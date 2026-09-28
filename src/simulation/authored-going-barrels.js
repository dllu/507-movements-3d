import { correctGoingBarrel } from './maintaining-clock-parts.js';
import clickPaths from './baked/maintaining-clock-clicks.js';
import {
  followerTable,
  makeSeatedFollower,
  sawRatchetOutline,
  seatedClickOutline,
} from './seated-ratchet-click.js';
import {
  capsule,
  circle,
  plate,
  poly,
  polygonClipping,
} from './finite-plate-geometry.js';
import * as THREE from 'three';
import { replaceWithLaidRope } from './laid-rope.js';
import {
  PALETTE,
  makeBeam,
  makeGear,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function smootherstep(value) {
  return value ** 3 * (value * (value * 6 - 15) + 10);
}

function smootherstepFirst(value) {
  return 30 * value ** 2 * (1 - value) ** 2;
}

function smootherstepSecond(value) {
  return 60 * value * (1 - value) * (1 - 2 * value);
}

// Smootherstep over [start, end] of a unit progress, with derivatives
// with respect to that progress.
function windowedStep(progress, start, end) {
  const width = end - start;
  const u = THREE.MathUtils.clamp((progress - start) / width, 0, 1);
  const inside = progress > start && progress < end;
  return {
    value: smootherstep(u),
    first: inside ? smootherstepFirst(u) / width : 0,
    second: inside ? smootherstepSecond(u) / width ** 2 : 0,
  };
}

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function makeRatchetShape(outerRadius, innerRadius, toothCount) {
  const shape = new THREE.Shape();
  const pitch = FULL_TURN / toothCount;
  let first = true;
  for (let tooth = 0; tooth < toothCount; tooth += 1) {
    for (const sample of [
      { offset: -0.50, radius: outerRadius * 0.82 },
      { offset: -0.35, radius: outerRadius },
      { offset: 0.38, radius: outerRadius * 0.94 },
      { offset: 0.50, radius: outerRadius * 0.82 },
    ]) {
      const angle = tooth * pitch + sample.offset * pitch;
      const x = Math.cos(angle) * sample.radius;
      const y = Math.sin(angle) * sample.radius;
      if (first) {
        shape.moveTo(x, y);
        first = false;
      } else shape.lineTo(x, y);
    }
  }
  shape.closePath();
  if (innerRadius > 0) {
    const hole = new THREE.Path();
    hole.absarc(0, 0, innerRadius, 0, FULL_TURN, true);
    shape.holes.push(hole);
  }
  return shape;
}

function makeRatchetMesh({
  color,
  depth,
  innerRadius = 0,
  outerRadius,
  role,
  toothCount,
}) {
  const geometry = new THREE.ExtrudeGeometry(
    makeRatchetShape(outerRadius, innerRadius, toothCount),
    { bevelEnabled: false, depth },
  );
  geometry.translate(0, 0, -depth / 2);
  const mesh = new THREE.Mesh(
    geometry,
    matte(color, { metalness: 0.14, roughness: 0.60 }),
  );
  mesh.userData.role = role;
  mesh.userData.toothCount = toothCount;
  return mesh;
}

function makeRotor(role) {
  const root = new THREE.Group();
  const rotor = new THREE.Group();
  root.add(rotor);
  root.userData.axis = Z_AXIS.clone();
  root.userData.role = role;
  root.userData.rotor = rotor;
  return root;
}

function setRotorAngle(root, angle) {
  root.userData.rotor.rotation.z = angle;
}

function makePawl({ color, contact, pivot, role, z }) {
  const root = new THREE.Group();
  root.position.set(pivot.x, pivot.y, z);
  root.userData.role = role;
  const displacement = contact.clone().sub(pivot);
  const length = displacement.length();
  const baseAngle = Math.atan2(displacement.y, displacement.x);
  const material = matte(color, { metalness: 0.16, roughness: 0.52 });
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(length, 0.14, 0.13),
    material,
  );
  body.position.x = length / 2;
  body.userData.role = `${role}-body`;
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.13, 0.30, 4),
    material,
  );
  tip.position.x = length;
  tip.rotation.z = -Math.PI / 2;
  tip.userData.role = `${role}-tip`;
  const pin = cylinderAlongZ(
    0.14,
    0.28,
    matte(PALETTE.ink, { metalness: 0.24, roughness: 0.44 }),
    24,
  );
  pin.userData.role = `${role}-pivot`;
  root.add(body, tip, pin);
  root.rotation.z = baseAngle;

  const relative = displacement.clone();
  const plus = relative.clone().rotateAround(
    new THREE.Vector2(),
    0.01,
  ).add(pivot).length();
  const minus = relative.clone().rotateAround(
    new THREE.Vector2(),
    -0.01,
  ).add(pivot).length();
  root.userData.baseAngle = baseAngle;
  root.userData.contact = contact.clone();
  root.userData.length = length;
  root.userData.liftSign = plus >= minus ? 1 : -1;
  root.userData.pivot = pivot.clone();
  return markShadows(root);
}

function setBoxBetween(box, start, end) {
  const displacement = end.clone().sub(start);
  box.position.copy(start).add(end).multiplyScalar(0.5);
  box.rotation.z = Math.atan2(displacement.y, displacement.x);
  box.scale.x = displacement.length();
}

// Brown's clicks T and R are flat curved blades with a round bored eye. Each
// is one planar plate whose nose fills the valley at the tooth root, riding
// the saw-toothed ratchet by an exact geometric follower. Both ratchets are
// re-cut as saw teeth with a nearly radial working face.
function seatGoingBarrelClicks(root) {
  const b = root.userData.blocks;
  const g = root.userData.geometry;
  const [clickRFollower, clickTFollower] = b.finiteClicks;
  const setups = [
    {
      name: 'R',
      follower: clickRFollower,
      mesh: b.barrelRatchet,
      teeth: g.barrelRatchetToothCount,
      hand: -1,
      radius: g.barrelRatchetPitchRadius * 1.04,
      bore: 0.142,
      depth: 0.16,
      // Going: B and the larger ratchet turn together, R seated.
      seatWheelAngle: 0,
      // Brown's clicks are broad strips, not wires.
      width: 0.22,
      shank: 0.58,
      // The face leans a little more than R's nose drifts as it drops about
      // its pivot, so R slides down the face instead of snapping past it.
      rake: 0.08,
    },
    {
      name: 'T',
      follower: clickTFollower,
      mesh: b.largeRatchetMesh,
      teeth: g.largeRatchetToothCount,
      hand: 1,
      radius: g.largeRatchetOuterRadius,
      bore: g.largeRatchetInnerRadius,
      depth: 0.19,
      // Winding: the larger ratchet slips back onto T.
      seatWheelAngle: -g.clickTBacklash,
      width: 0.22,
      shank: 0.75,
      rake: 0.04,
      fillet: 1.0,
    },
  ];
  b.finiteClicks = setups.map((setup) => {
    const { follower, mesh, teeth, hand, radius, bore, depth, seatWheelAngle, width } = setup;
    const pawl = follower.group;
    const pivot = [pawl.position.x, pawl.position.y];
    const contact = pawl.userData.contact;
    const contactAngle = Math.atan2(contact.y, contact.x);
    const wheel = sawRatchetOutline({
      radius,
      rootRadius: radius * 0.85,
      teeth,
      hand,
      rootAngle: contactAngle - seatWheelAngle,
      rake: setup.rake,
    });
    const geometry = plate(polygonClipping.difference(
      poly(wheel.outline),
      poly(circle([0, 0], bore, 96)),
    ), -depth / 2, depth / 2);
    mesh.geometry.dispose();
    mesh.geometry = geometry;
    mesh.rotation.z = 0;
    mesh.userData.toothCount = teeth;
    mesh.userData.ratchetProfile = {
      outline: wheel.outline, radius, bore, teeth, hand, phase: wheel.phase, depth,
      rootRadius: wheel.rootRadius, rake: wheel.rake,
    };
    // Seated pose, in the carrier frame.
    const at = (r, a) => [r * Math.cos(a + seatWheelAngle), r * Math.sin(a + seatWheelAngle)];
    const apex = at(wheel.rootRadius, wheel.rootAngle);
    const faceTip = at(radius, wheel.rootAngle + hand * wheel.rake * wheel.pitch);
    const flankTip = at(radius, wheel.rootAngle - hand * (1 - wheel.rake) * wheel.pitch);
    const unit = (to) => {
      const v = [to[0] - apex[0], to[1] - apex[1]];
      const l = Math.hypot(v[0], v[1]);
      return [v[0] / l, v[1] / l];
    };
    const outline = seatedClickOutline({
      pivot,
      apex,
      face: unit(faceTip),
      flank: unit(flankTip),
      shank: setup.shank,
      fillet: setup.fillet,
      width,
      bossRadius: 0.16,
      boreRadius: 0.082,
    });
    const local = outline.polygons.map((polygon) => polygon.map((ring) => ring.map((p) => [p[0] - pivot[0], p[1] - pivot[1]])));
    follower.body.geometry.dispose();
    follower.body.geometry = plate(local, -0.06, 0.06);
    follower.body.userData.role = 'finite-bored-clock-click';
    pawl.rotation.z = 0;
    const core = makeSeatedFollower({ outline, wheel, pivot, seatWheelAngle });
    const angleAt = (relativeWheelAngle) => core.angleAt(hand * (relativeWheelAngle - seatWheelAngle));
    const bakeKey = `321-${setup.name}`;
    const bakeSignature = {
      clickOutline: outline.polygons[0][0].map((p) => [Number(p[0].toFixed(9)), Number(p[1].toFixed(9))]),
      hand, pivot, radius, rootRadius: wheel.rootRadius, rake: wheel.rake, seatWheelAngle, teeth,
    };
    const path = clickPaths[bakeKey];
    const baked = path && JSON.stringify(path.signature) === JSON.stringify(bakeSignature);
    const playbackAngleAt = baked ? (angle) => {
      const phase = positiveModulo(angle / path.pitch, 1);
      const coordinate = phase * path.phaseScale;
      const knots = path.knots;
      let lo = 0;
      let hi = knots.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (knots[mid][0] <= coordinate) lo = mid;
        else hi = mid;
      }
      const a = knots[lo];
      const c = knots[hi];
      return a[1] + (coordinate - a[0]) / (c[0] - a[0]) * (c[1] - a[1]);
    } : followerTable(angleAt, wheel.pitch);
    return {
      name: setup.name,
      group: pawl,
      body: follower.body,
      pin: follower.pin,
      wheel: mesh,
      pivot,
      outline: wheel.outline,
      clickOutline: outline,
      seatWheelAngle,
      liftSign: core.liftSign,
      angleAt,
      playbackAngleAt,
      bakeKey,
      bakeSignature,
      bakedPlayback: Boolean(baked),
      update(angle) { pawl.rotation.z = playbackAngleAt(angle); },
    };
  });
}

function harrisonGoingBarrel(movement) {
  const root = new THREE.Group();

  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterCenter = new THREE.Vector2(239, 242);
  const sourceRasterFrameClickPivotT = new THREE.Vector2(479, 47);
  const sourceRasterFrameClickContactT = new THREE.Vector2(181, 80);
  const sourceRasterCarriedClickPivotR = new THREE.Vector2(369, 269);
  const sourceRasterCarriedClickContactR = new THREE.Vector2(293, 320);
  const sourceRasterOuterSpringAnchorSPrime = new THREE.Vector2(65, 208);
  const sourceRasterInnerSpringAnchorS = new THREE.Vector2(162, 132);
  const sourceRasterWeightCenter = new THREE.Vector2(173, 487);
  const sourceScale = 0.0145;

  const demonstrationPeriod = 8;
  // Going fills most of the cycle. Winding takes an eighth: G runs 45
  // degrees ahead of the held larger ratchet, which Brown's short curved
  // wire S-S' takes up by opening its hairpin (a quarter turn would need a
  // wire longer than the chord between its anchors). The spring recovers in
  // the last twelfth, as the re-engaged weight quickly recharges it.
  // Winding starts on a whole tooth of the larger ratchet (19 of 24) so T
  // seats, and the short recovery keeps the weight near its wound height at
  // the plate pose (see below).
  const windingStartPhase = 19 / 24;
  const windingEndPhase = 22 / 24;
  const greatWheelToothCount = 48;
  const greatWheelPitchRadius = 2.95;
  const largeRatchetToothCount = 24;
  const largeRatchetPitchRadius = Math.hypot(
    (sourceRasterFrameClickContactT.x - sourceRasterCenter.x) * sourceScale,
    (sourceRasterFrameClickContactT.y - sourceRasterCenter.y) * sourceScale,
  );
  const largeRatchetOuterRadius = largeRatchetPitchRadius * 1.025;
  const largeRatchetInnerRadius = 1.50;
  // Brown's small ratchet on B has about eighteen teeth.
  const barrelRatchetToothCount = 18;
  const barrelRatchetPitchRadius = Math.hypot(
    (sourceRasterCarriedClickContactR.x - sourceRasterCenter.x) * sourceScale,
    (sourceRasterCarriedClickContactR.y - sourceRasterCenter.y) * sourceScale,
  );
  const barrelFaceRadius = 1.02;
  // Each cycle the weight falls one drum turn and winding lifts it back.
  // Brown hangs it just under G (his box top is 13 px below G's lowest
  // teeth), so the plate pose must be close to the wound top of travel. The
  // plate pose (t = 0) is the moment R has re-engaged after winding. Between
  // the end of winding and then, B turns only the winding lag plus G's
  // recovery advance (5/24 of a turn), so the small drum (0.2, just
  // outside the bored barrel arbor) lifts the weight 0.26 above its plate
  // height. The weight's top hangs 0.34 below G's tips at the plate pose
  // (Brown: 0.19 below his slightly smaller G) and stays 0.08 clear of them
  // at the top of its travel.
  const ropeDrumPitchRadius = 0.20;
  // The drum is on B's arbor behind the wheels, as Brown's cord leaves B
  // behind them; the cord hangs from its tangent in that plane (it used to
  // loop round the arbor in front of ratchet B and hang across its face).
  const ropePlaneZ = -1.0;
  const weightHalfHeight = 0.45;
  const greatWheelTipClearanceY = -3.12;
  // B is wound back past the plate pose by the recoil of the larger ratchet
  // and the overrun that lets R drop behind its tooth (see the backlash).
  const windingOvershootAngle = FULL_TURN * (1 - windingStartPhase)
    + 0.08 * FULL_TURN / largeRatchetToothCount
    + 0.12 * FULL_TURN / barrelRatchetToothCount;
  const referenceWeightY = greatWheelTipClearanceY - weightHalfHeight
    - ropeDrumPitchRadius * windingOvershootAngle;
  const weightX = -ropeDrumPitchRadius;
  const springOuterAnchorRadius = 2.60;
  const springInnerAnchorRadius = 1.98;
  const springOuterBaseAngle = Math.atan2(0.50, -2.55);
  const springInnerBaseAngle = Math.atan2(1.65, -1.10);
  // Brown draws S-S' as one curved wire, not a coil: from S' on G it runs
  // in toward the arbor with a gentle S-bend, turns in a round U over the
  // lower left of B and comes back out to S on the larger ratchet (see
  // springSourceCentreLine). The wire keeps one material length: when T
  // holds the larger ratchet and G runs ahead, the U opens toward the chord
  // between the anchors just enough; it closes again as R re-engages.
  const springSegmentCount = 240;
  const springWireRadius = 0.035;
  const springPreload = 2.20;
  const springStiffness = 0.60;
  // B's small ratchet and click R lie directly in front of the larger
  // ratchet, with B's plain face on them, and the wire lies just in front of
  // that face (0.02 running clearance), so it crosses over B as Brown draws
  // it, on short studs rather than long posts.
  const springPlaneZ = 0.375;
  const goingLoadTorque = 0.30;
  const largeRatchetLagMaximum = FULL_TURN
    * (windingEndPhase - windingStartPhase);
  const greatWheelAngularVelocity = FULL_TURN / demonstrationPeriod;
  const largeRatchetToothPitch = FULL_TURN / largeRatchetToothCount;
  const barrelRatchetToothPitch = FULL_TURN / barrelRatchetToothCount;
  // Ratchet backlash: each wheel runs a little past a seat, then slips back
  // so its click drops fully into the root against the tooth face.
  const clickTBacklash = 0.08 * largeRatchetToothPitch;
  const clickRBacklash = 0.12 * barrelRatchetToothPitch;
  const clickTRecoilWindow = 0.3;
  const clickRSettleStart = 0.88;

  const springSweep = (greatWheelAngle, largeRatchetAngle) =>
    springInnerBaseAngle + largeRatchetAngle
    - springOuterBaseAngle - greatWheelAngle;
  // u runs from S' (0) to S (1), in material-length fractions. Brown's
  // wire is traced as a smooth centripetal Catmull-Rom curve through points
  // on his centre line (raster pixels): from S' it rises a little, dips in
  // an S-bend under B's lower left, turns in a round U (radius about 0.21)
  // over B's rim and climbs back to S. The curve is kept in polar form about
  // the arbor; as G runs ahead of the larger ratchet its angles spread in
  // proportion to the anchors' sweep.
  const springSourceCentreLine = [
    [73, 203], [97, 202], [123, 207], [147, 217], [170, 225], [187, 227],
    [200, 223], [208, 213], [210, 203], [205, 190], [193, 177], [180, 165],
    [168, 152],
  ];
  const springReferenceSamples = 2048;
  const springReference = (() => {
    const anchorPoint = (angle, radius) => new THREE.Vector2(Math.cos(angle), Math.sin(angle))
      .multiplyScalar(radius);
    const points = [
      anchorPoint(springOuterBaseAngle, springOuterAnchorRadius),
      ...springSourceCentreLine.map(([x, y]) => new THREE.Vector2(
        (x - sourceRasterCenter.x) * sourceScale,
        -(y - sourceRasterCenter.y) * sourceScale,
      )),
      anchorPoint(springInnerBaseAngle, springInnerAnchorRadius),
    ];
    const padded = [
      points[0].clone().multiplyScalar(2).sub(points[1]),
      ...points,
      points.at(-1).clone().multiplyScalar(2).sub(points.at(-2)),
    ];
    const dense = [];
    const perSpan = 256;
    for (let i = 1; i < padded.length - 2; i += 1) {
      const [p0, p1, p2, p3] = [padded[i - 1], padded[i], padded[i + 1], padded[i + 2]];
      const t0 = 0;
      const t1 = t0 + Math.sqrt(p1.distanceTo(p0));
      const t2 = t1 + Math.sqrt(p2.distanceTo(p1));
      const t3 = t2 + Math.sqrt(p3.distanceTo(p2));
      const mix = (a, b, ta, tb, t) => a.clone().multiplyScalar((tb - t) / (tb - ta))
        .add(b.clone().multiplyScalar((t - ta) / (tb - ta)));
      for (let k = 0; k < perSpan; k += 1) {
        const t = t1 + (t2 - t1) * k / perSpan;
        const a1 = mix(p0, p1, t0, t1, t);
        const a2 = mix(p1, p2, t1, t2, t);
        const a3 = mix(p2, p3, t2, t3, t);
        dense.push(mix(mix(a1, a2, t0, t2, t), mix(a2, a3, t1, t3, t), t1, t2, t));
      }
    }
    dense.push(points.at(-1).clone());
    const distance = [0];
    for (let i = 1; i < dense.length; i += 1) {
      distance.push(distance[i - 1] + dense[i].distanceTo(dense[i - 1]));
    }
    const total = distance.at(-1);
    const angle = new Float64Array(springReferenceSamples + 1);
    const radius = new Float64Array(springReferenceSamples + 1);
    let j = 0;
    let previousAngle = springOuterBaseAngle;
    for (let i = 0; i <= springReferenceSamples; i += 1) {
      const target = total * i / springReferenceSamples;
      while (j < dense.length - 2 && distance[j + 1] < target) j += 1;
      const span = distance[j + 1] - distance[j];
      const point = dense[j].clone().lerp(dense[j + 1], span > 0 ? (target - distance[j]) / span : 0);
      let theta = Math.atan2(point.y, point.x);
      theta += FULL_TURN * Math.round((previousAngle - theta) / FULL_TURN);
      angle[i] = theta;
      radius[i] = point.length();
      previousAngle = theta;
    }
    angle[0] = springOuterBaseAngle;
    radius[0] = springOuterAnchorRadius;
    angle[springReferenceSamples] = springInnerBaseAngle;
    radius[springReferenceSamples] = springInnerAnchorRadius;
    return { angle, radius };
  })();
  const springReferencePolarAt = (u) => {
    const x = THREE.MathUtils.clamp(u, 0, 1) * springReferenceSamples;
    const i = Math.min(springReferenceSamples - 1, Math.floor(x));
    const f = x - i;
    return [
      springReference.angle[i] + (springReference.angle[i + 1] - springReference.angle[i]) * f,
      springReference.radius[i] + (springReference.radius[i + 1] - springReference.radius[i]) * f,
    ];
  };
  const springSourceSweep = springInnerBaseAngle - springOuterBaseAngle;
  const springAnchorsAt = (greatWheelAngle, sweep) => {
    const outerAngle = springOuterBaseAngle + greatWheelAngle;
    const innerAngle = outerAngle + sweep;
    return [
      new THREE.Vector2(Math.cos(outerAngle), Math.sin(outerAngle))
        .multiplyScalar(springOuterAnchorRadius),
      new THREE.Vector2(Math.cos(innerAngle), Math.sin(innerAngle))
        .multiplyScalar(springInnerAnchorRadius),
    ];
  };
  // opening 0 is Brown's hairpin; opening 1 is the straight chord between
  // the anchors. Both pass through the anchors, so every blend does too.
  const springPointAt = (u, greatWheelAngle, sweep, opening) => {
    if (u <= 0 || u >= 1) {
      const anchor = springAnchorsAt(greatWheelAngle, sweep)[u <= 0 ? 0 : 1];
      return new THREE.Vector3(anchor.x, anchor.y, springPlaneZ);
    }
    const [referenceAngle, radius] = springReferencePolarAt(u);
    const angle = springOuterBaseAngle + greatWheelAngle
      + (referenceAngle - springOuterBaseAngle) * sweep / springSourceSweep;
    const [outer, inner] = springAnchorsAt(greatWheelAngle, sweep);
    const chord = outer.lerp(inner, u);
    return new THREE.Vector3(
      THREE.MathUtils.lerp(Math.cos(angle) * radius, chord.x, opening),
      THREE.MathUtils.lerp(Math.sin(angle) * radius, chord.y, opening),
      springPlaneZ,
    );
  };
  const springLengthSamples = 2048;
  const springLength = (sweep, opening) => {
    let length = 0;
    let previous = springPointAt(0, 0, sweep, opening);
    for (let index = 1; index <= springLengthSamples; index += 1) {
      const point = springPointAt(index / springLengthSamples, 0, sweep,
        opening);
      length += point.distanceTo(previous);
      previous = point;
    }
    return length;
  };
  const springReferenceSweep = springSweep(0, 0);
  const springMaterialLength = springLength(springReferenceSweep, 0);

  const springGeometryAtAngles = (greatWheelAngle, largeRatchetAngle) => {
    const sweep = springSweep(greatWheelAngle, largeRatchetAngle);
    // When G runs ahead of the held ratchet the hairpin would lengthen, so
    // it opens toward the chord just enough to keep the material length.
    let opening = 0;
    if (springLength(sweep, 0) > springMaterialLength) {
      let low = 0;
      let high = 1;
      if (springLength(sweep, high) > springMaterialLength) {
        throw new RangeError('The fixed-length maintaining spring cannot reach both anchors.');
      }
      for (let iteration = 0; iteration < 64; iteration += 1) {
        const middle = (low + high) / 2;
        if (springLength(sweep, middle) > springMaterialLength) low = middle;
        else high = middle;
      }
      opening = (low + high) / 2;
    } else if (springLength(sweep, 0) < springMaterialLength - 1e-9) {
      throw new RangeError('The maintaining spring is never shorter than Brown\'s hairpin.');
    }
    const cumulative = new Float64Array(springLengthSamples + 1);
    let previous = springPointAt(0, greatWheelAngle, sweep, opening);
    let minimumRadius = Math.hypot(previous.x, previous.y);
    for (let index = 1; index <= springLengthSamples; index += 1) {
      const point = springPointAt(index / springLengthSamples,
        greatWheelAngle, sweep, opening);
      cumulative[index] = cumulative[index - 1] + point.distanceTo(previous);
      minimumRadius = Math.min(minimumRadius, Math.hypot(point.x, point.y));
      previous = point;
    }
    const measuredLength = cumulative[springLengthSamples];
    const parameterAtMaterialFraction = (fraction) => {
      const target = THREE.MathUtils.clamp(fraction, 0, 1)
        * cumulative[springLengthSamples];
      let lower = 0;
      let upper = springLengthSamples;
      while (upper - lower > 1) {
        const middle = Math.floor((lower + upper) / 2);
        if (cumulative[middle] < target) lower = middle;
        else upper = middle;
      }
      const interval = cumulative[upper] - cumulative[lower];
      const local = interval > 1e-15
        ? (target - cumulative[lower]) / interval
        : 0;
      return (lower + local) / springLengthSamples;
    };
    return {
      opening,
      minimumRadius,
      sweep,
      materialLength: springMaterialLength,
      measuredLength,
      pointAtMaterialFraction: (fraction) => {
        if (fraction <= 0) return springPointAt(0, greatWheelAngle, sweep, opening);
        if (fraction >= 1) return springPointAt(1, greatWheelAngle, sweep, opening);
        return springPointAt(parameterAtMaterialFraction(fraction),
          greatWheelAngle, sweep, opening);
      },
    };
  };

  const kinematicStateAtTime = (time) => {
    const cycleIndex = Math.floor(time / demonstrationPeriod);
    const localTime = time - cycleIndex * demonstrationPeriod;
    const phase = localTime / demonstrationPeriod;
    const greatWheelAngle = cycleIndex * FULL_TURN + FULL_TURN * phase;
    let largeRatchetLocalAngle;
    let largeRatchetPhaseRate;
    let largeRatchetPhaseAcceleration;
    let barrelAngle;
    let barrelPhaseRate;
    let barrelPhaseAcceleration;
    let mode;

    if (phase <= windingStartPhase) {
      largeRatchetLocalAngle = FULL_TURN * phase;
      largeRatchetPhaseRate = FULL_TURN;
      largeRatchetPhaseAcceleration = 0;
      barrelAngle = FULL_TURN * phase;
      barrelPhaseRate = FULL_TURN;
      barrelPhaseAcceleration = 0;
      mode = 'going-weight-drives-B-through-R-spring-and-G';
    } else if (phase <= windingEndPhase) {
      const span = windingEndPhase - windingStartPhase;
      const windingProgress = (phase - windingStartPhase) / span;
      // Backlash: as the weight's torque leaves the larger ratchet, the
      // spring lets it slip back a little until the face of the tooth T has
      // just dropped behind comes against T's nose (T seats in the root).
      const recoil = windowedStep(windingProgress, 0, clickTRecoilWindow);
      // B is wound a little past its last tooth so that R drops fully behind
      // it; released, the weight draws B forward until that face meets R.
      const wind = windowedStep(windingProgress, 0, clickRSettleStart);
      const settle = windowedStep(windingProgress, clickRSettleStart, 1);
      largeRatchetLocalAngle = FULL_TURN * windingStartPhase
        - clickTBacklash * recoil.value;
      largeRatchetPhaseRate = -clickTBacklash * recoil.first / span;
      largeRatchetPhaseAcceleration = -clickTBacklash * recoil.second
        / span ** 2;
      barrelAngle = largeRatchetLocalAngle
        - (FULL_TURN + clickRBacklash) * wind.value
        + clickRBacklash * settle.value;
      barrelPhaseRate = largeRatchetPhaseRate
        + (-(FULL_TURN + clickRBacklash) * wind.first
          + clickRBacklash * settle.first) / span;
      barrelPhaseAcceleration = largeRatchetPhaseAcceleration
        + (-(FULL_TURN + clickRBacklash) * wind.second
          + clickRBacklash * settle.second) / span ** 2;
      mode = 'winding-B-backward-R-ratcheting-T-holds-spring-drives-G';
    } else {
      const recoveryProgress = (
        phase - windingEndPhase
      ) / (1 - windingEndPhase);
      const shaped = smootherstep(recoveryProgress);
      const shapedFirst = smootherstepFirst(recoveryProgress);
      const shapedSecond = smootherstepSecond(recoveryProgress);
      const greatLocalAngle = FULL_TURN * phase;
      const lagAtRelease = largeRatchetLagMaximum + clickTBacklash;
      const lag = lagAtRelease * (1 - shaped);
      largeRatchetLocalAngle = greatLocalAngle - lag;
      largeRatchetPhaseRate = FULL_TURN
        + lagAtRelease * shapedFirst
          / (1 - windingEndPhase);
      largeRatchetPhaseAcceleration = lagAtRelease
        * shapedSecond / (1 - windingEndPhase) ** 2;
      barrelAngle = largeRatchetLocalAngle - FULL_TURN;
      barrelPhaseRate = largeRatchetPhaseRate;
      barrelPhaseAcceleration = largeRatchetPhaseAcceleration;
      mode = 'post-winding-R-reengaged-weight-recharges-spring';
    }
    const largeRatchetAngle = cycleIndex * FULL_TURN
      + largeRatchetLocalAngle;
    const phaseRateToTime = 1 / demonstrationPeriod;
    const largeRatchetAngularVelocity = largeRatchetPhaseRate
      * phaseRateToTime;
    const largeRatchetAngularAcceleration = largeRatchetPhaseAcceleration
      * phaseRateToTime ** 2;
    const barrelAngularVelocity = barrelPhaseRate * phaseRateToTime;
    const barrelAngularAcceleration = barrelPhaseAcceleration
      * phaseRateToTime ** 2;
    const relativeSpringRotation = largeRatchetAngle - greatWheelAngle;
    const springDeflection = springPreload + relativeSpringRotation;
    const springTorque = springStiffness * springDeflection;
    const springEnergy = 0.5 * springStiffness * springDeflection ** 2;
    const isWinding = phase > windingStartPhase
      && phase <= windingEndPhase;
    const springGeometry = springGeometryAtAngles(
      greatWheelAngle,
      largeRatchetAngle,
    );

    const clickRToothProgress = positiveModulo(
      (largeRatchetAngle - barrelAngle) / barrelRatchetToothPitch,
      1,
    );
    const clickTToothProgress = positiveModulo(
      largeRatchetAngle / largeRatchetToothPitch,
      1,
    );
    const clickRLift = isWinding
      ? 0.115 * Math.sin(Math.PI * clickRToothProgress) ** 4
      : 0;
    const clickTLift = isWinding
      ? 0
      : 0.095 * Math.sin(Math.PI * clickTToothProgress) ** 4;
    return {
      barrelAngle,
      barrelAngularAcceleration,
      barrelAngularVelocity,
      clickRLift,
      clickRMode: isWinding
        ? 'ratcheting-over-reversing-barrel-teeth'
        : 'engaged-transmitting-weight-torque',
      clickRToothProgress,
      clickTLift,
      clickTMode: isWinding
        ? 'engaged-holding-large-ratchet-against-fallback'
        : 'ratcheting-forward-over-large-ratchet',
      clickTToothProgress,
      cycleIndex,
      greatWheelAngle,
      greatWheelAngularAcceleration: 0,
      greatWheelAngularVelocity,
      isWinding,
      largeRatchetAngle,
      largeRatchetAngularAcceleration,
      largeRatchetAngularVelocity,
      mode,
      phase,
      powerSource: isWinding
        ? 'stored-maintaining-spring-S-S-prime'
        : 'descending-weight-through-barrel-B-and-click-R',
      relativeSpringRotation,
      ropeTravel: ropeDrumPitchRadius * barrelAngle,
      springDeflection,
      springEnergy,
      springGeometry,
      springTorque,
      weightAcceleration: -ropeDrumPitchRadius
        * barrelAngularAcceleration,
      weightPosition: new THREE.Vector3(
        weightX,
        referenceWeightY - ropeDrumPitchRadius * barrelAngle,
        ropePlaneZ,
      ),
      weightVelocity: -ropeDrumPitchRadius * barrelAngularVelocity,
    };
  };

  const clickRPivot = new THREE.Vector2(
    (sourceRasterCarriedClickPivotR.x - sourceRasterCenter.x) * sourceScale,
    -(sourceRasterCarriedClickPivotR.y - sourceRasterCenter.y) * sourceScale,
  );
  const clickRContact = new THREE.Vector2(
    (sourceRasterCarriedClickContactR.x - sourceRasterCenter.x) * sourceScale,
    -(sourceRasterCarriedClickContactR.y - sourceRasterCenter.y) * sourceScale,
  );
  const clickTPivot = new THREE.Vector2(
    (sourceRasterFrameClickPivotT.x - sourceRasterCenter.x) * sourceScale,
    -(sourceRasterFrameClickPivotT.y - sourceRasterCenter.y) * sourceScale,
  );
  const clickTContact = new THREE.Vector2(
    (sourceRasterFrameClickContactT.x - sourceRasterCenter.x) * sourceScale,
    -(sourceRasterFrameClickContactT.y - sourceRasterCenter.y) * sourceScale,
  );

  const greatWheel = makeGear({
    axis: Z_AXIS,
    color: PALETTE.driven,
    depth: 0.30,
    radius: greatWheelPitchRadius,
    teeth: greatWheelToothCount,
    toothHeight: 0.18,
  });
  greatWheel.position.z = -0.28;
  greatWheel.userData.role = 'great-going-wheel-G';
  // Brown draws G plain: drop the generic gear's decorative face ring (it
  // stood into the larger ratchet) and its white face index bar.
  for (const part of [...greatWheel.userData.rotor.children]) {
    if (part.geometry?.type === 'TorusGeometry'
      || (part.geometry?.type === 'BoxGeometry'
        && part.material?.color?.getHex() === PALETTE.white)) {
      greatWheel.userData.rotor.remove(part);
      part.geometry.dispose();
    }
  }
  const greatIndexMaterial = matte(PALETTE.white, { roughness: 0.48 });
  const greatWheelIndices = [];
  for (let index = 0; index < 6; index += 1) {
    const angle = index * FULL_TURN / 6;
    const marker = cylinderAlongZ(0.075, 0.08, greatIndexMaterial, 14);
    marker.position.set(
      Math.cos(angle) * 2.62,
      Math.sin(angle) * 2.62,
      0.19,
    );
    marker.userData.role = 'great-wheel-G-symmetric-rotation-index';
    greatWheel.userData.rotor.add(marker);
    greatWheelIndices.push(marker);
  }

  const largeRatchet = makeRotor('larger-ratchet-wheel');
  const largeRatchetMesh = makeRatchetMesh({
    color: PALETTE.accent,
    depth: 0.19,
    innerRadius: largeRatchetInnerRadius,
    outerRadius: largeRatchetOuterRadius,
    role: 'larger-ratchet-wheel-held-by-T',
    toothCount: largeRatchetToothCount,
  });
  largeRatchet.userData.rotor.add(largeRatchetMesh);
  const ringRim = new THREE.Mesh(
    new THREE.TorusGeometry(largeRatchetInnerRadius, 0.065, 9, 72),
    matte(PALETTE.ink, { metalness: 0.16, roughness: 0.50 }),
  );
  ringRim.userData.role = 'larger-ratchet-inner-rim';
  ringRim.visible = false; // Brown's inner edge line only: kept, not drawn
  ringRim.userData.retiredInkOutline = true;
  largeRatchet.userData.rotor.add(ringRim);

  const barrel = makeRotor('weight-going-barrel-B');
  barrel.position.z = 0.29;
  const barrelBody = cylinderAlongZ(
    barrelFaceRadius,
    0.43,
    matte(PALETTE.driver, { metalness: 0.11, roughness: 0.65 }),
    56,
  );
  barrelBody.userData.role = 'barrel-B-face-and-weight-drum-flange';
  const ropeDrum = cylinderAlongZ(
    ropeDrumPitchRadius,
    0.64,
    matte(PALETTE.ink, { metalness: 0.22, roughness: 0.48 }),
    36,
  );
  ropeDrum.userData.role = 'narrow-weight-rope-drum-on-barrel-B';
  const barrelRatchet = makeRatchetMesh({
    color: PALETTE.driver,
    depth: 0.16,
    outerRadius: barrelRatchetPitchRadius * 1.04,
    role: 'small-ratchet-fixed-to-barrel-B',
    toothCount: barrelRatchetToothCount,
  });
  // World z 0.115-0.275: 0.02 in front of the larger ratchet.
  barrelRatchet.position.z = 0.195 - barrel.position.z;
  const barrelHub = cylinderAlongZ(
    0.22,
    1.10,
    matte(PALETTE.ink, { metalness: 0.26, roughness: 0.42 }),
    28,
  );
  barrelHub.userData.role = 'common-going-barrel-arbor';
  barrel.userData.rotor.add(
    barrelBody,
    ropeDrum,
    barrelRatchet,
    barrelHub,
  );
  const barrelIndices = [];
  for (let index = 0; index < 6; index += 1) {
    const angle = index * FULL_TURN / 6;
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 12, 9),
      greatIndexMaterial,
    );
    marker.position.set(
      Math.cos(angle) * 0.72,
      Math.sin(angle) * 0.72,
      0.60,
    );
    marker.userData.role = 'barrel-B-symmetric-rotation-index';
    barrel.userData.rotor.add(marker);
    barrelIndices.push(marker);
  }

  const clickR = makePawl({
    color: PALETTE.ink,
    contact: clickRContact,
    pivot: clickRPivot,
    role: 'click-R-carried-by-larger-ratchet',
    z: 1.30,
  });
  largeRatchet.userData.rotor.add(clickR);
  const clickT = makePawl({
    color: PALETTE.ink,
    contact: clickTContact,
    pivot: clickTPivot,
    role: 'fixed-frame-click-T',
    z: 0.26,
  });

  const springMaterial = matte(PALETTE.ink, {
    metalness: 0.16,
    roughness: 0.56,
  });
  // One continuous round wire, rebuilt in place each frame along the hairpin.
  const springSides = 10;
  const springRingCount = springSegmentCount + 1;
  const springPositions = new Float32Array(springRingCount * springSides * 3);
  const springNormals = new Float32Array(springRingCount * springSides * 3);
  const springIndices = [];
  for (let ring = 0; ring < springSegmentCount; ring += 1) {
    for (let side = 0; side < springSides; side += 1) {
      const a = ring * springSides + side;
      const b = ring * springSides + (side + 1) % springSides;
      const c = a + springSides;
      const d = b + springSides;
      // Counterclockwise seen from outside, matching the outward normals.
      springIndices.push(a, b, c, b, d, c);
    }
  }
  const springWireGeometry = new THREE.BufferGeometry();
  springWireGeometry.setAttribute('position',
    new THREE.BufferAttribute(springPositions, 3));
  springWireGeometry.setAttribute('normal',
    new THREE.BufferAttribute(springNormals, 3));
  springWireGeometry.setIndex(springIndices);
  const springWire = new THREE.Mesh(springWireGeometry, springMaterial);
  springWire.userData.role = 'maintaining-spring-S-S-prime-curved-wire';
  springWire.frustumCulled = false;
  root.add(springWire);
  const springSegments = [springWire];
  const shapeSpringWire = (springGeometry) => {
    const points = Array.from({ length: springRingCount }, (_, index) =>
      springGeometry.pointAtMaterialFraction(index / springSegmentCount));
    for (let ring = 0; ring < springRingCount; ring += 1) {
      const before = points[Math.max(0, ring - 1)];
      const after = points[Math.min(springSegmentCount, ring + 1)];
      const tangentX = after.x - before.x;
      const tangentY = after.y - before.y;
      const tangentLength = Math.hypot(tangentX, tangentY) || 1;
      const normalX = -tangentY / tangentLength;
      const normalY = tangentX / tangentLength;
      for (let side = 0; side < springSides; side += 1) {
        const phi = side / springSides * FULL_TURN;
        const nx = Math.cos(phi) * normalX;
        const ny = Math.cos(phi) * normalY;
        const nz = Math.sin(phi);
        const offset = (ring * springSides + side) * 3;
        springPositions[offset] = points[ring].x + springWireRadius * nx;
        springPositions[offset + 1] = points[ring].y + springWireRadius * ny;
        springPositions[offset + 2] = points[ring].z + springWireRadius * nz;
        springNormals[offset] = nx;
        springNormals[offset + 1] = ny;
        springNormals[offset + 2] = nz;
      }
    }
    springWireGeometry.attributes.position.needsUpdate = true;
    springWireGeometry.attributes.normal.needsUpdate = true;
    springWireGeometry.computeBoundingSphere();
    springWireGeometry.computeBoundingBox();
  };
  const springMarkers = Array.from({ length: 5 }, (_, index) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 12, 9),
      matte(PALETTE.white, { roughness: 0.48 }),
    );
    marker.userData.materialCoordinate = (index + 1) / 6;
    marker.userData.role = 'maintaining-spring-material-index';
    root.add(marker);
    return marker;
  });
  // S' is a short pin hanging from G's arm through the wire's eye; S is a
  // short stud standing on the larger ratchet's face.
  const springOuterAnchor = cylinderAlongZ(
    0.09,
    0.12,
    matte(PALETTE.ink, { metalness: 0.20, roughness: 0.48 }),
    20,
  );
  springOuterAnchor.position.set(
    Math.cos(springOuterBaseAngle) * springOuterAnchorRadius,
    Math.sin(springOuterBaseAngle) * springOuterAnchorRadius,
    springPlaneZ + 0.02 - greatWheel.position.z,
  );
  springOuterAnchor.userData.role = 'spring-outer-anchor-S-prime-on-G';
  greatWheel.userData.rotor.add(springOuterAnchor);
  const springInnerAnchor = cylinderAlongZ(
    0.09,
    springPlaneZ + 0.06 - 0.09,
    springOuterAnchor.material,
    20,
  );
  springInnerAnchor.position.set(
    Math.cos(springInnerBaseAngle) * springInnerAnchorRadius,
    Math.sin(springInnerBaseAngle) * springInnerAnchorRadius,
    (0.09 + springPlaneZ + 0.06) / 2,
  );
  springInnerAnchor.userData.role = 'spring-inner-anchor-S-on-larger-ratchet';
  largeRatchet.userData.rotor.add(springInnerAnchor);

  // The weight hangs in the rope's plane behind the wheels.
  const weight = new THREE.Mesh(
    new THREE.BoxGeometry(1.18, weightHalfHeight * 2, 0.56),
    matte(PALETTE.driver, { metalness: 0.08, roughness: 0.74 }),
  );
  weight.userData.role = 'driving-weight-on-barrel-B';
  // Brown's weight cord is one laid rope: wound 1.7 turns-worth of arc on
  // the drum behind the wheels, then hanging straight to the weight.
  const rope = new THREE.Mesh(
    new THREE.BufferGeometry(),
    matte(PALETTE.belt, { roughness: 0.78 }),
  );
  rope.userData.role = 'single-weight-rope-wound-on-barrel-B';
  rope.userData.crossSection = 'laid-rope';
  const ropeContact = new THREE.Vector3(
    weightX,
    0,
    ropePlaneZ,
  );

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-clock-frame-and-T-bearing';
  fixedFrame.add(
    makeBeam(
      new THREE.Vector3(-3.75, 3.45, -0.60),
      new THREE.Vector3(3.85, 3.45, -0.60),
      { color: PALETTE.frame, depth: 0.28, thickness: 0.20 },
    ),
    makeBeam(
      new THREE.Vector3(3.48, 3.45, -0.60),
      new THREE.Vector3(3.48, 2.83, -0.60),
      { color: PALETTE.frame, depth: 0.24, thickness: 0.16 },
    ),
  );
  const rearBearing = cylinderAlongZ(
    0.34,
    0.35,
    matte(PALETTE.frame, { metalness: 0.16, roughness: 0.58 }),
    32,
  );
  rearBearing.position.z = -0.63;
  rearBearing.userData.role = 'fixed-coaxial-going-barrel-bearing';
  fixedFrame.add(rearBearing);

  root.add(
    fixedFrame,
    greatWheel,
    largeRatchet,
    barrel,
    clickT,
    rope,
    weight,
  );

  const pawlTipPosition = (pawl, parentAngle, lift) => {
    const pivot = pawl.userData.pivot;
    const displacement = pawl.userData.contact.clone().sub(pivot)
      .rotateAround(
        new THREE.Vector2(),
        pawl.userData.liftSign * lift,
      );
    const local = pivot.clone().add(displacement);
    return local.rotateAround(new THREE.Vector2(), parentAngle);
  };

  const stateAtTime = (time) => {
    const state = kinematicStateAtTime(time);
    const clickRTip2 = pawlTipPosition(
      clickR,
      state.largeRatchetAngle,
      state.clickRLift,
    );
    const clickTTip2 = pawlTipPosition(clickT, 0, state.clickTLift);
    return {
      ...state,
      contacts: {
        R: {
          active: !state.isWinding,
          clearance: clickRTip2.length() - barrelRatchetPitchRadius,
          point: new THREE.Vector3(clickRTip2.x, clickRTip2.y, 1.30),
          ratcheting: state.isWinding,
        },
        T: {
          activeHold: state.isWinding,
          clearance: clickTTip2.length() - largeRatchetPitchRadius,
          point: new THREE.Vector3(clickTTip2.x, clickTTip2.y, 0.26),
          ratchetingForward: !state.isWinding,
        },
      },
      rope: {
        freeLength: ropeContact.y
          - (state.weightPosition.y + 0.45),
        pitchRadius: ropeDrumPitchRadius,
        slipError: state.weightPosition.y - referenceWeightY
          + ropeDrumPitchRadius * state.barrelAngle,
        topContact: ropeContact.clone(),
        weightAttachment: state.weightPosition.clone().add(
          new THREE.Vector3(0, 0.45, 0),
        ),
      },
    };
  };

  const ropeRadius = 0.035;
  const ropeWrapPoints = Array.from({ length: 65 }, (_, i) => {
    const angle = Math.PI - 1.7 * Math.PI * (64 - i) / 64;
    return new THREE.Vector3(
      ropeDrumPitchRadius * Math.cos(angle),
      ropeDrumPitchRadius * Math.sin(angle),
      ropeContact.z,
    );
  });
  const ropeWrapCurve = new THREE.CatmullRomCurve3(ropeWrapPoints);
  const shapeRope = (state) => {
    const path = new THREE.CurvePath();
    path.add(ropeWrapCurve);
    path.add(new THREE.LineCurve3(
      state.rope.topContact.clone(),
      state.rope.weightAttachment.clone(),
    ));
    // The lay moves with the rope as the barrel pays it out.
    replaceWithLaidRope(rope, path, {
      radius: ropeRadius,
      travel: ropeDrumPitchRadius * state.barrelAngle,
      tubularSegments: 256,
    });
  };
  const update = (time) => {
    const state = stateAtTime(time);
    setRotorAngle(greatWheel, state.greatWheelAngle);
    setRotorAngle(largeRatchet, state.largeRatchetAngle);
    setRotorAngle(barrel, state.barrelAngle);
    clickR.rotation.z = clickR.userData.baseAngle
      + clickR.userData.liftSign * state.clickRLift;
    clickT.rotation.z = clickT.userData.baseAngle
      + clickT.userData.liftSign * state.clickTLift;
    weight.position.copy(state.weightPosition);
    shapeRope(state);
    shapeSpringWire(state.springGeometry);
    for (const marker of springMarkers) {
      marker.position.copy(state.springGeometry.pointAtMaterialFraction(
        marker.userData.materialCoordinate,
      ));
      marker.position.z += 0.03;
    }
    root.userData.contacts = state.contacts;
    root.userData.renderState = state;
    root.userData.updateClockInterfaces?.(state);
  };

  const sourcePointToReferenceFront = (point) => new THREE.Vector3(
    (point.x - sourceRasterCenter.x) * sourceScale,
    -(point.y - sourceRasterCenter.y) * sourceScale,
    0,
  );

  root.userData.archetype =
    'harrison-spring-maintaining-power-going-barrel';
  root.userData.blocks = {
    barrel,
    barrelBody,
    barrelHub,
    barrelIndices,
    barrelRatchet,
    clickR,
    clickT,
    fixedFrame,
    greatWheel,
    greatWheelIndices,
    largeRatchet,
    largeRatchetMesh,
    rope,
    ropeDrum,
    springInnerAnchor,
    springMarkers,
    springOuterAnchor,
    springSegments,
    weight,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.85, -4.60, -1.05),
    new THREE.Vector3(4.00, 3.60, 1.55),
  );
  root.userData.canonicalTimes = {
    cycleClosure: demonstrationPeriod,
    goingMidStroke: demonstrationPeriod * windingStartPhase / 2,
    windingBegins: demonstrationPeriod * windingStartPhase,
    windingMidStroke: demonstrationPeriod
      * (windingStartPhase + windingEndPhase) / 2,
    windingEnds: demonstrationPeriod * windingEndPhase,
    springRecoveryMidStroke: demonstrationPeriod * (windingEndPhase + 1) / 2,
  };
  root.userData.geometry = {
    barrelFaceRadius,
    barrelRatchetPitchRadius,
    barrelRatchetToothCount,
    barrelRatchetToothPitch,
    clickRBacklash,
    clickRSettleStart,
    clickTBacklash,
    clickTRecoilWindow,
    demonstrationPeriod,
    goingLoadTorque,
    greatWheelAngularVelocity,
    greatWheelPitchRadius,
    greatWheelToothCount,
    largeRatchetInnerRadius,
    largeRatchetLagMaximum,
    largeRatchetOuterRadius,
    largeRatchetPitchRadius,
    largeRatchetToothCount,
    largeRatchetToothPitch,
    springSourceCentreLine,
    springWireRadius,
    springPlaneZ,
    referenceWeightY,
    ropeDrumPitchRadius,
    ropePlaneZ,
    sourceImageHeight,
    sourceImageWidth,
    sourceScale,
    springInnerAnchorRadius,
    springMaterialLength,
    springOuterAnchorRadius,
    springPreload,
    springSegmentCount,
    springStiffness,
    windingEndPhase,
    windingStartPhase,
  };
  root.userData.kinematicStateAtTime = kinematicStateAtTime;
  root.userData.mechanism =
    'weight unwinds barrel B and its small ratchet drives carried click R, the larger ratchet, preloaded spring S–S′, and great wheel G; while B reverses to wind the weight, R clicks backward, fixed click T holds the larger ratchet, and the spring alone keeps G advancing';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    referenceScope: 'Brown supplies coaxial barrel B, its small ratchet, carried click R, the larger ratchet, fixed-frame click T, spring S–S′, outer great wheel G, and the weight cord. Tooth counts, spring stiffness and preload, drum depth, masses, and timing are not dimensioned.',
    sourceUrl: 'https://507movements.com/mm_321.html',
  };
  root.userData.sourcePointToReferenceFront = sourcePointToReferenceFront;
  root.userData.sourceReference = {
    brownPlate321: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'coaxial outer great wheel G, spring-coupled larger ratchet carrying R, small ratchet fixed to barrel B, fixed-frame holding click T, and one weight rope',
      measurementUncertaintyPixels: 11,
      rasterBarrelCenterB: sourceRasterCenter.clone(),
      rasterCarriedClickContactR:
        sourceRasterCarriedClickContactR.clone(),
      rasterCarriedClickPivotR: sourceRasterCarriedClickPivotR.clone(),
      rasterFrameClickContactT: sourceRasterFrameClickContactT.clone(),
      rasterFrameClickPivotT: sourceRasterFrameClickPivotT.clone(),
      rasterInnerSpringAnchorS: sourceRasterInnerSpringAnchorS.clone(),
      rasterOuterSpringAnchorSPrime:
        sourceRasterOuterSpringAnchorSPrime.clone(),
      rasterWeightCenter: sourceRasterWeightCenter.clone(),
    },
    officialDescription: movement.description,
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 79,
      edition: 21,
      illustrationPage: 78,
      publicationYear: 1908,
    },
  };
  root.userData.springGeometryAtAngles = springGeometryAtAngles;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    demonstrationPeriod,
    schedule: [
      'weight-descends-and-B-drives-carried-click-R',
      'larger-ratchet-loads-spring-S-S-prime-and-drives-G',
      'winding-reverses-B-and-lifts-the-weight',
      'R-ratchets-while-fixed-click-T-holds-the-larger-ratchet',
      'stored-spring-energy-keeps-G-advancing',
      'R-reengages-and-restores-the-spring-preload',
    ],
  };
  root.userData.transmission = {
    carriedClick: 'R is pivoted on the larger ratchet and engages the small ratchet fixed to B',
    fixedClick: 'T is pivoted in the frame and prevents the larger ratchet falling back during winding',
    goingPath: 'weight → barrel B → small ratchet → R → larger ratchet → spring S–S′ → great wheel G',
    outputContinuity: 'G has strictly positive constant angular velocity through going, winding, and spring recovery',
    ropeNoSlipLaw: 'weight displacement = -barrel angle × rope-drum pitch radius',
    springLaw: 'torque = stiffness × (preload + larger-ratchet angle - G angle)',
    windingPath: 'operator reverses B; R overruns, T holds the larger ratchet, and S–S′ alone supplies G',
  };

  correctGoingBarrel(root);
  seatGoingBarrelClicks(root);
  // B's plain face is a thin raised disc on its small ratchet, just
  // behind the spring's plane; R's journal only spans the gap to R.
  {
    barrelBody.updateMatrix();
    const geometry = barrelBody.geometry.applyMatrix4(barrelBody.matrix);
    barrelBody.position.set(0, 0, 0);
    barrelBody.rotation.set(0, 0, 0);
    barrelBody.scale.set(1, 1, 1);
    geometry.computeBoundingBox();
    const minZ = geometry.boundingBox.min.z;
    const maxZ = geometry.boundingBox.max.z;
    const faceBack = 0.27 - barrel.position.z;
    const faceFront = springPlaneZ - springWireRadius - 0.02
      - barrel.position.z;
    geometry.translate(0, 0, -minZ);
    geometry.scale(1, 1, (faceFront - faceBack) / (maxZ - minZ));
    geometry.translate(0, 0, faceBack);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const clickR = root.userData.blocks.finiteClicks
      .find((follower) => follower.name === 'R');
    const pinBack = 0.085;
    const pinFront = clickR.group.position.z + 0.07;
    clickR.pin.geometry.dispose();
    clickR.pin.geometry = new THREE.CylinderGeometry(0.08, 0.08,
      pinFront - pinBack, 32);
    clickR.pin.position.z = (pinFront + pinBack) / 2;
  }

  // Brown draws no frame, bearing or stud: T turns on a short journal pin
  // through its eye, and the common arbor ends as a plain cut stub just
  // behind the rope drum, so no undrawn back bar is needed.
  {
    const { blocks } = root.userData;
    const clickT = blocks.finiteClicks.find((follower) => follower.name === 'T');
    const pinLength = 0.26;
    clickT.pin.geometry.dispose();
    clickT.pin.geometry = new THREE.CylinderGeometry(0.08, 0.08, pinLength, 32);
    clickT.pin.position.z = -0.01;
    root.updateMatrixWorld(true);
    const hubBox = new THREE.Box3().setFromObject(blocks.barrelHub);
    const wheelBox = new THREE.Box3().setFromObject(blocks.greatWheelBody);
    // It runs on back through the rope drum (behind the wheels) to a cut
    // stub just behind the drum.
    const drumBox = new THREE.Box3().setFromObject(blocks.ropeDrum);
    const arborBack = Math.min(wheelBox.min.z - 0.08, drumBox.min.z - 0.06);
    // In front, Brown squares the arbor end flush with B's small ratchet:
    // a short winding square, the arbor ending inside it.
    const ratchetFront = new THREE.Box3().setFromObject(barrelBody).max.z;
    const arborFront = ratchetFront + 0.03;
    const arborLength = arborFront - arborBack;
    blocks.barrelHub.geometry.dispose();
    blocks.barrelHub.geometry = new THREE.CylinderGeometry(0.14, 0.14, arborLength, 40);
    blocks.barrelHub.position.z += (arborFront + arborBack) / 2 - (hubBox.max.z + hubBox.min.z) / 2;
    const windingSquare = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.34, 0.06),
      blocks.barrelHub.material,
    );
    windingSquare.position.set(0, 0,
      ratchetFront + 0.02 - barrel.position.z);
    windingSquare.userData.role = 'common-arbor-winding-square-flush-with-B';
    barrel.userData.rotor.add(windingSquare);
  }
  // The laid rope already runs round the exposed groove; the helper's
  // separate wrap stays only as a reference.
  root.userData.blocks.ropeWrap.visible = false;
  root.userData.blocks.ropeWrap.userData.retiredDuplicateRope = true;
  // The spring lies just in front of the larger ratchet's face, in the
  // wheels' plane. S is a short stud on the ratchet's face. S' belongs to G,
  // behind the ratchet: a short post comes up through an arc slot in the
  // ratchet ring (G runs up to 45 degrees ahead of the ratchet; outside the
  // ratchet's rim it would strike click T), then a short arm lying just in
  // front of the wire's plane reaches S'.
  {
    const postRadius = 0.07;
    const springPinTopZ = greatWheel.position.z
      + springOuterAnchor.position.z
      + springOuterAnchor.geometry.parameters.height / 2;
    const outerPostRadius = 1.66;
    const outerPostAngle = THREE.MathUtils.degToRad(192);
    const greatWheelFrontZ = greatWheel.position.z + 0.15;
    const armBottomZ = springPinTopZ - 0.01;
    const armDepth = 0.08;
    const outerPostTopZ = armBottomZ + armDepth;
    const outerPostLength = outerPostTopZ - greatWheelFrontZ + 0.02;
    const greatWheelLocalZ = (z) => z - greatWheel.position.z;
    const outerPost = cylinderAlongZ(postRadius, outerPostLength,
      greatWheel.userData.rotor.children[0].material, 20);
    const postPoint = new THREE.Vector2(
      Math.cos(outerPostAngle) * outerPostRadius,
      Math.sin(outerPostAngle) * outerPostRadius,
    );
    outerPost.position.set(postPoint.x, postPoint.y,
      greatWheelLocalZ(greatWheelFrontZ - 0.02 + outerPostLength / 2));
    outerPost.userData.role = 'spring-S-prime-post-on-G';
    greatWheel.userData.rotor.add(outerPost);
    const anchorPoint = new THREE.Vector2(
      springOuterAnchor.position.x,
      springOuterAnchor.position.y,
    );
    const armSpan = anchorPoint.clone().sub(postPoint);
    // A flat round-ended arm, its ends concentric with the post and S'.
    const armLow = greatWheelLocalZ(armBottomZ);
    const arm = new THREE.Mesh(
      plate(capsule(postPoint.toArray(), anchorPoint.toArray(), 0.10),
        armLow, armLow + armDepth),
      outerPost.material,
    );
    arm.userData.role = 'spring-S-prime-arm-on-G';
    greatWheel.userData.rotor.add(arm);

    const profile = largeRatchetMesh.userData.ratchetProfile;
    const slotInner = outerPostRadius - postRadius - 0.025;
    const slotOuter = outerPostRadius + postRadius + 0.025;
    const slotHalfAngle = (postRadius + 0.03) / outerPostRadius;
    const slotStart = outerPostAngle - slotHalfAngle;
    const slotEnd = outerPostAngle + THREE.MathUtils.degToRad(45)
      + slotHalfAngle;
    const slotSteps = 48;
    const slot = [
      ...Array.from({ length: slotSteps + 1 }, (_, index) => {
        const angle = slotStart + (slotEnd - slotStart) * index / slotSteps;
        return [slotOuter * Math.cos(angle), slotOuter * Math.sin(angle)];
      }),
      ...Array.from({ length: slotSteps + 1 }, (_, index) => {
        const angle = slotEnd - (slotEnd - slotStart) * index / slotSteps;
        return [slotInner * Math.cos(angle), slotInner * Math.sin(angle)];
      }),
    ];
    largeRatchetMesh.geometry.dispose();
    largeRatchetMesh.geometry = plate(polygonClipping.difference(
      poly(profile.outline),
      poly(circle([0, 0], profile.bore, 64)),
      poly(slot),
    ), -profile.depth / 2, profile.depth / 2);
    Object.assign(root.userData.blocks, {
      springOuterArm: arm,
      springOuterPost: outerPost,
    });
  }
  // Frame the lowered weight's lowest point (just before winding).
  root.userData.cameraFitBounds.min.y = Math.min(
    root.userData.cameraFitBounds.min.y,
    referenceWeightY - ropeDrumPitchRadius * FULL_TURN * windingStartPhase
      - weightHalfHeight - 0.05,
  );
  update(0);
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  markShadows(root);
  rope.castShadow = false;
  rope.receiveShadow = false;
  root.userData.fidelity = 'authored';

  return {
    cameraDirection: new THREE.Vector3(.6, .8, 15),
    root,
    update,
  };
}

export function createAuthoredGoingBarrelMovement(movement) {
  if (movement.id !== 321) return null;
  return harrisonGoingBarrel(movement);
}
