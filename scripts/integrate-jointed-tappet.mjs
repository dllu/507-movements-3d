import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
const frozen=JSON.parse(await readFile('artifacts/review/075-verification-source-hashes.json'));
for(const [file,expected] of Object.entries(frozen))if(hash(await readFile(file))!==expected)throw new Error('Changed frozen source: '+file);
const files=['scripts/lib/jointed-tappet-candidate.mjs','scripts/lib/finite-plate-study.mjs','scripts/lib/extruded-section-caps.mjs','scripts/lib/jointed-tappet-contact-study.mjs','scripts/lib/jointed-tappet-playback-study.mjs','scripts/check-jointed-tappet-playback-contacts.mjs','scripts/check-jointed-tappet-playback-browser.mjs','scripts/build-jointed-tappet-playback-study.mjs','artifacts/review/076-playback-preview.html','artifacts/review/076-playback-candidate.json','artifacts/review/076-playback-contact-bounds.json','artifacts/review/076-playback-compression-study.json','artifacts/review/076-playback-browser-fixed.json'];
const sources=[];
for(let i=0;i<files.length;i++){
  const file=files[i],bytes=await readFile(file),archive=`artifacts/review/076-preintegration-source-${i}.txt`;
  await writeFile(archive,bytes,{flag:'wx'});sources.push({file,archive,sha256:hash(bytes)});
}
await writeFile('artifacts/review/076-preintegration-checkpoint.json',JSON.stringify({movement:76,time:new Date().toISOString(),frozenMatched:Object.keys(frozen).length,sources,prior:'artifacts/review/076-finite-dynamics-checkpoint.json',productionChanged:false},null,2)+'\n',{flag:'wx'});
for(const [from,to] of [['finite-plate-study.mjs','finite-plate-geometry.js'],['extruded-section-caps.mjs','extruded-section-caps.js'],['jointed-tappet-contact-study.mjs','jointed-tappet-contact.js']]){
  let source=await readFile('scripts/lib/'+from,'utf8');
  source=source.replace('../../src/simulation/clutch-section-geometry.js','./clutch-section-geometry.js').replace('// Isolated source-scale kinematic study. No production factory depends on it.','// Source-scale ratchet profile and finite circular-nose contact geometry.').replaceAll('makeJointedTappetContactStudy','makeJointedTappetContactProfile');
  await writeFile('src/simulation/'+to,source,{flag:'wx'});
}
const playback=JSON.parse(await readFile('artifacts/review/076-playback-candidate.json'));
const {physics,geometry,physicsPeriod,epsilon,initialSettleTime,first,steady}=playback;
const metadata={physics,geometry,physicsPeriod,period:12,epsilon,initialSettleTime};
await writeFile('src/data/jointed-tappet-profile.js','// Finite contact dynamics cache. See artifacts/review/076-preintegration-checkpoint.json.\n// Rows: physical time, tappet angle, dog angle relative to tappet, wheel angle, holding-pawl angle.\nexport default {\n'+Object.entries(metadata).map(([k,v])=>`  ${k}: ${JSON.stringify(v)},`).join('\n')+'\n  first: [\n'+first.map(r=>'    '+JSON.stringify(r)).join(',\n')+'\n  ],\n  steady: [\n'+steady.map(r=>'    '+JSON.stringify(r)).join(',\n')+'\n  ],\n};\n',{flag:'wx'});
let factory=await readFile('scripts/lib/jointed-tappet-candidate.mjs','utf8');
factory=factory.replace('../../src/simulation/primitives.js','./primitives.js').replaceAll('makeJointedTappetContactStudy','makeJointedTappetContactProfile').replace('./jointed-tappet-contact-study.mjs','./jointed-tappet-contact.js').replace('./finite-plate-study.mjs','./finite-plate-geometry.js').replace('./extruded-section-caps.mjs','./extruded-section-caps.js');
factory="import profile from '../data/jointed-tappet-profile.js';\nimport {sampleJointedTappetMotion} from './jointed-tappet-motion.js';\n"+factory;
factory=factory.replace('makeJointedTappetCandidate({motionParameters={}}={})','makeJointedTappetCounter()').replace(',...motionParameters','').replace('Unknown candidate view','Unknown jointed tappet view');
factory=factory.replace("mechanism:'isolated-finite-jointed-tappet-counter',fidelity:'candidate',", "mechanism:'stud-struck-jointed-tappet-ratchet-counter',fidelity:'authored',reconstructionStatus:'rebuilt',\n    profile,playbackPeriod:profile.period,animationTiming:{authoredCyclePeriod:profile.period},minimumDisplayCycleSeconds:profile.period,");
factory=factory.replace(/qualification:'Static finite candidate only[^']*'/,"idealConstraints:'A clockwise stud drives the jointed tappet; the 20-tooth count wheel turns counterclockwise and settles one tooth ahead. Gravity, finite normal contact and inelastic impact determine the cached trajectory. Common material density, viscous bearing damping and an opposing output load are reconstruction assumptions. The 24-second physical cycle is displayed in 12 seconds. The engraving section clips only the display of the complete coaxial driver.'");
factory=factory.replace("setConfiguration('section');setState();markShadows(root);\n  return{root,update:()=>{},setState,contact,cameraDirection:new THREE.Vector3(0,0,10)};", "const stateAtTime=time=>sampleJointedTappetMotion(time);\n  const update=time=>{const state=stateAtTime(time);setState(state);Object.assign(root.userData.kinematics,state);};\n  root.userData.stateAtTime=stateAtTime;\n  setConfiguration('section');update(0);markShadows(root);\n  return{root,update,setState,contact,cameraDirection:new THREE.Vector3(0,0,10)};");
await writeFile('src/simulation/jointed-tappet.js',factory,{flag:'wx'});
const file='src/simulation/authored-intermittent.js',old=await readFile('artifacts/review/076-original-factory.txt','utf8');let source=await readFile(file,'utf8');if(!source.includes(old))throw new Error('Original factory mismatch');
source=source.replace(old,'').replace('case 76: return studStruckJointedTappetCounter();','case 76: return makeJointedTappetCounter();');
source="import { makeJointedTappetCounter } from './jointed-tappet.js';\n"+source;await writeFile(file,source);
const testFile='tests/models.test.mjs',oldTest=await readFile('artifacts/review/076-original-test.txt','utf8'),test=await readFile(testFile,'utf8');if(!test.includes(oldTest))throw new Error('Original test mismatch');await writeFile(testFile,test.replace(oldTest,''));
console.log({integrated:true,parts:24,first:first.length,steady:steady.length,frozenMatched:Object.keys(frozen).length});
