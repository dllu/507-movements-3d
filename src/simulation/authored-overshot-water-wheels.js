import * as THREE from 'three';
import {ring,plate,poly,sector,polygonClipping} from './finite-plate-geometry.js';
import {wheelBearings} from './water-wheel-solids.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';
import {WaterSpray,WaterStream,ballisticPath,collectWaterStreams,guidedPath,joinPaths} from './water-stream.js';

const FULL_TURN = Math.PI * 2;

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function smoothStep5(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return THREE.MathUtils.clamp(
    clamped ** 3 * (clamped * (clamped * 6 - 15) + 10),
    0,
    1,
  );
}

function arcPoints(radius, startAngle, endAngle, z, count = 64) {
  return Array.from({ length: count + 1 }, (_, index) => {
    const angle = THREE.MathUtils.lerp(
      startAngle,
      endAngle,
      index / count,
    );
    return new THREE.Vector3(
      radius * Math.cos(angle),
      radius * Math.sin(angle),
      z,
    );
  });
}

function makeTube(points, radius, material, role) {
  const curve = new THREE.CatmullRomCurve3(
    points,
    false,
    'centripetal',
  );
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, points.length * 3, radius, 9, false),
    material,
  );
  tube.userData.role = role;
  return tube;
}


// Bucket partition (Brown's dotted bent boards): polar corners (radius,
// angle ahead of the partition's root), measured on the plate.
const PARTITION = [[2.02, 0], [2.33, 0.06], [2.62, 0.30]];
const PARTITION_HALF_THICKNESS = 0.03;
function partitionCenterline(rootAngle = 0) {
  return PARTITION.map(([r, a]) => new THREE.Vector2(r * Math.cos(rootAngle + a), r * Math.sin(rootAngle + a)));
}
// Offset a polyline sideways by `d` (left of travel positive), mitred.
function offsetPolyline(points, d) {
  return points.map((p, i) => {
    const prev = points[Math.max(0, i - 1)], next = points[Math.min(points.length - 1, i + 1)];
    const n0 = i > 0 ? new THREE.Vector2(-(p.y - prev.y), p.x - prev.x).normalize() : null;
    const n1 = i < points.length - 1 ? new THREE.Vector2(-(next.y - p.y), next.x - p.x).normalize() : null;
    if (!n0) return p.clone().addScaledVector(n1, d);
    if (!n1) return p.clone().addScaledVector(n0, d);
    const m = n0.clone().add(n1).normalize();
    return p.clone().addScaledVector(m, d / Math.max(0.3, m.dot(n0)));
  });
}
function bucketPartitionOutline() {
  const line = partitionCenterline(0);
  const left = offsetPolyline(line, PARTITION_HALF_THICKNESS);
  const right = offsetPolyline(line, -PARTITION_HALF_THICKNESS);
  // The root runs along the board's slant to the sole ring's face (r 2.02),
  // so the board stands on the ring without overlapping it.
  for (const face of [left, right]) {
    const d = face[1].clone().sub(face[0]).normalize();
    const pd = face[0].dot(d), c = face[0].lengthSq() - 2.02 * 2.02;
    face[0].addScaledVector(d, -(pd - Math.sqrt(Math.max(0, pd * pd - c))));
  }
  return [...right, ...left.reverse()].map(p => [p.x, p.y]);
}

// Water held in the pocket between two bent partitions, clipped by a level
// surface that never rises above the lower lip tip (the pocket's spill
// point). Reuses the mesh's buffers.
const CELL_CLEARANCE = 0.012;
function bentCellWaterGeometry() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 240), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(3 * 240), 3));
  return g;
}
function updateBentCellWater(mesh, {lowerRoot, upperRoot, fill, origin, width}) {
  const inset = PARTITION_HALF_THICKNESS + CELL_CLEARANCE;
  const upper = offsetPolyline(partitionCenterline(upperRoot), -inset);
  const lower = offsetPolyline(partitionCenterline(lowerRoot), inset);
  const sole = 2.02 + CELL_CLEARANCE;
  // Where each offset board face (its first, slanted run) meets the sole.
  const onSole = (line) => {
    const d = line[1].clone().sub(line[0]).normalize();
    const pd = line[0].dot(d), c = line[0].lengthSq() - sole * sole;
    return line[0].clone().addScaledVector(d, -pd + Math.sqrt(Math.max(0, pd * pd - c)));
  };
  lower[0] = onSole(lower);
  upper[0] = onSole(upper);
  const outline = [];
  const steps = 6;
  const a0 = Math.atan2(lower[0].y, lower[0].x);
  let a1 = Math.atan2(upper[0].y, upper[0].x);
  while (a1 < a0) a1 += Math.PI * 2;
  for (let i = 0; i <= steps; i += 1) {
    const a = a0 + (a1 - a0) * i / steps;
    outline.push(new THREE.Vector2(sole * Math.cos(a), sole * Math.sin(a)));
  }
  outline.push(upper[1], upper[2], lower[2], lower[1]);
  let minY = Infinity;
  for (const p of outline) minY = Math.min(minY, p.y);
  const spillY = Math.min(upper[2].y, lower[2].y);
  const level = minY + Math.max(0, Math.min(1, fill)) * Math.max(0, spillY - minY);
  const clipped = [];
  for (let i = 0; i < outline.length; i += 1) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    if (a.y <= level) clipped.push(a);
    if ((a.y < level && b.y > level) || (a.y > level && b.y < level)) {
      clipped.push(new THREE.Vector2(a.x + (b.x - a.x) * (level - a.y) / (b.y - a.y), level));
    }
  }
  const g = mesh.geometry, p = g.attributes.position;
  let count = 0;
  const vertex = (v, z) => { if (count < p.count) p.setXYZ(count++, v.x - origin.x, v.y - origin.y, z); };
  if (clipped.length >= 3 && level > minY + 1e-4) {
    // Counter-clockwise outline so the side walls wind outward.
    if (THREE.ShapeUtils.isClockWise(clipped)) clipped.reverse();
    const faces = THREE.ShapeUtils.triangulateShape(clipped, []);
    for (const face of faces) {
      const [i, j, k] = THREE.ShapeUtils.area(face.map(f => clipped[f])) >= 0 ? face : [face[0], face[2], face[1]];
      vertex(clipped[i], width / 2); vertex(clipped[j], width / 2); vertex(clipped[k], width / 2);
      vertex(clipped[i], -width / 2); vertex(clipped[k], -width / 2); vertex(clipped[j], -width / 2);
    }
    for (let i = 0; i < clipped.length; i += 1) {
      const a = clipped[i], b = clipped[(i + 1) % clipped.length];
      vertex(a, -width / 2); vertex(b, -width / 2); vertex(b, width / 2);
      vertex(a, -width / 2); vertex(b, width / 2); vertex(a, width / 2);
    }
  }
  // Park unused vertices on the water (or the pocket's lowest point) so the
  // body's bounds never reach back to its local origin.
  let rest = outline[0];
  for (const q of outline) if (q.y < rest.y) rest = q;
  const px = count ? p.getX(0) : rest.x - origin.x, py = count ? p.getY(0) : rest.y - origin.y, pz = count ? p.getZ(0) : 0;
  for (let i = count; i < p.count; i += 1) p.setXYZ(i, px, py, pz);
  p.needsUpdate = true; g.setDrawRange(0, count); g.computeVertexNormals(); g.computeBoundingSphere();
  mesh.visible = fill > .002; mesh.position.set(0, 0, 0); mesh.scale.set(1, 1, 1);
}

function overshotWaterWheel(movement) {
  const root = new THREE.Group();
  const cycleDuration = 6;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const wheelRadius = 2.72;
  const bucketCenterRadius = 2.35;
  const bucketRadialDepth = 0.74;
  const bucketAxialWidth = 1.02;
  const bucketCount = 12;
  const spokeCount = 6;
  const hubRadius = 0.43;
  const shaftRadius = 0.22;
  const inletAngle = THREE.MathUtils.degToRad(67);
  const fillTravelAngle = THREE.MathUtils.degToRad(16);
  // The bent buckets spill over their lower lips from just below the
  // horizontal (Brown's falling water at the right) and are empty by about
  // 48 degrees below it, as their pocket geometry dictates.
  const drainStartTravelAngle = THREE.MathUtils.degToRad(72);
  const drainEndTravelAngle = THREE.MathUtils.degToRad(115);
  const sourcePoseBucketOffset = inletAngle;
  const gravity = 9.81;
  const cyclePeriod = cycleDuration;

  const waterFillAtWorldAngle = (worldAngle) => {
    const clockwiseTravel = THREE.MathUtils.euclideanModulo(
      inletAngle - worldAngle,
      FULL_TURN,
    );
    if (clockwiseTravel < fillTravelAngle) {
      return smoothStep5(clockwiseTravel / fillTravelAngle);
    }
    if (clockwiseTravel < drainStartTravelAngle) return 1;
    if (clockwiseTravel < drainEndTravelAngle) {
      return 1 - smoothStep5(
        (clockwiseTravel - drainStartTravelAngle)
          / (drainEndTravelAngle - drainStartTravelAngle),
      );
    }
    return 0;
  };

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const wheelAngle = -inputAngle;
    const wheelAngularSpeed = -inputSpeed;
    const wheelAngularAcceleration = -inputAcceleration;
    const buckets = [];
    let retainedWaterMassNormalized = 0;
    let gravityTorqueNormalized = 0;
    let retainedWaterPotentialNormalized = 0;
    for (let bucketIndex = 0; bucketIndex < bucketCount;
      bucketIndex += 1) {
      const localAngle = sourcePoseBucketOffset
        + bucketIndex * FULL_TURN / bucketCount;
      const worldAngle = localAngle + wheelAngle;
      const radial = new THREE.Vector3(
        Math.cos(worldAngle),
        Math.sin(worldAngle),
        0,
      );
      const tangent = new THREE.Vector3(-radial.y, radial.x, 0);
      const center = radial.clone().multiplyScalar(bucketCenterRadius);
      const centerVelocity = tangent.clone().multiplyScalar(
        bucketCenterRadius * wheelAngularSpeed,
      );
      const centerAcceleration = tangent.clone().multiplyScalar(
        bucketCenterRadius * wheelAngularAcceleration,
      ).addScaledVector(
        radial,
        -bucketCenterRadius * wheelAngularSpeed ** 2,
      );
      const waterFill = waterFillAtWorldAngle(worldAngle);
      const gravityTorque = -waterFill * gravity * center.x;
      retainedWaterMassNormalized += waterFill;
      gravityTorqueNormalized += gravityTorque;
      retainedWaterPotentialNormalized += waterFill * gravity * center.y;
      buckets.push({
        center,
        centerAcceleration,
        centerVelocity,
        gravityTorque,
        index: bucketIndex,
        localAngle,
        radial,
        tangent,
        waterFill,
        waterSurfaceWorldAngle: 0,
        worldAngle,
      });
    }
    const rimReferenceRadial = new THREE.Vector3(
      Math.cos(wheelAngle),
      Math.sin(wheelAngle),
      0,
    );
    const rimReferenceTangent = new THREE.Vector3(
      -rimReferenceRadial.y,
      rimReferenceRadial.x,
      0,
    );
    const rimReferencePoint = rimReferenceRadial.clone()
      .multiplyScalar(wheelRadius);
    const rimReferenceVelocity = rimReferenceTangent.clone()
      .multiplyScalar(wheelRadius * wheelAngularSpeed);
    const rimReferenceAcceleration = rimReferenceTangent.clone()
      .multiplyScalar(wheelRadius * wheelAngularAcceleration)
      .addScaledVector(
        rimReferenceRadial,
        -wheelRadius * wheelAngularSpeed ** 2,
      );
    return {
      buckets,
      gravityTorqueNormalized,
      inputAcceleration,
      inputAngle,
      inputSpeed,
      retainedWaterMassNormalized,
      retainedWaterPotentialNormalized,
      rimReferenceAcceleration,
      rimReferencePoint,
      rimReferenceVelocity,
      wheelAngle,
      wheelAngularAcceleration,
      wheelAngularSpeed,
    };
  };

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    return {
      ...stateAtInputAngle(inputAngularSpeed * cycleTime),
      cycleTime,
      phase: cycleTime / cycleDuration,
    };
  };

  const geometry = {
    bucketAxialWidth,
    bucketCenterRadius,
    bucketCount,
    bucketRadialDepth,
    cycleDuration,
    drainEndTravelAngle,
    drainStartTravelAngle,
    fillTravelAngle,
    gravity,
    hubRadius,
    inletAngle,
    inputAngularSpeed,
    shaftRadius,
    sourcePoseBucketOffset,
    spokeCount,
    wheelRadius,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.22,
    roughness: 0.58,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.47,
  });
  const wheelMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.55,
  });
  const bucketMaterial = matte(PALETTE.brass, {
    metalness: 0.20,
    roughness: 0.48,
  });
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.74,
    roughness: 0.35,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const paleWaterMaterial = matte(0x70bfd0, {
    opacity: 0.46,
    roughness: 0.32,
    transparent: true,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const rotor = new THREE.Group();
  rotor.userData.role =
    'clockwise-overshot-water-wheel-rotor-with-retaining-buckets';
  root.add(rotor);
  for (const face of [-1, 1]) {
    const z = face * bucketAxialWidth / 2;
    const outerRim = new THREE.Mesh(
      new THREE.TorusGeometry(wheelRadius, 0.105, 10, 96),
      wheelMaterial,
    );
    outerRim.position.z = z;
    outerRim.userData.role = face < 0
      ? 'rear-outer-wheel-rim'
      : 'front-outer-wheel-rim';
    const innerRim = new THREE.Mesh(
      new THREE.TorusGeometry(1.91, 0.075, 9, 96),
      wheelMaterial,
    );
    innerRim.position.z = z;
    innerRim.userData.role = face < 0
      ? 'rear-inner-wheel-rim'
      : 'front-inner-wheel-rim';
    rotor.add(outerRim, innerRim);
  }

  const innerDrum=new THREE.Mesh(ring(1.91,2.02,-.51,.51,256),wheelMaterial);innerDrum.userData.role='closed-inner-bucket-drum';rotor.add(innerDrum);
  const bucketCheeks=[];
  for(const side of[-1,1]){const material=wheelMaterial.clone();if(side>0){material.transparent=true;material.opacity=.24;material.depthWrite=false;}const cheek=new THREE.Mesh(ring(1.91,2.77,side<0?-.59:.51,side<0?-.51:.59,256),material);cheek.userData.role='bucket-side-cheek';rotor.add(cheek);bucketCheeks.push(cheek);}
  const hub = cylinderAlongZ(hubRadius, 1.26, wheelMaterial, 40);
  hub.position.z = 0;
  hub.userData.role = 'water-wheel-hub-fast-on-main-shaft';
  rotor.add(hub);
  for (let spokeIndex = 0; spokeIndex < spokeCount; spokeIndex += 1) {
    const angle = spokeIndex * FULL_TURN / spokeCount;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(1.96, 0.15, 0.26),
      wheelMaterial,
    );
    spoke.position.set(
      0.98 * Math.cos(angle),
      0.98 * Math.sin(angle),
      0,
    );
    spoke.rotation.z = angle;
    spoke.userData.role = `wheel-spoke-${spokeIndex + 1}-of-six`;
    rotor.add(spoke);
  }

  const bucketParts = [];
  for (let bucketIndex = 0; bucketIndex < bucketCount;
    bucketIndex += 1) {
    const localAngle = sourcePoseBucketOffset
      + bucketIndex * FULL_TURN / bucketCount;
    const bucket = new THREE.Group();
    bucket.position.set(
      bucketCenterRadius * Math.cos(localAngle),
      bucketCenterRadius * Math.sin(localAngle),
      0,
    );
    bucket.rotation.z = localAngle;
    bucket.userData.role =
      `overshot-retaining-bucket-${bucketIndex + 1}-of-twelve`;
    // Brown's buckets are bent boards: a short start rising from the sole
    // at a slant, then a long lip bent back toward the following bucket so
    // the pocket holds its water down the descending side.
    const divider = new THREE.Mesh(
      plate(poly(bucketPartitionOutline()), -bucketAxialWidth / 2, bucketAxialWidth / 2),
      bucketMaterial,
    );
    divider.geometry.translate(-bucketCenterRadius, 0, 0);
    divider.userData.role =
      `bent-slanted-partition-of-bucket-${bucketIndex + 1}`;
    bucket.add(divider);
    const hookedLip = null;
    rotor.add(bucket);

    const waterLoad = new THREE.Group();
    waterLoad.position.set(
      bucketCenterRadius * Math.cos(localAngle),
      bucketCenterRadius * Math.sin(localAngle),
      0,
    );
    waterLoad.userData.role =
      `gravity-level-water-load-in-bucket-${bucketIndex + 1}`;
    const waterBody = new THREE.Mesh(
      bentCellWaterGeometry(),
      waterMaterial,
    );
    waterBody.position.z = 0.02;
    waterBody.userData.role =
      `retained-water-body-${bucketIndex + 1}`;
    waterLoad.add(waterBody);
    rotor.add(waterLoad);
    bucketParts.push({
      bucket,
      divider,
      hookedLip,
      waterBody,
      waterLoad,
    });
  }
  const rotationMarker = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.09, 0.10),
    whiteMaterial,
  );
  rotationMarker.position.set(0.27, 0, 0.68);
  rotationMarker.userData.role = 'visible-clockwise-wheel-rotation-marker';
  rotationMarker.visible = false; // Brown draws no index on the wheel.
  rotor.add(rotationMarker);

  const shaft = cylinderAlongZ(shaftRadius, 1.70, darkMaterial, 36);
  shaft.position.z = 0;
  shaft.userData.role = 'main-water-wheel-shaft-in-fixed-bearings';
  root.add(shaft);
  const bearingParts=wheelBearings(root,shaft,frameMaterial,-3.85);
  // Pass 56: Brown's elevation is a section through the pit, so the near
  // side is cut away: the wheel's shaft ends at the hub in front and runs
  // back to the one far bearing on its pedestal and footing behind the race.
  for (const key of ['bearings', 'bearingPedestals']) {
    bearingParts[key] = bearingParts[key].filter((part) => {
      if (part.position.z < 0) return true;
      part.removeFromParent();part.geometry.dispose();return false;
    });
  }
  shaft.geometry.dispose();shaft.geometry=new THREE.CylinderGeometry(shaftRadius,shaftRadius,1.75,64);shaft.position.z=-0.225;
  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(1.00, 0.30, 0.60),
    frameMaterial,
  );
  foundation.position.set(0, -4.00, -0.94);
  foundation.userData.role = 'fixed-overshot-wheel-foundation';
  root.add(foundation);

  // Brown's headrace ends just right of the wheel's crown.
  const flumeLength = 4.575;
  const flume = new THREE.Mesh(
    new THREE.BoxGeometry(flumeLength, 0.22, 1.40),
    frameMaterial,
  );
  flume.position.set(-4.275 + flumeLength / 2, 3.43, -0.18);
  flume.rotation.z = -0.045;
  flume.userData.role = 'fixed-top-feed-headrace-flume';
  root.add(flume);
  const flumeWater = new THREE.Mesh(
    new THREE.BoxGeometry(flumeLength - 0.3, 0.12, 1.02),
    paleWaterMaterial,
  );
  flumeWater.position.set(flume.position.x - 0.05, 3.54, 0.04);
  flumeWater.rotation.z = -0.045;
  flumeWater.userData.role = 'water-flowing-along-top-headrace';
  // The continuous feed stream below carries the headrace water now.
  flumeWater.visible = false;
  root.add(flumeWater);

  // Pass 69: the feed is ONE continuous swept body (water-stream.js): it runs
  // along the headrace, leaves its end with the channel speed and falls on a
  // projectile path into the bucket mouths just past the crown. The channel
  // speed is the one whose parabola lands at the filling position.
  flume.updateMatrix();
  const flumePoint = (x) => new THREE.Vector3(x, 0.11 + 0.055, 0).applyMatrix4(flume.matrix).setZ(0);
  const headStart = flumePoint(-flumeLength / 2 + 0.3);
  const lip = flumePoint(flumeLength / 2);
  const flumeDirection = lip.clone().sub(headStart).normalize();
  const mouthRadius = 2.62;
  const feedLanding = (speed) => ballisticPath({
    origin: lip, velocity: flumeDirection.clone().multiplyScalar(speed),
    stop: (point) => Math.hypot(point.x, point.y) <= mouthRadius, samples: 24,
  });
  const targetAngle = inletAngle - fillTravelAngle / 3;
  let lowSpeed = 0.05, highSpeed = 6;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lowSpeed + highSpeed) / 2;
    const end = feedLanding(mid).points.at(-1);
    if (Math.atan2(end.y, end.x) > targetAngle) lowSpeed = mid; else highSpeed = mid;
  }
  const feedSpeed = (lowSpeed + highSpeed) / 2;
  const feedWater = new WaterStream(joinPaths(
    guidedPath([headStart, lip], {speed: feedSpeed, samples: 16}),
    feedLanding(feedSpeed),
  ), {
    width: 0.42, thickness: 0.055, widthAxis: new THREE.Vector3(0, 0, 1), widthExponent: 0.15,
    foam: {start: 0.93, amount: 0.5}, cyclePeriod, streakRate: 0.9, opacity: 0.5,
  });
  feedWater.userData.role = 'continuous-top-fed-water-stream-onto-wheel';
  root.add(feedWater);
  const feedEnd = feedWater.path.points.at(-1);
  const feedSplash = new WaterSpray({
    origin: feedEnd, velocity: new THREE.Vector3(0.5, 0.9, 0), spread: 0.5, count: 16,
    lifetime: 0.3, radius: 0.03, cyclePeriod, seed: 430, originSpread: new THREE.Vector3(0, 0, 0.35),
  });
  feedSplash.userData.role = 'splash-where-feed-enters-buckets';
  root.add(feedSplash);
  // The buckets spill over their lower lips once past the horizontal; the
  // spilled water leaves the wheel's edge with the rim's downward speed and
  // falls as a curtain to the tail floor, whitening where it lands.
  const rimSpeed = inputAngularSpeed * wheelRadius;
  const spillAngle = THREE.MathUtils.degToRad(-8);
  const curtainTop = new THREE.Vector3(Math.cos(spillAngle), Math.sin(spillAngle), 0)
    .multiplyScalar(wheelRadius + 0.16);
  const tailFloorY = -3.07;
  const dischargeWater = new WaterStream(ballisticPath({
    origin: curtainTop,
    velocity: new THREE.Vector3(Math.sin(spillAngle), -Math.cos(spillAngle), 0).multiplyScalar(rimSpeed * 0.55),
    endY: tailFloorY + 0.03, samples: 28,
  }), {
    width: 0.44, thickness: 0.07, widthAxis: new THREE.Vector3(0, 0, 1), widthExponent: 0.1,
    spread: {start: 0.1, width: 1.05, thickness: 3.6}, fadeIn: 0.12, foam: {start: 0.8, amount: 0.55},
    cyclePeriod, streakRate: 1.4, opacity: 0.42,
  });
  dischargeWater.userData.role = 'water-spilled-from-descending-buckets-falling-to-tail-floor';
  root.add(dischargeWater);
  const tailSplash = new WaterSpray({
    origin: dischargeWater.path.points.at(-1).clone().setY(tailFloorY + 0.02),
    velocity: new THREE.Vector3(0.2, 1.3, 0), spread: 0.8, count: 28, lifetime: 0.42, radius: 0.04,
    cyclePeriod, seed: 431, originSpread: new THREE.Vector3(0.15, 0, 0.4),
  });
  tailSplash.userData.role = 'splash-of-spilled-water-on-tail-floor';
  root.add(tailSplash);
  const updateWater = collectWaterStreams(root);
  const feedPathPoints = feedWater.path.points;
  const feedCurve = new THREE.CatmullRomCurve3(feedPathPoints.filter((_, i) => i % 4 === 0), false, 'centripetal');
  const droplets = [];
  for (let dropletIndex = 0; dropletIndex < 7; dropletIndex += 1) {
    const droplet = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 18, 12),
      paleWaterMaterial,
    );
    droplet.userData.role = `falling-feed-water-droplet-${dropletIndex + 1}`;
    root.add(droplet);
    droplets.push(droplet);
  }

  const tailrace = makeTube(
    [
      new THREE.Vector3(0.25, -3.03, 0.08),
      new THREE.Vector3(1.35, -3.18, 0.08),
      new THREE.Vector3(2.70, -3.31, 0.08),
      new THREE.Vector3(4.05, -3.30, 0.08),
    ],
    0.19,
    waterMaterial,
    'bottom-tailrace-carrying-discharged-water-away',
  );
  // The plate shows the spent water falling on the pit floor, not a pipe.
  tailrace.visible = false;
  root.add(tailrace);
  const masonryRace = makeTube(
    arcPoints(3.18, THREE.MathUtils.degToRad(188),
      THREE.MathUtils.degToRad(342), -0.56, 80),
    0.16,
    frameMaterial,
    'fixed-curved-masonry-wheel-race',
  );
  // Brown's wheel pit: a hatched masonry breast falling straight from the
  // headrace, curving close round the lower left of the wheel and running
  // out as the tail floor to the right.
  {
    const inner = 3.07, outer = 3.67, top = 3.32, floorEnd = 3.9;
    const arc = (radius, from, to, count = 96) => Array.from({length: count + 1},
      (_, i) => { const a = from + (to - from) * i / count; return [radius * Math.cos(a), radius * Math.sin(a)]; });
    const outline = [[-inner, top], ...arc(inner, Math.PI, 1.5 * Math.PI), [floorEnd, -inner],
      [floorEnd, -outer], ...arc(outer, 1.5 * Math.PI, Math.PI), [-outer, top]];
    masonryRace.geometry.dispose();
    masonryRace.geometry = plate(poly(outline), -0.75, 0.75);
  }
  root.add(masonryRace);

  const update = (time) => {
    const state = stateAtTime(time);
    rotor.rotation.z = state.wheelAngle;
    updateWater(time);
    for (let bucketIndex = 0; bucketIndex < bucketCount;
      bucketIndex += 1) {
      const bucketState = state.buckets[bucketIndex];
      const parts = bucketParts[bucketIndex];
      parts.waterLoad.rotation.z = -state.wheelAngle;
      updateBentCellWater(parts.waterBody, {lowerRoot: bucketState.worldAngle - FULL_TURN / bucketCount,
        upperRoot: bucketState.worldAngle, fill: bucketState.waterFill, origin: bucketState.center, width: .96});
    }
    const flowPhase = THREE.MathUtils.euclideanModulo(
      time / 0.82,
      1,
    );
    for (let dropletIndex = 0; dropletIndex < droplets.length;
      dropletIndex += 1) {
      const progress = THREE.MathUtils.euclideanModulo(
        flowPhase + dropletIndex / droplets.length,
        1,
      );
      droplets[dropletIndex].position.copy(feedCurve.getPoint(progress));
      const endFade = Math.min(progress / 0.08, (1 - progress) / 0.08, 1);
      droplets[dropletIndex].scale.setScalar(0.45 + 0.55 * endFade);
    }
  };

  const sourceState = stateAtInputAngle(0);
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 6,
    },
    archetype:
      'overshot-water-wheel-with-top-fed-retaining-buckets-weighting-clockwise-descending-side',
    blocks: {
      innerDrum,
      bucketCheeks,
      ...bearingParts,
      bucketGroups: bucketParts.map(({ bucket }) => bucket),
      bucketWaterBodies: bucketParts.map(({ waterBody }) => waterBody),
      bucketWaterLoads: bucketParts.map(({ waterLoad }) => waterLoad),
      dischargeWater,
      feedSplash,
      feedWater,
      tailSplash,
      flume,
      flumeWater,
      foundation,
      hub,
      masonryRace,
      rotationMarker,
      rotor,
      shaft,
      tailrace,
    },
    degreesOfFreedom: {
      bucketWaterFillIndependent: false,
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      wheelRotationIndependent: true,
    },
    dynamics: {
      bucketFillModel:
        'Each wheel-fixed bucket receives a smooth fill ramp beneath the stationary top flume, retains its load down the descending side, and drains smoothly near the bottom. Water surfaces remain horizontal in world space.',
      fluidPressureViscositySplashLeakageImpactBearingFrictionWheelInertiaGeneratorLoadAndSpeedResponseModeled:
        false,
      gravityTorqueDiagnostic:
        'The displayed normalized torque is the exact moment of each prescribed bucket water weight about the shaft; wheel speed remains prescribed rather than dynamically integrated.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'A fixed elevated headrace delivers water over the crown into retaining buckets fixed around the wheel rim. The filled buckets remain on the right-hand descending side, so their weight produces clockwise torque about the shaft. Each load drains before rising on the left, and the discharged water leaves through the bottom tailrace. All buckets, rims, spokes, hub, and the visible rotation marker are one rigid rotor; only the water surfaces counter-rotate locally to remain level under gravity.',
    motion: {
      bucketPitch: FULL_TURN / bucketCount,
      cycleDuration,
      inputAngularSpeed,
      wheelDirection: 'clockwise',
      wheelRevolutionsPerCycle: 1,
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 430 page provides Brown’s single static engraving and two-word caption but contains no Canvas construction or source timing.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      buckets: sourceState.buckets.map((bucket) => ({
        center: bucket.center.clone(),
        waterFill: bucket.waterFill,
        worldAngle: bucket.worldAngle,
      })),
      gravityTorqueNormalized: sourceState.gravityTorqueNormalized,
      wheelAngle: sourceState.wheelAngle,
    },
    sourceReference: {
      brownPlate430: {
        approximateBucketCount: 12,
        approximateOuterWheelRadiusPixels: 166,
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 15,
        shaftApproximateCenterPixels: [315, 293],
        topFlumeOutletApproximatePixels: [357, 119],
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the mechanism is an overshot water-wheel',
        ],
        engravingEvidence:
          'Brown’s engraving shows an elevated left-to-right headrace discharging above the wheel, bucket pockets around the rim, six spokes, a clockwise/downward arrow on the right, retained water on the descending side, a close masonry race, and bottom discharge.',
        reconstructionDisclosure:
          'Brown gives no dimensions, bucket count, bucket profile, width, flow rate, head, speed, materials, efficiency, losses, bearing friction, wheel inertia, or load. Twelve equal buckets, dimensions, smooth fill/hold/drain schedule, water amount, colors, axial construction, and six-second demonstration cycle are independently engineered; the overshot topology, top feed, gravity-loaded descending side, clockwise direction, six visible spokes, and bottom tailrace are source-grounded.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 430',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      bucketAttachment:
        'bucketWorldAngle=bucketLocalAngle+wheelAngle',
      gravityTorque:
        'tau_z=sum(-waterFill*g*bucketCenter.x)',
      waterLevelConstraint:
        'waterLoadWorldAngle=wheelAngle+waterLoadLocalAngle=0',
    },
    update,
    waterFillAtWorldAngle,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.30, -4.16, -1.08),
    new THREE.Vector3(4.30, 3.72, 1.48),
  );
  root.userData.cameraDistanceScale = 1.03;
  root.userData.cameraDirection = new THREE.Vector3(5.1, 3.8, 12.0);
  root.userData.groundFloorY = -4.16;
  root.userData.hideGround=true;
  root.userData.solidReview={qualification:'Finite supports and water-path geometry; water is a prescribed visual envelope. No free-surface flow, sealing, energy balance or speed response is solved.'};
  root.traverse(object=>{for(const material of object.material?[].concat(object.material):[])material.fog=false;});
  root.userData.minimumDisplayCycleSeconds = cycleDuration;
  markShadows(root);
  foundation.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredOvershotWaterWheelMovement(movement) {
  if (movement.id !== 430) return null;
  return overshotWaterWheel(movement);
}
