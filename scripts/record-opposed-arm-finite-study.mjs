import fs from 'node:fs';
import crypto from 'node:crypto';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),json=file=>JSON.parse(fs.readFileSync(file)),
 files=fs.readdirSync('artifacts/review').filter(n=>n.startsWith('079-')).map(n=>'artifacts/review/'+n),
 freeze=json('artifacts/review/078-verification-source-hashes.json'),changed=Object.entries(freeze).filter(([file,sha])=>hash(fs.readFileSync(file))!==sha);
if(changed.length)throw Error('Previously verified inputs changed: '+changed.map(v=>v[0]).join(', '));
const d=json('artifacts/review/079-two-cycle-dynamics.json'),s=json('artifacts/review/079-two-cycle-surfaces.json'),n=json('artifacts/review/079-two-cycle-reactions.json'),
 topology=json('artifacts/review/079-smoothed-candidate-topology.json'),force=json('artifacts/review/079-force-formulas.json'),contact=json('artifacts/review/079-contact-formulas-float32.json'),
 source=json('artifacts/review/079-source-centerlines-refined.json'),pitch=2*Math.PI/33;
if(d.failures.length||s.issues.length||!n.passed||topology.issues.length||!force.passed||!contact.passed||!source.inspected||!source.adopted)throw Error('A required preliminary check did not pass');
const manifests=['079-first-candidate','079-smoothed-candidate','079-two-cycle-candidate','079-wide-reversal'].map(p=>json('artifacts/review/'+p+'-captures.json')),
 captures=manifests.flatMap(r=>r.captures);
for(const capture of captures)if(!capture.inspected||hash(fs.readFileSync(capture.file))!==capture.sha256)throw Error('Uninspected or altered capture '+capture.file);
let reverse=0,stopped=0;for(let i=1;i<d.rows.length;i++){reverse+=Math.max(0,d.rows[i].x[0]-d.rows[i-1].x[0])/pitch;if(Math.abs(d.rows[i].v[0])<1e-5)stopped++;}
const reports=files.filter(f=>f.endsWith('.json')).map(file=>({file,sha256:hash(fs.readFileSync(file))})),archives=files.filter(f=>f.endsWith('.txt')).map(file=>({file,sha256:hash(fs.readFileSync(file))})),
 sourceFiles=['scripts/record-opposed-arm-finite-study.mjs','scripts/record-opposed-arm-command.mjs','scripts/measure-opposed-arm-source.mjs','scripts/capture-opposed-arm-baseline.mjs',
 'scripts/capture-opposed-arm-candidate.mjs','scripts/probe-opposed-arm-baseline.mjs','scripts/probe-opposed-arm-topology.mjs','scripts/probe-opposed-arm-surfaces.mjs',
 'scripts/check-opposed-arm-forces.mjs','scripts/check-opposed-arm-contact.mjs','scripts/check-opposed-arm-reactions.mjs','scripts/study-opposed-arm-dynamics.mjs',
 'scripts/lib/opposed-arm-candidate.mjs','scripts/lib/opposed-arm-forces-study.mjs','scripts/lib/opposed-arm-contact-study.mjs'],sources=[];
for(const file of sourceFiles){const bytes=fs.readFileSync(file),archive=`artifacts/review/079-finite-study-source-${sources.length}.txt`;fs.writeFileSync(archive,bytes,{flag:'wx'});sources.push({file,archive,sha256:hash(bytes)});}
const checkpoint={movement:79,status:'isolated-finite-face-ratchet-study',created:new Date().toISOString(),productionChanged:false,mechanicsPassed:false,
 prior:'079-baseline-checkpoint.json',priorVerified:'078-integrated-checkpoint.json',frozenInputsMatched:Object.keys(freeze).length,
 source:{url:'https://507movements.com/mm_079.html',image:'artifacts/reference/brown-079-detail.png',outer:{center:source.traces.outer.center,radius:source.traces.outer.radius,rms:source.traces.outer.rms},
  inner:{center:source.traces.inner.center,radius:source.traces.inner.radius,rms:source.traces.inner.rms},divisionCount:33,visibleDivisions:31,inferredHiddenDivisions:[4,29],regularDivisionFit:source.fits.find(f=>f.teeth===33)},
 geometry:{solids:topology.rows.length,closedSolidsPassed:true,rodClosurePoses:topology.closurePoses,maximumClosure:topology.maximumClosure,
  interpretation:'Axial crown ratchet with a continuous annular face, measured radial-arm and slider joints, two finite pawls pivoted on concealed radial journals.',
  assumptions:['Concentric regular 33-tooth geometry','Axial thicknesses and concealed journal construction','Spring torque and preload; a detailed coil is not rendered','Common material density, bearing damping and bidirectional dry output resistance','Prescribed horizontal slider with no added visible base or guide']},
 dynamics:{duration:d.duration,dt:d.dt,states:d.rows.length,solverFailures:d.failures.length,teethClockwise:-d.rows.at(-1).x[0]/pitch,
  firstCycleTeeth:-d.rows[4000].x[0]/pitch,secondCycleTeeth:-(d.rows[8000].x[0]-d.rows[4000].x[0])/pitch,reverseTeeth:reverse,stoppedFraction:stopped/(d.rows.length-1),
  minimumGap:d.minimumGap,maximumIterations:d.maximumIterations,maximumResidual:d.maximumResidual,
  qualification:'Exploratory 16-second run with two 8-second input cycles. Substantial coasting occurs. This does not establish steady alternating drive, a periodic playback state, or numerical convergence.'},
 independentChecks:{massTensorErrors:topology.massErrors,forceErrors:force.maxima,contactDerivativeChecks:contact.checked,contactDerivativeMaximum:contact.maximumError,
  volumeErrors:contact.volumeErrors,surfacePoses:s.states.length,independentPairs:s.pairs.length,surfaceChecks:s.checks,surfacePenetrations:s.penetrations,
  positiveImpulsesChecked:n.checked,maximumContactSeparation:n.maximumSeparation,maximumBoundaryDistance:n.maximumBoundaryDistance,maximumNormalConeError:n.maximumConeError,maximumMomentArmError:n.maximumJacobianError},
 views:{baselineInspected:9,candidateInspected:captures.length,acceptedCurrentSource:'079-smoothed-candidate-source-aligned.png',
  initialShadingRejected:true,sourceCameraCroppedAt:[2,10],wideReplacements:['079-wide-reversal-cycle-2.png','079-wide-reversal-cycle-10.png'],captures},
 preservedFailures:['The original production model penetrates teeth and remains unchanged.','Unmasked outside-ink circle and first inner-circle selection rejected; exact readings retained.',
  'First surface runner failed to import the helper; corrected path and rerun passed.','First force checker archive collided with the wrapper archive; renamed archive prefix and rerun passed.',
  'First contact module had an incomplete cross-product expression; exact failing source retained.','First candidate showed fine ramp shading stripes; analytic surface normals corrected them.',
  'Source-aligned camera cropped the slider stub at maximum extension; wider reviewed captures replace those motion views.'],
 remaining:['Assess sustained alternating drive and settle output-load/stroke assumptions with longer runs and load variation','Refine time steps and assess energy balance using moving-input work',
  'Verify continuous finite clearance, including all bearings and full playback interpolation','Complete hidden spring and joint detail review and settle readable display speed',
  'Integrate only after qualification, then run focused tests, full numerical/build/browser regressions and inspect final product views'],
 reports,archives,sources,full507GoalStillActive:true};
fs.writeFileSync('artifacts/review/079-finite-study-checkpoint.json',JSON.stringify(checkpoint,null,2)+'\n',{flag:'wx'});
console.log({status:checkpoint.status,productionChanged:false,frozenInputs:Object.keys(freeze).length,reports:reports.length,archives:archives.length,sources:sources.length,captures:captures.length,states:d.rows.length,surfaceChecks:s.checks,positiveImpulses:n.checked});
