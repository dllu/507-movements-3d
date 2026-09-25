import profileData from '../data/star-mangle-profiles.js';
import mapData from '../data/star-mangle-contact-map.js';
import * as THREE from 'three';
import { starMangleMotion } from './star-mangle-motion.js';
import { starMangleLoadedMotion } from './star-mangle-contact-motion.js';
import { boredSpurGeometry } from './jaw-clutch-geometry.js';
import { radialToothGeometry } from './star-mangle-geometry.js';
import { PALETTE, matte, markShadows } from './primitives.js';
import { turnedClutchGeometry } from './clutch-section-geometry.js';
import { starMangleCrabBlock, starMangleCrabEnd, starMangleRunningRim } from './star-mangle-guide.js';

export function makeStarMangle({ profiles: data = profileData, contactMap = mapData } = {}) {
  const motion = starMangleMotion(data.parameters), p = motion.parameters;
  const loadedMotion = contactMap ? starMangleLoadedMotion(contactMap) : null;
  const root = new THREE.Group(), wheel = new THREE.Group(), input = new THREE.Group();
  input.rotation.x = -Math.PI / 2; const rotor = new THREE.Group(); input.add(rotor); root.add(wheel, input);
  const plate = (shape, depth, color, z = 0, curveSegments = 96) => new THREE.Mesh(new THREE.ExtrudeGeometry(shape,
    { depth, bevelEnabled: false, curveSegments }).translate(0, 0, z - depth / 2), matte(color));
  const annulus = (inner, outer, start = 0, sweep = 2 * Math.PI, depth = 0.10, color = PALETTE.driven) => {
    const shape = new THREE.Shape(); shape.absarc(0, 0, outer, start, start + sweep, false);
    if (sweep === 2 * Math.PI) {
      const hole = new THREE.Path(); hole.absarc(0, 0, inner, 0, 2 * Math.PI, true); shape.holes.push(hole);
    } else {
      shape.lineTo(inner * Math.cos(start + sweep), inner * Math.sin(start + sweep));
      shape.absarc(0, 0, inner, start + sweep, start, true); shape.closePath();
    }
    return plate(shape, depth, color, 0, Math.max(3, Math.ceil(96 * sweep / (2 * Math.PI))));
  };
  const sourceWheelAngle = -0.42 - 2 * Math.PI;
  const initialTravel = (-Math.PI / 2 - p.firstTerminal - sourceWheelAngle) / p.ratio;
  const innerRim = annulus(1.27, 1.36, 0, 2 * Math.PI, 0.33), outerRim = new THREE.Mesh(starMangleRunningRim(motion), matte(PALETTE.driven));
  const hub = annulus(0.235, 0.46, 0, 2 * Math.PI, 0.26), shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.234, 0.234, 0.69, 96), matte(PALETTE.ink));
  shaft.rotation.x = Math.PI / 2; shaft.position.z = -0.105; wheel.add(innerRim, outerRim, hub, shaft);
  const spokes = [];
  for (let i = 0; i < 4; i += 1) {
    const shape = new THREE.Shape(); shape.moveTo(0.40, -0.14);
    shape.bezierCurveTo(0.65, -0.11, 0.99, -0.09, 1.31, -0.17);
    shape.lineTo(1.31, 0.17); shape.bezierCurveTo(0.99, 0.09, 0.65, 0.11, 0.40, 0.14); shape.closePath();
    const spoke = plate(shape, 0.105, PALETTE.driven); spoke.rotation.z = i * Math.PI / 2 - sourceWheelAngle;
    wheel.add(spoke); spokes.push(spoke);
  }
  const profileMap = new Map(data.teeth.map((t) => [t.toothIndex, t]));
  const generic = profileMap.get(Math.floor(p.toothCount / 2)), geometryCache = new Map(), teeth = [];
  for (let i = 0; i < p.toothCount; i += 1) {
    const profile = profileMap.get(i) ?? generic;
    if (!geometryCache.has(profile)) geometryCache.set(profile, radialToothGeometry(profile, { outerRadius: 1.78 }));
    const tooth = new THREE.Mesh(geometryCache.get(profile), matte(i === 0 || i === p.toothCount - 1 ? PALETTE.brass : PALETTE.driven));
    tooth.rotation.z = p.firstTerminal + i * p.wheelPitch;
    tooth.userData = { radialTooth: true, index: i, terminal: i === 0 || i === p.toothCount - 1 };
    wheel.add(tooth); teeth.push(tooth);
  }
  const pinion = new THREE.Mesh(boredSpurGeometry({ teeth: p.pinionTeeth, module: p.module,
    depth: data.pinionDepth, boreRadius: 0.04, pressureAngle: p.pinionPressureAngle,
    profileShift: p.pinionProfileShift, addendumCoefficient: p.pinionAddendumCoefficient }), matte(PALETTE.driver));
  const inputShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03999, 0.03999, 0.64, 96), matte(PALETTE.ink));
  inputShaft.rotation.x = Math.PI / 2; inputShaft.position.z = -0.30; rotor.add(pinion, inputShaft);
  const collarRadius = 0.10, collarBore = 0.0401, collarHalfLength = Math.sqrt(collarRadius ** 2 - collarBore ** 2);
  const collarProfile = Array.from({ length: 65 }, (_, i) => {
    const z = -collarHalfLength + 2 * collarHalfLength * i / 64;
    return [z, Math.sqrt(Math.max(0, collarRadius ** 2 - z * z))];
  });
  const collar = new THREE.Mesh(turnedClutchGeometry(collarProfile, { angularSegments: 192, boreRadius: collarBore, color: PALETTE.brass }),
    new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.18, roughness: 0.58 }));
  collar.position.z = -0.265; rotor.add(collar);
  const crab = new THREE.Group(), crabEnds = [], crabReturns = [];
  for (const first of [true, false]) for (const guideSide of [1, -1]) {
    const geometry = starMangleCrabEnd(motion, first, { guideSide }), mesh = new THREE.Mesh(geometry, matte(PALETTE.brass));
    mesh.rotation.z = geometry.userData.terminal; crab.add(mesh);
    (guideSide > 0 ? crabEnds : crabReturns).push(mesh);
  }
  const crabBlock = new THREE.Mesh(undefined, matte(PALETTE.brass));
  crab.add(crabBlock); wheel.add(crab);
  const applyState = (s) => {
    wheel.rotation.z = s.wheelAngle;
    input.position.set(0, s.centerY, s.centerZ); rotor.rotation.z = s.pinionAngle;
    root.userData.kinematics = s;
  };
  const updateTravel = (travel) => applyState(loadedMotion
    ? loadedMotion.atInputTravel(loadedMotion.inputAtPath(travel)) : motion.atTravel(travel));
  const initialInputTravel = loadedMotion ? loadedMotion.inputAtPath(initialTravel) : initialTravel;
  const stateAtTime = (time) => loadedMotion ? loadedMotion.atInputTravel(initialInputTravel + p.inputSpeed * time)
    : motion.atTime(initialTravel / p.inputSpeed + time);
  const update = (time) => applyState(stateAtTime(time));
  // Wheel-frame collar centres through both crossovers and the adjoining
  // face runs, in the block's (s = -y, z) section coordinates.
  function collarSweep() {
    const points = [], centre = new THREE.Vector3(), inverse = new THREE.Matrix4();
    for (const start of [p.runTravel, p.returnStart]) {
      for (let travel = start - 0.8; travel <= start + Math.PI + 0.8 + 1e-9; travel += 0.05) {
        updateTravel(travel); root.updateMatrixWorld(true);
        inverse.copy(wheel.matrixWorld).invert();
        centre.setFromMatrixPosition(collar.matrixWorld).applyMatrix4(inverse);
        points.push([-centre.y, centre.z]);
      }
      points.push(null);
    }
    const runs = [], run = []; for (const point of points) { if (point) run.push(point); else runs.push(run.splice(0)); }
    return runs;
  }
  crabBlock.geometry = starMangleCrabBlock(collarSweep());
  root.userData = { fidelity: 'authored', hideGround: true, cameraFov: 17, shadowCameraHalfExtent: 2.2, shadowBias: -0.00003,
    fullCameraDirection: new THREE.Vector3(4, 3, 8),
    mechanism: 'radial-tooth-mangle-with-captured-crab-guide', reconstructionStatus: 'contact-verified-reconstruction',
    idealConstraints: 'Fixed output axis; external input bearing fixes X and follows Y²−Z²=R²−rp², with end stops at Z=±rp.', geometry: { ...p, ...loadedMotion?.parameters, initialTravel, initialInputTravel },
    blocks: { wheel, input }, parts: { spokes, teeth, innerRim, outerRim, hub, shaft, pinion, inputShaft,
      collar, crab, crabEnds, crabReturns, crabBlock },
    animationTiming: { authoredCyclePeriod: p.cycleDuration }, updateTravel, stateAtTime, loadedMotion };
  update(0); markShadows(root); return { root, update, cameraDirection: new THREE.Vector3(0, 0, 10) };
}
