import * as THREE from 'three';
import { makeHoistBlock, makeHoistLoad } from './hoist-hardware.js';
import { circularRopeArc, contactState, externalTangents, rotationFromContact } from './rope-kinematics.js';
import { PALETTE, makeBeam, makeDynamicMovingBelt, markShadows, matte, setSpin } from './primitives.js';

const Z_AXIS = new THREE.Vector3(0, 0, 1);
const DOWN = new THREE.Vector3(0, -1, 0);
const UP = new THREE.Vector3(0, 1, 0);

function spanishBarton(nominalAdvantage) {
  const five = nominalAdvantage === 5;
  const root = new THREE.Group();
  const radius = 0.44;
  const planeSeparation = 0.44;
  const fixedY = 1.72;
  const loadBaseY = -1.02;
  const carrierBaseY = 0.28;
  const loadX = -0.64;
  const carrierX = loadX + radius * (five ? 3 : 2);
  const fixedX = five ? loadX + radius * 2 : (loadX + carrierX) / 2;
  const fixedZ = five ? 0 : planeSeparation;
  const carrierZ = five ? planeSeparation : 0;
  const fixed = makeHoistBlock({ radius, color: PALETTE.driver, upperEyeZ: 0 });
  const load = makeHoistBlock({ radius, color: PALETTE.driven, lowerHook: true,
    ...(five ? { pinBecketZ: planeSeparation } : { upperEyeZ: planeSeparation }) });
  const carrier = makeHoistBlock({ radius, color: PALETTE.accent,
    upperEyeZ: five ? -planeSeparation : planeSeparation });
  fixed.position.set(fixedX, fixedY, fixedZ);
  load.position.set(loadX, loadBaseY, 0);
  carrier.position.set(carrierX, carrierBaseY, carrierZ);
  const weight = makeHoistLoad({ radius: 0.40, height: 0.60 });
  const anchor = new THREE.Vector3(loadX - radius, 2.48, 0);
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.12, 1.05), matte(PALETTE.frame));
  ceiling.position.set(five ? 0 : -0.25, 2.62, 0.2);
  const anchorEye = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.022, 12, 40), matte(PALETTE.ink));
  anchorEye.position.copy(anchor).add(new THREE.Vector3(0, 0.075, 0));
  const fixedAttachment = fixed.position.clone().add(fixed.userData.upperAttachment);
  const mountingStem = makeBeam(fixedAttachment,
    new THREE.Vector3(fixedX, 2.59, fixedZ), { thickness: 0.055, depth: 0.055, color: PALETTE.ink });
  root.add(fixed, load, carrier, weight, ceiling, anchorEye, mountingStem);
  const effortDirection = five ? new THREE.Vector3(Math.sin(0.30), -Math.cos(0.30), 0) : DOWN.clone();
  const effortBaseLength = five ? 2.1 : 2.4;
  const attachmentAt = (block, x, y, z) => new THREE.Vector3(x, y, z).add(block.userData.upperAttachment);
  const pathAt = (travel, ropeLengths = null) => {
    const loadY = loadBaseY + travel;
    const carrierY = carrierBaseY - (five ? 2 : 1) * travel;
    const loadCenter = new THREE.Vector3(loadX, loadY, 0);
    const fixedCenter = new THREE.Vector3(fixedX, fixedY, fixedZ);
    const carrierCenter = new THREE.Vector3(carrierX, carrierY, carrierZ);
    const loadBecket = attachmentAt(load, loadX, loadY, 0);
    const carrierBecket = attachmentAt(carrier, carrierX, carrierY, carrierZ);
    const loadLeft = loadCenter.clone().add(new THREE.Vector3(-radius, 0, 0));
    const loadRight = loadCenter.clone().add(new THREE.Vector3(radius, 0, 0));
    const fixedLeft = fixedCenter.clone().add(new THREE.Vector3(-radius, 0, 0));
    const fixedRight = fixedCenter.clone().add(new THREE.Vector3(radius, 0, 0));
    const carrierLeft = carrierCenter.clone().add(new THREE.Vector3(-radius, 0, 0));
    const carrierExit = carrierCenter.clone().addScaledVector(
      new THREE.Vector3(-effortDirection.y, effortDirection.x, 0), radius);
    const primary = new THREE.CurvePath();
    const secondary = new THREE.CurvePath();
    const loadArc = circularRopeArc(loadCenter, loadLeft, loadRight, Z_AXIS, DOWN);
    const fixedArc = circularRopeArc(fixedCenter, fixedLeft, fixedRight, Z_AXIS, UP);
    primary.add(new THREE.LineCurve3(anchor, loadLeft));
    primary.add(loadArc);
    let carrierArc;
    if (five) {
      primary.add(new THREE.LineCurve3(loadRight, fixedLeft));
      primary.add(fixedArc);
      primary.add(new THREE.LineCurve3(fixedRight, carrierBecket));
      carrierArc = externalTangents(carrierCenter, loadBecket, radius).map((point) =>
        circularRopeArc(carrierCenter, point, carrierExit, Z_AXIS, point.clone().sub(loadBecket).normalize()))
        .sort((a, b) => a.getTangent(1).distanceTo(effortDirection) - b.getTangent(1).distanceTo(effortDirection))[0];
      secondary.add(new THREE.LineCurve3(loadBecket, carrierArc.getPoint(0)));
      secondary.add(carrierArc);
    } else {
      carrierArc = circularRopeArc(carrierCenter, carrierLeft, carrierExit, Z_AXIS, UP);
      primary.add(new THREE.LineCurve3(loadRight, carrierLeft));
      primary.add(carrierArc);
      secondary.add(new THREE.LineCurve3(loadBecket, fixedLeft));
      secondary.add(fixedArc);
      secondary.add(new THREE.LineCurve3(fixedRight, carrierBecket));
    }
    const hauling = five ? secondary : primary;
    const effortLength = ropeLengths === null ? effortBaseLength
      : ropeLengths[five ? 'secondary' : 'primary'] - hauling.getLength();
    const effort = carrierExit.clone().addScaledVector(effortDirection, effortLength);
    hauling.add(new THREE.LineCurve3(carrierExit, effort));
    return { primary, secondary, loadArc, fixedArc, carrierArc, loadBecket, carrierBecket,
      loadY, carrierY, effort, effortLength };
  };
  const initial = pathAt(0);
  const nominalRopeLengths = { primary: initial.primary.getLength(), secondary: initial.secondary.getLength() };
  const primary = makeDynamicMovingBelt(initial.primary, { closed: false, radius: 0.032, markerCount: 0 });
  const secondary = makeDynamicMovingBelt(initial.secondary, { closed: false, radius: 0.032, markerCount: 0 });
  primary.userData.mechanismRope = true;
  secondary.userData.mechanismRope = true;
  primary.userData.ropeStage = five ? 'primary' : 'hauling';
  secondary.userData.ropeStage = five ? 'secondary' : 'interblock';
  root.add(primary, secondary);
  const contactDefinitions = {
    load: { rope: 'primary', index: 1 },
    fixed: { rope: five ? 'primary' : 'secondary', index: five ? 3 : 1 },
    carrier: { rope: five ? 'secondary' : 'primary', index: five ? 1 : 3 },
  };
  for (const definition of Object.values(contactDefinitions)) {
    definition.initial = contactState(initial[definition.rope], definition.index);
  }
  const anglesAt = (path) => Object.fromEntries(Object.entries(contactDefinitions).map(([name, definition]) =>
    [name, rotationFromContact(path[definition.rope], definition.index, radius, definition.initial)]));
  root.userData.mechanism = five ? 'spanish-barton-five-to-one' : 'spanish-barton-four-to-one';
  root.userData.cameraFov = 18;
  root.userData.pulleys = { fixed, load, carrier };
  root.userData.ropes = five ? { primary, secondary } : { hauling: primary, interblock: secondary };
  root.userData.nominalRopeLengths = five ? nominalRopeLengths
    : { hauling: nominalRopeLengths.primary, interblock: nominalRopeLengths.secondary };
  root.userData.blocks = { fixed, load, carrier, weight, ceiling, anchorEye };
  root.userData.contactDefinitions = contactDefinitions;
  root.userData.geometry = { radius, fixedY, loadBaseY, carrierBaseY, loadX, carrierX, fixedX,
    planeSeparation, effortDirection: effortDirection.clone() };
  const update = (time) => {
    const frequency = five ? 0.52 : 0.5;
    const amplitude = five ? 0.12 : 0.14;
    const travel = Math.sin(time * frequency) * amplitude;
    const loadSpeed = Math.cos(time * frequency) * amplitude * frequency;
    const path = pathAt(travel, nominalRopeLengths);
    const delta = 1e-5;
    const before = pathAt(travel - delta, nominalRopeLengths);
    const after = pathAt(travel + delta, nominalRopeLengths);
    const effortDerivative = after.effort.clone().sub(before.effort).multiplyScalar(1 / (2 * delta));
    const angles = anglesAt(path);
    const beforeAngles = anglesAt(before);
    const afterAngles = anglesAt(after);
    const speeds = {};
    for (const [name, pulley] of Object.entries(root.userData.pulleys)) {
      setSpin(pulley, angles[name]);
      speeds[name] = (afterAngles[name] - beforeAngles[name]) / (2 * delta) * loadSpeed;
    }
    load.position.y = path.loadY;
    carrier.position.y = path.carrierY;
    weight.position.copy(load.position).add(load.userData.lowerAttachment).add(new THREE.Vector3(0, -0.20, 0));
    primary.userData.setCurve(path.primary);
    secondary.userData.setCurve(path.secondary);
    const haulPerLoad = effortDerivative.dot(effortDirection);
    const becketVerticalFraction = path.carrierArc.getTangent(0).y;
    const primaryTensionOverEffort = five ? becketVerticalFraction - effortDirection.y : 1;
    const directLoadForceContributions = five
      ? [primaryTensionOverEffort, primaryTensionOverEffort, becketVerticalFraction] : [1, 1, 2];
    root.userData.attachments = { ceilingAnchor: anchor.clone(), effort: path.effort,
      load: load.position.clone(), loadTerminal: path.loadBecket, lowerBecket: path.loadBecket,
      carrierTerminal: path.carrierBecket, interstageTerminal: path.carrierBecket };
    root.userData.contacts = { loadArc: path.loadArc, fixedArc: path.fixedArc, carrierArc: path.carrierArc };
    root.userData.kinematics = {
      mechanicalAdvantage: nominalAdvantage, nominalEffortForceOverLoad: 1 / nominalAdvantage,
      effortForceOverLoad: 1 / haulPerLoad, haulPerLoad, haulSpeed: haulPerLoad * loadSpeed,
      effortDisplacement: path.effort.y - initial.effort.y,
      effortPerLoad: effortDerivative.y, effortSpeed: effortDerivative.y * loadSpeed,
      loadDisplacement: travel, loadSpeed, carrierDisplacement: path.carrierY - carrierBaseY,
      carrierPerLoad: five ? -2 : -1, carrierSpeed: (five ? -2 : -1) * loadSpeed,
      fixedRadius: radius, loadRadius: radius, carrierRadius: radius,
      fixedAngularSpeed: speeds.fixed, loadAngularSpeed: speeds.load, carrierAngularSpeed: speeds.carrier,
      directLoadForceContributions,
      ...(five ? {
        primaryRopeLength: path.primary.getLength(), secondaryRopeLength: path.secondary.getLength(),
        primaryTensionOverEffort, secondaryTensionOverEffort: 1,
      } : {
        haulingRopeLength: path.primary.getLength(), interblockRopeLength: path.secondary.getLength(),
        haulingTensionOverEffort: 1, interblockTensionOverEffort: 2,
      }),
    };
  };
  update(0);
  markShadows(root);
  return { root, update, cameraDirection: new THREE.Vector3(0.3, 0.15, 10) };
}

export const spanishBartonFourToOne = () => spanishBarton(4);
export const spanishBartonFiveToOne = () => spanishBarton(5);
