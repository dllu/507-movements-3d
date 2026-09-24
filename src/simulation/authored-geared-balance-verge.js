import * as THREE from 'three';
import { PALETTE, makeGear, markShadows, matte } from './primitives.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

// Brown's 298: balance C on a vertical staff whose pinion drives a crown wheel
// (the drum, geared like Movement 26) on a horizontal arbor. That arbor carries
// two tilted loops over the top of a face-on saw-tooth escape wheel. At the top
// the teeth move along the arbor, so the loops are reconstructed as opposite-
// handed helical pallets: a tooth corner pushing a helical face turns the arbor,
// and each pallet releases by swinging out of the wheel's plane (one toward the
// front, one toward the back). Coordinates: x right, y up, z toward the viewer;
// 0.03 model units per source pixel, origin at source (150, 276), the arbor axis.
const SCALE = 0.03;
const source = (px, py) => new THREE.Vector2((px - 150) * SCALE, (276 - py) * SCALE);

// Closed solid from a map of the unit cube [0,1]^3 sampled nu x nv x 1. Faces
// are emitted outward in parameter space, then the whole mesh is flipped if
// the map reverses orientation, so every face shares one outward winding.
function parametricSolid(nu, nv, map) {
  const positions = [];
  const at = (u, v, w) => map(u, v, w);
  const quad = (a, b, c, d) => { for (const p of [a, b, c, a, c, d]) positions.push(p.x, p.y, p.z); };
  for (let i = 0; i < nu; i += 1) for (let j = 0; j < nv; j += 1) {
    const u0 = i / nu, u1 = (i + 1) / nu, v0 = j / nv, v1 = (j + 1) / nv;
    quad(at(u0, v0, 0), at(u0, v1, 0), at(u1, v1, 0), at(u1, v0, 0));
    quad(at(u0, v0, 1), at(u1, v0, 1), at(u1, v1, 1), at(u0, v1, 1));
  }
  for (let i = 0; i < nu; i += 1) {
    const u0 = i / nu, u1 = (i + 1) / nu;
    quad(at(u0, 0, 0), at(u1, 0, 0), at(u1, 0, 1), at(u0, 0, 1));
    quad(at(u0, 1, 0), at(u0, 1, 1), at(u1, 1, 1), at(u1, 1, 0));
  }
  for (let j = 0; j < nv; j += 1) {
    const v0 = j / nv, v1 = (j + 1) / nv;
    quad(at(0, v0, 0), at(0, v0, 1), at(0, v1, 1), at(0, v1, 0));
    quad(at(1, v0, 0), at(1, v1, 0), at(1, v1, 1), at(1, v0, 1));
  }
  let volume = 0;
  for (let k = 0; k < positions.length; k += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = positions.slice(k, k + 9);
    volume += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  if (volume < 0) for (let k = 0; k < positions.length; k += 9) {
    for (let e = 0; e < 3; e += 1) [positions[k + 3 + e], positions[k + 6 + e]] = [positions[k + 6 + e], positions[k + 3 + e]];
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function cylinder(radius, length, axis, material, segments = 32) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, segments), material);
  mesh.quaternion.setFromUnitVectors(Y_AXIS, axis);
  return mesh;
}

function gearedBalanceVergeEscapement(movement) {
  const root = new THREE.Group();
  const steel = matte(PALETTE.ink, { metalness: 0.3, roughness: 0.45 });
  const brass = matte(PALETTE.brass, { metalness: 0.2, roughness: 0.5 });
  const wheelMaterial = matte(PALETTE.driven, { metalness: 0.12, roughness: 0.6 });
  const balanceMaterial = matte(PALETTE.driver, { metalness: 0.12, roughness: 0.6 });
  const crownMaterial = matte(PALETTE.accent, { metalness: 0.16, roughness: 0.55 });

  // Escape wheel: 20 saw teeth turning counterclockwise (Brown's arrow rises on
  // the right), so the top teeth travel toward -x along the arbor.
  const escapeCenter = new THREE.Vector2(source(115, 0).x, -2.68);
  const toothCount = 20;
  const pitch = FULL_TURN / toothCount;
  const tipRadius = 2.4;
  const rootRadius = 2.02;
  const wheelThickness = 0.1;
  const halfThickness = wheelThickness / 2;

  // Arbor, pallets and their helix.
  const arborY = 0;
  const arborRadius = 0.13;
  const arborAmplitude = THREE.MathUtils.degToRad(30);
  const releaseAngle = THREE.MathUtils.degToRad(6);
  const catchAngle = THREE.MathUtils.degToRad(18);
  const helixPitch = 0.62;
  const palletThickness = 0.09;
  const palletClearance = 0.002;
  const palletMargin = THREE.MathUtils.degToRad(5);

  const tipPoint = (phi) => new THREE.Vector2(
    escapeCenter.x + tipRadius * Math.cos(phi),
    escapeCenter.y + tipRadius * Math.sin(phi),
  );
  const cornerAngle = (phi) => Math.atan2(halfThickness, arborY - tipPoint(phi).y);
  // Pallet 2 (right) pushes the arbor negative; pallet 1 (left) positive.
  // Each contacting tooth touches at the tip corner nearest its pallet.
  const palletX = (side, center, theta, phi) => center + helixPitch * (cornerAngle(phi) + side * theta);
  const solveTip = (side, center, theta) => {
    let phi = Math.PI / 2;
    for (let iteration = 0; iteration < 40; iteration += 1) {
      const f = tipPoint(phi).x - palletX(side, center, theta, phi);
      const h = 1e-7;
      const g = (tipPoint(phi + h).x - palletX(side, center, theta, phi + h) - f) / h;
      const step = f / g;
      phi -= step;
      if (Math.abs(step) < 1e-14) break;
    }
    return phi;
  };
  // side +1 = pallet 2 (x = c + p(delta + theta)); side -1 = pallet 1.
  const pallet1X = source(88, 0).x;
  const halfBeat = pitch / 2;
  const drops = (pallet2X) => {
    const tip1 = (theta) => solveTip(-1, pallet1X, theta);
    const tip2 = (theta) => solveTip(1, pallet2X, theta);
    return {
      first: tip2(catchAngle) - tip1(releaseAngle) + pitch,
      second: tip1(-catchAngle) - tip2(-releaseAngle),
    };
  };
  let low = pallet1X + 0.1, high = pallet1X + 0.7;
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const middle = (low + high) / 2;
    const { first, second } = drops(middle);
    if (first > second) low = middle; else high = middle;
  }
  const pallet2X = (low + high) / 2;
  const tipAt = (side, theta) => solveTip(side, side > 0 ? pallet2X : pallet1X, theta);
  const dropAngles = drops(pallet2X);

  const period = 4;
  const omega = FULL_TURN / period;
  const phaseAtAngle = (angle, rising) => {
    const base = Math.acos(THREE.MathUtils.clamp(-angle / arborAmplitude, -1, 1));
    return (rising ? base : FULL_TURN - base) / omega;
  };
  const times = {
    release1: phaseAtAngle(releaseAngle, true),
    catch2: phaseAtAngle(catchAngle, true),
    release2: phaseAtAngle(-releaseAngle, false),
    catch1: phaseAtAngle(-catchAngle, false),
  };
  const arborAt = (time) => ({
    angle: -arborAmplitude * Math.cos(omega * time),
    speed: arborAmplitude * omega * Math.sin(omega * time),
    acceleration: arborAmplitude * omega ** 2 * Math.cos(omega * time),
  });
  const contactState = (side, time, offset) => {
    const d = 1e-5;
    const angle = (t) => tipAt(side, arborAt(t).angle) + offset - Math.PI / 2;
    const value = angle(time);
    return {
      angle: value,
      speed: (angle(time + d) - angle(time - d)) / (2 * d),
      acceleration: (angle(time + d) - 2 * value + angle(time - d)) / d ** 2,
    };
  };
  // Drops: quintic from the release state to the landing state.
  const quintic = (start, end, t0, t1, time) => {
    const span = t1 - t0, u = (time - t0) / span;
    const p0 = start.angle, v0 = start.speed * span, a0 = start.acceleration * span ** 2;
    const p1 = end.angle, v1 = end.speed * span, a1 = end.acceleration * span ** 2;
    const c3 = 10 * (p1 - p0) - 6 * v0 - 4 * v1 - 1.5 * a0 + 0.5 * a1;
    const c4 = -15 * (p1 - p0) + 8 * v0 + 7 * v1 + 1.5 * a0 - a1;
    const c5 = 6 * (p1 - p0) - 3 * v0 - 3 * v1 - 0.5 * a0 + 0.5 * a1;
    const position = p0 + v0 * u + 0.5 * a0 * u ** 2 + c3 * u ** 3 + c4 * u ** 4 + c5 * u ** 5;
    const velocity = (v0 + a0 * u + 3 * c3 * u ** 2 + 4 * c4 * u ** 3 + 5 * c5 * u ** 4) / span;
    return { angle: position, speed: velocity, acceleration: 0 };
  };
  const stateAtTime = (time) => {
    const cycle = Math.floor(time / period);
    const local = time - cycle * period;
    const arbor = arborAt(local);
    const base = cycle * pitch;
    let wheel, stage, activePallet = null;
    if (local < times.release1) {
      wheel = contactState(-1, local, base); stage = 'pallet-1-recoil-and-impulse'; activePallet = 1;
    } else if (local < times.catch2) {
      wheel = quintic(contactState(-1, times.release1, base), contactState(1, times.catch2, base + pitch),
        times.release1, times.catch2, local); stage = 'drop-to-pallet-2';
    } else if (local < times.release2) {
      wheel = contactState(1, local, base + pitch); stage = 'pallet-2-recoil-and-impulse'; activePallet = 2;
    } else if (local < times.catch1) {
      wheel = quintic(contactState(1, times.release2, base + pitch), contactState(-1, times.catch1, base + pitch),
        times.release2, times.catch1, local); stage = 'drop-to-pallet-1';
    } else {
      wheel = contactState(-1, local, base + pitch); stage = 'pallet-1-recoil-and-impulse'; activePallet = 1;
    }
    return {
      activePallet,
      arborAngle: arbor.angle,
      arborSpeed: arbor.speed,
      balanceAngle: arbor.angle * gearRatio,
      balanceSpeed: arbor.speed * gearRatio,
      stage,
      wheelAngle: wheel.angle,
      wheelSpeed: wheel.speed,
    };
  };

  // Escape wheel solid: saw teeth with a radial leading face, a sloped back
  // and Brown's four lens-shaped openings.
  const wheelShape = new THREE.Shape();
  for (let index = 0; index < toothCount; index += 1) {
    const tip = Math.PI / 2 + index * pitch;
    const points = [
      [rootRadius, tip - pitch * 0.72],
      [tipRadius, tip],
      [rootRadius, tip - 0.03],
    ];
    points.forEach(([radius, angle], k) => {
      const x = radius * Math.cos(angle), y = radius * Math.sin(angle);
      if (index === 0 && k === 0) wheelShape.moveTo(x, y); else wheelShape.lineTo(x, y);
    });
  }
  wheelShape.closePath();
  for (let lens = 0; lens < 4; lens += 1) {
    const middle = Math.PI / 4 + lens * Math.PI / 2, spread = 0.66;
    const inner = 0.78, outer = 1.8;
    const hole = new THREE.Path();
    const polar = (angle, radius) => new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius);
    // A vesica: two arcs meeting at points on the mid radius.
    const a = polar(middle - spread, (inner + outer) / 2), b = polar(middle + spread, (inner + outer) / 2);
    const bulgeOut = polar(middle, 2 * outer - (inner + outer) / 2 * Math.cos(spread));
    const bulgeIn = polar(middle, 2 * inner - (inner + outer) / 2 * Math.cos(spread));
    hole.moveTo(a.x, a.y);
    hole.quadraticCurveTo(bulgeOut.x, bulgeOut.y, b.x, b.y);
    hole.quadraticCurveTo(bulgeIn.x, bulgeIn.y, a.x, a.y);
    wheelShape.holes.push(hole);
  }
  const escapeWheel = new THREE.Group();
  escapeWheel.position.set(escapeCenter.x, escapeCenter.y, 0);
  const escapeRotor = new THREE.Group();
  escapeWheel.add(escapeRotor);
  const wheelGeometry = new THREE.ExtrudeGeometry(wheelShape, { bevelEnabled: false, curveSegments: 12, depth: wheelThickness });
  wheelGeometry.translate(0, 0, -halfThickness);
  const toothedWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
  toothedWheel.userData.role = 'twenty-tooth-saw-escape-wheel';
  const escapeHub = cylinder(0.3, 0.24, Z_AXIS, steel);
  escapeHub.userData.role = 'escape-wheel-hub';
  const escapeArbor = cylinder(0.1, 0.9, Z_AXIS, steel, 20);
  escapeArbor.position.z = 0.25;
  escapeArbor.userData.role = 'escape-wheel-arbor-toward-viewer';
  escapeRotor.add(toothedWheel, escapeHub, escapeArbor);
  root.add(escapeWheel);

  // Horizontal arbor with the two helical pallets and the crown wheel.
  const arbor = new THREE.Group();
  arbor.position.set(0, arborY, 0);
  arbor.userData.axis = X_AXIS.clone();
  const arborLeft = source(7, 0).x;
  const crownRearX = source(197, 0).x;
  const arborRod = cylinder(arborRadius, crownRearX - arborLeft + 0.2, X_AXIS, steel, 24);
  arborRod.position.x = (arborLeft + crownRearX + 0.2) / 2;
  arborRod.userData.role = 'horizontal-pallet-arbor';
  arbor.add(arborRod);
  const topTipHeight = arborY - (escapeCenter.y + tipRadius);
  const palletReach = topTipHeight + 0.09;
  // Wire-loop pallets: band width, the lowest the non-working part of a loop
  // may reach below the arbor axis, and its innermost radius (just inside the
  // arbor rod, so the loop is carried by it).
  const loopWireWidth = 0.1;
  const loopFloor = topTipHeight - 0.05;
  const loopInnerLimit = arborRadius - 0.01;
  const loopTopRadius = palletReach + 0.1;
  const loopBlendArc = 0.25;
  const loopGap = 0.004;
  const loopReturnSegments = 96;
  const normalizeAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
  const makePallet = (side, center) => {
    // The release edge is the corner angle at the release pose; the other end
    // carries a margin past the recoil extreme.
    const releaseCorner = cornerAngle(tipAt(side, -side * releaseAngle));
    const deltaMin = side > 0 ? releaseCorner - releaseAngle : -releaseCorner - arborAmplitude - palletMargin;
    const deltaMax = side > 0 ? releaseCorner + arborAmplitude + palletMargin : -releaseCorner + releaseAngle;
    // Brown draws each pallet as a wire loop hung on the arbor. The loop is a
    // flat band of constant radial width closed around the arbor: across the
    // working arc its face is the exact helix (standing a running clearance
    // behind it, so its chords never cross the tooth corner that rides the
    // analytic face) and it reaches down to the tooth corners; over the rest
    // of the turn it returns to its starting x and stays above the teeth for
    // any arbor swing, rising again to the loop's full radius over the top.
    const workingSpan = deltaMax - deltaMin;
    const returnSpan = FULL_TURN - workingSpan - loopGap;
    const workingFraction = 36 / (36 + loopReturnSegments);
    const smooth = (s) => s * s * (3 - 2 * s);
    const clearOuter = (delta) => {
      // Largest radius whose lowest point, over the full arbor swing, stays
      // above loopFloor.
      const tilt = Math.max(0, Math.abs(normalizeAngle(delta)) - arborAmplitude);
      return tilt >= Math.PI / 2 ? loopTopRadius : Math.min(loopTopRadius, loopFloor / Math.cos(tilt));
    };
    const geometry = parametricSolid(4, 36 + loopReturnSegments, (u, v, w) => {
      let delta, helixDelta, outer;
      if (v <= workingFraction) {
        delta = deltaMin + workingSpan * (v / workingFraction);
        helixDelta = delta;
        outer = palletReach;
      } else {
        const s = (v - workingFraction) / (1 - workingFraction);
        delta = deltaMax + returnSpan * s;
        helixDelta = deltaMax + (deltaMin - deltaMax) * smooth(s);
        // Past the recoil end the loop leaves the working radius over a short
        // arc; at the release edge it steps up at once, clear of the escaping
        // tooth corner.
        const recoilArc = side > 0 ? s * returnSpan : (1 - s) * returnSpan;
        const releaseArc = side > 0 ? (1 - s) * returnSpan : s * returnSpan;
        const blend = releaseArc < loopGap * 2 ? 1 : Math.min(1, recoilArc / loopBlendArc);
        outer = THREE.MathUtils.lerp(palletReach, clearOuter(delta), smooth(blend));
      }
      const rho = Math.max(loopInnerLimit, outer - loopWireWidth) + (outer - Math.max(loopInnerLimit, outer - loopWireWidth)) * u;
      const x = center + side * helixPitch * helixDelta - palletClearance - w * palletThickness;
      return new THREE.Vector3(x, -rho * Math.cos(delta), rho * Math.sin(delta));
    });
    const mesh = new THREE.Mesh(geometry, brass);
    mesh.userData.role = side > 0 ? 'right-helical-pallet-loop' : 'left-helical-pallet-loop';
    return mesh;
  };
  const pallet1 = makePallet(-1, pallet1X);
  const pallet2 = makePallet(1, pallet2X);
  arbor.add(pallet1, pallet2);

  // Crown wheel geared like Movement 26: a drum with straight-sided axial
  // teeth that act as a rack where they pass the involute pinion.
  const pinionTeeth = 12, crownTeeth = 30;
  const gearModule = 0.135;
  const pinionRadius = pinionTeeth * gearModule / 2;
  const crownPitchRadius = crownTeeth * gearModule / 2;
  const gearRatio = crownPitchRadius / pinionRadius;
  const crownOuterRadius = 2.15;
  const crownFaceX = crownRearX + 0.85;
  const crown = new THREE.Group();
  crown.userData.role = 'crown-wheel-geared-like-26';
  const crownProfile = [
    new THREE.Vector2(0.12, crownRearX), new THREE.Vector2(crownOuterRadius, crownRearX),
    new THREE.Vector2(crownOuterRadius, crownFaceX), new THREE.Vector2(crownPitchRadius - 0.15, crownFaceX),
    new THREE.Vector2(crownPitchRadius - 0.15, crownRearX + 0.12), new THREE.Vector2(0.12, crownRearX + 0.12),
    new THREE.Vector2(0.12, crownRearX),
  ];
  const drumGeometry = new THREE.LatheGeometry(crownProfile.map((p) => new THREE.Vector2(p.x, p.y)), 96);
  drumGeometry.rotateZ(-Math.PI / 2);
  const drum = new THREE.Mesh(drumGeometry, crownMaterial);
  drum.userData.role = 'crown-wheel-drum';
  crown.add(drum);
  const addendum = gearModule, dedendum = gearModule * 1.25;
  const pitchLineX = crownFaceX + dedendum;
  const flankSlope = Math.tan(THREE.MathUtils.degToRad(20));
  // Crown teeth are thinned for backlash: the crown's rim is only locally
  // a straight rack for the involute pinion.
  const crownBacklash = 0.03;
  // Narrow radially: teeth away from the pitch point are tilted about the
  // arbor, so their radial edges drift from the ideal rack.
  const crownToothRadialWidth = 0.14;
  const halfPitchWidth = Math.PI * gearModule / 4 - crownBacklash / 2;
  const crownToothSolids = [];
  for (let index = 0; index < crownTeeth; index += 1) {
    const angle = Math.PI / 2 + index * FULL_TURN / crownTeeth;
    const geometry = parametricSolid(1, 1, (u, v, w) => {
      const height = v * (addendum + dedendum);
      const half = halfPitchWidth + (dedendum - height) * flankSlope;
      const tangent = (u * 2 - 1) * half;
      const radius = crownPitchRadius + (w - 0.5) * crownToothRadialWidth;
      return new THREE.Vector3(
        crownFaceX - 0.02 * (1 - v) + height,
        radius * Math.sin(angle) + tangent * Math.cos(angle),
        radius * Math.cos(angle) - tangent * Math.sin(angle),
      );
    });
    const tooth = new THREE.Mesh(geometry, crownMaterial);
    tooth.userData.role = 'crown-wheel-axial-tooth';
    tooth.userData.index = index;
    crown.add(tooth);
    crownToothSolids.push(tooth);
  }
  arbor.add(crown);
  root.add(arbor);

  // Balance C on its vertical staff with the pinion just below it.
  const staffX = pitchLineX + pinionRadius;
  const staff = new THREE.Group();
  staff.position.set(staffX, 0, 0);
  staff.userData.axis = Y_AXIS.clone();
  const staffTop = source(0, 96).y, staffBottom = source(0, 420).y;
  const staffRod = cylinder(0.1, staffTop - staffBottom, Y_AXIS, steel, 20);
  staffRod.position.y = (staffTop + staffBottom) / 2;
  staffRod.userData.role = 'vertical-balance-staff';
  const pinion = makeGear({ axis: Y_AXIS, color: PALETTE.accent, depth: 0.9, radius: pinionRadius, teeth: pinionTeeth, toothHeight: addendum + dedendum, addendum, dedendum });
  const pinionRotor = pinion.userData.rotor;
  for (const child of [...pinionRotor.children].slice(2)) {
    pinionRotor.remove(child);
    child.geometry.dispose();
  }
  pinion.position.y = crownPitchRadius - 0.1;
  pinion.userData.role = 'twelve-leaf-balance-pinion';
  const balanceY = source(0, 119).y;
  const balanceRadius = 7.3;
  const balance = new THREE.Group();
  balance.position.y = balanceY;
  // Brown draws a broad flat rim.
  const rimShape = new THREE.Shape().absarc(0, 0, balanceRadius, 0, FULL_TURN, false);
  rimShape.holes.push(new THREE.Path().absarc(0, 0, balanceRadius - 0.62, 0, FULL_TURN, true));
  const rimGeometry = new THREE.ExtrudeGeometry(rimShape, { bevelEnabled: false, curveSegments: 96, depth: 0.22 });
  rimGeometry.translate(0, 0, -0.11);
  const rim = new THREE.Mesh(rimGeometry, balanceMaterial);
  rim.rotation.x = Math.PI / 2;
  rim.userData.role = 'balance-C-rim';
  balance.add(rim);
  for (let index = 0; index < 3; index += 1) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(balanceRadius - 0.3, 0.12, 0.2), balanceMaterial);
    const angle = Math.PI / 2 + index * FULL_TURN / 3;
    spoke.position.set(Math.cos(angle) * (balanceRadius - 0.3) / 2, 0, -Math.sin(angle) * (balanceRadius - 0.3) / 2);
    spoke.rotation.y = angle;
    spoke.userData.role = 'balance-C-spoke';
    balance.add(spoke);
  }
  const balanceHub = cylinder(0.32, 0.36, Y_AXIS, steel);
  balanceHub.userData.role = 'balance-C-hub';
  balance.add(balanceHub);
  staff.add(staffRod, pinion, balance);
  root.add(staff);

  // Mesh phase: a crown tooth sits at the top at arbor angle zero, so a pinion
  // space must face the crown there.
  const pinionPhase = Math.PI / pinionTeeth;
  const update = (time) => {
    const state = stateAtTime(time);
    arbor.rotation.x = state.arborAngle;
    escapeRotor.rotation.z = state.wheelAngle;
    staff.rotation.y = state.balanceAngle;
    pinionRotor.rotation.z = pinionPhase;
    root.userData.kinematics = state;
  };

  root.userData.fidelity = 'authored';
  root.userData.archetype = movement.archetype;
  root.userData.hideGround = true;
  root.userData.blocks = { arbor, arborRod, balance, crown, crownToothSolids, drum, escapeRotor, escapeWheel, pallet1, pallet2, pinion, staff, staffRod, toothedWheel };
  root.userData.geometry = {
    arborAmplitude, catchAngle, crownPitchRadius, crownTeeth, dropAngles, escapeCenter: escapeCenter.clone(), gearModule, gearRatio,
    halfBeat, helixPitch, mechanismCyclePeriod: period, pallet1X, pallet2X, palletThickness, period, pinionRadius, pinionTeeth,
    pitch, pitchLineX, releaseAngle, rootRadius, staffX, tipRadius, toothCount, wheelThickness,
  };
  root.userData.animationTiming = { authoredCyclePeriod: period };
  root.userData.minimumDisplayCycleSeconds = 4;
  root.userData.contactTipAngle = tipAt;
  root.userData.palletX = (side, theta, phi) => palletX(side, side > 0 ? pallet2X : pallet1X, theta, phi);
  root.userData.times = times;
  root.userData.stateAtTime = stateAtTime;
  root.userData.sourceAnimation = {
    available: false,
    reason: 'The official Movement 298 page marks Animated unavailable and serves only the original engraving.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.reconstruction = {
    drawn: 'balance C, vertical staff and pinion, 26-style crown wheel on a horizontal arbor, two tilted loops on that arbor over a face-on saw-tooth wheel, arrow rising on the wheel’s right',
    inferred: 'the loops are opposite-handed helical pallets pushed by the top teeth and released by swinging out of the wheel plane; tooth counts 20/30/12, helix pitch, swing and drop schedule; each loop is a flat wire band whose working arc is the helical face and whose return over the arbor is shaped only to clear the teeth',
  };
  update(0);
  markShadows(root);
  return { root, update, cameraDirection: new THREE.Vector3(0.4, 3.4, 10) };
}

export function createAuthoredGearedBalanceVergeMovement(movement) {
  if (movement.id !== 298) return null;
  return gearedBalanceVergeEscapement(movement);
}
