import { readFile, writeFile, copyFile, unlink } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
const directory='artifacts/review/',json=async name=>JSON.parse(await readFile(directory+name+'.json','utf8'));
const hash=data=>createHash('sha256').update(data).digest('hex');
for(const[file,digest]of Object.entries(await json('069-verification-source-hashes')))
  if(hash(await readFile(file))!==digest)throw new Error('Previous production checkpoint changed: '+file);
for(const name of ['exact-analytic-motion','refined-hardware','refined-locking','refined-solids','refined-contact-cones','refined-source-fit','refined-candidate-capture']){
  const exit=await json('070-'+name+'-exit-status');if(exit.code!==0||exit.signal!==null)throw new Error('Incomplete check: '+name);
}
const hardware=await json('070-refined-hardware'),locking=await json('070-refined-locking'),forces=await json('070-refined-contact-cones'),solids=await json('070-refined-solids');
if(hardware.inside||hardware.checks!==452216700||hardware.pairs.length!==65||locking.issues.length||locking.poses!==20
  ||forces.failedDrive||forces.failedLock||forces.activePoses!==189||forces.lockingPoses!==20||solids.issues.length||solids.rows.length!==18)throw new Error('Candidate mechanical acceptance failed');
const captures=await json('070-refined-candidate-captures');if(captures.captures.length!==11)throw new Error('Missing candidate views');
for(const frame of captures.captures)if(!frame.inspected||hash(await readFile(frame.file))!==frame.sha256)throw new Error('Uninspected or changed candidate frame');
let source=await readFile('src/simulation/authored-intermittent.js','utf8'),tests=await readFile('tests/models.test.mjs','utf8');
const oldFactory=(await readFile(directory+'070-original-factory.txt','utf8')).trim(),oldTest=(await readFile(directory+'070-original-test.txt','utf8')).trim();
const importLine="import { makeSmallSingleToothIndex } from './small-single-tooth-index.js';",caseLine='case 70: return openRimTappetStudIndex();';
for(const part of [oldFactory,importLine,caseLine])if(source.split(part).length!==2)throw new Error('Changed original source');
if(tests.split(oldTest).length!==2)throw new Error('Changed original test');
const originalRecord=await json('070-reconstruction');
for(const frame of originalRecord.baselineCaptures){
  if(hash(await readFile(directory+frame.file))!==frame.sha256)throw new Error('Changed baseline frame');
  await copyFile(directory+frame.file,directory+frame.file.replace('070-phase-','070-original-phase-'),constants.COPYFILE_EXCL);
}
await writeFile(directory+'070-display-profiles-before.json',await readFile('src/data/display-profiles.json'),{flag:'wx'});
const factory=(await readFile('scripts/lib/open-rim-tappet-candidate.mjs','utf8'))
  .replace("'./open-rim-tappet-profile.mjs'","'../data/open-rim-tappet-profile.js'")
  .replace("'./open-rim-tappet-motion.mjs'","'./open-rim-tappet-motion.js'")
  .replace("'../../src/simulation/clutch-section-geometry.js'","'./clutch-section-geometry.js'")
  .replace("'../../src/simulation/primitives.js'","'./primitives.js'")
  .replace('makeOpenRimTappetCandidate','makeOpenRimTappetIndex').replace("reconstructionStatus:'candidate'","reconstructionStatus:'rebuilt'");
await writeFile('src/simulation/open-rim-tappet.js',factory,{flag:'wx'});
await copyFile('scripts/lib/open-rim-tappet-motion.mjs','src/simulation/open-rim-tappet-motion.js',constants.COPYFILE_EXCL);
await copyFile('scripts/lib/open-rim-tappet-profile.mjs','src/data/open-rim-tappet-profile.js',constants.COPYFILE_EXCL);
source=source.replace(oldFactory,'').replace(importLine,importLine+"\nimport { makeOpenRimTappetIndex } from './open-rim-tappet.js';")
  .replace(caseLine,'case 70: return makeOpenRimTappetIndex();');
tests=tests.replace(oldTest,`test('movement 70 wires the source-shaped open-rim tappet and ten studs', () => {
  const model = createMovementModel(catalog.movements[69]), data = model.root.userData;
  assert.equal(data.mechanism, 'open-rim-tappet-stud-index');
  assert.equal(data.geometry.studCount, 10);
  assert.equal(Object.keys(data.parts).length, 18);
  assert.equal(data.parts.driverCover.parent, data.blocks.input);
  assert.equal(data.parts.outputPlate.parent, data.blocks.output);
  assert.equal(data.sectionView, false);
  assert.equal(data.hideGround, true);
  assert.ok(data.animationTiming.displayCycleDuration >= 5 - 1e-8);
  disposeModel(model.root);
});`);
const catalog=JSON.parse(await readFile('src/data/movements.json','utf8'));
catalog.movements[69].mechanicalNote='The tappet advances one of ten studs per turn. The outer rim locks the wheel between steps. Section view reveals the hidden contacts. Motion assumes a resisting load, bearing resistance during a short pause and idealized engagement impacts.';
await writeFile('src/simulation/authored-intermittent.js',source);await writeFile('tests/models.test.mjs',tests);
await writeFile('src/data/movements.json',JSON.stringify(catalog,null,2)+'\n');
for(const frame of originalRecord.baselineCaptures){await unlink(directory+frame.file);frame.file=frame.file.replace('070-phase-','070-original-phase-');}
originalRecord.status='integrated-validation-in-progress';originalRecord.productionChanged=true;
originalRecord.remaining=['Focused and complete numerical/build/browser verification, integrated equivalence, source and UI capture inspection.'];
await writeFile(directory+'070-reconstruction.json',JSON.stringify(originalRecord,null,2)+'\n');
console.log({integrated:true,baselineFramesPreserved:originalRecord.baselineCaptures.length,previousCheckpointVerified:true});
