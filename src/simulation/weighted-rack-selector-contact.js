import * as T from 'three';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {plate, poly, circle, capsule, polygonClipping as clip} from './finite-plate-geometry.js';

// Brown's elbow lever C: a broad curved arm (about half the rack's width)
// hanging from the pivot, and a short straight arm running left from it to a
// small knob under its tip. Spring d, hooked just below the pivot, returns C
// to its rest angle (prescribed: Brown draws no fixed stop for it).
// Rack A1 carries one rigid protrusion running diagonally up and to the left
// from its upper end, with a roller at its tip (pass 91: Brown draws no
// pivoting piece here). As A1 rises on its working (inner) branch the roller
// meets the convex lower edge of C's curved arm and swings C round against
// spring d. At the top the loaded spring presses C back on the roller; that
// thrust points down and outward, so it carries A1's pin over the upper angle
// of guide b, and C follows the roller back to rest.
const R = 2;
export const selectorGeometry = Object.freeze({
  radius: R, halfWidth: .085, tipHalfWidth: .06, endAngle: -1.1,
  shortArmEnd: [-1.03, .03], shortArmHalfWidth: .07, bossRadius: .16, boreRadius: .064,
  restAngle: 0, stopRadius: .045, springStud: [0, -.33],
  rollerRadius: .10, rollerAxleRadius: .045,
  // The roller in A1's own frame (pivot a at the origin, the rack along +y),
  // and the foot of the diagonal protrusion on the rack's centre line.
  roller: [-.25, 5.35], protrusionFoot: [0, 4.80], protrusionHalfWidth: .08,
});
const g = selectorGeometry;
// The curved arm's convex (lower right) edge is a true circle of radius
// R + halfWidth about the arm's centre, which lies R to the left of the
// pivot in C's frame; the roller rides on it.
const contactRadius = R + g.halfWidth + g.rollerRadius;
// The knob's centre under the short arm's end (Brown's small circle).
const stopCenter = (() => {
  const [ex, ey] = g.shortArmEnd, length = Math.hypot(ex, ey), f = (length - .08) / length;
  // Offset square to the arm's edge (it rises slightly to the left).
  const nx = ey / length, ny = -ex / length, offset = g.shortArmHalfWidth + g.stopRadius + .0002;
  return [ex * f - nx * offset, ey * f - ny * offset];
})();
export function selectorRollerCenter(rightPose, pivot) {
  const a = rightPose.rackAngle, c = Math.cos(a), s = Math.sin(a), [lx, ly] = g.roller;
  return {x: rightPose.pivot.x + lx * c - ly * s - pivot.x, y: rightPose.pivot.y + lx * s + ly * c - pivot.y};
}
const armCentre = angle => ({x: R * Math.cos(Math.PI + angle), y: R * Math.sin(Math.PI + angle)});
const contactGap = (q, angle) => {const o = armCentre(angle); return Math.hypot(q.x - o.x, q.y - o.y) - contactRadius;};
// C rests at its rest angle until the roller reaches its arm; then C takes
// the angle at which the arm's convex edge just touches the roller (found by
// bisection on the monotone branch). No physics stepping.
export function selectorState(rightPose, pivot) {
  const q = selectorRollerCenter(rightPose, pivot), rest = g.restAngle;
  let angle = rest;
  if (contactGap(q, rest) < 0) {
    let hi = rest, lo = rest - 1.2;
    if (contactGap(q, lo) < 0) throw new Error('391 selector has no admissible contact branch');
    for (let i = 0; i < 60; i++) {const mid = (hi + lo) / 2; if (contactGap(q, mid) < 0) hi = mid; else lo = mid;}
    angle = lo;
  }
  const o = armCentre(angle), length = Math.hypot(q.x - o.x, q.y - o.y);
  const normal = {x: (q.x - o.x) / length, y: (q.y - o.y) / length};
  const point = {x: q.x - g.rollerRadius * normal.x, y: q.y - g.rollerRadius * normal.y};
  const arm = {x: q.x + pivot.x - rightPose.pivot.x, y: q.y + pivot.y - rightPose.pivot.y};
  const contact = angle < rest - 1e-9;
  // The contact point's angle round the arm's centre, in C's own frame
  // (0 at the pivot, endAngle at the tip).
  const armAngle = Math.atan2(normal.y, normal.x) - angle;
  return {leverAngle: angle, springDeflection: rest - angle, contact, gap: Math.max(0, contactGap(q, rest)),
    point, normal, armAngle,
    rackTorquePerNormalForce: arm.x * normal.y - arm.y * normal.x,
    leverTorquePerNormalForce: -(point.x * normal.y - point.y * normal.x), q};
}

export function installWeightedRackSelector(root) {
  const d = root.userData, b = d.blocks;
  const lever = b.elbowLever;
  // C: the curved arm (a circular arc whose convex edge stays at a constant
  // radius, tapering on its concave side to a rounded tip), the short
  // straight arm and the pivot boss, as one plate.
  const arm = [], n = 160;
  const halfAt = i => g.halfWidth + (g.tipHalfWidth - g.halfWidth) * i / n;
  const tipWidth = g.tipHalfWidth;
  for (let i = 0; i <= n; i++) {const a = g.endAngle * i / n; arm.push([-R + (R + g.halfWidth) * Math.cos(a), (R + g.halfWidth) * Math.sin(a)]);}
  // Round tip: a semicircle joining the outer and inner edges at endAngle.
  const outerEnd = R + g.halfWidth, innerEnd = R + g.halfWidth - 2 * tipWidth, midEnd = (outerEnd + innerEnd) / 2;
  const tipCentre = [-R + midEnd * Math.cos(g.endAngle), midEnd * Math.sin(g.endAngle)];
  for (let i = 1; i < 24; i++) {const a = g.endAngle - Math.PI * i / 24; arm.push([tipCentre[0] + tipWidth * Math.cos(a), tipCentre[1] + tipWidth * Math.sin(a)]);}
  for (let i = n; i >= 0; i--) {const a = g.endAngle * i / n, inner = R + g.halfWidth - 2 * halfAt(i); arm.push([-R + inner * Math.cos(a), inner * Math.sin(a)]);}
  const outline = clip.difference(clip.union(poly(arm), capsule([0, 0], g.shortArmEnd, g.shortArmHalfWidth, 32),
    poly(circle([0, 0], g.bossRadius, 64)),
    // Brown's small knob under the short arm's tip is carried on C itself (pass 82):
    // a boss hanging from the tip, not a pin floating on nothing.
    poly(circle(stopCenter, g.stopRadius + .03, 48))), poly(circle([0, 0], g.boreRadius, 64)));
  const cam = lever.children[0]; cam.geometry.dispose();
  cam.geometry = plate(outline, .23, .37);
  cam.userData.role = 'elbow-lever-C-curved-arm-short-arm-and-bored-pivot';
  const pivotPin = lever.children[1]; pivotPin.geometry.dispose();
  // C's fixed pivot pin stands free, as Brown draws it (p79): a short pin
  // through C's boss, proud of both faces, with no lug or bracket.
  const pinBack = .20, pinFront = .40;
  pivotPin.geometry = new T.CylinderGeometry(g.boreRadius - .004, g.boreRadius - .004, pinFront - pinBack, 32); // the mesh stands along z
  pivotPin.position.z = (pinFront + pinBack) / 2;
  const add = (geometry, material, role, parent) => {const o = new T.Mesh(geometry, material); o.userData.role = role; parent.add(o); o.castShadow = o.receiveShadow = true; return o;};
  // Rack A1's rigid protrusion: it runs up and to the left from the rack's
  // top, above the last tooth, and ends in an eye round the roller's axle.
  // Rack and protrusion are one extrusion (Brown draws no joint between
  // them). The axle stands forward out of the eye to C's plane, where the
  // roller turns on it.
  const rack = b.rightRack, rackDepth = d.geometry.rackDepth, body = rack.userData.body;
  body.geometry.computeBoundingBox();
  const bodyBox = body.geometry.boundingBox;
  const bodyOutline = clip.difference(clip.union(
    poly([[bodyBox.min.x, bodyBox.min.y], [bodyBox.max.x, bodyBox.min.y], [bodyBox.max.x, bodyBox.max.y], [bodyBox.min.x, bodyBox.max.y]]),
    capsule(g.protrusionFoot, g.roller, g.protrusionHalfWidth, 32), poly(circle(g.roller, .12, 64))),
  poly(circle([0, 0], .089, 48)), poly(circle(g.roller, g.rollerAxleRadius + .002, 48)));
  body.geometry.dispose();
  body.geometry = plate(bodyOutline, bodyBox.min.z, bodyBox.max.z);
  body.userData.role = 'right-rack-A1-straight-bar-with-rigid-diagonal-protrusion';
  const protrusion = body;
  const roller = add(boredLatheGeometry([{axial: -.06, radial: g.rollerRadius}, {axial: .06, radial: g.rollerRadius}], g.rollerAxleRadius + .003, 64),
    rack.userData.pivotBore.material, 'roller-on-protrusion-bearing-on-elbow-lever-C', rack);
  // C's plate lies 0.36..0.50 in world depth; the rack is centred at 0.12.
  const rollerZ = lever.position.z + .30 - rack.position.z;
  roller.rotation.x = Math.PI / 2; roller.position.set(...g.roller, rollerZ);
  const axleBack = -rackDepth / 2 + .02, axleFront = rollerZ + .085;
  const axle = add(new T.CylinderGeometry(g.rollerAxleRadius, g.rollerAxleRadius, axleFront - axleBack, 32), roller.material, 'roller-axle-in-protrusion-eye', rack);
  axle.rotation.x = Math.PI / 2; axle.position.set(...g.roller, (axleFront + axleBack) / 2);
  // Spring d's stud just below the pivot, standing out to the spring's plane.
  // Its back end stops just inside C's plate (not flush with C's rear face).
  const stud = add(new T.CylinderGeometry(.055, .055, .33, 32).rotateX(Math.PI / 2), roller.material, 'elbow-spring-attachment-standoff', lever);
  stud.position.set(...g.springStud, .405);
  // Brown's small knob under the short arm's tip: a stud standing out of the
  // boss on C's front face, so it swings with C (Brown draws nothing fixed
  // there to carry a separate stop pin).
  const stop = add(new T.CylinderGeometry(g.stopRadius, g.stopRadius, .08, 32).rotateX(Math.PI / 2), roller.material, 'knob-under-tip-of-short-arm-of-C', lever);
  stop.position.set(...stopCenter, .41);
  b.leverContactIndex.geometry.dispose(); b.leverContactIndex.geometry = new T.SphereGeometry(.028, 16, 10);
  // Plate ink, not a part: the contact marker stays hidden.
  b.leverContactIndex.visible = false;
  d.updateSelectorContact = state => {
    const p = state.elbowAssist.point;
    b.leverContactIndex.position.set(p.x, p.y, .47);
    b.leverContactIndex.visible = false;
  };
  Object.assign(b, {elbowCam: cam, elbowProtrusion: protrusion, elbowRoller: roller, elbowRollerAxle: axle, elbowSpringStud: stud, elbowRestStop: stop});
  d.selectorContactReview = {...selectorGeometry, stopCenter, contactRadius,
    qualification: 'The roller on A1\'s rigid protrusion bears directly on the convex edge of C\'s curved arm, so C\'s angle follows exactly from the prescribed rack trajectory. Spring torque and contact-normal direction are checked; inertia and passive branch dynamics remain prescribed, not a native force solution.'};
}
