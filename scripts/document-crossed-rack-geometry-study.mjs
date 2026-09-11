import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const base='artifacts/review/',hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
 documents=[base+'080-reconstruction-notes.md','docs/review-progress.md',base+'index.html'],
 prior=documents.map((file,i)=>{const archive=base+'080-geometry-prior-document-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);return{file,archive,sha256:hash(archive)};});
const baseline=JSON.parse(fs.readFileSync(base+'080-baseline-checkpoint.json')),
 baselineNotes=baseline.files.find(r=>r.file===documents[0]);assert.equal(prior[0].sha256,baselineNotes.sha256);
const previousDocs=JSON.parse(fs.readFileSync(base+'079-integrated-documentation.json'));
for(const file of previousDocs.files){const archive=prior.find(r=>r.file===file.file)?.archive;assert.equal(hash(archive??file.file),file.sha256);}
fs.writeFileSync(documents[0],`# Movement 080 reconstruction review

The source geometry is rebuilt in an isolated candidate. Production movement 080 remains unchanged and mechanically unverified. See the [geometry-study checkpoint](080-geometry-study-checkpoint.json). Movement 079 is verified; the full 507-movement review remains active.

The [official source](https://507movements.com/mm_080.html) describes lever C and two hooked pawls imparting rectilinear motion to slotted rack A. The [Brown crop](../reference/brown-080-detail.png), from page 28 / printed page 24 at [410,2520,1320,1290], shows a finite closed slot, flared rack head, plain lower stem with a broken cut edge, tapered lever, rounded end weights and long crossed pawls. The right-pivot pawl passes in front at the crossing.

[Measured stroke fits](080-source-measurements.json) locate both weights, both pawl bores and the fulcrum. Their RMS residuals are 1.794, 2.017, 0.779, 0.427 and 1.325 pixels, respectively. The fulcrum uses the inner edge of its enclosed light opening because the surrounding ink joins the slot. Twenty-five visible or partly visible driving strokes support sixteen teeth per side and a shared pitch of 35.777482 pixels. Seven covered or ambiguous strokes are inferred and excluded from the fit. Separate left/right phases retain the small source asymmetry. Shared-pitch RMS residuals are 2.695 and 2.820 pixels. The regular capsule slot follows the side strokes within 4.75 pixels. The [annotated source](080-source-measurements.png) and [measurement inspections](080-source-inspections.json) record the adopted dimensions.

The candidate has sixteen closed, consistently oriented solids with real bores, separate pawl layers and hooked webs reaching back to the rack. Its [source overlay](080-relieved-candidate-source-overlay.png), [oblique view](080-relieved-candidate-oblique.png), [rear view](080-relieved-candidate-rear.png) and hook details are inspected. The first full-depth hook webs produced 91 sampled intrusions at the traced pose, reaching depth 0.026387683. That geometry and all eight images are preserved as rejected evidence. Concealed relief behind both visible toes removes those source-pose intrusions while leaving the other fourteen parts and their 28 position/normal buffers unchanged. The relief is an explicit reconstruction assumption, visible as a step when orbiting.

The [revised source-pose screen](080-relieved-candidate-geometry.json) checks all 81 independent pairs and 32,900 actual surface samples with zero intrusion beyond 1e-6. Both versions have closed oriented surfaces. Eight revised candidate images are accepted for continued study; sixteen candidate images in total are inspected. This evidence covers one prescribed pose only. It does not establish loaded contact, pawl return, operating travel or continuous clearance. No video has been recorded or watched.

The [original baseline](080-baseline-checkpoint.json) remains rejected: 193 poses and 720 pawl/rack pairs produced 232,128 intrusions from 2,101,460 surface samples, with maximum depth 0.0543770058. Its whole rack also jumps backward by one pitch at phase seams despite continuous physical displacement. All six original views are rejected. The earlier baseline note is preserved at [its exact archive](080-geometry-prior-document-0.txt).

The next work is to derive and verify finite hook/rack contact, gravity-driven pawl return and loaded bar travel, then check energy, refinement, reactions and continuous assembly clearance. Only the lever should be prescribed. The finite bar must retain its whole-body displacement; useful lift ends when the remaining teeth pass the hooks, before the slot reaches the fulcrum. Playback therefore needs a finite demonstration and an explicit replay action. Its exact duration and integration remain undecided. All 835 previously verified production inputs still match their hashes.
`);
let progress=fs.readFileSync(documents[1],'utf8');
const start=progress.indexOf('Review continues at 080.'),end=progress.indexOf('**037, 063, 071 and 073',start);assert.ok(start>=0&&end>start);
progress=progress.slice(0,start)+`Review continues at 080. Its original model is rejected for 232,128 sampled
pawl/rack intrusions and whole-rack jumps at phase seams. The replacement is
an isolated sixteen-solid geometry study: fitted weights and joint centers,
a finite closed slot, sixteen teeth per side, a tapered lever and long crossed
hooked pawls. Twenty-five measured tooth strokes give a shared pitch of
35.777482 source pixels; seven covered positions are inferred.

The initial full-depth hook webs intruded at 91 source-pose samples. Concealed
toe relief removes those intrusions while retaining all fourteen other
meshes. The revised source pose passes 32,900 samples across 81 independent
pairs. All sixteen surfaces are closed and oriented. Sixteen candidate images
are inspected, including eight rejected initial views and eight revised
views accepted for continued study. Loaded motion, finite travel, continuous
clearance and playback remain unverified. Production 080 is unchanged; all
835 verified inputs still match. See \`080-geometry-study-checkpoint.json\`
and \`080-reconstruction-notes.md\`.

`+progress.slice(end);fs.writeFileSync(documents[1],progress);
const cards=[['080-source-measurements.png','080 source measurements · sixteen teeth per side'],
 ['080-relieved-candidate-source-overlay.png','080 isolated candidate · source alignment; motion unverified'],
 ['080-relieved-candidate-oblique.png','080 isolated candidate · crossed pawls and concealed toe relief'],
 ['080-relieved-candidate-left-hook-detail.png','080 isolated candidate · source-pose clearance; loaded contact pending']];
let gallery=fs.readFileSync(documents[2],'utf8');
gallery=gallery.replace('<div class="grid">','<div class="grid">\n'+cards.map(([file,label])=>{
 assert.ok(fs.existsSync(base+file));return`<a href="${file}"><img src="${file}" loading="lazy" alt="${label}"><span>${label}</span></a>`;
}).join('\n'));fs.writeFileSync(documents[2],gallery);
const files=documents.map(file=>({file,sha256:hash(file)}));
fs.writeFileSync(base+'080-geometry-study-documentation.json',JSON.stringify({movement:80,created:new Date().toISOString(),
 status:'isolated-geometry-documentation-current',productionChanged:false,mechanicsPassed:false,
 checkpoint:{file:base+'080-geometry-study-checkpoint.json',sha256:hash(base+'080-geometry-study-checkpoint.json')},
 prior,files,source:{file:'scripts/document-crossed-rack-geometry-study.mjs',sha256:hash('scripts/document-crossed-rack-geometry-study.mjs')},
 full507GoalStillActive:true},null,2)+'\n',{flag:'wx'});
console.log({documents:files.length,priorDocumentsPreserved:prior.length,galleryCards:cards.length,productionChanged:false});
