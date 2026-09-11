import fs from 'node:fs';
import crypto from 'node:crypto';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),checkpointFile='artifacts/review/079-loaded-study-checkpoint.json',
 checkpoint=JSON.parse(fs.readFileSync(checkpointFile)),documents=['artifacts/review/079-reconstruction-notes.md','docs/review-progress.md','artifacts/review/index.html'],prior=[];
for(const file of documents){const bytes=fs.readFileSync(file),archive=`artifacts/review/079-loaded-study-prior-document-${prior.length}.txt`;fs.writeFileSync(archive,bytes,{flag:'wx'});prior.push({file,archive,sha256:hash(bytes)});}
const notes=`# Movement 079: loaded face-ratchet study

The latest record is \`079-loaded-study-checkpoint.json\`. Production 079 is
unchanged and all 823 previously verified inputs still match. This is an
isolated reconstruction; complete playback and integration remain unverified.
The prior baseline and finite-study checkpoints retain the earlier evidence.

The original model prescribes its wheel and pawl-return curves. Its baseline
screen found 15,970 penetrations among 903,458 surface checks, with maximum
depth 0.047999984 units. All nine baseline views are inspected and rejected.
The exact original factory, test, diagnostics and images remain archived.

The [official description](https://507movements.com/mm_079.html) identifies a
ratchet-faced wheel driven by pawls on two oscillating radial arms. Brown's
crop has continuous inner and outer rims, supporting an axial face ratchet.
The adopted outer stroke centerline has center [406.298146, 777.924924],
radius 400.226936 pixels and RMS residual 1.162981 pixels. The inner radius
is 338.900381 pixels, with RMS residual 1.865581 pixels. The model regularizes
the two fitted circles to a common center.

The inspected source plot identifies 31 visible divisions, including two
partial marks, and infers a hidden division behind each arm. The model uses
33 regular teeth. The ordered division fit has RMS error 22.337932 pixels
and maximum error 43.200517 pixels; the drawing's tooth spacing is irregular.
Five measured bore centers determine the linkage. Rejected earlier source
readings are retained, together with their exact measurement scripts.

The candidate contains 37 closed solids: one crowned wheel, bored arms and
rods, a slider stub, finite pawls and concealed radial journals. Both rods
retain fixed lengths and the source asymmetry. Closure errors stay below
1e-15 over 1,001 slider positions. Axial dimensions, concealed journals,
spring preload, density and output resistance are reconstruction assumptions.
Spring torque is modeled; a detailed coil is not rendered. The common wheel
axis and horizontal slider constraint are ideal supports without an added
visible base or guide.

The rendered meshes supply the inertia tensors. Independent tetrahedral
force calculations agree within 9.534e-10. The wheel is represented by 3,168
finite convex cells whose union matches its mesh volume; the upper and lower
pawls have two and eleven convex pieces. All 6,992 checked separation
derivatives pass, including derivatives of moving axes.

The input period is eight physical seconds and its half-stroke is 0.24 wheel
radii. The wheel rotation and both pawl lift angles are free coordinates,
driven by finite contact, gravity, inertia and spring preload. Spring
stiffnesses are 1 and 0.7, with rest angles of 0.65 radians. Neither the
output rotation nor the number of teeth advanced is prescribed.

The earlier resistance-2 study has been extended to forty seconds. It settles
into a sixteen-second pattern: alternate eight-second cycles advance about
3.721437 and 4.278563 teeth. Coasting sometimes bypasses an upper driving
stroke. Resistance 6 is the selected loaded study: it advances 3.685063 teeth
in the initial cycle and four teeth per settled cycle. Both pawls drive their
respective half strokes, and settled output speed stays clockwise, between
0.043147 and 0.141579 rad/s in the coarse run. Continuations at resistances
5 and 7 also maintain rotation; their final eight-second cycles advance four
teeth. These are normalized model loads, not measurements from the engraving.

Complete sixteen-second trajectories at dt=0.002, 0.001 and 0.0005 seconds
finish without solver failures. Successive full-trajectory differences are
bounded by 0.209598 and 0.183012 source pixels over every interpolation
interval. These measure observed numerical refinement, not exact continuum
error. Input work includes prescribed-arm inertia, gravity and contact
reactions. Independent kinetic/potential-energy and momentum formulas pass.
After accounting for implicit-step velocity loss and contact work, absolute
energy residual falls from 0.008978 to 0.004504 to 0.002260. Positive raw
residual falls from 3.33927e-4 to 1.19876e-4 to 1.53572e-5 over those same
sixteen-second runs.

Continuous primary checks reject all three coarser playback interpolations.
The dt=0.002 and 0.001 paths penetrate at a lower-pawl transition by
2.141936e-6 and 1.280274e-6. An independent actual-mesh surface witness
confirms the first penetration. The dt=0.0005 path has nominal gap
-9.518626e-7 at t=0.83475, exceeding the effective all-orientation allowance
of 9.306974e-7 after the Float32 wheel's pitch-symmetry error is reserved.
The final tolerance remains 1e-6. These rejected paths are retained.

A new dt=0.00025 run covers the initial two seconds. All 8,000 intervals pass
continuous wheel/pawl bounds, including all 33 pitch orientations, with
729,799 certified convex pairs and minimum lower bound -9.967920e-7. The
original and optimized implementations both pass the complete two-second
run. The optimization caches poses and tries face normals before all SAT
axes; 36 comparison cases reproduce the three prior rejections. The initial
two-second trajectory differs from dt=0.0005 by at most 0.065756 source pixels.
The remaining fourteen seconds have not yet been qualified at this step.

The full dt=0.0005 hardware trajectory passes continuous bounds for the 536
independent pairs outside the two wheel/pawl contact pairs: 395 axial
separations, eight bores, 19 axes in a shared arm frame and 114 enclosing
capsule pairs. Minimum hardware clearance is 0.000999987 units. Trigonometric
extrema cover the tilting pawls; linkage speed bounds cover entire intervals.
An independent scene-matrix check covers 7,128 vertex derivatives and 808
bearing alignments, with maximum bearing-center error 6.685e-16. This hardware
result does not override the primary-contact rejection.

The earlier resistance-2 independent surface screen remains useful geometric
evidence: 65 poses, 538 pairs and 10,155,450 surface checks, with no penetration
beyond tolerance. Its 14,718 positive impulses pass actual boundary,
normal-cone and moment-arm checks. Those reports apply to that earlier run;
the final selected trajectory still needs its own complete reaction check.

Thirty-eight candidate stills are now inspected across both study stages.
The latest eight usable views show the loaded candidate, including both pawl
details. Another eight are retained as rejected: missing canvas CSS caused
intrinsic-size growth and blank or clipped preview scenes. The corrected
preview completes a displayed input cycle in 4.0019 seconds with 140 rendered
frames. It is available at \`079-finer-preview-sized.html\` and remains a
provisional one-shot preview of a rejected interpolation. No video was
recorded or watched. The source-aligned pose and wider stroke-limit views
from the earlier stage remain available in the gallery.

Next: continue the finest dynamics to sixteen seconds, assess complete
refinement and energy, create compact startup/repeating playback, and bound
that final interpolation. Check its actual surface reactions, finish the
hidden spring/journal interpretation and visual review, then integrate and
run the focused, numerical, build and browser checks. The complete 507 review
remains active; 037, 063, 071 and 073 are mechanically unresolved.
`;
fs.writeFileSync(documents[0],notes);
const progress=fs.readFileSync(documents[1],'utf8'),start=progress.indexOf('Review continues at 079. Its original factory'),end=progress.indexOf('\n**037, 063, 071 and 073 remain',start);
if(start<0||end<0)throw Error('Review progress anchors missing');
const update=`Review continues at 079. Its original prescribed motion is rejected, with
15,970 measured baseline penetrations. An isolated 37-solid reconstruction
follows the measured joints and 33-tooth axial face ratchet. Its finite
contacts, gravity, spring preload and inertia determine the free wheel and
pawl angles. Both connecting rods retain their fixed lengths.

At normalized output resistance 6, both pawls drive their respective strokes
and settled output advances four teeth per input cycle without stopping.
Nearby load trials preserve sustained rotation. Complete sixteen-second
refinements differ by at most 0.209598 and 0.183012 source pixels, while the
accounted energy residual halves at each step refinement.

Continuous bounds cover all 536 secondary hardware pairs, with minimum gap
0.000999987. The three coarser primary interpolations remain rejected. The
new dt=0.00025 initial two-second path passes all 8,000 primary intervals and
33 wheel orientations; the remaining fourteen seconds still need this check.
Thirty-eight candidate stills are inspected, including eight rejected blank
preview captures and their eight usable replacements. Corrected playback is
timed at 4.0019 seconds per input cycle; no video was recorded or watched.

Production 079 remains unchanged. Final playback, complete reactions,
continuous contact clearance and integration are pending. All 823 previously
verified inputs still match. See \`079-loaded-study-checkpoint.json\` and
\`079-reconstruction-notes.md\`.
`;
fs.writeFileSync(documents[1],progress.slice(0,start)+update+progress.slice(end));
let gallery=fs.readFileSync(documents[2],'utf8');const cards=[['steady-start','loaded candidate · front; playback under review'],['steady-oblique','loaded candidate · oblique'],
 ['upper-drive','loaded candidate · upper pawl'],['return-crest','loaded candidate · lower pawl']].map(([name,label])=>{
 const file='079-finer-preview-sized-'+name+'.png';return '<a href="'+file+'"><img src="'+file+'" loading="lazy" alt="079 '+label+'"><span>079 '+label+'</span></a>';
}).join('\n');
gallery=gallery.replace('<div class="grid">','<div class="grid">\n'+cards);fs.writeFileSync(documents[2],gallery);
const issues=[];
for(const item of [...checkpoint.reports,...checkpoint.archives])if(hash(fs.readFileSync(item.file))!==item.sha256)issues.push({file:item.file,reason:'changed-evidence'});
for(const view of checkpoint.preview.views)if(hash(fs.readFileSync(view.file))!==view.sha256||!view.inspected)issues.push({file:view.file,reason:'changed-or-uninspected-view'});
const freeze=JSON.parse(fs.readFileSync('artifacts/review/078-verification-source-hashes.json'));
for(const [file,sha]of Object.entries(freeze))if(hash(fs.readFileSync(file))!==sha)issues.push({file,reason:'changed-verified-input'});
const report={movement:79,status:'loaded-study-documentation-updated',productionChanged:false,mechanicsPassed:false,passed:issues.length===0,
 checkpoint:{file:checkpointFile,sha256:hash(fs.readFileSync(checkpointFile))},prior,documents:documents.map(file=>({file,sha256:hash(fs.readFileSync(file))})),
 reportsChecked:checkpoint.reports.length,archivesChecked:checkpoint.archives.length,newViewsInspected:checkpoint.preview.views.length,
 frozenInputsMatched:Object.keys(freeze).length,issues};
fs.writeFileSync('artifacts/review/079-loaded-study-documentation.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(report);if(issues.length)process.exitCode=1;
