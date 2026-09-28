// Four-bar closure of the auxiliary crank, rigid pitman and long power rocker.
// Dimensions are in the reference animation's drawing units by default.
export function variableRadiusCrankAtAngle(angle, {
  radius = 2, halfSpan = 10, leftSpan = halfSpan, rightSpan = halfSpan, rockerLength = 30,
  rockerPivot = [10, 30], mainPivot = [-10, 0],
} = {}) {
  const auxiliaryPin = [radius * Math.cos(angle), radius * Math.sin(angle)];
  const dx = rockerPivot[0] - auxiliaryPin[0], dy = rockerPivot[1] - auxiliaryPin[1];
  const d = Math.hypot(dx, dy);
  if (d > rightSpan + rockerLength || d < Math.abs(rightSpan - rockerLength)) {
    throw new RangeError('The pitman and power rocker cannot close at this crank angle.');
  }
  const bearing = Math.atan2(dy, dx);
  const offset = Math.acos(Math.max(-1, Math.min(1,
    (d * d + rightSpan * rightSpan - rockerLength * rockerLength) / (2 * d * rightSpan))));
  const pitmanAngle = bearing - offset;
  const direction = [Math.cos(pitmanAngle), Math.sin(pitmanAngle)];
  const wrist = auxiliaryPin.map((x, i) => x + rightSpan * direction[i]);
  const slotPin = auxiliaryPin.map((x, i) => x - leftSpan * direction[i]);
  const mainAngle = Math.atan2(slotPin[1] - mainPivot[1], slotPin[0] - mainPivot[0]);
  return {auxiliaryPin, wrist, slotPin, pitmanAngle, mainAngle,
    slotRadius: Math.hypot(slotPin[0] - mainPivot[0], slotPin[1] - mainPivot[1])};
}

export function sourceVariableCrankGeometry() {
  const scale = .012, phase = Math.atan2(47, 24), radius = Math.hypot(24, 47) * scale;
  const leftSpan = Math.hypot(187, 56) * scale, rightSpan = Math.hypot(163, 46) * scale;
  // Brown breaks the power rocker off 1.36 above its wrist; its fulcrum is
  // not drawn. It is placed 2.5 along the drawn continuation (about one
  // pitman length) so the whole lever sits in the default view. The pin
  // orbit barely changes: over a revolution the slot radius spans
  // 0.361-1.476 (0.375-1.448 with the animation-ratio 7.776 rocker).
  const pitmanAngle = Math.atan2(-102, 350), rockerLength = 2.5;
  const wrist = [24 * scale + rightSpan * Math.cos(pitmanAngle), 47 * scale + rightSpan * Math.sin(pitmanAngle)];
  const rockerDirection = [19 / Math.hypot(19, 112), 112 / Math.hypot(19, 112)];
  return {scale, phase, radius, leftSpan, rightSpan, rockerLength,
    rockerPivot: wrist.map((x, i) => x + rockerLength * rockerDirection[i]),
    mainPivot: [-216 * scale, -3 * scale], period: 4};
}
