import * as T from 'three';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {plate, poly, circle, capsule, polygonClipping as clip} from './finite-plate-geometry.js';

// Brown's elbow lever C: a slim curved arm hanging from the pivot, a short
// straight arm running left from it to a small knob under its tip, and a short link
// hung from a pin on the curved arm, whose lower end bears on the top of rack
// A1. Spring d, hooked just below the pivot, returns C to its rest angle
// (prescribed: Brown draws no fixed stop for it).
// The link is a two-force strut: when the rack's top lug roller meets its
// rounded end, the link lines up between its pin and the roller, and the
// rising rack swings C back against the spring. At the upper corner the
// loaded spring pushes back down the link and carries the rack's pin outward
// over the angle of guide b; C then comes back to rest and the free link
// falls back to hang from its pin.
const R = 2, pinPhi = -.6;
export const selectorGeometry = Object.freeze({
  radius: R, halfWidth: .04, tipHalfWidth: .03, endAngle: -1.1,
  shortArmEnd: [-1.03, .03], shortArmHalfWidth: .04, bossRadius: .13, boreRadius: .064,
  linkPin: [-R + R * Math.cos(pinPhi), R * Math.sin(pinPhi)], linkPinRadius: .03,
  linkLength: .8, linkHalfWidth: .045, linkEyeRadius: .075,
  restAngle: 0, stopRadius: .045, springStud: [0, -.33],
  rollerRadius: .10,
  // The roller stands straight under the link pin (C at rest), so the
  // hanging link is met end-on: C's pivot is 0.38 right of rack A1's axis,
  // which keeps the roller within A1's width on its front face.
  lugX: .38 + (-R + R * Math.cos(pinPhi)), lugAboveGuide: -.75,
});
const g = selectorGeometry;
// The knob's centre under the short arm's end (Brown's small circle).
const stopCenter = (() => {
  const [ex, ey] = g.shortArmEnd, length = Math.hypot(ex, ey), f = (length - .08) / length;
  // Offset square to the arm's edge (it rises slightly to the left).
  const nx = ey / length, ny = -ex / length, offset = g.shortArmHalfWidth + g.stopRadius + .0002;
  return [ex * f - nx * offset, ey * f - ny * offset];
})();
const strutLength = g.linkLength + g.linkHalfWidth + g.rollerRadius;
const rotate = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
export function selectorRollerCenter(rightPose, guideY, pivot) {
  const a = rightPose.rackAngle, c = Math.cos(a), s = Math.sin(a), lx = g.lugX, ly = guideY + g.lugAboveGuide;
  return {x: rightPose.pivot.x + lx * c - ly * s - pivot.x, y: rightPose.pivot.y + lx * s + ly * c - pivot.y};
}
const strutGap = (q, angle) => {
  const [px, py] = rotate(g.linkPin, angle);
  return Math.hypot(q.x - px, q.y - py) - strutLength;
};
// C rests at its rest angle until the roller comes within reach of the hanging
// link; then C takes the angle at which the link spans exactly from its pin to
// the roller (found by a monotone scan and bisection). No physics stepping.
export function selectorState(rightPose, guideY, pivot) {
  const q = selectorRollerCenter(rightPose, guideY, pivot), rest = g.restAngle;
  let angle = rest;
  if (strutGap(q, rest) < 0) {
    let hi = rest, lo = rest;
    while (strutGap(q, lo) < 0) {hi = lo; lo -= .01; if (lo < rest - 1.2) throw new Error('391 selector has no admissible strut branch');}
    for (let i = 0; i < 48; i++) {const mid = (hi + lo) / 2; if (strutGap(q, mid) < 0) hi = mid; else lo = mid;}
    angle = lo;
  }
  const [px, py] = rotate(g.linkPin, angle), length = Math.hypot(q.x - px, q.y - py);
  const normal = {x: (q.x - px) / length, y: (q.y - py) / length};
  const end = {x: px + g.linkLength * normal.x, y: py + g.linkLength * normal.y};
  const arm = {x: q.x + pivot.x - rightPose.pivot.x, y: q.y + pivot.y - rightPose.pivot.y};
  const contact = angle < rest - 1e-9;
  return {leverAngle: angle, springDeflection: rest - angle, contact, gap: strutGap(q, rest) > 0 ? strutGap(q, rest) : 0,
    point: {x: end.x + g.linkHalfWidth * normal.x, y: end.y + g.linkHalfWidth * normal.y},
    linkPin: {x: px, y: py}, strutAngle: Math.atan2(normal.y, normal.x), normal,
    rackTorquePerNormalForce: arm.x * normal.y - arm.y * normal.x,
    leverTorquePerNormalForce: -(q.x * normal.y - q.y * normal.x), q};
}

// The free link hangs from its pin. From the moment C lets it go at the upper
// corner, it falls back to hang straight down (a damped fall, prescribed as a
// cubic from its release angle and rate to rest in fallTime).
export function makeSelectorLinkSchedule(stateAtCycleTime, cycleDuration, fallTime = .7) {
  const n = 4000, hang = -Math.PI / 2;
  let release = null;
  for (let i = 1; i <= n; i++) {
    const t = cycleDuration * i / n, before = stateAtCycleTime(cycleDuration * (i - 1) / n);
    if (before.contact && !stateAtCycleTime(t).contact) {
      let lo = cycleDuration * (i - 1) / n, hi = t;
      for (let k = 0; k < 50; k++) {const mid = (lo + hi) / 2; if (stateAtCycleTime(mid).contact) lo = mid; else hi = mid;}
      release = lo; break;
    }
  }
  if (release === null) throw new Error('391 selector link never released');
  const h = 1e-5, a1 = stateAtCycleTime(release).strutAngle, w1 = (a1 - stateAtCycleTime(release - h).strutAngle) / h;
  return {release, fallTime, angleAt(cycleTime, state) {
    if (state.contact) return state.strutAngle;
    const u = (cycleTime - release) / fallTime;
    if (u < 0 || u >= 1) return hang;
    const d = a1 - hang, v = w1 * fallTime;
    // Hermite from (a1, w1) to (hang, 0).
    return hang + d * (2 * u ** 3 - 3 * u ** 2 + 1) + v * (u ** 3 - 2 * u ** 2 + u);
  }};
}

export function installWeightedRackSelector(root) {
  const d = root.userData, b = d.blocks, G = d.geometry, lx = g.lugX, ly = G.guideY + g.lugAboveGuide;
  const lever = b.elbowLever;
  // C: the curved arm (a circular arc, tapering slightly to its rounded tip),
  // the short straight arm and the pivot boss, as one plate.
  const arm = [], n = 160;
  const halfAt = i => g.halfWidth + (g.tipHalfWidth - g.halfWidth) * i / n;
  for (let i = 0; i <= n; i++) {const a = g.endAngle * i / n, w = halfAt(i); arm.push([-R + (R + w) * Math.cos(a), (R + w) * Math.sin(a)]);}
  const tip = [-R + R * Math.cos(g.endAngle), R * Math.sin(g.endAngle)];
  for (let i = 1; i < 24; i++) {const a = g.endAngle - Math.PI * i / 24; arm.push([tip[0] + g.tipHalfWidth * Math.cos(a), tip[1] + g.tipHalfWidth * Math.sin(a)]);}
  for (let i = n; i >= 0; i--) {const a = g.endAngle * i / n, w = halfAt(i); arm.push([-R + (R - w) * Math.cos(a), (R - w) * Math.sin(a)]);}
  const outline = clip.difference(clip.union(poly(arm), capsule([0, 0], g.shortArmEnd, g.shortArmHalfWidth, 32),
    poly(circle([0, 0], g.bossRadius, 64)), poly(circle(g.linkPin, g.linkPinRadius + .035, 48)),
    // Brown's small knob under the short arm's tip is carried on C itself (pass 82):
    // a boss hanging from the tip, not a pin floating on nothing.
    poly(circle(stopCenter, g.stopRadius + .03, 48))), poly(circle([0, 0], g.boreRadius, 64)));
  const cam = lever.children[0]; cam.geometry.dispose();
  cam.geometry = plate(outline, .23, .37);
  cam.userData.role = 'elbow-lever-C-curved-arm-short-arm-and-bored-pivot';
  const pivotPin = lever.children[1]; pivotPin.geometry.dispose();
  pivotPin.geometry = new T.CylinderGeometry(g.boreRadius - .004, g.boreRadius - .004, .20, 32); // the mesh stands along z
  pivotPin.position.z = .30; // just through C's boss
  const add = (geometry, material, role, parent) => {const o = new T.Mesh(geometry, material); o.userData.role = role; parent.add(o); o.castShadow = o.receiveShadow = true; return o;};
  // The link: a flat bar with an eye at its pin and a rounded lower end, in
  // front of C, swinging on a pin fixed in C.
  const linkPivot = new T.Group(); linkPivot.position.set(...g.linkPin, 0); linkPivot.userData.role = 'short-link-swinging-on-pin-in-C'; lever.add(linkPivot);
  const linkOutline = clip.difference(clip.union(capsule([0, 0], [g.linkLength, 0], g.linkHalfWidth, 32), poly(circle([0, 0], g.linkEyeRadius, 48))),
    poly(circle([0, 0], g.linkPinRadius + .004, 32)));
  const link = add(plate(linkOutline, .38, .46), cam.material, 'short-link-bearing-on-top-of-rack-A1', linkPivot);
  const linkPin = add(new T.CylinderGeometry(g.linkPinRadius, g.linkPinRadius, .27, 24).rotateX(Math.PI / 2), pivotPin.material, 'pin-in-C-carrying-the-short-link', lever);
  linkPin.position.set(...g.linkPin, .345);
  // Rack A1's top lug and its roller, standing forward to the link's plane.
  const rackAdd = (geometry, material, role) => add(geometry, material, role, b.rightRack);
  // The roller's axle stands in A1's front face; a thin collar seats it
  // there, within the rack's width and behind C's plate.
  const lug = rackAdd(plate(clip.difference(poly(circle([lx, ly], .085, 64)), poly(circle([lx, ly], .056, 64))), .18, .222),
    b.rightRack.userData.body.material, 'upper-rack-lug-carrying-roller-for-link-of-C');
  const roller = rackAdd(boredLatheGeometry([{axial: -.06, radial: g.rollerRadius}, {axial: .06, radial: g.rollerRadius}], .058, 64), b.rightRack.userData.pivotBore.material, 'upper-rack-lug-roller-under-link-of-C');
  roller.rotation.x = Math.PI / 2; roller.position.set(lx, ly, .43);
  const axle = rackAdd(new T.CylinderGeometry(.055, .055, .45, 32), roller.material, 'upper-lug-roller-axle');
  axle.rotation.x = Math.PI / 2; axle.position.set(lx, ly, .245);
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
  d.updateSelectorContact = state => {
    const e = state.elbowAssist, p = e.point;
    b.leverContactIndex.position.set(p.x, p.y, .47);
    linkPivot.rotation.z = e.linkAngle - e.leverAngle;
  };
  Object.assign(b, {elbowCam: cam, elbowLink: link, elbowLinkPivot: linkPivot, elbowLinkPin: linkPin, elbowLug: lug, elbowRoller: roller, elbowRollerAxle: axle, elbowSpringStud: stud, elbowRestStop: stop});
  d.selectorContactReview = {...selectorGeometry, stopCenter, strutLength,
    qualification: 'The link is an ideal two-force strut between its pin in C and the rack\'s lug roller, so C\'s angle follows exactly from the prescribed rack trajectory. Spring torque and contact-normal direction are checked; guide-corner scheduling, inertia, the free link\'s fall and passive branch dynamics remain prescribed, not a native force solution.'};
}
