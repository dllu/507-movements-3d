// Four-bar closure of the auxiliary crank, rigid pitman and long power rocker.
// Dimensions are in the reference animation's drawing units by default.
export function variableRadiusCrankAtAngle(angle, {
  radius = 2, halfSpan = 10, rockerLength = 30,
  rockerPivot = [10, 30], mainPivot = [-10, 0],
} = {}) {
  const auxiliaryPin = [radius * Math.cos(angle), radius * Math.sin(angle)];
  const dx = rockerPivot[0] - auxiliaryPin[0], dy = rockerPivot[1] - auxiliaryPin[1];
  const d = Math.hypot(dx, dy);
  if (d > halfSpan + rockerLength || d < Math.abs(halfSpan - rockerLength)) {
    throw new RangeError('The pitman and power rocker cannot close at this crank angle.');
  }
  const bearing = Math.atan2(dy, dx);
  const offset = Math.acos(Math.max(-1, Math.min(1,
    (d * d + halfSpan * halfSpan - rockerLength * rockerLength) / (2 * d * halfSpan))));
  const pitmanAngle = bearing - offset;
  const direction = [Math.cos(pitmanAngle), Math.sin(pitmanAngle)];
  const wrist = auxiliaryPin.map((x, i) => x + halfSpan * direction[i]);
  const slotPin = auxiliaryPin.map((x, i) => x - halfSpan * direction[i]);
  const mainAngle = Math.atan2(slotPin[1] - mainPivot[1], slotPin[0] - mainPivot[0]);
  return {auxiliaryPin, wrist, slotPin, pitmanAngle, mainAngle,
    slotRadius: Math.hypot(slotPin[0] - mainPivot[0], slotPin[1] - mainPivot[1])};
}
