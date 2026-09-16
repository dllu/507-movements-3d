# Remaining movements: family passes

The review queue is now **183–507, grouped into 20 component families** rather
than one drawing at a time. Every number has one primary queue owner; a family
assignment is not a claim that its existing simulation is correct. Previously
reviewed movements remain reusable references, with their documented residuals.
The executable inventory is [movement-batches.mjs](../scripts/lib/movement-batches.mjs).

## Passes

1. **Screen the whole queue.** Check construction, finite geometry/transforms,
   CPU update cost, geometry size and obvious source/motion discrepancies. Read
   the caption and check the original site's animation when one exists. Record
   unavailable animations instead of inventing an oracle. Fix crashes first.
2. **Correct shared components in batches.** Reuse solid worms, involute gears,
   conical bevels, bored joints, shafts, slots and ropes. Fix ratios, constraint
   closure, clearances, playback continuity and framing before decorative detail.
   Analytical gears and determinate linkages stay analytical.
3. **Solve contact-dependent families.** Use MuJoCo for catches, pawls, friction
   transfer, impacts and other genuinely passive degrees of freedom. Validate
   one reusable mechanism with contact-disabled and timestep controls, then
   validate each variant's changed dimensions/contacts. Bake expensive geometry
   and trajectories for browser playback. Similarity alone is not validation.
4. **Finish visual exceptions.** Extract irregular visible contours with the
   [CV tool](engraving-extraction.md), then fit intended circles, lines, sine
   waves or other mechanical curves. Reconstruct occlusions explicitly. Preserve
   mechanical intent instead of copying hand-drawn or perspective distortion.

For each family, publish the useful correction and a short residual list after
focused mechanism tests and browser inspection. Reserve exhaustive collision
sweeps and dense contour fitting for a specific unresolved contact or visible
failure. Do not keep an independent family waiting for one difficult latch.

## First parallel batch

- **195/207:** replace spring-like worms with one shared solid thread component;
  preserve analytical feed directions and tooth-count ratios.
- **220/230:** fix shaft/hub interference and full-cycle framing using shared
  shaft placement; retain analytical linkage constraints.
- **CV tooling:** threshold, contour hierarchy, ROI selection and simplified
  SVG/JSON extraction with overlays, keeping inferred edges separate.
- **Coordination:** inventory all remaining movements and run the cheap screen.

183–184 remains an explicit contact reconstruction exception. The local passive
quadrant prototype's first 36-second trial stalls on return (piston ends near
−0.593 instead of −1.388); it is not production and does not block these batches.
181–182's wider lower catch head also remains a source-fit residual.

## Running the screen

```sh
node scripts/screen-movement-batches.mjs
node scripts/screen-movement-batches.mjs --batch=worm-drives --out=/dev/shm/worm-screen.json
node scripts/screen-movement-batches.mjs --ids=195,207,220,230 --timeout-ms=20000
```

Each model runs in its own timed process, so one pathological constructor does
not block the queue or retain geometry in the next model. Output is checkpointed
after every movement in `/dev/shm` by default. Run against settled files; rerun
any entries affected by concurrent edits. CPU timing excludes module import,
GPU rendering and browser loading. Draw-call counts are estimates. Forty-nine
finite update samples catch gross failures, **not** clipping, contact correctness,
source fidelity or physics validity. Timing flags are triage thresholds, not
performance guarantees.

## Family inventory

<!-- Generated from scripts/lib/movement-batches.mjs; edit that inventory first. -->

| Family | Movements | Default method | Reuse candidates |
|---|---|---|---|
| catches-and-clutches | 183-184,186-189,217-218,247,251,253,267,277-278,280,360-361,385,415 | contact-bake | [mujoco-diagonal-catch](../src/simulation/mujoco-diagonal-catch), [finite-plate-geometry.js](../src/simulation/finite-plate-geometry.js) |
| valve-linkages | 185,418 | analytic | [authored-locomotive-valve-gears.js](../src/simulation/authored-locomotive-valve-gears.js), [authored-marine-valve-gears.js](../src/simulation/authored-marine-valve-gears.js) |
| screws-and-clamps | 190,260,266,275,285,366,379-382,389,399,493-494 | mixed | [bored-worm-geometry.js](../src/simulation/bored-worm-geometry.js), [mujoco-screw](../src/simulation/mujoco-screw), [mujoco-bench-clamp](../src/simulation/mujoco-bench-clamp) |
| noncircular-and-variable-gears | 191,196,201,205,208-209,219,221-224,414 | mixed | [noncircular-gear-geometry.js](../src/simulation/noncircular-gear-geometry.js), [stepped-sector-geometry.js](../src/simulation/stepped-sector-geometry.js) |
| mangle-and-reversing-racks | 192-194,197-199,216,269,371,394 | contact-bake | [mangle-gear-geometry.js](../src/simulation/mangle-gear-geometry.js), [mujoco-endless-rack](../src/simulation/mujoco-endless-rack) |
| worm-drives | 195,202,207,264 | analytic | [bored-worm-geometry.js](../src/simulation/bored-worm-geometry.js), [helical-gear-geometry.js](../src/simulation/helical-gear-geometry.js), [worm-wheel-profile.js](../src/simulation/worm-wheel-profile.js) |
| bevel-and-epicyclic-gears | 200,226,412,495,502-507 | analytic | [bevel-geometry.js](../src/simulation/bevel-geometry.js), [coaxial-gear-geometry.js](../src/simulation/coaxial-gear-geometry.js), [band-epicyclic-geometry.js](../src/simulation/band-epicyclic-geometry.js) |
| slots-and-crank-couplings | 203,210,220,230-231,252,268,273,279,282-283,348,350,354,401,417,419 | analytic | [authored-offset-crank-slots.js](../src/simulation/authored-offset-crank-slots.js), [linked-variable-crank-motion.js](../src/simulation/linked-variable-crank-motion.js), [mujoco-scotch-yoke](../src/simulation/mujoco-scotch-yoke) |
| friction-drives-and-brakes | 204,242,244,250,262-263,265,270,365,372-373,388,413 | mixed | [grooved-friction-geometry.js](../src/simulation/grooved-friction-geometry.js), [authored-cone-friction-drives.js](../src/simulation/authored-cone-friction-drives.js) |
| ratchets-and-indexers | 206,211-215,225,232-233,235-237,239-241,271,284,364,390-391,397-398,491 | contact-bake | [pull-pawl-geometry.js](../src/simulation/pull-pawl-geometry.js), [mujoco-reversible-click](../src/simulation/mujoco-reversible-click), [mujoco-rack-rectifier](../src/simulation/mujoco-rack-rectifier) |
| chains-belts-and-pulleys | 227-229,243,254-259,352,358-359,362,368,374,383-384,392,496 | analytic | [belt-geometry.js](../src/simulation/belt-geometry.js), [rope-kinematics.js](../src/simulation/rope-kinematics.js), [fusee-geometry.js](../src/simulation/fusee-geometry.js) |
| cams-and-followers | 272,276,281,286,400 | mixed | [mujoco-heart-cam](../src/simulation/mujoco-heart-cam), [mujoco-grooved-heart](../src/simulation/mujoco-grooved-heart), [wave-cam-contact.js](../src/simulation/wave-cam-contact.js) |
| escapements | 234,238,288-314,320-321,396,402 | contact-bake | [finite-plate-geometry.js](../src/simulation/finite-plate-geometry.js), [authored-deadbeat-escapements.js](../src/simulation/authored-deadbeat-escapements.js) |
| governors-and-inertial-devices | 274,287,315-319,355-357,369 | mixed | [mujoco-ball-governor](../src/simulation/mujoco-ball-governor), [mujoco-crossed-governor](../src/simulation/mujoco-crossed-governor) |
| drawing-and-measuring-linkages | 246,322-325,349,367,403-411 | analytic | [authored-linkages.js](../src/simulation/authored-linkages.js), [authored-drawing-instruments.js](../src/simulation/authored-drawing-instruments.js) |
| piston-guides-and-engines | 326-347,421-429 | mixed | [mujoco-crank-slider](../src/simulation/mujoco-crank-slider), [mujoco-scotch-yoke](../src/simulation/mujoco-scotch-yoke), [authored-beam-engine-parallel-motions.js](../src/simulation/authored-beam-engine-parallel-motions.js) |
| impacts-and-treadles | 351,353,363,375-378,416,420,470-472 | contact-bake | [mujoco-treadle](../src/simulation/mujoco-treadle), [wiper-stamp-geometry.js](../src/simulation/wiper-stamp-geometry.js) |
| spatial-and-folding-linkages | 245,248-249,261,370,386-387,393,468,489-490,492 | analytic | [authored-joints.js](../src/simulation/authored-joints.js), [authored-pipe-couplings.js](../src/simulation/authored-pipe-couplings.js), [rope-kinematics.js](../src/simulation/rope-kinematics.js) |
| water-wheels-and-fluid-rotors | 430-438,441-443,447,469,474,484-488,497 | fluid-analytic | [authored-horizontal-overshot-water-wheels.js](../src/simulation/authored-horizontal-overshot-water-wheels.js), [authored-screw-propellers.js](../src/simulation/authored-screw-propellers.js) |
| pumps-valves-and-fluid-storage | 395,439-440,444-446,448-467,473,475-483,498-501 | fluid-analytic | [authored-lift-pumps.js](../src/simulation/authored-lift-pumps.js), [authored-double-acting-pumps.js](../src/simulation/authored-double-acting-pumps.js), [authored-gasometers.js](../src/simulation/authored-gasometers.js) |

“Mixed” means analytical motion first, with native studies for the specific contact or dynamic uncertainty. Fluid models need explicit pressure/volume/flow assumptions; MuJoCo alone does not validate fluid behavior. Reuse candidates are starting points to inspect, not universally compatible drop-in parts.

## First screen results (2026-09-15)

All 325 authored factories constructed and produced finite geometry/transforms
at the 49 sampled poses. Movement 198 initially read an intermediate concurrent
save; its settled-file rerun passed. None exceeded the coarse triage thresholds.
This is a CPU-only sample on this workstation, run alongside other work; it does
not establish smooth GPU rendering or physical correctness.

| Measurement | Highest observed | Next candidates |
|---|---|---|
| Factory construction, excluding imports | 416: 264 ms | 196, 192, 193, 221 |
| 95th-percentile CPU update + world matrices | 320: 6.25 ms | 261, 352, 358, 390 |
| Estimated mesh draw calls, excluding shadow passes | 506: 438 | 507, 319, 436, 264 |
| Rendered model triangles | 188: 160,756 | 264, 507, 435, 506 |

The production build's initial main chunk is **26.31 MB (9.16 MB gzip)**.
`engine.js` and `model-loader.js` eagerly import the registry, which imports all
remaining authored families. Separating the application shell and loading the
requested family on demand is a shared loading-performance task. The CPU screen
excludes these imports and does not explain the reported browser slowness alone.
Bulk measurements remain in `/dev/shm/507-first-batch-screen.json`; rerun the
screen to regenerate them.

The first four corrected movements passed 29 focused component/movement tests;
the queue passed two coverage/parser tests. The production build passed. Browser
source comparisons and 17-pose desktop framing checks passed for all four; 230's
initial view now exposes both linkage planes. Their family review documents retain
unresolved wheel-contact and depth/clearance assumptions.


## Second parallel batch

- **200/226:** fixed 226's incorrect input pivot and shaft interference; removed
  200's unsupported frame and improved views. Fourteen focused tests pass.
- **231/273:** corrected shaft engagement and rebuilt solid pin joints with real
  bores; removed the unsupported 273 frame. Eighteen focused tests pass.
- **255–259:** shared bored lathe profiles, improved shoulders/grooves and source
  widths, groundless/fogless presentation. Forty-seven focused tests pass.
- **Loading:** [family-selective imports](family-loading.md) reduce the main chunk
  from 26.31 MB to 0.59 MB; all 507 route comparisons and packaged network/playback
  checks pass. Large legacy gears/intermittent chunks still need internal splitting.

These are correction passes, not family completion. Keep finite contact studies
moving in one parallel lane while other lanes clear shared geometry and source
mismatches. The source-animation check must inspect whether a usable animation
actually loads: 273 has one despite its static HTML's unavailable class.


## Third parallel batch

- **207:** baked generated worm-wheel sectors replace skewed trapezoids. A
  65-pose working-mesh audit passes for both hands, and the coarser qualified
  grid reduces wheel triangles by about four times versus the first candidate.
  195's different face-wheel envelope remains separate work.
- **203/210/252:** ideal circular slots and actual pin/roller bores, corrected
  210 endcaps, and continued slots through 252's crossbar and lower web.
- **322–325:** shared bored ruler arms and pivots, bored rolling-wheel journals,
  source-facing orientation and removal of invented paper/guide decorations.
- **183–184:** remove floating markers/ground; preserve an explicitly failed
  native diagnostic with contact-disabled controls and named residual contacts.
  The inferred hidden retaining pins need a mechanically compatible sweep.

The integrated focused run passes 73 tests, including shared worm regression
coverage; the production build and four packaged desktop/mobile checks pass.
Desktop source comparisons cover
the eight substantive geometry corrections. The new finite-clearance tests
check actual rendered holes and slot boundaries; they do not certify every
solid pair. Analytical transmission laws remain in production for these families.
Classical contour extraction helps measure visible boundaries, while ideal
circles and separately inferred occlusions remain necessary for the quadrant
contact exception. Detailed evidence and limitations are linked from
[review progress](review-progress.md).


## Fourth parallel batch

- **185/418:** real slot/die engagement and connected pin lugs; eccentric rods
  join straps. Separate the rod/roller/guide planes, connect guide ends, and
  correct valve/seat tangency. Fifteen focused tests pass.
- **186–189:** bored valve levers and 189's bell-crank/hanger joints; 188's pin
  web clears its axle. Twenty-four tests pass. Finite cam/shoe intersections in
  186–187 remain measured and need a separate contact-envelope correction.
- **326–327:** open rod/bearing/roller bores, shorten crankshafts, correct rolling
  radius and guide placement, separate the crosshead, align bored cylinder and
  gland, join 326's piston rod to its shoes, and fit full stroke. Twenty-one
  focused tests pass.
- **502–505:** bored gears/journals and improved carrier assemblies; remove
  invented frames and markers. 505 gets offline rack-generated involute gears
  after its ring teeth were found entering the old planet root. The 33-pose
  mesh audit clears all four, with calculated 505 contact ratios above one.

The integrated run passes 93 focused tests, followed by the final 504/shared-gear
recheck. The production build and five packaged playback/mobile checks pass.
These passes reuse bored lathe,
finite plate, bored-link and generated-gear helpers; no new live browser physics
is needed for the retained determinate motion laws. Remaining source, contact
and axial reconstruction limits stay in the linked family reviews rather than
being silently counted as complete.


## Fifth parallel batch

- **186–187:** finite round toes, connected rear shoulders and analytically
  solved handle rocking. Tangency, finite extents, axial overlap and reaction
  torque checks pass, with a frozen-angle negative control. Operator lift and
  latch motion remain prescribed; other legacy contacts remain unresolved.
- **328/330:** shared bored journals, open rod eyes, connected/aligned piston
  assemblies, finite fork/guide clearances and full-stroke framing. 328's
  involute flanks now have a small running allowance with unchanged pitch radii.
- **332–336:** shared bored links including intermediate pin stations, extended
  pivot shafts, source-facing/full-stroke views, and matching 334 rack/sector
  involutes with a bored backing roller at the true tangent line.
- **506–507:** ratio-derived common-apex bevels, corrected tooth mounting phases,
  full-depth spur profiles and bored nested sleeves. 507 retains its actual
  25,000:1 output with a visible index and an explanation of its slow rate.

The integrated run passes 119 tests, the production build and six packaged
playback/mobile checks. Source comparisons cover all eleven movements. The
family reviews linked from [review progress](review-progress.md) distinguish
sampled finite-contact evidence from unresolved source interpretations and
passive dynamics. These families reuse analytical constraints without adding
live browser physics or manual pixel tracing.


## Sixth parallel batch

- **202/264:** integral bored worm solids and offline wheel profiles generated
  with the actual common cutter motion. Both 264 counts retain exact indexing;
  corrected nested journals and refreshed playback profiles prevent misleading
  speed. The 33-pose working-mesh audit passes with nearby working surfaces.
- **217–218:** swept-hook notch pockets remove finite release interference while
  retaining two opposing load-bearing flanks. The diagnostic now checks actual
  flanks. A restored legacy-notch negative control detects the old fault.
- **262/263/265:** real roller bores, mating screw/nut solids, connected spring
  guides clear of the cone, readable speed and source-facing views. Preserve
  ideal circumferential rolling; axial sliding and inferred returns are explicit.
- **337–341:** shared bored rods and intermediate eyes, engaged fixed pins,
  separated bearings, and a physically guided/connected 339 slider assembly.

112 focused tests, the production build and ten packaged playback/mobile checks
pass. Remaining catch-trip dynamics,
loaded worm contact, inferred cone guides and legacy linkage joints remain in
the family reviews linked from [review progress](review-progress.md). This pass
uses geometry generated offline and existing analytic constraints; no new live
browser physics or hand-traced decorative contours are needed.

## Seventh parallel batch

- **272/276:** corrected finite cam/follower contact, inset trim, bored rollers
  and a relieved rear yoke; retained existing analytic motion.
- **342–343:** shared bored joints, engaged pins, corrected chain/shoe depth,
  piston/cylinder alignment, stroke clearance and connected bearing supports.
- **344–346:** real rod passages through covers/glands, separated trunnions and
  crank layers, and a crosshead that fits between its guides.
- **412/495:** corrected involute mesh and bevel phase/depth, bored journals,
  carrier supports and source-facing views. 412 shows the engraved base gearing;
  both retain their exact ratios and use refreshed readable playback profiles.

92 focused tests, the production build and nine packaged playback/mobile checks
pass. Finite mesh audits distinguish sampled clearance from loaded dynamics;
342's continuous-chain approximation, cam preload, open engine sections and
approximate bevel flanks remain documented in the reviews linked from
[review progress](review-progress.md). The complete review remains active.


## Eighth parallel batch

- **260/266/275:** integral mating screw/nut solids, corrected 260 gear phase and
  involutes, properly seated journals, and a solid worm with matching rack faces.
  A 33-pose finite working-surface audit clears 1.45 million queries.
- **268/273/279:** bored rod eye, full-depth roller engagement, closed guides,
  open crosshead slot and connected taper liners within the journal box.
- **281/286:** a genuine recessed channel, compatible toe/lifter faces,
  aligned rod guides and a valve head that actually closes on its seat.
- **349/367:** extracted source arm silhouettes reused as bored flat plates,
  separated joint layers and a calibrated circular indicator strip. The small
  profile generator demonstrates repeatable classical CV use in production.

118 focused tests, the production build and ten packaged playback/mobile checks
pass. Shared helper regressions are included. All four family reviews linked
from [review progress](review-progress.md) distinguish validated constraints and
sampled working-solid clearance from unresolved load behavior and reconstruction
choices. The full review remains active.

## Ninth parallel batch

- **200/226:** inclined single-driver bevel construction, narrower conical tooth
  bands, engaged shafts and corrected carrier support. Reuses the existing
  involute bevel builder; saved finite-contact audit covers all six meshes.
- **348/350/354:** shared slot/plate tools provide real openings, bored joints,
  seated sliders and guides. Preserve exact ratio laws and documented reversal
  idealizations.
- **400:** finite radial and axial follower buttons, actual rendered cam-face
  support, connected bearings and feed-bar passages. Fast deterministic contact
  geometry replaces erroneous point-center placement; loaded spring/gravity
  dynamics remain unqualified.
- **403/404/405:** keep exact drawing loci and correct finite pins, rollers,
  pencil/cord routes, threads and depth layers. 404's bending and 405's finite
  cord winding remain prescribed reconstructions, with specific residuals.

These corrections reuse finite plates, bores, conical gears and solid threads;
none requires manually tracing a new decorative silhouette or adding live
browser physics. Prior finite audit hashes are refreshed only after confirming
that the changed 200/226 builders leave their other gear dependencies byte-identical.

## Tenth parallel batch

- **190/285:** closed mating square threads, open screw passages and seated
  keyed quill guides. 285's casting now meets its base; 190's small remaining
  collar/holder interference is measured rather than claimed solved.
- **401/417/419:** actual slotted/bored joints, seated spherical joints, captured
  slide and compatible band/drum/shoe layers. 401's spring is still prescribed;
  419's displayed two-band total length varies by about 0.2%.
- **503/504:** common-apex bevel clearance and one continuous intermediate gear
  for Ferguson's paradox, with compatible common-base-pitch output profiles.
  The 33-pose audit finds no penetration in 1,261,607 sampled surface queries.
- **408/409/410:** finite perspective guides, true compass slots/sliders and
  outward bisecting-gauge setup. 409 reuses a source-hashed CV grip contour;
  mechanical circles, straight webs and hidden connections remain analytical.
- **403 follow-up:** corrected the reversed pencil cone and replaced the nominal
  tip-height assertion with a transformed-apex and mesh-vertex check.

135 focused/regression tests, the build and eleven packaged playback/mobile
checks pass. Other clamp/epicyclic builders and shared
helpers remain byte-identical after excluding the scoped builders/imports.
Historical contact reports retain their original source snapshots; the new
503/504 report supersedes those movements' old stepped-wheel results.


## Eleventh parallel batch

- **190 follow-up:** actual finite collar-rim/cheek-edge support resolves the
  previously measured penetration, preserving the collar radius and source pose.
- **191/196/201:** offline generated mating contours, compatible involutes,
  correctly sized slot follower and bored carrier joints. The 513-pose rendered
  gear-profile audit clears all three meshes; 191's seam reset remains prescribed.
- **366/379/380:** closed threads, open bores, compatible keys and shafts,
  thrust capture, bored feed links and downward drill tips. 366's small-pinion
  mounting still differs from the source layout and remains queued.
- **421/422/423:** coaxial trunk/gland, closed curved sectors, open valve chest
  and separated bored rods. Shared finite-solid helpers retain the exact
  analytical linkage laws and improve full-cycle source-facing framing.

The new gear envelopes are generated offline rather than approximated by eye.
Ideal circles, sectors and screws remain analytical; no new decorative tracing
or live browser contact solver is needed. Full pressure/load behavior is not
claimed for the engine cutaways, and the whole 507-movement review remains active.

101 focused/regression tests, the production build and ten packaged playback/mobile
checks pass. See the family reports linked from [review progress](review-progress.md).


## Twelfth parallel batch

- **366 follow-up:** source-correct small bevel above the large wheel, matching
  spindle phase, keyed rotating hub and upper-bearing retainers. The previous
  layout mismatch is resolved.
- **282/283:** real straight/curved slots, involute rack outputs, open guides,
  seated pulley/cord and coaxial piston barrels with bedplate passages.
- **368/372:** shared conical involutes, bored shaft/sleeve/carrier interfaces;
  368 directly reuses the rack-output helper. A saved 33-pose working-solid
  audit clears all named meshes.
- **424/425/426:** finite wrist/shaft clearance, compatible chamber and sliding
  abutment profiles, and actual radial hub grooves.

The source-facing drill correction closes an existing residual while independent
families proceed. Determinate links and gears remain analytical. Steam pressure,
contact loads and return/preload forces are not inferred from geometry tests.
The complete review remains active.

104 focused/regression tests, the production build and eight packaged playback/mobile
checks pass. Family reviews are linked from [review progress](review-progress.md).


## Thirteenth parallel batch

- **221/222/223:** compatible involutes, offline swept elliptical/sector
  profiles, real guide/journal bores and explicit discontinuous handoffs.
- **369/411:** finite cord/cheek offsets, correct tire radius, pointed recording
  pencil and real journal/bevel interfaces.
- **381/382/399:** actual wedge/wood overlap, dovetails, bored stand joints and
  closed mating chain-link threads with retaining-head clearance.
- **427/428/429:** slotted rolling packings, bored rollers, compatible working
  walls and measured residual source-profile interference in 429.

Existing ideal curves and shared parts suffice for these repairs. Expensive
profile generation stays offline. No decorative manual tracing or new live
physics was needed; pressure, torque, friction and loading limitations are
explicit in the linked family reviews. 411's compact layout and 429's remaining
mating interference stay queued rather than blocking the other families.

105 focused/regression tests, the production build and eleven packaged playback/mobile
checks pass. Family reports are linked from [review progress](review-progress.md).


## Fourteenth parallel batch

- **205/208/209:** offline working-profile corrections, finite pin slots and
  actual shaft/journal interfaces using the existing analytical ratios.
- **493/494:** finite wedge faces, tongs and bored joints; the original
  animation timing is retained. The attempted 389 pawl correction remains
  outside production because its seating branch is still discontinuous.
- **430/431/432:** connected bored bearings, bounded spokes, open sluices,
  real bucket/channel geometry and reusable clipped water-cell buffers.
- **429 follow-up:** source-preserving swept relief removes the documented
  piston interference. Varying clearance remains a sealing/loaded-transmission
  limitation and is stated explicitly rather than hidden by a penetration test
  allowance.

These are geometrical corrections and prescribed explanatory motions. Contact
loads, fluid dynamics and manufacturing-level sealing are not inferred from
finite nonpenetration samples. Expensive profile cutting is performed offline.

A small 221–223 follow-up corrects bore-wall winding in their baked profiles;
prior finite/contact checks are refreshed for the changed geometry.

110 focused/regression tests, the build and twelve packaged playback/mobile
checks pass. The 389 experiment is preserved on `codex/389-finite-pawl-wip`;
it remains outside main until its finite handoff is continuous.
