import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeCrossedRackCandidate} from './lib/crossed-rack-candidate.mjs';
import {sampleCrossedRackProfile} from './lib/crossed-rack-playback-study.mjs';
import {MovementEngine} from '../src/simulation/engine.js';
const profileFile='artifacts/review/080-framed-finite-playback-profile.json',preparationFile='artifacts/review/080-framed-finite-playback-preparation.json',
 input='artifacts/review/080-fixed-normal-finest-dynamics.json',refinementFile='artifacts/review/080-fixed-normal-refinement.json',
 secondaryFile='artifacts/review/080-fixed-normal-secondary-bounds.json',prefix='artifacts/review/080-playback-sampler',
 profile=JSON.parse(fs.readFileSync(profileFile)),preparation=JSON.parse(fs.readFileSync(preparationFile)),data=JSON.parse(fs.readFileSync(input)),
 refinement=JSON.parse(fs.readFileSync(refinementFile)),secondary=JSON.parse(fs.readFileSync(secondaryFile)),
 model=makeCrossedRackCandidate(profile.geometry),u=model.root.userData,sample=t=>sampleCrossedRackProfile(profile,t),issues=[],
 hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
assert(preparation.passed&&refinement.passed&&secondary.passed);assert.equal(hash(profileFile),preparation.profile.sha256);
assert.deepEqual(profile.physics,data.parameters);assert.deepEqual(profile.geometry,data.geometry);
assert.equal(profile.rows.length,preparation.selectedIndices.length);
for(const [j,i]of preparation.selectedIndices.entries())assert.deepEqual(profile.rows[j],[data.rows[i].time,...data.rows[i].x]);
const ranges=profile.rows.reduce((r,s)=>r.map((range,j)=>[Math.min(range[0],s[j+1]),Math.max(range[1],s[j+1])]),[0,1,2].map(()=>[Infinity,-Infinity]));
for(let j=0;j<3;j++)assert(ranges[j][0]>=secondary.ranges[j][0]&&ranges[j][1]<=secondary.ranges[j][1]);
let maximumPixels=0,maximumInputError=0,checks=0;
for(let i=0;i<data.rows.length;i++)for(const mid of [false,true]){
 if(mid&&i+1===data.rows.length)continue;
 const a=data.rows[i],b=mid?data.rows[i+1]:a,time=(a.time+b.time)/2,expected=a.x.map((v,j)=>(v+b.x[j])/2),state=sample(time/2),
  actual=[state.rackY,state.leftAngle,state.rightAngle];
 maximumPixels=Math.max(maximumPixels,...actual.map((v,j)=>Math.abs(v-expected[j])*preparation.radii[j]*u.geometry.scale));
 maximumInputError=Math.max(maximumInputError,Math.abs(state.q-data.parameters.amplitude*Math.sin(data.parameters.omega*Math.min(time,data.parameters.stopAt))));checks++;
}
if(maximumPixels>preparation.largestAcceptedError+1e-9||maximumInputError>1e-12)issues.push({kind:'sampler-agreement',maximumPixels,maximumInputError});
const combinedPixels=refinement.comparisons.at(-1).maximumPixels+preparation.largestAcceptedError;
if(combinedPixels>.25)issues.push({kind:'combined-refinement-and-compression',combinedPixels});
const start=sample(0),end=sample(profile.playbackDuration),later=sample(100),negative=sample(-1);
for(const key of ['q','rackY','leftAngle','rightAngle']){assert.equal(start[key],negative[key]);assert.equal(end[key],later[key]);}
assert(end.finished&&end.inputStopped);assert.equal(later.rackVelocity,0);assert(later.angularVelocities.every(v=>v===0));
for(const value of [NaN,Infinity,-Infinity])assert.throws(()=>sample(value));assert.throws(()=>sampleCrossedRackProfile(profile,1,{period:0}));
const seams=[4,8].map(time=>{const a=sample(time-1e-7),b=sample(time+1e-7),jump=Math.abs(b.rackY-a.rackY);assert(jump<1e-6);return{time,jump,rackY:sample(time).rackY};});
const box=new THREE.Box3(new THREE.Vector3(...profile.motionBounds.min),new THREE.Vector3(...profile.motionBounds.max));
let meshChecks=0,minimumMeshMargin=Infinity;
for(let i=0;i<=100;i++){
 u.setState(sample(i*profile.playbackDuration/100));
 for(const mesh of Object.values(u.parts)){
  const p=mesh.geometry.attributes.position;
  for(let j=0;j<p.count;j++){
   const v=new THREE.Vector3().fromBufferAttribute(p,j).applyMatrix4(mesh.matrixWorld);
   const margin=Math.min(v.x-box.min.x,box.max.x-v.x,v.y-box.min.y,box.max.y-v.y,v.z-box.min.z,box.max.z-v.z);
   minimumMeshMargin=Math.min(minimumMeshMargin,margin);meshChecks++;if(margin< -1e-10&&issues.length<20)issues.push({kind:'mesh-envelope',i,part:mesh.name,vertex:j,margin});
  }
 }
}
u.setState(start);u.sampledMotionBounds=profile.motionBounds;
const cameraChecks=[];
for(const [width,height]of [[1000,720],[390,600],[1600,600]])for(const direction of [[0,0,10],[-4,3,10],[4,3,-10]]){
 const engine={model,container:{clientWidth:width,clientHeight:height},camera:new THREE.PerspectiveCamera(36,1,.05,100),controls:{target:new THREE.Vector3(),enableDamping:false}};
 engine.controls.update=()=>{engine.camera.lookAt(engine.controls.target);engine.camera.updateMatrixWorld();};
 MovementEngine.prototype.fitCamera.call(engine,new THREE.Vector3(...direction));let maximum=0,minZ=Infinity,maxZ=-Infinity;
 for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
  const p=new THREE.Vector3(x,y,z).project(engine.camera);maximum=Math.max(maximum,Math.abs(p.x),Math.abs(p.y));minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z);
 }
 const row={width,height,direction,maximum,minZ,maxZ};cameraChecks.push(row);if(maximum>1||minZ< -1||maxZ>1)issues.push({kind:'camera-envelope',...row});
}
const sources=['scripts/check-crossed-rack-playback.mjs','scripts/lib/crossed-rack-playback-study.mjs','scripts/lib/crossed-rack-candidate.mjs',
 'scripts/lib/crossed-rack-source.mjs','src/simulation/engine.js',profileFile,preparationFile,input,refinementFile,secondaryFile].map((file,i)=>{
 const archive=prefix+'-source-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);return{file,archive,sha256:hash(file)};
});
const report={movement:80,status:'finite-playback-sampler-and-framing-check',productionChanged:false,mechanicsPassed:false,passed:issues.length===0,
 checks,maximumPixels,maximumInputError,combinedPixels,ranges,secondaryBoundsTransferredBySubset:true,seams,
 end:{rackY:end.rackY,pitches:end.rackY/u.geometry.pitch,finished:end.finished,inputStopped:end.inputStopped},
 meshChecks,minimumMeshMargin,cameraChecks,issues,sources,
 qualification:'Independent sampler checks cover every original knot and interval midpoint. Selected knots are exact original states, so compressed coordinate ranges remain inside the continuously certified secondary ranges. The source-pixel agreement budget includes time-step refinement plus compression. End clamping and whole-rack continuity at input cycle seams are checked. Actual vertices are screened at 101 poses; the continuous motion box from preparation is fitted by the real engine method in nine desktop/mobile views. UI stop/replay behavior and production integration remain pending.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,cameraChecks:cameraChecks.length,sources:undefined});if(!report.passed)process.exitCode=1;
