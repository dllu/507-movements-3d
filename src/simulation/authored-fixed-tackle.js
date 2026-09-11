import * as THREE from 'three';
import { makeHoistBlock, makeHoistLoad } from './hoist-hardware.js';
import { circularRopeArc, contactState, externalTangents, rotationFromContact } from './rope-kinematics.js';
import { PALETTE, makeBeam, makeDynamicMovingBelt, markShadows, matte, setSpin } from './primitives.js';

const Z_AXIS = new THREE.Vector3(0, 0, 1);

export function twoFixedOneMovable() {
  const root = new THREE.Group();
  const upperRadius = 0.48;
  const lowerFixedRadius = 0.30;
  const movableRadius = 0.36;
  const upperY = 1.85;
  const lowerFixedY = 0.78;
  const movableBaseY = -1.85;
  const movableX = 0;
  const upperX = movableX + movableRadius - upperRadius;
  const lowerFixedX = movableX - movableRadius + lowerFixedRadius;
  const becketZ = 0;
  const upperFixed = makeHoistBlock({ radius: upperRadius, color: PALETTE.driver, upperEyeZ: 0 });
  const lowerFixed = makeHoistBlock({ radius: lowerFixedRadius, color: PALETTE.accent });
  const movable = makeHoistBlock({ radius: movableRadius, color: PALETTE.driven,
    upperEyeZ: becketZ, upperEyeScale: 0.6, lowerHook: true, lowerHookScale: 0.5 });
  upperFixed.position.set(upperX, upperY, 0);
  lowerFixed.position.set(lowerFixedX, lowerFixedY, 0);
  movable.position.set(movableX, movableBaseY, 0);
  const links = [-1, 1].map((sign) => {
    const link = makeBeam(new THREE.Vector3(0, 0, sign * lowerFixed.userData.cheekZ),
      new THREE.Vector3(upperX - lowerFixedX, upperY - lowerFixedY, sign * upperFixed.userData.cheekZ),
      { thickness: 0.065, depth: 0.055, color: PALETTE.ink });
    lowerFixed.userData.frame.add(link);
    return link;
  });
  const support = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 0.7), matte(PALETTE.frame));
  support.position.set(upperX, 2.79, 0);
  const mountingStem = makeBeam(upperFixed.position.clone().add(upperFixed.userData.upperAttachment),
    new THREE.Vector3(upperX, 2.75, 0), { thickness: 0.055, depth: 0.055, color: PALETTE.ink });
  const weight = makeHoistLoad({ radius: 0.31, height: 0.48 });
  const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.14, 8, 16), matte(PALETTE.accent));
  handle.rotation.z = -0.32;
  root.add(upperFixed, lowerFixed, movable, support, mountingStem, weight, handle);
  const effortDirection = new THREE.Vector3(-Math.sin(0.32), -Math.cos(0.32), 0);
  const upperExit = upperFixed.position.clone().add(new THREE.Vector3(
    -Math.cos(0.32) * upperRadius, Math.sin(0.32) * upperRadius, 0));
  const upperRight = upperFixed.position.clone().add(new THREE.Vector3(upperRadius, 0, 0));
  const lowerLeft = lowerFixed.position.clone().add(new THREE.Vector3(-lowerFixedRadius, 0, 0));
  const effortBaseLength = 1.32;
  const pathAt = (travel, targetLength = null) => {
    const movableCenter = new THREE.Vector3(movableX, movableBaseY + travel, 0);
    const becket = movableCenter.clone().add(movable.userData.upperAttachment);
    const lowerEntry = externalTangents(lowerFixed.position, becket, lowerFixedRadius)
      .sort((a, b) => b.x - a.x)[0];
    const lowerArc = circularRopeArc(lowerFixed.position, lowerEntry, lowerLeft, Z_AXIS,
      lowerEntry.clone().sub(becket).setZ(0).normalize());
    const movableLeft = movableCenter.clone().add(new THREE.Vector3(-movableRadius, 0, 0));
    const movableRight = movableCenter.clone().add(new THREE.Vector3(movableRadius, 0, 0));
    const movableArc = circularRopeArc(movableCenter, movableLeft, movableRight, Z_AXIS, new THREE.Vector3(0, -1, 0));
    const upperArc = circularRopeArc(upperFixed.position, upperRight, upperExit, Z_AXIS, new THREE.Vector3(0, 1, 0));
    const curve = new THREE.CurvePath();
    const becketSpan = new THREE.LineCurve3(becket, lowerEntry);
    curve.add(becketSpan);
    curve.add(lowerArc);
    curve.add(new THREE.LineCurve3(lowerLeft, movableLeft));
    curve.add(movableArc);
    curve.add(new THREE.LineCurve3(movableRight, upperRight));
    curve.add(upperArc);
    const effortLength = targetLength === null ? effortBaseLength : targetLength - curve.getLength();
    const effort = upperExit.clone().addScaledVector(effortDirection, effortLength);
    curve.add(new THREE.LineCurve3(upperExit, effort));
    return { curve, becket, becketSpan, lowerArc, movableArc, upperArc, effort, effortLength, movableCenter };
  };
  const initial = pathAt(0);
  const nominalRopeLength = initial.curve.getLength();
  const rope = makeDynamicMovingBelt(initial.curve, { closed: false, radius: 0.032, markerCount: 0 });
  rope.userData.mechanismRope = true;
  root.add(rope);
  const definitions = {
    lowerFixed: { rope: 'rope', index: 1, radius: lowerFixedRadius },
    movable: { rope: 'rope', index: 3, radius: movableRadius },
    upperFixed: { rope: 'rope', index: 5, radius: upperRadius },
  };
  for (const definition of Object.values(definitions)) definition.initial = contactState(initial.curve, definition.index);
  const anglesAt = (path) => Object.fromEntries(Object.entries(definitions).map(([name, definition]) =>
    [name, rotationFromContact(path.curve, definition.index, definition.radius, definition.initial)]));
  root.userData.mechanism = 'two-fixed-one-movable-three-to-one';
  root.userData.cameraFov = 18;
  root.userData.nominalRopeLength = nominalRopeLength;
  root.userData.pulleys = { upperFixed, lowerFixed, movable };
  root.userData.ropes = { rope };
  root.userData.blocks = { upperFixed, lowerFixed, movable, weight, support, handle, rope, links };
  root.userData.contactDefinitions = definitions;
  root.userData.geometry = { upperRadius, lowerFixedRadius, movableRadius, becketZ, movableBaseY,
    effortDirection: effortDirection.clone() };
  const update = (time) => {
    const frequency = 0.55;
    const amplitude = 0.14;
    const travel = Math.sin(time * frequency) * amplitude;
    const loadSpeed = Math.cos(time * frequency) * amplitude * frequency;
    const path = pathAt(travel, nominalRopeLength);
    const delta = 1e-5;
    const before = pathAt(travel - delta, nominalRopeLength);
    const after = pathAt(travel + delta, nominalRopeLength);
    const effortDerivative = after.effort.clone().sub(before.effort).multiplyScalar(1 / (2 * delta));
    const angles = anglesAt(path);
    const beforeAngles = anglesAt(before);
    const afterAngles = anglesAt(after);
    const speeds = {};
    for (const [name, pulley] of Object.entries(root.userData.pulleys)) {
      setSpin(pulley, angles[name]);
      speeds[name] = (afterAngles[name] - beforeAngles[name]) / (2 * delta) * loadSpeed;
    }
    movable.position.copy(path.movableCenter);
    weight.position.copy(movable.position).add(movable.userData.lowerAttachment).add(new THREE.Vector3(0, -0.2, 0));
    rope.userData.setCurve(path.curve);
    handle.position.copy(path.effort);
    const haulPerLoad = effortDerivative.dot(effortDirection);
    const becketVerticalFraction = path.becketSpan.getTangent(0).y;
    root.userData.attachments = { effort: path.effort, load: path.movableCenter, loadBecket: path.becket };
    root.userData.contacts = { lowerFixedArc: path.lowerArc, movableArc: path.movableArc, upperArc: path.upperArc };
    root.userData.becketSpan = path.becketSpan;
    root.userData.kinematics = {
      mechanicalAdvantage: 3, supportingSegments: 3, nominalEffortForceOverLoad: 1 / 3,
      effortForceOverLoad: 1 / haulPerLoad, haulPerLoad, haulSpeed: haulPerLoad * loadSpeed,
      effortDisplacement: path.effort.y - initial.effort.y,
      effortPerLoad: effortDerivative.y, effortSpeed: effortDerivative.y * loadSpeed,
      loadDisplacement: travel, loadSpeed, ropeLength: path.curve.getLength(),
      upperRadius, lowerFixedRadius, movableRadius,
      upperFixedAngularSpeed: speeds.upperFixed, lowerFixedAngularSpeed: speeds.lowerFixed,
      loadAngularSpeed: speeds.movable, directLoadForceContributions: [1, 1, becketVerticalFraction],
      terminalFleetAngle: Math.acos(THREE.MathUtils.clamp(path.becketSpan.getTangent(1)
        .dot(path.lowerArc.getTangent(0)), -1, 1)),
    };
  };
  update(0);
  markShadows(root);
  return { root, update, cameraDirection: new THREE.Vector3(0.3, 0.15, 10) };
}
