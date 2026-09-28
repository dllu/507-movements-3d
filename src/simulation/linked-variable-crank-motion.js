import {variableRadiusCrankAtAngle} from './variable-radius-crank-motion.js';

export function linkedVariableCrankGeometry() {
  const scale = .012, phase = Math.atan2(45, -16);
  const rightSpan = Math.hypot(190, 56) * scale, leftSpan = Math.hypot(177, 58) * scale;
  const direction = Math.atan2(114, 367), radius = Math.hypot(16, 45) * scale;
  const wrist = [-16 * scale - rightSpan * Math.cos(direction), 45 * scale - rightSpan * Math.sin(direction)];
  // As in 168, the undrawn rocker fulcrum sits 2.5 along Brown's broken-off
  // continuation (about one pitman length), not 7.776 away.
  const rockerLength = 2.5, norm = Math.hypot(25, 110);
  return {scale, phase, radius, rightSpan, leftSpan, rockerLength,
    rockerPivot: [wrist[0] - rockerLength * 25 / norm, wrist[1] - rockerLength * 110 / norm],
    mainPivot: [159 * scale, -scale], mainRadius: Math.hypot(63, 58) * scale,
    linkLength: Math.hypot(61, 46) * scale, period: 4};
}

export function linkedVariableCrankAtAngle(angle, g = linkedVariableCrankGeometry()) {
  const state = variableRadiusCrankAtAngle(angle, g);
  const dx = state.slotPin[0] - g.mainPivot[0], dy = state.slotPin[1] - g.mainPivot[1];
  const distance = Math.hypot(dx, dy), innerMargin = distance - Math.abs(g.mainRadius - g.linkLength);
  const outerMargin = g.mainRadius + g.linkLength - distance;
  if (innerMargin < 0 || outerMargin < 0) throw new RangeError('Main crank and connecting link cannot close.');
  const mainAngle = Math.atan2(dy, dx) - Math.acos(Math.max(-1, Math.min(1,
    (distance * distance + g.mainRadius ** 2 - g.linkLength ** 2) / (2 * distance * g.mainRadius))));
  const mainPin = [g.mainPivot[0] + g.mainRadius * Math.cos(mainAngle), g.mainPivot[1] + g.mainRadius * Math.sin(mainAngle)];
  return {...state, mainAngle, mainPin, innerMargin, outerMargin};
}
