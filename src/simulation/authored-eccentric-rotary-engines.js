import * as THREE from 'three';
import { PALETTE, markShadows, matte } from './primitives.js';
import { latheSectionGeometry } from './cutaway-section.js';
import {
  circlePolygon,
  partPlate,
  pointInPolygon,
  polygonClipping,
  ringPolygon,
  safeClip,
  sectionPlate,
  setSteamRegions,
  steamVolume,
} from './steam-section-kit.js';

const FULL_TURN = Math.PI * 2;
const DEG = Math.PI / 180;
const rect = (x0, y0, x1, y1) => ringPolygon([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);

// Movement 425, rotary engine with an eccentric piston and a sliding
// abutment (pass 71 rebuild from Brown's plate).
//
// Shaft B runs through the centre of cylinder A; piston C is an eccentric
// fast on it and touches the bore along one line, sealed by the packing
// strip Brown hatches in C. Abutment D slides in a guide in the top of the
// casing and rides on C, so the crescent between C and the bore is divided
// at D and at the contact line. The right neck admits steam just right of D
// (Brown's downward arrow); the left neck educts just left of it. C turns
// clockwise (Brown's arrow): the space from D round to the contact line takes
// steam and grows; the space from the contact line round to D is swept out.
// While the contact line passes between the two ports the live space is
// open to the eduction port as well: this engine's dead point.
function eccentricRotaryEngine(movement) {
  const root = new THREE.Group();
  const cycleDuration = 4;
  const angularSpeed = FULL_TURN / cycleDuration; // clockwise

  // Official-trace units (bore 7), checked against Brown's plate at 37.9 px
  // of the doubled raster per unit.
  const boreRadius = 7;
  const eccentricity = 2;
  const pistonRadius = boreRadius - eccentricity - 0.005;
  const shaftRadius = 1.45;
  const abutmentHalfWidth = 0.55;
  const slotHalfWidth = 0.58;
  const abutmentLength = 5.8;
  const slotTop = 13.8;
  const towerHalfWidth = 1.45;
  const towerTop = 14.6;
  const neckTop = 10.4;
  const channelInner = 2.1;
  const channelOuter = 3.5;
  const depth = 2.4;
  const zBack = -depth;
  const backThickness = 0.35;

  const channelAngle = (x) => Math.asin(x / boreRadius);
  const inletOpen = [channelAngle(channelInner), channelAngle(channelOuter)];
  const exhaustOpen = [FULL_TURN - inletOpen[1], FULL_TURN - inletOpen[0]];

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    // clockwise angle of the contact line from the top; Brown: at the bottom
    const contactAngle = THREE.MathUtils.euclideanModulo(Math.PI + angularSpeed * cycleTime, FULL_TURN);
    const direction = [Math.sin(contactAngle), Math.cos(contactAngle)];
    const pistonCenter = [eccentricity * direction[0], eccentricity * direction[1]];
    const noseCenterY = pistonCenter[1]
      + Math.sqrt((pistonRadius + abutmentHalfWidth) ** 2 - pistonCenter[0] ** 2);
    const rotorAngle = -(angularSpeed * cycleTime);
    // live space A (D round to the contact line): the inlet opens as the
    // contact line crosses its mouth; the space blows down as the line
    // crosses the eduction mouth.
    const opening = THREE.MathUtils.smoothstep(contactAngle, inletOpen[0], inletOpen[1]);
    const release = THREE.MathUtils.smootherstep(contactAngle, exhaustOpen[0], exhaustOpen[1]);
    return {
      cycleTime, phase: cycleTime / cycleDuration, contactAngle, direction, pistonCenter, noseCenterY, rotorAngle,
      livePressure: opening * (1 - release),
      contactPoint: [boreRadius * direction[0], boreRadius * direction[1]],
      abutmentTop: noseCenterY + abutmentLength,
    };
  };

  const frameMaterial = matte(PALETTE.frame, { metalness: 0.24, roughness: 0.54 });
  const backMaterial = matte(0x7d8786, { metalness: 0.18, roughness: 0.6 });
  const pistonMaterial = matte(PALETTE.driver, { metalness: 0.2, roughness: 0.46 });
  const abutmentMaterial = matte(PALETTE.driven, { metalness: 0.21, roughness: 0.46 });
  const darkMaterial = matte(PALETTE.ink, { metalness: 0.3, roughness: 0.43 });

  // ---- casing A (sectioned) -------------------------------------------------------------------
  const flank = new THREE.SplineCurve([
    [4.25, 7.2], [5.7, 6.0], [7.45, 3.5], [8.2, 0], [7.75, -3.4], [6.55, -5.5], [5.55, -6.35], [6.3, -6.9], [7.85, -7.0],
  ].map(([x, y]) => new THREE.Vector2(x, y))).getPoints(96).map((p) => [p.x, p.y]);
  const rightSide = [
    [towerHalfWidth, towerTop], [towerHalfWidth, neckTop], [5.1, neckTop], [5.1, 9.6], [4.25, 9.6],
    ...flank, [7.85, -8.05],
  ];
  const outline = ringPolygon([...rightSide, ...rightSide.slice().reverse().map(([x, y]) => [-x, y])]);
  const bore = circlePolygon([0, 0], boreRadius, 360);
  const channels = {
    inlet: polygonClipping.difference(rect(channelInner, 5, channelOuter, neckTop + 0.2), bore),
    eduction: polygonClipping.difference(rect(-channelOuter, 5, -channelInner, neckTop + 0.2), bore),
  };
  // p96: the neck steam stops 0.8 below the open mouths, so from above the
  // ports read open instead of capped with pale plugs.
  const steamNeckTop = neckTop - 0.8;
  const steamChannels = {
    inlet: polygonClipping.difference(rect(channelInner, 5, channelOuter, steamNeckTop), bore),
    eduction: polygonClipping.difference(rect(-channelOuter, 5, -channelInner, steamNeckTop), bore),
  };
  const slot = rect(-slotHalfWidth, 5, slotHalfWidth, slotTop);
  const cavity = polygonClipping.union(bore, channels.inlet, channels.eduction, slot);
  const casing = sectionPlate(polygonClipping.difference(outline, cavity), zBack, 0, frameMaterial,
    'sectioned-cylinder-A-with-two-port-necks-and-abutment-guide');
  root.add(casing);
  const back = sectionPlate(polygonClipping.difference(outline, circlePolygon([0, 0], shaftRadius * 0.55 + 0.01, 48)),
    zBack - backThickness, zBack, backMaterial, 'solid-back-cover-of-cylinder-A');
  back.material = [backMaterial, backMaterial];
  root.add(back);

  // ---- piston C on shaft B, abutment D ---------------------------------------------------------
  const rotor = new THREE.Group();
  rotor.userData.role = 'eccentric-piston-C-fast-on-shaft-B';
  const packingHalf = 0.46;
  // In the rotor frame at angle 0 the contact line is at the bottom.
  const pistonC = partPlate(polygonClipping.difference(
    circlePolygon([0, -eccentricity], pistonRadius, 256),
    rect(-packingHalf, -eccentricity - pistonRadius - 0.1, packingHalf, -eccentricity - pistonRadius + 0.8),
    circlePolygon([0, 0], shaftRadius, 64)),
  zBack + 0.01, -0.01, pistonMaterial, 'eccentric-piston-C');
  const packing = partPlate(polygonClipping.intersection(
    rect(-packingHalf + 0.004, -eccentricity - pistonRadius - 0.1, packingHalf - 0.004, -eccentricity - pistonRadius + 0.8),
    circlePolygon([0, -eccentricity], pistonRadius, 256)),
  zBack + 0.01, -0.01, darkMaterial, 'packing-strip-of-C-on-the-contact-line');
  const shaftB = new THREE.Mesh(latheSectionGeometry(
    [[0, zBack - backThickness - 1.0], [shaftRadius * 0.55, zBack - backThickness - 1.0],
      [shaftRadius * 0.55, zBack], [shaftRadius, zBack], [shaftRadius, -0.012], [0, -0.012]],
    { segments: 64, phiStart: 0, phiLength: FULL_TURN }), darkMaterial);
  shaftB.rotation.x = Math.PI / 2;
  shaftB.userData.role = 'central-shaft-B';
  rotor.add(pistonC, packing, shaftB);
  root.add(rotor);

  const noseOutline = polygonClipping.union(
    circlePolygon([0, 0], abutmentHalfWidth, 48),
    rect(-abutmentHalfWidth, 0, abutmentHalfWidth, abutmentLength),
  );
  const abutmentD = partPlate(noseOutline, zBack + 0.01, -0.01, abutmentMaterial, 'sliding-abutment-D');
  root.add(abutmentD);

  // ---- steam --------------------------------------------------------------------------------------
  const steamZ = [zBack + 0.015, -0.015];
  // Sealed volumes set together: where a crescent piece meets a neck at its
  // mouth the two draw as one closed body of steam (no sheet across the mouth).
  const steam = {
    live: steamVolume('steam-in-space-from-D-to-the-contact-line', ...steamZ, { sealed: true }),
    swept: steamVolume('steam-in-space-from-the-contact-line-to-D', ...steamZ, { sealed: true }),
    inlet: steamVolume('live-steam-in-right-induction-neck', ...steamZ, { sealed: true }),
    eduction: steamVolume('exhaust-steam-in-left-eduction-neck', ...steamZ, { sealed: true }),
  };
  for (const mesh of Object.values(steam)) root.add(mesh);
  const report = { pieces: [] };
  const updateSteam = (state) => {
    const [dx, dy] = state.direction;
    const splitter = ringPolygon([[-0.012, 6.6], [0.012, 6.6], [0.012, 7.2], [-0.012, 7.2]]
      .map(([x, y]) => [x * dy + y * dx, -x * dx + y * dy]));
    const pieces = safeClip('difference', bore,
      circlePolygon(state.pistonCenter, pistonRadius + 0.01, 256),
      polygonClipping.union(circlePolygon([0, state.noseCenterY], abutmentHalfWidth + 0.01, 32),
        rect(-abutmentHalfWidth - 0.01, state.noseCenterY, abutmentHalfWidth + 0.01, boreRadius + 1)),
      splitter);
    // a point midway across the crescent at the given clockwise angle
    const mid = (angle) => {
      const u = [Math.sin(angle), Math.cos(angle)];
      const cu = state.pistonCenter[0] * u[0] + state.pistonCenter[1] * u[1];
      const surface = cu + Math.sqrt(pistonRadius ** 2 - eccentricity ** 2 + cu ** 2);
      const radius = (surface + boreRadius) / 2;
      return [radius * u[0], radius * u[1]];
    };
    const probe = mid(state.contactAngle / 2);
    const live = [];
    const swept = [];
    for (const piece of pieces) {
      (pointInPolygon(probe, piece) ? live : swept).push(piece);
    }
    setSteamRegions([
      { mesh: steam.live, region: live, pressure: state.livePressure },
      { mesh: steam.swept, region: swept, pressure: 0 },
      { mesh: steam.inlet, region: steamChannels.inlet, pressure: 1 },
      { mesh: steam.eduction, region: steamChannels.eduction, pressure: 0 },
    ]);
    report.pieces = pieces.length;
  };

  const update = (time) => {
    const state = stateAtTime(time);
    rotor.rotation.z = Math.atan2(state.direction[0], -state.direction[1]);
    abutmentD.position.set(0, state.noseCenterY, 0);
    updateSteam(state);
    return state;
  };

  root.userData = {
    animationTiming: { authoredCyclePeriod: cycleDuration, targetCycleDuration: cycleDuration },
    archetype: 'shaft-fast-eccentric-circular-piston-tangent-to-fixed-cylinder-with-cam-lifted-sliding-port-abutment',
    blocks: { casing, back, rotor, pistonC, packing, shaftB, abutmentD, steam },
    degreesOfFreedom: { independentPrescribedInputs: 1, operatingDegreesOfFreedom: 1 },
    dynamics: {
      steam: 'Steam volumes are the actual pieces of the crescent after C, D and the contact line divide it. The space from D round to the contact line is live once the contact line has passed the induction mouth and is blown down as it passes the eduction mouth; the space ahead of the contact line is swept to the eduction neck.',
      abutmentLoad: 'D is kept on C; the steam or spring load that does it is not modelled.',
    },
    fidelity: 'authored',
    geometry: {
      cycleDuration, boreRadius, eccentricity, pistonRadius, shaftRadius, abutmentHalfWidth, slotHalfWidth,
      abutmentLength, slotTop, channelInner, channelOuter, depth, inletOpen, exhaustOpen, channels,
    },
    mechanism: 'Piston C is an eccentric fast on central shaft B and touches cylinder A along one packed line. Abutment D slides in a guide between the two ports and rides on C. Steam admitted right of D drives C clockwise; the space ahead of the contact line exhausts left of D.',
    motion: { cycleDuration, direction: 'clockwise' },
    sourceReference: {
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 425',
      reconstructionDisclosure: 'The bore, eccentric, abutment and neck positions follow the official trace and Brown’s plate. The casing depth, the open neck tops (Brown’s flanges) and the load that keeps D on C are engineered.',
    },
    stateAtTime,
    steamReport: report,
    update,
  };
  root.userData.cameraDirection = new THREE.Vector3(0.08, 0.05, 1);
  root.userData.cameraFov = 8;
  root.userData.cameraFitBounds = new THREE.Box3(new THREE.Vector3(-2.59, -2.59, -1.18), new THREE.Vector3(2.59, 4.43, 0.05));
  root.userData.hideGround = true;
  root.scale.setScalar(0.3);
  update(0);
  root.traverse((object) => {
    for (const material of object.material ? [].concat(object.material) : []) material.fog = false;
  });
  markShadows(root);
  for (const mesh of Object.values(steam)) { mesh.castShadow = false; mesh.receiveShadow = false; }
  return { cameraDirection: root.userData.cameraDirection, root, update };
}

export function createAuthoredEccentricRotaryEngineMovement(movement) {
  if (movement.id !== 425) return null;
  return eccentricRotaryEngine(movement);
}
