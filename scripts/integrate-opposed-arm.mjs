import fs from 'node:fs';
import crypto from 'node:crypto';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),review='artifacts/review/',
 freeze=JSON.parse(fs.readFileSync(review+'078-verification-source-hashes.json')),
 checkpoint=JSON.parse(fs.readFileSync(review+'079-playback-study-checkpoint.json'));
if(!checkpoint.candidateReady)throw Error('Candidate is not qualified');
for(const [file,sha]of Object.entries(freeze))if(hash(fs.readFileSync(file))!==sha)throw Error('Verified source changed: '+file);
for(const item of [...checkpoint.reports,...checkpoint.archives])if(hash(fs.readFileSync(item.file))!==item.sha256)throw Error('Evidence changed: '+item.file);
const files=['src/simulation/authored-intermittent.js','tests/models.test.mjs','src/data/display-profiles.js','src/data/display-profiles.json',
 'scripts/lib/opposed-arm-candidate.mjs','scripts/lib/opposed-arm-playback.mjs','artifacts/review/079-projected-finest-candidate.json',
 'artifacts/review/079-playback-study-checkpoint.json','scripts/integrate-opposed-arm.mjs'],sources=[];
for(const file of files){const bytes=fs.readFileSync(file),archive=review+`079-preintegration-source-${sources.length}.txt`;fs.writeFileSync(archive,bytes,{flag:'wx'});sources.push({file,archive,sha256:hash(bytes)});}
fs.writeFileSync(review+'079-preintegration-checkpoint.json',JSON.stringify({movement:79,created:new Date().toISOString(),productionChanged:false,
 mechanicsPassed:false,frozenInputsMatched:Object.keys(freeze).length,sources},null,2)+'\n',{flag:'wx'});
const cache=JSON.parse(fs.readFileSync(checkpoint.playback.file)),bounds=JSON.parse(fs.readFileSync(review+'079-view-bounds.json')).bounds,
 metadata={geometry:cache.geometry,physics:cache.physics,physicsPeriod:cache.physicsPeriod,playbackPeriod:cache.playbackPeriod,pitch:cache.pitch,
 teethPerCycle:cache.teethPerCycle,sourceSlider:cache.sourceSlider,motionBounds:{min:bounds.min,max:bounds.max},
 maximumAngleErrors:cache.maximumAngleErrors,denseOutputProjection:cache.denseOutputProjection};
fs.writeFileSync('src/data/opposed-arm-profile.js','// Finite-contact dynamics and bounded interpolation; see artifacts/review/079-playback-study-checkpoint.json.\n'+
 '// Rows: physical time, wheel angle, upper pawl tilt, lower pawl tilt.\nexport default {\n'+
 Object.entries(metadata).map(([key,value])=>'  '+key+': '+JSON.stringify(value)+',').join('\n')+
 '\n  first: [\n'+cache.first.map(row=>'    '+JSON.stringify(row)).join(',\n')+
 '\n  ],\n  steady: [\n'+cache.steady.map(row=>'    '+JSON.stringify(row)).join(',\n')+'\n  ],\n};\n',{flag:'wx'});
let geometry=fs.readFileSync('scripts/lib/opposed-arm-candidate.mjs','utf8').replaceAll('../../src/simulation/','./').replace('makeOpposedArmCandidate','makeOpposedArmGeometry');
geometry=geometry.replace("mechanism:'isolated-axial-face-ratchet-candidate',fidelity:'candidate'", "mechanism:'opposed-arm-face-ratchet-drive',fidelity:'authored'");
fs.writeFileSync('src/simulation/opposed-arm-geometry.js',geometry,{flag:'wx'});
let motion=fs.readFileSync('scripts/lib/opposed-arm-playback.mjs','utf8');
motion="import profile from '../data/opposed-arm-profile.js';\n\n// Interpolate the continuously bounded startup and repeating contact path.\n"+
 motion.slice(0,motion.indexOf('\nexport function attachOpposedArmPlayback')).replace('sampleOpposedArmPlayback(profile,time,','sampleOpposedArmMotion(time,');
fs.writeFileSync('src/simulation/opposed-arm-motion.js',motion,{flag:'wx'});
fs.writeFileSync('src/simulation/opposed-arm.js',`import profile from '../data/opposed-arm-profile.js';
import {makeOpposedArmGeometry} from './opposed-arm-geometry.js';
import {sampleOpposedArmMotion} from './opposed-arm-motion.js';

export function makeOpposedArmDrive(){
 const model=makeOpposedArmGeometry(profile.geometry),u=model.root.userData;
 Object.assign(u,{profile,reconstructionStatus:'rebuilt',playbackPeriod:profile.playbackPeriod,
  animationTiming:{authoredCyclePeriod:profile.playbackPeriod},minimumDisplayCycleSeconds:profile.playbackPeriod,
  sampledMotionBounds:profile.motionBounds,stateAtTime:sampleOpposedArmMotion,
  qualification:'Measured joint centers, rim circles and pawl contours follow the engraving. The 33 regular axial ratchet teeth, axial layers, radial journals and concealed return preload reconstruct details that the source does not fully specify.',
  idealConstraints:'A prescribed horizontal slider drives two fixed-length rods and independent radial arms. Gravity, inertia, ideal torsional hinge preload and finite unilateral tooth contact determine the free wheel and pawl tilts. Common density, damping, output resistance and stroke amplitude are reconstruction assumptions. No detailed spring coil is rendered. The eight-second physical cycle plays in four seconds. Physical startup is retained; the steady wheel advances four teeth clockwise without stopping. One bounded interior pawl-angle correction resolves dense-output interpolation overlap.'});
 model.update=time=>{const state=sampleOpposedArmMotion(time);u.setState(state);Object.assign(u.kinematics,state);};
 model.update(0);return model;
}
`,{flag:'wx'});
const main='src/simulation/authored-intermittent.js',oldFactory=fs.readFileSync(review+'079-original-factory.txt','utf8'),original=fs.readFileSync(main,'utf8');
if(!original.includes(oldFactory))throw Error('Original factory mismatch');
fs.writeFileSync(main,"import { makeOpposedArmDrive } from './opposed-arm.js';\n"+original.replace(oldFactory,'')
 .replace('case 79: return sliderDrivenOpposedArmInternalRatchet();','case 79: return makeOpposedArmDrive();'));
const testFile='tests/models.test.mjs',oldTest=fs.readFileSync(review+'079-original-test.txt','utf8'),test=fs.readFileSync(testFile,'utf8');
if(!test.includes(oldTest))throw Error('Original test mismatch');fs.writeFileSync(testFile,test.replace(oldTest,''));
console.log({integrated:true,parts:37,first:cache.first.length,steady:cache.steady.length,frozenInputs:Object.keys(freeze).length});
