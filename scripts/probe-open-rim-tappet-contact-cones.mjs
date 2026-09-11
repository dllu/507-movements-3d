import { writeFile } from 'node:fs/promises';
import { makeOpenRimTappetCandidate } from './lib/open-rim-tappet-candidate.mjs';
import { extrudedPlateContour } from './lib/extruded-plate-contour.mjs';
import { planarContactSurface, forceInNormalCone } from './lib/planar-contact-surface.mjs';
const model=makeOpenRimTappetCandidate(),{parts,motion,geometry:p,blocks}=model.root.userData;
const gapTolerance=2e-6,angleTolerance=.002,powerTolerance=.015;
const surfaces=Object.fromEntries(['rim','tappet',...Array.from({length:10},(_,i)=>`stud${i}`)]
  .map(name=>[name,planarContactSurface(extrudedPlateContour(parts[name].geometry),{inward:name.startsWith('stud'),gapTolerance})]));
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const point=(q,m)=>{const e=m.elements;return[e[0]*q[0]+e[4]*q[1]+e[12],e[1]*q[0]+e[5]*q[1]+e[13]];};
const normal=(q,m)=>{const e=m.elements;return[e[0]*q[0]+e[4]*q[1],e[1]*q[0]+e[5]*q[1]];};
const poses=[];
for(const stage of motion.stages)for(let i=0;i<33;i++)poses.push({angle:stage.begin+(stage.end-stage.begin)*(i+.319)/33});
for(const stage of motion.stages)for(const angle of [stage.begin,stage.end])for(const delta of [-1e-6,0,1e-6])poses.push({angle:angle+delta});
for(let stud=0;stud<10;stud++)for(const sign of [-1,1])poses.push({angle:0,outputAngle:sign*p.lockSeat-stud*p.pitch,expectedLockSign:-sign,stud});
const rows=[];
for(const pose of poses){
  const time=pose.angle-p.initialInputPhase;model.update(time);
  const state=motion.atTime(time);if(pose.outputAngle!==undefined){blocks.output.rotation.z=pose.outputAngle;state.outputAngle=pose.outputAngle;state.outputSpeed=0;}
  model.root.updateMatrixWorld(true);
  const inputCenter=point([0,0],blocks.input.matrixWorld),outputCenter=point([0,0],blocks.output.matrixWorld);
  const active=state.outputSpeed< -1e-5, driverName=active?state.contact.part:'rim';
  const dMesh=parts[driverName],dShape=surfaces[driverName],dInv=dMesh.matrixWorld.clone().invert();
  let best=null,lock=null,contacts=0;
  const studs=pose.expectedLockSign?Array.from({length:10},(_,i)=>i):[0];
  for(const stud of studs){
    const cMesh=parts[`stud${stud}`],cShape=surfaces[`stud${stud}`],cInv=cMesh.matrixWorld.clone().invert();
    const assess=(at,gap,dNormals,cNormals)=>{
      contacts++;
      const rD=[at[0]-inputCenter[0],at[1]-inputCenter[1]],rO=[at[0]-outputCenter[0],at[1]-outputCenter[1]];
      const velocity=[-rD[1]+state.outputSpeed*rO[1],rD[0]-state.outputSpeed*rO[0]],length=Math.hypot(...velocity);
      const perpendicular=length>1e-14?[-velocity[1]/length,velocity[0]/length]:null;
      const candidates=[...dNormals,...cNormals,...(perpendicular?[perpendicular,perpendicular.map(v=>-v)]:[])];
      for(const force of candidates){
        if(!forceInNormalCone(force,dNormals,angleTolerance)||!forceInNormalCone(force,cNormals,angleTolerance))continue;
        const inputMoment=cross(rD,force),outputMoment=cross(rO,force);
        const relativePower=Math.abs(inputMoment-state.outputSpeed*outputMoment)/Math.max(1e-10,Math.abs(inputMoment),Math.abs(state.outputSpeed*outputMoment));
        const row={stud,point:at,force,gap,inputMoment,outputMoment,relativePower,dNormals,cNormals};
        if(outputMoment<-.01&&inputMoment>0&&(!best||relativePower<best.relativePower))best=row;
        if(pose.expectedLockSign&&outputMoment*pose.expectedLockSign>.01&&Math.abs(inputMoment)<.002&&(!lock||gap<lock.gap))lock=row;
      }
    };
    for(const s of dShape.samples){
      const world=point(s.point,dMesh.matrixWorld),local=point(world,cInv),normals=s.normals.map(n=>normal(n,dMesh.matrixWorld));
      cShape.near(local,hit=>assess(point(hit.at,cMesh.matrixWorld),hit.distance,normals,hit.normals.map(n=>normal(n,cMesh.matrixWorld))));
    }
    for(const s of cShape.samples){
      const world=point(s.point,cMesh.matrixWorld),local=point(world,dInv),normals=s.normals.map(n=>normal(n,cMesh.matrixWorld));
      dShape.near(local,hit=>assess(world,hit.distance,hit.normals.map(n=>normal(n,dMesh.matrixWorld)),normals));
    }
  }
  const accepted=active?Boolean(best&&best.relativePower<powerTolerance):pose.expectedLockSign?Boolean(lock):null;
  rows.push({...pose,time,stage:state.stage,outputSpeed:state.outputSpeed,active,contacts,best,lock,accepted});
}
const active=rows.filter(r=>r.active),locks=rows.filter(r=>r.expectedLockSign),failed=rows.filter(r=>r.accepted===false);
const report={movement:70,status:'isolated-actual-contact-cone-audit',productionChanged:false,
  method:'Both directions of actual Float32 contour vertices and side midpoints against opposite edges. Force lies within physical normal cones on both bodies. Every analytic contact stage, both sides of events, and both rim seats at all ten stud positions are sampled. Positive counterclockwise motor work, clockwise output torque and speed-power agreement check quasistatic drive under a resisting load.',
  gapTolerance,angleTolerance,powerTolerance,poses:rows.length,activePoses:active.length,lockingPoses:locks.length,
  failedDrive:active.filter(r=>!r.accepted).length,failedLock:locks.filter(r=>!r.accepted).length,failed,rows};
await writeFile(process.env.PROBE_OUTPUT??'artifacts/review/070-candidate-contact-cones.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({poses:rows.length,active:active.length,locks:locks.length,failedDrive:report.failedDrive,failedLock:report.failedLock,failed});
if(failed.length)process.exitCode=1;
