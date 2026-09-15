import {ReturnBandRoute} from './band-route.js';
// Forward kinematics preserves every leaf link length between baked keyframes.
export function springTreadleState(q,rest){
 const {points,lengths,angles,eyeIndex,tieLocal}=rest,leafPoints=[points[0].slice()];let delta=0,upper;
 for(let i=0;i<lengths.length;i++){
  if(i)delta+=q[i-1];const a=angles[i]+delta,c=Math.cos(a),s=Math.sin(a),p=leafPoints[i];
  leafPoints.push([p[0]+lengths[i]*c,p[1]+lengths[i]*s,0]);
  if(i===eyeIndex-1)upper=[p[0]+c*tieLocal[0]-s*tieLocal[1],p[1]+s*tieLocal[0]+c*tieLocal[1],0];
 }
 const treadle=q[lengths.length-1],c=Math.cos(treadle),s=Math.sin(treadle),point=([x,y])=>[-2.862+c*x-s*y,-2.898+s*x+c*y,0],lower=point([3.6,.576]);
 return{treadle,upper,lower,foot:point([5.274,.666]),leafPoints,rotorPhase:new ReturnBandRoute(upper,lower).rotorPhase};
}
