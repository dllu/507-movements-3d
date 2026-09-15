import {waveCamGeometry,waveCamHeight} from './profile.js';

// Angular extrema of the sinusoidal lower face.
export function waveCamProfileCriticalPoints(g=waveCamGeometry()){
 return Array.from({length:2*g.lobes},(_,i)=>i*Math.PI/g.lobes);
}

export function makeWaveCamContactSolver({samples=128,margin=.006,geometry:g=waveCamGeometry()}={}){
 const critical=waveCamProfileCriticalPoints(g),zmin=g.rollerZ-g.rollerDepth/2,zmax=g.rollerZ+g.rollerDepth/2,limit=Math.sqrt(g.outerRadius**2-zmin**2);
 const arm=Math.hypot(g.rollerX-g.pivot[0],g.rollerY-g.pivot[1]),leftLength=Math.hypot(g.outputPin[0]-g.pivot[0],g.outputPin[1]-g.pivot[1]),initialAngle=Math.atan2(g.rollerY-g.pivot[1],g.rollerX-g.pivot[0]),leftX=g.pivot[0]-leftLength*Math.cos(initialAngle);
 function solve(cam){
  function faceAt(x){
   const hi=Math.min(zmax,Math.sqrt(Math.max(0,g.outerRadius**2-x*x)));
   const height=z=>waveCamHeight(Math.atan2(x,z)-cam,g);
   let z=height(zmin)<height(hi)?zmin:hi;
   for(const angle of critical){
    const candidate=x/Math.tan(cam+angle);
    if(candidate<zmin||candidate>hi||!Number.isFinite(candidate))continue;
    if(height(candidate)<height(z))z=candidate;
   }
   return{height:height(z),z};
  }
  const xs=new Set(Array.from({length:samples+1},(_,i)=>-limit+2*limit*i/samples));
  const add=x=>{if(x>-limit&&x<limit)xs.add(x);};
  for(const angle of critical){
   add(zmin*Math.tan(cam+angle));
   const z=g.outerRadius*Math.cos(cam+angle);
   if(z>=zmin&&z<=zmax)add(g.outerRadius*Math.sin(cam+angle));
  }
  const grid=[...xs].sort((a,b)=>a-b).map(x=>({x,...faceAt(x)}));
  function support(centerX){
   const evaluate=(x,face=faceAt(x))=>{const dx=x-centerX;if(Math.abs(dx)>=g.rollerRadius)return{height:Infinity};return{height:face.height-margin-Math.sqrt(g.rollerRadius**2-dx**2),point:[x,face.height,face.z]};};
   const values=grid.map(p=>evaluate(p.x,p));let best=values.reduce((a,b)=>a.height<b.height?a:b);
   const ranges=[[grid[0].x,grid[1].x],[grid.at(-2).x,grid.at(-1).x]];
   for(let i=1;i<grid.length-1;i++)if(values[i].height<=values[i-1].height&&values[i].height<=values[i+1].height)ranges.push([grid[i-1].x,grid[i+1].x]);
   for(let [a,b]of ranges){
    for(let j=0;j<44;j++){const c=a+(b-a)*.3819660112501051,d=b-(b-a)*.3819660112501051;if(evaluate(c).height<evaluate(d).height)b=d;else a=c;}
    const next=evaluate((a+b)/2);if(next.height<best.height)best=next;
   }
   return best;
  }
  const at=theta=>{const center=[g.pivot[0]+arm*Math.cos(theta),g.pivot[1]+arm*Math.sin(theta),g.rollerZ],contact=support(center[0]);return{theta,center,contact,residual:center[1]-contact.height};};
  let low=-.1,high=.45;if(!(at(low).residual<0&&at(high).residual>0))throw new RangeError('No seated follower on the engraved branch');
  for(let i=0;i<36;i++){const middle=(low+high)/2;if(at(middle).residual>0)high=middle;else low=middle;}
  const s=at((low+high)/2);
  return{cam,rocker:s.theta,rollerAngle:0,rollerCenter:s.center,outputY:g.pivot[1]-leftLength*Math.sin(s.theta),shoeX:g.pivot[0]-leftLength*Math.cos(s.theta)-leftX,contactPoint:s.contact.point,residual:s.residual,margin,method:'quasistatic finite-surface contact'};
 }
 return{solve,geometry:{...g,arm,leftLength,leftX},critical};
}
