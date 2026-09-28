import * as THREE from 'three';

// Brown's fusee is a stack of flat turned tiers (plate 46: three working
// tiers over a base flange). The chain wraps each tier level, seated on the
// shelf of the tier below and against its own riser, and climbs to the next
// tier once per turn: a short spiral lobe on the tier carries it outward over
// the shelf, then it runs down the next riser. Each tier's transition window
// is staggered round the axis so no lobe lies under another turn's descent.
const tierChainRadii = [0.62, 0.85, 1.08];
const tierHeight = 0.26;
const tierTop = 0.34;
const chainSeat = 0.039; // chain centre above its shelf (pins reach 0.037)
const riserGap = 0.0195; // chain centre line outside its riser
const tierShelves = tierChainRadii.map((_, k) => tierTop - tierHeight * (k + 1));
const tierChainHeights = tierShelves.map((shelf) => shelf + chainSeat);
const riseAngle = 1.1;
const descentAngle = 1.25;
const firstTransition = 3.8;
const transitionAdvance = 2 * Math.PI - 1.4;
const lastTierArc = 4.0;
const transitionStarts = [firstTransition, firstTransition + transitionAdvance];
const wrapAngle = transitionStarts.at(-1) + riseAngle + descentAngle + lastTierArc;

export const fuseeParameters = Object.freeze({
  barrelRadius: 1.0,
  barrelCenterX: -1.38,
  fuseeCenterX: 1.38,
  fuseeTopRadius: tierChainRadii[0],
  fuseeBottomRadius: tierChainRadii.at(-1),
  fuseeZTop: tierChainHeights[0],
  fuseeZBottom: tierChainHeights.at(-1),
  grooveTurns: wrapAngle / (2 * Math.PI),
  tierChainRadii: Object.freeze(tierChainRadii),
  tierChainHeights: Object.freeze(tierChainHeights),
  tierShelves: Object.freeze(tierShelves),
  tierHeight,
  tierTop,
  chainSeat,
  riserGap,
  lobeGap: 0.0235,
  baseRadius: 1.28,
  baseBottom: tierShelves.at(-1) - 0.16,
  riseAngle,
  descentAngle,
  transitionStarts: Object.freeze(transitionStarts),
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

// Chain centre line on the fusee as a function of the wrapped angle theta
// (0 at the top free end, wrapAngle at the anchored bottom end), with
// derivatives with respect to theta.
export function fuseeTierPath(parameters = fuseeParameters) {
  const p = parameters;
  const radii = p.tierChainRadii, heights = p.tierChainHeights;
  const at = (theta) => {
    let radius = radii[0], height = heights[0], dRadius = 0, dHeight = 0, tier = 0;
    let phase = 'level';
    for (let k = 0; k < p.transitionStarts.length; k += 1) {
      const start = p.transitionStarts[k];
      if (theta < start) break;
      const rise = (theta - start) / p.riseAngle;
      const fall = (theta - start - p.riseAngle) / p.descentAngle;
      const deltaR = radii[k + 1] - radii[k], deltaZ = heights[k + 1] - heights[k];
      if (rise < 1) {
        radius = radii[k] + deltaR * (1 - Math.cos(Math.PI * rise)) / 2;
        dRadius = deltaR * Math.PI * Math.sin(Math.PI * rise) / (2 * p.riseAngle);
        height = heights[k]; dHeight = 0; tier = k; phase = 'rise';
      } else if (fall < 1) {
        radius = radii[k + 1]; dRadius = 0;
        height = heights[k] + deltaZ * descentStep(fall);
        dHeight = deltaZ * descentSlope(fall) / p.descentAngle;
        tier = k; phase = 'descent';
      } else {
        radius = radii[k + 1]; height = heights[k + 1]; dRadius = 0; dHeight = 0;
        tier = k + 1; phase = 'level';
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
    fuseeContact.y = tierPoint.height + lift;
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
      const eased = along < settle ? lift * (1 - along / settle) ** 2 : 0;
      const point = tierPath.at(grooveAngle * u);
      // Never below the seat the chain is running down to.
      const seat = p.tierChainHeights[point.phase === 'descent' ? point.tier + 1 : point.tier];
      const height = Math.max(point.height + eased, Math.min(point.height, seat));
      return target.set(p.fuseeCenterX + radius * Math.cos(angle), height, -radius * Math.sin(angle));
    };
    return { at, length, barrelLength, spanLength, fuseeLength, barrelAngle, fuseeAngle,
      barrelContact, fuseeContact, contactAngle, progress, barrelTurns, fuseeRadius, contactLift: lift, settle };
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
    for (let iteration = 0; iteration < 12; iteration += 1) {
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
