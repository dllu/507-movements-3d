import fs from 'node:fs';
import crypto from 'node:crypto';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),read=name=>JSON.parse(fs.readFileSync('artifacts/review/'+name+'.json')),
 freeze=read('078-verification-source-hashes'),changed=Object.entries(freeze).filter(([file,sha])=>hash(fs.readFileSync(file))!==sha);
if(changed.length)throw Error('Verified production inputs changed: '+changed.map(([f])=>f).join(', '));
const prior=read('079-finite-study-checkpoint');
for(const item of [...prior.reports,...prior.archives,...prior.sources.map(s=>({file:s.archive,sha256:s.sha256}))])if(hash(fs.readFileSync(item.file))!==item.sha256)throw Error('Earlier evidence changed: '+item.file);
const selected=read('079-load6-finer'),refinement=read('079-load6-refinement'),secondary=read('079-finer-secondary-bounds'),formulas=read('079-bound-formulas'),
 optimization=read('079-bound-optimization'),initial=read('079-load6-finest-initial'),initialBounds=read('079-finest-initial-primary-bounds'),initialFast=read('079-finest-initial-primary-fast'),
 initialRefinement=read('079-finest-initial-refinement'),energyFormulas=read('079-energy-formulas');
if(selected.failures.length||initial.failures.length||![refinement,secondary,formulas,optimization,initialRefinement,energyFormulas].every(r=>r.passed))throw Error('Required study check failed');
if(initialBounds.passed!==initialFast.passed)throw Error('Full initial bound implementations disagree');
const views=[];
for(const prefix of ['079-finer-preview','079-finer-preview-sized']){
 const manifest=read(prefix+'-captures');for(const capture of manifest.captures){
  if(hash(fs.readFileSync(capture.file))!==capture.sha256)throw Error('Capture changed: '+capture.file);
  views.push({...capture,inspected:true,accepted:prefix.endsWith('-sized'),qualification:prefix.endsWith('-sized')?
   'Viewed: visible mechanism/source and readable contact detail; the provisional trajectory is not accepted for final playback.':
   'Viewed and rejected: missing canvas CSS caused intrinsic-size growth and blank or clipped scenes.'});
 }
}
const energyNames=['079-load6-coarse-energy16','079-load6-fine-energy16','079-load6-finer-energy16'],energy=energyNames.map(name=>({file:name+'.json',...read(name).summary})),
 loads=['079-load6-energy','079-load5-response-energy','079-load7-response-energy'].map(name=>({file:name+'.json',summary:read(name).summary})),
 rejected=['079-coarse-primary-bounds','079-fine-primary-bounds','079-finer-primary-bounds'].map(name=>({file:name+'.json',...read(name)}));
if(rejected.some(r=>r.passed))throw Error('Historical rejected paths unexpectedly passed');
const sourceFiles=fs.readdirSync('scripts').filter(n=>n.includes('opposed-arm')&&n.endsWith('.mjs')).map(n=>'scripts/'+n)
 .concat(fs.readdirSync('scripts/lib').filter(n=>n.includes('opposed-arm')&&n.endsWith('.mjs')).map(n=>'scripts/lib/'+n)),sources=[];
for(const file of sourceFiles){const bytes=fs.readFileSync(file),archive=`artifacts/review/079-loaded-study-source-${sources.length}.txt`;fs.writeFileSync(archive,bytes,{flag:'wx'});sources.push({file,archive,sha256:hash(bytes)});}
const files=fs.readdirSync('artifacts/review').filter(n=>n.startsWith('079-')).map(n=>'artifacts/review/'+n),
 reports=files.filter(f=>f.endsWith('.json')).map(file=>({file,sha256:hash(fs.readFileSync(file))})),
 archives=files.filter(f=>f.endsWith('.txt')||f.endsWith('.mjs')).map(file=>({file,sha256:hash(fs.readFileSync(file))})),
 checkpoint={movement:79,status:'isolated-loaded-face-ratchet-study',created:new Date().toISOString(),productionChanged:false,mechanicsPassed:false,
  prior:'079-finite-study-checkpoint.json',priorVerified:'078-integrated-checkpoint.json',frozenInputsMatched:Object.keys(freeze).length,
  operation:{selectedOutputResistance:6,physicsPeriod:8,displayPeriod:4,loads,
   lowerResistanceContinuation:read('079-load2-continuation-energy').summary,
   finding:'Resistance 6 produces continuous settled rotation with both pawls driving their respective half strokes and four output teeth per input cycle. Nearby resistances 5 and 7 preserve sustained rotation. Resistance 2 settles into a two-input-cycle pattern with substantial coasting.'},
  refinement:{fullSixteenSecondComparisons:refinement.comparisons,initialTwoSecondFinestComparison:initialRefinement.comparisons.at(-1)},
  energy:{formulaCheck:energyFormulas.maxima??energyFormulas,comparisons:energy,
   interpretation:'Input work includes prescribed-arm inertia, gravity and contact reactions. Inelastic contact and implicit-step velocity losses explain the large negative raw energy residual. The remaining absolute accounted residual halves through dt=.002, .001 and .0005. No formal continuum energy bound is claimed.'},
  continuousClearance:{tolerance:1e-6,secondary:{passed:secondary.passed,intervals:secondary.intervals,classification:secondary.classification,
    minimumGap:Math.min(...secondary.pairs.filter(p=>p.kind!=='primary-contact').map(p=>p.minimum)),source:'079-finer-secondary-bounds.json'},
   formulas:{passed:formulas.passed,vertexChecks:formulas.vertexChecks,boreChecks:formulas.boreChecks,maxima:formulas.maxima},
   optimization:{passed:optimization.passed,cases:optimization.cases.length,source:'079-bound-optimization.json'},
   rejected:rejected.map(r=>({file:r.file,dt:r.dt,intervalsPassed:r.totals.intervals,failure:r.failures[0]})),
   finerQualification:'The .0005 interpolation fails the all-pitch-orientations clearance margin at t=.83475: nominal SAT gap -9.5186258e-7, while the effective tolerance after Float32 pitch-symmetry allowance is 9.30697435e-7. The two coarser paths have penetration beyond 1e-6; the coarse witness is independently confirmed on the actual mesh.',
   finestInitial:{duration:initial.duration,dt:initial.dt,states:initial.rows.length,passed:initialBounds.passed,original:initialBounds.totals,optimized:initialFast.totals,
    qualification:'Only the initial two physical seconds have been simulated and checked at .00025. This does not qualify the whole playback.'}},
  preview:{html:'079-finer-preview-sized.html',views,timing:read('079-finer-preview-sized-captures').timing,
   qualification:'Eight corrected stills are inspected. Timed playback is measured, but no video was recorded or watched. The provisional .0005 path is still rejected for final playback.'},
  remaining:['Continue the .00025 dynamics from t=2 to t=16 and assess the complete refined trajectory',
   'Create compact startup and repeating playback with four-pitch closure; bound both contact pairs and all hardware on the actual final interpolation',
   'Check every final positive impulse against actual triangle boundaries and normal cones, and complete the independent surface screen',
   'Finish hidden spring/journal interpretation and final visual review; integrate only after qualification and run focused/full/build/browser checks'],
  reports,archives,sources,full507GoalStillActive:true};
fs.writeFileSync('artifacts/review/079-loaded-study-checkpoint.json',JSON.stringify(checkpoint,null,2)+'\n',{flag:'wx'});
console.log({status:checkpoint.status,frozenInputs:checkpoint.frozenInputsMatched,reports:reports.length,archives:archives.length,currentSources:sources.length,views:views.length,initialPrimaryPassed:initialBounds.passed});
