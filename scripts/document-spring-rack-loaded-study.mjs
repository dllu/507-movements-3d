import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const base='artifacts/review/',checkpointFile=base+'081-loaded-study-checkpoint.json',checkpoint=JSON.parse(fs.readFileSync(checkpointFile)),
 hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
for(const item of checkpoint.priorDocuments){assert.equal(hash(item.file),item.sha256,item.file);assert.equal(hash(item.archive),item.sha256,item.archive);}
const notes=`# Movement 081 reconstruction review

An isolated replacement is implemented and running. It follows the measured engraving with 24 closed solids, six involute gear teeth, seven rack teeth, real guide passages and a spring with constant wire thickness. The loaded geometry, contact reactions, discrete energy checks and latest rack time-step comparison pass. Full continuous playback error and neighboring spring-cell checks remain pending, so **081 is not yet verified or integrated**. All 850 previously verified production inputs remain unchanged. The [loaded study checkpoint](081-loaded-study-checkpoint.json) preserves this state and its outstanding work.

The [official source](https://507movements.com/mm_081.html) describes continuous rotation of mutilated gear A lifting rack rod B, with compression spring C returning the rack after release. The [Brown crop](../reference/brown-081-detail.png), from PDF page 28 / printed page 24, is inspected. The [refined measurement overlay](081-source-measurements-refined.png) identifies six installed wheel teeth, including one hidden by the rack, and seven rack teeth. The first seven-tooth interpretation and its measurement overlay remain preserved as rejected evidence.

The fitted wheel circle has radius 139.760832 source pixels and center [820.449472,800.882555]. Selected unoccluded rack strokes give pitch 52.574627 pixels. Sixteen virtual wheel teeth best fit the visible tooth angles. The [joint phase fit](081-fitted-source-pose.json) adjusts gear angle by -0.017040714 radians and rack tooth locations by 3.170356 pixels, giving compatible source-pose contact. Rack stroke RMS error is 5.772472 pixels; gear-tip position RMS error is 6.387681 pixels, including the hand drawing's radial variation. The [source overlay](081-fitted-loaded-source-overlay.png) and [oblique view](081-fitted-loaded-oblique.png) are inspected and accepted for this candidate.

The trial uses a ten-degree involute pressure angle, finite tooth tips and matching straight rack flanks. Its contact ratio is 1.096785 and the gear tip width remains positive at about 11.056 source pixels. The direct profile design approach is consistent with Kapelevich and Kleiss's [Direct Gear Design for Spur and Helical Involute Gears](https://akgears.com/papers/direct_gear_design.htm), which treats tooth geometry separately from standard generating-tool proportions. Pressure angle, backlash and depths are reconstruction assumptions; the engraving supplies no such dimensions.

A shallow rear flange preserves the drawn wheel circle while the working tooth roots clear the rack. The upper stem is reconstructed as a fixed mandrel inside a hollow moving rack. A real closed slot in its rear wall and a fixed pin provide travel stops. The adopted slot top is source y=681. The lower guide is vacated at high lift; the mandrel remains engaged by at least 377.000041 source pixels throughout the stroke. This hidden construction, concentric regularization of the drawn wheel/shaft circles, spring-end shaping, mass, stiffness, preload and guide resistance are explicit assumptions. They are not claimed to be visible features of Brown's drawing.

The original factory and its [rejected baseline](081-baseline-checkpoint.json) remain archived. Its 135-pose screen found 1,688,884 intruding surface samples, including teeth, solid guides and the axially scaled uncapped spring. Its return was prescribed by a Hermite curve. The replacement's return is solved from inertia, gravity, a massless Hookean spring and viscous guide drag; only gear rotation is prescribed. Study parameters are normalized rack mass 1, spring stiffness 12, preload 0.25, drag 0.3 and gravity 9.81, with a two-second study input period. These select an illustrative motion rather than recover unknown physical dimensions or material properties.

The [finest dynamics](081-interval-finer-dynamics.json) complete three revolutions with 24,001 states at a 0.00025-second step. The source pose starts during engaged lift, with velocity derived from its actual supporting tooth. Leading-tooth impact, brief overrun, opposite-face contact, spring return and impact at the lower stop are retained. All [17,746 positive reactions](081-finer-reactions.json) pass checks against the actual gear, rack, slot and pin boundaries and their outward normal cones. The [energy and refinement assessment](081-first-dynamics-assessment.json) passes; the latest rack comparison differs by at most 0.202189663 source pixels. This is observed numerical agreement, not a continuum-error guarantee.

The [indexed loaded surface screen](081-indexed-loaded-geometry.json) covers all 183 independent pairs, 101 poses and 39,074,016 actual surface samples with zero intrusion beyond 1e-6. All 24 source-pose solids are closed and consistently oriented. [Continuous hardware bounds](081-refined-hardware-bounds.json) cover 176 pairs through every gear angle and the complete recorded rack range. The other seven pairs use finite gear/rack contact. Their [profile correspondence check](081-contact-representation.json) matches all 1,676 rendered outer gear edges and every rack edge; three tiny reversed root fans caused by Float32 rounding lie entirely inside an inaccessible core.

The [spring check](081-indexed-coil-check.json) confirms identical old/new triangle positions and normals at twelve travel poses, closed oriented topology and constant centerline quadrature length. Sharing indexed vertices reduced local update cost from about 12.53 ms to 0.63 ms. Continuous bounds keep spring cells more than half a turn apart clear by at least 0.003479809 scene units. Neighboring spring cells still require their separate continuous check. The [compressed spring detail](081-fitted-loaded-compressed-spring-detail.png) and [rear view](081-fitted-loaded-compressed-rear.png) are inspected.

The [current playback table](081-seamed-playback.json) has 1,589 knots. It preserves startup, then repeats the settled cycle at four display seconds per revolution. Finite-profile projection adds a small clearance guard. Across 32,001 screened poses, combined interpolation/projection error is at most 0.000463902 source pixels; loop agreement is within 5.7e-15 scene units. A complete interval bound on that correction and on deformed spring vertices remains pending. The [browser preview](081-seamed-playback-preview.json) ran at about 58.6 fps with no page errors, a stable camera and 1.1 ms 95th-percentile model updates. Its [source](081-seamed-playback-preview-source.png), [release](081-seamed-playback-preview-release.png), [return](081-seamed-playback-preview-return.png) and repeated poses are inspected. In total, [46 candidate views](081-loaded-study-inspections.json) are inspected; 28 are accepted as isolated views.

Earlier failures remain intact: the initial tooth phase penetrated, the original rest-at-engagement initial condition defeated the local contact solver, the first return stop caused a leading-tip jam, and nearest-feature linearization also failed at a valid entering corner. Exact vertical collision intervals resolved the latter. The first hardware report overestimated two circular margins; complete edge distance and spring chord sag correct them without changing the passing result. The first compressed table failed the strict loop check by 0.000034 source pixels; explicitly retaining the loop-start knot resolves it. Initial over-zoomed detail captures are preserved as diagnostics.

Next work is the continuous neighboring-coil check and complete playback correction/mesh-displacement bound. Then integrate 081, verify production parity, run the numerical/build/browser checks and inspect final app views. **037, 063, 071 and 073 remain unresolved; 080 remains verified. The full 507-movement review remains active.**
`;
fs.writeFileSync(base+'081-reconstruction-notes.md',notes);
const progressFile='docs/review-progress.md',progress=fs.readFileSync(progressFile,'utf8'),start=progress.indexOf('Review continues at 081.'),end=progress.indexOf('**037, 063, 071 and 073',start);
assert(start>=0&&end>start);
const update=`Review continues at 081. An isolated 24-solid replacement now follows the
measured six-tooth wheel, seven-tooth rack, spring and guide proportions.
Real involute contact, inertia, gravity and a Hookean spring determine motion.
The hollow rack, fixed internal mandrel and rear slot stop are explicit hidden
construction assumptions. The mandrel retains at least 377 source pixels of
engagement while the lower guide is vacated at high lift.

The finest study has 24,001 states. All 17,746 positive contact reactions pass
independent rendered-surface checks. Energy checks pass, and the latest rack
time-step comparison differs by at most 0.202189663 source pixels. All 183
independent pairs pass 39,074,016 actual surface samples at 101 poses.
Continuous hardware bounds cover 176 pairs; finite-profile projection handles
the other seven at evaluated poses. Nonlocal spring turns retain clearance.

The indexed spring preserves triangle geometry while reducing local update
cost about twentyfold. A 1,589-knot preview retains startup and repeats at four
display seconds per input revolution, running near 59 fps with stable framing.
Forty-six candidate views are inspected. Earlier failures and superseded
measurements remain archived. Continuous neighboring-spring-cell checks and
the complete playback correction/mesh-displacement bound remain pending.
Production 081 is unchanged, all 850 frozen inputs match, and 081 is not yet
verified. See 081-loaded-study-checkpoint.json and
081-reconstruction-notes.md.

`;
fs.writeFileSync(progressFile,progress.slice(0,start)+update+progress.slice(end));
const galleryFile=base+'index.html',gallery=fs.readFileSync(galleryFile,'utf8'),old='080 is rebuilt and verified. Review continues at 081. Older study and rejected baseline images remain below as historical evidence.';
assert(gallery.includes(old));
const cards=[['081-fitted-loaded-source-overlay.png','081 isolated replacement · measured source overlay'],
 ['081-fitted-loaded-compressed-oblique.png','081 isolated replacement · spring compressed; continuous checks pending'],
 ['081-seamed-playback-preview-return.png','081 isolated four-second playback · spring return; integration pending']]
 .map(([file,label])=>'<a href="'+file+'"><img src="'+file+'" loading="lazy" alt="'+label+'"><span>'+label+'</span></a>').join('\n');
fs.writeFileSync(galleryFile,gallery.replace(old,'080 is rebuilt and verified. An isolated replacement for 081 passes loaded mesh and dynamics checks; continuous spring/playback qualification and app integration remain pending. Older studies and rejected baselines remain below.').replace('<div class="grid">','<div class="grid">\n'+cards));
const file='scripts/document-spring-rack-loaded-study.mjs',archive=base+'081-loaded-study-documentation-source.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);
const report={movement:81,status:'isolated-loaded-study-documentation-current',productionChanged:false,mechanicsPassed:false,
 checkpoint:{file:checkpointFile,sha256:hash(checkpointFile)},prior:checkpoint.priorDocuments,
 files:[base+'081-reconstruction-notes.md',progressFile,galleryFile].map(file=>({file,sha256:hash(file)})),source:{file,archive,sha256:hash(file)},full507GoalStillActive:true};
fs.writeFileSync(base+'081-loaded-study-documentation.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({documents:report.files.length,productionChanged:false,mechanicsPassed:false});
