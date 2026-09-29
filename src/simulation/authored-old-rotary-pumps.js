import * as THREE from 'three';
import { PALETTE, markShadows, matte } from './primitives.js';
import { circle, plate, poly, polygonClipping as clip } from './finite-plate-geometry.js';
import { mergePassageParts } from './finite-fluid-passages.js';
import { portedCasingGeometry, roundPortPipeGeometry } from './round-port-pipes.js';
import { waterVolumeMaterial } from './water-volume.js';
import { applyRotationIndicator } from './rotation-indicator.js';
import { WaterStream, guidedPath } from './water-stream.js';

// Movement 455, Brown's old rotary pump.
//
// Brown's central part is a MUTILATED CYLINDER: a hollow drum with two
// diametrically opposite chordal flats. Each valve is a circular segment,
// hinged at the leading end of its flat: a straight inner face that beds on the
// flat and a circular-arc back of the drum's own radius. Folded home, the two
// valves restore the perfect cylinder, which passes the fixed abutment (the
// hatched projection in the lower right, part of the casing) with a close
// running fit. Away from the abutment each valve swings out until its edge
// bears on the inner surface of the outer cylinder, so the annulus is divided
// into sealed cells swept clockwise from the lower entrance round the long
// left-hand path to the upper exit.

const FULL_TURN = Math.PI * 2;
const deg = THREE.MathUtils.degToRad;

const CASING_INNER = 2.35;
const CASING_OUTER = 2.62;
const CASING_HALF_DEPTH = 0.38;
const ROTOR_RADIUS = 1.33; // Brown: drum about 0.565 of the bore
const ROTOR_HALF_DEPTH = 0.36;
const ROTOR_WALL = 0.18;
const SHAFT_RADIUS = 0.22;
const FLAT_SPAN = deg(52); // angular span of each chordal flat
const KNUCKLE = 0.075; // hinge knuckle radius, tangent inside the drum
const HINGE_PIN = 0.036; // pin through the knuckle (Brown's hinge circle)
const WEB_DEPTH = 0.06; // rotor rear web, closing the bore and recesses
const CLEAR = 0.006; // running clearance of knuckle, flats and abutment
const TIP_CLEAR = 0.004; // valve edge to bore when bearing on the casing
const CONTACT_GAP = 0.002; // film left where a valve bears on the abutment
const INLET_X = -0.08;
const PORT_BORE = 0.34;
const PORT_OUTER = 0.44;
const OUTLET_ANGLE = deg(36);
const ABUTMENT_X = INLET_X + PORT_BORE; // flush with the inlet's right bore
const SOURCE_ROTOR_ANGLE = deg(8.5); // Brown's right hinge sits just above centre
const CYCLE = 6.0;
// The chamber-limited opening depends only on fixed geometry: built once.
const CONSTRAINT_CACHE = {};

const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const rot = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const arc = (r, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => {
  const a = a0 + (a1 - a0) * i / n;
  return [r * Math.cos(a), r * Math.sin(a)];
});

const snap = multi => multi.map(polygon => polygon.map(ring => ring.map(([x, y]) => [Math.round(x * 1e7) / 1e7, Math.round(y * 1e7) / 1e7])));

function convexHull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), q) <= 1e-12) lower.pop();
    lower.push(q);
  }
  for (const q of p.reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), q) <= 1e-12) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]; // counter-clockwise
}

function segmentDistance(p, a, b) {
  const d = [b[0] - a[0], b[1] - a[1]], L = d[0] * d[0] + d[1] * d[1];
  const t = L ? Math.min(1, Math.max(0, ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1]) / L)) : 0;
  return Math.hypot(p[0] - a[0] - t * d[0], p[1] - a[1] - t * d[1]);
}

function inside(point, ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > point[1]) !== (b[1] > point[1])
      && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

// Section outlines, all in the rotor frame for valve 0 (hinge on +x).
export function oldRotaryPumpSections() {
  const r = ROTOR_RADIUS;
  const pivot = [r - KNUCKLE, 0];
  // The valve: a circular segment of the drum's radius from just past the
  // hinge to its free edge, plus the rounded heel round the knuckle.
  const back = arc(r, deg(0.2), FLAT_SPAN - deg(0.25), 72);
  const knuckle = circle(pivot, KNUCKLE, 48);
  const valve = convexHull([...knuckle, ...back]);
  // The drum's recess: the same outline with running clearance round the
  // knuckle and along the straight face.
  const recess = convexHull([
    ...circle(pivot, KNUCKLE + CLEAR, 64),
    ...arc(r + 0.05, 0, FLAT_SPAN + deg(4), 96),
    ...arc(r, 0, FLAT_SPAN, 96).map(([x, y]) => {
      const n = Math.hypot(x, y);
      return [x - CLEAR * x / n, y - CLEAR * y / n];
    }),
  ]);
  // Keep the recess inside the drum circle (its outer part is only a cutter).
  const recessInDrum = clip.intersection(poly(recess), poly(circle([0, 0], r, 720)));
  return { back, knuckle, pivot, recess, recessInDrum, valve };
}

function oldRotaryPump(movement) {
  const root = new THREE.Group();
  const omega = FULL_TURN / CYCLE;
  const r = ROTOR_RADIUS;
  const sections = oldRotaryPumpSections();
  const { pivot, valve: valveRing } = sections;
  const tipIndex = valveRing.reduce((best, p, i) =>
    Math.hypot(p[0] - pivot[0], p[1] - pivot[1])
      > Math.hypot(valveRing[best][0] - pivot[0], valveRing[best][1] - pivot[1]) ? i : best, 0);
  const valveReach = Math.hypot(valveRing[tipIndex][0] - pivot[0], valveRing[tipIndex][1] - pivot[1]);

  // Brown's projection: the square block in the lower-right annulus, its
  // upright face flush with the entrance bore and its top level with the foot
  // of the drum; the corner runs past the drum with the running clearance.
  const abutmentTop = -Math.sqrt(r * r - ABUTMENT_X * ABUTMENT_X) - CLEAR;
  const abutmentRight = Math.sqrt((CASING_INNER + 0.02) ** 2 - abutmentTop ** 2);
  const abutmentBottom = -Math.sqrt((CASING_INNER + 0.02) ** 2 - ABUTMENT_X ** 2);
  const abutmentCorner = [ABUTMENT_X, abutmentTop];
  const abutmentRing = [
    abutmentCorner,
    [ABUTMENT_X, abutmentBottom],
    ...arc(CASING_INNER + 0.02, Math.atan2(abutmentBottom, ABUTMENT_X), Math.atan2(abutmentTop, abutmentRight), 48).slice(1, -1),
    [abutmentRight, abutmentTop],
  ];

  // Opening law: each valve is pressed out (by the water and its own weight
  // swinging it) as far as the chamber allows: its edge rides the bore, then
  // the abutment's top, which folds it home into the drum, and after the
  // corner it swings out again down the abutment's upright face.
  const valvePointAt = (p, hingeAngle, open) => {
    const q = rot([p[0] - pivot[0], p[1] - pivot[1]], -open);
    return rot([q[0] + pivot[0], q[1] + pivot[1]], hingeAngle);
  };
  const feasible = (hingeAngle, open) => {
    const world = valveRing.map(p => valvePointAt(p, hingeAngle, open));
    for (const p of world) {
      if (Math.hypot(p[0], p[1]) > CASING_INNER - TIP_CLEAR + 1e-9) return false;
      if (inside(p, abutmentRing)) return false;
      if (segmentDistance(p, abutmentCorner, [abutmentRight, abutmentTop]) < CONTACT_GAP) return false;
      if (segmentDistance(p, abutmentCorner, [ABUTMENT_X, abutmentBottom]) < CONTACT_GAP) return false;
    }
    if (inside(abutmentCorner, world)) return false;
    return world.every((p, i) => segmentDistance(abutmentCorner, p, world[(i + 1) % world.length]) >= CONTACT_GAP);
  };
  // Unobstructed opening: the edge bearing on the bore.
  let freeLow = 0, freeHigh = deg(150);
  for (let i = 0; i < 40; i += 1) {
    const mid = (freeLow + freeHigh) / 2;
    const tip = valvePointAt(valveRing[tipIndex], 0, mid);
    if (Math.hypot(tip[0], tip[1]) <= CASING_INNER - TIP_CLEAR) freeLow = mid; else freeHigh = mid;
  }
  const freeOpen = freeLow;
  const constrainedOpen = (hingeAngle) => {
    // Far from the abutment only the bore limits the valve.
    const at = rot(pivot, hingeAngle);
    if (abutmentRing.every((p, i) => segmentDistance(at, p, abutmentRing[(i + 1) % abutmentRing.length]) > valveReach + 0.2)) return freeOpen;
    const step = deg(2);
    let low = 0, high = freeOpen;
    for (let a = step; a < freeOpen + step; a += step) {
      const trial = Math.min(a, freeOpen);
      if (feasible(hingeAngle, trial)) low = trial;
      else { high = trial; break; }
    }
    if (low === freeOpen) return low;
    for (let i = 0; i < 24; i += 1) {
      const mid = (low + high) / 2;
      if (feasible(hingeAngle, mid)) low = mid; else high = mid;
    }
    return low;
  };
  // Table by rotor travel (clockwise), one entry per quarter degree.
  const TABLE = 720;
  const openTable = CONSTRAINT_CACHE.table ??= Float64Array.from({ length: TABLE + 1 }, (_, j) =>
    j < TABLE ? constrainedOpen(-FULL_TURN * j / TABLE) : 0);
  // Once the edge clears the abutment the valve could fly open; the water
  // entering behind it swings it out over REOPEN_TRAVEL of rotation instead
  // (quintic ease), never beyond what the chamber allows.
  const REOPEN_TRAVEL = deg(40);
  let release = 0, jump = 0;
  for (let j = 0; j < TABLE; j += 1) {
    const rise = openTable[(j + 1) % TABLE] - openTable[j];
    if (rise > jump) { jump = rise; release = j; }
  }
  const releaseOpen = openTable[release];
  const eased = Float64Array.from(openTable);
  const rampSteps = Math.round(REOPEN_TRAVEL / (FULL_TURN / TABLE));
  for (let k = 1; k <= rampSteps; k += 1) {
    const j = (release + k) % TABLE, t = k / rampSteps;
    const ramp = releaseOpen + (freeOpen - releaseOpen) * t * t * t * (10 + t * (-15 + 6 * t));
    eased[j] = Math.min(openTable[j], ramp);
  }
  eased[TABLE] = eased[0];
  const openAtHingeAngle = (hingeAngle) => {
    const u = THREE.MathUtils.euclideanModulo(-hingeAngle, FULL_TURN) / FULL_TURN * TABLE;
    const i = Math.min(TABLE - 1, Math.floor(u)), t = u - i;
    return eased[i] * (1 - t) + eased[i + 1] * t;
  };
  const maximumOpen = freeOpen;

  const stateAtTime = (time) => {
    const rotorAngle = SOURCE_ROTOR_ANGLE - omega * time;
    const valves = [0, 1].map(index => {
      const hingeAngle = rotorAngle + index * Math.PI;
      const open = openAtHingeAngle(hingeAngle);
      const tip = valvePointAt(valveRing[tipIndex], hingeAngle, open);
      return {
        closedFraction: 1 - open / maximumOpen,
        hingeAngle,
        index,
        open,
        pivot: rot(pivot, hingeAngle),
        tip,
        tipRadius: Math.hypot(tip[0], tip[1]),
      };
    });
    return { rotorAngle, rotorAngularSpeed: -omega, valves };
  };

  // Materials.
  const frameMaterial = matte(PALETTE.frame, { metalness: 0.24, roughness: 0.58 });
  const rotorMaterial = matte(PALETTE.driver, { metalness: 0.14, roughness: 0.54 });
  const valveMaterial = matte(PALETTE.accent, { metalness: 0.14, roughness: 0.5 });
  const darkMaterial = matte(PALETTE.ink, { metalness: 0.22, roughness: 0.48 });
  // The blank faces behind the section plane (case back, rotor web) take a
  // plain muted finish: white would read as holes on the cream page.
  const paperMaterial = matte(PALETTE.muted, { roughness: 0.8 });
  const waterMaterial = waterVolumeMaterial({ opacity: 0.34 });

  const named = (mesh, role) => { mesh.userData.role = role; return mesh; };

  // Fixed casing: the outer cylinder and the abutment are one casting, pierced
  // by square ports only in the middle layer, where the round pipes enter.
  const inletHole = poly([[INLET_X - PORT_BORE, -2.95], [INLET_X + PORT_BORE, -2.95],
    [INLET_X + PORT_BORE, -2.0], [INLET_X - PORT_BORE, -2.0]]);
  const outletHole = poly([[2.0, -PORT_BORE], [2.95, -PORT_BORE], [2.95, PORT_BORE], [2.0, PORT_BORE]]
    .map(p => rot(p, OUTLET_ANGLE)));
  const casingShape = clip.union(
    clip.difference(poly(circle([0, 0], CASING_OUTER, 512)), poly(circle([0, 0], CASING_INNER, 512))),
    poly(abutmentRing),
  );
  const inletStart = new THREE.Vector3(INLET_X, -2.42, 0), inletEnd = new THREE.Vector3(INLET_X, -3.74, 0);
  const outletDir = new THREE.Vector3(Math.cos(OUTLET_ANGLE), Math.sin(OUTLET_ANGLE), 0);
  const outletStart = outletDir.clone().multiplyScalar(2.42), outletEnd = outletDir.clone().multiplyScalar(3.95);
  const casing = named(new THREE.Mesh(mergePassageParts([
    portedCasingGeometry(casingShape, -CASING_HALF_DEPTH, CASING_HALF_DEPTH, 0, PORT_BORE, [inletHole, outletHole]),
    roundPortPipeGeometry(inletStart, inletEnd, PORT_BORE, PORT_OUTER, 64),
    roundPortPipeGeometry(outletStart, outletEnd, PORT_BORE, PORT_OUTER, 64),
  ]), frameMaterial), 'fixed-outer-cylinder-with-abutment-and-port-pipes');
  root.add(casing);
  // Brown's section shows the blank back of the case; the front cover is cut away.
  // Pass 73: the cover has real thickness and carries a bearing boss on its
  // outside, so the rotor shaft runs through a journal, not an empty hole.
  const rearCover = named(new THREE.Mesh(
    plate(clip.difference(poly(circle([0, 0], CASING_INNER, 512)), poly(circle([0, 0], SHAFT_RADIUS + 0.004, 96)), poly(abutmentRing)),
      -CASING_HALF_DEPTH - 0.06, -CASING_HALF_DEPTH),
    paperMaterial,
  ), 'fixed-rear-cover-of-casing');
  root.add(rearCover);
  const rearBearing = named(new THREE.Mesh(
    plate(clip.difference(poly(circle([0, 0], 0.42, 96)), poly(circle([0, 0], SHAFT_RADIUS + 0.004, 96))),
      -CASING_HALF_DEPTH - 0.26, -CASING_HALF_DEPTH - 0.06),
    frameMaterial,
  ), 'fixed-bearing-boss-on-rear-cover-carrying-rotor-shaft');
  root.add(rearBearing);

  // Rotor: the mutilated hollow drum.
  const rotor = named(new THREE.Group(), 'central-mutilated-drum-rotor-turning-clockwise');
  root.add(rotor);
  const recesses = [0, Math.PI].map(a => sections.recess.map(p => rot(p, a)));
  // Relief for the heel's swing, swept over the full opening range.
  const heelRelief = [0, Math.PI].map(a => poly(heelSweep(sections.valve, pivot, maximumOpen * 1.02).map(p => rot(p, a))));
  // The drum wall keeps its thickness under the flats.
  const boreCutters = recesses.map(ring => poly(convexHull(ring.flatMap(p => circle(p, ROTOR_WALL, 24)))));
  const bore = clip.difference(poly(circle([0, 0], r - ROTOR_WALL, 360)), ...boreCutters);
  // One cutter per side (recess plus heel relief), applied in turn: the
  // clipping library is fragile with many near-coincident arcs at once.
  let drumSection = clip.difference(poly(circle([0, 0], r, 720)), bore);
  for (let i = 0; i < 2; i += 1) {
    drumSection = clip.difference(drumSection, snap(clip.union(poly(recesses[i]), snap(heelRelief[i]))));
  }
  const rotorBody = named(new THREE.Mesh(plate(drumSection, -ROTOR_HALF_DEPTH, ROTOR_HALF_DEPTH), rotorMaterial),
    'mutilated-hollow-drum-with-two-chordal-flats');
  rotor.add(rotorBody);
  // Rear end web closing the hollow drum, part of the rotor casting. It is
  // needed: it carries the drum on the shaft and takes the driving torque
  // (Brown draws no shaft in the section, so the drive is behind it). Its
  // hub carries the shaft, which runs out through the rear cover and its
  // bearing boss and ends a little beyond it. Brown leaves the bore blank,
  // as he leaves the case back blank: both lie behind the section plane,
  // so the web's face takes the same plain finish as the rear cover.
  // Pass 86: the web also closes the back of both valve recesses (it is the
  // drum's whole section less the wall), so it can carry the hinge pins.
  const webSection = clip.difference(poly(circle([0, 0], r, 720)), drumSection);
  const rotorRearWeb = named(new THREE.Mesh(plate(webSection, -ROTOR_HALF_DEPTH, -ROTOR_HALF_DEPTH + WEB_DEPTH), paperMaterial),
    'rotor-rear-end-web-behind-hollow-drum');
  rotor.add(rotorRearWeb);
  const shaftBack = -CASING_HALF_DEPTH - 0.46;
  const shaft = named(new THREE.Mesh(new THREE.CylinderGeometry(SHAFT_RADIUS, SHAFT_RADIUS, -ROTOR_HALF_DEPTH - shaftBack, 48), darkMaterial),
    'rotor-shaft-through-rear-cover-bearing');
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = (-ROTOR_HALF_DEPTH + shaftBack) / 2;
  rotor.add(shaft);

  // Pass 86: each valve turns on a hinge pin (Brown's small circle at each
  // hinge) through a bore in its knuckle. The pin is fast in the rear web and
  // runs out flush with the drum's front face; the valve stands just clear of
  // the web. Before this the loose knuckle only lay in an open cradle and
  // touched the drum along its thin root.
  const valveGeometry = plate(clip.difference(poly(sections.valve), poly(circle(pivot, HINGE_PIN + CLEAR / 2, 48))),
    -ROTOR_HALF_DEPTH + WEB_DEPTH + CLEAR, ROTOR_HALF_DEPTH);
  valveGeometry.translate(-pivot[0], -pivot[1], 0);
  const pocketWater = [];
  const valves = [0, 1].map(index => {
    const carrier = named(new THREE.Group(), `rotor-valve-${index + 1}-carrier`);
    carrier.rotation.z = index * Math.PI;
    rotor.add(carrier);
    const hinge = named(new THREE.Group(), `hinged-segment-valve-${index + 1}`);
    hinge.position.set(pivot[0], pivot[1], 0);
    carrier.add(hinge);
    const blade = named(new THREE.Mesh(valveGeometry, valveMaterial),
      `segment-valve-${index + 1}-with-drum-radius-arc-back`);
    hinge.add(blade);
    // Pass 104: the pin's back end stops 0.005 inside the web, so its end
    // face no longer lies on the web's rear face (they flickered).
    const pinSink = 0.005;
    const pin = named(new THREE.Mesh(new THREE.CylinderGeometry(HINGE_PIN, HINGE_PIN, 2 * ROTOR_HALF_DEPTH - pinSink, 32), darkMaterial),
      `hinge-pin-${index + 1}-fast-in-rotor-web`);
    pin.rotation.x = Math.PI / 2;
    pin.position.set(pivot[0], pivot[1], pinSink / 2);
    carrier.add(pin);
    const water = new PocketWater(sections.recessInDrum[0][0], waterMaterial);
    water.userData.role = `water-in-drum-recess-${index + 1}-behind-open-valve`;
    carrier.add(water);
    pocketWater.push(water);
    return { blade, carrier, hinge };
  });

  // Water: the annulus is always full (a primed pump); what the valves sweep
  // from the entrance leaves by the exit. The recess behind each open valve
  // fills and empties as the valve swings, so the drum plus water keeps the
  // chamber volume constant.
  const annulusWater = named(new THREE.Mesh(
    withoutCylinderFaces(plate(
      clip.difference(poly(circle([0, 0], CASING_INNER, 512)), poly(circle([0, 0], r, 720)), poly(abutmentRing)),
      -CASING_HALF_DEPTH + 0.002, CASING_HALF_DEPTH - 0.002,
    ), r),
    waterMaterial,
  ), 'water-filling-annulus-between-drum-and-casing');
  annulusWater.renderOrder = 1;
  root.add(annulusWater);
  const streamOptions = { width: PORT_BORE - 0.006, thickness: PORT_BORE - 0.006, radialSegments: 24, cyclePeriod: CYCLE, streakRate: 1, opacity: 0.34 };
  const inletWater = new WaterStream(guidedPath([inletEnd, new THREE.Vector3(INLET_X, -Math.sqrt(CASING_INNER ** 2 - INLET_X ** 2), 0)], { speed: 1, samples: 6 }), streamOptions);
  inletWater.userData.role = 'water-rising-in-lower-entrance-pipe';
  const outletWater = new WaterStream(guidedPath([outletDir.clone().multiplyScalar(CASING_INNER), outletEnd], { speed: 1, samples: 6 }), streamOptions);
  outletWater.userData.role = 'water-leaving-by-upper-exit-pipe';
  root.add(inletWater, outletWater);

  const update = (time) => {
    const state = stateAtTime(time);
    rotor.rotation.z = state.rotorAngle;
    state.valves.forEach((valve, index) => {
      valves[index].hinge.rotation.z = -valve.open;
      pocketWater[index].setOpen(valve.open, pivot);
    });
    inletWater.update(time);
    outletWater.update(time);
  };

  root.userData = {
    animationTiming: { authoredCyclePeriod: CYCLE, targetCycleDuration: 2 },
    archetype: 'old-two-hinged-vane-rotary-pump-with-fixed-abutment-lower-inlet-and-upper-outlet',
    blocks: { abutment: casing, annulusWater, casing, inletWater, outletWater, pocketWater, rearBearing, rearCover, rotor, rotorBody, rotorRearWeb, shaft, valves },
    degreesOfFreedom: { independentPrescribedInputs: 1, operatingDegreesOfFreedom: 1, valve1Independent: false, valve2Independent: false },
    fidelity: 'authored',
    geometry: {
      abutmentCorner, abutmentRing, casingDepth: 2 * CASING_HALF_DEPTH, casingInnerRadius: CASING_INNER,
      casingOuterRadius: CASING_OUTER, cycleDuration: CYCLE, flatSpan: FLAT_SPAN, knuckleRadius: KNUCKLE,
      maximumOpen, mechanismCyclePeriod: CYCLE, outletAngle: OUTLET_ANGLE, pivot, rotorRadius: r,
      runningClearance: CLEAR, tipClearance: TIP_CLEAR, valveCount: 2, valveReach,
    },
    mechanism:
      'A hollow drum with two opposite chordal flats (a mutilated cylinder) turns clockwise. Each flat carries a hinged segment valve whose arc back has the drum radius, so a folded valve restores the perfect cylinder. Away from the abutment each valve swings out until its edge bears on the bore, sweeping water from the lower entrance round the left and top to the upper exit; the square projection folds each valve home in turn and the closed cylinder passes it with a running fit.',
    motion: { cycleDuration: CYCLE, motionType: 'uniform-clockwise-drum-rotation-with-chamber-limited-valve-opening' },
    dynamics: {
      valveContactModel:
        'Each valve opens as far as the chamber allows (edge on the bore, the abutment top or its upright face), found by a swept-outline search tabulated per degree of rotor angle; the return force that holds it out (water pressure, weight) is not solved.',
      flowModel:
        'The annulus, recesses and both pipes stay full; flow is shown by the moving streaks in the pipes at the steady swept rate. Pressure, leakage and slip are not solved.',
    },
    sourceAnimation: { available: false, reason: 'The official page has no animation for Movement 455.' },
    sourceReference: {
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 455',
      reconstruction:
        'Mutilated drum at 0.565 of the bore (as drawn), two 52-degree flats, segment valves with drum-radius arc backs and knuckle heels, square abutment flush with the entrance bore; depth, clearances, speed and the chamber-limited opening law are engineered. Brown draws the flats about 65 degrees wide but the valves shorter than the flats; 52 degrees lets one segment both fill its flat and reach the bore.',
    },
    stateAtTime,
    update,
  };
  root.userData.openAtHingeAngle = openAtHingeAngle;
  root.userData.solidReview = {
    qualification: 'Finite drum, segment valves, knuckle recesses and casing with abutment; valves open only as far as the bore and abutment allow, with running clearances.',
  };
  root.userData.cameraFitBounds = new THREE.Box3(new THREE.Vector3(-2.75, -3.74, -0.4), new THREE.Vector3(3.3, 2.75, 0.4));
  root.userData.cameraDirection = new THREE.Vector3(0, 0.01, 1);
  root.userData.hideGround = true;
  root.userData.minimumDisplayCycleSeconds = CYCLE;
  markShadows(root);
  // The shaft end, seen from behind, is featureless: it takes the shared
  // quadrant cue so its turning reads.
  applyRotationIndicator(shaft, { axis: 'auto' });
  for (const object of [rearCover, rotorRearWeb, annulusWater, inletWater, outletWater, ...pocketWater]) {
    object.receiveShadow = false;
    object.castShadow = false;
  }
  root.traverse(o => { for (const m of o.material ? [].concat(o.material) : []) m.fog = false; });
  update(0);
  return { cameraDirection: root.userData.cameraDirection, root, update };
}

// Region swept by the valve near its heel as it opens by up to `open` about
// `pivot`, grown by the running clearance. In polar coordinates about the
// pivot the convex valve meets each circle in one arc [lo, hi]; the sweep
// widens that arc to [lo - open, hi].
function heelSweep(valve, pivot, open, reach = 0.24) {
  const lower = [], upper = [];
  for (let i = 0; i <= 40; i += 1) {
    const d = KNUCKLE + 0.002 + (reach - KNUCKLE - 0.002) * i / 40;
    let lo = Infinity, hi = -Infinity;
    for (let k = -720; k <= 720; k += 1) {
      const t = k * Math.PI / 720;
      if (inside([pivot[0] + d * Math.cos(t), pivot[1] + d * Math.sin(t)], valve)) { lo = Math.min(lo, t); hi = Math.max(hi, t); }
    }
    if (lo > hi) continue;
    const grow = CLEAR / d;
    lower.push([d + CLEAR, lo - open - grow]);
    upper.push([d + CLEAR, hi + grow]);
  }
  const toXY = ([d, t]) => [pivot[0] + d * Math.cos(t), pivot[1] + d * Math.sin(t)];
  return [...lower.map(toXY), ...upper.reverse().map(toXY)];
}

// Water body with its faces on the drum cylinder removed: there it meets the
// drum (opaque) or the water in an open recess, so no interior face shows.
function withoutCylinderFaces(geometry, radius) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  const p = source.attributes.position.array, kept = [];
  for (let i = 0; i < p.length; i += 9) {
    let onCylinder = true;
    for (let k = 0; k < 9; k += 3) if (Math.abs(Math.hypot(p[i + k], p[i + k + 1]) - radius) > 2e-3) onCylinder = false;
    if (!onCylinder) for (let k = 0; k < 9; k += 1) kept.push(p[i + k]);
  }
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(kept, 3));
  result.computeVertexNormals();
  if (source !== geometry) source.dispose();
  geometry.dispose();
  return result;
}

// Water in one drum recess: the recess clipped by the open valve's straight
// face (the valve lies wholly beyond it). Fixed-size buffer, rewritten in place.
class PocketWater extends THREE.Mesh {
  constructor(ring, material) {
    const outline = ring.slice(0, -1);
    const capacity = outline.length + 4;
    const count = (capacity - 2) * 6 + capacity * 6;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    super(geometry, material);
    this.outline = outline;
    this.capacity = capacity;
    this.renderOrder = 1;
    this.frustumCulled = false;
  }

  setOpen(open, pivot) {
    // Straight face of the valve at this opening: through the knuckle's
    // tangent, i.e. the hull edge that the closed valve lays on the flat.
    const face = this.face ?? (this.face = straightFace(pivot));
    const a = rotAbout(face[0], pivot, -open), b = rotAbout(face[1], pivot, -open);
    const d = [b[0] - a[0], b[1] - a[1]];
    const side = p => d[0] * (p[1] - a[1]) - d[1] * (p[0] - a[0]);
    // The valve lies on the side of the face away from the drum centre when closed.
    const keepSign = -Math.sign(side(rotAbout([ROTOR_RADIUS * Math.cos(FLAT_SPAN / 2), ROTOR_RADIUS * Math.sin(FLAT_SPAN / 2)], pivot, -open)));
    const polygon = [];
    const n = this.outline.length;
    for (let i = 0; i < n; i += 1) {
      const p = this.outline[i], q = this.outline[(i + 1) % n];
      const sp = side(p) * keepSign, sq = side(q) * keepSign;
      if (sp >= 0) polygon.push(p);
      if ((sp >= 0) !== (sq >= 0)) {
        const t = sp / (sp - sq);
        polygon.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
    this.write(polygon);
  }

  write(polygon) {
    const P = this.geometry.attributes.position.array;
    P.fill(0);
    const low = -CASING_HALF_DEPTH + 0.002, high = CASING_HALF_DEPTH - 0.002;
    let k = 0;
    const put = (x, y, z) => { P[k++] = x; P[k++] = y; P[k++] = z; };
    const m = Math.min(polygon.length, this.capacity);
    if (m >= 3 && Math.abs(area(polygon)) > 1e-5) {
      const ccw = area(polygon) > 0;
      for (let i = 1; i < m - 1; i += 1) {
        const [a, b, c] = [polygon[0], polygon[i], polygon[i + 1]];
        if (ccw) { put(a[0], a[1], high); put(b[0], b[1], high); put(c[0], c[1], high); put(a[0], a[1], low); put(c[0], c[1], low); put(b[0], b[1], low); }
        else { put(a[0], a[1], high); put(c[0], c[1], high); put(b[0], b[1], high); put(a[0], a[1], low); put(b[0], b[1], low); put(c[0], c[1], low); }
      }
      for (let i = 0; i < m; i += 1) {
        const a = polygon[i], b = polygon[(i + 1) % m];
        // Faces on the drum cylinder meet the annulus water: omit them.
        if (Math.abs(Math.hypot(...a) - ROTOR_RADIUS) < 2e-3 && Math.abs(Math.hypot(...b) - ROTOR_RADIUS) < 2e-3) continue;
        const [s, t] = ccw ? [a, b] : [b, a];
        put(s[0], s[1], low); put(t[0], t[1], low); put(t[0], t[1], high);
        put(s[0], s[1], low); put(t[0], t[1], high); put(s[0], s[1], high);
      }
    }
    this.geometry.setDrawRange(0, k / 3);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.visible = k > 0;
  }
}

const area = poly2 => poly2.reduce((s, p, i) => {
  const q = poly2[(i + 1) % poly2.length];
  return s + p[0] * q[1] - q[0] * p[1];
}, 0) / 2;

function rotAbout(p, pivot, angle) {
  return add(rot([p[0] - pivot[0], p[1] - pivot[1]], angle), pivot);
}

// The valve's straight face: from its tangent on the knuckle to the free edge.
function straightFace(pivot) {
  const tip = [ROTOR_RADIUS * Math.cos(FLAT_SPAN - deg(0.25)), ROTOR_RADIUS * Math.sin(FLAT_SPAN - deg(0.25))];
  const d = [tip[0] - pivot[0], tip[1] - pivot[1]], L = Math.hypot(...d);
  // Tangent from the tip to the knuckle circle on the drum-centre side.
  const beta = Math.asin(KNUCKLE / L), base = Math.atan2(-d[1], -d[0]);
  const candidates = [base + beta, base - beta].map(a => {
    const dir = [Math.cos(a), Math.sin(a)], along = Math.sqrt(L * L - KNUCKLE * KNUCKLE);
    return [tip[0] + dir[0] * along, tip[1] + dir[1] * along];
  });
  const touch = candidates.sort((u, v) => Math.hypot(...u) - Math.hypot(...v))[0];
  return [touch, tip];
}

export function createAuthoredOldRotaryPumpMovement(movement) {
  if (movement.id !== 455) return null;
  return oldRotaryPump(movement);
}
