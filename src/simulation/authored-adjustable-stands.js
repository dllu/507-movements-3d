import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

import {boredCylinderGeometry,fitPistonGuide} from './piston-guide-parts.js';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {plate,poly,polygonClipping,sector} from './finite-plate-geometry.js';
import {helicalThread,threadAngles} from './mujoco-screw/thread-geometry.js';
import {toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function cylinderAlongX(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
}

function roundedRectangle(width, height, radius, count = 16) {
  const points = [];
  const corners = [
    [width / 2 - radius, height / 2 - radius, 0],
    [-width / 2 + radius, height / 2 - radius, Math.PI / 2],
    [-width / 2 + radius, -height / 2 + radius, Math.PI],
    [width / 2 - radius, -height / 2 + radius, 1.5 * Math.PI],
  ];
  for (const [x, y, start] of corners) {
    for (let index = 0; index <= count; index += 1) {
      const angle = start + Math.PI / 2 * index / count;
      points.push([x + radius * Math.cos(angle), y + radius * Math.sin(angle)]);
    }
  }
  return poly(points);
}


// Collect triangles, each turned to face its reference direction, then
// crease the normals so curved faces shade smoothly and edges stay sharp.
function orientedSolid(triangles, creaseAngle = Math.PI / 5) {
  const positions = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const normal = new THREE.Vector3();
  for (const [p, q, r, reference] of triangles) {
    a.fromArray(p); b.fromArray(q); c.fromArray(r);
    normal.subVectors(b, a).cross(c.clone().sub(a));
    if (normal.lengthSq() < 1e-18) continue;
    const flip = normal.dot(reference) < 0;
    positions.push(...p, ...(flip ? r : q), ...(flip ? q : r));
  }
  const source = new THREE.BufferGeometry();
  source.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const geometry = toCreasedNormals(source, creaseAngle);
  source.dispose();
  return geometry;
}

// A straight bored band of the turned pillar, from low to high, with a
// round radial hole through its wall for the set screw. Its rim vertices
// sit at the same angles as a LatheGeometry of the same segment count, so
// it joins the turned pieces above and below ring to ring. The hole is
// centred on lathe column holeColumn, at half height.
function radiallyHoledBandGeometry({ outer, bore, low, high, holeRadius, holeColumn, segments = 64, span = 6, below = [], above = [] }) {
  const step = 2 * Math.PI / segments;
  const holeTheta = holeColumn * step;
  const holeY = (low + high) / 2;
  const rows = 2 * span;
  const ys = Array.from({ length: rows + 1 }, (_, j) => low + (high - low) * j / rows);
  const onCylinder = (radius, theta, y) => [radius * Math.sin(theta), y, radius * Math.cos(theta)];
  // Patch coordinates (u across, v up) on the cylinder around the hole.
  const fromPatch = (radius, u, v) => onCylinder(radius, holeTheta + Math.asin(u / radius), holeY + v);
  const radial = (point, sign) => new THREE.Vector3(point[0], 0, point[2]).multiplyScalar(sign);
  const triangles = [];
  for (const [radius, sign] of [[outer, 1], [bore, -1]]) {
    // Plain grid outside the patch.
    for (let k = span; k < segments - span; k += 1) {
      for (let j = 0; j < rows; j += 1) {
        const t0 = holeTheta + k * step, t1 = t0 + step;
        const p00 = onCylinder(radius, t0, ys[j]), p10 = onCylinder(radius, t1, ys[j]);
        const p01 = onCylinder(radius, t0, ys[j + 1]), p11 = onCylinder(radius, t1, ys[j + 1]);
        const reference = radial(onCylinder(radius, t0 + step / 2, 0), sign);
        triangles.push([p00, p10, p11, reference], [p00, p11, p01, reference]);
      }
    }
    // The patch: rings blended from the hole circle out to the patch's
    // square boundary, whose vertices are the grid's.
    const boundary = [];
    for (let k = -span; k < span; k += 1) boundary.push([radius * Math.sin(k * step), ys[0] - holeY]);
    for (let j = 0; j < rows; j += 1) boundary.push([radius * Math.sin(span * step), ys[j] - holeY]);
    for (let k = span; k > -span; k -= 1) boundary.push([radius * Math.sin(k * step), ys[rows] - holeY]);
    for (let j = rows; j > 0; j -= 1) boundary.push([radius * Math.sin(-span * step), ys[j] - holeY]);
    const rings = 6;
    const ringPoint = (i, ring) => {
      const [bu, bv] = boundary[i % boundary.length];
      // The hole circle's vertex angles are the same on both cylinders.
      const angle = Math.atan2(bv, bu * outer / radius);
      const t = ring / rings;
      return fromPatch(radius,
        THREE.MathUtils.lerp(holeRadius * Math.cos(angle), bu, t),
        THREE.MathUtils.lerp(holeRadius * Math.sin(angle), bv, t));
    };
    for (let i = 0; i < boundary.length; i += 1) {
      for (let ring = 0; ring < rings; ring += 1) {
        const p00 = ringPoint(i, ring), p10 = ringPoint(i + 1, ring);
        const p01 = ringPoint(i, ring + 1), p11 = ringPoint(i + 1, ring + 1);
        const reference = radial(onCylinder(radius, holeTheta, 0), sign);
        triangles.push([p00, p10, p11, reference], [p00, p11, p01, reference]);
      }
    }
    if (sign > 0) {
      // The hole's wall, from the outer surface in to the bore.
      const count = boundary.length;
      for (let i = 0; i < count; i += 1) {
        const [bu0, bv0] = boundary[i], [bu1, bv1] = boundary[(i + 1) % count];
        const angles = [Math.atan2(bv0, bu0), Math.atan2(bv1, bu1)];
        const [o0, o1, i0, i1] = [[outer, 0], [outer, 1], [bore, 0], [bore, 1]].map(([r, n]) => fromPatch(r,
          holeRadius * Math.cos(angles[n]), holeRadius * Math.sin(angles[n])));
        const axisPoint = new THREE.Vector3(...onCylinder(1, holeTheta, holeY)).setY(0)
          .multiplyScalar((outer + bore) / 2).setY(holeY);
        const reference = axisPoint.clone().sub(new THREE.Vector3(...o0));
        reference.sub(new THREE.Vector3(...onCylinder(1, holeTheta, 0)).multiplyScalar(
          reference.dot(new THREE.Vector3(...onCylinder(1, holeTheta, 0)))));
        triangles.push([o0, o1, i1, reference], [o0, i1, i0, reference]);
      }
    }
  }
  // The turned profiles below and above the band ({axial, radial}, rising;
  // below ends and above starts at the band's radius) are lathed on the
  // same columns, so the whole pillar is one solid with no inner faces.
  const lathe = (profile) => {
    for (let n = 0; n + 1 < profile.length; n += 1) {
      const a = profile[n], b = profile[n + 1];
      const dy = b.axial - a.axial, dr = b.radial - a.radial;
      for (let k = 0; k < segments; k += 1) {
        const t0 = k * step, t1 = t0 + step, mid = t0 + step / 2;
        const reference = new THREE.Vector3(dy * Math.sin(mid), -dr, dy * Math.cos(mid));
        triangles.push([onCylinder(a.radial, t0, a.axial), onCylinder(a.radial, t1, a.axial), onCylinder(b.radial, t1, b.axial), reference],
          [onCylinder(a.radial, t0, a.axial), onCylinder(b.radial, t1, b.axial), onCylinder(b.radial, t0, b.axial), reference]);
      }
    }
  };
  lathe([...below, { axial: low, radial: outer }]);
  lathe([{ axial: high, radial: outer }, ...above]);
  const bottom = below[0] ?? { axial: low, radial: outer };
  const top = above.at(-1) ?? { axial: high, radial: outer };
  // The bore runs on through the turned pieces.
  for (const [y0, y1] of [[bottom.axial, low], [high, top.axial]]) {
    if (y1 <= y0) continue;
    for (let k = 0; k < segments; k += 1) {
      const t0 = k * step, t1 = t0 + step, mid = t0 + step / 2;
      const reference = new THREE.Vector3(-Math.sin(mid), 0, -Math.cos(mid));
      triangles.push([onCylinder(bore, t0, y0), onCylinder(bore, t1, y0), onCylinder(bore, t1, y1), reference],
        [onCylinder(bore, t0, y0), onCylinder(bore, t1, y1), onCylinder(bore, t0, y1), reference]);
    }
  }
  // Annular rims at the very bottom and top.
  for (const [{ axial: y, radial }, sign] of [[bottom, -1], [top, 1]]) {
    for (let k = 0; k < segments; k += 1) {
      const t0 = k * step, t1 = t0 + step;
      const o0 = onCylinder(radial, t0, y), o1 = onCylinder(radial, t1, y);
      const i0 = onCylinder(bore, t0, y), i1 = onCylinder(bore, t1, y);
      const reference = new THREE.Vector3(0, sign, 0);
      triangles.push([o0, o1, i1, reference], [o0, i1, i0, reference]);
    }
  }
  const geometry = orientedSolid(triangles);
  geometry.userData = { boreRadius: bore, holeRadius, holeTheta, holeY, outer };
  return geometry;
}

// A moulded frame: a profile of (inset from the outer edge, height) swept
// round a rounded rectangle; each inset ring keeps the corner centres, so
// every ring has the same vertices and the mouldings run true round the
// corners. The profile is a closed loop.
function mouldedFrameGeometry(width, height, radius, profile, cornerCount = 16) {
  const ring = (inset, z) => {
    const points = [];
    const r = radius - inset;
    const corners = [
      [width / 2 - radius, height / 2 - radius, 0],
      [-width / 2 + radius, height / 2 - radius, Math.PI / 2],
      [-width / 2 + radius, -height / 2 + radius, Math.PI],
      [width / 2 - radius, -height / 2 + radius, 1.5 * Math.PI],
    ];
    for (const [x, y, start] of corners) {
      for (let index = 0; index <= cornerCount; index += 1) {
        const angle = start + Math.PI / 2 * index / cornerCount;
        points.push({ point: [x + r * Math.cos(angle), y + r * Math.sin(angle), z], outward: [Math.cos(angle), Math.sin(angle)] });
      }
    }
    return points;
  };
  const rings = profile.map(([inset, z]) => ring(inset, z));
  const triangles = [];
  const count = rings[0].length;
  // In the section plane (w = -inset outward, z) a counter-clockwise loop
  // has outward normal (dz, -dw) = (dZ, dInset).
  let area = 0;
  for (let n = 0; n < profile.length; n += 1) {
    const [s0, z0] = profile[n], [s1, z1] = profile[(n + 1) % profile.length];
    area += -s0 * z1 + s1 * z0;
  }
  const orientation = Math.sign(area);
  for (let n = 0; n < profile.length; n += 1) {
    const next = (n + 1) % profile.length;
    const dInset = profile[next][0] - profile[n][0], dZ = profile[next][1] - profile[n][1];
    for (let i = 0; i < count; i += 1) {
      const j = (i + 1) % count;
      const a = rings[n][i], b = rings[n][j], c = rings[next][j], d = rings[next][i];
      const [ox, oy] = a.outward;
      const reference = new THREE.Vector3(dZ * ox, dZ * oy, dInset).multiplyScalar(orientation);
      triangles.push([a.point, b.point, c.point, reference], [a.point, c.point, d.point, reference]);
    }
  }
  return orientedSolid(triangles, Math.PI / 4);
}

function adjustableMirrorStand(movement) {
  const root = new THREE.Group();

  const demonstrationPeriod = 6.0;
  const adjustmentAngularFrequency = FULL_TURN / demonstrationPeriod;
  const stemExtensionMean = 0.42;
  const stemExtensionAmplitude = 0.25;
  const stemBottomLocalY = -0.50;
  // Brown's hinge stands about 1.65 above the socket top at the plate pose.
  const stemTopLocalY = 1.86;
  const socketBottomY = -0.75;
  const socketTopY = 0.75;
  const yawAmplitude = THREE.MathUtils.degToRad(32);
  const tiltAmplitude = THREE.MathUtils.degToRad(18);
  const yawPhaseOffset = Math.PI / 2;
  const tiltFrequencyRatio = 2;
  // The cycle starts at full back tilt with the stem fully yawed, the pose
  // Brown engraves: the frame leans with its top edge rising to the right.
  const tiltPhaseOffset = -Math.PI / 2;
  // The frame stands far enough behind the hinge that its lower edge clears
  // the pillar, collar and set screw over the whole inclination range.
  // Brown's frame is about 1.2 base diameters wide and 1.35 high, and his
  // hinge is at about the middle of its back.
  const mirrorCenterLocal = new THREE.Vector3(0, 0.15, -1.10);
  const mirrorOuterWidth = 3.20;
  const mirrorOuterHeight = 3.60;
  // The glass fills the broad frame's rounded opening (0.30 border, let
  // 0.005 into the frame).
  const mirrorGlassWidth = mirrorOuterWidth - 2 * 0.295;
  const mirrorGlassHeight = mirrorOuterHeight - 2 * 0.295;
  const socketRadialClearance = 0.055;
  const stemRadius = 0.145;
  const socketBoreRadius = stemRadius + socketRadialClearance;

  const stateAtTime = (time) => {
    const adjustmentPhase = adjustmentAngularFrequency * time;
    const stemExtension = stemExtensionMean
      + stemExtensionAmplitude * Math.sin(adjustmentPhase);
    const stemVerticalSpeed = stemExtensionAmplitude
      * adjustmentAngularFrequency * Math.cos(adjustmentPhase);
    const stemVerticalAcceleration = -stemExtensionAmplitude
      * adjustmentAngularFrequency ** 2 * Math.sin(adjustmentPhase);
    const yawPhase = adjustmentPhase + yawPhaseOffset;
    const yawAngle = yawAmplitude * Math.sin(yawPhase);
    const yawAngularSpeed = yawAmplitude
      * adjustmentAngularFrequency * Math.cos(yawPhase);
    const yawAngularAcceleration = -yawAmplitude
      * adjustmentAngularFrequency ** 2 * Math.sin(yawPhase);
    const tiltPhase = tiltFrequencyRatio * adjustmentPhase
      + tiltPhaseOffset;
    const tiltAngle = tiltAmplitude * Math.sin(tiltPhase);
    const tiltAngularSpeed = tiltAmplitude * tiltFrequencyRatio
      * adjustmentAngularFrequency * Math.cos(tiltPhase);
    const tiltAngularAcceleration = -tiltAmplitude
      * (tiltFrequencyRatio * adjustmentAngularFrequency) ** 2
      * Math.sin(tiltPhase);
    const stemBottomY = stemExtension + stemBottomLocalY;
    const stemInsertionLength = socketTopY - stemBottomY;
    const hingeCenter = new THREE.Vector3(
      0,
      stemExtension + stemTopLocalY,
      0,
    );
    const yawQuaternion = new THREE.Quaternion().setFromAxisAngle(
      Y_AXIS,
      yawAngle,
    );
    const tiltQuaternion = new THREE.Quaternion().setFromAxisAngle(
      X_AXIS,
      tiltAngle,
    );
    const mirrorQuaternion = yawQuaternion.clone().multiply(
      tiltQuaternion,
    );
    const mirrorCenter = mirrorCenterLocal.clone()
      .applyQuaternion(mirrorQuaternion)
      .add(hingeCenter);
    const mirrorNormal = Z_AXIS.clone().applyQuaternion(
      mirrorQuaternion,
    );
    const hingeAxis = X_AXIS.clone().applyQuaternion(yawQuaternion);
    return {
      adjustmentPhase,
      hingeAxis,
      hingeCenter,
      mirrorCenter,
      mirrorNormal,
      mirrorQuaternion,
      stemBottomY,
      stemExtension,
      stemInsertionLength,
      stemVerticalAcceleration,
      stemVerticalSpeed,
      tiltAngle,
      tiltAngularAcceleration,
      tiltAngularSpeed,
      tiltPhase,
      yawAngle,
      yawAngularAcceleration,
      yawAngularSpeed,
      yawPhase,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.22,
    roughness: 0.57,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.46,
  });
  const stemMaterial = matte(PALETTE.driven, {
    metalness: 0.18,
    roughness: 0.52,
  });
  const mirrorFrameMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.58,
  });
  // Opaque silvered glass: a cool grey, highly metallic face.
  const glassMaterial = matte(0xc3ced2, {
    metalness: 0.78,
    roughness: 0.14,
  });
  const screwMaterial = matte(PALETTE.accent, {
    metalness: 0.24,
    roughness: 0.47,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const base = new THREE.Group();
  base.userData.fixed = true;
  base.userData.role = 'fixed-stepped-pedestal-and-socket-pillar';
  root.add(base);
  const baseTiers = [];
  // Brown's foot is a broad thin rim sweeping up in a concave flared cone
  // to the baluster's foot, not stepped discs: a rim disc, the flare and a
  // small fillet ring under the pillar.
  const flareBottomY = -1.335;
  const flareTopY = -1.075;
  const flareProfile = [new THREE.Vector2(0, flareBottomY)];
  for (let index = 0; index <= 32; index += 1) {
    const t = index / 32;
    flareProfile.push(new THREE.Vector2(
      0.44 + 0.80 * (1 - t) ** 1.7,
      flareBottomY + (flareTopY - flareBottomY) * t,
    ));
  }
  flareProfile.push(new THREE.Vector2(0, flareTopY));
  const tierGeometries = [
    new THREE.CylinderGeometry(1.27, 1.31, 0.06, 64)
      .translate(0, flareBottomY - 0.03, 0),
    new THREE.LatheGeometry(flareProfile, 64),
    new THREE.CylinderGeometry(0.45, 0.46, 0.06, 48)
      .translate(0, flareTopY + 0.03, 0),
  ];
  for (const geometry of tierGeometries) {
    const tier = new THREE.Mesh(geometry, frameMaterial);
    tier.userData.role = 'one-of-source-stepped-stand-base-tiers';
    baseTiers.push(tier);
    base.add(tier);
  }
  // Brown's pillar is a turned baluster: a foot, a swelling vase and a
  // slender neck, crowned by a round bead collar and a plain socket cap.
  // The set screw enters the neck just under the bead, as drawn: the neck
  // is a straight bored band with a round radial hole for the screw, joined
  // ring to ring to the turned vase below and the collar above.
  const latheSegments = 128;
  const neckRadius = 0.26;
  const neckLowY = 0.30;
  const neckHighY = 0.52;
  const turned = (points) => new THREE.SplineCurve(points.map(([axial, radial]) => new THREE.Vector2(axial, radial)))
    .getPoints(64).map(({ x, y }) => ({ axial: x, radial: y }));
  // The screw's hole is centred on lathe column 22 of 128; the screw yaw
  // follows it.
  const socketScrewColumn = 22;
  const socketScrewYaw = -(Math.PI / 2 - socketScrewColumn * 2 * Math.PI / latheSegments);
  const socketScrewY = (neckLowY + neckHighY) / 2;
  const pillar = new THREE.Mesh(
    radiallyHoledBandGeometry({
      outer: neckRadius, bore: socketBoreRadius, low: neckLowY, high: neckHighY,
      holeRadius: 0.082, holeColumn: socketScrewColumn, segments: latheSegments, span: 12,
      below: turned([
        [-1.015, .40], [-.93, .29], [-.78, .33], [-.52, .44],
        [-.24, .38], [.02, .30], [.18, .264], [.25, neckRadius], [neckLowY, neckRadius],
      ]).slice(0, -1),
      above: [
        ...turned([
          [neckHighY, neckRadius], [.528, .285], [.542, .335], [.562, .378], [.588, .407],
          [.618, .418], [.648, .407], [.670, .378], [.686, .338], [.698, .30],
        ]),
        { axial: socketTopY - .015, radial: .30 }, { axial: socketTopY, radial: .285 },
      ].slice(1),
    }),
    frameMaterial,
  );
  pillar.userData.boreRadius = socketBoreRadius;
  pillar.userData.role = 'fixed-turned-hollow-socket-pillar-with-tapped-neck-and-bead-collar';
  base.add(pillar);
  const socketBoreWitness = new THREE.Mesh(
    new THREE.TorusGeometry(socketBoreRadius, 0.025, 8, 40),
    darkMaterial,
  );
  socketBoreWitness.rotation.x = Math.PI / 2;
  socketBoreWitness.position.y = socketTopY + 0.035;
  socketBoreWitness.userData.role = 'visible-annular-stem-socket-bore';
  // Traced a drawn edge only: hidden reference, not a dark rim.
  socketBoreWitness.visible = false;
  socketBoreWitness.userData.retiredInkOutline = true;
  base.add(socketBoreWitness);

  const socketSetScrew = new THREE.Group();
  socketSetScrew.position.set(0, socketScrewY, 0);
  // Turned a little toward the front (still on Brown's right-hand side) so
  // the frame's lower edge swings well clear of the knob at mid-tilt.
  socketSetScrew.rotation.y = socketScrewYaw;
  socketSetScrew.userData.fixed = true;
  socketSetScrew.userData.lockedDegreesOfFreedom = [
    'stem vertical translation',
    'stem yaw rotation',
  ];
  socketSetScrew.userData.role =
    'source-side-set-screw-locking-stem-height-and-yaw';
  root.add(socketSetScrew);
  // The screw's point bears on the stem (0.001 short of it), which is what
  // locks the stem's height and yaw.
  const socketScrewTip = stemRadius + 0.001;
  const socketScrewCore = cylinderAlongX(
    0.075,
    0.91 - socketScrewTip,
    screwMaterial,
    22,
  );
  socketScrewCore.position.x = (0.91 + socketScrewTip) / 2;
  socketScrewCore.userData.role = 'socket-lock-screw-core';
  socketSetScrew.add(socketScrewCore);
  const socketScrewKnob = cylinderAlongX(
    0.18,
    0.12,
    screwMaterial,
    28,
  );
  socketScrewKnob.position.x = .97;
  const screwProfile={inner:.074,outer:.079,low:.20,high:.90,width:.025,lead:.05/(2*Math.PI),phase:0};
  const socketThread=new THREE.Mesh(helicalThread(screwProfile,threadAngles(screwProfile,40)).rotateY(Math.PI/2),screwMaterial);
  socketThread.userData.role='closed-socket-set-screw-thread';
  socketSetScrew.add(socketThread);
  socketScrewKnob.userData.role = 'socket-lock-screw-knob';
  socketSetScrew.add(socketScrewKnob);

  const stem = new THREE.Group();
  stem.userData.axis = Y_AXIS.clone();
  stem.userData.role =
    'sliding-and-yawing-inner-stem-released-by-socket-set-screw';
  root.add(stem);
  const stemCore = new THREE.Mesh(
    new THREE.CylinderGeometry(
      stemRadius,
      stemRadius,
      stemTopLocalY - .23 - stemBottomLocalY,
      30,
    ),
    stemMaterial,
  );
  stemCore.position.y = (stemTopLocalY - .23 + stemBottomLocalY) / 2;
  stemCore.userData.role = 'inner-stem-inside-pillar-socket';
  stem.add(stemCore);
  const stemHeightIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.018, 0.24, 0.018),
    whiteMaterial,
  );
  stemHeightIndex.position.set(stemRadius - .004, .85, 0);
  stemHeightIndex.userData.role = 'white-stem-height-and-yaw-index';
  stem.add(stemHeightIndex);

  const hingeYoke = new THREE.Group();
  hingeYoke.position.y = stemTopLocalY;
  hingeYoke.userData.role = 'stem-mounted-fixed-half-of-tilt-hinge';
  stem.add(hingeYoke);
  const yokeBridge = new THREE.Mesh(new THREE.BoxGeometry(.76,.12,.22),stemMaterial);
  yokeBridge.position.y=-.26;
  hingeYoke.add(yokeBridge);
  const hingeOuterBarrels = [];
  for (const x of [-0.31, 0.31]) {
    const barrel = cylinderAlongX(0.20, 0.28, stemMaterial, 28);
    barrel.geometry.dispose();
    barrel.geometry=boredCylinderGeometry(.20,.080,.28);
    barrel.position.x = x;
    barrel.userData.role = 'one-of-two-stem-side-hinge-barrels';
    hingeOuterBarrels.push(barrel);
    hingeYoke.add(barrel);
  }
  const hingeSetScrew = new THREE.Group();
  hingeSetScrew.position.x = 0;
  hingeSetScrew.userData.lockedDegreesOfFreedom = [
    'mirror inclination about horizontal hinge',
  ];
  hingeSetScrew.userData.role =
    'source-hinge-set-screw-locking-mirror-inclination';
  hingeYoke.add(hingeSetScrew);
  const hingeScrewCore = cylinderAlongX(
    0.072,
    1.30,
    screwMaterial,
    22,
  );
  hingeScrewCore.position.x = -.20;
  hingeScrewCore.userData.role = 'hinge-lock-screw-core';
  hingeSetScrew.add(hingeScrewCore);
  const hingeScrewKnob = cylinderAlongX(
    0.17,
    0.12,
    screwMaterial,
    28,
  );
  hingeScrewKnob.position.x = -.91;
  const hingeProfile={inner:.071,outer:.077,low:-.85,high:-.17,width:.025,lead:.05/(2*Math.PI),phase:0};
  const hingeThread=new THREE.Mesh(helicalThread(hingeProfile,threadAngles(hingeProfile,40)).rotateY(Math.PI/2),screwMaterial);
  hingeThread.userData.role='closed-hinge-lock-screw-thread';
  hingeSetScrew.add(hingeThread);
  hingeScrewKnob.userData.role = 'hinge-lock-screw-knob';
  hingeSetScrew.add(hingeScrewKnob);

  const mirrorTiltPivot = new THREE.Group();
  mirrorTiltPivot.userData.axis = X_AXIS.clone();
  mirrorTiltPivot.userData.role =
    'horizontal-hinge-pivot-varying-mirror-inclination';
  hingeYoke.add(mirrorTiltPivot);
  const centerHingeBarrel = cylinderAlongX(
    0.155,
    0.32,
    mirrorFrameMaterial,
    28,
  );
  centerHingeBarrel.geometry.dispose();
  centerHingeBarrel.geometry=boredCylinderGeometry(.155,.080,.32);
  // The hinge is on the back of the mirror (the glass faces away from the
  // stand). A short neck of the frame casting runs from the hinge barrel
  // to the central rib of the frame's back board; it stands the
  // frame off far enough that its lower edge swings clear of the socket
  // collar and screw.
  const mirrorBackPocketFloor = 0.0;
  const mirrorBackBossFront = 0.06;
  // The neck is sunk 0.01 into the back board's central rib.
  const mirrorBackNeckSeat = mirrorBackBossFront - 0.01;
  const mirrorBackBracket = new THREE.Mesh(
    new THREE.BoxGeometry(.30,.22,mirrorCenterLocal.z*-1-mirrorBackNeckSeat-.135),
    mirrorFrameMaterial,
  );
  mirrorBackBracket.position.z=(mirrorCenterLocal.z+mirrorBackNeckSeat-.135)/2;
  mirrorBackBracket.userData.role='mirror-back-neck-to-hinge-barrel';
  mirrorTiltPivot.add(mirrorBackBracket);
  centerHingeBarrel.userData.role =
    'mirror-side-center-hinge-barrel';
  mirrorTiltPivot.add(centerHingeBarrel);

  const mirrorAssembly = new THREE.Group();
  mirrorAssembly.position.copy(mirrorCenterLocal);
  mirrorAssembly.userData.role =
    'tilting-rectangular-framed-mirror-or-camera-platform';
  mirrorTiltPivot.add(mirrorAssembly);
  // Brown draws a broad rounded frame round the glass, its back moulded:
  // a rounded outer edge, a bold bead, a cove and a small inner bead down to
  // the back board. It is one solid swept round the rounded rectangle.
  const mirrorFrameBorder = 0.30;
  const mouldingProfile = new THREE.SplineCurve([
    [0, .02], [.012, .058], [.04, .078], [.07, .088], [.095, .122], [.12, .136],
    [.145, .122], [.168, .092], [.19, .080], [.215, .080], [.238, .094],
    [.255, .104], [.272, .096], [.286, .080], [mirrorFrameBorder, .072],
  ].map(([inset, z]) => new THREE.Vector2(inset, z))).getPoints(72).map(({ x, y }) => [x, y]);
  const mirrorFrame = new THREE.Mesh(
    mouldedFrameGeometry(mirrorOuterWidth, mirrorOuterHeight, 0.42, [
      [mirrorFrameBorder, -0.12], [0.02, -0.12], [0, -0.10], ...mouldingProfile,
    ]),
    mirrorFrameMaterial,
  );
  mirrorFrame.userData.role = 'broad-rounded-mirror-frame';
  mirrorAssembly.add(mirrorFrame);
  const mirrorFrameBars = [mirrorFrame];
  // Glass and back board are let 0.005 into the frame's inner wall, so no
  // faces coincide; their corners are the frame's inner corners.
  const openingInset = mirrorFrameBorder - 0.005;
  const openingOutline = roundedRectangle(mirrorOuterWidth - 2 * openingInset,
    mirrorOuterHeight - 2 * openingInset, 0.42 - openingInset);
  const mirrorGlass = new THREE.Mesh(plate(openingOutline, -0.10, -0.03), glassMaterial);
  mirrorGlass.userData.role = 'glass-or-camera-mounting-plane';
  mirrorAssembly.add(mirrorGlass);
  // The back board, as Brown draws it, has two long recessed panels either
  // side of a plain central rib that carries the hinge neck: symmetric about
  // the frame's vertical centre line.
  const mirrorBackBoard = new THREE.Mesh(
    plate(openingOutline, -0.03, mirrorBackPocketFloor),
    mirrorFrameMaterial,
  );
  mirrorBackBoard.userData.role = 'mirror-back-board-recessed-pocket-floor';
  mirrorAssembly.add(mirrorBackBoard);
  const backPanels = [-1, 1].map((side) => {
    // Brown's two long panels fill most of the back, either side of the hinge land.
    const inner = 0.25, outer = 1.00, bottom = -1.22, top = 1.22, r = 0.18;
    const [left, right] = side > 0 ? [inner, outer] : [-outer, -inner];
    return roundedRectangle(right - left, top - bottom, r).map((ring) => ring.map((loop) => loop.map(([x, y]) => [x + (left + right) / 2, y + (top + bottom) / 2])));
  });
  const mirrorBackLand = new THREE.Mesh(
    plate(polygonClipping.difference(openingOutline, ...backPanels), mirrorBackPocketFloor, mirrorBackBossFront),
    mirrorFrameMaterial,
  );
  mirrorBackLand.userData.role = 'mirror-back-board-with-two-symmetric-recessed-panels';
  mirrorBackLand.userData.panels = backPanels;
  mirrorAssembly.add(mirrorBackLand);
  const mirrorNormalIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.64, 0.055),
    whiteMaterial,
  );
  mirrorNormalIndex.position.set(0, 0.73, 0.075);
  mirrorNormalIndex.userData.role = 'white-mirror-orientation-index';
  mirrorAssembly.add(mirrorNormalIndex);

  const update = (time) => {
    const state = stateAtTime(time);
    stem.position.y = state.stemExtension;
    stem.rotation.y = state.yawAngle;
    mirrorTiltPivot.rotation.x = state.tiltAngle;
    root.userData.currentState = state;
    root.userData.constraintResiduals = {
      hingeHeight:
        stem.position.y + hingeYoke.position.y - state.hingeCenter.y,
      hingeX: state.hingeCenter.x,
      hingeZ: state.hingeCenter.z,
      socketRadial:
        Math.hypot(stem.position.x, stem.position.z),
    };
  };

  root.userData = {
    archetype: movement.archetype,
    blocks: {
      base,
      baseTiers,
      mirrorBackLand,
      socketThread,
      hingeThread,
      yokeBridge,
      mirrorBackBracket,
      centerHingeBarrel,
      hingeOuterBarrels,
      hingeScrewCore,
      hingeScrewKnob,
      hingeSetScrew,
      hingeYoke,
      mirrorAssembly,
      mirrorFrameBars,
      mirrorGlass,
      mirrorNormalIndex,
      mirrorTiltPivot,
      pillar,
      socketBoreWitness,
      socketScrewCore,
      socketScrewKnob,
      socketSetScrew,
      stem,
      stemCore,
      stemHeightIndex,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 3,
      inputs: [
        'stem translation along the vertical socket axis',
        'stem yaw rotation about that same vertical axis',
        'mirror inclination about the stem-top horizontal hinge',
      ],
      lockedDegreesOfFreedom: 0,
      note:
        'with both set screws tightened all three adjustments lock; the animation represents both screws loosened and uses rationally related smooth schedules only to display the full adjustment envelope',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'rigid pedestal, socket, stem, hinge, and framed mirror',
        'frictionless unlocked stem translation and yaw',
        'frictionless unlocked hinge inclination',
        'set screws represented as binary friction locks rather than threaded-force solvers',
        'smooth periodic adjustment schedules without gravity or operator-force dynamics',
      ],
      sourceSpecifiesDimensionsTimingRangesOrScrewPitch: false,
      treatment:
        'Brown explicitly supplies elevation, yaw, inclination, socket, stem, hinge, and both set-screw locks but no values; the three rigid transforms and insertion bounds are analytic while ranges and timing are engineered',
    },
    fidelity: 'authored',
    geometry: {
      adjustmentAngularFrequency,
      demonstrationPeriod,
      mirrorCenterLocal,
      mirrorGlassHeight,
      mirrorGlassWidth,
      mirrorOuterHeight,
      mirrorOuterWidth,
      socketBoreRadius,
      socketBottomY,
      socketRadialClearance,
      socketTopY,
      stemBottomLocalY,
      stemExtensionAmplitude,
      stemExtensionMean,
      stemRadius,
      stemTopLocalY,
      tiltAmplitude,
      tiltFrequencyRatio,
      tiltPhaseOffset,
      yawAmplitude,
      yawPhaseOffset,
    },
    locking: {
      hingeSetScrew:
        'tightening removes the one inclination degree of freedom at the horizontal hinge',
      releasedForDemonstration: true,
      socketSetScrew:
        'tightening removes both axial translation and yaw rotation of the stem in its socket',
      tightenedSystemDegreesOfFreedom: 0,
    },
    mechanism:
      'one-stem-slides-and-yaws-inside-one-pillar-socket-locked-by-one-side-set-screw-and-carries-one-framed-mirror-on-one-horizontal-inclination-hinge-locked-by-a-second-set-screw',
    officialDescription: movement.description,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      pageMarksAnimationUnavailable: true,
      sourcePrescribedTiming: false,
    },
    sourceReference: {
      brownPlate382: {
        baseLeft: new THREE.Vector2(144, 497),
        baseRight: new THREE.Vector2(373, 498),
        hingeCenter: new THREE.Vector2(260, 178),
        hingeSetScrewEnd: new THREE.Vector2(220, 179),
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 8,
        mirrorFrameBottom: new THREE.Vector2(236, 317),
        mirrorFrameLeft: new THREE.Vector2(132, 111),
        mirrorFrameRight: new THREE.Vector2(406, 257),
        mirrorFrameTop: new THREE.Vector2(286, 16),
        socketSetScrewEnd: new THREE.Vector2(323, 315),
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the stand supports mirrors or other articles',
          'the article can be raised or lowered',
          'the article can be turned right or left',
          'its inclination can be varied',
          'the stem fits a pillar socket and is secured by a set screw',
          'the glass is hinged to the stem and the hinge has a tightening set screw',
          'the same arrangement is used for photographic camera stands',
        ],
        engravingEvidence:
          'the plate shows a broad stepped base, hollow-shaped pillar, vertical inner stem, side socket screw, horizontal hinge barrel and screw, and a rounded rectangular framed glass',
        reconstructionDisclosure:
          'frame depth, glass material, 0.25-unit elevation range, 32-degree yaw, 18-degree tilt, phase relationship, colors, and six-second cycle are engineered because Brown gives no dimensions or timing and the official page has no canvas animation',
      },
      officialPage: 'https://507movements.com/mm_382.html',
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        publicationYear: 1908,
      },
    },
    stateAtTime,
    timeline: {
      demonstrationPeriod,
      note:
        'one elevation and yaw cycle plus two inclination cycles close every rigid transform smoothly in six authored seconds',
    },
    transmission: {
      hingeAxisLaw:
        'the horizontal hinge axis yaws rigidly with the stem, and mirror inclination is a pure rotation about that moving axis',
      mirrorTransformLaw:
        'world mirror transform equals stem vertical translation followed by stem yaw, hinge offset, and local hinge tilt',
      socketConstraint:
        'the cylindrical stem center remains exactly on the socket Y axis while retaining positive radial and axial insertion clearances',
    },
  };

  update(0);
  // Frame the whole adjustment envelope of the (larger) mirror.
  {
    const bounds = new THREE.Box3();
    for (let i = 0; i <= 96; i += 1) {
      update(demonstrationPeriod * i / 96);
      root.updateMatrixWorld(true);
      root.traverseVisible((o) => {
        if (!o.geometry) return;
        o.geometry.computeBoundingBox();
        bounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
      });
    }
    update(0);
    root.userData.cameraFitBounds = bounds.expandByScalar(0.04);
  }
  root.userData.groundFloorY = -1.42;
  // Brown's elevation is nearly level: the foot's rim reads as a line and
  // its flared cone in profile, so keep perspective from tipping it open.
  root.userData.cameraFov = 14;
  fitPistonGuide(root, update, demonstrationPeriod);
  markShadows(root);
  // The hinge bracket's shadow aliased into stair-stepped patches on the
  // glass and frame face; the mirror assembly takes no cast shadow.
  mirrorAssembly.traverse((object) => { object.receiveShadow = false; });
  return {
    cameraDirection: new THREE.Vector3(-1.6, 0.4, 10.2),
    root,
    update,
  };
}

export function createAuthoredAdjustableStandMovement(movement) {
  if (movement.id !== 382) return null;
  return adjustableMirrorStand(movement);
}
