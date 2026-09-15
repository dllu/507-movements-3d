import {waveCamHeight} from './profile.js';

// Resolve narrow roller-envelope transitions without uniformly multiplying the
// collision mesh count. Interior probes catch narrow curvature missed by a midpoint.
export function waveCamProfileAngles({segments=90,tolerance=.001}={}){
 const angles=[0];
 function split(a,b,depth=0){
  const ya=waveCamHeight(a),yb=waveCamHeight(b);
  const error=Math.max(...Array.from({length:15},(_,i)=>(i+1)/16).map(u=>Math.abs(waveCamHeight(a+(b-a)*u)-(ya+(yb-ya)*u))));
  if(error>.9*tolerance&&depth<20){const mid=(a+b)/2;split(a,mid,depth+1);split(mid,b,depth+1);}else angles.push(b);
 }
 for(let i=0;i<segments;i++)split(2*Math.PI*i/segments,2*Math.PI*(i+1)/segments);
 return angles;
}
