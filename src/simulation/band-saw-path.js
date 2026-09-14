import {bandSawDimensions as source} from '../data/band-saw-dimensions.js';
export const bandSawPathDimensions={
 radius:source.wheelRadius/100,
 spacing:(source.lowerWheel[1]-source.upperWheel[1])/100,
 thickness:.005,width:.12,toothProjection:.035,
 wheelBack:-.08,wheelFront:.045,
 period:12,
};
const {radius:r,spacing:h}=bandSawPathDimensions;
export const bandSawPathLength=2*h+2*Math.PI*r;
/** Clockwise material travel, starting at the upper wheel's right tangent. */
export function bandSawPoint(distance){
 if(!Number.isFinite(distance))throw new RangeError('Invalid blade distance');
 const s=((distance%bandSawPathLength)+bandSawPathLength)%bandSawPathLength;
 let point,tangent,section;
 if(s<h){point=[r,h-s];tangent=[0,-1];section='cutting';}
 else if(s<h+Math.PI*r){const a=-(s-h)/r;point=[r*Math.cos(a),r*Math.sin(a)];tangent=[Math.sin(a),-Math.cos(a)];section='lower-wrap';}
 else if(s<2*h+Math.PI*r){point=[-r,s-h-Math.PI*r];tangent=[0,1];section='return';}
 else{const a=-Math.PI-(s-2*h-Math.PI*r)/r;point=[r*Math.cos(a),h+r*Math.sin(a)];tangent=[Math.sin(a),-Math.cos(a)];section='upper-wrap';}
 return {point,tangent,normal:[-tangent[1],tangent[0]],section};
}
export function bandSawMotion(time){
 if(!Number.isFinite(time)||time<0)throw new RangeError('Invalid time');
 const speed=bandSawPathLength/bandSawPathDimensions.period;
 return {travel:time*speed,speed,wheelAngle:-time*speed/r,wheelAngularSpeed:-speed/r};
}
