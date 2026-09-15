// Geometric diagnostic for a cylindrical roller beneath a continuous annular
// wave face. It checks the whole finite roller width, not its vertical top point.
// The legacy mesh is triangulated; this ideal continuous profile is kept separate.
const TAU=2*Math.PI;
function faceMinimumAtX(x,angle,g){
 const dx=x-g.axisX;if(Math.abs(dx)>=g.outerRadius)return null;
 const lo=Math.max(g.rollerZ-g.rollerDepth/2,Math.sqrt(Math.max(0,g.innerRadius**2-dx**2))),hi=Math.min(g.rollerZ+g.rollerDepth/2,Math.sqrt(g.outerRadius**2-dx**2));if(!(hi>=lo&&lo>0))return null;
 const phi=[Math.atan2(dx,lo),Math.atan2(dx,hi)].sort((a,b)=>a-b),u=phi.map(p=>g.waves*(p-angle));
 const critical=Math.ceil((u[0]-Math.PI)/TAU),minimum=Math.PI+critical*TAU;
 let phase=minimum<=u[1]?minimum:Math.cos(u[0])<Math.cos(u[1])?u[0]:u[1];
 const world=angle+phase/g.waves,z=Math.abs(dx)<1e-12?(lo+hi)/2:dx/Math.tan(world);
 return{height:g.meanY+g.amplitude*Math.cos(phase),z:Math.max(lo,Math.min(hi,z))};
}
export function waveCamSupportHeight(centerX,angle,g,{samples=128}={}){
 const at=t=>{const x=centerX+g.rollerRadius*Math.sin(t),face=faceMinimumAtX(x,angle,g);return face?{height:face.height-g.rollerRadius*Math.cos(t),point:[x,face.height,face.z],parameter:t}:{height:Infinity};};
 const rows=Array.from({length:samples+1},(_,i)=>at(-Math.PI/2+Math.PI*i/samples));let best=rows.reduce((a,b)=>a.height<b.height?a:b);
 for(let i=1;i<samples;i++)if(rows[i].height<=rows[i-1].height&&rows[i].height<=rows[i+1].height&&Number.isFinite(rows[i].height)){
  let a=-Math.PI/2+Math.PI*(i-1)/samples,b=-Math.PI/2+Math.PI*(i+1)/samples;
  for(let step=0;step<64;step++){const c=a+(b-a)*.3819660112501051,d=b-(b-a)*.3819660112501051;if(at(c).height<at(d).height)b=d;else a=c;}
  const candidate=at((a+b)/2);if(candidate.height<best.height)best=candidate;
 }
 if(!Number.isFinite(best.height))throw new RangeError('Roller misses the annular cam');return best;
}
export function waveCamSeatedRocker(angle,g,options){
 const state=theta=>{const center=[g.pivot[0]+g.armLength*Math.cos(theta),g.pivot[1]+g.armLength*Math.sin(theta),g.rollerZ],support=waveCamSupportHeight(center[0],angle,g,options);return{theta,center,support,residual:center[1]-support.height};};
 let low=-.65,high=.65;const a=state(low),b=state(high);if(!(a.residual<0&&b.residual>0))throw new RangeError('No seated rocker configuration in the intended branch');
 for(let i=0;i<52;i++){const middle=(low+high)/2;if(state(middle).residual>0)high=middle;else low=middle;}return state((low+high)/2);
}
