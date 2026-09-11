import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {makeCrossedRackCandidate} from './lib/crossed-rack-candidate.mjs';
import {sampleCrossedRackProfile} from './lib/crossed-rack-playback-study.mjs';
import {makeCrossedRackDrive} from '../src/simulation/crossed-rack.js';
import profile from '../src/data/crossed-rack-profile.js';
const file='artifacts/review/080-framed-finite-playback-profile.json',original=JSON.parse(fs.readFileSync(file)),
 a=makeCrossedRackCandidate(original.geometry),b=makeCrossedRackDrive(),rows=[],times=[-1,0,9-1e-9,9,9+1e-9,10,11,100],prefix='artifacts/review/080-production-parity';
assert.deepEqual(profile,original);
const expectedGeometry=fs.readFileSync('scripts/lib/crossed-rack-candidate.mjs','utf8').replaceAll('../../src/simulation/','./')
 .replace("'./crossed-rack-source.mjs'","'../data/crossed-rack-source.js'").replace('makeCrossedRackCandidate','makeCrossedRackGeometry')
 .replace("mechanism:'isolated-crossed-hook-slotted-rack-candidate',fidelity:'candidate'","mechanism:'crossed-hook-slotted-rack-drive',fidelity:'authored'");
assert.equal(fs.readFileSync('src/simulation/crossed-rack-geometry.js','utf8'),expectedGeometry);
assert.equal(fs.readFileSync('src/data/crossed-rack-source.js','utf8'),fs.readFileSync('scripts/lib/crossed-rack-source.mjs','utf8'));
assert.equal(fs.readFileSync('src/simulation/crossed-rack-motion.js','utf8'),"import profile from '../data/crossed-rack-profile.js';\n\n"+
 fs.readFileSync('scripts/lib/crossed-rack-playback-study.mjs','utf8').replace('sampleCrossedRackProfile(profile,time,','sampleCrossedRackMotion(time,'));
let buffers=0,poses=0,maxStateError=0,maxMatrixError=0;
assert.deepEqual(Object.keys(a.root.userData.parts),Object.keys(b.root.userData.parts));
for(const [name,mesh]of Object.entries(a.root.userData.parts)){
 const other=b.root.userData.parts[name];assert.equal(a.root.userData.families[name],b.root.userData.families[name]);
 for(const key of Object.keys(mesh.geometry.attributes)){assert.deepEqual(other.geometry.attributes[key].array,mesh.geometry.attributes[key].array);buffers++;}
 assert.deepEqual(other.geometry.index?.array,mesh.geometry.index?.array);if(mesh.geometry.index)buffers++;
 assert.deepEqual(other.position.toArray(),mesh.position.toArray());assert.deepEqual(other.material.color.toArray(),mesh.material.color.toArray());
 for(const k of ['roughness','metalness','opacity','transparent'])assert.equal(other.material[k],mesh.material[k]);rows.push({name,attributes:Object.keys(mesh.geometry.attributes),indexed:!!mesh.geometry.index});
}
for(const key of ['hideGround','cameraFov','shadowCameraHalfExtent','shadowBias','shadowNormalBias'])assert.equal(a.root.userData[key],b.root.userData[key]);
for(let i=0;i<original.rows.length;i++){times.push(original.rows[i][0]/2);if(i)times.push((original.rows[i-1][0]+original.rows[i][0])/4);}
for(let i=0;i<=4000;i++)times.push((i+.193)*10/4000);
for(const time of times){
 const expected=sampleCrossedRackProfile(original,time),actual=b.root.userData.stateAtTime(time);assert.deepEqual(actual,expected);
 for(const key of ['q','rackY','leftAngle','rightAngle'])maxStateError=Math.max(maxStateError,Math.abs(expected[key]-actual[key]));
 a.setState(expected);b.update(time);
 for(const name of Object.keys(a.root.userData.parts)){
  const x=a.root.userData.parts[name].matrixWorld.elements,y=b.root.userData.parts[name].matrixWorld.elements;
  for(let i=0;i<16;i++)maxMatrixError=Math.max(maxMatrixError,Math.abs(x[i]-y[i]));
 }
 poses++;
}
const sources=['scripts/probe-crossed-rack-production-parity.mjs','scripts/lib/crossed-rack-candidate.mjs','scripts/lib/crossed-rack-source.mjs',
 'scripts/lib/crossed-rack-playback-study.mjs','src/simulation/crossed-rack.js','src/simulation/crossed-rack-geometry.js',
 'src/simulation/crossed-rack-motion.js','src/simulation/finite-plate-geometry.js','src/data/crossed-rack-source.js','src/data/crossed-rack-profile.js',file].map((file,i)=>{
 const archive=prefix+'-source-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);
 return{file,archive,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
});
const report={movement:80,status:'qualified-candidate-production-parity',passed:maxStateError===0&&maxMatrixError===0,
 parts:rows.length,buffers,poses,maxStateError,maxMatrixError,sourceSubstitutionChecked:true,rows,sources,
 qualification:'Full geometry and sampler source substitutions, adopted source bytes, complete profile data, all rendered attributes/indices/materials and 11810 deterministic pose matrices are compared with the qualified isolated candidate. This transfers its geometry and continuous playback evidence; UI behavior requires separate validation.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,rows:undefined,sources:undefined});if(!report.passed)process.exitCode=1;
