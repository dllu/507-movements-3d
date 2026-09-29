import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ring } from './finite-plate-geometry.js';
import { bandInvoluteGear, involute } from './band-epicyclic-geometry.js';
import { makeSeeThrough } from './see-through-part.js';
import { PALETTE, markShadows, matte } from './primitives.js';
import { arborMesh, circlePoints, extrudeOutline, tagged } from './plate-escapement-kit.js';
import {
  DESIGN, SOURCE_POINTS, SOURCE_SCALE, gearing, leverAngleAt, leverOutline, pitch, rackLayout, seats, wheelOutline,
} from './guernsey-anchor.js';
import { guernseyAnchorBake } from './baked/guernsey-anchor-402.js';

// Movement 402, G. O. Guernsey's escapement: one escape wheel drives anchor A,
// which is one piece with lever B. B's curved arm is two runs, each a band
// concentric with its pivot and stepped at the bar: internal teeth on the
// upper run turn the upper balance's pinion one way, external teeth on the
// lower run turn the left balance's
// pinion the other way, so the two balances oscillate in opposite
// directions. Every working part is one flat extrusion in one plane; the
// geometry and the contact-solved wheel motion live in guernsey-anchor.js.

const TAU = Math.PI * 2;
// Planes (z): the working plane holds the lever/anchor plate, the escape
// wheel and both pinions; the balances lie behind it, the upper in front of
// the left because their rims overlap; the bridge is in front of everything.
const PLANE = Object.freeze({ low: 0.30, high: 0.46 });
const UPPER_BALANCE = Object.freeze({ low: 0.10, high: 0.20 });
const LEFT_BALANCE = Object.freeze({ low: -0.08, high: 0.02 });
const BRIDGE = Object.freeze({ low: 0.58, high: 0.66 });
const BALANCE_OUTER = 1.50;
const BALANCE_INNER = 1.36;
// The hub stands 0.01 proud of the 0.12 collar, so their faces never coincide.
const HUB_RADIUS = 0.13;

const close = (points) => [...points, points[0]];

// Balance: Brown's plain rim and a hub bored for its arbor, as one flat
// solid (two pieces). A thin web in the shared see-through style joins them
// (built in makeBalance), so the plate's open rim reads.
function balanceGeometry(low, high) {
  const annulus = (outerRadius, innerRadius, count) => extrudeOutline(
    circlePoints([0, 0], outerRadius, count), [circlePoints([0, 0], innerRadius, count).reverse()], low, high);
  const geometry = mergeGeometries([annulus(BALANCE_OUTER, BALANCE_INNER, 240), annulus(HUB_RADIUS, DESIGN.boreRadius, 64)]);
  if (!geometry) throw new Error('402 balance rim and hub do not merge');
  return geometry;
}

function pinionGeometry() {
  const g = gearing(), alpha = DESIGN.pressureAngle, N = DESIGN.pinionTeeth;
  const geometry = bandInvoluteGear({
    teeth: N,
    baseRadius: g.rp * Math.cos(alpha),
    baseHalfAngle: Math.PI / (2 * N) + involute(1 / Math.cos(alpha)) - DESIGN.backlash / (2 * g.rp),
    rootRadius: g.rp - g.hf,
    tipRadius: g.rp + g.ha,
    boreRadius: DESIGN.boreRadius,
    depth: PLANE.high - PLANE.low,
    flankSamples: 24,
  });
  geometry.translate(0, 0, (PLANE.low + PLANE.high) / 2);
  return geometry;
}

function guernseyEscapement(movement) {
  const root = new THREE.Group();
  const g = gearing(), s = seats(), O = DESIGN.wheelCenter, U = DESIGN.upperCenter, L = DESIGN.leftCenter;
  const lever = leverOutline();
  const racks = rackLayout();

  const metal = (color, m = 0.2, r = 0.5) => matte(color, { metalness: m, roughness: r });
  const leverMaterial = metal(PALETTE.driven, 0.17, 0.52);
  const wheelMaterial = metal(PALETTE.driver, 0.17, 0.52);
  const pinionMaterial = metal(PALETTE.accent, 0.3, 0.45);
  const balanceMaterial = metal(PALETTE.brass, 0.3, 0.5);
  const arborMaterial = metal(PALETTE.ink, 0.28, 0.44);

  // Lever B with anchor A: one plate.
  const leverGroup = new THREE.Group();
  leverGroup.userData.role = 'lever-B-with-anchor-A-one-rigid-plate';
  const leverPlate = tagged(new THREE.Mesh(extrudeOutline(lever.outer, lever.holes, PLANE.low, PLANE.high), leverMaterial),
    'lever-B-anchor-A-and-single-toothed-arm-one-plate');
  leverGroup.add(leverPlate);
  root.add(leverGroup);

  // Escape wheel: one plate with Brown's twelve saw teeth, and a collet.
  const wheelGroup = new THREE.Group();
  wheelGroup.position.set(O[0], O[1], 0);
  wheelGroup.userData.role = 'escape-wheel';
  const bore = circlePoints([0, 0], DESIGN.boreRadius, 48).reverse();
  const wheelPlate = tagged(new THREE.Mesh(extrudeOutline(wheelOutline(), [bore], PLANE.low, PLANE.high), wheelMaterial),
    'escape-wheel-single-plate-twelve-saw-teeth');
  const collet = tagged(new THREE.Mesh(ring(DESIGN.boreRadius, 0.41, PLANE.high - 0.01, PLANE.high + 0.05, 96), wheelMaterial),
    'escape-wheel-collet');
  wheelGroup.add(wheelPlate, collet);
  root.add(wheelGroup);

  // Balances with their pinions (rigid on one collar), turning on fixed arbors.
  const makeBalance = (center, plane, label) => {
    const group = new THREE.Group();
    group.position.set(center[0], center[1], 0);
    group.userData.role = `${label}-balance-with-pinion`;
    const wheel = tagged(new THREE.Mesh(balanceGeometry(plane.low, plane.high), balanceMaterial), `${label}-balance-wheel`);
    // The web is sunk 0.03 into the rim and hub and is thinner than both,
    // so none of its faces lies on theirs.
    const web = tagged(new THREE.Mesh(ring(HUB_RADIUS - 0.03, BALANCE_INNER + 0.03, plane.low + 0.02, plane.high - 0.03, 240), balanceMaterial.clone()), `${label}-balance-see-through-web`);
    makeSeeThrough(web);
    const collar = tagged(new THREE.Mesh(ring(DESIGN.boreRadius + 0.008, 0.12, plane.high - 0.01, PLANE.low + 0.01, 64), balanceMaterial), `${label}-balance-collar-to-pinion`);
    const pinion = tagged(new THREE.Mesh(pinionGeometry(), pinionMaterial), `${label}-balance-involute-pinion`);
    group.add(wheel, web, collar, pinion);
    root.add(group);
    const bearing = tagged(new THREE.Mesh(ring(DESIGN.boreRadius - 0.006, 0.2, plane.low - 0.14, plane.low - 0.02, 64), arborMaterial), `${label}-balance-rear-bearing`);
    bearing.position.set(center[0], center[1], 0);
    const arbor = arborMesh(center, DESIGN.boreRadius, plane.low - 0.10, PLANE.high + 0.03, arborMaterial, `${label}-balance-fixed-arbor`);
    root.add(bearing, arbor);
    return { group, wheel, web, collar, pinion, bearing, arbor };
  };
  const upper = makeBalance(U, UPPER_BALANCE, 'upper');
  const left = makeBalance(L, LEFT_BALANCE, 'left');

  // The bar Brown draws from B's boss over the wheel to a round boss at its
  // centre (teeth under it dotted): the fixed bridge carrying the lever and
  // wheel arbors, in front of every moving part and see-through.
  const bridgeShape = polygonClipping.difference(
    polygonClipping.union(
      [close(circlePoints([0, 0], 0.24, 72))],
      [close(circlePoints(O, 0.59, 144))],
      (() => {
        const d = [O[0], O[1]], l = Math.hypot(...d), n = [-d[1] / l * 0.11, d[0] / l * 0.11];
        return [close([[n[0], n[1]], [d[0] + n[0], d[1] + n[1]], [d[0] - n[0], d[1] - n[1]], [-n[0], -n[1]]])];
      })(),
    ),
    [close(circlePoints([0, 0], DESIGN.boreRadius, 48))],
    [close(circlePoints(O, DESIGN.boreRadius, 48))],
  );
  const [bridgeOuter, ...bridgeHoles] = bridgeShape[0].map((r) => r.slice(0, -1));
  const bridge = tagged(new THREE.Mesh(extrudeOutline(bridgeOuter, bridgeHoles, BRIDGE.low, BRIDGE.high), metal(PALETTE.frame, 0.2, 0.55)),
    'fixed-bridge-carrying-lever-and-escape-wheel-arbors');
  makeSeeThrough(bridge);
  root.add(bridge);
  // Fixed arbors of the lever and the wheel end just inside the bridge.
  const leverArbor = arborMesh([0, 0], DESIGN.boreRadius, PLANE.low - 0.06, BRIDGE.high - 0.01, arborMaterial, 'lever-B-fixed-arbor');
  const wheelArbor = arborMesh(O, DESIGN.boreRadius, PLANE.low - 0.06, BRIDGE.high - 0.01, arborMaterial, 'escape-wheel-fixed-arbor');
  root.add(leverArbor, wheelArbor);

  // Pinion phases: at the plate pose (lever 0) a rack tooth stands on each
  // pitch point, so each pinion shows a tooth space there.
  const N = DESIGN.pinionTeeth;
  const upperPhase = g.upperAngle - Math.PI / N;
  const leftPhase = g.leftAngle + Math.PI - Math.PI / N;
  const bake = guernseyAnchorBake;
  const wheelAngleAt = (time) => {
    const cycles = Math.floor(time / bake.period), x = (time / bake.period - cycles) * bake.steps;
    const i = Math.min(bake.steps - 1, Math.floor(x)), f = x - i;
    return bake.angles[i] + (bake.angles[i + 1] - bake.angles[i]) * f + cycles * bake.advancePerPeriod;
  };
  const wheelStateAt = (time) => {
    const x = ((time / bake.period) % 1 + 1) % 1;
    return ['free-drop', 'following-pallet-face', 'pushed-back-by-pallet', 'resting-on-pallet'][bake.states[Math.round(x * bake.steps) % bake.steps]];
  };
  const stateAtTime = (time) => {
    const theta = leverAngleAt(time);
    return {
      leverAngle: theta,
      upperBalanceAngle: upperPhase + g.upperRatio * theta,
      leftBalanceAngle: leftPhase + g.leftRatio * theta,
      wheelAngle: wheelAngleAt(time),
      wheelEvent: wheelStateAt(time),
    };
  };
  const update = (time) => {
    const state = stateAtTime(time);
    leverGroup.rotation.z = state.leverAngle;
    upper.group.rotation.z = state.upperBalanceAngle;
    left.group.rotation.z = state.leftBalanceAngle;
    wheelGroup.rotation.z = state.wheelAngle;
    root.userData.kinematics = state;
  };

  root.traverse((o) => { for (const m of [o.material].flat().filter(Boolean)) m.fog = false; });
  const source = SOURCE_POINTS;
  Object.assign(root.userData, {
    archetype: movement.archetype,
    fidelity: 'authored',
    hideGround: true,
    materialsIgnoreSceneFog: true,
    minimumDisplayCycleSeconds: DESIGN.period,
    animationTiming: { authoredCyclePeriod: DESIGN.period },
    timeline: { demonstrationPeriod: DESIGN.period, sourcePosePhase: 0 },
    blocks: { leverGroup, leverPlate, wheelGroup, wheelPlate, collet, upper, left, bridge, leverArbor, wheelArbor },
    geometry: { design: DESIGN, gearing: g, racks, seats: s, lever, pitch: pitch(), upperPhase, leftPhase, planes: { working: PLANE, upperBalance: UPPER_BALANCE, leftBalance: LEFT_BALANCE, bridge: BRIDGE } },
    stateAtTime,
    update,
    mechanism: 'One escape wheel drives anchor A, one piece with lever B; B\'s single curved arm carries internal teeth driving the upper balance pinion and external teeth driving the left balance pinion, so the balances oscillate in opposite directions.',
    constraints: {
      anchor: 'Anchor A, lever B and its single toothed arm are one rigid plate turning about B\'s fixed arbor.',
      escapement: 'The forward-urged escape wheel is stopped, pushed back or released only by contact of its outline with the two pallet blades (baked contact search, one tooth per lever period).',
      internalMesh: 'Internal involute teeth on the arm (pitch radius = upper centre distance + pinion pitch radius) turn the upper pinion with the lever: thetaUpper = +(Rin/r) thetaB.',
      externalMesh: 'External involute teeth on the arm (pitch radius = left centre distance - pinion pitch radius) turn the left pinion against the lever: thetaLeft = -(Rout/r) thetaB.',
    },
    reconstructionNote: 'Anchor A, lever B and B\'s single curved arm are one flat plate. Pallet A is Brown\'s narrow wedge hanging point-down; the lower pallet blade lies along a tooth\'s front face with its nose in the root at the end of its swing; the wheel follows the drawn outlines by contact (recoil anchor). The lever swing is a prescribed sinusoid of 13 degrees about a centre 3 degrees clockwise of the plate pose (the most the 0.24-deep teeth allow); balance springs, train torque and inertia are not modelled. The arm is two runs, each concentric with B as the gearing requires and stepped at the bar, where Brown draws one freer curve; each run carries sixteen fine teeth, all of which mesh over the swing, and the pinions have twenty teeth. The upper run reaches Brown\'s top end; the lower run stops about 12 degrees short of his lower end, and the upper run\'s teeth stop about 20 degrees short of the bar.',
    sourceReference: {
      officialPage: movement.sourceUrl,
      brownPlate402: { imageWidth: 525, imageHeight: 525, scale: SOURCE_SCALE, ...Object.fromEntries(Object.entries(source).map(([k, v]) => [`${k}Pixels`, v])) },
      usPatent35373: { number: 'US35373A', date: '1862-05-27', inventor: 'Calvin O. Guernsey', url: 'https://patents.google.com/patent/US35373A/en' },
    },
    sourceAnimation: { available: false, reason: 'The official page offers only Brown\'s static engraving.' },
    cameraDirection: new THREE.Vector3(0.5, 0.3, 18),
    cameraFitBounds: new THREE.Box3(new THREE.Vector3(-4.15, -2.45, -0.3), new THREE.Vector3(2.55, 3.4, 0.7)),
    cameraDistanceScale: 1.02,
  });
  markShadows(root);
  update(0);
  return { root, update, cameraDirection: root.userData.cameraDirection };
}

export function createAuthoredGuernseyEscapementMovement(movement) {
  if (movement.id !== 402) return null;
  return guernseyEscapement(movement);
}
