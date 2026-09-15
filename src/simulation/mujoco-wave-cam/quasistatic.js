import {waveCamGeometry,waveCamTrace,waveCamTraceY} from './profile.js';
import {waveCamProjectedHeight} from './projected-profile.js';

// Profile minima over an interval occur at its endpoints, measured monotonic
// cubic boundaries, or crossings of the cubic and roller envelope. The circle
// is monotonic on either side of its crown; same-direction branches cannot
// introduce an interior minimum even if they cross more than once.
export function waveCamProfileCriticalPoints(g=waveCamGeometry()){
 const raw=x=>g.topY+(177-waveCamTraceY(g.axisPixelX+x/g.scale))*g.scale;
 const circle=x=>g.rollerY+Math.sqrt(Math.max(0,g.rollerRadius**2-(x-g.rollerX)**2));
 const knots=[...waveCamTrace.map(([x])=>(x-g.axisPixelX)*g.scale),g.rollerX-g.rollerRadius,g.rollerX,g.rollerX+g.rollerRadius].sort((a,b)=>a-b),result=[...knots];
 for(let i=1;i<knots.length;i++){
  let a=knots[i-1],b=knots[i];if(a<g.rollerX-g.rollerRadius||b>g.rollerX+g.rollerRadius)continue;
  let fa=raw(a)-circle(a),fb=raw(b)-circle(b);if(fa*fb>=0)continue;
  for(let j=0;j<48;j++){const c=(a+b)/2,fc=raw(c)-circle(c);if(fa*fc>0){a=c;fa=fc;}else{b=c;fb=fc;}}
  result.push((a+b)/2);
 }
 return result.sort((a,b)=>a-b);
}

export function makeWaveCamContactSolver({samples=128,margin=.006,geometry:g=waveCamGeometry()}={}){
 const critical=waveCamProfileCriticalPoints(g),zmin=g.rollerZ-g.rollerDepth/2,zmax=g.rollerZ+g.rollerDepth/2,limit=Math.sqrt(g.outerRadius**2-zmin**2);
 const arm=Math.hypot(g.rollerX-g.pivot[0],g.rollerY-g.pivot[1]),leftLength=Math.hypot(g.outputPin[0]-g.pivot[0],g.outputPin[1]-g.pivot[1]),initialAngle=Math.atan2(g.rollerY-g.pivot[1],g.rollerX-g.pivot[0]),leftX=g.pivot[0]-leftLength*Math.cos(initialAngle);
 function solve(cam){
  const cos=Math.cos(cam),sin=Math.sin(cam);
  function faceAt(x){
   const hi=Math.min(zmax,Math.sqrt(Math.max(0,g.outerRadius**2-x*x))),u=x*cos-zmin*sin,v=x*cos-hi*sin,low=Math.min(u,v),high=Math.max(u,v);
   let local=waveCamProjectedHeight(u,g)<waveCamProjectedHeight(v,g)?u:v,height=waveCamProjectedHeight(local,g);
   for(const k of critical){if(k<low)continue;if(k>high)break;const h=waveCamProjectedHeight(k,g);if(h<height){height=h;local=k;}}
   return{height,z:Math.abs(sin)>1e-12?Math.max(zmin,Math.min(hi,(x*cos-local)/sin)):zmin};
  }
  const xs=new Set(Array.from({length:samples+1},(_,i)=>-limit+2*limit*i/samples));
  const add=x=>{if(x>-limit&&x<limit)xs.add(x);};
  for(const k of critical){
   if(Math.abs(cos)>1e-12)add((k+zmin*sin)/cos);
   if(Math.abs(k)<=g.outerRadius){const a=Math.asin(k/g.outerRadius);for(const phi of [cam+a,cam+Math.PI-a]){const z=g.outerRadius*Math.cos(phi);if(z>=zmin&&z<=zmax)add(g.outerRadius*Math.sin(phi));}}
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
