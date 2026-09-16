// Convex finite pawl against the triangular rack teeth in the mechanism plane.
// The first clear retreat retains the analytic power stroke and avoids letting
// an ideal point constraint hide a collision by the rest of the pawl.
export function polygonsOverlap(a,b,tolerance=1e-9){
 for(const p of [a,b])for(let i=0;i<p.length;i++){
  const q=p[(i+1)%p.length],r=p[i],axis=[q[1]-r[1],r[0]-q[0]],scale=Math.hypot(...axis);
  const x=a.map(v=>v[0]*axis[0]+v[1]*axis[1]),y=b.map(v=>v[0]*axis[0]+v[1]*axis[1]);
  if(Math.min(Math.max(...x),Math.max(...y))-Math.max(Math.min(...x),Math.min(...y))<=tolerance*scale)return false;
 }
 return true;
}
export function pawlPolygon(length){return [[0,-.10],[length-.20,-.03],[length,0],[length-.22,.11],[0,.10]];}
export function clearRackPawl(points,pivot,angle,teeth,lift){
 const c=Math.cos(angle),s=Math.sin(angle),p=points.map(([x,y])=>[pivot.x+c*x-s*y,pivot.y+s*x+c*y]);
 return !teeth.some(t=>polygonsOverlap(p,t.map(([x,y])=>[x,y+lift])));
}
export function firstClearRetreat(clear,minimum,maximum){
 if(clear(minimum))return minimum;
 let previous=minimum;
 for(let i=1;i<=32;i++){
  const next=minimum+(maximum-minimum)*i/32;
  if(clear(next)){
   let a=previous,b=next;
   for(let j=0;j<28;j++){const mid=(a+b)/2;if(clear(mid))b=mid;else a=mid;}
   return b;
  }
  previous=next;
 }
 throw new Error('Rack pawl has no clear retreat within its permitted range');
}

// If the proposed lift cuts into the underside of a retreating tooth while
// the seated pose is still free, stay on that lower contact branch. Jumping
// directly to the clear region above the tooth would teleport the pawl.
export function boundedRetreat(clear,preferred,maximum){
 if(clear(preferred))return preferred;
 if(clear(0)){
  let low=0,high=preferred;
  for(let i=0;i<32;i++){const mid=(low+high)/2;if(clear(mid))low=mid;else high=mid;}
  return low;
 }
 return firstClearRetreat(clear,preferred,maximum);
}
