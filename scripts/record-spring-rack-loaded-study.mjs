import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const base='artifacts/review/',hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
 read=name=>JSON.parse(fs.readFileSync(base+name+'.json')),frozen=read('080-verification-source-hashes'),
 sources=[],views=[...read('081-candidate-inspections').views],previewReports=['081-indexed-playback','081-seamed-playback-preview'];
for(const [file,expected]of Object.entries(frozen))assert.equal(hash(file),expected,file);
for(const name of previewReports){const report=read(name);assert.equal(report.errors.length,0);
 for(const view of report.views){assert.equal(hash(view.file),view.sha256);views.push({...view,inspected:true,visualAccepted:name.includes('seamed'),
  qualification:name.includes('seamed')?'Individually opened and inspected. Source, entry, lift, release, compressed coil, return, dwell and both repeat poses remain fully framed with no visible interpart clipping. Four-second cycle timing and browser update performance are accepted for the isolated preview; full mechanics remain pending.':
   'Individually opened and inspected. Geometry and framing are readable, but this preview uses the preserved first playback table whose strict loop-seam check failed. Superseded by the seamed preview.'});}
}
fs.writeFileSync(base+'081-loaded-study-inspections.json',JSON.stringify({movement:81,productionChanged:false,mechanicsPassed:false,views,
 inspected:views.length,accepted:views.filter(v=>v.visualAccepted).length},null,2)+'\n',{flag:'wx'});
for(const name of ['081-finer-reactions','081-first-dynamics-assessment','081-refined-hardware-bounds','081-indexed-coil-check','081-contact-representation','081-seamed-playback'])
 assert.equal(read(name).passed,true,name);
assert.equal(read('081-indexed-loaded-geometry').geometryPassed,true);
const priorDocuments=[],docs=read('080-integrated-documentation'),baseline=read('081-baseline-checkpoint');
for(const [index,file]of ['artifacts/review/081-reconstruction-notes.md','docs/review-progress.md','artifacts/review/index.html'].entries()){
 const expected=(index===0?baseline.files:docs.files).find(r=>r.file===file);assert.equal(hash(file),expected.sha256,file);
 const archive=base+'081-loaded-study-prior-document-'+index+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);
 priorDocuments.push({file,archive,sha256:expected.sha256});
}
const studyFiles=[...fs.readdirSync('scripts').filter(n=>n.includes('spring-rack')&&n.endsWith('.mjs')).map(n=>'scripts/'+n),
 ...fs.readdirSync('scripts/lib').filter(n=>n.startsWith('spring-rack-')&&n.endsWith('.mjs')).map(n=>'scripts/lib/'+n)];
for(const file of studyFiles){const archive=base+'081-loaded-study-source-'+sources.length+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);sources.push({file,archive,sha256:hash(file)});}
const artifacts=fs.readdirSync(base).filter(n=>n.startsWith('081-')&&/\.(json|txt|log|png|svg)$/.test(n)&&!n.includes('loaded-study-command'))
 .map(n=>({file:base+n,sha256:hash(base+n)})),reports=artifacts.filter(r=>r.file.endsWith('.json')),
 archiveSources=new Map();
for(const item of reports){const r=JSON.parse(fs.readFileSync(item.file));
 for(const s of [...(r.sources??[]),...(r.source?[r.source]:[])])if(s.archive&&s.sha256){assert.equal(hash(s.archive),s.sha256,s.archive);archiveSources.set(s.archive,s.sha256);}
}
const surface=read('081-indexed-loaded-geometry'),dynamics=read('081-interval-finer-dynamics'),refinement=read('081-first-dynamics-assessment'),
 reactions=read('081-finer-reactions'),bounds=read('081-refined-hardware-bounds'),playback=read('081-seamed-playback'),browser=read('081-seamed-playback-preview'),
 report={movement:81,status:'isolated-loaded-reconstruction-in-progress',created:new Date().toISOString(),productionChanged:false,mechanicsPassed:false,
 frozenInputsMatched:Object.keys(frozen).length,geometry:dynamics.geometry,parameters:dynamics.parameters,
 summary:{closedSolids:surface.topology.length,independentPairs:surface.pairs.length,surfacePoses:surface.poses,surfaceSamples:surface.checks,
  surfaceIntrusions:surface.penetrations,dynamicStates:dynamics.rows.length,dynamicStep:dynamics.dt,positiveReactions:reactions.checked,
  latestRackRefinementPixels:refinement.comparisons.at(-1).maximum.pixels,hardwarePairsBounded:bounds.bounds.length,
  minimumMandrelEngagementPixels:bounds.minimumMandrelEngagementPixels,playbackKnots:playback.knots,
  sampledCombinedPlaybackErrorPixels:playback.maximum.combinedPixels,displayPeriod:4,previewFps:browser.summary.fps,
  candidateViewsInspected:views.length,candidateViewsAccepted:views.filter(v=>v.visualAccepted).length},
 priorDocuments,sources,reports,artifacts,archivedSourceHashesChecked:archiveSources.size,views,
 remaining:['Complete continuous bounds for neighboring coil mesh cells, including local folding; current coil bounds cover cells more than half a turn apart.',
  'Bound the playback contact correction over complete time intervals and combine rack time-step agreement with compression and deformed spring-vertex displacement.',
  'Preserve this isolated evidence, then integrate 081, verify exact candidate/production geometry and motion parity, run focused and full numerical/build/browser checks, and inspect final app views.',
  'Continue reviewing the remaining movements. 037, 063, 071 and 073 remain unresolved; 081 is not yet verified.'],
 full507GoalStillActive:true};
fs.writeFileSync(base+'081-loaded-study-checkpoint.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({status:report.status,summary:report.summary,frozen:report.frozenInputsMatched,reports:reports.length,artifacts:artifacts.length,sources:sources.length,
 archivedSourceHashesChecked:archiveSources.size,productionChanged:false,mechanicsPassed:false});
