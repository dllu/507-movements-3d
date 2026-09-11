import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const base='artifacts/review/',hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),
 freeze=JSON.parse(fs.readFileSync(base+'079-verification-source-hashes.json')),study=JSON.parse(fs.readFileSync(base+'080-loaded-study-checkpoint.json'));
assert(study.candidateReadyForIntegration);for(const [file,expected]of Object.entries(freeze))assert.equal(hash(file),expected,file);
for(const s of [...study.reports,...study.archives,...study.sources,study.playback])assert.equal(hash(s.archive??s.file),s.sha256,s.file);
const files=['src/simulation/authored-intermittent.js','tests/models.test.mjs','src/data/display-profiles.js','src/data/display-profiles.json',
 'src/simulation/engine.js','src/main.js','scripts/lib/crossed-rack-candidate.mjs','scripts/lib/crossed-rack-source.mjs',
 'scripts/lib/crossed-rack-playback-study.mjs',study.playback.file,base+'080-loaded-study-checkpoint.json','scripts/integrate-crossed-rack.mjs'],
 sources=files.map((file,i)=>{const archive=base+'080-preintegration-source-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);return{file,archive,sha256:hash(file)};});
fs.writeFileSync(base+'080-preintegration-checkpoint.json',JSON.stringify({movement:80,created:new Date().toISOString(),productionChanged:false,
 frozenInputsMatched:Object.keys(freeze).length,sources},null,2)+'\n',{flag:'wx'});
const profile=JSON.parse(fs.readFileSync(study.playback.file)),metadata=Object.fromEntries(Object.entries(profile).filter(([key])=>key!=='rows'));
fs.writeFileSync('src/data/crossed-rack-profile.js','// Qualified finite dynamics; artifacts/review/080-loaded-study-checkpoint.json.\n'+
 '// Rows: physical time, rack height, left-pivot pawl angle, right-pivot pawl angle.\nexport default {\n'+
 Object.entries(metadata).map(([key,value])=>'  '+key+': '+JSON.stringify(value)+',').join('\n')+
 '\n  rows: [\n'+profile.rows.map(row=>'    '+JSON.stringify(row)).join(',\n')+'\n  ],\n};\n',{flag:'wx'});
fs.copyFileSync('scripts/lib/crossed-rack-source.mjs','src/data/crossed-rack-source.js',fs.constants.COPYFILE_EXCL);
let geometry=fs.readFileSync('scripts/lib/crossed-rack-candidate.mjs','utf8').replaceAll('../../src/simulation/','./')
 .replace("'./crossed-rack-source.mjs'","'../data/crossed-rack-source.js'").replace('makeCrossedRackCandidate','makeCrossedRackGeometry')
 .replace("mechanism:'isolated-crossed-hook-slotted-rack-candidate',fidelity:'candidate'","mechanism:'crossed-hook-slotted-rack-drive',fidelity:'authored'");
fs.writeFileSync('src/simulation/crossed-rack-geometry.js',geometry,{flag:'wx'});
const motion="import profile from '../data/crossed-rack-profile.js';\n\n"+fs.readFileSync('scripts/lib/crossed-rack-playback-study.mjs','utf8')
 .replace('sampleCrossedRackProfile(profile,time,','sampleCrossedRackMotion(time,');
fs.writeFileSync('src/simulation/crossed-rack-motion.js',motion,{flag:'wx'});
fs.writeFileSync('src/simulation/crossed-rack.js',`import profile from '../data/crossed-rack-profile.js';
import {makeCrossedRackGeometry} from './crossed-rack-geometry.js';
import {sampleCrossedRackMotion} from './crossed-rack-motion.js';

export function makeCrossedRackDrive(){
 const model=makeCrossedRackGeometry(profile.geometry),u=model.root.userData;
 Object.assign(u,{profile,reconstructionStatus:'rebuilt',playbackPeriod:profile.playbackPeriod,playbackDuration:profile.playbackDuration,
  animationTiming:{authoredCyclePeriod:profile.playbackPeriod},minimumDisplayCycleSeconds:profile.playbackPeriod,
  sampledMotionBounds:profile.motionBounds,stateAtTime:sampleCrossedRackMotion,
  qualification:'Measured source contours, joint centers and sixteen teeth per side follow the engraving. Axial layers, concealed hook-toe relief, pin construction and regular pitch reconstruct details absent or irregular in the source.',
  idealConstraints:'Only the lever is prescribed. An ideal prismatic rack constraint imposes the source-described straight path; the shaft and slot alone are not claimed to form a complete linear guide. Gravity, moving-pivot inertia, viscous drag and finite frictionless tooth contact determine rack height and both free pawl angles. Common density, zero extra payload, input amplitude and period are reconstruction assumptions. Startup seating, physical handoff rollback and finite whole-rack lift are retained. The eight-second physical input cycle plays in four seconds. Input stops at a zero-speed reversal after nine display seconds; the ten-second demonstration holds its final pose for explicit replay.'});
 model.update=time=>{const state=sampleCrossedRackMotion(time);u.setState(state);Object.assign(u.kinematics,state);};
 model.update(0);return model;
}
`,{flag:'wx'});
const main='src/simulation/authored-intermittent.js',factory=fs.readFileSync(base+'080-original-factory.txt','utf8'),old=fs.readFileSync(main,'utf8');
assert(old.includes(factory));assert(old.includes('case 80: return crossedHookPawlSlottedRackDrive();'));
fs.writeFileSync(main,"import { makeCrossedRackDrive } from './crossed-rack.js';\n"+old.replace(factory,'').replace('case 80: return crossedHookPawlSlottedRackDrive();','case 80: return makeCrossedRackDrive();'));
const tests='tests/models.test.mjs',oldTest=fs.readFileSync(base+'080-original-test.txt','utf8'),text=fs.readFileSync(tests,'utf8');assert(text.includes(oldTest));fs.writeFileSync(tests,text.replace(oldTest,''));
console.log({integrated:true,movement:80,parts:16,knots:profile.rows.length,playbackDuration:profile.playbackDuration,frozenInputs:Object.keys(freeze).length});
