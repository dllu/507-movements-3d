const midpoint = (a,b) => a.map((x,i)=>(x+b[i])/2);
const segmentDistance = (p,a,b) => {
  const edge=b.map((x,i)=>x-a[i]),offset=p.map((x,i)=>x-a[i]);
  const lengthSquared=edge.reduce((sum,x)=>sum+x*x,0);
  const t=lengthSquared ? Math.max(0,Math.min(1,offset.reduce((sum,x,i)=>sum+x*edge[i],0)/lengthSquared)) : 0;
  return Math.hypot(...offset.map((x,i)=>x-t*edge[i]));
};

/** Flatten a cubic with an explicit control-hull bound on the chord error. */
export function cubicPolyline(control,tolerance) {
  if (!(Number.isFinite(tolerance) && tolerance>0)) throw new RangeError('Positive finite curve tolerance required');
  if (control.length!==4 || control.some(p=>p.length!==2 || p.some(x=>!Number.isFinite(x))))
    throw new RangeError('Four finite planar control points required');
  const points=[[...control[0]]],pending=[{curve:control,depth:0}];
  let maximumErrorBound=0;
  while (pending.length) {
    const {curve:[a,b,c,d],depth}=pending.pop();
    const error=Math.max(segmentDistance(b,a,d),segmentDistance(c,a,d));
    // A Bezier curve lies in its control hull, so this bounds every point on
    // the accepted subcurve, including control points beyond the chord ends.
    if (error<=tolerance) {points.push([...d]);maximumErrorBound=Math.max(maximumErrorBound,error);continue;}
    if (depth===30) throw new RangeError('Curve tolerance exceeds subdivision precision');
    const ab=midpoint(a,b),bc=midpoint(b,c),cd=midpoint(c,d),abc=midpoint(ab,bc),bcd=midpoint(bc,cd),middle=midpoint(abc,bcd);
    pending.push({curve:[middle,bcd,cd,d],depth:depth+1},{curve:[a,ab,abc,middle],depth:depth+1});
  }
  return {points,maximumErrorBound};
}
