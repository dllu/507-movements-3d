import { writeFile } from 'node:fs/promises';
import { makeSmallSingleToothCandidate } from './lib/small-single-tooth-candidate.mjs';
import { extrudedPlateContour } from './lib/extruded-plate-contour.mjs';
const model=makeSmallSingleToothCandidate(),{motion,geometry:p,parts}=model.root.userData;
const profile={driver:[extrudedPlateContour(parts.driverPlate.geometry)],output:[extrudedPlateContour(parts.wheelPlate.geometry)]};
const gapTolerance=5e-6,angleTolerance=.002,powerTolerance=.015;
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const rotate=(q,a,offset=[0,0])=>[q[0]*Math.cos(a)-q[1]*Math.sin(a)+offset[0],q[0]*Math.sin(a)+q[1]*Math.cos(a)+offset[1]];
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const normalize=q=>{const n=Math.hypot(...q);return n>1e-14?q.map(v=>v/n):null;};
function shape(polygon,interior) {
  // Float32 matches the x/y coordinates of the actual extruded plate skins.
  const ring=polygon[0].map(q=>q.map(Math.fround)).filter((q,i,all)=>
    i===0||q[0]!==all[i-1][0]||q[1]!==all[i-1][1]);
  if(ring[0][0]===ring.at(-1)[0]&&ring[0][1]===ring.at(-1)[1])ring.pop();
  const edges=ring.map((a,i)=>{
    const b=ring[(i+1)%ring.length],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
    return {a,b,index:i,dx,dy,length,normal:interior?[-dy/length,dx/length]:[dy/length,-dx/length],
      min:[Math.min(a[0],b[0]),Math.min(a[1],b[1])],max:[Math.max(a[0],b[0]),Math.max(a[1],b[1])]};
  });
  const cone=i=>[edges[(i+edges.length-1)%edges.length].normal,edges[i%edges.length].normal];
  const build=items=>{
    const min=[Infinity,Infinity],max=[-Infinity,-Infinity];
    for(const e of items)for(let k=0;k<2;k++){min[k]=Math.min(min[k],e.min[k]);max[k]=Math.max(max[k],e.max[k]);}
    if(items.length<9)return {min,max,items};
    const axis=max[0]-min[0]>max[1]-min[1]?0:1;items.sort((a,b)=>a.min[axis]+a.max[axis]-b.min[axis]-b.max[axis]);
    const mid=items.length>>1;return {min,max,left:build(items.slice(0,mid)),right:build(items.slice(mid))};
  };
  const tree=build([...edges]);
  const near=(point,accept)=>{
    const visit=node=>{
      const dx=Math.max(0,node.min[0]-point[0],point[0]-node.max[0]),dy=Math.max(0,node.min[1]-point[1],point[1]-node.max[1]);
      if(dx*dx+dy*dy>gapTolerance*gapTolerance)return;
      if(node.items)for(const e of node.items) {
        const t=Math.max(0,Math.min(1,((point[0]-e.a[0])*e.dx+(point[1]-e.a[1])*e.dy)/(e.length*e.length)));
        const at=[e.a[0]+t*e.dx,e.a[1]+t*e.dy],distance=Math.hypot(point[0]-at[0],point[1]-at[1]);
        if(distance>gapTolerance)continue;
        const normals=t*e.length<gapTolerance?cone(e.index):(1-t)*e.length<gapTolerance?cone(e.index+1):[e.normal];
        accept({at,distance,normals,edge:e.index});
      } else {visit(node.left);visit(node.right);}
    };visit(tree);
  };
  const samples=edges.flatMap(e=>[{point:e.a,normals:cone(e.index)},
    {point:[(e.a[0]+e.b[0])/2,(e.a[1]+e.b[1])/2],normals:[e.normal]}]);
  return {near,samples};
}
const driver=shape(profile.driver,false),output=shape(profile.output,true);
function inCone(force,normals) {
  const relative=wrap(Math.atan2(force[1],force[0])-Math.atan2(normals[0][1],normals[0][0]));
  if(normals.length===1)return Math.abs(relative)<=angleTolerance;
  const span=wrap(Math.atan2(normals[1][1],normals[1][0])-Math.atan2(normals[0][1],normals[0][0]));
  return relative>=Math.min(0,span)-angleTolerance&&relative<=Math.max(0,span)+angleTolerance;
}
const start=p.entryAngle-p.initialInputPhase,end=p.exitAngle-p.initialInputPhase;
const times=Array.from({length:129},(_,i)=>start+(end-start)*(i+.319)/129);
for(const angle of [p.entryAngle,3.869,3.9797487756638796,p.exitAngle])for(const d of [-1e-5,0,1e-5])times.push(angle-p.initialInputPhase+d);
times.push(0,5-p.initialInputPhase,p.period);
const poses=times.map(time=>({time}));
for(let notch=0;notch<p.teeth;notch++)for(const sign of [-1,1])poses.push({
  time:-p.initialInputPhase, outputAngle:(sign>0?p.positiveSeat:p.negativeSeat)-notch*p.pitch,
  expectedLockSign:-sign,notch});
const rows=[];
for(const pose of poses) {
  const {time}=pose,state=motion.atTime(time);
  if(pose.outputAngle!==undefined){state.outputAngle=pose.outputAngle;state.outputSpeed=0;}
  const q=state.outputAngle,theta=state.inputAngle;
  let best=null,contacts=0,lockingPositive=null,lockingNegative=null;
  const assess=(at,gap,dNormals,cNormals)=>{
    contacts++;
    const point=rotate(at,q),rD=[point[0]-p.centerDistance,point[1]];
    const relativeVelocity=[-state.inputSpeed*rD[1]+state.outputSpeed*point[1],state.inputSpeed*rD[0]-state.outputSpeed*point[0]];
    const perpendicular=normalize([-relativeVelocity[1],relativeVelocity[0]]);
    const candidates=[...dNormals,...cNormals,...(perpendicular?[perpendicular,perpendicular.map(v=>-v)]:[])];
    for(const force of candidates) {
      if(!inCone(force,dNormals)||!inCone(force,cNormals))continue;
      const outputMoment=cross(point,force),inputMoment=cross(rD,force);
      const normalSpeed=inputMoment*state.inputSpeed-outputMoment*state.outputSpeed;
      const relativePower=Math.abs(normalSpeed)/Math.max(1e-8,Math.abs(inputMoment*state.inputSpeed),Math.abs(outputMoment*state.outputSpeed));
      const row={point,force,gap,outputMoment,inputMoment,normalSpeed,relativePower};
      if(outputMoment<-.02&&inputMoment>0&&(!best||relativePower<best.relativePower))best=row;
      if(Math.abs(inputMoment)<.002){
        if(outputMoment>.02&&(!lockingPositive||gap<lockingPositive.gap))lockingPositive=row;
        if(outputMoment<-.02&&(!lockingNegative||gap<lockingNegative.gap))lockingNegative=row;
      }
    }
  };
  for(const sample of driver.samples) {
    const world=rotate(sample.point,theta,[p.centerDistance,0]),local=rotate(world,-q);
    const normals=sample.normals.map(n=>rotate(n,theta));
    output.near(local,hit=>assess(hit.at,hit.distance,normals,hit.normals.map(n=>rotate(n,q))));
  }
  for(const sample of output.samples) {
    const world=rotate(sample.point,q,[-p.centerDistance,0]),local=rotate(world,-theta);
    const normals=sample.normals.map(n=>rotate(n,q));
    driver.near(local,hit=>assess(sample.point,hit.distance,hit.normals.map(n=>rotate(n,theta)),normals));
  }
  const active=state.outputSpeed<-.001;
  rows.push({time,angle:theta,outputAngle:q,outputSpeed:state.outputSpeed,active,contacts,best,lockingPositive,lockingNegative,
    expectedLockSign:pose.expectedLockSign,notch:pose.notch,
    accepted:active?Boolean(best&&best.relativePower<=powerTolerance):pose.expectedLockSign?
      Boolean(pose.expectedLockSign>0?lockingPositive:lockingNegative):null});
}
const active=rows.filter(r=>r.active),missing=active.filter(r=>!r.accepted);
const locks=rows.filter(r=>r.expectedLockSign),missingLocks=locks.filter(r=>!r.accepted);
const report={movement:69,status:'quasistatic-contact-cone-diagnosis',productionChanged:false,
  method:'Both directions of actual Float32 plate contour vertices and midpoints against opposite edges. At vertices, compressive force must lie in the cone of neighboring physical edge normals on both bodies; smooth-edge normals and the relative-velocity perpendicular are candidate directions. Clockwise output torque and power agreement test transmission under a resisting quasistatic load. Proximity and angular tolerances accommodate tessellation. This does not certify finite-inertia impacts or unloaded coasting.',
  gapTolerance,angleTolerance,powerTolerance,poses:rows.length,activePoses:active.length,missingDriveCount:missing.length,
  lockingPoses:locks.length,missingLockCount:missingLocks.length,
  missingAngles:missing.map(r=>r.angle),minimumAcceptedOutputMoment:Math.min(...active.filter(r=>r.accepted).map(r=>-r.best.outputMoment)),rows};
await writeFile(process.env.PROBE_OUTPUT??'artifacts/review/069-balanced-contact-cones.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({poses:rows.length,active:active.length,missing:missing.length,missingAngles:report.missingAngles,lockingPoses:locks.length,missingLocks:missingLocks.length,
  minimumAcceptedOutputMoment:report.minimumAcceptedOutputMoment});
if(missing.length||missingLocks.length)process.exitCode=1;
