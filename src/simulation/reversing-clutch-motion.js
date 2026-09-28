const TAU = 2 * Math.PI;
const smooth = (x) => x * x * (3 - 2 * x);
const slope = (x) => 6 * x * (1 - x);

export function reversingClutchMotion() {
  const p = { inputAngularSpeed: 1.05, teeth: 40, jawCount: 12, jawHeight: 0.09,
    // p96: the jaws sit on short hubs projecting past the bevels' small
    // ends, as Brown draws. Only the face gap enters the motion, so the
    // shifted pair (0.56, 0.32) keeps the previous (0.70, 0.46) kinematics.
    gearFaceDistance: 0.56, centralFaceDistance: 0.32, stroke: 0.11,
    contactAxialGap: 0.00016, entryOverlap: 0.012, waitingGap: 0.002,
    pivotX: 0.12, pivotY: -0.44, leverLength: 0.445, handleLength: 0.39,
    rodLength: 0.50, inertia: 0.015, loadDeceleration: 2.6 };
  p.cyclePeriod = TAU / p.inputAngularSpeed;
  p.sourceTime = 0.77 * p.cyclePeriod;
  p.pitch = TAU / p.jawCount; p.flankSlope = 2 * p.jawHeight / p.pitch;
  p.touchShift = p.gearFaceDistance - p.centralFaceDistance - 2 * p.jawHeight;
  p.entryTime = 0.04 * p.cyclePeriod; p.lockTime = 0.10 * p.cyclePeriod;
  p.insertedTime = 0.25 * p.cyclePeriod; p.withdrawalTime = 0.29 * p.cyclePeriod;
  p.releaseTime = 0.40 * p.cyclePeriod; p.neutralTime = 0.47 * p.cyclePeriod;
  p.coastDuration = p.inputAngularSpeed / p.loadDeceleration;
  p.stopTime = p.releaseTime + p.coastDuration;
  const deltaAt = (amount) => (p.gearFaceDistance - p.centralFaceDistance - amount - p.jawHeight - p.contactAxialGap) / p.flankSlope;
  p.entryDelta = deltaAt(p.touchShift + p.entryOverlap);
  p.releaseDelta = deltaAt(p.touchShift);
  p.lockedAdvance = p.inputAngularSpeed * (p.releaseTime - p.lockTime) - p.releaseDelta + p.entryDelta;
  p.advance = p.lockedAdvance + p.inputAngularSpeed * p.coastDuration / 2;
  p.restAngle = -p.advance + p.inputAngularSpeed * (p.sourceTime - p.cyclePeriod / 2 - p.lockTime) - deltaAt(p.stroke) + p.entryDelta;
  // At the loaded phase the two triangular height profiles sum to the
  // available axial gap. Axial movement therefore cams the shaft as well
  // as selecting it. The opposite flank transmits the reverse direction.
  p.leftCrownPhase = p.restAngle - (-Math.PI / 2 + p.inputAngularSpeed * p.lockTime) - p.pitch / 2 + p.entryDelta;
  p.rightCrownPhase = p.restAngle + p.advance - (Math.PI / 2 - p.inputAngularSpeed * (p.lockTime + p.cyclePeriod / 2)) - p.pitch / 2 - p.entryDelta;
  p.resistingTorque = p.inertia * p.loadDeceleration;
  p.engagementAngularImpulse = p.inertia * p.inputAngularSpeed;
  const shiftAt = (t) => {
    const waiting = p.touchShift - p.waitingGap, entry = p.touchShift + p.entryOverlap;
    const move = (a, b, from, to, mode) => {
      const u = (t - a) / (b - a), distance = to - from;
      return { amount: from + distance * smooth(u), speed: distance * slope(u) / (b - a),
        acceleration: distance * (6 - 12 * u) / (b - a) ** 2, mode };
    };
    if (t < p.entryTime) return move(0, p.entryTime, 0, waiting, 'approaching');
    if (t < p.lockTime) return move(p.entryTime, p.lockTime, waiting, entry, 'entering-and-taking-up-clearance');
    if (t < p.insertedTime) return move(p.lockTime, p.insertedTime, entry, p.stroke, 'inserting');
    if (t < p.withdrawalTime) return { amount: p.stroke, speed: 0, acceleration: 0, mode: 'inserted' };
    if (t < p.releaseTime) return move(p.withdrawalTime, p.releaseTime, p.stroke, p.touchShift, 'withdrawing');
    if (t < p.neutralTime) return move(p.releaseTime, p.neutralTime, p.touchShift, 0, 'retracting');
    return { amount: 0, speed: 0, acceleration: 0, mode: 'neutral' };
  };
  const rawStateAtTime = (time) => {
    const cycle = Math.floor(time / p.cyclePeriod), local = time - cycle * p.cyclePeriod;
    const side = local < p.cyclePeriod / 2 ? 'left' : 'right', sign = side === 'left' ? 1 : -1;
    const t = side === 'left' ? local : local - p.cyclePeriod / 2;
    const shift = shiftAt(t), locked = t >= p.lockTime && t < p.releaseTime;
    let advance = 0, speed = 0, acceleration = 0;
    if (locked) {
      advance = p.inputAngularSpeed * (t - p.lockTime) - deltaAt(shift.amount) + p.entryDelta;
      speed = p.inputAngularSpeed + shift.speed / p.flankSlope;
      acceleration = shift.acceleration / p.flankSlope;
    } else if (t >= p.releaseTime) {
      const coast = Math.min(t - p.releaseTime, p.coastDuration);
      advance = p.lockedAdvance + p.inputAngularSpeed * coast - p.loadDeceleration * coast ** 2 / 2;
      if (coast < p.coastDuration) { speed = p.inputAngularSpeed - p.loadDeceleration * coast; acceleration = -p.loadDeceleration; }
    }
    const outputAngle = p.restAngle + (side === 'right' ? p.advance : 0) + sign * advance;
    const clutchX = -sign * shift.amount, dx = clutchX - p.pivotX, dy = Math.sqrt(p.leverLength ** 2 - dx ** 2);
    const torque = locked ? p.inertia * acceleration + p.resistingTorque : 0;
    const loadTorque = speed > 0 ? -sign * p.resistingTorque : 0;
    return { time, cycle, local, halfTime: t, side, locked, clutchX, axialSpeed: -sign * shift.speed, axialMode: shift.mode,
      outputAngle, outputAngularSpeed: sign * speed, outputAcceleration: sign * acceleration,
      inputAngle: -Math.PI / p.teeth + p.inputAngularSpeed * time,
      leftAngle: -Math.PI / 2 + p.inputAngularSpeed * time,
      rightAngle: Math.PI / 2 - p.inputAngularSpeed * time,
      inputAngularSpeed: p.inputAngularSpeed, activeJawOverlap: Math.max(0, shift.amount - p.touchShift),
      transmittedTorque: sign * torque, loadTorque, outputTorque: sign * torque + loadTorque,
      selectorAxialForce: -sign * torque / p.flankSlope,
      followerX: clutchX, followerY: p.pivotY + dy, leverAngle: Math.atan2(dy, dx) - Math.PI / 2,
      handleX: p.pivotX - p.handleLength * dy / p.leverLength,
      handleY: p.pivotY + p.handleLength * dx / p.leverLength };
  };
  return { parameters: p, rawStateAtTime, stateAtTime: (time) => rawStateAtTime(time + p.sourceTime) };
}
