import * as THREE from 'three';

// Brown's fusee (plate 46) as a real fusee: one continuous helical ledge
// wound on a cone. In any radial section the body is a staircase (a flat
// tread the chain lies on and a vertical riser up to the next turn), but
// going round the axis tread and riser sweep on continuously, with no step
// anywhere round the circumference. Seen from above the risers form one
// Archimedean spiral,
//   r(theta) = chainRadiusStart + radialPitch * theta / (2 pi) - riserGap,
// and the tread height falls linearly with theta, leadPerTurn per turn:
// the chain's centre line is a conical helix. theta is the unwrapped angle
// from the top free end of the chain; it is also the body angle.
const chainRadiusStart = 0.56;
const radialPitch = 0.2; // chain radius gained per turn
const leadPerTurn = 0.26; // tread drop per turn
const chainSeat = 0.039; // chain centre above its tread (pins reach 0.037)
const riserGap = 0.0195; // chain centre line outside its riser
const grooveTurns = 2.6; // chain wrapped on the fusee when fully wound
const topTread = 0.111; // tread height at theta = 0

export const fuseeParameters = Object.freeze({
  barrelRadius: 1.0,
  barrelCenterX: -1.38,
  fuseeCenterX: 1.38,
  chainRadiusStart,
  radialPitch,
  leadPerTurn,
  chainSeat,
  riserGap,
  grooveTurns,
  topTread,
  fuseeTopRadius: chainRadiusStart,
  fuseeBottomRadius: chainRadiusStart + radialPitch * grooveTurns,
  fuseeZTop: topTread + chainSeat,
  fuseeZBottom: topTread - leadPerTurn * grooveTurns + chainSeat,
  // The ledge runs out onto the flat top over the turn above the chain's
  // free end and onto the base flange over the turn below its anchored end.
  bodyTop: topTread + leadPerTurn,
  flangeTop: topTread - leadPerTurn * grooveTurns,
  baseRadius: 1.28,
  baseBottom: topTread - leadPerTurn * grooveTurns - 0.16,
  // The reserve turn on the barrel, never unwound, lies above the working
  // turns and eases down onto the first of them.
  barrelChainZTop: 0.47,
  reserveBarrelTurns: 1,
  reserveDescentTurns: 0.2,
  barrelSettleLength: 0.9,
  nominalLinkPitch: 0.08,
});

// Unclamped tread height and riser radius of the helical ledge.
export const fuseeTreadHeight = (p, theta) => p.topTread - p.leadPerTurn * theta / (2 * Math.PI);
export const fuseeRiserRadius = (p, theta) => p.chainRadiusStart + p.radialPitch * theta / (2 * Math.PI) - p.riserGap;
// The tread actually cut at theta: flat top above the run-out, flat flange
// below it.
export const fuseeClampedTread = (p, theta) => THREE.MathUtils.clamp(fuseeTreadHeight(p, theta), p.flangeTop, p.bodyTop);

// Height of the body's top surface at plan point (radius, body angle phi):
// the tread of the innermost riser turn lying inside the point.
export function fuseeSurfaceHeight(p, radius, phi) {
  if (radius > p.baseRadius) return -Infinity;
  const turn = 2 * Math.PI;
  const base = THREE.MathUtils.euclideanModulo(phi, turn) - turn; // first candidate >= -2 pi
  const riserTurns = Math.floor((radius + p.riserGap - p.chainRadiusStart - p.radialPitch * base / turn) / p.radialPitch);
  const theta = base + turn * riserTurns;
  if (theta < -turn) return p.bodyTop;
  return fuseeClampedTread(p, theta);
}

// Chain centre line on the fusee as a function of theta, with derivatives.
export function fuseeTierPath(parameters = fuseeParameters) {
  const p = parameters;
  const dRadius = p.radialPitch / (2 * Math.PI), dHeight = -p.leadPerTurn / (2 * Math.PI);
  const at = (theta) => ({
    radius: p.chainRadiusStart + dRadius * theta,
    height: fuseeTreadHeight(p, theta) + p.chainSeat,
    dRadius, dHeight,
  });
  return { at, wrapAngle: 2 * Math.PI * p.grooveTurns };
}

// Stations are measured along the barrel coil, the straight span, and the
// remaining fusee helix. Chord walking then enforces the actual fixed link
// length, including links straddling a wrap/span transition.
export function makeFuseeMotion(parameters = fuseeParameters) {
  const p = parameters;
  const fullTurn = 2 * Math.PI;
  const grooveAngle = fullTurn * p.grooveTurns;
  const centerDistance = p.fuseeCenterX - p.barrelCenterX;
  const barrelCircumference = fullTurn * p.barrelRadius;
  const tierPath = fuseeTierPath(p);
  const radiusAt = (u) => tierPath.at(grooveAngle * u).radius;
  const heightAt = (u) => tierPath.at(grooveAngle * u).height;
  const speedAt = (u) => {
    const point = tierPath.at(grooveAngle * THREE.MathUtils.clamp(u, 0, 1));
    return grooveAngle * Math.hypot(point.dRadius, point.dHeight, point.radius);
  };
  const sampleCount = 8192;
  const lengths = new Float64Array(sampleCount + 1);
  for (let i = 1; i <= sampleCount; i += 1) {
    lengths[i] = lengths[i - 1] + (speedAt((i - 1) / sampleCount)
      + 4 * speedAt((i - 0.5) / sampleCount) + speedAt(i / sampleCount)) / (6 * sampleCount);
  }
  const lengthAt = (u) => {
    if (u <= 0) return u * speedAt(0);
    if (u >= 1) return lengths[sampleCount] + (u - 1) * speedAt(1);
    const coordinate = u * sampleCount, index = Math.floor(coordinate);
    return THREE.MathUtils.lerp(lengths[index], lengths[index + 1], coordinate - index);
  };
  const progressAtLength = (length) => {
    if (length <= 0) return length / speedAt(0);
    if (length >= lengths[sampleCount]) return 1 + (length - lengths[sampleCount]) / speedAt(1);
    let low = 0, high = sampleCount;
    while (high - low > 1) {
      const middle = (low + high) >> 1;
      if (lengths[middle] > length) high = middle;
      else low = middle;
    }
    return (low + (length - lengths[low]) / (lengths[high] - lengths[low])) / sampleCount;
  };
  // Plan tangent from the barrel circle to the contact circle; the span
  // continues the helix at its lead angle, rising towards the barrel (it
  // leaves over the turn above, so it clears the tread under it).
  const spanGeometry = (progress) => {
    const point = tierPath.at(grooveAngle * progress);
    const normalX = (p.barrelRadius - point.radius) / centerDistance;
    const normalZ = Math.sqrt(1 - normalX * normalX);
    const planSpan = centerDistance * normalZ;
    const rise = -point.dHeight / Math.hypot(point.radius, point.dRadius); // per unit plan length
    return { point, normalX, normalZ, planSpan, rise };
  };

  // Barrel coil, parameterised by chain length sigma from the barrel anchor:
  // the chain reaching the barrel at sigma was laid at that phase's barrel
  // contact height, so the coil records the span.
  const barrelSettle = p.barrelSettleLength;
  const progressSamples = 2048;
  const spans = Array.from({ length: progressSamples + 1 }, (_, i) => spanGeometry(i / progressSamples));
  const contactHeights = spans.map((span) => span.point.height + span.rise * span.planSpan);
  const planSpan0 = spans[0].planSpan;
  const reserveDrop = p.barrelChainZTop - contactHeights[0];
  const reserveDescentLength = Math.hypot(barrelCircumference * p.reserveDescentTurns, reserveDrop);
  const reserveLength = barrelCircumference * (p.reserveBarrelTurns - p.reserveDescentTurns) + reserveDescentLength;
  const sigmaOfProgress = spans.map((span, i) => reserveLength + lengthAt(i / progressSamples) + planSpan0 - span.planSpan);
  const sigmaSamples = 8192;
  const sigmaMax = sigmaOfProgress[progressSamples] + 1;
  const sigmaAt = (i) => sigmaMax * i / sigmaSamples;
  const descentStep = (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
  const settled = new Float64Array(sigmaSamples + 1);
  {
    let j = 0;
    for (let i = 0; i <= sigmaSamples; i += 1) {
      const sigma = sigmaAt(i);
      if (sigma <= reserveLength) {
        const t = THREE.MathUtils.clamp((sigma - reserveLength + reserveDescentLength) / reserveDescentLength, 0, 1);
        settled[i] = p.barrelChainZTop - reserveDrop * descentStep(t);
        continue;
      }
      while (j < progressSamples && sigmaOfProgress[j + 1] < sigma) j += 1;
      if (sigma >= sigmaOfProgress[progressSamples]) settled[i] = contactHeights[progressSamples];
      else {
        const f = (sigma - sigmaOfProgress[j]) / (sigmaOfProgress[j + 1] - sigmaOfProgress[j]);
        settled[i] = THREE.MathUtils.lerp(contactHeights[j], contactHeights[j + 1], THREE.MathUtils.clamp(f, 0, 1));
      }
    }
  }
  const tableValue = (table, sigma) => {
    const coordinate = THREE.MathUtils.clamp(sigma / sigmaMax, 0, 1) * sigmaSamples;
    const index = Math.min(sigmaSamples - 1, Math.floor(coordinate));
    return THREE.MathUtils.lerp(table[index], table[index + 1], coordinate - index);
  };
  const slopeWindow = 0.02;
  const tableSlope = (table, sigma) => (tableValue(table, sigma + slopeWindow)
    - tableValue(table, sigma - slopeWindow)) / (2 * slopeWindow);
  const turns = new Float64Array(sigmaSamples + 1);
  for (let i = 1; i <= sigmaSamples; i += 1) {
    const dSigma = sigmaMax / sigmaSamples, dz = settled[i] - settled[i - 1];
    turns[i] = turns[i - 1] + Math.sqrt(Math.max(0, dSigma * dSigma - dz * dz)) / barrelCircumference;
  }
  const barrelHeightAtLength = (sigma) => tableValue(settled, sigma);
  const barrelTurnsAtLength = (sigma) => (sigma <= sigmaMax ? tableValue(turns, sigma)
    : turns[sigmaSamples] + (sigma - sigmaMax) / barrelCircumference);
  const reserveTurns = barrelTurnsAtLength(reserveLength);

  const pathFor = (progress, barrelLength) => {
    const barrelTurns = barrelTurnsAtLength(barrelLength);
    const { point, normalX, normalZ, rise } = spanGeometry(progress);
    const fuseeRadius = point.radius;
    const contactAngle = Math.atan2(-normalZ, normalX);
    const barrelAngle = contactAngle - fullTurn * barrelTurns;
    const fuseeAngle = contactAngle - grooveAngle * progress;
    const fuseeStartLength = lengthAt(progress);
    const fuseeLength = lengths[sampleCount] - fuseeStartLength;
    const fuseeContact = new THREE.Vector3(p.fuseeCenterX + normalX * fuseeRadius,
      point.height, normalZ * fuseeRadius);
    const barrelContact = new THREE.Vector3(p.barrelCenterX + normalX * p.barrelRadius, 0, normalZ * p.barrelRadius);
    barrelContact.y = point.height + rise * Math.hypot(fuseeContact.x - barrelContact.x, fuseeContact.z - barrelContact.z);
    // Barrel side: the recorded coil, eased onto the arriving span so both
    // height and slope are continuous at the contact (the lift absorbs the
    // small difference between the continuous and the walked chain).
    const barrelEase = Math.min(barrelSettle, barrelLength / 2);
    const barrelLift = barrelContact.y - barrelHeightAtLength(barrelLength);
    const spanRate = rise / Math.hypot(1, rise); // per unit chain length
    const barrelEaseSlope = (spanRate + tableSlope(settled, barrelLength)) * barrelEase;
    const spanLength = barrelContact.distanceTo(fuseeContact);
    const length = barrelLength + spanLength + fuseeLength;
    const at = (station, target = new THREE.Vector3()) => {
      if (station < barrelLength && barrelTurns > 0) {
        const angle = barrelAngle + fullTurn * barrelTurnsAtLength(station);
        const along = barrelLength - station, t = along / barrelEase;
        const eased = along < barrelEase
          ? barrelLift * (2 * t ** 3 - 3 * t ** 2 + 1) + barrelEaseSlope * (t ** 3 - 2 * t ** 2 + t) : 0;
        return target.set(p.barrelCenterX + p.barrelRadius * Math.cos(angle),
          barrelHeightAtLength(station) + eased, -p.barrelRadius * Math.sin(angle));
      }
      if (station < barrelLength + spanLength) {
        return target.copy(barrelContact).lerp(fuseeContact, (station - barrelLength) / spanLength);
      }
      const u = progressAtLength(fuseeStartLength + station - barrelLength - spanLength);
      const helix = tierPath.at(grooveAngle * u);
      const angle = fuseeAngle + grooveAngle * u;
      return target.set(p.fuseeCenterX + helix.radius * Math.cos(angle), helix.height, -helix.radius * Math.sin(angle));
    };
    return { at, length, barrelLength, spanLength, fuseeLength, barrelAngle, fuseeAngle,
      barrelContact, fuseeContact, contactAngle, progress, barrelTurns, fuseeRadius,
      spanRise: rise, barrelLift, barrelSettle: barrelEase };
  };
  const referencePath = pathFor(0, reserveLength);
  const linkCount = Math.round(referencePath.length / p.nominalLinkPitch);
  const walk = (path, pitch, retain = false) => {
    let station = 0;
    const previous = path.at(0), point = new THREE.Vector3();
    const pins = retain ? [previous.clone()] : null;
    const stations = retain ? [0] : null;
    for (let link = 0; link < linkCount; link += 1) {
      let next = station + pitch;
      for (let iteration = 0; iteration < 30; iteration += 1) {
        const correction = pitch - path.at(next, point).distanceTo(previous);
        if (Math.abs(correction) < 2e-12) break;
        next += correction;
      }
      path.at(next, previous);
      station = next;
      if (retain) { pins.push(previous.clone()); stations.push(station); }
    }
    return { residual: station - path.length, pins, stations };
  };
  let linkPitch = referencePath.length / linkCount;
  for (let iteration = 0; iteration < 6; iteration += 1) {
    linkPitch -= walk(referencePath, linkPitch).residual / linkCount;
  }
  const totalChainLength = linkCount * linkPitch;
  const stateAtProgress = (rawProgress, retain = true) => {
    const progress = THREE.MathUtils.clamp(rawProgress, 0, 1);
    let barrelLength = reserveLength + lengthAt(progress) + planSpan0 - spanGeometry(progress).planSpan;
    let path, walked;
    for (let iteration = 0; iteration < 40; iteration += 1) {
      path = pathFor(progress, barrelLength);
      walked = walk(path, linkPitch);
      if (Math.abs(walked.residual) < 2e-10) break;
      barrelLength = Math.max(reserveLength, barrelLength + walked.residual);
    }
    if (retain) walked = walk(path, linkPitch, true);
    return { ...path, ...walked, linkPitch, linkCount, totalChainLength };
  };
  return { parameters: p, tierPath, stateAtProgress, pathFor, lengthAt, radiusAt, heightAt,
    barrelHeightAtLength, barrelTurnsAtLength, reserveLength, reserveTurns, fullFuseeLength: lengths[sampleCount],
    barrelCircumference, totalChainLength, linkPitch, linkCount };
}
