import{readFile,writeFile}from'node:fs/promises';
import{createHash}from'node:crypto';
import{makeTiltHammerCandidate}from'./lib/tilt-hammer-candidate.mjs';
import{makeFourLobeTiltHammer}from'../src/simulation/tilt-hammer.js';
import{createMovementModel}from'../src/simulation/registry.js';
const checkpoint=JSON.parse(await readFile('artifacts/review/072-candidate-checkpoint.json','utf8'));
const candidate=makeTiltHammerCandidate(),registryChecked=process.env.CHECK_REGISTRY==='1';
const catalog=JSON.parse(await readFile('src/data/movements.json','utf8'));
const runtime=registryChecked?createMovementModel(catalog.movements[71]):makeFourLobeTiltHammer();
const p=runtime.root.userData.geometry,failures=[],meshes=[];
const hash=array=>createHash('sha256').update(Buffer.from(array.buffer,array.byteOffset,array.byteLength)).digest('hex');
for(const expected of checkpoint.meshes){
  const mesh=runtime.root.userData.parts[expected.name],attributes={};
  for(const[key,sha]of Object.entries(expected.attributes))attributes[key]=hash(mesh.geometry.attributes[key].array)===sha;
  const index=mesh.geometry.index?hash(mesh.geometry.index.array):null;
  if(Object.values(attributes).some(value=>!value)||index!==expected.index)failures.push('Mesh differs: '+expected.name);
  meshes.push({name:expected.name,attributes,index:index===expected.index});
}
const transforms=[];
for(const pose of checkpoint.poses){
  runtime.update(pose.time-p.initialTime);runtime.root.updateMatrixWorld(true);
  let maximumError=0;
  for(const[name,expected]of Object.entries(pose.matrices)){
    const actual=runtime.root.userData.parts[name].matrixWorld.elements;
    for(let i=0;i<16;i++)maximumError=Math.max(maximumError,Math.abs(actual[i]-expected[i]));
  }
  transforms.push({candidateTime:pose.time,publicTime:pose.time-p.initialTime,maximumError});
  if(maximumError>1e-10)failures.push('Pose differs: '+pose.time);
}
const maxima={q:0,velocity:0,acceleration:0,reaction:0},events=Object.values(candidate.motion.events).map(event=>event.time);
const times=Array.from({length:10001},(_,i)=>(i/10000*12-6)*p.period);
for(let cycle=-2;cycle<=2;cycle++)for(const event of events)for(const delta of [-1e-6,0,1e-6])times.push(cycle*p.period+event+delta);
for(const time of times){
  const a=candidate.motion.stateAtTime(time),b=runtime.motion.atTime(time-p.initialTime);
  if(a.stage!==b.stage)failures.push('Stage differs: '+time);
  for(const key of Object.keys(maxima))if(a[key]!==undefined&&b[key]!==undefined)maxima[key]=Math.max(maxima[key],Math.abs(a[key]-b[key]));
}
if(maxima.q>1e-10||maxima.velocity>1e-8||maxima.acceleration>2e-5||maxima.reaction>1e-4)failures.push('Motion differs beyond tolerance');
const report={movement:72,status:'runtime-candidate-equivalence',registryChecked,meshes,transforms,poses:times.length,maxima,failures,
  qualification:'Raw mesh attributes and indices match the saved audit checkpoint. World transforms are compared at every inspected candidate pose. Runtime time zero is shifted to the source engraving pose. Closed-form contact acceleration is compared against the candidate finite-difference force calculation; contact coordinates and gravity knots retain the audited trajectory.'};
await writeFile(process.env.PROBE_OUTPUT??'artifacts/review/072-runtime-equivalence.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({registryChecked,meshes:meshes.length,transforms:transforms.length,poses:times.length,maxima,failures});if(failures.length)process.exitCode=1;
