import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {makePullPawlCandidate} from './lib/pull-pawl-candidate.mjs';
import {samplePullPawlPlayback} from './lib/pull-pawl-playback-study.mjs';
import {makePullPawlDrive} from '../src/simulation/pull-pawl.js';
import profile from '../src/data/pull-pawl-profile.js';
const original=JSON.parse(await readFile('artifacts/review/078-playback-finest-candidate.json')),a=makePullPawlCandidate(original.geometry),b=makePullPawlDrive();
assert.deepEqual(profile.first,original.first);assert.deepEqual(profile.steady,original.steady);assert.deepEqual(profile.physics,original.physics);assert.deepEqual(profile.geometry,original.geometry);
const rows=[];let buffers=0,poses=0,maxMatrixError=0,maxStateError=0;
for(const [name,mesh] of Object.entries(a.root.userData.parts)){
  const other=b.root.userData.parts[name];assert.equal(a.root.userData.families[name],b.root.userData.families[name]);
  for(const key of Object.keys(mesh.geometry.attributes)){assert.deepEqual(other.geometry.attributes[key].array,mesh.geometry.attributes[key].array);buffers++;}
  assert.deepEqual(other.geometry.index?.array,mesh.geometry.index?.array);if(mesh.geometry.index)buffers++;
  assert.deepEqual(other.position.toArray(),mesh.position.toArray());rows.push({name,attributes:Object.keys(mesh.geometry.attributes),indexed:!!mesh.geometry.index});
}
const times=[];
for(const cycle of [0,1,26]){const rows=cycle===0?original.first:original.steady;for(let i=0;i<rows.length;i++){times.push((rows[i][0]+cycle*8)/2);if(i)times.push(((rows[i-1][0]+rows[i][0])/2+cycle*8)/2);}}
for(let i=0;i<=4100;i++)times.push((i+.193)*240/4100);
for(const time of times){
  const expected=samplePullPawlPlayback(original,time),actual=b.root.userData.stateAtTime(time);
  for(const key of ['q','theta','leftAngle','rightAngle'])maxStateError=Math.max(maxStateError,Math.abs(expected[key]-actual[key]));
  a.setState(expected);b.update(time);
  for(const name of Object.keys(a.root.userData.parts)){
    const x=a.root.userData.parts[name].matrixWorld.elements,y=b.root.userData.parts[name].matrixWorld.elements;
    for(let i=0;i<16;i++)maxMatrixError=Math.max(maxMatrixError,Math.abs(x[i]-y[i]));
  }
  poses++;
}
const sources=[];for(const file of ['scripts/probe-pull-pawl-production-parity.mjs','scripts/lib/pull-pawl-candidate.mjs','scripts/lib/pull-pawl-playback-study.mjs','src/simulation/pull-pawl.js','src/simulation/pull-pawl-motion.js','src/simulation/finite-plate-geometry.js','src/simulation/pull-pawl-geometry.js','src/data/pull-pawl-profile.js','artifacts/review/078-playback-finest-candidate.json'])sources.push({file,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
const report={movement:78,passed:maxStateError===0&&maxMatrixError===0,parts:rows.length,buffers,poses,maxStateError,maxMatrixError,rows,sources};
await writeFile('artifacts/review/078-production-parity.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,rows:undefined,sources:undefined});process.exitCode=report.passed?0:1;
