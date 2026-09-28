import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

import {fitPistonGuide} from './piston-guide-parts.js';
import {boreBoxY,replaceYJournal} from './drill-feed-parts.js';
import {plate,poly} from './finite-plate-geometry.js';
import {crankArmGeometry, turnedHandleGeometry, handleShank, HANDLE_FOOT_EMBED} from './turned-handle.js';

// The C-shaped cramp frame is one flat extrusion of Brown's outline: the back
// and both arms share one section thickness. Each arm ends buried inside its
// journal (drill housing or feed nut) wall, clear of that journal's bore.
function cFrameMesh(outline, depth, material) {
  const mesh = new THREE.Mesh(plate(poly(outline), -depth / 2, depth / 2), material);
  mesh.userData.role = 'fixed-one-piece-c-frame';
  mesh.userData.outline = outline;
  return mesh;
}

const FULL_TURN = Math.PI * 2;

// Brown draws the same crank on 379 and 380: a flat bar whose far end
// carries an upright turned handle. The bar is one flat extrusion whose plan
// is the hull of two circles, one concentric with the handle's axis and one
// buried in the spindle hub, so the handle's foot stands wholly on the bar
// and no bar edge overhangs it.
// (Pass 92: the builders now live in turned-handle.js, shared with other
// movements that draw the usual turned crank handle.)

function cylinderAlongY(radius, length, material, segments = 32) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
}

function tubeBetween(start, end, radius, material) {
  return new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.LineCurve3(start, end),
      1,
      radius,
      10,
      false,
    ),
    material,
  );
}

// Pass 96: Brown hatches both feed screws as fine V-threads. The screw is one
// closed solid of one material: a helical grid whose rows follow the thread,
// so the crest and root run exactly along rows (no stair-stepped crest), with
// analytic normals that break sharply at the crest, flank and root edges.
// A side is either a V-thread {root, crest} or a plain cylinder {radius};
// `inner` null closes the solid to the axis. Points are
// (r cos phi, y, r sin phi) with y = phase + u - lead * phi / 2pi: a
// right-hand helix about +Y, whose front crests rise to the right as Brown
// hatches them on both plates. Turned by Three's rotation.y = angle inside a
// fixed nut, it advances +lead * angle / 2pi.
// The V has a flat crest and root, each 1/8 of the lead, and 3/8 flanks;
// the profile is linear between its four breaks, so rows sit only there.
const V_THREAD_BREAKS = [0, 2 / 16, 8 / 16, 10 / 16];
const vThreadDepthFraction = (u) => {
  const s = ((u % 1) + 1) % 1;
  if (s <= 2 / 16) return 1;
  if (s <= 8 / 16) return 1 - (s - 2 / 16) / (6 / 16);
  if (s <= 10 / 16) return 0;
  return (s - 10 / 16) / (6 / 16);
};

function threadedTubeGeometry({ low, high, lead, phase = 0, outer, inner = null, segments = 96 }) {
  const c = -lead / FULL_TURN;
  const positions = [];
  const normals = [];
  const side = (spec) => spec.radius !== undefined
    ? { r: () => spec.radius, slope: () => 0 }
    : {
      r: (u) => spec.root + (spec.crest - spec.root) * vThreadDepthFraction((u - phase) / lead),
      // Band slope dr/du between rows i and i+1 (the profile is linear there).
      slope: (u0, u1) => (spec.crest - spec.root)
        * (vThreadDepthFraction((u1 - phase) / lead - 1e-9) - vThreadDepthFraction((u0 - phase) / lead + 1e-9))
        / (u1 - u0),
    };
  const push = (p, n) => {
    const a = new THREE.Vector3(...p[0]);
    const cross = new THREE.Vector3(...p[1]).sub(a).cross(new THREE.Vector3(...p[2]).sub(a));
    if (cross.lengthSq() < 1e-16) return;
    const mean = new THREE.Vector3(...n[0]).add(new THREE.Vector3(...n[1])).add(new THREE.Vector3(...n[2]));
    if (cross.dot(mean) < 0) { [p[1], p[2]] = [p[2], p[1]]; [n[1], n[2]] = [n[2], n[1]]; }
    positions.push(...p.flat());
    normals.push(...n.flat());
  };
  const cosOf = (j) => (j % segments === 0 ? 1 : Math.cos(FULL_TURN * j / segments));
  const sinOf = (j) => (j % segments === 0 ? 0 : Math.sin(FULL_TURN * j / segments));
  // Rows u_i cover [low, high + lead] so every column spans [low, high];
  // a row outside that range clamps to the end plane (zero-area there).
  const uStart = Math.floor((low - phase) / lead) * lead + phase;
  const turns = Math.ceil((high + lead - uStart) / lead - 1e-9);
  const rows = [];
  for (let turn = 0; turn < turns; turn += 1) {
    for (const fraction of V_THREAD_BREAKS) rows.push(uStart + (turn + fraction) * lead);
  }
  rows.push(uStart + turns * lead);
  const surface = (spec, sign) => {
    const s = side(spec);
    // A plain cylinder needs no helical rows: one quad per column.
    const bands = spec.radius !== undefined
      ? [[low, high + lead]]
      : rows.slice(0, -1).map((u, i) => [u, rows[i + 1]]);
    for (let j = 0; j < segments; j += 1) {
      for (const [u0, u1] of bands) {
        const slope = s.slope(u0, u1);
        const vertex = (jj, u) => {
          const phi = FULL_TURN * jj / segments;
          const y = THREE.MathUtils.clamp(u + c * phi, low, high);
          const uu = y - c * phi;
          const r = s.r(uu);
          const cs = cosOf(jj);
          const sn = sinOf(jj);
          const n = new THREE.Vector3(r * cs - c * slope * sn, -r * slope, c * slope * cs + r * sn)
            .normalize().multiplyScalar(sign);
          return [[r * cs, y, r * sn], n.toArray()];
        };
        const a = vertex(j, u0);
        const b = vertex(j + 1, u0);
        const d = vertex(j, u1);
        const e = vertex(j + 1, u1);
        push([a[0], b[0], e[0]], [a[1], b[1], e[1]]);
        push([a[0], e[0], d[0]], [a[1], e[1], d[1]]);
      }
    }
  };
  surface(outer, 1);
  if (inner) surface(inner, -1);
  const so = side(outer);
  const si = inner ? side(inner) : null;
  for (const [y, sign] of [[low, -1], [high, 1]]) {
    const n = [0, sign, 0];
    for (let j = 0; j < segments; j += 1) {
      const ring = (jj, s) => {
        if (!s) return [0, y, 0];
        const r = s.r(y - c * FULL_TURN * jj / segments);
        return [r * cosOf(jj), y, r * sinOf(jj)];
      };
      const o0 = ring(j, so);
      const o1 = ring(j + 1, so);
      const i0 = ring(j, si);
      const i1 = ring(j + 1, si);
      push([i0, o0, o1], [n, n, n]);
      push([i0, o1, i1], [n, n, n]);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.vThread = { low, high, lead, phase, outer, inner };
  return geometry;
}

// Brown's flat spear-point drill: one flat extrusion in the spindle's plane.
// The shank flares where it is set in its holder, waists, swells to the
// spear's shoulder and runs straight to the point. y = 0 is the holder face;
// the point is at y = -length.
function spearBitGeometry({ length, top, waist, shoulder, shoulderAt = 0.72, thickness }) {
  const right = new THREE.CatmullRomCurve3([
    new THREE.Vector3(top, 0, 0),
    new THREE.Vector3(0.5 * (top + waist), -0.12 * length, 0),
    new THREE.Vector3(waist, -0.38 * length, 0),
    new THREE.Vector3(0.5 * (waist + shoulder), -0.58 * length, 0),
    new THREE.Vector3(shoulder, -shoulderAt * length, 0),
  ], false, 'centripetal').getSpacedPoints(32).map((p) => [p.x, p.y]);
  const tip = [[0, -length]];
  const left = [...right].reverse().map(([x, y]) => [-x, y]);
  return plate(poly([...right, ...tip, ...left]), -thickness / 2, thickness / 2);
}

function opposingFeedScrewCrampDrill(movement) {
  const root = new THREE.Group();

  const commonAxisX = 0.76;
  const commonAxisZ = 0;
  const drillRotorOrigin = new THREE.Vector3(
    commonAxisX,
    2.18,
    commonAxisZ,
  );
  const drillTipLocalY = -1.24;
  const drillTipY = drillRotorOrigin.y + drillTipLocalY;
  const demonstrationPeriod = 4.0;
  const drillTurnsPerDemonstration = 4;
  const drillAngularSpeed = drillTurnsPerDemonstration
    * FULL_TURN / demonstrationPeriod;
  const drillStartAngle = THREE.MathUtils.degToRad(12);
  const feedTurnAmplitude = 2.8;
  const feedAngularFrequency = FULL_TURN / demonstrationPeriod;
  // Pass 96: Brown hatches a fine thread; a 0.125 lead turned 2.8 times keeps
  // the 0.35 feed travel.
  const threadLead = 0.125;
  const feedScrewRootRadius = 0.135;
  const feedScrewCrestRadius = 0.18;
  const nutThreadClearance = 0.005;
  const feedBaseY = -1.19;
  const feedRotorOrigin = new THREE.Vector3(
    commonAxisX,
    feedBaseY,
    commonAxisZ,
  );
  const workRestLocalY = 1.55;
  const workRestHalfHeight=.085;
  const maximumFeedTravel = threadLead * feedTurnAmplitude;
  const minimumClearance = drillTipY
    - (feedBaseY + workRestLocalY + workRestHalfHeight + maximumFeedTravel);
  const threadMinimumY = 0.09;
  const threadMaximumY = 1.48;
  const threadTurns = (threadMaximumY - threadMinimumY) / threadLead;
  const nutCenterY = -0.30;
  const handwheelRadius = 0.71;

  const stateAtTime = (time) => {
    const drillAngle = drillStartAngle + drillAngularSpeed * time;
    const feedPhase = feedAngularFrequency * time;
    const feedTurns = 0.5 * feedTurnAmplitude
      * (1 - Math.cos(feedPhase));
    const feedTurnsRate = 0.5 * feedTurnAmplitude
      * feedAngularFrequency * Math.sin(feedPhase);
    const feedTurnsAcceleration = 0.5 * feedTurnAmplitude
      * feedAngularFrequency ** 2 * Math.cos(feedPhase);
    const feedScrewAngle = FULL_TURN * feedTurns;
    const feedScrewAngularSpeed = FULL_TURN * feedTurnsRate;
    const feedScrewAngularAcceleration = FULL_TURN
      * feedTurnsAcceleration;
    const axialTravel = threadLead * feedTurns;
    const axialSpeed = threadLead * feedTurnsRate;
    const axialAcceleration = threadLead * feedTurnsAcceleration;
    const feedRotorY = feedBaseY + axialTravel;
    const workRestY = feedRotorY + workRestLocalY;
    const workRestTopY=workRestY+workRestHalfHeight;
    const clearance = drillTipY - workRestTopY;
    return {
      axialAcceleration,
      axialSpeed,
      axialTravel,
      clearance,
      drillAngle,
      drillAngularSpeed,
      drillTipY,
      feedPhase,
      feedRotorY,
      feedScrewAngle,
      feedScrewAngularAcceleration,
      feedScrewAngularSpeed,
      feedTurns,
      feedTurnsAcceleration,
      feedTurnsRate,
      threadAdvanceResidual: axialTravel
        - threadLead * feedScrewAngle / FULL_TURN,
      workRestY, workRestTopY,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.22,
    roughness: 0.57,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.43,
  });
  const drillMaterial = matte(PALETTE.driver, {
    metalness: 0.18,
    roughness: 0.52,
  });
  const feedMaterial = matte(PALETTE.driven, {
    metalness: 0.18,
    roughness: 0.53,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.43 });

  const crampFrame = new THREE.Group();
  crampFrame.userData.fixed = true;
  crampFrame.userData.role =
    'fixed-c-shaped-portable-cramp-drill-frame';
  root.add(crampFrame);
  // Back, upper arm and lower arm are all 0.32 thick and 0.52 deep.
  const frameThickness = 0.32;
  const frameBackX = -1.64;
  const frameTopY = 2.49;
  const frameLowY = nutCenterY - 0.16;
  const cFrame = cFrameMesh([
    [frameBackX, frameLowY],
    [commonAxisX - 0.20, frameLowY],
    [commonAxisX - 0.20, frameLowY + frameThickness],
    [frameBackX + frameThickness, frameLowY + frameThickness],
    [frameBackX + frameThickness, frameTopY - frameThickness],
    [commonAxisX - 0.17, frameTopY - frameThickness],
    [commonAxisX - 0.17, frameTopY],
    [frameBackX, frameTopY],
  ], 0.52, frameMaterial);
  crampFrame.add(cFrame);
  const drillHousing = cylinderAlongY(
    0.34,
    0.72,
    frameMaterial,
    36,
  );
  drillHousing.position.set(commonAxisX, 2.15, commonAxisZ);
  drillHousing.userData.role = 'fixed-upper-drill-spindle-bearing';
  crampFrame.add(drillHousing);
  const fixedFeedNut = cylinderAlongY(
    0.34,
    0.40,
    frameMaterial,
    36,
  );
  fixedFeedNut.position.set(commonAxisX, nutCenterY, commonAxisZ);
  fixedFeedNut.userData.fixedAgainstRotationAndTranslation = true;
  fixedFeedNut.userData.role =
    'fixed-lower-frame-nut-guiding-opposed-feed-screw';
  crampFrame.add(fixedFeedNut);

  const drillRotor = new THREE.Group();
  drillRotor.position.copy(drillRotorOrigin);
  drillRotor.userData.axis = new THREE.Vector3(0, 1, 0);
  drillRotor.userData.role =
    'upper-hand-crank-drill-spindle-rigid-rotor';
  root.add(drillRotor);
  // The spindle runs from the crank hub down through its bearing into a thin
  // collar set just under the bearing, as Brown draws; the flat spear drill
  // hangs from the collar (pass 96: no undrawn chuck, no needle stub).
  const drillSpindle = cylinderAlongY(
    0.105,
    0.99,
    darkMaterial,
    28,
  );
  drillSpindle.position.y = 0.065;
  drillSpindle.userData.role = 'fixed-height-rotating-drill-spindle';
  drillRotor.add(drillSpindle);
  const drillChuck = cylinderAlongY(
    0.20,
    0.07,
    darkMaterial,
    40,
  );
  drillChuck.position.y = -0.43;
  drillChuck.userData.role = 'drill-collar-rigid-with-upper-spindle';
  drillRotor.add(drillChuck);
  const drillBitTopY = -0.455;
  const drillBit = new THREE.Mesh(
    spearBitGeometry({ length: drillBitTopY - drillTipLocalY, top: 0.105,
      waist: 0.055, shoulder: 0.10, thickness: 0.06 }),
    darkMaterial,
  );
  drillBit.position.y = drillBitTopY;
  drillBit.userData.role = 'downward-pointing-flat-spear-drill-bit';
  drillRotor.add(drillBit);
  // Crank bar 0.11 thick (y 0.505-0.615), handle axis 1.60 from the spindle.
  const drillCrankHandleX = -1.60;
  const drillCrankArm = new THREE.Mesh(
    crankArmGeometry({ handleX: drillCrankHandleX, handleEndRadius: 0.15,
      hubEndRadius: 0.12, bottomY: 0.505, topY: 0.615 }),
    drillMaterial,
  );
  drillCrankArm.userData.role =
    'radial-upper-hand-crank-rigid-with-drill-spindle';
  drillRotor.add(drillCrankArm);
  const drillCrankHub = cylinderAlongY(
    0.18,
    0.25,
    darkMaterial,
    28,
  );
  drillCrankHub.position.y = 0.52;
  drillCrankHub.userData.role = 'upper-crank-axis-hub';
  drillRotor.add(drillCrankHub);
  // Brown draws a turned handle: a slim neck swelling to a rounded bulb.
  const drillCrankKnob = new THREE.Mesh(
    turnedHandleGeometry({ height: 0.47, side: [
      [0.10, 0], [0.075, 0.185], [0.085, 0.37], [0.15, 0.574], [0.175, 0.74],
    ], shank: handleShank(0.11) }), // pass 98: flush with the bar's underside
    drillMaterial,
  );
  drillCrankKnob.position.set(drillCrankHandleX, 0.615 - HANDLE_FOOT_EMBED, 0);
  drillCrankKnob.userData.role = 'free-turning-upper-crank-hand-knob';
  drillRotor.add(drillCrankKnob);
  const drillIndex = new THREE.Mesh(
    new THREE.BoxGeometry(.08,.12,.012),
    whiteMaterial,
  );
  drillIndex.position.set(0,-.77,.222);
  drillIndex.userData.role = 'white-drill-spindle-rotation-index';
  drillRotor.add(drillIndex);

  const feedScrewRotor = new THREE.Group();
  feedScrewRotor.position.copy(feedRotorOrigin);
  feedScrewRotor.userData.axis = new THREE.Vector3(0, 1, 0);
  feedScrewRotor.userData.role =
    'lower-feed-screw-rest-and-handwheel-rigid-rotor';
  root.add(feedScrewRotor);
  // Pass 96: the feed screw is one solid V-threaded rod of one material,
  // from inside the handle boss to inside the work rest.
  const feedThread = new THREE.Mesh(
    threadedTubeGeometry({ low: threadMinimumY, high: threadMaximumY, lead: threadLead,
      outer: { root: feedScrewRootRadius, crest: feedScrewCrestRadius } }),
    feedMaterial,
  );
  feedThread.userData.handedness = 'right-hand-about-positive-Y';
  feedThread.userData.lead = threadLead;
  feedThread.userData.role = 'visible-helical-feed-screw-thread';
  feedScrewRotor.add(feedThread);
  const workRest = new THREE.Mesh(
    new THREE.BoxGeometry(0.78, 0.17, 0.70),
    feedMaterial,
  );
  workRest.position.y = workRestLocalY;
  workRest.userData.role =
    'flat-work-rest-opposite-and-coaxial-with-drill';
  feedScrewRotor.add(workRest);
  const handwheelHub = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 28, 18),
    feedMaterial,
  );
  handwheelHub.position.y = -0.04;
  handwheelHub.userData.role = 'lower-feed-handwheel-center';
  feedScrewRotor.add(handwheelHub);
  const handwheelArms = [];
  const handwheelKnobs = [];
  // Brown's feed handle is a straight tommy bar with a ball at each end.
  for (let index = 0; index < 2; index += 1) {
    const angle = index * FULL_TURN / 2;
    const radial = new THREE.Vector3(
      Math.cos(angle) * handwheelRadius,
      -0.04,
      Math.sin(angle) * handwheelRadius,
    );
    const arm = tubeBetween(
      new THREE.Vector3(0, -0.04, 0),
      radial,
      0.075,
      feedMaterial,
    );
    arm.userData.index = index;
    arm.userData.role = 'one-of-two-feed-handle-arms';
    handwheelArms.push(arm);
    feedScrewRotor.add(arm);
    const knob = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 22, 14),
      darkMaterial,
    );
    knob.position.copy(radial);
    knob.userData.index = index;
    knob.userData.role = 'one-of-two-feed-handle-end-balls';
    handwheelKnobs.push(knob);
    feedScrewRotor.add(knob);
  }
  const feedIndex = new THREE.Mesh(
    new THREE.BoxGeometry(.24,.055,.055),
    whiteMaterial,
  );
  feedIndex.position.set(.35,.045,0);
  feedIndex.userData.role = 'white-feed-screw-rotation-index';
  feedScrewRotor.add(feedIndex);

  replaceYJournal(drillHousing,.34,.109,.72);
  // The fixed nut is one solid with the screw's V cut in its bore, offset
  // radially by the running clearance and phased to the screw's world helix.
  fixedFeedNut.geometry.dispose();
  fixedFeedNut.geometry = threadedTubeGeometry({ low: -0.20, high: 0.20, lead: threadLead,
    phase: feedBaseY - nutCenterY, outer: { radius: 0.34 },
    inner: { root: feedScrewRootRadius + nutThreadClearance, crest: feedScrewCrestRadius + nutThreadClearance } });

  const update = (time) => {
    const state = stateAtTime(time);
    drillRotor.rotation.y = state.drillAngle;
    feedScrewRotor.position.y = state.feedRotorY;
    feedScrewRotor.rotation.y = state.feedScrewAngle;
    root.userData.currentState = state;
    root.userData.constraintResiduals = {
      axisX: drillRotor.position.x - feedScrewRotor.position.x,
      axisZ: drillRotor.position.z - feedScrewRotor.position.z,
      threadAdvance: state.threadAdvanceResidual,
      workRestHeight:
        feedScrewRotor.position.y + workRestLocalY - state.workRestY,
    };
  };

  root.userData = {
    archetype: movement.archetype,
    blocks: {
      crampFrame,
      drillBit,
      drillChuck,
      drillCrankArm,
      drillCrankHub,
      drillCrankKnob,
      drillHousing,
      drillIndex,
      drillRotor,
      drillSpindle,
      feedIndex,
      feedScrewRotor,
      feedThread,
      fixedFeedNut,
      cFrame,
      handwheelArms,
      handwheelHub,
      handwheelKnobs,
      workRest,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 2,
      inputs: [
        'continuous upper hand crank and drill-spindle rotation',
        'reversing lower handwheel and feed-screw rotation',
      ],
      note:
        'the drill spindle is axially fixed; the separate lower handwheel, feed screw, and work rest rotate and translate together through one fixed frame nut',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'rigid C-shaped cramp frame and fixed drill and feed bearings',
        'constant-speed hand-driven drill rotation',
        'rigid right-hand feed screw with exact lead and no backlash',
        'smooth forward-and-reverse feed schedule for a closed demonstration',
        'no workpiece or drilling-force model because neither is specified in the plate',
      ],
      sourceSpecifiesDimensionsTimingLeadOrSpeed: false,
      treatment:
        'Brown distinguishes the first portable cramp drill by placing its feed screw opposite the drill; the model preserves that coaxial opposed layout and applies an analytic screw-lead constraint while dimensions, lead, speed, and feed schedule are engineered',
    },
    fidelity: 'authored',
    geometry: {
      commonAxisX,
      commonAxisZ,
      demonstrationPeriod,
      drillRotorOrigin,
      drillStartAngle,
      drillTipLocalY,
      drillTipY,
      drillTurnsPerDemonstration,
      feedAngularFrequency,
      feedBaseY,
      feedRotorOrigin,
      feedTurnAmplitude,
      handwheelRadius,
      maximumFeedTravel,
      minimumClearance,
      nutCenterY,
      threadLead,
      threadMaximumY,
      threadMinimumY,
      threadTurns,
      workRestLocalY, workRestHalfHeight,
    },
    mechanism:
      'one-fixed-c-cramp-carries-one-axially-fixed-upper-hand-crank-drill-and-one-separate-coaxial-opposed-lower-feed-screw-whose-handwheel-raises-the-work-rest-through-a-fixed-nut',
    officialDescription: movement.description,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      pageMarksAnimationUnavailable: true,
      sourcePrescribedTiming: false,
    },
    sourceReference: {
      brownPlate379: {
        cFrameBottomLeft: new THREE.Vector2(158, 410),
        cFrameBottomRight: new THREE.Vector2(390, 412),
        cFrameTopLeft: new THREE.Vector2(159, 140),
        drillAxisX: 338,
        drillBitTip: new THREE.Vector2(338, 279),
        feedHandwheelCenter: new THREE.Vector2(337, 480),
        feedRestCenter: new THREE.Vector2(338, 324),
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 7,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the tool is a portable cramp drill',
          'movement 379 places the feed screw opposite the drill',
        ],
        engravingEvidence:
          'the plate shows one C-shaped frame, an upper drill spindle and crank, a lower coaxial threaded feed screw with flat work rest, and a three-knob handwheel below the fixed lower frame arm',
        reconstructionDisclosure:
          'frame depth, colors, four drill turns, 0.125-unit V-thread lead, 2.8-turn reversible feed excursion, and four-second cycle are engineered because Brown supplies no dimensions or timing and the official page has no canvas animation',
      },
      officialPage: 'https://507movements.com/mm_379.html',
      pairedMovement: 380,
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        publicationYear: 1908,
      },
    },
    stateAtTime,
    timeline: {
      demonstrationPeriod,
      note:
        'the drill makes four continuous turns while the independent feed screw advances 2.8 turns and reverses to its exact starting pose',
    },
    transmission: {
      drillAngularSpeed,
      feedLeadLaw:
        'axial travel = +(thread lead / 2π) times the rendered feed-screw angle (Three.js positive-Y rotation) for the modeled right-hand helix, whose front crests rise to the right as Brown hatches them',
      maximumFeedTravel,
      minimumClearance,
      opposedAxisLaw:
        'the upper drill tip and lower feed screw/work rest share exactly one vertical axis but remain separate independently operated rotors',
      threadLead,
    },
  };

  update(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.58, -1.96, -1.18),
    new THREE.Vector3(2.42, 3.46, 1.18),
  );
  root.userData.groundFloorY = -1.90;
  root.userData.cameraDirection=new THREE.Vector3(1.1,.6,14);
  fitPistonGuide(root,update,demonstrationPeriod);
  markShadows(root);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

function throughFeedScrewCrampDrill(movement) {
  const root = new THREE.Group();

  const commonAxisX = 0.72;
  const commonAxisZ = 0;
  const feedBaseY = 1.33;
  const demonstrationPeriod = 4.0;
  const drillTurnsPerDemonstration = 4;
  const drillAngularSpeed = drillTurnsPerDemonstration
    * FULL_TURN / demonstrationPeriod;
  const drillStartAngle = THREE.MathUtils.degToRad(10);
  // Pass 96: Brown hatches a fine thread; a 0.10 lead turned 2.75 times keeps
  // the 0.275 down-feed.
  const feedTurnAmplitude = 2.75;
  const feedAngularFrequency = FULL_TURN / demonstrationPeriod;
  const threadLead = 0.10;
  const maximumDownFeed = threadLead * feedTurnAmplitude;
  // Pass 96: Brown's screw is about 0.45 of the nut's width: root 0.165 and
  // crest 0.20 against the 0.44 nut. outerSleeveRadius is the thread root.
  const outerSleeveRadius = 0.165;
  const sleeveCrestRadius = 0.20;
  const nutThreadClearance = 0.005;
  const innerBoreRadius = 0.115;
  const drillSpindleRadius = 0.090;
  const radialBoreClearance = innerBoreRadius - drillSpindleRadius;
  // The threaded sleeve runs from inside the thrust collar to inside the
  // cross-handle hub, as Brown's hatching runs from block to collar.
  const sleeveMinimumY = -0.75;
  const sleeveMaximumY = 0.81;
  const sleeveLength = sleeveMaximumY - sleeveMinimumY;
  const threadTurns = sleeveLength / threadLead;
  const drillTipLocalY = -1.73;
  const fixedWorkRestTopY = -0.81;
  const minimumClearance = feedBaseY - maximumDownFeed
    + drillTipLocalY - fixedWorkRestTopY;

  const stateAtTime = (time) => {
    const drillAngle = drillStartAngle + drillAngularSpeed * time;
    const feedPhase = feedAngularFrequency * time;
    const feedTurns = 0.5 * feedTurnAmplitude
      * (1 - Math.cos(feedPhase));
    const feedTurnsRate = 0.5 * feedTurnAmplitude
      * feedAngularFrequency * Math.sin(feedPhase);
    const feedTurnsAcceleration = 0.5 * feedTurnAmplitude
      * feedAngularFrequency ** 2 * Math.cos(feedPhase);
    const feedScrewAngle = -FULL_TURN * feedTurns;
    const feedScrewAngularSpeed = -FULL_TURN * feedTurnsRate;
    const feedScrewAngularAcceleration = -FULL_TURN
      * feedTurnsAcceleration;
    const axialTravel = -threadLead * feedTurns;
    const axialSpeed = -threadLead * feedTurnsRate;
    const axialAcceleration = -threadLead * feedTurnsAcceleration;
    const sharedRotorY = feedBaseY + axialTravel;
    const drillTipY = sharedRotorY + drillTipLocalY;
    const clearance = drillTipY - fixedWorkRestTopY;
    const relativeDrillAngle = drillAngle - feedScrewAngle;
    const relativeDrillAngularSpeed = drillAngularSpeed
      - feedScrewAngularSpeed;
    return {
      axialAcceleration,
      axialSpeed,
      axialTravel,
      clearance,
      drillAngle,
      drillAngularSpeed,
      drillTipY,
      feedPhase,
      feedScrewAngle,
      feedScrewAngularAcceleration,
      feedScrewAngularSpeed,
      feedTurns,
      feedTurnsAcceleration,
      feedTurnsRate,
      relativeDrillAngle,
      relativeDrillAngularSpeed,
      sharedRotorY,
      threadAdvanceResidual: axialTravel
        - threadLead * feedScrewAngle / FULL_TURN,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.22,
    roughness: 0.57,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.43,
  });
  const drillMaterial = matte(PALETTE.driver, {
    metalness: 0.18,
    roughness: 0.52,
  });
  const feedMaterial = matte(PALETTE.driven, {
    metalness: 0.18,
    roughness: 0.53,
    side: THREE.DoubleSide,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.43 });

  const crampFrame = new THREE.Group();
  crampFrame.userData.fixed = true;
  crampFrame.userData.role =
    'fixed-c-shaped-through-feed-screw-cramp-frame';
  root.add(crampFrame);
  // One 0.34-thick section throughout. As Brown draws, the work rest's top
  // is flush with the lower arm's inner face, the rest standing out beyond
  // the arm, whose underside is chamfered up to the rest.
  const frameThickness = 0.34;
  const frameBackX = -1.55;
  const frameTopY = 1.51;
  const restLeftX = commonAxisX - 0.44;
  const restBottomY = fixedWorkRestTopY - 0.19;
  const frameLowY = fixedWorkRestTopY - frameThickness;
  const cFrame = cFrameMesh([
    [frameBackX, frameLowY],
    [restLeftX + 0.12, frameLowY],
    [restLeftX + 0.12 + (restBottomY - frameLowY), restBottomY],
    [restLeftX, restBottomY],
    [restLeftX, fixedWorkRestTopY],
    [frameBackX + frameThickness, fixedWorkRestTopY],
    [frameBackX + frameThickness, frameTopY - frameThickness],
    [commonAxisX - 0.339, frameTopY - frameThickness],
    [commonAxisX - 0.339, frameTopY],
    [frameBackX, frameTopY],
  ], 0.54, frameMaterial);
  crampFrame.add(cFrame);
  const fixedFeedNut = cylinderAlongY(
    0.44,
    0.70,
    frameMaterial,
    40,
  );
  fixedFeedNut.position.set(commonAxisX, 1.33, commonAxisZ);
  fixedFeedNut.userData.fixedAgainstRotationAndTranslation = true;
  fixedFeedNut.userData.role =
    'fixed-upper-frame-nut-around-hollow-feed-screw';
  crampFrame.add(fixedFeedNut);
  const fixedWorkRest = new THREE.Mesh(
    // As deep as the arm it stands on, so no lip overhangs the arm sides.
    new THREE.BoxGeometry(0.88, 0.19, 0.54),
    frameMaterial,
  );
  fixedWorkRest.position.set(
    commonAxisX,
    fixedWorkRestTopY - 0.095,
    commonAxisZ,
  );
  fixedWorkRest.userData.role =
    'fixed-lower-work-rest-beneath-through-feed-drill';
  crampFrame.add(fixedWorkRest);

  const feedSleeveRotor = new THREE.Group();
  feedSleeveRotor.position.set(commonAxisX, feedBaseY, commonAxisZ);
  feedSleeveRotor.userData.axis = new THREE.Vector3(0, 1, 0);
  feedSleeveRotor.userData.innerBoreRadius = innerBoreRadius;
  feedSleeveRotor.userData.role =
    'rotating-translating-hollow-feed-screw-and-cross-handle';
  root.add(feedSleeveRotor);
  // Pass 96: the hollow feed screw is one solid of one material: a fine
  // V-thread outside, the spindle's bore inside.
  const feedThread = new THREE.Mesh(
    threadedTubeGeometry({ low: sleeveMinimumY, high: sleeveMaximumY, lead: threadLead,
      outer: { root: outerSleeveRadius, crest: sleeveCrestRadius },
      inner: { radius: innerBoreRadius } }),
    feedMaterial,
  );
  feedThread.geometry.userData.boreRadius = innerBoreRadius;
  const hollowSleeve = feedThread;
  feedThread.userData.handedness = 'right-hand-about-positive-Y';
  feedThread.userData.lead = threadLead;
  feedThread.userData.role = 'open-ended-hollow-v-threaded-feed-screw';
  feedSleeveRotor.add(feedThread);
  const feedHandleHub = cylinderAlongY(
    0.34,
    0.22,
    feedMaterial,
    32,
  );
  feedHandleHub.position.y = 0.91;
  feedHandleHub.userData.role = 'hollow-feed-screw-cross-handle-hub';
  feedSleeveRotor.add(feedHandleHub);
  const feedHandleBar = new THREE.Mesh(
    new THREE.BoxGeometry(2.08, 0.095, 0.11),
    feedMaterial,
  );
  feedHandleBar.position.y = 0.91;
  feedHandleBar.userData.role =
    'two-ended-cross-handle-rigid-with-hollow-feed-screw';
  feedSleeveRotor.add(feedHandleBar);
  const feedHandleKnobs = [];
  for (const x of [-1.08, 1.08]) {
    const knob = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.14, 0.34, 7, 16),
      feedMaterial,
    );
    knob.position.set(x, 0.91, 0);
    knob.rotation.z = Math.PI / 2;
    knob.userData.role = 'one-of-two-hollow-feed-cross-handle-grips';
    feedHandleKnobs.push(knob);
    feedSleeveRotor.add(knob);
  }
  const thrustCollar = cylinderAlongY(
    0.32,
    0.28,
    feedMaterial,
    34,
  );
  thrustCollar.position.y = -0.88;
  thrustCollar.userData.role =
    'feed-sleeve-thrust-collar-capturing-inner-drill-axially';
  feedSleeveRotor.add(thrustCollar);
  const feedIndex = new THREE.Mesh(
    new THREE.BoxGeometry(.35,.012,.115),
    whiteMaterial,
  );
  feedIndex.position.set(.45,.96,0);
  feedIndex.userData.role = 'white-hollow-feed-screw-rotation-index';
  feedSleeveRotor.add(feedIndex);

  const drillRotor = new THREE.Group();
  drillRotor.position.set(commonAxisX, feedBaseY, commonAxisZ);
  drillRotor.userData.axis = new THREE.Vector3(0, 1, 0);
  drillRotor.userData.role =
    'inner-drill-spindle-passing-coaxially-through-feed-screw-bore';
  root.add(drillRotor);
  const drillSpindle = cylinderAlongY(
    drillSpindleRadius,
    2.57,
    darkMaterial,
    28,
  );
  // Ends inside the chuck (pass 96), not below it.
  drillSpindle.position.y = 0.085;
  drillSpindle.userData.role =
    'continuous-inner-spindle-through-hollow-feed-screw';
  drillRotor.add(drillSpindle);
  // Pass 96: a shorter chuck under the thrust collar carries Brown's flat
  // spear drill (no needle stub).
  const drillChuck = cylinderAlongY(
    0.22,
    0.22,
    drillMaterial,
    32,
  );
  drillChuck.position.y = -1.135;
  drillChuck.userData.role =
    'lower-drill-chuck-rigid-with-through-spindle';
  drillRotor.add(drillChuck);
  const drillBitTopY = -1.235;
  const drillBit = new THREE.Mesh(
    spearBitGeometry({ length: drillBitTopY - drillTipLocalY, top: 0.08,
      waist: 0.05, shoulder: 0.085, thickness: 0.055 }),
    darkMaterial,
  );
  drillBit.position.y = drillBitTopY;
  drillBit.userData.role = 'downward-flat-spear-bit-on-through-spindle';
  drillRotor.add(drillBit);
  const drillCrankHub = cylinderAlongY(
    0.18,
    0.26,
    darkMaterial,
    28,
  );
  drillCrankHub.position.y = 1.43;
  drillCrankHub.userData.role = 'upper-through-spindle-crank-hub';
  drillRotor.add(drillCrankHub);
  // Pass 90: 380's crank takes 379's turned handle, with the proportions of
  // Brown's plate 380 (0.0077 units per pixel): the handle stands 0.43 above
  // the bar, its foot flares to 0.116, its neck narrows to 0.058 at 0.43 of
  // its height and its bulb swells to 0.108 at 0.76 (neck and bulb are made
  // 0.004 fuller, as Brown's outline strokes eat into them); its axis is 1.45
  // from the spindle and the bar runs 0.20 beyond it.
  const drillCrankHandleX = -1.45;
  const drillCrankArm = new THREE.Mesh(
    crankArmGeometry({ handleX: drillCrankHandleX, handleEndRadius: 0.20,
      hubEndRadius: 0.12, bottomY: 1.445, topY: 1.555 }),
    drillMaterial,
  );
  drillCrankArm.userData.role =
    'upper-hand-crank-rigid-with-inner-drill-spindle';
  drillRotor.add(drillCrankArm);
  const drillCrankKnob = new THREE.Mesh(
    turnedHandleGeometry({ height: 0.43 + HANDLE_FOOT_EMBED, side: [
      [0.116, 0], [0.088, 0.12], [0.062, 0.43], [0.085, 0.6], [0.112, 0.76],
    ], shank: handleShank(0.11) }), // pass 98: flush with the bar's underside
    drillMaterial,
  );
  drillCrankKnob.position.set(drillCrankHandleX, 1.555 - HANDLE_FOOT_EMBED, 0);
  drillCrankKnob.userData.role = 'upper-drill-crank-hand-knob';
  drillRotor.add(drillCrankKnob);
  const drillIndex = new THREE.Mesh(
    new THREE.BoxGeometry(.08,.12,.012),
    whiteMaterial,
  );
  drillIndex.position.set(0,-1.26,.222);
  drillIndex.userData.role = 'white-inner-drill-spindle-rotation-index';
  drillRotor.add(drillIndex);

  // The fixed nut is one solid with the sleeve's V cut in its bore.
  fixedFeedNut.geometry.dispose();
  fixedFeedNut.geometry = threadedTubeGeometry({ low: -0.35, high: 0.35, lead: threadLead,
    phase: feedBaseY - 1.33, outer: { radius: 0.44 },
    inner: { root: outerSleeveRadius + nutThreadClearance, crest: sleeveCrestRadius + nutThreadClearance } });
  replaceYJournal(feedHandleHub,.34,innerBoreRadius,.22);
  replaceYJournal(thrustCollar,.32,.095,.28);
  boreBoxY(feedHandleBar,innerBoreRadius);
  // The upper thrust ring rides on the collar's top face inside the sleeve
  // bore; the chuck bears on the collar's underside.
  const thrustRings=[-.88+.17].map(y=>{
    const ring=cylinderAlongY(.11,.04,drillMaterial);ring.position.y=y;drillRotor.add(ring);return ring;
  });

  const update = (time) => {
    const state = stateAtTime(time);
    feedSleeveRotor.position.y = state.sharedRotorY;
    feedSleeveRotor.rotation.y = state.feedScrewAngle;
    drillRotor.position.y = state.sharedRotorY;
    drillRotor.rotation.y = state.drillAngle;
    root.userData.currentState = state;
    root.userData.constraintResiduals = {
      axialCapture: drillRotor.position.y
        - feedSleeveRotor.position.y,
      axisX: drillRotor.position.x - feedSleeveRotor.position.x,
      axisZ: drillRotor.position.z - feedSleeveRotor.position.z,
      threadAdvance: state.threadAdvanceResidual,
    };
  };

  root.userData = {
    archetype: movement.archetype,
    blocks: {
      crampFrame,
      drillBit,
      drillChuck,
      drillCrankArm,
      drillCrankHub,
      drillCrankKnob,
      drillIndex,
      drillRotor,
      drillSpindle,
      feedHandleBar,
      feedHandleHub,
      feedHandleKnobs,
      feedIndex,
      feedSleeveRotor,
      feedThread,
      fixedFeedNut,
      fixedWorkRest,
      cFrame,
      hollowSleeve, thrustRings,
      thrustCollar,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 2,
      inputs: [
        'continuous upper crank rotation of the inner drill spindle',
        'reversing cross-handle rotation of the outer hollow feed screw',
      ],
      note:
        'the inner drill spindle rotates independently inside the outer screw bore but is axially captured by its thrust collar, so both members share feed translation while retaining distinct angles',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'rigid C-shaped cramp frame and fixed lower work rest',
        'constant-speed hand-driven inner drill spindle',
        'rigid hollow right-hand feed screw with exact lead and no backlash',
        'frictionless coaxial journal and thrust capture between spindle and feed sleeve',
        'smooth down-and-up feed schedule for a closed demonstration',
      ],
      sourceSpecifiesDimensionsTimingLeadClearanceOrSpeed: false,
      treatment:
        'Brown distinguishes movement 380 by passing the drill spindle through the center of its feed screw; the model represents a genuinely hollow threaded sleeve, an independently rotating inner spindle, common axial feed through a thrust collar, and an analytic lead constraint',
    },
    fidelity: 'authored',
    geometry: {
      commonAxisX,
      commonAxisZ,
      demonstrationPeriod,
      drillSpindleRadius,
      drillStartAngle,
      drillTipLocalY,
      drillTurnsPerDemonstration,
      feedAngularFrequency,
      feedBaseY,
      feedTurnAmplitude,
      fixedWorkRestTopY,
      innerBoreRadius,
      maximumDownFeed,
      minimumClearance,
      outerSleeveRadius,
      radialBoreClearance,
      sleeveLength,
      sleeveMaximumY,
      sleeveMinimumY,
      threadLead,
      threadTurns,
    },
    mechanism:
      'one-upper-crank-turns-one-inner-drill-spindle-through-the-center-bore-of-one-separately-cross-handle-turned-hollow-feed-screw-whose-fixed-nut-and-thrust-collar-feed-the-spindle-toward-one-fixed-lower-rest',
    officialDescription: movement.description,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      pageMarksAnimationUnavailable: true,
      sourcePrescribedTiming: false,
    },
    sourceReference: {
      brownPlate380: {
        cFrameBottomLeft: new THREE.Vector2(153, 478),
        cFrameBottomRestCenter: new THREE.Vector2(354, 432),
        cFrameTopLeft: new THREE.Vector2(153, 170),
        drillBitTip: new THREE.Vector2(354, 359),
        drillCrankHandleCenter: new THREE.Vector2(171, 66),
        feedCrossHandleY: 127,
        feedThreadAxisX: 354,
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 7,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the tool is a portable cramp drill',
          'movement 380 passes the drill spindle through the center of the feed screw',
        ],
        engravingEvidence:
          'the plate shows one C-shaped frame with fixed lower rest, an externally threaded upper feed member with a two-ended cross handle, a narrower continuous drill spindle through its center, an upper drill crank, and a lower chuck and bit',
        reconstructionDisclosure:
          'frame depth, bore and spindle radii, thrust-collar interpretation, colors, four drill turns, 0.10-unit V-thread lead, 2.75-turn reversible feed excursion, and four-second cycle are engineered because Brown supplies no dimensions or timing and the official page has no canvas animation',
      },
      officialPage: 'https://507movements.com/mm_380.html',
      pairedMovement: 379,
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        publicationYear: 1908,
      },
    },
    stateAtTime,
    timeline: {
      demonstrationPeriod,
      note:
        'the inner drill makes four continuous turns while the hollow outer feed screw advances 2.75 turns, carries both axial members downward, and reverses smoothly to the start',
    },
    transmission: {
      axialCaptureLaw:
        'the thrust collar makes inner spindle and outer hollow feed screw share exactly one axial translation while allowing their relative rotation',
      boreClearanceLaw:
        'inner drill radius remains smaller than the hollow feed-screw bore radius by one fixed radial clearance',
      drillAngularSpeed,
      feedLeadLaw:
        'axial travel = +(thread lead / 2π) times outer feed-screw angle (Three.js positive-Y rotation) for the modeled right-hand helix, whose front crests rise to the right as Brown hatches them',
      maximumDownFeed,
      minimumClearance,
      relativeRotationLaw:
        'inner-spindle angle relative to the hollow feed screw equals drill angle minus feed-screw angle',
      threadLead,
    },
  };

  update(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.54, -1.55, -1.22),
    new THREE.Vector3(2.50, 3.52, 1.22),
  );
  root.userData.groundFloorY = -1.50;
  root.userData.cameraDirection=new THREE.Vector3(1.1,.6,14);
  fitPistonGuide(root,update,demonstrationPeriod);
  markShadows(root);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredCrampDrillMovement(movement) {
  if (movement.id === 379) return opposingFeedScrewCrampDrill(movement);
  if (movement.id === 380) return throughFeedScrewCrampDrill(movement);
  return null;
}
