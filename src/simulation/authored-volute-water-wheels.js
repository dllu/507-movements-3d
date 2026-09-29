import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {horizontalRing,horizontalPlate,horizontalVane,horizontalTurned} from './horizontal-turbine-solids.js';
import {poly,circle,polygonClipping,rotate,plate,sector} from './finite-plate-geometry.js';
import {mergePassageParts,curvedPipeWall} from './finite-fluid-passages.js';
import {waterVolumeMaterial} from './water-volume.js';
import {WaterStream,collectWaterStreams,guidedPath,ballisticPath} from './water-stream.js';
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
    new THREE.TubeGeometry(curve, 96, radius, 9, false),
    material,
  );
  tube.userData.role = role;
  return tube;
}

function boxBetween(start, end, width, height, material, role) {
  const direction = end.clone().sub(start);
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(direction.length(), height, width),
    material,
  );
  box.position.copy(start).add(end).multiplyScalar(0.5);
  box.quaternion.setFromUnitVectors(
    new THREE.Vector3(1, 0, 0),
    direction.normalize(),
  );
  box.userData.role = role;
  return box;
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

function voluteWaterWheel(movement) {
  const root = new THREE.Group();
  const cycleDuration = 5.5;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const radialVaneCount = 8;
  const lowerBucketCount = 4;
  const radialVanePitch = FULL_TURN / radialVaneCount;
  const lowerBucketPitch = FULL_TURN / lowerBucketCount;
  // Brown's vanes a are short radial stubs in the outer ring of the wheel.
  const runnerInnerRadius = 1.60;
  const runnerOuterRadius = 2.25;
  const radialVaneCenterRadius =
    (runnerInnerRadius + runnerOuterRadius) / 2;
  const lowerBucketCenterRadius = 1.42;
  const radialVaneCenterY = 0.27;
  const lowerBucketCenterY = -0.38;
  const sourcePoseVaneOffset = 0;
  const sourcePoseBucketOffset = Math.PI / 4;
  const shaftRadius = 0.21;
  const voluteStartAngle = THREE.MathUtils.degToRad(90);
  const voluteSweepAngle = THREE.MathUtils.degToRad(326);
  const voluteStartRadius = 3.42;
  const voluteEndRadius = 2.50;
  const voluteWallHalfGap = 0.30;
  const upperEffectiveRadius = 2.10;
  const upperTangentialForceNormalized = 8.4;
  const upperVaneTorqueNormalized =
    -upperEffectiveRadius * upperTangentialForceNormalized;
  const lowerMassFlowNormalized = 1;
  const lowerInletClockwiseWhirlSpeed = 2.05;
  const lowerOutletClockwiseWhirlSpeed = 0.34;
  const lowerInletAngularMomentumY =
    -lowerBucketCenterRadius * lowerInletClockwiseWhirlSpeed;
  const lowerOutletAngularMomentumY =
    -lowerBucketCenterRadius * lowerOutletClockwiseWhirlSpeed;
  const lowerBucketTorqueNormalized = lowerMassFlowNormalized
    * (lowerInletAngularMomentumY - lowerOutletAngularMomentumY);
  const totalTorqueNormalized = upperVaneTorqueNormalized
    + lowerBucketTorqueNormalized;

  const voluteRadiusAtProgress = (progress) => THREE.MathUtils.lerp(
    voluteStartRadius,
    voluteEndRadius,
    THREE.MathUtils.clamp(progress, 0, 1),
  );

  const makeVoluteCurve = (radiusOffset = 0, height = 0.24) => {
    const points = Array.from({ length: 97 }, (_, pointIndex) => {
      const progress = pointIndex / 96;
      const radius = voluteRadiusAtProgress(progress) + radiusOffset;
      const angle = voluteStartAngle - voluteSweepAngle * progress;
      return cylindricalPoint(radius, angle, height);
    });
    return new THREE.CatmullRomCurve3(
      points,
      false,
      'centripetal',
    );
  };

  const scrollFlowCurve = makeVoluteCurve(0, 0.26);
  const scrollOuterWallCurve = makeVoluteCurve(voluteWallHalfGap, 0.34);
  const scrollInnerWallCurve = makeVoluteCurve(-voluteWallHalfGap, 0.34);

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const runnerAngle = -inputAngle;
    const runnerAngularSpeed = -inputSpeed;
    const runnerAngularAcceleration = -inputAcceleration;
    const radialVanes = [];
    for (let vaneIndex = 0; vaneIndex < radialVaneCount;
      vaneIndex += 1) {
      const localAngle = sourcePoseVaneOffset
        + vaneIndex * radialVanePitch;
      const worldAngle = localAngle + runnerAngle;
      const radial = horizontalRadial(worldAngle);
      const tangent = horizontalTangent(worldAngle);
      const center = radial.clone().multiplyScalar(radialVaneCenterRadius);
      center.y = radialVaneCenterY;
      const centerVelocity = tangent.clone().multiplyScalar(
        radialVaneCenterRadius * runnerAngularSpeed,
      );
      const centerAcceleration = tangent.clone().multiplyScalar(
        radialVaneCenterRadius * runnerAngularAcceleration,
      ).addScaledVector(
        radial,
        -radialVaneCenterRadius * runnerAngularSpeed ** 2,
      );
      radialVanes.push({
        center,
        centerAcceleration,
        centerVelocity,
        index: vaneIndex,
        localAngle,
        radial,
        tangent,
        worldAngle,
      });
    }
    const lowerBuckets = [];
    for (let bucketIndex = 0; bucketIndex < lowerBucketCount;
      bucketIndex += 1) {
      const localAngle = sourcePoseBucketOffset
        + bucketIndex * lowerBucketPitch;
      const worldAngle = localAngle + runnerAngle;
      const radial = horizontalRadial(worldAngle);
      const tangent = horizontalTangent(worldAngle);
      const center = radial.clone().multiplyScalar(lowerBucketCenterRadius);
      center.y = lowerBucketCenterY;
      const centerVelocity = tangent.clone().multiplyScalar(
        lowerBucketCenterRadius * runnerAngularSpeed,
      );
      const centerAcceleration = tangent.clone().multiplyScalar(
        lowerBucketCenterRadius * runnerAngularAcceleration,
      ).addScaledVector(
        radial,
        -lowerBucketCenterRadius * runnerAngularSpeed ** 2,
      );
      lowerBuckets.push({
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
      .multiplyScalar(runnerOuterRadius);
    rimReferencePoint.y = radialVaneCenterY;
    const rimReferenceVelocity = rimReferenceTangent.clone()
      .multiplyScalar(runnerOuterRadius * runnerAngularSpeed);
    const rimReferenceAcceleration = rimReferenceTangent.clone()
      .multiplyScalar(runnerOuterRadius * runnerAngularAcceleration)
      .addScaledVector(
        rimReferenceRadial,
        -runnerOuterRadius * runnerAngularSpeed ** 2,
      );
    return {
      inputAcceleration,
      inputAngle,
      inputSpeed,
      lowerBucketTorqueNormalized,
      lowerBuckets,
      lowerInletAngularMomentumY,
      lowerOutletAngularMomentumY,
      radialVanes,
      rimReferenceAcceleration,
      rimReferencePoint,
      rimReferenceVelocity,
      runnerAngle,
      runnerAngularAcceleration,
      runnerAngularSpeed,
      totalTorqueNormalized,
      upperVaneTorqueNormalized,
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
    cycleDuration,
    inputAngularSpeed,
    lowerBucketCenterRadius,
    lowerBucketCenterY,
    lowerBucketCount,
    lowerBucketPitch,
    lowerInletClockwiseWhirlSpeed,
    lowerMassFlowNormalized,
    lowerOutletClockwiseWhirlSpeed,
    radialVaneCenterRadius,
    radialVaneCenterY,
    radialVaneCount,
    radialVanePitch,
    runnerInnerRadius,
    runnerOuterRadius,
    shaftRadius,
    sourcePoseBucketOffset,
    sourcePoseVaneOffset,
    upperEffectiveRadius,
    upperTangentialForceNormalized,
    voluteEndRadius,
    voluteStartAngle,
    voluteStartRadius,
    voluteSweepAngle,
    voluteWallHalfGap,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.59,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.31,
    roughness: 0.46,
  });
  const runnerMaterial = matte(PALETTE.driven, {
    metalness: 0.18,
    roughness: 0.49,
  });
  const bucketMaterial = matte(PALETTE.driver, {
    metalness: 0.15,
    roughness: 0.52,
  });
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.64,
    roughness: 0.32,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const paleWaterMaterial = matte(0x75c7d7, {
    opacity: 0.50,
    roughness: 0.30,
    transparent: true,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.40 });

  const runner = new THREE.Group();
  runner.userData.role =
    'clockwise-volute-wheel-with-upper-radial-vanes-a-and-lower-buckets-c';
  root.add(runner);
  const radialVanes = [];
  for (let vaneIndex = 0; vaneIndex < radialVaneCount;
    vaneIndex += 1) {
    const angle = sourcePoseVaneOffset + vaneIndex * radialVanePitch;
    const vaneGroup = new THREE.Group();
    vaneGroup.rotation.y = angle;
    vaneGroup.userData.role =
      `upper-radial-vane-a-${vaneIndex + 1}-of-eight`;
    const vane = new THREE.Mesh(
      new THREE.BoxGeometry(
        runnerOuterRadius - runnerInnerRadius,
        0.52,
        0.10,
      ),
      runnerMaterial,
    );
    vane.position.set(radialVaneCenterRadius, radialVaneCenterY, 0);
    vane.userData.role = `water-impingement-face-of-vane-a-${vaneIndex + 1}`;
    vaneGroup.add(vane);
    runner.add(vaneGroup);
    radialVanes.push(vaneGroup);
  }
  for (const height of [0.02, 0.54]) {
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(runnerOuterRadius, 0.085, 9, 96),
      runnerMaterial,
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = height;
    rim.userData.role = 'rotating-outer-boundary-of-radial-vane-wheel';
    runner.add(rim);
  }

  const lowerBuckets = [];
  const lowerBucketProfiles = [];
  const bucketSectorInnerRadius = 0.42;
  const bucketSectorOuterRadius = 1.40;
  const bucketSectorHalfAngle = THREE.MathUtils.degToRad(26);
  const bucketTilt = 0.35;
  for (let bucketIndex = 0; bucketIndex < lowerBucketCount;
    bucketIndex += 1) {
    const angle = sourcePoseBucketOffset + bucketIndex * lowerBucketPitch;
    const bucketGroup = new THREE.Group();
    bucketGroup.rotation.y = angle;
    bucketGroup.userData.role =
      `inclined-lower-escape-bucket-c-${bucketIndex + 1}-of-four`;
    // Brown draws each bucket c as a shaded sector round the hub; the plate
    // is tilted about its radial centre line so it reads as an inclined bucket.
    const points = Array.from({ length: 11 }, (_, pointIndex) => new THREE.Vector3(
      THREE.MathUtils.lerp(bucketSectorInnerRadius, bucketSectorOuterRadius, pointIndex / 10),
      lowerBucketCenterY, 0));
    const sectorPlate = new THREE.Mesh(plate(sector(bucketSectorInnerRadius,
      bucketSectorOuterRadius, -bucketSectorHalfAngle, bucketSectorHalfAngle, 48),
    -0.045, 0.045), bucketMaterial);
    sectorPlate.rotation.x = -Math.PI / 2 + bucketTilt;
    sectorPlate.position.y = lowerBucketCenterY;
    sectorPlate.userData.role = `inclined-sector-bucket-c-${bucketIndex + 1}`;
    bucketGroup.add(sectorPlate);
    runner.add(bucketGroup);
    lowerBuckets.push(bucketGroup);
    lowerBucketProfiles.push(points.map((point) => point.clone()));
  }
  const runnerFloor = new THREE.Mesh(
    new THREE.CylinderGeometry(runnerOuterRadius, runnerOuterRadius,
      0.12, 72),
    runnerMaterial,
  );
  // Four slim arms under the buckets carry the rim; the rest of the floor is open.
  const floorSpokes=Array.from({length:4},(_,i)=>poly([[-.10,-.08],[runnerOuterRadius-.06,-.08],[runnerOuterRadius-.06,.08],[-.10,.08]].map(p=>rotate(p,sourcePoseBucketOffset+i*Math.PI/2))));
  const floorOutline=polygonClipping.union(polygonClipping.difference(poly(circle([0,0],runnerOuterRadius)),poly(circle([0,0],runnerOuterRadius-.12))),poly(circle([0,0],.44)),...floorSpokes);
  runnerFloor.geometry.dispose();runnerFloor.geometry=horizontalPlate(floorOutline,-.06,.06);
  runnerFloor.position.y = -0.67;
  runnerFloor.userData.role = 'rotating-bottom-plate-with-escape-openings';
  runner.add(runnerFloor);
  const runnerHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 1.02, 40),
    runnerMaterial,
  );
  runnerHub.position.y = -0.20;
  runnerHub.userData.role = 'volute-wheel-hub-fast-on-vertical-shaft';
  runner.add(runnerHub);
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(shaftRadius, shaftRadius, 3.64, 36),
    darkMaterial,
  );
  shaft.position.y = 1.45;
  shaft.userData.role = 'vertical-output-shaft-of-volute-wheel';
  runner.add(shaft);
  const outerScrollWall = makeTube(
    scrollOuterWallCurve,
    0.15,
    frameMaterial,
    'fixed-outer-wall-of-scroll-casing-b',
  );
  const innerScrollWall = makeTube(
    scrollInnerWallCurve,
    0.15,
    frameMaterial,
    'fixed-inner-wall-of-scroll-casing-b',
  );
  outerScrollWall.geometry.dispose();outerScrollWall.geometry=horizontalVane(scrollOuterWallCurve.getPoints(192),.10,-.74,.73);
  // The volute opens directly onto the runner around its inner perimeter. A full inner wall would isolate the driving water.
  innerScrollWall.geometry.dispose();innerScrollWall.geometry=horizontalVane(scrollInnerWallCurve.getPoints(192).map(p=>{const r=Math.hypot(p.x,p.z),safe=Math.max(r,runnerOuterRadius+.16);return p.clone().multiplyScalar(safe/r);}),.045,-.78,-.73);
  const scrollOuter=scrollOuterWallCurve.getPoints(192).map(p=>[p.x,-p.z]);
  const scrollInner=scrollOuter.map(p=>{const r=Math.hypot(...p);return p.map(v=>v*(runnerOuterRadius+.15)/r);}).reverse();
  const scrollFloor=new THREE.Mesh(horizontalPlate(poly([...scrollOuter,...scrollInner]),-.78,-.74),frameMaterial);scrollFloor.userData.role='fixed-open-annular-volute-floor';root.add(scrollFloor);
  // Pass 69 (p69-w1): the water fills the scroll passage from its floor to a
  // level over the vanes, between the outer wall and the runner, and fills
  // the vane ring itself, so it acts on the vanes all round as Brown says.
  // It was a round hose along the passage centreline.
  const scrollWaterTopY = 0.44;
  const outerWaterFace = scrollOuterWallCurve.getPoints(192).map((p) => {
    const r = Math.hypot(p.x, p.z), inner = r - 0.10 - 0.004;
    return [p.x * inner / r, -p.z * inner / r];
  });
  // Pass 104: the water reaches 0.006 inside the vanes' inner ends, so its
  // inner face no longer lies on their end faces (they flickered).
  const waterInnerRadius = runnerInnerRadius - 0.006;
  const passageInner = outerWaterFace.map(([x, y]) => {
    const r = Math.hypot(x, y);
    return [x * waterInnerRadius / r, y * waterInnerRadius / r];
  }).reverse();
  const scrollWater = new THREE.Mesh(horizontalPlate(polygonClipping.union(
    poly([...outerWaterFace, ...passageInner]),
    polygonClipping.difference(poly(circle([0, 0], runnerOuterRadius + 0.12, 192)), poly(circle([0, 0], waterInnerRadius, 192))),
  ), -0.74, scrollWaterTopY), waterVolumeMaterial({opacity: 0.36}));
  scrollWater.renderOrder = 1;
  scrollWater.userData.role = 'clockwise-water-confined-around-runner-by-volute-b';
  // Its circulation: one sheet along the passage just under the surface. The
  // passage narrows round the scroll, so the water speeds up (continuity) and
  // the sheet narrows with it.
  const passageWidthAt = (u) => voluteRadiusAtProgress(u) + voluteWallHalfGap - 0.10 - runnerOuterRadius;
  const scrollSheet = new WaterStream(guidedPath(Array.from({length: 49}, (_, i) => {
    const u = i / 48 * 0.97;
    const radius = (voluteRadiusAtProgress(u) + voluteWallHalfGap - 0.10 + runnerOuterRadius) / 2;
    return cylindricalPoint(radius, voluteStartAngle - voluteSweepAngle * u, scrollWaterTopY - 0.1);
  }), {speedAt: (u) => 1.6 * passageWidthAt(0) / passageWidthAt(u * 0.97), samples: 96}), {
    width: passageWidthAt(0) * 0.42, thickness: 0.05, widthExponent: 1,
    widthAxis: (i, p) => new THREE.Vector3(p.x, 0, p.z).normalize(),
    fadeOut: 0.1, cyclePeriod: cycleDuration, streakRate: 0.7, opacity: 0.3,
  });
  scrollSheet.userData.role = 'clockwise-circulation-sheet-in-volute-b';
  root.add(outerScrollWall, innerScrollWall, scrollWater, scrollSheet);
  // Brown's cast scroll b has a flange round its outer wall with bolt lugs.
  const flangeRing = (offset) => scrollOuterWallCurve.getPoints(192).map(p => {
    const r = Math.hypot(p.x, p.z);
    return [p.x * (r + offset) / r, -p.z * (r + offset) / r];
  });
  const lugCenters = Array.from({ length: 11 }, (_, index) => {
    const p = scrollOuterWallCurve.getPoint(0.04 + 0.92 * index / 10);
    const r = Math.hypot(p.x, p.z);
    return [p.x * (r + 0.42) / r, -p.z * (r + 0.42) / r];
  });
  const casingFlange = new THREE.Mesh(horizontalPlate(polygonClipping.difference(
    polygonClipping.union(poly([...flangeRing(0.04), ...flangeRing(0.30).reverse()]),
      ...lugCenters.map(c => poly(circle(c, 0.17, 48)))),
    ...lugCenters.map(c => poly(circle(c, 0.06, 32)))), 0.61, 0.73), frameMaterial);
  casingFlange.userData.role = 'fixed-bolting-flange-and-lugs-of-scroll-casing-b';
  root.add(casingFlange);
  const voluteStart = scrollFlowCurve.getPoint(0);
  const voluteStartTangent = scrollFlowCurve.getTangent(0).normalize();
  // Brown's inlet is a straight level channel entering across the top of
  // the case from the left and running into the scroll along its tangent.
  const inletDirection = new THREE.Vector3(voluteStartTangent.x, 0,
    voluteStartTangent.z).normalize();
  const inletUpstream = voluteStart.clone()
    .addScaledVector(inletDirection, -1.95);
  // The inlet is an open duct as deep as the scroll: a floor and two walls
  // continuing the passage along its tangent (it was a solid bar with a film
  // of water on its top). Its outer wall carries on the scroll's outer wall;
  // its inner wall meets the scroll end at the tongue beside the runner.
  const inletRadial = new THREE.Vector3(voluteStart.x, 0, voluteStart.z).normalize();
  const inletOuterFace = voluteStartRadius + voluteWallHalfGap - 0.10;
  const inletInnerFace = runnerOuterRadius + 0.15;
  const inletQuad = (r0, r1) => {
    const corners = [];
    for (const [along, r] of [[0, r0], [1, r0], [1, r1], [0, r1]]) {
      const base = along ? voluteStart : inletUpstream;
      const q = new THREE.Vector3(base.x, 0, base.z).addScaledVector(inletRadial, r - voluteStartRadius);
      corners.push([q.x, -q.z]);
    }
    return poly(corners);
  };
  const inletFlume = new THREE.Mesh(mergeGeometries([
    horizontalPlate(inletQuad(inletInnerFace, inletOuterFace), -0.78, -0.74),
    horizontalPlate(inletQuad(inletOuterFace, inletOuterFace + 0.10), -0.78, 0.73),
    horizontalPlate(inletQuad(inletInnerFace - 0.10, inletInnerFace), -0.78, 0.73),
  ].map((g) => g.index ? g.toNonIndexed() : g)), frameMaterial);
  inletFlume.userData.role = 'fixed-tangential-inlet-to-volute-casing-b';
  root.add(inletFlume);
  const inletWater = new THREE.Mesh(horizontalPlate(inletQuad(inletInnerFace + 0.004, inletOuterFace - 0.004), -0.74, scrollWaterTopY),
    waterVolumeMaterial({opacity: 0.36}));
  inletWater.renderOrder = 1;
  inletWater.userData.role = 'water-entering-scroll-tangentially';
  root.add(inletWater);

  const scrollMarkers = [];
  const scrollMarkerCount = 14;
  for (let markerIndex = 0; markerIndex < scrollMarkerCount;
    markerIndex += 1) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.088, 16, 11),
      paleWaterMaterial,
    );
    marker.userData.role = `clockwise-volute-flow-marker-${markerIndex + 1}`;
    root.add(marker);
    scrollMarkers.push(marker);
  }

  const escapeFlowCurves = [];
  const escapeFlowTubes = [];
  const escapeMarkers = [];
  for (let pathIndex = 0; pathIndex < lowerBucketCount;
    pathIndex += 1) {
    const angle = sourcePoseBucketOffset + pathIndex * lowerBucketPitch;
    const curve = new THREE.CatmullRomCurve3([
      cylindricalPoint(1.86, angle - 0.20, 0.08),
      cylindricalPoint(1.68, angle - 0.28, -0.26),
      cylindricalPoint(1.44, angle - 0.35, -0.64),
      cylindricalPoint(1.22, angle - 0.38, -1.12),
      cylindricalPoint(1.12, angle - 0.38, -1.54),
    ], false, 'centripetal');
    escapeFlowCurves.push(curve);
    const tube = makeTube(
      curve,
      0.065,
      waterMaterial,
      `water-escaping-down-through-inclined-bucket-opening-${pathIndex + 1}`,
    );
    root.add(tube);
    escapeFlowTubes.push(tube);
    for (let markerIndex = 0; markerIndex < 3; markerIndex += 1) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.080, 16, 11),
        paleWaterMaterial,
      );
      marker.userData.role =
        `lower-escape-flow-marker-path-${pathIndex + 1}-particle-${markerIndex + 1}`;
      root.add(marker);
      escapeMarkers.push({ marker, markerIndex, pathIndex });
    }
  }

  const lowerBasin = new THREE.Mesh(
    new THREE.CylinderGeometry(2.76, 2.76, 0.22, 80),
    waterMaterial,
  );
  lowerBasin.position.y = -1.56;
  lowerBasin.userData.role = 'tailwater-basin-below-inclined-outlet-buckets';
  root.add(lowerBasin);
  const casingFloor = new THREE.Mesh(
    new THREE.CylinderGeometry(3.86, 3.86, 0.20, 88),
    frameMaterial,
  );
  casingFloor.position.y = -1.76;
  casingFloor.userData.role = 'fixed-foundation-under-volute-wheel';
  root.add(casingFloor);
  const upperBearing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.38, 0.40, 36),
    frameMaterial,
  );
  upperBearing.geometry.dispose();upperBearing.geometry=horizontalRing(shaftRadius+.004,.38,-.20,.20);
  upperBearing.position.y = 3.18;
  upperBearing.userData.role = 'fixed-upper-bearing-of-volute-wheel-shaft';
  root.add(upperBearing);
  const bearingBeam=new THREE.Mesh(horizontalPlate(polygonClipping.difference(poly([[-3.50,-.14],[3.50,-.14],[3.50,.14],[-3.50,.14]]),poly(circle([0,0],shaftRadius+.004,128))),3.14,3.30),frameMaterial);bearingBeam.userData.role='bored-upper-bearing-crossbeam';root.add(bearingBeam);
  const bearingPosts=[];for(const x of[-3.42,3.42]){const post=new THREE.Mesh(new THREE.BoxGeometry(.16,4.82,.22),frameMaterial);post.position.set(x,.75,0);post.userData.role='upper-bearing-support-post';root.add(post);bearingPosts.push(post);}

  // The escaping water: below each inclined bucket c a sheet leaves the
  // open floor and falls away. Its shape is steady in the runner's frame, so
  // it turns with the runner; it fades as it drops out of the picture (Brown
  // draws no tailrace).
  const escapeStreams = [];
  for (let pathIndex = 0; pathIndex < lowerBucketCount; pathIndex += 1) {
    const angle = sourcePoseBucketOffset + pathIndex * lowerBucketPitch - 0.3;
    const origin = cylindricalPoint(1.0, angle, -0.74);
    const stream = new WaterStream(ballisticPath({
      origin, velocity: horizontalTangent(angle).multiplyScalar(-0.5).add(new THREE.Vector3(0, -0.6, 0)),
      endY: -1.62, samples: 24, // above the (unpresented) foundation disc
    }), {
      width: 0.34, thickness: 0.05, widthAxis: horizontalRadial(angle), widthExponent: 0.2,
      fadeOut: 0.6, spread: {start: 0.4, width: 1.3, thickness: 2}, cyclePeriod: cycleDuration, streakRate: 1.2, opacity: 0.36,
    });
    stream.userData.role = `water-falling-from-escape-opening-under-bucket-c-${pathIndex + 1}`;
    runner.add(stream);
    escapeStreams.push(stream);
  }
  const updateWater = collectWaterStreams(root);
  const update = (time) => {
    const state = stateAtTime(time);
    runner.rotation.y = state.runnerAngle;
    updateWater(time);
    const scrollPhase = THREE.MathUtils.euclideanModulo(time / 1.42, 1);
    for (let markerIndex = 0; markerIndex < scrollMarkers.length;
      markerIndex += 1) {
      const progress = THREE.MathUtils.euclideanModulo(
        scrollPhase + markerIndex / scrollMarkers.length,
        1,
      );
      scrollMarkers[markerIndex].position.copy(
        scrollFlowCurve.getPoint(progress),
      );
      const endpointFade = Math.sin(Math.PI * progress);
      scrollMarkers[markerIndex].scale.setScalar(
        Math.sqrt(Math.max(0, endpointFade)),
      );
    }
    const escapePhase = THREE.MathUtils.euclideanModulo(time / 0.96, 1);
    for (const entry of escapeMarkers) {
      const progress = THREE.MathUtils.euclideanModulo(
        escapePhase + entry.markerIndex / 3,
        1,
      );
      entry.marker.position.copy(
        escapeFlowCurves[entry.pathIndex].getPoint(progress),
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
      'volute-water-wheel-with-eight-radial-vanes-driven-around-fixed-scroll-and-four-lower-inclined-escape-buckets',
    blocks: {
      bearingBeam,
      bearingPosts,
      casingFloor,
      escapeFlowTubes,
      escapeMarkers: escapeMarkers.map(({ marker }) => marker),
      inletFlume,
      inletWater,
      innerScrollWall,
      scrollFloor,
      lowerBasin,
      lowerBuckets,
      outerScrollWall,
      radialVanes,
      casingFlange,
      runner,
      runnerFloor,
      runnerHub,
      scrollMarkers,
      scrollWater,
      shaft,
      upperBearing,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      lowerBucketsAndUpperVanesIndependent: false,
      operatingDegreesOfFreedom: 1,
      voluteCasingRotates: false,
    },
    dynamics: {
      fluidPressureViscosityTurbulenceLeakageCavitationDetailedBladeLoadingBearingFrictionRunnerInertiaGeneratorLoadAndSpeedResponseModeled:
        false,
      lowerBucketAngularMomentumDiagnostic:
        'The additional lower-stage torque is mass flow times inlet-minus-outlet angular momentum as the inclined escape buckets reduce clockwise whirl. It is negative and adds to the clockwise upper-vane torque.',
      markerContinuity:
        'Scroll and lower-discharge markers each follow one centripetal Catmull-Rom path and fade to zero at their recycling endpoints.',
      upperVaneImpulseDiagnostic:
        'The casing-distributed upper-vane torque is normalized tangential water force times effective radius and is negative (clockwise).',
    },
    escapeFlowCurves,
    fidelity: 'authored',
    geometry,
    lowerBucketProfiles,
    mechanism:
      'Water enters fixed scroll casing b tangentially and circulates clockwise around the rotor. Because the volute confines and distributes it around the circumference, water impinges on all eight upper radial vanes a and carries their wheel clockwise. Four inclined buckets c occupy a lower axial level on the same runner; as water escapes downward through their openings, its reduced whirl adds a second clockwise torque. Both vane sets, hub, floor, shaft, and marker are one rigid runner, while the volute walls, inlet, bearings, flow paths, and basin remain fixed.',
    motion: {
      cycleDuration,
      inputAngularSpeed,
      runnerDirectionViewedInBrownPlan: 'clockwise',
      runnerRevolutionsPerCycle: 1,
    },
    scrollFlowCurve,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 437 page provides Brown’s static plan-view engraving and caption but contains no Canvas construction or source timing.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      lowerBuckets: sourceState.lowerBuckets.map((bucket) => ({
        center: bucket.center.clone(),
        worldAngle: bucket.worldAngle,
      })),
      radialVanes: sourceState.radialVanes.map((vane) => ({
        center: vane.center.clone(),
        worldAngle: vane.worldAngle,
      })),
      runnerAngle: sourceState.runnerAngle,
      voluteAngle: 0,
    },
    sourceReference: {
      brownPlate437: {
        approximateCasingOuterRadiusPixels: 229,
        approximateInclinedLowerBucketCount: 4,
        approximateRadialVaneCount: 8,
        approximateRunnerRadiusPixels: 134,
        centerApproximatePixels: [226, 285],
        imageHeight: 525,
        imageWidth: 525,
        inletThroatApproximatePixels: [116, 128],
        measurementUncertaintyPixels: 17,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the volute wheel has radial vanes a against which water impinges and carries the wheel around',
          'fixed scroll or volute casing b confines water so it acts on vanes all around the wheel',
          'inclined buckets c at the bottom add force as water escapes through their openings',
        ],
        engravingEvidence:
          'Brown’s plan shows a tangential upper-left inlet into a clockwise scroll, eight radial vane positions on the inner wheel, four shaded inclined bucket sectors beneath them, a central shaft, and a narrowing fixed casing with external mounting lugs.',
        reconstructionDisclosure:
          'Brown gives no dimensions, exact vane or lower-bucket counts, scroll law, blade profiles, axial spacing, flow rate, head, velocities, shaft speed, materials, losses, leakage, efficiency, inertia, or load. Eight radial vanes, four lower buckets, Archimedean-like decreasing-radius scroll, flow paths, normalized two-stage torque, dimensions, colors, and a 5.5-second cycle are independently engineered; the fixed volute b, circumferential impingement on radial vanes a, lower inclined outlet buckets c, added escape force, and clockwise scroll flow are source-grounded.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 437',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      lowerEscapeStage:
        'tau_lower=massFlow*(L_in-L_out)<0 and reinforces the upper-vane torque',
      rigidRunner:
        'all radial vanes a and inclined lower buckets c share runnerAngle',
      upperScrollStage:
        'tau_upper=-effectiveRadius*tangentialForce<0 around fixed volute b',
    },
    update,
    voluteRadiusAtProgress,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.36, -2.02, -4.18),
    new THREE.Vector3(4.72, 3.48, 4.18),
  );
  root.userData.cameraDistanceScale = 1.04;
  root.userData.cameraDirection = new THREE.Vector3(5.5, 7.8, 8.4);
  root.userData.groundFloorY = -2.02;
  root.userData.hideGround=true;
  root.userData.solidReview={qualification:'Finite working passages and shaft supports; water paths, nozzle flow and torque remain prescribed illustrations, without pressure, leakage, efficiency or load-response validation.'};
  root.traverse(object=>{for(const material of object.material?[].concat(object.material):[])material.fog=false;});
  root.userData.minimumDisplayCycleSeconds = cycleDuration;
  markShadows(root);
  casingFloor.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredVoluteWaterWheelMovement(movement) {
  if (movement.id !== 437) return null;
  return voluteWaterWheel(movement);
}
