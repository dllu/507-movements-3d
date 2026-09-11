import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { wormAndWheel } from '../src/simulation/authored-gears.js';
import { surfaceTriangles, surfacePoints, solidSurface } from '../tests/helpers/solid-surface.mjs';
import { triangleTree, meshPairDistance } from './lib/star-mangle-pair-distance.mjs';
const candidate=process.env.PROBE_PROFILE?JSON.parse(await readFile(process.env.PROBE_PROFILE,'utf8')):null;
const catalog=JSON.parse(await readFile('src/data/movements.json','utf8'));
const model=candidate?wormAndWheel({...candidate.parameters,profile:candidate.profile,wheelPhase:candidate.wheelPhase??Math.PI/2,
  shaftOffsetX:candidate.shaftOffsetX??0,shaftRadius:candidate.shaftRadius??0.075,wormAngularSteps:640})
  :createMovementModel(catalog.movements[30]);
const {blocks,geometry:p}=model.root.userData,worm=blocks.worm.userData.thread,wheel=blocks.wheel.userData.toothMesh;
const data=[worm,wheel].map(mesh=>({mesh,points:surfacePoints(mesh.geometry),solid:solidSurface(mesh.geometry),tree:triangleTree(mesh.geometry)}));
const working=surfaceTriangles(wheel.geometry).filter(face=>{
  const q=face.getMidpoint(new THREE.Vector3()),n=face.getNormal(new THREE.Vector3());return-q.clone().cross(n).z>0.1*Math.hypot(q.x,q.y);
});
const workingTree=triangleTree(new THREE.BufferGeometry().setFromPoints(working.flatMap(face=>[face.a,face.b,face.c])));
const count=Number(process.env.PROBE_POSES??17),rows=[],period=2*Math.PI/model.root.userData.kinematics.wormAngularSpeed;
for(let i=0;i<count;i++){
  const time=period*(i+0.317)/count;model.update(time);model.root.updateMatrixWorld(true);
  let checks=0,inside=0,maximumDepth=0;
  for(const [a,b] of [[data[0],data[1]],[data[1],data[0]]]){
    const matrix=b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
    for(const point of a.points){const q=point.clone().applyMatrix4(matrix);checks++;if(!b.solid.inside(q))continue;const depth=b.solid.distance(q);if(depth<1e-6)continue;inside++;maximumDepth=Math.max(maximumDepth,depth);}
  }
  const exact=meshPairDistance(data[0].tree,workingTree,wheel.matrixWorld.clone().invert().multiply(worm.matrixWorld),0.025);
  let inputTorque=null,outputTorque=null,powerResidual=null;
  if(exact.witness&&exact.distance>1e-10){
    const a=new THREE.Vector3().fromArray(exact.witness.a).applyMatrix4(wheel.matrixWorld),b=new THREE.Vector3().fromArray(exact.witness.b).applyMatrix4(wheel.matrixWorld);
    const force=b.clone().sub(a).normalize();outputTorque=b.clone().sub(p.wheelCenter).cross(force).dot(p.wheelAxis);
    inputTorque=a.clone().sub(p.wormCenter).cross(force.clone().negate()).dot(p.wormAxis);
    const state=model.root.userData.kinematics,ip=inputTorque*state.wormAngularSpeed,op=outputTorque*state.wheelAngularSpeed;
    powerResidual=Math.abs(ip+op)/Math.max(Math.abs(ip),Math.abs(op));
  }
  rows.push({time,checks,inside,maximumDepth,gap:exact.distance,witness:exact.witness,inputTorque,outputTorque,powerResidual});
  console.log({pose:i,inside,gap:exact.distance,powerResidual});
}
const summary={poses:rows.length,checks:rows.reduce((s,r)=>s+r.checks,0),inside:rows.reduce((s,r)=>s+r.inside,0),
  minimumGap:Math.min(...rows.map(r=>r.gap)),maximumGap:Math.max(...rows.map(r=>r.gap)),
  maximumPowerResidual:Math.max(...rows.map(r=>r.powerResidual??Infinity)),minimumOutputTorque:Math.min(...rows.map(r=>r.outputTorque??-Infinity))};
await writeFile(process.env.PROBE_OUTPUT??'artifacts/review/031-reopened-worm-power.json',JSON.stringify({movement:31,status:candidate?'isolated-corrected-worm-candidate':'reopened-production-diagnostic',
  method:`${candidate?'An isolated substituted cylindrical-hob wheel and finer worm mesh; production geometry is unchanged.':'Unmodified production 031 worm and baked wheel.'} Bidirectional actual Float32 surface containment and closest loaded-flank triangle witnesses; torque and normal-force power are evaluated about their physical world axes.`,summary,rows},null,2)+'\n');
console.log(summary);if(summary.inside||summary.minimumGap<=1e-6||summary.minimumOutputTorque<=0||summary.maximumPowerResidual>0.02)process.exitCode=1;
