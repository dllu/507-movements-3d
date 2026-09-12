// Two independent angular contact equations fix both angular velocities from
// the prescribed input. Optional Newton seed metadata is irrelevant to that
// rank. Only an underconstrained angular system needs the sliding-cam step cap.
export function pumpCatchHasSlidingCam(active){
  if(!active.some(c=>c.kind==='cam'))return false;
  const angular=active.filter(c=>['cam','stop','heel'].includes(c.kind));
  for(let i=0;i<angular.length;i++)for(let j=i+1;j<angular.length;j++){
    const a=angular[i].gradient,b=angular[j].gradient;
    if(Math.abs(a[0]*b[1]-a[1]*b[0])>1e-10)return false;
  }
  return true;
}
