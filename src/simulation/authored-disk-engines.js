import * as THREE from 'three';
import { circle, poly, polygonClipping as clip } from './finite-plate-geometry.js';
import { STEAM_COLORS, STEAM_OPACITY, steamMaterial } from './steam-section-kit.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  const remainder = value % modulus;
  if (remainder === 0) return 0;
  return remainder < 0 ? remainder + modulus : remainder;
}

function cylinderAlongX(radius, length, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
}

function cylinderAlongZ(radius, length, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function beamBetween3D(start, end, width, depth, material) {
  const delta = end.clone().sub(start);
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(delta.length(), width, depth),
    material,
  );
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.quaternion.setFromUnitVectors(
    X_AXIS,
    delta.clone().normalize(),
  );
  return beam;
}

function tubeThrough(points, radius, material, tubularSegments = 32) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  return new THREE.Mesh(
    new THREE.TubeGeometry(curve, tubularSegments, radius, 9, false),
    material,
  );
}

function normalizedVectorWithRates(raw, rawVelocity, rawAcceleration) {
  const length = raw.length();
  const lengthVelocity = raw.dot(rawVelocity) / length;
  const lengthAcceleration = (
    rawVelocity.lengthSq()
      + raw.dot(rawAcceleration)
      - lengthVelocity ** 2
  ) / length;
  const direction = raw.clone().multiplyScalar(1 / length);
  const velocity = rawVelocity.clone().multiplyScalar(1 / length)
    .addScaledVector(raw, -lengthVelocity / length ** 2);
  const acceleration = rawAcceleration.clone().multiplyScalar(1 / length)
    .addScaledVector(rawVelocity,
      -2 * lengthVelocity / length ** 2)
    .addScaledVector(raw,
      -lengthAcceleration / length ** 2
        + 2 * lengthVelocity ** 2 / length ** 3);
  return {
    acceleration,
    direction,
    length,
    lengthAcceleration,
    lengthVelocity,
    velocity,
  };
}

// The radial slit is parallel-sided: the fixed diaphragm keeps one thickness
// from the ball to the rim, so a wedge-shaped slot would pinch it near B.
function slottedDiscGeometry(radius, thickness, slotHalfWidth) {
  const shape = new THREE.Shape();
  const edgeAngle = Math.asin(slotHalfWidth / radius);
  shape.moveTo(0, slotHalfWidth);
  shape.lineTo(radius * Math.cos(edgeAngle), slotHalfWidth);
  shape.absarc(0, 0, radius, edgeAngle, FULL_TURN - edgeAngle, false);
  shape.lineTo(0, -slotHalfWidth);
  shape.lineTo(0, slotHalfWidth);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 80,
    depth: thickness,
    steps: 1,
  });
  geometry.translate(0, 0, -thickness / 2);
  // ExtrudeGeometry uses XY for the shape and Z for thickness. The moving
  // disk frame uses local X for its normal, local Y for the radial slot, and
  // local Z for the in-plane transverse direction.
  geometry.applyMatrix4(new THREE.Matrix4().set(
    0, 0, 1, 0,
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 0, 1,
  ));
  geometry.computeVertexNormals();
  return geometry;
}

function sphericalZoneGeometry(radius, halfAngle, segments = 28) {
  const axialSegments = Math.max(8, Math.round(segments * 0.7));
  const azimuthSegments = segments;
  const positions = [];
  const normals = [];
  const indices = [];
  for (let axialIndex = 0; axialIndex <= axialSegments;
    axialIndex += 1) {
    const axialAngle = THREE.MathUtils.lerp(
      -halfAngle,
      halfAngle,
      axialIndex / axialSegments,
    );
    for (let azimuthIndex = 0; azimuthIndex <= azimuthSegments;
      azimuthIndex += 1) {
      // Retain the rear half (z <= 0) as a cutaway shell.
      const azimuth = Math.PI
        + Math.PI * azimuthIndex / azimuthSegments;
      const x = radius * Math.sin(axialAngle);
      const radial = radius * Math.cos(axialAngle);
      const y = radial * Math.cos(azimuth);
      const z = radial * Math.sin(azimuth);
      positions.push(x, y, z);
      normals.push(x / radius, y / radius, z / radius);
    }
  }
  const rowLength = azimuthSegments + 1;
  for (let axialIndex = 0; axialIndex < axialSegments;
    axialIndex += 1) {
    for (let azimuthIndex = 0; azimuthIndex < azimuthSegments;
      azimuthIndex += 1) {
      const a = axialIndex * rowLength + azimuthIndex;
      const b = a + rowLength;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(
    positions,
    3,
  ));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(
    normals,
    3,
  ));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

// Closed solid made by revolving 2D regions (axial a, radius b >= 0) about
// X through the rear half-turn (z <= 0); the two cut faces lie in z = 0 and
// face the viewer, so the part reads as Brown's section. The region may
// change along the half-turn: `intervals` is a list of {phi0, phi1, region} covering
// [pi, 2pi] in order. Where the region changes, the step between the two
// regions is closed by flat radial faces (a port's walls, a divider's
// faces), so the solid stays watertight. Only the end caps on z = 0 take
// the section-face material group.
function revolvedRegionIntervalsGeometry(sourceIntervals, segmentsPerRadian = 30) {
  // Conform every ring to the union of all vertices, so the side surfaces of
  // neighbouring intervals and the step faces between them meet edge to
  // edge (no T-junctions).
  const steps = sourceIntervals.slice(1).map(({ region }, index) => [
    clip.difference(sourceIntervals[index].region, region),
    clip.difference(region, sourceIntervals[index].region),
  ]);
  const vertices = [];
  const collect = (multi) => multi.forEach((polygon) => polygon.forEach((ring) => ring.forEach((v) => vertices.push(v))));
  sourceIntervals.forEach(({ region }) => collect(region));
  steps.forEach(([a, b]) => { collect(a); collect(b); });
  const conform = (multi) => multi.map((polygon) => polygon.map((ring) => {
    const out = [];
    for (let i = 0; i < ring.length - 1; i += 1) {
      const [a0, b0] = ring[i], [a1, b1] = ring[i + 1];
      const da = a1 - a0, db = b1 - b0, lengthSq = da * da + db * db;
      out.push(ring[i]);
      if (lengthSq < 1e-20) continue;
      const inserted = [];
      for (const v of vertices) {
        const t = ((v[0] - a0) * da + (v[1] - b0) * db) / lengthSq;
        if (t <= 1e-9 || t >= 1 - 1e-9) continue;
        const off = Math.abs((v[0] - a0) * db - (v[1] - b0) * da) / Math.sqrt(lengthSq);
        if (off < 1e-9) inserted.push([t, v]);
      }
      inserted.sort((x, y) => x[0] - y[0]);
      for (const [, v] of inserted) {
        const last = out.at(-1);
        if (Math.hypot(v[0] - last[0], v[1] - last[1]) > 1e-12) out.push(v);
      }
    }
    out.push(ring.at(-1));
    return out;
  }));
  const intervals = sourceIntervals.map((interval) => ({ ...interval, region: conform(interval.region) }));
  const sidePositions = [], capPositions = [];
  const point = (a, b, phi) => [a, b * Math.cos(phi), b * Math.sin(phi)];
  const pushTriangle = (target, p, q, r, outward) => {
    const u = new THREE.Vector3(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
    const v = new THREE.Vector3(r[0] - p[0], r[1] - p[1], r[2] - p[2]);
    const normal = u.cross(v);
    if (normal.lengthSq() < 1e-20) return;
    if (normal.dot(outward) < 0) target.push(...p, ...r, ...q);
    else target.push(...p, ...q, ...r);
  };
  // Flat faces: ear-clip the raw polygon, then split each triangle at any
  // shared vertex lying inside one of its edges, so the faces meet the
  // conformed side strips edge to edge without zero-area slivers.
  const interiorVertex = (p, q) => {
    const da = q[0] - p[0], db = q[1] - p[1], lengthSq = da * da + db * db;
    let best = null;
    for (const v of vertices) {
      const t = ((v[0] - p[0]) * da + (v[1] - p[1]) * db) / lengthSq;
      if (t <= 1e-9 || t >= 1 - 1e-9) continue;
      if (Math.abs((v[0] - p[0]) * db - (v[1] - p[1]) * da) / Math.sqrt(lengthSq) >= 1e-9) continue;
      if (Math.hypot(v[0] - p[0], v[1] - p[1]) < 1e-12 || Math.hypot(v[0] - q[0], v[1] - q[1]) < 1e-12) continue;
      if (!best || Math.abs(t - 0.5) < Math.abs(best[0] - 0.5)) best = [t, v];
    }
    return best?.[1] ?? null;
  };
  const flatFaces = (polygons, phi, outward, target) => {
    const emit = (a, b, c, depth = 0) => {
      if (depth < 64) {
        for (const [p, q, r] of [[a, b, c], [b, c, a], [c, a, b]]) {
          const v = interiorVertex(p, q);
          if (v) { emit(p, v, r, depth + 1); emit(v, q, r, depth + 1); return; }
        }
      }
      pushTriangle(target, point(a[0], a[1], phi), point(b[0], b[1], phi), point(c[0], c[1], phi), outward);
    };
    for (const [outer, ...holes] of polygons) {
      const contour = outer.slice(0, -1).map(([a, b]) => new THREE.Vector2(a, b));
      const holeRings = holes.map((ring) => ring.slice(0, -1).map(([a, b]) => new THREE.Vector2(a, b)));
      const all = [...contour, ...holeRings.flat()].map((v) => [v.x, v.y]);
      for (const [i, j, k] of THREE.ShapeUtils.triangulateShape(contour, holeRings)) emit(all[i], all[j], all[k]);
    }
  };
  intervals.forEach(({ phi0, phi1, region }, index) => {
    const segments = Math.max(1, Math.ceil((phi1 - phi0) * segmentsPerRadian));
    const phis = Array.from({ length: segments + 1 }, (_, i) => phi0 + (phi1 - phi0) * i / segments);
    for (const polygon of region) {
      for (const ring of polygon) {
        const points = ring.slice(0, -1);
        for (let i = 0; i < points.length; i += 1) {
          const [a0, b0] = points[i], [a1, b1] = points[(i + 1) % points.length];
          let na = b1 - b0, nb = -(a1 - a0);
          const length = Math.hypot(na, nb);
          if (length < 1e-12) continue;
          na /= length; nb /= length;
          const ma = (a0 + a1) / 2 + na * 1e-4, mb = (b0 + b1) / 2 + nb * 1e-4;
          if (insideRegion(region, ma, mb)) { na = -na; nb = -nb; }
          for (let j = 0; j < segments; j += 1) {
            const phi = (phis[j] + phis[j + 1]) / 2;
            const outward = new THREE.Vector3(na, nb * Math.cos(phi), nb * Math.sin(phi));
            const p00 = point(a0, b0, phis[j]), p10 = point(a1, b1, phis[j]);
            const p01 = point(a0, b0, phis[j + 1]), p11 = point(a1, b1, phis[j + 1]);
            pushTriangle(sidePositions, p00, p10, p11, outward);
            pushTriangle(sidePositions, p00, p11, p01, outward);
          }
        }
      }
    }
    const raw = sourceIntervals[index].region;
    if (index === 0) flatFaces(raw, phi0, new THREE.Vector3(0, 0, 1), capPositions);
    if (index === intervals.length - 1) flatFaces(raw, phi1, new THREE.Vector3(0, 0, 1), capPositions);
    if (index > 0) {
      const [solidBefore, solidAfter] = steps[index - 1];
      const tangent = new THREE.Vector3(0, -Math.sin(phi0), Math.cos(phi0));
      flatFaces(solidBefore, phi0, tangent, sidePositions);
      flatFaces(solidAfter, phi0, tangent.clone().negate(), sidePositions);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([...sidePositions, ...capPositions], 3));
  geometry.addGroup(0, sidePositions.length / 3, 0);
  geometry.addGroup(sidePositions.length / 3, capPositions.length / 3, 1);
  geometry.computeVertexNormals();
  return geometry;
}

function insideRegion(polygons, a, b) {
  let inside = false;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [ai, bi] = ring[i], [aj, bj] = ring[j];
        if ((bi > b) !== (bj > b) && a < (aj - ai) * (b - bi) / (bj - bi) + ai) inside = !inside;
      }
    }
  }
  return inside;
}

function radialPartitionGeometry({
  ballRadius,
  chamberRadius,
  halfAngle,
  thickness,
}) {
  const samples = 28;
  const shape = new THREE.Shape();
  const outerStartX = -chamberRadius * Math.sin(halfAngle);
  const outerEndX = chamberRadius * Math.sin(halfAngle);
  for (let index = 0; index <= samples; index += 1) {
    const x = THREE.MathUtils.lerp(
      outerStartX,
      outerEndX,
      index / samples,
    );
    const y = Math.sqrt(Math.max(0, chamberRadius ** 2 - x ** 2));
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const innerEndX = ballRadius * Math.sin(halfAngle);
  const innerStartX = -innerEndX;
  shape.lineTo(
    innerEndX,
    Math.sqrt(ballRadius ** 2 - innerEndX ** 2),
  );
  for (let index = samples; index >= 0; index -= 1) {
    const x = THREE.MathUtils.lerp(
      innerStartX,
      innerEndX,
      index / samples,
    );
    const y = Math.sqrt(Math.max(0, ballRadius ** 2 - x ** 2));
    shape.lineTo(x, y);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 32,
    depth: thickness,
    steps: 1,
  });
  geometry.translate(0, 0, -thickness / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function diskEngine(movement) {
  const root = new THREE.Group();

  // Movement 347 has no official canvas animation and supplies no dimensions.
  // Its first visible phase is reconstructed from Brown's 525 px engraving.
  // The topology is independently confirmed by Reuleaux's conic double-slider
  // analysis and by the preserved Dakeyne model described by the Science
  // Museum: spherical zone, opposed conical heads, central ball, perpendicular
  // rod, crank socket, and a fixed radial diaphragm passing through a disk slot.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterBallCenter = new THREE.Vector2(321, 257);
  const sourceRasterCrankPin = new THREE.Vector2(115, 155);
  const sourceRasterDiscUpperRim = new THREE.Vector2(370, 130);
  const sourceRasterDiscLowerRim = new THREE.Vector2(277, 388);
  const sourceRasterChamberTop = new THREE.Vector2(329, 87);
  const sourceRasterChamberBottom = new THREE.Vector2(330, 423);
  const sourceDiscRadiusPixels = (
    sourceRasterDiscUpperRim.distanceTo(sourceRasterBallCenter)
      + sourceRasterDiscLowerRim.distanceTo(sourceRasterBallCenter)
  ) / 2;
  const chamberRadius = 2.4;
  const sourcePixelsPerModelUnit = sourceDiscRadiusPixels / chamberRadius;
  const sourceCrankVectorPixels = new THREE.Vector2(
    sourceRasterCrankPin.x - sourceRasterBallCenter.x,
    sourceRasterBallCenter.y - sourceRasterCrankPin.y,
  );
  const nutationHalfAngle = Math.atan2(
    Math.abs(sourceCrankVectorPixels.y),
    Math.abs(sourceCrankVectorPixels.x),
  );
  const pistonRodCrankLength = sourceCrankVectorPixels.length()
    / sourcePixelsPerModelUnit;
  const crankPlaneDistance = pistonRodCrankLength
    * Math.cos(nutationHalfAngle);
  const crankRadius = pistonRodCrankLength
    * Math.sin(nutationHalfAngle);
  const chamberAxialHalfLength = chamberRadius
    * Math.sin(nutationHalfAngle);
  const chamberJunctionRadius = chamberRadius
    * Math.cos(nutationHalfAngle);
  const centralBallRadius = 0.49;
  const pistonDiscBodyRadius = chamberRadius - 0.06;
  const pistonDiscThickness = 0.15;
  // A parallel slit 0.24 wide passes the 0.10 diaphragm at every tilt of the
  // disk (the dihedral angle never falls below 90 degrees minus beta).
  const radialSlotHalfWidth = 0.12;
  const radialSlotHalfAngle = Math.asin(radialSlotHalfWidth / pistonDiscBodyRadius);
  const radialPartitionThickness = 0.10;
  const counterRodLength = 2.75;
  const ballCenter = new THREE.Vector3(0, 2.85, 0);
  const crankCenter = new THREE.Vector3(
    ballCenter.x - crankPlaneDistance,
    ballCenter.y,
    ballCenter.z,
  );
  const demonstrationCyclesPerMinute = 15;
  const cyclePeriod = 60 / demonstrationCyclesPerMinute;
  const inputAngularSpeed = FULL_TURN / cyclePeriod;

  const stateAtInputAngle = (
    unwrappedInputAngle,
    resolvedInputAngularSpeed = inputAngularSpeed,
    inputAngularAcceleration = 0,
  ) => {
    const inputAngle = positiveModulo(unwrappedInputAngle, FULL_TURN);
    const sine = Math.sin(inputAngle);
    const cosine = Math.cos(inputAngle);
    const pointP = new THREE.Vector3(
      crankCenter.x,
      crankCenter.y + crankRadius * cosine,
      crankCenter.z + crankRadius * sine,
    );
    const pointPThetaDerivative = new THREE.Vector3(
      0,
      -crankRadius * sine,
      crankRadius * cosine,
    );
    const pointPThetaSecondDerivative = new THREE.Vector3(
      0,
      -crankRadius * cosine,
      -crankRadius * sine,
    );
    const pointPVelocity = pointPThetaDerivative.clone()
      .multiplyScalar(resolvedInputAngularSpeed);
    const pointPAcceleration = pointPThetaSecondDerivative.clone()
      .multiplyScalar(resolvedInputAngularSpeed ** 2)
      .addScaledVector(pointPThetaDerivative, inputAngularAcceleration);
    const diskNormal = pointP.clone().sub(ballCenter)
      .multiplyScalar(1 / pistonRodCrankLength);
    const diskNormalThetaDerivative = pointPThetaDerivative.clone()
      .multiplyScalar(1 / pistonRodCrankLength);
    const diskNormalThetaSecondDerivative =
      pointPThetaSecondDerivative.clone()
        .multiplyScalar(1 / pistonRodCrankLength);
    const diskNormalVelocity = diskNormalThetaDerivative.clone()
      .multiplyScalar(resolvedInputAngularSpeed);
    const diskNormalAcceleration = diskNormalThetaSecondDerivative.clone()
      .multiplyScalar(resolvedInputAngularSpeed ** 2)
      .addScaledVector(
        diskNormalThetaDerivative,
        inputAngularAcceleration,
      );

    // The fixed diaphragm is the rear horizontal half-plane through the
    // shaft axis (world XZ, z < 0), so it lies behind Brown's vertical
    // section and leaves the cut chamber open to view. Its intersection with
    // the moving disk is the disk's radial slot direction; choosing the sign
    // with negative Z keeps that one-sided slot on the physical diaphragm.
    const rawSlotDirection = new THREE.Vector3(
      -diskNormal.z,
      0,
      diskNormal.x,
    );
    const rawSlotVelocity = new THREE.Vector3(
      -diskNormalVelocity.z,
      0,
      diskNormalVelocity.x,
    );
    const rawSlotAcceleration = new THREE.Vector3(
      -diskNormalAcceleration.z,
      0,
      diskNormalAcceleration.x,
    );
    const slotState = normalizedVectorWithRates(
      rawSlotDirection,
      rawSlotVelocity,
      rawSlotAcceleration,
    );
    const transverseDirection = new THREE.Vector3()
      .crossVectors(diskNormal, slotState.direction).normalize();
    const transverseVelocity = new THREE.Vector3()
      .crossVectors(diskNormalVelocity, slotState.direction)
      .add(new THREE.Vector3().crossVectors(
        diskNormal,
        slotState.velocity,
      ));
    const transverseAcceleration = new THREE.Vector3()
      .crossVectors(diskNormalAcceleration, slotState.direction)
      .addScaledVector(
        new THREE.Vector3().crossVectors(
          diskNormalVelocity,
          slotState.velocity,
        ),
        2,
      )
      .add(new THREE.Vector3().crossVectors(
        diskNormal,
        slotState.acceleration,
      ));
    const diskAngularVelocity = new THREE.Vector3()
      .crossVectors(diskNormal, diskNormalVelocity)
      .add(new THREE.Vector3().crossVectors(
        slotState.direction,
        slotState.velocity,
      ))
      .add(new THREE.Vector3().crossVectors(
        transverseDirection,
        transverseVelocity,
      ))
      .multiplyScalar(0.5);
    const diskAngularAcceleration = new THREE.Vector3()
      .crossVectors(diskNormal, diskNormalAcceleration)
      .add(new THREE.Vector3().crossVectors(
        slotState.direction,
        slotState.acceleration,
      ))
      .add(new THREE.Vector3().crossVectors(
        transverseDirection,
        transverseAcceleration,
      ))
      .multiplyScalar(0.5);
    const rotationMatrix = new THREE.Matrix4().makeBasis(
      diskNormal,
      slotState.direction,
      transverseDirection,
    );
    const orientation = new THREE.Quaternion()
      .setFromRotationMatrix(rotationMatrix).normalize();

    const projectedAxis = X_AXIS.clone().addScaledVector(
      diskNormal,
      -X_AXIS.dot(diskNormal),
    ).normalize();
    const coneContactPlus = ballCenter.clone().addScaledVector(
      projectedAxis,
      chamberRadius,
    );
    const coneContactMinus = ballCenter.clone().addScaledVector(
      projectedAxis,
      -chamberRadius,
    );
    const slotOuterPoint = ballCenter.clone().addScaledVector(
      slotState.direction,
      chamberRadius,
    );

    return {
      crank: {
        angle: inputAngle,
        angularAcceleration: inputAngularAcceleration,
        angularVelocity: resolvedInputAngularSpeed,
        axis: X_AXIS.clone(),
      },
      disk: {
        angularAcceleration: diskAngularAcceleration,
        angularVelocity: diskAngularVelocity,
        coneContactMinus,
        coneContactPlus,
        normal: diskNormal,
        normalAcceleration: diskNormalAcceleration,
        normalVelocity: diskNormalVelocity,
        orientation,
        slotDirection: slotState.direction,
        slotDirectionAcceleration: slotState.acceleration,
        slotDirectionVelocity: slotState.velocity,
        slotOuterPoint,
        transverseDirection,
        transverseDirectionAcceleration: transverseAcceleration,
        transverseDirectionVelocity: transverseVelocity,
      },
      inputAngle,
      inputAngularAcceleration,
      inputAngularSpeed: resolvedInputAngularSpeed,
      pistonRod: {
        ballCenter: ballCenter.clone(),
        crankEnd: pointP,
        length: pointP.distanceTo(ballCenter),
        lengthError: pointP.distanceTo(ballCenter)
          - pistonRodCrankLength,
      },
      pointP,
      pointPAcceleration,
      pointPVelocity,
      unwrappedInputAngle,
    };
  };

  const stateAtCyclePhase = (phase) => stateAtInputAngle(
    FULL_TURN * phase,
    inputAngularSpeed,
    0,
  );
  const stateAtTime = (time) => {
    const state = stateAtInputAngle(inputAngularSpeed * time);
    state.phase = positiveModulo(time, cyclePeriod) / cyclePeriod;
    state.time = time;
    return state;
  };
  const canonicalTimes = {
    engravingPhase: 0,
    quarterTurn: cyclePeriod / 4,
    halfTurn: cyclePeriod / 2,
    threeQuarterTurn: cyclePeriod * 3 / 4,
    cycleClosure: cyclePeriod,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.18,
    roughness: 0.62,
  });
  const frameEdgeMaterial = matte(PALETTE.ink, {
    metalness: 0.22,
    roughness: 0.50,
  });
  const chamberMaterial = matte(PALETTE.driven, {
    opacity: 0.19,
    roughness: 0.70,
    side: THREE.DoubleSide,
    transparent: true,
  });
  chamberMaterial.depthWrite = false;
  const chamberRibMaterial = matte(PALETTE.frame, {
    metalness: 0.15,
    roughness: 0.58,
  });
  const diskMaterial = matte(PALETTE.driven, {
    metalness: 0.13,
    roughness: 0.57,
    side: THREE.DoubleSide,
  });
  const diskEdgeMaterial = matte(PALETTE.ink, {
    metalness: 0.20,
    roughness: 0.50,
  });
  const crankMaterial = matte(PALETTE.driver, {
    metalness: 0.18,
    roughness: 0.56,
  });
  const ballMaterial = matte(PALETTE.accent, {
    metalness: 0.19,
    roughness: 0.50,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role =
    'fixed-frame-conical-heads-spherical-zone-ball-seats-and-radial-diaphragm';
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(
      crankPlaneDistance + chamberAxialHalfLength + 2.6,
      0.24,
      5.45,
    ),
    frameMaterial,
  );
  base.position.set(
    (crankCenter.x + chamberAxialHalfLength) / 2 - 0.25,
    0.16,
    0,
  );
  base.userData.role = 'fixed-disc-engine-foundation';
  const baseEdge = new THREE.Mesh(
    new THREE.BoxGeometry(
      crankPlaneDistance + chamberAxialHalfLength + 2.85,
      0.07,
      5.67,
    ),
    frameEdgeMaterial,
  );
  baseEdge.position.set(base.position.x, 0.30, 0);
  baseEdge.userData.role = 'fixed-foundation-top-edge';
  fixedFrame.add(base, baseEdge);

  const fixedChamber = new THREE.Group();
  fixedChamber.position.copy(ballCenter);
  fixedChamber.userData.axis = X_AXIS.clone();
  fixedChamber.userData.role =
    'fixed-cutaway-disc-engine-chamber-about-central-ball';
  const sphericalZone = new THREE.Mesh(
    sphericalZoneGeometry(chamberRadius, nutationHalfAngle, 40),
    chamberMaterial,
  );
  sphericalZone.userData.role = 'fixed-rear-half-spherical-zone';
  const conicalHeads = [-1, 1].map((side, index) => {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(
        chamberJunctionRadius,
        chamberAxialHalfLength,
        64,
        1,
        true,
        Math.PI / 2,
        Math.PI,
      ),
      chamberMaterial,
    );
    cone.rotation.z = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    cone.position.x = side * chamberAxialHalfLength / 2;
    cone.userData.role = `fixed-opposed-conical-cylinder-head-${index + 1}`;
    fixedChamber.add(cone);
    return cone;
  });
  const chamberJunctionRings = [-1, 1].map((side, index) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(
        chamberJunctionRadius,
        0.055,
        9,
        72,
      ),
      chamberRibMaterial,
    );
    ring.rotation.y = Math.PI / 2;
    ring.position.x = side * chamberAxialHalfLength;
    ring.userData.role = `fixed-cone-to-spherical-zone-ring-${index + 1}`;
    fixedChamber.add(ring);
    return ring;
  });
  const centralSeatRings = [-1, 1].map((side, index) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(
        centralBallRadius * Math.cos(nutationHalfAngle),
        0.045,
        8,
        48,
      ),
      frameEdgeMaterial,
    );
    ring.rotation.y = Math.PI / 2;
    ring.position.x = side * centralBallRadius
      * Math.sin(nutationHalfAngle);
    ring.userData.role = `fixed-concentric-ball-seat-ring-${index + 1}`;
    fixedChamber.add(ring);
    return ring;
  });

  const chamberShellRibs = [];
  for (const azimuth of [Math.PI, Math.PI * 1.25, Math.PI * 1.5,
    Math.PI * 1.75, FULL_TURN]) {
    const points = [];
    for (let index = 0; index <= 18; index += 1) {
      const axialAngle = THREE.MathUtils.lerp(
        -nutationHalfAngle,
        nutationHalfAngle,
        index / 18,
      );
      points.push(new THREE.Vector3(
        chamberRadius * Math.sin(axialAngle),
        chamberRadius * Math.cos(axialAngle) * Math.cos(azimuth),
        chamberRadius * Math.cos(axialAngle) * Math.sin(azimuth),
      ));
    }
    const rib = tubeThrough(points, 0.027, chamberRibMaterial, 24);
    rib.userData.role = 'fixed-spherical-zone-meridian-rib';
    fixedChamber.add(rib);
    chamberShellRibs.push(rib);
  }
  const coneGeneratorRibs = [];
  for (const side of [-1, 1]) {
    for (const azimuth of [Math.PI, Math.PI * 1.25, Math.PI * 1.5,
      Math.PI * 1.75, FULL_TURN]) {
      const direction = new THREE.Vector3(
        side * Math.sin(nutationHalfAngle),
        Math.cos(nutationHalfAngle) * Math.cos(azimuth),
        Math.cos(nutationHalfAngle) * Math.sin(azimuth),
      );
      const rib = beamBetween3D(
        direction.clone().multiplyScalar(centralBallRadius),
        direction.clone().multiplyScalar(chamberRadius),
        0.035,
        0.035,
        chamberRibMaterial,
      );
      rib.userData.role = `fixed-conical-head-generator-rib-${side}`;
      fixedChamber.add(rib);
      coneGeneratorRibs.push(rib);
    }
  }
  const fixedPartition = new THREE.Mesh(
    radialPartitionGeometry({
      ballRadius: centralBallRadius + 0.004,
      chamberRadius,
      halfAngle: nutationHalfAngle,
      thickness: radialPartitionThickness,
    }),
    frameMaterial,
  );
  // The diaphragm stands in the rear horizontal half-plane (local XZ,
  // z < 0), out of the section plane that Brown cuts.
  fixedPartition.geometry.rotateX(-Math.PI / 2);
  fixedPartition.userData.role =
    'fixed-radial-diaphragm-through-piston-disc-slot';
  const partitionFace = new THREE.Mesh(
    radialPartitionGeometry({
      ballRadius: centralBallRadius + 0.025,
      chamberRadius: chamberRadius - 0.025,
      halfAngle: nutationHalfAngle,
      thickness: 0.012,
    }),
    ballMaterial,
  );
  partitionFace.position.z = radialPartitionThickness / 2 + 0.008;
  partitionFace.userData.role = 'visible-fixed-radial-diaphragm-face';
  fixedChamber.add(sphericalZone, fixedPartition, partitionFace);
  fixedFrame.add(fixedChamber);

  const chamberFeet = [-1, 1].map((side, index) => {
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.28, 1.02),
      frameMaterial,
    );
    foot.position.set(
      side * (chamberAxialHalfLength + 0.28),
      0.43,
      -0.36,
    );
    foot.userData.role = `fixed-chamber-foot-${index + 1}`;
    fixedFrame.add(foot);
    return foot;
  });
  const chamberCradle = tubeThrough(
    Array.from({ length: 25 }, (_, index) => {
      const angle = Math.PI + Math.PI * index / 24;
      return new THREE.Vector3(
        0,
        ballCenter.y + (chamberRadius + 0.13) * Math.sin(angle),
        (chamberRadius + 0.13) * Math.cos(angle) - 0.10,
      );
    }),
    0.095,
    frameMaterial,
    40,
  );
  chamberCradle.userData.role = 'fixed-lower-chamber-cradle';
  fixedFrame.add(chamberCradle);

  const inputCrank = new THREE.Group();
  inputCrank.position.copy(crankCenter);
  inputCrank.userData.axis = X_AXIS.clone();
  inputCrank.userData.role =
    'rotating-output-shaft-flywheel-and-crank-arm';
  const crankShaft = cylinderAlongX(0.21, 2.45,
    frameEdgeMaterial, 40);
  crankShaft.position.x = -0.36;
  crankShaft.userData.role = 'rotating-horizontal-output-shaft';
  const flywheelRim = new THREE.Mesh(
    new THREE.TorusGeometry(1.72, 0.13, 12, 72),
    crankMaterial,
  );
  flywheelRim.rotation.y = Math.PI / 2;
  flywheelRim.position.x = -0.52;
  flywheelRim.userData.role = 'rotating-output-flywheel-rim';
  const flywheelSpokes = [];
  for (let index = 0; index < 6; index += 1) {
    const angle = index * Math.PI / 3;
    const spoke = beamBetween3D(
      new THREE.Vector3(-0.52, 0, 0),
      new THREE.Vector3(
        -0.52,
        1.50 * Math.cos(angle),
        1.50 * Math.sin(angle),
      ),
      0.11,
      0.09,
      crankMaterial,
    );
    spoke.userData.role = `rotating-flywheel-spoke-${index + 1}`;
    inputCrank.add(spoke);
    flywheelSpokes.push(spoke);
  }
  const crankHub = cylinderAlongX(0.39, 0.50,
    frameEdgeMaterial, 40);
  crankHub.position.x = -0.31;
  crankHub.userData.role = 'rotating-output-shaft-hub';
  const crankArm = beamBetween3D(
    new THREE.Vector3(0.13, 0, 0),
    new THREE.Vector3(0.13, crankRadius, 0),
    0.27,
    0.22,
    crankMaterial,
  );
  crankArm.userData.role = 'rotating-crank-arm-O-P';
  const crankSocket = cylinderAlongX(0.28, 0.48,
    crankMaterial, 36);
  crankSocket.position.set(0.13, crankRadius, 0);
  crankSocket.userData.role = 'rotating-socket-at-crank-pin-P';
  const crankPinAnchor = new THREE.Object3D();
  crankPinAnchor.position.set(0, crankRadius, 0);
  crankPinAnchor.userData.role = 'analytic-crank-pin-center-P';
  const crankIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 20, 12),
    whiteMaterial,
  );
  crankIndex.position.set(-0.67, 1.72, 0);
  crankIndex.userData.role = 'flywheel-angular-index';
  inputCrank.add(
    crankShaft,
    flywheelRim,
    crankHub,
    crankArm,
    crankSocket,
    crankPinAnchor,
    crankIndex,
  );
  root.add(inputCrank);

  const crankBearings = [-1, 1].map((side, index) => {
    const bearing = cylinderAlongX(0.36, 0.30,
      frameEdgeMaterial, 38);
    bearing.position.set(
      crankCenter.x - 0.36 + side * 0.90,
      crankCenter.y,
      crankCenter.z,
    );
    bearing.userData.role = `fixed-output-shaft-bearing-${index + 1}`;
    const standardHeight = crankCenter.y - 0.34;
    const standard = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, standardHeight, 0.70),
      frameMaterial,
    );
    standard.position.set(
      bearing.position.x,
      0.34 + standardHeight / 2,
      -0.03,
    );
    standard.userData.role = `fixed-output-shaft-standard-${index + 1}`;
    fixedFrame.add(bearing, standard);
    return { bearing, standard };
  });
  root.add(fixedFrame);

  const diskAssembly = new THREE.Group();
  diskAssembly.position.copy(ballCenter);
  diskAssembly.userData.role =
    'nutating-non-free-spinning-slotted-disc-ball-and-piston-rod';
  const pistonDisc = new THREE.Mesh(
    slottedDiscGeometry(
      pistonDiscBodyRadius,
      pistonDiscThickness,
      radialSlotHalfWidth,
    ),
    diskMaterial,
  );
  pistonDisc.userData.role =
    'nutating-circular-piston-disc-with-one-radial-slot';
  const diskRimPoints = [];
  for (let index = 0; index <= 72; index += 1) {
    const sealEndAngle = Math.asin((radialSlotHalfWidth + 0.07) / pistonDiscBodyRadius);
    const angle = THREE.MathUtils.lerp(
      sealEndAngle,
      FULL_TURN - sealEndAngle,
      index / 72,
    );
    diskRimPoints.push(new THREE.Vector3(
      0,
      pistonDiscBodyRadius * Math.cos(angle),
      pistonDiscBodyRadius * Math.sin(angle),
    ));
  }
  const diskRimSeal = tubeThrough(
    diskRimPoints,
    chamberRadius - pistonDiscBodyRadius,
    diskEdgeMaterial,
    90,
  );
  diskRimSeal.userData.role =
    'moving-disc-peripheral-seal-in-spherical-zone';
  const slotLips = [-1, 1].map((side, index) => {
    const lipZ = side * (radialSlotHalfWidth + 0.0225);
    const lip = beamBetween3D(
      new THREE.Vector3(0, Math.sqrt(centralBallRadius ** 2 - lipZ ** 2), lipZ),
      new THREE.Vector3(0, Math.sqrt((pistonDiscBodyRadius - 0.13) ** 2 - lipZ ** 2), lipZ),
      0.045,
      0.045,
      diskEdgeMaterial,
    );
    lip.userData.role = `moving-radial-slot-lip-${index + 1}`;
    diskAssembly.add(lip);
    return lip;
  });
  const pistonBall = new THREE.Mesh(
    new THREE.SphereGeometry(centralBallRadius, 40, 24),
    ballMaterial,
  );
  pistonBall.userData.role =
    'moving-central-ball-attached-to-piston-disc';
  const crankSideRod = cylinderAlongX(0.105,
    pistonRodCrankLength - centralBallRadius * 0.45,
    ballMaterial, 30);
  crankSideRod.position.x = (
    pistonRodCrankLength + centralBallRadius * 0.45
  ) / 2;
  crankSideRod.userData.role =
    'rigid-piston-rod-from-central-ball-to-crank-socket';
  const counterSideRod = cylinderAlongX(0.10,
    counterRodLength - centralBallRadius * 0.45,
    ballMaterial, 30);
  counterSideRod.position.x = -(
    counterRodLength + centralBallRadius * 0.45
  ) / 2;
  counterSideRod.userData.role =
    'rigid-opposite-piston-rod-extension';
  const crankEndBall = new THREE.Mesh(
    new THREE.SphereGeometry(0.235, 28, 18),
    ballMaterial,
  );
  crankEndBall.position.x = pistonRodCrankLength;
  crankEndBall.userData.role = 'moving-ball-in-crank-pin-socket-P';
  const crankEndAnchor = new THREE.Object3D();
  crankEndAnchor.position.x = pistonRodCrankLength;
  crankEndAnchor.userData.role = 'analytic-piston-rod-crank-end-P';
  const centralBallAnchor = new THREE.Object3D();
  centralBallAnchor.userData.role = 'analytic-fixed-center-of-moving-ball-B';
  const slotOuterAnchor = new THREE.Object3D();
  slotOuterAnchor.position.y = chamberRadius;
  slotOuterAnchor.userData.role = 'analytic-outer-end-of-radial-disc-slot';
  const discIndex = new THREE.Mesh(
    new THREE.BoxGeometry(
      pistonDiscThickness + 0.025,
      pistonDiscBodyRadius * 0.82,
      0.075,
    ),
    whiteMaterial,
  );
  discIndex.position.set(
    pistonDiscThickness / 2 + 0.018,
    -pistonDiscBodyRadius * 0.49,
    0,
  );
  discIndex.userData.role = 'fixed-to-disc-roll-index';
  diskAssembly.add(
    pistonDisc,
    diskRimSeal,
    pistonBall,
    crankSideRod,
    counterSideRod,
    crankEndBall,
    crankEndAnchor,
    centralBallAnchor,
    slotOuterAnchor,
    discIndex,
  );
  root.add(diskAssembly);

  const coneContactMarkers = [-1, 1].map((side, index) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 20, 12),
      whiteMaterial,
    );
    marker.userData.role = `moving-cone-generator-contact-marker-${index + 1}`;
    root.add(marker);
    return marker;
  });

  const contacts = {
    centralBallInConcentricSeats: {
      fixedMember: fixedChamber,
      movingMember: diskAssembly,
      point: ballCenter.clone(),
      type: 'spherical-pair-central-ball-in-fixed-concentric-seats-B',
    },
    diskFacesAtConicalHeads: {
      members: [diskAssembly, fixedChamber],
      points: [new THREE.Vector3(), new THREE.Vector3()],
      type: 'two-moving-generator-lines-on-opposed-fixed-conical-heads',
    },
    diskRimInSphericalZone: {
      center: ballCenter.clone(),
      fixedMember: fixedChamber,
      movingMember: diskAssembly,
      nominalRadius: chamberRadius,
      type: 'nutating-peripheral-seal-on-fixed-spherical-zone',
    },
    pistonRodAtCrankSocket: {
      members: [diskAssembly, inputCrank],
      point: new THREE.Vector3(),
      type: 'spherical-pair-piston-rod-end-in-rotating-crank-socket-P',
    },
    radialSlotOnFixedDiaphragm: {
      fixedMember: fixedPartition,
      movingMember: diskAssembly,
      outerPoint: new THREE.Vector3(),
      planeNormal: Z_AXIS.clone(),
      type: 'sliding-radial-slot-over-fixed-diaphragm-in-rear-world-XZ-half-plane',
    },
    shaftBearings: {
      fixedMember: fixedFrame,
      movingMember: inputCrank,
      point: crankCenter.clone(),
      type: 'fixed-revolute-output-shaft-bearings-about-X',
    },
  };

  const update = (time) => {
    const state = stateAtTime(time);
    inputCrank.rotation.x = state.inputAngle;
    inputCrank.userData.angularSpeed = state.inputAngularSpeed;
    inputCrank.userData.angularAcceleration =
      state.inputAngularAcceleration;
    diskAssembly.quaternion.copy(state.disk.orientation);
    diskAssembly.userData.angularVelocity =
      state.disk.angularVelocity.clone();
    diskAssembly.userData.angularAcceleration =
      state.disk.angularAcceleration.clone();
    coneContactMarkers[0].position.copy(state.disk.coneContactMinus);
    coneContactMarkers[1].position.copy(state.disk.coneContactPlus);
    contacts.diskFacesAtConicalHeads.points[0]
      .copy(state.disk.coneContactMinus);
    contacts.diskFacesAtConicalHeads.points[1]
      .copy(state.disk.coneContactPlus);
    contacts.pistonRodAtCrankSocket.point.copy(state.pointP);
    contacts.radialSlotOnFixedDiaphragm.outerPoint
      .copy(state.disk.slotOuterPoint);
    root.userData.kinematics = state;
  };

  const modelPointToReferenceRaster = (point) => new THREE.Vector2(
    sourceRasterBallCenter.x
      + (point.x - ballCenter.x) * sourcePixelsPerModelUnit,
    sourceRasterBallCenter.y
      - (point.y - ballCenter.y) * sourcePixelsPerModelUnit,
  );

  const geometry = {
    ballCenter,
    centralBallRadius,
    chamberAxialHalfLength,
    chamberJunctionRadius,
    chamberRadius,
    counterRodLength,
    crankCenter,
    crankPlaneDistance,
    crankRadius,
    cyclePeriod,
    inputAngularSpeed,
    nutationHalfAngle,
    pistonDiscBodyRadius,
    pistonDiscThickness,
    pistonRodCrankLength,
    radialPartitionThickness,
    radialSlotHalfAngle,
    radialSlotHalfWidth,
    sourceDiscRadiusPixels,
    sourcePixelsPerModelUnit,
  };

  root.userData.archetype =
    'nutating-disc-steam-engine-ball-joint-crank';
  root.userData.blocks = {
    base,
    baseEdge,
    centralBallAnchor,
    centralSeatRings,
    chamberCradle,
    chamberFeet,
    chamberJunctionRings,
    chamberShellRibs,
    coneContactMarkers,
    coneGeneratorRibs,
    conicalHeads,
    counterSideRod,
    crankArm,
    crankBearings,
    crankEndAnchor,
    crankEndBall,
    crankHub,
    crankIndex,
    crankPinAnchor,
    crankShaft,
    crankSideRod,
    discIndex,
    diskAssembly,
    diskRimSeal,
    fixedChamber,
    fixedFrame,
    fixedPartition,
    flywheelRim,
    flywheelSpokes,
    inputCrank,
    partitionFace,
    pistonBall,
    pistonDisc,
    slotLips,
    slotOuterAnchor,
    sphericalZone,
  };
  root.userData.cameraDistanceScale = 1.16;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(crankCenter.x - 1.85, 0, -2.72),
    new THREE.Vector3(chamberAxialHalfLength + 2.75,
      ballCenter.y + chamberRadius + 0.30, 2.72),
  );
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.contacts = contacts;
  root.userData.degreesOfFreedom = {
    input:
      'one rotating crankshaft coordinate; steam power may drive the same coordinate in the reverse causal direction',
    mechanism: 1,
    output:
      'one disk normal precessing on a fixed cone while its radial slot remains on the fixed diaphragm plane',
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = geometry;
  root.userData.groundFloorY = 0;
  root.userData.mechanism =
    'fixed-spherical-zone-and-opposed-conical-heads-central-ball-B-slotted-nutating-disc-rigid-perpendicular-piston-rod-B-P-socketed-to-crank-P-on-horizontal-output-shaft-with-fixed-radial-diaphragm-preventing-free-disc-spin';
  root.userData.modelPointToReferenceRaster = modelPointToReferenceRaster;
  root.userData.sourceAnimation = {
    available: false,
    demonstrationCyclesPerMinute,
    demonstrationDurationSeconds: cyclePeriod,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    reason:
      'the official Movement 347 page marks Animated unavailable and contains no canvas model; the four-second loop is an explicit demonstration tempo, not a claimed source speed',
    referenceScope:
      'Brown fixes the edgewise nutating disk, opposed conical heads, central ball and crank-connected perpendicular rod. Reuleaux and the preserved Dakeyne model independently fix the spherical peripheral zone and the otherwise omitted fixed radial diaphragm and matching one-sided disk slot.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    brownPlate347: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology:
        'one edgewise circular disk fixed perpendicular to a rod through central ball B; its left end reaches a crank pin while the fixed chamber supplies opposed cones and a spherical peripheral wall',
      measurementUncertaintyPixels: 20,
      rasterBallCenter: sourceRasterBallCenter,
      rasterChamberBottom: sourceRasterChamberBottom,
      rasterChamberTop: sourceRasterChamberTop,
      rasterCrankPin: sourceRasterCrankPin,
      rasterDiscLowerRim: sourceRasterDiscLowerRim,
      rasterDiscUpperRim: sourceRasterDiscUpperRim,
    },
    reuleauxConicDoubleSlider: {
      author: 'Franz Reuleaux',
      construction:
        'Davies disc engine is chamber gear from the conic turning double-slider; the plane disc has spherical center and peripheral surfaces, its faces envelope two cones, and its radial slit or packed sliding block works over a fixed chamber diaphragm.',
      pages: [386, 388, 389],
      plate: 'XXVIII, figures 1–3',
      publication: 'The Kinematics of Machinery',
      publicationYear: 1876,
      url: 'https://en.wikisource.org/wiki/Page:The_Kinematics_of_Machinery.djvu/408',
    },
    scienceMuseumDakeyneModel: {
      collectionNumber: '1893-172',
      construction:
        'spherical lateral zone, opposed cones meeting at their apexes, circular disc with central ball, perpendicular rod socketed in a crank, fixed radial partition, and corresponding disc slot',
      institution: 'Science Museum Group',
      url: 'https://collection.sciencemuseumgroup.org.uk/objects/co51101/model-of-disc-engine',
    },
    officialDescription: movement.description,
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      edition: 21,
      publicationYear: 1908,
    },
    reconstruction: {
      crankPlaneDistance,
      crankRadius,
      dimensionalStatus:
        'proportional normalization from engraving landmarks; Brown supplies no dimensions',
      nutationHalfAngle,
      pistonRodCrankLength,
      sourcePixelsPerModelUnit,
    },
  };
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtInputAngle = stateAtInputAngle;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    chamberContact:
      'the disk rim remains on the sphere |X-B|=R while its two faces touch one generator of each opposed cone',
    crankConstraint:
      'P=B+L n lies on the crank circle P=(-D, r cos(theta), r sin(theta)) with L^2=D^2+r^2',
    diaphragmConstraint:
      'the one-sided disk slot follows normalized (-n_z,0,n_x), exactly the intersection of the disk plane n·(X-B)=0 with the fixed rear XZ diaphragm half-plane behind the section',
    motion:
      'uniform shaft rotation makes disk normal n precess at constant half-angle beta; the fixed diaphragm controls roll, so the disk nutates rather than freely spinning about n',
    powerFlow:
      'steam alternately expands on opposite disk faces and can drive the crankshaft; the visualization parameterizes that reversible one-DOF relation by shaft angle',
  };

  // Brown's plate is a section on the vertical plane through the shaft. The
  // fixed casing is therefore built as one closed solid revolved through its
  // rear half only: conical heads meeting the ball in concentric seats, the
  // spherical zone, the outer skin and the two flat end plates, each head
  // opened where the rod sweeps its cone. The moving disk, ball and rod stay
  // whole in front of the cut, as Brown draws them.
  const sectionClearance = 0.003;
  const headWall = 0.10;
  const casingWall = 0.12;
  const seatWall = 0.12;
  const casingOuterRadius = chamberRadius + casingWall;
  const casingEndX = 1.36 * chamberAxialHalfLength;
  const tanBeta = Math.tan(nutationHalfAngle);
  const cosBeta = Math.cos(nutationHalfAngle);
  const coneOffset = (pistonDiscThickness / 2 + 0.004) / cosBeta;
  const headOffset = coneOffset + headWall / cosBeta;
  const far = 20;
  const rect = (a0, b0, a1, b1) => poly([[a0, b0], [a1, b0], [a1, b1], [a0, b1]]);
  const halfDisk = (radius) => clip.intersection(poly(circle([0, 0], radius, 256)), rect(-far, 0, far, far));
  const cavity = clip.intersection(
    poly([[-coneOffset, 0], [coneOffset, 0], [coneOffset + far * tanBeta, far], [-coneOffset - far * tanBeta, far]]),
    halfDisk(chamberRadius + sectionClearance),
  );
  const headInterior = (side) => clip.difference(
    clip.intersection(
      poly([[side * headOffset, 0], [side * far, 0], [side * far, far], [side * (headOffset + far * tanBeta), far]]),
      rect(-(casingEndX - casingWall), 0, casingEndX - casingWall, casingOuterRadius - casingWall),
    ),
    halfDisk(centralBallRadius + seatWall),
  );
  const rodOpening = (side, rodRadius) => {
    const lift = (rodRadius + 0.025) / cosBeta;
    return poly([[0, 0], [side * far, 0], [side * far, far * tanBeta + lift], [0, lift]]);
  };
  const casingRegion = clip.difference(
    rect(-casingEndX, 0, casingEndX, casingOuterRadius),
    cavity, headInterior(-1), headInterior(1),
    halfDisk(centralBallRadius + 0.006),
    rodOpening(-1, 0.105), rodOpening(1, 0.10),
  );
  const zoneRegion = clip.difference(
    rect(-(chamberAxialHalfLength + 0.25), 0, chamberAxialHalfLength + 0.25, casingOuterRadius + 1),
    halfDisk(chamberRadius + sectionClearance - 0.0005),
  );
  const casingMaterial = matte(PALETTE.frame, { metalness: 0.16, roughness: 0.62 });
  // Brown hatches the cut; the flat section faces take the dark ink tone.
  const sectionFaceMaterial = matte(PALETTE.ink, { metalness: 0.10, roughness: 0.70 });
  const setGeometry = (mesh, geometry) => {
    mesh.geometry.dispose();
    mesh.geometry = geometry;
    mesh.position.set(0, 0, 0);
    mesh.rotation.set(0, 0, 0);
    mesh.material = [casingMaterial, sectionFaceMaterial];
  };
  sphericalZone.userData.role = 'fixed-rear-half-spherical-zone-and-outer-skin-section';
  // Ports (pass 71, reworked in pass 72). Each conical head is pierced by
  // two rectangular ports just clear of the diaphragm: the admission port
  // above it and the eduction port below. Each side of the disk lies against
  // one cone, so each cone's ports serve that side alone.
  // Pass 72: Brown's hollow behind each head is open, with the rod in it, and
  // his section shows no chest there. Each port therefore opens into a steam
  // passage cored inside the head wall: it runs up the middle of the wall to
  // the solid corner where head, zone and outer skin meet, then straight out
  // through the outer skin at the back, where the supply and exhaust pipes
  // (not drawn by Brown) would join. The passages lie only in the ports'
  // sectors near the diaphragm, so the section plane never meets them.
  const diaphragmPhi = 1.5 * Math.PI;
  const portInner = 1.75, portOuter = 2.0;
  const portNear = THREE.MathUtils.degToRad(4.5), portFar = THREE.MathUtils.degToRad(19);
  const passageTop = 2.30;
  const passageHalfWidth = 0.0225;
  const wallMiddle = (radius) => (coneOffset + headOffset) / 2 + radius * tanBeta;
  const portPassage = (side) => clip.union(
    poly([
      [side * (coneOffset + portInner * tanBeta - 0.03), portInner],
      [side * wallMiddle(portInner), portInner],
      [side * wallMiddle(portOuter), portOuter],
      [side * (coneOffset + portOuter * tanBeta - 0.03), portOuter],
    ]),
    poly([
      [side * (wallMiddle(portInner) - passageHalfWidth), portInner],
      [side * (wallMiddle(portInner) + passageHalfWidth), portInner],
      [side * (wallMiddle(passageTop) + passageHalfWidth), passageTop],
      [side * (wallMiddle(passageTop) + passageHalfWidth), casingOuterRadius + 0.05],
      [side * (wallMiddle(passageTop) - passageHalfWidth), casingOuterRadius + 0.05],
      [side * (wallMiddle(passageTop) - passageHalfWidth), passageTop],
    ]),
  );
  const passages = clip.union(portPassage(-1), portPassage(1));
  const portedIntervals = (region, ported) => [
    { phi0: Math.PI, phi1: diaphragmPhi - portFar, region },
    { phi0: diaphragmPhi - portFar, phi1: diaphragmPhi - portNear, region: ported },
    { phi0: diaphragmPhi - portNear, phi1: diaphragmPhi + portNear, region },
    { phi0: diaphragmPhi + portNear, phi1: diaphragmPhi + portFar, region: ported },
    { phi0: diaphragmPhi + portFar, phi1: 2 * Math.PI, region },
  ];
  const zoneSection = clip.intersection(casingRegion, zoneRegion);
  setGeometry(sphericalZone, revolvedRegionIntervalsGeometry(
    portedIntervals(zoneSection, clip.difference(zoneSection, passages))));
  conicalHeads.forEach((head, index) => {
    const side = index === 0 ? -1 : 1;
    const halfPlane = side < 0 ? rect(-far, 0, 0, far) : rect(0, 0, far, far);
    const open = clip.intersection(clip.difference(casingRegion, zoneRegion), halfPlane);
    setGeometry(head, revolvedRegionIntervalsGeometry(
      portedIntervals(open, clip.difference(open, portPassage(side)))));
    head.userData.ports = { admission: [diaphragmPhi + portNear, diaphragmPhi + portFar],
      eduction: [diaphragmPhi - portFar, diaphragmPhi - portNear], radial: [portInner, portOuter],
      passage: { top: passageTop, halfWidth: passageHalfWidth } };
  });
  const chestSteam = [];
  root.userData.blocks.chestSteam = chestSteam;
  // The section solid replaces the former translucent shells, rib lines and
  // rings, the cradle and the white contact and roll indices.
  for (const hidden of [...chamberJunctionRings, ...centralSeatRings, ...chamberShellRibs,
    ...coneGeneratorRibs, partitionFace, chamberCradle, ...chamberFeet, discIndex,
    ...coneContactMarkers, crankIndex, crankArm, ...flywheelSpokes,
    // The ink slot lips were a dark rim lying flush on the slot walls
    // (coplanar faces); the slot is cut in the disk itself.
    ...slotLips]) hidden.visible = false;
  fixedPartition.material = casingMaterial;

  // Brown's "crank-arm or fly-wheel" is a solid wheel seen edgewise, the rod
  // end socketed in it; the shaft runs left to a pedestal bearing.
  const flywheelRadius = ballCenter.y - 0.40;
  const flywheelBack = -0.78, flywheelFront = -0.26;
  flywheelRim.geometry.dispose();
  flywheelRim.geometry = new THREE.CylinderGeometry(flywheelRadius, flywheelRadius,
    flywheelFront - flywheelBack, 96).rotateZ(Math.PI / 2);
  flywheelRim.rotation.set(0, 0, 0);
  flywheelRim.position.set((flywheelBack + flywheelFront) / 2, 0, 0);
  flywheelRim.userData.role = 'rotating-solid-flywheel-carrying-the-rod-socket';
  const socketDirection = new THREE.Vector3(crankPlaneDistance, -crankRadius, 0).normalize();
  const cavityTop = Math.sqrt(0.241 ** 2 - 0.125 ** 2);
  const socketProfile = [new THREE.Vector2(0, -0.36), new THREE.Vector2(0.32, -0.36),
    new THREE.Vector2(0.32, 0.30), new THREE.Vector2(0.125, 0.30), new THREE.Vector2(0.125, cavityTop)];
  const topAngle = Math.atan2(cavityTop, 0.125);
  for (let i = 1; i <= 24; i++) {
    const angle = THREE.MathUtils.lerp(topAngle, -Math.PI / 2, i / 24);
    socketProfile.push(new THREE.Vector2(Math.max(0, 0.241 * Math.cos(angle)), 0.241 * Math.sin(angle)));
  }
  crankSocket.geometry.dispose();
  crankSocket.geometry = new THREE.LatheGeometry(socketProfile, 48);
  crankSocket.rotation.set(0, 0, 0);
  crankSocket.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), socketDirection);
  crankSocket.position.set(0, crankRadius, 0);
  crankSocket.userData.role = 'rotating-cup-socket-at-crank-pin-P-around-the-rod-end-ball';
  crankShaft.geometry.dispose();
  crankShaft.geometry = new THREE.CylinderGeometry(0.21, 0.21, 2.5, 40);
  crankShaft.position.set(-1.55, 0, 0);
  const bearingOffsets = [-1.2, -2.5];
  crankBearings.forEach(({ bearing, standard }, index) => {
    const x = crankCenter.x + bearingOffsets[index];
    bearing.geometry.dispose();
    bearing.geometry = new THREE.LatheGeometry([new THREE.Vector2(0.216, 0.15),
      new THREE.Vector2(0.216, -0.15), new THREE.Vector2(0.40, -0.15),
      new THREE.Vector2(0.40, 0.15), new THREE.Vector2(0.216, 0.15)], 48);
    bearing.position.set(x, crankCenter.y, crankCenter.z);
    bearing.userData.boreRadius = 0.21;
    standard.position.x = x;
    standard.geometry.dispose();
    const standardHeight = crankCenter.y - 0.40 - 0.30;
    standard.geometry = new THREE.BoxGeometry(0.34, standardHeight, 0.70);
    standard.position.y = 0.30 + standardHeight / 2;
    standard.position.z = 0;
  });
  // Brown draws no base: the left pedestal and the right standard both run
  // off the bottom of the plate. One pedestal bearing (the far one) carries
  // the shaft; the base, its edge and the near standard are hidden.
  const standardFootY = -3.0;
  base.visible = false;
  baseEdge.visible = false;
  crankBearings[0].bearing.visible = false;
  crankBearings[0].standard.visible = false;
  {
    const { standard } = crankBearings[1];
    const standardHeight = crankCenter.y - 0.40 - standardFootY;
    standard.geometry.dispose();
    standard.geometry = new THREE.BoxGeometry(0.34, standardHeight, 0.70);
    standard.position.y = standardFootY + standardHeight / 2;
  }
  // A pedestal under the casing, behind the section plane.
  const casingPedestal = new THREE.Mesh(
    new THREE.BoxGeometry(2 * casingEndX, ballCenter.y - casingOuterRadius + 0.10 - standardFootY, 1.4),
    casingMaterial,
  );
  casingPedestal.position.set(0, (standardFootY + ballCenter.y - casingOuterRadius + 0.10) / 2, -0.85);
  casingPedestal.userData.role = 'fixed-casing-pedestal-behind-section';
  // Brown leaves the space under the casing open; the casing is carried by
  // the right-hand standard, so the pedestal is kept only for offline checks.
  casingPedestal.visible = false;
  fixedFrame.add(casingPedestal);
  // Brown's hatched right-hand standard beyond the casing end, cut by the
  // section plane. Its top stops below the cone swept by the rod's
  // right-hand end (radius x tan(beta) plus the rod and collar).
  const rightStandardLeft = casingEndX;
  const rightStandardRight = casingEndX + 0.72;
  const rightStandardTop = ballCenter.y
    - (rightStandardRight * Math.tan(nutationHalfAngle) + 0.26);
  const rightStandard = new THREE.Mesh(
    new THREE.BoxGeometry(rightStandardRight - rightStandardLeft,
      rightStandardTop - standardFootY, 0.70),
    [casingMaterial, casingMaterial, casingMaterial, casingMaterial,
      sectionFaceMaterial, casingMaterial],
  );
  rightStandard.position.set((rightStandardLeft + rightStandardRight) / 2,
    (rightStandardTop + standardFootY) / 2, -0.35);
  rightStandard.userData.fixed = true;
  rightStandard.userData.role = 'fixed-right-hand-standard-in-section';
  fixedFrame.add(rightStandard);

  // Brown's rod carries a square collar near each end, the two joined by a
  // bow arching over the casing. The bow and collars are fast to the rod and
  // disk, so they only wobble through the nutation half-angle and stay above
  // the casing (whose farthest corner is well inside the bow radius).
  const bowRadius = 3.15;
  counterSideRod.geometry.dispose();
  const counterLength = bowRadius + 0.36;
  counterSideRod.geometry = new THREE.CylinderGeometry(0.10, 0.10,
    counterLength - centralBallRadius * 0.45, 30).rotateZ(Math.PI / 2);
  counterSideRod.rotation.set(0, 0, 0);
  counterSideRod.position.set(-(counterLength + centralBallRadius * 0.45) / 2, 0, 0);
  const collarMaterial = pistonBall.material;
  const rodCollars = [1, -1].map((side, index) => {
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.44, 0.50), collarMaterial);
    collar.position.set(side * bowRadius, 0, 0);
    collar.userData.role = `moving-square-collar-on-rod-end-${index + 1}`;
    diskAssembly.add(collar);
    return collar;
  });
  const bowPoints = [];
  const bowStart = Math.asin(0.20 / bowRadius);
  for (let index = 0; index <= 96; index += 1) {
    const angle = THREE.MathUtils.lerp(bowStart, Math.PI - bowStart, index / 96);
    // Local -Z (minus the disk's transverse axis) is up in Brown's view.
    bowPoints.push(new THREE.Vector3(bowRadius * Math.cos(angle), 0, -bowRadius * Math.sin(angle)));
  }
  const bowSection = new THREE.Shape();
  bowSection.absarc(0, 0, 0.11, 0, Math.PI * 2, false);
  const rodBow = new THREE.Mesh(new THREE.ExtrudeGeometry(bowSection, {
    bevelEnabled: false, curveSegments: 16, steps: 128,
    extrudePath: new THREE.CatmullRomCurve3(bowPoints),
  }), collarMaterial);
  rodBow.userData.role = 'moving-bow-linking-the-rod-end-collars';
  diskAssembly.add(rodBow);
  Object.assign(root.userData.blocks, { casingPedestal, rightStandard, rodBow, rodCollars });
  // The chamber is a half-section on z = 0; the disk, its seal and slot lips
  // inside it are cut on the same fixed plane (as Brown draws the disk as a
  // section line), so no half of the disk hangs outside the housing. The
  // ball, rod, bow and collars stay whole, in front of the cut.
  {
    const localCut = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
    const worldCut = localCut.clone();
    const clipped = [];
    root.traverse((object) => {
      if (!object.isMesh) return;
      if (!/^(?:nutating-circular-piston-disc|moving-disc-peripheral-seal|moving-radial-slot-lip)/.test(object.userData.role ?? '')) return;
      object.material = object.material.clone();
      object.material.clippingPlanes = [worldCut];
      object.material.side = THREE.DoubleSide;
      object.onBeforeRender = () => { worldCut.copy(localCut).applyMatrix4(root.matrixWorld); };
      clipped.push(object);
    });
    root.userData.localClippingEnabled = true;
    root.userData.sectionClippedParts = clipped.map((object) => object.userData.role);
  }
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(crankCenter.x - 2.0, 0.1, -0.4),
    new THREE.Vector3(bowRadius + 0.5, ballCenter.y + bowRadius + 0.2, 0.4),
  );
  root.userData.hideGround = true;
  root.userData.cameraDistanceScale = 1.0;
  root.userData.cameraFov = 12;
  Object.assign(geometry, { casingEndX, casingOuterRadius, coneOffset, flywheelRadius });

  // Steam in the rear half of the chamber (pass 71). The working space is
  // the zone between the two cones, the ball and the sphere. The disk
  // splits it into two sides, each touching one cone along a line (the
  // pinch) that travels round the axis with the crank. The fixed diaphragm
  // (the rear horizontal half-plane) cuts each side into two cells: the one
  // behind the travelling pinch, just above the diaphragm, grows and takes
  // live steam from the admission side; the one ahead of the pinch is swept
  // out through the eduction side below the diaphragm. Both sides work, their
  // pinches half a turn apart, so the engine has no dead point. The cells
  // are rebuilt every frame from the disk position; only the rear half
  // (behind Brown's section plane) is shown, as translucent volumes.
  const steamGroup = new THREE.Group();
  steamGroup.position.copy(ballCenter);
  steamGroup.userData.role = 'steam-volumes-in-rear-half-of-disk-chamber';
  root.add(steamGroup);
  // Each volume stands a few thousandths clear of the walls it fills, so its
  // faces never coincide with the casting's.
  const steamInner = centralBallRadius + 0.02;
  const steamOuter = chamberRadius - 0.012;
  const steamFaceOffset = pistonDiscThickness / 2 + 0.012;
  const partitionHalf = radialPartitionThickness / 2 + 0.012;
  const coneSine = coneOffset * Math.cos(nutationHalfAngle) - 0.008;
  const steamCells = [];
  const cellSegments = { u: 40, lambda: 8, r: 4 };
  const cellCapacity = 4 * 6 * (2 * cellSegments.u * cellSegments.lambda
    + 2 * cellSegments.u * cellSegments.r + 2 * cellSegments.lambda * cellSegments.r);
  // One volume per side of the disk; its admission and eduction cells meet
  // at the pinch, so when the pinch crosses the diaphragm the full live
  // space simply becomes the eduction cell (per-vertex colour and alpha).
  for (const side of [1, -1]) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(cellCapacity * 3);
    const colors = new Float32Array(cellCapacity * 4);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)
      .setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(cellCapacity * 3), 3)
      .setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4)
      .setUsage(THREE.DynamicDrawUsage));
    geometry.setDrawRange(0, 0);
    const material = steamMaterial('live');
    material.side = THREE.DoubleSide;
    material.vertexColors = true;
    material.color.set(0xffffff);
    material.opacity = 1;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.role = `steam-in-working-space-on-${side > 0 ? 'crank' : 'far'}-side-of-disk`;
    mesh.userData.steamVolume = true;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.renderOrder = 2;
    mesh.frustumCulled = false;
    steamGroup.add(mesh);
    steamCells.push({ side, mesh, positions, colors });
  }
  // Latitude interval (lambda from the YZ plane toward +X) of side `side` of
  // the disk at radius r and azimuth phi (about X from +Y toward +Z).
  const latitudeInterval = (normal, side, r, phi) => {
    const coneLimit = nutationHalfAngle + Math.asin(Math.min(1, coneSine / r));
    const a = normal.x;
    const c = normal.y * Math.cos(phi) + normal.z * Math.sin(phi);
    const magnitude = Math.hypot(a, c);
    const k = Math.min(1, steamFaceOffset / (r * magnitude));
    const delta = Math.atan2(c, a);
    const base = side > 0
      ? [Math.asin(k) - delta, Math.PI - Math.asin(k) - delta]
      : [-Math.PI + Math.asin(k) - delta, -Math.asin(k) - delta];
    let best = null;
    for (const shift of [-2 * Math.PI, 0, 2 * Math.PI]) {
      const lo = Math.max(-coneLimit, base[0] + shift);
      const hi = Math.min(coneLimit, base[1] + shift);
      if (hi > lo && (!best || hi - lo > best[1] - best[0])) best = [lo, hi];
    }
    if (best) return best;
    // Pinched: collapse onto the cone that the disk face has just crossed.
    let edge = coneLimit, gap = Infinity;
    for (const shift of [-2 * Math.PI, 0, 2 * Math.PI]) {
      const lo = base[0] + shift, hi = base[1] + shift;
      if (lo >= coneLimit && lo - coneLimit < gap) { gap = lo - coneLimit; edge = coneLimit; }
      if (hi <= -coneLimit && -coneLimit - hi < gap) { gap = -coneLimit - hi; edge = -coneLimit; }
    }
    return [edge, edge];
  };
  const steamPoint = (normal, side, u, b, r, out) => {
    // u is the azimuth measured from the diaphragm (phi = -pi/2) toward +phi.
    let phi = u - Math.PI / 2;
    let [lo, hi] = latitudeInterval(normal, side, r, phi);
    let lambda = lo + (hi - lo) * b;
    out.set(r * Math.sin(lambda), r * Math.cos(lambda) * Math.cos(phi), r * Math.cos(lambda) * Math.sin(phi));
    return out;
  };
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3();
  const tmpD = new THREE.Vector3(), edge1 = new THREE.Vector3(), edge2 = new THREE.Vector3();
  const faceNormal = new THREE.Vector3(), hintVector = new THREE.Vector3();
  const tmpE = new THREE.Vector3(), tmpF = new THREE.Vector3();
  // Azimuth of the diaphragm face at (r, lambda) on the admission (+) or
  // eduction (-) side, and of the section plane z = 0.
  const partitionU = (r, sign) => {
    const half = Math.asin(Math.min(1, partitionHalf / (r * Math.cos(nutationHalfAngle))));
    return sign > 0 ? half : 2 * Math.PI - half;
  };
  const liveColor = new THREE.Color(STEAM_COLORS.live);
  const exhaustColor = new THREE.Color(STEAM_COLORS.exhaust);
  const pieceColor = new THREE.Color();
  const buildPiece = (cell, normal, pieces) => {
    const { positions, colors } = cell;
    const normals = cell.mesh.geometry.attributes.normal.array;
    let count = 0;
    let alpha = 1;
    const push = (v) => {
      positions[count * 3] = v.x; positions[count * 3 + 1] = v.y; positions[count * 3 + 2] = v.z;
      colors[count * 4] = pieceColor.r; colors[count * 4 + 1] = pieceColor.g;
      colors[count * 4 + 2] = pieceColor.b; colors[count * 4 + 3] = alpha;
      count += 1;
    };
    // Quads wound outward: `hint` points out of the cell at this face.
    const quad = (a, b, c, d, hint) => {
      edge1.subVectors(c, a); edge2.subVectors(d, b);
      faceNormal.crossVectors(edge1, edge2);
      if (faceNormal.lengthSq() < 1e-12) return;
      faceNormal.normalize();
      const order = faceNormal.dot(hint) < 0 ? [a, c, b, a, d, c] : [a, b, c, a, c, d];
      if (faceNormal.dot(hint) < 0) faceNormal.negate();
      for (const v of order) {
        normals[count * 3] = faceNormal.x; normals[count * 3 + 1] = faceNormal.y; normals[count * 3 + 2] = faceNormal.z;
        push(v);
      }
    };
    for (const [uStart, uEnd, pressure] of pieces) {
      pieceColor.copy(exhaustColor).lerp(liveColor, pressure);
      alpha = THREE.MathUtils.lerp(STEAM_OPACITY.exhaust, STEAM_OPACITY.live, pressure);
      const uAt = (a, r) => {
        const start = typeof uStart === 'function' ? uStart(r) : uStart;
        const end = typeof uEnd === 'function' ? uEnd(r) : uEnd;
        return start + (end - start) * a;
      };
      const radiusAt = (c) => steamInner + (steamOuter - steamInner) * c;
      const point = (a, b, c, out) => {
        const r = radiusAt(c);
        return steamPoint(normal, cell.side, uAt(a, r), b, r, out);
      };
      const { u: nu, lambda: nl, r: nr } = cellSegments;
      const hint = (face, inner) => hintVector.subVectors(face, inner);
      // Inner and outer spherical faces.
      for (const c of [0, 1]) for (let i = 0; i < nu; i += 1) for (let j = 0; j < nl; j += 1) {
        quad(point(i / nu, j / nl, c, tmpA), point((i + 1) / nu, j / nl, c, tmpB),
          point((i + 1) / nu, (j + 1) / nl, c, tmpC), point(i / nu, (j + 1) / nl, c, tmpD),
          hint(point((i + 0.5) / nu, (j + 0.5) / nl, c, tmpE), point((i + 0.5) / nu, (j + 0.5) / nl, 0.5, tmpF)));
      }
      // Disk face and cone face (their outward sense from the radial
      // direction of latitude, which stays defined where a cell pinches).
      for (const b of [0, 1]) for (let i = 0; i < nu; i += 1) for (let k = 0; k < nr; k += 1) {
        const lambdaSign = b === 1 ? 1 : -1;
        point((i + 0.5) / nu, b, (k + 0.5) / nr, tmpE);
        const radial = Math.hypot(tmpE.y, tmpE.z) || 1;
        // d/dlambda of (r sin l, r cos l cos phi, r cos l sin phi) ~ (cos l, -sin l cos phi, -sin l sin phi)
        const r = tmpE.length() || 1;
        hintVector.set(radial / r, -tmpE.x * tmpE.y / (r * radial), -tmpE.x * tmpE.z / (r * radial))
          .multiplyScalar(lambdaSign);
        quad(point(i / nu, b, k / nr, tmpA), point((i + 1) / nu, b, k / nr, tmpB),
          point((i + 1) / nu, b, (k + 1) / nr, tmpC), point(i / nu, b, (k + 1) / nr, tmpD), hintVector);
      }
      // Diaphragm, section-plane or pinch ends (outward along -/+ azimuth).
      for (const a of [0, 1]) for (let j = 0; j < nl; j += 1) for (let k = 0; k < nr; k += 1) {
        point(a, (j + 0.5) / nl, (k + 0.5) / nr, tmpE);
        hintVector.set(0, -tmpE.z, tmpE.y).multiplyScalar(a === 1 ? 1 : -1);
        quad(point(a, j / nl, k / nr, tmpA), point(a, (j + 1) / nl, k / nr, tmpB),
          point(a, (j + 1) / nl, (k + 1) / nr, tmpC), point(a, j / nl, (k + 1) / nr, tmpD), hintVector);
      }
    }
    const geometry = cell.mesh.geometry;
    geometry.setDrawRange(0, count);
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.normal.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    cell.mesh.visible = count > 0;
  };
  const steamRelease = THREE.MathUtils.degToRad(24);
  const updateSteam = (state) => {
    const normal = state.disk.normal;
    const psi = Math.atan2(normal.z, normal.y);
    const upper = [(r) => partitionU(r, 1), Math.PI / 2];
    const lower = [3 * Math.PI / 2, (r) => partitionU(r, -1)];
    for (const cell of steamCells) {
      // Side +1 is pinched where the disk meets the -X cone (phi = psi),
      // side -1 where it meets the +X cone (phi = psi + pi).
      const pinchPhi = cell.side > 0 ? psi : psi + Math.PI;
      const pinchU = positiveModulo(pinchPhi + Math.PI / 2, FULL_TURN);
      const pieces = [];
      const clampPiece = ([s0, s1], lo, hi, pressure) => {
        // Intersect [s0, s1] (possibly r-dependent ends) with [lo, hi].
        const numeric = (v) => (typeof v === 'function' ? v(steamOuter) : v);
        const start = numeric(s0) >= lo ? s0 : lo;
        const end = numeric(s1) <= hi ? s1 : hi;
        if (numeric(end) - numeric(start) > 1e-4) pieces.push([start, end, pressure]);
      };
      // The cell behind the pinch holds live steam; just after the pinch
      // crosses the diaphragm the full cell opens to eduction and blows down.
      const eductionPressure = 1 - THREE.MathUtils.smoothstep(pinchU, 0, steamRelease);
      clampPiece(upper, 0, pinchU, 1);
      clampPiece(lower, 0, pinchU, 1);
      clampPiece(upper, pinchU, FULL_TURN, eductionPressure);
      clampPiece(lower, pinchU, FULL_TURN, eductionPressure);
      buildPiece(cell, normal, pieces);
      cell.mesh.userData.eductionPressure = eductionPressure;
      cell.mesh.userData.pinchU = pinchU;
    }
  };
  const updateWithSteam = (time) => {
    update(time);
    updateSteam(root.userData.kinematics);
  };
  Object.assign(root.userData.blocks, { steamCells: steamCells.map((cell) => cell.mesh), steamGroup });

  updateWithSteam(0);
  markShadows(root);
  for (const part of [...steamCells.map((cell) => cell.mesh), ...chestSteam]) { part.castShadow = false; part.receiveShadow = false; }
  // The key light falls from above the section plane, so the casing's own
  // upper wall would black out the upper half of the opened chamber. The
  // cut casing is lit but takes no cast shadows, so both halves read open.
  for (const part of [sphericalZone, ...conicalHeads]) part.receiveShadow = false;
  return {
    cameraDirection: new THREE.Vector3(0, 0.03, 1),
    root,
    update: updateWithSteam,
  };
}

export function createAuthoredDiskEngineMovement(movement) {
  switch (movement.id) {
    case 347: return diskEngine(movement);
    default: return null;
  }
}
