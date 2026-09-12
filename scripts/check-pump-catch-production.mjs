import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makePumpCatchDrive} from '../src/simulation/pump-catch.js';
import {makePumpCatchLiveCandidate} from './lib/pump-catch-live-rope.mjs';
import {indexPumpCatchHardware} from './lib/pump-catch-indexed-hardware.mjs';
import {makePumpCatchPlayback} from './lib/pump-catch-playback.mjs';
import {pumpCatchCompleteSources} from './lib/pump-catch-complete-sources.mjs';
import {readStudyReport,hashStudyFile,verifyStudySources,freezeStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-production-parity',exportFile='artifacts/review/086-production-export.json',
  exported=readStudyReport(exportFile),input='artifacts/review/086-tighter-hybrid-compressed-motion.json',data=readStudyReport(input),
  production=makePumpCatchDrive(),u=production.root.userData,candidate=makePumpCatchLiveCandidate(),v=candidate.root.userData,motion=makePumpCatchPlayback(data);
assert(data.passed);verifyStudySources(data.sources);indexPumpCatchHardware(candidate);
for(const {file,sha256}of u.profile.provenance){assert.equal(hashStudyFile(file),sha256);const report=readStudyReport(file);assert(report.passed);verifyStudySources(report.sources);}
for(const key of ['rows','repeat','angularSpeed','parameters'])assert.deepEqual(u.profile[key],data[key]);
assert.deepEqual(u.profile.motionBounds,exported.motionBounds);
for(const key of ['source','families','geometry','completeHardware','rearDrive','heelStop','candidateOptions','profiles'])assert.deepEqual(u[key],v[key],key);
// Verify the transferred modules themselves, as well as sampled execution.
// Only import paths and exported factory names may differ from qualified code.
for(const [from,to]of Object.entries(exported.mapping)){
 let expected=fs.readFileSync('scripts/lib/'+from,'utf8').replaceAll("'../../src/simulation/","'./");
 for(const [old,file]of Object.entries(exported.mapping))expected=expected.replaceAll("'./"+old+"'","'"+(file.startsWith('src/data/')?'../data/':'./')+file.split('/').at(-1)+"'");
 for(const [old,name]of Object.entries(exported.renames))expected=expected.replaceAll(old,name);
 assert.equal(fs.readFileSync(to,'utf8'),expected,to);assert(!/from ['"].*scripts\//.test(expected));
}
let poses=0,states=0,transforms=0,bufferChecks=0,attributeValues=0;
const names=Object.keys(u.parts);assert.deepEqual(names,Object.keys(v.parts));
function buffers(name){
 const a=u.parts[name],b=v.parts[name];assert.deepEqual(Object.keys(a.geometry.attributes),Object.keys(b.geometry.attributes));
 for(const key of Object.keys(a.geometry.attributes)){
  const x=a.geometry.attributes[key],y=b.geometry.attributes[key];assert.equal(x.itemSize,y.itemSize);assert.equal(x.normalized,y.normalized);assert.equal(x.count,y.count);
  assert.deepEqual(x.array.subarray(0,x.count*x.itemSize),y.array.subarray(0,y.count*y.itemSize),name+'/'+key);bufferChecks++;attributeValues+=x.count*x.itemSize;
 }
 for(const key of ['groups','drawRange'])assert.deepEqual(a.geometry[key],b.geometry[key],name+'/'+key);
 const x=a.geometry.index,y=b.geometry.index;assert.equal(x.count,y.count);assert.deepEqual(x.array.subarray(0,x.count),y.array.subarray(0,y.count),name+'/index');bufferChecks++;
 for(const key of ['castShadow','receiveShadow','visible'])assert.equal(a[key],b[key],name+'/'+key);
 for(const key of ['roughness','metalness','side','opacity','transparent'])assert.equal(a.material[key],b.material[key],name+'/'+key);
 assert.deepEqual(a.material.color.toArray(),b.material.color.toArray());
 if(a.material.map){assert.deepEqual(a.material.map.image.data,b.material.map.image.data);assert.deepEqual(a.material.map.repeat.toArray(),b.material.map.repeat.toArray());}
}
names.forEach(buffers);
const extrema=new Set();for(const k of [0,1,2])for(const sign of [-1,1]){
 let best=0;for(let i=1;i<data.rows.length;i++)if(sign*data.rows[i].q[k]>sign*data.rows[best].q[k])best=i;extrema.add(best);
}
const counts=new Set();
for(let i=0;i<data.rows.length;i++)for(const physicalTime of [data.rows[i].time,...(i?[(data.rows[i-1].time+data.rows[i].time)/2]:[])]){
 const time=physicalTime/2,expected=motion.sample(time);assert.deepEqual(u.stateAtTime(time),expected);states++;
 production.update(time);candidate.setState(expected);poses++;
 for(const name of names){assert.deepEqual(u.parts[name].matrixWorld.elements,v.parts[name].matrixWorld.elements,name+' at '+time);transforms++;}
 assert.equal(u.parts.inputDriveBand.material.map.offset.x,v.parts.inputDriveBand.material.map.offset.x);
 if(i%64===0||extrema.has(i)){buffers('pumpRope');counts.add(u.parts.pumpRope.geometry.attributes.position.count);}
 if(time>=.25)for(const cycles of [1,2]){assert.deepEqual(u.stateAtTime(time+4*cycles),motion.sample(time+4*cycles));states++;}
 if(i%1000===0&&physicalTime===data.rows[i].time)console.log({row:i,poses,states,transforms});
}
assert(counts.size>20);
const sources=freezeStudySources(['scripts/check-pump-catch-production.mjs',exportFile,input,...exported.exportedFiles,
 'scripts/lib/pump-catch-live-rope.mjs','scripts/lib/pump-catch-indexed-hardware.mjs','scripts/lib/pump-catch-playback.mjs',
 ...pumpCatchCompleteSources,'src/data/display-profiles.js','src/data/display-profiles.json','src/simulation/authored-intermittent.js',
 'tests/pump-catch.test.mjs','tests/e2e/pump-catch.spec.mjs'],prefix);verifyStudySources(sources);
const report={movement:86,status:'exact-qualified-production-geometry-and-playback-parity',passed:true,candidateIntegrated:true,productionVerificationPending:true,
 parts:names.length,poses,states,transforms,bufferChecks,attributeValues,ropeSectionCounts:counts.size,profileRows:data.rows.length,
 maximumGeometryError:0,maximumTransformError:0,maximumStateError:0,sources,
 qualification:'Transferred source modules differ only in imports/factory names. All 42 initial meshes, materials and hardware parameters match the qualified candidate. Every knot and midpoint has exact state and world-transform parity, with additional repeated-cycle states. Actual rope attributes and active indices agree at 64-row intervals and coordinate extrema. Geometry and motion provenance is unchanged. Build, full numerical suite, browser checks and integrated inspection are separate requirements.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined});
