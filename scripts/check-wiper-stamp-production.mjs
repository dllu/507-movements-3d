import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWiperStampDrive} from '../src/simulation/wiper-stamp.js';
import {makeWiperStampCandidate} from './lib/wiper-stamp-candidate.mjs';
import {makeWiperStampPlayback} from './lib/wiper-stamp-playback.mjs';
import {readStudyReport,verifyStudySources,freezeStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/085-production-parity';
const input='artifacts/review/085-first-playback-data.json',data=readStudyReport(input),hardware=readStudyReport('artifacts/review/085-first-hardware-bound.json');
verifyStudySources(hardware.sources);assert(hardware.passed);
const production=makeWiperStampDrive(),u=production.root.userData,candidate=makeWiperStampCandidate(),motion=makeWiperStampPlayback(candidate,data);
for(const key of Object.keys(data))assert.deepEqual(u.profile[key],data[key],key);
assert.deepEqual(u.source,candidate.root.userData.source);assert.deepEqual(u.families,candidate.root.userData.families);
assert.deepEqual(u.geometry,candidate.root.userData.geometry);
let buffers=0,poses=0,transforms=0;const names=Object.keys(u.parts);
assert.deepEqual(names,Object.keys(candidate.root.userData.parts));
for(const name of names){const a=u.parts[name],b=candidate.root.userData.parts[name];
  assert.deepEqual(Object.keys(a.geometry.attributes),Object.keys(b.geometry.attributes));
  for(const attr of Object.keys(a.geometry.attributes)){assert.deepEqual(a.geometry.attributes[attr].array,b.geometry.attributes[attr].array,name+'/'+attr);buffers++;}
  assert.deepEqual(a.geometry.index?.array,b.geometry.index?.array,name+'/index');
  for(const key of ['castShadow','receiveShadow','visible'])assert.equal(a[key],b[key],name+'/'+key);
}
const times=[];
for(let i=0;i<data.knots.length;i++){times.push(data.knots[i][0]);if(i)times.push((data.knots[i-1][0]+data.knots[i][0])/2);}
for(const time of times){const expected=motion.sample(time),actual=u.stateAtTime(time);assert.deepEqual(actual,expected);production.update(time);candidate.setState(expected);poses++;
  for(const name of names){assert.deepEqual(u.parts[name].matrixWorld.elements,candidate.root.userData.parts[name].matrixWorld.elements,name);transforms++;}
  if(time>=data.loopStart)for(const period of [1,2]){assert.deepEqual(u.stateAtTime(time+period*data.period),motion.sample(time+period*data.period));poses++;}
}
const sources=freezeStudySources([input,'artifacts/review/085-first-hardware-bound.json','scripts/check-wiper-stamp-production.mjs',
  'src/simulation/wiper-stamp.js','src/simulation/wiper-stamp-geometry.js','src/simulation/wiper-stamp-contact.js','src/simulation/wiper-stamp-motion.js',
  'src/data/wiper-stamp-source.js','src/data/wiper-stamp-profile.js',...hardware.sources.map(s=>s.file)],prefix);
const report={movement:85,status:'exact-production-geometry-and-playback-parity',passed:true,candidateIntegrated:true,productionVerificationPending:true,
  parts:names.length,buffers,poses,transforms,knots:data.knots.length,maximumGeometryError:0,maximumTransformError:0,maximumStateError:0,sources,
  qualification:'All generated attributes, indices, family memberships, geometry parameters and shadow/visibility flags match the certified candidate. Every knot and midpoint has exact pose and world-transform parity; repeated-cycle samples also agree. The profile is identical to the continuously certified data. Final build, numerical suite, browser checks and render inspection are separate requirements.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined});
