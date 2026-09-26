import { correctCraneBrakeJoints, correctSpatialPulley, finishBandDrive } from './band-drive-working-parts.js';
import {correctChainDrive} from './chain-drive-working-parts.js';
import { ropeDrumSpokeShape } from './rope-drum-spoke.js';
import { filletPulleySpokes } from './spoked-wheel.js';
import { HelicalDrumWrap } from './helical-drum-wrap.js';
import { ceilingAnchoredEightToOneCascade, sixPulleyCascade, loadAnchoredSevenToOneCascade, loadAnchoredThreeToOneCascade } from './authored-cascades.js';
import * as THREE from 'three';
import {correctClampParts} from './clamp-working-parts.js';
import { plate, poly, circle, polygonClipping } from './finite-plate-geometry.js';
import {windlassSheaveGeometry,windlassHookGeometry,windingAdvance} from './windlass-hardware.js';
import { makeMiterGear } from './miter-gear.js';
import { whitePulleys } from './authored-white-pulleys.js';
import { twoFixedOneMovable } from './authored-fixed-tackle.js';
import { spanishBartonFourToOne, spanishBartonFiveToOne } from './authored-bartons.js';
import { makeHoistLoad, makeSheaveHanger, makeTackleCase } from './hoist-hardware.js';
import { LAID_ROPE, makeLaidRopeMesh } from './laid-rope.js';
import { makeHaulingHand } from './hauling-hand.js';
import { freezeFitBoundsWithout } from './back-plate-support.js';
import {
  CircularArcCurve3,
  PALETTE,
  beltCurveCrossed,
  beltCurveOpen,
  circularArcThrough,
  makeBeam,
  makeConePulley,
  makeDynamicCable,
  makeDynamicLink,
  makeDynamicMovingBelt,
  makeMovingBelt,
  makePulley,
  makeShaft,
  makeSteppedPulley,
  markShadows,
  matte,
  setSpin,
  smoothStep01,
} from './primitives.js';

const Z_AXIS = new THREE.Vector3(0, 0, 1);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

// Hold a flat band parallel to each pulley axis on its wrap, and distribute
// the quarter-turn twist over the free leaves between perpendicular shafts.
function contactWidthDirection(curve, rawAxes) {
  const lengths = curve.getCurveLengths();
  const total = lengths.at(-1);
  // Sign the contact axes consistently around the loop. Negating only a free
  // leaf's end (as before) left the next wrap using the opposite sign, so one
  // belt section flipped inside out there: a crossed quad in the rendered band.
  const axes = rawAxes.map((axis) => axis?.clone() ?? null);
  let previousAxis = null;
  for (const axis of axes) {
    if (!axis) continue;
    if (previousAxis && axis.dot(previousAxis) < 0) axis.negate();
    previousAxis = axis;
  }
  const firstAxis = axes.find(Boolean);
  if (firstAxis && previousAxis && firstAxis.dot(previousAxis) < 0) {
    // An odd half-twist cannot be signed consistently; keep the raw axes.
    rawAxes.forEach((axis, index) => { axes[index] = axis; });
  }
  return (u) => {
    const distance = curve.getUtoTmapping(u) * total;
    let index = lengths.findIndex((length) => distance <= length);
    if (index < 0) index = lengths.length - 1;
    if (axes[index]) return axes[index];
    const start = index > 0 ? lengths[index - 1] : 0;
    const fraction = (distance - start) / (lengths[index] - start);
    let previous = (index - 1 + axes.length) % axes.length;
    let next = (index + 1) % axes.length;
    while (!axes[previous]) previous = (previous - 1 + axes.length) % axes.length;
    while (!axes[next]) next = (next + 1) % axes.length;
    const end = axes[next].clone();
    if (end.dot(axes[previous]) < 0) end.negate();
    return axes[previous].clone().lerp(end, smoothStep01(fraction)).normalize();
  };
}

function orientVerticalSpeedDrive(root) {
  // Local X separates the shafts, local Z runs along them. Brown shows the
  // first shaft above the second, with both axes horizontal across the page.
  root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    new THREE.Vector3(0, -1, 0), Z_AXIS, new THREE.Vector3(-1, 0, 0),
  ));
}

// Generic rectangular scenery obscured the actual belt paths and was not part
// of Brown's mechanisms. Movement-specific supports are still authored where
// they carry a load or constrain a moving block.
function addBackdropFrame() {}

function addAxle(root, position, length = 1.5, axis = Z_AXIS) {
  const shaft = makeShaft({ length, radius: 0.075, color: PALETTE.ink, axis });
  shaft.position.copy(position);
  root.add(shaft);
  return shaft;
}

// A pulley keyed to its shaft turns the shaft with it, so the shaft is carried
// by the pulley rotor rather than passing through an unbored rotating hub.
function addKeyedShaft(pulley, length = 1.5, radius = 0.075) {
  const shaft = makeShaft({ length, radius, color: PALETTE.ink });
  shaft.userData.role = 'keyed-shaft';
  pulley.userData.rotor.add(shaft);
  return shaft;
}

function setBeltActive(belt, active) {
  belt.visible = active;
  belt.userData.active = active;
}

function tangentPointsFromExternal(center, external, radius, axis) {
  const offset = external.clone().sub(center);
  const axialOffset = axis.dot(offset);
  if (Math.abs(axialOffset) > 1e-6) {
    throw new RangeError('External tangent point must lie in the pulley plane.');
  }
  const distanceSquared = offset.lengthSq();
  if (distanceSquared <= radius ** 2) {
    throw new RangeError('External tangent point must lie outside the pulley.');
  }
  const along = offset.clone().multiplyScalar(radius ** 2 / distanceSquared);
  const side = new THREE.Vector3()
    .crossVectors(axis, offset)
    .multiplyScalar(radius * Math.sqrt(distanceSquared - radius ** 2) / distanceSquared);
  return [
    center.clone().add(along).add(side),
    center.clone().add(along).sub(side),
  ];
}

function tangentFillet(vertex, fromPoint, toPoint, radius) {
  const incoming = vertex.clone().sub(fromPoint).normalize();
  const outgoing = toPoint.clone().sub(vertex).normalize();
  const towardIncoming = incoming.clone().negate();
  const wedgeAngle = Math.acos(THREE.MathUtils.clamp(towardIncoming.dot(outgoing), -1, 1));
  const tangentDistance = radius / Math.tan(wedgeAngle / 2);
  if (
    tangentDistance >= vertex.distanceTo(fromPoint)
    || tangentDistance >= vertex.distanceTo(toPoint)
  ) {
    throw new RangeError('Guide pulley is too large for its tangent spans.');
  }
  const bisector = towardIncoming.clone().add(outgoing).normalize();
  const center = vertex.clone().addScaledVector(bisector, radius / Math.sin(wedgeAngle / 2));
  const start = vertex.clone().addScaledVector(towardIncoming, tangentDistance);
  const end = vertex.clone().addScaledVector(outgoing, tangentDistance);
  const axis = new THREE.Vector3().crossVectors(incoming, outgoing).normalize();
  const arc = circularArcThrough(center, start, end, axis, incoming);
  return { arc, axis, center, end, start };
}

class BowedSpanCurve3 extends THREE.Curve {
  constructor(start, end, amplitude, direction, peak = 0.5) {
    super();
    this.start = start.clone();
    this.end = end.clone();
    this.amplitude = amplitude;
    this.direction = direction.clone().normalize();
    this.peak = peak;
  }

  getPoint(t, target = new THREE.Vector3()) {
    const phase = t <= this.peak ? t / this.peak : (1 - t) / (1 - this.peak);
    const envelope = Math.sin(Math.PI * phase / 2) ** 2;
    return target
      .copy(this.start)
      .lerp(this.end, t)
      .addScaledVector(this.direction, this.amplitude * envelope);
  }

  getTangent(t, target = new THREE.Vector3()) {
    const phase = t <= this.peak ? t / this.peak : (1 - t) / (1 - this.peak);
    const derivative = Math.PI / 2 * Math.sin(Math.PI * phase)
      * (t <= this.peak ? 1 / this.peak : -1 / (1 - this.peak));
    return target
      .subVectors(this.end, this.start)
      .addScaledVector(this.direction, this.amplitude * derivative)
      .normalize();
  }
}

class TangentCubicBezierCurve3 extends THREE.CubicBezierCurve3 {
  getTangent(t, target = new THREE.Vector3()) {
    const remaining = 1 - t;
    return target
      .copy(this.v1)
      .sub(this.v0)
      .multiplyScalar(3 * remaining ** 2)
      .addScaledVector(this.v2.clone().sub(this.v1), 6 * remaining * t)
      .addScaledVector(this.v3.clone().sub(this.v2), 3 * t ** 2)
      .normalize();
  }
}

class AxialWrapCurve3 extends THREE.Curve {
  constructor(center, radialStart, axis, sweep, axialTravel) {
    super();
    this.center = center.clone();
    this.radialStart = radialStart.clone();
    this.axis = axis.clone().normalize();
    this.sweep = sweep;
    this.axialTravel = axialTravel;
  }

  getPoint(t, target = new THREE.Vector3()) {
    return target
      .copy(this.radialStart)
      .applyAxisAngle(this.axis, this.sweep * t)
      .add(this.center)
      .addScaledVector(this.axis, this.axialTravel * (t - 0.5));
  }

  getTangent(t, target = new THREE.Vector3()) {
    const radial = this.radialStart.clone().applyAxisAngle(this.axis, this.sweep * t);
    return target
      .crossVectors(this.axis, radial)
      .multiplyScalar(this.sweep)
      .addScaledVector(this.axis, this.axialTravel)
      .normalize();
  }
}

// A taut crossed rope: both free runs are straight common tangents of the
// pulleys. So that the strands pass at the crossover, the run leaving the
// upper pulley lies wholly in front of the pulley mid-plane and the other
// wholly behind it; the rope shifts across the wide tread over each wrap
// (smoothly, with no axial slope where it meets a run).
class AxialShiftWrapCurve3 extends CircularArcCurve3 {
  constructor(arc, from, to) {
    super(arc.center, arc.radialStart, arc.axis, arc.sweep);
    this.from = from;
    this.to = to;
    this.arcLength = Math.abs(arc.sweep) * arc.radialStart.length();
  }

  getPoint(t, target = new THREE.Vector3()) {
    super.getPoint(t, target);
    return target.addScaledVector(this.axis, (this.to - this.from) * smoothStep01(t) + this.from);
  }

  getTangent(t, target = new THREE.Vector3()) {
    super.getTangent(t, target).multiplyScalar(this.arcLength);
    return target.addScaledVector(this.axis, (this.to - this.from) * 6 * t * (1 - t)).normalize();
  }
}

function tautCrossedRopeCurve(centerA, centerB, radius, offset) {
  const [firstSpan, secondArc, secondSpan, firstArc] = beltCurveCrossed(centerA, centerB, radius, radius).curves;
  const at = (point, z) => point.clone().setZ(z);
  const curve = new THREE.CurvePath();
  curve.add(new THREE.LineCurve3(at(firstSpan.start, offset), at(firstSpan.end, offset)));
  curve.add(new AxialShiftWrapCurve3(secondArc, offset, -offset));
  curve.add(new THREE.LineCurve3(at(secondSpan.start, -offset), at(secondSpan.end, -offset)));
  curve.add(new AxialShiftWrapCurve3(firstArc, -offset, offset));
  curve.userData = { crossoverLift: offset, selfIntersectionAvoidance: 'straight-runs-in-offset-planes' };
  return curve;
}

function simpleBeltTransmission(crossed = false) {
  const root = new THREE.Group();
  const upperCenter = new THREE.Vector2(0, 2.05);
  const lowerCenter = new THREE.Vector2(0, -2.05);
  // Brown hatches the band of 1 and 2 as a laid rope, about a fifteenth of
  // the pulley diameter across. Its centreline runs just outside the tread.
  const pulleyRadius = 0.808;
  const ropeRadius = 0.048;
  const radius = pulleyRadius + ropeRadius + 0.003;
  const driver = filletPulleySpokes(makePulley({ radius: pulleyRadius, width: 0.30, color: PALETTE.driver }));
  const driven = filletPulleySpokes(makePulley({ radius: pulleyRadius, width: 0.30, color: PALETTE.driven }));
  driver.position.set(upperCenter.x, upperCenter.y, 0);
  driven.position.set(lowerCenter.x, lowerCenter.y, 0);
  // Pass 58: the crossed rope of 2 is taut, its runs straight tangents.
  const belt = makeMovingBelt(
    crossed
      ? tautCrossedRopeCurve(upperCenter, lowerCenter, radius, ropeRadius + 0.018)
      : beltCurveOpen(upperCenter, lowerCenter, radius, radius),
    { radius: ropeRadius, laid: true, markerCount: 0 },
  );
  root.add(driver, driven, belt);
  addKeyedShaft(driver);
  addKeyedShaft(driven);
  const angularSpeed = 1.55;
  const beltSpeed = angularSpeed * radius;
  root.userData.mechanism = crossed
    ? 'single-crossed-belt-opposite-direction-pulley-drive'
    : 'single-open-belt-same-direction-pulley-drive';
  root.userData.blocks = { belt, driven, driver };
  root.userData.cameraFov = 18;
  root.userData.cameraDistanceScale = crossed ? 1.33 : 1.31;
  root.userData.kinematics = {
    beltSpeed,
    drivenAngularSpeed: crossed ? angularSpeed : -angularSpeed,
    drivenRadius: radius,
    driverAngularSpeed: -angularSpeed,
    driverRadius: radius,
  };

  return {
    root,
    cameraDirection: new THREE.Vector3(0.3, 0.15, 10),
    update(time) {
      const angle = time * angularSpeed;
      setSpin(driver, -angle);
      setSpin(driven, crossed ? angle : -angle);
      belt.userData.updateDistance(time * beltSpeed);
    },
  };
}

function rightAngleGuides() {
  const root = new THREE.Group();
  const drivenCenter = new THREE.Vector3(1.6, 1.5, 0);
  const driverCenter = new THREE.Vector3(-1.8, -2.65, 0);
  const guideVertex = new THREE.Vector3(driverCenter.x, 2.36, 0);
  // Brown hatches this band as a laid rope. Its centreline runs just outside
  // each tread, so the radii below are rope pitch radii.
  const ropeRadius = 0.045;
  const ropeLift = ropeRadius + 0.003;
  const drivenRadius = 0.868 + ropeLift;
  // Brown's drum is as tall as it is wide, about 0.92 of the wheel's diameter.
  const drumRadius = 0.798;
  const driverRadius = drumRadius + ropeLift;
  const driverWidth = 2 * (drumRadius + 0.012);
  const guideRadius = 0.428 + ropeLift;
  const driven = filletPulleySpokes(makePulley({ radius: drivenRadius - ropeLift, width: 0.38, color: PALETTE.driven, axis: Z_AXIS }));
  const driver = makePulley({ radius: drumRadius, width: driverWidth, hubLength: driverWidth + 0.1,
    spokes: 0, grooves: 0, color: PALETTE.driver, axis: X_AXIS });
  driven.position.copy(drivenCenter);
  driver.position.copy(driverCenter);
  // The rope winds on right of the drum's middle, as Brown draws it; the
  // drum's axis is X, so sliding it along X leaves the belt path unchanged.
  driver.position.x -= 0.09 * driverWidth;

  const drivenTangents = tangentPointsFromExternal(
    drivenCenter,
    guideVertex,
    drivenRadius,
    Z_AXIS,
  ).sort((first, second) => second.y - first.y);
  const driverTangents = tangentPointsFromExternal(
    driverCenter,
    guideVertex,
    driverRadius,
    X_AXIS,
  ).sort((first, second) => second.z - first.z);
  const firstGuide = tangentFillet(
    guideVertex,
    drivenTangents[0],
    driverTangents[0],
    guideRadius,
  );
  const returnGuideAt = (height) => {
    const vertex = guideVertex.clone().setY(height);
    const fromDriver = tangentPointsFromExternal(driverCenter, vertex, driverRadius, X_AXIS)
      .sort((a, b) => a.z - b.z)[0];
    const toDriven = tangentPointsFromExternal(drivenCenter, vertex, drivenRadius, Z_AXIS)
      .sort((a, b) => a.y - b.y)[0];
    return { guide: tangentFillet(vertex, fromDriver, toDriven, guideRadius), fromDriver, toDriven };
  };
  let lower = guideVertex.y;
  let upper = guideVertex.y + 2;
  for (let i = 0; i < 44; i += 1) {
    const height = (lower + upper) / 2;
    if (returnGuideAt(height).guide.center.y < firstGuide.center.y) lower = height;
    else upper = height;
  }
  const returnGuide = returnGuideAt((lower + upper) / 2);
  const secondGuide = returnGuide.guide;
  driverTangents[1] = returnGuide.fromDriver;
  drivenTangents[1] = returnGuide.toDriven;
  const driverArc = circularArcThrough(
    driverCenter,
    driverTangents[0],
    driverTangents[1],
    X_AXIS,
    driverTangents[0].clone().sub(firstGuide.end).normalize(),
  );
  const drivenArc = circularArcThrough(
    drivenCenter,
    drivenTangents[1],
    drivenTangents[0],
    Z_AXIS,
    drivenTangents[1].clone().sub(secondGuide.end).normalize(),
  );
  // Brown places the guide wheels side by side, one for each leaf. Give
  // their complete rims axial clearance and distribute the resulting skew
  // over the free ribbon leaves, preserving every pulley-entry tangent.
  const guideOffsets = [new THREE.Vector3(0, 0, 0.30), new THREE.Vector3(0, 0, -0.30)];
  const freeLeaf = (start, end, startOffset = new THREE.Vector3(), endOffset = new THREE.Vector3()) => {
    const handle = end.clone().sub(start).multiplyScalar(1 / 3);
    const a = start.clone().add(startOffset);
    const b = end.clone().add(endOffset);
    return new TangentCubicBezierCurve3(a, a.clone().add(handle), b.clone().sub(handle), b);
  };
  const firstStart = firstGuide.start.clone();
  const firstEnd = firstGuide.end.clone();
  const secondStart = secondGuide.start.clone();
  const secondEnd = secondGuide.end.clone();
  for (const [index, guide] of [firstGuide, secondGuide].entries()) {
    guide.center.add(guideOffsets[index]);
    guide.arc.center.add(guideOffsets[index]);
  }
  const beltCurve = new THREE.CurvePath();
  beltCurve.add(freeLeaf(drivenTangents[0], firstStart, undefined, guideOffsets[0]));
  beltCurve.add(firstGuide.arc);
  beltCurve.add(freeLeaf(firstEnd, driverTangents[0], guideOffsets[0]));
  beltCurve.add(driverArc);
  beltCurve.add(freeLeaf(driverTangents[1], secondStart, undefined, guideOffsets[1]));
  beltCurve.add(secondGuide.arc);
  beltCurve.add(freeLeaf(secondEnd, drivenTangents[1], guideOffsets[1]));
  beltCurve.add(drivenArc);

  const guideA = makePulley({
    radius: guideRadius - ropeLift,
    width: 0.23,
    color: PALETTE.accent,
    axis: firstGuide.axis,
    spokes: 0,
  });
  const guideB = makePulley({
    radius: guideRadius - ropeLift,
    width: 0.23,
    color: PALETTE.accent,
    axis: secondGuide.axis,
    spokes: 0,
  });
  guideA.position.copy(firstGuide.center);
  guideB.position.copy(secondGuide.center);
  const belt = makeMovingBelt(beltCurve, { radius: ropeRadius, laid: true, markerCount: 0 });
  root.add(driver, driven, guideA, guideB, belt);
  addKeyedShaft(driver, driverWidth + 0.3);
  addKeyedShaft(driven, 1.45);
  addKeyedShaft(guideA, 0.32);
  addKeyedShaft(guideB, 0.32);
  root.userData.mechanism = 'right-angle-guide-pulley-drive';
  root.userData.blocks = { driver, driven, guideA, guideB, belt };
  // Brown draws the weight drum flat, as a square block with no end faces or
  // ground. A narrow field of view from further off keeps the near-orthographic
  // elevation, so the off-axis drum no longer swells and shows both ends.
  root.userData.cameraFov = 9;
  root.userData.hideGround = true;
  root.userData.beltContacts = [
    { object: driver, radius: driverRadius, axis: X_AXIS.clone(), arc: driverArc },
    { object: driven, radius: drivenRadius, axis: Z_AXIS.clone(), arc: drivenArc },
    { object: guideA, radius: guideRadius, axis: firstGuide.axis.clone(), arc: firstGuide.arc },
    { object: guideB, radius: guideRadius, axis: secondGuide.axis.clone(), arc: secondGuide.arc },
  ];

  return {
    root,
    cameraDirection: new THREE.Vector3(0.3, 0.15, 10),
    update(time) {
      const beltDistance = time * 0.8;
      setSpin(driver, Math.sign(driverArc.sweep) * beltDistance / driverRadius);
      setSpin(driven, Math.sign(drivenArc.sweep) * beltDistance / drivenRadius);
      setSpin(guideA, Math.sign(firstGuide.arc.sweep) * beltDistance / guideRadius);
      setSpin(guideB, Math.sign(secondGuide.arc.sweep) * beltDistance / guideRadius);
      belt.userData.updateDistance(beltDistance);
    },
  };
}

function rightAngleCrossed() {
  const root = new THREE.Group();
  const driverCenter = new THREE.Vector3(0, 2.1, 0);
  const drivenCenter = new THREE.Vector3(0, -2.55, 0);
  const leftVertex = new THREE.Vector3(-3.3, drivenCenter.y, 0);
  const rightVertex = new THREE.Vector3(3.3, drivenCenter.y, 0);
  const driverRadius = 0.88;
  const drivenRadius = 0.58;
  const guideRadius = 0.48;
  const driver = filletPulleySpokes(makePulley({
    radius: driverRadius - 0.05,
    width: 0.4,
    color: PALETTE.driver,
    axis: Z_AXIS,
  }));
  const driven = filletPulleySpokes(makePulley({
    radius: drivenRadius - 0.05,
    width: 0.5,
    color: PALETTE.driven,
    grooves: 1,
    axis: Y_AXIS,
  }));
  driver.position.copy(driverCenter);
  driven.position.copy(drivenCenter);

  // The opposite upper tangencies make the two long leaves cross, while the
  // lower tangencies put both leaves on the same face of the upright pulley.
  const driverLeftTangent = tangentPointsFromExternal(
    driverCenter,
    leftVertex,
    driverRadius,
    Z_AXIS,
  ).sort((first, second) => second.x - first.x)[0];
  const driverRightTangent = tangentPointsFromExternal(
    driverCenter,
    rightVertex,
    driverRadius,
    Z_AXIS,
  ).sort((first, second) => first.x - second.x)[0];
  const drivenLeftTangent = tangentPointsFromExternal(
    drivenCenter,
    leftVertex,
    drivenRadius,
    Y_AXIS,
  ).sort((first, second) => second.z - first.z)[0];
  const drivenRightTangent = tangentPointsFromExternal(
    drivenCenter,
    rightVertex,
    drivenRadius,
    Y_AXIS,
  ).sort((first, second) => second.z - first.z)[0];
  const leftGuideContact = tangentFillet(
    leftVertex,
    driverLeftTangent,
    drivenLeftTangent,
    guideRadius,
  );
  const rightGuideContact = tangentFillet(
    rightVertex,
    drivenRightTangent,
    driverRightTangent,
    guideRadius,
  );
  const drivenEntryArc = circularArcThrough(
    drivenCenter,
    drivenLeftTangent,
    drivenRightTangent,
    Y_AXIS,
    drivenLeftTangent.clone().sub(leftGuideContact.end).normalize(),
  );
  const wrapSweep = drivenEntryArc.sweep + Math.sign(drivenEntryArc.sweep) * Math.PI * 4;
  const drivenWrap = new AxialWrapCurve3(
    drivenCenter,
    drivenLeftTangent.clone().sub(drivenCenter),
    Y_AXIS,
    wrapSweep,
    0.30,
  );
  const driverArc = circularArcThrough(
    driverCenter,
    driverRightTangent,
    driverLeftTangent,
    Z_AXIS,
    driverRightTangent.clone().sub(rightGuideContact.end).normalize(),
  );
  const tangentTransition = (start, end, startTangent, endTangent) => {
    const handleLength = Math.min(0.34, start.distanceTo(end) * 0.36);
    return new TangentCubicBezierCurve3(
      start,
      start.clone().addScaledVector(startTangent, handleLength),
      end.clone().addScaledVector(endTangent, -handleLength),
      end,
    );
  };
  const wrapStart = drivenWrap.getPoint(0);
  const wrapEnd = drivenWrap.getPoint(1);
  // The leaves bow apart axially where their projections cross.
  const crossingParameters = (() => {
    const p = driverLeftTangent;
    const r = leftGuideContact.start.clone().sub(p);
    const q = rightGuideContact.end;
    const s = driverRightTangent.clone().sub(q);
    const cross = (a, b) => a.x * b.y - a.y * b.x;
    const d = q.clone().sub(p);
    return [cross(d, s) / cross(r, s), cross(d, r) / cross(r, s)];
  })();
  const beltCurve = new THREE.CurvePath();
  beltCurve.add(new BowedSpanCurve3(
    driverLeftTangent,
    leftGuideContact.start,
    0.22,
    Z_AXIS,
    crossingParameters[0],
  ));
  beltCurve.add(leftGuideContact.arc);
  beltCurve.add(tangentTransition(
    leftGuideContact.end,
    wrapStart,
    leftGuideContact.arc.getTangent(1),
    drivenWrap.getTangent(0),
  ));
  beltCurve.add(drivenWrap);
  beltCurve.add(tangentTransition(
    wrapEnd,
    rightGuideContact.start,
    drivenWrap.getTangent(1),
    rightGuideContact.arc.getTangent(0),
  ));
  beltCurve.add(rightGuideContact.arc);
  beltCurve.add(new BowedSpanCurve3(
    rightGuideContact.end,
    driverRightTangent,
    -0.22,
    Z_AXIS,
    crossingParameters[1],
  ));
  beltCurve.add(driverArc);

  const guideLeft = makePulley({
    radius: guideRadius - 0.05,
    width: 0.22,
    color: PALETTE.accent,
    axis: leftGuideContact.axis,
    spokes: 0,
  });
  const guideRight = makePulley({
    radius: guideRadius - 0.05,
    width: 0.22,
    color: PALETTE.accent,
    axis: rightGuideContact.axis,
    spokes: 0,
  });
  guideLeft.position.copy(leftGuideContact.center);
  guideRight.position.copy(rightGuideContact.center);
  // Brown hatches the band as a laid rope lying on each tread.
  const belt = makeMovingBelt(beltCurve, { radius: 0.05, laid: true, markerCount: 0 });
  root.add(driver, driven, guideLeft, guideRight, belt);
  addKeyedShaft(driver, 1.5);
  addKeyedShaft(driven, 1.15);
  addKeyedShaft(guideLeft, 0.74);
  addKeyedShaft(guideRight, 0.74);
  root.userData.mechanism = 'crossed-right-angle-guide-drive';
  root.userData.drivenWrapTurns = Math.abs(wrapSweep) / (Math.PI * 2);
  root.userData.crossoverClearance = 0.44;
  root.userData.cameraFov = 18;
  root.userData.shaftIntersection = driverCenter.clone();
  root.userData.beltContacts = [
    { object: driver, radius: driverRadius, axis: Z_AXIS.clone(), arc: driverArc },
    { object: driven, radius: drivenRadius, axis: Y_AXIS.clone(), arc: drivenWrap },
    { object: guideLeft, radius: guideRadius, axis: leftGuideContact.axis.clone(), arc: leftGuideContact.arc },
    { object: guideRight, radius: guideRadius, axis: rightGuideContact.axis.clone(), arc: rightGuideContact.arc },
  ];

  return {
    root,
    cameraDirection: new THREE.Vector3(0.3, 0.15, 10),
    update(time) {
      const beltDistance = time * 0.82;
      const driverAngularSpeed = Math.sign(driverArc.sweep) * 0.82 / driverRadius;
      const drivenAngularSpeed = Math.sign(drivenWrap.sweep) * 0.82 / drivenRadius;
      setSpin(driver, driverAngularSpeed * time);
      setSpin(driven, drivenAngularSpeed * time);
      setSpin(guideLeft, Math.sign(leftGuideContact.arc.sweep) * beltDistance / guideRadius);
      setSpin(guideRight, Math.sign(rightGuideContact.arc.sweep) * beltDistance / guideRadius);
      belt.userData.updateDistance(beltDistance);
      root.userData.kinematics = {
        beltSpeed: 0.82,
        drivenAngularSpeed,
        drivenRadius,
        driverAngularSpeed,
        driverRadius,
      };
    },
  };
}

function tighteningPulley() {
  const root = new THREE.Group();
  const beltZ = 0;
  const top = new THREE.Vector3(0, 2.35, beltZ);
  const bottom = new THREE.Vector3(0.20, -2.35, beltZ);
  // Brown hatches the band as a laid rope; its centreline runs just outside
  // each tread, so the radii below are rope pitch radii.
  const ropeRadius = 0.045;
  const ropeLift = ropeRadius + 0.003;
  const driverRadius = 0.888 + ropeLift;
  const drivenRadius = 0.628 + ropeLift;
  const idlerRadius = 0.358 + ropeLift;
  const driver = filletPulleySpokes(makePulley({ radius: driverRadius - ropeLift, color: PALETTE.driver }));
  const driven = filletPulleySpokes(makePulley({ radius: drivenRadius - ropeLift, color: PALETTE.driven }));
  const idler = makePulley({ radius: idlerRadius - ropeLift, width: 0.26, spokes: 0, color: PALETTE.accent, bore: 0.082 });
  driver.position.copy(top).setZ(0);
  driven.position.copy(bottom).setZ(0);
  const pivot = new THREE.Vector3(-1.57, -0.78, -0.25);
  const sourceIdler = new THREE.Vector3(-0.46, -0.34, beltZ);
  const armLength = Math.hypot(sourceIdler.x - pivot.x, sourceIdler.y - pivot.y);
  const engagedArmAngle = Math.atan2(sourceIdler.y - pivot.y, sourceIdler.x - pivot.x);
  const slackArmAngle = 1.3;
  const idlerAt = (engagement) => {
    const angle = THREE.MathUtils.lerp(slackArmAngle, engagedArmAngle, engagement);
    return new THREE.Vector3(pivot.x + armLength * Math.cos(angle), pivot.y + armLength * Math.sin(angle), beltZ);
  };
  const tangent = (a, b, ra, rb, senseA, senseB) => {
    const direction = b.clone().sub(a);
    const separation = direction.length();
    direction.divideScalar(separation);
    const opposite = senseA * senseB;
    const projection = (ra - opposite * rb) / separation;
    const normal = direction.clone().multiplyScalar(projection)
      .addScaledVector(new THREE.Vector3().crossVectors(Z_AXIS, direction),
        -senseA * Math.sqrt(1 - projection ** 2));
    return {
      start: a.clone().addScaledVector(normal, ra),
      end: b.clone().addScaledVector(normal, opposite * rb),
      normal,
    };
  };
  const outward = tangent(top, bottom, driverRadius, drivenRadius, -1, -1);
  const naturalReturn = tangent(bottom, top, drivenRadius, driverRadius, -1, -1);
  const rightDirection = outward.end.clone().sub(outward.start).normalize();
  const naturalLeftNormal = new THREE.Vector3().crossVectors(Z_AXIS,
    naturalReturn.end.clone().sub(naturalReturn.start).normalize());

  const tautPathAt = (center) => {
    const clearance = center.clone().sub(naturalReturn.start).dot(naturalLeftNormal) - idlerRadius;
    const hasIdlerContact = clearance < -1e-8;
    const incoming = hasIdlerContact ? tangent(bottom, center, drivenRadius, idlerRadius, -1, 1) : naturalReturn;
    const outgoing = hasIdlerContact ? tangent(center, top, idlerRadius, driverRadius, 1, -1) : naturalReturn;
    const bottomArc = circularArcThrough(bottom, outward.end, incoming.start, Z_AXIS, rightDirection);
    const topEntry = hasIdlerContact ? outgoing.end : naturalReturn.end;
    const topEntryTangent = outgoing.end.clone().sub(outgoing.start).normalize();
    const topArc = circularArcThrough(top, topEntry, outward.start, Z_AXIS, topEntryTangent);
    const curve = new THREE.CurvePath();
    curve.add(new THREE.LineCurve3(outward.start, outward.end));
    curve.add(bottomArc);
    curve.add(new THREE.LineCurve3(incoming.start, incoming.end));
    let idlerArc = null;
    if (hasIdlerContact) {
      idlerArc = circularArcThrough(center, incoming.end, outgoing.start, Z_AXIS,
        incoming.end.clone().sub(incoming.start).normalize());
      curve.add(idlerArc);
      curve.add(new THREE.LineCurve3(outgoing.start, outgoing.end));
    }
    curve.add(topArc);
    return { curve, bottomArc, topArc, idlerArc, center, hasIdlerContact };
  };
  const nominalBeltLength = tautPathAt(idlerAt(1)).curve.getLength();
  let previousEngagement = null;
  let previousPath = null;
  const pathAt = (engagement) => {
    if (engagement === previousEngagement) return previousPath;
    const path = tautPathAt(idlerAt(engagement));
    const tautLength = path.curve.getLength();
    const excess = nominalBeltLength - tautLength;
    let slackAmplitude = 0;
    if (excess > 1e-10) {
      const targetLength = outward.start.distanceTo(outward.end) + excess;
      let lower = 0;
      let upper = 2;
      for (let i = 0; i < 44; i += 1) {
        const amplitude = (lower + upper) / 2;
        const span = new BowedSpanCurve3(outward.start, outward.end, amplitude, outward.normal);
        if (span.getLength() < targetLength) lower = amplitude;
        else upper = amplitude;
      }
      slackAmplitude = (lower + upper) / 2;
      path.curve.curves[0] = new BowedSpanCurve3(outward.start, outward.end, slackAmplitude, outward.normal);
      path.curve.updateArcLengths();
    }
    path.slackAmplitude = slackAmplitude;
    previousEngagement = engagement;
    previousPath = path;
    return path;
  };
  const belt = makeDynamicMovingBelt(pathAt(1).curve, { radius: ropeRadius, laid: true, markerCount: 0 });
  belt.userData.mechanismBelt = true;
  const arm = makeDynamicLink({ thickness: 0.085, depth: 0.12, color: PALETTE.frame, jointRadius: 0.085 });
  root.add(driver, driven, idler, belt, arm);
  addKeyedShaft(driver, 0.85);
  addKeyedShaft(driven, 0.75);
  // Both pins belong to the rigid lever: the idler turns on its pin, and the
  // lever turns with its pivot journal in the unshown bracket.
  const idlerPin = addAxle(root, sourceIdler.clone().setZ(-0.08), 0.62);
  const pivotPin = addAxle(root, pivot, 0.35);
  const driverAngularSpeed = 1.35;
  const phaseOffset = 4.5;
  const transmissionIntegral = (time) => {
    const cycles = Math.floor(time / 10);
    const phase = THREE.MathUtils.euclideanModulo(time, 10);
    let area = 0;
    if (phase >= 7.5) area = 3.9;
    else if (phase > 6.9) {
      const u = (phase - 6.9) / 0.6;
      area = 3.6 + 0.6 * (u - u ** 3 + u ** 4 / 2);
    } else if (phase >= 3.6) area = 0.3 + phase - 3.6;
    else if (phase > 3) {
      const u = (phase - 3) / 0.6;
      area = 0.6 * (u ** 3 - u ** 4 / 2);
    }
    return cycles * 3.9 + area;
  };
  root.userData.mechanism = 'movable-belt-tensioner';
  root.userData.nominalBeltLength = nominalBeltLength;
  root.userData.blocks = { driver, driven, idler, idlerPin, belt, arm };
  root.userData.geometry = { armLength, pivot, driverRadius, drivenRadius, idlerRadius };
  root.userData.cameraFov = 18;
  const update = (time) => {
    const cycle = THREE.MathUtils.euclideanModulo(time + phaseOffset, 10);
    let engagement = 0;
    if (cycle >= 2 && cycle < 3) engagement = smoothStep01(cycle - 2);
    else if (cycle >= 3 && cycle < 7.5) engagement = 1;
    else if (cycle >= 7.5 && cycle < 8.5) engagement = 1 - smoothStep01(cycle - 7.5);
    let transmission = 0;
    if (cycle >= 3 && cycle < 3.6) transmission = smoothStep01((cycle - 3) / 0.6);
    else if (cycle >= 3.6 && cycle < 6.9) transmission = 1;
    else if (cycle >= 6.9 && cycle < 7.5) transmission = 1 - smoothStep01((cycle - 6.9) / 0.6);
    const path = pathAt(engagement);
    idler.position.copy(path.center).setZ(0);
    idlerPin.position.copy(path.center).setZ(-0.08);
    arm.userData.setEndpoints(pivot, path.center.clone().setZ(pivot.z));
    const armAngle = Math.atan2(path.center.y - pivot.y, path.center.x - pivot.x);
    for (const joint of arm.children.slice(1)) joint.quaternion.copy(arm.children[0].quaternion);
    setSpin(idlerPin, armAngle);
    setSpin(pivotPin, armAngle);
    const beltSpeed = driverAngularSpeed * driverRadius * transmission;
    const beltDistance = driverAngularSpeed * driverRadius
      * (transmissionIntegral(time + phaseOffset) - transmissionIntegral(phaseOffset));
    setSpin(driver, -time * driverAngularSpeed);
    setSpin(driven, -beltDistance / drivenRadius);
    setSpin(idler, beltDistance / idlerRadius);
    if (belt.userData.curve !== path.curve) belt.userData.setCurve(path.curve);
    belt.userData.updateDistance(beltDistance);
    root.userData.beltContacts = [
      { object: driver, radius: driverRadius, axis: Z_AXIS.clone(), arc: path.topArc },
      { object: driven, radius: drivenRadius, axis: Z_AXIS.clone(), arc: path.bottomArc },
      ...(path.idlerArc ? [{ object: idler, radius: idlerRadius, axis: Z_AXIS.clone(), arc: path.idlerArc }] : []),
    ];
    root.userData.kinematics = {
      beltCount: 1, beltLength: path.curve.getLength(), beltSpeed, beltDistance,
      drivenAngularSpeed: -beltSpeed / drivenRadius, driverAngularSpeed: -driverAngularSpeed,
      driverRadius, drivenRadius, mainPitchRadius: driverRadius,
      engagement, hasIdlerContact: path.hasIdlerContact, idlerCenter: path.center.clone(),
      idlerPitchRadius: idlerRadius, isTransmitting: transmission > 1e-6,
      slackAmplitude: path.slackAmplitude, transmission,
    };
  };
  update(0);
  return { root, update, cameraDirection: new THREE.Vector3(0.3, 0.15, 10) };
}

function oscillatingSector() {
  const root = new THREE.Group();
  const beltZ = 0;
  // Brown hatches the band as a laid rope; its centreline runs just outside
  // the sector rim and pulley treads, so the radii below are rope pitch radii.
  const ropeRadius = 0.045;
  const ropeLift = ropeRadius + 0.003;
  const sectorRimRadius = 1.12;
  const outerRadius = sectorRimRadius - 0.012;
  const sectorRadius = outerRadius + ropeLift;
  const lowerPitchRadius = 0.548 + ropeLift;
  const sectorPivot = new THREE.Vector3(0, 1.25, 0);
  const sector = new THREE.Group();
  sector.position.copy(sectorPivot);
  const sectorShape = new THREE.Shape();
  const innerRadius = sectorRimRadius * 0.80;
  sectorShape.moveTo(-outerRadius, 0);
  sectorShape.absarc(0, 0, outerRadius, Math.PI, Math.PI * 2, false);
  sectorShape.lineTo(innerRadius, 0);
  sectorShape.absarc(0, 0, innerRadius, 0, -Math.PI, true);
  sectorShape.closePath();
  const sectorPlate = new THREE.Mesh(
    new THREE.ExtrudeGeometry(sectorShape, {
      depth: 0.26,
      bevelEnabled: false,
      curveSegments: 80,
    }).translate(0, 0, -0.13),
    matte(PALETTE.accent),
  );
  sectorPlate.userData.role = 'open-sector-rim';
  const lever = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.14, 0.22), matte(PALETTE.ink));
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 0.34, 24),
    matte(PALETTE.ink),
  );
  hub.rotation.x = Math.PI / 2;
  for (const angle of [-Math.PI * 0.70, -Math.PI * 0.30]) {
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(sectorRimRadius * 0.72, 0.08, 0.20),
      matte(PALETTE.ink),
    );
    spoke.position.set(Math.cos(angle) * sectorRimRadius * 0.51, Math.sin(angle) * sectorRimRadius * 0.51, 0);
    spoke.rotation.z = angle;
    sector.add(spoke);
  }
  // Brown's sector has four arms: the two diagonals and two more running
  // out along the underside of the lever bar to the rim's ends.
  for (const side of [-1, 1]) {
    const length = innerRadius - 0.18;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(length + 0.02, 0.08, 0.20), matte(PALETTE.ink));
    arm.position.set(side * (0.18 + length / 2), -0.115, 0);
    arm.userData.role = 'sector-arm-under-lever';
    sector.add(arm);
  }
  // The rope ends are fastened to the rim just under the lever bar (half
  // height 0.07) rather than inside it.
  const attachmentDrop = Math.asin((0.074 + ropeRadius) / sectorRadius);
  const leftAttachmentLocal = new THREE.Vector3(
    -sectorRadius * Math.cos(attachmentDrop), -sectorRadius * Math.sin(attachmentDrop), beltZ);
  const rightAttachmentLocal = new THREE.Vector3(
    sectorRadius * Math.cos(attachmentDrop), -sectorRadius * Math.sin(attachmentDrop), beltZ);
  const sectorShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 1.4, 22),
    matte(PALETTE.ink, { metalness: 0.28, roughness: 0.44 }));
  sectorShaft.rotation.x = Math.PI / 2;
  sector.add(sectorPlate, lever, hub, sectorShaft);
  for (const x of [-2.2, 2.2]) {
    const grip = new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 12), matte(PALETTE.ink));
    grip.position.x = x;
    sector.add(grip);
  }

  const leftCenter = new THREE.Vector3(-1.5, -1.9, beltZ);
  const rightCenter = new THREE.Vector3(1.5, -1.9, beltZ);
  const leftPulley = filletPulleySpokes(makePulley({ radius: lowerPitchRadius - ropeLift, width: 0.28, color: PALETTE.driven }));
  const rightPulley = filletPulleySpokes(makePulley({ radius: lowerPitchRadius - ropeLift, width: 0.28, color: PALETTE.driven }));
  leftPulley.position.set(leftCenter.x, leftCenter.y, 0);
  rightPulley.position.set(rightCenter.x, rightCenter.y, 0);
  const leftBottom = leftCenter.clone().add(new THREE.Vector3(0, -lowerPitchRadius, 0));
  const rightBottom = rightCenter.clone().add(new THREE.Vector3(0, -lowerPitchRadius, 0));
  const worldAttachment = (localPoint, angle) => localPoint
    .clone()
    .applyAxisAngle(Z_AXIS, angle)
    .add(sectorPivot);
  const sectorContactCenter = sectorPivot.clone().setZ(beltZ);
  const crossedTangent = (lowerCenter, side) => {
    const displacement = lowerCenter.clone().sub(sectorContactCenter);
    const separation = displacement.length();
    const along = displacement.clone().divideScalar(separation);
    const perpendicular = new THREE.Vector3().crossVectors(Z_AXIS, along);
    const cosine = (sectorRadius + lowerPitchRadius) / separation;
    const normal = along.multiplyScalar(cosine)
      .addScaledVector(perpendicular, side * Math.sqrt(1 - cosine ** 2));
    return {
      upper: sectorContactCenter.clone().addScaledVector(normal, sectorRadius),
      lower: lowerCenter.clone().addScaledVector(normal, -lowerPitchRadius),
    };
  };
  const toRight = crossedTangent(rightCenter, -1);
  const fromLeft = crossedTangent(leftCenter, 1);
  const crossingFraction = -toRight.upper.x / (toRight.lower.x - toRight.upper.x);
  const makeBeltCurve = (angle) => {
    const leftAttachment = worldAttachment(leftAttachmentLocal, angle);
    const rightAttachment = worldAttachment(rightAttachmentLocal, angle);
    const rightTangent = toRight.lower;
    const leftTangent = fromLeft.lower;
    const rightArc = circularArcThrough(
      rightCenter,
      rightTangent,
      rightBottom,
      Z_AXIS,
      rightTangent.clone().sub(toRight.upper).normalize(),
    );
    const leftArc = circularArcThrough(
      leftCenter,
      leftBottom,
      leftTangent,
      Z_AXIS,
      leftBottom.clone().sub(rightBottom).normalize(),
    );
    const leftSectorArc = circularArcThrough(
      sectorContactCenter, leftAttachment, toRight.upper, Z_AXIS,
      new THREE.Vector3().crossVectors(Z_AXIS, leftAttachment.clone().sub(sectorContactCenter)),
    );
    const rightSectorArc = circularArcThrough(
      sectorContactCenter, fromLeft.upper, rightAttachment, Z_AXIS,
      fromLeft.upper.clone().sub(leftTangent).normalize(),
    );
    const curve = new THREE.CurvePath();
    curve.add(leftSectorArc);
    curve.add(new BowedSpanCurve3(toRight.upper, rightTangent, 0.13, Z_AXIS, crossingFraction));
    curve.add(rightArc);
    curve.add(new THREE.LineCurve3(rightBottom, leftBottom));
    curve.add(leftArc);
    curve.add(new BowedSpanCurve3(leftTangent, fromLeft.upper, -0.13, Z_AXIS, 1 - crossingFraction));
    curve.add(rightSectorArc);
    return {
      curve,
      leftArc,
      leftAttachment,
      rightArc,
      rightAttachment,
    };
  };
  const initialPath = makeBeltCurve(0);
  const belt = makeDynamicMovingBelt(initialPath.curve, {
    closed: false,
    markerCount: 0,
    radius: ropeRadius,
    laid: true,
  });
  belt.userData.mechanismBelt = true;
  root.add(sector, leftPulley, rightPulley, belt);
  addKeyedShaft(leftPulley, 1.2);
  addKeyedShaft(rightPulley, 1.2);
  root.userData.mechanism = 'vibrating-sector-belt-drive';
  root.userData.nominalBeltLength = initialPath.curve.getLength();
  root.userData.blocks = { sector, sectorPlate, leftPulley, rightPulley, belt };
  root.userData.cameraFov = 18;

  const update = (time) => {
    const frequency = 1.05;
    const amplitude = 0.3;
    const angle = Math.sin(time * frequency) * amplitude;
    const angularSpeed = Math.cos(time * frequency) * amplitude * frequency;
    const beltTravel = sectorRadius * angle;
    const beltSpeed = sectorRadius * angularSpeed;
    const path = makeBeltCurve(angle);
    sector.rotation.z = angle;
    setSpin(leftPulley, Math.sign(path.leftArc.sweep) * beltTravel / lowerPitchRadius);
    setSpin(rightPulley, Math.sign(path.rightArc.sweep) * beltTravel / lowerPitchRadius);
    belt.userData.setCurve(path.curve);
    // The ends are fixed to the sector: material coordinates measured from
    // the first anchor stay constant as arc length transfers between wraps.
    belt.userData.updateDistance(0);
    root.userData.beltContacts = [
      { object: leftPulley, radius: lowerPitchRadius, axis: Z_AXIS.clone(), arc: path.leftArc },
      { object: rightPulley, radius: lowerPitchRadius, axis: Z_AXIS.clone(), arc: path.rightArc },
    ];
    root.userData.kinematics = {
      beltLength: path.curve.getLength(),
      beltSpeed,
      beltTravel,
      leftAngularSpeed: Math.sign(path.leftArc.sweep) * beltSpeed / lowerPitchRadius,
      lowerPitchRadius,
      rightAngularSpeed: Math.sign(path.rightArc.sweep) * beltSpeed / lowerPitchRadius,
      sectorAngle: angle,
      sectorAngularSpeed: angularSpeed,
      sectorRadius,
    };
    root.userData.crossoverClearance = 0.26;
    root.userData.attachments = {
      left: path.leftAttachment,
      right: path.rightAttachment,
    };
  };
  update(0);
  // Brown draws the sector and pulleys with no ground below them.
  root.userData.hideGround = true;

  return {
    root,
    cameraDirection: new THREE.Vector3(0.3, 0.15, 10),
    update,
  };
}

function reversingBevelDrive() {
  const root = new THREE.Group();
  const stackX = 1.22;
  const upperY = 2.22;
  const lowerY = -1.18;
  const grooveSpacing = 0.28;
  const pitchRadius = 0.65;
  const sideGearRadius = 0.54;
  const outputGearRadius = sideGearRadius * 22 / 18;
  const levels = [-grooveSpacing, 0, grooveSpacing];
  const roles = ['hollow-shaft-b', 'loose-neutral', 'inner-shaft-a'];
  const lowerColors = [PALETTE.driven, PALETTE.muted, PALETTE.accent];

  // B is keyed on the hollow sleeve; the loose middle pulley and A's pulley
  // are bored for the inner shaft that passes through them.
  const stackBores = [0.13, 0.085, 0.085];
  const makeStackPulley = (y, level, color, bore) => {
    const pulley = makePulley({
      // Brown draws the three lower pulleys as one continuous faced block
      // with the belt on the middle (loose) one; they nearly abut here.
      radius: pitchRadius - 0.012,
      width: 0.272,
      hubLength: 0.23,
      color,
      grooves: 0,
      spokes: 0,
      axis: X_AXIS,
      bore,
    });
    pulley.position.set(stackX + level, y, 0);
    return pulley;
  };
  const driverDrum = makePulley({
    radius: pitchRadius - 0.012, width: 1.23, hubLength: 1.37,
    color: PALETTE.driver, grooves: 0, spokes: 0, axis: X_AXIS,
  });
  driverDrum.position.set(stackX, upperY, 0);
  const driverPulleys = [driverDrum];
  const lowerPulleys = levels.map((level, index) => {
    const pulley = makeStackPulley(lowerY, level, lowerColors[index], stackBores[index]);
    pulley.userData.role = roles[index];
    return pulley;
  });

  // The belt curve is authored in the local XY plane, then turned so that its
  // plane is normal to the horizontal pulley shafts. Moving it along local Z
  // traverses the same single belt across the three pulley pairs.
  const planarUpper = new THREE.Vector2(0, upperY);
  const planarLower = new THREE.Vector2(0, lowerY);
  const belt = makeMovingBelt(
    beltCurveOpen(planarUpper, planarLower, pitchRadius, pitchRadius),
    { width: 0.18, thickness: 0.024, markerCount: 0 },
  );
  belt.userData.selectorBelt = true;
  belt.userData.active = true;
  const beltFrame = new THREE.Group();
  beltFrame.position.x = stackX;
  beltFrame.quaternion.setFromUnitVectors(Z_AXIS, X_AXIS);
  beltFrame.add(belt);

  const gearIntersection = new THREE.Vector3(-1.38, lowerY, 0);
  const sideConeAngle = Math.atan2(18, 22);
  const sideOuterDistance = outputGearRadius;
  const outputOuterDistance = sideGearRadius;
  const gearA = makeMiterGear({
    innerDistance: sideOuterDistance * 0.68,
    outerDistance: sideOuterDistance,
    pitchConeAngle: sideConeAngle,
    toothHeight: 0.12,
    teeth: 18,
    color: PALETTE.accent,
    axis: X_AXIS.clone().negate(),
  });
  const gearB = makeMiterGear({
    innerDistance: sideOuterDistance * 0.68,
    outerDistance: sideOuterDistance,
    pitchConeAngle: sideConeAngle,
    toothHeight: 0.12,
    teeth: 18,
    color: PALETTE.driven,
    axis: X_AXIS,
    boreRadius: 0.085,
  });
  const outputGear = makeMiterGear({
    innerDistance: outputOuterDistance * 0.68,
    outerDistance: outputOuterDistance,
    pitchConeAngle: Math.PI / 2 - sideConeAngle,
    toothHeight: 0.12,
    teeth: 22,
    color: PALETTE.brass,
    axis: Y_AXIS,
  });
  for (const gear of [gearA, gearB, outputGear]) gear.position.copy(gearIntersection);
  gearA.userData.role = 'A-inner-shaft';
  gearB.userData.role = 'B-hollow-shaft';
  outputGear.userData.role = 'C-upright-output';
  // Brown draws no dark ring on the gears' back faces; the generic miter-gear
  // face ring is only line-drawing edging, so it stays as a hidden placeholder.
  for (const gear of [gearA, gearB, outputGear]) {
    gear.userData.inset.visible = false;
    gear.userData.inset.userData.retiredInkOutline = true;
  }

  const rightPulleyX = stackX + grooveSpacing;
  const leftPulleyX = stackX - grooveSpacing;
  const innerShaftStart = gearIntersection.x - sideOuterDistance - 0.2;
  const innerShaft = makeShaft({
    length: rightPulleyX + 0.25 - innerShaftStart,
    radius: 0.075,
    color: PALETTE.ink,
    axis: X_AXIS,
  });
  innerShaft.position.set((rightPulleyX + 0.25 + innerShaftStart) / 2, lowerY, 0);
  innerShaft.userData.role = 'inner-shaft-a';
  const hollowStart = gearIntersection.x + sideOuterDistance * 0.68 - 0.1;
  const hollowEnd = leftPulleyX + 0.135;
  const hollowLength = hollowEnd - hollowStart;
  const sleeveGeometry = new THREE.LatheGeometry([
    new THREE.Vector2(0.095, -hollowLength / 2),
    new THREE.Vector2(0.13, -hollowLength / 2),
    new THREE.Vector2(0.13, hollowLength / 2),
    new THREE.Vector2(0.095, hollowLength / 2),
    new THREE.Vector2(0.095, -hollowLength / 2),
  ], 48);
  sleeveGeometry.rotateX(Math.PI / 2);
  const hollowShaft = new THREE.Group();
  const sleeveRotor = new THREE.Group();
  sleeveRotor.add(new THREE.Mesh(sleeveGeometry, matte(PALETTE.muted)));
  hollowShaft.add(sleeveRotor);
  hollowShaft.userData.rotor = sleeveRotor;
  hollowShaft.quaternion.setFromUnitVectors(Z_AXIS, X_AXIS);
  hollowShaft.position.set((hollowStart + hollowEnd) / 2, lowerY, 0);
  hollowShaft.userData.role = 'hollow-shaft-b';
  addKeyedShaft(driverDrum, 2.05, 0.085);
  const outputShaft = makeShaft({ length: 2.295, radius: 0.09, axis: Y_AXIS });
  outputShaft.position.copy(gearIntersection).addScaledVector(Y_AXIS, 1.4475);
  outputShaft.userData.role = 'upright-output-shaft';

  root.add(
    ...driverPulleys,
    ...lowerPulleys,
    beltFrame,
    gearA,
    gearB,
    outputGear,
    innerShaft,
    hollowShaft,
    outputShaft,
  );

  const selectorPositionAt = (time) => {
    const phase = THREE.MathUtils.euclideanModulo(time, 16);
    if (phase < 3) return 0;
    if (phase < 4) return -smoothStep01(phase - 3);
    if (phase < 7) return -1;
    if (phase < 8) return -1 + smoothStep01(phase - 7);
    if (phase < 11) return 0;
    if (phase < 12) return smoothStep01(phase - 11);
    if (phase < 15) return 1;
    return 1 - smoothStep01(phase - 15);
  };
  let driverAngle = 0;
  let beltDistance = 0;
  const lowerAngles = [0, 0, 0];
  let outputAngle = 0;

  const update = (time, delta) => {
    const stepDelta = Number.isFinite(delta) ? delta : 0;
    const driverAngularSpeed = -1.3;
    const beltSpeed = Math.abs(driverAngularSpeed) * pitchRadius;
    const selectorPosition = selectorPositionAt(time);
    const leftEngagement = Math.max(0, -selectorPosition);
    const rightEngagement = Math.max(0, selectorPosition);
    const neutralEngagement = 1 - Math.abs(selectorPosition);
    const driveBalance = leftEngagement - rightEngagement;
    const leftShaftAngularSpeed = driveBalance === 0 ? 0 : driverAngularSpeed * driveBalance;
    const rightShaftAngularSpeed = leftShaftAngularSpeed === 0 ? 0 : -leftShaftAngularSpeed;
    const neutralPulleyAngularSpeed = driverAngularSpeed * neutralEngagement;
    const outputAngularSpeed = leftShaftAngularSpeed === 0
      ? 0
      : -leftShaftAngularSpeed * sideGearRadius / outputGearRadius;

    driverAngle += driverAngularSpeed * stepDelta;
    beltDistance += beltSpeed * stepDelta;
    lowerAngles[0] += leftShaftAngularSpeed * stepDelta;
    lowerAngles[1] += neutralPulleyAngularSpeed * stepDelta;
    lowerAngles[2] += rightShaftAngularSpeed * stepDelta;
    outputAngle += outputAngularSpeed * stepDelta;

    driverPulleys.forEach((pulley) => setSpin(pulley, driverAngle));
    lowerPulleys.forEach((pulley, index) => setSpin(pulley, lowerAngles[index]));
    setSpin(hollowShaft, lowerAngles[0]);
    setSpin(gearB, lowerAngles[0] + Math.PI / 2);
    setSpin(innerShaft, lowerAngles[2]);
    // Gear A faces the opposite way, so its local rotation is the negative of
    // the inner shaft's rotation about the shared world X axis.
    setSpin(gearA, -lowerAngles[2] + Math.PI / 2);
    setSpin(outputGear, outputAngle - Math.PI / 22);
    setSpin(outputShaft, outputAngle);
    belt.position.z = selectorPosition * grooveSpacing;
    belt.userData.updateDistance(beltDistance);

    const isShifting = Math.abs(selectorPosition - Math.round(selectorPosition)) > 1e-5;
    const selectedIndex = isShifting ? null : Math.round(selectorPosition) + 1;
    root.userData.kinematics = {
      activeBeltCount: 1,
      beltSpeed,
      driverAngularSpeed,
      gearRatio: sideGearRadius / outputGearRadius,
      isShifting,
      leftShaftAngularSpeed,
      neutralPulleyAngularSpeed,
      outputAngularSpeed,
      outputGearRadius,
      pitchRadius,
      rightShaftAngularSpeed,
      selectedIndex,
      selectorPosition,
      sideGearRadius,
    };
  };
  root.userData.mechanism = 'reversing-bevel-selector';
  root.userData.blocks = { driver: driverDrum, lowerPulleys, belt, innerShaft, hollowShaft, gearA, gearB, outputGear };
  root.userData.cameraFov = 10;
  root.userData.coaxialDrive = {
    axis: X_AXIS.clone(),
    gearA,
    gearB,
    hollowShaft,
    innerShaft,
    lowerPulleys,
  };
  root.userData.bevelContacts = [
    { input: gearA, output: outputGear },
    { input: gearB, output: outputGear },
  ];
  update(0, 0);

  return {
    root,
    // Plate 7 is a flat front elevation of the shafts.
    cameraDirection: new THREE.Vector3(0, 0, 1),
    update,
  };
}

function steppedSpeedDrive() {
  const root = new THREE.Group();
  const left = new THREE.Vector2(-2.56, 0);
  const right = new THREE.Vector2(2.56, 0);
  const halfThickness = 0.012;
  const beltLengthFor = (a, b) => {
    const difference = a - b;
    const separation = right.x - left.x;
    return 2 * Math.sqrt(separation ** 2 - difference ** 2)
      + Math.PI * (a + b) + 2 * difference * Math.asin(difference / separation);
  };
  // Equal sums of step radii are only an approximation. Solve the middle
  // pair against the full tangent-and-wrap length of the extreme pair.
  const beltLength = beltLengthFor(0.32 + halfThickness, 0.96 + halfThickness);
  let lower = 0.54;
  let upper = 0.96;
  for (let i = 0; i < 48; i += 1) {
    const radius = (lower + upper) / 2;
    if (beltLengthFor(0.54 + halfThickness, radius + halfThickness) < beltLength) lower = radius;
    else upper = radius;
  }
  const radii = [0.32, 0.54, (lower + upper) / 2, 0.96];
  const stepWidth = 0.36;
  const driver = makeSteppedPulley({ radii, stepWidth, color: PALETTE.driver });
  const driven = makeSteppedPulley({ radii, stepWidth, color: PALETTE.driven, reverse: true });
  driver.position.set(left.x, left.y, 0);
  driven.position.set(right.x, right.y, 0);
  root.add(driver, driven);
  addKeyedShaft(driver, 2.1);
  addKeyedShaft(driven, 2.1);
  // Each stage runs the drive up, holds it and runs it down (4.2 s), then
  // shifts the belt by hand to the adjacent step pair while the pulleys are
  // at rest. The steps are visited in a ping-pong order, so every shift is
  // one step and the six-stage cycle closes without a jump.
  const shiftPeriod = 4.2;
  const shiftDuration = 0.8;
  const stageDuration = shiftPeriod + shiftDuration;
  const levelSequence = [2, 3, 2, 1, 0, 1];
  const cycleDuration = stageDuration * levelSequence.length;
  const rampFraction = 0.16;
  const rampTime = shiftPeriod * rampFraction;
  const fullIntegral = shiftPeriod - rampTime;
  const rampIntegral = (t) => rampTime * ((t / rampTime) ** 3 - (t / rampTime) ** 4 / 2);
  const envelopeIntegral = (t) => {
    if (t < rampTime) return rampIntegral(t);
    if (t > shiftPeriod - rampTime) return fullIntegral - rampIntegral(shiftPeriod - t);
    return t - rampTime / 2;
  };
  const pitchRadii = radii.map((radius) => radius + halfThickness);
  const ratioAt = (index) => pitchRadii[index] / pitchRadii[radii.length - 1 - index];
  const prefix = (weight) => levelSequence.reduce((sums, level) => [...sums, sums.at(-1) + 1.25 * fullIntegral * weight(level)], [0]);
  const drivenPrefix = prefix(ratioAt);
  const beltPrefix = prefix((level) => pitchRadii[level]);
  const levelZ = (level) => (level - (radii.length - 1) / 2) * stepWidth;
  // One belt: it runs on a step pair and is shifted across at rest.
  const belt = makeDynamicMovingBelt(
    beltCurveOpen(left, right, pitchRadii[2], pitchRadii[1], levelZ(2)),
    { width: 0.20, thickness: 2 * halfThickness, markerCount: 0 },
  );
  belt.userData.role = 'belt-on-one-step-pair-shifted-at-rest';
  belt.userData.selectorBelt = true;
  setBeltActive(belt, true);
  root.add(belt);
  const belts = [belt];
  const smooth = (x) => { const t = THREE.MathUtils.clamp(x, 0, 1); return t * t * t * (10 - 15 * t + 6 * t * t); };

  const update = (time) => {
    const completedCycles = Math.floor(time / cycleDuration);
    const withinCycle = time - completedCycles * cycleDuration;
    const stage = Math.min(levelSequence.length - 1, Math.floor(withinCycle / stageDuration));
    const local = withinCycle - stage * stageDuration;
    const selected = levelSequence[stage];
    const shifting = local >= shiftPeriod;
    const cycleProgress = Math.min(local, shiftPeriod) / shiftPeriod;
    let driveEnvelope = 0;
    if (!shifting) {
      driveEnvelope = 1;
      if (cycleProgress < rampFraction) {
        const progress = cycleProgress / rampFraction;
        driveEnvelope = progress * progress * (3 - 2 * progress);
      } else if (cycleProgress > 1 - rampFraction) {
        const progress = (1 - cycleProgress) / rampFraction;
        driveEnvelope = progress * progress * (3 - 2 * progress);
      }
    }
    const driverRadius = pitchRadii[selected];
    const drivenRadius = pitchRadii[radii.length - selected - 1];
    const driverAngularSpeed = 1.25 * driveEnvelope;
    const drivenAngularSpeed = driverAngularSpeed * driverRadius / drivenRadius;
    const beltSpeed = driverAngularSpeed * driverRadius;
    const integratedEnvelope = envelopeIntegral(Math.min(local, shiftPeriod));
    const stagesDone = completedCycles * levelSequence.length + stage;
    const driverAngle = 1.25 * (stagesDone * fullIntegral + integratedEnvelope);
    const drivenAngle = completedCycles * drivenPrefix.at(-1) + drivenPrefix[stage]
      + 1.25 * integratedEnvelope * ratioAt(selected);
    const beltDistance = completedCycles * beltPrefix.at(-1) + beltPrefix[stage]
      + 1.25 * integratedEnvelope * driverRadius;
    setSpin(driver, -driverAngle);
    setSpin(driven, -drivenAngle);
    let shift = null;
    let beltDriverRadius = driverRadius, beltDrivenRadius = drivenRadius, beltZ = levelZ(selected);
    if (shifting) {
      // The rising end is lifted onto its larger step before the belt is
      // slid across; the falling end slides over its smaller step and then
      // drops onto it.
      const target = levelSequence[(stage + 1) % levelSequence.length];
      const progress = (local - shiftPeriod) / shiftDuration;
      const driverUp = pitchRadii[target] > pitchRadii[selected];
      const lift = smooth(progress / 0.45), slide = smooth((progress - 0.25) / 0.5), drop = smooth((progress - 0.55) / 0.45);
      const radiusAt = (from, to, up) => THREE.MathUtils.lerp(from, to, up ? lift : drop);
      beltDriverRadius = radiusAt(pitchRadii[selected], pitchRadii[target], driverUp);
      beltDrivenRadius = radiusAt(pitchRadii[radii.length - 1 - selected], pitchRadii[radii.length - 1 - target], !driverUp);
      beltZ = THREE.MathUtils.lerp(levelZ(selected), levelZ(target), slide);
      shift = { from: selected, to: target, progress };
    }
    const key = `${beltDriverRadius},${beltDrivenRadius},${beltZ}`;
    if (belt.userData.pathKey !== key) {
      belt.userData.pathKey = key;
      belt.userData.setCurve(beltCurveOpen(left, right, beltDriverRadius, beltDrivenRadius, beltZ));
    }
    belt.userData.level = selected;
    belt.userData.updateDistance(beltDistance);
    root.userData.kinematics = {
      activeBeltCount: 1,
      beltSpeed,
      drivenAngle,
      drivenAngularSpeed: -drivenAngularSpeed,
      drivenRadius,
      driverAngle,
      driverAngularSpeed: -driverAngularSpeed,
      driverRadius,
      selected,
      shift,
    };
  };
  root.userData.animationTiming = { authoredCyclePeriod: cycleDuration };
  root.userData.mechanism = 'stepped-speed-drive';
  root.userData.blocks = { driver, driven, belts };
  root.userData.nominalBeltLength = beltLength;
  root.userData.cameraFov = 18;
  orientVerticalSpeedDrive(root);
  update(0, 0);

  return {
    root,
    cameraDirection: new THREE.Vector3(0.3, 0.15, 10),
    update,
  };
}

function coneSpeedDrive(nonlinear = false) {
  const root = new THREE.Group();
  const left = new THREE.Vector2(-2.56, 0);
  const right = new THREE.Vector2(2.56, 0);
  const length = 2.5;
  const beltOffset = 0.012;
  const beltWidth = 0.16;
  const profile = nonlinear ? 'concave' : 'linear';
  const driver = makeConePulley({ length, radiusStart: 0.42, radiusEnd: 1.05, color: PALETTE.driver, profile });
  const driven = makeConePulley({ length, radiusStart: 0.42, radiusEnd: 1.05, color: PALETTE.driven, profile: nonlinear ? 'convex' : 'linear', reverse: true });
  driver.position.set(left.x, left.y, 0);
  driven.position.set(right.x, right.y, 0);
  const makeBeltCurve = (level) => {
    const driverPitchRadius = driver.userData.radiusAt(level) + beltOffset;
    const drivenPitchRadius = driven.userData.radiusAt(level) + beltOffset;
    const z = -length / 2 + level * length;
    const edgeCurve = (side, radialOffset) => {
      const edgeLevel = level + side * beltWidth / (2 * length);
      return beltCurveOpen(left, right,
        driver.userData.radiusAt(edgeLevel) + radialOffset,
        driven.userData.radiusAt(edgeLevel) + radialOffset,
        z + side * beltWidth / 2);
    };
    return {
      curve: beltCurveOpen(left, right, driverPitchRadius, drivenPitchRadius, z),
      // Open belt curves run clockwise, so the negative section normal is
      // the outer running face. Both edges follow their own cone radii.
      sectionCurves: [edgeCurve(-1, 2 * beltOffset), edgeCurve(1, 2 * beltOffset),
        edgeCurve(1, 0), edgeCurve(-1, 0)],
      drivenPitchRadius,
      driverPitchRadius,
      level,
      z,
    };
  };
  let currentPath = makeBeltCurve(0.5);
  const sectionAt = (u) => {
    const lengths = currentPath.curve.getCurveLengths();
    const distance = currentPath.curve.getUtoTmapping(u) * lengths.at(-1);
    let index = lengths.findIndex((value) => distance <= value);
    if (index < 0) index = lengths.length - 1;
    const start = index === 0 ? 0 : lengths[index - 1];
    const fraction = (distance - start) / (lengths[index] - start);
    return currentPath.sectionCurves.map((curve) => curve.curves[index].getPointAt(fraction));
  };
  const belt = makeDynamicMovingBelt(currentPath.curve, {
    width: beltWidth,
    thickness: 2 * beltOffset,
    sectionAt,
    widthDirection: (u) => {
      const corners = sectionAt(u);
      return corners[1].clone().sub(corners[0]);
    },
    markerCount: 0,
  });
  belt.userData.selectorBelt = true;
  belt.userData.active = true;
  belt.userData.mechanismBelt = true;
  root.add(driver, driven, belt);
  let driverAngle = 0;
  let drivenAngle = 0;
  let beltDistance = 0;

  const update = (time, delta) => {
    const stepDelta = Number.isFinite(delta) ? delta : 0;
    const level = 0.5 + 0.46 * Math.sin(time * 0.5);
    const path = makeBeltCurve(level);
    currentPath = path;
    const driverAngularSpeed = -1.2;
    const drivenAngularSpeed = driverAngularSpeed
      * path.driverPitchRadius / path.drivenPitchRadius;
    const beltSpeed = Math.abs(driverAngularSpeed) * path.driverPitchRadius;
    driverAngle += driverAngularSpeed * stepDelta;
    drivenAngle += drivenAngularSpeed * stepDelta;
    beltDistance += beltSpeed * stepDelta;
    setSpin(driver, driverAngle);
    setSpin(driven, drivenAngle);
    belt.userData.setCurve(path.curve);
    belt.userData.updateDistance(beltDistance);
    root.userData.beltContacts = [
      {
        object: driver,
        radius: path.driverPitchRadius,
        axis: Z_AXIS.clone(),
        arc: path.curve.curves[3],
      },
      {
        object: driven,
        radius: path.drivenPitchRadius,
        axis: Z_AXIS.clone(),
        arc: path.curve.curves[1],
      },
    ];
    root.userData.kinematics = {
      activeBeltCount: 1,
      beltLength: path.curve.getLength(),
      beltSpeed,
      beltZ: path.z,
      drivenAngularSpeed,
      drivenPitchRadius: path.drivenPitchRadius,
      driverAngularSpeed,
      driverPitchRadius: path.driverPitchRadius,
      level,
      ratio: path.driverPitchRadius / path.drivenPitchRadius,
    };
  };
  root.userData.mechanism = nonlinear
    ? 'curved-cone-variable-speed-drive'
    : 'opposed-cone-variable-speed-drive';
  root.userData.blocks = { driver, driven, belt };
  root.userData.cameraFov = 18;
  orientVerticalSpeedDrive(root);
  update(0, 0);

  return {
    root,
    cameraDirection: new THREE.Vector3(0.3, 0.15, 10),
    update,
  };
}

function sampledArc(center, radius, startAngle, endAngle, count = 9, z = 0.05) {
  return Array.from({ length: count }, (_, index) => {
    const angle = THREE.MathUtils.lerp(startAngle, endAngle, index / (count - 1));
    return new THREE.Vector3(
      center.x + Math.cos(angle) * radius,
      center.y + Math.sin(angle) * radius,
      z,
    );
  });
}

function makeWeight(color = PALETTE.driven, scale = 1) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38 * scale, 0.48 * scale, 0.72 * scale, 28),
    matte(color, { metalness: 0.12, roughness: 0.68 }),
  );
  const eye = new THREE.Mesh(
    new THREE.TorusGeometry(0.14 * scale, 0.045 * scale, 8, 22),
    matte(PALETTE.ink),
  );
  eye.position.y = 0.48 * scale;
  eye.rotation.x = Math.PI / 2;
  group.add(body, eye);
  return markShadows(group);
}

function addCeiling(root, width = 4.8, y = 2.25) {
  root.add(makeBeam(
    new THREE.Vector3(-width / 2, y, -0.55),
    new THREE.Vector3(width / 2, y, -0.55),
    { thickness: 0.14, depth: 0.2, color: PALETTE.frame },
  ));
}

// Brown hangs a fixed sheave by an open hook from a staple under the hatched
// ceiling. The staple links through the hook curl above the hanger shoulder.
function addHookStaple(parent, shoulder, { width = 2.4, offset = 0, x = 0 } = {}) {
  const stapleY = shoulder + 0.433;
  const staple = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.022, 12, 40), matte(PALETTE.ink));
  staple.rotation.y = Math.PI / 2;
  staple.position.set(x, stapleY, 0);
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(width, 0.12, 0.55), matte(PALETTE.frame));
  ceiling.position.set(x + offset, stapleY + 0.097 + 0.06, 0);
  parent.add(staple, ceiling);
  return { staple, ceiling, underside: stapleY + 0.097 };
}

// On a quarter-turn belt each run must approach its pulley in that pulley's
// mid-plane. Pass 58 makes both runs of 11 taut straight lines: the drum's
// belt plane touches the pulley's pitch circle at its left (so the left run is
// vertical, as Brown draws it), and the drum stands forward of the pulley
// plane by its pitch radius, so the pulley's plane touches the drum's pitch
// cylinder where the right run leaves it. Each run leaves its pulley at the
// delivery angle; the belt eases across the tread just before it leaves, so
// the path stays smooth. A tangent-continuous wrap ending in a skewed
// tangent to the pitch cylinder.
class SkewedDeliveryWrapCurve3 extends CircularArcCurve3 {
  constructor(arc, offsetAxis, amplitude) {
    super(arc.center, arc.radialStart, arc.axis, arc.sweep);
    this.offsetAxis = offsetAxis.clone().normalize();
    this.amplitude = amplitude;
    this.arcLength = Math.abs(arc.sweep) * arc.radialStart.length();
  }

  getPoint(t, target = new THREE.Vector3()) {
    super.getPoint(t, target);
    return target.addScaledVector(this.offsetAxis, this.amplitude * (t ** 8 - t ** 7));
  }

  getTangent(t, target = new THREE.Vector3()) {
    super.getTangent(t, target).multiplyScalar(this.arcLength);
    return target.addScaledVector(this.offsetAxis, this.amplitude * (8 * t ** 7 - 7 * t ** 6)).normalize();
  }
}

function rightAngleWithoutGuides() {
  const root = new THREE.Group();
  const topPitchRadius = 0.76;
  const bottomPitchRadius = 0.96;
  const beltPlaneX = -bottomPitchRadius;
  const topCenter = new THREE.Vector3(beltPlaneX, 2.25, topPitchRadius);
  const bottomCenter = new THREE.Vector3(0, -2.25, 0);
  const driver = makePulley({
    radius: topPitchRadius - 0.012,
    width: 1.44,
    color: PALETTE.driver,
    axis: X_AXIS,
    spokes: 0,
    grooves: 0,
  });
  const driven = filletPulleySpokes(makePulley({
    radius: bottomPitchRadius - 0.012,
    width: 0.4,
    color: PALETTE.driven,
    axis: Z_AXIS,
  }));
  driver.position.copy(topCenter);
  driven.position.copy(bottomCenter);

  // The right run leaves the drum's back line (in the pulley plane) and
  // meets the pulley's right side; the left run leaves the pulley's left
  // point (in the drum's belt plane) and meets the drum's front.
  const drumDelivery = new THREE.Vector3(beltPlaneX, topCenter.y, 0);
  const pulleyDelivery = new THREE.Vector3(beltPlaneX, bottomCenter.y, 0);
  const bottomRight = tangentPointsFromExternal(bottomCenter, drumDelivery, bottomPitchRadius, Z_AXIS)
    .reduce((best, point) => (point.x > best.x ? point : best));
  const topFront = tangentPointsFromExternal(topCenter, pulleyDelivery, topPitchRadius, X_AXIS)
    .reduce((best, point) => (point.z > best.z ? point : best));
  const rightRun = new THREE.LineCurve3(drumDelivery, bottomRight);
  const leftRun = new THREE.LineCurve3(pulleyDelivery, topFront);
  const rightDirection = bottomRight.clone().sub(drumDelivery).normalize();
  const leftDirection = topFront.clone().sub(pulleyDelivery).normalize();
  const bottomCircle = circularArcThrough(bottomCenter, bottomRight, pulleyDelivery, Z_AXIS, rightDirection);
  const topCircle = circularArcThrough(topCenter, topFront, drumDelivery, X_AXIS, leftDirection);
  const bottomArc = new SkewedDeliveryWrapCurve3(bottomCircle, Z_AXIS,
    Math.abs(bottomCircle.sweep) * bottomPitchRadius * leftDirection.z / leftDirection.y);
  const topArc = new SkewedDeliveryWrapCurve3(topCircle, X_AXIS,
    Math.abs(topCircle.sweep) * topPitchRadius * rightDirection.x / -rightDirection.y);
  const beltCurve = new THREE.CurvePath();
  beltCurve.add(rightRun);
  beltCurve.add(bottomArc);
  beltCurve.add(leftRun);
  beltCurve.add(topArc);
  const belt = makeMovingBelt(beltCurve, {
    width: 0.16, thickness: 0.024, markerCount: 0,
    widthDirection: contactWidthDirection(beltCurve, [null, Z_AXIS, null, X_AXIS]),
  });
  belt.userData.mechanismBelt = true;
  root.add(driver, driven, belt);
  addKeyedShaft(driver, 2.15);
  addKeyedShaft(driven, 1.5);
  root.userData.mechanism = 'twisted-right-angle-belt-drive';
  root.userData.cameraFov = 18;
  root.userData.blocks = { driver, driven, belt };
  root.userData.beltContacts = [
    { object: driver, radius: topPitchRadius, axis: X_AXIS.clone(), arc: topArc },
    { object: driven, radius: bottomPitchRadius, axis: Z_AXIS.clone(), arc: bottomArc },
  ];
  return {
    root,
    cameraDirection: new THREE.Vector3(0.3, 0.15, 10),
    update(time) {
      const beltDistance = time * 0.82;
      const driverAngularSpeed = Math.sign(topArc.sweep) * 0.82 / topPitchRadius;
      const drivenAngularSpeed = Math.sign(bottomArc.sweep) * 0.82 / bottomPitchRadius;
      setSpin(driver, Math.sign(topArc.sweep) * beltDistance / topPitchRadius);
      setSpin(driven, Math.sign(bottomArc.sweep) * beltDistance / bottomPitchRadius);
      belt.userData.updateDistance(beltDistance);
      root.userData.kinematics = {
        beltSpeed: 0.82,
        bottomPitchRadius,
        drivenAngularSpeed,
        driverAngularSpeed,
        topPitchRadius,
      };
    },
  };
}

function baseRailForPulley() {}

function fixedHoist() {
  const root = new THREE.Group();
  const center = new THREE.Vector3(0, 1.1, 0);
  const pitchRadius = 0.68;
  const pulley = makePulley({
    radius: pitchRadius - 0.042,
    width: 0.34,
    hubLength: 0.46,
    color: PALETTE.driver,
    spokes: 0,
    bore: 0.072,
  });
  pulley.position.copy(center);
  const weight = new THREE.Group();
  const bagProfile = [
    [0, -0.65], [0.2, -0.63], [0.37, -0.53], [0.43, -0.38],
    [0.39, -0.18], [0.26, 0.02], [0.13, 0.16], [0.13, 0.23],
    [0.17, 0.30], [0.14, 0.38], [0, 0.40],
  ].map(([radius, y]) => new THREE.Vector2(radius, y));
  const bag = new THREE.Mesh(new THREE.LatheGeometry(bagProfile, 64), matte(PALETTE.driven));
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 10, 32), matte(PALETTE.belt));
  tie.rotation.x = Math.PI / 2;
  tie.position.y = 0.23;
  weight.add(bag, tie);
  markShadows(weight);
  const leftContactAngle = Math.PI * 0.75;
  const leftContact = center.clone().add(new THREE.Vector3(
    Math.cos(leftContactAngle) * pitchRadius,
    Math.sin(leftContactAngle) * pitchRadius,
    0.05,
  ));
  const rightContact = center.clone().add(new THREE.Vector3(pitchRadius, 0, 0.05));
  const effortDirection = new THREE.Vector3(1, 1, 0).normalize();
  const loadDirection = new THREE.Vector3(0, -1, 0);
  const contactArc = circularArcThrough(
    center.clone().setZ(0.05),
    leftContact,
    rightContact,
    Z_AXIS,
    effortDirection,
  );
  // Brown's hand grips the rope about 3.3 sheave radii below the pulley.
  const baseEffortLength = 2.2;
  const baseLoadLength = 2.65;
  const makeRopePath = (motion) => {
    const effortLength = baseEffortLength + motion;
    const loadLength = baseLoadLength - motion;
    const effortEnd = leftContact.clone().addScaledVector(effortDirection, -effortLength);
    const loadAttachment = rightContact.clone().addScaledVector(loadDirection, loadLength);
    const curve = new THREE.CurvePath();
    curve.add(new THREE.LineCurve3(effortEnd, leftContact));
    curve.add(contactArc);
    curve.add(new THREE.LineCurve3(rightContact, loadAttachment));
    return {
      curve,
      effortEnd,
      effortLength,
      loadAttachment,
      loadLength,
    };
  };
  const initialPath = makeRopePath(0);
  // Brown draws the fall as a laid rope.
  const rope = makeDynamicMovingBelt(initialPath.curve, {
    closed: false,
    markerCount: 0,
    radius: 0.042,
    laid: true,
  });
  rope.userData.mechanismRope = true;
  root.add(pulley, rope, weight);
  const suspension = makeSheaveHanger({ radius: pitchRadius, width: 0.34, openHook: true });
  suspension.position.copy(center);
  const { pin } = suspension.userData;
  const { staple: hook, ceiling: support } = addHookStaple(suspension,
    pitchRadius + 0.15, { width: 2.4, offset: -0.2 });
  root.add(markShadows(suspension));
  const hand = makeHaulingHand(effortDirection, 0.042);
  root.add(hand);
  root.userData.blocks = { pulley, rope, weight, suspension, pin, hook, support, hand };
  root.userData.cameraFov = 18;
  root.userData.mechanism = 'fixed-pulley-hoist';
  root.userData.ropeContact = {
    arc: contactArc,
    axis: Z_AXIS.clone(),
    object: pulley,
    radius: pitchRadius,
  };
  root.userData.nominalRopeLength = initialPath.curve.getLength();
  const update = (time) => {
    const frequency = 0.72;
    const motion = Math.sin(time * frequency) * 0.46;
    const motionSpeed = Math.cos(time * frequency) * 0.46 * frequency;
    const path = makeRopePath(motion);
    const ropeTravel = -motion;
    const ropeSpeed = -motionSpeed;
    rope.userData.setCurve(path.curve);
    // The path starts at the hand's grip on a constant-length rope, so each
    // arc-length coordinate is a fixed piece of rope: the lay is not shifted.
    rope.userData.updateDistance(0);
    weight.position.copy(path.loadAttachment).add(new THREE.Vector3(0, -0.39, 0));
    hand.position.copy(path.effortEnd);
    setSpin(pulley, Math.sign(contactArc.sweep) * ropeTravel / pitchRadius);
    root.userData.attachments = {
      effort: path.effortEnd,
      load: path.loadAttachment,
    };
    root.userData.kinematics = {
      effortDisplacement: motion,
      effortForceOverLoad: 1,
      effortLength: path.effortLength,
      loadDisplacement: motion,
      loadLength: path.loadLength,
      mechanicalAdvantage: 1,
      pitchRadius,
      pulleyAngularSpeed: Math.sign(contactArc.sweep) * ropeSpeed / pitchRadius,
      ropeLength: path.curve.getLength(),
      ropeSpeed,
      supportingSegments: 1,
    };
  };
  // Fit the swept silhouette (hand, tail and bag travel), not the stale
  // pre-hand profile box.
  const fit = new THREE.Box3();
  for (let i = 0; i < 24; i += 1) {
    update(i * 2 * Math.PI / (0.72 * 24));
    root.updateMatrixWorld(true);
    fit.union(new THREE.Box3().setFromObject(root, true));
  }
  root.userData.cameraFitBounds = fit;
  update(0);
  // Brown hangs the pulley from a hatched ceiling with no ground below.
  root.userData.hideGround = true;
  return { root, update, cameraDirection: new THREE.Vector3(0.3, 0.15, 10) };
}

// Brown crops the hauling part of each tackle (14-22). Rather than stopping
// the rope in mid-air at that crop, the fall runs on a little past the plate
// frame into plate 12's hauling hand. The rope's own free leaf is lengthened
// (same segment count) so the hand grips a continuous rope; the camera keeps
// the pre-hand swept bounds, so the default view still frames Brown's crop.
function addTackleHaulingHand(result, { clearance = 0.45, scale = 0.8, sampleFrequency = 0.5 } = {}) {
  const { root } = result;
  const originalUpdate = result.update;
  const fit = new THREE.Box3();
  let highestEffort = -Infinity;
  const period = 2 * Math.PI / sampleFrequency;
  for (let i = 0; i < 32; i += 1) {
    originalUpdate(i * period / 32, 0);
    root.updateMatrixWorld(true);
    fit.union(new THREE.Box3().setFromObject(root, true));
    highestEffort = Math.max(highestEffort, root.userData.attachments.effort.y);
  }
  if (!root.userData.cameraFitBounds?.isBox3) root.userData.cameraFitBounds = fit;
  const frameBottom = root.userData.cameraFitBounds.min.y;
  originalUpdate(0, 0);
  const effort = root.userData.attachments?.effort;
  // Lengthen the fall until even its highest grip lies clear below the frame.
  let extension = 0;
  let rope = null;
  root.traverse((object) => {
    const curve = object.userData.curve;
    if (!rope && object.userData.setCurve && curve?.getPoint
      && curve.getPoint(1).distanceTo(effort) < 1e-6) rope = object;
  });
  if (!rope) throw new Error('No hauling rope ends at the tackle effort attachment.');
  const fallTangent = rope.userData.curve.getTangent(1);
  extension = Math.max(0.3, (highestEffort - frameBottom + clearance) / Math.max(0.3, -fallTangent.y));
  const setCurve = rope.userData.setCurve;
  rope.userData.setCurve = (curve) => {
    const extended = new THREE.CurvePath();
    const parts = curve.curves ?? [curve];
    const last = parts.at(-1);
    if (last.isLineCurve3) {
      const tip = last.v2.clone().addScaledVector(last.getTangent(1), extension);
      extended.curves.push(...parts.slice(0, -1), new THREE.LineCurve3(last.v1.clone(), tip));
    } else {
      const end = curve.getPoint(1);
      extended.curves.push(...parts, new THREE.LineCurve3(end, end.clone().addScaledVector(curve.getTangent(1), extension)));
    }
    setCurve(extended);
  };
  rope.userData.setCurve(rope.userData.curve);
  const up = rope.userData.curve.getTangent(1).negate();
  up.z = 0;
  up.normalize();
  const radius = rope.userData.thickness / 2;
  const hand = makeHaulingHand(up, radius / scale);
  hand.scale.setScalar(scale);
  hand.userData.role = 'hauling-hand-beyond-plate-crop';
  // Both run past Brown's framing on purpose: the hand wholly, the fall only
  // below the pre-hand frame bottom (everything above it is the original rope).
  hand.userData.beyondPlateCrop = true;
  rope.userData.beyondPlateCropBelowY = frameBottom;
  root.add(hand);
  const update = (time, delta) => {
    originalUpdate(time, delta);
    const grip = rope.userData.curve.getPoint(1);
    hand.position.copy(grip);
    // The hand is now the effort attachment (the rope's real end).
    const attachments = root.userData.attachments;
    const cropEnd = attachments.effort.clone();
    for (const [key, value] of Object.entries(attachments)) {
      if (value?.isVector3 && value.distanceTo(cropEnd) < 1e-9) attachments[key] = grip.clone();
      if (Array.isArray(value)) {
        attachments[key] = value.map((point) => (point?.isVector3 && point.distanceTo(cropEnd) < 1e-9 ? grip.clone() : point));
      }
    }
  };
  update(0, 0);
  root.userData.haulingHand = hand;
  return { ...result, update };
}

function singleMovableHoist() {
  const root = new THREE.Group();
  const fixedCenter = new THREE.Vector3(-0.58, 1.6, 0);
  const movableBase = new THREE.Vector3(0.56, -1.12, 0);
  const fixedPitchRadius = 0.64;
  const movablePitchRadius = 0.5;
  const ropeZ = 0;
  const fixedPulley = makePulley({
    radius: fixedPitchRadius - 0.04,
    width: 0.3,
    hubLength: 0.42,
    color: PALETTE.driver,
    spokes: 0,
    bore: 0.072,
  });
  const movablePulley = makePulley({
    radius: movablePitchRadius - 0.04,
    width: 0.32,
    hubLength: 0.44,
    color: PALETTE.driven,
    spokes: 0,
    bore: 0.072,
  });
  fixedPulley.position.copy(fixedCenter);
  movablePulley.position.copy(movableBase);
  const fixedArcCenter = fixedCenter.clone().setZ(ropeZ);
  const freeContactAngle = Math.PI * 0.75;
  const freeContact = fixedArcCenter.clone().add(new THREE.Vector3(
    Math.cos(freeContactAngle) * fixedPitchRadius,
    Math.sin(freeContactAngle) * fixedPitchRadius,
    0,
  ));
  const fixedRightContact = fixedArcCenter.clone().add(new THREE.Vector3(fixedPitchRadius, 0, 0));
  const effortDirection = new THREE.Vector3(1, 1, 0).normalize();
  const fixedArc = circularArcThrough(
    fixedArcCenter,
    freeContact,
    fixedRightContact,
    Z_AXIS,
    effortDirection,
  );
  const fixedShoulder = fixedPitchRadius + 0.15;
  const ceilingUnderside = fixedCenter.y + fixedShoulder + 0.433 + 0.097;
  const anchor = new THREE.Vector3(
    movableBase.x + movablePitchRadius,
    ceilingUnderside - 0.17,
    ropeZ,
  );
  // The fall ends in plate 12's hauling hand just beyond Brown's crop of it,
  // not in mid-air at the crop line.
  const baseEffortLength = 1.3;
  const makeRopePath = (travel) => {
    const movableCenter = movableBase.clone().add(new THREE.Vector3(0, travel, ropeZ));
    const movableLeftContact = movableCenter.clone().add(new THREE.Vector3(-movablePitchRadius, 0, 0));
    const movableRightContact = movableCenter.clone().add(new THREE.Vector3(movablePitchRadius, 0, 0));
    const movableArc = circularArcThrough(
      movableCenter,
      movableLeftContact,
      movableRightContact,
      Z_AXIS,
      new THREE.Vector3(0, -1, 0),
    );
    const effortLength = baseEffortLength + travel * 2;
    const effortEnd = freeContact.clone().addScaledVector(effortDirection, -effortLength);
    const curve = new THREE.CurvePath();
    curve.add(new THREE.LineCurve3(effortEnd, freeContact));
    curve.add(fixedArc);
    curve.add(new THREE.LineCurve3(fixedRightContact, movableLeftContact));
    curve.add(movableArc);
    curve.add(new THREE.LineCurve3(movableRightContact, anchor));
    return {
      curve,
      effortEnd,
      effortLength,
      movableArc,
      movableCenter,
      movableLeftContact,
      movableRightContact,
    };
  };
  const initialPath = makeRopePath(0);
  // Brown draws the rope laid; it runs from the free end to the anchor.
  const rope = makeDynamicMovingBelt(initialPath.curve, {
    closed: false,
    markerCount: 0,
    radius: 0.04,
    laid: true,
  });
  rope.userData.mechanismRope = true;
  const weight = makeHoistLoad({ radius: 0.46, height: 0.62 });
  const fixedHanger = makeSheaveHanger({ radius: fixedPitchRadius, width: 0.3, openHook: true });
  fixedHanger.position.copy(fixedCenter);
  const { ceiling: support } = addHookStaple(fixedHanger, fixedShoulder,
    { width: 2.65, offset: 0.78 });
  const movableHanger = makeSheaveHanger({ radius: movablePitchRadius, width: 0.32, direction: -1 });
  const anchorEye = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.025, 12, 40), matte(PALETTE.ink));
  anchorEye.position.copy(anchor).add(new THREE.Vector3(0, 0.085, 0));
  const hand = makeHaulingHand(effortDirection, 0.04);
  hand.userData.role = 'hauling-hand-beyond-plate-crop';
  root.add(fixedPulley, movablePulley, rope, weight, fixedHanger, movableHanger, anchorEye, hand);
  root.userData.blocks = { fixedPulley, movablePulley, fixedHanger, movableHanger,
    rope, weight, support, anchorEye, hand };
  root.userData.cameraFov = 18;
  root.userData.mechanism = 'single-movable-pulley-hoist';
  root.userData.fixedContact = {
    arc: fixedArc,
    axis: Z_AXIS.clone(),
    object: fixedPulley,
    radius: fixedPitchRadius,
  };
  root.userData.nominalRopeLength = initialPath.curve.getLength();
  root.userData.anchor = anchor.clone();

  const update = (time) => {
    const frequency = 0.66;
    const travel = Math.sin(time * frequency) * 0.3;
    const loadSpeed = Math.cos(time * frequency) * 0.3 * frequency;
    const effortTravel = travel * 2;
    const effortSpeed = loadSpeed * 2;
    const path = makeRopePath(travel);
    rope.userData.setCurve(path.curve);
    // Constant length measured from the free end: each arc-length coordinate
    // is a fixed piece of rope, so the lay is not shifted along the path.
    rope.userData.updateDistance(0);
    hand.position.copy(path.effortEnd);
    movablePulley.position.copy(path.movableCenter).setZ(0);
    movableHanger.position.copy(movablePulley.position);
    weight.position.copy(movableHanger.position).add(movableHanger.userData.attachment)
      .add(new THREE.Vector3(0, -0.20, 0));
    const fixedAngularSpeed = -Math.sign(fixedArc.sweep) * effortSpeed / fixedPitchRadius;
    const movableAngularSpeed = -loadSpeed / movablePitchRadius;
    setSpin(fixedPulley, -Math.sign(fixedArc.sweep) * effortTravel / fixedPitchRadius);
    setSpin(movablePulley, -travel / movablePitchRadius);
    root.userData.attachments = {
      anchor: anchor.clone(),
      effort: path.effortEnd,
      load: path.movableCenter.clone(),
    };
    root.userData.movableContact = {
      arc: path.movableArc,
      axis: Z_AXIS.clone(),
      object: movablePulley,
      radius: movablePitchRadius,
    };
    root.userData.kinematics = {
      effortDisplacement: effortTravel,
      effortForceOverLoad: 0.5,
      effortSpeed,
      fixedAngularSpeed,
      fixedPitchRadius,
      loadDisplacement: travel,
      loadSpeed,
      mechanicalAdvantage: 2,
      movableAngularSpeed,
      movablePitchRadius,
      ropeLength: path.curve.getLength(),
      supportingSegments: 2,
    };
  };
  // Fit the swept silhouette including the hand and its tail.
  const fit = new THREE.Box3();
  for (let i = 0; i < 24; i += 1) {
    update(i * 2 * Math.PI / (0.66 * 24));
    root.updateMatrixWorld(true);
    fit.union(new THREE.Box3().setFromObject(root, true));
  }
  root.userData.cameraFitBounds = fit;
  update(0);
  return { root, update, cameraDirection: new THREE.Vector3(0.3, 0.15, 10) };
}

function movableHoist(variant = 0) {
  const root = new THREE.Group();
  const fixedCenter = new THREE.Vector2(variant === 2 ? 0.72 : -0.72, 1.35);
  const movableBase = new THREE.Vector2(variant === 1 ? -0.7 : 0.65, -0.72);
  const radiusFixed = variant === 2 ? 0.48 : 0.55;
  const radiusMovable = variant === 1 ? 0.5 : 0.58;
  const fixed = makePulley({ radius: radiusFixed, width: 0.3, color: PALETTE.driver });
  const movable = makePulley({ radius: radiusMovable, width: 0.3, color: PALETTE.driven });
  fixed.position.set(fixedCenter.x, fixedCenter.y, 0);
  movable.position.set(movableBase.x, movableBase.y, 0);
  const cable = makeDynamicCable({ maxSegments: 36, radius: 0.043, color: PALETTE.belt });
  const weight = makeWeight(PALETTE.driven, 0.72);
  const freeEnd = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), matte(PALETTE.accent));
  root.add(fixed, movable, cable, weight, freeEnd);
  addAxle(root, fixed.position, 1.25);
  addCeiling(root, 4.5, 2.15);
  baseRailForPulley(root, -2.15, 4.8);

  const anchor = variant === 1
    ? new THREE.Vector3(1.3, 2.02, 0.05)
    : new THREE.Vector3(-1.5, 2.02, 0.05);
  const update = (time) => {
    const travel = Math.sin(time * 0.7) * 0.28;
    const movableY = movableBase.y + travel;
    movable.position.y = movableY;
    weight.position.set(movable.position.x, movableY - 0.75, 0);
    const freeY = -0.7 - travel * 2;
    const leftContact = new THREE.Vector3(movable.position.x - radiusMovable, movableY, 0.05);
    const rightContact = new THREE.Vector3(movable.position.x + radiusMovable, movableY, 0.05);
    const points = [anchor];
    if (anchor.x < movable.position.x) {
      points.push(leftContact, ...sampledArc(movable.position, radiusMovable, Math.PI, 0, 9));
    } else {
      points.push(rightContact, ...sampledArc(movable.position, radiusMovable, 0, -Math.PI, 9));
    }
    const approachAngle = fixedCenter.x < movable.position.x ? 0 : Math.PI;
    points.push(
      new THREE.Vector3(fixedCenter.x + Math.cos(approachAngle) * radiusFixed, fixedCenter.y, 0.05),
      ...sampledArc(fixedCenter, radiusFixed, approachAngle, approachAngle + (approachAngle === 0 ? -Math.PI : Math.PI), 9),
      new THREE.Vector3(
        fixedCenter.x + Math.cos(approachAngle + Math.PI) * radiusFixed,
        freeY,
        0.05,
      ),
    );
    cable.userData.setPoints(points);
    freeEnd.position.copy(points.at(-1));
    setSpin(fixed, -travel * 2.4);
    setSpin(movable, travel * 2.1);
  };
  update(0);
  return { root, update, cameraDirection: new THREE.Vector3(6.2, 3.8, 8.4) };
}

function blockAndTackle() {
  // Plate 14 draws a four-sheave upper block over a three-sheave lower block,
  // both solid round-ended wooden shells with mortise slots. With four over
  // three, the only reeving that uses every sheave makes the standing part
  // fast to a becket on the lower block: becket, U1, L1, U2, L2, U3, L3, U4,
  // then the fall. Seven parts carry the lower block, so the ideal advantage
  // is 7; Brown's rule of twice the lower sheaves (6) ignores the becket part.
  const root = new THREE.Group();
  const topGroup = new THREE.Group();
  const bottomGroup = new THREE.Group();
  const topY = 1.65;
  const bottomBaseY = -1.2;
  const topX = -0.13;
  const bottomX = 0.13;
  const pitchRadius = 0.34;
  const ropeRadius = 0.034;
  const topLevels = [0.63, 0.21, -0.21, -0.63];
  const bottomLevels = [0.42, 0, -0.42];
  topGroup.position.set(topX, topY, 0);
  bottomGroup.position.set(bottomX, bottomBaseY, 0);
  const makeSheaves = (levels, group, color) => levels.map((z) => {
    const pulley = makePulley({
      radius: pitchRadius - ropeRadius,
      width: 0.22,
      color,
      spokes: 0,
      bore: 0.072,
    });
    pulley.position.z = z;
    group.add(pulley);
    return pulley;
  });
  const topPulleys = makeSheaves(topLevels, topGroup, PALETTE.driver);
  const bottomPulleys = makeSheaves(bottomLevels, bottomGroup, PALETTE.driven);
  const topCase = makeTackleCase({ levels: topLevels, radius: pitchRadius, width: 0.22, direction: 1 });
  const bottomCase = makeTackleCase({ levels: bottomLevels, radius: pitchRadius, width: 0.22, direction: -1 });
  topGroup.add(topCase);
  bottomGroup.add(bottomCase);
  const weight = makeHoistLoad({ radius: 0.26, round: true });
  bottomGroup.add(weight);
  weight.position.copy(bottomCase.userData.attachment).add(new THREE.Vector3(0, -0.2, 0));

  // All upper sheaves share one axle line and all lower ones another, so the
  // four tangent points in the XY projection are common to every pair.
  const tangentOffsets = (bottomY) => {
    const centerDirection = new THREE.Vector3(topX - bottomX, topY - bottomY, 0).normalize();
    const right = new THREE.Vector3(centerDirection.y, -centerDirection.x, 0).multiplyScalar(pitchRadius);
    return { centerDirection, right, left: right.clone().negate() };
  };
  const topCenterAt = (z) => new THREE.Vector3(topX, topY, z);
  const bottomCenterAt = (z, bottomY) => new THREE.Vector3(bottomX, bottomY, z);
  // The becket eye stands on the lower block's front end cheek, on the line of
  // the first rising part so that part leaves it straight.
  const becketZ = bottomCase.userData.edges.at(-1);
  const becketRise = 0.45;
  const becketLocal = (() => {
    const { centerDirection, left } = tangentOffsets(bottomBaseY);
    return left.clone().addScaledVector(centerDirection, becketRise).setZ(becketZ);
  })();
  const becketEye = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.018, 12, 40), matte(PALETTE.ink));
  becketEye.position.copy(becketLocal).add(new THREE.Vector3(0, -0.05, 0));
  becketEye.userData.role = 'becket-eye-on-lower-block';
  bottomGroup.add(becketEye);
  const baseEffortLength = 2.15;
  const makeRopePath = (travel, targetLength = null) => {
    const bottomY = bottomBaseY + travel;
    const { left, right } = tangentOffsets(bottomY);
    const curve = new THREE.CurvePath();
    const anchor = bottomCenterAt(0, bottomY).add(becketLocal);
    let current = anchor.clone();
    const bottomArcs = [];
    const topArcs = [];
    topLevels.forEach((topZ, index) => {
      const topCenter = topCenterAt(topZ);
      const topLeft = topCenter.clone().add(left);
      const rising = new THREE.LineCurve3(current, topLeft);
      const last = index === topLevels.length - 1;
      const topRight = topCenter.clone().add(right);
      const topEnd = last
        ? right.clone().applyAxisAngle(Z_AXIS, 0.4).add(topCenter)
        : topRight;
      const topArc = circularArcThrough(topCenter, topLeft, topEnd, Z_AXIS, rising.getTangent(1));
      curve.add(rising);
      curve.add(topArc);
      topArcs.push(topArc);
      current = topArc.getPoint(1);
      if (last) return;
      const bottomCenter = bottomCenterAt(bottomLevels[index], bottomY);
      const bottomRight = bottomCenter.clone().add(right);
      const bottomLeft = bottomCenter.clone().add(left);
      const falling = new THREE.LineCurve3(current, bottomRight);
      const bottomArc = circularArcThrough(bottomCenter, bottomRight, bottomLeft, Z_AXIS, falling.getTangent(1));
      curve.add(falling);
      curve.add(bottomArc);
      bottomArcs.push(bottomArc);
      current = bottomLeft;
    });
    // The small fleet angles make the spans slightly longer than their
    // vertical projections; solve the free end from the remaining rope length
    // so the rope stays taut at every pose.
    const internalLength = curve.getLength();
    const effortLength = targetLength === null
      ? baseEffortLength
      : targetLength - internalLength;
    if (effortLength <= 0) {
      throw new RangeError('Movement 14 has insufficient free rope length.');
    }
    const effortStart = current;
    const effortEnd = effortStart.clone().addScaledVector(topArcs.at(-1).getTangent(1), effortLength);
    curve.add(new THREE.LineCurve3(effortStart, effortEnd));
    return {
      anchor,
      bottomArcs,
      bottomY,
      curve,
      effortEnd,
      effortLength,
      internalLength,
      topArcs,
    };
  };
  const initialPath = makeRopePath(0);
  const nominalRopeLength = initialPath.curve.getLength();
  const rope = makeDynamicMovingBelt(initialPath.curve, {
    closed: false,
    markerCount: 0,
    radius: ropeRadius,
    laid: true,
  });
  rope.userData.mechanismRope = true;
  root.add(topGroup, bottomGroup, rope);
  root.userData.cameraFov = 18;
  root.userData.mechanism = 'seven-part-block-and-tackle';
  root.userData.nominalRopeLength = nominalRopeLength;
  root.userData.blocks = {
    becketEye,
    bottom: bottomGroup,
    bottomPulleys,
    top: topGroup,
    topPulleys,
    topCase,
    bottomCase,
    rope,
    weight,
  };
  const topFactors = [1, 3, 5, 7];
  const bottomFactors = [2, 4, 6];
  const update = (time) => {
    const frequency = 0.56;
    const travel = Math.sin(time * frequency) * 0.2;
    const loadSpeed = Math.cos(time * frequency) * 0.2 * frequency;
    const path = makeRopePath(travel, nominalRopeLength);
    const derivativeStep = 1e-5;
    const nextPath = makeRopePath(travel + derivativeStep, nominalRopeLength);
    const effortPerLoad = (
      nextPath.effortLength - path.effortLength
    ) / derivativeStep;
    const effortTravel = path.effortLength - baseEffortLength;
    const effortSpeed = effortPerLoad * loadSpeed;
    bottomGroup.position.y = path.bottomY;
    rope.userData.setCurve(path.curve);
    // Rope speed relative to each sheave: the n-th sheave met from the becket
    // passes n load speeds of rope (upper sheaves odd, lower ones even).
    const bottomAngularSpeeds = bottomFactors.map((factor) => -factor * loadSpeed / pitchRadius);
    const topAngularSpeeds = topFactors.map((factor) => -factor * loadSpeed / pitchRadius);
    bottomPulleys.forEach((pulley, index) => {
      setSpin(pulley, -bottomFactors[index] * travel / pitchRadius);
    });
    topPulleys.forEach((pulley, index) => {
      setSpin(pulley, -topFactors[index] * travel / pitchRadius);
    });
    root.userData.attachments = {
      anchor: path.anchor,
      effort: path.effortEnd,
      load: new THREE.Vector3(bottomX, path.bottomY, 0),
    };
    root.userData.contacts = {
      bottomArcs: path.bottomArcs,
      topArcs: path.topArcs,
    };
    root.userData.kinematics = {
      bottomAngularSpeeds,
      effortDisplacement: effortTravel,
      effortForceOverLoad: 1 / 7,
      effortPerLoad,
      effortSpeed,
      loadDisplacement: travel,
      loadSpeed,
      mechanicalAdvantage: 7,
      nominalBrownRuleAdvantage: 6,
      pitchRadius,
      ropeLength: path.curve.getLength(),
      supportingSegments: 7,
      topAngularSpeeds,
    };
  };
  update(0);
  // Brown hangs the tackle in open space: no ground or shadow below.
  root.userData.hideGround = true;
  // Slightly raised, as the plate shows the upper block's top mortises.
  return { root, update, cameraDirection: new THREE.Vector3(8, 1.8, 5.8) };
}

function cascadePulleys(variant) {
  const root = new THREE.Group();
  const configurations = {
    19: [[-0.65, 0.9], [0.35, -0.05], [-0.55, -1.02]],
    20: [[0.65, 1.05], [-0.25, 0], [0.6, -1.05]],
    21: [[-0.5, 0.8], [0.5, -0.45]],
    22: [[0, 1.05], [-0.65, 0.12], [0.35, -0.68], [-0.45, -1.38]],
  };
  const bases = configurations[variant];
  const pulleys = bases.map(([x, y], index) => {
    const pulley = makePulley({
      radius: 0.34 - index * 0.018,
      width: 0.23,
      color: index === 0 ? PALETTE.driver : PALETTE.driven,
      spokes: 3,
    });
    pulley.position.set(x, y, 0);
    root.add(pulley);
    return pulley;
  });
  const cables = pulleys.map(() => {
    const cable = makeDynamicCable({ maxSegments: 18, radius: 0.035, color: PALETTE.belt });
    root.add(cable);
    return cable;
  });
  const weight = makeWeight(PALETTE.driven, 0.6);
  root.add(weight);
  addCeiling(root, 4.5, 2.25);
  baseRailForPulley(root, -2.4, 4.8);
  const update = (time) => {
    const drive = Math.sin(time * 0.55) * 0.24;
    pulleys.forEach((pulley, index) => {
      const [baseX, baseY] = bases[index];
      const amplitude = drive / 2 ** index;
      pulley.position.set(baseX, baseY + amplitude, 0);
      setSpin(pulley, (index % 2 ? -1 : 1) * time * (1 + index * 0.18));
      const radius = 0.34 - index * 0.018;
      const anchorX = baseX + (index % 2 ? -0.72 : 0.72);
      const anchorY = index === 0 ? 2.08 : pulleys[index - 1].position.y - 0.2;
      const attach = index < pulleys.length - 1
        ? pulleys[index + 1].position.clone().add(new THREE.Vector3(0, 0.36, 0.05))
        : new THREE.Vector3(baseX + (index % 2 ? 0.9 : -0.9), -1.7 - drive * 4, 0.05);
      const arcStart = index % 2 ? 0 : Math.PI;
      cables[index].userData.setPoints([
        new THREE.Vector3(anchorX, anchorY, 0.05),
        new THREE.Vector3(pulley.position.x + Math.cos(arcStart) * radius, pulley.position.y, 0.05),
        ...sampledArc(pulley.position, radius, arcStart, arcStart + (index % 2 ? -Math.PI : Math.PI), 7),
        attach,
      ]);
    });
    const last = pulleys.at(-1);
    weight.position.set(last.position.x, last.position.y - 0.78, 0);
  };
  update(0);
  return { root, update, cameraDirection: new THREE.Vector3(6.4, 4.0, 8.5) };
}

function compensatedMovableDrive() {
  const root = new THREE.Group();
  const driverCenter = new THREE.Vector2(-2.8, 0.5);
  const compensatorBase = new THREE.Vector2(0.35, 0.9);
  const movableBase = new THREE.Vector2(1.30, -1.35);
  const driverRadius = 0.72;
  const compensatorRadius = 0.40;
  const movableRadius = 0.56;
  const beltLane = 0.14;
  const beltSpeed = 0.82;
  const frequency = 0.55;
  const movableAmplitude = 0.3;

  const driver = makePulley({
    radius: driverRadius - 0.045,
    width: 0.5,
    hubLength: 0.6,
    spokes: 0,
    color: PALETTE.driver,
    grooves: 1,
  });
  const movable = makePulley({
    radius: movableRadius - 0.045,
    width: 0.5,
    hubLength: 0.6,
    spokes: 0,
    color: PALETTE.driven,
    grooves: 1,
  });
  const compensatorRear = makePulley({
    radius: compensatorRadius - 0.045,
    width: 0.18,
    color: PALETTE.accent,
    spokes: 0,
    bore: 0.082,
  });
  const compensatorFront = makePulley({
    radius: compensatorRadius - 0.045,
    width: 0.18,
    color: PALETTE.accent,
    spokes: 0,
    bore: 0.082,
  });
  driver.position.set(driverCenter.x, driverCenter.y, 0);
  movable.position.set(movableBase.x, movableBase.y, 0);
  compensatorRear.position.set(compensatorBase.x, compensatorBase.y, -beltLane);
  compensatorFront.position.set(compensatorBase.x, compensatorBase.y, beltLane);

  const commonTangent = (a, ra, b, rb, crossed, component, side) => {
    const offset = b.clone().sub(a);
    const distance = offset.length();
    const direction = offset.multiplyScalar(1 / distance);
    const perpendicular = new THREE.Vector2(-direction.y, direction.x);
    const radiusSign = crossed ? -1 : 1;
    const cosine = (ra - radiusSign * rb) / distance;
    const sine = Math.sqrt(1 - cosine * cosine);
    const candidates = [-1, 1].map((sign) => direction.clone().multiplyScalar(cosine)
      .addScaledVector(perpendicular, sign * sine));
    candidates.sort((u, v) => side * (v[component] - u[component]));
    const normal = candidates[0];
    return { a: a.clone().addScaledVector(normal, ra), b: b.clone().addScaledVector(normal, rb * radiusSign) };
  };
  const inPlane = (point, z) => new THREE.Vector3(point.x, point.y, z);
  const sweepBetween = (center, start, end, sign) => {
    const a = Math.atan2(start.y - center.y, start.x - center.x);
    const b = Math.atan2(end.y - center.y, end.x - center.x);
    let delta = b - a;
    while (sign * delta < 0) delta += sign * Math.PI * 2;
    return delta;
  };
  const makeBeltPath = (compensatorY, movableY) => {
    const compensatorCenter = new THREE.Vector2(compensatorBase.x, compensatorY);
    const movableCenter = new THREE.Vector2(movableBase.x, movableY);
    const driverCenter3 = new THREE.Vector3(driverCenter.x, driverCenter.y, 0);
    const movableCenter3 = new THREE.Vector3(movableCenter.x, movableCenter.y, 0);
    const rearCompensatorCenter = new THREE.Vector3(
      compensatorCenter.x,
      compensatorCenter.y,
      -beltLane,
    );
    const frontCompensatorCenter = new THREE.Vector3(
      compensatorCenter.x,
      compensatorCenter.y,
      beltLane,
    );

    // The outer passes use external tangents; the returning passes cross
    // the projected center lines. Their separate axial tracks keep them apart.
    const top = commonTangent(driverCenter, driverRadius, compensatorCenter, compensatorRadius, false, 'y', 1);
    const bottom = commonTangent(driverCenter, driverRadius, compensatorCenter, compensatorRadius, true, 'y', -1);
    const outside = commonTangent(compensatorCenter, compensatorRadius, movableCenter, movableRadius, false, 'x', 1);
    const inside = commonTangent(compensatorCenter, compensatorRadius, movableCenter, movableRadius, true, 'x', 1);
    const driverTop = inPlane(top.a, -beltLane);
    const driverLower = inPlane(bottom.a, beltLane);
    const rearEntry = inPlane(top.b, -beltLane);
    const rearExit = inPlane(outside.a, -beltLane);
    const frontEntry = inPlane(bottom.b, beltLane);
    const frontExit = inPlane(inside.a, beltLane);
    const movableRightRear = inPlane(outside.b, -beltLane);
    const movableLeftFront = inPlane(inside.b, beltLane);
    const rearCompensatorArc = new CircularArcCurve3(
      rearCompensatorCenter,
      rearEntry.clone().sub(rearCompensatorCenter),
      Z_AXIS,
      sweepBetween(compensatorCenter, rearEntry, rearExit, -1),
    );
    const movableWrap = new AxialWrapCurve3(
      movableCenter3,
      movableRightRear.clone().setZ(0).sub(movableCenter3),
      Z_AXIS,
      sweepBetween(movableCenter, movableRightRear, movableLeftFront, -1),
      beltLane * 2,
    );
    const frontCompensatorArc = new CircularArcCurve3(
      frontCompensatorCenter,
      frontExit.clone().sub(frontCompensatorCenter),
      Z_AXIS,
      sweepBetween(compensatorCenter, frontExit, frontEntry, 1),
    );
    const driverWrap = new AxialWrapCurve3(
      driverCenter3,
      driverLower.clone().setZ(0).sub(driverCenter3),
      Z_AXIS,
      sweepBetween(driverCenter, driverLower, driverTop, -1),
      -beltLane * 2,
    );

    const tangentTransition = (start, end, startTangent, endTangent) => {
      const handleLength = Math.min(0.46, start.distanceTo(end) * 0.28);
      return new TangentCubicBezierCurve3(
        start,
        start.clone().addScaledVector(startTangent, handleLength),
        end.clone().addScaledVector(endTangent, -handleLength),
        end,
      );
    };

    const curve = new THREE.CurvePath();
    curve.add(tangentTransition(
      driverTop,
      rearEntry,
      driverWrap.getTangent(1),
      rearCompensatorArc.getTangent(0),
    ));
    curve.add(rearCompensatorArc);
    curve.add(tangentTransition(
      rearExit,
      movableRightRear,
      rearCompensatorArc.getTangent(1),
      movableWrap.getTangent(0),
    ));
    curve.add(movableWrap);
    curve.add(tangentTransition(
      movableLeftFront,
      frontExit,
      movableWrap.getTangent(1),
      frontCompensatorArc.getTangent(0),
    ));
    curve.add(frontCompensatorArc);
    curve.add(tangentTransition(
      frontEntry,
      driverLower,
      frontCompensatorArc.getTangent(1),
      driverWrap.getTangent(0),
    ));
    curve.add(driverWrap);
    for (const arc of [rearCompensatorArc, movableWrap, frontCompensatorArc, driverWrap]) {
      arc.getLength = () => Math.hypot(arc.radialStart.length() * arc.sweep, arc.axialTravel ?? 0);
      arc.getPointAt = (u, target) => arc.getPoint(u, target);
      arc.getTangentAt = (u, target) => arc.getTangent(u, target);
    }
    return {
      curve,
      driverWrap,
      frontCompensatorArc,
      movableWrap,
      rearCompensatorArc,
    };
  };

  const materialContacts = (path) => [1, 3, 5, 7].map((index) => ({
    arc: path.curve.curves[index],
    entryAngle: Math.atan2(path.curve.curves[index].radialStart.y, path.curve.curves[index].radialStart.x),
    distance: path.curve.curves.slice(0, index).reduce((sum, segment) => sum + segment.getLength(), 0),
  }));
  const initialBeltPath = makeBeltPath(compensatorBase.y, movableBase.y);
  const initialContacts = materialContacts(initialBeltPath);
  const nominalBeltLength = initialBeltPath.curve.getLength();
  const beltLengthResidual = (compensatorY, movableY) => (
    makeBeltPath(compensatorY, movableY).curve.getLength() - nominalBeltLength
  );
  const solveCompensatorY = (movableY) => {
    let previousY = -0.1;
    let previousResidual = beltLengthResidual(previousY, movableY);
    let bestY = previousY;
    let bestResidual = Math.abs(previousResidual);
    let bracket = null;
    const samples = 48;
    for (let index = 1; index <= samples; index += 1) {
      const candidateY = THREE.MathUtils.lerp(-0.1, 1.42, index / samples);
      const candidateResidual = beltLengthResidual(candidateY, movableY);
      if (Math.abs(candidateResidual) < bestResidual) {
        bestResidual = Math.abs(candidateResidual);
        bestY = candidateY;
      }
      if (candidateResidual === 0 || previousResidual * candidateResidual < 0) {
        bracket = [previousY, candidateY];
        break;
      }
      previousY = candidateY;
      previousResidual = candidateResidual;
    }
    if (!bracket) return bestY;
    let [lower, upper] = bracket;
    let lowerResidual = beltLengthResidual(lower, movableY);
    for (let iteration = 0; iteration < 42; iteration += 1) {
      const middle = (lower + upper) / 2;
      const middleResidual = beltLengthResidual(middle, movableY);
      if (lowerResidual * middleResidual <= 0) {
        upper = middle;
      } else {
        lower = middle;
        lowerResidual = middleResidual;
      }
    }
    return (lower + upper) / 2;
  };

  // Brown hatches the band as a laid rope and draws the weight cord as a
  // plain cord; both render as the shared laid rope.
  const belt = makeDynamicMovingBelt(initialBeltPath.curve, {
    markerCount: 0,
    radius: 0.045,
    laid: true,
  });
  belt.userData.mechanismBelt = true;
  belt.userData.continuousThreePulleyLoop = true;

  const guideRadius = 0.20;
  const ropePlane = 0.5;
  const guideCenters = [
    new THREE.Vector3(compensatorBase.x + guideRadius, 2.12, ropePlane),
    new THREE.Vector3(2.39, 2.12, ropePlane),
  ];
  const guides = guideCenters.map((center) => {
    const guide = makePulley({
      radius: guideRadius - 0.03,
      width: 0.2,
      color: PALETTE.muted,
      spokes: 0,
      bore: 0.082,
    });
    guide.position.copy(center);
    return guide;
  });
  const suspensionStartOffset = compensatorRadius + 0.30;
  const weightEyeOffset = 0.22;
  const weightBaseY = 0.70;
  const makeSuspensionPath = (compensatorY, weightY) => {
    const start = new THREE.Vector3(
      compensatorBase.x,
      compensatorY + suspensionStartOffset,
      ropePlane,
    );
    const firstLeft = guideCenters[0].clone().add(new THREE.Vector3(-guideRadius, 0, 0));
    const firstTop = guideCenters[0].clone().add(new THREE.Vector3(0, guideRadius, 0));
    const secondTop = guideCenters[1].clone().add(new THREE.Vector3(0, guideRadius, 0));
    const secondRight = guideCenters[1].clone().add(new THREE.Vector3(guideRadius, 0, 0));
    const end = new THREE.Vector3(
      guideCenters[1].x + guideRadius,
      weightY + weightEyeOffset,
      ropePlane,
    );
    const firstArc = circularArcThrough(
      guideCenters[0],
      firstLeft,
      firstTop,
      Z_AXIS,
      new THREE.Vector3(0, 1, 0),
    );
    const secondArc = circularArcThrough(
      guideCenters[1],
      secondTop,
      secondRight,
      Z_AXIS,
      new THREE.Vector3(1, 0, 0),
    );
    const curve = new THREE.CurvePath();
    curve.add(new THREE.LineCurve3(start, firstLeft));
    curve.add(firstArc);
    curve.add(new THREE.LineCurve3(firstTop, secondTop));
    curve.add(secondArc);
    curve.add(new THREE.LineCurve3(secondRight, end));
    return { curve, end, guideArcs: [firstArc, secondArc], start };
  };
  const initialSuspension = makeSuspensionPath(compensatorBase.y, weightBaseY);
  const suspension = makeDynamicMovingBelt(initialSuspension.curve, {
    closed: false,
    markerCount: 0,
    radius: 0.03,
    laid: true,
  });
  suspension.userData.mechanismRope = true;
  const weight = makeHoistLoad({ radius: 0.27, height: 0.5 });
  weight.userData.body.material.color.set(PALETTE.brass);
  weight.position.set(guideCenters[1].x + guideRadius, weightBaseY, ropePlane);

  root.add(
    driver,
    movable,
    compensatorRear,
    compensatorFront,
    belt,
    ...guides,
    suspension,
    weight,
  );
  const driverAxle = addKeyedShaft(driver, 0.80);
  const movableAxle = addKeyedShaft(movable, 0.80);
  const compensatorAxle = addAxle(
    root,
    new THREE.Vector3(compensatorBase.x, compensatorBase.y, 0.07),
    1.02,
  );
  // Brown draws no frame: the guide pulleys B and the driver turn on plain
  // axle stubs, as elsewhere in the belt family (p60 support policy).
  const guideAxles = guides.map((guide) => addAxle(root, guide.position, 0.42));
  const hanger = new THREE.Group();
  const shoulder = compensatorRadius + 0.10;
  for (const z of [-0.36, ropePlane]) {
    hanger.add(makeBeam(new THREE.Vector3(0, 0, z), new THREE.Vector3(0, shoulder, z),
      { thickness: 0.055, depth: 0.045, color: PALETTE.ink }));
  }
  hanger.add(makeBeam(new THREE.Vector3(0, shoulder, -0.36), new THREE.Vector3(0, shoulder, ropePlane),
    { thickness: 0.055, depth: 0.045, color: PALETTE.ink }));
  const eye = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.022, 12, 40), matte(PALETTE.ink));
  eye.position.set(0, shoulder + 0.11, ropePlane);
  hanger.add(eye);
  root.add(hanger);
  root.userData.cameraFov = 18;

  root.userData.mechanism = 'counterweighted-single-belt-movable-pulley-drive';
  root.userData.nominalBeltLength = nominalBeltLength;
  root.userData.nominalSuspensionLength = initialSuspension.curve.getLength();
  root.userData.blocks = {
    belt,
    hanger,
    suspension,
    compensatorAxle,
    compensatorFront,
    compensatorRear,
    driver,
    driverAxle,
    guideAxles,
    guides,
    movable,
    movableAxle,
    weight,
  };

  const update = (time) => {
    const movableDisplacement = Math.sin(time * frequency) * movableAmplitude;
    const movableSpeed = Math.cos(time * frequency) * movableAmplitude * frequency;
    const movableY = movableBase.y + movableDisplacement;
    const compensatorY = solveCompensatorY(movableY);
    const epsilon = 1e-4;
    const nextCompensatorY = solveCompensatorY(movableY + epsilon);
    const compensatorMotionRatio = (nextCompensatorY - compensatorY) / epsilon;
    const compensatorSpeed = compensatorMotionRatio * movableSpeed;
    const weightY = weightBaseY - (compensatorY - compensatorBase.y);
    const path = makeBeltPath(compensatorY, movableY);
    const suspensionPath = makeSuspensionPath(compensatorY, weightY);
    const beltDistance = time * beltSpeed;

    movable.position.y = movableY;
    compensatorRear.position.y = compensatorY;
    compensatorFront.position.y = compensatorY;
    compensatorAxle.position.y = compensatorY;
    weight.position.y = weightY;
    belt.userData.setCurve(path.curve);
    belt.userData.updateDistance(beltDistance);
    suspension.userData.setCurve(suspensionPath.curve);
    // The cord is fast to the hanger at the path start and keeps its length,
    // so each arc-length coordinate is a fixed piece of cord.
    suspension.userData.updateDistance(0);
    hanger.position.set(compensatorBase.x, compensatorY, 0);

    const contacts = materialContacts(path);
    const beforeContacts = materialContacts(makeBeltPath(compensatorY - epsilon * compensatorMotionRatio, movableY - epsilon));
    const afterContacts = materialContacts(makeBeltPath(compensatorY + epsilon * compensatorMotionRatio, movableY + epsilon));
    const angularSpeeds = [];
    const relativeMaterialSpeeds = [];
    const axialSlipSpeeds = [];
    [compensatorRear, movable, compensatorFront, driver].forEach((pulley, index) => {
      const { arc, distance } = contacts[index];
      const flow = beltSpeed - (afterContacts[index].distance - beforeContacts[index].distance)
        / (2 * epsilon) * movableSpeed;
      const angularTravelPerLength = initialContacts[index].arc.sweep / initialContacts[index].arc.getLength();
      const angleDelta = contacts[index].entryAngle - initialContacts[index].entryAngle;
      setSpin(pulley, angleDelta + (beltDistance - distance + initialContacts[index].distance) * angularTravelPerLength);
      const entrySpeed = (afterContacts[index].entryAngle - beforeContacts[index].entryAngle) / (2 * epsilon) * movableSpeed;
      angularSpeeds.push(entrySpeed + flow * angularTravelPerLength);
      relativeMaterialSpeeds.push(flow);
      axialSlipSpeeds.push(flow * (arc.axialTravel ?? 0) / arc.getLength());
    });
    suspensionPath.guideArcs.forEach((arc, index) => {
      setSpin(
        guides[index],
        Math.sign(arc.sweep) * (compensatorY - compensatorBase.y) / guideRadius,
      );
    });

    root.userData.attachments = {
      counterweight: suspensionPath.end,
      slidingFrame: suspensionPath.start,
    };
    root.userData.beltContacts = {
      compensator: [path.rearCompensatorArc, path.frontCompensatorArc],
      driver: path.driverWrap,
      movable: path.movableWrap,
    };
    root.userData.kinematics = {
      beltCount: 1,
      beltLength: path.curve.getLength(),
      beltSpeed,
      compensatorAngularSpeeds: [angularSpeeds[0], angularSpeeds[2]],
      relativeMaterialSpeeds,
      axialSlipSpeeds,
      compensatorDisplacement: compensatorY - compensatorBase.y,
      compensatorMotionRatio,
      compensatorSpeed,
      counterweightSpeed: -compensatorSpeed,
      driverAngularSpeed: angularSpeeds[3],
      movableAngularSpeed: angularSpeeds[1],
      movableDisplacement,
      movableSpeed,
      oppositeCompensatorDirections:
        Math.sign(path.rearCompensatorArc.sweep)
          === -Math.sign(path.frontCompensatorArc.sweep),
      suspensionLength: suspensionPath.curve.getLength(),
    };
  };
  update(0);
  // Frame Brown's view on the swept mechanism.
  freezeFitBoundsWithout(root, update, 2 * Math.PI / frequency, []);
  return {
    root,
    cameraDirection: new THREE.Vector3(0.3, 0.15, 10),
    update,
  };
}

function compensatedMovableDriveLegacy() {
  const root = new THREE.Group();
  const beltPlanes = [-0.14, 0.14];
  const driverCenter = new THREE.Vector2(-1.55, 0.45);
  const compensatorBase = new THREE.Vector2(0.35, 0.72);
  const movableBase = new THREE.Vector2(0.9, -1.25);
  const driverRadius = 0.72;
  const compensatorRadius = 0.42;
  const movableRadius = 0.64;
  const guideRadius = 0.22;
  const ropePlane = 0.48;
  const frequency = 0.55;
  const movableAmplitude = 0.3;
  const driverAngularSpeedMagnitude = 1.12;

  const driver = makePulley({
    radius: driverRadius - 0.05,
    width: 0.34,
    color: PALETTE.driver,
  });
  const compensator = makePulley({
    radius: compensatorRadius - 0.05,
    width: 0.56,
    color: PALETTE.accent,
    grooves: 2,
    spokes: 3,
  });
  const movable = makePulley({
    radius: movableRadius - 0.05,
    width: 0.36,
    color: PALETTE.driven,
  });
  driver.position.set(driverCenter.x, driverCenter.y, beltPlanes[0]);
  compensator.position.set(compensatorBase.x, compensatorBase.y, 0);
  movable.position.set(movableBase.x, movableBase.y, beltPlanes[1]);

  const guideCenters = [
    new THREE.Vector3(compensatorBase.x + guideRadius, 1.82, ropePlane),
    new THREE.Vector3(1.53, 1.82, ropePlane),
  ];
  const guides = guideCenters.map((center) => {
    const guide = makePulley({
      radius: guideRadius - 0.04,
      width: 0.2,
      color: PALETTE.muted,
      spokes: 3,
    });
    guide.position.copy(center);
    root.add(guide);
    return guide;
  });

  // The engraving collapses the two grooves of A into one face-on circle.
  // In 3D the staggered belt planes make the actual serial drive unambiguous:
  // the first belt turns A's shaft and its second groove turns the movable pulley.
  const makeBeltPaths = (compensatorY, movableY) => [
    beltCurveOpen(
      driverCenter,
      new THREE.Vector2(compensatorBase.x, compensatorY),
      driverRadius,
      compensatorRadius,
      beltPlanes[0],
    ),
    beltCurveOpen(
      new THREE.Vector2(compensatorBase.x, compensatorY),
      new THREE.Vector2(movableBase.x, movableY),
      compensatorRadius,
      movableRadius,
      beltPlanes[1],
    ),
  ];
  const openBeltLength = (first, second, firstRadius, secondRadius) => {
    const centerDistance = first.distanceTo(second);
    const radiusDifference = firstRadius - secondRadius;
    const tangentLength = Math.sqrt(centerDistance ** 2 - radiusDifference ** 2);
    return 2 * tangentLength
      + Math.PI * (firstRadius + secondRadius)
      + 2 * radiusDifference * Math.asin(radiusDifference / centerDistance);
  };
  const workingLengths = (compensatorY, movableY) => {
    const compensatorCenter = new THREE.Vector2(compensatorBase.x, compensatorY);
    const movableCenter = new THREE.Vector2(movableBase.x, movableY);
    return [
      openBeltLength(driverCenter, compensatorCenter, driverRadius, compensatorRadius),
      openBeltLength(compensatorCenter, movableCenter, compensatorRadius, movableRadius),
    ];
  };
  const nominalWorkingLengths = workingLengths(compensatorBase.y, movableBase.y);
  const nominalCombinedBeltLength = nominalWorkingLengths[0] + nominalWorkingLengths[1];
  const combinedLengthResidual = (compensatorY, movableY) => {
    const lengths = workingLengths(compensatorY, movableY);
    return lengths[0] + lengths[1] - nominalCombinedBeltLength;
  };
  const solveCompensatorY = (movableY) => {
    let lower = -0.15;
    let upper = 1.45;
    for (let iteration = 0; iteration < 48; iteration += 1) {
      const middle = (lower + upper) / 2;
      if (combinedLengthResidual(middle, movableY) > 0) upper = middle;
      else lower = middle;
    }
    return (lower + upper) / 2;
  };
  const beltLengthCenterDerivative = (first, second, firstRadius, secondRadius) => {
    const centerDistance = first.distanceTo(second);
    const radiusDifference = firstRadius - secondRadius;
    return 2 * Math.sqrt(centerDistance ** 2 - radiusDifference ** 2) / centerDistance;
  };
  const compensatorMotionRatio = (compensatorY, movableY) => {
    const compensatorCenter = new THREE.Vector2(compensatorBase.x, compensatorY);
    const movableCenter = new THREE.Vector2(movableBase.x, movableY);
    const driverDistance = driverCenter.distanceTo(compensatorCenter);
    const movableDistance = compensatorCenter.distanceTo(movableCenter);
    const firstDerivative = beltLengthCenterDerivative(
      driverCenter,
      compensatorCenter,
      driverRadius,
      compensatorRadius,
    );
    const secondDerivative = beltLengthCenterDerivative(
      compensatorCenter,
      movableCenter,
      compensatorRadius,
      movableRadius,
    );
    const withRespectToCompensator = firstDerivative
      * (compensatorY - driverCenter.y) / driverDistance
      + secondDerivative * (compensatorY - movableY) / movableDistance;
    const withRespectToMovable = secondDerivative
      * (movableY - compensatorY) / movableDistance;
    return -withRespectToMovable / withRespectToCompensator;
  };

  const initialBeltPaths = makeBeltPaths(compensatorBase.y, movableBase.y);
  const belts = initialBeltPaths.map((path, index) => {
    const belt = makeDynamicMovingBelt(path, {
      markerCount: index === 0 ? 7 : 6,
      radius: 0.045,
    });
    belt.userData.mechanismBelt = true;
    belt.userData.beltStage = index;
    root.add(belt);
    return belt;
  });

  const ropeStartOffset = compensatorRadius + 0.14;
  const weightEyeOffset = 0.38;
  const weightBaseY = -0.08;
  const weight = makeWeight(PALETTE.brass, 0.78);
  weight.position.set(guideCenters[1].x + guideRadius, weightBaseY, ropePlane);
  const makeSuspensionPath = (compensatorY, weightY) => {
    const start = new THREE.Vector3(
      compensatorBase.x,
      compensatorY + ropeStartOffset,
      ropePlane,
    );
    const firstLeft = guideCenters[0].clone().add(new THREE.Vector3(-guideRadius, 0, 0));
    const firstTop = guideCenters[0].clone().add(new THREE.Vector3(0, guideRadius, 0));
    const secondTop = guideCenters[1].clone().add(new THREE.Vector3(0, guideRadius, 0));
    const secondRight = guideCenters[1].clone().add(new THREE.Vector3(guideRadius, 0, 0));
    const end = new THREE.Vector3(
      guideCenters[1].x + guideRadius,
      weightY + weightEyeOffset,
      ropePlane,
    );
    const firstArc = circularArcThrough(
      guideCenters[0],
      firstLeft,
      firstTop,
      Z_AXIS,
      new THREE.Vector3(0, 1, 0),
    );
    const secondArc = circularArcThrough(
      guideCenters[1],
      secondTop,
      secondRight,
      Z_AXIS,
      new THREE.Vector3(1, 0, 0),
    );
    const curve = new THREE.CurvePath();
    curve.add(new THREE.LineCurve3(start, firstLeft));
    curve.add(firstArc);
    curve.add(new THREE.LineCurve3(firstTop, secondTop));
    curve.add(secondArc);
    curve.add(new THREE.LineCurve3(secondRight, end));
    return { curve, end, guideArcs: [firstArc, secondArc], start };
  };
  const initialSuspension = makeSuspensionPath(compensatorBase.y, weightBaseY);
  const suspension = makeDynamicMovingBelt(initialSuspension.curve, {
    closed: false,
    color: PALETTE.ink,
    markerCount: 5,
    radius: 0.03,
  });
  suspension.userData.mechanismRope = true;
  root.add(driver, compensator, movable, suspension, weight);

  const driverAxle = addAxle(root, driver.position, 1.05);
  const compensatorAxle = addAxle(root, compensator.position, 1.2);
  const movableAxle = addAxle(root, movable.position, 1.08);
  const guideAxles = guides.map((guide) => addAxle(root, guide.position, 0.64));
  const compensatorCarrier = makeDynamicLink({
    thickness: 0.12,
    depth: 0.18,
    color: PALETTE.frame,
    jointRadius: 0.1,
  });
  const movableCarrier = makeDynamicLink({
    thickness: 0.11,
    depth: 0.16,
    color: PALETTE.frame,
    jointRadius: 0.09,
  });
  const hanger = makeDynamicLink({
    thickness: 0.09,
    depth: 0.12,
    color: PALETTE.frame,
    jointRadius: 0.08,
  });
  root.add(compensatorCarrier, movableCarrier, hanger);

  // Subtle guide rails make both permitted translations explicit. Brown's
  // description notes A's guides even though the engraving omits them.
  root.add(
    makeBeam(
      new THREE.Vector3(compensatorBase.x - 0.54, 0.2, -0.48),
      new THREE.Vector3(compensatorBase.x - 0.54, 1.32, -0.48),
      { thickness: 0.075, depth: 0.1, color: PALETTE.frame },
    ),
    makeBeam(
      new THREE.Vector3(compensatorBase.x + 0.54, 0.2, -0.48),
      new THREE.Vector3(compensatorBase.x + 0.54, 1.32, -0.48),
      { thickness: 0.075, depth: 0.1, color: PALETTE.frame },
    ),
    makeBeam(
      new THREE.Vector3(movableBase.x - 0.78, -1.72, -0.48),
      new THREE.Vector3(movableBase.x - 0.78, -0.72, -0.48),
      { thickness: 0.075, depth: 0.1, color: PALETTE.frame },
    ),
    makeBeam(
      new THREE.Vector3(movableBase.x + 0.78, -1.72, -0.48),
      new THREE.Vector3(movableBase.x + 0.78, -0.72, -0.48),
      { thickness: 0.075, depth: 0.1, color: PALETTE.frame },
    ),
  );
  guideCenters.forEach((center) => {
    root.add(makeBeam(
      new THREE.Vector3(center.x, center.y, -0.42),
      new THREE.Vector3(center.x, 2.18, -0.42),
      { thickness: 0.08, depth: 0.11, color: PALETTE.frame },
    ));
  });
  addCeiling(root, 5.4, 2.22);
  baseRailForPulley(root, -1.96, 5.5);

  root.userData.mechanism = 'counterweighted-compound-movable-pulley-drive';
  root.userData.nominalCombinedBeltLength = nominalCombinedBeltLength;
  root.userData.nominalWorkingBeltLengths = nominalWorkingLengths;
  root.userData.nominalSuspensionLength = initialSuspension.curve.getLength();
  root.userData.blocks = {
    compensator,
    compensatorAxle,
    driver,
    driverAxle,
    guideAxles,
    guides,
    movable,
    movableAxle,
    weight,
  };

  const update = (time) => {
    const movableDisplacement = Math.sin(time * frequency) * movableAmplitude;
    const movableSpeed = Math.cos(time * frequency) * movableAmplitude * frequency;
    const movableY = movableBase.y + movableDisplacement;
    const compensatorY = solveCompensatorY(movableY);
    const compensatorDisplacement = compensatorY - compensatorBase.y;
    const motionRatio = compensatorMotionRatio(compensatorY, movableY);
    const compensatorSpeed = motionRatio * movableSpeed;
    const weightY = weightBaseY - compensatorDisplacement;
    const weightSpeed = -compensatorSpeed;
    const paths = makeBeltPaths(compensatorY, movableY);
    const exactLengths = workingLengths(compensatorY, movableY);
    const suspensionPath = makeSuspensionPath(compensatorY, weightY);
    const beltSpeed = driverAngularSpeedMagnitude * driverRadius;
    const driverAngularSpeed = Math.sign(paths[0].curves[3].sweep)
      * beltSpeed / driverRadius;
    const compensatorAngularSpeed = Math.sign(paths[0].curves[1].sweep)
      * beltSpeed / compensatorRadius;
    const movableAngularSpeed = Math.sign(paths[1].curves[1].sweep)
      * beltSpeed / movableRadius;
    const beltDistance = beltSpeed * time;
    const ropeTravel = compensatorDisplacement;

    compensator.position.y = compensatorY;
    compensatorAxle.position.y = compensatorY;
    movable.position.y = movableY;
    movableAxle.position.y = movableY;
    weight.position.y = weightY;
    compensatorCarrier.userData.setEndpoints(
      new THREE.Vector3(compensatorBase.x - 0.47, compensatorY, -0.34),
      new THREE.Vector3(compensatorBase.x + 0.47, compensatorY, -0.34),
    );
    movableCarrier.userData.setEndpoints(
      new THREE.Vector3(movableBase.x - 0.69, movableY, -0.34),
      new THREE.Vector3(movableBase.x + 0.69, movableY, -0.34),
    );
    hanger.userData.setEndpoints(
      new THREE.Vector3(compensatorBase.x, compensatorY, ropePlane),
      suspensionPath.start,
    );
    belts.forEach((belt, index) => {
      belt.userData.setCurve(paths[index]);
      belt.userData.updateDistance(beltDistance);
    });
    suspension.userData.setCurve(suspensionPath.curve);
    suspension.userData.updateDistance(ropeTravel);

    setSpin(driver, driverAngularSpeed * time);
    setSpin(compensator, compensatorAngularSpeed * time);
    setSpin(movable, movableAngularSpeed * time);
    guides.forEach((guide, index) => {
      setSpin(
        guide,
        Math.sign(suspensionPath.guideArcs[index].sweep) * ropeTravel / guideRadius,
      );
    });

    root.userData.attachments = {
      counterweight: suspensionPath.end,
      slidingFrame: suspensionPath.start,
    };
    root.userData.beltContacts = [
      {
        arc: paths[0].curves[3],
        axis: Z_AXIS.clone(),
        beltStage: 0,
        object: driver,
        radius: driverRadius,
      },
      {
        arc: paths[0].curves[1],
        axis: Z_AXIS.clone(),
        beltStage: 0,
        groove: 0,
        object: compensator,
        radius: compensatorRadius,
      },
      {
        arc: paths[1].curves[3],
        axis: Z_AXIS.clone(),
        beltStage: 1,
        groove: 1,
        object: compensator,
        radius: compensatorRadius,
      },
      {
        arc: paths[1].curves[1],
        axis: Z_AXIS.clone(),
        beltStage: 1,
        object: movable,
        radius: movableRadius,
      },
    ];
    root.userData.ropeContacts = suspensionPath.guideArcs.map((arc, index) => ({
      arc,
      axis: Z_AXIS.clone(),
      object: guides[index],
      radius: guideRadius,
    }));
    root.userData.kinematics = {
      beltCount: 2,
      beltLengths: paths.map((path) => path.getLength()),
      beltSpeeds: [beltSpeed, beltSpeed],
      combinedWorkingBeltLength: exactLengths[0] + exactLengths[1],
      compensatorAngularSpeed,
      compensatorDisplacement,
      compensatorMotionRatio: motionRatio,
      compensatorPitchRadii: [compensatorRadius, compensatorRadius],
      compensatorSpeed,
      counterweightDisplacement: -compensatorDisplacement,
      counterweightSpeed: weightSpeed,
      driverAngularSpeed,
      driverPitchRadius: driverRadius,
      guideAngularSpeeds: suspensionPath.guideArcs.map((arc) => (
        Math.sign(arc.sweep) * compensatorSpeed / guideRadius
      )),
      guideRadius,
      movableAngularSpeed,
      movableDisplacement,
      movablePitchRadius: movableRadius,
      movableSpeed,
      suspensionLength: suspensionPath.curve.getLength(),
      workingBeltLengths: exactLengths,
      workingLengthResidual: exactLengths[0] + exactLengths[1]
        - nominalCombinedBeltLength,
    };
  };
  update(0);
  return { root, update, cameraDirection: new THREE.Vector3(0.8, 3.6, 10.5) };
}

function fiddleDrill() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;

  // Reference points measured from the public-domain 525 px engraving.  Its
  // diagonal string is the bow chord; the spindle center is offset to the
  // opposite side from the curved stock by one string-groove radius.
  const sourceRasterLowerBowTip = new THREE.Vector2(92, -468);
  const sourceRasterUpperBowTip = new THREE.Vector2(413, -111);
  const sourceRasterSpindleCenter = new THREE.Vector2(305, -307);
  const sourceRasterBowRise = 86;
  const bowChordLength = 5.25;
  const sourceRasterChordVector = sourceRasterUpperBowTip.clone().sub(
    sourceRasterLowerBowTip
  );
  const sourceRasterChordLength = sourceRasterChordVector.length();
  const sourceScale = bowChordLength / sourceRasterChordLength;
  const chordDirection = sourceRasterChordVector.clone().normalize();
  const chordNormal = new THREE.Vector2(
    -chordDirection.y,
    chordDirection.x,
  );
  const sourceRasterChordMidpoint = sourceRasterLowerBowTip.clone().lerp(
    sourceRasterUpperBowTip,
    0.5,
  );
  const sourceRasterSpindleFromChordMidpoint = sourceRasterSpindleCenter
    .clone().sub(sourceRasterChordMidpoint);
  const sourceRasterTangentCoordinate = sourceRasterSpindleFromChordMidpoint
    .dot(chordDirection);
  const sourceRasterSpindleNormalOffset = -sourceRasterSpindleFromChordMidpoint
    .dot(chordNormal);
  const chordAngle = Math.atan2(chordDirection.y, chordDirection.x);
  const bowRise = sourceRasterBowRise * sourceScale;
  const bowControlRise = bowRise * 2;
  const tangentCoordinate = sourceRasterTangentCoordinate * sourceScale;
  const spindlePitchRadius = sourceRasterSpindleNormalOffset * sourceScale;
  const spindleOuterRadius = spindlePitchRadius * 1.17;
  const spindleDrumRadius = spindlePitchRadius * 0.88;
  const spindleCenter = new THREE.Vector2()
    .addScaledVector(chordDirection, tangentCoordinate)
    .addScaledVector(chordNormal, -spindlePitchRadius);
  const tangentPoint2 = new THREE.Vector2().addScaledVector(
    chordDirection,
    tangentCoordinate,
  );

  const bowTravelAmplitude = bowChordLength * 0.2;
  const bowStroke = bowTravelAmplitude * 2;
  const cyclePeriod = 5.2;
  const driveAngularFrequency = fullTurn / cyclePeriod;
  const pulleyBodyPlaneZ = 0;
  const stringPlaneZ = 0.28;
  const stringRadius = 0.026;
  const stringMarkerCount = 9;
  const spindleWidth = 0.42;
  const spindleShaftLength = 2.0;
  const spindleShaftRadius = 0.075;
  const completeWrapTurns = 1;
  const wrapSweep = -fullTurn * completeWrapTurns;
  const wrapLength = Math.abs(wrapSweep) * spindlePitchRadius;
  const nominalStringLength = bowChordLength + wrapLength;
  const bowStockRadius = 0.105;
  const bowDepthOffset = stringPlaneZ - 0.06;
  const reversalTolerance = 1e-11;

  const chordDirection3 = new THREE.Vector3(
    chordDirection.x,
    chordDirection.y,
    0,
  );
  const chordNormal3 = new THREE.Vector3(
    chordNormal.x,
    chordNormal.y,
    0,
  );
  const spindleCenter3 = new THREE.Vector3(
    spindleCenter.x,
    spindleCenter.y,
    stringPlaneZ,
  );
  const tangentPoint = new THREE.Vector3(
    tangentPoint2.x,
    tangentPoint2.y,
    stringPlaneZ,
  );
  const contactRadiusVector = chordNormal3.clone().multiplyScalar(
    spindlePitchRadius
  );

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.08,
    roughness: 0.67,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.14,
    roughness: 0.58,
  });
  const inkMaterial = matte(PALETTE.ink, {
    metalness: 0.23,
    roughness: 0.48,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.69,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const endpointAt = (displacement, endSign) => new THREE.Vector3()
    .addScaledVector(
      chordDirection3,
      displacement + endSign * bowChordLength / 2,
    )
    .setZ(stringPlaneZ);
  const stringGeometryAt = (displacement) => {
    const lowerEndpoint = endpointAt(displacement, -1);
    const upperEndpoint = endpointAt(displacement, 1);
    const leftSpanLength = tangentCoordinate
      - (displacement - bowChordLength / 2);
    const rightSpanLength = displacement + bowChordLength / 2
      - tangentCoordinate;
    if (leftSpanLength <= 0 || rightSpanLength <= 0) {
      throw new RangeError('Movement 124 bow stroke passed its spindle tangent.');
    }
    return {
      leftSpanLength,
      lowerEndpoint,
      rightSpanLength,
      upperEndpoint,
    };
  };

  const materialPoint = (displacement, velocity, fraction) => {
    const clampedFraction = THREE.MathUtils.clamp(fraction, 0, 1);
    const geometry = stringGeometryAt(displacement);
    const materialCoordinate = clampedFraction * nominalStringLength;
    let position;
    let tangent;
    let region;
    let wrapAngle = null;
    if (materialCoordinate <= geometry.leftSpanLength) {
      position = geometry.lowerEndpoint.clone().addScaledVector(
        chordDirection3,
        materialCoordinate,
      );
      tangent = chordDirection3.clone();
      region = 'lower-straight-span';
    } else if (
      materialCoordinate <= geometry.leftSpanLength + wrapLength
    ) {
      const distanceAroundSpindle = materialCoordinate
        - geometry.leftSpanLength;
      wrapAngle = -distanceAroundSpindle / spindlePitchRadius;
      const radial = contactRadiusVector.clone().applyAxisAngle(
        Z_AXIS,
        wrapAngle,
      );
      position = spindleCenter3.clone().add(radial);
      tangent = chordDirection3.clone().applyAxisAngle(Z_AXIS, wrapAngle);
      region = 'full-spindle-wrap';
    } else {
      const distanceAlongUpperSpan = materialCoordinate
        - geometry.leftSpanLength - wrapLength;
      position = tangentPoint.clone().addScaledVector(
        chordDirection3,
        distanceAlongUpperSpan,
      );
      tangent = chordDirection3.clone();
      region = 'upper-straight-span';
    }
    return {
      fraction: clampedFraction,
      materialCoordinate,
      position,
      region,
      tangent,
      velocity: tangent.clone().multiplyScalar(velocity),
      wrapAngle,
    };
  };

  class FiddleStringCurve extends THREE.Curve {
    constructor(displacement) {
      super();
      this.displacement = displacement;
      const geometry = stringGeometryAt(displacement);
      this.leftSpanLength = geometry.leftSpanLength;
      this.rightSpanLength = geometry.rightSpanLength;
      this.lowerEndpoint = geometry.lowerEndpoint;
      this.upperEndpoint = geometry.upperEndpoint;
      this.curves = [
        new THREE.LineCurve3(this.lowerEndpoint, tangentPoint),
        new CircularArcCurve3(
          spindleCenter3,
          contactRadiusVector,
          Z_AXIS,
          wrapSweep,
        ),
        new THREE.LineCurve3(tangentPoint, this.upperEndpoint),
      ];
      this.arcLength = wrapLength;
      this.totalLength = nominalStringLength;
      this.wrapTurns = completeWrapTurns;
    }

    getPoint(fraction, target = new THREE.Vector3()) {
      return target.copy(materialPoint(
        this.displacement,
        0,
        fraction,
      ).position);
    }

    getPointAt(fraction, target = new THREE.Vector3()) {
      return this.getPoint(fraction, target);
    }

    getTangent(fraction, target = new THREE.Vector3()) {
      return target.copy(materialPoint(
        this.displacement,
        0,
        fraction,
      ).tangent);
    }

    getTangentAt(fraction, target = new THREE.Vector3()) {
      return this.getTangent(fraction, target);
    }

    getLength() {
      return this.totalLength;
    }
  }

  const stringCurveAt = (displacement) => new FiddleStringCurve(displacement);

  const bow = new THREE.Group();
  bow.rotation.z = chordAngle;
  bow.userData.axis = chordDirection3.clone();
  bow.userData.role = 'rigid-curved-reciprocating-fiddle-bow';
  const localBowCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-bowChordLength / 2, 0, bowDepthOffset),
    new THREE.Vector3(0, bowControlRise, bowDepthOffset),
    new THREE.Vector3(bowChordLength / 2, 0, bowDepthOffset),
  );
  const bowStock = new THREE.Mesh(
    new THREE.TubeGeometry(localBowCurve, 120, bowStockRadius, 12, false),
    driverMaterial,
  );
  bowStock.userData.role = 'curved-stock-of-fiddle-bow';
  const bowGrip = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.16, 0.82, 8, 18),
    inkMaterial,
  );
  bowGrip.rotation.z = Math.PI / 2;
  bowGrip.position.set(0, bowRise, bowDepthOffset);
  bowGrip.userData.role = 'center-handgrip-on-bow-stock';
  const bowTips = [-1, 1].map((endSign) => {
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(bowStockRadius * 1.24, 22, 14),
      driverMaterial,
    );
    tip.position.set(
      endSign * bowChordLength / 2,
      0,
      bowDepthOffset,
    );
    tip.userData.endSign = endSign;
    tip.userData.role = endSign < 0
      ? 'lower-tip-of-rigid-bow'
      : 'upper-tip-of-rigid-bow';
    return tip;
  });
  const stringKnots = [-1, 1].map((endSign) => {
    const knot = new THREE.Mesh(
      new THREE.SphereGeometry(stringRadius * 2.05, 16, 11),
      drivenMaterial,
    );
    knot.position.set(endSign * bowChordLength / 2, 0, stringPlaneZ);
    knot.userData.endSign = endSign;
    knot.userData.role = endSign < 0
      ? 'lower-string-end-fixed-to-bow-tip'
      : 'upper-string-end-fixed-to-bow-tip';
    return knot;
  });
  const endpointBindings = [];
  for (const endSign of [-1, 1]) {
    for (let bandIndex = 0; bandIndex < 3; bandIndex += 1) {
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(
          bowStockRadius * 1.18,
          0.016,
          7,
          22,
        ),
        inkMaterial,
      );
      band.position.set(
        endSign * (
          bowChordLength / 2 - 0.11 - bandIndex * 0.075
        ),
        0.04 + bandIndex * 0.014,
        bowDepthOffset,
      );
      band.rotation.y = Math.PI / 2;
      band.userData.endSign = endSign;
      band.userData.role = 'binding-securing-string-to-bow-tip';
      endpointBindings.push(band);
    }
  }
  bow.add(
    bowStock,
    bowGrip,
    ...bowTips,
    ...stringKnots,
    ...endpointBindings,
  );

  const initialStringCurve = stringCurveAt(0);
  // Brown draws the bowstring as cord: the shared laid rope. Its lay is
  // fixed from the lower tied end, so it carries no white flow markers.
  const string = makeDynamicMovingBelt(initialStringCurve, {
    closed: false,
    color: PALETTE.belt,
    markerCount: 0,
    radius: stringRadius,
    tubularSegments: 260,
    laid: true,
  });
  const stringMarkers = string.children.filter((child) => (
    child.userData.isFlowMarker === true
  ));
  // Material probe coordinates along the string (no longer drawn).
  const stringMarkerFractions = Array.from({ length: stringMarkerCount }, (_, index) => (
    (index + 1) / (stringMarkerCount + 1)
  ));
  string.userData.closed = false;
  string.userData.materialMarkerFractions = stringMarkerFractions;
  string.userData.markers = stringMarkers;
  string.userData.mechanismString = true;
  string.userData.physicalString = true;
  string.userData.role = 'single-bowstring-with-one-complete-spindle-wrap';
  string.userData.wrapTurns = completeWrapTurns;

  const spindle = new THREE.Group();
  const spindleRotor = new THREE.Group();
  spindle.position.set(spindleCenter.x, spindleCenter.y, 0);
  spindle.add(spindleRotor);
  spindle.userData.axis = Z_AXIS.clone();
  spindle.userData.pitchRadius = spindlePitchRadius;
  spindle.userData.role = 'fixed-axis-alternating-fiddle-drill-spindle';
  spindle.userData.rotor = spindleRotor;
  const spindleDrum = new THREE.Mesh(
    new THREE.CylinderGeometry(
      spindleDrumRadius,
      spindleDrumRadius,
      spindleWidth,
      56,
    ),
    drivenMaterial,
  );
  spindleDrum.rotation.x = Math.PI / 2;
  spindleDrum.position.z = pulleyBodyPlaneZ;
  spindleDrum.userData.role = 'string-grooved-drum-on-drill-spindle';
  const spindleFlanges = [-1, 1].map((axialSign) => {
    const flange = new THREE.Mesh(
      new THREE.CylinderGeometry(
        spindleOuterRadius,
        spindleOuterRadius,
        0.075,
        60,
      ),
      drivenMaterial,
    );
    flange.rotation.x = Math.PI / 2;
    flange.position.z = pulleyBodyPlaneZ + axialSign * spindleWidth / 2;
    flange.userData.axialSign = axialSign;
    flange.userData.role = axialSign > 0
      ? 'front-flange-retaining-bowstring'
      : 'rear-flange-retaining-bowstring';
    return flange;
  });
  const grooveRings = [-1, 1].map((axialSign) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(
        spindlePitchRadius,
        0.028,
        8,
        52,
      ),
      inkMaterial,
    );
    ring.position.z = axialSign > 0
      ? stringPlaneZ
      : pulleyBodyPlaneZ - spindleWidth * 0.38;
    ring.userData.axialSign = axialSign;
    ring.userData.role = 'edge-of-string-groove-on-spindle-pulley';
    // Line-drawing edging, not a part: hidden, kept for block references.
    ring.visible = false;
    ring.userData.retiredInkOutline = true;
    return ring;
  });
  const spindleShaft = makeShaft({
    axis: Z_AXIS,
    color: PALETTE.ink,
    length: spindleShaftLength,
    radius: spindleShaftRadius,
  });
  spindleShaft.position.z = 0.34;
  spindleShaft.userData.role = 'drill-spindle-shaft-fast-to-pulley';
  const spindleFaceRing = new THREE.Mesh(
    new THREE.TorusGeometry(
      spindlePitchRadius * 0.52,
      0.032,
      8,
      44,
    ),
    inkMaterial,
  );
  spindleFaceRing.position.z = pulleyBodyPlaneZ + spindleWidth / 2 + 0.08;
  spindleFaceRing.userData.role = 'front-face-ring-on-drill-pulley';
  spindleFaceRing.visible = false;
  spindleFaceRing.userData.retiredInkOutline = true;
  const spindleRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(
      spindlePitchRadius * 0.73,
      0.052,
      0.03,
    ),
    indexMaterial,
  );
  spindleRotationIndex.position.set(
    spindlePitchRadius * 0.39,
    0,
    pulleyBodyPlaneZ + spindleWidth / 2 + 0.115,
  );
  spindleRotationIndex.userData.role = 'white-index-showing-spindle-reversal';
  const spindleRotationDot = new THREE.Mesh(
    new THREE.SphereGeometry(0.052, 18, 12),
    indexMaterial,
  );
  spindleRotationDot.position.set(
    spindlePitchRadius * 0.73,
    0,
    pulleyBodyPlaneZ + spindleWidth / 2 + 0.12,
  );
  spindleRotationDot.userData.role = 'white-rim-dot-showing-spindle-speed';
  const drillChuck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.2, 0.34, 30),
    inkMaterial,
  );
  drillChuck.rotation.x = Math.PI / 2;
  drillChuck.position.z = 1.28;
  drillChuck.userData.role = 'chuck-fast-to-drill-spindle';
  const drillBit = new THREE.Mesh(
    new THREE.ConeGeometry(0.075, 0.72, 22),
    inkMaterial,
  );
  drillBit.rotation.x = Math.PI / 2;
  drillBit.position.z = 1.79;
  drillBit.userData.role = 'drill-bit-on-alternating-spindle';
  spindleRotor.add(
    spindleDrum,
    ...spindleFlanges,
    ...grooveRings,
    spindleShaft,
    spindleFaceRing,
    spindleRotationIndex,
    spindleRotationDot,
    drillChuck,
    drillBit,
  );

  const bearingPlaneZ = -0.69;
  const spindleBearing = new THREE.Mesh(
    new THREE.TorusGeometry(spindleShaftRadius * 2.25, 0.046, 9, 34),
    frameMaterial,
  );
  spindleBearing.position.set(
    spindleCenter.x,
    spindleCenter.y,
    bearingPlaneZ + 0.11,
  );
  spindleBearing.userData.role = 'fixed-bearing-supporting-drill-spindle';
  const supportBottomY = spindleCenter.y - 1.56;
  const spindleSupportPost = makeBeam(
    new THREE.Vector3(spindleCenter.x, supportBottomY, bearingPlaneZ),
    new THREE.Vector3(spindleCenter.x, spindleCenter.y, bearingPlaneZ),
    { thickness: 0.13, depth: 0.18, color: PALETTE.frame },
  );
  spindleSupportPost.userData.role = 'fixed-post-behind-drill-spindle';
  const supportBase = makeBeam(
    new THREE.Vector3(spindleCenter.x - 1.05, supportBottomY, bearingPlaneZ),
    new THREE.Vector3(spindleCenter.x + 1.05, supportBottomY, bearingPlaneZ),
    { thickness: 0.14, depth: 0.2, color: PALETTE.frame },
  );
  supportBase.userData.role = 'fixed-base-of-drill-spindle-support';
  const stringContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.046, 18, 12),
    indexMaterial,
  );
  stringContactMarker.position.copy(tangentPoint);
  stringContactMarker.position.z += stringRadius * 1.7;
  stringContactMarker.userData.role = 'white-marker-at-string-spindle-tangent';
  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(
      bowChordLength + bowStroke + 0.3,
      bowRise + spindleOuterRadius * 2 + 0.55,
      0.01,
    ),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.copy(chordNormal3).multiplyScalar(
    (bowRise - spindlePitchRadius) / 2
  );
  cameraEnvelope.position.z = bearingPlaneZ;
  cameraEnvelope.rotation.z = chordAngle;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role = 'invisible-envelope-of-complete-bow-stroke';

  root.add(
    cameraEnvelope,
    supportBase,
    spindleSupportPost,
    spindleBearing,
    spindle,
    bow,
    string,
    stringContactMarker,
  );

  const stateAtTime = (time) => {
    const rawCyclePhase = time / cyclePeriod;
    const cyclePhase = THREE.MathUtils.euclideanModulo(rawCyclePhase, 1);
    const driveAngle = time * driveAngularFrequency;
    const bowDisplacement = bowTravelAmplitude * Math.sin(driveAngle);
    const bowVelocity = bowTravelAmplitude * driveAngularFrequency
      * Math.cos(driveAngle);
    const bowAcceleration = -bowTravelAmplitude * driveAngularFrequency ** 2
      * Math.sin(driveAngle);
    const geometry = stringGeometryAt(bowDisplacement);
    const stringCurve = stringCurveAt(bowDisplacement);
    const spindleAngle = -bowDisplacement / spindlePitchRadius;
    const spindleAngularSpeed = -bowVelocity / spindlePitchRadius;
    const spindleAngularAcceleration = -bowAcceleration / spindlePitchRadius;
    const bowTranslation = chordDirection3.clone().multiplyScalar(
      bowDisplacement
    );
    const bowVelocityVector = chordDirection3.clone().multiplyScalar(
      bowVelocity
    );
    const bowAccelerationVector = chordDirection3.clone().multiplyScalar(
      bowAcceleration
    );
    const stringContactVelocity = chordDirection3.clone().multiplyScalar(
      bowVelocity
    );
    const spindleContactVelocity = new THREE.Vector3().crossVectors(
      Z_AXIS.clone().multiplyScalar(spindleAngularSpeed),
      contactRadiusVector,
    );
    const relativeContactVelocity = spindleContactVelocity.clone().sub(
      stringContactVelocity
    );
    const atForwardReversal = Math.abs(cyclePhase - 0.25)
      <= reversalTolerance;
    const atReturnReversal = Math.abs(cyclePhase - 0.75)
      <= reversalTolerance;
    const atReversal = atForwardReversal || atReturnReversal;
    const stage = atForwardReversal
      ? 'bow-reverses-at-forward-end'
      : atReturnReversal
        ? 'bow-reverses-at-return-end'
        : bowVelocity > 0
          ? 'bow-traverses-forward-spindle-turns-clockwise'
          : 'bow-traverses-back-spindle-turns-counterclockwise';
    return {
      atForwardReversal,
      atReturnReversal,
      atReversal,
      bowAcceleration,
      bowAccelerationVector,
      bowDisplacement,
      bowEndpointDistanceError: geometry.lowerEndpoint.distanceTo(
        geometry.upperEndpoint
      ) - bowChordLength,
      bowLowerEndpoint: geometry.lowerEndpoint,
      bowRotation: chordAngle,
      bowTranslation,
      bowUpperEndpoint: geometry.upperEndpoint,
      bowVelocity,
      bowVelocityVector,
      cyclePhase,
      driveAngle,
      leftSpanLength: geometry.leftSpanLength,
      nominalStringLength,
      rawCyclePhase,
      relativeContactVelocity,
      rightSpanLength: geometry.rightSpanLength,
      spindleAngle,
      spindleAngularAcceleration,
      spindleAngularSpeed,
      spindleContactVelocity,
      spindlePitchRadius,
      stage,
      stringContactNormalVelocityError: relativeContactVelocity.dot(
        chordNormal3
      ),
      stringContactPoint: tangentPoint.clone(),
      stringContactTangentialVelocityError: relativeContactVelocity.dot(
        chordDirection3
      ),
      stringContactVelocity,
      stringCount: 1,
      stringCurve,
      stringLength: stringCurve.getLength(),
      stringLengthError: stringCurve.getLength() - nominalStringLength,
      stringPlaneError: tangentPoint.z - stringPlaneZ,
      velocityDiscontinuous: false,
      wrapLength,
      wrapTurns: completeWrapTurns,
    };
  };

  const stringMaterialPointAtTime = (time, fraction) => {
    const state = stateAtTime(time);
    return materialPoint(state.bowDisplacement, state.bowVelocity, fraction);
  };

  root.userData.mechanism = 'single-string-fiddle-drill';
  root.userData.cameraDistanceScale = 1.03;
  root.userData.blocks = {
    bow,
    bowGrip,
    bowStock,
    bowTips,
    cameraEnvelope,
    drillBit,
    drillChuck,
    endpointBindings,
    grooveRings,
    spindle,
    spindleBearing,
    spindleDrum,
    spindleFaceRing,
    spindleFlanges,
    spindleRotationDot,
    spindleRotationIndex,
    spindleRotor,
    spindleShaft,
    spindleSupportPost,
    string,
    stringContactMarker,
    stringKnots,
    stringMarkers,
    supportBase,
  };
  root.userData.geometry = {
    bearingPlaneZ,
    bowChordLength,
    bowControlRise,
    bowDepthOffset,
    bowRise,
    bowStockRadius,
    bowStroke,
    bowTravelAmplitude,
    chordAngle,
    chordDirection,
    chordDirection3,
    chordNormal,
    chordNormal3,
    completeWrapTurns,
    contactRadiusVector,
    cyclePeriod,
    driveAngularFrequency,
    nominalStringLength,
    pulleyBodyPlaneZ,
    reversalTolerance,
    sourceRasterBowRise,
    sourceRasterChordLength,
    sourceRasterChordMidpoint,
    sourceRasterChordVector,
    sourceRasterLowerBowTip,
    sourceRasterSpindleCenter,
    sourceRasterSpindleFromChordMidpoint,
    sourceRasterSpindleNormalOffset,
    sourceRasterTangentCoordinate,
    sourceRasterUpperBowTip,
    sourceScale,
    spindleCenter,
    spindleCenter3,
    spindleDrumRadius,
    spindleOuterRadius,
    spindlePitchRadius,
    spindleShaftLength,
    spindleShaftRadius,
    spindleWidth,
    stringMarkerCount,
    stringMarkerFractions,
    stringPlaneZ,
    stringRadius,
    tangentCoordinate,
    tangentPoint,
    tangentPoint2,
    wrapLength,
    wrapSweep,
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.stringCurveAt = stringCurveAt;
  root.userData.stringMaterialPointAtTime = stringMaterialPointAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    bow.position.copy(state.bowTranslation);
    bow.userData.velocity = state.bowVelocityVector.clone();
    bow.userData.acceleration = state.bowAccelerationVector.clone();
    spindleRotor.rotation.set(0, 0, state.spindleAngle);
    spindle.userData.angularSpeed = state.spindleAngularSpeed;
    spindle.userData.angularAcceleration = state.spindleAngularAcceleration;
    string.userData.setCurve(state.stringCurve);
    string.userData.updateDistance(0);
    root.userData.attachments = {
      lowerBowTip: state.bowLowerEndpoint.clone(),
      upperBowTip: state.bowUpperEndpoint.clone(),
    };
    root.userData.contacts = {
      stringSpindle: {
        contactPoint: state.stringContactPoint.clone(),
        normalVelocityError: state.stringContactNormalVelocityError,
        pitchRadius: spindlePitchRadius,
        tangentialVelocityError: state.stringContactTangentialVelocityError,
        wrapTurns: state.wrapTurns,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(3.8, 3.1, 10.8),
  };
}

function fixedPulleyBellCrankForceRedirector() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;

  // Reference points measured from the public-domain engraving.  The clean
  // 7:6 arm proportions retain the source's nearly horizontal and vertical
  // arms while making the displacement and ideal-force ratios inspectable.
  const sourceRasterPulleyCenter = new THREE.Vector2(157, -151);
  const sourceRasterBellPivot = new THREE.Vector2(397, -351);
  const sourceRasterInputJoint = new THREE.Vector2(226, -351);
  const sourceRasterOutputJoint = new THREE.Vector2(387, -490);
  const sourceScale = 0.22;
  const sourceInputArmLength = 7;
  const sourceOutputArmLength = 6;
  const sourcePulleyCenterFromPivot = new THREE.Vector2(-10.931089, 8);
  const sourcePulleyPitchRadius = 4.2;
  const sourceInputFreeEndY = -14;
  const sourceOutputFreeEnd = new THREE.Vector2(6.468911, -5.598076);
  const inputArmLength = sourceInputArmLength * sourceScale;
  const outputArmLength = sourceOutputArmLength * sourceScale;
  const pulleyCenter2 = sourcePulleyCenterFromPivot.clone().multiplyScalar(
    sourceScale,
  );
  const pulleyPitchRadius = sourcePulleyPitchRadius * sourceScale;
  const inputFreeEndSourceY = sourceInputFreeEndY * sourceScale;
  const outputFreeEndSource = sourceOutputFreeEnd.clone().multiplyScalar(
    sourceScale,
  );
  const motionRatio = -outputArmLength / inputArmLength;
  const idealForceRatio = inputArmLength / outputArmLength;
  const bellAngleAmplitude = Math.PI / 6;
  const cyclePeriod = 5.4;
  const driveAngularFrequency = fullTurn / cyclePeriod;
  const inputCablePlaneZ = 0.28;
  const bellCrankPlaneZ = 0.48;
  const outputCablePlaneZ = 0.68;
  const rearFrameZ = -0.5;
  const cableRadius = 0.03;
  const inputCableMarkerCount = 9;
  const outputCableMarkerCount = 5;
  const pulleyWidth = 0.22;
  const bellArmThickness = 0.18;
  const bellArmDepth = 0.13;
  const pivot = new THREE.Vector2(0, 0);
  const sourceInputArm = new THREE.Vector2(-inputArmLength, 0);
  const sourceOutputArm = new THREE.Vector2(0, -outputArmLength);
  const pulleyCenter = new THREE.Vector3(
    pulleyCenter2.x,
    pulleyCenter2.y,
    inputCablePlaneZ,
  );
  const leftTangentPoint = pulleyCenter.clone().add(
    new THREE.Vector3(-pulleyPitchRadius, 0, 0),
  );
  const inputFreeEndX = leftTangentPoint.x;
  const outputGuideY = outputFreeEndSource.y;
  const sourceOutputCableLength = sourceOutputArm.distanceTo(
    outputFreeEndSource,
  );
  const inputMarkerFractions = Array.from(
    { length: inputCableMarkerCount },
    (_, index) => (index + 1) / (inputCableMarkerCount + 1),
  );
  const outputMarkerFractions = Array.from(
    { length: outputCableMarkerCount },
    (_, index) => (index + 1) / (outputCableMarkerCount + 1),
  );
  const up = new THREE.Vector3(0, 1, 0);

  class SegmentedOpenCableCurve extends THREE.Curve {
    constructor(curves, segmentLengths, metadata = {}) {
      super();
      this.curves = curves;
      this.segmentLengths = segmentLengths;
      this.totalLength = segmentLengths.reduce(
        (sum, length) => sum + length,
        0,
      );
      Object.assign(this, metadata);
    }

    segmentAt(fraction) {
      const clampedFraction = THREE.MathUtils.clamp(fraction, 0, 1);
      const distance = clampedFraction * this.totalLength;
      let segmentStart = 0;
      for (let index = 0; index < this.curves.length; index += 1) {
        const segmentLength = this.segmentLengths[index];
        if (
          distance <= segmentStart + segmentLength
          || index === this.curves.length - 1
        ) {
          const localFraction = segmentLength > 0
            ? THREE.MathUtils.clamp(
              (distance - segmentStart) / segmentLength,
              0,
              1,
            )
            : 0;
          return {
            curve: this.curves[index],
            index,
            localFraction,
          };
        }
        segmentStart += segmentLength;
      }
      throw new RangeError('Movement 126 cable segment lookup failed.');
    }

    getPoint(fraction, target = new THREE.Vector3()) {
      const segment = this.segmentAt(fraction);
      return segment.curve.getPoint(segment.localFraction, target);
    }

    getPointAt(fraction, target = new THREE.Vector3()) {
      return this.getPoint(fraction, target);
    }

    getTangent(fraction, target = new THREE.Vector3()) {
      const segment = this.segmentAt(fraction);
      return segment.curve.getTangent(segment.localFraction, target);
    }

    getTangentAt(fraction, target = new THREE.Vector3()) {
      return this.getTangent(fraction, target);
    }

    getLength() {
      return this.totalLength;
    }
  }

  const inputJointAtAngle = (bellAngle) => sourceInputArm.clone().rotateAround(
    pivot,
    bellAngle,
  );
  const outputJointAtAngle = (bellAngle) => sourceOutputArm.clone().rotateAround(
    pivot,
    bellAngle,
  );

  const tangentGeometryForInputJoint = (inputJoint2) => {
    const inputJoint = new THREE.Vector3(
      inputJoint2.x,
      inputJoint2.y,
      inputCablePlaneZ,
    );
    const relative = inputJoint.clone().sub(pulleyCenter);
    const distanceSquared = relative.lengthSq();
    const tangentReachSquared = distanceSquared - pulleyPitchRadius ** 2;
    if (tangentReachSquared <= 0) {
      throw new RangeError('Movement 126 input joint entered its pulley.');
    }
    const base = relative.clone().multiplyScalar(
      pulleyPitchRadius ** 2 / distanceSquared,
    );
    const offset = new THREE.Vector3(-relative.y, relative.x, 0)
      .multiplyScalar(
        pulleyPitchRadius * Math.sqrt(tangentReachSquared) / distanceSquared,
      );
    const candidates = [
      pulleyCenter.clone().add(base).add(offset),
      pulleyCenter.clone().add(base).sub(offset),
    ];
    const tangentCandidates = candidates.map((tangentPoint) => {
      const arc = circularArcThrough(
        pulleyCenter,
        leftTangentPoint,
        tangentPoint,
        Z_AXIS,
        up,
      );
      const tangentLine = new THREE.LineCurve3(tangentPoint, inputJoint);
      return {
        alignment: arc.getTangent(1).dot(tangentLine.getTangent(0)),
        arc,
        arcLength: Math.abs(arc.sweep) * pulleyPitchRadius,
        inputJoint,
        tangentLine,
        tangentLineLength: tangentPoint.distanceTo(inputJoint),
        tangentPoint,
      };
    });
    const selected = tangentCandidates[0].alignment
      >= tangentCandidates[1].alignment
      ? tangentCandidates[0]
      : tangentCandidates[1];
    if (selected.alignment < 1 - 1e-10) {
      throw new RangeError('Movement 126 selected the wrong pulley tangent.');
    }
    return selected;
  };

  const sourceInputTangentGeometry = tangentGeometryForInputJoint(
    sourceInputArm,
  );
  const sourceInputFreeEnd = new THREE.Vector3(
    inputFreeEndX,
    inputFreeEndSourceY,
    inputCablePlaneZ,
  );
  const sourceInputFreeSpanLength = leftTangentPoint.y
    - sourceInputFreeEnd.y;
  const nominalInputCableLength = sourceInputFreeSpanLength
    + sourceInputTangentGeometry.arcLength
    + sourceInputTangentGeometry.tangentLineLength;

  const inputCableGeometryAt = (inputJoint2) => {
    const tangentGeometry = tangentGeometryForInputJoint(inputJoint2);
    const freeSpanLength = nominalInputCableLength
      - tangentGeometry.arcLength
      - tangentGeometry.tangentLineLength;
    if (freeSpanLength <= 0) {
      throw new RangeError('Movement 126 exhausted its input cable free span.');
    }
    const freeEnd = new THREE.Vector3(
      inputFreeEndX,
      leftTangentPoint.y - freeSpanLength,
      inputCablePlaneZ,
    );
    const freeSpan = new THREE.LineCurve3(freeEnd, leftTangentPoint);
    const curve = new SegmentedOpenCableCurve(
      [freeSpan, tangentGeometry.arc, tangentGeometry.tangentLine],
      [
        freeSpanLength,
        tangentGeometry.arcLength,
        tangentGeometry.tangentLineLength,
      ],
      {
        arcLength: tangentGeometry.arcLength,
        freeEnd,
        freeSpanLength,
        tangentPoint: tangentGeometry.tangentPoint,
        tangentSpanLength: tangentGeometry.tangentLineLength,
        wrapSweep: tangentGeometry.arc.sweep,
      },
    );
    return {
      ...tangentGeometry,
      curve,
      freeEnd,
      freeSpanLength,
    };
  };

  const outputCableGeometryAt = (outputJoint2) => {
    const verticalDifference = outputGuideY - outputJoint2.y;
    const horizontalReachSquared = sourceOutputCableLength ** 2
      - verticalDifference ** 2;
    if (horizontalReachSquared <= 0) {
      throw new RangeError('Movement 126 output cable cannot reach its guide.');
    }
    const freeEnd2 = new THREE.Vector2(
      outputJoint2.x + Math.sqrt(horizontalReachSquared),
      outputGuideY,
    );
    const outputJoint = new THREE.Vector3(
      outputJoint2.x,
      outputJoint2.y,
      outputCablePlaneZ,
    );
    const freeEnd = new THREE.Vector3(
      freeEnd2.x,
      freeEnd2.y,
      outputCablePlaneZ,
    );
    const line = new THREE.LineCurve3(outputJoint, freeEnd);
    const curve = new SegmentedOpenCableCurve(
      [line],
      [sourceOutputCableLength],
      { freeEnd, outputJoint },
    );
    return { curve, freeEnd, freeEnd2, outputJoint };
  };

  const sourceInputCableGeometry = inputCableGeometryAt(sourceInputArm);
  const sourceOutputCableGeometry = outputCableGeometryAt(sourceOutputArm);

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.1,
    roughness: 0.64,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.08,
    roughness: 0.68,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.69,
  });
  const inkMaterial = matte(PALETTE.ink, {
    metalness: 0.23,
    roughness: 0.48,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const bellCrank = new THREE.Group();
  bellCrank.userData.axis = Z_AXIS.clone();
  bellCrank.userData.role = 'rigid-right-angle-bell-crank';
  const inputArm = makeBeam(
    new THREE.Vector3(0, 0, bellCrankPlaneZ),
    new THREE.Vector3(-inputArmLength, 0, bellCrankPlaneZ),
    {
      color: PALETTE.driver,
      depth: bellArmDepth,
      thickness: bellArmThickness,
    },
  );
  inputArm.userData.role = 'seven-unit-horizontal-input-arm';
  const outputArm = makeBeam(
    new THREE.Vector3(0, 0, bellCrankPlaneZ),
    new THREE.Vector3(0, -outputArmLength, bellCrankPlaneZ),
    {
      color: PALETTE.driver,
      depth: bellArmDepth,
      thickness: bellArmThickness,
    },
  );
  outputArm.userData.role = 'six-unit-vertical-output-arm';
  inputArm.traverse((object) => {
    if (object.material) object.material = driverMaterial;
  });
  outputArm.traverse((object) => {
    if (object.material) object.material = driverMaterial;
  });
  const makeBellRing = (position, radius, planeZ, role) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.042, 9, 36),
      driverMaterial,
    );
    ring.position.set(position.x, position.y, planeZ + 0.075);
    ring.userData.role = role;
    return ring;
  };
  const bellPivotRing = makeBellRing(
    pivot,
    0.19,
    bellCrankPlaneZ,
    'fixed-pivot-eye-of-bell-crank',
  );
  const inputJointRing = makeBellRing(
    sourceInputArm,
    0.14,
    inputCablePlaneZ,
    'input-cable-eye-on-seven-unit-arm',
  );
  const outputJointRing = makeBellRing(
    sourceOutputArm,
    0.14,
    outputCablePlaneZ,
    'output-cable-eye-on-six-unit-arm',
  );
  const inputJointPin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.064, 0.064, 0.43, 22),
    inkMaterial,
  );
  inputJointPin.rotation.x = Math.PI / 2;
  inputJointPin.position.set(
    sourceInputArm.x,
    sourceInputArm.y,
    (inputCablePlaneZ + bellCrankPlaneZ) / 2,
  );
  inputJointPin.userData.role = 'pin-joining-input-cable-to-bell-crank';
  const outputJointPin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.064, 0.064, 0.43, 22),
    inkMaterial,
  );
  outputJointPin.rotation.x = Math.PI / 2;
  outputJointPin.position.set(
    sourceOutputArm.x,
    sourceOutputArm.y,
    (bellCrankPlaneZ + outputCablePlaneZ) / 2,
  );
  outputJointPin.userData.role = 'pin-joining-output-cable-to-bell-crank';
  bellCrank.add(
    inputArm,
    outputArm,
    bellPivotRing,
    inputJointRing,
    outputJointRing,
    inputJointPin,
    outputJointPin,
  );

  const redirectPulley = makePulley({
    axis: Z_AXIS,
    color: PALETTE.driven,
    grooves: 1,
    radius: pulleyPitchRadius,
    spokes: 4,
    width: pulleyWidth,
  });
  redirectPulley.position.copy(pulleyCenter);
  redirectPulley.userData.role = 'single-fixed-input-force-redirecting-pulley';
  redirectPulley.userData.pitchRadius = pulleyPitchRadius;
  const redirectPulleyRotor = redirectPulley.userData.rotor;
  const redirectPulleyShaft = makeShaft({
    axis: Z_AXIS,
    color: PALETTE.ink,
    length: 1.32,
    radius: 0.08,
  });
  redirectPulleyShaft.position.copy(pulleyCenter);
  redirectPulleyShaft.userData.role = 'fixed-axis-shaft-of-redirecting-pulley';
  const bellPivotShaft = makeShaft({
    axis: Z_AXIS,
    color: PALETTE.ink,
    length: 1.42,
    radius: 0.085,
  });
  bellPivotShaft.position.set(0, 0, bellCrankPlaneZ);
  bellPivotShaft.userData.role = 'fixed-pivot-shaft-of-bell-crank';

  // Brown hatches both cables as laid rope; each lay is fixed from its tied
  // end, so the cables carry no white flow markers.
  const inputCable = makeDynamicMovingBelt(sourceInputCableGeometry.curve, {
    closed: false,
    color: PALETTE.driven,
    markerCount: 0,
    radius: cableRadius,
    tubularSegments: 150,
    laid: true,
  });
  inputCable.userData.mechanismString = true;
  inputCable.userData.physicalCable = true;
  inputCable.userData.role = 'single-constant-length-input-cable-over-pulley';
  inputCable.userData.materialMarkerFractions = inputMarkerFractions;
  const inputCableMarkers = inputCable.children.filter((child) => child.userData.isFlowMarker);
  const inputCableMesh = inputCable.userData.mesh;
  const outputCable = makeDynamicMovingBelt(sourceOutputCableGeometry.curve, {
    closed: false,
    color: PALETTE.driven,
    markerCount: 0,
    radius: cableRadius,
    tubularSegments: 72,
    laid: true,
  });
  outputCable.userData.mechanismString = true;
  outputCable.userData.physicalCable = true;
  outputCable.userData.role = 'separate-constant-length-output-cable';
  outputCable.userData.materialMarkerFractions = outputMarkerFractions;
  const outputCableMarkers = outputCable.children.filter((child) => child.userData.isFlowMarker);
  const outputCableMesh = outputCable.userData.mesh;

  const inputFreeEndKnot = new THREE.Mesh(
    new THREE.SphereGeometry(cableRadius * 2.05, 16, 11),
    drivenMaterial,
  );
  inputFreeEndKnot.userData.role = 'moving-free-end-of-input-cable';
  const outputFreeEndKnot = new THREE.Mesh(
    new THREE.SphereGeometry(cableRadius * 2.05, 16, 11),
    drivenMaterial,
  );
  outputFreeEndKnot.userData.role = 'horizontally-moving-free-end-of-output-cable';
  const inputDirectionIndex = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.055, 0.34, 5, 14),
    indexMaterial,
  );
  inputDirectionIndex.userData.role = 'white-vertical-input-motion-index';
  const outputDirectionIndex = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.055, 0.34, 5, 14),
    indexMaterial,
  );
  outputDirectionIndex.rotation.z = Math.PI / 2;
  outputDirectionIndex.userData.role = 'white-horizontal-output-motion-index';

  const baseY = -4.05;
  const baseRail = makeBeam(
    new THREE.Vector3(-4.0, baseY, rearFrameZ),
    new THREE.Vector3(2.45, baseY, rearFrameZ),
    { color: PALETTE.frame, depth: 0.22, thickness: 0.17 },
  );
  baseRail.userData.role = 'fixed-base-under-bell-crank-demonstrator';
  const pulleyPost = makeBeam(
    new THREE.Vector3(pulleyCenter.x, baseY, rearFrameZ),
    new THREE.Vector3(pulleyCenter.x, pulleyCenter.y, rearFrameZ),
    { color: PALETTE.frame, depth: 0.2, thickness: 0.15 },
  );
  pulleyPost.userData.role = 'rear-post-supporting-fixed-pulley';
  const pivotPost = makeBeam(
    new THREE.Vector3(0, baseY, rearFrameZ),
    new THREE.Vector3(0, 0, rearFrameZ),
    { color: PALETTE.frame, depth: 0.2, thickness: 0.15 },
  );
  pivotPost.userData.role = 'rear-post-supporting-bell-crank-pivot';
  const frameTie = makeBeam(
    new THREE.Vector3(pulleyCenter.x, pulleyCenter.y, rearFrameZ),
    new THREE.Vector3(0, 0, rearFrameZ),
    { color: PALETTE.frame, depth: 0.18, thickness: 0.13 },
  );
  frameTie.userData.role = 'rear-tie-between-pulley-and-bell-crank-bearings';
  const pulleyBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.058, 9, 38),
    frameMaterial,
  );
  pulleyBearing.position.set(
    pulleyCenter.x,
    pulleyCenter.y,
    rearFrameZ + 0.16,
  );
  pulleyBearing.userData.role = 'fixed-bearing-behind-redirecting-pulley';
  const bellPivotBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.23, 0.062, 9, 38),
    frameMaterial,
  );
  bellPivotBearing.position.set(0, 0, rearFrameZ + 0.16);
  bellPivotBearing.userData.role = 'fixed-bearing-behind-bell-crank';
  const inputEndGuide = makeBeam(
    new THREE.Vector3(inputFreeEndX, -3.98, rearFrameZ + 0.04),
    new THREE.Vector3(inputFreeEndX, -2.17, rearFrameZ + 0.04),
    { color: PALETTE.frame, depth: 0.12, thickness: 0.07 },
  );
  inputEndGuide.userData.role = 'vertical-guide-showing-input-force-direction';
  const outputEndGuide = makeBeam(
    new THREE.Vector3(0.58, outputGuideY, rearFrameZ + 0.04),
    new THREE.Vector3(2.28, outputGuideY, rearFrameZ + 0.04),
    { color: PALETTE.frame, depth: 0.12, thickness: 0.07 },
  );
  outputEndGuide.userData.role = 'horizontal-guide-showing-output-force-direction';
  const inputGuideStandoff = makeBeam(
    new THREE.Vector3(inputFreeEndX, -3.08, rearFrameZ),
    new THREE.Vector3(
      inputFreeEndX,
      -3.08,
      inputCablePlaneZ - 0.08,
    ),
    { color: PALETTE.frame, depth: 0.09, thickness: 0.07 },
  );
  inputGuideStandoff.userData.role = 'input-direction-guide-standoff';
  const outputGuideStandoff = makeBeam(
    new THREE.Vector3(1.43, outputGuideY, rearFrameZ),
    new THREE.Vector3(
      1.43,
      outputGuideY,
      outputCablePlaneZ - 0.08,
    ),
    { color: PALETTE.frame, depth: 0.09, thickness: 0.07 },
  );
  outputGuideStandoff.userData.role = 'output-direction-guide-standoff';
  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(7.2, 7.75, 0.01),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(-0.95, -0.45, -0.78);
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role = 'invisible-full-bell-crank-force-path-envelope';

  root.add(
    cameraEnvelope,
    baseRail,
    pulleyPost,
    pivotPost,
    frameTie,
    inputEndGuide,
    outputEndGuide,
    inputGuideStandoff,
    outputGuideStandoff,
    pulleyBearing,
    bellPivotBearing,
    redirectPulleyShaft,
    bellPivotShaft,
    redirectPulley,
    bellCrank,
    inputCable,
    outputCable,
    inputFreeEndKnot,
    outputFreeEndKnot,
    inputDirectionIndex,
    outputDirectionIndex,
  );

  const inputCableMaterialPointAtGeometry = (geometry, fraction) => {
    const clampedFraction = THREE.MathUtils.clamp(fraction, 0, 1);
    const materialCoordinate = clampedFraction * nominalInputCableLength;
    let region;
    if (materialCoordinate <= geometry.freeSpanLength) {
      region = 'vertical-input-free-span';
    } else if (
      materialCoordinate <= geometry.freeSpanLength + geometry.arcLength
    ) {
      region = 'fixed-pulley-wrap';
    } else {
      region = 'pulley-to-bell-crank-tangent-span';
    }
    return {
      fraction: clampedFraction,
      materialCoordinate,
      position: geometry.curve.getPointAt(clampedFraction),
      region,
      tangent: geometry.curve.getTangentAt(clampedFraction),
    };
  };

  const stateAtTime = (time) => {
    const driveAngle = time * driveAngularFrequency;
    const rawCyclePhase = time / cyclePeriod;
    const cyclePhase = THREE.MathUtils.euclideanModulo(rawCyclePhase, 1);
    const bellAngle = bellAngleAmplitude * Math.sin(driveAngle);
    const bellAngularSpeed = bellAngleAmplitude
      * driveAngularFrequency * Math.cos(driveAngle);
    const bellAngularAcceleration = -bellAngleAmplitude
      * driveAngularFrequency ** 2 * Math.sin(driveAngle);
    const inputArmVector = sourceInputArm.clone().rotateAround(
      pivot,
      bellAngle,
    );
    const outputArmVector = sourceOutputArm.clone().rotateAround(
      pivot,
      bellAngle,
    );
    const inputJoint = inputArmVector.clone();
    const outputJoint = outputArmVector.clone();
    const inputJointVelocity = new THREE.Vector2(
      -inputArmVector.y,
      inputArmVector.x,
    ).multiplyScalar(bellAngularSpeed);
    const outputJointVelocity = new THREE.Vector2(
      -outputArmVector.y,
      outputArmVector.x,
    ).multiplyScalar(bellAngularSpeed);
    const inputCableGeometry = inputCableGeometryAt(inputJoint);
    const inputTangentDirection = inputCableGeometry.inputJoint.clone()
      .sub(inputCableGeometry.tangentPoint)
      .normalize();
    const inputFreeEndVelocityY = inputTangentDirection.x
      * inputJointVelocity.x + inputTangentDirection.y * inputJointVelocity.y;
    const inputFreeEndVelocity = new THREE.Vector3(
      0,
      inputFreeEndVelocityY,
      0,
    );
    const redirectPulleyAngle = -(
      inputCableGeometry.freeEnd.y - sourceInputFreeEnd.y
    ) / pulleyPitchRadius;
    const redirectPulleyAngularSpeed = -inputFreeEndVelocityY
      / pulleyPitchRadius;
    const leftContactRadius = leftTangentPoint.clone().sub(pulleyCenter);
    const redirectPulleyContactVelocity = new THREE.Vector3()
      .crossVectors(Z_AXIS, leftContactRadius)
      .multiplyScalar(redirectPulleyAngularSpeed);
    const inputCableContactVelocity = up.clone().multiplyScalar(
      inputFreeEndVelocityY,
    );
    const inputContactRelativeVelocity = redirectPulleyContactVelocity
      .clone().sub(inputCableContactVelocity);
    const outputCableGeometry = outputCableGeometryAt(outputJoint);
    const outputVerticalDifference = outputGuideY - outputJoint.y;
    const outputHorizontalReach = outputCableGeometry.freeEnd.x
      - outputJoint.x;
    const outputFreeEndVelocityX = outputJointVelocity.x
      + outputVerticalDifference * outputJointVelocity.y
        / outputHorizontalReach;
    const outputFreeEndVelocity = new THREE.Vector3(
      outputFreeEndVelocityX,
      0,
      0,
    );
    const outputCableVector = outputCableGeometry.freeEnd2.clone().sub(
      outputJoint,
    );
    const outputRelativeVelocity = new THREE.Vector2(
      outputFreeEndVelocityX - outputJointVelocity.x,
      -outputJointVelocity.y,
    );
    const inputArmVerticalDisplacement = inputJoint.y;
    const outputArmHorizontalDisplacement = outputJoint.x;
    const inputArmVerticalSpeed = inputJointVelocity.y;
    const outputArmHorizontalSpeed = outputJointVelocity.x;
    const atForwardReversal = Math.abs(cyclePhase - 0.25) < 1e-11;
    const atReturnReversal = Math.abs(cyclePhase - 0.75) < 1e-11;
    const speedEpsilon = 1e-10;
    const stage = atForwardReversal
      ? 'bell-crank-reverses-at-forward-limit'
      : atReturnReversal
        ? 'bell-crank-reverses-at-return-limit'
        : bellAngularSpeed > speedEpsilon
          ? 'input-descends-while-output-moves-right'
          : bellAngularSpeed < -speedEpsilon
            ? 'input-rises-while-output-moves-left'
            : 'bell-crank-pauses-at-stroke-reversal';
    return {
      atForwardReversal,
      atReturnReversal,
      atReversal: atForwardReversal || atReturnReversal,
      bellAngle,
      bellAngularAcceleration,
      bellAngularSpeed,
      bellArmDotError: inputArmVector.dot(outputArmVector),
      cyclePhase,
      driveAngle,
      idealForceRatio,
      inputArmLengthError: inputArmVector.length() - inputArmLength,
      inputArmVector,
      inputArmVerticalDisplacement,
      inputArmVerticalSpeed,
      inputCableContactVelocity,
      inputCableCount: 1,
      inputCableCurve: inputCableGeometry.curve,
      inputCableFreeEnd: inputCableGeometry.freeEnd,
      inputCableFreeEndVelocity: inputFreeEndVelocity,
      inputCableLength: inputCableGeometry.curve.getLength(),
      inputCableLengthError: inputCableGeometry.curve.getLength()
        - nominalInputCableLength,
      inputCablePulleyNormalVelocityError: inputContactRelativeVelocity.x,
      inputCablePulleyTangentialVelocityError: inputContactRelativeVelocity.y,
      inputCableTangentAlignment: inputCableGeometry.alignment,
      inputCableTangentPoint: inputCableGeometry.tangentPoint,
      inputCableTangentSpanLength: inputCableGeometry.tangentLineLength,
      inputCableWrapLength: inputCableGeometry.arcLength,
      inputCableWrapSweep: inputCableGeometry.arc.sweep,
      inputFreeSpanLength: inputCableGeometry.freeSpanLength,
      inputJoint,
      inputJointVelocity,
      motionRatio,
      motionRatioDisplacementError: outputArmHorizontalDisplacement
        - motionRatio * inputArmVerticalDisplacement,
      motionRatioVelocityError: outputArmHorizontalSpeed
        - motionRatio * inputArmVerticalSpeed,
      outputArmHorizontalDisplacement,
      outputArmHorizontalSpeed,
      outputArmLengthError: outputArmVector.length() - outputArmLength,
      outputArmVector,
      outputCableCount: 1,
      outputCableCurve: outputCableGeometry.curve,
      outputCableFreeEnd: outputCableGeometry.freeEnd,
      outputCableFreeEndVelocity: outputFreeEndVelocity,
      outputCableLength: outputCableGeometry.curve.getLength(),
      outputCableLengthError: outputCableGeometry.curve.getLength()
        - sourceOutputCableLength,
      outputCableRadialVelocityError: outputRelativeVelocity.dot(
        outputCableVector.normalize(),
      ),
      outputJoint,
      outputJointVelocity,
      rawCyclePhase,
      redirectPulleyAngle,
      redirectPulleyAngularSpeed,
      redirectPulleyContactVelocity,
      ropeCount: 2,
      stage,
      virtualPowerError: inputArmVerticalSpeed
        + idealForceRatio * outputArmHorizontalSpeed,
      velocityDiscontinuous: false,
    };
  };

  const inputCableMaterialPointAtTime = (time, fraction) => {
    const state = stateAtTime(time);
    return inputCableMaterialPointAtGeometry({
      arcLength: state.inputCableWrapLength,
      curve: state.inputCableCurve,
      freeSpanLength: state.inputFreeSpanLength,
    }, fraction);
  };

  root.userData.mechanism = 'fixed-pulley-two-cable-bell-crank-force-redirector';
  root.userData.cameraDistanceScale = 1.02;
  root.userData.blocks = {
    baseRail,
    bellCrank,
    bellPivotBearing,
    bellPivotRing,
    bellPivotShaft,
    cameraEnvelope,
    frameTie,
    inputArm,
    inputCable,
    inputCableMarkers,
    inputCableMesh,
    inputDirectionIndex,
    inputEndGuide,
    inputFreeEndKnot,
    inputGuideStandoff,
    inputJointPin,
    inputJointRing,
    outputArm,
    outputCable,
    outputCableMarkers,
    outputCableMesh,
    outputDirectionIndex,
    outputEndGuide,
    outputFreeEndKnot,
    outputGuideStandoff,
    outputJointPin,
    outputJointRing,
    pivotPost,
    pulleyBearing,
    pulleyPost,
    redirectPulley,
    redirectPulleyRotor,
    redirectPulleyShaft,
  };
  root.userData.geometry = {
    bellAngleAmplitude,
    bellArmDepth,
    bellArmThickness,
    bellCrankPlaneZ,
    cableRadius,
    cyclePeriod,
    driveAngularFrequency,
    fullTurn,
    idealForceRatio,
    inputArmLength,
    inputCableMarkerCount,
    inputCablePlaneZ,
    inputFreeEndSourceY,
    inputFreeEndX,
    inputMarkerFractions,
    leftTangentPoint,
    motionRatio,
    nominalInputCableLength,
    outputArmLength,
    outputCableMarkerCount,
    outputCablePlaneZ,
    outputFreeEndSource,
    outputGuideY,
    outputMarkerFractions,
    pulleyCenter,
    pulleyCenter2,
    pulleyPitchRadius,
    pulleyWidth,
    rearFrameZ,
    sourceInputArm: sourceInputArm.clone(),
    sourceInputArmLength,
    sourceInputFreeEnd,
    sourceInputFreeEndY,
    sourceInputFreeSpanLength,
    sourceInputTangentPoint: sourceInputTangentGeometry.tangentPoint.clone(),
    sourceInputWrapSweep: sourceInputTangentGeometry.arc.sweep,
    sourceOutputArm: sourceOutputArm.clone(),
    sourceOutputArmLength,
    sourceOutputCableLength,
    sourceOutputFreeEnd,
    sourcePulleyCenterFromPivot,
    sourcePulleyPitchRadius,
    sourceRasterBellPivot,
    sourceRasterInputJoint,
    sourceRasterOutputJoint,
    sourceRasterPulleyCenter,
    sourceScale,
  };
  root.userData.inputCableCurveAtAngle = (bellAngle) => (
    inputCableGeometryAt(inputJointAtAngle(bellAngle)).curve
  );
  root.userData.inputCableMaterialPointAtTime = inputCableMaterialPointAtTime;
  root.userData.outputCableCurveAtAngle = (bellAngle) => (
    outputCableGeometryAt(outputJointAtAngle(bellAngle)).curve
  );
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    bellCrank.rotation.set(0, 0, state.bellAngle);
    redirectPulleyRotor.rotation.set(0, 0, state.redirectPulleyAngle);
    inputCable.userData.setCurve(state.inputCableCurve);
    inputCable.userData.updateDistance(0);
    outputCable.userData.setCurve(state.outputCableCurve);
    outputCable.userData.updateDistance(0);
    inputFreeEndKnot.position.copy(state.inputCableFreeEnd);
    outputFreeEndKnot.position.copy(state.outputCableFreeEnd);
    inputDirectionIndex.position.copy(state.inputCableFreeEnd).add(
      new THREE.Vector3(0, -0.24, 0.03),
    );
    outputDirectionIndex.position.copy(state.outputCableFreeEnd).add(
      new THREE.Vector3(0.25, 0, 0.03),
    );
    bellCrank.userData.angularSpeed = state.bellAngularSpeed;
    redirectPulley.userData.angularSpeed = state.redirectPulleyAngularSpeed;
    inputFreeEndKnot.userData.velocity = state.inputCableFreeEndVelocity.clone();
    outputFreeEndKnot.userData.velocity = state.outputCableFreeEndVelocity.clone();
    root.userData.attachments = {
      inputCableBellJoint: new THREE.Vector3(
        state.inputJoint.x,
        state.inputJoint.y,
        inputCablePlaneZ,
      ),
      inputCableFreeEnd: state.inputCableFreeEnd.clone(),
      outputCableBellJoint: new THREE.Vector3(
        state.outputJoint.x,
        state.outputJoint.y,
        outputCablePlaneZ,
      ),
      outputCableFreeEnd: state.outputCableFreeEnd.clone(),
    };
    root.userData.contacts = {
      bellCrankRightAngle: {
        dotError: state.bellArmDotError,
        inputLengthError: state.inputArmLengthError,
        outputLengthError: state.outputArmLengthError,
      },
      inputCableRedirectPulley: {
        normalVelocityError: state.inputCablePulleyNormalVelocityError,
        pitchRadius: pulleyPitchRadius,
        tangentAlignment: state.inputCableTangentAlignment,
        tangentialVelocityError:
          state.inputCablePulleyTangentialVelocityError,
        wrapSweep: state.inputCableWrapSweep,
      },
      outputCable: {
        lengthError: state.outputCableLengthError,
        radialVelocityError: state.outputCableRadialVelocityError,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(6.6, 5.1, 13.8),
  };
}

function chineseDifferentialWindlass() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;

  // Reference measurements from the public-domain engraving. The two ropes
  // leave opposite sides of the coaxial barrels. Their vertical legs define
  // a unique tilted plane for the one lower pulley, avoiding any unengraved
  // guide sheaves while keeping every rope contact spatially tangent.
  const sourceRasterShaftCenter = new THREE.Vector2(255, -115);
  const sourceRasterLargeBarrelRadius = 50;
  const sourceRasterSmallBarrelRadius = 31;
  const sourceRasterLargeBarrelRangeX = new THREE.Vector2(122, 202);
  const sourceRasterSmallBarrelRangeX = new THREE.Vector2(318, 390);
  const sourceRasterLeftRopeX = 201;
  const sourceRasterRightRopeX = 316;
  const sourceRasterLowerPulleyCenter = new THREE.Vector2(254, -319);
  const sourceRasterLowerPulleyRadius = 59;
  const sourceRasterFramePostsX = new THREE.Vector2(94, 430);
  const sourceScale = 0.016;

  const shaftY = 2.15;
  const sourcePulleyCenterY = shaftY - Math.abs(
    sourceRasterLowerPulleyCenter.y - sourceRasterShaftCenter.y
  ) * sourceScale;
  const largeBarrelPitchRadius = sourceRasterLargeBarrelRadius * sourceScale;
  const smallBarrelPitchRadius = sourceRasterSmallBarrelRadius * sourceScale;
  const barrelRadiusDifference = largeBarrelPitchRadius
    - smallBarrelPitchRadius;
  const barrelRadiusSum = largeBarrelPitchRadius
    + smallBarrelPitchRadius;
  const barrelExitHalfSpacing = (
    sourceRasterRightRopeX - sourceRasterLeftRopeX
  ) * sourceScale / 2;
  const largeRopeExit = new THREE.Vector3(
    -barrelExitHalfSpacing,
    shaftY,
    -largeBarrelPitchRadius,
  );
  const smallRopeExit = new THREE.Vector3(
    barrelExitHalfSpacing,
    shaftY,
    smallBarrelPitchRadius,
  );
  const pulleyCenterZ = (
    smallBarrelPitchRadius - largeBarrelPitchRadius
  ) / 2;
  const legSeparation = smallRopeExit.clone().sub(largeRopeExit);
  legSeparation.y = 0;
  const lowerPulleyPitchRadius = legSeparation.length() / 2;
  const lowerPulleyHorizontal = legSeparation.clone().normalize();
  const lowerPulleyAxis = lowerPulleyHorizontal.clone()
    .cross(Y_AXIS)
    .normalize();
  const pulleyTravelPerShaftRadian = barrelRadiusDifference / 2;
  const circumferenceDifference = fullTurn * barrelRadiusDifference;
  const pulleyTravelPerWindlassRevolution = circumferenceDifference / 2;

  const shaftAngleAmplitude = Math.PI * 1.2;
  const cyclePeriod = 6;
  const driveAngularFrequency = fullTurn / cyclePeriod;
  const sourcePoseAngle = 0;
  const baseLargeWrapTurns = 6;
  const baseSmallWrapTurns = 6;
  const baseLargeWoundLength = largeBarrelPitchRadius
    * fullTurn * baseLargeWrapTurns;
  const baseSmallWoundLength = smallBarrelPitchRadius
    * fullTurn * baseSmallWrapTurns;
  const ropeRadius = 0.064;
  const ropeMarkerCount = 9;
  const ropeRenderAngleThreshold = 0.06;
  const ropeRenderInterval = 1 / 30;
  const ropeTubularSegments = 288;
  const lowerWrapLength = Math.PI * lowerPulleyPitchRadius;
  const sourceLeftLegLength = shaftY - sourcePulleyCenterY;
  const sourceRightLegLength = shaftY - sourcePulleyCenterY;
  const sourceFreeRopeLength = sourceLeftLegLength
    + lowerWrapLength + sourceRightLegLength;
  const nominalRopeLength = baseLargeWoundLength
    + sourceFreeRopeLength + baseSmallWoundLength;
  const ropeMarkerMaterialDistances = Array.from(
    { length: ropeMarkerCount },
    (_, index) => baseLargeWoundLength
      + sourceFreeRopeLength * (index + 1) / (ropeMarkerCount + 1),
  );

  const largeBarrelInnerX = largeRopeExit.x;
  const largeBarrelOuterX = largeBarrelInnerX - (
    sourceRasterLargeBarrelRangeX.y - sourceRasterLargeBarrelRangeX.x
  ) * sourceScale;
  const smallBarrelInnerX = smallRopeExit.x;
  const smallBarrelOuterX = smallBarrelInnerX + (
    sourceRasterSmallBarrelRangeX.y - sourceRasterSmallBarrelRangeX.x
  ) * sourceScale;
  const largeBarrelWidth = largeBarrelInnerX - largeBarrelOuterX;
  const smallBarrelWidth = smallBarrelOuterX - smallBarrelInnerX;
  const largeBarrelBodyRadius = largeBarrelPitchRadius - ropeRadius * 1.15;
  const smallBarrelBodyRadius = smallBarrelPitchRadius - ropeRadius * 1.15;
  const barrelFlangeThickness = 0.1;
  const barrelFlangeExtraRadius = 0.28;
  const largeWindingAxialSpan = largeBarrelWidth - barrelFlangeThickness / 2 - ropeRadius - .02;
  const smallWindingAxialSpan = smallBarrelWidth - barrelFlangeThickness / 2 - ropeRadius - .02;
  const shaftRadius = 0.105;
  const shaftLength = 5.75;
  const crankRadius = 0.82;
  const crankHandleLength = 0.48;
  const idealForceRatio = crankRadius / pulleyTravelPerShaftRadian;
  const rearFrameZ = -0.82;
  const baseY = shaftY - (430 - 115) * sourceScale;
  const framePostXs = [94, 430].map(x => (x - sourceRasterShaftCenter.x) * sourceScale);
  const bearingInnerRadius = shaftRadius + 0.027;
  const bearingOuterRadius = 0.29;
  const bearingLength = 0.32;
  const transitionTolerance = 1e-10;

  class WoundHelixCurve3 extends THREE.Curve {
    constructor({
      axialSpan,
      exitPhase,
      exitX,
      radius,
      reverseAxial,
      reversePhase,
      wrapSweep,
    }) {
      super();
      this.axialSpan = axialSpan;
      this.exitPhase = exitPhase;
      this.exitX = exitX;
      this.radius = radius;
      this.reverseAxial = reverseAxial;
      this.reversePhase = reversePhase;
      this.wrapSweep = wrapSweep;
    }

    getPoint(t, target = new THREE.Vector3()) {
      const smooth = windingAdvance(t, this.wrapSweep / fullTurn).position;
      const x = this.reverseAxial
        ? this.exitX + this.axialSpan * smooth
        : this.exitX - this.axialSpan * (1 - smooth);
      const phase = this.reversePhase
        ? this.exitPhase - this.wrapSweep * t
        : this.exitPhase + this.wrapSweep * (1 - t);
      return target.set(
        x,
        shaftY + this.radius * Math.cos(phase),
        this.radius * Math.sin(phase),
      );
    }

    getTangent(t, target = new THREE.Vector3()) {
      const smoothDerivative = windingAdvance(t, this.wrapSweep / fullTurn).derivative;
      const xDerivative = this.axialSpan * smoothDerivative;
      const phase = this.reversePhase
        ? this.exitPhase - this.wrapSweep * t
        : this.exitPhase + this.wrapSweep * (1 - t);
      const phaseDerivative = -this.wrapSweep;
      return target.set(
        xDerivative,
        -this.radius * Math.sin(phase) * phaseDerivative,
        this.radius * Math.cos(phase) * phaseDerivative,
      ).normalize();
    }
  }

  class SegmentedWindlassRopeCurve extends THREE.Curve {
    constructor(curves, segmentLengths, metadata = {}) {
      super();
      this.curves = curves;
      this.segmentLengths = segmentLengths;
      this.totalLength = segmentLengths.reduce(
        (sum, length) => sum + length,
        0,
      );
      Object.assign(this, metadata);
    }

    segmentAtDistance(rawDistance) {
      const distance = THREE.MathUtils.clamp(
        rawDistance,
        0,
        this.totalLength,
      );
      let segmentStartDistance = 0;
      for (let index = 0; index < this.curves.length; index += 1) {
        const segmentLength = this.segmentLengths[index];
        if (
          distance <= segmentStartDistance + segmentLength
          || index === this.curves.length - 1
        ) {
          return {
            curve: this.curves[index],
            index,
            localFraction: segmentLength > 0
              ? THREE.MathUtils.clamp(
                (distance - segmentStartDistance) / segmentLength,
                0,
                1,
              )
              : 0,
            segmentStartDistance,
          };
        }
        segmentStartDistance += segmentLength;
      }
      throw new RangeError('Movement 129 rope segment lookup failed.');
    }

    getPoint(fraction, target = new THREE.Vector3()) {
      return this.getPointAtDistance(fraction * this.totalLength, target);
    }

    getPointAt(fraction, target = new THREE.Vector3()) {
      return this.getPoint(fraction, target);
    }

    getPointAtDistance(distance, target = new THREE.Vector3()) {
      const segment = this.segmentAtDistance(distance);
      return segment.curve.getPoint(segment.localFraction, target);
    }

    getTangent(fraction, target = new THREE.Vector3()) {
      return this.getTangentAtDistance(fraction * this.totalLength, target);
    }

    getTangentAt(fraction, target = new THREE.Vector3()) {
      return this.getTangent(fraction, target);
    }

    getTangentAtDistance(distance, target = new THREE.Vector3()) {
      const segment = this.segmentAtDistance(distance);
      return segment.curve.getTangent(segment.localFraction, target);
    }

    getLength() {
      return this.totalLength;
    }
  }

  const ropeGeometryAtShaftAngle = (shaftAngle) => {
    const largeWoundLength = baseLargeWoundLength
      + largeBarrelPitchRadius * shaftAngle;
    const smallWoundLength = baseSmallWoundLength
      - smallBarrelPitchRadius * shaftAngle;
    if (largeWoundLength <= 0 || smallWoundLength <= 0) {
      throw new RangeError('Movement 129 exhausted a wound rope reserve.');
    }
    const pulleyCenterY = sourcePulleyCenterY
      + pulleyTravelPerShaftRadian * shaftAngle;
    const lowerPulleyCenter = new THREE.Vector3(
      0,
      pulleyCenterY,
      pulleyCenterZ,
    );
    const leftPulleyTangent = lowerPulleyCenter.clone().addScaledVector(
      lowerPulleyHorizontal,
      -lowerPulleyPitchRadius,
    );
    const rightPulleyTangent = lowerPulleyCenter.clone().addScaledVector(
      lowerPulleyHorizontal,
      lowerPulleyPitchRadius,
    );
    const leftLegLength = largeRopeExit.y - leftPulleyTangent.y;
    const rightLegLength = smallRopeExit.y - rightPulleyTangent.y;
    if (leftLegLength <= 0 || rightLegLength <= 0) {
      throw new RangeError('Movement 129 raised its pulley into the barrels.');
    }
    const largeWrapSweep = largeWoundLength / largeBarrelPitchRadius;
    const smallWrapSweep = smallWoundLength / smallBarrelPitchRadius;
    const largeHelix = new WoundHelixCurve3({
      axialSpan: largeWindingAxialSpan,
      exitPhase: -Math.PI / 2,
      exitX: largeRopeExit.x,
      radius: largeBarrelPitchRadius,
      reverseAxial: false,
      reversePhase: false,
      wrapSweep: largeWrapSweep,
    });
    const leftLeg = new THREE.LineCurve3(
      largeRopeExit.clone(),
      leftPulleyTangent.clone(),
    );
    const lowerWrap = new CircularArcCurve3(
      lowerPulleyCenter,
      leftPulleyTangent.clone().sub(lowerPulleyCenter),
      lowerPulleyAxis,
      Math.PI,
    );
    const rightLeg = new THREE.LineCurve3(
      rightPulleyTangent.clone(),
      smallRopeExit.clone(),
    );
    const smallHelix = new WoundHelixCurve3({
      axialSpan: smallWindingAxialSpan,
      exitPhase: Math.PI / 2,
      exitX: smallRopeExit.x,
      radius: smallBarrelPitchRadius,
      reverseAxial: true,
      reversePhase: true,
      wrapSweep: smallWrapSweep,
    });
    const segmentLengths = [
      largeWoundLength,
      leftLegLength,
      lowerWrapLength,
      rightLegLength,
      smallWoundLength,
    ];
    const transitionDistances = [];
    let cumulativeLength = 0;
    for (const segmentLength of segmentLengths.slice(0, -1)) {
      cumulativeLength += segmentLength;
      transitionDistances.push(cumulativeLength);
    }
    const curve = new SegmentedWindlassRopeCurve(
      [largeHelix, leftLeg, lowerWrap, rightLeg, smallHelix],
      segmentLengths,
      {
        largeHelix,
        largeWoundLength,
        leftLeg,
        leftLegLength,
        leftPulleyTangent,
        lowerPulleyCenter,
        lowerWrap,
        lowerWrapLength,
        rightLeg,
        rightLegLength,
        rightPulleyTangent,
        smallHelix,
        smallWoundLength,
        transitionDistances,
      },
    );
    return {
      curve,
      largeHelix,
      largeWoundLength,
      leftLeg,
      leftLegLength,
      leftPulleyTangent,
      lowerPulleyCenter,
      lowerWrap,
      rightLeg,
      rightLegLength,
      rightPulleyTangent,
      segmentLengths,
      smallHelix,
      smallWoundLength,
      transitionDistances,
    };
  };

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.61,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.1,
    roughness: 0.65,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.69,
  });
  const inkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const cylinderAlongX = (radius, length, material, segments = 36) => {
    const cylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, length, segments),
      material,
    );
    cylinder.rotation.z = Math.PI / 2;
    return cylinder;
  };
  const annularSleeveAlongX = ({
    innerRadius,
    length,
    material,
    outerRadius,
  }) => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outerRadius, 0, fullTurn, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, innerRadius, 0, fullTurn, true);
    shape.holes.push(hole);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      bevelEnabled: true,
      bevelSegments: 1,
      bevelSize: 0.008,
      bevelThickness: 0.008,
      curveSegments: 32,
      depth: length,
    });
    geometry.translate(0, 0, -length / 2);
    const sleeve = new THREE.Mesh(geometry, material);
    sleeve.rotation.y = Math.PI / 2;
    return sleeve;
  };

  const windlass = new THREE.Group();
  windlass.position.set(0, shaftY, 0);
  windlass.userData.axis = X_AXIS.clone();
  windlass.userData.role = 'fixed-axis-chinese-windlass-input';
  const windlassRotor = new THREE.Group();
  windlassRotor.userData.role = 'one-rigid-shaft-with-two-unequal-barrels';
  windlass.add(windlassRotor);

  const inputShaft = cylinderAlongX(
    shaftRadius,
    shaftLength,
    inkMaterial,
    30,
  );
  inputShaft.position.x = .115;
  inputShaft.userData.axis = X_AXIS.clone();
  inputShaft.userData.role = 'common-shaft-fast-to-both-windlass-barrels';
  const largeBarrel = cylinderAlongX(
    largeBarrelBodyRadius,
    largeBarrelWidth,
    driverMaterial,
    56,
  );
  largeBarrel.position.x = (
    largeBarrelOuterX + largeBarrelInnerX
  ) / 2;
  largeBarrel.userData.pitchRadius = largeBarrelPitchRadius;
  largeBarrel.userData.role = 'larger-rope-winding-barrel';
  const smallBarrel = cylinderAlongX(
    smallBarrelBodyRadius,
    smallBarrelWidth,
    driverMaterial,
    48,
  );
  smallBarrel.position.x = (
    smallBarrelInnerX + smallBarrelOuterX
  ) / 2;
  smallBarrel.userData.pitchRadius = smallBarrelPitchRadius;
  smallBarrel.userData.role = 'smaller-rope-unwinding-barrel';

  // The engraving's central flange is separated from both rope exits by
  // bare barrel. A flange at either exit cuts directly through the rope.
  const largeBareBarrel = cylinderAlongX(largeBarrelBodyRadius, -largeBarrelInnerX, driverMaterial, 56);
  largeBareBarrel.position.x = largeBarrelInnerX / 2;
  const smallBareBarrel = cylinderAlongX(smallBarrelBodyRadius * .72, smallBarrelInnerX, driverMaterial, 48);
  smallBareBarrel.position.x = smallBarrelInnerX / 2;
  windlassRotor.add(largeBareBarrel, smallBareBarrel);

  const barrelFlanges = [];
  for (const [x, radius, side] of [
    [largeBarrelOuterX, largeBarrelPitchRadius, 'large-outer'],
    [0, largeBarrelPitchRadius, 'central'],
    [smallBarrelOuterX, smallBarrelPitchRadius, 'small-outer'],
  ]) {
    const flange = cylinderAlongX(
      radius + (side.startsWith('small') ? .24 : barrelFlangeExtraRadius),
      barrelFlangeThickness,
      driverMaterial,
      52,
    );
    flange.position.x = x;
    flange.userData.role = `${side}-windlass-barrel-flange`;
    flange.userData.side = side;
    barrelFlanges.push(flange);
  }
  const barrelFaceRings = barrelFlanges.map((flange) => {
    const radius = flange.geometry.parameters.radiusTop * 0.88;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.034, 8, 44),
      inkMaterial,
    );
    ring.rotation.y = Math.PI / 2;
    ring.position.x = flange.position.x
      + (flange.position.x < 0 ? -1 : 1)
        * barrelFlangeThickness * 0.57;
    ring.userData.role = 'dark-outline-on-windlass-barrel-flange';
    // Only line-drawing edging: Brown sees the flanges edge-on and draws no
    // ring on them. Kept as a hidden placeholder for block references.
    ring.visible = false;
    ring.userData.retiredInkOutline = true;
    return ring;
  });
  const shaftRotationIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 18, 12),
    indexMaterial,
  );
  shaftRotationIndex.position.set(
    smallBarrelOuterX + barrelFlangeThickness * 0.62,
    smallBarrelPitchRadius * 0.72,
    0,
  );
  shaftRotationIndex.userData.role = 'white-index-on-common-windlass-shaft';

  const crankArm = makeBeam(
    new THREE.Vector3(2.48, 0, 0),
    new THREE.Vector3(2.48, crankRadius, 0),
    {
      color: PALETTE.driver,
      depth: 0.16,
      thickness: 0.17,
    },
  );
  crankArm.userData.role = 'hand-crank-fast-to-common-windlass-shaft';
  crankArm.traverse((object) => {
    if (object.material) object.material = driverMaterial;
  });
  const crankHandle = cylinderAlongX(
    0.105,
    crankHandleLength,
    inkMaterial,
    24,
  );
  crankHandle.position.set(
    2.48 + crankHandleLength / 2,
    crankRadius,
    0,
  );
  crankHandle.userData.role = 'free-hand-grip-on-windlass-crank';
  crankArm.visible = false;
  crankHandle.visible = false;
  windlassRotor.add(
    inputShaft,
    largeBarrel,
    smallBarrel,
    ...barrelFlanges,
    ...barrelFaceRings,
    shaftRotationIndex,
    crankArm,
    crankHandle,
  );

  const lowerPulley = makePulley({
    axis: lowerPulleyAxis,
    color: PALETTE.driven,
    grooves: 1,
    radius: lowerPulleyPitchRadius,
    spokes: 4,
    width: 0.46,
  });
  lowerPulley.userData.pitchRadius = lowerPulleyPitchRadius;
  lowerPulley.userData.role = 'single-tilted-movable-load-pulley';
  const lowerPulleyRotor = lowerPulley.userData.rotor;
  const lowerPulleyContactTread = new THREE.Mesh(
    new THREE.CylinderGeometry(
      lowerPulleyPitchRadius - ropeRadius,
      lowerPulleyPitchRadius - ropeRadius,
      0.27,
      56,
    ),
    drivenMaterial,
  );
  lowerPulleyContactTread.rotation.x = Math.PI / 2;
  lowerPulleyContactTread.userData.contactRadius = (
    lowerPulleyPitchRadius - ropeRadius
  );
  lowerPulleyContactTread.userData.role = (
    'central-groove-bed-touching-the-single-windlass-rope'
  );
  // Keep the old primitive parts available to diagnostics, but render one solid.
  lowerPulleyRotor.children.forEach(part => { part.visible = false; });
  lowerPulleyContactTread.geometry.dispose();
  lowerPulleyContactTread.geometry = windlassSheaveGeometry(lowerPulleyPitchRadius, ropeRadius);
  lowerPulleyContactTread.rotation.set(0, 0, 0);
  lowerPulleyRotor.add(lowerPulleyContactTread);
  const movingBlock = new THREE.Group();
  movingBlock.position.set(0, sourcePulleyCenterY, pulleyCenterZ);
  movingBlock.userData.axis = Y_AXIS.clone();
  movingBlock.userData.role = 'vertically-translating-pulley-block-and-hook';
  const hangerLength = 1.4;
  const hangerFrontOffset = 0.36;
  const hangerOrientation = new THREE.Quaternion().setFromUnitVectors(
    Z_AXIS,
    lowerPulleyAxis,
  );
  const loadHangerOutline = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, hangerLength + 0.02, 0.12),
    inkMaterial,
  );
  loadHangerOutline.quaternion.copy(hangerOrientation);
  loadHangerOutline.position.copy(lowerPulleyAxis).multiplyScalar(
    hangerFrontOffset - 0.055,
  );
  loadHangerOutline.position.y = -hangerLength / 2;
  loadHangerOutline.userData.role = (
    'dark-outline-behind-front-mounted-load-hanger'
  );
  // An ink outline, not a part: hidden, kept for block references.
  loadHangerOutline.visible = false;
  loadHangerOutline.userData.retiredInkOutline = true;
  const loadHanger = new THREE.Mesh(
    new THREE.BoxGeometry(0.64, hangerLength, 0.16),
    drivenMaterial,
  );
  loadHanger.quaternion.copy(hangerOrientation);
  loadHanger.position.copy(lowerPulleyAxis).multiplyScalar(
    hangerFrontOffset,
  );
  loadHanger.position.y = -hangerLength / 2;
  loadHanger.userData.role = 'rigid-hanger-below-movable-pulley';
  const lowerAxle = makeShaft({
    axis: lowerPulleyAxis,
    color: PALETTE.ink,
    length: 0.92,
    radius: 0.1,
  });
  lowerAxle.userData.role = 'axle-of-tilted-load-pulley';
  const loadHook = new THREE.Mesh(
    windlassHookGeometry(),
    drivenMaterial,
  );
  loadHook.quaternion.copy(hangerOrientation);

  loadHook.position.copy(lowerPulleyAxis).multiplyScalar(
    hangerFrontOffset,
  );

  loadHook.position.y = 0;
  loadHook.userData.role = 'load-hook-fixed-to-movable-pulley-block';
  const hookNeck = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.2, 0.18),
    drivenMaterial,
  );
  hookNeck.quaternion.copy(hangerOrientation);
  hookNeck.position.copy(lowerPulleyAxis).multiplyScalar(
    hangerFrontOffset,
  );
  hookNeck.position.y = -1.42;
  hookNeck.userData.role = 'neck-joining-load-hook-to-pulley-block';
  const hangerBoss = new THREE.Mesh(new THREE.CylinderGeometry(.40, .40, .10, 64), drivenMaterial);
  hangerBoss.geometry.rotateX(Math.PI / 2);
  hangerBoss.quaternion.copy(hangerOrientation);
  hangerBoss.position.copy(lowerPulleyAxis).multiplyScalar(.45);
  movingBlock.add(hangerBoss);
  const axleEnd = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .05, 48), inkMaterial);
  axleEnd.geometry.rotateX(Math.PI / 2);
  axleEnd.quaternion.copy(hangerOrientation);
  axleEnd.position.copy(lowerPulleyAxis).multiplyScalar(.515);
  movingBlock.add(axleEnd);
  movingBlock.add(
    lowerPulley,
    lowerAxle,
    loadHangerOutline,
    loadHanger,
    hookNeck,
    loadHook,
  );

  const bearingSleeves = [];
  const bearingPosts = [];
  const footBlocks = [];
  for (const x of framePostXs) {
    const side = x < 0 ? 'left' : 'right';
    const sleeve = annularSleeveAlongX({
      innerRadius: bearingInnerRadius,
      length: bearingLength,
      material: frameMaterial,
      outerRadius: bearingOuterRadius,
    });
    sleeve.position.set(x, shaftY, 0);
    sleeve.userData.axis = X_AXIS.clone();
    sleeve.userData.role = `${side}-fixed-windlass-shaft-bearing`;
    const postTop = shaftY + (115 - 62) * sourceScale;
    const shape = new THREE.Shape();
    shape.moveTo(-.15, baseY);shape.lineTo(.15, baseY);
    shape.lineTo(.15, postTop);shape.lineTo(-.15, postTop);shape.closePath();
    const bore = new THREE.Path();bore.absarc(0, shaftY, bearingInnerRadius, 0, fullTurn, true);shape.holes.push(bore);
    const postGeometry = new THREE.ExtrudeGeometry(shape, {depth:.27, bevelEnabled:false, curveSegments:32});
    postGeometry.translate(0,0,-.135);postGeometry.rotateY(Math.PI/2);
    const post = new THREE.Mesh(postGeometry, frameMaterial);
    post.position.x = x;
    post.userData.role = `${side}-windlass-bearing-support-post`;
    const foot = new THREE.Mesh(new THREE.BoxGeometry(.9,.16,1.2), frameMaterial);
    foot.position.set(x,baseY+.08,-.35);
    foot.userData.role = `${side}-windlass-frame-foot`;
    bearingSleeves.push(sleeve);
    bearingPosts.push(post);
    footBlocks.push(foot);
  }
  const baseRail = new THREE.Mesh(
    new THREE.BoxGeometry(6.7, 0.15, 0.34),
    frameMaterial,
  );
  baseRail.position.set(0, baseY, rearFrameZ);
  baseRail.userData.role = 'fixed-base-rail-of-chinese-windlass';

  const sourceRopeGeometry = ropeGeometryAtShaftAngle(sourcePoseAngle);
  // Brown hatches the rope as laid rope. The curve's arc length is the
  // rope's material coordinate (both ends are fast), so the lay is not shifted.
  const rope = makeDynamicMovingBelt(sourceRopeGeometry.curve, {
    closed: false,
    color: PALETTE.driven,
    markerCount: 0,
    radius: ropeRadius,
    tubularSegments: ropeTubularSegments,
    laid: true,
  });
  rope.userData.mechanismString = true;
  rope.userData.physicalCable = true;
  rope.userData.role = 'one-continuous-differential-windlass-rope';
  rope.userData.ropeCount = 1;
  rope.userData.materialMarkerDistances = ropeMarkerMaterialDistances;
  const ropeMesh = rope.children[0];
  ropeMesh.userData.role = 'continuous-wound-free-and-pulley-rope-mesh';
  const ropeMarkers = ropeMarkerMaterialDistances.map((distance, index) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(ropeRadius * 1.72, 12, 9),
      indexMaterial,
    );
    marker.position.copy(sourceRopeGeometry.curve.getPointAtDistance(distance));
    marker.userData.materialDistance = distance;
    marker.userData.markerIndex = index;
    marker.userData.role = 'white-material-marker-on-single-windlass-rope';
    rope.add(marker);
    return marker;
  });
  rope.userData.markers = ropeMarkers;

  const largeDrumContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.058, 17, 11),
    indexMaterial,
  );
  largeDrumContactMarker.position.copy(largeRopeExit);
  largeDrumContactMarker.userData.role = 'white-large-barrel-rope-contact';
  const smallDrumContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.058, 17, 11),
    indexMaterial,
  );
  smallDrumContactMarker.position.copy(smallRopeExit);
  smallDrumContactMarker.userData.role = 'white-small-barrel-rope-contact';
  const lowerContactMarkers = [-1, 1].map((sideSign) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.058, 17, 11),
      indexMaterial,
    );
    marker.userData.side = sideSign < 0 ? 'left' : 'right';
    marker.userData.role = 'white-lower-pulley-rope-contact';
    return marker;
  });
  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(7.8, 8.4, 0.01),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(0, -0.65, rearFrameZ - 0.25);
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role = 'invisible-chinese-windlass-camera-envelope';
  root.add(
    cameraEnvelope,
    baseRail,
    ...bearingPosts,
    ...bearingSleeves,
    ...footBlocks,
    windlass,
    movingBlock,
    rope,
    largeDrumContactMarker,
    smallDrumContactMarker,
    ...lowerContactMarkers,
  );

  const stateAtShaftKinematics = ({
    drivePhase = null,
    shaftAngle,
    shaftAngularAcceleration,
    shaftAngularSpeed,
  }) => {
    const ropeGeometry = ropeGeometryAtShaftAngle(shaftAngle);
    const pulleyDisplacement = pulleyTravelPerShaftRadian * shaftAngle;
    const pulleyCenterY = sourcePulleyCenterY + pulleyDisplacement;
    const pulleyVelocityY = pulleyTravelPerShaftRadian * shaftAngularSpeed;
    const pulleyAccelerationY = pulleyTravelPerShaftRadian
      * shaftAngularAcceleration;
    const lowerPulleyAngle = -barrelRadiusSum * shaftAngle
      / (2 * lowerPulleyPitchRadius);
    const lowerPulleyAngularSpeed = -barrelRadiusSum * shaftAngularSpeed
      / (2 * lowerPulleyPitchRadius);
    const lowerPulleyAngularAcceleration = -barrelRadiusSum
      * shaftAngularAcceleration / (2 * lowerPulleyPitchRadius);
    const shaftAngularVelocity = X_AXIS.clone().multiplyScalar(
      shaftAngularSpeed,
    );
    const largeBarrelContactRadius = new THREE.Vector3(
      0,
      0,
      -largeBarrelPitchRadius,
    );
    const smallBarrelContactRadius = new THREE.Vector3(
      0,
      0,
      smallBarrelPitchRadius,
    );
    const largeBarrelSurfaceVelocity = new THREE.Vector3().crossVectors(
      shaftAngularVelocity,
      largeBarrelContactRadius,
    );
    const smallBarrelSurfaceVelocity = new THREE.Vector3().crossVectors(
      shaftAngularVelocity,
      smallBarrelContactRadius,
    );
    const leftRopeVelocity = Y_AXIS.clone().multiplyScalar(
      largeBarrelPitchRadius * shaftAngularSpeed,
    );
    const rightRopeVelocity = Y_AXIS.clone().multiplyScalar(
      -smallBarrelPitchRadius * shaftAngularSpeed,
    );
    const lowerCenterVelocity = Y_AXIS.clone().multiplyScalar(
      pulleyVelocityY,
    );
    const lowerAngularVelocity = lowerPulleyAxis.clone().multiplyScalar(
      lowerPulleyAngularSpeed,
    );
    const leftLowerContactRadius = lowerPulleyHorizontal.clone()
      .multiplyScalar(-lowerPulleyPitchRadius);
    const rightLowerContactRadius = lowerPulleyHorizontal.clone()
      .multiplyScalar(lowerPulleyPitchRadius);
    const leftLowerSurfaceVelocity = lowerCenterVelocity.clone().add(
      new THREE.Vector3().crossVectors(
        lowerAngularVelocity,
        leftLowerContactRadius,
      ),
    );
    const rightLowerSurfaceVelocity = lowerCenterVelocity.clone().add(
      new THREE.Vector3().crossVectors(
        lowerAngularVelocity,
        rightLowerContactRadius,
      ),
    );
    const atReversal = Math.abs(shaftAngularSpeed) < transitionTolerance;
    const stage = atReversal
      ? shaftAngularAcceleration < 0
        ? 'windlass-reverses-at-raised-load-limit'
        : 'windlass-reverses-at-lowered-load-limit'
      : pulleyVelocityY > 0
        ? 'larger-barrel-winds-smaller-unwinds-load-rises'
        : 'larger-barrel-unwinds-smaller-winds-load-descends';
    return {
      atReversal,
      drivePhase,
      largeBarrelContactRadius,
      largeBarrelSurfaceVelocity,
      largeBarrelTangentialVelocityError: largeBarrelSurfaceVelocity.clone()
        .sub(leftRopeVelocity),
      largeWoundLength: ropeGeometry.largeWoundLength,
      largeWoundTurns: ropeGeometry.largeWoundLength
        / (fullTurn * largeBarrelPitchRadius),
      leftLowerContactPoint: ropeGeometry.leftPulleyTangent.clone(),
      leftLowerContactRadius,
      leftLowerNoSlipError: leftLowerSurfaceVelocity.clone().sub(
        leftRopeVelocity,
      ),
      leftLowerSurfaceVelocity,
      leftRopeVelocity,
      lowerPulleyAngle,
      lowerPulleyAngularAcceleration,
      lowerPulleyAngularSpeed,
      lowerPulleyCenter: ropeGeometry.lowerPulleyCenter.clone(),
      nominalRopeLength,
      pulleyAcceleration: Y_AXIS.clone().multiplyScalar(
        pulleyAccelerationY,
      ),
      pulleyAccelerationY,
      pulleyCenterY,
      pulleyDisplacement,
      pulleyVelocity: lowerCenterVelocity.clone(),
      pulleyVelocityY,
      rightLowerContactPoint: ropeGeometry.rightPulleyTangent.clone(),
      rightLowerContactRadius,
      rightLowerNoSlipError: rightLowerSurfaceVelocity.clone().sub(
        rightRopeVelocity,
      ),
      rightLowerSurfaceVelocity,
      rightRopeVelocity,
      ropeCount: 1,
      ropeCurve: ropeGeometry.curve,
      ropeLength: ropeGeometry.curve.getLength(),
      ropeLengthError: ropeGeometry.curve.getLength() - nominalRopeLength,
      ropeSegmentLengths: ropeGeometry.segmentLengths,
      ropeTransitionDistances: ropeGeometry.transitionDistances,
      shaftAngle,
      shaftAngularAcceleration,
      shaftAngularSpeed,
      smallBarrelContactRadius,
      smallBarrelSurfaceVelocity,
      smallBarrelTangentialVelocityError: smallBarrelSurfaceVelocity.clone()
        .sub(rightRopeVelocity),
      smallWoundLength: ropeGeometry.smallWoundLength,
      smallWoundTurns: ropeGeometry.smallWoundLength
        / (fullTurn * smallBarrelPitchRadius),
      stage,
      velocityDiscontinuous: false,
    };
  };

  const stateAtTime = (time) => {
    const drivePhase = THREE.MathUtils.euclideanModulo(
      time / cyclePeriod,
      1,
    );
    const driveAngle = fullTurn * drivePhase;
    const shaftAngle = sourcePoseAngle
      + shaftAngleAmplitude * Math.sin(driveAngle);
    const shaftAngularSpeed = shaftAngleAmplitude
      * driveAngularFrequency * Math.cos(driveAngle);
    const shaftAngularAcceleration = -shaftAngleAmplitude
      * driveAngularFrequency ** 2 * Math.sin(driveAngle);
    return stateAtShaftKinematics({
      drivePhase,
      shaftAngle,
      shaftAngularAcceleration,
      shaftAngularSpeed,
    });
  };
  const ropeMaterialPointAtTime = (time, materialDistance) => (
    stateAtTime(time).ropeCurve.getPointAtDistance(materialDistance)
  );

  root.userData.mechanism = 'single-rope-differential-chinese-windlass';
  for (const marker of [...ropeMarkers, ...lowerContactMarkers,
    largeDrumContactMarker, smallDrumContactMarker, shaftRotationIndex]) marker.visible = false;
  root.userData.shadowCameraHalfExtent = 6;
  root.userData.shadowBias = -.00003;
  root.userData.shadowNormalBias = .005;
  root.userData.hideGround = true;
  root.userData.minimumDisplayCycleSeconds = cyclePeriod;
  root.userData.reconstructionNote = 'The larger barrel takes up more rope than the smaller one releases. Bare barrel separates the rope exits from the central flange. The tilted sheave and winding helix are idealized reconstructions.';
  root.userData.cameraDistanceScale = 1.04;
  root.userData.blocks = {
    barrelFaceRings,
    barrelFlanges,
    baseRail,
    bearingPosts,
    bearingSleeves,
    cameraEnvelope,
    crankArm,
    crankHandle,
    footBlocks,
    hookNeck,
    inputShaft,
    largeBarrel,
    largeDrumContactMarker,
    loadHanger,
    loadHangerOutline,
    loadHook,
    lowerAxle,
    lowerContactMarkers,
    lowerPulley,
    lowerPulleyContactTread,
    lowerPulleyRotor,
    movingBlock,
    rope,
    ropeMarkers,
    ropeMesh,
    shaftRotationIndex,
    smallBarrel,
    smallDrumContactMarker,
    windlass,
    windlassRotor,
  };
  root.userData.geometry = {
    axis: X_AXIS.clone(),
    barrelExitHalfSpacing,
    barrelFlangeExtraRadius,
    barrelFlangeThickness,
    barrelRadiusDifference,
    barrelRadiusSum,
    baseLargeWoundLength,
    baseLargeWrapTurns,
    baseSmallWoundLength,
    baseSmallWrapTurns,
    baseY,
    bearingInnerRadius,
    bearingLength,
    bearingOuterRadius,
    circumferenceDifference,
    crankHandleLength,
    crankRadius,
    cyclePeriod,
    driveAngularFrequency,
    framePostXs,
    fullTurn,
    hangerFrontOffset,
    hangerLength,
    idealForceRatio,
    largeBarrelBodyRadius,
    largeBarrelInnerX,
    largeBarrelOuterX,
    largeBarrelPitchRadius,
    largeBarrelWidth,
    largeRopeExit: largeRopeExit.clone(),
    lowerPulleyAxis: lowerPulleyAxis.clone(),
    lowerPulleyHorizontal: lowerPulleyHorizontal.clone(),
    lowerPulleyPitchRadius,
    lowerWrapLength,
    nominalRopeLength,
    pulleyCenterZ,
    pulleyTravelPerShaftRadian,
    pulleyTravelPerWindlassRevolution,
    rearFrameZ,
    largeWindingAxialSpan,
    smallWindingAxialSpan,
    ropeMarkerCount,
    ropeMarkerMaterialDistances,
    ropeRadius,
    ropeRenderAngleThreshold,
    ropeRenderInterval,
    ropeTubularSegments,
    shaftAngleAmplitude,
    shaftLength,
    shaftRadius,
    shaftY,
    smallBarrelBodyRadius,
    smallBarrelInnerX,
    smallBarrelOuterX,
    smallBarrelPitchRadius,
    smallBarrelWidth,
    smallRopeExit: smallRopeExit.clone(),
    sourceFreeRopeLength,
    sourceLeftLegLength,
    sourcePoseAngle,
    sourcePulleyCenterY,
    sourceRasterFramePostsX,
    sourceRasterLargeBarrelRadius,
    sourceRasterLargeBarrelRangeX,
    sourceRasterLeftRopeX,
    sourceRasterLowerPulleyCenter,
    sourceRasterLowerPulleyRadius,
    sourceRasterRightRopeX,
    sourceRasterShaftCenter,
    sourceRasterSmallBarrelRadius,
    sourceRasterSmallBarrelRangeX,
    sourceRightLegLength,
    sourceScale,
    transitionTolerance,
  };
  root.userData.ropeGeometryAtShaftAngle = ropeGeometryAtShaftAngle;
  root.userData.ropeMaterialPointAtTime = ropeMaterialPointAtTime;
  root.userData.stateAtShaftKinematics = stateAtShaftKinematics;
  root.userData.stateAtTime = stateAtTime;

  let renderedRopeShaftAngle = sourcePoseAngle;
  let renderedRopeTime = 0;
  const update = (time) => {
    const state = stateAtTime(time);
    windlassRotor.rotation.set(state.shaftAngle, 0, 0);
    windlass.userData.angularSpeed = state.shaftAngularSpeed;
    windlass.userData.angularAcceleration = state.shaftAngularAcceleration;
    movingBlock.position.set(0, state.pulleyCenterY, pulleyCenterZ);
    movingBlock.rotation.set(0, 0, 0);
    movingBlock.userData.velocity = state.pulleyVelocity.clone();
    setSpin(lowerPulley, state.lowerPulleyAngle);
    lowerPulley.userData.angularSpeed = state.lowerPulleyAngularSpeed;
    lowerPulley.userData.angularAcceleration = (
      state.lowerPulleyAngularAcceleration
    );
    const ropeTimeWentBackward = time < renderedRopeTime;
    const ropeRenderDue = ropeTimeWentBackward
      || time - renderedRopeTime >= ropeRenderInterval;
    if (
      ropeRenderDue
      && Math.abs(state.shaftAngle - renderedRopeShaftAngle)
        >= ropeRenderAngleThreshold
    ) {
      rope.userData.setCurve(state.ropeCurve);
      renderedRopeShaftAngle = state.shaftAngle;
      renderedRopeTime = time;
    }
    rope.userData.renderedShaftAngle = renderedRopeShaftAngle;
    rope.userData.renderedTime = renderedRopeTime;
    ropeMarkers.forEach((marker, index) => {
      marker.position.copy(state.ropeCurve.getPointAtDistance(
        ropeMarkerMaterialDistances[index],
      ));
    });
    largeDrumContactMarker.position.copy(largeRopeExit);
    smallDrumContactMarker.position.copy(smallRopeExit);
    lowerContactMarkers[0].position.copy(state.leftLowerContactPoint);
    lowerContactMarkers[1].position.copy(state.rightLowerContactPoint);
    root.userData.contacts = {
      largeBarrelRope: {
        contactPoint: largeRopeExit.clone(),
        pitchRadius: largeBarrelPitchRadius,
        tangentialVelocityError: state.largeBarrelTangentialVelocityError
          .clone(),
        woundLength: state.largeWoundLength,
        winding: state.shaftAngularSpeed > 0,
      },
      lowerMovablePulley: {
        axis: lowerPulleyAxis.clone(),
        leftContactPoint: state.leftLowerContactPoint.clone(),
        leftNoSlipError: state.leftLowerNoSlipError.clone(),
        pitchRadius: lowerPulleyPitchRadius,
        rightContactPoint: state.rightLowerContactPoint.clone(),
        rightNoSlipError: state.rightLowerNoSlipError.clone(),
      },
      ropeLength: {
        count: state.ropeCount,
        error: state.ropeLengthError,
        nominalLength: nominalRopeLength,
      },
      smallBarrelRope: {
        contactPoint: smallRopeExit.clone(),
        pitchRadius: smallBarrelPitchRadius,
        tangentialVelocityError: state.smallBarrelTangentialVelocityError
          .clone(),
        unwinding: state.shaftAngularSpeed > 0,
        woundLength: state.smallWoundLength,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(-.8, .5, 12),
  };
}

function singleWrappedRopeDrumDrive() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;

  // Movement 134 has no source animation.  These dimensions are measured
  // from the 525 px public-domain engraving; the caption supplies the
  // authoritative topology: one rope or band, wound one or more complete
  // turns around one drum, converts uniform rotation into uniform material
  // travel along two free spans that appear collinear in the engraving.
  const sourceScale = 0.01;
  const sourceRasterDrumCenter = new THREE.Vector2(253, 231);
  const sourceRasterDrumOuterRadius = 181;
  const sourceRasterRimInnerRadius = 151;
  const sourceRasterRopeCenterY = 404;
  const sourceRasterRopeLeftX = 20;
  const sourceRasterRopeRightX = 486;
  const sourceRasterHubOuterRadius = 43;
  const sourceRasterShaftHoleRadius = 25;
  const sourceRasterRimSeparatorCount = 8;
  const sourceRasterSpokeCount = 4;
  const wrapTurns = 1;
  const wrapSweep = fullTurn * wrapTurns;

  const drumFlangeOuterRadius = sourceRasterDrumOuterRadius * sourceScale;
  const drumRimInnerRadius = sourceRasterRimInnerRadius * sourceScale;
  const ropePitchRadius = (
    sourceRasterRopeCenterY - sourceRasterDrumCenter.y
  ) * sourceScale;
  const leftRopeEndX = (
    sourceRasterRopeLeftX - sourceRasterDrumCenter.x
  ) * sourceScale;
  const rightRopeEndX = (
    sourceRasterRopeRightX - sourceRasterDrumCenter.x
  ) * sourceScale;
  const axialLead = .14;
  const axialSlope = axialLead / (2 * Math.PI * ropePitchRadius);
  const leftFreeSpanLength = -leftRopeEndX * Math.hypot(1, axialSlope);
  const rightFreeSpanLength = rightRopeEndX * Math.hypot(1, axialSlope);
  const hubOuterRadius = sourceRasterHubOuterRadius * sourceScale;
  const shaftHoleRadius = sourceRasterShaftHoleRadius * sourceScale;
  const ropeRadius = 0.045;
  const drumContactBedRadius = ropePitchRadius - ropeRadius;
  const drumWidth = 0.5;
  const flangeDepth = 0.07;
  const ropePlaneZ = 0;
  const wrappedLength = Math.hypot(wrapSweep * ropePitchRadius, axialLead);
  const nominalVisibleRopeLength = leftFreeSpanLength
    + wrappedLength + rightFreeSpanLength;
  const ropeMarkerCount = 13;
  const markerEndFadeLength = 0.18;
  const materialMarkerOffsets = Array.from(
    { length: ropeMarkerCount },
    (_, index) => nominalVisibleRopeLength
      * (index + 0.5) / ropeMarkerCount,
  );
  const drumAngularSpeed = 0.72;
  const drumRotationPeriod = fullTurn / drumAngularSpeed;
  const ropeLinearSpeed = ropePitchRadius * drumAngularSpeed;
  const linearTravelPerDrumRadian = ropePitchRadius;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.59,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.08,
    roughness: 0.72,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.69,
  });
  const inkMaterial = matte(PALETTE.ink, {
    metalness: 0.23,
    roughness: 0.49,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.47 });

  const centeredExtrusion = (shape, depth, bevelSize = 0.006) => {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      bevelEnabled: bevelSize > 0,
      bevelSegments: 1,
      bevelSize,
      bevelThickness: bevelSize,
      curveSegments: 32,
      depth,
      steps: 1,
    });
    geometry.translate(0, 0, -depth / 2);
    geometry.computeVertexNormals();
    return geometry;
  };
  const annulusShape = (innerRadius, outerRadius) => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outerRadius, 0, fullTurn, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, innerRadius, 0, fullTurn, true);
    shape.holes.push(hole);
    return shape;
  };
  const cylinderAlongZ = (radius, length, material, segments = 40) => {
    const cylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, length, segments),
      material,
    );
    cylinder.rotation.x = Math.PI / 2;
    return cylinder;
  };

  class SegmentedWrappedRopeCurve extends THREE.Curve {
    constructor() {
      super();
      this.wrap = new HelicalDrumWrap(ropePitchRadius, wrapSweep, axialLead);
      this.leftSpan = new THREE.LineCurve3(
        new THREE.Vector3(leftRopeEndX, -ropePitchRadius, -axialLead / 2 + leftRopeEndX * axialSlope),
        this.wrap.getPoint(0),
      );
      this.rightSpan = new THREE.LineCurve3(
        this.wrap.getPoint(1),
        new THREE.Vector3(rightRopeEndX, -ropePitchRadius, axialLead / 2 + rightRopeEndX * axialSlope),
      );
      this.curves = [this.leftSpan, this.wrap, this.rightSpan];
      this.segmentLengths = [
        leftFreeSpanLength,
        wrappedLength,
        rightFreeSpanLength,
      ];
      this.transitionDistances = [
        leftFreeSpanLength,
        leftFreeSpanLength + wrappedLength,
      ];
      this.totalLength = nominalVisibleRopeLength;
      this.wrapStartDistance = this.transitionDistances[0];
      this.wrapEndDistance = this.transitionDistances[1];
    }

    segmentAtDistance(rawDistance) {
      const distance = THREE.MathUtils.clamp(rawDistance, 0, this.totalLength);
      if (distance <= this.segmentLengths[0]) {
        return {
          curve: this.leftSpan,
          index: 0,
          localFraction: distance / this.segmentLengths[0],
          segmentStartDistance: 0,
        };
      }
      if (distance <= this.transitionDistances[1]) {
        return {
          curve: this.wrap,
          index: 1,
          localFraction: (
            distance - this.transitionDistances[0]
          ) / this.segmentLengths[1],
          segmentStartDistance: this.transitionDistances[0],
        };
      }
      return {
        curve: this.rightSpan,
        index: 2,
        localFraction: (
          distance - this.transitionDistances[1]
        ) / this.segmentLengths[2],
        segmentStartDistance: this.transitionDistances[1],
      };
    }

    getPoint(fraction, target = new THREE.Vector3()) {
      return this.getPointAtDistance(fraction * this.totalLength, target);
    }

    getPointAt(fraction, target = new THREE.Vector3()) {
      return this.getPoint(fraction, target);
    }

    getPointAtDistance(distance, target = new THREE.Vector3()) {
      const segment = this.segmentAtDistance(distance);
      return segment.curve.getPoint(segment.localFraction, target);
    }

    getTangent(fraction, target = new THREE.Vector3()) {
      return this.getTangentAtDistance(fraction * this.totalLength, target);
    }

    getTangentAt(fraction, target = new THREE.Vector3()) {
      return this.getTangent(fraction, target);
    }

    getTangentAtDistance(distance, target = new THREE.Vector3()) {
      const segment = this.segmentAtDistance(distance);
      return segment.curve.getTangent(segment.localFraction, target);
    }

    getLength() {
      return this.totalLength;
    }
  }

  const ropeCurve = new SegmentedWrappedRopeCurve();
  // Brown hatches the rope as laid rope; its lay runs with the rope travel.
  const rope = makeDynamicMovingBelt(ropeCurve, {
    closed: false,
    color: PALETTE.driven,
    markerCount: 0,
    radius: ropeRadius,
    tubularSegments: 420,
    laid: true,
  });
  rope.userData.mechanismString = true;
  rope.userData.physicalCable = true;
  rope.userData.role = 'one-continuous-rope-wound-once-around-one-drum';
  rope.userData.ropeCount = 1;
  rope.userData.wrapTurns = wrapTurns;
  rope.userData.materialMarkerOffsets = materialMarkerOffsets;
  const ropeMesh = rope.children[0];
  ropeMesh.userData.role = 'single-wrapped-and-two-free-span-rope-mesh';
  const ropeMarkers = materialMarkerOffsets.map((offset, index) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(ropeRadius * 1.55, 12, 9),
      indexMaterial,
    );
    marker.position.copy(ropeCurve.getPointAtDistance(offset));
    marker.userData.index = index;
    marker.userData.materialOffset = offset;
    marker.userData.role = 'white-material-marker-on-single-capstan-rope';
    rope.add(marker);
    return marker;
  });
  rope.userData.markers = ropeMarkers;

  const drum = new THREE.Group();
  const drumRotor = new THREE.Group();
  drum.add(drumRotor);
  drum.userData.axis = Z_AXIS.clone();
  drum.userData.pitchRadius = ropePitchRadius;
  drum.userData.role = 'single-fixed-axis-rope-driving-drum';
  drum.userData.rotor = drumRotor;

  const contactBed = new THREE.Mesh(
    centeredExtrusion(
      annulusShape(drumRimInnerRadius, drumContactBedRadius),
      drumWidth,
      0,
    ),
    driverMaterial,
  );
  contactBed.userData.contactRadius = drumContactBedRadius;
  contactBed.userData.role = 'cylindrical-bed-under-the-single-rope-wrap';
  const frontFlange = new THREE.Mesh(
    centeredExtrusion(
      annulusShape(drumRimInnerRadius, drumFlangeOuterRadius),
      flangeDepth,
      0.004,
    ),
    driverMaterial,
  );
  frontFlange.position.z = drumWidth / 2 + flangeDepth / 2;
  frontFlange.userData.role = 'front-retaining-flange-of-rope-drum';
  const rearFlange = frontFlange.clone();
  rearFlange.position.z = -drumWidth / 2 - flangeDepth / 2;
  rearFlange.userData.role = 'rear-retaining-flange-of-rope-drum';

  const spokeShape = ropeDrumSpokeShape();
  const spokeGeometry = centeredExtrusion(spokeShape, 0.2, 0.007);
  const spokes = Array.from(
    { length: sourceRasterSpokeCount },
    (_, index) => {
      const spoke = new THREE.Mesh(spokeGeometry.clone(), driverMaterial);
      spoke.position.z = 0.08;
      spoke.rotation.z = index * Math.PI / 2;
      spoke.userData.index = index;
      spoke.userData.role = 'one-of-four-curved-drum-spokes';
      return spoke;
    },
  );
  const hub = new THREE.Mesh(centeredExtrusion(annulusShape(shaftHoleRadius + .001, hubOuterRadius), drumWidth + .12, 0), driverMaterial);
  hub.userData.role = 'bored-hub-rigid-with-rope-drum';
  const hubFaceRing = new THREE.Mesh(
    new THREE.TorusGeometry(hubOuterRadius * 0.8, 0.035, 9, 48),
    inkMaterial,
  );
  hubFaceRing.position.z = drumWidth / 2 + 0.07;
  hubFaceRing.userData.role = 'dark-front-outline-of-drum-hub';
  const inputShaft = cylinderAlongZ(
    shaftHoleRadius,
    1.18,
    inkMaterial,
    38,
  );
  inputShaft.position.z = -.10;
  inputShaft.userData.axis = Z_AXIS.clone();
  inputShaft.userData.role = 'input-shaft-fast-to-single-rope-drum';
  const shaftFace = new THREE.Mesh(
    new THREE.CircleGeometry(shaftHoleRadius, 38),
    inkMaterial,
  );
  shaftFace.position.z = .491;
  shaftFace.userData.role = 'front-face-of-input-shaft';
  const frontOuterOutline = new THREE.Mesh(
    new THREE.TorusGeometry(
      drumFlangeOuterRadius - 0.025,
      0.028,
      9,
      88,
    ),
    inkMaterial,
  );
  frontOuterOutline.position.z = drumWidth / 2 + flangeDepth + 0.012;
  frontOuterOutline.userData.role = 'dark-outline-of-drum-front-rim';
  const frontInnerOutline = new THREE.Mesh(
    new THREE.TorusGeometry(
      drumRimInnerRadius + 0.02,
      0.025,
      9,
      80,
    ),
    inkMaterial,
  );
  frontInnerOutline.position.z = frontOuterOutline.position.z;
  frontInnerOutline.userData.role = 'dark-inner-outline-of-drum-front-rim';
  const rimSeparators = Array.from(
    { length: sourceRasterRimSeparatorCount },
    (_, index) => {
      const separator = new THREE.Mesh(
        new THREE.BoxGeometry(
          drumFlangeOuterRadius - drumRimInnerRadius,
          0.14,
          0.012,
        ),
        inkMaterial,
      );
      const angle = index * fullTurn / sourceRasterRimSeparatorCount;
      const radius = (
        drumFlangeOuterRadius + drumRimInnerRadius
      ) / 2;
      separator.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        drumWidth / 2 + flangeDepth + .001,
      );
      separator.rotation.z = angle;
      separator.userData.index = index;
      separator.userData.role = 'one-of-eight-source-rim-separator-plates';
      return separator;
    },
  );
  const drumRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.065, 0.034),
    indexMaterial,
  );
  drumRotationIndex.position.set(
    1.08,
    0.42,
    frontOuterOutline.position.z + 0.045,
  );
  drumRotationIndex.rotation.z = Math.atan2(0.42, 1.08);
  drumRotationIndex.userData.role = 'white-index-showing-uniform-drum-rotation';
  drumRotor.add(
    contactBed,
    frontFlange,
    rearFlange,
    ...spokes,
    hub,
    hubFaceRing,
    inputShaft,
    shaftFace,
    frontOuterOutline,
    frontInnerOutline,
    ...rimSeparators,
    drumRotationIndex,
  );

  const rearFrameZ = -0.52;
  const pedestalBottomY = -2.18;
  const pedestal = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 1.92, 0.38),
    frameMaterial,
  );
  pedestal.position.set(0, -1.24, rearFrameZ);
  pedestal.userData.role = 'rear-fixed-pedestal-supporting-drum-axis';
  const pedestalFoot = new THREE.Mesh(
    new THREE.BoxGeometry(1.75, 0.16, 0.68),
    frameMaterial,
  );
  pedestalFoot.position.set(0, pedestalBottomY, rearFrameZ);
  pedestalFoot.userData.role = 'fixed-foot-of-drum-bearing-pedestal';
  const rearBearing = new THREE.Mesh(
    centeredExtrusion(annulusShape(shaftHoleRadius + .003, hubOuterRadius * .7 + .075), .30, 0),
    frameMaterial,
  );
  rearBearing.position.z = -.51;
  rearBearing.userData.axis = Z_AXIS.clone();
  rearBearing.userData.role = 'fixed-bearing-behind-drum-hub';

  const bottomContactPoint = ropeCurve.wrap.getPoint(0);
  const pitchContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 18, 12),
    indexMaterial,
  );
  pitchContactMarker.position.copy(bottomContactPoint);
  pitchContactMarker.position.z += ropeRadius * 1.45;
  pitchContactMarker.userData.noShadow = true;
  pitchContactMarker.userData.role = 'white-bottom-drum-rope-pitch-contact';
  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(5.35, 4.85, 0.01),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(0, -0.14, rearFrameZ - 0.25);
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.noShadow = true;
  cameraEnvelope.userData.role = 'invisible-complete-rope-drum-envelope';
  root.add(
    cameraEnvelope,
    pedestal,
    pedestalFoot,
    rearBearing,
    drum,
    rope,
    pitchContactMarker,
  );
  // Brown crops both free spans at the plate edge. Beyond it each span simply
  // runs on straight and taut, and ends cleanly out of the default view; Brown
  // draws no reels or stands, so none are modelled. Each lead is a whole number
  // of strand periods long so the lay runs continuously into the drawn spans.
  // Keep the default view on Brown's crop.
  root.updateMatrixWorld(true);
  root.userData.cameraFitBounds = new THREE.Box3().setFromObject(root, true);
  const strandPeriod = LAID_ROPE.layPerDiameter * 2 * ropeRadius / LAID_ROPE.strands;
  const ropeLeadLength = Math.ceil(1.0 / strandPeriod) * strandPeriod;
  const ropeLeads = [-1, 1].map((side) => {
    const span = side < 0 ? ropeCurve.leftSpan : ropeCurve.rightSpan;
    const cropEnd = side < 0 ? span.v1.clone() : span.v2.clone();
    const outward = span.v2.clone().sub(span.v1).normalize().multiplyScalar(side);
    const endPoint = cropEnd.clone().addScaledVector(outward, ropeLeadLength);
    const lead = makeDynamicMovingBelt(
      side < 0 ? new THREE.LineCurve3(endPoint, cropEnd) : new THREE.LineCurve3(cropEnd, endPoint),
      { closed: false, color: PALETTE.driven, markerCount: 0, radius: ropeRadius, laid: true },
    );
    lead.userData.role = side < 0 ? 'rope-running-on-beyond-left-crop' : 'rope-running-on-beyond-right-crop';
    root.add(lead);
    return { lead, side };
  });
  const updateRopeLeads = (ropeTravel) => {
    for (const { lead, side } of ropeLeads) {
      lead.userData.updateDistance(side < 0 ? ropeTravel : ropeTravel - nominalVisibleRopeLength);
    }
  };
  root.userData.ropeLeads = ropeLeads.map(({ lead }) => lead);

  const stateAtDrumKinematics = ({
    drumAngle,
    angularAcceleration,
    angularSpeed,
    time = null,
  }) => {
    const ropeTravel = ropePitchRadius * drumAngle;
    const linearSpeed = ropePitchRadius * angularSpeed;
    const linearAcceleration = ropePitchRadius * angularAcceleration;
    const contactRadius = new THREE.Vector3(0, -ropePitchRadius, 0);
    const drumSurfaceVelocity = new THREE.Vector3().crossVectors(
      Z_AXIS.clone().multiplyScalar(angularSpeed),
      contactRadius,
    );
    const drumSurfaceAcceleration = new THREE.Vector3().crossVectors(
      Z_AXIS.clone().multiplyScalar(angularAcceleration),
      contactRadius,
    ).add(new THREE.Vector3().crossVectors(
      Z_AXIS.clone().multiplyScalar(angularSpeed),
      new THREE.Vector3().crossVectors(
        Z_AXIS.clone().multiplyScalar(angularSpeed),
        contactRadius,
      ),
    ));
    const freeRopeVelocity = new THREE.Vector3(1, 0, axialSlope).normalize().multiplyScalar(linearSpeed);
    const freeRopeAcceleration = new THREE.Vector3(1, 0, axialSlope).normalize().multiplyScalar(
      linearAcceleration
    );
    const noSlipVelocityError = drumSurfaceVelocity.clone().sub(
      freeRopeVelocity
    );
    const rotationPhase = THREE.MathUtils.euclideanModulo(
      drumAngle / fullTurn,
      1,
    );
    return {
      angularAcceleration,
      angularSpeed,
      bottomContactPoint: bottomContactPoint.clone(),
      contactRadius,
      drumAngle,
      drumSurfaceAcceleration,
      drumSurfaceVelocity,
      freeRopeAcceleration,
      freeRopeVelocity,
      linearAcceleration,
      linearSpeed,
      linearTravelPerDrumRadian,
      noSlipVelocityError,
      nominalVisibleRopeLength,
      ropeCount: 1,
      ropeCurve,
      ropeLength: ropeCurve.getLength(),
      ropeLengthError: ropeCurve.getLength() - nominalVisibleRopeLength,
      ropeTravel,
      rotationPhase,
      stage: angularSpeed >= 0
        ? 'drum-turns-counterclockwise-rope-travels-right'
        : 'drum-turns-clockwise-rope-travels-left',
      time,
      velocityDiscontinuous: false,
      wrapSweep,
      wrapTurns,
    };
  };
  const stateAtTime = (time) => stateAtDrumKinematics({
    angularAcceleration: 0,
    angularSpeed: drumAngularSpeed,
    drumAngle: drumAngularSpeed * time,
    time,
  });
  const materialDistanceAtTime = (time, materialOffset) => (
    THREE.MathUtils.euclideanModulo(
      materialOffset + stateAtTime(time).ropeTravel,
      nominalVisibleRopeLength,
    )
  );
  const ropeMaterialPointAtTime = (time, materialOffset) => (
    ropeCurve.getPointAtDistance(materialDistanceAtTime(time, materialOffset))
  );
  const ropeMaterialVelocityAtDistance = (distance, angularSpeed) => (
    ropeCurve.getTangentAtDistance(distance).multiplyScalar(
      ropePitchRadius * angularSpeed
    )
  );
  const wrappedContactStateAtAngle = (angle, angularSpeed) => {
    const radial = new THREE.Vector3(
      ropePitchRadius * Math.sin(angle),
      -ropePitchRadius * Math.cos(angle),
      0,
    );
    const surfaceVelocity = new THREE.Vector3().crossVectors(
      Z_AXIS.clone().multiplyScalar(angularSpeed),
      radial,
    );
    const ropeVelocity = ropeCurve.wrap.getTangent(angle / wrapSweep).multiplyScalar(ropePitchRadius * angularSpeed);
    return {
      angle,
      noSlipVelocityError: surfaceVelocity.clone().sub(ropeVelocity),
      radial,
      ropeVelocity,
      surfaceVelocity,
    };
  };

  root.userData.mechanism = 'single-rope-one-turn-drum-linear-drive';
  root.userData.cameraDistanceScale = 1.06;
  root.userData.blocks = {
    cameraEnvelope,
    contactBed,
    drum,
    drumRotationIndex,
    drumRotor,
    frontFlange,
    frontInnerOutline,
    frontOuterOutline,
    hub,
    hubFaceRing,
    inputShaft,
    pedestal,
    pedestalFoot,
    pitchContactMarker,
    rearBearing,
    rearFlange,
    rimSeparators,
    rope,
    ropeMarkers,
    ropeMesh,
    shaftFace,
    spokes,
  };
  root.userData.geometry = {
    axialLead,
    axialSlope,
    drumAngularSpeed,
    drumContactBedRadius,
    drumFlangeOuterRadius,
    drumRimInnerRadius,
    drumRotationPeriod,
    drumWidth,
    flangeDepth,
    fullTurn,
    hubOuterRadius,
    leftFreeSpanLength,
    leftRopeEndX,
    linearTravelPerDrumRadian,
    markerEndFadeLength,
    materialMarkerOffsets,
    nominalVisibleRopeLength,
    pedestalBottomY,
    rearFrameZ,
    rightFreeSpanLength,
    rightRopeEndX,
    ropeLinearSpeed,
    ropeMarkerCount,
    ropePitchRadius,
    ropePlaneZ,
    ropeRadius,
    shaftHoleRadius,
    sourceRasterDrumCenter,
    sourceRasterDrumOuterRadius,
    sourceRasterHubOuterRadius,
    sourceRasterRimInnerRadius,
    sourceRasterRimSeparatorCount,
    sourceRasterRopeCenterY,
    sourceRasterRopeLeftX,
    sourceRasterRopeRightX,
    sourceRasterShaftHoleRadius,
    sourceRasterSpokeCount,
    sourceScale,
    wrappedLength,
    wrapSweep,
    wrapTurns,
  };
  root.userData.materialDistanceAtTime = materialDistanceAtTime;
  root.userData.ropeMaterialPointAtTime = ropeMaterialPointAtTime;
  root.userData.ropeMaterialVelocityAtDistance =
    ropeMaterialVelocityAtDistance;
  root.userData.stateAtDrumKinematics = stateAtDrumKinematics;
  root.userData.stateAtTime = stateAtTime;
  root.userData.wrappedContactStateAtAngle = wrappedContactStateAtAngle;

  const update = (time) => {
    const state = stateAtTime(time);
    drumRotor.rotation.set(0, 0, state.drumAngle);
    drum.userData.angularSpeed = state.angularSpeed;
    drum.userData.angularAcceleration = state.angularAcceleration;
    rope.userData.materialTravel = state.ropeTravel;
    rope.userData.updateDistance(state.ropeTravel);
    updateRopeLeads(state.ropeTravel);
    ropeMarkers.forEach((marker, index) => {
      const materialDistance = materialDistanceAtTime(
        time,
        materialMarkerOffsets[index],
      );
      marker.position.copy(ropeCurve.getPointAtDistance(materialDistance));
      marker.visible = materialDistance > markerEndFadeLength
        && materialDistance
          < nominalVisibleRopeLength - markerEndFadeLength;
      marker.userData.materialDistance = materialDistance;
      marker.userData.velocity = ropeMaterialVelocityAtDistance(
        materialDistance,
        state.angularSpeed,
      );
    });
    root.userData.contacts = {
      drumRopeWrap: {
        contactPoint: state.bottomContactPoint.clone(),
        noSlipVelocityError: state.noSlipVelocityError.clone(),
        pitchRadius: ropePitchRadius,
        ropeCount: state.ropeCount,
        wrapSweep: state.wrapSweep,
        wrapTurns: state.wrapTurns,
      },
      fixedDrumBearing: {
        axisError: drum.userData.axis.distanceTo(Z_AXIS),
        centerTranslation: drum.position.length(),
      },
      ropeMaterialFlow: {
        linearAcceleration: state.linearAcceleration,
        linearSpeed: state.linearSpeed,
        travelPerDrumRadian: state.linearTravelPerDrumRadian,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  cameraEnvelope.castShadow = false;
  cameraEnvelope.receiveShadow = false;
  pitchContactMarker.castShadow = false;
  pitchContactMarker.receiveShadow = false;
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  root.userData.hideGround = true;
  root.userData.supportsRestart = true;
  root.userData.minimumDisplayCycleSeconds = 4;
  root.userData.animationTiming = { authoredCyclePeriod: drumRotationPeriod };
  root.userData.tractionAssumption = 'Prescribed mean rope speed R omega; helical axial creep is reported, not dynamically solved.';
  for (const outline of [frontOuterOutline, frontInnerOutline, hubFaceRing]) outline.visible = false;
  drumRotationIndex.visible = false;
  pitchContactMarker.visible = false;
  return {
    root,
    update,
    reset: () => update(0),
    cameraDirection: new THREE.Vector3(.4, .2, 13.5),
  };
}

function endlessBandSaw() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;

  // The official animation supplies an exact, particularly clean layout:
  // equal 5-unit wheels at (0, 0) and (0, 35), joined by one open endless
  // band whose straight runs lie at x = +/-5.  Its table surface is y = 6.
  // Those source coordinates are retained here so the rendered proportions
  // and every no-slip relationship can be checked independently.
  const sourceScale = 0.115;
  const sourceLowerWheelCenter = new THREE.Vector2(0, 0);
  const sourceUpperWheelCenter = new THREE.Vector2(0, 35);
  const sourceWheelPitchRadius = 5;
  const sourceRightBladeX = 5;
  const sourceLeftBladeX = -5;
  const sourceTableLeftX = -5.5;
  const sourceTableRightX = 19.5;
  const sourceTableBottomY = 5.5;
  const sourceTableTopY = 6;
  const sourceFrameBaseLeftX = -31;
  const sourceFrameBaseRightX = 16;
  const sourceFrameBaseBottomY = -10;
  const sourceFrameBaseTopY = -9;
  const sourceSpokeCount = 6;

  const lowerWheelCenter = new THREE.Vector3(
    sourceLowerWheelCenter.x * sourceScale,
    sourceLowerWheelCenter.y * sourceScale,
    0,
  );
  const upperWheelCenter = new THREE.Vector3(
    sourceUpperWheelCenter.x * sourceScale,
    sourceUpperWheelCenter.y * sourceScale,
    0,
  );
  const wheelPitchRadius = sourceWheelPitchRadius * sourceScale;
  const wheelCenterDistance = upperWheelCenter.y - lowerWheelCenter.y;
  const rightBladeX = sourceRightBladeX * sourceScale;
  const leftBladeX = sourceLeftBladeX * sourceScale;
  const tableLeftX = sourceTableLeftX * sourceScale;
  const tableRightX = sourceTableRightX * sourceScale;
  const tableBottomY = sourceTableBottomY * sourceScale;
  const tableTopY = sourceTableTopY * sourceScale;
  const frameBaseLeftX = sourceFrameBaseLeftX * sourceScale;
  const frameBaseRightX = sourceFrameBaseRightX * sourceScale;
  const frameBaseBottomY = sourceFrameBaseBottomY * sourceScale;
  const frameBaseTopY = sourceFrameBaseTopY * sourceScale;
  const straightRunLength = wheelCenterDistance;
  const halfWrapLength = Math.PI * wheelPitchRadius;
  const bladePathLength = straightRunLength * 2 + halfWrapLength * 2;
  const bladeWidth = 0.2;
  const bladeThickness = 0.032;
  const wheelWidth = 0.28;
  const wheelContactRadius = wheelPitchRadius - bladeThickness / 2;
  const wheelAngularSpeedMagnitude = 1.05;
  const driverAngularSpeed = -wheelAngularSpeedMagnitude;
  const drivenAngularSpeed = driverAngularSpeed;
  const bladeLinearSpeed = wheelPitchRadius * wheelAngularSpeedMagnitude;
  const wheelRotationPeriod = fullTurn / wheelAngularSpeedMagnitude;
  const bladeCircuitPeriod = bladePathLength / bladeLinearSpeed;
  const sawToothCount = 64;
  const indexToothStride = 8;
  const indexToothCount = sawToothCount / indexToothStride;
  const sawToothPitch = bladePathLength / sawToothCount;

  class EqualWheelSawBandPath extends THREE.Curve {
    constructor() {
      super();
      this.rightRunEndDistance = straightRunLength;
      this.lowerWrapEndDistance = straightRunLength + halfWrapLength;
      this.leftRunEndDistance = straightRunLength * 2 + halfWrapLength;
      this.totalLength = bladePathLength;
      this.transitionDistances = [
        0,
        this.rightRunEndDistance,
        this.lowerWrapEndDistance,
        this.leftRunEndDistance,
        this.totalLength,
      ];
      this.segmentLengths = [
        straightRunLength,
        halfWrapLength,
        straightRunLength,
        halfWrapLength,
      ];
    }

    normalizeDistance(distance) {
      return THREE.MathUtils.euclideanModulo(distance, this.totalLength);
    }

    segmentAtDistance(distance) {
      const normalizedDistance = this.normalizeDistance(distance);
      if (normalizedDistance <= this.rightRunEndDistance) {
        return {
          index: 0,
          kind: 'right-cutting-run',
          localDistance: normalizedDistance,
          normalizedDistance,
        };
      }
      if (normalizedDistance <= this.lowerWrapEndDistance) {
        return {
          index: 1,
          kind: 'lower-clockwise-half-wrap',
          localDistance: normalizedDistance - this.rightRunEndDistance,
          normalizedDistance,
        };
      }
      if (normalizedDistance <= this.leftRunEndDistance) {
        return {
          index: 2,
          kind: 'left-return-run',
          localDistance: normalizedDistance - this.lowerWrapEndDistance,
          normalizedDistance,
        };
      }
      return {
        index: 3,
        kind: 'upper-clockwise-half-wrap',
        localDistance: normalizedDistance - this.leftRunEndDistance,
        normalizedDistance,
      };
    }

    getPointAtDistance(distance, target = new THREE.Vector3()) {
      const segment = this.segmentAtDistance(distance);
      if (segment.index === 0) {
        return target.set(
          rightBladeX,
          upperWheelCenter.y - segment.localDistance,
          0,
        );
      }
      if (segment.index === 1) {
        const angle = -segment.localDistance / wheelPitchRadius;
        return target.set(
          lowerWheelCenter.x + Math.cos(angle) * wheelPitchRadius,
          lowerWheelCenter.y + Math.sin(angle) * wheelPitchRadius,
          0,
        );
      }
      if (segment.index === 2) {
        return target.set(
          leftBladeX,
          lowerWheelCenter.y + segment.localDistance,
          0,
        );
      }
      const angle = -Math.PI - segment.localDistance / wheelPitchRadius;
      return target.set(
        upperWheelCenter.x + Math.cos(angle) * wheelPitchRadius,
        upperWheelCenter.y + Math.sin(angle) * wheelPitchRadius,
        0,
      );
    }

    getTangentAtDistance(distance, target = new THREE.Vector3()) {
      const segment = this.segmentAtDistance(distance);
      if (segment.index === 0) return target.set(0, -1, 0);
      if (segment.index === 2) return target.set(0, 1, 0);
      const angle = segment.index === 1
        ? -segment.localDistance / wheelPitchRadius
        : -Math.PI - segment.localDistance / wheelPitchRadius;
      return target.set(Math.sin(angle), -Math.cos(angle), 0);
    }

    getCurvatureVectorAtDistance(distance, target = new THREE.Vector3()) {
      const segment = this.segmentAtDistance(distance);
      if (segment.index === 0 || segment.index === 2) {
        return target.set(0, 0, 0);
      }
      const center = segment.index === 1
        ? lowerWheelCenter
        : upperWheelCenter;
      const point = this.getPointAtDistance(distance, new THREE.Vector3());
      return target.subVectors(center, point).divideScalar(
        wheelPitchRadius ** 2,
      );
    }

    getPoint(fraction, target = new THREE.Vector3()) {
      return this.getPointAtDistance(fraction * this.totalLength, target);
    }

    getPointAt(fraction, target = new THREE.Vector3()) {
      return this.getPoint(fraction, target);
    }

    getTangent(fraction, target = new THREE.Vector3()) {
      return this.getTangentAtDistance(
        fraction * this.totalLength,
        target,
      );
    }

    getTangentAt(fraction, target = new THREE.Vector3()) {
      return this.getTangent(fraction, target);
    }

    getLength() {
      return this.totalLength;
    }
  }

  const bladePath = new EqualWheelSawBandPath();
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.61,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.61,
  });
  const bladeMaterial = matte(PALETTE.driven, {
    metalness: 0.28,
    roughness: 0.47,
    side: THREE.DoubleSide,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.69,
  });
  const inkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.49,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const centeredExtrusion = (shape, depth, bevelSize = 0.006) => {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      bevelEnabled: bevelSize > 0,
      bevelSegments: 1,
      bevelSize,
      bevelThickness: bevelSize,
      curveSegments: 40,
      depth,
      steps: 1,
    });
    geometry.translate(0, 0, -depth / 2);
    geometry.computeVertexNormals();
    return geometry;
  };
  const annulusShape = (innerRadius, outerRadius) => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outerRadius, 0, fullTurn, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, innerRadius, 0, fullTurn, true);
    shape.holes.push(hole);
    return shape;
  };
  const cylinderAlongZ = (radius, length, material, segments = 36) => {
    const cylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, length, segments),
      material,
    );
    cylinder.rotation.x = Math.PI / 2;
    return cylinder;
  };

  const makeSawWheel = (center, material, role) => {
    const wheel = new THREE.Group();
    const rotor = new THREE.Group();
    wheel.position.copy(center);
    wheel.add(rotor);
    wheel.userData.axis = Z_AXIS.clone();
    wheel.userData.pitchRadius = wheelPitchRadius;
    wheel.userData.contactRadius = wheelContactRadius;
    wheel.userData.rotor = rotor;
    wheel.userData.role = role;

    const rimRadialThickness = 0.105;
    const rim = new THREE.Mesh(
      centeredExtrusion(
        annulusShape(
          wheelContactRadius - rimRadialThickness,
          wheelContactRadius,
        ),
        wheelWidth,
        0.005,
      ),
      material,
    );
    rim.userData.contactRadius = wheelContactRadius;
    rim.userData.role = `${role}-open-rim-and-band-contact-tread`;

    const hubRadius = 0.13;
    const hub = cylinderAlongZ(hubRadius, wheelWidth + 0.1, material, 40);
    hub.userData.role = `${role}-hub`;

    const spokeGeometry = Array.from(
      { length: sourceSpokeCount },
      (_, index) => {
        const angle = index * fullTurn / sourceSpokeCount;
        const twist = 0.22;
        const curve = new THREE.CubicBezierCurve3(
          new THREE.Vector3(
            Math.cos(angle) * hubRadius * 0.72,
            Math.sin(angle) * hubRadius * 0.72,
            0.025,
          ),
          new THREE.Vector3(
            Math.cos(angle + twist * 0.12) * wheelPitchRadius * 0.42,
            Math.sin(angle + twist * 0.12) * wheelPitchRadius * 0.42,
            0.025,
          ),
          new THREE.Vector3(
            Math.cos(angle + twist * 0.76) * wheelPitchRadius * 0.64,
            Math.sin(angle + twist * 0.76) * wheelPitchRadius * 0.64,
            0.025,
          ),
          new THREE.Vector3(
            Math.cos(angle + twist) * (
              wheelContactRadius - rimRadialThickness * 0.78
            ),
            Math.sin(angle + twist) * (
              wheelContactRadius - rimRadialThickness * 0.78
            ),
            0.025,
          ),
        );
        const spoke = new THREE.Mesh(
          new THREE.TubeGeometry(curve, 18, 0.029, 8, false),
          material,
        );
        spoke.userData.index = index;
        spoke.userData.role = `${role}-curved-spoke`;
        return spoke;
      },
    );
    // Brown inks the rim and hub edges only because the plate is a line
    // drawing; the former dark outline rings are not separate parts.
    const rotationIndex = new THREE.Mesh(
      new THREE.BoxGeometry(0.19, 0.05, 0.032),
      indexMaterial,
    );
    rotationIndex.position.set(
      wheelPitchRadius * 0.64,
      0,
      wheelWidth / 2 + 0.055,
    );
    rotationIndex.userData.role = `${role}-white-rotation-index`;
    rotor.add(
      rim,
      ...spokeGeometry,
      hub,
      rotationIndex,
    );
    wheel.userData.blocks = {
      hub,
      rim,
      rotationIndex,
      spokes: spokeGeometry,
    };
    return wheel;
  };

  const lowerWheel = makeSawWheel(
    lowerWheelCenter,
    driverMaterial,
    'lower-driving-saw-wheel',
  );
  const upperWheel = makeSawWheel(
    upperWheelCenter,
    drivenMaterial,
    'upper-driven-saw-wheel',
  );

  const makeBladeRibbonGeometry = (segmentCount = 384) => {
    const positions = [];
    const indices = [];
    const halfThickness = bladeThickness / 2;
    const halfWidth = bladeWidth / 2;
    for (let index = 0; index < segmentCount; index += 1) {
      const distance = bladePathLength * index / segmentCount;
      const point = bladePath.getPointAtDistance(distance);
      const tangent = bladePath.getTangentAtDistance(distance);
      const normal = new THREE.Vector3(-tangent.y, tangent.x, 0);
      for (const [normalScale, zOffset] of [
        [halfThickness, halfWidth],
        [-halfThickness, halfWidth],
        [-halfThickness, -halfWidth],
        [halfThickness, -halfWidth],
      ]) {
        const vertex = point.clone().addScaledVector(normal, normalScale);
        vertex.z += zOffset;
        positions.push(vertex.x, vertex.y, vertex.z);
      }
    }
    for (let index = 0; index < segmentCount; index += 1) {
      const next = (index + 1) % segmentCount;
      for (let side = 0; side < 4; side += 1) {
        const sideNext = (side + 1) % 4;
        const a = index * 4 + side;
        const b = next * 4 + side;
        const c = next * 4 + sideNext;
        const d = index * 4 + sideNext;
        indices.push(a, b, c, a, c, d);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    geometry.userData.closedRibbon = true;
    geometry.userData.segmentCount = segmentCount;
    return geometry;
  };

  const sawBand = new THREE.Group();
  sawBand.userData.closed = true;
  sawBand.userData.physicalSawBand = true;
  sawBand.userData.role = 'one-continuous-flat-toothed-saw-band';
  const bladeRibbon = new THREE.Mesh(
    makeBladeRibbonGeometry(),
    bladeMaterial,
  );
  bladeRibbon.userData.role = 'closed-flat-saw-blade-ribbon';
  bladeRibbon.userData.pathLength = bladePathLength;
  sawBand.add(bladeRibbon);

  const toothLength = sawToothPitch * 0.56;
  const toothProjection = 0.075;
  const makeToothGeometry = () => {
    const x0 = -toothLength / 2;
    const x1 = toothLength / 2;
    const y0 = -bladeThickness * 0.68;
    const y1 = bladeThickness * 0.68;
    const vertices = new Float32Array([
      x0, y0, 0, x1, y0, 0, x1, y0, toothProjection,
      x0, y1, 0, x1, y1, 0, x1, y1, toothProjection,
    ]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex([
      0, 1, 2, 3, 5, 4,
      0, 3, 4, 0, 4, 1,
      1, 4, 5, 1, 5, 2,
      2, 5, 3, 2, 3, 0,
    ]);
    geometry.computeVertexNormals();
    return geometry;
  };
  const toothGeometry = makeToothGeometry();
  const sawTeeth = [];
  const bladeIndexes = [];
  const toothMaterialOffsets = [];
  for (let index = 0; index < sawToothCount; index += 1) {
    const isIndex = index % indexToothStride === 0;
    const tooth = new THREE.Mesh(
      toothGeometry,
      isIndex ? indexMaterial : bladeMaterial,
    );
    const materialOffset = index * sawToothPitch;
    tooth.userData.index = index;
    tooth.userData.materialOffset = materialOffset;
    tooth.userData.role = isIndex
      ? 'white-material-index-tooth-on-endless-saw-band'
      : 'moving-tooth-on-endless-saw-band';
    toothMaterialOffsets.push(materialOffset);
    sawTeeth.push(tooth);
    if (isIndex) bladeIndexes.push(tooth);
    sawBand.add(tooth);
  }
  sawBand.userData.markers = bladeIndexes;
  sawBand.userData.teeth = sawTeeth;

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role = 'fixed-c-frame-table-and-wheel-bearings';
  const frameBase = new THREE.Mesh(
    new THREE.BoxGeometry(
      frameBaseRightX - frameBaseLeftX,
      frameBaseTopY - frameBaseBottomY,
      1.34,
    ),
    frameMaterial,
  );
  frameBase.position.set(
    (frameBaseLeftX + frameBaseRightX) / 2,
    (frameBaseBottomY + frameBaseTopY) / 2,
    -0.37,
  );
  frameBase.userData.role = 'source-proportioned-fixed-machine-base';

  const columnShape = new THREE.Shape();
  columnShape.moveTo(-26 * sourceScale, -9 * sourceScale);
  columnShape.lineTo(-7 * sourceScale, -9 * sourceScale);
  columnShape.lineTo(-8 * sourceScale, -6.928932 * sourceScale);
  columnShape.lineTo(-8 * sourceScale, 21.754033 * sourceScale);
  columnShape.bezierCurveTo(
    -8 * sourceScale,
    27 * sourceScale,
    -4.5 * sourceScale,
    31.5 * sourceScale,
    0,
    31.5 * sourceScale,
  );
  columnShape.lineTo(0, 39.5 * sourceScale);
  columnShape.bezierCurveTo(
    -7 * sourceScale,
    41 * sourceScale,
    -15.5 * sourceScale,
    33 * sourceScale,
    -17 * sourceScale,
    23 * sourceScale,
  );
  columnShape.bezierCurveTo(
    -18.5 * sourceScale,
    9 * sourceScale,
    -20 * sourceScale,
    0,
    -26 * sourceScale,
    -9 * sourceScale,
  );
  columnShape.closePath();
  const frameColumn = new THREE.Mesh(
    centeredExtrusion(columnShape, 0.48, 0.018),
    frameMaterial,
  );
  frameColumn.position.z = -0.47;
  frameColumn.userData.role = 'source-profiled-c-frame-column-and-upper-arm';

  const lowerBearingPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 1.08, 0.54),
    frameMaterial,
  );
  lowerBearingPost.position.set(0, -0.54, -0.45);
  lowerBearingPost.userData.role = 'fixed-lower-wheel-bearing-post';
  const tablePost = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 1.4, 0.58),
    frameMaterial,
  );
  tablePost.position.set(
    0.9,
    tableBottomY - 0.7,
    -0.43,
  );
  tablePost.userData.role = 'fixed-work-table-pedestal';
  const tableBraceCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0.82, -0.58, -0.42),
    new THREE.Vector3(1.86, -0.55, -0.42),
    new THREE.Vector3(1.87, tableBottomY - 0.04, -0.42),
  );
  const tableBrace = new THREE.Mesh(
    new THREE.TubeGeometry(tableBraceCurve, 48, 0.065, 10, false),
    frameMaterial,
  );
  tableBrace.userData.role = 'curved-fixed-work-table-brace';

  const tableDepth = 2.15;
  const tableSlotHalfX = 0.074;
  const tableSlotHalfZ = 0.17;
  const tableReturnNotchRightX = leftBladeX + tableSlotHalfX;
  const tableShape = new THREE.Shape();
  tableShape.moveTo(tableLeftX, -tableDepth / 2);
  tableShape.lineTo(tableRightX, -tableDepth / 2);
  tableShape.lineTo(tableRightX, tableDepth / 2);
  tableShape.lineTo(tableLeftX, tableDepth / 2);
  tableShape.lineTo(tableLeftX, tableSlotHalfZ);
  tableShape.lineTo(tableReturnNotchRightX, tableSlotHalfZ);
  tableShape.lineTo(tableReturnNotchRightX, -tableSlotHalfZ);
  tableShape.lineTo(tableLeftX, -tableSlotHalfZ);
  tableShape.closePath();
  const tableSlot = new THREE.Path();
  tableSlot.moveTo(rightBladeX - tableSlotHalfX, -tableSlotHalfZ);
  tableSlot.lineTo(rightBladeX - tableSlotHalfX, tableSlotHalfZ);
  tableSlot.lineTo(rightBladeX + tableSlotHalfX, tableSlotHalfZ);
  tableSlot.lineTo(rightBladeX + tableSlotHalfX, -tableSlotHalfZ);
  tableSlot.closePath();
  tableShape.holes.push(tableSlot);
  const workTable = new THREE.Mesh(
    new THREE.ExtrudeGeometry(tableShape, {
      bevelEnabled: true,
      bevelSegments: 1,
      bevelSize: 0.008,
      bevelThickness: 0.008,
      depth: tableTopY - tableBottomY,
      steps: 1,
    }),
    frameMaterial,
  );
  workTable.rotation.x = Math.PI / 2;
  workTable.position.y = tableTopY;
  workTable.userData.actualReturnRunEdgeNotch = true;
  workTable.userData.actualThroughSlot = true;
  workTable.userData.role =
    'fixed-slotted-work-table-clearing-both-straight-band-runs';

  const upperBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.055, 10, 42),
    frameMaterial,
  );
  upperBearing.position.copy(upperWheelCenter);
  upperBearing.position.z = -0.25;
  upperBearing.userData.axis = Z_AXIS.clone();
  upperBearing.userData.role = 'fixed-upper-wheel-bearing';
  const lowerBearing = upperBearing.clone();
  lowerBearing.position.copy(lowerWheelCenter);
  lowerBearing.position.z = -0.25;
  lowerBearing.userData.role = 'fixed-lower-wheel-bearing';
  const upperShaft = cylinderAlongZ(0.07, 0.95, inkMaterial, 34);
  upperShaft.position.copy(upperWheelCenter);
  upperShaft.userData.axis = Z_AXIS.clone();
  upperShaft.userData.role = 'fixed-axis-upper-wheel-shaft';
  const lowerShaft = cylinderAlongZ(0.078, 1.05, inkMaterial, 34);
  lowerShaft.position.copy(lowerWheelCenter);
  lowerShaft.userData.axis = Z_AXIS.clone();
  lowerShaft.userData.role = 'input-shaft-through-lower-driving-wheel';
  fixedFrame.add(
    frameBase,
    frameColumn,
    lowerBearingPost,
    tablePost,
    tableBrace,
    workTable,
    upperBearing,
    lowerBearing,
    upperShaft,
    lowerShaft,
  );

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(6.55, 6.25, 0.01),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(-0.72, 1.7, -0.92);
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.noShadow = true;
  cameraEnvelope.userData.role = 'invisible-complete-band-saw-envelope';
  root.add(
    cameraEnvelope,
    fixedFrame,
    lowerWheel,
    upperWheel,
    sawBand,
  );

  const contactDefinitions = [
    {
      distance: 0,
      radial: new THREE.Vector3(wheelPitchRadius, 0, 0),
      role: 'upper-right-cutting-run-contact',
      wheel: 'upper',
    },
    {
      distance: straightRunLength,
      radial: new THREE.Vector3(wheelPitchRadius, 0, 0),
      role: 'lower-right-cutting-run-contact',
      wheel: 'lower',
    },
    {
      distance: straightRunLength + halfWrapLength,
      radial: new THREE.Vector3(-wheelPitchRadius, 0, 0),
      role: 'lower-left-return-run-contact',
      wheel: 'lower',
    },
    {
      distance: straightRunLength * 2 + halfWrapLength,
      radial: new THREE.Vector3(-wheelPitchRadius, 0, 0),
      role: 'upper-left-return-run-contact',
      wheel: 'upper',
    },
  ];

  const contactState = (definition, state) => {
    const angularSpeed = definition.wheel === 'lower'
      ? state.driverAngularSpeed
      : state.drivenAngularSpeed;
    const center = definition.wheel === 'lower'
      ? lowerWheelCenter
      : upperWheelCenter;
    const contactPoint = center.clone().add(definition.radial);
    const surfaceVelocity = new THREE.Vector3().crossVectors(
      Z_AXIS.clone().multiplyScalar(angularSpeed),
      definition.radial,
    );
    const bladeVelocity = bladePath.getTangentAtDistance(
      definition.distance,
    ).multiplyScalar(state.bladeLinearSpeed);
    return {
      bladeVelocity,
      contactPoint,
      noSlipVelocityError: surfaceVelocity.clone().sub(bladeVelocity),
      pitchRadius: wheelPitchRadius,
      radial: definition.radial.clone(),
      role: definition.role,
      surfaceVelocity,
      wheel: definition.wheel,
    };
  };

  const stateAtDriverKinematics = ({
    driverAngle,
    driverAngularAcceleration,
    driverAngularSpeed: inputAngularSpeed,
    time = null,
  }) => {
    const drivenAngle = driverAngle;
    const drivenAcceleration = driverAngularAcceleration;
    const drivenSpeed = inputAngularSpeed;
    const materialTravel = -wheelPitchRadius * driverAngle;
    const linearSpeed = -wheelPitchRadius * inputAngularSpeed;
    const linearAcceleration = -wheelPitchRadius
      * driverAngularAcceleration;
    const state = {
      bladeCircuitPhase: THREE.MathUtils.euclideanModulo(
        materialTravel / bladePathLength,
        1,
      ),
      bladeLinearAcceleration: linearAcceleration,
      bladeLinearSpeed: linearSpeed,
      bladePathLength,
      cuttingRunDirection: new THREE.Vector3(0, -1, 0),
      cuttingRunVelocity: new THREE.Vector3(0, -linearSpeed, 0),
      driverAngle,
      driverAngularAcceleration,
      driverAngularSpeed: inputAngularSpeed,
      drivenAngle,
      drivenAngularAcceleration: drivenAcceleration,
      drivenAngularSpeed: drivenSpeed,
      materialTravel,
      returnRunDirection: new THREE.Vector3(0, 1, 0),
      returnRunVelocity: new THREE.Vector3(0, linearSpeed, 0),
      stage: linearSpeed >= 0
        ? 'clockwise-wheels-drive-cutting-run-downward'
        : 'counterclockwise-wheels-drive-cutting-run-upward',
      time,
      wheelAngularRatio: 1,
    };
    state.contacts = Object.fromEntries(contactDefinitions.map(
      (definition) => [definition.role, contactState(definition, state)],
    ));
    return state;
  };
  const stateAtTime = (time) => stateAtDriverKinematics({
    driverAngle: driverAngularSpeed * time,
    driverAngularAcceleration: 0,
    driverAngularSpeed,
    time,
  });
  const materialDistanceAtTime = (time, materialOffset) => (
    THREE.MathUtils.euclideanModulo(
      materialOffset + stateAtTime(time).materialTravel,
      bladePathLength,
    )
  );
  const bladeMaterialPointAtTime = (time, materialOffset) => (
    bladePath.getPointAtDistance(materialDistanceAtTime(time, materialOffset))
  );
  const bladeMaterialVelocityAtDistance = (distance, linearSpeed) => (
    bladePath.getTangentAtDistance(distance).multiplyScalar(linearSpeed)
  );
  const bladeMaterialAccelerationAtDistance = (
    distance,
    linearSpeed,
    linearAcceleration = 0,
  ) => bladePath.getTangentAtDistance(distance)
    .multiplyScalar(linearAcceleration)
    .add(bladePath.getCurvatureVectorAtDistance(distance)
      .multiplyScalar(linearSpeed ** 2));

  root.userData.mechanism = 'equal-wheel-endless-band-saw-continuous-cutting-run';
  root.userData.cameraDistanceScale = 1.02;
  root.userData.blocks = {
    bladeIndexes,
    bladeRibbon,
    cameraEnvelope,
    fixedFrame,
    frameBase,
    frameColumn,
    lowerBearing,
    lowerBearingPost,
    lowerShaft,
    lowerWheel,
    sawBand,
    sawTeeth,
    tableBrace,
    tablePost,
    upperBearing,
    upperShaft,
    upperWheel,
    workTable,
  };
  root.userData.geometry = {
    bladeCircuitPeriod,
    bladeLinearSpeed,
    bladePath,
    bladePathLength,
    bladeThickness,
    bladeWidth,
    driverAngularSpeed,
    drivenAngularSpeed,
    frameBaseBottomY,
    frameBaseLeftX,
    frameBaseRightX,
    frameBaseTopY,
    fullTurn,
    halfWrapLength,
    indexToothCount,
    indexToothStride,
    leftBladeX,
    lowerWheelCenter,
    rightBladeX,
    sawToothCount,
    sawToothPitch,
    sourceFrameBaseBottomY,
    sourceFrameBaseLeftX,
    sourceFrameBaseRightX,
    sourceFrameBaseTopY,
    sourceLeftBladeX,
    sourceLowerWheelCenter,
    sourceRightBladeX,
    sourceScale,
    sourceSpokeCount,
    sourceTableBottomY,
    sourceTableLeftX,
    sourceTableRightX,
    sourceTableTopY,
    sourceUpperWheelCenter,
    sourceWheelPitchRadius,
    straightRunLength,
    tableBottomY,
    tableDepth,
    tableLeftX,
    tableRightX,
    tableReturnNotchRightX,
    tableSlotHalfX,
    tableSlotHalfZ,
    tableTopY,
    toothMaterialOffsets,
    toothProjection,
    upperWheelCenter,
    wheelAngularSpeedMagnitude,
    wheelCenterDistance,
    wheelContactRadius,
    wheelPitchRadius,
    wheelRotationPeriod,
    wheelWidth,
  };
  root.userData.bladeMaterialAccelerationAtDistance =
    bladeMaterialAccelerationAtDistance;
  root.userData.bladeMaterialPointAtTime = bladeMaterialPointAtTime;
  root.userData.bladeMaterialVelocityAtDistance =
    bladeMaterialVelocityAtDistance;
  root.userData.materialDistanceAtTime = materialDistanceAtTime;
  root.userData.stateAtDriverKinematics = stateAtDriverKinematics;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(lowerWheel, state.driverAngle);
    setSpin(upperWheel, state.drivenAngle);
    lowerWheel.userData.angularSpeed = state.driverAngularSpeed;
    upperWheel.userData.angularSpeed = state.drivenAngularSpeed;
    sawBand.userData.materialTravel = state.materialTravel;
    sawTeeth.forEach((tooth, index) => {
      const distance = materialDistanceAtTime(
        time,
        toothMaterialOffsets[index],
      );
      const point = bladePath.getPointAtDistance(distance);
      const tangent = bladePath.getTangentAtDistance(distance);
      tooth.position.copy(point);
      tooth.position.z += bladeWidth / 2;
      tooth.rotation.set(0, 0, Math.atan2(tangent.y, tangent.x));
      tooth.userData.materialDistance = distance;
      tooth.userData.velocity = tangent.clone().multiplyScalar(
        state.bladeLinearSpeed,
      );
      tooth.userData.acceleration =
        bladeMaterialAccelerationAtDistance(
          distance,
          state.bladeLinearSpeed,
          state.bladeLinearAcceleration,
        );
    });
    root.userData.contacts = state.contacts;
    root.userData.kinematics = state;
  };
  update(0);
  cameraEnvelope.castShadow = false;
  cameraEnvelope.receiveShadow = false;
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(6.8, 3.8, 12.5),
  };
}

// Sizes a finite chain rocked by a hoist stroke: the lowest tail index and
// highest head index whose end nodes stay at or below endMaximumY over the
// stroke (both legs hang straight down at linkPitch spacing).
function finiteHoistChainBounds(stateAtInputAngle, strokeAngle, linkPitch, endMaximumY, samples = 128) {
  let chainTailIndex = -Infinity;
  let chainHeadIndex = Infinity;
  for (let i = 0; i <= samples; i += 1) {
    const { nodes } = stateAtInputAngle(strokeAngle * Math.sin(2 * Math.PI * i / samples));
    const left = nodes.filter((node) => node.section === 'left').at(-1);
    const right = nodes.find((node) => node.section === 'right');
    chainTailIndex = Math.max(chainTailIndex,
      left.materialIndex + Math.max(0, Math.ceil((left.position.y - endMaximumY) / linkPitch - 1e-9)));
    chainHeadIndex = Math.min(chainHeadIndex,
      right.materialIndex - Math.max(0, Math.ceil((right.position.y - endMaximumY) / linkPitch - 1e-9)));
  }
  return { chainTailIndex, chainHeadIndex };
}

function alternatingPlaneLinkChainPulley(movement) {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const sourceScale = 0.4;
  const sourcePitchRadius = 5;
  const sourceLinkPitch = 2.58819;
  const sourceChainEndY = -15.529143;
  const sourceLinkHalfWidth = 0.3;
  const sourceJointRadius = 0.15;
  const sourceViewBox = Object.freeze({
    bottom: -9,
    height: 18,
    left: -9,
    top: 9,
    width: 18,
  });
  const sprocketToothCount = 6;
  const chainPositionsPerTurn = 12;
  const chainNodeStep = fullTurn / chainPositionsPerTurn;
  const toothStep = fullTurn / sprocketToothCount;
  const pitchRadius = sourcePitchRadius * sourceScale;
  const linkPitch = 2 * pitchRadius * Math.sin(chainNodeStep / 2);
  const sourceScaledLinkPitch = sourceLinkPitch * sourceScale;
  const wheelCenter = new THREE.Vector3(0, 0.38, 0);
  // Brown's teeth pass through the edge-on (perpendicular) links and stand
  // out beyond the chain, while the flat links lie on the arcs between
  // teeth; so each tooth is centred on a perpendicular link, one node step
  // on from the animation's flat-link phase.
  const toothCenterPhase = Math.PI / 4 + chainNodeStep;
  const toothRootRadius = (sourcePitchRadius - 2.28819) * sourceScale;
  const toothShoulderRadius = Math.hypot(2.287868, 4.117995)
    * sourceScale;
  const sourceToothTipCenterRadius = Math.hypot(1.674168, 6.248079);
  const toothTipRadius = (sourceToothTipCenterRadius + 0.2) * sourceScale;
  const sprocketDepth = 0.15;
  const linkLoopHalfWidth = sourceLinkHalfWidth * sourceScale * 1.25;
  const linkWireRadius = sourceLinkHalfWidth * sourceScale * 0.25;
  const chainTailLinkCount = 7;
  // The finite chain's two end links stay below this height (under the
  // plate's crop) throughout the hoist stroke.
  const chainEndMaximumY = -5.9;
  let chainTailIndex = null;
  let chainHeadIndex = null;
  const inputAngularSpeed = fullTurn / 4;
  const cyclePeriod = fullTurn / inputAngularSpeed;

  const centeredExtrusion = (shape, depth, bevelSize = 0.012) => {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize,
      bevelThickness: bevelSize,
      curveSegments: 28,
      depth,
      steps: 1,
    });
    geometry.translate(0, 0, -depth / 2);
    geometry.computeVertexNormals();
    return geometry;
  };

  const pointOnRadius = (angle, radius) => new THREE.Vector2(
    Math.cos(angle) * radius,
    Math.sin(angle) * radius,
  );
  // Brown's pulley is a round body with six concave-flanked teeth standing
  // out through the edge-on links; the flat links rest on the arcs between
  // them. This blank is replaced in correctChainDrive by the clean analytic
  // profile (cleanSprocketProfile227), whose notches hug the flat links' end
  // loops, which the tooth drives. (The animation's petals survive only as numbers.)
  const toothValleyRadius = 1.66;
  // Brown's teeth are broad-based with concave flanks; the offline sweep
  // trims this blank to clear the plate-link ends.
  const toothBaseHalfAngle = THREE.MathUtils.degToRad(25);
  const toothFlankControlHalfAngle = THREE.MathUtils.degToRad(17);
  const toothFlankControlRadius = 2.15;
  const sprocketShape = new THREE.Shape();
  for (let index = 0; index < sprocketToothCount; index += 1) {
    const centerAngle = toothCenterPhase + index * toothStep;
    const start = pointOnRadius(centerAngle - toothStep / 2, toothValleyRadius);
    const tip = pointOnRadius(centerAngle, toothTipRadius);
    const enteringControl = pointOnRadius(
      centerAngle - toothFlankControlHalfAngle,
      toothFlankControlRadius,
    );
    const leavingControl = pointOnRadius(
      centerAngle + toothFlankControlHalfAngle,
      toothFlankControlRadius,
    );
    const baseEnd = pointOnRadius(centerAngle + toothBaseHalfAngle, toothValleyRadius);
    if (index === 0) sprocketShape.moveTo(start.x, start.y);
    sprocketShape.absarc(0, 0, toothValleyRadius, centerAngle - toothStep / 2,
      centerAngle - toothBaseHalfAngle, false);
    sprocketShape.quadraticCurveTo(enteringControl.x, enteringControl.y, tip.x, tip.y);
    sprocketShape.quadraticCurveTo(leavingControl.x, leavingControl.y, baseEnd.x, baseEnd.y);
    sprocketShape.absarc(0, 0, toothValleyRadius, centerAngle + toothBaseHalfAngle,
      centerAngle + toothStep / 2, false);
  }
  sprocketShape.closePath();
  const shaftHoleRadius = 0.27;
  const shaftHole = new THREE.Path();
  shaftHole.absarc(0, 0, shaftHoleRadius, 0, fullTurn, true);
  sprocketShape.holes.push(shaftHole);

  const sprocketRotor = new THREE.Group();
  sprocketRotor.position.copy(wheelCenter);
  sprocketRotor.userData.axis = Z_AXIS.clone();
  sprocketRotor.userData.role = 'six-tooth-chain-pulley-rotor';
  const sprocket = new THREE.Mesh(
    centeredExtrusion(sprocketShape, sprocketDepth),
    matte(PALETTE.driver, { metalness: 0.14, roughness: 0.57 }),
  );
  sprocket.userData.axis = Z_AXIS.clone();
  sprocket.userData.pitchRadius = pitchRadius;
  sprocket.userData.role = 'source-profiled-six-tooth-chain-pulley';
  sprocket.userData.teeth = sprocketToothCount;
  sprocket.userData.toothCenterPhase = toothCenterPhase;
  sprocket.userData.toothDirections = Array.from(
    { length: sprocketToothCount },
    (_, index) => pointOnRadius(
      toothCenterPhase + index * toothStep,
      1,
    ),
  );

  const hubOuterRadius = 1.3 * sourceScale;
  const hubShape = new THREE.Shape();
  hubShape.absarc(0, 0, hubOuterRadius, 0, fullTurn, false);
  const hubHole = new THREE.Path();
  hubHole.absarc(0, 0, shaftHoleRadius, 0, fullTurn, true);
  hubShape.holes.push(hubHole);
  const hub = new THREE.Mesh(
    centeredExtrusion(hubShape, 0.34, 0.009),
    matte(PALETTE.ink, { metalness: 0.22, roughness: 0.5 }),
  );
  hub.userData.role = 'chain-pulley-annular-hub';
  sprocketRotor.add(sprocket, hub);

  const shaft = makeShaft({
    axis: Z_AXIS,
    color: PALETTE.ink,
    length: 1.45,
    radius: shaftHoleRadius * 0.72,
  });
  shaft.position.copy(wheelCenter);
  shaft.userData.role = 'chain-pulley-input-shaft';

  // Brown draws flat plate links. The links standing across the teeth are
  // flat loops whose rounded ends reach exactly to the joint centres, so
  // each end bar passes straight through a small round eye in the plate links
  // either side, which he draws as rivet dots.
  const makeLinkLoopGeometry = () => {
    const r = linkLoopHalfWidth;
    const topLeft = new THREE.Vector3(r, r, 0);
    const topRight = new THREE.Vector3(linkPitch - r, r, 0);
    const bottomRight = new THREE.Vector3(linkPitch - r, -r, 0);
    const bottomLeft = new THREE.Vector3(r, -r, 0);
    const path = new THREE.CurvePath();
    path.add(new THREE.LineCurve3(topLeft, topRight));
    path.add(new CircularArcCurve3(
      new THREE.Vector3(linkPitch - r, 0, 0),
      new THREE.Vector3(0, r, 0),
      Z_AXIS,
      -Math.PI,
    ));
    path.add(new THREE.LineCurve3(bottomRight, bottomLeft));
    path.add(new CircularArcCurve3(
      new THREE.Vector3(r, 0, 0),
      new THREE.Vector3(0, -r, 0),
      Z_AXIS,
      -Math.PI,
    ));
    const geometry = new THREE.TubeGeometry(
      path,
      72,
      linkWireRadius,
      9,
      true,
    );
    geometry.computeVertexNormals();
    return geometry;
  };
  const linkGeometry = makeLinkLoopGeometry();
  const chainMaterial = matte(PALETTE.belt, {
    metalness: 0.18,
    roughness: 0.5,
  });
  const chainMaterialAlternate = matte(0x427c98, {
    metalness: 0.18,
    roughness: 0.5,
  });
  // An even slot count keeps each slot's parity, and so its link plane and
  // geometry, fixed as the chain advances.
  // Covers the finite hoist chain (24 links; checked below).
  const maximumRenderedLinks = chainTailLinkCount * 2 + 10;
  const chain = new THREE.Group();
  chain.userData.alternatingLinkPlanes = true;
  chain.userData.role = 'one-articulated-alternating-plane-chain';
  // Links in the pulley plane are flat plates: a narrow round-ended bar
  // pierced at each joint by an eye just larger than the neighbouring loop's
  // end bar (whose centreline leans only 0.003 across the plate thickness).
  const plateLinkEndRadius = 0.12;
  const plateLinkEyeRadius = 0.048;
  const plateLinkShape = new THREE.Shape();
  plateLinkShape.absarc(linkPitch, 0, plateLinkEndRadius, -Math.PI / 2, Math.PI / 2, false);
  plateLinkShape.absarc(0, 0, plateLinkEndRadius, Math.PI / 2, 3 * Math.PI / 2, false);
  plateLinkShape.closePath();
  for (const x of [0, linkPitch]) {
    const eye = new THREE.Path();
    eye.absarc(x, 0, plateLinkEyeRadius, 0, fullTurn, true);
    plateLinkShape.holes.push(eye);
  }
  const plateLinkGeometry = new THREE.ExtrudeGeometry(plateLinkShape, {
    bevelEnabled: false, curveSegments: 40, depth: 2 * linkWireRadius, steps: 1,
  });
  plateLinkGeometry.translate(0, 0, -linkWireRadius);
  plateLinkGeometry.computeVertexNormals();
  const edgeOnStrapGeometry = new THREE.BoxGeometry(
    linkPitch - 2 * linkLoopHalfWidth, 2 * linkWireRadius, 2 * plateLinkEndRadius - 0.02);
  const links = Array.from({ length: maximumRenderedLinks }, (_, index) => {
    const material = index % 2 === 0 ? chainMaterial : chainMaterialAlternate;
    const link = new THREE.Mesh(
      index % 2 === 1 ? linkGeometry : plateLinkGeometry,
      material,
    );
    link.userData.chainLink = true;
    link.userData.renderSlot = index;
    link.userData.role = index % 2 === 1
      ? 'edge-on-flat-loop-link-across-tooth'
      : 'flat-plate-link-in-pulley-plane';
    if (index % 2 === 1) {
      // Brown draws the links across the teeth as strips as broad as the
      // plate links, not thin wires: the loop's two side bars are flat
      // straps standing radially (the tooth passes between them), while
      // the round end bars still pass through the plate links' eyes.
      for (const side of [-1, 1]) {
        const strap = new THREE.Mesh(edgeOnStrapGeometry, material);
        strap.position.set(linkPitch / 2, side * linkLoopHalfWidth, 0);
        strap.userData.role = 'edge-on-link-side-strap';
        link.add(strap);
      }
    }
    chain.add(link);
    return link;
  });

  const cameraEnvelopeMaterial = new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
    opacity: 0,
    transparent: true,
  });
  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(
      sourceViewBox.width * sourceScale,
      sourceViewBox.height * sourceScale,
      0.01,
    ),
    cameraEnvelopeMaterial,
  );
  cameraEnvelope.position.copy(wheelCenter);
  cameraEnvelope.position.y -= 0.3;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.noShadow = true;
  cameraEnvelope.userData.role = 'source-animation-view-envelope';
  root.add(cameraEnvelope, sprocketRotor, shaft, chain);

  const vectorForNode = (x, y) => new THREE.Vector3(
    wheelCenter.x + x,
    wheelCenter.y + y,
    0,
  );
  const normalizedPhase = (inputAngle) => {
    const rawStep = inputAngle / chainNodeStep;
    const nearestStep = Math.round(rawStep);
    if (Math.abs(rawStep - nearestStep) < 2e-12) {
      return { phase: 0, stepIndex: nearestStep };
    }
    const stepIndex = Math.floor(rawStep);
    return {
      phase: inputAngle - stepIndex * chainNodeStep,
      stepIndex,
    };
  };
  const velocityAtNode = (
    section,
    point,
    sprocketAngularSpeed,
    chainLinearSpeed,
  ) => {
    if (section === 'arc') {
      return new THREE.Vector3().crossVectors(
        Z_AXIS.clone().multiplyScalar(sprocketAngularSpeed),
        point.clone().sub(wheelCenter),
      );
    }
    return new THREE.Vector3(
      0,
      section === 'left' ? chainLinearSpeed : -chainLinearSpeed,
      0,
    );
  };
  const stateAtInputAngle = (
    inputAngle,
    angularSpeed = inputAngularSpeed,
  ) => {
    const { phase, stepIndex } = normalizedPhase(inputAngle);
    const maximumCircleIndex = stepIndex + 6;
    const minimumCircleIndex = stepIndex + 1;
    const leftCircleAngle = maximumCircleIndex * chainNodeStep - inputAngle;
    const leftCircleX = pitchRadius * Math.cos(leftCircleAngle);
    const leftCircleY = pitchRadius * Math.sin(leftCircleAngle);
    const leftHorizontalReach = leftCircleX + pitchRadius;
    const leftVerticalReach = Math.sqrt(Math.max(
      0,
      linkPitch ** 2 - leftHorizontalReach ** 2,
    ));
    const leftPreviousY = leftCircleY - leftVerticalReach;
    const chordalVelocityFactor = pitchRadius * Math.cos(phase)
      + leftHorizontalReach * pitchRadius * Math.sin(phase)
        / Math.max(leftVerticalReach, 1e-12);
    const chainLinearSpeed = angularSpeed * chordalVelocityFactor;
    const sprocketAngularSpeed = -angularSpeed;
    const nodes = [];
    for (
      let offset = chainTailIndex === null
        ? chainTailLinkCount
        : chainTailIndex - (maximumCircleIndex + 1);
      offset >= 0;
      offset -= 1
    ) {
      nodes.push({
        materialIndex: maximumCircleIndex + 1 + offset,
        position: vectorForNode(
          -pitchRadius,
          leftPreviousY - offset * linkPitch,
        ),
        section: 'left',
      });
    }
    for (
      let materialIndex = maximumCircleIndex;
      materialIndex >= minimumCircleIndex;
      materialIndex -= 1
    ) {
      const angle = materialIndex * chainNodeStep - inputAngle;
      nodes.push({
        angle,
        materialIndex,
        position: vectorForNode(
          pitchRadius * Math.cos(angle),
          pitchRadius * Math.sin(angle),
        ),
        section: 'arc',
      });
    }
    const rightCircleNode = nodes.at(-1);
    const rightHorizontalReach = pitchRadius
      - (rightCircleNode.position.x - wheelCenter.x);
    const rightVerticalReach = Math.sqrt(Math.max(
      0,
      linkPitch ** 2 - rightHorizontalReach ** 2,
    ));
    const rightFirstY = rightCircleNode.position.y
      - wheelCenter.y
      - rightVerticalReach;
    for (
      let offset = 0;
      chainHeadIndex === null
        ? offset < chainTailLinkCount + 1
        : minimumCircleIndex - 1 - offset >= chainHeadIndex;
      offset += 1
    ) {
      nodes.push({
        materialIndex: minimumCircleIndex - 1 - offset,
        position: vectorForNode(
          pitchRadius,
          rightFirstY - offset * linkPitch,
        ),
        section: 'right',
      });
    }
    nodes.forEach((node) => {
      node.velocity = velocityAtNode(
        node.section,
        node.position,
        sprocketAngularSpeed,
        chainLinearSpeed,
      );
    });
    const chainLinks = nodes.slice(0, -1).map((start, index) => {
      const end = nodes[index + 1];
      const chord = end.position.clone().sub(start.position);
      const center = start.position.clone().add(end.position)
        .multiplyScalar(0.5);
      const materialIndex = start.materialIndex;
      const perpendicularPlane = Math.abs(materialIndex % 2) === 1;
      const planeNormal = perpendicularPlane
        ? new THREE.Vector3(
          Math.sin(Math.atan2(chord.y, chord.x)),
          -Math.cos(Math.atan2(chord.y, chord.x)),
          0,
        )
        : Z_AXIS.clone();
      return {
        angle: Math.atan2(chord.y, chord.x),
        center,
        chord,
        end,
        length: chord.length(),
        materialIndex,
        plane: perpendicularPlane
          ? 'perpendicular-to-sprocket'
          : 'coplanar-with-sprocket',
        planeNormal,
        start,
        visible: true,
      };
    });
    const sprocketAngle = -inputAngle;
    const toothAngles = Array.from(
      { length: sprocketToothCount },
      (_, index) => toothCenterPhase + index * toothStep + sprocketAngle,
    );
    const engagements = chainLinks
      .filter((link) => (
        link.start.section === 'arc'
        && link.end.section === 'arc'
        && Math.abs(link.materialIndex % 2) === 1
      ))
      .map((link) => {
        const radial = link.center.clone().sub(wheelCenter);
        const linkCenterAngle = Math.atan2(radial.y, radial.x);
        const rawToothIndex = Math.round(
          (linkCenterAngle - toothCenterPhase - sprocketAngle) / toothStep,
        );
        const toothIndex = THREE.MathUtils.euclideanModulo(
          rawToothIndex,
          sprocketToothCount,
        );
        const toothAngle = toothCenterPhase
          + rawToothIndex * toothStep
          + sprocketAngle;
        const chainVelocity = link.start.velocity.clone()
          .add(link.end.velocity)
          .multiplyScalar(0.5);
        const sprocketVelocity = new THREE.Vector3().crossVectors(
          Z_AXIS.clone().multiplyScalar(sprocketAngularSpeed),
          radial,
        );
        return {
          chainVelocity,
          contactPoint: link.center.clone(),
          linkCenterAngle,
          linkMaterialIndex: link.materialIndex,
          noSlipVelocityError: chainVelocity.clone().sub(sprocketVelocity),
          phaseError: THREE.MathUtils.euclideanModulo(
            linkCenterAngle - toothAngle + Math.PI,
            fullTurn,
          ) - Math.PI,
          sprocketVelocity,
          toothAngle,
          toothIndex,
        };
      });
    return {
      chainAdvance: stepIndex * linkPitch + leftPreviousY + linkPitch,
      chainLinearSpeed,
      chainLinks,
      chordalVelocityFactor,
      engagements,
      inputAngle,
      inputAngularSpeed: angularSpeed,
      materialStepIndex: stepIndex,
      nodes,
      phaseWithinOneLink: phase,
      sprocketAngle,
      sprocketAngularSpeed,
      toothAngles,
    };
  };
  // Brown's two legs run off the plate. A finite chain cannot loop on a
  // wheel turning one way, and an endless one would have to recycle links
  // somewhere, so the wheel rocks the chain like a hoist: from Brown's pose
  // it turns hoistStrokePitches links each way on a sine stroke. The chain
  // is one fixed set of whole links whose two ends stay below the plate's
  // crop over the whole stroke (finiteHoistChainBounds).
  const hoistStrokePitches = 2;
  const hoistStrokeAngle = hoistStrokePitches * chainNodeStep;
  ({ chainTailIndex, chainHeadIndex } = finiteHoistChainBounds(
    stateAtInputAngle, hoistStrokeAngle, linkPitch, chainEndMaximumY));
  if (chainTailIndex - chainHeadIndex > maximumRenderedLinks) {
    throw new RangeError(`Movement 227 finite chain (${chainTailIndex - chainHeadIndex} links) exceeds its rendered links.`);
  }
  const stateAtTime = (time) => stateAtInputAngle(
    hoistStrokeAngle * Math.sin(fullTurn * time / cyclePeriod),
    hoistStrokeAngle * Math.cos(fullTurn * time / cyclePeriod) * fullTurn / cyclePeriod,
  );

  root.userData.mechanism = 'six-tooth-alternating-plane-link-chain-pulley';
  root.userData.archetype = 'six-tooth-alternating-plane-link-chain-pulley';
  root.userData.blocks = {
    cameraEnvelope,
    chain,
    hub,
    links,
    shaft,
    sprocket,
    sprocketRotor,
  };
  root.userData.geometry = {
    chainNodeStep,
    chainPositionsPerTurn,
    chainTailLinkCount,
    cyclePeriod,
    fullTurn,
    hubOuterRadius,
    inputAngularSpeed,
    linkLoopHalfWidth,
    linkPitch,
    linkWireRadius,
    pitchRadius,
    plateLinkEndRadius,
    plateLinkEyeRadius,
    shaftHoleRadius,
    sourceChainEndY,
    sourceLinkHalfWidth,
    sourceLinkPitch,
    sourceScaledLinkPitch,
    sourceScale,
    sourceToothTipCenterRadius,
    sprocketDepth,
    sprocketToothCount,
    toothCenterPhase,
    toothRootRadius,
    toothShoulderRadius,
    toothStep,
    toothTipRadius,
    chainEndMaximumY,
    chainHeadIndex,
    chainTailIndex,
    hoistStrokeAngle,
    hoistStrokePitches,
    wheelCenter,
  };
  root.userData.sourceAnimation = {
    available: true,
    chainPositionsPerPulleyTurn: 12,
    cyclesPerMinute: 15,
    linkEnd: [2.58819, 0],
    linkStartTracks: [
      [[-5, -15.529143], [-4, -15.529143]],
      [[-5, -12.940952], [-4, -12.940952]],
    ],
    pulleyPitchCircle: { center: [0, 0], radius: 5 },
    sourceProfileSegmentCount: 36,
    viewBox: sourceViewBox,
  };
  root.userData.sourceReference = {
    plate227: {
      chainLeavesFrameAtBothLowerEdges: true,
      pulleyToothCount: 6,
      shownChainPlanes: 'alternating',
      visibleUpperWrap: 'approximately-one-half-turn',
    },
  };
  root.userData.transmission = {
    chainLinksAdvancedPerPulleyTurn: chainPositionsPerTurn,
    chainPitchPolygonSides: chainPositionsPerTurn,
    chainTravelPerPulleyTurn: chainPositionsPerTurn * linkPitch,
    chordalActionIncluded: true,
    engagedLinkParity: 0,
    pulleyTeeth: sprocketToothCount,
    toothAdvanceInLinks: chainPositionsPerTurn / sprocketToothCount,
  };
  root.userData.stateAtInputAngle = stateAtInputAngle;
  root.userData.stateAtTime = stateAtTime;

  const alternatePlane = new THREE.Quaternion().setFromAxisAngle(
    X_AXIS,
    Math.PI / 2,
  );
  const linkAlignment = new THREE.Quaternion();
  const update = (time) => {
    const state = stateAtTime(time);
    sprocketRotor.rotation.z = state.sprocketAngle;
    links.forEach((object) => {
      object.visible = false;
      object.userData.materialIndex = null;
      object.userData.stateIndex = null;
    });
    state.chainLinks.forEach((link, stateIndex) => {
      const renderSlot = THREE.MathUtils.euclideanModulo(
        link.materialIndex,
        maximumRenderedLinks,
      );
      const object = links[renderSlot];
      object.visible = link.visible;
      object.position.copy(link.start.position);
      object.material = Math.abs(link.materialIndex % 2) === 0
        ? chainMaterial
        : chainMaterialAlternate;
      for (const strap of object.children) strap.material = object.material;
      linkAlignment.setFromAxisAngle(Z_AXIS, link.angle);
      object.quaternion.copy(linkAlignment);
      if (link.plane === 'perpendicular-to-sprocket') {
        object.quaternion.multiply(alternatePlane);
      }
      object.userData.currentLength = link.length;
      object.userData.materialIndex = link.materialIndex;
      object.userData.plane = link.plane;
      object.userData.planeNormal = link.planeNormal.clone();
      object.userData.stateIndex = stateIndex;
      object.userData.startPosition = link.start.position.clone();
      object.userData.endPosition = link.end.position.clone();
    });
    sprocketRotor.userData.angularSpeed = state.sprocketAngularSpeed;
    chain.userData.chainAdvance = state.chainAdvance;
    chain.userData.linearSpeed = state.chainLinearSpeed;
    root.userData.contacts = {
      engagedLinks: state.engagements,
    };
    root.userData.kinematics = state;
  };
  update(0);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(5.2, 3.4, 11.5),
  };
}

function ladderRungChainPulley() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const pulleyPitchCount = 12;
  const chainNodeStep = fullTurn / pulleyPitchCount;
  const upperWrapPitchCount = pulleyPitchCount / 2;
  const pitchRadius = 2.05;
  const linkPitch = 2 * pitchRadius * Math.sin(chainNodeStep / 2);
  const wheelCenter = new THREE.Vector3(0, 0.68, 0);
  // Brown's disc reaches almost to the rungs and is a broad drum: its front
  // face meets the front side links, so the rungs lie across its rim, which
  // carries the slender wedges standing proud of it between them; the
  // wedges' roots are buried in it. The drum faces stop just inside the
  // side-link wires.
  const diskRadius = 1.95;
  const diskDepth = 0.76;
  const toothRootRadius = 1.68;
  const toothTipRadius = 2.17;
  // Tent-shaped wedges about half the rung length, not broad cogs.
  const toothDepth = 0.45;
  const toothCenterPhase = chainNodeStep / 2;
  const hubRadius = 0.39;
  const hubDepth = 0.9;
  const shaftRadius = 0.14;
  const shaftLength = 1.75;
  const sidePlaneOffset = 0.48;
  const sidePlaneAlternation = 0.042;
  const sideLinkHalfWidth = 0.096;
  const sideLinkWireRadius = 0.038;
  const rungRadius = 0.055;
  const rungLength = 1.18;
  // Tail sections of Brown's plate window (the finite chain is sized by
  // finiteHoistChainBounds below).
  const chainTailLinkCount = 10;
  const maximumRenderedSections = chainTailLinkCount * 2 + 8;
  // The finite chain's two end sections stay below this height (under the
  // plate's crop) throughout the hoist stroke.
  const chainEndMaximumY = -7.4;
  let chainTailIndex = null;
  let chainHeadIndex = null;
  const inputAngularSpeed = fullTurn / 4;
  const cyclePeriod = fullTurn / inputAngularSpeed;

  const centeredExtrusion = (shape, depth, bevelSize = 0.012) => {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize,
      bevelThickness: bevelSize,
      curveSegments: 20,
      depth,
      steps: 1,
    });
    geometry.translate(0, 0, -depth / 2);
    geometry.computeVertexNormals();
    return geometry;
  };
  const pointOnRadius = (angle, radius) => new THREE.Vector2(
    Math.cos(angle) * radius,
    Math.sin(angle) * radius,
  );

  const sprocketRotor = new THREE.Group();
  sprocketRotor.position.copy(wheelCenter);
  sprocketRotor.userData.axis = Z_AXIS.clone();
  sprocketRotor.userData.pitches = pulleyPitchCount;
  sprocketRotor.userData.role = 'twelve-pitch-ladder-chain-pulley-rotor';

  const diskGeometry = new THREE.CylinderGeometry(
    diskRadius,
    diskRadius,
    diskDepth,
    72,
  );
  diskGeometry.rotateX(Math.PI / 2);
  diskGeometry.computeVertexNormals();
  const disk = new THREE.Mesh(
    diskGeometry,
    matte(PALETTE.driver, { metalness: 0.13, roughness: 0.58 }),
  );
  disk.userData.axis = Z_AXIS.clone();
  disk.userData.pitchRadius = pitchRadius;
  disk.userData.rungPockets = pulleyPitchCount;
  disk.userData.role = 'broad-solid-ladder-chain-pulley-disk';

  const toothRootHalfAngle = chainNodeStep * 0.32;
  const toothTipHalfAngle = chainNodeStep * 0.13;
  const toothShape = new THREE.Shape();
  const toothRootLower = pointOnRadius(-toothRootHalfAngle, toothRootRadius);
  const toothTipLower = pointOnRadius(-toothTipHalfAngle, toothTipRadius);
  const toothTipUpper = pointOnRadius(toothTipHalfAngle, toothTipRadius);
  const toothRootUpper = pointOnRadius(toothRootHalfAngle, toothRootRadius);
  toothShape.moveTo(toothRootLower.x, toothRootLower.y);
  toothShape.lineTo(toothTipLower.x, toothTipLower.y);
  toothShape.lineTo(toothTipUpper.x, toothTipUpper.y);
  toothShape.lineTo(toothRootUpper.x, toothRootUpper.y);
  toothShape.closePath();
  const toothGeometry = centeredExtrusion(toothShape, toothDepth, 0.009);
  const toothMaterial = matte(0xc34d2b, {
    metalness: 0.16,
    roughness: 0.52,
  });
  const teeth = Array.from({ length: pulleyPitchCount }, (_, index) => {
    const tooth = new THREE.Mesh(toothGeometry, toothMaterial);
    tooth.rotation.z = toothCenterPhase + index * chainNodeStep;
    tooth.userData.index = index;
    tooth.userData.role = 'ladder-chain-rung-separating-tooth';
    sprocketRotor.add(tooth);
    return tooth;
  });

  const hubGeometry = new THREE.CylinderGeometry(
    hubRadius,
    hubRadius,
    hubDepth,
    40,
  );
  hubGeometry.rotateX(Math.PI / 2);
  const hub = new THREE.Mesh(
    hubGeometry,
    matte(PALETTE.ink, { metalness: 0.24, roughness: 0.48 }),
  );
  hub.userData.axis = Z_AXIS.clone();
  hub.userData.role = 'ladder-chain-pulley-hub';
  sprocketRotor.add(disk, hub);

  const shaft = makeShaft({
    axis: Z_AXIS,
    color: PALETTE.ink,
    length: shaftLength,
    radius: shaftRadius,
  });
  shaft.position.copy(wheelCenter);
  shaft.userData.role = 'ladder-chain-pulley-shaft';

  const sideLinkPath = new THREE.CurvePath();
  const topLeft = new THREE.Vector3(0, sideLinkHalfWidth, 0);
  const topRight = new THREE.Vector3(linkPitch, sideLinkHalfWidth, 0);
  const bottomRight = new THREE.Vector3(linkPitch, -sideLinkHalfWidth, 0);
  const bottomLeft = new THREE.Vector3(0, -sideLinkHalfWidth, 0);
  sideLinkPath.add(new THREE.LineCurve3(topLeft, topRight));
  sideLinkPath.add(new CircularArcCurve3(
    new THREE.Vector3(linkPitch, 0, 0),
    new THREE.Vector3(0, sideLinkHalfWidth, 0),
    Z_AXIS,
    -Math.PI,
  ));
  sideLinkPath.add(new THREE.LineCurve3(bottomRight, bottomLeft));
  sideLinkPath.add(new CircularArcCurve3(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, -sideLinkHalfWidth, 0),
    Z_AXIS,
    -Math.PI,
  ));
  const sideLinkGeometry = new THREE.TubeGeometry(
    sideLinkPath,
    52,
    sideLinkWireRadius,
    9,
    true,
  );
  sideLinkGeometry.computeVertexNormals();
  const rungGeometry = new THREE.CylinderGeometry(
    rungRadius,
    rungRadius,
    rungLength,
    18,
  );
  rungGeometry.rotateX(Math.PI / 2);
  rungGeometry.computeVertexNormals();
  const sideLinkMaterial = matte(PALETTE.belt, {
    metalness: 0.2,
    roughness: 0.47,
  });
  const sideLinkMaterialAlternate = matte(0x397994, {
    metalness: 0.2,
    roughness: 0.47,
  });
  const rungMaterial = matte(0x78909a, {
    metalness: 0.36,
    roughness: 0.4,
  });
  const chain = new THREE.Group();
  chain.userData.hasTransverseRungs = true;
  chain.userData.parallelSideLinkRows = 2;
  chain.userData.role = 'one-articulated-ladder-rung-chain';
  const sideLinks = [];
  const rungs = [];
  const sections = Array.from(
    { length: maximumRenderedSections },
    (_, index) => {
      const section = new THREE.Group();
      const rearSideLink = new THREE.Mesh(
        sideLinkGeometry,
        index % 2 === 0
          ? sideLinkMaterial
          : sideLinkMaterialAlternate,
      );
      const frontSideLink = new THREE.Mesh(
        sideLinkGeometry,
        index % 2 === 0
          ? sideLinkMaterial
          : sideLinkMaterialAlternate,
      );
      const rung = new THREE.Mesh(rungGeometry, rungMaterial);
      rearSideLink.userData.side = 'rear';
      frontSideLink.userData.side = 'front';
      rung.userData.axis = Z_AXIS.clone();
      rung.userData.transverseRung = true;
      section.userData.chainSection = true;
      section.userData.renderSlot = index;
      section.userData.sideLinks = [rearSideLink, frontSideLink];
      section.userData.rung = rung;
      section.add(rearSideLink, frontSideLink, rung);
      sideLinks.push(rearSideLink, frontSideLink);
      rungs.push(rung);
      chain.add(section);
      return section;
    },
  );

  const cameraEnvelopeMaterial = new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
    opacity: 0,
    transparent: true,
  });
  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(6.9, 7.45, 0.01),
    cameraEnvelopeMaterial,
  );
  cameraEnvelope.position.set(wheelCenter.x, 0.1, wheelCenter.z);
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.noShadow = true;
  cameraEnvelope.userData.role = 'plate-228-camera-envelope';
  root.add(cameraEnvelope, sprocketRotor, shaft, chain);

  const vectorForNode = (x, y) => new THREE.Vector3(
    wheelCenter.x + x,
    wheelCenter.y + y,
    0,
  );
  const normalizedPhase = (inputAngle) => {
    const rawStep = inputAngle / chainNodeStep;
    const nearestStep = Math.round(rawStep);
    if (Math.abs(rawStep - nearestStep) < 2e-12) {
      return { phase: 0, stepIndex: nearestStep };
    }
    const stepIndex = Math.floor(rawStep);
    return {
      phase: inputAngle - stepIndex * chainNodeStep,
      stepIndex,
    };
  };
  const velocityAtNode = (
    section,
    point,
    sprocketAngularSpeed,
    chainLinearSpeed,
  ) => {
    if (section === 'arc') {
      return new THREE.Vector3().crossVectors(
        Z_AXIS.clone().multiplyScalar(sprocketAngularSpeed),
        point.clone().sub(wheelCenter),
      );
    }
    return new THREE.Vector3(
      0,
      section === 'left' ? chainLinearSpeed : -chainLinearSpeed,
      0,
    );
  };
  const stateAtInputAngle = (
    inputAngle,
    angularSpeed = inputAngularSpeed,
  ) => {
    const { phase, stepIndex } = normalizedPhase(inputAngle);
    const maximumCircleIndex = stepIndex + upperWrapPitchCount;
    const minimumCircleIndex = stepIndex + 1;
    const leftCircleAngle = maximumCircleIndex * chainNodeStep - inputAngle;
    const leftCircleX = pitchRadius * Math.cos(leftCircleAngle);
    const leftCircleY = pitchRadius * Math.sin(leftCircleAngle);
    const leftHorizontalReach = leftCircleX + pitchRadius;
    const leftVerticalReach = Math.sqrt(Math.max(
      0,
      linkPitch ** 2 - leftHorizontalReach ** 2,
    ));
    const leftPreviousY = leftCircleY - leftVerticalReach;
    const chordalVelocityFactor = pitchRadius * Math.cos(phase)
      + leftHorizontalReach * pitchRadius * Math.sin(phase)
        / Math.max(leftVerticalReach, 1e-12);
    const chainLinearSpeed = angularSpeed * chordalVelocityFactor;
    const sprocketAngularSpeed = -angularSpeed;
    const nodes = [];
    for (
      let offset = chainTailIndex === null
        ? chainTailLinkCount
        : chainTailIndex - (maximumCircleIndex + 1);
      offset >= 0;
      offset -= 1
    ) {
      nodes.push({
        materialIndex: maximumCircleIndex + 1 + offset,
        position: vectorForNode(
          -pitchRadius,
          leftPreviousY - offset * linkPitch,
        ),
        section: 'left',
      });
    }
    for (
      let materialIndex = maximumCircleIndex;
      materialIndex >= minimumCircleIndex;
      materialIndex -= 1
    ) {
      const angle = materialIndex * chainNodeStep - inputAngle;
      nodes.push({
        angle,
        materialIndex,
        position: vectorForNode(
          pitchRadius * Math.cos(angle),
          pitchRadius * Math.sin(angle),
        ),
        section: 'arc',
      });
    }
    const rightCircleNode = nodes.at(-1);
    const rightHorizontalReach = pitchRadius
      - (rightCircleNode.position.x - wheelCenter.x);
    const rightVerticalReach = Math.sqrt(Math.max(
      0,
      linkPitch ** 2 - rightHorizontalReach ** 2,
    ));
    const rightFirstY = rightCircleNode.position.y
      - wheelCenter.y
      - rightVerticalReach;
    for (
      let offset = 0;
      chainHeadIndex === null
        ? offset < chainTailLinkCount + 1
        : minimumCircleIndex - 1 - offset >= chainHeadIndex;
      offset += 1
    ) {
      nodes.push({
        materialIndex: minimumCircleIndex - 1 - offset,
        position: vectorForNode(
          pitchRadius,
          rightFirstY - offset * linkPitch,
        ),
        section: 'right',
      });
    }
    nodes.forEach((node) => {
      node.velocity = velocityAtNode(
        node.section,
        node.position,
        sprocketAngularSpeed,
        chainLinearSpeed,
      );
    });
    const chainSections = nodes.slice(0, -1).map((start, index) => {
      const end = nodes[index + 1];
      const chord = end.position.clone().sub(start.position);
      return {
        angle: Math.atan2(chord.y, chord.x),
        center: start.position.clone().add(end.position).multiplyScalar(0.5),
        chord,
        end,
        length: chord.length(),
        materialIndex: start.materialIndex,
        sideLinkPlaneNormal: Z_AXIS.clone(),
        start,
        visible: true,
      };
    });
    const sprocketAngle = -inputAngle;
    const pocketAngles = Array.from(
      { length: pulleyPitchCount },
      (_, index) => index * chainNodeStep + sprocketAngle,
    );
    const toothAngles = pocketAngles.map((angle) => angle + toothCenterPhase);
    const engagements = nodes
      .filter((node) => node.section === 'arc')
      .map((node) => {
        const radial = node.position.clone().sub(wheelCenter);
        const rungAngle = Math.atan2(radial.y, radial.x);
        const rawPocketIndex = Math.round(
          (rungAngle - sprocketAngle) / chainNodeStep,
        );
        const pocketIndex = THREE.MathUtils.euclideanModulo(
          rawPocketIndex,
          pulleyPitchCount,
        );
        const pocketAngle = rawPocketIndex * chainNodeStep + sprocketAngle;
        const sprocketVelocity = new THREE.Vector3().crossVectors(
          Z_AXIS.clone().multiplyScalar(sprocketAngularSpeed),
          radial,
        );
        return {
          chainVelocity: node.velocity.clone(),
          contactPoint: node.position.clone(),
          noSlipVelocityError: node.velocity.clone().sub(sprocketVelocity),
          phaseError: THREE.MathUtils.euclideanModulo(
            rungAngle - pocketAngle + Math.PI,
            fullTurn,
          ) - Math.PI,
          pocketAngle,
          pocketIndex,
          rungAngle,
          rungMaterialIndex: node.materialIndex,
          sprocketVelocity,
        };
      });
    return {
      chainAdvance: stepIndex * linkPitch + leftPreviousY + linkPitch,
      chainLinearSpeed,
      chainSections,
      chordalVelocityFactor,
      engagements,
      inputAngle,
      inputAngularSpeed: angularSpeed,
      materialStepIndex: stepIndex,
      nodes,
      phaseWithinOneLink: phase,
      pocketAngles,
      sprocketAngle,
      sprocketAngularSpeed,
      toothAngles,
    };
  };
  // As on 227, Brown's two legs run off the plate. A finite chain cannot loop on a
  // wheel turning one way, and an endless one would have to recycle links
  // somewhere, so the wheel rocks the chain like a hoist: from Brown's pose
  // it turns hoistStrokePitches links each way on a sine stroke. The chain
  // is one fixed set of whole links whose two ends stay below the plate's
  // crop over the whole stroke (finiteHoistChainBounds).
  const hoistStrokePitches = 2;
  const hoistStrokeAngle = hoistStrokePitches * chainNodeStep;
  ({ chainTailIndex, chainHeadIndex } = finiteHoistChainBounds(
    stateAtInputAngle, hoistStrokeAngle, linkPitch, chainEndMaximumY));
  if (chainTailIndex - chainHeadIndex > maximumRenderedSections) {
    throw new RangeError(`Movement 228 finite chain (${chainTailIndex - chainHeadIndex} sections) exceeds its rendered sections.`);
  }
  const stateAtTime = (time) => stateAtInputAngle(
    hoistStrokeAngle * Math.sin(fullTurn * time / cyclePeriod),
    hoistStrokeAngle * Math.cos(fullTurn * time / cyclePeriod) * fullTurn / cyclePeriod,
  );

  root.userData.mechanism = 'twelve-pitch-ladder-rung-chain-pulley';
  root.userData.archetype = 'twelve-pitch-ladder-rung-chain-pulley';
  root.userData.blocks = {
    cameraEnvelope,
    chain,
    disk,
    hub,
    rungs,
    sections,
    shaft,
    sideLinks,
    sprocketRotor,
    teeth,
  };
  root.userData.geometry = {
    chainNodeStep,
    chainTailLinkCount,
    cyclePeriod,
    diskDepth,
    diskRadius,
    fullTurn,
    hubDepth,
    hubRadius,
    inputAngularSpeed,
    linkPitch,
    maximumRenderedSections,
    pitchRadius,
    pulleyPitchCount,
    rungLength,
    rungRadius,
    shaftLength,
    shaftRadius,
    sideLinkHalfWidth,
    sideLinkWireRadius,
    sidePlaneAlternation,
    sidePlaneOffset,
    toothCenterPhase,
    toothDepth,
    toothRootHalfAngle,
    toothRootRadius,
    toothTipHalfAngle,
    toothTipRadius,
    upperWrapPitchCount,
    chainEndMaximumY,
    chainHeadIndex,
    chainTailIndex,
    hoistStrokeAngle,
    hoistStrokePitches,
    wheelCenter,
  };
  root.userData.sourceAnimation = {
    available: false,
    officialPageHasCanvasAnimation: false,
  };
  root.userData.sourceReference = {
    plate228: {
      chainConstruction: 'two parallel side-link rows with transverse rungs',
      chainLeavesFrameAtBothLowerEdges: true,
      inferredPulleyPitchCount: 12,
      rearRungSeparatingTeethVisible: true,
      solidPulleyFace: true,
      visibleUpperWrapRungIntervals: 6,
    },
  };
  root.userData.transmission = {
    chainPitchPolygonSides: pulleyPitchCount,
    chainTravelPerPulleyTurn: pulleyPitchCount * linkPitch,
    chordalActionIncluded: true,
    pulleyPitches: pulleyPitchCount,
    rungsAdvancedPerPulleyTurn: pulleyPitchCount,
    toothAdvanceInRungs: 1,
  };
  root.userData.stateAtInputAngle = stateAtInputAngle;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    sprocketRotor.rotation.z = state.sprocketAngle;
    sections.forEach((object) => {
      object.visible = false;
    });
    state.chainSections.forEach((link, stateIndex) => {
      const renderSlot = THREE.MathUtils.euclideanModulo(
        link.materialIndex,
        maximumRenderedSections,
      );
      const object = sections[renderSlot];
      object.visible = link.visible;
      const parity = Math.abs(link.materialIndex % 2);
      const sideOffset = parity === 0
        ? sidePlaneAlternation
        : -sidePlaneAlternation;
      const [rearSideLink, frontSideLink] = object.userData.sideLinks;
      rearSideLink.position.z = -sidePlaneOffset - sideOffset;
      frontSideLink.position.z = sidePlaneOffset + sideOffset;
      rearSideLink.material = parity === 0
        ? sideLinkMaterial
        : sideLinkMaterialAlternate;
      frontSideLink.material = rearSideLink.material;
      object.position.copy(link.start.position);
      object.rotation.set(0, 0, link.angle);
      object.userData.currentLength = link.length;
      object.userData.endPosition = link.end.position.clone();
      object.userData.materialIndex = link.materialIndex;
      object.userData.sideLinkPlaneNormal = link.sideLinkPlaneNormal.clone();
      object.userData.stateIndex = stateIndex;
      object.userData.startPosition = link.start.position.clone();
    });
    sprocketRotor.userData.angularSpeed = state.sprocketAngularSpeed;
    chain.userData.chainAdvance = state.chainAdvance;
    chain.userData.linearSpeed = state.chainLinearSpeed;
    root.userData.contacts = {
      engagedRungs: state.engagements,
    };
    root.userData.kinematics = state;
  };
  update(0);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(5.4, 3.3, 10.8),
  };
}

function toothedLinkChainWheel() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const sourceScale = 0.4;
  const sourcePitchRadius = 5.4;
  const sourceLinkPitch = 2.403226;
  const sourceLinkHalfHeight = 0.4;
  const sourceLinkToothBaseStartX = 0.829623;
  const sourceLinkToothCenterX = 1.201613;
  const sourceLinkToothBaseEndX = 1.573603;
  const sourceLinkToothDepth = 0.897845;
  const sourcePivotHoleRadius = 0.15;
  const sourceChainStartTracks = Object.freeze([
    [[-10.19201, -17.173079], [-9.19201, -17.173079]],
    [[-9.570009, -14.851741], [-8.570009, -14.851741]],
  ]);
  const sourceChainEnd = Object.freeze([11.154831, -11.144112]);
  const sourceViewBox = Object.freeze({
    bottom: -10.168663,
    height: 17,
    left: -8.5,
    top: 6.831337,
    width: 17,
  });
  const sourceWheelProfileStart = Object.freeze({
    outerTip: [0.186573, 4.986224],
    root: [-0.811831, 4.290638],
    shoulderEntering: [-0.538881, 4.848961],
    shoulderLeaving: [0.899741, 4.795131],
  });
  const wheelPitchCount = 14;
  const chainNodeStep = fullTurn / wheelPitchCount;
  const pitchRadius = sourcePitchRadius * sourceScale;
  const linkPitch = 2 * pitchRadius * Math.sin(chainNodeStep / 2);
  const sourceScaledLinkPitch = sourceLinkPitch * sourceScale;
  const wheelCenter = new THREE.Vector3(0, 0.46, 0);
  const leftTangentAngle = 11 * Math.PI / 12;
  const rightTangentAngle = 5 * Math.PI / 36;
  const incomingDirectionAngle = 5 * Math.PI / 12;
  const outgoingDirectionAngle = -13 * Math.PI / 36;
  const incomingDirection = new THREE.Vector3(
    Math.cos(incomingDirectionAngle),
    Math.sin(incomingDirectionAngle),
    0,
  );
  const outgoingDirection = new THREE.Vector3(
    Math.cos(outgoingDirectionAngle),
    Math.sin(outgoingDirectionAngle),
    0,
  );
  const leftTangentPoint = wheelCenter.clone().add(new THREE.Vector3(
    pitchRadius * Math.cos(leftTangentAngle),
    pitchRadius * Math.sin(leftTangentAngle),
    0,
  ));
  const rightTangentPoint = wheelCenter.clone().add(new THREE.Vector3(
    pitchRadius * Math.cos(rightTangentAngle),
    pitchRadius * Math.sin(rightTangentAngle),
    0,
  ));
  const sourceEndPoint = wheelCenter.clone().add(new THREE.Vector3(
    sourceChainEnd[0] * sourceScale,
    sourceChainEnd[1] * sourceScale,
    0,
  ));
  const outgoingEndDistance = sourceEndPoint.clone()
    .sub(rightTangentPoint)
    .dot(outgoingDirection);
  const incomingPitchCountAtPhaseZero = 8;
  const incomingTailNodeCount = 8;
  const incomingStartAtPhaseZero = leftTangentPoint.clone().addScaledVector(
    incomingDirection,
    -incomingPitchCountAtPhaseZero * linkPitch,
  );
  const incomingStartAtPhaseOne = incomingStartAtPhaseZero.clone()
    .addScaledVector(incomingDirection, linkPitch);
  const maximumRenderedLinks = 24;
  const linkHalfHeight = sourceLinkHalfHeight * sourceScale;
  const pivotHoleRadius = sourcePivotHoleRadius * sourceScale;
  const wheelRootRadius = Math.hypot(
    ...sourceWheelProfileStart.root,
  ) * sourceScale;
  const wheelShoulderRadius = Math.hypot(
    ...sourceWheelProfileStart.shoulderEntering,
  ) * sourceScale;
  const wheelOuterTipRadius = Math.hypot(
    ...sourceWheelProfileStart.outerTip,
  ) * sourceScale;
  const linkToothDepth = pitchRadius * Math.cos(chainNodeStep / 2)
    - wheelRootRadius;
  const sourceScaledLinkToothDepth = sourceLinkToothDepth * sourceScale;
  const linkToothHalfBase = (
    sourceLinkToothBaseEndX - sourceLinkToothBaseStartX
  ) * sourceScale / 2;
  const linkToothCenterX = linkPitch / 2;
  const linkToothBaseStartX = linkToothCenterX - linkToothHalfBase;
  const linkToothBaseEndX = linkToothCenterX + linkToothHalfBase;
  const wheelDepth = 0.12;
  const linkPlateDepth = 0.08;
  const linkPlatePlaneOffset = 0.08;
  const pivotPinRadius = pivotHoleRadius * 0.62;
  const pivotPinLength = 0.34;
  const shaftHoleRadius = 0.5 * sourceScale;
  const hubOuterRadius = 1 * sourceScale;
  const hubDepth = 0.36;
  const shaftLength = 1.25;
  const inputAngularSpeed = fullTurn / 4;
  const cyclePeriod = fullTurn / inputAngularSpeed;
  const wheelRootReferenceAngle = leftTangentAngle - chainNodeStep / 2;
  const wheelProfileStartRootAngle = wheelRootReferenceAngle
    - 2 * chainNodeStep;
  const sourceRootAngle = Math.atan2(
    sourceWheelProfileStart.root[1],
    sourceWheelProfileStart.root[0],
  );
  const sourceEnteringShoulderAngle = Math.atan2(
    sourceWheelProfileStart.shoulderEntering[1],
    sourceWheelProfileStart.shoulderEntering[0],
  );
  const wheelShoulderAngleOffset = sourceRootAngle
    - sourceEnteringShoulderAngle;
  const rightHandoffPhase = leftTangentAngle
    - 5 * chainNodeStep
    - rightTangentAngle;

  const centeredExtrusion = (shape, depth, bevelSize = 0.008) => {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      bevelEnabled: false,
      bevelSegments: 2,
      bevelSize,
      bevelThickness: bevelSize,
      curveSegments: 24,
      depth,
      steps: 1,
    });
    geometry.translate(0, 0, -depth / 2);
    geometry.computeVertexNormals();
    return geometry;
  };
  const polarPoint = (radius, angle) => new THREE.Vector2(
    radius * Math.cos(angle),
    radius * Math.sin(angle),
  );

  const wheelShape = new THREE.Shape();
  const wheelProfilePoints = [];
  for (let index = 0; index < wheelPitchCount; index += 1) {
    const rootAngle = wheelProfileStartRootAngle - index * chainNodeStep;
    wheelProfilePoints.push(
      polarPoint(wheelRootRadius, rootAngle),
      polarPoint(
        wheelShoulderRadius,
        rootAngle - wheelShoulderAngleOffset,
      ),
      polarPoint(
        wheelOuterTipRadius,
        rootAngle - chainNodeStep / 2,
      ),
      polarPoint(
        wheelShoulderRadius,
        rootAngle - chainNodeStep + wheelShoulderAngleOffset,
      ),
    );
  }
  wheelShape.moveTo(wheelProfilePoints[0].x, wheelProfilePoints[0].y);
  wheelProfilePoints.slice(1).forEach((point) => {
    wheelShape.lineTo(point.x, point.y);
  });
  wheelShape.closePath();
  const wheelShaftHole = new THREE.Path();
  wheelShaftHole.absarc(0, 0, shaftHoleRadius, 0, fullTurn, true);
  wheelShape.holes.push(wheelShaftHole);

  const wheelRotor = new THREE.Group();
  wheelRotor.position.copy(wheelCenter);
  wheelRotor.userData.axis = Z_AXIS.clone();
  wheelRotor.userData.pitches = wheelPitchCount;
  wheelRotor.userData.role = 'fourteen-pitch-toothed-chain-wheel-rotor';
  const wheel = new THREE.Mesh(
    centeredExtrusion(wheelShape, wheelDepth),
    matte(PALETTE.driver, { metalness: 0.15, roughness: 0.55 }),
  );
  wheel.userData.axis = Z_AXIS.clone();
  wheel.userData.pitchRadius = pitchRadius;
  wheel.userData.profilePointCount = wheelPitchCount * 4 + 1;
  wheel.userData.profilePoints = wheelProfilePoints.map((point) => point.clone());
  wheel.userData.rootNotches = wheelPitchCount;
  wheel.userData.role = 'source-profiled-fourteen-notch-chain-wheel';
  wheel.userData.rootDirections = Array.from(
    { length: wheelPitchCount },
    (_, index) => polarPoint(
      1,
      wheelRootReferenceAngle - index * chainNodeStep,
    ),
  );

  const hubShape = new THREE.Shape();
  hubShape.absarc(0, 0, hubOuterRadius, 0, fullTurn, false);
  const hubHole = new THREE.Path();
  hubHole.absarc(0, 0, shaftHoleRadius, 0, fullTurn, true);
  hubShape.holes.push(hubHole);
  const hub = new THREE.Mesh(
    centeredExtrusion(hubShape, hubDepth, 0.006),
    matte(PALETTE.ink, { metalness: 0.25, roughness: 0.46 }),
  );
  hub.userData.axis = Z_AXIS.clone();
  hub.userData.role = 'toothed-chain-wheel-annular-hub';
  wheelRotor.add(wheel, hub);

  const shaft = makeShaft({
    axis: Z_AXIS,
    color: PALETTE.ink,
    length: shaftLength,
    radius: shaftHoleRadius * 0.68,
  });
  shaft.position.copy(wheelCenter);
  shaft.userData.role = 'toothed-chain-wheel-shaft';

  const linkShape = new THREE.Shape();
  linkShape.moveTo(0, linkHalfHeight);
  linkShape.lineTo(linkPitch, linkHalfHeight);
  linkShape.absarc(
    linkPitch,
    0,
    linkHalfHeight,
    Math.PI / 2,
    -Math.PI / 2,
    true,
  );
  linkShape.lineTo(linkToothBaseEndX, -linkHalfHeight);
  linkShape.lineTo(linkToothCenterX, -linkToothDepth);
  linkShape.lineTo(linkToothBaseStartX, -linkHalfHeight);
  linkShape.lineTo(0, -linkHalfHeight);
  linkShape.absarc(
    0,
    0,
    linkHalfHeight,
    -Math.PI / 2,
    Math.PI / 2,
    true,
  );
  linkShape.closePath();
  const pivotHole = new THREE.Path();
  pivotHole.absarc(0, 0, pivotHoleRadius, 0, fullTurn, false);
  linkShape.holes.push(pivotHole);
  const endPivotHole = new THREE.Path();
  endPivotHole.absarc(linkPitch, 0, pivotHoleRadius, 0, fullTurn, false);
  linkShape.holes.push(endPivotHole);
  const linkPlateGeometry = centeredExtrusion(
    linkShape,
    linkPlateDepth,
    0.005,
  );
  const linkOutlinePoints = Object.freeze([
    [0, linkHalfHeight],
    [linkPitch, linkHalfHeight],
    [linkPitch, -linkHalfHeight],
    [linkToothBaseEndX, -linkHalfHeight],
    [linkToothCenterX, -linkToothDepth],
    [linkToothBaseStartX, -linkHalfHeight],
    [0, -linkHalfHeight],
  ]);
  const pivotPinGeometry = new THREE.CylinderGeometry(
    pivotPinRadius,
    pivotPinRadius,
    pivotPinLength,
    18,
  );
  pivotPinGeometry.rotateX(Math.PI / 2);
  pivotPinGeometry.computeVertexNormals();
  const linkMaterial = matte(PALETTE.belt, {
    metalness: 0.21,
    roughness: 0.46,
  });
  const linkMaterialAlternate = matte(0x397994, {
    metalness: 0.21,
    roughness: 0.46,
  });
  const pivotMaterial = matte(0x607d86, {
    metalness: 0.38,
    roughness: 0.38,
  });
  const chain = new THREE.Group();
  chain.userData.inwardToothPerLink = 1;
  chain.userData.role = 'one-articulated-toothed-plate-link-chain';
  const plates = [];
  const pivotPins = [];
  const links = Array.from({ length: maximumRenderedLinks }, (_, index) => {
    const link = new THREE.Group();
    const plate = new THREE.Mesh(
      linkPlateGeometry,
      index % 2 === 0 ? linkMaterial : linkMaterialAlternate,
    );
    const pivotPin = new THREE.Mesh(pivotPinGeometry, pivotMaterial);
    plate.userData.inwardPointedTooth = true;
    pivotPin.userData.axis = Z_AXIS.clone();
    pivotPin.userData.role = 'toothed-chain-hinge-pin';
    link.userData.chainLink = true;
    link.userData.plate = plate;
    link.userData.pivotPin = pivotPin;
    link.userData.renderSlot = index;
    link.add(plate, pivotPin);
    plates.push(plate);
    pivotPins.push(pivotPin);
    chain.add(link);
    return link;
  });

  const cameraEnvelopeMaterial = new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
    opacity: 0,
    transparent: true,
  });
  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(
      sourceViewBox.width * sourceScale,
      sourceViewBox.height * sourceScale,
      0.01,
    ),
    cameraEnvelopeMaterial,
  );
  cameraEnvelope.position.set(
    wheelCenter.x + (sourceViewBox.left + sourceViewBox.width / 2)
      * sourceScale,
    wheelCenter.y + (sourceViewBox.bottom + sourceViewBox.height / 2)
      * sourceScale,
    wheelCenter.z,
  );
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.noShadow = true;
  cameraEnvelope.userData.role = 'official-229-view-envelope';
  root.add(cameraEnvelope, wheelRotor, shaft, chain);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(
      wheelCenter.x + sourceViewBox.left * sourceScale,
      wheelCenter.y + sourceViewBox.bottom * sourceScale,
      -0.34,
    ),
    new THREE.Vector3(
      wheelCenter.x + (sourceViewBox.left + sourceViewBox.width)
        * sourceScale,
      wheelCenter.y + sourceViewBox.top * sourceScale,
      0.34,
    ),
  );
  root.userData.cameraDistanceScale = 1.08;

  const normalizedPhase = (inputAngle) => {
    const rawStep = inputAngle / chainNodeStep;
    const nearestStep = Math.round(rawStep);
    if (Math.abs(rawStep - nearestStep) < 2e-12) {
      return { phase: 0, stepIndex: nearestStep };
    }
    const stepIndex = Math.floor(rawStep);
    return {
      phase: inputAngle - stepIndex * chainNodeStep,
      stepIndex,
    };
  };
  const lineCoordinateAtLinkDistance = (
    tangentPoint,
    direction,
    circlePoint,
    side,
  ) => {
    const offset = tangentPoint.clone().sub(circlePoint);
    const projected = offset.dot(direction);
    const constant = offset.lengthSq() - linkPitch ** 2;
    const discriminant = Math.max(0, projected ** 2 - constant);
    const root = Math.sqrt(discriminant);
    const candidates = [-projected - root, -projected + root];
    const valid = candidates.filter((coordinate) => (
      side === 'incoming' ? coordinate <= 1e-10 : coordinate >= -1e-10
    ));
    return side === 'incoming'
      ? Math.max(...valid)
      : Math.min(...valid);
  };
  const circleDerivativePerInputAngle = (point) => {
    const local = point.clone().sub(wheelCenter);
    return new THREE.Vector3(local.y, -local.x, 0);
  };
  const lineCoordinateDerivative = (
    tangentPoint,
    direction,
    coordinate,
    circlePoint,
    circleDerivative,
  ) => {
    const linePoint = tangentPoint.clone().addScaledVector(
      direction,
      coordinate,
    );
    const separation = linePoint.sub(circlePoint);
    return separation.dot(circleDerivative) / separation.dot(direction);
  };
  const pointOnPitchCircle = (angle) => wheelCenter.clone().add(
    new THREE.Vector3(
      pitchRadius * Math.cos(angle),
      pitchRadius * Math.sin(angle),
      0,
    ),
  );
  const signedPhaseError = (angle) => THREE.MathUtils.euclideanModulo(
    angle + Math.PI,
    fullTurn,
  ) - Math.PI;

  // The chain is one finite chain (see below): null bounds give the plate
  // window used to find its end links.
  let chainTailIndex = null;
  let chainHeadIndex = null;
  const stateAtInputAngle = (
    inputAngle,
    angularSpeed = inputAngularSpeed,
  ) => {
    const { phase, stepIndex } = normalizedPhase(inputAngle);
    if (chainTailIndex !== null
      && (stepIndex > chainTailIndex + incomingPitchCountAtPhaseZero - 1
        || stepIndex < chainHeadIndex + incomingPitchCountAtPhaseZero + 7)) {
      throw new RangeError('Movement 229 hoist stroke left its finite chain.');
    }
    const maximumCircleMaterialIndex = stepIndex
      - incomingPitchCountAtPhaseZero;
    const circleNodes = [];
    let circleAngle = leftTangentAngle - phase;
    let circleMaterialIndex = maximumCircleMaterialIndex;
    while (circleAngle >= rightTangentAngle - 2e-12) {
      const position = pointOnPitchCircle(circleAngle);
      const derivative = circleDerivativePerInputAngle(position);
      circleNodes.push({
        angle: circleAngle,
        derivative,
        materialIndex: circleMaterialIndex,
        position,
        section: 'pitch-circle',
      });
      circleAngle -= chainNodeStep;
      circleMaterialIndex -= 1;
    }
    const minimumCircleMaterialIndex = circleNodes.at(-1).materialIndex;
    const firstCircleNode = circleNodes[0];
    const incomingCoordinate = lineCoordinateAtLinkDistance(
      leftTangentPoint,
      incomingDirection,
      firstCircleNode.position,
      'incoming',
    );
    const incomingCoordinateDerivative = lineCoordinateDerivative(
      leftTangentPoint,
      incomingDirection,
      incomingCoordinate,
      firstCircleNode.position,
      firstCircleNode.derivative,
    );
    const incomingMaterialIndex = maximumCircleMaterialIndex + 1;
    const nodes = [];
    for (
      let offset = chainTailIndex === null
        ? incomingTailNodeCount - 1
        : chainTailIndex - incomingMaterialIndex;
      offset >= 0;
      offset -= 1
    ) {
      nodes.push({
        derivative: incomingDirection.clone().multiplyScalar(
          incomingCoordinateDerivative,
        ),
        materialIndex: incomingMaterialIndex + offset,
        position: leftTangentPoint.clone().addScaledVector(
          incomingDirection,
          incomingCoordinate - offset * linkPitch,
        ),
        section: 'incoming-tangent',
      });
    }
    nodes.push(...circleNodes);

    const lastCircleNode = circleNodes.at(-1);
    const outgoingCoordinate = lineCoordinateAtLinkDistance(
      rightTangentPoint,
      outgoingDirection,
      lastCircleNode.position,
      'outgoing',
    );
    const outgoingCoordinateDerivative = lineCoordinateDerivative(
      rightTangentPoint,
      outgoingDirection,
      outgoingCoordinate,
      lastCircleNode.position,
      lastCircleNode.derivative,
    );
    const outgoingMaterialIndex = minimumCircleMaterialIndex - 1;
    for (
      let offset = 0;
      chainHeadIndex === null
        ? outgoingCoordinate + offset * linkPitch <= outgoingEndDistance + 1e-10
        : outgoingMaterialIndex - offset >= chainHeadIndex;
      offset += 1
    ) {
      nodes.push({
        derivative: outgoingDirection.clone().multiplyScalar(
          outgoingCoordinateDerivative,
        ),
        materialIndex: outgoingMaterialIndex - offset,
        position: rightTangentPoint.clone().addScaledVector(
          outgoingDirection,
          outgoingCoordinate + offset * linkPitch,
        ),
        section: 'outgoing-tangent',
      });
    }
    nodes.forEach((node) => {
      node.velocity = node.derivative.clone().multiplyScalar(angularSpeed);
    });

    const sprocketAngle = -inputAngle;
    const sprocketAngularSpeed = -angularSpeed;
    const chainLinks = nodes.slice(0, -1).map((start, stateIndex) => {
      const end = nodes[stateIndex + 1];
      const chord = end.position.clone().sub(start.position);
      const angle = Math.atan2(chord.y, chord.x);
      const toothOffset = new THREE.Vector3(
        linkToothCenterX,
        -linkToothDepth,
        0,
      ).applyAxisAngle(Z_AXIS, angle);
      const toothTip = start.position.clone().add(toothOffset);
      const relativeVelocity = end.velocity.clone().sub(start.velocity);
      const linkAngularSpeed = (
        chord.x * relativeVelocity.y - chord.y * relativeVelocity.x
      ) / chord.lengthSq();
      const toothTipVelocity = start.velocity.clone().add(
        new THREE.Vector3().crossVectors(
          Z_AXIS.clone().multiplyScalar(linkAngularSpeed),
          toothOffset,
        ),
      );
      const toothRadial = toothTip.clone().sub(wheelCenter);
      const toothTipAngle = Math.atan2(toothRadial.y, toothRadial.x);
      const rawRootIndex = Math.round(
        (
          wheelRootReferenceAngle
          + sprocketAngle
          - toothTipAngle
        ) / chainNodeStep,
      );
      const rootAngle = wheelRootReferenceAngle
        - rawRootIndex * chainNodeStep
        + sprocketAngle;
      const startPitchError = Math.abs(
        start.position.distanceTo(wheelCenter) - pitchRadius,
      );
      const endPitchError = Math.abs(
        end.position.distanceTo(wheelCenter) - pitchRadius,
      );
      return {
        angle,
        center: start.position.clone().add(end.position).multiplyScalar(0.5),
        chord,
        end,
        endPitchError,
        engaged: start.section === 'pitch-circle'
          && end.section === 'pitch-circle',
        length: chord.length(),
        linkAngularSpeed,
        materialIndex: start.materialIndex,
        rootAngle,
        rootIndex: THREE.MathUtils.euclideanModulo(
          rawRootIndex,
          wheelPitchCount,
        ),
        rootPhaseError: signedPhaseError(toothTipAngle - rootAngle),
        rootRadialError: toothRadial.length() - wheelRootRadius,
        start,
        startPitchError,
        stateIndex,
        toothTip,
        toothTipAngle,
        toothTipVelocity,
      };
    });
    const engagements = chainLinks
      .filter((link) => link.engaged)
      .map((link) => {
        const radial = link.toothTip.clone().sub(wheelCenter);
        const wheelVelocity = new THREE.Vector3().crossVectors(
          Z_AXIS.clone().multiplyScalar(sprocketAngularSpeed),
          radial,
        );
        return {
          chainVelocity: link.toothTipVelocity.clone(),
          contactPoint: link.toothTip.clone(),
          linkMaterialIndex: link.materialIndex,
          noSlipVelocityError: link.toothTipVelocity.clone()
            .sub(wheelVelocity),
          phaseError: link.rootPhaseError,
          radialError: link.rootRadialError,
          rootAngle: link.rootAngle,
          rootIndex: link.rootIndex,
          wheelVelocity,
        };
      });
    return {
      chainAdvance: stepIndex * linkPitch + incomingCoordinate + linkPitch,
      chainLinks,
      circleNodeCount: circleNodes.length,
      engagements,
      incomingCoordinate,
      incomingLinearSpeed: incomingCoordinateDerivative * angularSpeed,
      inputAngle,
      inputAngularSpeed: angularSpeed,
      materialStepIndex: stepIndex,
      nodes,
      outgoingCoordinate,
      outgoingLinearSpeed: outgoingCoordinateDerivative * angularSpeed,
      phaseWithinOneLink: phase,
      sprocketAngle,
      sprocketAngularSpeed,
    };
  };
  // Brown draws a finite chain: the left leg ends in a rounded end link about
  // a pitch radius below the wheel centre, and the right leg runs off the
  // plate. A finite chain cannot loop on a wheel turning one way, so the
  // wheel works as a chain hoist: from Brown's pose it pays out the left leg
  // (lifting the right) hoistStrokePitches links and winds it back each
  // cycle, on a smooth cosine stroke. Both chain ends are whole links.
  const hoistStrokePitches = 4;
  const hoistStrokeAngle = hoistStrokePitches * chainNodeStep;
  const plateWindow = stateAtInputAngle(0);
  // Brown's left end pin sits 0.96 pitch radii below the wheel centre: five
  // links fewer than the plate window's incoming tail.
  chainTailIndex = plateWindow.nodes[0].materialIndex - 5;
  // The right end stays two links past the plate's crop at the top of the
  // stroke.
  chainHeadIndex = plateWindow.nodes.at(-1).materialIndex - 2 - hoistStrokePitches;
  const hoistAngleAtTime = (time) => -hoistStrokeAngle
    * (1 - Math.cos(fullTurn * time / cyclePeriod)) / 2;
  const hoistSpeedAtTime = (time) => -hoistStrokeAngle
    * Math.sin(fullTurn * time / cyclePeriod) * Math.PI / cyclePeriod;
  const stateAtTime = (time) => stateAtInputAngle(
    hoistAngleAtTime(time),
    hoistSpeedAtTime(time),
  );

  root.userData.mechanism = 'fourteen-pitch-toothed-link-chain-wheel';
  root.userData.archetype = 'fourteen-pitch-toothed-link-chain-wheel';
  root.userData.blocks = {
    cameraEnvelope,
    chain,
    hub,
    links,
    pivotPins,
    plates,
    shaft,
    wheel,
    wheelRotor,
  };
  root.userData.geometry = {
    chainHeadIndex,
    chainNodeStep,
    chainTailIndex,
    hoistStrokeAngle,
    hoistStrokePitches,
    cyclePeriod,
    fullTurn,
    hubDepth,
    hubOuterRadius,
    incomingDirection,
    incomingDirectionAngle,
    incomingPitchCountAtPhaseZero,
    incomingStartAtPhaseOne,
    incomingStartAtPhaseZero,
    inputAngularSpeed,
    leftTangentAngle,
    leftTangentPoint,
    linkHalfHeight,
    linkPitch,
    linkPlateDepth,
    linkPlatePlaneOffset,
    linkToothBaseEndX,
    linkToothBaseStartX,
    linkToothCenterX,
    linkToothDepth,
    linkOutlinePoints,
    maximumRenderedLinks,
    outgoingDirection,
    outgoingDirectionAngle,
    outgoingEndDistance,
    pitchRadius,
    pivotHoleRadius,
    pivotPinLength,
    pivotPinRadius,
    rightHandoffPhase,
    rightTangentAngle,
    rightTangentPoint,
    shaftHoleRadius,
    shaftLength,
    sourceLinkHalfHeight,
    sourceLinkPitch,
    sourceLinkToothDepth,
    sourcePitchRadius,
    sourceScale,
    sourceScaledLinkPitch,
    sourceScaledLinkToothDepth,
    wheelCenter,
    wheelDepth,
    wheelOuterTipRadius,
    wheelPitchCount,
    wheelProfileStartRootAngle,
    wheelRootRadius,
    wheelRootReferenceAngle,
    wheelShoulderAngleOffset,
    wheelShoulderRadius,
  };
  root.userData.sourceAnimation = {
    available: true,
    chainEnd: sourceChainEnd,
    chainStartTracks: sourceChainStartTracks,
    interpolationStepsPerTurn: 14,
    linkEnd: [sourceLinkPitch, 0],
    linkOutline: {
      halfHeight: sourceLinkHalfHeight,
      pivotHoleRadius: sourcePivotHoleRadius,
      toothBaseEndX: sourceLinkToothBaseEndX,
      toothBaseStartX: sourceLinkToothBaseStartX,
      toothCenter: [sourceLinkToothCenterX, -sourceLinkToothDepth],
    },
    pulleyPitchCircle: { center: [0, 0], radius: sourcePitchRadius },
    sourceProfilePointCount: 57,
    viewBox: sourceViewBox,
    wheelProfileStart: sourceWheelProfileStart,
  };
  root.userData.sourceReference = {
    plate229: {
      chainLeavesFrameAtBothLowerEdges: true,
      inwardPointedToothPerLink: 1,
      pivotedFlatPlateLinks: true,
      pulleyPitchCount: 14,
      visibleUpperWrap: 'source-asymmetric-tangent-wrap',
    },
  };
  root.userData.transmission = {
    chainPitchPolygonSides: wheelPitchCount,
    chainTravelPerWheelTurn: wheelPitchCount * linkPitch,
    chordalActionIncluded: true,
    officialLinearInterpolationCorrected: true,
    teethAdvancedPerWheelTurn: wheelPitchCount,
    toothAdvanceInLinks: 1,
    wheelPitches: wheelPitchCount,
  };
  root.userData.stateAtInputAngle = stateAtInputAngle;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    wheelRotor.rotation.z = state.sprocketAngle;
    links.forEach((object) => {
      object.visible = false;
      object.userData.materialIndex = null;
      object.userData.stateIndex = null;
    });
    state.chainLinks.forEach((link, stateIndex) => {
      const renderSlot = THREE.MathUtils.euclideanModulo(
        link.materialIndex,
        maximumRenderedLinks,
      );
      const object = links[renderSlot];
      const parity = Math.abs(link.materialIndex % 2);
      object.visible = true;
      object.position.copy(link.start.position);
      object.rotation.set(0, 0, link.angle);
      object.userData.plate.position.z = parity === 0
        ? linkPlatePlaneOffset
        : -linkPlatePlaneOffset;
      object.userData.plate.material = parity === 0
        ? linkMaterial
        : linkMaterialAlternate;
      object.userData.currentLength = link.length;
      object.userData.endPosition = link.end.position.clone();
      object.userData.engaged = link.engaged;
      object.userData.materialIndex = link.materialIndex;
      object.userData.rootPhaseError = link.rootPhaseError;
      object.userData.rootRadialError = link.rootRadialError;
      object.userData.startPosition = link.start.position.clone();
      object.userData.stateIndex = stateIndex;
      object.userData.toothTipPosition = link.toothTip.clone();
    });
    wheelRotor.userData.angularSpeed = state.sprocketAngularSpeed;
    chain.userData.chainAdvance = state.chainAdvance;
    chain.userData.currentLinkCount = state.chainLinks.length;
    chain.userData.incomingLinearSpeed = state.incomingLinearSpeed;
    chain.userData.outgoingLinearSpeed = state.outgoingLinearSpeed;
    root.userData.contacts = {
      engagedLinkTeeth: state.engagements,
    };
    root.userData.kinematics = state;
  };
  update(0);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(4.8, 3, 11.2),
  };
}

function leverContractedCraneBandBrake(movement) {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const sourceImageCenter = new THREE.Vector2(170, 270);
  const sourceScale = 0.011;
  const sourceWheelCenter = new THREE.Vector2(170, 270);
  const sourceUpperBandEnd = new THREE.Vector2(352, 259);
  const sourceLowerBandEnd = new THREE.Vector2(338, 337);
  const sourceFulcrum = new THREE.Vector2(384, 301);
  const sourceHandleEnd = new THREE.Vector2(516, 275);
  const sourceToWorld = (point) => new THREE.Vector2(
    (point.x - sourceImageCenter.x) * sourceScale,
    (sourceImageCenter.y - point.y) * sourceScale,
  );
  const wheelCenter = sourceToWorld(sourceWheelCenter);
  const upperBandEnd = sourceToWorld(sourceUpperBandEnd);
  const sourceLowerEnd = sourceToWorld(sourceLowerBandEnd);
  const leverFulcrum = sourceToWorld(sourceFulcrum);
  const sourceHandlePosition = sourceToWorld(sourceHandleEnd);
  const lowerArmLocal = sourceLowerEnd.clone().sub(leverFulcrum);
  const handleLocal = sourceHandlePosition.clone().sub(leverFulcrum);
  const upperAnchorLength = upperBandEnd.distanceTo(leverFulcrum);
  const lowerArmLength = lowerArmLocal.length();
  const handleLength = handleLocal.length();
  const mechanicalAdvantage = handleLength / lowerArmLength;
  const wheelRadius = 1.62;
  const wheelDepth = 0.38;
  const bandWidth = 0.12;
  const bandDepth = 0.18;
  const bandPlaneZ = 0.08;
  const bandContactRadius = wheelRadius + bandWidth / 2 + .0005;
  const appliedLeverAngle = THREE.MathUtils.degToRad(-25);
  const bandArcSamples = 121;
  const cyclePeriod = 4;
  const cyclesPerSecond = 1 / cyclePeriod;
  const releasedEnd = 0.15;
  const brakingStart = 0.35;
  const applicationEnd = 0.45;
  const appliedHoldEnd = 0.65;
  const accelerationEnd = 0.75;
  const releaseEnd = 0.95;
  const normalizedWheelTravelPerCycle = 0.7;
  const freeWheelAngularSpeed = fullTurn
    / (cyclePeriod * normalizedWheelTravelPerCycle);

  const positiveModulo = (value, modulus) => ((value % modulus) + modulus)
    % modulus;
  const rotate2 = (vector, angle) => new THREE.Vector2(
    vector.x * Math.cos(angle) - vector.y * Math.sin(angle),
    vector.x * Math.sin(angle) + vector.y * Math.cos(angle),
  );
  const smoothIntegral = (progress) => progress ** 3
    - 0.5 * progress ** 4;
  const segmentProgress = (phase, start, end) => THREE.MathUtils.clamp(
    (phase - start) / (end - start),
    0,
    1,
  );
  const polylineLength = (points) => points.slice(1).reduce(
    (length, point, index) => length + point.distanceTo(points[index]),
    0,
  );
  const tangentFromExternalPoint = (point, upper) => {
    const distance = point.length();
    if (distance <= bandContactRadius) {
      throw new RangeError('A brake-band endpoint entered the brake drum.');
    }
    const polarAngle = Math.atan2(point.y, point.x);
    const tangentOffset = Math.acos(bandContactRadius / distance);
    const angle = polarAngle + (upper ? tangentOffset : -tangentOffset);
    return {
      angle,
      point: new THREE.Vector2(
        Math.cos(angle) * bandContactRadius,
        Math.sin(angle) * bandContactRadius,
      ),
      tangentLength: Math.sqrt(
        distance ** 2 - bandContactRadius ** 2,
      ),
    };
  };
  const rawBandPathAtLeverAngle = (leverAngleDelta, slackAmplitude) => {
    const lowerBandEnd = leverFulcrum.clone().add(
      rotate2(lowerArmLocal, leverAngleDelta),
    );
    const upperTangent = tangentFromExternalPoint(upperBandEnd, true);
    const lowerTangent = tangentFromExternalPoint(lowerBandEnd, false);
    const wrapAngle = positiveModulo(
      lowerTangent.angle - upperTangent.angle,
      fullTurn,
    );
    const points2D = [upperBandEnd.clone()];
    for (let index = 0; index < bandArcSamples; index += 1) {
      const progress = index / (bandArcSamples - 1);
      const angle = upperTangent.angle + wrapAngle * progress;
      const radius = bandContactRadius
        + slackAmplitude * Math.sin(Math.PI * progress) ** 2;
      points2D.push(new THREE.Vector2(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
      ));
    }
    points2D.push(lowerBandEnd);
    return {
      length: polylineLength(points2D),
      lowerBandEnd,
      lowerTangent,
      minimumCenterlineRadius: Math.min(
        ...points2D.slice(1, -1).map((point) => point.length()),
      ),
      points2D,
      slackAmplitude,
      upperTangent,
      wrapAngle,
    };
  };
  const appliedBandPath = rawBandPathAtLeverAngle(appliedLeverAngle, 0);
  const constantBandLength = appliedBandPath.length;
  const bandPathAtLeverAngle = (leverAngleDelta) => {
    const shortest = rawBandPathAtLeverAngle(leverAngleDelta, 0);
    const slackLength = Math.max(0, constantBandLength - shortest.length);
    let slackAmplitude = slackLength === 0
      ? 0
      : 2 * slackLength / shortest.wrapAngle;
    for (let iteration = 0; iteration < 4 && slackLength > 0; iteration += 1) {
      const epsilon = 1e-5;
      const path = rawBandPathAtLeverAngle(
        leverAngleDelta,
        slackAmplitude,
      );
      const beforeLength = rawBandPathAtLeverAngle(
        leverAngleDelta,
        Math.max(0, slackAmplitude - epsilon),
      ).length;
      const afterLength = rawBandPathAtLeverAngle(
        leverAngleDelta,
        slackAmplitude + epsilon,
      ).length;
      const derivative = (afterLength - beforeLength)
        / (slackAmplitude < epsilon ? epsilon : 2 * epsilon);
      if (Math.abs(derivative) < 1e-9) break;
      slackAmplitude = Math.max(
        0,
        slackAmplitude - (path.length - constantBandLength) / derivative,
      );
    }
    const path = rawBandPathAtLeverAngle(leverAngleDelta, slackAmplitude);
    return {
      ...path,
      lengthError: path.length - constantBandLength,
      points: path.points2D.map((point) => new THREE.Vector3(
        point.x,
        point.y,
        bandPlaneZ,
      )),
      shortestLength: shortest.length,
      slackLength,
    };
  };
  const releasedBandPath = bandPathAtLeverAngle(0);

  const applicationAtPhase = (phase) => {
    if (phase < releasedEnd) {
      return { acceleration: 0, rate: 0, value: 0 };
    }
    if (phase < brakingStart) {
      const duration = brakingStart - releasedEnd;
      const progress = segmentProgress(phase, releasedEnd, brakingStart);
      return {
        acceleration: (6 - 12 * progress) / duration ** 2,
        rate: 6 * progress * (1 - progress) / duration,
        value: smoothStep01(progress),
      };
    }
    if (phase < accelerationEnd) {
      return { acceleration: 0, rate: 0, value: 1 };
    }
    if (phase < releaseEnd) {
      const duration = releaseEnd - accelerationEnd;
      const progress = segmentProgress(phase, accelerationEnd, releaseEnd);
      return {
        acceleration: -(6 - 12 * progress) / duration ** 2,
        rate: -6 * progress * (1 - progress) / duration,
        value: 1 - smoothStep01(progress),
      };
    }
    return { acceleration: 0, rate: 0, value: 0 };
  };
  const wheelMotionAtPhase = (phase) => {
    if (phase < brakingStart) {
      return { factor: 1, factorDerivative: 0, travel: phase };
    }
    if (phase < applicationEnd) {
      const duration = applicationEnd - brakingStart;
      const progress = segmentProgress(phase, brakingStart, applicationEnd);
      return {
        factor: 1 - smoothStep01(progress),
        factorDerivative: -6 * progress * (1 - progress) / duration,
        travel: brakingStart + duration * (
          progress - smoothIntegral(progress)
        ),
      };
    }
    const stoppedTravel = brakingStart
      + (applicationEnd - brakingStart) / 2;
    if (phase < appliedHoldEnd) {
      return { factor: 0, factorDerivative: 0, travel: stoppedTravel };
    }
    if (phase < accelerationEnd) {
      const duration = accelerationEnd - appliedHoldEnd;
      const progress = segmentProgress(phase, appliedHoldEnd, accelerationEnd);
      return {
        factor: smoothStep01(progress),
        factorDerivative: 6 * progress * (1 - progress) / duration,
        travel: stoppedTravel + duration * smoothIntegral(progress),
      };
    }
    const acceleratedTravel = stoppedTravel
      + (accelerationEnd - appliedHoldEnd) / 2;
    return {
      factor: 1,
      factorDerivative: 0,
      travel: acceleratedTravel + phase - accelerationEnd,
    };
  };

  const wheel = new THREE.Group();
  const wheelRotor = new THREE.Group();
  wheel.add(wheelRotor);
  wheel.userData.axis = Z_AXIS.clone();
  wheel.userData.rotor = wheelRotor;
  wheel.userData.role = 'crane-and-hoist-brake-wheel';
  const wheelMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.62,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const wheelBody = new THREE.Mesh(
    new THREE.CylinderGeometry(
      wheelRadius,
      wheelRadius,
      wheelDepth,
      96,
    ),
    wheelMaterial,
  );
  wheelBody.rotation.x = Math.PI / 2;
  wheelBody.userData.role = 'solid-brake-drum';
  wheelRotor.add(wheelBody);
  // Brown's second circle inside the drum's edge marks a raised braking rim,
  // not an ink ring: a shallow lip in the drum's own colour, inside the tread.
  const rimLipDepth = 0.03;
  const brakingRim = new THREE.Mesh(
    new THREE.LatheGeometry([
      new THREE.Vector2(wheelRadius - 0.15, 0),
      new THREE.Vector2(wheelRadius, 0),
      new THREE.Vector2(wheelRadius, rimLipDepth),
      new THREE.Vector2(wheelRadius - 0.15, rimLipDepth),
      new THREE.Vector2(wheelRadius - 0.15, 0),
    ], 96).rotateX(Math.PI / 2),
    wheelMaterial,
  );
  brakingRim.position.z = wheelDepth / 2;
  brakingRim.userData.role = 'visible-braking-rim';
  wheelRotor.add(brakingRim);
  const wheelHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.29, 0.29, 0.62, 40),
    darkMaterial,
  );
  wheelHub.rotation.x = Math.PI / 2;
  wheelHub.userData.role = 'brake-wheel-hub';
  wheelRotor.add(wheelHub);
  const wheelIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.78, 0.026),
    matte(PALETTE.white, { roughness: 0.47 }),
  );
  wheelIndex.position.set(0, 0.88, wheelDepth / 2 + 0.085);
  wheelIndex.userData.role = 'brake-wheel-rotation-index';
  wheelRotor.add(wheelIndex);
  root.add(wheel);
  const wheelShaft = makeShaft({ length: 1.15, radius: 0.13 });
  wheelShaft.userData.role = 'brake-wheel-shaft';
  root.add(wheelShaft);

  const makeDynamicFlatBand = () => {
    const pointCount = bandArcSamples + 2;
    const positions = new Float32Array(pointCount * 4 * 3);
    const normals = new Float32Array(pointCount * 4 * 3);
    for (let index = 0; index < pointCount; index += 1) {
      normals.set([
        0, 0, 1,
        0, 0, 1,
        0, 0, -1,
        0, 0, -1,
      ], index * 12);
    }
    const indices = [];
    for (let index = 0; index < pointCount - 1; index += 1) {
      const first = index * 4;
      const second = (index + 1) * 4;
      indices.push(
        first, second, second + 1,
        first, second + 1, first + 1,
        first + 2, second + 3, second + 2,
        first + 2, first + 3, second + 3,
        first, first + 2, second + 2,
        first, second + 2, second,
        first + 1, second + 1, second + 3,
        first + 1, second + 3, first + 3,
      );
    }
    const last = (pointCount - 1) * 4;
    indices.push(
      0, 1, 3, 0, 3, 2,
      last, last + 2, last + 3, last, last + 3, last + 1,
    );
    const geometry = new THREE.BufferGeometry();
    const positionAttribute = new THREE.BufferAttribute(positions, 3);
    positionAttribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', positionAttribute);
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
    geometry.setIndex(indices);
    const band = new THREE.Mesh(
      geometry,
      matte(PALETTE.accent, { metalness: 0.11, roughness: 0.64 }),
    );
    band.frustumCulled = false;
    band.userData.isBrakeStrap = true;
    band.userData.noShadow = true;
    band.userData.role = 'constant-length-contracting-brake-strap';
    band.userData.setPoints = (points) => {
      if (points.length !== pointCount) {
        throw new RangeError('Brake strap point count changed.');
      }
      for (let index = 0; index < pointCount; index += 1) {
        const previous = points[Math.max(0, index - 1)];
        const next = points[Math.min(pointCount - 1, index + 1)];
        const tangent = new THREE.Vector2(
          next.x - previous.x,
          next.y - previous.y,
        ).normalize();
        const normal = new THREE.Vector2(-tangent.y, tangent.x);
        const center = new THREE.Vector2(points[index].x, points[index].y);
        if (index === 0) center.addScaledVector(tangent, .115);
        if (index === pointCount - 1) center.addScaledVector(tangent, -.115);
        const plus = center.clone()
          .addScaledVector(normal, bandWidth / 2);
        const minus = center.clone()
          .addScaledVector(normal, -bandWidth / 2);
        const base = index * 12;
        positions.set([
          plus.x, plus.y, bandPlaneZ + bandDepth / 2,
          minus.x, minus.y, bandPlaneZ + bandDepth / 2,
          plus.x, plus.y, bandPlaneZ - bandDepth / 2,
          minus.x, minus.y, bandPlaneZ - bandDepth / 2,
        ], base);
      }
      positionAttribute.needsUpdate = true;
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      band.userData.centerlinePoints = points.map((point) => point.clone());
    };
    return band;
  };
  const brakeBand = makeDynamicFlatBand();
  root.add(brakeBand);

  const leverPlaneZ = 0.37;
  const lever = new THREE.Group();
  lever.position.set(leverFulcrum.x, leverFulcrum.y, leverPlaneZ);
  lever.userData.role = 'hand-lever-with-short-band-closing-arm';
  const leverShortArm = makeBeam(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(lowerArmLocal.x, lowerArmLocal.y, 0),
    { color: PALETTE.driver, depth: 0.14, thickness: 0.12 },
  );
  leverShortArm.userData.role = 'rigid-short-arm-to-lower-band-end';
  const leverHandle = makeBeam(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(handleLocal.x, handleLocal.y, 0),
    { color: PALETTE.driver, depth: 0.14, thickness: 0.12 },
  );
  leverHandle.userData.role = 'long-hand-operated-brake-lever';
  const lowerEndpointJoint = new THREE.Group();
  lowerEndpointJoint.position.set(lowerArmLocal.x, lowerArmLocal.y, 0);
  lowerEndpointJoint.userData.role = 'lower-brake-strap-end-on-lever-arm';
  const lowerEndpointRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.12, 0.035, 8, 32),
    darkMaterial,
  );
  lowerEndpointJoint.add(lowerEndpointRing);
  lever.add(leverShortArm, leverHandle, lowerEndpointJoint);
  root.add(lever);
  const leverFulcrumShaft = makeShaft({ length: 0.96, radius: 0.115 });
  leverFulcrumShaft.position.set(
    leverFulcrum.x,
    leverFulcrum.y,
    leverPlaneZ - 0.14,
  );
  leverFulcrumShaft.userData.fixedPivot = true;
  leverFulcrumShaft.userData.role = 'fixed-brake-lever-fulcrum';
  root.add(leverFulcrumShaft);

  const upperAnchorLink = makeDynamicLink({
    color: PALETTE.ink,
    depth: 0.13,
    jointRadius: 0.105,
    thickness: 0.085,
  });
  upperAnchorLink.userData.setEndpoints(
    new THREE.Vector3(upperBandEnd.x, upperBandEnd.y, leverPlaneZ),
    new THREE.Vector3(leverFulcrum.x, leverFulcrum.y, leverPlaneZ),
  );
  upperAnchorLink.userData.role = 'rigid-upper-band-end-anchor-link';
  root.add(upperAnchorLink);
  const upperEndpointShaft = makeShaft({ length: 0.72, radius: 0.075 });
  upperEndpointShaft.position.set(
    upperBandEnd.x,
    upperBandEnd.y,
    leverPlaneZ - 0.14,
  );
  upperEndpointShaft.userData.role = 'fixed-upper-brake-strap-end-pin';
  root.add(upperEndpointShaft);

  const frameZ = -0.35;
  const baseY = -2.15;
  const baseRail = makeBeam(
    new THREE.Vector3(-1.92, baseY, frameZ),
    new THREE.Vector3(4.08, baseY, frameZ),
    { color: PALETTE.frame, depth: 0.2, thickness: 0.16 },
  );
  baseRail.userData.role = 'brake-demonstration-base';
  const wheelPost = makeBeam(
    new THREE.Vector3(0, baseY, frameZ),
    new THREE.Vector3(0, 0, frameZ),
    { color: PALETTE.frame, depth: 0.19, thickness: 0.15 },
  );
  wheelPost.userData.role = 'fixed-brake-wheel-bearing-post';
  const fulcrumPost = makeBeam(
    new THREE.Vector3(leverFulcrum.x + 0.18, baseY, frameZ),
    new THREE.Vector3(leverFulcrum.x, leverFulcrum.y, frameZ),
    { color: PALETTE.frame, depth: 0.19, thickness: 0.15 },
  );
  fulcrumPost.userData.role = 'fixed-lever-fulcrum-post';
  root.add(baseRail, wheelPost, fulcrumPost);

  const snapCycleCoordinate = (coordinate) => {
    const nearestInteger = Math.round(coordinate);
    return Math.abs(coordinate - nearestInteger) < 1e-12
      ? nearestInteger
      : coordinate;
  };
  const stateAtCycleCoordinate = (coordinate) => {
    const cycleCoordinate = snapCycleCoordinate(coordinate);
    const cycleIndex = Math.floor(cycleCoordinate);
    const cyclePhase = cycleCoordinate - cycleIndex;
    const application = applicationAtPhase(cyclePhase);
    const leverAngleDelta = appliedLeverAngle * application.value;
    const leverAngularSpeed = appliedLeverAngle * application.rate
      * cyclesPerSecond;
    const leverAngularAcceleration = appliedLeverAngle
      * application.acceleration * cyclesPerSecond ** 2;
    const bandPath = bandPathAtLeverAngle(leverAngleDelta);
    const handlePosition = leverFulcrum.clone().add(
      rotate2(handleLocal, leverAngleDelta),
    );
    const wheelMotion = wheelMotionAtPhase(cyclePhase);
    const wheelAngle = fullTurn * cycleIndex
      + freeWheelAngularSpeed * cyclePeriod * wheelMotion.travel;
    const wheelAngularSpeed = freeWheelAngularSpeed * wheelMotion.factor;
    const wheelAngularAcceleration = freeWheelAngularSpeed
      * wheelMotion.factorDerivative * cyclesPerSecond;
    const brakeEngagement = 1 - wheelMotion.factor;
    const endpointSeparation = upperBandEnd.distanceTo(
      bandPath.lowerBandEnd,
    );
    let stage = 'released-band-wheel-turning';
    if (cyclePhase >= releasedEnd && cyclePhase < applicationEnd) {
      stage = brakeEngagement > 0
        ? 'lever-pulled-down-band-taking-load-and-wheel-decelerating'
        : 'lever-pulled-down-taking-up-band-slack';
    } else if (cyclePhase >= applicationEnd && cyclePhase < appliedHoldEnd) {
      stage = 'contracted-band-holds-brake-wheel-stopped';
    } else if (cyclePhase >= appliedHoldEnd && cyclePhase < releaseEnd) {
      stage = cyclePhase < accelerationEnd
        ? 'taut-band-unloads-and-wheel-resumes'
        : 'lever-returning-with-band-slack';
    }
    return {
      application: application.value,
      bandPath,
      bandTaut: bandPath.slackLength < 2e-10,
      brakeEngagement,
      brakeNormalForce: null,
      illustrativeLoadIndex: brakeEngagement * mechanicalAdvantage,
      cycleCoordinate,
      cycleIndex,
      cyclePhase,
      endpointSeparation,
      handlePosition,
      leverAngleDelta,
      leverAngularAcceleration,
      leverAngularSpeed,
      lowerBandEnd: bandPath.lowerBandEnd,
      sourcePose: Math.abs(cycleCoordinate) < 1e-12,
      stage,
      wheelAngle,
      wheelAngularAcceleration,
      wheelAngularSpeed,
      wheelStopped: wheelMotion.factor < 1e-12,
      wheelTurns: wheelAngle / fullTurn,
    };
  };
  const stateAtTime = (time) => stateAtCycleCoordinate(
    time * cyclesPerSecond,
  );

  root.userData.archetype =
    'lever-contracted-constant-length-crane-band-brake';
  root.userData.blocks = {
    baseRail,
    brakeBand,
    brakingRim,
    fulcrumPost,
    lever,
    leverFulcrumShaft,
    leverHandle,
    leverShortArm,
    lowerEndpointJoint,
    upperAnchorLink,
    upperEndpointShaft,
    wheel,
    wheelBody,
    wheelHub,
    wheelIndex,
    wheelPost,
    wheelShaft,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-1.95, -2.3, -0.65),
    new THREE.Vector3(4.15, 1.9, 0.85),
  );
  root.userData.bandPathAtLeverAngle = bandPathAtLeverAngle;
  root.userData.geometry = {
    accelerationEnd,
    appliedBandPath,
    appliedHoldEnd,
    appliedLeverAngle,
    applicationEnd,
    bandArcSamples,
    bandContactRadius,
    bandDepth,
    bandPlaneZ,
    bandWidth,
    brakingStart,
    constantBandLength,
    cyclePeriod,
    cyclesPerSecond,
    freeWheelAngularSpeed,
    handleLength,
    handleLocal,
    leverFulcrum,
    lowerArmLength,
    lowerArmLocal,
    mechanicalAdvantage,
    normalizedWheelTravelPerCycle,
    releaseEnd,
    releasedBandPath,
    releasedEnd,
    sourceHandlePosition,
    sourceLowerEnd,
    upperAnchorLength,
    upperBandEnd,
    wheelCenter,
    wheelDepth,
    wheelRadius,
  };
  root.userData.mechanism =
    'fixed-upper-band-end-and-pivoted-short-arm-draw-the-constant-length-strap-tight-around-a-crane-brake-wheel';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'The official Movement 242 page marks its animation unavailable.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate242: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'one brake wheel, one open contracting strap, one fixed upper anchor link, and one pivoted hand lever carrying the lower strap end',
      officialAnimationAvailable: false,
      rasterFulcrum: sourceFulcrum,
      rasterHandleEnd: sourceHandleEnd,
      rasterLowerBandEnd: sourceLowerBandEnd,
      rasterUpperBandEnd: sourceUpperBandEnd,
      rasterWheelCenter: sourceWheelCenter,
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 61,
      edition: 21,
      illustrationPage: 60,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtCycleCoordinate = stateAtCycleCoordinate;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    accelerationEnd,
    appliedHoldEnd,
    applicationEnd,
    brakingStart,
    cyclePeriod,
    releaseEnd,
    releasedEnd,
  };
  root.userData.transmission = {
    appliedWrapAngleDegrees: THREE.MathUtils.radToDeg(
      appliedBandPath.wrapAngle,
    ),
    bandCirculates: false,
    brakeType: 'external-contracting-band-brake',
    constantBandLength,
    driveAssumption:
      'an external crane or hoist load turns the wheel whenever the brake is released',
    endpointSeparationApplied: upperBandEnd.distanceTo(
      appliedBandPath.lowerBandEnd,
    ),
    endpointSeparationReleased: upperBandEnd.distanceTo(sourceLowerEnd),
    leverMechanicalAdvantage: mechanicalAdvantage,
    lowerBandEndMovesWithLever: true,
    upperBandEndAnchoredToFulcrum: true,
    wheelRevolutionsPerDemonstrationCycle: 1,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    wheelRotor.rotation.z = state.wheelAngle;
    wheelShaft.userData.rotor.rotation.z = state.wheelAngle;
    lever.rotation.z = state.leverAngleDelta;
    brakeBand.userData.setPoints(state.bandPath.points);
    brakeBand.userData.application = state.application;
    brakeBand.userData.brakeEngagement = state.brakeEngagement;
    brakeBand.userData.centerlineLength = state.bandPath.length;
    brakeBand.userData.slackAmplitude = state.bandPath.slackAmplitude;
    brakeBand.userData.slackLength = state.bandPath.slackLength;
    wheel.userData.angularSpeed = state.wheelAngularSpeed;
    wheelShaft.userData.angularSpeed = state.wheelAngularSpeed;
    lever.userData.angularSpeed = state.leverAngularSpeed;
    root.userData.contacts = {
      bandToBrakeWheel: {
        active: state.brakeEngagement > 0,
        innerSurfaceClearance: bandContactRadius
          - bandWidth / 2 - wheelRadius,
        normalForce: null,
        illustrativeLoadIndex: state.illustrativeLoadIndex,
        taut: state.bandTaut,
        wrapAngle: state.bandPath.wrapAngle,
      },
    };
    root.userData.kinematics = state;
  };
  correctCraneBrakeJoints(root);
  finishBandDrive(root, 6, 'The lever first takes up slack; only then does the prescribed wheel slowdown begin. It holds the strap taut while the illustrative braking load rises and falls, then releases it. Friction, band elasticity, tension and normal force are not solved; the wheel schedule is a demonstration, not validated braking dynamics.');
  root.userData.dynamics = { prescribedWheelSchedule: true, forceValidated: false, normalForce: null, illustrativeLoadIndexIsDimensionless: true };
  update(0);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(.8, .5, 15),
  };
}

function horizontalDriverToTwinVerticalShafts(movement) {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const sourceImageCenter = new THREE.Vector2(272, 304);
  const sourceScale = 0.015;
  const sourceDriverCenter = new THREE.Vector2(272, 304);
  const sourceLeftGuideCenter = new THREE.Vector2(168, 277);
  const sourceRightGuideCenter = new THREE.Vector2(375, 277);
  const sourceLeftVerticalBeltPlane = new THREE.Vector2(72, 252);
  const sourceRightVerticalBeltPlane = new THREE.Vector2(460, 252);
  const sourceToWorld = (point) => new THREE.Vector3(
    (point.x - sourceImageCenter.x) * sourceScale,
    (sourceImageCenter.y - point.y) * sourceScale,
    0,
  );
  const driverCenter = sourceToWorld(sourceDriverCenter);
  const leftGuideCenter = sourceToWorld(sourceLeftGuideCenter);
  const rightGuideCenter = sourceToWorld(sourceRightGuideCenter);
  const driverRadius = 0.7;
  const guideRadius = 0.375;
  const verticalRadius = 0.48;
  const beltWidth = 0.16;
  const beltThickness = 0.06;
  const verticalPulleyPlaneY = leftGuideCenter.y + guideRadius;
  const verticalPulleyCenterZ = -verticalRadius;
  const leftVerticalCenter = new THREE.Vector3(
    sourceToWorld(sourceLeftVerticalBeltPlane).x,
    verticalPulleyPlaneY,
    verticalPulleyCenterZ,
  );
  const rightVerticalCenter = new THREE.Vector3(
    sourceToWorld(sourceRightVerticalBeltPlane).x,
    verticalPulleyPlaneY,
    verticalPulleyCenterZ,
  );
  const cyclePeriod = 4;
  const inputAngularSpeed = fullTurn / cyclePeriod;
  const beltLinearSpeed = inputAngularSpeed * driverRadius;
  const markerCount = 14;

  const internalTangent = (
    firstCenter,
    firstRadius,
    secondCenter,
    secondRadius,
    side,
  ) => {
    const centerDelta = secondCenter.clone().sub(firstCenter);
    const centerDistance = centerDelta.length();
    const radiusSum = firstRadius + secondRadius;
    if (centerDistance <= radiusSum) {
      throw new RangeError('The crossed internal belt tangent is impossible.');
    }
    const along = centerDelta.clone().divideScalar(centerDistance);
    const across = new THREE.Vector3(-along.y, along.x, 0);
    const projection = radiusSum / centerDistance;
    const perpendicular = Math.sqrt(1 - projection ** 2);
    const firstNormal = along.clone().multiplyScalar(projection)
      .addScaledVector(across, side * perpendicular);
    const firstPoint = firstCenter.clone().addScaledVector(
      firstNormal,
      firstRadius,
    );
    const secondPoint = secondCenter.clone().addScaledVector(
      firstNormal,
      -secondRadius,
    );
    return {
      centerDistance,
      firstNormal,
      firstPoint,
      secondPoint,
      spanLength: firstPoint.distanceTo(secondPoint),
    };
  };

  const leftInternalTangent = internalTangent(
    leftGuideCenter,
    guideRadius,
    driverCenter,
    driverRadius,
    1,
  );
  const rightInternalTangent = internalTangent(
    driverCenter,
    driverRadius,
    rightGuideCenter,
    guideRadius,
    -1,
  );
  const leftGuideTop = leftGuideCenter.clone().add(
    new THREE.Vector3(0, guideRadius, 0),
  );
  const rightGuideTop = rightGuideCenter.clone().add(
    new THREE.Vector3(0, guideRadius, 0),
  );
  const leftVerticalFront = leftVerticalCenter.clone().add(
    new THREE.Vector3(0, 0, verticalRadius),
  );
  const leftVerticalRear = leftVerticalCenter.clone().add(
    new THREE.Vector3(0, 0, -verticalRadius),
  );
  const rightVerticalFront = rightVerticalCenter.clone().add(
    new THREE.Vector3(0, 0, verticalRadius),
  );
  const rightVerticalRear = rightVerticalCenter.clone().add(
    new THREE.Vector3(0, 0, -verticalRadius),
  );
  const leftGuideArc = circularArcThrough(
    leftGuideCenter,
    leftGuideTop,
    leftInternalTangent.firstPoint,
    Z_AXIS,
    X_AXIS,
  );
  const driverArc = circularArcThrough(
    driverCenter,
    leftInternalTangent.secondPoint,
    rightInternalTangent.firstPoint,
    Z_AXIS,
    leftInternalTangent.secondPoint.clone()
      .sub(leftInternalTangent.firstPoint)
      .normalize(),
  );
  const rightGuideArc = circularArcThrough(
    rightGuideCenter,
    rightInternalTangent.secondPoint,
    rightGuideTop,
    Z_AXIS,
    rightInternalTangent.secondPoint.clone()
      .sub(rightInternalTangent.firstPoint)
      .normalize(),
  );
  const rightVerticalArc = circularArcThrough(
    rightVerticalCenter,
    rightVerticalFront,
    rightVerticalRear,
    Y_AXIS,
    X_AXIS,
  );
  const leftVerticalArc = circularArcThrough(
    leftVerticalCenter,
    leftVerticalRear,
    leftVerticalFront,
    Y_AXIS,
    X_AXIS.clone().negate(),
  );
  const quarterTurnWidth = (from, to, progress) => {
    const angle = Math.PI / 2 * smoothStep01(progress);
    return from.clone().multiplyScalar(Math.cos(angle))
      .addScaledVector(to, Math.sin(angle));
  };
  const constantWidth = (axis) => () => axis.clone();
  const beltSegments = [
    {
      curve: new THREE.LineCurve3(leftVerticalFront, leftGuideTop),
      role: 'left-ninety-degree-twist-from-vertical-pulley-to-guide',
      widthAt: (progress) => quarterTurnWidth(Y_AXIS, Z_AXIS, progress),
    },
    {
      curve: leftGuideArc,
      role: 'left-guide-clockwise-wrap',
      widthAt: constantWidth(Z_AXIS),
    },
    {
      curve: new THREE.LineCurve3(
        leftInternalTangent.firstPoint,
        leftInternalTangent.secondPoint,
      ),
      role: 'left-guide-to-horizontal-driver-internal-tangent',
      widthAt: constantWidth(Z_AXIS),
    },
    {
      curve: driverArc,
      role: 'horizontal-driver-counterclockwise-lower-wrap',
      widthAt: constantWidth(Z_AXIS),
    },
    {
      curve: new THREE.LineCurve3(
        rightInternalTangent.firstPoint,
        rightInternalTangent.secondPoint,
      ),
      role: 'horizontal-driver-to-right-guide-internal-tangent',
      widthAt: constantWidth(Z_AXIS),
    },
    {
      curve: rightGuideArc,
      role: 'right-guide-clockwise-wrap',
      widthAt: constantWidth(Z_AXIS),
    },
    {
      curve: new THREE.LineCurve3(rightGuideTop, rightVerticalFront),
      role: 'right-ninety-degree-twist-from-guide-to-vertical-pulley',
      widthAt: (progress) => quarterTurnWidth(Z_AXIS, Y_AXIS, progress),
    },
    {
      curve: rightVerticalArc,
      role: 'right-vertical-pulley-outboard-half-wrap',
      widthAt: constantWidth(Y_AXIS),
    },
    {
      curve: new THREE.LineCurve3(rightVerticalRear, leftVerticalRear),
      role: 'rear-return-leaf-between-vertical-pulleys',
      widthAt: constantWidth(Y_AXIS),
    },
    {
      curve: leftVerticalArc,
      role: 'left-vertical-pulley-outboard-half-wrap',
      widthAt: constantWidth(Y_AXIS),
    },
  ];
  let accumulatedLength = 0;
  beltSegments.forEach((segment, index) => {
    segment.index = index;
    segment.length = segment.curve instanceof CircularArcCurve3
      ? segment.curve.radialStart.length() * Math.abs(segment.curve.sweep)
      : segment.curve.getLength();
    segment.startDistance = accumulatedLength;
    accumulatedLength += segment.length;
    segment.endDistance = accumulatedLength;
  });
  const beltLength = accumulatedLength;
  const positiveModulo = (value, modulus) => ((value % modulus) + modulus)
    % modulus;
  const beltFrameAtDistance = (rawDistance) => {
    const distance = positiveModulo(rawDistance, beltLength);
    const segment = beltSegments.find(
      ({ endDistance }) => distance < endDistance,
    ) ?? beltSegments[0];
    const progress = segment.length === 0
      ? 0
      : (distance - segment.startDistance) / segment.length;
    const point = segment.curve.getPoint(progress);
    const tangent = segment.curve.getTangent(progress).normalize();
    const widthDirection = segment.widthAt(progress)
      .addScaledVector(tangent, -segment.widthAt(progress).dot(tangent))
      .normalize();
    const thicknessDirection = new THREE.Vector3()
      .crossVectors(tangent, widthDirection)
      .normalize();
    return {
      distance,
      point,
      progress,
      role: segment.role,
      segmentIndex: segment.index,
      tangent,
      thicknessDirection,
      widthDirection,
    };
  };

  class ExactSpatialBeltCurve extends THREE.Curve {
    getPoint(progress, target = new THREE.Vector3()) {
      return target.copy(beltFrameAtDistance(progress * beltLength).point);
    }

    getTangent(progress, target = new THREE.Vector3()) {
      return target.copy(beltFrameAtDistance(progress * beltLength).tangent);
    }

    getLength() {
      return beltLength;
    }
  }
  const beltCurve = new ExactSpatialBeltCurve();

  const makeSpatialRibbonBelt = () => {
    const sectionDistances = [];
    for (const segment of beltSegments) {
      const count = Math.ceil(384 * segment.length / beltLength);
      for (let i = 0; i < count; i++) sectionDistances.push(segment.startDistance + segment.length * i / count);
    }
    sectionDistances.push(beltLength);
    const ribbonSamples = sectionDistances.length - 1;
    const vertexCount = (ribbonSamples + 1) * 4;
    const positions = new Float32Array(vertexCount * 3);
    for (let sample = 0; sample <= ribbonSamples; sample += 1) {
      const frame = beltFrameAtDistance(
        sectionDistances[sample],
      );
      const widthOffset = frame.widthDirection.clone()
        .multiplyScalar(beltWidth / 2);
      const thicknessOffset = frame.thicknessDirection.clone()
        .multiplyScalar(beltThickness / 2);
      const plusWidth = frame.point.clone().add(widthOffset);
      const minusWidth = frame.point.clone().sub(widthOffset);
      const base = sample * 12;
      positions.set([
        ...plusWidth.clone().add(thicknessOffset).toArray(),
        ...minusWidth.clone().add(thicknessOffset).toArray(),
        ...plusWidth.clone().sub(thicknessOffset).toArray(),
        ...minusWidth.clone().sub(thicknessOffset).toArray(),
      ], base);
    }
    const indices = [];
    for (let sample = 0; sample < ribbonSamples; sample += 1) {
      const first = sample * 4;
      const second = (sample + 1) * 4;
      indices.push(
        first, second, second + 1,
        first, second + 1, first + 1,
        first + 2, second + 3, second + 2,
        first + 2, first + 3, second + 3,
        first, first + 2, second + 2,
        first, second + 2, second,
        first + 1, second + 1, second + 3,
        first + 1, second + 3, first + 3,
      );
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const group = new THREE.Group();
    const ribbon = new THREE.Mesh(
      geometry,
      matte(PALETTE.belt, {
        metalness: 0.04,
        roughness: 0.78,
        side: THREE.DoubleSide,
      }),
    );
    ribbon.userData.role = 'single-flat-spatial-power-band';
    group.add(ribbon);
    const markerMaterial = matte(PALETTE.white, { roughness: 0.48 });
    const markers = Array.from({ length: markerCount }, (_, index) => {
      const marker = new THREE.Mesh(
        new THREE.BoxGeometry(beltWidth * .9, beltThickness + .0003, .034),
        markerMaterial,
      );
      marker.userData.markerIndex = index;
      marker.userData.role = 'constant-arclength-band-marker';
      group.add(marker);
      return marker;
    });
    group.userData.beltCount = 1;
    group.userData.curve = beltCurve;
    group.userData.frameAtDistance = beltFrameAtDistance;
    group.userData.length = beltLength;
    group.userData.markers = markers;
    group.userData.ribbon = ribbon;
    group.userData.ribbonSamples = ribbonSamples;
    group.userData.segments = beltSegments;
    group.userData.updateDistance = (distance) => {
      group.userData.distance = distance;
      group.userData.phase = positiveModulo(distance, beltLength)
        / beltLength;
      markers.forEach((marker, index) => {
        const markerDistance = distance + beltLength * index / markerCount;
        const frame = beltFrameAtDistance(markerDistance);
        marker.position.copy(frame.point);
        marker.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
          frame.widthDirection, frame.thicknessDirection, frame.tangent));
        marker.userData.distance = positiveModulo(markerDistance, beltLength);
        marker.userData.pathRole = frame.role;
        marker.userData.segmentIndex = frame.segmentIndex;
        marker.userData.tangent = frame.tangent;
      });
    };
    group.userData.updateDistance(0);
    return group;
  };

  const driver = makePulley({
    axis: Z_AXIS,
    color: PALETTE.driver,
    radius: driverRadius - beltThickness / 2 - .0006,
    spokes: 0,
    width: 0.36,
  });
  driver.position.copy(driverCenter);
  driver.userData.contactRadius = driverRadius;
  driver.userData.role = 'horizontal-shaft-central-driving-pulley';
  const leftGuide = makePulley({
    axis: Z_AXIS,
    color: PALETTE.accent,
    radius: guideRadius - beltThickness / 2 - .0006,
    spokes: 0,
    width: 0.27,
  });
  leftGuide.position.copy(leftGuideCenter);
  leftGuide.userData.contactRadius = guideRadius;
  leftGuide.userData.role = 'left-horizontal-axis-guide-idler';
  const rightGuide = makePulley({
    axis: Z_AXIS,
    color: PALETTE.accent,
    radius: guideRadius - beltThickness / 2 - .0006,
    spokes: 0,
    width: 0.27,
  });
  rightGuide.position.copy(rightGuideCenter);
  rightGuide.userData.contactRadius = guideRadius;
  rightGuide.userData.role = 'right-horizontal-axis-guide-idler';
  // Brown's vertical pulleys are flanged spools: a drum about 1.7 radii
  // long (the band runs round its middle) between two thin flanges 1.2
  // drum radii across and 0.3 radii thick, on a shaft a third of the drum's
  // diameter (all measured on plate 243).
  const spoolDrumLength = 1.7 * verticalRadius;
  const spoolFlangeRadius = 1.2 * verticalRadius;
  const spoolFlangeThickness = 0.3 * verticalRadius;
  const makeSpool = () => {
    const spool = makePulley({
      axis: Y_AXIS,
      color: PALETTE.driven,
      radius: verticalRadius - beltThickness / 2 - .0006,
      spokes: 0,
      width: spoolDrumLength,
    });
    const { rotor } = spool.userData;
    const drum = spool.userData.tread;
    for (const side of [-1, 1]) {
      const flange = new THREE.Mesh(
        new THREE.CylinderGeometry(spoolFlangeRadius, spoolFlangeRadius, spoolFlangeThickness, 80),
        drum.material,
      );
      flange.rotation.x = Math.PI / 2;
      flange.position.z = side * (spoolDrumLength + spoolFlangeThickness) / 2;
      flange.userData.role = side < 0 ? 'spool-lower-flange' : 'spool-upper-flange';
      rotor.add(flange);
    }
    // The shaft fills the spool's bore, so the pulley's own hub is hidden.
    spool.userData.hub.visible = false;
    return markShadows(spool);
  };
  // Brown's shafts are a third of the drum's diameter and run about 1.7
  // spool heights above and below it.
  const spoolShaftRadius = 0.32 * verticalRadius;
  const spoolShaftLength = 3.9;
  const leftVertical = makeSpool();
  leftVertical.position.copy(leftVerticalCenter);
  leftVertical.userData.contactRadius = verticalRadius;
  leftVertical.userData.role = 'left-vertical-shaft-driven-pulley';
  const rightVertical = makeSpool();
  rightVertical.position.copy(rightVerticalCenter);
  rightVertical.userData.contactRadius = verticalRadius;
  rightVertical.userData.role = 'right-vertical-shaft-driven-pulley';
  const belt = makeSpatialRibbonBelt();
  belt.userData.role = 'one-endless-band-driving-both-vertical-shafts';

  const driverShaft = makeShaft({ length: 1.4, radius: 0.105, axis: Z_AXIS });
  driverShaft.position.copy(driverCenter);
  driverShaft.userData.role = 'horizontal-input-shaft';
  const leftGuideShaft = makeShaft({
    length: 0.86,
    radius: 0.07,
    axis: Z_AXIS,
  });
  leftGuideShaft.position.copy(leftGuideCenter);
  leftGuideShaft.userData.role = 'fixed-left-guide-shaft';
  const rightGuideShaft = makeShaft({
    length: 0.86,
    radius: 0.07,
    axis: Z_AXIS,
  });
  rightGuideShaft.position.copy(rightGuideCenter);
  rightGuideShaft.userData.role = 'fixed-right-guide-shaft';
  const leftVerticalShaft = makeShaft({
    length: spoolShaftLength,
    radius: spoolShaftRadius,
    axis: Y_AXIS,
  });
  leftVerticalShaft.position.copy(leftVerticalCenter);
  leftVerticalShaft.userData.role = 'left-vertical-output-shaft';
  const rightVerticalShaft = makeShaft({
    length: spoolShaftLength,
    radius: spoolShaftRadius,
    axis: Y_AXIS,
  });
  rightVerticalShaft.position.copy(rightVerticalCenter);
  rightVerticalShaft.userData.role = 'right-vertical-output-shaft';
  root.add(
    driver,
    leftGuide,
    rightGuide,
    leftVertical,
    rightVertical,
    driverShaft,
    leftGuideShaft,
    rightGuideShaft,
    leftVerticalShaft,
    rightVerticalShaft,
    belt,
  );

  const stateAtInputAngle = (inputAngle) => {
    const beltDistance = inputAngle * driverRadius;
    const verticalAngle = beltDistance / verticalRadius;
    const guideAngle = -beltDistance / guideRadius;
    return {
      beltDistance,
      beltFrame: beltFrameAtDistance(beltDistance),
      beltLinearSpeed,
      beltPhase: positiveModulo(beltDistance, beltLength) / beltLength,
      driverAngle: inputAngle,
      driverAngularSpeed: inputAngularSpeed,
      guideAngle,
      guideAngularSpeed: -beltLinearSpeed / guideRadius,
      inputAngle,
      leftVerticalAngle: verticalAngle,
      rightVerticalAngle: verticalAngle,
      sourcePose: Math.abs(inputAngle) < 1e-12,
      stage: 'one-endless-band-drives-both-vertical-shafts-continuously',
      verticalAngularSpeed: beltLinearSpeed / verticalRadius,
    };
  };
  const stateAtTime = (time) => stateAtInputAngle(
    time * inputAngularSpeed,
  );

  root.userData.archetype =
    'single-spatial-band-horizontal-driver-to-two-vertical-shafts-with-guide-idlers';
  root.userData.blocks = {
    belt,
    driver,
    driverShaft,
    leftGuide,
    leftGuideShaft,
    leftVertical,
    leftVerticalShaft,
    rightGuide,
    rightGuideShaft,
    rightVertical,
    rightVerticalShaft,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.62, -1.20, -1.22),
    new THREE.Vector3(3.44, 2.76, 0.78),
  );
  root.userData.geometry = {
    beltLength,
    beltSegments,
    beltThickness,
    beltWidth,
    cyclePeriod,
    driverArc,
    driverCenter,
    driverRadius,
    guideRadius,
    leftGuideArc,
    leftGuideCenter,
    leftGuideTop,
    leftInternalTangent,
    leftVerticalArc,
    leftVerticalCenter,
    leftVerticalFront,
    leftVerticalRear,
    markerCount,
    rearReturnDepth: rightVerticalRear.z,
    rightGuideArc,
    rightGuideCenter,
    rightGuideTop,
    rightInternalTangent,
    rightVerticalArc,
    rightVerticalCenter,
    rightVerticalFront,
    rightVerticalRear,
    verticalPulleyCenterZ,
    verticalPulleyPlaneY,
    verticalRadius,
  };
  root.userData.mechanism =
    'one-endless-flat-band-wraps-a-horizontal-driver-two-guide-idlers-and-two-parallel-vertical-shaft-pulleys';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'The official Movement 243 page marks its animation unavailable.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate243: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'one continuous spatial band with two quarter-twist leaves, a hidden rear return, two guide idlers, one horizontal driver, and two vertical driven pulleys',
      officialAnimationAvailable: false,
      rasterDriverCenter: sourceDriverCenter,
      rasterDriverPitchRadius: 47,
      rasterGuidePitchRadius: 25,
      rasterLeftGuideCenter: sourceLeftGuideCenter,
      rasterLeftVerticalBeltPlane: sourceLeftVerticalBeltPlane,
      rasterRightGuideCenter: sourceRightGuideCenter,
      rasterRightVerticalBeltPlane: sourceRightVerticalBeltPlane,
      rasterVerticalPitchRadius: 32,
      sourceProjectionNote:
        'the rear return leaf overlaps the front leaves in the engraving projection but is axially separate in the mechanism',
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 63,
      edition: 21,
      illustrationPage: 62,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtInputAngle = stateAtInputAngle;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    beltCount: 1,
    beltLinearSpeed,
    driverDirectionViewedFromFront: 'counterclockwise',
    guideAngularSpeedToDriver: -driverRadius / guideRadius,
    guideIdlersChangeDirectionNotBeltSpeed: true,
    leftVerticalAngularSpeedToDriver: driverRadius / verticalRadius,
    noSlip: true,
    quarterTwistCount: 2,
    rearReturnLeafPresent: true,
    rightVerticalAngularSpeedToDriver: driverRadius / verticalRadius,
    verticalOutputsRotateTogether: true,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(driver, state.driverAngle);
    setSpin(leftGuide, state.guideAngle);
    setSpin(rightGuide, state.guideAngle);
    setSpin(leftVertical, state.leftVerticalAngle);
    setSpin(rightVertical, state.rightVerticalAngle);
    setSpin(driverShaft, state.driverAngle);
    setSpin(leftVerticalShaft, state.leftVerticalAngle);
    setSpin(rightVerticalShaft, state.rightVerticalAngle);
    belt.userData.updateDistance(state.beltDistance);
    driver.userData.angularSpeed = state.driverAngularSpeed;
    leftGuide.userData.angularSpeed = state.guideAngularSpeed;
    rightGuide.userData.angularSpeed = state.guideAngularSpeed;
    leftVertical.userData.angularSpeed = state.verticalAngularSpeed;
    rightVertical.userData.angularSpeed = state.verticalAngularSpeed;
    root.userData.contacts = {
      driverToBand: {
        active: true,
        arc: driverArc,
        surfaceSpeedAlongBand: state.driverAngularSpeed * driverRadius,
      },
      leftGuideToBand: {
        active: true,
        arc: leftGuideArc,
        surfaceSpeedAlongBand: -state.guideAngularSpeed * guideRadius,
      },
      leftVerticalToBand: {
        active: true,
        arc: leftVerticalArc,
        surfaceSpeedAlongBand: state.verticalAngularSpeed * verticalRadius,
      },
      rightGuideToBand: {
        active: true,
        arc: rightGuideArc,
        surfaceSpeedAlongBand: -state.guideAngularSpeed * guideRadius,
      },
      rightVerticalToBand: {
        active: true,
        arc: rightVerticalArc,
        surfaceSpeedAlongBand: state.verticalAngularSpeed * verticalRadius,
      },
    };
    root.userData.kinematics = state;
  };
  for (const [pulley, shaftRadius] of [[driver, .105], [leftGuide, .07], [rightGuide, .07], [leftVertical, .095], [rightVertical, .095]]) {
    correctSpatialPulley(pulley, shaftRadius);
    // Brown draws all five pulleys as plain discs with a hub, not spoked
    // wheels: the web is an annulus seated on the bored hub's outer wall.
    const { tread, hub, radius, width } = pulley.userData;
    const hubRadius = Math.max(...hub.geometry.userData.outerProfile.map((point) => point.radial));
    const web = new THREE.LatheGeometry([
      new THREE.Vector2(hubRadius, -width / 2),
      new THREE.Vector2(radius, -width / 2),
      new THREE.Vector2(radius, width / 2),
      new THREE.Vector2(hubRadius, width / 2),
      new THREE.Vector2(hubRadius, -width / 2),
    ], 80);
    tread.geometry.dispose();
    tread.geometry = web;
    tread.userData.role = 'plain-disc-pulley-web';
  }
  finishBandDrive(root, 6, 'One band follows two quarter twists and a rear return to drive both vertical shafts. Ratios use the belt neutral-line radii; the inner running surfaces lie half a belt thickness below them. Belt stretch, tracking, tension and transmitted torque are not simulated.');
  update(0);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(2.2, 1.6, 15),
  };
}

function pronyBrakeDynamometer(movement) {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const sourceImageCenter = new THREE.Vector2(94, 286);
  const sourceScale = 0.012;
  const sourceDrumCenter = new THREE.Vector2(94, 286);
  const sourceLeverLeft = new THREE.Vector2(17, 236);
  const sourceLeverRight = new THREE.Vector2(462, 236);
  const sourceLeftClampScrew = new THREE.Vector2(43, 219);
  const sourceRightClampScrew = new THREE.Vector2(139, 219);
  const sourceSuspension = new THREE.Vector2(434, 253);
  const sourceUpperStop = new THREE.Vector2(355, 205);
  const sourceLowerStop = new THREE.Vector2(355, 270);
  const sourceScalePanCenter = new THREE.Vector2(414, 459);
  const sourceToWorld = (point, z = 0) => new THREE.Vector3(
    (point.x - sourceImageCenter.x) * sourceScale,
    (sourceImageCenter.y - point.y) * sourceScale,
    z,
  );
  const drumCenter = sourceToWorld(sourceDrumCenter);
  const drumRadius = 0.52;
  const drumDepth = 0.4;
  const brakeDepth = 0.29;
  const shoeStartAngle = THREE.MathUtils.degToRad(30);
  const shoeEndAngle = THREE.MathUtils.degToRad(150);
  const lowerBandStartAngle = shoeEndAngle;
  const lowerBandEndAngle = shoeStartAngle + fullTurn;
  const upperShoeWrapAngle = shoeEndAngle - shoeStartAngle;
  const lowerBandWrapAngle = lowerBandEndAngle - lowerBandStartAngle;
  const leverCenterY = 0.6;
  const leverThickness = 0.14;
  const leverDepth = 0.18;
  const leverPlaneZ = 0.3;
  const leverLeftX = sourceToWorld(sourceLeverLeft).x;
  const leverRightX = sourceToWorld(sourceLeverRight).x;
  const suspensionPoint = new THREE.Vector3(
    sourceToWorld(sourceSuspension).x,
    leverCenterY,
    leverPlaneZ,
  );
  const leverArm = suspensionPoint.x - drumCenter.x;
  const stopX = sourceToWorld(sourceUpperStop).x;
  const stopHeight = 0.16;
  const upperStopCenterY = sourceToWorld(sourceUpperStop).y;
  const lowerStopCenterY = sourceToWorld(sourceLowerStop).y;
  const upperStopSurfaceY = upperStopCenterY - stopHeight / 2;
  const lowerStopSurfaceY = lowerStopCenterY + stopHeight / 2;
  const cyclePeriod = 4;
  const drumAngularSpeed = fullTurn / cyclePeriod;
  const frictionCoefficient = 0.34;
  const weightForce = 0.34;
  const frictionTorque = weightForce * leverArm;
  const clampNormalForce = frictionTorque
    / (frictionCoefficient * drumRadius);
  const shaftRpm = drumAngularSpeed * 60 / fullTurn;
  const suspensionTangentialSpeed = leverArm * drumAngularSpeed;
  const measuredPower = weightForce * suspensionTangentialSpeed;

  const annularSectorShape = (
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
  ) => {
    const shape = new THREE.Shape();
    shape.moveTo(
      Math.cos(startAngle) * innerRadius,
      Math.sin(startAngle) * innerRadius,
    );
    shape.lineTo(
      Math.cos(startAngle) * outerRadius,
      Math.sin(startAngle) * outerRadius,
    );
    shape.absarc(0, 0, outerRadius, startAngle, endAngle, false);
    shape.lineTo(
      Math.cos(endAngle) * innerRadius,
      Math.sin(endAngle) * innerRadius,
    );
    shape.absarc(0, 0, innerRadius, endAngle, startAngle, true);
    shape.closePath();
    return shape;
  };
  const makeAnnularSector = ({
    color,
    depth,
    endAngle,
    innerRadius,
    outerRadius,
    role,
    startAngle,
    z = 0,
  }) => {
    const geometry = new THREE.ExtrudeGeometry(
      annularSectorShape(
        innerRadius,
        outerRadius,
        startAngle,
        endAngle,
      ),
      {
        bevelEnabled: true,
        bevelSegments: 1,
        bevelSize: 0.008,
        bevelThickness: 0.008,
        curveSegments: 48,
        depth,
      },
    );
    geometry.translate(0, 0, -depth / 2);
    const mesh = new THREE.Mesh(
      geometry,
      matte(color, { metalness: 0.08, roughness: 0.68 }),
    );
    mesh.position.z = z;
    mesh.userData.endAngle = endAngle;
    mesh.userData.innerRadius = innerRadius;
    mesh.userData.outerRadius = outerRadius;
    mesh.userData.role = role;
    mesh.userData.startAngle = startAngle;
    return mesh;
  };
  const polarPoint = (radius, angle, z = 0) => new THREE.Vector3(
    Math.cos(angle) * radius,
    Math.sin(angle) * radius,
    z,
  );

  const drum = new THREE.Group();
  const drumRotor = new THREE.Group();
  drum.add(drumRotor);
  drum.userData.axis = Z_AXIS.clone();
  drum.userData.rotor = drumRotor;
  drum.userData.role = 'smooth-shaft-mounted-brake-drum-A';
  const drumMaterial = matte(PALETTE.driver, {
    metalness: 0.15,
    roughness: 0.58,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.22,
    roughness: 0.5,
  });
  const drumBody = new THREE.Mesh(
    new THREE.CylinderGeometry(
      drumRadius,
      drumRadius,
      drumDepth,
      96,
    ),
    drumMaterial,
  );
  drumBody.rotation.x = Math.PI / 2;
  drumBody.userData.role = 'smooth-turned-friction-pulley-A';
  drumRotor.add(drumBody);
  const drumFaceRing = new THREE.Mesh(
    new THREE.TorusGeometry(drumRadius * 0.72, 0.035, 9, 72),
    darkMaterial,
  );
  drumFaceRing.position.z = drumDepth / 2 + 0.012;
  drumFaceRing.userData.role = 'brake-drum-face-ring';
  drumRotor.add(drumFaceRing);
  const drumHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.17, 0.7, 36),
    darkMaterial,
  );
  drumHub.rotation.x = Math.PI / 2;
  drumHub.userData.role = 'brake-drum-hub';
  drumRotor.add(drumHub);
  const drumIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.055, 0.025),
    matte(PALETTE.white, { roughness: 0.46 }),
  );
  drumIndex.position.set(0.34, 0, drumDepth / 2 + 0.055);
  drumIndex.userData.role = 'visible-drum-speed-index';
  drumRotor.add(drumIndex);
  root.add(drum);
  const drumShaft = makeShaft({ length: 1.25, radius: 0.105, axis: Z_AXIS });
  drumShaft.userData.role = 'motive-power-shaft-through-drum-A';
  root.add(drumShaft);

  const brakeAssembly = new THREE.Group();
  brakeAssembly.userData.role =
    'stationary-clamped-brake-and-balanced-torque-arm-D';
  const upperShoe = makeAnnularSector({
    color: PALETTE.accent,
    depth: brakeDepth,
    endAngle: shoeEndAngle,
    innerRadius: drumRadius,
    outerRadius: 0.64,
    role: 'single-upper-wooden-brake-block',
    startAngle: shoeStartAngle,
  });
  brakeAssembly.add(upperShoe);
  const lowerBandBacking = makeAnnularSector({
    color: PALETTE.ink,
    depth: brakeDepth * 0.86,
    endAngle: lowerBandEndAngle,
    innerRadius: drumRadius,
    outerRadius: 0.57,
    role: 'continuous-lower-band-or-chain-backing',
    startAngle: lowerBandStartAngle,
    z: -0.01,
  });
  brakeAssembly.add(lowerBandBacking);
  const strapCount = 7;
  const strapGap = THREE.MathUtils.degToRad(2.2);
  const strapPitch = lowerBandWrapAngle / strapCount;
  const lowerStraps = [];
  for (let index = 0; index < strapCount; index += 1) {
    const startAngle = lowerBandStartAngle + index * strapPitch
      + strapGap / 2;
    const endAngle = lowerBandStartAngle + (index + 1) * strapPitch
      - strapGap / 2;
    const strap = makeAnnularSector({
      color: index % 2 === 0 ? PALETTE.accent : PALETTE.brass,
      depth: brakeDepth,
      endAngle,
      innerRadius: 0.555,
      outerRadius: 0.68,
      role: 'articulated-lower-brake-strap',
      startAngle,
      z: 0.015,
    });
    strap.userData.strapIndex = index;
    lowerStraps.push(strap);
    brakeAssembly.add(strap);
  }
  const strapPins = [];
  for (let index = 0; index <= strapCount; index += 1) {
    const angle = lowerBandStartAngle + index * strapPitch;
    const pin = makeShaft({
      axis: Z_AXIS,
      color: PALETTE.ink,
      length: brakeDepth * 1.28,
      radius: 0.043,
    });
    pin.position.copy(polarPoint(0.68, angle, 0.015));
    pin.userData.role = 'lower-strap-hinge-pin';
    pin.userData.strapBoundaryIndex = index;
    strapPins.push(pin);
    brakeAssembly.add(pin);
  }

  const lever = makeBeam(
    new THREE.Vector3(leverLeftX, leverCenterY, leverPlaneZ),
    new THREE.Vector3(leverRightX, leverCenterY, leverPlaneZ),
    {
      color: PALETTE.frame,
      depth: leverDepth,
      thickness: leverThickness,
    },
  );
  lever.userData.role = 'horizontal-dynamometer-torque-arm-D';
  brakeAssembly.add(lever);
  const leftScrewX = sourceToWorld(sourceLeftClampScrew).x;
  const rightScrewX = sourceToWorld(sourceRightClampScrew).x;
  const screwBottomY = 0.32;
  const screwTopY = 0.86;
  const clampScrews = [leftScrewX, rightScrewX].map((x, index) => {
    const screw = makeShaft({
      axis: Y_AXIS,
      color: PALETTE.ink,
      length: screwTopY - screwBottomY,
      radius: 0.045,
    });
    screw.position.set(
      x,
      (screwTopY + screwBottomY) / 2,
      leverPlaneZ,
    );
    screw.userData.clampIndex = index;
    screw.userData.role = 'brake-pressure-adjusting-screw';
    brakeAssembly.add(screw);
    const nut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.105, 0.105, 0.1, 6),
      darkMaterial,
    );
    nut.position.set(x, screwTopY, leverPlaneZ);
    nut.userData.clampIndex = index;
    nut.userData.role = 'brake-pressure-adjusting-nut';
    brakeAssembly.add(nut);
    return { nut, screw };
  });
  const leftBandEnd = polarPoint(0.68, lowerBandStartAngle, leverPlaneZ);
  const rightBandEnd = polarPoint(0.68, lowerBandEndAngle, leverPlaneZ);
  const leftClampLower = new THREE.Vector3(
    leftScrewX,
    screwBottomY,
    leverPlaneZ,
  );
  const rightClampLower = new THREE.Vector3(
    rightScrewX,
    screwBottomY,
    leverPlaneZ,
  );
  const leftBandLink = makeDynamicLink({
    color: PALETTE.ink,
    depth: 0.11,
    jointRadius: 0.065,
    thickness: 0.065,
  });
  leftBandLink.userData.setEndpoints(leftBandEnd, leftClampLower);
  leftBandLink.userData.role = 'left-screw-to-band-end-link';
  const rightBandLink = makeDynamicLink({
    color: PALETTE.ink,
    depth: 0.11,
    jointRadius: 0.065,
    thickness: 0.065,
  });
  rightBandLink.userData.setEndpoints(rightBandEnd, rightClampLower);
  rightBandLink.userData.role = 'right-screw-to-band-end-link';
  brakeAssembly.add(leftBandLink, rightBandLink);
  const shoeHangers = [-0.28, 0.28].map((x, index) => {
    const lower = new THREE.Vector3(
      x,
      Math.sqrt(0.64 ** 2 - x ** 2),
      0.06,
    );
    const upper = new THREE.Vector3(x, leverCenterY, leverPlaneZ);
    const hanger = makeDynamicLink({
      color: PALETTE.ink,
      depth: 0.09,
      jointRadius: 0.045,
      thickness: 0.05,
    });
    hanger.userData.setEndpoints(lower, upper);
    hanger.userData.hangerIndex = index;
    hanger.userData.role = 'upper-shoe-to-lever-hanger';
    brakeAssembly.add(hanger);
    return hanger;
  });
  root.add(brakeAssembly);

  const hangerEye = new THREE.Mesh(
    new THREE.TorusGeometry(0.115, 0.03, 9, 36),
    darkMaterial,
  );
  hangerEye.position.copy(suspensionPoint);
  hangerEye.userData.role = 'scale-B-suspension-eye';
  root.add(hangerEye);
  const panCenter = new THREE.Vector3(
    suspensionPoint.x,
    sourceToWorld(sourceScalePanCenter).y,
    0.05,
  );
  const panWidth = 1.48;
  const panDepth = 0.82;
  const panThickness = 0.09;
  const scalePan = new THREE.Mesh(
    new THREE.BoxGeometry(panWidth, panThickness, panDepth),
    matte(PALETTE.frame, { metalness: 0.12, roughness: 0.62 }),
  );
  scalePan.position.copy(panCenter);
  scalePan.userData.role = 'hanging-scale-pan-B';
  root.add(scalePan);
  const panRimMaterial = matte(PALETTE.ink, { roughness: 0.58 });
  const panRims = [
    new THREE.Mesh(
      new THREE.BoxGeometry(panWidth, 0.1, 0.045),
      panRimMaterial,
    ),
    new THREE.Mesh(
      new THREE.BoxGeometry(panWidth, 0.1, 0.045),
      panRimMaterial,
    ),
    new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.1, panDepth),
      panRimMaterial,
    ),
    new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.1, panDepth),
      panRimMaterial,
    ),
  ];
  panRims[0].position.set(
    panCenter.x,
    panCenter.y + 0.08,
    panCenter.z + panDepth / 2,
  );
  panRims[1].position.set(
    panCenter.x,
    panCenter.y + 0.08,
    panCenter.z - panDepth / 2,
  );
  panRims[2].position.set(
    panCenter.x + panWidth / 2,
    panCenter.y + 0.08,
    panCenter.z,
  );
  panRims[3].position.set(
    panCenter.x - panWidth / 2,
    panCenter.y + 0.08,
    panCenter.z,
  );
  panRims.forEach((rim, index) => {
    rim.userData.rimIndex = index;
    rim.userData.role = 'scale-pan-raised-rim';
    root.add(rim);
  });
  const cableCorners = [
    new THREE.Vector3(
      panCenter.x - panWidth / 2,
      panCenter.y + 0.12,
      panCenter.z - panDepth / 2,
    ),
    new THREE.Vector3(
      panCenter.x - panWidth / 2,
      panCenter.y + 0.12,
      panCenter.z + panDepth / 2,
    ),
    new THREE.Vector3(
      panCenter.x + panWidth / 2,
      panCenter.y + 0.12,
      panCenter.z - panDepth / 2,
    ),
    new THREE.Vector3(
      panCenter.x + panWidth / 2,
      panCenter.y + 0.12,
      panCenter.z + panDepth / 2,
    ),
  ];
  const scaleCables = cableCorners.map((corner, index) => {
    const cable = makeDynamicCable({
      color: PALETTE.ink,
      maxSegments: 1,
      radius: 0.018,
    });
    cable.userData.setPoints([
      suspensionPoint.clone().add(new THREE.Vector3(0, -0.1, 0)),
      corner,
    ]);
    cable.userData.cableIndex = index;
    cable.userData.role = 'scale-pan-suspension-cable';
    root.add(cable);
    return cable;
  });
  const weightSpecifications = [
    { forceFraction: 0.22, height: 0.18, radius: 0.13, x: -0.42 },
    { forceFraction: 0.48, height: 0.36, radius: 0.18, x: 0 },
    { forceFraction: 0.30, height: 0.26, radius: 0.145, x: 0.38 },
  ];
  const scaleWeights = weightSpecifications.map((specification, index) => {
    const weight = new THREE.Mesh(
      new THREE.CylinderGeometry(
        specification.radius,
        specification.radius,
        specification.height,
        32,
      ),
      matte(PALETTE.driven, { metalness: 0.18, roughness: 0.54 }),
    );
    weight.position.set(
      panCenter.x + specification.x,
      panCenter.y + panThickness / 2 + specification.height / 2,
      panCenter.z,
    );
    weight.userData.force = weightForce * specification.forceFraction;
    weight.userData.forceFraction = specification.forceFraction;
    weight.userData.role = 'calibrated-scale-weight';
    weight.userData.weightIndex = index;
    root.add(weight);
    return weight;
  });

  // Each stop block runs back from the lever's plane to the fixed post
  // behind it (front face z = -0.11), so C and C' are carried by the post.
  const stopBack = -0.115, stopFront = leverPlaneZ + 0.17;
  const upperStop = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, stopHeight, stopFront - stopBack),
    matte(PALETTE.ink, { metalness: 0.14, roughness: 0.6 }),
  );
  upperStop.position.set(stopX, upperStopCenterY, (stopFront + stopBack) / 2);
  upperStop.userData.fixed = true;
  upperStop.userData.role = 'upper-horizontal-position-stop-C-prime';
  const lowerStop = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, stopHeight, stopFront - stopBack),
    upperStop.material,
  );
  lowerStop.position.set(stopX, lowerStopCenterY, (stopFront + stopBack) / 2);
  lowerStop.userData.fixed = true;
  lowerStop.userData.role = 'lower-horizontal-position-stop-C';
  const stopPost = makeBeam(
    new THREE.Vector3(stopX, lowerStopCenterY - 0.22, -0.18),
    new THREE.Vector3(stopX, upperStopCenterY + 0.22, -0.18),
    { color: PALETTE.frame, depth: 0.14, thickness: 0.1 },
  );
  stopPost.userData.role = 'fixed-stop-support';
  root.add(upperStop, lowerStop, stopPost);

  const leverCenterlineYAtAngle = (angle) => (
    stopX * Math.sin(angle) + leverCenterY * Math.cos(angle)
  );
  const solveStopAngle = (targetY, lowerAngle, upperAngle) => {
    let lower = lowerAngle;
    let upper = upperAngle;
    for (let iteration = 0; iteration < 80; iteration += 1) {
      const middle = (lower + upper) / 2;
      if (leverCenterlineYAtAngle(middle) < targetY) lower = middle;
      else upper = middle;
    }
    return (lower + upper) / 2;
  };
  const upperLeverAngleLimit = solveStopAngle(
    upperStopSurfaceY - leverThickness / 2,
    0,
    THREE.MathUtils.degToRad(15),
  );
  const lowerLeverAngleLimit = solveStopAngle(
    lowerStopSurfaceY + leverThickness / 2,
    THREE.MathUtils.degToRad(-15),
    0,
  );
  const stopClearancesAtAngle = (angle) => {
    const centerY = leverCenterlineYAtAngle(angle);
    return {
      lower: centerY - leverThickness / 2 - lowerStopSurfaceY,
      upper: upperStopSurfaceY - centerY - leverThickness / 2,
    };
  };

  const stateAtTime = (time) => {
    const drumAngle = time * drumAngularSpeed;
    const leverAngle = 0;
    const stopClearances = stopClearancesAtAngle(leverAngle);
    return {
      balanceResidualTorque: frictionTorque - weightForce * leverArm,
      brakeAssemblyAngularSpeed: 0,
      clampNormalForce,
      drumAngle,
      drumAngularSpeed,
      drumTurns: drumAngle / fullTurn,
      frictionPower: frictionTorque * drumAngularSpeed,
      frictionTorque,
      frictionWork: frictionTorque * drumAngle,
      leverAngle,
      measuredPower,
      shaftRpm,
      sourcePose: Math.abs(time) < 1e-12,
      stage: 'steady-balanced-prony-brake-power-measurement',
      stopClearances,
      suspensionTangentialSpeed,
      weightForce,
    };
  };

  root.userData.archetype =
    'balanced-prony-brake-dynamometer-with-weighted-torque-arm';
  root.userData.blocks = {
    brakeAssembly,
    clampScrews,
    drum,
    drumBody,
    drumFaceRing,
    drumIndex,
    drumShaft,
    hangerEye,
    leftBandLink,
    lever,
    lowerBandBacking,
    lowerStop,
    lowerStraps,
    panRims,
    rightBandLink,
    scaleCables,
    scalePan,
    scaleWeights,
    shoeHangers,
    stopPost,
    strapPins,
    upperShoe,
    upperStop,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-1.15, -2.32, -0.58),
    new THREE.Vector3(4.62, 1.18, 0.78),
  );
  root.userData.geometry = {
    brakeDepth,
    clampNormalForce,
    cyclePeriod,
    drumCenter,
    drumDepth,
    drumRadius,
    frictionCoefficient,
    leverArm,
    leverCenterY,
    leverDepth,
    leverLeftX,
    leverPlaneZ,
    leverRightX,
    leverThickness,
    lowerBandEndAngle,
    lowerBandStartAngle,
    lowerBandWrapAngle,
    lowerLeverAngleLimit,
    lowerStopCenterY,
    lowerStopSurfaceY,
    measuredPower,
    panCenter,
    shaftRpm,
    shoeEndAngle,
    shoeStartAngle,
    stopHeight,
    stopX,
    suspensionPoint,
    upperLeverAngleLimit,
    upperShoeWrapAngle,
    upperStopCenterY,
    upperStopSurfaceY,
  };
  root.userData.mechanism =
    'a-smooth-rotating-drum-slides-inside-a-stationary-clamped-shoe-and-strap-whose-friction-moment-is-balanced-by-scale-weights-on-arm-D';
  root.userData.measurement = {
    clampNormalForce,
    driveAssumption:
      'external motive power maintains steady shaft speed against the measured brake torque',
    frictionCoefficient,
    frictionTorque,
    leverArm,
    measuredPower,
    powerIdentity:
      'friction torque times shaft angular speed equals scale weight times the suspension-point velocity if attached to the shaft',
    shaftRpm,
    scalePanTared: true,
    suspensionTangentialSpeed,
    weightForce,
  };
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'The official Movement 244 page marks its animation unavailable.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate244: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'one smooth rotating drum A, one stationary upper wooden block, one articulated lower strap, two clamp screws, one torque arm D, two fixed stops C and C-prime, and one weighted hanging scale B',
      officialAnimationAvailable: false,
      rasterDrumCenter: sourceDrumCenter,
      rasterDrumRadius: 42,
      rasterLeftClampScrew: sourceLeftClampScrew,
      rasterLeverLeft: sourceLeverLeft,
      rasterLeverRight: sourceLeverRight,
      rasterLowerStop: sourceLowerStop,
      rasterRightClampScrew: sourceRightClampScrew,
      rasterScalePanCenter: sourceScalePanCenter,
      rasterSuspension: sourceSuspension,
      rasterUpperStop: sourceUpperStop,
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 63,
      edition: 21,
      illustrationPage: 62,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.stopClearancesAtAngle = stopClearancesAtAngle;
  root.userData.transmission = {
    brakeAssemblyRotatesWithDrum: false,
    brakeType: 'prony-brake-absorption-dynamometer',
    clampAdjustmentScrewCount: 2,
    drumDirectionViewedFromFront: 'counterclockwise',
    frictionInterface: 'continuous-sliding-contact',
    lowerArticulatedStrapCount: strapCount,
    scaleWeightBalancesFrictionMoment: true,
    stopCount: 2,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    drumRotor.rotation.z = state.drumAngle;
    drumShaft.userData.rotor.rotation.z = state.drumAngle;
    brakeAssembly.rotation.z = state.leverAngle;
    drum.userData.angularSpeed = state.drumAngularSpeed;
    brakeAssembly.userData.angularSpeed = 0;
    root.userData.contacts = {
      articulatedBandToDrum: {
        active: true,
        normalForce: clampNormalForce * 0.65,
        relativeSurfaceSpeed: drumRadius * drumAngularSpeed,
        sliding: true,
        wrapAngle: lowerBandWrapAngle,
      },
      lowerStopToLever: {
        active: state.stopClearances.lower <= 1e-12,
        clearance: state.stopClearances.lower,
      },
      upperShoeToDrum: {
        active: true,
        normalForce: clampNormalForce * 0.35,
        relativeSurfaceSpeed: drumRadius * drumAngularSpeed,
        sliding: true,
        wrapAngle: upperShoeWrapAngle,
      },
      upperStopToLever: {
        active: state.stopClearances.upper <= 1e-12,
        clearance: state.stopClearances.upper,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(5.6, 4.1, 10.5),
  };
}

// Brown draws the belts, ropes and sheaves of these plates without the white
// phase-index stripes, rim patches, belt markers or rope beads the shared
// pulley and belt primitives add for legibility, and none of these movements
// has a white part the plate does draw. Visible marks are detached (not
// hidden) so framing ignores them; their userData handles stay so motion checks
// still read the positions the removed marks would have had. Marks a factory
// already hides stay as its invisible kinematic references.
const UNDRAWN_WHITE_INDEX_IDS = new Set([
  ...Array.from({ length: 23 }, (_, index) => index + 1), 134, 227, 228, 229, 242, 243, 244,
]);
const WHITE_INDEX_COLOR = new THREE.Color(PALETTE.white);

function removeUndrawnWhiteIndexMarks(root) {
  const doomed = [];
  root.traverse((object) => {
    if (!object.isMesh || !object.visible || object.userData.keepWhite) return;
    const materials = [object.material].flat();
    if (materials.every((material) => material?.color?.equals(WHITE_INDEX_COLOR))) doomed.push(object);
  });
  for (const object of doomed) object.removeFromParent();
  root.userData.removedWhiteIndexMarks = doomed.length;
}

// Brown draws A's shaft cut in section: a hatched circle inside the smooth
// pulley. The hatching is notation; the model shows the plain shaft end, so
// the drum's steady rotation has no visible cue (the lever and scale stay
// balanced at rest by design).
// The shaft's front stub is set back flush with the hub face, as a section.
// Brown draws the four scale-pan cords as plain cord lines: render each as
// the shared laid rope along its final (static) span, in place of the plain
// cylinder the clamp correction positioned.
function layProny244Cables(root) {
  const cordMaterial = matte(PALETTE.belt, { metalness: 0.04, roughness: 0.72 });
  for (const cable of root.userData.blocks.scaleCables) {
    const segment = cable.children[0];
    const offset = new THREE.Vector3(0, segment.scale.y / 2, 0).applyQuaternion(segment.quaternion);
    const upper = segment.position.clone().add(offset);
    const lower = segment.position.clone().sub(offset);
    // Thick enough (0.035, like the other laid cords) for its three strands
    // to read, in the shared cord colour rather than ink.
    const rope = makeLaidRopeMesh(new THREE.LineCurve3(upper, lower), cordMaterial,
      { radius: 0.035 });
    rope.userData.role = 'scale-pan-suspension-cable';
    for (const child of cable.children) child.visible = false;
    cable.add(rope);
    cable.userData.mesh = rope;
  }
}

function addProny244ShaftSection(root) {
  const { blocks } = root.userData;
  const rotor = blocks.drum.parent;
  const hubFrontZ = 0.35;
  blocks.drumShaft.position.z = hubFrontZ - 0.63;
  const radius = 0.165;
  // Brown hatches the cut end of shaft A; the model shows the plain end of
  // the shaft itself, in the shaft's own material (no hatch strokes).
  const face = new THREE.Mesh(
    plate(poly(circle([0, 0], radius, 96)), hubFrontZ + 0.002, hubFrontZ + 0.01),
    blocks.drumShaft.userData.rotor.children[0].material);
  face.userData.role = 'shaft-A-plain-end-face';
  rotor.add(face);
  blocks.shaftSection = { face };
}

export function createAuthoredBeltMovement(movement) {
  let result;
  switch (movement.id) {
    case 1: result = simpleBeltTransmission(false); break;
    case 2: result = simpleBeltTransmission(true); break;
    case 3: result = rightAngleGuides(); break;
    case 4: result = rightAngleCrossed(); break;
    case 5: result = tighteningPulley(); break;
    case 6: result = oscillatingSector(); break;
    case 7: result = reversingBevelDrive(); break;
    case 8: result = steppedSpeedDrive(); break;
    case 9: result = coneSpeedDrive(false); break;
    case 10: result = coneSpeedDrive(true); break;
    case 11: result = rightAngleWithoutGuides(); break;
    case 12: result = fixedHoist(); break;
    case 13: result = singleMovableHoist(); break;
    case 14: result = blockAndTackle(); break;
    case 15: result = whitePulleys(); break;
    case 16: result = spanishBartonFourToOne(); break;
    case 17: result = spanishBartonFiveToOne(); break;
    case 18: result = twoFixedOneMovable(); break;
    case 19: result = sixPulleyCascade(); break;
    case 20: result = loadAnchoredSevenToOneCascade(); break;
    case 21: result = loadAnchoredThreeToOneCascade(); break;
    case 22: result = ceilingAnchoredEightToOneCascade(); break;
    case 23: result = compensatedMovableDrive(); break;
    case 124: result = fiddleDrill(); break;
    case 126: result = fixedPulleyBellCrankForceRedirector(); break;
    case 129: result = chineseDifferentialWindlass(); break;
    case 134: result = singleWrappedRopeDrumDrive(); break;
    case 141: result = endlessBandSaw(); break;
    // 227-229: each finite chain is whole (a hoist stroke); no pipes or deck.
    case 227: result = alternatingPlaneLinkChainPulley(movement); correctChainDrive(result, 227); break;
    case 228: result = ladderRungChainPulley(); correctChainDrive(result, 228); break;
    case 229: result = toothedLinkChainWheel(); correctChainDrive(result, 229); break;
    case 242: result = leverContractedCraneBandBrake(movement); break;
    case 243: result = horizontalDriverToTwinVerticalShafts(movement); break;
    case 244: result = pronyBrakeDynamometer(movement); correctClampParts(result, 244); addProny244ShaftSection(result.root); layProny244Cables(result.root); break;
    default: return null;
  }
  if (movement.id >= 14 && movement.id <= 22) result = addTackleHaulingHand(result);
  if (UNDRAWN_WHITE_INDEX_IDS.has(movement.id)) removeUndrawnWhiteIndexMarks(result.root, movement.id);
  markShadows(result.root);
  result.root.traverse((object) => {
    if (!object.userData.cameraFramingEnvelope && !object.userData.noShadow) {
      return;
    }
    object.castShadow = false;
    object.receiveShadow = false;
  });
  result.root.userData.fidelity = 'authored';
  return result;
}
