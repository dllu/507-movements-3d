import * as THREE from 'three';
import { makeSheaveHanger } from './hoist-hardware.js';
import { PALETTE, circularArcThrough, makeDynamicMovingBelt, makeSteppedPulley,
  setSpin } from './primitives.js';

const Z_AXIS = new THREE.Vector3(0, 0, 1);

export function whitePulleys() {
  const root = new THREE.Group();
  const topY = 1.9;
  const bottomBaseY = -1.9;
  const basePitchRadius = 0.145;
  const topFactors = [2, 4, 6];
  const bottomFactors = [1, 3, 5];
  const topPitchRadii = topFactors.map((factor) => factor * basePitchRadius);
  const bottomPitchRadii = bottomFactors.map((factor) => factor * basePitchRadius);
  const ropeRadius = 0.028;
  const stepWidth = 0.2;
  const boreRadius = 0.072;
  const levels = [stepWidth, 0, -stepWidth];
  const compound = (radii, color) => {
    const pulley = makeSteppedPulley({
      radii: radii.map((radius) => radius - ropeRadius).reverse(), stepWidth, color,
    });
    const steps = pulley.userData.rotor.children.filter((part) => part.userData.role === 'stepped-pulley-tread');
    steps.forEach((step, index) => {
      const radius = radii.at(-1 - index);
      const grooveClearance = 0.02;
      const grooveRadius = ropeRadius + grooveClearance;
      const outerRadius = radius + grooveClearance + 0.004;
      const profile = [new THREE.Vector2(boreRadius, -stepWidth / 2),
        new THREE.Vector2(outerRadius - 0.012, -stepWidth / 2),
        new THREE.Vector2(outerRadius, -stepWidth / 2), new THREE.Vector2(outerRadius, -0.065)];
      for (let sample = 0; sample <= 64; sample += 1) {
        const z = grooveRadius * (2 * sample / 64 - 1);
        profile.push(new THREE.Vector2(radius + grooveClearance - Math.sqrt(Math.max(0, grooveRadius ** 2 - z ** 2)), z));
      }
      profile.push(new THREE.Vector2(outerRadius, 0.065),
        new THREE.Vector2(outerRadius, stepWidth / 2),
        new THREE.Vector2(outerRadius - 0.012, stepWidth / 2), new THREE.Vector2(boreRadius, stepWidth / 2),
        new THREE.Vector2(boreRadius, -stepWidth / 2));
      // The groove is part of one closed solid, avoiding coincident black
      // torus/cylinder surfaces and their mottled shading at the visible rim.
      // The bore clears the hanger's fixed pin, on which the compound turns.
      step.geometry.dispose();
      step.geometry = new THREE.LatheGeometry(profile, 96);
      const caps = [];
      const runningFaces = [];
      const indices = step.geometry.index.array;
      for (let sector = 0; sector < 96; sector += 1) {
        for (let face = 0; face < profile.length - 1; face += 1) {
          const group = face === 0 || face >= profile.length - 3 ? caps : runningFaces;
          const start = (sector * (profile.length - 1) + face) * 6;
          for (let i = start; i < start + 6; i += 1) group.push(indices[i]);
        }
      }
      step.geometry.setIndex([...caps, ...runningFaces]);
      step.geometry.addGroup(0, caps.length, 0);
      step.geometry.addGroup(caps.length, runningFaces.length, 1);
      // Groove and rim are the step's own metal, a shade darker so the
      // groove reads, not an ink outline round each step.
      const grooveMaterial = step.material.clone();
      grooveMaterial.color.multiplyScalar(0.72);
      step.material = [step.material, grooveMaterial];
      step.userData.pitchRadius = radius;
    });
    for (const indicator of pulley.userData.rotor.children) {
      if (steps.includes(indicator)) continue;
      const length = indicator.geometry.parameters.width;
      const inner = boreRadius + 0.012;
      const outer = Math.max(length, inner + 0.6 * (length / 0.7 - inner));
      indicator.scale.x = (outer - inner) / length;
      indicator.position.x = (outer + inner) / 2;
    }
    pulley.userData.groovedSteps = steps;
    return pulley;
  };
  const top = compound(topPitchRadii, PALETTE.driver);
  const bottom = compound(bottomPitchRadii, PALETTE.driven);
  top.position.y = topY;
  bottom.position.y = bottomBaseY;
  const topHanger = makeSheaveHanger({ radius: topPitchRadii.at(-1), width: stepWidth * 3,
    openHook: true });
  const bottomHanger = makeSheaveHanger({ radius: bottomPitchRadii.at(-1), width: stepWidth * 3,
    direction: -1 });
  topHanger.position.copy(top.position);
  bottomHanger.position.copy(bottom.position);
  // The fixed end is tied at the front bearing, outside the rotating steps.
  const anchor = new THREE.Vector3(0, topY, 0.47);
  const baseEffortLength = 3.85;
  const makeRopePath = (travel, targetLength = null) => {
    const bottomY = bottomBaseY + travel;
    const separation = topY - bottomY;
    const slope = basePitchRadius / separation;
    const side = Math.sqrt(1 - slope * slope);
    const bottomArcs = [];
    const topArcs = [];
    const bottomLeft = [];
    const bottomRight = [];
    const topLeft = [];
    const topRight = [];
    const centerAt = (y, index) => new THREE.Vector3(0, y, levels[index]);
    for (let index = 0; index < levels.length; index += 1) {
      const lower = centerAt(bottomY, index);
      const upper = centerAt(topY, index);
      bottomLeft.push(lower.clone().addScaledVector(new THREE.Vector3(-side, slope, 0), bottomPitchRadii[index]));
      bottomRight.push(lower.clone().addScaledVector(new THREE.Vector3(side, -slope, 0), bottomPitchRadii[index]));
      topRight.push(upper.clone().addScaledVector(new THREE.Vector3(side, -slope, 0), topPitchRadii[index]));
      topLeft.push(upper.clone().addScaledVector(index === levels.length - 1
        ? new THREE.Vector3(-Math.cos(0.12), Math.sin(0.12), 0)
        : new THREE.Vector3(-side, slope, 0), topPitchRadii[index]));
      bottomArcs.push(circularArcThrough(lower, bottomLeft[index], bottomRight[index], Z_AXIS,
        new THREE.Vector3(-slope, -side, 0)));
      topArcs.push(circularArcThrough(upper, topRight[index], topLeft[index], Z_AXIS,
        new THREE.Vector3(slope, side, 0)));
    }
    const curve = new THREE.CurvePath();
    curve.add(new THREE.LineCurve3(anchor, bottomLeft[0]));
    for (let index = 0; index < levels.length; index += 1) {
      curve.add(bottomArcs[index]);
      curve.add(new THREE.LineCurve3(bottomRight[index], topRight[index]));
      curve.add(topArcs[index]);
      if (index < levels.length - 1) curve.add(new THREE.LineCurve3(topLeft[index], bottomLeft[index + 1]));
    }
    const internalLength = curve.getLength();
    const effortLength = targetLength === null ? baseEffortLength : targetLength - internalLength;
    const effortEnd = topLeft.at(-1).clone().addScaledVector(topArcs.at(-1).getTangent(1), effortLength);
    curve.add(new THREE.LineCurve3(topLeft.at(-1), effortEnd));
    return { curve, bottomY, bottomArcs, topArcs, effortLength, effortEnd };
  };
  const initialPath = makeRopePath(0);
  const nominalRopeLength = initialPath.curve.getLength();
  // About 25 units of rope wrap grooves as small as 0.145: the default 128
  // tube segments cut chords 0.03 deep into the treads, so sample finely.
  const rope = makeDynamicMovingBelt(initialPath.curve, { closed: false, radius: ropeRadius, markerCount: 0, laid: true,
    tubularSegments: 1536 });
  rope.userData.mechanismRope = true;
  root.add(top, bottom, topHanger, bottomHanger, rope);
  root.userData.mechanism = 'whites-six-part-pulley';
  root.userData.cameraFov = 18;
  root.userData.nominalRopeLength = nominalRopeLength;
  root.userData.grooveRatios = { top: topFactors, bottom: bottomFactors };
  root.userData.compoundBlocks = { top, bottom, topHanger, bottomHanger, rope,
    bottomAxle: bottomHanger.userData.pin };
  root.userData.sourceEvidence = {
    engraving: 'https://507movements.com/mm_015.html',
    primaryDescription: 'https://www.gutenberg.org/files/42951/42951-h/42951-h.htm',
    grooveAssignment: 'https://www.gutenberg.org/files/66078/66078-h/66078-h.htm',
    correction: 'Three lower sheaves and a fixed upper becket give six supporting parts. Brown prints seven, but that would require a different termination or another sheave.',
    limitation: 'The rope length uses straight fleet spans and actual wraps. Rigid groove speeds use the ideal parallel-strand limit; small fleet angles introduce a residual contact-speed error.',
  };
  const update = (time) => {
    const frequency = 0.52;
    const travel = Math.sin(time * frequency) * 0.16;
    const loadSpeed = Math.cos(time * frequency) * 0.16 * frequency;
    const path = makeRopePath(travel, nominalRopeLength);
    const delta = 1e-5;
    const effortPerLoad = (makeRopePath(travel + delta, nominalRopeLength).effortLength
      - makeRopePath(travel - delta, nominalRopeLength).effortLength) / (2 * delta);
    bottom.position.y = path.bottomY;
    bottomHanger.position.copy(bottom.position);
    rope.userData.setCurve(path.curve);
    setSpin(top, travel / basePitchRadius);
    setSpin(bottom, travel / basePitchRadius);
    root.userData.attachments = { anchor: anchor.clone(), effort: path.effortEnd,
      load: new THREE.Vector3(0, path.bottomY, 0) };
    root.userData.contacts = { bottomArcs: path.bottomArcs, topArcs: path.topArcs };
    root.userData.kinematics = {
      basePitchRadius, topPitchRadii, bottomPitchRadii,
      blockAngularSpeed: loadSpeed / basePitchRadius,
      topGrooveSpeeds: topFactors.map((factor) => factor * loadSpeed),
      bottomGrooveSpeeds: bottomFactors.map((factor) => factor * loadSpeed),
      effortDisplacement: path.effortLength - baseEffortLength,
      effortPerLoad, effortSpeed: effortPerLoad * loadSpeed,
      effortForceOverLoad: 1 / effortPerLoad,
      loadDisplacement: travel, loadSpeed,
      mechanicalAdvantage: 6, supportingSegments: 6,
      ropeLength: path.curve.getLength(),
    };
  };
  update(0);
  return { root, update, cameraDirection: new THREE.Vector3(0.3, 0.15, 10) };
}
