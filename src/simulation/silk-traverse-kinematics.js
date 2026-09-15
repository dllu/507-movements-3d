import {silkTraverseDimensions as s} from '../data/silk-traverse-dimensions.js';
const vector=(a,b)=>[(a[0]-b[0])/100,(b[1]-a[1])/100];
const rotate=([x,y],a)=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];
export const silkTraverseGeometry={orbit:vector(s.planetCenter,s.diskCenter),crank:vector(s.crankWrist,s.planetCenter),ratio:s.sunTeeth/s.planetTeeth,rodLength:3.7,carrierPeriod:5,period:15};
/** The omitted connecting rod length and vertical output guide are inferred. */
export function silkTraverseAtTime(time){
 if(!Number.isFinite(time)||time<0)throw new RangeError('Invalid time');
 const g=silkTraverseGeometry,angle=time*2*Math.PI/g.carrierPeriod,planetAngle=(1+g.ratio)*angle;
 const planet=rotate(g.orbit,angle),crank=rotate(g.crank,planetAngle),wrist=planet.map((v,i)=>v+crank[i]);
 const slider=[0,wrist[1]-Math.sqrt(g.rodLength**2-wrist[0]**2)];
 return {angle,planetAngle,planet,wrist,slider,rodAngle:Math.atan2(slider[1]-wrist[1],slider[0]-wrist[0]),effectiveRadius:Math.hypot(...wrist)};
}
