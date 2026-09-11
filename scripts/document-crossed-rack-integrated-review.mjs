import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const base='artifacts/review/',hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
 checkpoint=JSON.parse(fs.readFileSync(base+'080-integrated-checkpoint.json')),
 priorReport=JSON.parse(fs.readFileSync(base+'080-loaded-study-documentation.json')),
 documents=[base+'080-reconstruction-notes.md','docs/review-progress.md',base+'index.html'];
assert.equal(checkpoint.mechanicsPassed,true);assert.equal(checkpoint.regression.browser,36);
for(const item of priorReport.files)assert.equal(hash(item.file),item.sha256,item.file);
const prior=documents.map((file,i)=>{const archive=base+'080-integrated-prior-document-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);return{file,archive,sha256:hash(archive)};});
let notes=fs.readFileSync(documents[0],'utf8');
notes=notes.replace('The isolated replacement now passes its loaded mechanics checks and is ready for integration. Production movement 080 is still the original unverified model. See the [loaded-study checkpoint](080-loaded-study-checkpoint.json). Movement 079 remains verified; the full 507-movement review remains active.',
 'Movement 080 is rebuilt and verified. The [integrated checkpoint](080-integrated-checkpoint.json) records the final production sources, validation and inspected images. Its ten-second demonstration raises the complete rack, holds the final supported pose and offers Replay. The full 507-movement review remains active.');
notes=notes.replace('A four-second displayed input cycle and ten-second finite demonstration are prepared. App completion and an explicit Replay action are still to be integrated and tested.',
 'A four-second displayed input cycle and ten-second finite demonstration are integrated. The input stops at nine display seconds; the engine stops at ten seconds and holds the raised pose. Replay restarts the demonstration while preserving the camera. Pause and Reset view retain their expected behavior.');
notes=notes.replace('No video has been recorded or watched. Final app playback and controls remain pending.',
 'Seventeen additional final integrated stills are inspected and accepted, including the [source overlay](080-integrated-final-source-overlay.png), [oblique view](080-integrated-final-oblique.png), [raised desktop pose](080-integrated-final-desktop-raised.png) and [mobile Replay](080-integrated-final-mobile-replay.png). No video has been recorded or watched.');
const production=`[Production parity](080-production-parity.json) is exact for all sixteen parts, all 48 rendered buffers, the complete 3,901-knot profile and 11,810 deterministic pose matrices. Full geometry and sampler source substitutions also match. This transfers the qualified candidate's continuous clearance evidence to production. Eight new focused tests additionally check actual solids, bores, finite translation, both loaded hook contacts and fifteen surface poses; six engine tests also pass. All **3,094 numerical tests**, the production build and all **36 browser checks** pass against **850 frozen inputs**. All 507 entries render. The other 506 display profiles and 829 prior inputs outside the six planned changes remain unchanged. The build retains its existing large-bundle warning, with a main JavaScript bundle of about 21.45 MB before gzip.

The final app checks cover reduced-motion startup, play, pause, finite completion, stable final pose, Replay, Reset view and desktop/mobile framing. All fourteen automated checks pass. The seventeen final images are recorded in [integrated inspections](080-integrated-inspections.json). Fourteen earlier images from a failed capture attempt remain preserved without a separate inspection claim. Eighteen historical browser screenshots were restored after the fresh regression captures were archived.

`;
assert(notes.includes('Earlier failures remain preserved.'));notes=notes.replace('Earlier failures remain preserved.',production+'Earlier failures remain preserved.');
const oldEnd='All 835 previously verified production inputs remain unchanged. Next: integrate the qualified geometry and finite sampler, add completion and Replay behavior, measure final display timing, inspect desktop/mobile app playback, verify production parity, and run the full numerical/browser regression. Movement 080 will only be marked verified after that work passes.';
assert(notes.includes(oldEnd));notes=notes.replace(oldEnd,
 'The first focused test command failed two new assertions: one compared compressed playback with a raw cycle constant without accounting for its certified error; the other omitted the reverse rack-tip-to-hook support direction. The corrected tests pass without changing geometry, physics or collision tolerance. The first integrated capture stopped after fourteen images because its instrumentation imported a different Vite module URL. Resolving the actual loaded engine module fixed the harness; a fresh capture prefix preserved the failed attempt. The earlier loaded-study documents are preserved in [their exact archive](080-integrated-prior-document-0.txt). Review now continues at movement 081.');
fs.writeFileSync(documents[0],notes);
let progress=fs.readFileSync(documents[1],'utf8'),start=progress.indexOf('Review continues at 080.'),end=progress.indexOf('## Completion requirements',start);
assert(start>=0&&end>start);
const update=`080 is rebuilt and verified. Its sixteen closed solids follow the finite
slot, flared rack, sixteen teeth per side, tapered lever and long crossed
hooked pawls. Gravity, inertia and finite contact determine the rack and free
pawls. The ideal prismatic rack constraint, hidden axial relief, density and
drag are explicit reconstruction assumptions. Startup seating and handoff
rollback are retained. Each input cycle takes four display seconds; the
ten-second demonstration holds its raised final pose and offers Replay.

All 228,333 contact reactions pass boundary, normal and moment checks.
Continuous primary bounds cover every one of the 3,900 playback segments
through 6,008 proof intervals within 1e-6. The other 79 independent pairs
retain their complete layer, bore, slot and hull bounds. The loaded candidate
passes 3,270,960 actual surface samples at 101 poses. Time-step agreement plus
compression totals 0.237842698 source pixels; this is observed numerical
agreement, not an exact continuum-error guarantee. The energy audit passes.

Production matches all 48 buffers, the complete profile and 11,810 poses
exactly. Eight new focused tests, all 3,094 numerical tests, the build and all
36 browser checks pass against 850 frozen inputs. All 507 entries rendered.
Forty candidate and seventeen final integrated stills are inspected. Desktop
and mobile completion, pause, Replay and framing pass. Eighteen historical
browser images were restored after fresh copies were preserved. Earlier
mechanics failures and two corrected test/capture issues remain archived.
See \`080-integrated-checkpoint.json\` and \`080-reconstruction-notes.md\`.

Review continues at 081. Its original gear, rack and spring reconstruction
requires correction. A 135-pose selected surface screen finds 7,006 gear/rack
intrusions, 405 rack/guide intrusions and 1,681,473 spring/hardware intrusions.
The preset return curve does not solve the stated spring force. The enlarged
Brown source and nine baseline app views are inspected. Source dimensions and
the replacement's real involute tooth entry/release and spring dynamics remain
pending. Production 081 remains unchanged. See \`081-baseline-checkpoint.json\`
and \`081-reconstruction-notes.md\`.

**037, 063, 071 and 073 remain mechanically unresolved. 031, 064, 065, 066, 067,
068, 069, 070, 072, 074, 075, 076, 077, 078, 079 and 080 are verified. Review
continues at 081; the complete 507-movement review remains active.**

`;
fs.writeFileSync(documents[1],progress.slice(0,start)+update+progress.slice(end));
const cards=[
 ['080-integrated-final-source-aligned.png','080 verified reconstruction · source comparison'],
 ['080-integrated-final-source-overlay.png','080 verified reconstruction · engraving alignment'],
 ['080-integrated-final-oblique.png','080 verified reconstruction · crossed pawls and hook relief'],
 ['080-integrated-final-rear.png','080 verified reconstruction · complete rear geometry'],
 ['080-integrated-final-desktop-raised.png','080 verified reconstruction · supported final lift and Replay'],
 ['080-integrated-final-mobile-replay.png','080 verified reconstruction · mobile Replay'],
 ['081-baseline-source.png','081 original baseline · rejected proportions and contact'],
 ['081-baseline-oblique.png','081 original baseline · rack, spring and guide reconstruction pending']
];
for(const [file]of cards)assert(fs.existsSync(base+file),file);
let gallery=fs.readFileSync(documents[2],'utf8');
const oldIntro='079 is rebuilt and verified. Movement 080 is qualified in isolation; app integration and final playback review remain pending.';
assert(gallery.includes(oldIntro));gallery=gallery.replace(oldIntro,'080 is rebuilt and verified. Review continues at 081.')
 .replace('<div class="grid">','<div class="grid">\n'+cards.map(([file,label])=>`<a href="${file}"><img src="${file}" loading="lazy" alt="${label}"><span>${label}</span></a>`).join('\n'));
fs.writeFileSync(documents[2],gallery);
const files=documents.map(file=>({file,sha256:hash(file)}));for(const item of prior)assert.equal(hash(item.archive),item.sha256);
const sourceFile='scripts/document-crossed-rack-integrated-review.mjs',archive=base+'080-integrated-documentation-source.txt';
fs.copyFileSync(sourceFile,archive,fs.constants.COPYFILE_EXCL);
fs.writeFileSync(base+'080-integrated-documentation.json',JSON.stringify({movement:80,created:new Date().toISOString(),status:'verified-documentation-current',
 checkpoint:{file:base+'080-integrated-checkpoint.json',sha256:hash(base+'080-integrated-checkpoint.json')},prior,files,
 source:{file:sourceFile,archive,sha256:hash(sourceFile)},full507GoalStillActive:true},null,2)+'\n',{flag:'wx'});
console.log({documents:files.length,priorDocumentsPreserved:prior.length,galleryCards:cards.length,status:'080-verified-081-review-active'});
