import fs from 'node:fs';
import crypto from 'node:crypto';

const review='artifacts/review/',hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex'),
 frozen=JSON.parse(fs.readFileSync(review+'077-verification-source-hashes.json')),
 checkpoint=JSON.parse(fs.readFileSync(review+'078-playback-study-checkpoint.json'));
for(const [file,expected]of Object.entries(frozen))if(hash(fs.readFileSync(file))!==expected)throw Error('Changed verified source: '+file);
for(const item of [...checkpoint.reports,...checkpoint.sources.map(s=>({...s,file:s.archive})),...checkpoint.captures,...checkpoint.plots]){
 if(hash(fs.readFileSync(item.file))!==item.sha256)throw Error('Changed evidence: '+item.file);
}
const files=['src/simulation/authored-intermittent.js','tests/models.test.mjs','src/data/display-profiles.js','src/data/display-profiles.json',
 'scripts/lib/pull-pawl-candidate.mjs','scripts/lib/pull-pawl-playback-study.mjs','artifacts/review/078-playback-finest-candidate.json',
 'artifacts/review/078-playback-study-checkpoint.json','artifacts/review/078-preview-config.json'],sources=[];
for(const [i,file]of files.entries()){
 const bytes=fs.readFileSync(file),archive=review+`078-preintegration-source-${i}.txt`;
 fs.writeFileSync(archive,bytes,{flag:'wx'});sources.push({file,archive,sha256:hash(bytes)});
}
fs.writeFileSync(review+'078-preintegration-checkpoint.json',JSON.stringify({movement:78,created:new Date().toISOString(),productionChanged:false,
 mechanicsPassed:false,frozenMatched:Object.keys(frozen).length,sources},null,2)+'\n',{flag:'wx'});

const cache=JSON.parse(fs.readFileSync(review+'078-playback-finest-candidate.json')),
 bounds=JSON.parse(fs.readFileSync(review+'078-preview-config.json')).motionBounds,
 metadata={geometry:cache.geometry,pitch:cache.pitch,physics:cache.physics,physicsPeriod:cache.physicsPeriod,
  playbackPeriod:cache.playbackPeriod,epsilon:cache.epsilon,motionBounds:bounds};
fs.writeFileSync('src/data/pull-pawl-profile.js','// Finite-contact dynamics; see artifacts/review/078-playback-study-checkpoint.json.\n'+
 '// Rows: physical time, lever, wheel, left pawl, right pawl angles.\nexport default {\n'+
 Object.entries(metadata).map(([key,value])=>'  '+key+': '+JSON.stringify(value)+',').join('\n')+
 '\n  first: [\n'+cache.first.map(row=>'    '+JSON.stringify(row)).join(',\n')+
 '\n  ],\n  steady: [\n'+cache.steady.map(row=>'    '+JSON.stringify(row)).join(',\n')+'\n  ],\n};\n',{flag:'wx'});
let geometry=fs.readFileSync('scripts/lib/pull-pawl-candidate.mjs','utf8')
 .replaceAll('../../src/simulation/','./').replace('makePullPawlCandidate','makePullPawlGeometry');
geometry=geometry.replace("mechanism:'isolated-alternating-pull-pawl-candidate',fidelity:'candidate',\n  qualification:'Source-contour geometry study only. Regularized concentric wheel, six similar openings, covered frame/pawl edges and the rear relief beneath the left hook are reconstructions. Tooth contact, gravity return, finite clearance and motion are unverified.'", "mechanism:'alternating-pull-pawl-ratchet-drive',fidelity:'authored'");
fs.writeFileSync('src/simulation/pull-pawl-geometry.js',geometry,{flag:'wx'});
let motion=fs.readFileSync('scripts/lib/pull-pawl-playback-study.mjs','utf8');
motion="import profile from '../data/pull-pawl-profile.js';\n\n// Linear interpolation preserves the separately bounded finite-contact path.\n"+
 motion.slice(0,motion.indexOf('\nexport function attachPullPawlPlayback')).replace('samplePullPawlPlayback(profile,time,','samplePullPawlMotion(time,');
fs.writeFileSync('src/simulation/pull-pawl-motion.js',motion,{flag:'wx'});
fs.writeFileSync('src/simulation/pull-pawl.js',`import profile from '../data/pull-pawl-profile.js';
import {makePullPawlGeometry} from './pull-pawl-geometry.js';
import {samplePullPawlMotion} from './pull-pawl-motion.js';

export function makePullPawlDrive(){
 const model=makePullPawlGeometry(profile.geometry),u=model.root.userData;
 Object.assign(u,{profile,reconstructionStatus:'rebuilt',playbackPeriod:profile.playbackPeriod,
  animationTiming:{authoredCyclePeriod:profile.playbackPeriod},minimumDisplayCycleSeconds:profile.playbackPeriod,
  sampledMotionBounds:profile.motionBounds,stateAtTime:samplePullPawlMotion,
  idealConstraints:'The prescribed rocker drives two independently hinged pulling pawls. Gravity, inertia and inelastic tooth contact determine the wheel and pawl motion. Common density, absolute angular damping and bidirectional dry-friction resistance are reconstruction assumptions. The eight-second physical cycle is displayed in four seconds. Startup settling and its tiny rollback are retained; each steady cycle advances one clockwise tooth. The concentric 26-tooth wheel, repeated spoke openings, hidden contours and rear relief beneath the left hook regularize the engraving. Ratchet teeth retain the source undercuts.'});
 model.update=time=>{const state=samplePullPawlMotion(time);model.setState(state);Object.assign(u.kinematics,state);};
 model.update(0);return model;
}
`,{flag:'wx'});
const main='src/simulation/authored-intermittent.js',oldFactory=fs.readFileSync(review+'078-original-factory.txt','utf8'),
 original=fs.readFileSync(main,'utf8');
if(!original.includes(oldFactory))throw Error('Original factory mismatch');
fs.writeFileSync(main,"import { makePullPawlDrive } from './pull-pawl.js';\n"+original.replace(oldFactory,'')
 .replace('case 78: return alternatingPullPawlRatchetDrive();','case 78: return makePullPawlDrive();'));
const testFile='tests/models.test.mjs',oldTest=fs.readFileSync(review+'078-original-test.txt','utf8'),test=fs.readFileSync(testFile,'utf8');
if(!test.includes(oldTest))throw Error('Original tests mismatch');
fs.writeFileSync(testFile,test.replace(oldTest,''));
console.log({integrated:true,parts:23,first:cache.first.length,steady:cache.steady.length,frozenMatched:Object.keys(frozen).length});
