import * as THREE from 'three';
import {applyCutawayFor} from './cutaway-presentations.js';
import {
  PALETTE,
  makeShaft,
  markShadows,
  matte,
} from './primitives.js';

import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { circle, plate, poly, polygonClipping } from './finite-plate-geometry.js';
import { correctSpinningFanParts, fanAirflowCurve } from './spinning-fan-working-parts.js';

const Z_AXIS = new THREE.Vector3(0, 0, 1);

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function centeredExtrusion(shape, depth, bevel = 0.018) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: bevel > 0,
    bevelSegments: 2,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 42,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

// p100: the housing is a circle concentric with the fan (Brown's scroll is
// within a few pixels of one), a small uniform clearance outside the blade
// tips, with the straight spout leaving it tangentially at the bottom and a
// flange round its mouth, as drawn. The wall is one extrusion of that
// outline, smooth-shaded; the side plates share its outer outline.
export const FAN_HOUSING = Object.freeze({
  tipRadius: 3.30,
  clearance: 0.06,
  wall: 0.12,
  // Spout mouth: Brown's spout top sits half the casing radius below the
  // axis and its mouth 1.5 radii out.
  spoutTopFraction: 0.5,
  mouthFraction: 1.5,
  flangeReach: 0.22,
  flangeThickness: 0.12,
});

function housingOutlines() {
  const h = FAN_HOUSING;
  const inner = h.tipRadius + h.clearance, outer = inner + h.wall;
  const spoutTop = -h.spoutTopFraction * inner, mouth = h.mouthFraction * inner;
  const ring = (radius) => circle([0, 0], radius, 720);
  const shell = polygonClipping.union(poly(ring(outer)), poly([[0, -outer], [mouth, -outer], [mouth, spoutTop + h.wall], [0, spoutTop + h.wall]]));
  const cavity = polygonClipping.union(poly(ring(inner)), poly([[0, -inner], [mouth + 1, -inner], [mouth + 1, spoutTop], [0, spoutTop]]));
  const flange = poly([
    [mouth - h.flangeThickness, -outer - h.flangeReach], [mouth, -outer - h.flangeReach],
    [mouth, spoutTop + h.wall + h.flangeReach], [mouth - h.flangeThickness, spoutTop + h.wall + h.flangeReach],
  ]);
  return {
    inner, outer, spoutTop, mouth,
    wall: polygonClipping.difference(polygonClipping.union(shell, flange), cavity),
    side: polygonClipping.union(shell, flange),
  };
}

function smoothPlate(polygons, low, high) {
  const raw = plate(polygons, low, high);
  const geometry = toCreasedNormals(raw, Math.PI / 6);
  raw.dispose();
  return geometry;
}

function voluteSidePlateGeometry(depth, inletRadius) {
  const {side} = housingOutlines();
  return smoothPlate(polygonClipping.difference(side, poly(circle([0, 0], inletRadius, 256))), -depth / 2, depth / 2);
}

// p100: Brown draws each vane as a thin curved blade plate carried on the
// broad end of a separate curved arm from the hub. Blade 0 as drawn at the
// start (polar radius, degrees): its centreline is the circular arc through
// its inner end, middle and tip, bowed toward the counter-clockwise turn.
const BLADE = {inner: [1.75, 51], middle: [2.60, 57.5], tip: [3.2787, 55], halfThickness: 0.06};
const polar = ([radius, degrees]) => new THREE.Vector2(radius * Math.cos(degrees * Math.PI / 180), radius * Math.sin(degrees * Math.PI / 180));

function bladeArc() {
  const [a, m, c] = [BLADE.inner, BLADE.middle, BLADE.tip].map(polar);
  // Circumcentre of the three points.
  const d = 2 * (a.x * (m.y - c.y) + m.x * (c.y - a.y) + c.x * (a.y - m.y));
  const sq = (v) => v.x * v.x + v.y * v.y;
  const center = new THREE.Vector2(
    (sq(a) * (m.y - c.y) + sq(m) * (c.y - a.y) + sq(c) * (a.y - m.y)) / d,
    (sq(a) * (c.x - m.x) + sq(m) * (a.x - c.x) + sq(c) * (m.x - a.x)) / d,
  );
  const radius = a.distanceTo(center);
  const angle = (v) => Math.atan2(v.y - center.y, v.x - center.x);
  const a0 = angle(a);
  let a1 = angle(c);
  const am = angle(m);
  // Take the way round that passes the middle point.
  const between = (x, lo, hi) => (lo < hi ? x > lo && x < hi : x > hi && x < lo);
  const wrap = (x) => x - 2 * Math.PI * Math.round((x - a0) / (2 * Math.PI));
  a1 = wrap(a1);
  if (!between(wrap(am), a0, a1)) a1 += a1 > a0 ? -2 * Math.PI : 2 * Math.PI;
  const at = (t, offset = 0) => {
    const q = a0 + (a1 - a0) * t;
    return new THREE.Vector2(center.x + (radius + offset) * Math.cos(q), center.y + (radius + offset) * Math.sin(q));
  };
  // Offset side (+1 or -1) that lies toward the counter-clockwise turn.
  const mid = at(0.5), out = at(0.5, 0.01).sub(mid);
  const leadingSign = out.dot(new THREE.Vector2(-mid.y, mid.x)) > 0 ? 1 : -1;
  return {at, leadingSign};
}

function bladeGeometry(depth) {
  const {at} = bladeArc(), samples = 64, t = BLADE.halfThickness;
  const side = (offset) => Array.from({length: samples + 1}, (_, i) => at(i / samples, offset).toArray());
  const outline = [...side(t), ...side(-t).reverse()];
  return smoothPlate(poly(outline), -depth / 2, depth / 2);
}

// The arm runs from inside the hub to the blade: its trailing edge meets the
// blade's inner end and runs along the blade's centreline (so the arm is
// solidly welded into the plate) out to its broad square end.
function armGeometry(depth) {
  const {at} = bladeArc();
  const along = (radius) => {
    let lo = 0, hi = 1;
    for (let k = 0; k < 50; k += 1) { const mid = (lo + hi) / 2; if (at(mid).length() < radius) lo = mid; else hi = mid; }
    return lo;
  };
  const endT = along(2.48), samples = 24;
  const trailing = new THREE.SplineCurve([[0.40, 33], [0.90, 41], [1.30, 46], [1.62, 49.5]].map(polar)).getPoints(32);
  const onBlade = Array.from({length: samples + 1}, (_, i) => at(endT * i / samples));
  const leading = new THREE.SplineCurve([[2.50, 61.5], [2.16, 61], [1.60, 61], [1.00, 65], [0.40, 77]].map(polar)).getPoints(48);
  const outline = [...trailing, ...onBlade, ...leading].map((v) => v.toArray());
  return smoothPlate(poly(outline), -depth / 2, depth / 2);
}

function makeHousingWall(material, depth) {
  const {wall} = housingOutlines();
  const mesh = addRole(new THREE.Mesh(smoothPlate(wall, -depth / 2, depth / 2), material),
    'continuous-finite-volute-wall');
  const group = addRole(new THREE.Group(), 'open-peripheral-wall-of-volute-and-spout');
  group.add(mesh);
  group.userData.mesh = mesh;
  return group;
}

function centrifugalFanBlower(movement) {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const officialCyclesPerMinute = 15;
  const cycleDuration = 60 / officialCyclesPerMinute;
  const rotorAngularSpeed = fullTurn / cycleDuration;
  const bladeCount = 3;
  const bladeDepth = 0.72;
  const casingDepth = 1.28;
  const inletRadius = 1.18;
  const hubRadius = 0.57;
  const impellerOuterRadius = FAN_HOUSING.tipRadius;
  const armDepth = 0.14;
  const flowCyclesPerRotorCycle = 2;
  const flowCyclesPerSecond = flowCyclesPerRotorCycle / cycleDuration;

  const impeller = addRole(new THREE.Group(),
    'three-curved-blade-impeller-fast-with-shaft');
  const bladeMaterial = matte(PALETTE.driver, {
    metalness: 0.2,
    roughness: 0.46,
  });
  const hubMaterial = matte(PALETTE.brass, { metalness: 0.3, roughness: 0.39 });
  const oneBladeGeometry = bladeGeometry(bladeDepth);
  const oneArmGeometry = armGeometry(armDepth);
  const blades = [];
  const arms = [];
  for (let index = 0; index < bladeCount; index += 1) {
    const blade = addRole(new THREE.Mesh(oneBladeGeometry, bladeMaterial),
      `curved-blade-plate-${index + 1}-on-impeller-arm`);
    blade.rotation.z = index / bladeCount * fullTurn;
    blade.userData.bladeIndex = index;
    blades.push(blade);
    // The arm is cast with the hub, so it shares the hub's colour.
    const arm = addRole(new THREE.Mesh(oneArmGeometry, hubMaterial),
      `curved-impeller-arm-${index + 1}-carrying-blade`);
    arm.rotation.z = blade.rotation.z;
    arm.userData.bladeIndex = index;
    arms.push(arm);
    impeller.add(arm, blade);
  }
  const hub = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(hubRadius, hubRadius, bladeDepth + 0.26, 46),
    hubMaterial,
  ), 'impeller-hub-fixed-to-shaft');
  hub.rotation.x = Math.PI / 2;
  const hubIndex = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(hubRadius * 0.72, 0.065, bladeDepth + 0.3),
    matte(PALETTE.white, { roughness: 0.38 }),
  ), 'visible-impeller-rotation-index');
  hubIndex.position.x = hubRadius * 0.48;
  const shaft = makeShaft({
    axis: Z_AXIS,
    color: PALETTE.ink,
    length: 3.65,
    radius: 0.13,
  });
  shaft.userData.role = 'fan-driving-shaft';
  impeller.add(hub, hubIndex, shaft);

  const rearCasingMaterial = matte(PALETTE.frame, {
    metalness: 0.11,
    opacity: 0.76,
    roughness: 0.69,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const frontCasingMaterial = matte(PALETTE.frame, {
    depthWrite: false,
    metalness: 0.08,
    opacity: 0.24,
    roughness: 0.72,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const wallMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    opacity: 0.64,
    roughness: 0.66,
    transparent: true,
  });
  const plateGeometry = voluteSidePlateGeometry(0.12, inletRadius);
  const rearPlate = addRole(new THREE.Mesh(
    plateGeometry,
    rearCasingMaterial,
  ), 'rear-volute-side-with-circular-inlet-opening');
  rearPlate.position.z = -casingDepth / 2;
  rearPlate.userData.fixed = true;
  const frontPlate = addRole(new THREE.Mesh(
    plateGeometry,
    frontCasingMaterial,
  ), 'transparent-front-volute-side-with-circular-inlet-opening');
  frontPlate.position.z = casingDepth / 2;
  frontPlate.userData.fixed = true;
  frontPlate.renderOrder = 4;
  const housing = housingOutlines();
  const voluteWall = makeHousingWall(wallMaterial, casingDepth - 0.12);
  voluteWall.userData.fixed = true;
  const inletRimMaterial = matte(PALETTE.ink, {
    metalness: 0.23,
    roughness: 0.46,
  });
  const inletRims = [-1, 1].map((side, index) => {
    const rim = addRole(new THREE.Mesh(
      new THREE.TorusGeometry(inletRadius, 0.085, 12, 72),
      inletRimMaterial,
    ), `${side > 0 ? 'front' : 'rear'}-circular-air-inlet-rim`);
    rim.position.z = side * (casingDepth / 2 + 0.08);
    rim.userData.fixed = true;
    rim.userData.inletIndex = index;
    return rim;
  });

  // The spout's mouth flange is part of the wall's extrusion.
  const outletLips = [];

  const bearingMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.43,
  });
  const bearings = [-1.22, 1.22].map((z, index) => {
    const bearing = addRole(new THREE.Mesh(
      new THREE.TorusGeometry(0.26, 0.07, 10, 40),
      bearingMaterial,
    ), `fixed-fan-shaft-bearing-${index + 1}`);
    bearing.position.z = z;
    bearing.userData.fixed = true;
    return bearing;
  });

  const airflowCurves = [];
  for (const side of [-1, 1]) {
    for (const lane of [-1, 0, 1]) {
      airflowCurves.push(fanAirflowCurve(side, lane));
    }
  }
  const airflowMaterial = matte(PALETTE.white, {
    depthWrite: false,
    opacity: 0.88,
    roughness: 0.22,
    transparent: true,
  });
  const airflowParticles = [];
  const particlesPerCurve = 4;
  for (let curveIndex = 0; curveIndex < airflowCurves.length; curveIndex += 1) {
    for (let index = 0; index < particlesPerCurve; index += 1) {
      const particle = addRole(new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 12, 9),
        airflowMaterial,
      ), 'arc-length-sampled-intake-radial-discharge-air-particle');
      particle.userData.curveIndex = curveIndex;
      particle.userData.phaseOffset =
        (index + curveIndex / airflowCurves.length) / particlesPerCurve;
      particle.renderOrder = 3;
      airflowParticles.push(particle);
    }
  }

  root.add(
    rearPlate,
    voluteWall,
    ...inletRims,
    ...bearings,
    impeller,
    ...airflowParticles,
    frontPlate,
  );

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    const cyclePosition = cycleTime / cycleDuration;
    const rotorAngle = fullTurn * cyclePosition;
    const particleStates = airflowParticles.map((particle) => {
      const progress = THREE.MathUtils.euclideanModulo(
        time * flowCyclesPerSecond + particle.userData.phaseOffset,
        1,
      );
      return {
        curveIndex: particle.userData.curveIndex,
        position: airflowCurves[particle.userData.curveIndex]
          .getPointAt(progress),
        progress,
        visibilityScale: Math.sin(Math.PI * progress),
      };
    });
    return {
      cyclePosition,
      cycleTime,
      particleStates,
      rotorAngle,
      rotorAngularSpeed,
      rotationDirection: 'counterclockwise-viewed-from-front-positive-z',
    };
  };

  root.userData.archetype =
    'three-backward-curved-blade-centrifugal-fan-in-double-inlet-volute';
  root.userData.mechanism =
    'shaft-rotates-three-vane-impeller-counterclockwise-air-enters-both-side-eyes-turns-radially-and-leaves-tangential-spout-under-pressure';
  root.userData.blocks = {
    airflowCurves,
    airflowParticles,
    bearings,
    arms,
    blades,
    frontPlate,
    hub,
    hubIndex,
    impeller,
    inletRims,
    outletLips,
    rearPlate,
    shaft,
    voluteWall,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.35, -4.05, -2.18),
    new THREE.Vector3(5.18, 4.25, 2.18),
  );
  root.userData.canonicalTimes = {
    cycleClosure: cycleDuration,
    halfTurn: cycleDuration / 2,
    quarterTurn: cycleDuration / 4,
    sourcePose: 0,
  };
  root.userData.degreesOfFreedom = {
    independentShaftInputs: 1,
    independentBladeCoordinates: 0,
  };
  root.userData.geometry = {
    bladeCount,
    bladeDepth,
    casingDepth,
    cycleDuration,
    hubRadius,
    impellerOuterRadius,
    inletRadius,
    housingInnerRadius: housing.inner,
    housingOuterRadius: housing.outer,
    tipClearance: FAN_HOUSING.clearance,
    outletBounds: {
      bottom: -housing.inner,
      left: Math.sqrt(housing.inner ** 2 - housing.spoutTop ** 2),
      right: housing.mouth,
      top: housing.spoutTop,
    },
    shaftAxis: Z_AXIS.clone(),
  };
  root.userData.sourceAnimation = {
    available: true,
    cyclesPerMinute: officialCyclesPerMinute,
    durationSeconds: cycleDuration,
    officialCanvasModelPresent: true,
    rotatingDefinition:
      'one three-blade group add_rot about source [0,0] by cyclePos',
    rotationDirection: 'counterclockwise',
    sourceBounds: [-9, -9, 18, 18],
    sourceUrl: movement.sourceUrl,
    staticDefinition:
      'one casing group with paired side-opening circles, volute, and right spout',
  };
  root.userData.sourceReference = {
    historicalCorroboration: {
      detail:
        'Innes treats centrifugal-fan construction as a rotating wheel within a casing and documents inlet, impeller, and delivery arrangements for centrifugal fans.',
      title:
        'The Fan: Including the Theory and Practice of Centrifugal and Axial Fans (2nd ed., 1916)',
      url:
        'https://archive.org/details/fanincludingtheo00innerich',
    },
    modernTerminologyCheck: {
      detail:
        'AMCA defines a centrifugal fan as receiving air essentially axially and discharging it perpendicular to the axis, with one or two inlets and a scroll casing.',
      standard: 'ANSI/AMCA Standard 99-16',
      url:
        'https://www.amca.org/assets/resources/public/Standards%20for%20Member%20Download/amca-99-16.pdf',
    },
    officialDescription: movement.description,
    officialInlineModelUrl: movement.sourceUrl,
    reconstructionDisclosure:
      'The impeller count, counterclockwise direction, fixed volute, double side inlets, source center, and 15-cpm cycle are explicit in the official canvas; depth, transparency, and airflow tracers are explanatory 3D choices.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    flowCyclesPerRotorCycle,
    flowCyclesPerSecond,
    officialCyclesPerMinute,
    rotorAngularSpeed,
    rotorTurnsPerCycle: 1,
    shaftToImpellerRatio: 1,
  };
  root.userData.cameraDistanceScale = 1.04;

  const update = (time) => {
    const state = stateAtTime(time);
    impeller.rotation.z = state.rotorAngle;
    airflowParticles.forEach((particle, index) => {
      const particleState = state.particleStates[index];
      particle.position.copy(particleState.position);
      particle.scale.setScalar(particleState.visibilityScale);
    });
    impeller.userData.angularSpeed = rotorAngularSpeed;
    shaft.userData.angularSpeed = rotorAngularSpeed;
    root.userData.flow = {
      direction:
        'axial-in-through-both-circular-side-openings-radial-outward-through-impeller-tangential-out-through-spout',
      particleStates: state.particleStates,
    };
    root.userData.kinematics = state;
  };
  update(0);
  root.userData.fidelity = 'authored';
  markShadows(root);
  correctSpinningFanParts(root, 497);
  return {
    root,
    update,
    cameraDirection: root.userData.cameraDirection,
  };
}

export function createAuthoredFanBlowerMovement(movement) {
  if (movement.id !== 497) return null;
  return applyCutawayFor(centrifugalFanBlower(movement), movement.id);
}
