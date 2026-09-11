const TAU = 2 * Math.PI;
const smooth = (t) => t * t * (3 - 2 * t);
const slope = (t) => 6 * t * (1 - t);

// Support planes of the actual regular-polygon bore and stud skins. Their
// relative rotation matters: nominal circle radii alone do not establish fit.
export function pinClutchWallGap(delta, p) {
  const offsetX = -p.studCircleRadius * Math.sin(delta);
  const offsetY = p.studCircleRadius * (Math.cos(delta) - 1);
  const apothem = p.holeRadius * Math.cos(Math.PI / p.holeSegments);
  const step = TAU / p.pinSegments;
  let gap = Infinity, normal = null, edge = -1, point = null;
  for (let i = 0; i < p.holeSegments; i += 1) {
    const angle = TAU * (i + 0.5) / p.holeSegments, nx = Math.cos(angle), ny = Math.sin(angle);
    const vertexAngle = delta + step * Math.round((angle - delta) / step);
    const support = p.studRadius * Math.cos(vertexAngle - angle);
    const clearance = apothem - nx * offsetX - ny * offsetY - support;
    if (clearance < gap) {
      gap = clearance; normal = [nx, ny]; edge = i;
      point = [offsetX + p.studRadius * Math.cos(vertexAngle), p.studCircleRadius + offsetY + p.studRadius * Math.sin(vertexAngle)];
    }
  }
  return { gap, normal, edge, point };
}

export function pinClutchMotion(overrides = {}) {
  const p = { driverAngularSpeed: 1.05, studCircleRadius: 0.85, studRadius: 0.09,
    holeRadius: 0.10, pinSegments: 256, holeSegments: 256, contactClearance: 0.000005,
    driverFaceX: 0.20, studLength: 0.32, outputThickness: 0.22,
    retractedFaceX: 0.96, maximumInsertion: 0.18, entryInsertion: 0.018,
    waitingGap: 0.001, inertia: 0.015, collarOffset: 0.635,
    leverPivotX: 1.38, leverPivotY: -0.82, leverLength: 0.85, handleLength: 1.18,
    ...overrides };
  p.cyclePeriod = TAU / p.driverAngularSpeed;
  let low = 0, high = 2 * Math.asin((p.holeRadius - p.studRadius) / (2 * p.studCircleRadius)) * 1.1;
  for (let i = 0; i < 60; i += 1) {
    const mid = (low + high) / 2;
    if (pinClutchWallGap(mid, p).gap > p.contactClearance) low = mid; else high = mid;
  }
  p.contactAngle = (low + high) / 2;
  const contact = pinClutchWallGap(p.contactAngle, p);
  p.contactNormal = contact.normal; p.contactPoint = contact.point;
  p.contactTorqueArm = contact.point[0] * contact.normal[1] - contact.point[1] * contact.normal[0];
  p.studTipX = p.driverFaceX + p.studLength;
  p.lockTime = 0.22 * p.cyclePeriod;
  p.entryTime = p.lockTime - 2 * p.contactAngle / p.driverAngularSpeed;
  p.insertedTime = 0.32 * p.cyclePeriod;
  p.withdrawalTime = 0.52 * p.cyclePeriod;
  p.releaseTime = 0.62 * p.cyclePeriod;
  p.coastDuration = 0.20 * p.cyclePeriod;
  p.stopTime = p.releaseTime + p.coastDuration;
  p.resistingTorque = p.inertia * p.driverAngularSpeed / p.coastDuration;
  p.engagementAngularImpulse = p.inertia * p.driverAngularSpeed;
  p.outputAdvancePerCycle = Math.PI;
  const initialAngle = p.driverAngularSpeed * p.lockTime - p.contactAngle;
  const interpolate = (t, start, end, from, to, mode) => {
    const u = Math.max(0, Math.min(1, (t - start) / (end - start)));
    return { outputFaceX: from + (to - from) * smooth(u), axialSpeed: (to - from) * slope(u) / (end - start), axialMode: mode };
  };
  const axialState = (t) => {
    const approach = 0.06 * p.cyclePeriod, waiting = 0.14 * p.cyclePeriod, retracted = 0.76 * p.cyclePeriod;
    const waitX = p.studTipX + p.waitingGap, entryX = p.studTipX - p.entryInsertion, fullX = p.studTipX - p.maximumInsertion;
    if (t < approach) return { outputFaceX: p.retractedFaceX, axialSpeed: 0, axialMode: 'retracted' };
    if (t < waiting) return interpolate(t, approach, waiting, p.retractedFaceX, waitX, 'approaching');
    if (t < p.entryTime) return { outputFaceX: waitX, axialSpeed: 0, axialMode: 'waiting-for-alignment' };
    if (t < p.lockTime) return interpolate(t, p.entryTime, p.lockTime, waitX, entryX, 'entering-and-taking-up-clearance');
    if (t < p.insertedTime) return interpolate(t, p.lockTime, p.insertedTime, entryX, fullX, 'inserting');
    if (t < p.withdrawalTime) return { outputFaceX: fullX, axialSpeed: 0, axialMode: 'inserted' };
    if (t < p.releaseTime) return interpolate(t, p.withdrawalTime, p.releaseTime, fullX, p.studTipX, 'withdrawing');
    if (t < retracted) return interpolate(t, p.releaseTime, retracted, p.studTipX, p.retractedFaceX, 'retracting');
    return { outputFaceX: p.retractedFaceX, axialSpeed: 0, axialMode: 'retracted' };
  };
  const stateAtTime = (time) => {
    const cycle = Math.floor(time / p.cyclePeriod), t = time - cycle * p.cyclePeriod;
    const axial = axialState(t), locked = t >= p.lockTime && t < p.releaseTime;
    let outputAngle = initialAngle, outputAngularSpeed = 0, outputAcceleration = 0;
    if (locked) { outputAngle = p.driverAngularSpeed * t - p.contactAngle; outputAngularSpeed = p.driverAngularSpeed; }
    else if (t >= p.releaseTime) {
      const coast = Math.min(t - p.releaseTime, p.coastDuration);
      outputAngle = p.driverAngularSpeed * p.releaseTime - p.contactAngle
        + p.driverAngularSpeed * coast - p.driverAngularSpeed * coast ** 2 / (2 * p.coastDuration);
      if (t < p.stopTime) {
        outputAngularSpeed = p.driverAngularSpeed * (1 - coast / p.coastDuration);
        outputAcceleration = -p.driverAngularSpeed / p.coastDuration;
      }
    }
    outputAngle += cycle * p.outputAdvancePerCycle;
    const driverAngle = p.driverAngularSpeed * time;
    const relativeAngle = ((driverAngle - outputAngle + Math.PI / 2) % Math.PI + Math.PI) % Math.PI - Math.PI / 2;
    const followerX = axial.outputFaceX + p.collarOffset, dx = followerX - p.leverPivotX;
    const dy = Math.sqrt(p.leverLength ** 2 - dx ** 2), followerY = p.leverPivotY + dy;
    return { ...axial, time, cycle, cycleTime: t, driverAngle, driverAngularSpeed: p.driverAngularSpeed,
      outputAngle, outputAngularSpeed, outputAcceleration, relativeAngle, locked,
      mode: locked ? 'driving' : outputAngularSpeed > 0 ? 'coasting' : axial.axialMode,
      insertion: Math.max(0, p.studTipX - axial.outputFaceX),
      studNormalForce: locked ? p.resistingTorque / (2 * p.contactTorqueArm) : 0,
      followerX, followerY, leverAngle: Math.atan2(dy, dx) - Math.PI / 2,
      handleX: p.leverPivotX + p.handleLength * dy / p.leverLength,
      handleY: p.leverPivotY - p.handleLength * dx / p.leverLength };
  };
  return { parameters: p, stateAtTime };
}
