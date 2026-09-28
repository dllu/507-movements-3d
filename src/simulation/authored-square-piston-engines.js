import * as THREE from 'three';
import { PALETTE, markShadows, matte } from './primitives.js';
import { latheSectionGeometry } from './cutaway-section.js';
import { makeSeeThrough } from './see-through-part.js';
import {
  circlePolygon,
  filletPath,
  partPlate,
  polygonClipping,
  ringPolygon,
  sectionPlate,
  steamVolume,
} from './steam-section-kit.js';

const FULL_TURN = Math.PI * 2;
const DEG = Math.PI / 180;

const rect = (x0, y0, x1, y1) => ringPolygon([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);

// Movement 424, Root's double-reciprocating or square piston engine (pass 71
// rebuild from Brown's plate).
//
// Brown draws the engine in section with the front cover removed. The oblong
// cylinder A holds frame piston B, which slides horizontally between A's end
// walls; inside B, piston C slides vertically between B's top and bottom
// walls. Wrist a is fast in C, so B takes the wrist's x and C both its x and
// y: the two pistons are the Cartesian components of the crank circle and
// never reach a dead point together.
//
// Steam: the black ports are passages. B's ports are in A's end walls; C's
// ports are in A's top and bottom walls and reach C's spaces through long
// slots in B's top and bottom walls, which stay over A's ports through B's
// whole stroke. Each passage turns back through the back cover to the
// (undrawn) valve. Each of the four working spaces takes live steam while it
// grows and exhausts while it shrinks, which turns the crank anticlockwise.
//
// Brown dots crank b behind C, so C is see-through. The crank arm works in a round pocket in the
// back of C, closed by the back cover, and shaft b runs out through a bearing
// in the back cover, so no support is needed in front.
function squarePistonEngine(movement) {
  const root = new THREE.Group();
  const cycleDuration = 4;
  const inputAngularSpeed = FULL_TURN / cycleDuration; // anticlockwise
  // Brown's pose: wrist a down and to the right of b (B far right, C low).
  const sourceCrankAngle = -43.6 * DEG;

  // Brown's plate measured at 26.5 px (of the doubled 525 px raster) per unit.
  const crankRadius = 4.2;
  const aInnerHalfWidth = 16.5;
  const aInnerHalfHeight = 11.1;
  const aWall = 2.1;
  const bOuterHalfWidth = 11.1;
  const bInnerHalfWidth = 9.15;
  const bInnerHalfHeight = 10.0;
  const cHalfWidth = bInnerHalfWidth;
  const cHalfHeight = 4.9;
  const sidePortHalfHeight = 3.7;
  const endPortHalfWidth = 3.7;
  const portDepth = 1.0;
  const slotHalfLength = endPortHalfWidth + crankRadius + 0.2;
  const pocketRadius = crankRadius + 0.3;
  const shaftRadius = 0.26;
  const wristRadius = 1.0;
  const depth = 3.0;
  const zBack = -depth;
  const backThickness = 0.5;

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    const crankAngle = sourceCrankAngle + inputAngularSpeed * cycleTime;
    const wrist = [crankRadius * Math.cos(crankAngle), crankRadius * Math.sin(crankAngle)];
    const bX = wrist[0];
    const cY = wrist[1];
    // A space takes steam while it grows. dB/dt = -r w sin, dC/dt = r w cos.
    const soften = Math.sin(8 * DEG);
    const live = (value) => THREE.MathUtils.smoothstep(value / soften, -1, 1);
    const pressure = {
      left: live(-Math.sin(crankAngle)),
      right: live(Math.sin(crankAngle)),
      below: live(Math.cos(crankAngle)),
      above: live(-Math.cos(crankAngle)),
    };
    return {
      cycleTime, phase: cycleTime / cycleDuration, crankAngle, wrist, bX, cY, pressure,
      leftClearance: aInnerHalfWidth + bX - bOuterHalfWidth,
      rightClearance: aInnerHalfWidth - bX - bOuterHalfWidth,
      aboveClearance: bInnerHalfHeight - cY - cHalfHeight,
      belowClearance: bInnerHalfHeight + cY - cHalfHeight,
      // torque arms of the horizontal and vertical piston forces
      horizontalArm: -wrist[1],
      verticalArm: wrist[0],
    };
  };

  const frameMaterial = matte(PALETTE.frame, { metalness: 0.24, roughness: 0.54 });
  const backMaterial = matte(0x7d8786, { metalness: 0.18, roughness: 0.6 });
  const bMaterial = matte(PALETTE.driven, { metalness: 0.2, roughness: 0.47 });
  const cMaterial = matte(PALETTE.driver, { metalness: 0.2, roughness: 0.46 });
  const darkMaterial = matte(PALETTE.ink, { metalness: 0.33, roughness: 0.42 });

  // ---- cylinder A (sectioned) --------------------------------------------------------------
  const aTop = aInnerHalfHeight + 1.8;
  const outer = ringPolygon(filletPath([
    [-aInnerHalfWidth - aWall, -aInnerHalfHeight - 0.5],
    [aInnerHalfWidth + aWall, -aInnerHalfHeight - 0.5],
    [aInnerHalfWidth + aWall, aTop],
    [-aInnerHalfWidth - aWall, aTop],
  ], [0, 0, 2.3, 2.3], 14));
  const flange = rect(-aInnerHalfWidth - aWall - 0.8, -aInnerHalfHeight - 1.8,
    aInnerHalfWidth + aWall + 0.8, -aInnerHalfHeight - 0.5);
  const aOutline = polygonClipping.union(outer, flange);
  const ports = {
    left: rect(-aInnerHalfWidth - portDepth, -sidePortHalfHeight, -aInnerHalfWidth + 0.01, sidePortHalfHeight),
    right: rect(aInnerHalfWidth - 0.01, -sidePortHalfHeight, aInnerHalfWidth + portDepth, sidePortHalfHeight),
    above: rect(-endPortHalfWidth, aInnerHalfHeight - 0.01, endPortHalfWidth, aInnerHalfHeight + portDepth),
    below: rect(-endPortHalfWidth, -aInnerHalfHeight - portDepth, endPortHalfWidth, -aInnerHalfHeight + 0.01),
  };
  const bore = rect(-aInnerHalfWidth, -aInnerHalfHeight, aInnerHalfWidth, aInnerHalfHeight);
  const cavity = polygonClipping.union(bore, ...Object.values(ports));
  const cylinderA = sectionPlate(polygonClipping.difference(aOutline, cavity), zBack, 0, frameMaterial,
    'sectioned-oblong-cylinder-A-with-four-ports');
  root.add(cylinderA);
  // Each port turns back through the back cover to the valve (not drawn).
  const inset = 0.12;
  const portHoles = {
    left: rect(-aInnerHalfWidth - portDepth + inset, -sidePortHalfHeight + inset, -aInnerHalfWidth - inset, sidePortHalfHeight - inset),
    right: rect(aInnerHalfWidth + inset, -sidePortHalfHeight + inset, aInnerHalfWidth + portDepth - inset, sidePortHalfHeight - inset),
    above: rect(-endPortHalfWidth + inset, aInnerHalfHeight + inset, endPortHalfWidth - inset, aInnerHalfHeight + portDepth - inset),
    below: rect(-endPortHalfWidth + inset, -aInnerHalfHeight - portDepth + inset, endPortHalfWidth - inset, -aInnerHalfHeight - inset),
  };
  const shaftHole = circlePolygon([0, 0], shaftRadius + 0.01, 48);
  const back = sectionPlate(polygonClipping.difference(aOutline, shaftHole, ...Object.values(portHoles)),
    zBack - backThickness, zBack, backMaterial, 'back-cover-of-A-with-shaft-bearing-and-port-passages');
  back.material = [backMaterial, backMaterial];
  root.add(back);
  // Bearing boss for shaft b and the short pipes from the valve.
  const boss = new THREE.Mesh(latheSectionGeometry(
    [[shaftRadius + 0.01, zBack - backThickness - 0.8], [0.9, zBack - backThickness - 0.8],
      [0.9, zBack - backThickness], [shaftRadius + 0.01, zBack - backThickness]],
    { segments: 48, phiStart: 0, phiLength: FULL_TURN }), backMaterial);
  boss.rotation.x = Math.PI / 2;
  boss.userData.role = 'bearing-boss-for-shaft-b-on-back-cover';
  root.add(boss);
  // Each passage ends in a short blind pipe: the valve it would join is not
  // drawn.
  const pipes = Object.entries(portHoles).map(([name, hole]) => {
    const box = grow(hole, 0.22);
    const pipeEnd = zBack - backThickness - 1.2;
    const pipe = new THREE.Group();
    pipe.userData.role = `blind-pipe-from-valve-to-${name}-port`;
    pipe.add(
      partPlate(polygonClipping.difference(rect(...box), hole), pipeEnd + 0.25, zBack - backThickness, backMaterial,
        `pipe-wall-to-${name}-port`),
      partPlate(rect(...box), pipeEnd, pipeEnd + 0.25, backMaterial, `pipe-end-behind-${name}-port`),
    );
    root.add(pipe);
    return pipe;
  });

  // ---- frame piston B, piston C, crank --------------------------------------------------------
  // B's top and bottom walls are slotted over A's ports only in the back
  // part of their depth, so from the front B is a closed frame, as Brown
  // draws it.
  const slotDepth = 1.8;
  const bFrame = polygonClipping.difference(
    rect(-bOuterHalfWidth, -aInnerHalfHeight + 0.005, bOuterHalfWidth, aInnerHalfHeight - 0.005),
    rect(-bInnerHalfWidth, -bInnerHalfHeight, bInnerHalfWidth, bInnerHalfHeight));
  const bSlotted = polygonClipping.difference(bFrame,
    rect(-slotHalfLength, bInnerHalfHeight - 0.01, slotHalfLength, aInnerHalfHeight + 0.1),
    rect(-slotHalfLength, -aInnerHalfHeight - 0.1, slotHalfLength, -bInnerHalfHeight + 0.01));
  const pistonB = new THREE.Group();
  pistonB.userData.role = 'horizontally-sliding-frame-piston-B';
  const bFront = partPlate(bFrame, zBack + slotDepth, -0.01, bMaterial, 'front-of-frame-piston-B');
  const bBack = partPlate(bSlotted, zBack + 0.01, zBack + slotDepth, bMaterial,
    'back-of-frame-piston-B-with-slots-over-the-top-and-bottom-ports');
  pistonB.add(bFront, bBack);
  root.add(pistonB);

  const pistonC = new THREE.Group();
  pistonC.userData.role = 'vertically-sliding-piston-C-inside-B';
  const pocketDepth = 1.0;
  const cSolid = rect(-cHalfWidth + 0.005, -cHalfHeight, cHalfWidth - 0.005, cHalfHeight);
  const cFront = partPlate(polygonClipping.difference(cSolid, circlePolygon([0, 0], wristRadius, 48)),
    zBack + 0.01 + pocketDepth, -0.01, cMaterial, 'piston-C-body-bored-for-wrist-a');
  const cBack = partPlate(polygonClipping.difference(cSolid, circlePolygon([0, 0], pocketRadius, 128)),
    zBack + 0.01, zBack + 0.01 + pocketDepth, cMaterial, 'back-of-piston-C-round-crank-pocket');
  pistonC.add(cFront, cBack);
  // Brown dots crank a-b behind C: C gets the standard see-through style so
  // the crank arm and shaft b working in its pocket show (the crank circle
  // always lies inside C's outline, so B never covers it).
  makeSeeThrough(cFront);
  makeSeeThrough(cBack);
  const wristA = new THREE.Mesh(latheSectionGeometry(
    [[0, zBack + 0.1], [wristRadius - 0.004, zBack + 0.1], [wristRadius - 0.004, -0.02], [0, -0.02]],
    { segments: 40, phiStart: 0, phiLength: FULL_TURN }), darkMaterial);
  wristA.rotation.x = Math.PI / 2;
  wristA.userData.role = 'wrist-a-fast-in-piston-C';
  pistonC.add(wristA);
  root.add(pistonC);

  const crank = new THREE.Group();
  crank.userData.role = 'main-shaft-b-and-crank-behind-C';
  const armOutline = polygonClipping.difference(polygonClipping.union(
    circlePolygon([0, 0], shaftRadius + 0.02, 40),
    circlePolygon([crankRadius, 0], wristRadius + 0.22, 48),
    rect(0, -0.24, crankRadius, 0.24),
  ), circlePolygon([crankRadius, 0], wristRadius, 48));
  const crankArm = partPlate(armOutline, zBack + 0.08, zBack + 0.34, darkMaterial, 'crank-arm-b-a-in-pocket-of-C');
  const shaftB = new THREE.Mesh(latheSectionGeometry(
    [[0, zBack - backThickness - 1.4], [shaftRadius, zBack - backThickness - 1.4], [shaftRadius, zBack + 0.08], [0, zBack + 0.08]],
    { segments: 40, phiStart: 0, phiLength: FULL_TURN }), darkMaterial);
  shaftB.rotation.x = Math.PI / 2;
  shaftB.userData.role = 'main-shaft-b-through-back-cover';
  crank.add(crankArm, shaftB);
  root.add(crank);

  // ---- steam ---------------------------------------------------------------------------------
  const steamZ = [zBack + 0.015, -0.015];
  const steamNames = ['left', 'right', 'above', 'below'];
  const steam = Object.fromEntries(steamNames.map((name) => {
    const mesh = steamVolume(`steam-in-${name}-working-space-and-port`, ...steamZ);
    root.add(mesh);
    return [name, mesh];
  }));
  const regions = (state) => {
    const bLeft = state.bX - bOuterHalfWidth;
    const bRight = state.bX + bOuterHalfWidth;
    const cTop = state.cY + cHalfHeight;
    const cBottom = state.cY - cHalfHeight;
    const x0 = state.bX - bInnerHalfWidth;
    const x1 = state.bX + bInnerHalfWidth;
    return {
      left: polygonClipping.union(rect(-aInnerHalfWidth, -aInnerHalfHeight, bLeft, aInnerHalfHeight), ports.left),
      right: polygonClipping.union(rect(bRight, -aInnerHalfHeight, aInnerHalfWidth, aInnerHalfHeight), ports.right),
      above: polygonClipping.union(rect(x0, cTop, x1, bInnerHalfHeight),
        rect(state.bX - slotHalfLength, bInnerHalfHeight - 0.01, state.bX + slotHalfLength, aInnerHalfHeight), ports.above),
      below: polygonClipping.union(rect(x0, -bInnerHalfHeight, x1, cBottom),
        rect(state.bX - slotHalfLength, -aInnerHalfHeight, state.bX + slotHalfLength, -bInnerHalfHeight + 0.01), ports.below),
    };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    pistonB.position.x = state.bX;
    pistonC.position.set(state.wrist[0], state.wrist[1], 0);
    crank.rotation.z = state.crankAngle;
    const pieces = regions(state);
    for (const name of steamNames) steam[name].userData.setRegion(pieces[name], state.pressure[name]);
    return state;
  };

  root.userData = {
    animationTiming: { authoredCyclePeriod: cycleDuration, targetCycleDuration: cycleDuration },
    archetype:
      'oblong-square-cylinder-with-horizontal-frame-piston-containing-vertical-piston-directly-on-crank-wrist',
    blocks: { cylinderA, back, boss, pipes, pistonB, bFront, bBack, pistonC, cFront, cBack, wristA, crank, crankArm, shaftB, steam },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      pistonBHorizontalPositionIndependent: false,
      pistonCVerticalPositionWithinBIndependent: false,
    },
    dynamics: {
      steam: 'Each working space is live while it grows and exhausts while it shrinks (switching softened over ±8° of crank); Brown draws no valve, so the admission law is the ideal one for anticlockwise rotation, not a flow solution.',
      torque: 'The horizontal and vertical piston forces act on moment arms -y and x of the wrist, so they are never both at a dead point.',
    },
    fidelity: 'authored',
    geometry: {
      crankRadius, aInnerHalfWidth, aInnerHalfHeight, bOuterHalfWidth, bInnerHalfWidth, bInnerHalfHeight,
      cHalfWidth, cHalfHeight, sidePortHalfHeight, endPortHalfWidth, slotHalfLength, pocketRadius, shaftRadius,
      wristRadius, depth, slotDepth, cycleDuration, ports, sourceCrankAngle,
    },
    mechanism:
      'Fixed oblong-square cylinder A contains square frame piston B, which translates horizontally. Piston C fills B’s inner width and translates vertically relative to B. Crank wrist a is fast in C; B shares the wrist’s x coordinate while C shares both coordinates, so the two nested orthogonal piston motions are exactly the Cartesian components of the circular wrist path and cannot reach a dead point together.',
    motion: { crankDirection: 'counterclockwise', cycleDuration, inputAngularSpeed },
    sourceReference: {
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 424',
      reconstructionDisclosure: 'Proportions and the pose are measured from Brown’s plate (crank radius 4.2 against Brown’s ~5, so that the crank pocket in C keeps a sealing land). Brown draws no valve, crank bearing or port passages beyond the black ports; the slots in B, the passages through the back cover, the pocket in C and the depth are engineered.',
    },
    stateAtTime,
    update,
  };
  root.userData.cameraDirection = new THREE.Vector3(0, 0, 1);
  root.userData.cameraFov = 8;
  root.userData.cameraFitBounds = new THREE.Box3(new THREE.Vector3(-4.32, -2.89, -1.13), new THREE.Vector3(4.32, 2.89, 0.05));
  root.userData.hideGround = true;
  root.scale.setScalar(0.22);
  update(0);
  root.traverse((object) => {
    for (const material of object.material ? [].concat(object.material) : []) material.fog = false;
  });
  markShadows(root);
  for (const mesh of Object.values(steam)) { mesh.castShadow = false; mesh.receiveShadow = false; }
  return { cameraDirection: root.userData.cameraDirection, root, update };
}

function grow(multi, amount) {
  const xs = multi[0][0].map(([x]) => x);
  const ys = multi[0][0].map(([, y]) => y);
  return [Math.min(...xs) - amount, Math.min(...ys) - amount, Math.max(...xs) + amount, Math.max(...ys) + amount];
}

export function createAuthoredSquarePistonEngineMovement(movement) {
  if (movement.id !== 424) return null;
  return squarePistonEngine(movement);
}

