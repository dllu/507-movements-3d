import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const base='artifacts/review/',hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),
 checkpoint=JSON.parse(fs.readFileSync(base+'080-loaded-study-checkpoint.json')),
 previous=JSON.parse(fs.readFileSync(base+'080-geometry-study-documentation.json')),
 documents=[base+'080-reconstruction-notes.md','docs/review-progress.md',base+'index.html'];
assert(checkpoint.candidateReadyForIntegration);assert.equal(checkpoint.productionChanged,false);
for(const r of previous.files)assert.equal(hash(r.file),r.sha256,r.file);
const prior=documents.map((file,i)=>{const archive=base+'080-loaded-prior-document-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);return{file,archive,sha256:hash(archive)};});
const oldNotes=fs.readFileSync(documents[0],'utf8'),sourceStart=oldNotes.indexOf('The [official source]'),sourceEnd=oldNotes.indexOf('The [revised source-pose screen]');
assert(sourceStart>0&&sourceEnd>sourceStart);
fs.writeFileSync(documents[0],`# Movement 080 reconstruction review

The isolated replacement now passes its loaded mechanics checks and is ready for integration. Production movement 080 is still the original unverified model. See the [loaded-study checkpoint](080-loaded-study-checkpoint.json). Movement 079 remains verified; the full 507-movement review remains active.

${oldNotes.slice(sourceStart,sourceEnd)}The lever alone is prescribed. Rack height and both pawl angles follow gravity, moving-pivot inertia and finite unilateral contact. The rack has an ideal prismatic constraint imposing the source-described straight path; the drawn shaft and slot alone are not claimed to implement a complete physical linear guide. No extra guide is rendered. Common density, viscous drag, frictionless contact, zero extra payload, a 0.16-radian lever amplitude and an eight-second physical input period are reconstruction assumptions. The finite rack keeps its whole-body translation.

The [selected dynamics](080-fixed-normal-finest-dynamics.json) contain 80,001 states over 20 physical seconds at a 0.00025-second step, with no solver failures and at most four nonlinear iterations. The input holds at a zero-speed reversal at 18 seconds. The raised bar is supported through the final two seconds. Final lift is ${checkpoint.dynamics.finalPitches.toFixed(9)} pitches; the 8–16-second operating cycle advances ${checkpoint.dynamics.operatingCyclePitches.toFixed(9)} pitches. Cumulative downward motion during that cycle is ${checkpoint.dynamics.operatingRollbackPitches.toFixed(9)} pitches. Startup seating and this physical handoff rollback are retained; the motion is not presented as monotone or as an exact integer-pitch advance of the slightly tapered drawing.

The [force and contact formulas](080-fixed-normal-formulas.json) pass 240 independent Lagrangian force checks, 597 free-coordinate gap derivatives and 199 input-velocity derivatives, with no skipped feature switches. The [energy audit](080-fixed-normal-energy.json) independently checks kinetic energy, gravity potential and prescribed-angle momentum against actual-mesh tetrahedral quadrature at 31 states. Its corrected discrete energy defect halves with the time step and finishes at 0.009373% of work plus dissipation; the maximum momentum residual is below 9.15e-11. Input work, drag, velocity-change loss and endpoint contact work are included. This checks discrete consistency for the rack and free pawls, rather than claiming energy conservation through impacts or including the prescribed lever's own energy.

All [228,333 positive contact reactions](080-fixed-normal-reactions.json) pass actual rendered boundary, outward normal-cone and moment-arm checks. The [continuous primary certificate](080-fixed-normal-primary-bounds.json) covers both hook/rack pairs, every one of the 80,000 raw intervals and 80,066 proof intervals within 1e-6. It uses the actual Float32 cap triangles, including the rack slot, with checked cap/side incidence and orientation. The [other 79 pairs](080-fixed-normal-secondary-bounds.json) pass invariant depth, complete convex-hull, coaxial bore or convex-slot bounds; their smallest certified clearance is 0.004999995 units. The [loaded surface screen](080-fixed-normal-finest-surfaces-geometry.json) adds 3,270,960 actual surface samples at 101 poses across all 81 independent pairs, with zero intrusion and sixteen closed oriented solids.

The final [time-step comparison](080-fixed-normal-refinement.json) differs by at most 0.236842913 source pixels. The [prepared finite playback](080-framed-finite-playback-preparation.json) retains 3,901 exact original knots and adds at most 0.000999786 pixels of compression error. All 3,900 resulting segments pass continuous primary clearance through 6,008 proof intervals; their coordinate ranges remain within the already certified secondary bounds. The combined observed agreement and compression bound is 0.237842698 pixels, below the quarter-pixel criterion. It is not a formal bound on the unknown continuum solution.

The [sampler and framing audit](080-playback-sampler.json) checks 160,001 original-knot/midpoint samples, finite end clamping and continuity at input cycle seams. It checks 12,420,576 actual vertex positions in the prepared motion envelope and fits that continuous envelope through the real engine camera method in nine desktop/mobile views. A four-second displayed input cycle and ten-second finite demonstration are prepared. App completion and an explicit Replay action are still to be integrated and tested.

Twenty-four loaded-study stills are inspected, including twelve exploratory views and twelve fresh views of the selected finest trajectory. The [start](080-fixed-normal-finest-motion-0.png), [raised final pose](080-fixed-normal-finest-motion-20.png), [oblique view](080-fixed-normal-finest-oblique.png) and [rear view](080-fixed-normal-finest-rear.png) preserve the complete mechanism, pawl crossing order and readable axial layers without fog, ground or scene clipping. These bring the inspected candidate total to forty stills, including the sixteen earlier geometry views. No video has been recorded or watched. Final app playback and controls remain pending.

Earlier failures remain preserved. The [original baseline](080-baseline-checkpoint.json) has 232,128 sampled penetrations and whole-rack pitch jumps. The first full-depth hook webs intrude at 91 source-pose samples. The [first contact-law failure](080-corner-diagnostic.json) is reproduced at a convex rack tip in a concave hook corner, then resolved by its two real facets. The first coarse time-step comparison differs by 6.417 source pixels during startup. The [first energy audit](080-first-energy.json) flags reconstructed momentum residuals; [exact replay](080-finest-momentum-replay.json) identifies direction roundoff when a normal is computed from an almost-zero gap. Using the fixed interior-face normal resolves that issue without changing geometry, loads or tolerances. A serialization-only assertion failure in the first replay runner and an overly conservative initial camera bound are also retained in the checkpoint. The earlier static-study note is preserved in [its exact archive](080-loaded-prior-document-0.txt).

All 835 previously verified production inputs remain unchanged. Next: integrate the qualified geometry and finite sampler, add completion and Replay behavior, measure final display timing, inspect desktop/mobile app playback, verify production parity, and run the full numerical/browser regression. Movement 080 will only be marked verified after that work passes.
`);
let progress=fs.readFileSync(documents[1],'utf8');const start=progress.indexOf('Review continues at 080.'),end=progress.indexOf('**037, 063, 071 and 073',start);assert(start>=0&&end>start);
progress=progress.slice(0,start)+`Review continues at 080. Its isolated replacement is now qualified under
load and ready for integration. The sixteen-solid source reconstruction has
a finite closed slot, sixteen teeth per side, a tapered lever and long crossed
hooked pawls. Gravity and finite tooth contact determine rack lift and pawl
return. An ideal prismatic rack constraint implements the source-described
straight path; no additional guide is rendered.

The final 20-second physical run has no solver failures. All 228,333 positive
reactions and all 81 independent part pairs pass their contact and continuous
clearance checks. An additional 3,270,960 actual surface samples at 101 poses
have zero intrusion. The energy audit passes, and time-step agreement plus
playback compression totals 0.237842698 source pixels. The prepared ten-second
demonstration retains startup seating, handoff rollback and whole-rack lift,
then holds its raised final pose. Forty candidate stills are inspected.

Production 080 remains unchanged and unverified. Finite app completion,
explicit Replay, final display timing, production parity and full regression
remain pending. All 835 verified inputs still match. Earlier geometry,
contact, coarse-refinement and diagnostic failures remain archived. See
\`080-loaded-study-checkpoint.json\` and \`080-reconstruction-notes.md\`.

`+progress.slice(end);fs.writeFileSync(documents[1],progress);
const cards=[['080-fixed-normal-finest-motion-0.png','080 loaded candidate · mechanics qualified; app integration pending'],
 ['080-fixed-normal-finest-motion-20.png','080 finite lift · raised final pose; no rack wrap'],
 ['080-fixed-normal-finest-oblique.png','080 loaded candidate · separated crossed pawls and hook webs'],
 ['080-fixed-normal-finest-rear.png','080 loaded candidate · complete rear geometry']];
let gallery=fs.readFileSync(documents[2],'utf8');
gallery=gallery.replace('079 is rebuilt and verified. Review continues at 080.','079 is rebuilt and verified. Movement 080 is qualified in isolation; app integration and final playback review remain pending.');
gallery=gallery.replace('<div class="grid">','<div class="grid">\n'+cards.map(([file,label])=>{
 assert(fs.existsSync(base+file));return`<a href="${file}"><img src="${file}" loading="lazy" alt="${label}"><span>${label}</span></a>`;
}).join('\n'));fs.writeFileSync(documents[2],gallery);
const script='scripts/document-crossed-rack-loaded-study.mjs',archive=base+'080-loaded-documentation-source.txt';fs.copyFileSync(script,archive,fs.constants.COPYFILE_EXCL);
fs.writeFileSync(base+'080-loaded-study-documentation.json',JSON.stringify({movement:80,created:new Date().toISOString(),
 status:'isolated-loaded-study-documentation-current',productionChanged:false,mechanicsPassed:false,candidateMechanicsPassed:true,
 checkpoint:{file:base+'080-loaded-study-checkpoint.json',sha256:hash(base+'080-loaded-study-checkpoint.json')},prior,
 files:documents.map(file=>({file,sha256:hash(file)})),source:{file:script,archive,sha256:hash(script)},full507GoalStillActive:true},null,2)+'\n',{flag:'wx'});
console.log({documents:documents.length,priorDocumentsPreserved:prior.length,galleryCards:cards.length,productionChanged:false});
