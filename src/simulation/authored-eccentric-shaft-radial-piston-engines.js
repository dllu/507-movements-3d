import * as THREE from 'three';
import { PALETTE, markShadows, matte } from './primitives.js';
import { latheSectionGeometry } from './cutaway-section.js';
import { makeSeeThrough } from './see-through-part.js';
import { castFootPolygon } from './rotary-engine-cast-feet.js';
import {
  arcPoints,
  circlePolygon,
  multiArea,
  partPlate,
  pointInPolygon,
  polygonClipping,
  ringPolygon,
  safeClip,
  sectionPlate,
  steamVolume,
} from './steam-section-kit.js';

const FULL_TURN = Math.PI * 2;
const DEG = Math.PI / 180;
const rect = (x0, y0, x1, y1) => ringPolygon([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
const wrap = (angle) => THREE.MathUtils.euclideanModulo(angle, FULL_TURN);
// clockwise angle from the top, about O
const bearing = ([x, y]) => wrap(Math.atan2(x, y));

// Movement 427, rotary engine with the shaft eccentric to the cylinder
// (pass 71 rebuild from Brown's plate).
//
// Hub C is concentric with shaft B, whose bearings are eccentric to the
// cylinder, so C touches the bore along its top. Pistons A pass through
// rolling packings a in C's rim; their inner ends are fast on rings that turn
// on a hub on the cylinder head, centred on the cylinder, so each piston is
// always radial to the cylinder and reaches the bore. The packings rock to
// follow the piston's angle to C. Steam enters by the right neck, just past
// the contact line (Brown's downward arrow), and drives the piston behind it;
// C turns clockwise. When that piston has passed the inlet, the steam between
// the pistons works expansively until the leading piston uncovers the left
// neck, where it is educted (Brown's upward arrow).
function eccentricShaftRadialPistonEngine(movement) {
  const root = new THREE.Group();
  const cycleDuration = 6; // one turn of C; both pistons work in each turn
  const angularSpeed = FULL_TURN / cycleDuration; // clockwise

  // Units: bore radius 7 = 328 px of the doubled 525 px plate (47 px/unit).
  const boreRadius = 7;
  const casingRadius = 7.8;
  const shaftOffset = 1.1; // B above the cylinder centre O
  const hubRadius = boreRadius - shaftOffset - 0.004;
  const rimInner = 4.65;
  const packingRadius = 0.75;
  const packingPitch = 5.12; // packing centres from B
  const pistonHalfWidth = 0.3;
  const wedgeInner = 2.44;
  const wedgeOuter = 2.9;
  const wedgeHalf = 0.75;
  const ringInner = 2.02;
  const ringOuter = 2.43;
  const bossRadius = 2.0;
  const shaftRadius = 0.75;
  const webThickness = 0.12;
  const depth = 2.4;
  const zBack = -depth;
  const zFront = -0.01;
  const pistonFront = -webThickness - 0.02;
  const backThickness = 0.35;
  const neckTop = 8.8;
  const channelInner = 3.55;
  const channelOuter = 4.4;
  const neckOuter = 5.0;
  const neckInner = 2.8;
  const flatTop = 7.45;
  const B = [0, shaftOffset];

  const mouth = (x) => Math.asin(x / boreRadius);
  const inletMouth = [mouth(channelInner) + 0.012, mouth(channelOuter) + 0.012 + pistonHalfWidth / boreRadius * 2];
  const exhaustMouth = [FULL_TURN - inletMouth[1], FULL_TURN - inletMouth[0]];
  // Brown's pose: piston A at upper left, just short of the eduction neck.
  const sourceHubAngle = 147 * DEG;

  const pistonState = (hubAngle) => [0, 1].map((k) => {
    const a = hubAngle + k * Math.PI;
    const packing = [B[0] + packingPitch * Math.cos(a), B[1] + packingPitch * Math.sin(a)];
    const angle = Math.atan2(packing[1], packing[0]); // about O
    return { hubAngle: a, packing, angle, bearing: bearing(packing), packingAngle: angle - a };
  });

  const stateAtTime = (time) => {
    const cycleTime = wrap(time * angularSpeed) / angularSpeed;
    const hubAngle = sourceHubAngle - angularSpeed * cycleTime;
    const pistons = pistonState(hubAngle);
    return { cycleTime, phase: cycleTime / cycleDuration, hubAngle, pistons };
  };

  const frameMaterial = matte(PALETTE.frame, { metalness: 0.24, roughness: 0.54 });
  const backMaterial = matte(0x7d8786, { metalness: 0.18, roughness: 0.6 });
  const hubMaterial = matte(PALETTE.driven, { metalness: 0.2, roughness: 0.5 });
  const pistonMaterial = matte(PALETTE.driver, { metalness: 0.2, roughness: 0.48 });
  const packingMaterial = matte(PALETTE.accent, { metalness: 0.2, roughness: 0.5 });
  const darkMaterial = matte(PALETTE.ink, { metalness: 0.3, roughness: 0.43 });

  // ---- casing (sectioned) ---------------------------------------------------------------------
  const body = polygonClipping.intersection(circlePolygon([0, 0], casingRadius, 360), rect(-9, -9, 9, flatTop));
  const necks = [-1, 1].map((side) => rect(side < 0 ? -neckOuter : neckInner, 2, side < 0 ? -neckInner : neckOuter, neckTop));
  const foot = castFootPolygon({ casingRadius, padHalfWidth: 6.4, neckHalfWidth: 4.6, footY: -casingRadius - 0.45, padHeight: 0.55 });
  const outline = polygonClipping.union(body, ...necks, foot);
  const bore = circlePolygon([0, 0], boreRadius, 360);
  const channels = {
    inlet: polygonClipping.difference(rect(channelInner, 3, channelOuter, neckTop + 0.2), bore),
    eduction: polygonClipping.difference(rect(-channelOuter, 3, -channelInner, neckTop + 0.2), bore),
  };
  const recess = rect(-3.6, -casingRadius - 0.5, 3.6, -casingRadius - 0.3);
  const casing = sectionPlate(polygonClipping.difference(outline, bore, channels.inlet, channels.eduction, recess),
    zBack, 0, frameMaterial, 'sectioned-cylinder-with-two-port-necks-on-cast-foot');
  root.add(casing);
  const back = sectionPlate(polygonClipping.difference(polygonClipping.union(body, ...necks),
    circlePolygon(B, shaftRadius + 0.01, 48)), zBack - backThickness, zBack, backMaterial,
  'cylinder-head-behind-with-bearing-for-shaft-B');
  back.material = [backMaterial, backMaterial];
  root.add(back);
  const boss = partPlate(polygonClipping.difference(circlePolygon([0, 0], bossRadius, 96),
    circlePolygon(B, shaftRadius + 0.01, 48)), zBack, -webThickness - 0.4, backMaterial,
  'hub-on-cylinder-head-centred-on-the-cylinder');
  root.add(boss);

  // ---- hub C on shaft B ---------------------------------------------------------------------
  const rotor = new THREE.Group();
  rotor.position.set(B[0], B[1], 0);
  rotor.userData.role = 'hub-C-fast-on-shaft-B';
  // Each packing sits in a round socket open to the rim's inner face, with
  // a notch out to the working face for the piston.
  const sockets = [0, Math.PI].map((a) => polygonClipping.union(
    circlePolygon([packingPitch * Math.cos(a), packingPitch * Math.sin(a)], packingRadius + 0.006, 64),
    rect(packingPitch, -packingRadius - 0.006, hubRadius + 0.2, packingRadius + 0.006).map((polygon) => polygon.map((ring) => ring.map(([x, y]) => [
      x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]))),
  ));
  const rim = partPlate(polygonClipping.difference(circlePolygon([0, 0], hubRadius, 256),
    circlePolygon([0, 0], rimInner, 192), ...sockets), zBack + 0.01, -webThickness, hubMaterial, 'rim-of-hub-C-with-packing-sockets');
  const web = partPlate(circlePolygon([0, 0], hubRadius, 256), -webThickness, zFront, hubMaterial, 'front-web-of-hub-C');
  makeSeeThrough(web);
  const shaftB = new THREE.Mesh(latheSectionGeometry(
    [[0, zBack - backThickness - 1.0], [shaftRadius, zBack - backThickness - 1.0], [shaftRadius, -webThickness], [0, -webThickness]],
    { segments: 48, phiStart: 0, phiLength: FULL_TURN }), darkMaterial);
  shaftB.rotation.x = Math.PI / 2;
  shaftB.userData.role = 'shaft-B-in-eccentric-bearings';
  rotor.add(rim, web, shaftB);
  root.add(rotor);

  // ---- pistons A on their rings, rolling packings a ----------------------------------------------
  const pistonOutline = polygonClipping.union(
    rect(wedgeOuter - 0.01, -pistonHalfWidth, boreRadius - 0.012, pistonHalfWidth),
    ringPolygon([
      ...arcPoints([0, 0], wedgeInner, -Math.asin(wedgeHalf / wedgeInner), Math.asin(wedgeHalf / wedgeInner), 12),
      [wedgeOuter, pistonHalfWidth], [wedgeOuter, -pistonHalfWidth],
    ]),
  );
  const ringZ = [[zBack + 0.01, -1.21], [-1.19, pistonFront]];
  const pistonUnits = [0, 1].map((k) => {
    const unit = new THREE.Group();
    unit.userData.role = `piston-A-${k + 1}-on-its-ring`;
    const piston = partPlate(pistonOutline, zBack + 0.01, pistonFront, pistonMaterial, `radial-piston-A-${k + 1}`);
    const ring = partPlate(polygonClipping.difference(circlePolygon([0, 0], ringOuter, 128), circlePolygon([0, 0], ringInner, 128)),
      ...ringZ[k], darkMaterial, `ring-${k + 1}-keeping-piston-A-radial`);
    unit.add(piston, ring);
    root.add(unit);
    return { unit, piston, ring };
  });
  const packingOutline = polygonClipping.difference(circlePolygon([0, 0], packingRadius, 64),
    rect(-packingRadius - 0.1, -pistonHalfWidth - 0.006, packingRadius + 0.1, pistonHalfWidth + 0.006));
  const packings = [0, 1].map((k) => {
    const packing = partPlate(packingOutline, zBack + 0.02, -webThickness - 0.005, packingMaterial, `rolling-packing-a-${k + 1}`);
    root.add(packing);
    return packing;
  });

  // ---- steam ------------------------------------------------------------------------------------
  const steamZ = [zBack + 0.015, -0.015];
  const crescent = polygonClipping.difference(bore, circlePolygon(B, hubRadius + 0.008, 256),
    rect(-0.015, boreRadius - 0.3, 0.015, boreRadius + 0.1));
  const steam = {
    behind: steamVolume('steam-behind-the-piston-past-the-contact-line', ...steamZ),
    between: steamVolume('steam-between-the-pistons', ...steamZ),
    ahead: steamVolume('steam-ahead-of-the-leading-piston', ...steamZ),
    inlet: steamVolume('live-steam-in-right-neck', ...steamZ),
    eduction: steamVolume('exhaust-steam-in-left-neck', ...steamZ),
  };
  for (const mesh of Object.values(steam)) root.add(mesh);
  steam.inlet.userData.setRegion(channels.inlet, 1);
  steam.eduction.userData.setRegion(channels.eduction, 0);
  const placed = (outlineMulti, angle) => outlineMulti.map((polygon) => polygon.map((ring) => ring.map(([x, y]) => [
    x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)])));
  const splitPieces = (state) => safeClip('difference', crescent,
    ...state.pistons.map((p) => placed(rect(wedgeOuter, -pistonHalfWidth - 0.008, boreRadius + 0.1, pistonHalfWidth + 0.008), p.angle)));
  const midPoint = (angleFromTop) => {
    const u = [Math.sin(angleFromTop), Math.cos(angleFromTop)];
    const along = u[1] * shaftOffset;
    const hubSurface = along + Math.sqrt(hubRadius ** 2 - shaftOffset ** 2 + along ** 2);
    const radius = (hubSurface + boreRadius) / 2;
    return [radius * u[0], radius * u[1]];
  };
  const regionsOf = (state) => {
    const [lo, hi] = state.pistons.map((p) => p.bearing).sort((a, b) => a - b);
    const pieces = splitPieces(state);
    const probes = { behind: midPoint(lo / 2), between: midPoint((lo + hi) / 2), ahead: midPoint((hi + FULL_TURN) / 2) };
    const out = { behind: [], between: [], ahead: [] };
    for (const piece of pieces) {
      const key = Object.keys(probes).find((name) => pointInPolygon(probes[name], piece));
      if (key) out[key].push(piece);
    }
    return { lo, hi, ...out };
  };
  // Area between the pistons at cut-off, when the trailing piston closes
  // the inlet mouth (the same for both pistons by symmetry).
  const cutoffArea = (() => {
    let a0 = sourceHubAngle - Math.PI;
    let a1 = sourceHubAngle + Math.PI;
    const trailing = (angle) => Math.min(...pistonState(angle).map((p) => p.bearing));
    // find a hub angle where the trailing piston is at the inlet mouth's far edge
    let best = null;
    for (let i = 0; i <= 720; i += 1) {
      const angle = a0 + (a1 - a0) * i / 720;
      const value = trailing(angle) - inletMouth[1];
      if (!best || Math.abs(value) < Math.abs(best.value)) best = { angle, value };
    }
    a0 = best.angle - 0.02;
    a1 = best.angle + 0.02;
    for (let i = 0; i < 40; i += 1) {
      const mid = (a0 + a1) / 2;
      if ((trailing(mid) - inletMouth[1]) * (trailing(a0) - inletMouth[1]) <= 0) a1 = mid; else a0 = mid;
    }
    return multiArea(regionsOf({ pistons: pistonState((a0 + a1) / 2) }).between);
  })();
  const pressures = (regions) => {
    const { lo, hi } = regions;
    const open = THREE.MathUtils.smoothstep(lo, inletMouth[0], inletMouth[1]);
    const release = THREE.MathUtils.smootherstep(hi, exhaustMouth[0], exhaustMouth[1]);
    const area = multiArea(regions.between);
    const expansion = area > 0 ? Math.min(1, cutoffArea / area) : 1;
    return {
      behind: open,
      // before cut-off the inlet opens into the space between the pistons
      between: THREE.MathUtils.lerp(1, expansion, open) * (1 - release),
      ahead: 0,
    };
  };
  const report = { cutoffArea, lastPressures: null };
  const updateSteam = (state) => {
    const regions = regionsOf(state);
    const p = pressures(regions);
    for (const name of ['behind', 'between', 'ahead']) steam[name].userData.setRegion(regions[name], p[name]);
    report.lastPressures = p;
    report.lastRegions = { lo: regions.lo, hi: regions.hi };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    rotor.rotation.z = state.hubAngle;
    state.pistons.forEach((p, k) => {
      pistonUnits[k].unit.rotation.z = p.angle;
      packings[k].position.set(p.packing[0], p.packing[1], 0);
      packings[k].rotation.z = p.angle;
    });
    updateSteam(state);
    return state;
  };

  root.userData = {
    animationTiming: { authoredCyclePeriod: cycleDuration, targetCycleDuration: cycleDuration },
    archetype: 'eccentric-shaft-hub-with-two-orbiting-rolling-packings-guiding-cylinder-radial-sliding-pistons',
    blocks: { casing, back, boss, rotor, rim, web, shaftB, pistonUnits, packings, steam },
    degreesOfFreedom: { independentPrescribedInputs: 1, operatingDegreesOfFreedom: 1 },
    dynamics: {
      steam: 'Steam volumes are the actual pieces of the crescent after the pistons divide it. The space behind the piston past the contact line fills as it uncovers the inlet; the space between the pistons expands isothermally from cut-off (pressure = cut-off area / area) until the leading piston uncovers the eduction neck; the space ahead is swept out.',
      sealing: 'The pistons stop short of the front cover by the thickness of C’s web; that clearance and the piston end leakage are not modelled.',
    },
    fidelity: 'authored',
    geometry: {
      cycleDuration, boreRadius, casingRadius, shaftOffset, hubRadius, rimInner, packingRadius, packingPitch,
      pistonHalfWidth, wedgeInner, wedgeOuter, wedgeHalf, ringInner, ringOuter, bossRadius, shaftRadius, depth,
      inletMouth, exhaustMouth, cutoffArea, channels,
    },
    mechanism: 'Hub C, concentric with shaft B, turns clockwise in a cylinder whose centre is below B, touching the bore along its top. Pistons A, fast on rings turning on a hub centred on the cylinder, stay radial to the cylinder and slide through rolling packings a in C.',
    motion: { cycleDuration, direction: 'clockwise' },
    sourceReference: {
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 427',
      reconstructionDisclosure: 'Measured from Brown’s plate. The packings are set diametrically opposite in C, so Brown’s lower piston (about 28° off diametral) is not matched exactly. Brown’s rings are shown dotted; here they turn on one hub on the back head, seen through C’s front web, which uses the shared see-through style. Casing depth and piston-to-ring joints are engineered.',
    },
    stateAtTime,
    steamReport: report,
    update,
  };
  root.userData.cameraDirection = new THREE.Vector3(0.08, 0.05, 1);
  root.userData.cameraFov = 8;
  root.userData.cameraFitBounds = new THREE.Box3(new THREE.Vector3(-2.51, -2.53, -1.18), new THREE.Vector3(2.51, 2.84, 0.05));
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

export function createAuthoredEccentricShaftRadialPistonEngineMovement(movement) {
  if (movement.id !== 427) return null;
  return eccentricShaftRadialPistonEngine(movement);
}

