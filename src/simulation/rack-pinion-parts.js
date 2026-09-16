import { bandInvoluteGear, involute } from './band-epicyclic-geometry.js';
import { poly, plate } from './finite-plate-geometry.js';

export const RACK_PRESSURE_ANGLE = 25 * Math.PI / 180;
export function rackPinionGeometry({radius, teeth, addendum, depth, bore,
  pressureAngle = RACK_PRESSURE_ANGLE, backlash = .001}) {
  return bandInvoluteGear({teeth, baseRadius: radius*Math.cos(pressureAngle),
    baseHalfAngle: Math.PI/(2*teeth)+involute(1/Math.cos(pressureAngle))-backlash/(2*radius),
    rootRadius: radius-addendum-.006, tipRadius: radius+addendum,
    boreRadius:bore, depth, flankSamples:32});
}
// Pitch line y=0, rack travel along X, tips toward +Y. Both members share
// pressure angle and circular pitch; the extra root depth clears mating tips.
export function rackToothGeometry({pitch, addendum, depth,
  pressureAngle=RACK_PRESSURE_ANGLE, backlash=.001}) {
  const root=-addendum-.006, half=pitch/4-backlash/2,
    widthAt=y=>half-y*Math.tan(pressureAngle);
  const geometry=plate(poly([[-widthAt(root),root],[widthAt(root),root],
    [widthAt(addendum),addendum],[-widthAt(addendum),addendum]]),-depth/2,depth/2);
  geometry.userData.rackProfile={pitch,addendum,root,pressureAngle,backlash};
  return geometry;
}
