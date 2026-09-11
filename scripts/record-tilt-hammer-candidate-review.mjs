import{readFile,writeFile,readdir}from'node:fs/promises';
import{createHash}from'node:crypto';
import{makeTiltHammerCandidate}from'./lib/tilt-hammer-candidate.mjs';
const directory='artifacts/review/',json=async name=>JSON.parse(await readFile(directory+name,'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const snapshot=await json('070-verification-source-hashes.json'),mismatches=[];
for(const[file,expected]of Object.entries(snapshot))if(hash(await readFile(file))!==expected)mismatches.push(file);
if(mismatches.length)throw new Error('Production verification snapshot changed: '+mismatches.join(', '));
const baseline=await json('072-working-surface-baseline.json'),hardware=await json('072-candidate-hardware.json');
const solids=await json('072-candidate-solids.json'),forces=await json('072-final-candidate-contact-forces.json');
const energy=await json('072-refined-energy.json'),fit=await json('072-candidate-source-fit.json');
if(hardware.inside||solids.issues.length||forces.failed.length||energy.failures.length)throw new Error('Candidate audit failed');
const captureRecord=await json('072-candidate-captures.json');
for(const capture of captureRecord.captures){
  if(hash(await readFile(capture.file))!==capture.sha256)throw new Error('Changed capture '+capture.file);
  capture.inspected=true;
}
captureRecord.qualification='All nine frames were inspected. Subsequent refinements affect repeated-cycle pickup classification and force differentiation at the flank/tip join; they do not change the first-cycle capture poses or mesh geometry.';
await writeFile(directory+'072-candidate-captures.json',JSON.stringify(captureRecord,null,2)+'\n');
const inspection=[];
for(const file of ['072-phase-0.png','072-phase-0_075.png','072-phase-0_112.png','072-phase-0_145.png',
  '072-phase-0_38.png','072-phase-0_49.png','072-phase-0_6.png','072-phase-0_74.png',
  '072-source-flank-readings.png','072-candidate-source-overlay.png'])
  inspection.push({file,sha256:hash(await readFile(directory+file)),inspected:true});
const model=makeTiltHammerCandidate(),{parts,families,motion}=model.root.userData;
const meshes=Object.entries(parts).map(([name,mesh])=>({name,family:families[name],
  attributes:Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([key,attribute])=>[key,
    hash(Buffer.from(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength))])),
  index:mesh.geometry.index?hash(Buffer.from(mesh.geometry.index.array.buffer,mesh.geometry.index.array.byteOffset,mesh.geometry.index.array.byteLength)):null}));
const poses=captureRecord.captures.map(capture=>{
  model.update(capture.time);model.root.updateMatrixWorld(true);
  return{time:capture.time,q:motion.stateAtTime(capture.time).q,matrices:Object.fromEntries(Object.entries(parts).map(([name,mesh])=>[name,mesh.matrixWorld.toArray()]))};
});
const sourceFiles=(await readdir('scripts/lib')).filter(file=>file.startsWith('tilt-hammer-')).map(file=>'scripts/lib/'+file);
sourceFiles.push('scripts/lib/extruded-plate-contours.mjs');
const sources=Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[file,hash(await readFile(file))])));
await writeFile(directory+'072-candidate-checkpoint.json',JSON.stringify({movement:72,status:'isolated-candidate-checkpoint',productionChanged:false,
  sources,meshes,poses,parameters:motion.parameters,events:motion.events,mass:{...motion.mass,contours:undefined}},null,2)+'\n');
const exit=async prefix=>json(prefix+'-exit-status.json');
const record={movement:72,status:'isolated-candidate-audited-integration-pending',productionChanged:false,
  source:{page:'https://507movements.com/mm_072.html',animationAvailable:false,animationReviewed:false,
    originalStudy:'072-source-geometry-study.json',refinedFlank:'072-refined-source-flank.json',fit:'072-candidate-source-fit.json',points:fit.points,
    maximumErrorPixels:Math.max(...fit.groups.map(group=>group.maximumPixels)),widthPixels:1910,
    qualification:'Manual readings also guide reconstruction; the common actual-mesh overlay and visible source inspection assess the fit. No exact superposition is claimed.'},
  archives:'072-baseline-archives.json',baseline:{report:'072-working-surface-baseline.json',exit:await exit('072-working-surface-baseline'),
    poses:baseline.poses,checks:baseline.checks,inside:baseline.inside,failures:baseline.pairs.filter(pair=>pair.inside),timing:baseline.timing},
  hardware:{report:'072-candidate-hardware.json',exit:await exit('072-candidate-hardware'),poses:hardware.poses,pairs:hardware.pairs.length,checks:hardware.checks,inside:0},
  solids:{report:'072-candidate-solids.json',exit:await exit('072-candidate-solids'),count:solids.rows.length,triangles:solids.rows.reduce((sum,row)=>sum+row.triangles,0)},
  forces:{report:'072-final-candidate-contact-forces.json',exit:await exit('072-final-candidate-contact-forces'),poses:forces.poses,failed:0},
  energy:{report:'072-refined-energy.json',exit:await exit('072-refined-energy'),massErrors:energy.massErrors,cycleResidual:energy.cycleEnergyResidual},
  inspection,candidateCaptures:'072-candidate-captures.json',captureExit:await exit('072-candidate-capture-rerun'),
  checkpoint:'072-candidate-checkpoint.json',verifiedProductionFiles:Object.keys(snapshot).length,
  preservedFailures:[
    {report:'072-gravity-contact-trials.log',reason:'The initial release search stopped before reaching the lobe tip; the scan interval was extended.'},
    {report:'072-candidate-capture.log',reason:'The browser execution context was destroyed by navigation during the first capture attempt. The subsequent invocation completed.'},
    {report:'072-candidate-contact-forces.json',reason:'Two repeated-cycle pickup instants were classified as dwell due to floating-point time subtraction. Exact event snapping resolved them.'},
    {report:'072-candidate-energy.json',reason:'Central force differentiation averaged across the flank/tip curvature change. Derivatives from the active surface resolve the energy integration residual.'}],
  remaining:['Export browser runtime geometry and motion without polygon union or startup integration; prove equivalence to this audited candidate.',
    'Integrate movement 072, migrate its tests and dependent movement-353 comparisons, then run focused tests, full numerical tests, build and browser regression.',
    'Inspect integrated playback, desktop/mobile controls and source view. Movement 072 is not yet production-verified.']};
await writeFile(directory+'072-reconstruction.json',JSON.stringify(record,null,2)+'\n');
const existing=await readFile(directory+'index.html','utf8'),marker='<div class="grid">';
if(!existing.includes(marker))throw new Error('Missing gallery marker');
const files=(await readdir(directory)).filter(file=>/^(?:\d{3}-(?:crossed-)?(?:full-)?phase-[\d_]+|070-integrated-(?:source|section|oblique|rear|entry|first-corner|tip-side|release|rim-entry|locked)|072-candidate-(?:source|oblique|rear|pickup|lifting|release|fall|landing|dwell))\.png$/.test(file)).sort();
await writeFile(directory+'index.html',existing.slice(0,existing.indexOf(marker)+marker.length)+'\n'+files.map(file=>`<a href="${file}"><img src="${file}" loading="lazy" alt="${file}"><span>${file}</span></a>`).join('\n')+'\n</div></html>\n');
console.log({status:record.status,productionChanged:false,verifiedProductionFiles:record.verifiedProductionFiles,candidateFrames:captureRecord.captures.length,comparisons:files.length});
