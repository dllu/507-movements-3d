import * as THREE from 'three';
import { makeHoistBlock, makeHoistLoad } from './hoist-hardware.js';
import { circularRopeArc, contactState, rotationFromContact } from './rope-kinematics.js';
import { PALETTE, makeBeam, makeDynamicMovingBelt, markShadows, matte, setSpin } from './primitives.js';

const Z_AXIS = new THREE.Vector3(0, 0, 1);

function loadWithEyes(anchorXs) {
  const load = new THREE.Group();
  const centerX = (anchorXs[0] + anchorXs.at(-1)) / 2;
  const radius = (anchorXs.at(-1) - anchorXs[0]) / 2 + 0.3;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.48, 80), matte(PALETTE.driven));
  body.position.set(centerX, -0.24, 0);
  load.add(body);
  const eyes = anchorXs.map((x) => {
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.022, 12, 40), matte(PALETTE.ink));
    eye.position.set(x, 0.08, 0);
    // A short cast boss on the weight's top seats the eye's foot.
    const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.05, 28), matte(PALETTE.ink));
    boss.position.set(x, 0.015, 0);
    boss.userData.role = 'weight-eye-boss';
    load.add(eye, boss);
    return eye;
  });
  load.userData.body = body;
  return { load, eyes, centerX };
}

function loadAnchoredCascade(id) {
  const root = new THREE.Group();
  const threeStages = id === 20;
  const radii = threeStages ? [0.4, 0.4, 0.4] : [0.34, 0.46];
  const xs = threeStages ? [-0.4, 0, 0.4] : [-0.16, 0.3];
  const baseYs = threeStages ? [-0.36, 0.94, 2.08] : [0.54, 1.9];
  const factors = threeStages ? [-3, -1, 0] : [-1, 0];
  const nominalRatio = threeStages ? 7 : 3;
  const count = radii.length;
  const loadBaseY = -1.85;
  const anchorLift = 0.16;
  const angle = threeStages ? 0.35 : 0.2;
  const effortDirection = new THREE.Vector3(-Math.sin(angle), -Math.cos(angle), 0);
  const effortBaseLength = threeStages ? 2.08 : 1.78;
  const upperPulleys = radii.map((radius, index) => {
    const pulley = makeHoistBlock({ radius, color: index === count - 1 ? PALETTE.driver : PALETTE.accent,
      upperEyeZ: 0, upperEyeScale: 0.65 });
    pulley.position.set(xs[index], baseYs[index], 0);
    root.add(pulley);
    return pulley;
  });
  const anchorXs = xs.map((x, index) => x + radii[index]);
  const { load, eyes, centerX } = loadWithEyes(anchorXs);
  load.position.y = loadBaseY;
  const fixed = upperPulleys.at(-1);
  const upperAttachment = fixed.position.clone().add(fixed.userData.upperAttachment);
  const ceilingY = upperAttachment.y + 0.17;
  const support = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.12, 0.65), matte(PALETTE.frame));
  support.position.set(fixed.position.x, ceilingY, 0);
  const stem = makeBeam(upperAttachment, new THREE.Vector3(fixed.position.x, ceilingY - 0.04, 0),
    { thickness: 0.055, depth: 0.055, color: PALETTE.ink });
  root.add(load, support, stem);

  const pathsAt = (travel) => upperPulleys.map((pulley, index) => {
    const center = new THREE.Vector3(xs[index], baseYs[index] + factors[index] * travel, 0);
    const right = center.clone().add(new THREE.Vector3(radii[index], 0, 0));
    const exit = center.clone().add(index === 0
      ? new THREE.Vector3(-radii[index] * Math.cos(angle), radii[index] * Math.sin(angle), 0)
      : new THREE.Vector3(-radii[index], 0, 0));
    const start = new THREE.Vector3(anchorXs[index], loadBaseY + travel + anchorLift, 0);
    const end = index === 0
      ? exit.clone().addScaledVector(effortDirection, effortBaseLength + (1 - factors[0]) * travel)
      : new THREE.Vector3(xs[index - 1], baseYs[index - 1] + factors[index - 1] * travel, 0)
        .add(upperPulleys[index - 1].userData.upperAttachment);
    const arc = circularRopeArc(center, right, exit, Z_AXIS, new THREE.Vector3(0, 1, 0));
    const curve = new THREE.CurvePath();
    curve.add(new THREE.LineCurve3(start, right));
    curve.add(arc);
    curve.add(new THREE.LineCurve3(exit, end));
    return { center, curve, start, end, upperArc: arc };
  });
  const initialPaths = pathsAt(0);
  const ropes = initialPaths.map((path, index) => {
    const rope = makeDynamicMovingBelt(path.curve, { closed: false, markerCount: 0, radius: 0.032, laid: true });
    rope.userData.mechanismRope = true;
    rope.userData.ropeStage = index;
    root.add(rope);
    return rope;
  });
  const definitions = Object.fromEntries(upperPulleys.map((pulley, index) => [`upper${index}`, {
    rope: index, index: 1, radius: radii[index], initial: contactState(initialPaths[index].curve, 1),
  }]));
  const effortDerivative = new THREE.Vector3(0, factors[0], 0)
    .addScaledVector(effortDirection, 1 - factors[0]);
  const haulPerLoad = effortDerivative.dot(effortDirection);
  const tensions = Array.from({ length: count }, (_, index) => index === 0 ? 1 :
    (1 + Math.cos(angle)) * 2 ** (index - 1));
  root.userData.mechanism = threeStages ? 'seven-to-one-load-anchored-pulley-cascade'
    : 'three-to-one-load-anchored-pulley-cascade';
  root.userData.cameraFov = 18;
  root.userData.nominalRopeLengths = initialPaths.map((path) => path.curve.getLength());
  root.userData.pulleys = Object.fromEntries(upperPulleys.map((pulley, index) => [`upper${index}`, pulley]));
  root.userData.ropes = ropes;
  root.userData.blocks = { upperPulleys, load, loadAnchorPins: eyes, support };
  root.userData.contactDefinitions = definitions;
  root.userData.geometry = { effortDirection: effortDirection.clone(), anchorLift };
  const update = (time) => {
    const frequency = threeStages ? 0.5 : 0.52;
    const amplitude = threeStages ? 0.07 : 0.13;
    const travel = Math.sin(time * frequency) * amplitude;
    const loadSpeed = Math.cos(time * frequency) * amplitude * frequency;
    const paths = pathsAt(travel);
    load.position.y = loadBaseY + travel;
    for (let index = 0; index < count; index += 1) {
      upperPulleys[index].position.copy(paths[index].center);
      const definition = definitions[`upper${index}`];
      setSpin(upperPulleys[index], rotationFromContact(paths[index].curve, 1, radii[index], definition.initial));
      ropes[index].userData.setCurve(paths[index].curve);
    }
    root.userData.attachments = { effort: paths[0].end, load: new THREE.Vector3(centerX, load.position.y, 0),
      stageStarts: paths.map((path) => path.start), stageEnds: paths.map((path) => path.end) };
    root.userData.contacts = paths.map((path, index) => ({ upperArc: path.upperArc, radius: radii[index] }));
    root.userData.kinematics = {
      mechanicalAdvantage: nominalRatio, nominalEffortForceOverLoad: 1 / nominalRatio,
      effortForceOverLoad: 1 / haulPerLoad, haulPerLoad, haulSpeed: haulPerLoad * loadSpeed,
      effortDisplacement: paths[0].end.y - initialPaths[0].end.y,
      effortSpeed: effortDerivative.y * loadSpeed,
      effortVelocity: effortDerivative.clone().multiplyScalar(loadSpeed),
      loadDisplacement: travel, loadSpeed,
      upperRadii: radii, ...(threeStages ? { pitchRadius: radii[0] } : {}),
      upperDisplacements: factors.map((factor) => factor * travel),
      upperSpeeds: factors.map((factor) => factor * loadSpeed),
      upperAngularSpeeds: factors.map((factor, index) => (1 - factor) * loadSpeed / radii[index]),
      stageEndpointSpeeds: factors.map((factor, index) => index === 0 ? effortDerivative.y * loadSpeed
        : factors[index - 1] * loadSpeed),
      stageRopeTensionsOverEffort: tensions, directLoadForceContributions: tensions,
      ropeLengths: paths.map((path) => path.curve.getLength()),
    };
  };
  update(0);
  markShadows(root);
  return { root, update, cameraDirection: new THREE.Vector3(0.3, 0.15, 10) };
}

export const loadAnchoredSevenToOneCascade = () => loadAnchoredCascade(20);
export const loadAnchoredThreeToOneCascade = () => loadAnchoredCascade(21);

// Pass 96: close the free tip of a block's lower S-hook with a rounded cap
// of the tube's radius (the stock hook tube is open at its point).
function capHoistHook(block) {
  let hook = null;
  block.userData.frame.traverse((part) => { if (part.geometry?.type === 'TubeGeometry') hook = part; });
  // p104: the shared hook now carries this cap itself.
  if (!hook || hook.children.some((child) => child.userData.role === 'hook-tip-cap')) return;
  const { path, radius, radialSegments } = hook.geometry.parameters;
  const { tangents, normals, binormals } = hook.geometry;
  const last = tangents.length - 1;
  // A ball of the tube's radius centred on the tip: its front half rounds
  // the point and its back half closes the tube inside. Its equator is
  // turned onto the tube's end ring, vertex for vertex, so no step shows.
  const cap = new THREE.Mesh(new THREE.SphereGeometry(radius, radialSegments, 12), hook.material);
  cap.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    normals[last].clone(), tangents[last].clone(), binormals[last].clone().negate()));
  cap.position.copy(path.getPointAt(1));
  cap.userData.role = 'hook-tip-cap';
  hook.add(cap);
  markShadows(cap);
}

export function sixPulleyCascade() {
  const root = new THREE.Group();
  const upperRadii = [0.28, 0.38, 0.48];
  const lowerRadii = upperRadii.map((radius) => radius / 2);
  const xs = [-0.22, 0.16, 0.64];
  const baseYs = [-0.1, 1.0, 2.15];
  const factors = [-8, -2, 0];
  const loadBaseY = -1.65;
  const lowerXs = xs.map((x, index) => x + lowerRadii[index]);
  const upperPulleys = upperRadii.map((radius, index) => {
    const pulley = makeHoistBlock({ radius, color: index === 2 ? PALETTE.driver : PALETTE.accent,
      upperEyeZ: 0, upperEyeScale: 0.6, lowerEyeZ: 0, lowerEyeScale: 0.6 });
    pulley.position.set(xs[index], baseYs[index], 0);
    root.add(pulley);
    return pulley;
  });
  const load = new THREE.Group();
  const lowerPulleys = lowerRadii.map((radius, index) => {
    // Pass 96: the lower sheaves are thinned to 0.4 of their diameter and
    // their pins cut to 0.35 of the sheave radius (at most the stock 0.065),
    // so the smallest reads as an open sheave with a hub, not a black blob.
    const pinRadius = Math.min(0.065, 0.35 * radius);
    const pulley = makeHoistBlock({ radius, width: 0.8 * radius, color: PALETTE.driven,
      lowerHook: true, lowerHookScale: 0.35, pinRadius, bore: pinRadius + 0.007 });
    capHoistHook(pulley);
    pulley.position.set(lowerXs[index], radius - lowerRadii[2], 0);
    load.add(pulley);
    return pulley;
  });
  const { load: weight, eyes, centerX } = loadWithEyes(lowerXs);
  for (const eye of eyes) eye.rotation.y = Math.PI / 2;
  weight.position.y = -lowerRadii[2] - 0.1 - 0.35 * 0.35 - 0.16;
  load.add(weight);
  load.position.y = loadBaseY;
  const upperAttachment = upperPulleys[2].position.clone().add(upperPulleys[2].userData.upperAttachment);
  const ceilingY = upperAttachment.y + 0.17;
  const support = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 0.65), matte(PALETTE.frame));
  support.position.set(xs[2], ceilingY, 0);
  const stem = makeBeam(upperAttachment, new THREE.Vector3(xs[2], ceilingY - 0.04, 0),
    { thickness: 0.055, depth: 0.055, color: PALETTE.ink });
  const angle = 0.36;
  const effortDirection = new THREE.Vector3(-Math.sin(angle), -Math.cos(angle), 0);
  root.add(load, support, stem);
  const pathsAt = (travel) => upperPulleys.map((pulley, index) => {
    const upperCenter = new THREE.Vector3(xs[index], baseYs[index] + factors[index] * travel, 0);
    const lowerCenter = lowerPulleys[index].position.clone().add(new THREE.Vector3(0, loadBaseY + travel, 0));
    const start = upperCenter.clone().add(pulley.userData.lowerAttachment);
    const lowerLeft = lowerCenter.clone().add(new THREE.Vector3(-lowerRadii[index], 0, 0));
    const lowerRight = lowerCenter.clone().add(new THREE.Vector3(lowerRadii[index], 0, 0));
    const upperRight = upperCenter.clone().add(new THREE.Vector3(upperRadii[index], 0, 0));
    const upperExit = upperCenter.clone().add(index === 0
      ? new THREE.Vector3(-upperRadii[index] * Math.cos(angle), upperRadii[index] * Math.sin(angle), 0)
      : new THREE.Vector3(-upperRadii[index], 0, 0));
    const end = index === 0 ? upperExit.clone().addScaledVector(effortDirection, 2.4 + 18 * travel)
      : new THREE.Vector3(xs[index - 1], baseYs[index - 1] + factors[index - 1] * travel, 0)
        .add(upperPulleys[index - 1].userData.upperAttachment);
    const lowerArc = circularRopeArc(lowerCenter, lowerLeft, lowerRight, Z_AXIS, new THREE.Vector3(0, -1, 0));
    const upperArc = circularRopeArc(upperCenter, upperRight, upperExit, Z_AXIS, new THREE.Vector3(0, 1, 0));
    const curve = new THREE.CurvePath();
    curve.add(new THREE.LineCurve3(start, lowerLeft));
    curve.add(lowerArc);
    curve.add(new THREE.LineCurve3(lowerRight, upperRight));
    curve.add(upperArc);
    curve.add(new THREE.LineCurve3(upperExit, end));
    return { curve, start, end, upperArc, lowerArc, upperCenter };
  });
  const initial = pathsAt(0);
  const ropes = initial.map((path, index) => {
    const rope = makeDynamicMovingBelt(path.curve, { closed: false, radius: 0.032, markerCount: 0, laid: true });
    rope.userData.mechanismRope = true;
    rope.userData.ropeStage = index;
    root.add(rope);
    return rope;
  });
  const pulleys = {};
  const definitions = {};
  for (let index = 0; index < 3; index += 1) {
    for (const [prefix, block, radius, arcIndex] of [
      ['upper', upperPulleys[index], upperRadii[index], 3], ['lower', lowerPulleys[index], lowerRadii[index], 1],
    ]) {
      pulleys[prefix + index] = block;
      definitions[prefix + index] = { rope: index, index: arcIndex, radius,
        initial: contactState(initial[index].curve, arcIndex) };
    }
  }
  const effortDerivative = new THREE.Vector3(0, -8, 0).addScaledVector(effortDirection, 18);
  const haulPerLoad = effortDerivative.dot(effortDirection);
  const tensions = [1, 2 + Math.cos(angle), 3 * (2 + Math.cos(angle))];
  root.userData.mechanism = 'twenty-six-to-one-six-pulley-cascade';
  root.userData.cameraFov = 18;
  root.userData.pulleys = pulleys;
  root.userData.ropes = ropes;
  root.userData.contactDefinitions = definitions;
  root.userData.blocks = { load, upperPulleys, lowerPulleys, weight, loadAnchorPins: eyes, support };
  root.userData.nominalRopeLengths = initial.map((path) => path.curve.getLength());
  root.userData.geometry = { effortDirection: effortDirection.clone() };
  const update = (time) => {
    const travel = Math.sin(time * 0.48) * 0.032;
    const loadSpeed = Math.cos(time * 0.48) * 0.032 * 0.48;
    const paths = pathsAt(travel);
    load.position.y = loadBaseY + travel;
    upperPulleys.forEach((pulley, index) => pulley.position.copy(paths[index].upperCenter));
    for (const [name, definition] of Object.entries(definitions)) {
      setSpin(pulleys[name], rotationFromContact(paths[definition.rope].curve, definition.index,
        definition.radius, definition.initial));
    }
    ropes.forEach((rope, index) => rope.userData.setCurve(paths[index].curve));
    root.userData.attachments = { effort: paths[0].end, load: new THREE.Vector3(centerX, load.position.y, 0),
      stageStarts: paths.map((path) => path.start), stageEnds: paths.map((path) => path.end) };
    root.userData.contacts = paths.map((path, index) => ({ lowerArc: path.lowerArc, upperArc: path.upperArc,
      lowerRadius: lowerRadii[index], upperRadius: upperRadii[index] }));
    root.userData.kinematics = {
      mechanicalAdvantage: 26, nominalEffortForceOverLoad: 1 / 26, effortForceOverLoad: 1 / haulPerLoad,
      haulPerLoad, haulSpeed: haulPerLoad * loadSpeed,
      effortDisplacement: paths[0].end.y - initial[0].end.y, effortSpeed: effortDerivative.y * loadSpeed,
      effortVelocity: effortDerivative.clone().multiplyScalar(loadSpeed), loadDisplacement: travel, loadSpeed,
      upperRadii, lowerRadii, upperDisplacements: factors.map((factor) => factor * travel),
      upperSpeeds: factors.map((factor) => factor * loadSpeed),
      lowerAngularSpeeds: factors.map((factor, index) => (1 - factor) * loadSpeed / lowerRadii[index]),
      upperAngularSpeeds: factors.map((factor, index) => 2 * (1 - factor) * loadSpeed / upperRadii[index]),
      stageEndpointSpeeds: [effortDerivative.y, -8, -2].map((factor) => factor * loadSpeed),
      stageRopeTensionsOverEffort: tensions, directLoadForceContributions: tensions.map((tension) => 2 * tension),
      ropeLengths: paths.map((path) => path.curve.getLength()),
    };
  };
  update(0);
  markShadows(root);
  return { root, update, cameraDirection: new THREE.Vector3(0.3, 0.15, 10) };
}

export function ceilingAnchoredEightToOneCascade() {
  const root = new THREE.Group();
  const movingRadius = 0.34;
  const guideRadius = 0.34;
  const xs = [-0.66, -0.32, 0.02];
  const baseYs = [-1.23, -0.34, 0.7];
  const factors = [1, 2, 4];
  const guideX = xs[2] + movingRadius + guideRadius;
  const guideY = 1.8;
  const ceilingY = 2.55;
  const movingPulleys = xs.map((x, index) => {
    const pulley = makeHoistBlock({ radius: movingRadius, color: index === 0 ? PALETTE.driven : PALETTE.accent,
      ...(index === 0 ? { lowerHook: true, lowerHookScale: 0.6 } : { lowerEyeZ: 0, lowerEyeScale: 0.6 }) });
    if (index === 0) capHoistHook(pulley);
    pulley.position.set(x, baseYs[index], 0);
    root.add(pulley);
    return pulley;
  });
  const guide = makeHoistBlock({ radius: guideRadius, color: PALETTE.driver, upperEyeZ: 0, upperEyeScale: 0.6 });
  guide.position.set(guideX, guideY, 0);
  const support = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.12, 0.65), matte(PALETTE.frame));
  support.position.set(0.05, ceilingY, 0);
  const stem = makeBeam(guide.position.clone().add(guide.userData.upperAttachment),
    new THREE.Vector3(guideX, ceilingY - 0.04, 0), { thickness: 0.055, depth: 0.055, color: PALETTE.ink });
  const anchorPins = xs.map((x) => {
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.022, 12, 40), matte(PALETTE.ink));
    eye.position.set(x - movingRadius, ceilingY - 0.13, 0);
    root.add(eye);
    return eye;
  });
  const weight = makeHoistLoad({ radius: 0.56, height: 0.5, eyeBoss: true });
  root.add(guide, support, stem, weight);
  const pathsAt = (travel) => movingPulleys.map((pulley, index) => {
    const center = new THREE.Vector3(xs[index], baseYs[index] + factors[index] * travel, 0);
    const left = center.clone().add(new THREE.Vector3(-movingRadius, 0, 0));
    const right = center.clone().add(new THREE.Vector3(movingRadius, 0, 0));
    const anchor = new THREE.Vector3(xs[index] - movingRadius, ceilingY - 0.22, 0);
    const movingArc = circularRopeArc(center, left, right, Z_AXIS, new THREE.Vector3(0, -1, 0));
    const curve = new THREE.CurvePath();
    curve.add(new THREE.LineCurve3(anchor, left));
    curve.add(movingArc);
    if (index < 2) {
      const end = new THREE.Vector3(xs[index + 1], baseYs[index + 1] + factors[index + 1] * travel, 0)
        .add(movingPulleys[index + 1].userData.lowerAttachment);
      curve.add(new THREE.LineCurve3(right, end));
      return { curve, center, anchor, end, movingArc, guideArc: null };
    }
    const guideLeft = guide.position.clone().add(new THREE.Vector3(-guideRadius, 0, 0));
    const guideRight = guide.position.clone().add(new THREE.Vector3(guideRadius, 0, 0));
    const guideArc = circularRopeArc(guide.position, guideLeft, guideRight, Z_AXIS, new THREE.Vector3(0, 1, 0));
    const end = new THREE.Vector3(guideX + guideRadius, -1 - 8 * travel, 0);
    curve.add(new THREE.LineCurve3(right, guideLeft));
    curve.add(guideArc);
    curve.add(new THREE.LineCurve3(guideRight, end));
    return { curve, center, anchor, end, movingArc, guideArc };
  });
  const initial = pathsAt(0);
  const ropes = initial.map((path, index) => {
    const rope = makeDynamicMovingBelt(path.curve, { closed: false, radius: 0.032, markerCount: 0, laid: true });
    rope.userData.mechanismRope = true;
    rope.userData.ropeStage = index;
    root.add(rope);
    return rope;
  });
  const definitions = Object.fromEntries(movingPulleys.map((pulley, index) => [`moving${index}`, {
    rope: index, index: 1, radius: movingRadius, initial: contactState(initial[index].curve, 1),
  }]));
  definitions.guide = { rope: 2, index: 3, radius: guideRadius, initial: contactState(initial[2].curve, 3) };
  const pulleys = Object.fromEntries(movingPulleys.map((pulley, index) => [`moving${index}`, pulley]));
  pulleys.guide = guide;
  root.userData.mechanism = 'eight-to-one-ceiling-anchored-pulley-cascade';
  root.userData.cameraFov = 18;
  root.userData.pulleys = pulleys;
  root.userData.ropes = ropes;
  root.userData.blocks = { movingPulleys, guide, weight, anchorPins, support };
  root.userData.contactDefinitions = definitions;
  root.userData.nominalRopeLengths = initial.map((path) => path.curve.getLength());
  root.userData.geometry = { effortDirection: new THREE.Vector3(0, -1, 0) };
  const update = (time) => {
    const travel = Math.sin(time * 0.5) * 0.07;
    const loadSpeed = Math.cos(time * 0.5) * 0.07 * 0.5;
    const paths = pathsAt(travel);
    movingPulleys.forEach((pulley, index) => pulley.position.copy(paths[index].center));
    for (const [name, definition] of Object.entries(definitions)) {
      setSpin(pulleys[name], rotationFromContact(paths[definition.rope].curve, definition.index,
        definition.radius, definition.initial));
    }
    ropes.forEach((rope, index) => rope.userData.setCurve(paths[index].curve));
    weight.position.copy(movingPulleys[0].position).add(movingPulleys[0].userData.lowerAttachment)
      .add(new THREE.Vector3(0, -0.2, 0));
    root.userData.attachments = { anchors: paths.map((path) => path.anchor), effort: paths[2].end,
      load: movingPulleys[0].position.clone(), stageEnds: paths.map((path) => path.end) };
    root.userData.contacts = paths.map((path) => ({ movingArc: path.movingArc, guideArc: path.guideArc, movingRadius }));
    root.userData.kinematics = {
      mechanicalAdvantage: 8, effortForceOverLoad: 1 / 8, directLoadForceContributions: [4, 4],
      stageRopeTensionsOverEffort: [4, 2, 1], effortDisplacement: -8 * travel, effortSpeed: -8 * loadSpeed,
      loadDisplacement: travel, loadSpeed, movingRadius, guideRadius,
      movingDisplacements: factors.map((factor) => factor * travel), movingSpeeds: factors.map((factor) => factor * loadSpeed),
      movingAngularSpeeds: factors.map((factor) => factor * loadSpeed / movingRadius),
      guideAngularSpeed: -8 * loadSpeed / guideRadius,
      stageEndpointSpeeds: factors.map((factor) => factor * 2 * loadSpeed),
      ropeLengths: paths.map((path) => path.curve.getLength()),
    };
  };
  update(0);
  markShadows(root);
  return { root, update, cameraDirection: new THREE.Vector3(0.3, 0.15, 10) };
}
