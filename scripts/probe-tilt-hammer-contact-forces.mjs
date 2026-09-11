import{writeFile}from'node:fs/promises';
import{makeTiltHammerCandidate}from'./lib/tilt-hammer-candidate.mjs';
import{extrudedPlateContours}from'./lib/extruded-plate-contours.mjs';
import{planarContactSurface,forceInNormalCone}from'./lib/planar-contact-surface.mjs';
const model=makeTiltHammerCandidate(),{parts,motion,geometry:p}=model.root.userData;
const gapTolerance=2e-6,angleTolerance=.002,powerTolerance=.015;
const surfaces=Object.fromEntries(['camBody','hammerBody','striker','workpiece'].map(name=>[name,
  planarContactSurface(extrudedPlateContours(parts[name].geometry)[0].points,{inward:name==='hammerBody'||name==='striker',gapTolerance})]));
const point=(q,m)=>{const e=m.elements;return[e[0]*q[0]+e[4]*q[1]+e[12],e[1]*q[0]+e[5]*q[1]+e[13]];};
const normal=(q,m)=>{const e=m.elements;return[e[0]*q[0]+e[4]*q[1],e[1]*q[0]+e[5]*q[1]];};
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0],rows=[];
const{entry,release,landing}=motion.events,poses=[];
for(let cycle=0;cycle<4;cycle++){
  for(let i=0;i<=40;i++)poses.push({time:cycle*p.period+entry.time+(release.time-entry.time)*i/40,type:'cam'});
  for(const event of [motion.events.flankEnd,motion.events.crest])for(const delta of [-1e-6,0,1e-6])
    poses.push({time:cycle*p.period+event.time+delta,type:'cam'});
  poses.push({time:cycle*p.period+landing.time+1e-6,type:'workpiece'});
}
for(const pose of poses){
  model.update(pose.time);model.root.updateMatrixWorld(true);const state=motion.stateAtTime(pose.time);
  const supportName=pose.type==='cam'?'camBody':'workpiece',hammerName=pose.type==='cam'?'hammerBody':'striker';
  const d=parts[supportName],o=parts[hammerName],dInv=d.matrixWorld.clone().invert(),oInv=o.matrixWorld.clone().invert();
  const shapeD=surfaces[supportName],shapeO=surfaces[hammerName];let best=null,contacts=0;
  const qdd=pose.type==='cam'?motion.drivenAt(p.inputStart-p.omega*(pose.time%p.period)).acceleration:0;
  const evaluate=(at,gap,dNormals,oNormals)=>{
    contacts++;const rO=[at[0]-p.pivot[0],at[1]-p.pivot[1]];
    const inputSpeed=pose.type==='cam'?-p.omega:0,outputSpeed=pose.type==='cam'?state.velocity:0;
    const v=[-inputSpeed*at[1]+outputSpeed*rO[1],inputSpeed*at[0]-outputSpeed*rO[0]],length=Math.hypot(...v);
    const perpendicular=length>1e-14?[-v[1]/length,v[0]/length]:null;
    for(const force of [...dNormals,...oNormals,...(perpendicular?[perpendicular,perpendicular.map(v=>-v)]:[])]){
      if(!forceInNormalCone(force,dNormals,angleTolerance)||!forceInNormalCone(force,oNormals,angleTolerance))continue;
      const outputMoment=cross(rO,force),inputMoment=cross(at,force);
      if(outputMoment>=-.01)continue;
      const reaction=motion.mass.inertiaPerMass*(qdd-motion.acceleration(state.q))/outputMoment;
      const residual=Math.abs(inputSpeed*inputMoment-outputSpeed*outputMoment);
      const relativePower=residual/Math.max(1e-10,Math.abs(inputSpeed*inputMoment),Math.abs(outputSpeed*outputMoment));
      const candidate={point:at,gap,force,dNormals,oNormals,outputMoment,inputMoment,reaction,relativePower,residual,
        motorPower:pose.type==='cam'?reaction*inputMoment*inputSpeed:0};
      if(reaction>=-1e-6&&(!best||relativePower<best.relativePower))best=candidate;
    }
  };
  for(const s of shapeD.samples){
    const at=point(s.point,d.matrixWorld),normals=s.normals.map(n=>normal(n,d.matrixWorld));
    shapeO.near(point(at,oInv),hit=>evaluate(point(hit.at,o.matrixWorld),hit.distance,normals,hit.normals.map(n=>normal(n,o.matrixWorld))));
  }
  for(const s of shapeO.samples){
    const at=point(s.point,o.matrixWorld),normals=s.normals.map(n=>normal(n,o.matrixWorld));
    shapeD.near(point(at,dInv),hit=>evaluate(at,hit.distance,hit.normals.map(n=>normal(n,d.matrixWorld)),normals));
  }
  rows.push({...pose,stage:state.stage,q:state.q,velocity:state.velocity,contacts,best,
    accepted:Boolean(best&&(best.relativePower<powerTolerance||best.residual<2e-6))});
}
const failed=rows.filter(row=>!row.accepted),report={movement:72,status:'isolated-actual-contact-force-audit',productionChanged:false,
  method:'Both directions of actual Float32 contour vertices and midpoints against opposite edges. The recovered force must lie within both physical normal cones and supply the required hammer angular acceleration under gravity with a nonnegative normal reaction. Input work may be negative as the regulated cam absorbs energy near release. Four cam lobes and four workpiece seats are sampled. Bearing reactions, pickup/landing impulses and elastic stress remain separate.',
  gapTolerance,angleTolerance,powerTolerance,poses:rows.length,failed,rows};
await writeFile(process.env.PROBE_OUTPUT??'artifacts/review/072-candidate-contact-forces.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({poses:rows.length,failed:failed.length,failures:failed});if(failed.length)process.exitCode=1;
