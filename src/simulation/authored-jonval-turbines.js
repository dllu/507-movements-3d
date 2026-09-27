import * as THREE from 'three';
import {applyCutawayFor} from './cutaway-presentations.js';
import {horizontalRing,horizontalPlate,horizontalVane,horizontalTurned} from './horizontal-turbine-solids.js';
import {poly,circle,polygonClipping,rotate,plate} from './finite-plate-geometry.js';
import {mergePassageParts,curvedPipeWall} from './finite-fluid-passages.js';
import {latheSectionGeometry} from './cutaway-section.js';
import {waterVolumeMaterial} from './water-volume.js';
import {WaterStream,collectWaterStreams,guidedPath} from './water-stream.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function horizontalRadial(angle) {
  return new THREE.Vector3(Math.cos(angle), 0, -Math.sin(angle));
}

function horizontalTangent(angle) {
  return new THREE.Vector3(-Math.sin(angle), 0, -Math.cos(angle));
}

function cylindricalPoint(radius, angle, height) {
  return horizontalRadial(angle).multiplyScalar(radius)
    .add(new THREE.Vector3(0, height, 0));
}

function makeTube(curve, radius, material, role) {
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 72, radius, 9, false),
    material,
  );
  tube.userData.role = role;
  return tube;
}

function horizontalBoxBetween(start, end, height, thickness, material) {
  const direction = end.clone().sub(start);
  const length = Math.hypot(direction.x, direction.z);
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(length, height, thickness),
    material,
  );
  box.position.copy(start).add(end).multiplyScalar(0.5);
  box.rotation.y = Math.atan2(-direction.z, direction.x);
  return box;
}


// A helical (screw-like) vane between two radii and heights: at depth
// fraction d (0 top, 1 foot) every radial line of the vane is turned by
// sweep(d) about y; planOffset(r) (length, along -z at angle 0) leans the
// line at a slight tangent. Constant tangential thickness. Local frame: the
// vane's root line lies along +x.
function helicalVaneGeometry({inner, outer, top, bottom, sweep, thickness, planOffset = () => 0, radialSteps = 8, depthSteps = 16}) {
  const positions = [], indices = [];
  const point = (r, d, side) => {
    const theta = sweep(d) - planOffset(r) / r + side * thickness / (2 * r);
    return [r * Math.cos(theta), top + (bottom - top) * d, -r * Math.sin(theta)];
  };
  const grid = (rows, cols, at, expected) => {
    const base = positions.length / 3;
    for (let i = 0; i <= rows; i += 1) for (let j = 0; j <= cols; j += 1) positions.push(...at(i / rows, j / cols));
    const quads = [];
    for (let i = 0; i < rows; i += 1) for (let j = 0; j < cols; j += 1) {
      const a = base + i * (cols + 1) + j, b = a + cols + 1;
      quads.push([a, b, a + 1], [b, b + 1, a + 1]);
    }
    const [a, b, c] = quads[0].map(k => new THREE.Vector3().fromArray(positions, k * 3));
    const normal = b.clone().sub(a).cross(c.clone().sub(a));
    const flip = normal.dot(expected(a)) < 0;
    for (const [x, y, z] of quads) indices.push(...(flip ? [x, z, y] : [x, y, z]));
  };
  const lerpR = u => inner + (outer - inner) * u;
  const tangentAt = (p, side) => new THREE.Vector3(p.z, 0, -p.x).normalize().multiplyScalar(-side);
  for (const side of [-1, 1]) grid(radialSteps, depthSteps, (u, d) => point(lerpR(u), d, side), p => tangentAt(p, -side));
  for (const [r, sign] of [[inner, -1], [outer, 1]]) grid(1, depthSteps, (u, d) => point(r, d, 2 * u - 1), p => new THREE.Vector3(p.x, 0, p.z).multiplyScalar(sign));
  for (const [d, sign] of [[0, 1], [1, -1]]) grid(1, radialSteps, (u, v) => point(lerpR(v), d, 2 * u - 1), () => new THREE.Vector3(0, sign, 0));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function jonvalTurbine(movement) {
  const root = new THREE.Group();
  const cycleDuration = 5.7;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  // Brown's section shows about eight shutes and fourteen buckets across the
  // near half of the drum.
  const fixedShuteCount = 16;
  const runnerBucketCount = 28;
  const runnerBucketPitch = FULL_TURN / runnerBucketCount;
  const annulusInnerRadius = 0.72;
  const annulusOuterRadius = 2.48;
  const runnerBucketCenterRadius =
    (annulusInnerRadius + annulusOuterRadius) / 2;
  const guideRowCenterY = 0.43;
  const runnerRowCenterY = -0.43;
  const rowHeight = 0.68;
  const guidePitchAngle = THREE.MathUtils.degToRad(24);
  const runnerTangentAngle = THREE.MathUtils.degToRad(10);
  // Helical (screw-like) vane surfaces: every radial line of a vane turns
  // by the same angle as it descends, following a parabola in depth.
  // Brown's shutes a run straight down and bend toward +theta (right on the
  // near face) at their foot; the buckets c take the water nearly axially
  // and bend it back the other way.
  const guideHelixSweep = 0.34;
  const runnerHelixSweep = 0.30;
  const vaneThickness = 0.07;
  const sourcePoseBucketOffset = 0;
  const shaftRadius = 0.20;
  const massFlowNormalized = 1;
  const guideExitAxialSpeed = 3.62;
  const guideExitWhirlSpeed = 2.42;
  const runnerDischargeAxialSpeed = 4.28;
  const runnerDischargeWhirlSpeed = 0.20;

  const runnerSweepOffsetAtProgress = (progress) => {
    const clamped = THREE.MathUtils.clamp(progress, 0, 1);
    const radialTravel = annulusOuterRadius - annulusInnerRadius;
    return -Math.tan(runnerTangentAngle) * radialTravel * clamped;
  };
  // Vane turn (radians about y) at depth fraction 0 (top) .. 1 (foot).
  const guideSweepAtDepth = (depth) => guideHelixSweep * THREE.MathUtils.clamp(depth, 0, 1) ** 2;
  const runnerSweepAtDepth = (depth) => -runnerHelixSweep * THREE.MathUtils.clamp(depth, 0, 1) ** 2;

  const guideExitPoint = horizontalRadial(0)
    .multiplyScalar(runnerBucketCenterRadius);
  guideExitPoint.y = 0;
  const guideExitVelocity = new THREE.Vector3(0, -guideExitAxialSpeed, 0)
    .addScaledVector(
      horizontalTangent(0),
      guideExitWhirlSpeed,
    );
  const runnerDischargePoint = horizontalRadial(0)
    .multiplyScalar(runnerBucketCenterRadius);
  runnerDischargePoint.y = -0.86;
  const runnerDischargeVelocity = new THREE.Vector3(
    0,
    -runnerDischargeAxialSpeed,
    0,
  ).addScaledVector(
    horizontalTangent(0),
    runnerDischargeWhirlSpeed,
  );
  const inletSpecificAngularMomentumY = new THREE.Vector3()
    .crossVectors(guideExitPoint, guideExitVelocity).y;
  const outletSpecificAngularMomentumY = new THREE.Vector3()
    .crossVectors(runnerDischargePoint, runnerDischargeVelocity).y;
  const runnerTorqueNormalized = massFlowNormalized
    * (inletSpecificAngularMomentumY - outletSpecificAngularMomentumY);

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    // Counter-clockwise seen from above: the direction the helical shutes
    // whirl the water, as Brown's vane curves require.
    const runnerAngle = inputAngle;
    const runnerAngularSpeed = inputSpeed;
    const runnerAngularAcceleration = inputAcceleration;
    const runnerBuckets = [];
    for (let bucketIndex = 0; bucketIndex < runnerBucketCount;
      bucketIndex += 1) {
      const localAngle = sourcePoseBucketOffset
        + bucketIndex * runnerBucketPitch;
      const worldAngle = localAngle + runnerAngle;
      const radial = horizontalRadial(worldAngle);
      const tangent = horizontalTangent(worldAngle);
      const center = radial.clone()
        .multiplyScalar(runnerBucketCenterRadius);
      center.y = runnerRowCenterY;
      const centerVelocity = tangent.clone().multiplyScalar(
        runnerBucketCenterRadius * runnerAngularSpeed,
      );
      const centerAcceleration = tangent.clone().multiplyScalar(
        runnerBucketCenterRadius * runnerAngularAcceleration,
      ).addScaledVector(
        radial,
        -runnerBucketCenterRadius * runnerAngularSpeed ** 2,
      );
      runnerBuckets.push({
        center,
        centerAcceleration,
        centerVelocity,
        index: bucketIndex,
        localAngle,
        radial,
        tangent,
        worldAngle,
      });
    }
    const rimReferenceRadial = horizontalRadial(runnerAngle);
    const rimReferenceTangent = horizontalTangent(runnerAngle);
    const rimReferencePoint = rimReferenceRadial.clone()
      .multiplyScalar(annulusOuterRadius);
    rimReferencePoint.y = runnerRowCenterY;
    const rimReferenceVelocity = rimReferenceTangent.clone()
      .multiplyScalar(annulusOuterRadius * runnerAngularSpeed);
    const rimReferenceAcceleration = rimReferenceTangent.clone()
      .multiplyScalar(annulusOuterRadius * runnerAngularAcceleration)
      .addScaledVector(
        rimReferenceRadial,
        -annulusOuterRadius * runnerAngularSpeed ** 2,
      );
    return {
      guideExitPoint: guideExitPoint.clone(),
      guideExitVelocity: guideExitVelocity.clone(),
      inletSpecificAngularMomentumY,
      inputAcceleration,
      inputAngle,
      inputSpeed,
      outletSpecificAngularMomentumY,
      rimReferenceAcceleration,
      rimReferencePoint,
      rimReferenceVelocity,
      runnerAngle,
      runnerAngularAcceleration,
      runnerAngularSpeed,
      runnerBuckets,
      runnerDischargePoint: runnerDischargePoint.clone(),
      runnerDischargeVelocity: runnerDischargeVelocity.clone(),
      runnerTorqueNormalized,
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
    annulusInnerRadius,
    annulusOuterRadius,
    cycleDuration,
    fixedShuteCount,
    guideExitAxialSpeed,
    guideExitWhirlSpeed,
    guideHelixSweep,
    guidePitchAngle,
    guideRowCenterY,
    inputAngularSpeed,
    massFlowNormalized,
    rowHeight,
    runnerBucketCenterRadius,
    runnerBucketCount,
    runnerBucketPitch,
    runnerDischargeAxialSpeed,
    runnerDischargeWhirlSpeed,
    runnerHelixSweep,
    runnerRowCenterY,
    runnerTangentAngle,
    shaftRadius,
    sourcePoseBucketOffset,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.59,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.31,
    roughness: 0.46,
  });
  const guideMaterial = matte(PALETTE.driver, {
    metalness: 0.15,
    roughness: 0.52,
  });
  const runnerMaterial = matte(PALETTE.driven, {
    metalness: 0.18,
    roughness: 0.49,
  });
  const casingMaterial = matte(PALETTE.frame, {
    opacity: 0.24,
    roughness: 0.43,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.66,
    roughness: 0.31,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const paleWaterMaterial = matte(0x75c7d7, {
    opacity: 0.52,
    roughness: 0.29,
    transparent: true,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.40 });

  const fixedGuideAssembly = new THREE.Group();
  fixedGuideAssembly.userData.role =
    'stationary-upper-jonval-shute-row-a';
  root.add(fixedGuideAssembly);
  const guideDrum = new THREE.Mesh(
    new THREE.CylinderGeometry(
      annulusInnerRadius - 0.08,
      annulusInnerRadius - 0.08,
      rowHeight + 0.18,
      48,
    ),
    frameMaterial,
  );
  guideDrum.geometry.dispose();guideDrum.geometry=horizontalRing(shaftRadius+.004,annulusInnerRadius-.08,-(rowHeight+.18)/2,(rowHeight+.18)/2);
  guideDrum.position.y = guideRowCenterY;
  guideDrum.userData.role =
    'fixed-central-drum-carrying-radial-guide-shutes';
  fixedGuideAssembly.add(guideDrum);
  const fixedShuteGroups = [];
  for (let guideIndex = 0; guideIndex < fixedShuteCount; guideIndex += 1) {
    const angle = guideIndex * FULL_TURN / fixedShuteCount;
    const guideGroup = new THREE.Group();
    guideGroup.rotation.y = angle;
    guideGroup.userData.role =
      `fixed-radially-arranged-shute-${guideIndex + 1}-of-sixteen`;
    const guide = new THREE.Mesh(helicalVaneGeometry({
      inner: annulusInnerRadius, outer: annulusOuterRadius,
      top: guideRowCenterY + rowHeight / 2, bottom: guideRowCenterY - rowHeight / 2,
      sweep: guideSweepAtDepth, thickness: vaneThickness,
    }), guideMaterial);
    guide.userData.role =
      `helical-flow-surface-of-fixed-shute-${guideIndex + 1}`;
    guideGroup.add(guide);
    fixedGuideAssembly.add(guideGroup);
    fixedShuteGroups.push(guideGroup);
  }
  for (const height of [
    guideRowCenterY - rowHeight / 2,
    guideRowCenterY + rowHeight / 2,
  ]) {
    for (const radius of [annulusInnerRadius, annulusOuterRadius]) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.075, 9, 96),
        frameMaterial,
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = height;
      ring.userData.role = 'fixed-boundary-ring-of-guide-row-a';
      fixedGuideAssembly.add(ring);
    }
  }

  const runner = new THREE.Group();
  runner.userData.role =
    'counterclockwise-lower-jonval-runner-c';
  root.add(runner);
  const runnerBucketGroups = [];
  const runnerBucketProfiles = [];
  for (let bucketIndex = 0; bucketIndex < runnerBucketCount;
    bucketIndex += 1) {
    const angle = sourcePoseBucketOffset + bucketIndex * runnerBucketPitch;
    const bucketGroup = new THREE.Group();
    bucketGroup.rotation.y = angle;
    bucketGroup.userData.role =
      `tangential-helical-runner-bucket-${bucketIndex + 1}-of-twenty-eight`;
    const points = Array.from({ length: 13 }, (_, pointIndex) => {
      const progress = pointIndex / 12;
      const radius = THREE.MathUtils.lerp(
        annulusInnerRadius,
        annulusOuterRadius,
        progress,
      );
      return new THREE.Vector3(
        radius,
        runnerRowCenterY,
        runnerSweepOffsetAtProgress(progress),
      );
    });
    const bucketVane = new THREE.Mesh(helicalVaneGeometry({
      inner: annulusInnerRadius, outer: annulusOuterRadius,
      top: runnerRowCenterY + rowHeight / 2, bottom: runnerRowCenterY - rowHeight / 2,
      sweep: runnerSweepAtDepth, thickness: vaneThickness,
      planOffset: (radius) => runnerSweepOffsetAtProgress(
        (radius - annulusInnerRadius) / (annulusOuterRadius - annulusInnerRadius)),
    }), runnerMaterial);
    bucketVane.userData.role = `helical-bucket-${bucketIndex + 1}`;
    bucketGroup.add(bucketVane);
    runner.add(bucketGroup);
    runnerBucketGroups.push(bucketGroup);
    runnerBucketProfiles.push(points.map((point) => point.clone()));
  }
  for (const height of [
    runnerRowCenterY - rowHeight / 2,
    runnerRowCenterY + rowHeight / 2,
  ]) {
    for (const radius of [annulusInnerRadius, annulusOuterRadius]) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.075, 9, 96),
        runnerMaterial,
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = height;
      ring.userData.role = 'rotating-boundary-ring-of-runner-row-c';
      runner.add(ring);
    }
  }
  const runnerFloor = new THREE.Mesh(
    new THREE.CylinderGeometry(annulusOuterRadius, annulusOuterRadius,
      0.14, 72),
    runnerMaterial,
  );
  const floorSpokes=Array.from({length:4},(_,i)=>horizontalPlate(poly([[shaftRadius,-.10],[annulusOuterRadius,-.10],[annulusOuterRadius,.10],[shaftRadius,.10]].map(p=>rotate(p,i*Math.PI/2))),-.07,.07));
  runnerFloor.geometry.dispose();runnerFloor.geometry=mergePassageParts([horizontalRing(annulusOuterRadius-.10,annulusOuterRadius+.06,-.07,.07),...floorSpokes]);
  runnerFloor.position.y = runnerRowCenterY - rowHeight / 2 - 0.09;
  runnerFloor.userData.role = 'rotating-lower-support-plate-of-runner-c';
  runner.add(runnerFloor);
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(shaftRadius, shaftRadius, 7.10, 36),
    darkMaterial,
  );
  shaft.position.y = 1.85;
  shaft.userData.role = 'vertical-shaft-fast-on-jonval-runner-c';
  runner.add(shaft);
  const runnerHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.43, 0.43, 0.34, 40),
    runnerMaterial,
  );
  runnerHub.position.y = runnerRowCenterY - rowHeight / 2 - 0.19;
  runnerHub.userData.role = 'jonval-runner-hub-fast-on-shaft';
  runner.add(runnerHub);
  const rotationMarker = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.10, 0.12),
    whiteMaterial,
  );
  rotationMarker.position.set(1.90, runnerRowCenterY - 0.02, 0);
  rotationMarker.userData.role =
    'visible-rotation-marker-on-runner-c';
  runner.add(rotationMarker);
  rotationMarker.visible = false; // Brown draws no index stripe on the runner.

  const casing = new THREE.Mesh(
    new THREE.CylinderGeometry(
      annulusOuterRadius + 0.30,
      annulusOuterRadius + 0.30,
      3.42,
      84,
      1,
      true,
    ),
    casingMaterial,
  );
  // Brown's trunk b rises well above the wheel to the top cover and runs down
  // past the runner to the bridge carrying step c.
  // Brown's chute opens into the trunk: the wall is cut away across the
  // chute mouth (floor to roof, full chute width) so the water can enter.
  {
    const inner = annulusOuterRadius + .24, outer = annulusOuterRadius + .30;
    const mouthLow = 1.02 - 0.65, mouthHigh = 3.30 - 0.65;
    const half = Math.asin(1.0 / inner);
    const arc = (radius, from, to, n = 96) => Array.from({length: n + 1}, (_, i) => {
      const a = from + (to - from) * i / n;
      return [radius * Math.cos(a), radius * Math.sin(a)];
    });
    const wall = poly([...arc(outer, half, FULL_TURN - half), ...arc(inner, FULL_TURN - half, half)]);
    casing.geometry.dispose();
    casing.geometry = mergePassageParts([
      horizontalRing(inner, outer, -2.80, mouthLow),
      horizontalPlate(wall, mouthLow, mouthHigh),
      horizontalRing(inner, outer, mouthHigh, 2.80),
    ]);
  }
  casing.position.y = 0.65;
  casing.userData.role = 'fixed-trunk-or-casing-b-around-both-vane-rows';
  root.add(casing);
  const casingRings = [];
  for (const height of [-2.03, 3.33]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(annulusOuterRadius + 0.30, 0.12, 10, 104),
      frameMaterial,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = height;
    ring.userData.role =
      `fixed-casing-ring-at-${height < 0 ? 'bottom' : 'top'}`;
    root.add(ring);
    casingRings.push(ring);
  }
  const casingPosts = [];
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.20, 5.60, 0.24),
      frameMaterial,
    );
    post.position.set(side * (annulusOuterRadius + 0.24), 0.65, -0.18);
    post.userData.role =
      `${side < 0 ? 'left' : 'right'}-fixed-casing-cutaway-post`;
    root.add(post);
    casingPosts.push(post);
  }

  const upperBearing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.38, 0.42, 36),
    frameMaterial,
  );
  upperBearing.geometry.dispose();upperBearing.geometry=horizontalRing(shaftRadius+.004,.38,-.21,.21);
  upperBearing.position.y = 3.83;
  upperBearing.userData.role = 'fixed-upper-bearing-for-runner-shaft';
  root.add(upperBearing);
  const upperBeam = new THREE.Mesh(
    new THREE.BoxGeometry(5.96, 0.24, 0.74),
    frameMaterial,
  );
  // Brown closes trunk b with a flat top cover (drawn hatched in section),
  // the shaft passing through its bore to the collars above; there is no
  // overhead beam.
  upperBeam.geometry.dispose();upperBeam.geometry=horizontalRing(shaftRadius+.004,annulusOuterRadius+.42,-.08,.08);
  upperBeam.position.y = 3.53;
  upperBeam.userData.role = 'fixed-top-cover-of-trunk-b-carrying-upper-bearing';
  root.add(upperBeam);
  const lowerBearing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.38, 0.34, 36),
    frameMaterial,
  );
  lowerBearing.geometry.dispose();lowerBearing.geometry=horizontalRing(shaftRadius+.004,.38,-.17,.17);
  lowerBearing.position.y = -1.74;
  lowerBearing.userData.role = 'fixed-lower-thrust-bearing-below-runner';
  root.add(lowerBearing);

  const inletFlume = new THREE.Mesh(
    new THREE.BoxGeometry(3.40, 0.26, 1.28),
    frameMaterial,
  );
  // Brown's broad rectangular chute enters the side of trunk b under the top
  // cover, rising away to the upper right; drawn in section as a hatched
  // floor and roof over the back wall.
  {
    const x0 = annulusOuterRadius + 0.35, run = 3.5, rise = Math.tan(0.45) * run;
    const floorY = 1.16, roofY = 3.16, wall = 0.14, halfWidth = 1.0;
    const band = (y0, y1) => poly([[x0, y0], [x0 + run, y0 + rise], [x0 + run, y1 + rise], [x0, y1]]);
    inletFlume.geometry.dispose();
    inletFlume.geometry = mergePassageParts([
      plate(band(floorY - wall, floorY), -halfWidth, halfWidth),
      plate(band(roofY, roofY + wall), -halfWidth, halfWidth),
      plate(band(floorY - wall, roofY + wall), -halfWidth - 0.10, -halfWidth),
    ]);
    // Carry the slope on the mesh itself: its local x runs up the chute.
    inletFlume.geometry.translate(-x0, -floorY, 0).rotateZ(-0.45);
    inletFlume.position.set(x0, floorY, 0);
    inletFlume.rotation.z = 0.45;
  }
  inletFlume.userData.role = 'fixed-sloping-inlet-flume-to-casing-b';
  root.add(inletFlume);
  const inletWater = new THREE.Mesh(
    new THREE.BoxGeometry(3.22, 0.14, 0.90),
    waterMaterial,
  );
  {
    const x0 = annulusOuterRadius + 0.35, run = 3.5, rise = Math.tan(0.45) * run;
    inletWater.geometry.dispose();
    inletWater.geometry = plate(poly([[x0, 1.16], [x0 + run, 1.16 + rise], [x0 + run, 1.22 + rise], [x0, 1.22]]), -0.9, 0.9);
    inletWater.geometry.translate(-x0, -1.16, 0).rotateZ(-0.45);
    inletWater.position.set(x0, 1.16, 0);
    inletWater.rotation.z = 0.45;
  }
  // Brown draws the chute empty with only an arrow; the thin sheet stays for
  // offline checks and is hidden in the presentation.
  inletWater.visible = false;
  inletWater.userData.role = 'water-descending-inlet-flume-into-casing';
  root.add(inletWater);
  // Pass 69: the working water. A continuous sheet (water-stream.js) runs
  // down the chute floor through the opened mouth into trunk b, which
  // stands full of water over shute row a up to the chute floor. Both are
  // cut on the section plane like the casing: the stream fills the chute's
  // back half and the trunk water is its back half with a flat cut face.
  const chuteRise = Math.tan(0.45);
  const chuteX0 = annulusOuterRadius + 0.35;
  const chuteSurface = (x) => new THREE.Vector3(x, 1.16 + (x - chuteX0) * chuteRise + 0.155, -0.45);
  const trunkWaterLevel = 1.46;
  const chuteStream = new WaterStream(guidedPath([
    chuteSurface(chuteX0 + 3.45),
    chuteSurface(chuteX0),
    new THREE.Vector3(chuteX0 - 0.7, 1.30, -0.45),
  ], {speed: 2.6, samples: 30}), {
    width: 0.45, thickness: 0.15, widthAxis: new THREE.Vector3(0, 0, 1), widthExponent: 0,
    fadeOut: 0.12, cyclePeriod: cycleDuration, streakRate: 1.1, opacity: 0.5,
  });
  chuteStream.userData.role = 'water-running-down-chute-into-trunk-b';
  root.add(chuteStream);
  const trunkWater = new THREE.Mesh(
    latheSectionGeometry([[shaftRadius + 0.012, guideRowCenterY + rowHeight / 2 + 0.005],
      [annulusOuterRadius + 0.235, guideRowCenterY + rowHeight / 2 + 0.005],
      [annulusOuterRadius + 0.235, trunkWaterLevel], [shaftRadius + 0.012, trunkWaterLevel]], {segments: 96}),
    waterVolumeMaterial({opacity: 0.28}),
  );
  trunkWater.renderOrder = 1;
  trunkWater.userData.role = 'water-standing-in-trunk-b-over-shute-row-a';
  root.add(trunkWater);
  const updateWater = collectWaterStreams(root);
  const lowerBasin = new THREE.Mesh(
    new THREE.CylinderGeometry(3.02, 3.02, 0.24, 80),
    waterMaterial,
  );
  lowerBasin.position.y = -1.52;
  lowerBasin.userData.role = 'tailwater-basin-below-axial-runner-discharge';
  lowerBasin.visible = false; // Brown draws no tailwater disc under the case.
  root.add(lowerBasin);
  const foundation = new THREE.Mesh(
    new THREE.CylinderGeometry(3.26, 3.26, 0.22, 80),
    frameMaterial,
  );
  // No base disc: Brown draws a cranked bridge across the foot of trunk b
  // carrying step c.
  foundation.geometry.dispose();
  // Brown's bridge is an angular trough: upturned lips against the trunk
  // wall, straight sloping sides and a flat floor carrying step c, all of
  // one thickness (0.16), and deeper across the trunk than a thin strip.
  foundation.geometry = plate(polygonClipping.union(poly([
    [-2.58, -1.50], [-2.30, -1.50], [-1.35, -1.91], [1.35, -1.91], [2.30, -1.50], [2.58, -1.50],
    [2.58, -1.66], [2.26, -1.66], [1.32, -2.07], [-1.32, -2.07], [-2.26, -1.66], [-2.58, -1.66],
  ]), poly([[-2.58, -1.66], [-2.42, -1.66], [-2.42, -1.28], [-2.58, -1.28]]),
  poly([[2.42, -1.66], [2.58, -1.66], [2.58, -1.28], [2.42, -1.28]])), -0.45, 0.45);
  foundation.position.y = 0;
  foundation.userData.role = 'fixed-bridge-carrying-step-c-across-trunk-b';
  root.add(foundation);

  const flowCurves = [];
  const flowPathTubes = [];
  const representativePathCount = 6;
  for (let pathIndex = 0; pathIndex < representativePathCount;
    pathIndex += 1) {
    const baseAngle = pathIndex * FULL_TURN / representativePathCount;
    const radius = runnerBucketCenterRadius;
    const points = [
      cylindricalPoint(radius, baseAngle - 0.34, 1.70),
      cylindricalPoint(radius, baseAngle - 0.24, 1.18),
      cylindricalPoint(radius, baseAngle - 0.10, 0.60),
      cylindricalPoint(radius, baseAngle, 0.05),
      cylindricalPoint(radius, baseAngle + 0.06, -0.38),
      cylindricalPoint(radius, baseAngle + 0.03, -0.82),
      cylindricalPoint(radius, baseAngle - 0.02, -1.34),
      cylindricalPoint(radius, baseAngle - 0.02, -1.64),
    ];
    const curve = new THREE.CatmullRomCurve3(
      points,
      false,
      'centripetal',
    );
    flowCurves.push(curve);
    const tube = makeTube(
      curve,
      0.060,
      waterMaterial,
      `continuous-axial-flow-path-through-guide-a-and-runner-c-${pathIndex + 1}`,
    );
    // The path is kept as data for the drifting markers, but not drawn: a
    // solid tube reads as a stiff rod, and Brown shows only a flow arrow.
    tube.visible = false;
    root.add(tube);
    flowPathTubes.push(tube);
  }
  const flowMarkers = [];
  const markersPerPath = 4;
  for (let pathIndex = 0; pathIndex < representativePathCount;
    pathIndex += 1) {
    for (let markerIndex = 0; markerIndex < markersPerPath;
      markerIndex += 1) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.082, 16, 11),
        paleWaterMaterial,
      );
      marker.userData.role =
        `downward-flow-marker-path-${pathIndex + 1}-particle-${markerIndex + 1}`;
      root.add(marker);
      flowMarkers.push({ marker, markerIndex, pathIndex });
    }
  }

  const update = (time) => {
    const state = stateAtTime(time);
    runner.rotation.y = state.runnerAngle;
    updateWater(time);
    const flowPhase = THREE.MathUtils.euclideanModulo(time / 1.18, 1);
    for (const entry of flowMarkers) {
      const progress = THREE.MathUtils.euclideanModulo(
        flowPhase + entry.markerIndex / markersPerPath,
        1,
      );
      entry.marker.position.copy(
        flowCurves[entry.pathIndex].getPoint(progress),
      );
      const endpointFade = Math.sin(Math.PI * progress);
      entry.marker.scale.setScalar(Math.sqrt(Math.max(0, endpointFade)));
    }
  };

  const sourceState = stateAtInputAngle(0);
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: cycleDuration,
    },
    archetype:
      'jonval-axial-flow-turbine-with-fixed-radial-upper-shutes-and-more-numerous-tangential-parabolic-lower-runner-buckets',
    blocks: {
      casing,
      chuteStream,
      trunkWater,
      casingPosts,
      casingRings,
      fixedGuideAssembly,
      fixedShuteGroups,
      flowMarkers: flowMarkers.map(({ marker }) => marker),
      flowPathTubes,
      foundation,
      guideDrum,
      inletFlume,
      inletWater,
      lowerBasin,
      lowerBearing,
      rotationMarker,
      runner,
      runnerBucketGroups,
      runnerFloor,
      runnerHub,
      shaft,
      upperBeam,
      upperBearing,
    },
    degreesOfFreedom: {
      fixedUpperShutesRotate: false,
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      runnerAndShaftIndependent: false,
    },
    dynamics: {
      angularMomentumDiagnostic:
        'Normalized runner torque equals mass flow times guide-exit minus runner-discharge specific angular momentum about y. The helical fixed shutes supply counter-clockwise whirl and runner c removes most of it, producing exact positive (counter-clockwise) torque.',
      fluidPressureViscosityTurbulenceLeakageCavitationBladeLoadingBearingFrictionRunnerInertiaGeneratorLoadAndSpeedResponseModeled:
        false,
      markerContinuity:
        'Each visible water marker follows one centripetal Catmull-Rom curve continuously downward through both stacked rows and fades to zero at recycling endpoints.',
    },
    fidelity: 'authored',
    flowCurves,
    geometry,
    mechanism:
      'Water enters trunk b and descends axially through sixteen stationary helical shutes arranged radially around a fixed central drum. Their screw-like flow surfaces, straight at the top and bent at the foot, impart counter-clockwise whirl. Immediately below, the water crosses twenty-eight moving helical buckets in wheel c; these buckets exceed the shutes in number, are set at a slight tangent rather than radially, and bend the water back along a parabola in depth. Runner c removes most of the water’s whirl and turns counter-clockwise (seen from above) with its vertical shaft, while the casing, upper shute row a, bearings, inlet, and flow field remain fixed.',
    motion: {
      cycleDuration,
      inputAngularSpeed,
      runnerBucketPitch,
      runnerDirectionViewedFromAbove: 'counterclockwise',
      runnerRevolutionsPerCycle: 1,
    },
    runnerBucketProfiles,
    runnerSweepOffsetAtProgress,
    guideSweepAtDepth,
    runnerSweepAtDepth,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 436 page provides Brown’s static sectional engraving and caption but contains no Canvas construction or source timing.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      fixedGuideAngle: 0,
      runnerAngle: sourceState.runnerAngle,
      runnerBuckets: sourceState.runnerBuckets.map((bucket) => ({
        center: bucket.center.clone(),
        worldAngle: bucket.worldAngle,
      })),
      rowSeparation: guideRowCenterY - runnerRowCenterY,
    },
    sourceReference: {
      brownPlate436: {
        approximateCasingBoundsPixels: [96, 98, 333, 506],
        approximateGuideRowYRangePixels: [327, 383],
        approximateRunnerRowYRangePixels: [384, 441],
        approximateVisibleGuidePassages: 10,
        approximateVisibleRunnerPassages: 14,
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 17,
        shaftApproximateCenterXPixels: 222,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the mechanism is a Jonval turbine',
          'the shutes are arranged outside a drum, radial to a common center, and stationary in casing b',
          'wheel c is made nearly the same way',
          'the wheel buckets exceed the shutes in number',
          'the buckets are set at a slight tangent instead of radially',
          'the bucket curve generally used is cycloidal or parabolic',
        ],
        engravingEvidence:
          'Brown’s section shows a sloping inlet at upper right, a downward flow arrow within trunk b, a stationary upper vane row a, a distinct lower runner row c on the central shaft, an upper shaft bearing, and discharge beneath the runner.',
        reconstructionDisclosure:
          'Brown gives no dimensions, total shute or bucket counts, exact blade curve, vane pitch, flow rate, head, velocity triangles, shaft speed, rotation direction, materials, losses, leakage, efficiency, inertia, or load. Sixteen fixed shutes and twenty-eight runner buckets (counted from the near half of Brown’s section), the helical parabolic vane sweeps and the counter-clockwise handedness they imply, tangent angle, velocities, dimensions, colors, transparent cutaway, and a 5.7-second cycle are independently engineered; the stacked axial-flow layout, fixed radial shutes around a drum in casing b, more numerous tangential curved buckets on runner c, central shaft, and downward discharge are source-grounded.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 436',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      angularMomentum:
        'tau_y=massFlow*(cross(r_guideExit,v_guideExit).y-cross(r_runnerExit,v_runnerExit).y)>0',
      bucketGeometry:
        'helicoidal vanes: every radial line turns by sweep(depth)=±k*depth^2 about y; runner vanes also lean at a slight tangent (plan offset tangentSlope*radialTravel)',
      rowSequence:
        'fixed radial helical shutes a above, more numerous rotating tangential helical buckets c immediately below',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.95, -2.20, -1.2),
    new THREE.Vector3(6.35, 5.00, 1.2),
  );
  root.userData.cameraDistanceScale = 1.05;
  root.userData.cameraDirection = new THREE.Vector3(7.0, 4.8, 11.0);
  // Brown's sectional elevation is flat: a narrow field keeps the rings edge-on.
  root.userData.cameraFov = 8;
  root.userData.groundFloorY = -2.20;
  root.userData.hideGround=true;
  root.userData.solidReview={qualification:'Finite working passages and shaft supports; water paths, nozzle flow and torque remain prescribed illustrations, without pressure, leakage, efficiency or load-response validation.'};
  root.traverse(object=>{for(const material of object.material?[].concat(object.material):[])material.fog=false;});
  root.userData.minimumDisplayCycleSeconds = cycleDuration;
  markShadows(root);
  // The runner's many buckets would mottle the trough with broken shadow.
  foundation.receiveShadow = false;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredJonvalTurbineMovement(movement) {
  if (movement.id !== 436) return null;
  return applyCutawayFor(jonvalTurbine(movement), movement.id);
}
