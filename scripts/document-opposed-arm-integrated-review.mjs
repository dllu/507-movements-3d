import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const base='artifacts/review/',hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
 checkpoint=JSON.parse(fs.readFileSync(base+'079-integrated-checkpoint.json')),
 documents=[base+'079-reconstruction-notes.md','docs/review-progress.md',base+'index.html'];
assert.equal(checkpoint.mechanicsPassed,true);assert.equal(checkpoint.regression.browser,35);
const prior=documents.map((file,i)=>{
 const archive=base+'079-integrated-prior-document-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);
 return{file,archive,sha256:hash(archive)};
});
const notes=`# Movement 079 reconstruction review

Movement 079 is rebuilt and verified. The [integrated checkpoint](079-integrated-checkpoint.json) records the final production sources, validation and inspected images. The complete 507-movement review remains active.

The [official source](https://507movements.com/mm_079.html) describes two arms driven by rod B producing nearly continuous motion of the ratchet-faced wheel A. The Brown crop is taken from page 28, printed page 24, at [3055,1150,1430,1380]. Its outer and inner rim stroke fits have RMS errors of 1.163 and 1.866 pixels. Five measured joint centers retain the drawing's small asymmetry. The 33 repeated axial teeth include 31 visible divisions and two inferred beneath the arms; regularizing the irregular engraved pitch gives an angular-fit RMS of 22.338 source pixels. See [source measurements](079-source-centerlines-refined.json).

The assembly has 37 closed solids: a solid-backed face ratchet, independent radial arms, fixed-length connecting rods, the horizontal slider, radial pawl journals and real bored joints. Axial layers keep the rods, arms, pins and pawls clear. The final [source overlay](079-loop-preview-source-overlay.png), [integrated source comparison](079-integrated-source-aligned.png), [oblique view](079-integrated-oblique.png) and [rear view](079-integrated-rear.png) are inspected. Hub crescents are real cast shadows, confirmed using a refreshed unshadowed control. There is no ground or fog, and the complete motion remains framed on desktop and mobile.

Only the slider is prescribed. Gravity, inertia, finite unilateral tooth contact and ideal torsional hinge preload determine the free wheel and pawl angles. Common density, axial dimensions, hidden journals, hinge preload, stroke, damping and normalized output resistance are reconstruction assumptions. No detailed spring coil is modeled. At resistance 6, alternate pawls drive their respective strokes; the settled output advances four teeth clockwise per input cycle without stopping. Resistance trials at 5 and 7 also retain sustained motion. Startup settling and its tiny physical rollback are retained. An eight-second physical cycle is displayed in four seconds.

The complete finest trajectory has 64,001 states at dt=0.00025 over sixteen physical seconds. The last two time-step comparisons differ by at most 0.183012 and 0.103462 source pixels. The accounted absolute energy residual falls to 0.00113213 with refinement. The final playback has 4,433 startup and 4,573 repeating knots. One interior lower-pawl correction of 0.00000417127 radians resolves an interpolation contact violation while leaving the driver and wheel unchanged at that inserted pose. Compression and correction together differ from the finest path by at most 0.000391529 source pixels. Adding the last refinement difference gives 0.103854011 pixels. This is observed numerical agreement, not a formal continuum-error guarantee. See [refinement](079-final-refinement.json), [energy](079-finest-energy16.json), and [playback fidelity](079-projected-fidelity.json).

[Continuous primary bounds](079-projected-finest-bounds.json) cover all 9,004 playback intervals and all 33 wheel orientations within 1e-6. [Secondary bounds](079-projected-secondary-bounds.json) cover the other 536 independent pairs, with minimum gap 0.000999987. The [candidate surface screen](079-projected-surfaces.json) checks 97 poses and 15,195,512 mesh samples without intrusion beyond tolerance. [Independent reaction checks](079-resolved-reactions.json) accept all 113,064 reactions. Two contacts have a nonunique supporting edge: its valid midpoint resolves the original checker's arbitrary endpoint moment comparison without changing the dynamics or any tolerance.

[Production parity](079-production-parity.json) is exact for all 110 rendered buffers and 31,256 sampled poses. The large surface screen used the candidate; parity transfers its geometry and playback evidence to production. Seven focused production tests additionally check topology, rod closure, repeatable playback, bored joints, actual driving contact and surfaces at thirteen poses. All 3,087 numerical tests, the production build and all 35 browser checks pass against 835 frozen inputs. All 507 entries render successfully. The build retains its existing large-bundle warning, with a main JavaScript bundle of about 21.15 MB before gzip.

The final ten-image candidate preview and fourteen integrated images are accepted. In total, 72 candidate-study images (including rejected diagnostic views) and fourteen integrated images are inspected. No video was recorded or watched. Eighteen historical browser screenshots were restored after fresh regression captures were archived. See [integrated inspections](079-integrated-inspections.json), [browser log](079-browser-tests.log), and [verification hashes](079-verification-source-hashes.json).

The evidence retains the original model's 15,970 sampled intrusions, rejected coarse and unprojected interpolations, the two original reaction flags, failed blank preview captures, and earlier clerical errors in the production parity command/report. A finite point sample that missed the thin interpolation violation does not override the continuous-bound failure. The [playback study checkpoint](079-playback-study-checkpoint.json) preserves 189 reports, 781 exact archives and 45 study-source copies; the integrated checkpoint adds the production evidence. Earlier review documents are preserved separately. Review now continues at movement 080.
`;
fs.writeFileSync(documents[0],notes);
let progress=fs.readFileSync(documents[1],'utf8');
const start=progress.indexOf('Review continues at 079.'),end=progress.indexOf('## Completion requirements',start);
assert.ok(start>=0&&end>start);
const update=`079 is rebuilt and verified. Its 37 closed solids follow the measured rim,
five joints, independent arms, fixed-length rods and 33-tooth axial face
ratchet. Gravity, inertia, finite tooth contact and ideal hinge preload
determine the free wheel and pawls. The concealed journal and preload details,
material density, damping and output resistance are reconstruction assumptions.
The settled wheel advances four teeth clockwise per four-second displayed
input cycle without stopping; physical startup settling is retained.

The finest sixteen-second dynamics have 64,001 states. The last time-step
comparison differs by at most 0.103462 source pixels. Compression and one
interior contact projection add at most 0.000391529 pixels, giving a combined
observed-agreement bound of 0.103854011 pixels. Continuous bounds cover every
one of the 9,004 playback intervals, all 33 tooth orientations and all 538
independent pairs within 1e-6. All 113,064 contact reactions pass independent
surface, normal-cone and moment checks, including two resolved edge-midpoint
cases whose original flags remain preserved.

The candidate passes 15,195,512 actual surface samples at 97 poses. Production
matches all 110 buffers and 31,256 poses exactly, with additional focused
production surface checks. Seven focused tests, all 3,087 numerical tests,
the build and all 35 browser checks pass against 835 frozen inputs. All 507
entries rendered. Fourteen integrated images and the final ten candidate
preview images are accepted. Historical browser images are restored after
fresh copies are preserved. See \`079-integrated-checkpoint.json\` and
\`079-reconstruction-notes.md\`.

Review continues at 080. Its original model is rejected: the source shows a
finite closed slot, flared rack head, long crossed hooked pawls and a tapered
lever with rounded weights. The baseline has 232,128 sampled pawl/rack
intrusions and a whole-rack jump of one pitch at each phase seam. All six
baseline views are inspected and rejected. Source measurement and the finite
travel/contact reconstruction are pending; production 080 remains unchanged.
See \`080-baseline-checkpoint.json\` and \`080-reconstruction-notes.md\`.

**037, 063, 071 and 073 remain mechanically unresolved. 031, 064, 065, 066, 067,
068, 069, 070, 072, 074, 075, 076, 077, 078 and 079 are verified. Review continues
at 080; the complete 507-movement review remains active.**

`;
fs.writeFileSync(documents[1],progress.slice(0,start)+update+progress.slice(end));
const cards=[
 ['079-integrated-source-aligned.png','079 verified reconstruction · engraving alignment'],
 ['079-loop-preview-source-overlay.png','079 verified reconstruction · source overlay'],
 ['079-integrated-repaired-interval.png','079 verified reconstruction · bounded interior contact'],
 ['079-integrated-oblique.png','079 verified reconstruction · oblique'],
 ['079-integrated-rear.png','079 verified reconstruction · rear'],
 ['079-integrated-mobile-front.png','079 verified reconstruction · mobile'],
 ['080-baseline-source.png','080 original baseline · rejected proportions and contact'],
 ['080-baseline-oblique.png','080 original baseline · rejected rack and pawls']
];
for(const [file]of cards)assert.ok(fs.existsSync(base+file),file);
let gallery=fs.readFileSync(documents[2],'utf8');
gallery=gallery.replace('<div class="grid">','<p>079 is rebuilt and verified. Review continues at 080. Older study and rejected baseline images remain below as historical evidence.</p><div class="grid">\n'+
 cards.map(([file,label])=>`<a href="${file}"><img src="${file}" loading="lazy" alt="${label}"><span>${label}</span></a>`).join('\n'))
 .replaceAll('079 current production · rejected baseline','079 original production · rejected baseline');
fs.writeFileSync(documents[2],gallery);
const files=documents.map(file=>({file,sha256:hash(file)}));
for(const item of prior)assert.equal(hash(item.archive),item.sha256);
fs.writeFileSync(base+'079-integrated-documentation.json',JSON.stringify({movement:79,created:new Date().toISOString(),
 checkpoint:{file:base+'079-integrated-checkpoint.json',sha256:hash(base+'079-integrated-checkpoint.json')},prior,files,
 source:{file:'scripts/document-opposed-arm-integrated-review.mjs',sha256:hash('scripts/document-opposed-arm-integrated-review.mjs')},
 status:'verified-documentation-current',full507GoalStillActive:true},null,2)+'\n',{flag:'wx'});
console.log({documents:files.length,priorDocumentsPreserved:prior.length,galleryCards:cards.length,status:'079-verified-080-review-active'});
