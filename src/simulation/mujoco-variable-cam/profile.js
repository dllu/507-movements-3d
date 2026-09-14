import {variableCamOutline as trace} from '../../data/variable-cam-outline.js';
/** Cubic tracing of the engraving; preserves its sharp corners without bevels. */
export function variableCamProfile(samplesPerArc=64){
 const points=[];let a=trace.start;
 for(const [b,c,d]of trace.curves){
  for(let i=0;i<samplesPerArc;i++){
   const t=i/samplesPerArc,u=1-t;
   const p=[0,1].map(k=>u**3*a[k]+3*u*u*t*b[k]+3*u*t*t*c[k]+t**3*d[k]);
   points.push([(p[0]-trace.shaft[0])/trace.pixelsPerUnit,(trace.shaft[1]-p[1])/trace.pixelsPerUnit]);
  }
  a=d;
 }
 let initialRadius=-Infinity;
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length];
  if(a[0]*b[0]<=0&&a[0]!==b[0])initialRadius=Math.max(initialRadius,a[1]-a[0]*(b[1]-a[1])/(b[0]-a[0]));
 }
 return {points,initialRadius};
}
