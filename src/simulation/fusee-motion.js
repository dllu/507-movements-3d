import * as THREE from 'three';

// Brown's fusee is a stack of flat turned tiers (plate 46: three working
// tiers over a base flange). Seen from above, the risers form one smooth
// Archimedean spiral: the chain's centre line runs at radius
//   r(theta) = chainRadiusStart + radialPitch * theta / (2 pi),
// so its leverage grows steadily as it winds on. Each tier is a flat
// spiral (snail) plate spanning one turn of that spiral, ending in a radial
// step; all the steps lie on one radius. The chain lies level on a tier's
// shelf against the riser above, and at the step it runs down the next
// riser (still on the spiral) to the shelf below.
const chainRadiusStart = 0.56;
const radialPitch = 0.23; // chain radius gained per turn
const tierHeight = 0.26;
const tierTop = 0.34;
const tierCount = 3;
const chainSeat = 0.039; // chain centre above its shelf (pins reach 0.037)
const riserGap = 0.0195; // chain centre line outside its riser
const tierShelves = Array.from({ length: tierCount }, (_, k) => tierTop - tierHeight * (k + 1));
const tierChainHeights = tierShelves.map((shelf) => shelf + chainSeat);
const stepAngle = 3.8; // first step (unwrapped chain angle); later ones a turn apart
const descentAngle = 1.25;
const lastTierArc = 2 * Math.PI - descentAngle - 0.03; // the lowest tier's whole turn
const descentStarts = Array.from({ length: tierCount - 1 }, (_, k) => stepAngle + 2 * Math.PI * k);
const wrapAngle = descentStarts.at(-1) + descentAngle + lastTierArc;
const spiralRadius = (theta) => chainRadiusStart + radialPitch * theta / (2 * Math.PI);

export const fuseeParameters = Object.freeze({
  barrelRadius: 1.0,
  barrelCenterX: -1.38,
  fuseeCenterX: 1.38,
  fuseeTopRadius: spiralRadius(0),
  fuseeBottomRadius: spiralRadius(wrapAngle),
  fuseeZTop: tierChainHeights[0],
  fuseeZBottom: tierChainHeights.at(-1),
  grooveTurns: wrapAngle / (2 * Math.PI),
  chainRadiusStart,
  radialPitch,
  tierCount,
  tierChainHeights: Object.freeze(tierChainHeights),
  tierShelves: Object.freeze(tierShelves),
  tierHeight,
  tierTop,
  chainSeat,
  riserGap,
  baseRadius: 1.28,
  baseBottom: tierShelves.at(-1) - 0.16,
  stepAngle,
  descentAngle,
  descentStarts: Object.freeze(descentStarts),
  barrelChainPitch: 0.24,
  barrelChainZTop: 0.487,
  reserveBarrelTurns: 1,
  nominalLinkPitch: 0.08,
  contactSettleLength: 0.45,
});

// The descent is two parabolas (constant edgewise curvature, the least for a
// given drop), so the chain's pins tilt as little as possible in their bores.
const descentStep = (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
const descentSlope = (t) => (t < 0.5 ? 4 * t : 4 * (1 - t));

// Riser (plan outline) radius of tier k at body angle phi: the spiral turn
// that tier k carries, from its step at stepAngle + 2 pi (k - 1) to the next.
export function fuseeRiserRadius(parameters, k, phi) {
  const p = parameters;
  const start = p.stepAngle + 2 * Math.PI * (k - 1);
  const theta = start + THREE.MathUtils.euclideanModulo(phi - start, 2 * Math.PI);
  return p.chainRadiusStart + p.radialPitch * theta / (2 * Math.PI) - p.riserGap;
}

// Chain centre line on the fusee as a function of the wrapped angle theta
// (0 at the top free end, wrapAngle at the anchored bottom end), with
// derivatives with respect to theta. theta is also the body angle.
export function fuseeTierPath(parameters = fuseeParameters) {
  const p = parameters;
  const heights = p.tierChainHeights;
  const at = (theta) => {
    const radius = p.chainRadiusStart + p.radialPitch * theta / (2 * Math.PI);
    const dRadius = p.radialPitch / (2 * Math.PI);
    let height = heights[0], dHeight = 0, tier = 0, phase = 'level';
    for (let k = 0; k < p.descentStarts.length; k += 1) {
      const fall = (theta - p.descentStarts[k]) / p.descentAngle;
      if (fall < 0) break;
      const deltaZ = heights[k + 1] - heights[k];
      if (fall < 1) {
        height = heights[k] + deltaZ * descentStep(fall);
        dHeight = deltaZ * descentSlope(fall) / p.descentAngle;
        tier = k; phase = 'descent';
      } else {
        height = heights[k + 1]; dHeight = 0; tier = k + 1; phase = 'level';
      }
    }
    return { radius, height, dRadius, dHeight, tier, phase };
  };
  return { at, wrapAngle: 2 * Math.PI * p.grooveTurns };
}

// Stations are measured along a barrel helix, the straight span, and the
// remaining fusee helix. Chord walking then enforces the actual fixed link
// length, including links straddling a wrap/span transition.
export function makeFuseeMotion(parameters = fuseeParameters) {
  const p = parameters;
  const fullTurn = 2 * Math.PI;
  const grooveAngle = fullTurn * p.grooveTurns;
  const centerDistance = p.fuseeCenterX - p.barrelCenterX;
  const barrelLengthPerTurn = Math.hypot(fullTurn * p.barrelRadius, p.barrelChainPitch);
  const tierPath = fuseeTierPath(p);
  const radiusAt = (u) => tierPath.at(grooveAngle * u).radius;
  const heightAt = (u) => tierPath.at(grooveAngle * u).height;
  const speedAt = (u) => {
    const point = tierPath.at(grooveAngle * THREE.MathUtils.clamp(u, 0, 1));
    return grooveAngle * Math.hypot(point.dRadius, point.dHeight, point.radius);
  };
  const sampleCount = 16384;
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
  const pathFor = (progress, barrelTurns) => {
    const fuseeRadius = radiusAt(progress);
    const normalX = (p.barrelRadius - fuseeRadius) / centerDistance;
    const normalZ = Math.sqrt(1 - normalX * normalX);
    const contactAngle = Math.atan2(-normalZ, normalX);
    const barrelAngle = contactAngle - fullTurn * barrelTurns;
    const fuseeAngle = contactAngle - grooveAngle * progress;
    const barrelContact = new THREE.Vector3(p.barrelCenterX + normalX * p.barrelRadius,
      p.barrelChainZTop - barrelTurns * p.barrelChainPitch, normalZ * p.barrelRadius);
    const fuseeStartLength = lengthAt(progress);
    const fuseeLength = lengths[sampleCount] - fuseeStartLength;
    // The chain is free to slide up and down a riser, so near the point where
    // it leaves the fusee it eases from the tier path onto the straight span:
    // over the last settle length it is lifted (or lowered) by a parabola
    // whose slope at the contact matches the span. No joint then kinks
    // edgewise at the contact.
    const settle = Math.min(p.contactSettleLength, fuseeLength / 2);
    const tierPoint = tierPath.at(grooveAngle * progress);
    const pathSlope = settle > 0 ? grooveAngle * tierPoint.dHeight / speedAt(progress) : 0;
    const fuseeContact = new THREE.Vector3(p.fuseeCenterX + normalX * fuseeRadius,
      tierPoint.height, normalZ * fuseeRadius);
    let lift = 0;
    for (let iteration = 0; iteration < 4 && settle > 0; iteration += 1) {
      const lifted = fuseeContact.clone().setY(tierPoint.height + lift);
      const run = barrelContact.distanceTo(lifted);
      const spanSlope = (lifted.y - barrelContact.y) / run;
      lift = (pathSlope - spanSlope) * settle / 2;
    }
    // At a step the tier below reaches a radial pitch further out just
    // behind the step. While the chain leaves the fusee part-way down a
    // descent, the straight span back over that step would pass through the
    // tier below, so the chain rides over the step's top edge instead: the
    // contact is held up until the whole span over that tier clears it.
    const stepLift = (() => {
      const theta = grooveAngle * progress;
      const k = p.descentStarts.findIndex((start) => theta >= start && theta - start < Math.PI / 2);
      if (k < 0) return 0;
      const delta = theta - p.descentStarts[k];
      const planSpan = Math.hypot(barrelContact.x - fuseeContact.x, barrelContact.z - fuseeContact.z);
      const need = p.tierChainHeights[k];
      const clearance = (s) => {
        const behind = Math.atan2(s, fuseeRadius);
        const phi = theta - behind;
        return Math.hypot(fuseeRadius, s) - fuseeRiserRadius(p, k + 1, phi);
      };
      const weight = (gap) => 1 - THREE.MathUtils.smoothstep(gap, 0.025, 0.25);
      const requiredAt = (s) => {
        const f = s / planSpan;
        if (f >= 0.95) return -Infinity;
        const required = (need - barrelContact.y * f) / (1 - f);
        return tierPoint.height + weight(clearance(s)) * (required - tierPoint.height);
      };
      const crossing = fuseeRadius * Math.tan(delta);
      let required = requiredAt(crossing);
      for (let i = 1; i <= 96; i += 1) {
        const s = 1.2 * i / 96;
        if (s > crossing) required = Math.max(required, requiredAt(s));
      }
      return Math.max(0, required - tierPoint.height);
    })();
    // The ease is a cubic from (lift, span slope) at the contact to the tier
    // path over easeLength; with no step lift it is the slope-matching
    // parabola above. A larger lift eases over a longer run, which keeps
    // the chain's edgewise bend within what its pins allow.
    const easeLength = Math.min(settle + 7 * Math.sqrt(Math.max(0, stepLift - lift)),
      Math.max(settle, fuseeLength / 2));
    lift = Math.max(lift, stepLift);
    fuseeContact.y = tierPoint.height + lift;
    const spanSlope = settle > 0 ? (fuseeContact.y - barrelContact.y) / barrelContact.distanceTo(fuseeContact) : 0;
    const easeSlope = (spanSlope - pathSlope) * easeLength;
    const barrelLength = barrelTurns * barrelLengthPerTurn;
    const spanLength = barrelContact.distanceTo(fuseeContact);
    const length = barrelLength + spanLength + fuseeLength;
    const at = (station, target = new THREE.Vector3()) => {
      if (station < barrelLength && barrelTurns > 0) {
        const turns = station / barrelLengthPerTurn;
        const angle = barrelAngle + fullTurn * turns;
        return target.set(p.barrelCenterX + p.barrelRadius * Math.cos(angle),
          p.barrelChainZTop - p.barrelChainPitch * turns, -p.barrelRadius * Math.sin(angle));
      }
      if (station < barrelLength + spanLength) {
        return target.copy(barrelContact).lerp(fuseeContact, (station - barrelLength) / spanLength);
      }
      const along = station - barrelLength - spanLength;
      const u = progressAtLength(fuseeStartLength + along);
      const angle = fuseeAngle + grooveAngle * u, radius = radiusAt(u);
      const t = along / easeLength;
      const eased = along < easeLength
        ? lift * (2 * t ** 3 - 3 * t ** 2 + 1) + easeSlope * (t ** 3 - 2 * t ** 2 + t) : 0;
      const point = tierPath.at(grooveAngle * u);
      // Never below the seat the chain is running down to.
      const seat = p.tierChainHeights[point.phase === 'descent' ? point.tier + 1 : point.tier];
      const height = Math.max(point.height + eased, Math.min(point.height, seat));
      return target.set(p.fuseeCenterX + radius * Math.cos(angle), height, -radius * Math.sin(angle));
    };
    return { at, length, barrelLength, spanLength, fuseeLength, barrelAngle, fuseeAngle,
      barrelContact, fuseeContact, contactAngle, progress, barrelTurns, fuseeRadius, contactLift: lift, stepLift, settle: easeLength, baseSettle: settle };
  };
  const referencePath = pathFor(0, p.reserveBarrelTurns);
  const linkCount = Math.round(referencePath.length / p.nominalLinkPitch);
  const walk = (path, pitch, retain = false) => {
    let station = 0;
    const previous = path.at(0), point = new THREE.Vector3();
    const pins = retain ? [previous.clone()] : null;
    const stations = retain ? [0] : null;
    for (let link = 0; link < linkCount; link += 1) {
      let next = station + pitch;
      for (let iteration = 0; iteration < 10; iteration += 1) {
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
    let barrelTurns = p.reserveBarrelTurns + lengthAt(progress) / barrelLengthPerTurn;
    let path, walked;
    for (let iteration = 0; iteration < 40; iteration += 1) {
      path = pathFor(progress, barrelTurns);
      walked = walk(path, linkPitch);
      if (Math.abs(walked.residual) < 2e-10) break;
      barrelTurns = Math.max(p.reserveBarrelTurns, barrelTurns + walked.residual / barrelLengthPerTurn);
    }
    if (retain) walked = walk(path, linkPitch, true);
    return { ...path, ...walked, linkPitch, linkCount, totalChainLength };
  };
  return { parameters: p, tierPath, stateAtProgress, pathFor, lengthAt, radiusAt, heightAt,
    fullFuseeLength: lengths[sampleCount], barrelLengthPerTurn, totalChainLength, linkPitch, linkCount };
}
