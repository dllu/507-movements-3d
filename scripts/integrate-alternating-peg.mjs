import fs from 'node:fs';
import crypto from 'node:crypto';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const frozen=JSON.parse(fs.readFileSync('artifacts/review/076-verification-source-hashes.json'));
for(const [file,expected]of Object.entries(frozen))if(hash(fs.readFileSync(file))!==expected)throw Error('Changed frozen source: '+file);
for(const name of ['077-long-lip-topology','077-long-lip-clock-formula-refined','077-friction-projection-check','077-input-clock-check','077-playback-compression-study','077-playback-contact-bounds','077-playback-surfaces']){
 const result=JSON.parse(fs.readFileSync('artifacts/review/'+name+'.json'));
 const passed=name==='077-long-lip-topology'?result.rows.length===62&&result.issues.length===0:result.passed===true;
 if(!passed)throw Error('Missing verification: '+name);
}
const files=['src/simulation/authored-intermittent.js','tests/models.test.mjs','src/data/display-profiles.js','src/data/display-profiles.json',
 'scripts/lib/alternating-peg-candidate.mjs','scripts/lib/alternating-peg-contact-study.mjs','scripts/lib/alternating-peg-playback-study.mjs',
 'artifacts/review/077-playback-candidate.json','artifacts/review/077-long-lip-study-checkpoint.json','artifacts/review/077-long-lip-playback-vertices.json'],sources=[];
for(const [i,file]of files.entries()){
 const bytes=fs.readFileSync(file),archive=`artifacts/review/077-preintegration-source-${i}.txt`;fs.writeFileSync(archive,bytes,{flag:'wx'});sources.push({file,archive,sha256:hash(bytes)});
}
fs.writeFileSync('artifacts/review/077-preintegration-checkpoint.json',JSON.stringify({movement:77,time:new Date().toISOString(),productionChanged:false,mechanicsPassed:false,frozenMatched:Object.keys(frozen).length,sources},null,2)+'\n',{flag:'wx'});

const cache=JSON.parse(fs.readFileSync('artifacts/review/077-playback-candidate.json'));
const metadata={geometry:cache.geometry,pitch:cache.pitch,physics:cache.physics,physicsPeriod:cache.physicsPeriod,playbackPeriod:4,epsilon:cache.epsilon};
fs.writeFileSync('src/data/alternating-peg-profile.js','// Finite-contact dynamics; see artifacts/review/077-preintegration-checkpoint.json.\n// Rows: physical time, lever, wheel, upper pawl, lower pawl angles.\nexport default {\n'+Object.entries(metadata).map(([key,value])=>'  '+key+': '+JSON.stringify(value)+',').join('\n')+'\n  first: [\n'+cache.first.map(row=>'    '+JSON.stringify(row)).join(',\n')+'\n  ],\n  steady: [\n'+cache.steady.map(row=>'    '+JSON.stringify(row)).join(',\n')+'\n  ],\n};\n',{flag:'wx'});
const contact=fs.readFileSync('scripts/lib/alternating-peg-contact-study.mjs','utf8');
const start=contact.indexOf('export function makeAlternatingPegStudy'),end=contact.indexOf(' const drivenAngle=',start);
const geometry="import {add,sub,rotate} from './finite-plate-geometry.js';\n\n"+contact.slice(start,end).replace('makeAlternatingPegStudy','makeAlternatingPegGeometry')+
 ' return{parameters:{center,scale,A,pivots,arms,pitch,orbit,phases,seats,vectors,lengths,initialAngles,pinRadius:.049,innerRadius:323.5218298952886/scale},source,anchorAt,pinAt};\n}\n';
fs.writeFileSync('src/simulation/alternating-peg-geometry.js',geometry,{flag:'wx'});
let motion=fs.readFileSync('scripts/lib/alternating-peg-playback-study.mjs','utf8');
motion="import profile from '../data/alternating-peg-profile.js';\n\n// Keep linear interpolation: its finite-contact clearance is separately bounded.\n"+motion.slice(0,motion.indexOf('\nexport function attachAlternatingPegPlayback')).replace('sampleAlternatingPegPlayback(profile,time,','sampleAlternatingPegMotion(time,');
fs.writeFileSync('src/simulation/alternating-peg-motion.js',motion,{flag:'wx'});
let factory=fs.readFileSync('scripts/lib/alternating-peg-candidate.mjs','utf8');
factory=factory.replaceAll('../../src/simulation/','./').replaceAll('makeAlternatingPegStudy','makeAlternatingPegGeometry').replace('./alternating-peg-contact-study.mjs','./alternating-peg-geometry.js');
const declaration=factory.indexOf('export function makeAlternatingPegCandidate('),body=factory.indexOf(' const mouthLower=',declaration);
factory=factory.slice(0,declaration)+"export function makeAlternatingPegPawlDrive(){\n const {pinRadius=.049,headRadius=.1,lowerHeadRadius=headRadius,mouthRadius=.070,upperFace=Math.PI/3,lowerFace=-Math.PI/4,mouthAngle=130*Math.PI/180,lowerMouthAngle=null,seatPhase}=profile.geometry;\n"+factory.slice(body);
factory="import profile from '../data/alternating-peg-profile.js';\nimport {sampleAlternatingPegMotion} from './alternating-peg-motion.js';\n"+factory;
factory=factory.replace("mechanism:'isolated-alternating-peg-pawl-candidate',fidelity:'candidate',qualification:'First finite source-scale geometry only. The two-face hook seats and flared mouths are provisional; gravity return, force feasibility, topology and actual-surface clearance still require verification. No physical animation is supplied.'", "mechanism:'alternating-pawl-peg-ratchet-drive',fidelity:'authored',reconstructionStatus:'rebuilt',profile,playbackPeriod:profile.playbackPeriod,\n  animationTiming:{authoredCyclePeriod:profile.playbackPeriod},minimumDisplayCycleSeconds:profile.playbackPeriod,\n  idealConstraints:'The prescribed rocking lever drives two freely hinged finite pawls. Gravity, inertia and inelastic pin contact determine the cached wheel and pawl motion. Common density, absolute angular damping and bidirectional dry-friction output resistance are reconstruction assumptions. The eight-second physical cycle is displayed in four seconds. The initial drawing pose settles into a one-pitch repeat; tiny physical rollback is retained. The 24 evenly spaced pins regularize the engraving, with phase fitted to its engaged pair.'");
factory=factory.replace(' setState();markShadows(root);return{root,setState,update:()=>{},motion,cameraDirection:new THREE.Vector3(0,0,10)};',
 " const stateAtTime=time=>sampleAlternatingPegMotion(time),update=time=>{const state=stateAtTime(time);setState(state);Object.assign(root.userData.kinematics,state);};\n root.userData.stateAtTime=stateAtTime;update(0);markShadows(root);return{root,setState,update,motion,cameraDirection:new THREE.Vector3(0,0,10)};");
fs.writeFileSync('src/simulation/alternating-peg-pawl.js',factory,{flag:'wx'});
const main='src/simulation/authored-intermittent.js',original=fs.readFileSync('artifacts/review/077-original-factory.txt','utf8');let source=fs.readFileSync(main,'utf8');
if(!source.includes(original))throw Error('Original factory mismatch');
source="import { makeAlternatingPegPawlDrive } from './alternating-peg-pawl.js';\n"+source.replace(original,'').replace('case 77: return alternatingPawlPegRatchetDrive();','case 77: return makeAlternatingPegPawlDrive();');fs.writeFileSync(main,source);
const testFile='tests/models.test.mjs',oldTest=fs.readFileSync('artifacts/review/077-original-test.txt','utf8'),test=fs.readFileSync(testFile,'utf8');if(!test.includes(oldTest))throw Error('Original test mismatch');fs.writeFileSync(testFile,test.replace(oldTest,''));
console.log({integrated:true,parts:62,first:cache.first.length,steady:cache.steady.length,frozenMatched:Object.keys(frozen).length});
