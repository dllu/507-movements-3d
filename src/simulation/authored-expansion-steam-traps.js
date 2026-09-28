import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';
import { WaterStream, guidedPath } from './water-stream.js';
import {applyCutawayFor} from './cutaway-presentations.js';
import {cutFaceMaterial} from './cutaway-section.js';
import {plate} from './finite-plate-geometry.js';
import {horizontalPlate} from './horizontal-turbine-solids.js';
import {fitPistonGuide} from './piston-guide-parts.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

// Triangle soup with analytic vertex normals. Each triangle is wound to
// agree with its normals, so every surface faces outward from the material.
function surfaceBuffer() {
  const positions = [], normals = [];
  const cross = new THREE.Vector3(), ab = new THREE.Vector3(), ac = new THREE.Vector3();
  const tri = (a, b, c, na, nb, nc) => {
    ab.subVectors(b, a);ac.subVectors(c, a);cross.crossVectors(ab, ac);
    if (cross.lengthSq() < 1e-20) return;
    if (cross.x * (na.x + nb.x + nc.x) + cross.y * (na.y + nb.y + nc.y)
      + cross.z * (na.z + nb.z + nc.z) < 0) {[b, c] = [c, b];[nb, nc] = [nc, nb];}
    for (const v of [a, b, c]) positions.push(v.x, v.y, v.z);
    for (const n of [na, nb, nc]) normals.push(n.x, n.y, n.z);
  };
  return {positions, normals, tri, get count() {return positions.length / 3;}};
}

// A lathe of profile polylines ([radius, height] points, each polyline one
// smooth piece; corners fall between pieces). Pieces run so that the material
// lies on their left, which makes (dh, -dr) the outward normal. `frame` maps
// (radius, height, angle) to a point and (normal radius, normal height, angle)
// to a direction.
function latheInto(buffer, pieces, frame, phiStart, phiLength, segments) {
  for (const piece of pieces) {
    const count = piece.length;
    const segmentNormal = (i) => {
      const [ar, ah] = piece[i], [br, bh] = piece[i + 1];
      const length = Math.hypot(br - ar, bh - ah);
      return [(bh - ah) / length, -(br - ar) / length];
    };
    const vertexNormals = piece.map((_, i) => {
      const a = i > 0 ? segmentNormal(i - 1) : null, b = i < count - 1 ? segmentNormal(i) : null;
      const n = a && b ? [a[0] + b[0], a[1] + b[1]] : (a ?? b);
      const length = Math.hypot(n[0], n[1]);
      return [n[0] / length, n[1] / length];
    });
    const ring = (i, s) => {
      const phi = phiStart + phiLength * s / segments;
      return [frame.point(piece[i][0], piece[i][1], phi),
        frame.normal(vertexNormals[i][0], vertexNormals[i][1], phi)];
    };
    for (let i = 0; i < count - 1; i += 1) {
      for (let s = 0; s < segments; s += 1) {
        const [a, na] = ring(i, s), [b, nb] = ring(i + 1, s),
          [c, nc] = ring(i + 1, s + 1), [d, nd] = ring(i, s + 1);
        buffer.tri(a, b, c, na, nb, nc);buffer.tri(a, c, d, na, nc, nd);
      }
    }
  }
}

// Lathe frames: about the x axis through (0, y0, 0), or about the vertical
// through (x0, *, 0). Angles are chosen by the caller; the back half z <= 0 is
// phi in [pi, 2 pi] about x and [pi/2, 3 pi/2] about y.
const xAxisFrame = (y0 = 0) => ({
  point: (r, h, phi) => new THREE.Vector3(h, y0 + r * Math.cos(phi), r * Math.sin(phi)),
  normal: (nr, nh, phi) => new THREE.Vector3(nh, nr * Math.cos(phi), nr * Math.sin(phi)),
});
const yAxisFrame = (x0 = 0) => ({
  point: (r, h, phi) => new THREE.Vector3(x0 + r * Math.sin(phi), h, r * Math.cos(phi)),
  normal: (nr, nh, phi) => new THREE.Vector3(nr * Math.sin(phi), nh, nr * Math.cos(phi)),
});

function latheGeometry(pieces, frame, phiStart = 0, phiLength = FULL_TURN, segments = 96) {
  const buffer = surfaceBuffer();
  latheInto(buffer, pieces, frame, phiStart, phiLength, segments);
  return toGeometry(buffer);
}

function toGeometry(...groups) {
  const geometry = new THREE.BufferGeometry();
  const total = groups.reduce((sum, buffer) => sum + buffer.positions.length, 0);
  const positions = new Float32Array(total), normals = new Float32Array(total);
  let start = 0;
  groups.forEach((buffer, index) => {
    positions.set(buffer.positions, start * 3);normals.set(buffer.normals, start * 3);
    geometry.addGroup(start, buffer.count, index);start += buffer.count;
  });
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  if (groups.length === 1) geometry.clearGroups();
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return geometry;
}

// The back half (z <= 0) of a sphere of the given radius about `center`,
// with round holes where cylinders of radius `radius` along the unit `axis`
// directions (each lying in the plane z = 0) leave it. It is charted by
// (alpha, beta) about -z, whose rim alpha = pi / 2 is the section plane. Each
// chart cell is clipped against the holes' chart outlines, and every vertex
// takes the exact radial normal, so the surface shades smoothly. The chart
// has extra beta lines through the points where the holes meet the rim.
// Returns the rim's beta nodes and, per hole, the ordered boundary vertices,
// so the section face and the hubs can share the very same vertices.
const SPHERE_BETA_START = -0.75 * Math.PI;
const SPHERE_BETA_STEPS = 192;
function sphereBackInto(buffer, center, radius, holes, inward) {
  const alphaSteps = 48, beta0 = SPHERE_BETA_START;
  const direction = (alpha, beta) => new THREE.Vector3(Math.sin(alpha) * Math.cos(beta),
    Math.sin(alpha) * Math.sin(beta), -Math.cos(alpha));
  const place = ([a, b]) => direction(a, b).multiplyScalar(radius).add(center);
  const chains = holes.map(() => new Map());
  const betaOf = (d) => {
    const beta = Math.atan2(d.y, d.x);
    return beta < beta0 ? beta + FULL_TURN : beta;
  };
  const rimBetas = [];
  const outlines = holes.map(({axis, radius: holeRadius}) => {
    const a = new THREE.Vector3(...axis).normalize();
    const u = new THREE.Vector3().crossVectors(a, new THREE.Vector3(0, 0, 1)).normalize();
    const v = new THREE.Vector3().crossVectors(a, u);
    const sinH = holeRadius / radius, cosH = Math.sqrt(1 - sinH * sinH), ring = [];
    const samples = 1024;
    for (let i = 0; i < samples; i += 1) {
      const t = FULL_TURN * i / samples;
      const d = a.clone().multiplyScalar(cosH).addScaledVector(u, sinH * Math.cos(t)).addScaledVector(v, sinH * Math.sin(t));
      const point = [Math.acos(THREE.MathUtils.clamp(-d.z, -1, 1)), betaOf(d)];
      if (i === 0 || i === samples / 2) {point[0] = Math.PI / 2;rimBetas.push(point[1]);}
      ring.push(point);
    }
    ring.push(ring[0]);
    const box = ring.reduce((m, [x, y]) => [Math.min(m[0], x), Math.min(m[1], y), Math.max(m[2], x), Math.max(m[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);
    return {polygon: [ring], box, axis: a, holeRadius};
  });
  const betas = [...Array.from({length: SPHERE_BETA_STEPS + 1}, (_, j) => beta0 + FULL_TURN * j / SPHERE_BETA_STEPS),
    ...rimBetas].sort((p, q) => p - q).filter((b, i, all) => i === 0 || b - all[i - 1] > 1e-9);
  const note = (chart, position) => {
    outlines.forEach(({axis, holeRadius}, h) => {
      const offset = position.clone().sub(center);
      const along = offset.dot(axis);
      if (along > 0 && Math.abs(offset.addScaledVector(axis, -along).length() - holeRadius) < 1e-4) {
        chains[h].set(position.toArray().map((x) => x.toFixed(9)).join(), position);
      }
    });
  };
  const emit = (points, noteBoundary) => {
    const positions = points.map(place);
    if (noteBoundary) positions.forEach((p, k) => note(points[k], p));
    const normals = positions.map((p) => {
      const n = p.clone().sub(center).normalize();
      return inward ? n.negate() : n;
    });
    buffer.tri(...positions, ...normals);
  };
  for (let i = 0; i < alphaSteps; i += 1) {
    const a0 = Math.PI / 2 * i / alphaSteps, a1 = i === alphaSteps - 1 ? Math.PI / 2 : Math.PI / 2 * (i + 1) / alphaSteps;
    for (let j = 0; j < betas.length - 1; j += 1) {
      const b0 = betas[j], b1 = betas[j + 1];
      const hits = outlines.filter(({box}) => box[0] < a1 && box[2] > a0 && box[1] < b1 && box[3] > b0);
      if (!hits.length) {
        emit([[a0, b0], [a1, b0], [a1, b1]]);emit([[a0, b0], [a1, b1], [a0, b1]]);
        continue;
      }
      const cell = [[[a0, b0], [a1, b0], [a1, b1], [a0, b1], [a0, b0]]];
      for (const polygon of polygonClipping.difference(cell, ...hits.map(({polygon}) => polygon))) {
        const [outer, ...inner] = polygon.map((ring) => ring.slice(0, -1).map(([x, y]) => new THREE.Vector2(x, y)));
        const all = [...outer, ...inner.flat()];
        for (const [p, q, r] of THREE.ShapeUtils.triangulateShape(outer, inner)) {
          emit([p, q, r].map((k) => [all[k].x, all[k].y]), true);
        }
      }
    }
  }
  return {betas, chains: chains.map((chain) => [...chain.values()])};
}

// Rings of lathe vertices over the angles `phis` (one ring per profile
// point), joined into strips; rings of unequal sampling are zipped by angle.
function latheRing(frame, r, h, phis, [nr, nh], positions = null) {
  return phis.map((phi, k) => ({phi, p: positions ? positions[k] : frame.point(r, h, phi), n: frame.normal(nr, nh, phi)}));
}
function stripInto(buffer, a, b) {
  if (a.length === b.length) {
    for (let k = 0; k < a.length - 1; k += 1) {
      buffer.tri(a[k].p, b[k].p, b[k + 1].p, a[k].n, b[k].n, b[k + 1].n);
      buffer.tri(a[k].p, b[k + 1].p, a[k + 1].p, a[k].n, b[k + 1].n, a[k + 1].n);
    }
    return;
  }
  let i = 0, j = 0;
  while (i < a.length - 1 || j < b.length - 1) {
    if (j === b.length - 1 || (i < a.length - 1 && a[i + 1].phi <= b[j + 1].phi)) {
      buffer.tri(a[i].p, b[j].p, a[i + 1].p, a[i].n, b[j].n, a[i + 1].n);i += 1;
    } else {
      buffer.tri(a[i].p, b[j].p, b[j + 1].p, a[i].n, b[j].n, b[j + 1].n);j += 1;
    }
  }
}
// Ordered angles (and the vertices themselves) of a hole chain about an axis.
function chainAngles(chain, angleOf, low) {
  const entries = chain.map((p) => {
    let phi = angleOf(p);
    while (phi < low - 1e-9) phi += FULL_TURN;
    return {phi, p};
  }).sort((x, y) => x.phi - y.phi);
  return {phis: entries.map((e) => e.phi), positions: entries.map((e) => e.p)};
}

// A flat face in the plane z = 0 (normal +z) over simple polygons given as
// [x, y] rings (no repeated closing point).
function sectionFaceInto(buffer, rings, z = 0) {
  const normal = new THREE.Vector3(0, 0, 1);
  for (const ring of rings) {
    const outer = ring.map(([x, y]) => new THREE.Vector2(x, y));
    for (const [p, q, r] of THREE.ShapeUtils.triangulateShape(outer, [])) {
      buffer.tri(...[p, q, r].map((k) => new THREE.Vector3(outer[k].x, outer[k].y, z)), normal, normal, normal);
    }
  }
}

function ringNormalToX(radius, tubeRadius, material, role) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tubeRadius, 24, 96),
    material,
  );
  ring.rotation.y = Math.PI / 2;
  ring.userData.role = role;
  return ring;
}

function rayExpansionSteamTrap(movement) {
  const root = new THREE.Group();
  const cycleDuration = 8;

  // Brown supplies construction and state order, but no dimensions, material,
  // temperatures, pressures, or timing. These SI assumptions are exposed.
  // Thermal motion alone is greatly magnified in the display.
  const coolTemperatureKelvin = 330;
  const hotTemperatureKelvin = 430;
  const temperatureSwingKelvin = hotTemperatureKelvin
    - coolTemperatureKelvin;
  const pipeFreeLengthMetre = 0.45;
  const pipeLinearExpansionPerKelvin = 12e-6;
  const adjustedColdGapMetre = 0.00036;
  const thermalMotionDisplayScaleSceneUnitPerMetre = 800;
  const maximumFreeExpansionMetre = pipeLinearExpansionPerKelvin
    * pipeFreeLengthMetre * temperatureSwingKelvin;
  const closingTemperatureKelvin = coolTemperatureKelvin
    + adjustedColdGapMetre
      / (pipeLinearExpansionPerKelvin * pipeFreeLengthMetre);

  const inletPressurePascal = 165000;
  const outletPressurePascal = 101325;
  const condensateDensityKilogramPerCubicMetre = 988;
  const dischargeCoefficient = 0.64;
  const pipeInsideDiameterMetre = 0.018;
  const pipeBoreAreaSquareMetre = Math.PI
    * (pipeInsideDiameterMetre / 2) ** 2;
  const pressureDropPascal = inletPressurePascal - outletPressurePascal;
  const hydraulicSpeedFactorMetrePerSecond = Math.sqrt(
    2 * pressureDropPascal / condensateDensityKilogramPerCubicMetre,
  );

  // Brown's proportions, measured on the plate (1 scene unit = 51 plate px):
  // sphere C (outer 1.13, inner 0.88) centred on A's axis with a long left hub
  // that A slides through and a right hub that is the stuffing-box; A (0.20)
  // ends just past C's centre and the plunger, of A's own diameter, runs from
  // there out through the stuffing-box to the lower arm of D, whose pivot
  // stands 0.80 above the axis.
  const pipeAxisY = 0.20;
  const sphereCenter = new THREE.Vector3(0.25, pipeAxisY, 0);
  const coolPipeEndX = 0.30;
  // Pass 94: re-measured on the plate (C's centre at plate x 272): B's
  // hatched upright spans plate x 37-64 (scene -4.36 to -3.83), A's anchored
  // end is at x 30 (-4.49) and the base runs from x 26 (-4.57).
  const fixedPipeAnchorX = -4.47;
  const basePipeDisplayLength = coolPipeEndX - fixedPipeAnchorX;
  const pipeOuterRadius = 0.20;
  const pipeBoreRadius = 0.11;
  const plungerRadius = 0.20;
  // The plunger's outer end is very slightly crowned (sagitta 0.034), so it
  // bears on D's straight edge at one point as D turns.
  const plungerCrownRadius = 0.6;
  const plungerExternalContactLocalX = 1.55;
  const leverEdgeOffset = 0.23;
  const coolValveTipX = coolPipeEndX
    + adjustedColdGapMetre
      * thermalMotionDisplayScaleSceneUnitPerMetre;
  const coolExternalPadX = coolValveTipX
    + plungerExternalContactLocalX;
  const leverPivot = new THREE.Vector3(
    coolExternalPadX + leverEdgeOffset, pipeAxisY + 0.80, 0);
  const leverWeightLocalCenter = new THREE.Vector3(1.29, 0.10, 0);
  const leverWeightMassKilogram = 2.4;
  const gravityMetrePerSecondSquared = 9.80665;
  // D's lower arm has a straight inner edge (local x = -leverEdgeOffset);
  // the crown's centre lies leverEdgeOffset + crown radius from it:
  // a cos(theta) + b sin(theta) = e + Rc, a = pivot.x - crown centre x,
  // b = pivot.y - axis y.
  const leverContactHeight = leverPivot.y - pipeAxisY;
  const leverAngleForPad = (padX) => {
    const a = leverPivot.x - (padX - plungerCrownRadius);
    const b = leverContactHeight;
    return Math.atan2(b, a) - Math.acos(
      (leverEdgeOffset + plungerCrownRadius) / Math.hypot(a, b));
  };
  const leverStopAngle = leverAngleForPad(coolExternalPadX);
  // Stop-screw b is threaded through the lower arm 1.53 below the pivot; its
  // rounded tip (radius 0.06) stands 0.13 out of the arm's inner edge and
  // meets stop c; its square head stands out beyond the arm's outer edge.
  const stopScrewTipLocal = new THREE.Vector3(-0.36, -1.53, 0);
  const stopScrewTipRadius = 0.06;
  const rotatedPoint = (point, angle) => new THREE.Vector3(
    leverPivot.x + point.x * Math.cos(angle) - point.y * Math.sin(angle),
    leverPivot.y + point.x * Math.sin(angle) + point.y * Math.cos(angle),
    point.z,
  );
  const stopTipLeading = (angle) => rotatedPoint(stopScrewTipLocal, angle)
    .add(new THREE.Vector3(-stopScrewTipRadius, 0, 0));
  const fixedStopContactPoint = stopTipLeading(leverStopAngle);

  const stateAtTimeWithoutFlowIntegral = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    const phase = cycleTime / cycleDuration;
    const angle = FULL_TURN * phase;
    const heatingFraction = 0.5 * (1 - Math.cos(angle));
    const heatingFractionRatePerSecond = Math.PI / cycleDuration
      * Math.sin(angle);
    const temperatureKelvin = coolTemperatureKelvin
      + temperatureSwingKelvin * heatingFraction;
    const temperatureRateKelvinPerSecond = temperatureSwingKelvin
      * heatingFractionRatePerSecond;
    const pipeFreeExpansionMetre = pipeLinearExpansionPerKelvin
      * pipeFreeLengthMetre
      * (temperatureKelvin - coolTemperatureKelvin);
    const pipeExpansionRateMetrePerSecond = pipeLinearExpansionPerKelvin
      * pipeFreeLengthMetre * temperatureRateKelvinPerSecond;
    const pipeValveGapMetre = Math.max(
      0,
      adjustedColdGapMetre - pipeFreeExpansionMetre,
    );
    const plungerDisplacementMetre = Math.max(
      0,
      pipeFreeExpansionMetre - adjustedColdGapMetre,
    );
    const plungerVelocityMetrePerSecond = pipeFreeExpansionMetre
      > adjustedColdGapMetre
      ? pipeExpansionRateMetrePerSecond
      : 0;
    const displayedPlungerDisplacement = plungerDisplacementMetre
      * thermalMotionDisplayScaleSceneUnitPerMetre;
    const externalPadX = coolExternalPadX
      + displayedPlungerDisplacement;
    const leverAngle = leverAngleForPad(externalPadX);
    const crownCentreDistance = leverPivot.x
      - (externalPadX - plungerCrownRadius);
    const leverAngularVelocityRadianPerSecond =
      plungerVelocityMetrePerSecond
      * thermalMotionDisplayScaleSceneUnitPerMetre * Math.cos(leverAngle)
      / (leverContactHeight * Math.cos(leverAngle)
        - crownCentreDistance * Math.sin(leverAngle));
    const stopScrewTip = stopTipLeading(leverAngle);
    const stopClearanceSceneUnit = Math.max(
      0,
      stopScrewTip.x - fixedStopContactPoint.x,
    );
    const weightHorizontalMomentArmSceneUnit =
      leverWeightLocalCenter.x * Math.cos(leverAngle)
      - leverWeightLocalCenter.y * Math.sin(leverAngle);
    const clockwiseWeightTorqueNewtonSceneUnit = leverWeightMassKilogram
      * gravityMetrePerSecondSquared
      * weightHorizontalMomentArmSceneUnit;
    // The crown pushes D along the edge normal (cos, sin) at the contact
    // point; the stuffing-box takes the small lateral part.
    const contactX = externalPadX - plungerCrownRadius
      + plungerCrownRadius * Math.cos(leverAngle) - leverPivot.x;
    const contactY = pipeAxisY + plungerCrownRadius * Math.sin(leverAngle)
      - leverPivot.y;
    const normalContactArm = contactX * Math.sin(leverAngle)
      - contactY * Math.cos(leverAngle);
    const plungerClosingForceNewton = clockwiseWeightTorqueNewtonSceneUnit
      / normalContactArm * Math.cos(leverAngle);
    const pipeValveContact = pipeValveGapMetre <= 1e-12;
    const pipeValveContactForceNewton = pipeValveContact
      ? plungerClosingForceNewton
      : 0;
    const fixedStopReactionNewton = pipeValveContact
      ? 0
      : plungerClosingForceNewton;
    const curtainAreaSquareMetre = Math.PI * pipeInsideDiameterMetre
      * pipeValveGapMetre;
    const effectiveFlowAreaSquareMetre = Math.min(
      pipeBoreAreaSquareMetre,
      curtainAreaSquareMetre,
    );
    const condensateVolumeFlowCubicMetrePerSecond = dischargeCoefficient
      * effectiveFlowAreaSquareMetre * hydraulicSpeedFactorMetrePerSecond;
    return {
      clockwiseWeightTorqueNewtonSceneUnit,
      condensateVolumeFlowCubicMetrePerSecond,
      curtainAreaSquareMetre,
      cycleTime,
      effectiveFlowAreaSquareMetre,
      externalPadX,
      fixedStopReactionNewton,
      heatingFraction,
      leverAngle,
      leverAngularVelocityRadianPerSecond,
      phase,
      pipeEndX: coolPipeEndX + pipeFreeExpansionMetre
        * thermalMotionDisplayScaleSceneUnitPerMetre,
      pipeExpansionRateMetrePerSecond,
      pipeFreeExpansionMetre,
      pipeValveContact,
      pipeValveContactForceNewton,
      pipeValveGapMetre,
      plungerClosingForceNewton,
      plungerDisplacementMetre,
      plungerVelocityMetrePerSecond,
      stopClearanceSceneUnit,
      stopScrewTip,
      temperatureKelvin,
      temperatureRateKelvinPerSecond,
      valveTipX: coolValveTipX + displayedPlungerDisplacement,
      weightHorizontalMomentArmSceneUnit,
    };
  };

  const maximumFlowState = stateAtTimeWithoutFlowIntegral(0);
  const maximumCondensateVolumeFlowCubicMetrePerSecond =
    maximumFlowState.condensateVolumeFlowCubicMetrePerSecond;
  const integrationSamples = 2048;
  const cumulativeDischargeVolumeTable = new Float64Array(
    integrationSamples + 1,
  );
  for (let index = 1; index <= integrationSamples; index += 1) {
    const previousTime = cycleDuration * (index - 1)
      / integrationSamples;
    const currentTime = cycleDuration * index / integrationSamples;
    const previousFlow = stateAtTimeWithoutFlowIntegral(previousTime)
      .condensateVolumeFlowCubicMetrePerSecond;
    const currentFlow = index === integrationSamples
      ? maximumCondensateVolumeFlowCubicMetrePerSecond
      : stateAtTimeWithoutFlowIntegral(currentTime)
        .condensateVolumeFlowCubicMetrePerSecond;
    cumulativeDischargeVolumeTable[index] =
      cumulativeDischargeVolumeTable[index - 1]
      + 0.5 * (previousFlow + currentFlow)
        * (currentTime - previousTime);
  }
  const dischargeVolumePerCycleCubicMetre =
    cumulativeDischargeVolumeTable[integrationSamples];
  const markerPassesPerCycle = 2;
  const markerPathEquivalentVolumeCubicMetre =
    dischargeVolumePerCycleCubicMetre / markerPassesPerCycle;

  const cumulativeDischargeVolumeWithinCycle = (cycleTime) => {
    const coordinate = cycleTime / cycleDuration * integrationSamples;
    const lowerIndex = Math.min(
      integrationSamples - 1,
      Math.floor(coordinate),
    );
    return THREE.MathUtils.lerp(
      cumulativeDischargeVolumeTable[lowerIndex],
      cumulativeDischargeVolumeTable[lowerIndex + 1],
      coordinate - lowerIndex,
    );
  };
  const cumulativeDischargeVolumeAtTime = (time) => {
    const completeCycles = Math.floor(time / cycleDuration);
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    return completeCycles * dischargeVolumePerCycleCubicMetre
      + cumulativeDischargeVolumeWithinCycle(cycleTime);
  };
  const stateAtTime = (time) => {
    const state = stateAtTimeWithoutFlowIntegral(time);
    const cumulativeDischargeVolumeCubicMetre =
      cumulativeDischargeVolumeAtTime(time);
    return {
      ...state,
      cumulativeDischargeVolumeCubicMetre,
      flowFraction: maximumCondensateVolumeFlowCubicMetrePerSecond > 0
        ? state.condensateVolumeFlowCubicMetrePerSecond
          / maximumCondensateVolumeFlowCubicMetrePerSecond
        : 0,
      markerTravelTurns: cumulativeDischargeVolumeCubicMetre
        / markerPathEquivalentVolumeCubicMetre,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.42,
  });
  const pipeMaterial = matte(PALETTE.driven, {
    metalness: 0.22,
    roughness: 0.38,
  });
  const valveMaterial = matte(PALETTE.driven, {
    metalness: 0.28,
    roughness: 0.36,
  });
  const leverMaterial = matte(PALETTE.accent, {
    metalness: 0.25,
    roughness: 0.42,
  });
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.42,
    roughness: 0.26,
    transparent: true,
  });
  waterMaterial.depthWrite = false;
  const markerMaterial = matte(0xdaf5f7, {
    opacity: 0.91,
    roughness: 0.25,
    transparent: true,
  });
  markerMaterial.depthWrite = false;

  // Casting C: sphere, left hub (A slides through it), right hub (the
  // stuffing-box the plunger slides through) and the outlet neck, which
  // flares onto the base and runs down through it. Brown draws it as one
  // hatched section, so it is one solid, shown cut on z = 0.
  const sphereRadius = 1.13;
  const sphereInnerRadius = 0.88;
  const hubRadius = 0.40;
  const hubBoreRadius = pipeOuterRadius + 0.003;
  const leftHubEndX = sphereCenter.x - 2.0;
  const fixedStopFaceX = fixedStopContactPoint.x;
  const rightHubEndX = fixedStopFaceX + 0.05;
  const neckRadius = 0.40;
  const neckLowerRadius = 0.33;
  const outletBoreRadius = 0.15;
  const outletBottomY = -2.42;
  const baseTopY = -1.28;
  const baseBottomY = -1.48;
  const flareTopY = -1.08;
  const flareEnd = 0.4 * Math.PI;
  const flarePoint = (t) => [0.70 - 0.30 * Math.cos(t), flareTopY - 0.24 * Math.sin(t)];
  const flareBottomY = flarePoint(flareEnd)[1];
  const {x: cx, y: cy} = sphereCenter;
  const castingWalls = surfaceBuffer();
  const outerSphere = sphereBackInto(castingWalls, sphereCenter, sphereRadius, [
    {axis: [1, 0, 0], radius: hubRadius},
    {axis: [-1, 0, 0], radius: hubRadius},
    {axis: [0, -1, 0], radius: neckRadius},
  ], false);
  const innerSphere = sphereBackInto(castingWalls, sphereCenter, sphereInnerRadius, [
    {axis: [1, 0, 0], radius: hubBoreRadius},
    {axis: [-1, 0, 0], radius: hubBoreRadius},
    {axis: [0, -1, 0], radius: outletBoreRadius},
  ], true);
  const outerJoin = (radius) => Math.sqrt(sphereRadius ** 2 - radius ** 2);
  const innerJoin = (radius) => Math.sqrt(sphereInnerRadius ** 2 - radius ** 2);
  // Hubs about A's axis share the sphere's own hole vertices where they
  // leave it; their end faces zip the outer and bore samplings together.
  const hubFrame = xAxisFrame(cy);
  const hubAngle = (p) => Math.atan2(p.z, p.y - cy);
  for (const [side, endX] of [[0, rightHubEndX], [1, leftHubEndX]]) {
    const sign = side === 0 ? 1 : -1;
    const outer = chainAngles(outerSphere.chains[side], hubAngle, Math.PI);
    const bore = chainAngles(innerSphere.chains[side], hubAngle, Math.PI);
    stripInto(castingWalls,
      latheRing(hubFrame, hubRadius, 0, outer.phis, [1, 0], outer.positions),
      latheRing(hubFrame, hubRadius, endX, outer.phis, [1, 0]));
    stripInto(castingWalls,
      latheRing(hubFrame, hubRadius, endX, outer.phis, [0, sign]),
      latheRing(hubFrame, hubBoreRadius, endX, bore.phis, [0, sign]));
    stripInto(castingWalls,
      latheRing(hubFrame, hubBoreRadius, endX, bore.phis, [-1, 0]),
      latheRing(hubFrame, hubBoreRadius, 0, bore.phis, [-1, 0], bore.positions));
  }
  // The outlet neck, about the vertical through C's centre: its outer wall
  // runs smoothly into the flare onto the base, and its bore down through it.
  const neckFrame = yAxisFrame(cx);
  const neckAngle = (p) => Math.atan2(p.x - cx, p.z);
  const neckOuter = chainAngles(outerSphere.chains[2], neckAngle, Math.PI / 2);
  const neckBore = chainAngles(innerSphere.chains[2], neckAngle, Math.PI / 2);
  const flare = Array.from({length: 25}, (_, i) => flarePoint(flareEnd * i / 24));
  const neckProfile = [[neckRadius, cy - outerJoin(neckRadius)], ...flare];
  const neckNormals = neckProfile.map((_, i) => {
    const [ar, ah] = neckProfile[Math.max(0, i - 1)], [br, bh] = neckProfile[Math.min(neckProfile.length - 1, i + 1)];
    const n = [bh - ah, -(br - ar)], length = Math.hypot(...n);
    return n[0] < 0 ? [-n[0] / length, -n[1] / length] : [n[0] / length, n[1] / length];
  });
  const neckRings = neckProfile.map(([r, h], i) => latheRing(neckFrame, r, h, neckOuter.phis, neckNormals[i],
    i === 0 ? neckOuter.positions : null));
  for (let i = 0; i < neckRings.length - 1; i += 1) stripInto(castingWalls, neckRings[i], neckRings[i + 1]);
  const [flareR] = flare.at(-1);
  stripInto(castingWalls,
    latheRing(neckFrame, flareR, flareBottomY, neckOuter.phis, [0, -1]),
    latheRing(neckFrame, neckLowerRadius, flareBottomY, neckOuter.phis, [0, -1]));
  stripInto(castingWalls,
    latheRing(neckFrame, neckLowerRadius, flareBottomY, neckOuter.phis, [1, 0]),
    latheRing(neckFrame, neckLowerRadius, outletBottomY, neckOuter.phis, [1, 0]));
  stripInto(castingWalls,
    latheRing(neckFrame, neckLowerRadius, outletBottomY, neckOuter.phis, [0, -1]),
    latheRing(neckFrame, outletBoreRadius, outletBottomY, neckBore.phis, [0, -1]));
  stripInto(castingWalls,
    latheRing(neckFrame, outletBoreRadius, outletBottomY, neckBore.phis, [-1, 0]),
    latheRing(neckFrame, outletBoreRadius, 0, neckBore.phis, [-1, 0], neckBore.positions));
  // The cut face: three pieces (above the hubs, and either side of the
  // outlet), outlined through the rims' own vertices.
  // Rim nodes from `from` to `to`, rising or falling in beta, across the
  // chart's seam if need be (its two end nodes are the same point).
  const arc = (betas, radius, from, to, rising) => {
    const nodes = betas.slice(0, -1), start = nodes.indexOf(from), list = [];
    for (let k = start; ; k = (k + (rising ? 1 : -1) + nodes.length) % nodes.length) {
      list.push(nodes[k]);
      if (nodes[k] === to) break;
    }
    return list.map((b) => [cx + radius * Math.cos(b), cy + radius * Math.sin(b)]);
  };
  const rimBeta = (betas, target) => betas.reduce((best, b) => (Math.abs(b - target) < Math.abs(best - target) ? b : best));
  const oB = outerSphere.betas, iB = innerSphere.betas;
  const oHub = Math.asin(hubRadius / sphereRadius), iHub = Math.asin(hubBoreRadius / sphereInnerRadius);
  const oNeck = Math.asin(neckRadius / sphereRadius), iNeck = Math.asin(outletBoreRadius / sphereInnerRadius);
  const top = [
    [rightHubEndX, cy + hubBoreRadius], [rightHubEndX, cy + hubRadius],
    ...arc(oB, sphereRadius, rimBeta(oB, oHub), rimBeta(oB, Math.PI - oHub), true),
    [leftHubEndX, cy + hubRadius], [leftHubEndX, cy + hubBoreRadius],
    ...arc(iB, sphereInnerRadius, rimBeta(iB, Math.PI - iHub), rimBeta(iB, iHub), false),
  ];
  const lowerLeft = [
    [leftHubEndX, cy - hubBoreRadius],
    ...arc(iB, sphereInnerRadius, rimBeta(iB, Math.PI + iHub), rimBeta(iB, -0.5 * Math.PI - iNeck), true),
    [cx - outletBoreRadius, outletBottomY], [cx - neckLowerRadius, outletBottomY],
    [cx - neckLowerRadius, flareBottomY],
    ...flare.slice().reverse().map(([r, h]) => [cx - r, h]),
    ...arc(oB, sphereRadius, rimBeta(oB, -0.5 * Math.PI - oNeck), rimBeta(oB, Math.PI + oHub), false),
    [leftHubEndX, cy - hubRadius],
  ];
  const lowerRight = [
    [rightHubEndX, cy - hubRadius],
    ...arc(oB, sphereRadius, rimBeta(oB, -oHub), rimBeta(oB, -0.5 * Math.PI + oNeck), false),
    ...flare.map(([r, h]) => [cx + r, h]),
    [cx + neckLowerRadius, flareBottomY],
    [cx + neckLowerRadius, outletBottomY], [cx + outletBoreRadius, outletBottomY],
    ...arc(iB, sphereInnerRadius, rimBeta(iB, -0.5 * Math.PI + iNeck), rimBeta(iB, -iHub), true),
    [rightHubEndX, cy - hubBoreRadius],
  ];
  const castingCut = surfaceBuffer();
  sectionFaceInto(castingCut, [top, lowerLeft, lowerRight]);
  const castingC = new THREE.Mesh(toGeometry(castingWalls, castingCut),
    [frameMaterial, cutFaceMaterial(frameMaterial)]);
  castingC.userData.role =
    'cast-sphere-C-with-pipe-hub-stuffing-box-hub-and-outlet-neck-in-section';
  castingC.userData.cutawaySection = true;
  const hollowSphereC = new THREE.Group();
  hollowSphereC.userData.role =
    'fixed-hollow-sphere-C-surrounding-pipe-end-and-valve';
  hollowSphereC.add(castingC);
  root.add(hollowSphereC);

  // One base plate under B, C and D. The outlet neck runs down through it,
  // and the plate (which is not sectioned) is bored only to the outlet's bore
  // plus 0.005, so it overlaps the neck's wall instead of sharing its face and
  // stays whole in front of the cut neck.
  const baseOutline = [[-4.60, -0.65], [3.95, -0.65], [3.95, 0.65], [-4.60, 0.65]];
  const baseHoleRadius = outletBoreRadius + 0.005;
  const baseHole = Array.from({length: 128}, (_, i) => [
    cx + baseHoleRadius * Math.cos(FULL_TURN * i / 128),
    baseHoleRadius * Math.sin(FULL_TURN * i / 128),
  ]).reverse();
  const basePlate = new THREE.Mesh(
    horizontalPlate([[baseOutline, baseHole]], baseBottomY, baseTopY),
    frameMaterial,
  );
  basePlate.userData.role = 'fixed-base-plate-under-B-C-lever-D-and-stop-c';
  const baseLeft = basePlate, baseRight = basePlate;
  root.add(basePlate);

  const fixedSupportB = new THREE.Group();
  fixedSupportB.userData.role =
    'fixed-support-B-anchoring-one-point-of-waste-pipe-A';
  const supportPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 1.35, 0.82),
    frameMaterial,
  );
  // Its top stands 0.003 under A (whose wall slides in C's hubs as it
  // grows); clamp B holds A to it.
  supportPost.position.set(-4.10, -0.678, 0);
  supportPost.userData.role = 'fixed-upright-of-support-B';
  const supportClamp = ringNormalToX(
    pipeOuterRadius + 0.09,
    0.09,
    darkMaterial,
    'fixed-clamp-B-around-pipe-A',
  );
  supportClamp.position.set(-4.10, pipeAxisY, 0);
  fixedSupportB.add(supportPost, supportClamp);
  root.add(fixedSupportB);

  // Waste-pipe A: one closed tube, its open end facing valve a.
  const pipeA = new THREE.Group();
  pipeA.userData.role =
    'thermally-expanding-waste-pipe-A-fixed-at-B-and-free-at-C';
  const halfPipe = basePipeDisplayLength / 2;
  const pipeShell = new THREE.Mesh(latheGeometry([
    [[pipeBoreRadius, -halfPipe], [pipeOuterRadius, -halfPipe]],
    [[pipeOuterRadius, -halfPipe], [pipeOuterRadius, halfPipe]],
    [[pipeOuterRadius, halfPipe], [pipeBoreRadius, halfPipe]],
    [[pipeBoreRadius, halfPipe], [pipeBoreRadius, -halfPipe]],
  ], yAxisFrame(0)), pipeMaterial);
  pipeShell.rotation.z = Math.PI / 2;
  pipeShell.userData.role = 'expanding-outer-wall-of-pipe-A';
  const pipeFixedRim = ringNormalToX(
    pipeOuterRadius,
    0.05,
    darkMaterial,
    'fixed-inlet-rim-of-A-at-anchor-side',
  );
  pipeFixedRim.position.set(fixedPipeAnchorX, pipeAxisY, 0);
  // The free end is the tube's own end face; this marker only tracks it.
  const pipeFreeEndRim = new THREE.Group();
  pipeFreeEndRim.userData.role = 'moving-free-end-of-A-inside-sphere-C';
  pipeA.add(pipeShell, pipeFixedRim, pipeFreeEndRim);
  root.add(pipeA);

  // The right hub of C is the stuffing-box (part of the casting above).
  const stuffingBox = new THREE.Group();
  stuffingBox.userData.role =
    'fixed-stuffing-box-guiding-opposed-valve-plunger';
  stuffingBox.userData.castIn = castingC;
  const stuffingBody = castingC;
  root.add(stuffingBox);

  // Valve a: one rod of A's diameter; its flat inner end closes A's mouth,
  // its crowned outer end bears on D.
  const valvePlungerA = new THREE.Group();
  valvePlungerA.userData.role =
    'one-rigid-valve-plunger-a-sliding-in-stuffing-box';
  const crownSagitta = plungerCrownRadius
    - Math.sqrt(plungerCrownRadius ** 2 - plungerRadius ** 2);
  const crownStart = Math.asin(plungerRadius / plungerCrownRadius);
  const plungerLength = plungerExternalContactLocalX;
  const plunger = new THREE.Mesh(latheGeometry([
    [[0, 0], [plungerRadius, 0]],
    [[plungerRadius, 0], [plungerRadius, plungerLength - crownSagitta]],
    Array.from({length: 17}, (_, i) => {
      const psi = crownStart * (1 - i / 16);
      return [plungerCrownRadius * Math.sin(psi),
        plungerLength - plungerCrownRadius + plungerCrownRadius * Math.cos(psi)];
    }),
  ], xAxisFrame(0), 0, FULL_TURN, 96), valveMaterial);
  plunger.userData.role =
    'valve-a-plunger-closing-free-end-of-pipe-A-and-bearing-on-D';
  const valveFace = plunger, plungerRod = plunger;
  valvePlungerA.add(plunger);
  root.add(valvePlungerA);

  // Loaded elbow lever D: one flat plate (bored boss, lower arm with a
  // straight inner edge, neck to the ball load), with stop-screw b threaded
  // through the lower arm.
  const leverD = new THREE.Group();
  leverD.position.copy(leverPivot);
  leverD.userData.role =
    'loaded-elbow-lever-D-pressing-plunger-toward-pipe-end';
  const armBottom = -1.76, armEndCentre = -0.08, armEndRadius = 0.15;
  const armOutline = [[-leverEdgeOffset, 0], [-leverEdgeOffset, armBottom]];
  for (let i = 1; i < 32; i += 1) {
    const angle = Math.PI + Math.PI * i / 32;
    armOutline.push([armEndCentre + armEndRadius * Math.cos(angle),
      armBottom + armEndRadius * Math.sin(angle)]);
  }
  armOutline.push([armEndCentre + armEndRadius, armBottom], [leverEdgeOffset, 0]);
  const weightLength = Math.hypot(leverWeightLocalCenter.x, leverWeightLocalCenter.y);
  const across = [-leverWeightLocalCenter.y / weightLength, leverWeightLocalCenter.x / weightLength];
  const neckOutlineD = [
    [0.10 * across[0], 0.10 * across[1]], [-0.10 * across[0], -0.10 * across[1]],
    [leverWeightLocalCenter.x - 0.08 * across[0], leverWeightLocalCenter.y - 0.08 * across[1]],
    [leverWeightLocalCenter.x + 0.08 * across[0], leverWeightLocalCenter.y + 0.08 * across[1]],
  ];
  const circleRing = (x, y, radius, count = 96) => {
    const ring = Array.from({length: count}, (_, i) => [x + radius * Math.cos(FULL_TURN * i / count), y + radius * Math.sin(FULL_TURN * i / count)]);
    return [[...ring, ring[0]]];
  };
  const leverShape = polygonClipping.difference(
    polygonClipping.union([[...armOutline, armOutline[0]]], circleRing(0, 0, 0.30),
      [[...neckOutlineD, neckOutlineD[0]]]),
    circleRing(0, 0, 0.13),
  );
  const lowerLeverArm = new THREE.Mesh(plate(leverShape, -0.09, 0.09), leverMaterial);
  lowerLeverArm.userData.role = 'lower-arm-of-loaded-elbow-lever-D';
  const weightedLeverArm = lowerLeverArm;
  const leverWeight = new THREE.Mesh(
    new THREE.SphereGeometry(0.50, 64, 32),
    leverMaterial,
  );
  leverWeight.position.copy(leverWeightLocalCenter);
  leverWeight.userData.role = 'fixed-load-on-long-arm-of-lever-D';
  const screwY = stopScrewTipLocal.y, screwTipX = stopScrewTipLocal.x;
  const screwEndX = 0.50, headStartX = 0.47, headEndX = 0.70;
  const stopScrewB = new THREE.Mesh(latheGeometry([
    [...Array.from({length: 13}, (_, i) => {
      const psi = Math.PI / 2 * i / 12;
      return [stopScrewTipRadius * Math.sin(psi), screwTipX - stopScrewTipRadius * Math.cos(psi)];
    }), [stopScrewTipRadius, screwEndX]],
    [[stopScrewTipRadius, screwEndX], [0, screwEndX]],
  ], xAxisFrame(screwY), 0, FULL_TURN, 48), darkMaterial);
  stopScrewB.userData.role =
    'adjustable-stop-screw-b-threaded-through-lower-lever-arm';
  const screwHeadB = new THREE.Mesh(
    new THREE.BoxGeometry(headEndX - headStartX, 0.38, 0.38),
    darkMaterial,
  );
  screwHeadB.position.set((headStartX + headEndX) / 2, screwY, 0);
  screwHeadB.userData.role = 'head-of-adjusting-screw-b';
  leverD.add(lowerLeverArm, leverWeight, stopScrewB, screwHeadB);
  root.add(leverD);

  // D's fixed support (behind the lever) with its pivot pin and cap.
  const rect = (x0, y0, x1, y1) => [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]];
  const standShape = polygonClipping.union(
    rect(-0.13, baseTopY - 0.02 - leverPivot.y, 0.13, 0), circleRing(0, 0, 0.30));
  const leverStand = new THREE.Mesh(plate(standShape, -0.40, -0.26), frameMaterial);
  leverStand.position.copy(leverPivot);
  leverStand.userData.role = 'finite-lever-support-behind-D';
  const zAxisFrame = {
    point: (r, h, phi) => new THREE.Vector3(r * Math.cos(phi), r * Math.sin(phi), h),
    normal: (nr, nh, phi) => new THREE.Vector3(nr * Math.cos(phi), nr * Math.sin(phi), nh),
  };
  const leverPivotPin = new THREE.Mesh(latheGeometry([
    [[0, -0.29], [0.125, -0.29]], [[0.125, -0.29], [0.125, 0.095]],
    [[0.125, 0.095], [0.18, 0.095]], [[0.18, 0.095], [0.18, 0.14]],
    [[0.18, 0.14], [0, 0.14]],
  ], zAxisFrame, 0, FULL_TURN, 64), darkMaterial);
  leverPivotPin.position.copy(leverPivot);
  leverPivotPin.userData.role = 'fixed-pivot-pin-of-elbow-lever-D';
  root.add(leverStand, leverPivotPin);

  // Stop c: a post from the base up under the stuffing-box hub; b's tip
  // meets its outer face.
  const fixedStopC = new THREE.Group();
  fixedStopC.userData.role =
    'fixed-stop-c-limiting-loaded-lever-and-cold-plunger-position';
  const postTop = cy - hubRadius + 0.04, postBottom = baseTopY - 0.02;
  const stopPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.29, postTop - postBottom, 0.54),
    frameMaterial,
  );
  stopPost.position.set(fixedStopFaceX - 0.145, (postTop + postBottom) / 2, 0);
  stopPost.userData.role = 'fixed-upright-stop-c';
  const stopContactFace = stopPost;
  fixedStopC.add(stopPost);
  root.add(fixedStopC);

  const flowPathCount = 3;
  const markersPerPath = 6;
  const makeFlowPoints = (laneZ, pipeEndX) => [
    new THREE.Vector3(fixedPipeAnchorX + 0.08, pipeAxisY, laneZ),
    new THREE.Vector3(-2.52, pipeAxisY, laneZ),
    new THREE.Vector3(-1.35, pipeAxisY, laneZ),
    new THREE.Vector3(pipeEndX - 0.14, pipeAxisY, laneZ),
    new THREE.Vector3(pipeEndX + 0.11, pipeAxisY - 0.15, laneZ),
    new THREE.Vector3(sphereCenter.x + 0.25, -0.45, laneZ),
    new THREE.Vector3(sphereCenter.x, -0.66, laneZ),
    new THREE.Vector3(sphereCenter.x, -1.50, laneZ),
    new THREE.Vector3(sphereCenter.x, -2.36, laneZ * 0.35),
  ];
  const laneOffsets = [-0.05, 0, 0.05];
  const condensateFlowCurves = laneOffsets.map((laneZ) =>
    new THREE.CatmullRomCurve3(
      makeFlowPoints(laneZ, coolPipeEndX),
      false,
      'centripetal',
    ));
  const flowLineMaterial = new THREE.LineBasicMaterial({
    color: PALETTE.fluid,
    opacity: 0.34,
    transparent: true,
  });
  const flowGuideLines = condensateFlowCurves.map((curve, index) => {
    const points = curve.getSpacedPoints(80);
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      flowLineMaterial,
    );
    line.userData.role =
      `dynamic-condensate-guide-${index + 1}-through-A-gap-C-outlet`;
    root.add(line);
    return line;
  });
  const condensateMarkers = [];
  for (let pathIndex = 0; pathIndex < flowPathCount;
    pathIndex += 1) {
    for (let markerIndex = 0; markerIndex < markersPerPath;
      markerIndex += 1) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.080, 18, 12),
        markerMaterial,
      );
      marker.userData.role =
        `condensate-path-${pathIndex + 1}-marker-${markerIndex + 1}`;
      root.add(marker);
      condensateMarkers.push({ marker, markerIndex, pathIndex });
    }
  }

  const coolPipeColor = new THREE.Color(PALETTE.driven);
  const markerProgressAtTime = (time, markerIndex) => {
    const state = stateAtTime(time);
    return THREE.MathUtils.euclideanModulo(
      state.markerTravelTurns + markerIndex / markersPerPath,
      1,
    );
  };
  const updateFlowCurves = (pipeEndX) => {
    for (let index = 0; index < condensateFlowCurves.length; index += 1) {
      const curve = condensateFlowCurves[index];
      const points = makeFlowPoints(laneOffsets[index], pipeEndX);
      curve.points.forEach((point, pointIndex) => point.copy(points[pointIndex]));
      curve.updateArcLengths();
      const linePositions = flowGuideLines[index].geometry
        .getAttribute('position');
      for (let sample = 0; sample < linePositions.count; sample += 1) {
        const point = curve.getPointAt(sample / (linePositions.count - 1));
        linePositions.setXYZ(sample, point.x, point.y, point.z);
      }
      linePositions.needsUpdate = true;
    }
  };

  const update = (time) => {
    const state = stateAtTime(time);
    const displayedPipeLength = state.pipeEndX - fixedPipeAnchorX;
    const pipeMidpointX = (fixedPipeAnchorX + state.pipeEndX) / 2;
    pipeShell.position.set(pipeMidpointX, pipeAxisY, 0);
    pipeShell.scale.y = displayedPipeLength / basePipeDisplayLength;
    pipeFreeEndRim.position.set(state.pipeEndX, pipeAxisY, 0);
    valvePlungerA.position.set(state.valveTipX, pipeAxisY, 0);
    leverD.rotation.z = state.leverAngle;
    // Colour is not a signal: pipe A keeps one colour; its expansion shows
    // only as the free end's travel.
    pipeMaterial.color.copy(coolPipeColor);
    waterMaterial.opacity = 0.06 + 0.44 * state.flowFraction;
    flowLineMaterial.opacity = 0.03 + 0.42 * state.flowFraction;
    updateFlowCurves(state.pipeEndX);
    for (const entry of condensateMarkers) {
      const progress = markerProgressAtTime(time, entry.markerIndex);
      entry.marker.position.copy(
        condensateFlowCurves[entry.pathIndex].getPointAt(progress),
      );
      entry.marker.scale.setScalar(
        Math.sin(Math.PI * progress) ** 0.55
          * Math.sqrt(state.flowFraction),
      );
    }
    root.userData.updateWorkingParts?.(time, state);
  };

  const geometry = {
    adjustedColdGapMetre,
    basePipeDisplayLength,
    closingTemperatureKelvin,
    condensateDensityKilogramPerCubicMetre,
    coolExternalPadX,
    coolPipeEndX,
    coolTemperatureKelvin,
    coolValveTipX,
    cycleDuration,
    dischargeCoefficient,
    dischargeVolumePerCycleCubicMetre,
    fixedPipeAnchorX,
    fixedStopContactPoint: fixedStopContactPoint.clone(),
    flowPathCount,
    gravityMetrePerSecondSquared,
    hotTemperatureKelvin,
    hydraulicSpeedFactorMetrePerSecond,
    inletPressurePascal,
    integrationSamples,
    leverPivot: leverPivot.clone(),
    leverContactHeight,
    leverEdgeOffset,
    leverStopAngle,
    leverWeightLocalCenter: leverWeightLocalCenter.clone(),
    leverWeightMassKilogram,
    markerPassesPerCycle,
    markerPathEquivalentVolumeCubicMetre,
    markersPerPath,
    maximumCondensateVolumeFlowCubicMetrePerSecond,
    maximumFreeExpansionMetre,
    outletPressurePascal,
    pipeAxisY,
    pipeBoreAreaSquareMetre,
    pipeFreeLengthMetre,
    pipeInsideDiameterMetre,
    pipeLinearExpansionPerKelvin,
    pipeBoreRadius,
    pipeOuterRadius,
    plungerCrownRadius,
    plungerExternalContactLocalX,
    plungerRadius,
    pressureDropPascal,
    sphereCenter: sphereCenter.clone(),
    sphereInnerRadius,
    sphereRadius,
    stopScrewTipRadius,
    hubBoreRadius,
    stopScrewTipLocal: stopScrewTipLocal.clone(),
    temperatureSwingKelvin,
    thermalMotionDisplayScaleSceneUnitPerMetre,
  };

  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'ray-longitudinal-pipe-expansion-steam-trap-with-fixed-anchor-hollow-sphere-stuffing-box-plunger-weighted-elbow-lever-and-adjustable-stop',
    blocks: {
      baseLeft,
      basePlate,
      baseRight,
      castingC,
      condensateMarkers: condensateMarkers.map(({ marker }) => marker),
      fixedStopC,
      fixedSupportB,
      flowGuideLines,
      hollowSphereC,
      leverD,
      leverPivotPin,
      leverStand,
      leverWeight,
      lowerLeverArm,
      pipeA,
      pipeFixedRim,
      pipeFreeEndRim,
      pipeShell,
      plunger,
      plungerRod,
      screwHeadB,
      stopContactFace,
      stopPost,
      stopScrewB,
      stopTip: stopScrewB,
      stuffingBody,
      stuffingBox,
      valveFace,
      valvePlungerA,
      weightedLeverArm,
    },
    degreesOfFreedom: {
      independentOperatingCoordinates: 1,
      leverRotationSlavedToPlunger: true,
      plungerTranslationSlavedToPipeContact: true,
      prescribedThermalInput: 1,
    },
    dynamics: {
      assumptionScope:
        'The temperature cycle is prescribed and the contact solution is quasi-static. Pipe axial compliance, transient heat transfer, lever and plunger inertia, stuffing-box friction, leakage, flashing, water hammer, and condensate inventory are not integrated.',
      contactLaw:
        'gap=max(adjustedColdGap-freeExpansion,0); plungerTravel=max(freeExpansion-adjustedColdGap,0). Thus the pipe end never crosses valve a: it first closes the cold clearance, then carries the plunger and raises the loaded lever.',
      loadPath:
        'Before pipe contact the adjustable b-c stop bears the weighted lever. After contact, the growing pipe displaces the plunger and lifts the weight; the lever supplies the closing reaction at valve a.',
      markerContinuity:
        'Marker phase is integrated discharged volume. The three complete curves are updated for the current free-end location, sampled by arc length with getPointAt, frozen while closed, and endpoint-faded before recycling.',
      thermalMotionScaleDisclosure:
        'Only thermal expansion and the contact-driven plunger travel use 800 scene units per metre so sub-millimetric action can be seen. The pipe body length and all flow equations retain their separately disclosed physical values.',
    },
    fidelity: 'authored',
    flowPaths: {
      condensateFlowCurves,
      cumulativeDischargeVolumeAtTime,
      cumulativeDischargeVolumeTable,
      cumulativeDischargeVolumeWithinCycle,
      markerProgressAtTime,
      updateFlowCurves,
    },
    geometry,
    mechanism:
      'Ray’s trap anchors one portion of horizontal waste-pipe A at fixed support B. A passes into attached hollow sphere C and ends open near its center. Opposite that end, one plunger valve a slides horizontally through a fixed stuffing-box. A loaded elbow lever D presses the plunger inward until adjustable screw b meets fixed stop c. Cool, contracted A leaves an open gap to a and condensate runs into C and down its outlet. Steam heats and lengthens A from B; its free end advances across the adjusted gap, contacts a, and then pushes the plunger outward against D while remaining sealed.',
    motion: {
      pipeAnchor: new THREE.Vector3(fixedPipeAnchorX, pipeAxisY, 0),
      pipeExpansionDirection: new THREE.Vector3(1, 0, 0),
      plungerTranslationDirection: new THREE.Vector3(1, 0, 0),
      weightedLeverSenseUnderPipeExpansion: 'counterclockwise',
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 478 HTML marks Animated unavailable and supplies only Brown’s engraving and caption.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate478: {
        approximateFixedSupportBPixels: [65, 289],
        approximateLeverPivotPixels: [388, 235],
        approximatePipeEndPixels: [307, 282],
        approximateSphereCenterPixels: [289, 281],
        approximateStopScrewBPixels: [415, 326],
        approximateStuffingBoxPixels: [361, 283],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 14,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'waste-pipe A expands and contracts longitudinally',
          'A terminates in the middle of attached hollow sphere C',
          'a portion of A is firmly secured to fixed support B',
          'valve a is a stuffing-box-guided plunger opposite A',
          'loaded elbow lever D presses the plunger toward A',
          'adjustable screw b and fixed stop c limit inward travel',
          'water leaves the contracted pipe open and steam expansion closes it',
        ],
        engravingEvidence:
          'Brown’s section shows horizontal A clamped only at far-left B, traversing sphere C to an open central end; an opposed horizontal plunger crosses C’s right stuffing box to the lower arm of pivoted weighted lever D, whose bottom screw b faces base-mounted stop c.',
        patentIdentityDisclosure:
          'Brown names Ray’s patent but supplies no inventor forename, jurisdiction, date, patent number, or claim text. No patent identifier is inferred from the surname alone.',
        reconstructionDisclosure:
          'The B-A-C alignment, opposed stuffing-box plunger, weighted elbow lever, b-c adjustment stop, and cool-open/hot-closed order are source-grounded. Every dimension, material coefficient, temperature, pressure, mass, flow coefficient, streamline, color, and timing value is independently engineered and exposed.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 478',
      publicDomainBookScanUrl:
        'https://upload.wikimedia.org/wikipedia/commons/c/c3/Five_hundred_and_seven_mechanial_movements%2C_embracing_all_those_which_are_most_important_in_dynamics%2C_hydraulics%2C_hydrostatics%2C_pneumatics%2C_steam_engines%2C_mill_and_other_gearing_.._%28IA_fivehundredseven02brow%29.pdf',
    },
    stateAtTime,
    thermodynamics: {
      pipeExpansionEquation:
        'deltaL=alpha*L*(T-Tcool)',
      prescribedTemperatureEquation:
        'T=Tcool+(Thot-Tcool)*(1-cos(2*pi*t/cycleDuration))/2',
    },
    transmission: {
      curtainDischargeEquation:
        'A_eff=min(pi*d_pipe*gap, pi*d_pipe^2/4); Q=Cd*A_eff*sqrt(2*(p_in-p_out)/rho)',
      leverConstraintEquation:
        'a*cos(theta)+b*sin(theta)=e+Rc, a=x_pivot-(x_externalPad-Rc), b=y_pivot-y_axis: the crowned plunger end (radius Rc) bears on the straight inner edge of D, e from its pivot',
      stopAdjustment:
        'screw b against stop c sets the cold valve-tip location and therefore the expansion gap and closing temperature',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.61, -2.60, -1.32),
    new THREE.Vector3(4.28, 2.48, 1.32),
  );
  root.userData.cameraDistanceScale = 1.04;
  root.userData.cameraDirection = new THREE.Vector3(8.7, 4.4, 11.8);
  root.userData.groundFloorY = -2.60;
  {
    // The water shows what the trap passes: while the contracted pipe
    // leaves valve a open, condensate spills from A's mouth through the gap
    // to valve a, falls to the bottom of C, runs down its wall into the
    // outlet and out through the base. It is a sheet across the gap whose
    // thickness follows the flow, so it always fits the gap and thins to
    // nothing as the expanding pipe closes it.
    const b = root.userData.blocks;
    const wallY = (x) => cy - Math.sqrt(sphereInnerRadius ** 2 - (x - cx) ** 2);
    const along = 0.075;
    const pathFor = (pipeEndX, valveTipX) => {
      const x = (pipeEndX + valveTipX) / 2;
      const wall = [0, 0.25, 0.5, 0.75, 1].map((u) => {
        const px = THREE.MathUtils.lerp(x, cx + 0.10, u);
        const normal = new THREE.Vector2(cx - px, cy - wallY(px)).normalize();
        return new THREE.Vector3(px + along * normal.x, wallY(px) + along * normal.y, 0);
      });
      return guidedPath([
        new THREE.Vector3(x, pipeAxisY - pipeBoreRadius + 0.02, 0),
        new THREE.Vector3(x, pipeAxisY - pipeOuterRadius - 0.05, 0),
        ...wall,
        new THREE.Vector3(cx + 0.02, cy - innerJoin(outletBoreRadius) - 0.12, 0),
        new THREE.Vector3(cx, -1.6, 0),
        new THREE.Vector3(cx, outletBottomY + 0.02, 0),
      ], { speedAt: (u) => 0.6 + 2.4 * u, samples: 48 });
    };
    const drain = new WaterStream(pathFor(coolPipeEndX, coolValveTipX), {
      width: 0.07, thickness: 0.055, widthExponent: 0, cyclePeriod: cycleDuration,
      streakRate: 1.5, opacity: 0.55, minThickness: 0.003,
    });
    drain.userData.role = 'condensate-falling-through-sphere-C-and-its-outlet';
    root.add(drain);
    b.condensateDrain = drain;
    root.userData.updateWorkingParts = (time, state) => {
      const flow = THREE.MathUtils.clamp(state.flowFraction, 0, 1);
      drain.visible = flow > 1e-3;
      if (!drain.visible) return;
      drain.flow = -1;
      drain.setPath(pathFor(state.pipeEndX, state.valveTipX));
      drain.setFlow(Math.max(0.02, flow));
      // A trickle is faint as well as thin, so it fades out as the gap shuts.
      drain.material.opacity = 0.55 * THREE.MathUtils.smoothstep(flow, 0, 0.12);
      drain.update(time);
    };
  }
  root.userData.minimumDisplayCycleSeconds = cycleDuration;
  root.userData.workingPartsReview = {
    status: 'bounded-finite-geometry',
    residual: 'Thermal history, quasi-static contact and discharge remain prescribed analytical models; passive valve inertia, heat transfer, leakage and transient fluid dynamics are not solved.',
  };
  fitPistonGuide(root, update, cycleDuration);
  // Brown draws a flat section; a narrow view keeps it flat.
  root.userData.cameraDirection.set(0.1, 0.12, 15);
  root.userData.cameraFov = 10;
  markShadows(root);
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredExpansionSteamTrapMovement(movement) {
  if (movement.id !== 478) return null;
  return applyCutawayFor(rayExpansionSteamTrap(movement), movement.id);
}
