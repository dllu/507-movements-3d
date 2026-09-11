import * as THREE from 'three';

export const fuseeParameters = Object.freeze({
  barrelRadius: 1.0,
  barrelCenterX: -1.38,
  fuseeCenterX: 1.38,
  fuseeTopRadius: 0.50,
  fuseeBottomRadius: 1.08,
  fuseeZTop: 0.32,
  fuseeZBottom: -0.32,
  grooveTurns: 3,
  barrelChainPitch: 0.205,
  barrelChainZTop: 0.40,
  reserveBarrelTurns: 1,
  nominalLinkPitch: 0.08,
});

// Stations are measured along a barrel helix, the straight span, and the
// remaining fusee helix. Chord walking then enforces the actual fixed link
// length, including links straddling a wrap/span transition.
export function makeFuseeMotion(parameters = fuseeParameters) {
  const p = parameters;
  const fullTurn = 2 * Math.PI;
  const grooveAngle = fullTurn * p.grooveTurns;
  const centerDistance = p.fuseeCenterX - p.barrelCenterX;
  const radiusChange = p.fuseeBottomRadius - p.fuseeTopRadius;
  const height = p.fuseeZTop - p.fuseeZBottom;
  const barrelLengthPerTurn = Math.hypot(fullTurn * p.barrelRadius, p.barrelChainPitch);
  const radiusAt = (u) => p.fuseeTopRadius + radiusChange * u;
  const heightAt = (u) => p.fuseeZTop - height * u;
  const speedAt = (u) => Math.hypot(radiusChange, height, grooveAngle * radiusAt(u));
  const sampleCount = 4096;
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
    const fuseeContact = new THREE.Vector3(p.fuseeCenterX + normalX * fuseeRadius,
      heightAt(progress), normalZ * fuseeRadius);
    const barrelLength = barrelTurns * barrelLengthPerTurn;
    const spanLength = barrelContact.distanceTo(fuseeContact);
    const fuseeStartLength = lengthAt(progress);
    const fuseeLength = lengths[sampleCount] - fuseeStartLength;
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
      const u = progressAtLength(fuseeStartLength + station - barrelLength - spanLength);
      const angle = fuseeAngle + grooveAngle * u, radius = radiusAt(u);
      return target.set(p.fuseeCenterX + radius * Math.cos(angle), heightAt(u), -radius * Math.sin(angle));
    };
    return { at, length, barrelLength, spanLength, fuseeLength, barrelAngle, fuseeAngle,
      barrelContact, fuseeContact, contactAngle, progress, barrelTurns, fuseeRadius };
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
  return { parameters: p, stateAtProgress, pathFor, lengthAt, radiusAt, heightAt,
    fullFuseeLength: lengths[sampleCount], barrelLengthPerTurn, totalChainLength, linkPitch, linkCount };
}
