import source from './source.js';

const point = q => [(q[0] - source.center[0]) / source.scale, (source.center[1] - q[1]) / source.scale];
const rotate = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];

// Ordinary-pin connecting rod with its remote end constrained to the source
// rod's initial direction. The hidden remote guide is a reconstruction choice.
export function makeSpringSectorLinkage() {
  const pin = point(source.circles.rodEyeOuter.center), sourceEnd = point([1020, 282]);
  const delta = sourceEnd.map((v, i) => v - pin[i]), sourceLength = Math.hypot(...delta), direction = delta.map(v => v / sourceLength);
  // Complete the unshown remote pin beyond the engraving's cropped rod end.
  const length = sourceLength + 1.8, end = pin.map((v, i) => v + length * direction[i]);
  const initialAngle = Math.atan2(delta[1], delta[0]), normal = [-direction[1], direction[0]];
  const atAngle = shaftAngle => {
    const crankPin = rotate(pin, shaftAngle), relative = crankPin.map((v, i) => v - end[i]);
    const transverse = dot(relative, normal), discriminant = length ** 2 - transverse ** 2;
    if (!(discriminant > 0)) throw Error('Connecting rod reaches its remote-guide toggle');
    const slider = dot(relative, direction) + Math.sqrt(discriminant), remotePin = end.map((v, i) => v + slider * direction[i]);
    const rodAngle = Math.atan2(remotePin[1] - crankPin[1], remotePin[0] - crankPin[0]), angleDelta = rodAngle - initialAngle;
    const rotatedPin = rotate(pin, angleDelta), translation = crankPin.map((v, i) => v - rotatedPin[i]);
    return {shaftAngle, crankPin, remotePin, slider, rodAngle, angleDelta, translation, discriminant,
      lengthResidual: Math.hypot(...remotePin.map((v, i) => v - crankPin[i])) - length};
  };
  return {pin, end, length, direction, atAngle};
}
