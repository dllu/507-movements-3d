import { writeFile } from 'node:fs/promises';
import clipping from 'polygon-clipping';
import { makeSingleToothIndexMotion } from './lib/single-tooth-index-motion.mjs';

const name = process.env.CANDIDATE_PROFILE ?? 'source-envelope';
const { default: profile } = await import(`./lib/single-tooth-${name}-profile.mjs`);
const motion = makeSingleToothIndexMotion(profile.parameters), p = motion.parameters;
const rotate = (q,a,offset=[0,0])=>[q[0]*Math.cos(a)-q[1]*Math.sin(a)+offset[0],q[0]*Math.sin(a)+q[1]*Math.cos(a)+offset[1]];
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const segments = profile.output.flatMap(ring=>ring.map((a,i)=>{
  const b=ring[(i+1)%ring.length],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
  return {a,b,dx,dy,len,min:[Math.min(a[0],b[0]),Math.min(a[1],b[1])],max:[Math.max(a[0],b[0]),Math.max(a[1],b[1])]};
})).filter(s=>s.len>1e-12);
function build(items) {
  const min=[Infinity,Infinity],max=[-Infinity,-Infinity];
  for(const s of items)for(let k=0;k<2;k++){min[k]=Math.min(min[k],s.min[k]);max[k]=Math.max(max[k],s.max[k]);}
  if(items.length<9)return {min,max,items};
  const axis=max[0]-min[0]>max[1]-min[1]?0:1; items.sort((a,b)=>a.min[axis]+a.max[axis]-b.min[axis]-b.max[axis]);
  const mid=items.length>>1;return {min,max,left:build(items.slice(0,mid)),right:build(items.slice(mid))};
}
const tree=build(segments), tolerance=.0003;
const near=(point,accept)=>{
  const visit=node=>{
    const dx=Math.max(0,node.min[0]-point[0],point[0]-node.max[0]),dy=Math.max(0,node.min[1]-point[1],point[1]-node.max[1]);
    if(dx*dx+dy*dy>tolerance*tolerance)return;
    if(node.items)for(const s of node.items){
      const t=Math.max(0,Math.min(1,((point[0]-s.a[0])*s.dx+(point[1]-s.a[1])*s.dy)/(s.len*s.len)));
      const at=[s.a[0]+t*s.dx,s.a[1]+t*s.dy],distance=Math.hypot(point[0]-at[0],point[1]-at[1]);
      if(distance<=tolerance)accept({at,distance,force:[-s.dy/s.len,s.dx/s.len]});
    } else {visit(node.left);visit(node.right);}
  };visit(tree);
};
const rows=[];
const times=Array.from({length:129},(_,i)=>p.sourceAngle-p.halfIndex+2*p.halfIndex*i/128);
for(const edge of [p.sourceAngle-p.halfIndex,p.sourceAngle+p.halfIndex])for(const delta of [-.005,-1e-5,1e-5,.005])times.push(edge+delta);
times.push(0,p.sourceAngle+1,p.sourceAngle+Math.PI);
for(const time of times){
  const state=motion.atTime(time),q=state.outputAngle;
  const polygon=profile.driver.map(ring=>ring.map(v=>rotate(rotate(v,state.inputAngle,[-p.centerDistance,0]),-q)));
  const overlap=clipping.intersection(polygon,profile.output);
  const overlapArea=Math.abs(overlap.reduce((total,poly)=>total+poly.reduce((s,ring)=>s+ring.reduce((a,v,i)=>a+cross(v,ring[(i+1)%ring.length])/2,0),0),0));
  let bestDriving=null,bestBraking=null,nearest=null,lockPositive=null,lockNegative=null;
  for(const ring of polygon)for(let i=0;i<ring.length;i++)for(const point of [ring[i],ring[i].map((v,k)=>(v+ring[(i+1)%ring.length][k])/2)])near(point,hit=>{
    const position=rotate(hit.at,q),force=rotate(hit.force,q);
    const outputMoment=cross(position,force),inputMoment=cross([position[0]+p.centerDistance,position[1]],force);
    const normalSpeedResidual=inputMoment*state.inputSpeed-outputMoment*state.outputSpeed;
    const relativePowerResidual=Math.abs(normalSpeedResidual)/Math.max(1e-9,Math.abs(inputMoment*state.inputSpeed),Math.abs(outputMoment*state.outputSpeed));
    const row={...hit,outputMoment,inputMoment,normalSpeedResidual,relativePowerResidual};
    if(!nearest||hit.distance<nearest.distance)nearest=row;
    if(outputMoment>.05&&inputMoment<-.05&&(!bestDriving||row.relativePowerResidual<bestDriving.relativePowerResidual))bestDriving=row;
    if(outputMoment<-.05&&inputMoment>.05&&(!bestBraking||row.relativePowerResidual<bestBraking.relativePowerResidual))bestBraking=row;
    if(Math.abs(inputMoment)<.005){
      if(outputMoment>.05&&(!lockPositive||hit.distance<lockPositive.distance))lockPositive=row;
      if(outputMoment<-.05&&(!lockNegative||hit.distance<lockNegative.distance))lockNegative=row;
    }
  });
  rows.push({time,angle:state.inputAngle,stage:state.stage,outputSpeed:state.outputSpeed,overlapArea,nearest,bestDriving,bestBraking,lockPositive,lockNegative});
}
const driving=rows.filter(r=>r.stage==='tooth-index');
const missing=driving.filter(r=>!r.bestDriving||r.bestDriving.relativePowerResidual>.02);
const report={movement:68,status:'isolated-profile-contact-diagnosis',profile:name,tolerance,
  method:'Complete double-precision polygon intersection area and actual contour normals near driver vertices/midpoints. Positive output torque and normalized normal-speed/power agreement select driving contacts. This diagnoses the sampled 2D profile; full Float32 solid tests, force dynamics and contact convergence are separate requirements.',
  poses:rows.length,maximumOverlapArea:Math.max(...rows.map(r=>r.overlapArea)),missingDriveCount:missing.length,
  missingAngles:missing.map(r=>r.angle),rows};
await writeFile(`artifacts/review/068-${name}-contact.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({poses:rows.length,maximumOverlapArea:report.maximumOverlapArea,missingDriveCount:missing.length,
  missingRange:missing.length?[Math.min(...missing.map(r=>r.angle)),Math.max(...missing.map(r=>r.angle))]:null});
