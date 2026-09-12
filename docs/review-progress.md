# Fidelity and rendering review

The active task remains the review and correction of **all 507 movements**.
The previous implementation's `authored` labels and regression tests are not
evidence that all models match the engravings or avoid interference.

## Movement 082 reconstruction study — 2026-09-11

082 now has a finite-contact dynamics candidate with 26 steeper teeth,
curved pawls, separate rod joints and a small pulley C. The fixed-pin linkage
supplies both moving pawl hinges; gravity, inertia and an explicit lower-pawl
preload determine free motion. The finest twelve-second run passes 690,558
independent contact-reaction checks. Corrected joint/support spacing passes 12,153,906
surface samples over 49 poses and 538 pairs. All 35 meshes pass topology
checks, and 13 new source/motion views are inspected.

An independent loading study now includes all nine rigid component families.
It finds feasible positive strap tension with both feet pressing down,
allowing the rising foot to absorb work. Mesh energy integration and momentum
checks pass; corrected energy residual decreases with smaller steps. The
strap/pulley remain ideal massless constraints. The candidate now applies a
rolling approximation with small measured circumferential slip; it remains
an idealization without a traction proof. Conservative contact pruning gives identical results in 12,326 cases
and approximately 3.63 times faster local queries.

The pulley stays on its fixed axle, and all other part transforms match the
prior candidate at 257 checked poses. The newest twelve-second startup has
384,001 states and passes time-step agreement at 0.0345345 engraving pixels.
Compression to 24,123 knots adds at most 0.0000134321 pixels. Actual mesh
triangle bounds cover both pawl/ratchet pairs through every interval, and
the secondary bounds retain their margins after compression. Together they
cover all 538 independent component pairs within 1e-6 world units.

Thirteen new candidate stills and the live preview's final image are inspected.
The finite browser preview keeps all 269 rendered frames inside the camera
and above the ground. It averages 22.32 fps locally, with 0.400 ms model updates
at the 95th percentile. This is diagnostic candidate evidence.

The finest loading audit also passes, with a corrected cumulative energy
residual of 0.00143644% of its work/loss scale. It retains the explicit ideal
two-foot loading and massless pulley/strap assumptions.

082 has not been integrated. Both settling step sizes now reach 60 seconds
without failed steps. The completed 0.0625 ms continuation has 768,001 states.
Its comparison with 0.125 ms differs by 0.532806 engraving pixels, failing the
unchanged 0.25-pixel target. Sixteen-second recurrence differences are 0.420341
and 0.386980 pixels; eight-second recurrence remains rejected. Final playback
and repeated-motion clearance remain pending. A report-specific compact JSON
serialization intervention preserved the long run without changing study
sources. The runner now has a bounded writer, checked byte for byte against
native JSON with real trajectory rows. Its three output-only edits are
verified exactly against the archived runner; the other 40 study sources
remain unchanged.
Earlier gravity, contact,
hardware, step-size and recurrence failures remain archived, along with the
rejected oversized-pulley interpretation. The later framing-marker shadow
fix changes only the shared shadow helper; 082 remains separate from
production. Details and limits are in the
[082 study](../artifacts/review/082-reconstruction-notes.md).

## Movement 083 reconstruction study — 2026-09-11

Six actual baseline views are inspected against the native engraving. The
existing straight-bar sector and separate spring shoe do not reproduce the
broad pierced source plate. The prescribed return lift also permits finite
tooth interference: a 65-pose screen finds 4,632 penetrating samples among
3,585,304 checks over 1,036 selected pairs, with maximum depth 0.062958 world
units. This rejects the existing model; no replacement is yet integrated.
The isolated replacement now has broad pierced plates, rounded openings,
measured joints and a provisional 12-tooth arc. Source overlays exposed and
rejected a wheel-edge reading and an extra central tooth in earlier fits.
The latest candidate has paired radial spring guides behind each plate and
ordinary-pin input closure. The crown ramps now match the source direction;
the output axle turns with the wheel. Finite-mesh seating is checked at 117
shaft/wheel poses, with matching unpruned comparisons and an independent
penetrating negative control. Analytic contact derivatives and independent
mesh-energy checks of the free force equations pass.

Free contact dynamics now determine the wheel and sector lifts. The first
slower run passes all 7,147 spatial reaction checks at saved states, but it
fails midpoint clearance and differs by 194.416 source pixels when its time
step is halved. An independent mesh check confirms the missed tooth intrusion.
It is rejected for playback.

Starting from a checked static gravity/spring equilibrium removes the large
startup divergence. Two step sizes now advance about 8.12 teeth per cycle,
but still differ by 4.19131 pixels and retain about 0.23 teeth of retreat.
The completed 0.0005- and 0.00025-second-step runs reduce the refinement
differences to 1.703677 and 0.451570 pixels, still above the target. The corrected-start study also has
twelve inspected source/motion renders, without browser errors or unexpected
warnings. No final motion is accepted or integrated.

A new continuous finite-solid bound finds 21 missed crossings in the previous
0.0005-second trajectory. The integrator now rejects crossing trials and
recomputes both half steps without reseating a sector. The known failure
passes independent repaired-motion surface and reaction checks. A full
eight-second run now bounds both complete sector/crown pairs across 8,048
accepted intervals, and all 14,981 recorded reactions pass the spatial audit.
The finer 0.25 ms and 0.125 ms runs also finish without crossings, but differ
by 0.947596 source pixels and fail the 0.25-pixel motion-agreement target.

New full-travel bounds cover all 1,198 secondary hardware pairs, including
the round pin/slider bores, guide windows and spring seats. A deliberately
misaligned guide rod is rejected. Continuous local-cell and separate-turn
bounds establish self-clearance for all four finite spring wires; 52 sampled
wire states remain closed and outward oriented. The combined checker verifies
all 1,280 distinct-family pairs and spring self-clearance across the finest
run's 64,000 intervals within 1e-6 world units. Sources, exhaustive pair counts
and trajectory containment in the bounded domain match. This qualifies the
current candidate's clearance, including its assumed hidden guides.
Motion refinement, remaining reversal, loads, supports and final playback
are still pending. The next finer run and finest spatial-reaction audit are
in progress; 083 remains outside production.

For the earlier sampled trajectory, all 67 meshes pass topology checks at nine poses;
2,632,342 surface samples across 1,280 distinct-family pairs find no intrusion.
The later midpoint failure establishes the limits of that sampled evidence.
Refinement, guide loads and final playback remain open.
The capture check passes without JavaScript errors or unexpected warnings.
Production is unchanged.
Measurements, preserved failures and qualification limits are recorded in the
[083 review](../artifacts/review/083-reconstruction-notes.md).

## Invisible framing-marker shadows — 2026-09-11

The shared shadow helper no longer enables shadows on invisible camera-framing
guides. This removes the isolated shadow spots seen beyond 083's model.
Constructing all 507 catalog entries confirms shadows are disabled on all
66 marked guides in 53 movements. Six before/after renders are inspected;
pose data and the source panel match, and only the former marker-shadow pixels
change. The build and all 3,100 numerical tests pass. The updated
904-input map is `artifacts/review/083-shadow-source-hashes.json`; only
`src/simulation/primitives.js` differs from the prior production map.

## Movement 081 integration — 2026-09-11

081 now uses the measured six-tooth gear and seven-tooth rack, with finite
contact, spring return and a constant-section spring. All 3,100 numerical
tests, the build and its desktop/mobile browser check pass. Thirteen final
views are inspected. Details and reconstruction assumptions are in the
[081 review](../artifacts/review/081-reconstruction-notes.md).

## Git checkpoint — 2026-09-11

The workspace now tracks `git@github.com:dllu/507-movements-3d.git` on `main`.
Meaningful progress is committed and pushed using `daniel@lawrence.lu`.
Source, production data, tests, scripts and review notes are versioned; bulk
generated evidence remains in the local artifact archive. The Git setup cleaned
five whitespace-only warnings; the previous 3,094-test result applies to the
same program behavior. The local forward source map is now
`artifacts/review/git-bootstrap-source-hashes.json`; its transition record
identifies every whitespace edit. The full-507 review remains active.

## User correction pass — 2026-09-11

The requested corrections are implemented: shark-fin teeth on 073/075, continuous overtravel and pawl drop with an ordinary swinging rod pin on 075, the complete default wheel on 076, and improved engagement with less take-up on 077. The user caught a second 075 defect in static contact selection; that version is explicitly superseded. Current evidence is in [the correction record](../artifacts/review/073-077-correction-notes.md). The broader spring reconstruction for 073 remains unresolved. The saved 081 study has since been integrated; see its review below. The full-507 goal is active.

## Changes made on 2026-09-09

- Removed scene fog entirely. Replaced the decorative ground disk/rings with
  a subtle shadow surface. Its height uses the sampled motion envelope and an
  ongoing guard against translated or deformed parts crossing the floor.
- Removed the camera-distance clamp that allowed visible geometry to cross
  the frame even when the camera fitter had calculated the necessary distance.
- Rebuilt all three shared bevel constructors (`makeBevelGear`, `makeMiterGear`,
  `makePitchBevelGear`) with conical heel/toe surfaces, outward winding, and
  separate normals at cap/flank edges. Teeth use a back-cone involute
  approximation; they are **not certified generated octoid tooth surfaces**.
  See the [KHK gear dimensions reference](https://khkgears.net/gear-knowledge/gear-technical-reference/calculation-gear-dimensions/).
- Removed the outward extrusion-bevel expansion of shared spur teeth. The
  chamfer now stays within the specified involute outline. Two old tests
  required overlap with solid rack backing or a pedestal; they now verify
  backing clearance and engagement with the projecting rack teeth instead.
- Measured world rotation and floor envelopes for all 507 models. Playback
  still aims for two seconds, with limits for sustained rotation and brief
  impulses. Tiny details are weighted by their size; deforming cable/spring
  frames and instantaneous marker resets do not set the shaft speed limit.
  These are **sampled display profiles**, not a comprehensive fidelity review.
- Movement 007: replaced outward-facing offset cones with an 18:22 bevel train
  sharing one apex. Added correct tooth phases, a real hollow sleeve, and
  clearance between the upright and horizontal shafts. Initial camera now
  resembles the source view. Belt shifting/slip and all contact phases still
  require the ongoing review.
- Movement 025: shortened the bevel faces to the engraving's proportions,
  shortened the shafts, added collars, and changed to a near-front source view.
- Expanded 506's camera envelope for the corrected tooth geometry.
- Replaced unsupported "mechanically reviewed" claims in the interface and
  README. Also removed the undefined `mechanicallyReviewed` reference that
  broke the About page.

## Evidence and limits

Screenshots are in [`artifacts/review`](../artifacts/review/). The `*-source-comparison.png`
files show the actual app beside its local engraving. These cover initial
poses of 001–012, 025, 043, 151, and 506; an image alone does not certify motion.
Geometry tests independently check closure, winding, conical ends, and hard
edges for shallow, miter, and steep bevels. Ground tests exercise translation
and deformed vertices past the initial envelope. Numerical model tests retain
their authored-time mechanism constraints; obsolete exact two-second playback
assertions now check readable timing instead.

Verification for this pass:

- `npm test`: 2,812 passed (`artifacts/review/unit-tests.log`).
- Full Playwright sweep: five tests passed, including all 507 WebGL
  constructions (`artifacts/review/browser-tests.log`).
- The subsequent camera change is additionally checked by projecting actual
  vertices through `MovementEngine.fitCamera` for all 507 initial models at
  three aspect ratios (`tests/camera-catalog.test.mjs`). Explicit author crops
  remain respected. The combined rendering test run is recorded in
  `artifacts/review/rendering-tests.log`.
- Initial screenshots for 004, 007, and 025 were refreshed after the camera
  correction; the About page was also opened successfully without page errors.

These checks verify construction, numerical invariants, and the specified
rendering properties. They do not certify full-cycle collision freedom or
source fidelity of every movement.

Regenerate display measurements after model edits:

```sh
npm run measure-display       # all 507
npm run measure-display -- 7  # only movement 007, preserving other entries
```

The reference image provided by the user is
`/home/danlu/.codex/attachments/2efd4dff-7593-43c6-a1ba-dbdec45a31bc/image-1.png`.
The authoritative engravings are stored in `public/engravings/`; source text
and page URLs are in `src/data/movements.json`.

## Confirmed next work

1. **Remaining ribbon mechanics:** 003 now has two separated guides aligned
   in elevation, and 011 has source-like quarter-turn leaves. Their smooth
   free ribbon shapes are geometric reconstructions, not solved elastic
   ribbon equilibrium. Further mechanical review should address this without
   reintroducing interpenetrating guides or detaching the band from the wraps.
2. **Slack and selector dynamics:** 005 now has a rigid pivot arm, finite
   idler contact, source-sized unequal pulleys, and a constant-length planar
   belt. Its slack buckle and transmission ramp are illustrative rather than
   a mass/friction/stiffness simulation. 007's shifting band now clears its
   pulleys, but its transition slip/torque is still approximated by engagement
   weights. Both mechanisms need that distinction retained during review.
3. **Other belt contact work:** 004's helical capstan winding still needs
   an axial-slip/friction review. 008 changes the installed step while
   stopped but does not simulate manual re-reeving over each shoulder.
   009–010 retain the small length variation of the opposed cone construction;
   their shifting/elastic tension is not a solved dynamic model. Flat bands
   have only been introduced for the reviewed opening drives; later band
   callers still need review. Round hoist ropes remain round.
4. **023 axial tracking:** proportions, suspension hardware, actual wheel
   clearance, and projected tangencies have been corrected. Two independently
   rotating sheaves at A remain a reconstruction choice for the same-side
   passing strands in the [source](https://507movements.com/mm_023.html), not
   an independently confirmed construction detail. The main drums retain
   helical axial crossovers and their free spans retain slight axial curves;
   their XY projections are now straight tangents. This still needs a physical
   tracking/friction or elastic-belt solution. Circumferential mismatch of the
   retained approximation is bounded in the new contact tests; do not call
   these helical contacts fully no-slip. The circular A contacts now follow
   material travel without slip. Source text allows omitted sliding guides.
5. **Other bevel assemblies, including 043 and 506:** audit every caller's
   pitch radius/axial-distance convention, shared apex, phase, and physical
   clearance. 043 now has shorter faces and separated shafts, but its exact
   shaft-angle interpretation and final source projection still need review.
   Do not restore shafts through their common apex to imitate a projected
   crossing in the engraving.
6. **173's self-intersecting spur:** the remaining known negative involute
   tip half-angle is in 173 (18 teeth, radius 0.4, tooth height 0.16). The
   flanks cross at the tips despite the `true-involute` label. It contacts a
   tappet; choose the source-specific tooth shape and verify actual engagement.
   The corresponding 029 defect is repaired by the spiral-generated wheel
   described below.
7. **Timing outliers:** review 099 (tiny guide roller still influences pacing),
   151 and 264 (large real reductions), and 305 (short escapement impulses).
   Long complete cycles may be appropriate for real reductions, but pacing
   still needs visual judgment and a useful way to inspect slow output stages.
8. **The remaining gear catalog:** continue with **035–507**, preserving
   the earlier open items and the full objective. Fine-pitch spur callers
   also need the oversized default chamfer reviewed; 024, 026 and 034 now opt
   into standard tooth proportions and a small chamfer. The numerical cuts
   used by 026 and 029 retain finite mesh clearance and prescribed rotation,
   rather than a loaded contact/deflection solution. No movement is being
   declared comprehensively certified by this pass. Old analytic contact
   metadata is not proof that rendered solids engage.

## Pulley and band pass

- `makePulley` now has an open annular rim, the requested number of radial
  spokes, and a tread at its declared radius. Solid drums remain available
  with `spokes: 0`. Decorative indexes sit at the faces/tread rather than
  projecting large blocks into a contacting belt.
- Added rectangular band geometry with separate running faces, closed seams,
  capped open ends, and quarter-turn width frames. Cone-drive bands follow
  different contact radii at their two edges. White travel markers are small
  stripes instead of oversized spheres. Factories that identified markers
  by `SphereGeometry` now use an explicit tag; their material-coordinate
  tests are retained.
- 001–002 have source-like pulley spacing, open four-spoke wheels, flat bands,
  and a near-front view. 003's two guides now align in elevation and have
  more than 0.25 units of clearance between their complete rendered bounds;
  its broad lower drum matches the source proportions. Free leaves preserve
  each entry tangent while distributing the axial skew between the guides
  and working pulleys. 004's guide/capstan proportions were improved, and its
  intermediate flanges no longer intersect the helical rope winding.
- 005's arm retains its rigid length through engagement. The idler contacts
  a finite circular wrap, and the larger driver/smaller driven pulley match
  the engraving. A planar slack buckle absorbs the excess belt length as
  the idler retracts; a numerical solve keeps the installed length constant.
  Its initial pose is engaged, and angular positions are seekable.
- 006 now has an open semicircular rim and two spokes, with belt ends attached
  at the lever. Two sector wraps exchange exactly the length paid out to the
  lower wheels. Material markers move once with that transfer. Crossover lift
  peaks at the actual projected intersection, providing room for both bands.
- Centered bands 001–002 and 005–006 on their treads. Tests against the actual
  toroidal flange surfaces caught and removed the previous axial edge
  interference; testing only the pitch radius had missed it.
- 007 now uses one broad upper drum and three unflanged lower selector
  pulleys. Its flat band can traverse the treads without passing through
  raised rims, and the shaft spacing now follows the source proportions.
- 008 now has four steps on vertically stacked horizontal shafts. The middle
  pair is solved against the full tangent-and-wrap belt length, so all four
  ratios accept the same belt. Removed the raised center rings that cut
  through the band. Angular positions use the integrated drive schedule and
  remain consistent when seeking; shifts occur at zero drive speed.
- 009–010 have source-oriented cones and flat bands. 010's curved profiles
  were reversed in the previous model and now bend in the source direction.
  Raised cone index tubes were replaced with surface marks.
- 011 now has a broad upper drum, source-like shaft spacing, a flat twisted
  belt, and a near-front view. Removed its unsupported overhead bar.
- 012 now has a suspension bracket, eye, and support connected to the sheave
  pin, a solid sheave face, a tied sack, longer source-like rope legs, and a
  near-front view. Its effort grip is schematic; the source's hand is omitted.
- Added an optional narrow camera field of view for the reviewed models to
  reduce perspective distortion while keeping orbit controls available.
- Camera fitting now includes each model's sampled full-motion bounds. An
  initial-vertex fit had cropped 006's raised handle and 012's descending
  load. Explicit authored viewing bounds remain respected and are fitted
  completely: the expanded test caught a later pose in 084 leaving the
  initial-only fit even though it was inside its authored viewing region.
- 043's toe diameter is now about three-fifths of its heel, and both shafts
  terminate before the shared virtual apex. Actual shaft surface points clear
  the other shaft. Its camera and sampled floor were updated.

Evidence for this pass:

- All 2,828 numerical tests passed in `pulley-pass-tests.log`. All five
  browser tests, including the full 507-model sweep, passed in
  `pulley-pass-browser-tests.log`. The production build passed in
  `pulley-pass-build.log`. These runs precede the separate 013–015 edits below.
- New geometry tests check closed band skins and normals, real pulley holes,
  flange clearance, separated guides, rigid tensioner motion, fixed-length
  stepped-belt selection, material travel, cone-edge contact, and 043's actual
  short tooth faces and separated shaft solids.
- All-507 camera checks now cover six motion phases at three aspect ratios.
  The opening twelve models and 043 additionally pass 38 phases with the
  camera held fixed (`pulley-camera-tests.log`, `pulley-motion-tests.log`).
- All 507 display profiles were regenerated after the shared changes; 043
  was regenerated again after its assembly edit. Default display cycles are
  approximately 4.69 seconds for 008, 4.21 for 009, and 3.42 for 010. Their
  fastest visible pulleys no longer have to complete the selector cycle in
  two seconds.
- `scripts/capture-review.mjs` produces actual-engine/source pairs. Images
  named `NNN-phase-X.png` cover 001–023 and 043. Multiple phases were captured
  for the opening twelve models. These comparisons are evidence of
  the specific improvements and remaining faults, not blanket approvals.
  The [comparison gallery](../artifacts/review/index.html) indexes these images.

```sh
node scripts/capture-review.mjs 6 8 43
REVIEW_PHASES=0,0.25,0.75 node scripts/capture-review.mjs 9 10
```

The script defaults to a Vite server on port 5174; override with `REVIEW_URL`.

## Hoist review: 013–015

- 013 now has the source's larger fixed wheel and smaller movable wheel,
  solid faces, a connected fixed suspension and rope anchor, a moving pin
  and hanger, a load hook, and a cylindrical weight. The hanger stays upright
  while the wheel rotates. Longer vertical spacing and a near-front camera
  bring the assembly closer to the engraving.
- 014 now has four enclosing cheek plates around each three-sheave block,
  two crosspieces, a short common pin, and upper/lower hooks. The lower hook
  carries the source's small round weight. Removed the unrelated overhead
  beam and the shelves that previously stood in for the block housings.
  Reordered the reeving and chose the final wrap tangent so the free effort
  leaf leaves outward without crossing a supporting strand.
- 015 was rebuilt with a fixed upper rope anchor, straight free spans,
  concentric grooved solids, attached hangers/hooks, and the source's downward
  hauling end. Removed the unsupported S-shaped rope bends, moving becket,
  overhead beam, and extra load. The U-shaped groove is cut into each solid;
  its wider mouth clears the rope's small fleet angle. Material groups replace
  overlapping toroidal rim decorations that caused mottled shading.
- **015 source discrepancy:** three moving sheaves with a fixed upper anchor
  provide six supporting rope parts, not seven. The reconstruction follows
  this topology and retains Brown's original wording with an explanatory note
  beside it. [White's own account](https://www.gutenberg.org/files/42951/42951-h/42951-h.htm)
  describes the fixed upper termination and equal rotation of proportional
  grooves. [Kater and Lardner](https://www.gutenberg.org/files/66078/66078-h/66078-h.htm)
  explicitly assign odd groove ratios to the lower block and even ratios to
  the upper block. The model now uses that assignment.
- Finite fleet angles make the ideal parallel-strand angular ratios an
  approximation in 014–015. Rope length is solved from the actual straight
  spans and wraps. In 015, independently differentiated material coordinates
  bound the retained contact-speed error below 3% of load speed at the tested
  phases. The model does not claim a fully solved elastic rope/contact model.

Focused checks pass in `artifacts/review/hoist-tests.log`: actual rope/groove
and rope/cheek clearance, nonintersecting rope strands, rigid load attachments,
and full-motion framing at three aspect ratios. The fixed-camera test now
covers 001–015 plus 043 at 38 phases. The existing 013–015 numerical constraints
also pass after replacing the obsolete 015 seven-part assumptions. Profiles
and three-phase source comparisons were regenerated for these models.

The two Spanish barton factory assignments were reversed. Movement **016**
now receives the nominal 4:1 arrangement: one rope embraces both moving
sheaves and the other joins their centers over the fixed sheave. Movement
**017** receives the nominal 5:1 arrangement: its hauling rope starts at the
lower becket and passes over the carrier, while the other rope runs from the
ceiling around the load sheave and fixed sheave to the carrier center. These
connections follow the [016](https://507movements.com/mm_016.html) and
[017](https://507movements.com/mm_017.html) engravings. Their factory periods,
display profiles, and regression cases were reassigned together. This fixed
the model selection; construction was addressed in the subsequent pass below.

Verification of the final hoist-pass state:

- Production build passed (`artifacts/review/hoist-build.log`).
- All 2,834 numerical tests passed (`artifacts/review/hoist-full-tests.log`).
- All five browser tests passed, including the full 507-model WebGL sweep
  (`artifacts/review/hoist-browser-tests.log`). Movement 015's correction note
  was also opened in the production build without page errors; see
  `artifacts/review/015-app-correction.png`.
- Refreshed 013–017 comparisons include phases 0, 0.25, and 0.75. The
  gallery now indexes 62 images, including the earlier opening-drive review.
- A separate read-only 13-phase probe of 016–023 recorded actual torus/rope
  penetration of approximately 0.023, 0.021, and 0.022 units in 016, 017, and
  018 respectively (`artifacts/review/hoist-next-clearance.json`). These were
  open defects at that checkpoint and are addressed below. Positive gaps
  for 019–023 in this particular check do not
  establish clearance from spokes, hubs, shafts, housings, or other ropes.

## Hoist assembly pass: 016–022

- Rebuilt 016 and 017 with solid sheaves centered on their actual rope planes,
  short pins, rigid front/rear stirrups, attached eyes and hooks, and round
  loads. In 016 the fixed sheave and secondary rope share the forward plane;
  in 017 the carrier and its hauling rope share it. Brackets reach outboard
  attachment points above the wheels. The previous flange penetrations are
  removed without putting the terminating rope through a rotating drum.
- Rebuilt 018 with an actual link carrying its second fixed sheave, a compact
  upper becket on the moving block, and one planar rope. The previously
  unsupported cubic terminal is now a straight tangent. The second fixed
  sheave is smaller and offset left so its return strand clears the long
  right-hand supporting strand. Shortened the load hook and kept its crossbar
  below the running rope through the entire motion.
- Rebuilt 019–021's load-anchored cascades with solid wheels, short axles,
  proper stirrups, and wide cylindrical loads. In 019 the three small sheaves
  have individual hooks attached to load eyes. In 020–021 the rope eyes are
  attached directly to the load. Removed the suspended decorative crossbars,
  long axle stubs, and unrelated narrow bell-shaped weights.
- Rebuilt 022's ceiling-anchored cascade with actual ceiling eyes, lower
  carrier eyes, a fixed guide hanger, and a hook carrying the round load.
  Its three working ropes retain the exact ideal 8:1 vertical travel law.
- All seven models use near-frontal source views. The hauling ends in
  017–021 leave on the engraving's outward tangent, with constant installed
  rope lengths. Ratios 5:1, 3:1, 26:1, 7:1, and 3:1 are retained as nominal
  values; vertical force components and input work use the actual angled
  rope directions. Movement 016 retains its exact 4:1 arrangement.
- Shared circular rope contacts now use exact arc lengths. Wheel angles
  follow material distance from each tied rope origin, including moving
  terminations. Independent finite differences of rendered wheel points and
  fixed rope material coordinates agree within 2e-6 in the no-slip tests.
  The old imposed integer angular approximation for 017's carrier is gone.

These remain prescribed kinematic reconstructions with ideal massless ropes
and sheaves. They do not simulate lateral swinging, elastic rope stretch,
friction, or a free-body transient. The force checks concern vertical motion
and virtual work; they are not proof of unrestricted 3D static equilibrium.

Verification includes actual rope mesh vertices against every sheave drum,
flange, and stirrup bar over 32 poses; distinct rope strands over 17 poses;
material contact velocities; and force/work consistency derived independently
from the rendered paths. The fixed-camera test now covers 001–022 plus 043 at
38 phases and three aspect ratios. Display profiles and three-phase source
comparisons for 016–022 were regenerated. The gallery indexes 74 images,
including the still-unfixed 023 for the next pass.

Final verification for this pass:

- Production build passed (`artifacts/review/cascade-build.log`).
- All 2,859 numerical tests passed (`artifacts/review/cascade-full-tests.log`).
- All five browser tests passed, including all 507 WebGL constructions,
  mobile layout, and hosting beneath a subdirectory
  (`artifacts/review/cascade-browser-tests.log`).
- Dense fixed-camera projection passed for the expanded opening range
  (`artifacts/review/cascade-camera-tests.log`).
- The high-resolution original scan and printed page 12 are now available
  under `artifacts/reference/`, with source and regeneration instructions.
  They will help resolve the remaining 023 belt-routing interpretation.

## Movable belt and opening gear pass: 023, 024, 027, 028

- **023:** matched the engraving's larger horizontal separation, smaller
  movable wheel, short pins, solid sheaves, guide-pulley spacing, and small
  cylindrical counterweight. Removed the unrelated overhead bar and replaced
  the offset floating suspension link with a connected rigid stirrup and eye.
  Removed the intermediate drum flanges from the axial crossover tracks.
- Replaced 023's prescribed 80/110/20-degree contact angles with circle
  tangents recalculated from the moving centers. The outside spans use
  external tangents; the returning spans use internal tangents. This removes
  the visible XY bowing and the approximately 0.005-unit driver-drum
  penetration detected after the proportion change. Actual belt and rope
  meshes now clear all six sheave bodies and their flanges in 32 sampled poses.
- Wheel rotation in 023 now accounts for changing material distance to each
  wrap and for movement of its tangent point. Independently sampled circular
  idler contacts agree with their rope material velocities within 2e-6.
  The two helical wraps explicitly retain axial sliding; their changing pitch
  keeps a small circumferential mismatch, bounded below 0.1% of belt speed at
  three locations on each wrap and six tested times. This is a bounded
  reconstruction approximation, not a solved axial friction model.
- **024:** corrected the initial tooth phases. The old speed ratio was
  correct, but a 41-pose tooth-pitch sweep counted 2,204 outline vertices
  inside the mating gear, with as many as 56 per pose. The corrected phase
  removes that overlap. The final gears use 20-degree involutes, addendum
  equal to one module, dedendum equal to 1.25 modules, and a 0.008-unit
  chamfer. This removes the pointed appearance from the old excessive
  tooth height and chamfer. `makeGear` now accepts these optional dimensions;
  other callers retain their existing defaults.
- 024 also has shorter shafts, a near-frontal view, and source-sized inset
  face rings. The rings are flush decals with depth bias rather than partially
  buried toruses. Independent outline tests require both no penetration and
  a flank gap below 0.0015 over a complete tooth pitch, so merely separating
  the wheels cannot pass the test.
- **027:** replaced painted stripes with open radial channels between raised
  sector webs and recessed triangular pockets. Rollers now sit inside the
  channels, behind the carrier plate; their oversized flanges are removed.
  Added pins and moved the rear hub/shaft behind the groove floor so a roller
  can pass through the center without striking them. The exact ideal slot
  width equals the roller diameter. Ray casts hit the actual driving wall at
  the roller radius; mesh vertices clear the walls and floor through 48 poses.
- 027 now reports a roller as disengaged while it crosses the central opening.
  The other two rollers maintain the half-speed constraint. The roller's
  free spin during this passage remains prescribed rather than inertially
  simulated. This is an ideal zero-clearance kinematic mechanism.
- **028:** removed the pulley flanges that penetrated the friction disk by
  approximately 0.0347 units. The upper wheel is now a solid crowned roller;
  its slight crown gives one central contact rather than demanding equal
  rolling speeds across a finite disk-radius interval. Removed the raised
  disk rim, replaced the lower hub with the source's tapered underside, and
  shortened the shafts. The upper shaft follows the adjusting wheel. Actual
  vertices clear the disk through 80 drive/adjustment poses and reach the
  intended contact level within the mesh sampling tolerance.

Profiles and three-phase comparisons were regenerated for the four changed
models. Fixed-camera testing now additionally covers 023, 024, 027, and 028
at 38 phases and three aspect ratios. The gallery indexes 86 images; the new
initial 026 and 029 images document unresolved assemblies, not completed fixes.

Verification for this pass:

- Production build passed (`artifacts/review/drive-gear-build.log`).
- All 2,864 numerical tests passed (`artifacts/review/drive-gear-full-tests.log`).
- Focused physical geometry/material-motion checks passed
  (`artifacts/review/drive-gear-contact-tests.log`).
- All five browser tests passed, including all 507 WebGL constructions,
  mobile layout, and static hosting beneath a subdirectory
  (`artifacts/review/drive-gear-browser-tests.log`).

## Crown and spiral drive pass: 026 and 029

- **026:** a 41-pose sweep of the old assembly found 3,749 actual spur-mesh
  vertices inside the crown's block teeth, with up to 107 per pose. Correcting
  its phase alone still left 1,806 intruding vertices. Replaced those blocks
  with a sampled surface generated by the mating 20-degree involute pinion,
  using its actual unchamfered outline and the 28:36 rotation relation.
  The pinion now uses module 0.075, standard addendum/dedendum proportions,
  and a 0.008 chamfer. Both shafts are shorter and the default view follows
  the near-frontal [source engraving](https://507movements.com/mm_026.html).
- The crown cut varies across its radial face width, including relief of the
  inner edge; it is not a radial extrusion of one rack section. Conservative
  resampling keeps triangle interpolation on the removed-material side.
  Independent tests query the rendered triangles, actual pinion bevel/cap
  vertices, subdivided flanks at three axial stations, and the crown surface
  in reverse. They require no sampled penetration and a flank gap below
  0.003 units through the tooth cycle. This is a numerical generating
  approximation with clearance, not a manufacturing or loaded-contact model.
  The generating approach follows the envelope principle described in NASA's
  [Handbook on Face Gear Drives with a Spur Involute Pinion](https://ntrs.nasa.gov/archive/nasa/casi.ntrs.nasa.gov/20000027536.pdf).
- **029:** removed the self-crossing 18-tooth outline and corrected the
  rotation direction. With the depicted outward-winding spiral rotating
  about +Z, its intersection with the right-hand wheel moves inward; the
  driven wheel must rotate about +Y for its bottom pitch point to move in
  that direction. The former negative ratio moved that point outward.
- The new driven wheel is smaller and has short teeth cut by the swept round
  spiral, including both endpoint caps. Its sections vary across its width;
  this special drive uses a generated thread-mating profile rather than
  claiming that the old invalid extrusion was an involute. The round thread
  section is a reconstruction choice: the [source](https://507movements.com/mm_029.html)
  specifies one tooth of advance per disk revolution but does not supply a
  manufacturing profile. The one-tooth advance is preserved.
- 029's wheel now straddles the raised thread while its real tips stay more
  than 0.028 units above the disk face. Its vertical shaft extends farther
  below the wheel, matching the engraving; removed the extra outer face
  ring, enlarged the central hub, and placed the spiral opening at the top
  in the initial view. The spiral centerline is now exactly Archimedean.
- A 69-pose test includes phases immediately around the open-end handoff.
  It checks actual thread vertices against rendered wheel triangles, checks
  wheel vertices against the continuous round thread, and ray-casts from
  the wheel to the rendered thread surface. Each pose has no sampled solid
  penetration and an actual surface gap below 0.004 units. Motion remains
  prescribed with finite clearance; backlash take-up, compliance and contact
  forces are not dynamically solved.
- Generated cutting tables are saved in `src/data/contact-profiles.js`;
  `node scripts/bake-contact-profiles.mjs` regenerates them from the current
  model parameters. The mathematical generators remain available and run
  automatically when the parameter keys differ. Run the baking script after
  changing a generating algorithm as well. On this machine, saved cuts reduced
  cold model construction to about 40–45 ms, from roughly 0.7 seconds for the
  crown cut and 2.2 seconds for the spiral cut.
- Both changed models retain a two-second input cycle at default playback.
  Their three-phase source comparisons are refreshed, and fixed-camera
  testing now includes both at 38 phases and three aspect ratios. All phase
  images for 001–029 and 043 were recaptured after the bounds change.
  The gallery now indexes 115 images, including initial review captures for
  030–036. Those seven assemblies are not yet repaired by this pass.

### Precise motion bounds

The render comparison exposed another common framing error: rotating a disk's
local bounding square expands its world bounds by up to sqrt(2), even though
the disk itself keeps the same diameter. Display measurement now uses actual
vertices, and all 507 profiles have been regenerated. The initial camera and
ground bounds also use actual vertices. The runtime floor guard first checks
inexpensive part bounds, then scans vertices only when a part's box appears
to cross the floor; empty box corners can no longer lower the ground during
rotation. Translation and deformation still trigger the existing guard.
A new full-turn wheel regression covers this case.
The recalculation tightens 346 motion bounds; measured sustained playback
speeds are unchanged. For example, the old rotating-box estimate placed 217
and 218's floor envelopes about 1.78 units below their actual sampled geometry.

Initial observations at that checkpoint (030, 032 and 034 are addressed in
the following pass):

- 030, 032, 034 and 035 need near-frontal projections and closer source
  proportions. 030/033/035's discrete noncircular teeth still require actual
  flank-interference sweeps; correct pitch-curve metadata alone is insufficient.
- 031 depicts the worm as a thick round coil around a shaft. The engraving
  shows a screw thread; inspect the thread section and real wheel engagement.
- 033's current focus-mounted ellipses have a markedly different axle
  placement from the engraving's apparently centered holes. Resolve this
  interpretation before changing its kinematics; simply centering two exact
  ellipses is not a verified conjugate construction.
- 034 still uses the old block-toothed ring; investigate migration to the
  existing continuous internal-involute primitive and test the actual mesh.
- A preliminary 41-pose midplane screening projects mesh vertices into the
  other member's tooth rectangles. It found 2,596 hits for 030 (up to 68 per
  pose), 3,757 for 033 (up to 146), and 4,139 for 034 (up to 103). These are
  projected screening counts, not finalized 3D collision tests; use them to
  guide the next contact audit. Do not use only end-cap vertices for the 3D
  check: coplanar faces or different gear widths can hide axial overlap from
  a strict vertex-inside-solid test.
- 036's raised round guide rails need checking against the source's guiding
  groove and pinion-shaft constraint, including the transition at both ends.

Final verification after the bounds change:

- Production build passed (`artifacts/review/face-spiral-build.log`).
- All 2,867 numerical tests passed, including the catalog camera checks
  (`artifacts/review/face-spiral-full-tests.log`).
- The two detailed contact tests passed
  (`artifacts/review/face-spiral-contact-tests.log`).
- Focused engine and dense opening-camera checks passed
  (`artifacts/review/face-spiral-camera-tests.log`).
- All five browser tests passed, including construction and rendering of
  all 507 movements, mobile layout, and static subdirectory hosting
  (`artifacts/review/face-spiral-browser-tests.log`).
- All 507 display profiles were regenerated
  (`artifacts/review/precise-display-measurements.log`). The opening comparison
  captures and the separate 030–036 baseline captures completed without page
  errors (`precise-opening-captures.log`, `next-gear-captures.log`).

## Noncircular, friction and internal gear pass: 030, 032 and 034

- **030:** replaced discrete rectangular teeth with a continuous outline cut
  by a rolling straight-flanked rack. The generator removes the rack's swept
  volume from an offset convex blank, including root relief, and uses a
  20-degree pressure angle. A circular benchmark independently checks the
  resulting working flanks against standard involutes. The method follows
  the generating principle described by Bäsel in
  [Determining the geometry of noncircular gears for given transmission function](https://arxiv.org/abs/1905.02642).
- The existing conjugate pitch curves and variable-speed law are retained.
  Their convex rounded corners approximate the rectangular forms in the
  [engraving](https://507movements.com/mm_030.html); neither the exact curves
  nor the selected 48 teeth per wheel are specified by that source. Larger
  hubs, shorter shafts, inset face lines and a near-frontal camera improve
  the source projection. This is not an exact tracing of the engraving.
- A 192-pose full-cycle check queries both rendered extrusion outlines and
  requires no sampled penetration and a contact gap below 0.0025 units.
  Actual chamfer and cap vertices remain within those outlines, allowing
  only Float32 rounding tolerance. The cut includes small finite backlash
  and radial clearance; motion remains prescribed rather than force-driven.
  The new generator supports convex pitch curves and was initially enabled
  only for 030; 033 adopts it in the following pass. Other noncircular callers
  still require individual review.
- **032:** the official animation supplies radii 5 and 8, hub radii 1.5 and
  shaft radii 1. The reconstruction now uses those proportions and the exact
  opposite 5:8 rotation ratio. Both wheels have shorter shafts, thinner
  bodies and a near-frontal camera. Increasing the tread tessellation reduces
  visible faceting and the discretization gap at rolling contact.
  A 48-pose test checks actual wheel vertices against the mating cylinder
  and ray-casts the rendered treads, requiring a surface gap below 0.0005.
  The ideal rolling law does not simulate friction or slip under load.
- **034:** the official animation establishes a 50-tooth ring, 20-tooth
  pinion and 2:5 rotation ratio. These replace the previous 42:18 choice.
  The ring is now a continuous internal involute extrusion; the pinion uses
  matching module 0.06 and standard addendum/dedendum proportions. Corrected
  the initial tooth/gap phase, enlarged the hub to the source proportions,
  shortened the shaft and adopted a near-frontal camera.
- Corrected the internal-gear primitive's bevel offset so the chamfer stays
  within its specified material outline. Added optional chamfer and backlash
  parameters; 034 uses a 0.006 chamfer and 0.0006 tangential backlash.
  The small backlash accommodates the sampled flank interpolation rather
  than separating the nominal pitch circles. A 41-pose tooth-cycle test
  checks both mating outlines and actual chamfer/cap vertices, with no
  sampled penetration and a flank gap below 0.0015 units. The shared
  primitive also affects 329, 412 and 505; their display profiles were
  regenerated, but their complete assemblies remain pending review.

The official 032 and 034 page snapshots and extracted dimensions are recorded
in [`artifacts/reference/README.md`](../artifacts/reference/README.md).
Three-phase comparisons for 030, 032 and 034 were refreshed. The gallery still
contains 115 images. Dense fixed-camera testing now includes these three
models at 38 phases and three aspect ratios.

Verification for this pass:

- Production build passed (`artifacts/review/noncircular-internal-build.log`).
- All 2,871 numerical tests passed
  (`artifacts/review/noncircular-internal-full-tests.log`).
- All seven focused physical-contact tests passed
  (`artifacts/review/noncircular-internal-contact-tests.log`).
- Dense fixed-camera projection passed
  (`artifacts/review/noncircular-internal-camera-tests.log`).
- All five browser tests passed, including all 507 WebGL constructions,
  mobile layout and static subdirectory hosting
  (`artifacts/review/noncircular-internal-browser-tests.log`).

At that checkpoint, the next unresolved opening models were 031, 033, 035 and
036. The following pass addresses 031 and 033. The earlier open items and the
rest of the 507-movement catalog remain part of the active review.

## Worm and centered oval pass: 031 and 033

- **031:** replaced the detached round coil with one closed screw surface:
  straight axial flanks, flat crests, an integral root cylinder and planar
  end caps. Separate flank/crest normals retain the sharp edges without
  faceting the circular surfaces. This is a Type-I axial trapezoid, one of
  the worm profiles described in the
  [KHK technical reference](https://khkgears.net/gear-knowledge/gear-technical-reference/calculation-gear-dimensions/).
  The [source](https://507movements.com/mm_031.html) does not identify an exact
  manufactured profile; the 20-degree axial pressure angle is a reconstruction
  choice, not a recovered dimension from the engraving.
- Replaced 031's ordinary extruded wheel with a wheel generated by the
  synchronized screw sweep. The cutting hob has a quarter-module crest
  extension for root clearance. Its sampled surface varies across the wheel's
  width and includes the throat and skewed flanks. The generating cut uses
  1,200 poses and conservative neighboring samples to keep the triangle
  interpolation on the removed-material side. Clearance is finite; this
  remains prescribed kinematics rather than a loaded contact solver.
- Retained 30 wheel teeth and one tooth of advance per screw revolution.
  The worm is smaller, has 3.5 turns, and carries a shorter shaft. The wheel
  is thinner, with a source-sized hub and short shaft. Removed the unrelated
  large inset ring and switched to a near-frontal default view. Those chosen
  proportions approximate the engraving; the website provides no animation
  geometry for this movement.
- A manifold/winding test verifies the closed screw and its axial profile.
  A 65-pose contact test queries screw vertices, triangle centers and edge
  midpoints against actual wheel triangles. In reverse, wheel vertices and
  flank triangle centers clear the continuous screw surface. Ray casts to
  actual screw flanks require a contact gap below 0.004 units at every pose.
  The test selects the finite working flank, not its extrapolation above
  the crest, when choosing the contact normal.
- The worm cutting table is saved alongside 026 and 029 in
  `src/data/contact-profiles.js`. `node scripts/bake-contact-profiles.mjs`
  regenerates all three. Cold 031 construction is now about 0.1 seconds on
  this machine, compared with roughly three seconds when generating the cut.
- **033:** replaced focus-mounted true ellipses with centered second-order
  elliptical gears, matching the axle locations in the
  [engraving](https://507movements.com/mm_033.html). This interpretation follows
  the conjugate oval family described by
  [Vanegas-Useche et al., section 3](https://revistas.unal.edu.co/index.php/dyna/article/view/49170).
  Their pitch radius is `2ab / ((a+b) - (a-b) cos(2θ))`, with fixed center
  distance `a+b`. These are centered ovals, not exact geometric ellipses;
  the application now explains that distinction.
- 033 uses maximum/minimum pitch radii 1.2 and 0.72, a 1.92 center distance,
  and 32 teeth per wheel. The dimensions follow the drawing's proportions;
  they are not specified numerical source data. The resulting input/output
  speed-ratio magnitude ranges from 0.6 to 5/3, twice per revolution. This
  removes the previous focus-mounted pair's greater-than-40-fold variation.
  Integrated angles preserve exact ideal rolling and seekable motion.
- Replaced both sets of rectangular teeth with the rolling-rack generator
  introduced for 030. Uniform pitch-curve sampling gives both identical
  ovals equal tooth pitch. The 192-pose actual-outline test requires no
  sampled interference and a flank gap below 0.0025. Chamfer/cap vertices
  stay inside their cut outlines. Shafts are shorter, the gear faces have
  inset lines, and the default view is near-frontal.

Both models have refreshed display profiles and three-phase source comparisons.
Their default input cycles are two seconds; 031's full wheel revolution takes
30 input turns, preserving its genuine reduction. Fixed-camera checks include
both models at 38 phases and three aspect ratios. The original scan's printed
page 14 and the two website page snapshots are retained under
[`artifacts/reference`](../artifacts/reference/). Eighteen new baseline images
for 037–042 bring the comparison gallery to 133 images; those six models
have not been repaired by this pass.

Verification for this pass:

- Production build passed (`artifacts/review/worm-oval-build.log`).
- Five focused contact/geometry tests passed
  (`artifacts/review/worm-oval-contact-tests.log`).
- Dense fixed-camera projection passed
  (`artifacts/review/worm-oval-camera-tests.log`).
- All 2,874 numerical tests passed
  (`artifacts/review/worm-oval-full-tests.log`).
- All five browser tests passed, including all 507 WebGL constructions,
  mobile layout and static subdirectory hosting
  (`artifacts/review/worm-oval-browser-tests.log`).
- 033's interpretation note was also opened in the production build without
  page errors (`artifacts/review/033-app-interpretation.png`).

## Sliding elliptical pinion and mangle-wheel pass (035–036)

- **035:** kept the fixed true ellipse, uniform circular pinion and rotating
  slotted carrier from the [source](https://507movements.com/mm_035.html).
  Replaced both sets of block teeth with 20-degree rolling-rack cuts, including
  the 12-tooth pinion's undercut roots. The 192-pose contact check requires
  no sampled tooth interference and a working gap below 0.0025.
- Replaced the carriage that penetrated both rails with a bored sliding
  tongue and a separate retaining flange. Actual mesh/raycast checks require
  0.005 clearance at each slot wall, 0.025 between flange and rail faces,
  and open bores around both rotating shafts. The old overlap measurement
  remains in `artifacts/review/035-carriage-baseline.json`.
- Reconstructed the inward-pulling tension spring, including its attachment
  posts. Its changing helix radius preserves wire length as the carriage
  travels. Checks cover 33 carrier poses, shaft and flange clearance, positive
  spring extension and an inward force direction. The mechanism still uses
  prescribed ideal kinematics, rather than a spring-force/contact solver.
- **036:** corrected the working side of the
  [mangle-wheel](https://507movements.com/mm_036.html). The pinion runs outside
  the outer tooth edge, inside the inner edge, and around both convex ends.
  A real closed groove surrounds the raised C-shaped tooth strip. This
  replaces the former facing tooth rows and raised round guide rails.
- Generated the strip by subtracting the synchronized, rack-cut circular
  pinion along its complete path. Both circular runs and both reversals share
  one tooth pitch. There are 88 strip teeth and 12 pinion teeth; these counts
  and dimensions are a conjugate reconstruction of the undimensioned drawing,
  not numerical specifications published by Brown.
- The 256-pose actual-outline check finds no sampled interference and a
  maximum working gap of 0.001691 units. Actual cap/chamfer vertices stay
  within the cut outline. The generator samples the entire closed contour,
  including nonadjacent parts near the opening. Its saved cutting table is
  regenerated with the crown, spiral and worm tables by
  `node scripts/bake-contact-profiles.mjs`.
- The guide pin sits in a recessed groove with 0.008 nominal side clearance
  and 0.035 clearance above its floor. The upright slot leaves 0.006 around
  the main shaft. Raycasts check both actual groove walls through 96 poses.
  Shortened the pinion hub to clear the disk face, joined the raised strip
  to the face, and separated the stationary bar from the rotating pinion.
- Both models now use near-frontal source views and short shafts. 036 starts
  with its opening at the left. Its lighter tooth-strip finish makes both
  toothed edges readable. Three-phase comparisons for both models and two
  additional 036 reversal views are in the 135-image review gallery.
- Added both models to the fixed-camera test at 38 phases and three aspect
  ratios. Removed 036's obsolete hard-coded cycle duration, so display bounds
  are measured over its actual complete motion. At default speed, their
  pinions turn once per second; a complete 035 carrier circuit takes 4⅓ seconds
  and a complete 036 forward/reverse cycle takes 8⅓ seconds.

Verification against the final cycle-duration correction:

- Production build passed (`artifacts/review/sliding-mangle-build.log`).
- All 2,878 numerical tests passed, including both new contact suites and
  the expanded fixed-camera checks
  (`artifacts/review/sliding-mangle-full-tests.log`).
- All five browser tests passed, including all 507 WebGL constructions,
  mobile layout and static subdirectory hosting
  (`artifacts/review/sliding-mangle-browser-tests.log`).
- The source comparisons and extra reversal views rendered without page
  errors (`artifacts/review/mangle-captures.log` and
  `artifacts/review/mangle-reversal-captures.log`).

The original 037 baseline had actual mesh vertices and triangle interiors
penetrating the opposite frustum: long teeth by up to 0.1036 and studs by up to 0.2255 units
in a 96-pose baseline. These depths greatly exceed polygonal tessellation
error. See `artifacts/review/037-body-interference-baseline.json`. The
[official 037 page](https://507movements.com/mm_037.html), saved under
`artifacts/reference/mm_037.html`, has no source animation. Its spiral stud
layout and tooth law need checking alongside the body clearances and view.
An older related construction appears in Lanz and Betancourt's
[Analytical Essay, printed page 85 and figure L8 on plate 6](https://archive.org/details/b22009851/page/85/mode/1up).
The saved plate includes a plan as well as an elevation. It shows a spiral
running from one axial end to the other, with adjacent end teeth at different
heights; it does not support the former model's sinusoidal rise-and-fall
layout. The text also calls for tooth shapes matched to their respective
pinion sections. This is supporting evidence for the partial reconstruction below,
not a claim that Brown supplied a detailed tooth law or reset dynamics.
The shared `makeScrew` coil primitive remains unchanged for its later callers;
each still needs source/contact review.

The 037–042 baseline captures expose additional concrete work:

- 037's camera and shaft proportions differ from the engraving. The opposed
  cone bodies meet at their pitch surfaces; check their protruding teeth
  and studs against actual body volumes, not only contact-radius metadata.
- 038 substitutes a shallow continuous contour for the source's strongly
  stepped circular sectors and straight connecting edges. Its hidden center
  link, block teeth and motion law need a source-specific reconstruction.
- 039 needs the flywheel's broad rim/spokes, hub proportions, short shafts,
  source view and actual gear engagement reviewed. Its current flywheel
  reads as a thin separate hoop.
- 040–042 share `makeContinuousHelicalGear`, whose teeth use four-point radial
  sections rather than involute flanks. The smoothed prism edges appear
  rounded, and the source's thin edge-on views are not reproduced. Audit
  transverse/normal pitch, helix angles and real clearance before changing
  only the camera. 042 additionally needs its shaft-angle interpretation
  and unequal-wheel proportions checked.

## Partial repair of 037; engagement remains unresolved

- Replaced the original long block teeth with straight conical surfaces whose
  transverse profiles are 20-degree rack-generated involutes. The experimental
  stud-cut driver, which produced horizontal ridges, was discarded. The current
  pinion has continuous generators and separate cap/flank normals.
- Replaced the sinusoidal stud row with an end-to-end spiral and shortened the
  shafts. Removed decorative rim rings, indicators, contact marker and base
  rail. The near-frontal view and tapered silhouettes now follow the source
  more closely. The selected 12 pinion teeth, 10 studs and dimensions are a
  reconstruction; Brown does not supply manufacturing dimensions or counts.
- Relieved the stud cone below the maximum pinion tip envelope. Individual stud
  blanks are cut against the moving pinion, preserving its full conical teeth.
  The resulting caps are cached in `src/data/conical-stud-profile.js`; regenerate
  with `node scripts/bake-conical-stud-profile.mjs`. Both the factory and baker
  use one parameter object. A parameter mismatch falls back to generation.
- The 128-pose actual-vertex and triangle-interior check finds minimum sampled
  stud/tooth clearance of **0.000382** and tooth/body clearance of **0.016003**.
  These address the old solid-body penetrations; they do not prove engagement.
- A separate 256-pose point-to-actual-triangle distance check finds a maximum
  sampled working gap of **0.177659** near the spiral seam. The radial-distance
  test alone overstated some gaps near steep flanks, but this 3D check confirms
  that the handoff remains unresolved. Evidence is saved in
  `artifacts/review/conical-stud-euclidean-contact.json`. Reproduce this known
  engagement failure with `node scripts/probe-conical-stud-contact.mjs`
  (expected exit status 1 while 037 remains unfinished).
- **037 is not mechanically verified.** Its nominal motion integrates adjacent
  pitch ratios and closes after every stud has passed. This remains prescribed
  animation. Stud spacing, matching faces and the end-to-end handoff need to be
  solved together; the long exposed studs also need further source comparison.
  The app's note and `contactValidation` metadata make this limitation explicit.
  Legacy tests that merely equated two virtual pitch velocities were removed.
- Re-measured display bounds and speeds after the final geometry and source
  phase changes. The full output turn takes two seconds at default speed.
  Fixed-camera tests cover 38 poses at three aspect ratios. All three 037 source
  comparisons in the 135-image gallery now show this same reconstruction.
- Production build and all **2,879 numerical tests passed** in
  `artifacts/review/conical-stud-full-tests.log`. All **five browser tests passed**,
  including all 507 WebGL constructions, mobile layout and subdirectory hosting
  (`artifacts/review/conical-stud-browser-tests.log`). The separate engagement
  diagnostic above still fails; passing regression tests do not complete 037.

## Rebuilt 038: three stepped gear ratios

- Replaced the shallow smooth pitch curves with the source's three concentric
  sectors and radial boundaries. The official animation specifies successive
  ratios of **-3, -1 and -1/3**, with changes at input fractions 1/12 and 3/4.
  At center distance 2.8, the mating pitch radii are 2.1:0.7, 1.4:1.4 and
  0.7:2.1. Radial joints on the front faces reproduce the visible construction
  lines. The source remains `artifacts/reference/mm_038.html` and
  `mm_038-animation-data.json`.
- Generated all circular sectors with a common 20-degree rack and module
  2.8/24, using the 12-, 24- and 36-tooth parent circles. Simply connecting the
  arcs with radial faces caused interference at the transitions. The driven
  boundaries are now relieved against the actual moving driver through 9,216
  poses, with 9,216 angular cutting rays.
- Saved the driven cut alongside the crown, spiral, worm and mangle cuts in
  `src/data/contact-profiles.js`. `node scripts/bake-contact-profiles.mjs` now
  regenerates all five, and was run against the final motion correction.
- A 532-pose bidirectional check samples the actual outlines, including points
  along the long radial edges and both sides of every speed change. It finds
  no sampled penetration and a maximum working gap of **0.002858** units.
  Rendered bevel vertices also stay inside the checked outline. This required
  constraining small Three.js bevel-miter overshoots at sharp generated corners.
- Replaced the hidden center link with the visible fixed link and bored end
  collars, and shortened both shafts. Checks through 33 poses find more than
  0.0059 clearance in the actual bores, 0.005 between collars and rotating hubs,
  and 0.064 between the link and gear faces.
- The output positions now match all four source keyframes and remain
  continuous across cycle boundaries. Fixed a floating-point wrap that could
  incorrectly report zero output after a full revolution. The source's speed
  steps are retained; this is ideal kinematics without an impact/inertia model.
- Re-measured motion bounds and speeds and added 038 to the 38-pose camera test
  at three aspect ratios. A complete cycle takes two seconds at default speed;
  peak output speed is 1.5 turns per second during the short first sector.
  The four final source comparisons, including all three ratio-change poses,
  are in the **136-image** review gallery.
- Production build and all **2,881 numerical tests passed** in
  `artifacts/review/stepped-sector-full-tests.log`. Contact and hardware details
  are in `stepped-sector-contact-tests.log`, with maximum gap 0.002858.
  All **five browser tests passed**, including every one of the 507 WebGL
  constructions, mobile layout and subdirectory hosting
  (`stepped-sector-browser-tests.log`).

## Rebuilt 039: Watt's sun-and-planet motion

- Corrected the equal 24-tooth involute gears' indexing. The baseline entered
  its mate by up to **0.044202** units; the repaired actual outlines have no
  sampled penetration through 192 poses, with a maximum working gap of
  **0.0001591**. The test also checks the rendered chamfers.
- Reconstructed a finite rod three carrier lengths long, using the official
  animation's length ratio. Its unseen upper joint follows a vertical guide
  above the starting planet. This guide placement is an explicit reconstruction
  choice: it reproduces the engraving's right-hand planet and upright cropped
  rod, while the official animation puts its guide over the sun. The app
  explains this choice. The visible rod stays a fixed length and rocks with
  the planet; it does not telescope.
- The sun turns through twice the carrier angle minus the rod's rocking angle.
  Tests verify the full rod length, vertical upper guide, actual rendered rod
  direction, rigid attachment to the planet, instantaneous angular speeds and
  two complete sun turns per orbit.
- Replaced the round flywheel rim and crossed bars with a single broad rim,
  four tapered spokes and four real openings. Added the source's gear flanges,
  wide bored carrier, rod attachment boss and shorter shafts. Removed the rail
  and set a nearly frontal source view.
- Through 65 poses, the actual carrier bores provide over 0.0059 radial shaft
  clearance. The carrier clears the rod by 0.03 and its attachment boss by
  0.01; the planet and rear shaft clear the flywheel by over 0.0169.
- Re-measured the display profile. An orbit takes **2.2531 seconds** at default
  speed, keeping the sun's sustained visible speed within the shared limit.
  Fixed-camera tests include 38 poses at three aspect ratios. Four final
  screenshots are linked in the **137-image** gallery.
- Build and all **2,883 numerical tests passed**. The final contact/hardware
  tests passed again after the rendering experiments. All five browser tests passed, including every 507 WebGL construction,
  mobile layout and subdirectory hosting (sun-planet-browser-tests.log).
- **A small rendering issue remains open:** fine marks occur on the carrier
  face at some poses. Disabling its shadows, welding vertices, rebuilding its
  outline and replacing its triangulation did not reliably remove them.
  A separate shader-program key and a tenfold camera-near-plane increase also
  left the marks; the test browser reports a 24-bit depth buffer.
  The simpler original bored extrusion and normal lighting were retained;
  there is no evidence of a physical rod/plate intersection. Rendering probes
  are saved as sun-planet-*-probe.log and corresponding prefixed PNGs. An
  earlier progress message attributed this to shadows/triangulation too soon.

## Rebuilt 040 and 041: unequal involute helical gears

- Replaced the equal gears and oblique view with a smaller upper gear, larger
  lower gear and nearly edge-on source view. The engravings give no counts or
  exact ratio; **28:40** approximates their roughly 7:10 pitch diameters. This
  reconstruction choice is stated in both app notes. The lower gear turns
  oppositely at seven tenths of the upper gear's speed.
- Replaced the four-corner wedge teeth with normal-system involutes. Both gears
  use a 20-degree normal pressure angle, a 40-degree helix angle and a common
  normal module of 0.07 cos(40 degrees). Their different radii require different
  leads. The smaller and larger pitch radii are 0.98 and 1.4; face width is 0.74.
  A transverse backlash allowance of 0.0003 prevents tessellation interference.
- In 040, opposite helical hands meet at a sharp central chevron with no gap.
  In 041, the uninterrupted single helices have opposite hands. Corrected the
  visible slopes to match both sources. Flank lighting uses analytic helicoid
  normals; the flat end caps keep separate axial normals. Each gear is one
  closed toothed solid, with no separately overlapping tooth bars.
- Restored the short horizontal shafts and broad hubs, including 041's second
  hub step. Removed the decorative rail. Four source comparisons per mechanism
  include an offset of half a tooth pitch, since quarter turns repeat the
  appearance of uniformly spaced 28-tooth gears. The gallery has **139 images**.
- The contact test intersects the actual rendered triangle strips with axial
  planes, retaining their diagonal intersection points. It checks both faces,
  the center and all 48 strip midpoints through 32 input-tooth phases. No
  sampled penetration was found; maximum working gaps are **0.00016121** for
  040 and **0.00015613** for 041. These are finite-resolution surface checks,
  not a force or loaded-deflection simulation.
- Further checks cover closure of every mesh edge, outward triangle winding,
  flank normals tangent to the base cylinder, hard end-cap normals and the
  unequal tooth/gap relation across the entire width through 65 motion poses.
  The default upper-gear turn takes **two seconds**, and a lower-gear turn takes
  20/7 seconds. Re-measured both display profiles and added them to the
  38-pose camera test at three aspect ratios.
- Production build and all **2,885 numerical tests passed**
  (parallel-helical-full-tests.log). All **five browser tests passed**, including
  every one of the 507 WebGL constructions, mobile layout and subdirectory
  hosting (parallel-helical-browser-tests.log).

## Rebuilt 042: shallow skew involute gears

- Replaced the 90-degree, 16:24 wedge-tooth pair with nearly equal diameters
  on a **20-degree shaft crossing**. The upper gear is almost edge-on and the
  lower shows a narrow face, matching the engraving's arrangement. Brown
  supplies no dimensions: **40:42 teeth and 25/5-degree helix angles** are
  explicit reconstruction choices, stated in the app.
- Both gears use normal-system involutes with module 0.05 and a 20-degree
  normal pressure angle. Opposite hands make the crossing angle equal the
  difference of the helix angles. Their different transverse pressure angles
  and pitch radii follow from that common normal system. The obsolete shared
  four-corner helical-tooth helper was removed after its last caller migrated.
- Rebuilt the broad hubs and short horizontal-looking shafts, removed the
  rail, and restored a nearly frontal view. The lower gear turns oppositely
  at **20/21** of the upper gear's speed. Nominal contact retains sliding along
  the common tooth trace rather than falsely claiming pure rolling.
- The old 64-pose baseline had **0.146946** maximum radial penetration.
  Its factory and probe are archived in 042-original-factory.txt and
  042-original-probe.txt. The current command now checks the repaired model:
  node scripts/probe-crossed-helical-contact.mjs.
- The new check uses the actual triangulated surfaces, including axial-strip
  diagonals, both triangle centroids and samples near the outer ends of the
  cap triangles. Through 64 input-tooth phases it checks **2,428,122** points
  in the possible contact region in both directions. No sampled penetration
  was found, and the largest sampled point-to-triangle working gap was
  **0.00014118**. Detailed evidence is in 042-involute-contact.json.
- Independent Three.js raycasts at 48 unrelated positions agree with the fast
  surface queries. Tests also check mesh closure, outward winding, involute
  base-cylinder tangency of the lighting normals, hard cap normals, shaft
  directions, gear ratio and tooth advance. Through 65 poses, upper hubs and
  shafts clear the lower gear by over 0.69 units; lower hardware clears the
  upper gear by over 0.58 units.
- Re-measured the display profile and added 042 to the fixed-camera checks
  through 38 poses at three aspect ratios. An upper-gear turn takes **two
  seconds**, and a lower-gear turn takes **2.1 seconds**. Four source images,
  including a half-tooth phase, are saved in the review gallery.
- Production build and all **2,888 numerical tests passed**
  (crossed-helical-full-tests.log). All **five browser checks passed**,
  including rendering all 507 models (crossed-helical-browser-tests.log).

## Rebuilt 044: four staggered spur rows

- Replaced equal 24-tooth wheels with a common-module **36:50 involute pair**,
  matching the source's approximately 0.72 upper/lower diameter ratio. Brown
  specifies four staggered rows but no counts; the application identifies the
  tooth count as a reconstruction choice.
- Widened the stack to 2.686 units across a 2.365 shaft spacing and restored the
  source's nearly edge-on view. Each row advances one-quarter of its own tooth
  pitch; the lower rows have the complementary reverse stagger. Shafts now
  have the source's different upper/lower diameters.
- Removed per-row decorative rings, indices and oversized hubs. Reduced the
  tooth chamfers from about 0.0338 to 0.003. Actual adjacent row bodies formerly
  overlapped by **0.029184**; their new gap stays above **0.0739** through 65
  full-turn poses. The baseline is 044-stack-geometry-baseline.json; the old
  factory is preserved in 044-original-factory.txt.
- The actual tooth outlines, with all chamfer vertices checked against them,
  pass bidirectional contact probes through **161 poses per row**. Across all
  four rows, 162,037 nearby samples show no penetration and a largest sampled
  working gap of **0.00011065** (stepped-spur-contact-tests.log).
- Motion tests check the independent pitch velocities, weighted mesh phase,
  each row's actual rotor transform and the corresponding one-tooth advances.
  Upper/lower revolutions take **2 seconds / 2.7778 seconds** at default speed.
  Four comparison images include a half-tooth pose. Camera bounds now cover
  044 at all three tested aspect ratios.

## Rebuilt 045: five grooved friction faces and enlarged section

- Replaced the equal four-groove wheels with **five complementary V grooves**
  and **7:10 mean radii**, matching the engraving's unequal wheels. The face
  width and nearly edge-on camera follow the source. The right-hand detail
  enlarges the middle four grooves by 1.35, with hatched axial sections.
  Its geometry is a stationary reference illustration and casts no shadow.
- Each wheel is now one closed solid, with separate cap normals, sharp V
  creases and smooth circumferential normals. Its pale motion index is vertex
  color on the existing faces. There are no raised rings or face markers.
  The removed valley rings penetrated the mate by up to **0.018253** in the
  old model (045-groove-ring-interference-baseline.json). The original factory
  is retained in 045-original-factory.txt.
- Actual triangle vertices and centroids stay inside complementary conical
  envelopes: **2,228,224 checks across 64 poses**, no penetration. Tests also
  ensure no triangle bridges a groove valley. **5,120 raycasts** against the
  rotating, rendered faces find a largest working gap of **0.00016483**.
  Evidence is in grooved-friction-contact-tests.log.
- Closed-surface, outward-winding and normal tests pass. The reference section
  clears the machine by over 0.23 units; camera bounds include both through
  motion. Upper/lower turns take **2 seconds / 2.8571 seconds**.
- The nominal ratio rolls at the mean radii. Independent cross-product checks
  retain opposite signs of local sliding on the V faces. The application
  states that friction force and load-dependent slip are not simulated.

## Resolved 039 opaque-face rendering marks

The earlier shadow, material and arm-triangulation probes did not fix the
carrier's dotted marks. Further isolation reproduced the fault in the
multisampled default framebuffer: objects behind the opaque carrier changed
**7, 4 and 27 interior pixels** at phases 0.25, 0.5 and 0.75. Disabling
multisampling removed the effect. This isolates the rendering path; it does
not establish a general cause inside the browser or graphics driver.

The renderer now uses a single-sample framebuffer at **two pixels per CSS
pixel**. This keeps smooth displayed edges without the faulty multisample
path. With the same geometry and depth tests, all **52,314 sampled interior
pixels** now agree exactly with an isolated-arm rendering. This comparison
disables shadow reception in both views to isolate occlusion; the production
model retains its shadows. The existing mechanical clearance tests remain in
place. Evidence and reproducible command:

- 039-opaque-occlusion-baseline.json: old path, expected failure.
- 039-opaque-occlusion.json: repaired path, zero changed pixels.
- node scripts/probe-opaque-occlusion.mjs
- Fresh 039 comparisons at 0, 0.25, 0.5 and 0.75, plus refreshed 044/045 views.

The 2x framebuffer increases fragment shading work on standard-density
screens, compared with the previous 1x multisampled framebuffer. The 507-model
browser sweep validates the final rendering path. Production build and all
**2,891 numerical tests passed** (stepped-grooved-full-tests.log). **All five
browser checks passed**: four passed in the first invocation, and the all-507
rendering sweep passed on its rerun (7.5 minutes). The first sweep reached 507
but hit its 440.25-second timeout. Its revised budget is 1 second per model
plus 60 seconds of overhead; assertions and model coverage are unchanged.
Logs: stepped-grooved-browser-tests.log and stepped-grooved-browser-render-sweep.log.
Fresh renderer comparisons also cover 001, 025, 040–043 and the half-tooth
phase of 044.

## Next: 046 and 047 baselines

Both official pages mark their animation unavailable. Their page snapshots,
three comparison phases each, and original factories are saved. The gallery
now contains **153 comparisons**, including baselines that are not certified.
A larger Brown scan and direct PDF crops resolve details obscured by the small
website pictures (brown-page-16.png, brown-046-detail.png, brown-047-detail.png).

- **046:** the chain is drawn over a solid cone, while its supposed groove is
  a raised black wire. Raycasts against the actual cone show chain/link
  penetration up to **0.033571** across 24 poses (53,242 vertices checked;
  046-chain-cone-interference-baseline.json). The source fusee is wider and
  shorter, with an actual spiral ledge/channel and a flat link chain; its
  initial source pose has most of the chain on the barrel. The current spring
  and barrel arbor both rotate rigidly with the barrel. Glasgow's 1885
  practical manual, printed pages 63 and 66, confirms a cut groove for an
  edgewise chain and a **stationary barrel arbor** after spring adjustment.
  A spring reconstruction must allow the coils to unwind between that fixed
  inner arbor and the moving barrel attachment. The current torque curve is
  prescribed from the desired output torque, not derived from a spring.
- **047:** the high-resolution section shows a narrow outer annular tongue
  entering an annular recess in the left member. The existing broad face disk
  and plain cup do not match that profile; the initial opaque oblique view
  also hides it. Shaft, hub and lever axial lengths need source comparison.
  A raised input face index enters the engaged output disk by **0.013000**
  (047-face-marker-interference-baseline.json, 65 poses). The motion also clamps
  integration steps to 0.05 seconds: at a 0.1-second authored step it reports
  a locked 1.2-rad/s output while the actual output angle advances at only
  **0.6 rad/s**, against a 1.2-rad/s input (047-locked-rate-baseline.json).
  The rebuild needs time-consistent engagement and physical part clearances.

**037 remains mechanically unfinished**; completing the other entries does
not certify its continuous contact.

## Rebuilt 046 fusee, chain and spring

The initial source view now uses a short, wide fusee with **three broad spiral
turns**, a hollow spring barrel of the same height, and the front chain hook
and three barrel wraps shown by Brown. The shaft spacing is 2.76 relative to
a unit barrel chain radius; the fusee's top boss and base radii are 0.555 and
1.18. The 4.25-turn example in Glasgow's manual supports the mechanism's
interpretation, but produces too many narrow steps for this drawing. The
final model instead retains **one reserve barrel wrap at full wind**. Neither
that travel limit nor the exact dimensions are supplied by Brown; the
application explicitly identifies them as reconstruction choices.

- The old raised guide wire and solid cone are replaced by a closed,
  machined spiral ledge. Hard ledge edges retain separate normals, while the
  cylindrical and spiral risers shade smoothly. Top and bottom caps have
  complete boundaries and outward-facing triangles.
- **299 articulated links** have separate interleaved plates, bored ends and
  finite joint pins. Their pin spacing is fixed at **0.079975343** and the
  total polygonal chain length is **23.912627426**. A chord-walking closure
  solve moves the wrapping and free portions without stretching links or
  switching chains. Across 257 states, individual pitch error stays below
  2e-12; the 1,025-pose clearance sweep finds endpoint closure error below
  2e-10. The smooth guide's arc length is not used as a substitute for the
  actual rigid-link length.
- Both end pins remain in fixed clevis eyes on their respective rotors.
  **3,075,000 checks across 1,025 poses** prove that the oblique finite pins reach through, and
  clear, every plate and anchor bore (minimum conservative clearance
  **0.00087872**). A 129-pose check missed a narrow transition interference
  in the earlier 0.007-radius bores; the final bore radius is 0.0082 and the
  denser sampling remains in the regression test. **230,652 neighboring plate pairs** have a separating axis
  with at least **0.00353270** clearance. Nonadjacent chain sections also have
  disjoint conservative swept volumes across **2,876,445 segment pairs**.
- The final ledge opening accounts for the projecting joint-pin ends at the
  changing helix/span transition. **659,788,400 actual plate/pin surface
  samples across 1,025 poses** clear the continuous barrel/fusee envelopes:
  minima **0.00120090 / 0.00238177**. An independent radial-ray test against
  the rendered fusee triangles includes both plates and complete joint pins:
  **1,292,978 rays**, minimum clearance **0.00238806**.
  Evidence: 046-chain-clearance.json, 046-mechanical-tests.log, and the
  reproducible `FUSEE_CLEARANCE_STEPS=1024 node scripts/probe-fusee-clearance.mjs`
  diagnostic. Its default uses 129 poses for a faster check.
- The barrel arbor stays fixed. The ribbon expands toward the barrel wall as
  it unwinds, with fixed inner and rotating outer attachments in small clamps.
  Its neutral-line length changes by less than 4e-10. **29,361,299 finite
  spring-segment pairs** keep separate turns at least **0.037078** apart after
  allowing for ribbon thickness. Moving coils clear the arbor, cup wall,
  floor and rim. The clamps are permanent attachment interfaces.
- The prescribed spring-force curve illustrates torque compensation; it is
  not derived from the ribbon's elastic strain energy. Spring stress,
  friction, winding stopwork and load response are not simulated. These
  limitations remain visible in the application's mechanical note.

The complete winding/rewinding display cycle takes **8.7169 seconds**. Its
sustained visible rotation stays within one revolution per second. The fixed
camera check now includes 046 and correctly accounts for instanced chain
meshes. Six source comparisons cover the initial pose, quarter phases, and
both winding reversals (0.1108435329 and 0.6108435329). The gallery now contains
**156 comparisons**, still including uncorrected baselines for later entries.

The first complete browser run passed all five checks, including all 507
models (046-browser-tests.log, 8.1 minutes). The final bore-clearance change
also passed a fresh production build and all **2,897 numerical tests**
(046-full-tests.log, 104.4 seconds for the numerical suite). The additional
046 browser test passed against that final build, checking moving pixels,
pause stability and mobile layout (046-final-browser-test.log). All six
source comparisons were refreshed after the final geometry change. 047
retains its documented baseline defects and is next; **037's continuous
engagement remains unresolved**. This entry does not certify the remaining
mechanisms.

The next clutch outline is traced in 047-section-reconstruction.json, without
changing production 047. Relative to its outer radius, the larger drawing
gives a shaft length of about 2.04, lever arm 0.484, and handle 0.769. Its
input recess and output annular tongue need small explicit running
clearances. The sectional presentation must remain fixed while the members
rotate; simply rotating a half shell would misrepresent the mechanism.

## Rebuilt 047 annular friction clutch

The new section follows the larger Brown drawing: a narrow outer annular
tongue enters a matching annular recess, and the right member has a keyed
sliding sleeve and circumferential follower groove. The shaft is **2.04 outer
radii long**, with a **0.484-radius lever arm** and **0.769-radius handle**.
The old broad face disk, long shaft/hub and raised face index are removed.
The former index penetrated the engaged disk by 0.013 units; the new rotation
marks are painted into the member's vertex colors, outside the working face.

- Both clutch members are complete, closed solids with outward-facing
  triangles. The output bore includes its actual keyway, with explicit
  corner angles in the surface mesh. The fixed feather clears that bore
  throughout the 0.10-unit slide; **2,064 rays** against the actual bore find
  at least **0.005000** radial clearance at the sampled key surfaces. Shaft,
  lever and follower pins also clear their bores.
- The annular tongue clears both walls of its recess. **866,840 surface
  checks across 257 poses** find at least **0.00593295** side clearance.
  **18,504 axial rays** against the rendered working faces recover the
  commanded axial gap to below 1e-15. The faces meet at zero gap under
  applied pressure, without axial penetration.
- The lever is one rigid bell crank. Its follower maintains contact with the
  appropriate collar corner, with small lost motion between the two sides
  before axial travel begins. **8,313,387 surface checks across 1,025 poses**
  keep follower, pin and lever clear of the rotating sleeve; minimum sampled
  radial clearance is **0.00034855**. The analytic full follower circle also
  clears both collar corners at every sample, with **0.0002** contact
  clearance on the active side. The follower is a sliding contact, not a
  claimed no-slip roller.
- The source view is a fixed section of the rotating members, with front and
  rear faces at Z=0 and -0.08. Its keyway opening changes with the actual
  shaft angle; an oblique keyway may leave a separate slit in the rear face.
  **40,998 section-triangle checks across 512 full-turn angles** lie inside
  the complete physical solids. The cut does not rotate with the machine.
  A **Section view** control restores the full solids and an oblique camera;
  the complete view retains the normal floor, while the drawing view omits
  its shadow plane. Other movements retain their existing view controls.
- Polynomial pressure ramps and exact acceleration/angle integrals replace
  the old delta-clamped update. Breakaway, synchronization, release and rest
  occur at solved events. Tests compare actual angle derivatives with
  reported speed over 2,000 times, independently integrate the acceleration,
  and verify torque balance, including a stalled output under weak pressure.
  Updates with zero delta, 1/240, 1/60, 0.05, 0.1 and 0.4-second steps all
  produce the same state at a given time.

The display cycle is **2 seconds**, with a maximum input speed of about
0.764 revolutions per second. Dimensions, pressure, inertia, load and travel
are reconstruction choices; wear, heating and elastic deformation are not
simulated. The application states these limits.

The production build and **2,903 numerical tests passed**
(047-full-tests.log, 115.0 seconds). Evidence for the mechanism is in
047-mechanical-tests.log. **All seven browser tests passed** in 7.9 minutes
(047-browser-tests.log), including the all-507 render sweep, the 047
section/full-view and mobile controls, 046 playback, and static-subdirectory
hosting. Four source phases and two complete-model views are saved.
**037 remains mechanically unresolved**.

## 048 and 049 baseline for the next rebuilds

Official page snapshots and enlarged Brown PDF crops are saved in
artifacts/reference. Both official animations are unavailable. The review
gallery includes phases 0, 0.25 and 0.75 of each existing model; these are
baseline evidence, and neither mechanism is certified by the browser sweep.

048 has confirmed geometry and contact failures. The input clutch cylinder
is too short, both clutch halves are too wide relative to the driven gear,
and the narrow output hub does not follow the long cylindrical sleeve in
the drawing. The upper shaft and oblique camera also differ substantially.
The source's tapered or curved jaw outline needs reconstruction; its exact
jaw count and dimensions are not specified. Tooth counts and the ratio
cannot be reliably recovered from the schematic edge-on teeth alone.

The lower gear uses four-point trapezoidal teeth with an involute pinion.
A middle-plane probe of **1,093,792 actual pinion triangle samples across
257 poses** finds **55,275 samples inside** the lower gear's rendered
straight-extruded outline, with maximum sampled penetration **0.0304158**.
The positive clutch also declares its output locked while its jaws have
**0.006 axial clearance**. During full insertion the jaws remain centered
in **7.2 degrees of backlash on each side**, so they never carry torque
through flank contact. **99 rays across 33 locked poses** measure working
flank gaps of **0.0631647 to 0.126329**, including **0.0947470** at mean
radius 0.75. These failures are recorded in 048-contact-baseline.json.
The old model test checks prescribed phase and clearance but does not
establish actual engagement. The next rebuild must test the working
surfaces and the transition into and out of positive contact.

049's existing three-bevel topology needs a source-proportion review.
Its exposed upper shaft is much longer than the engraving, its bearing
frames differ, and the present oblique view obscures Brown's front outline.
The initial interpretation of that outline as a section was corrected in
the 049 rebuild below. The pawls used a prescribed cosine lift; their contact
with the actual ratchet teeth still needs investigation. The enlarged
source is saved as brown-049-detail.png. No 048/049 production changes
were included with the completed 047 rebuild.

## Rebuilt 048 geared jaw clutch

The long input cylinder and rounded sliding sleeve now follow the enlarged
Brown drawing. Their outer radius is **0.54** relative to the driven gear's
approximately unit outside radius. The input tip is at X=0.87; the parked
output tip is at X=1.29. The shaft extends from -0.56 to 3.99, and the
bell-crank arm and handle measure 1.15 and 1.09. The grooved collar has a
real bored follower and pin, and the short operating rod is pinned to the
handle. The source camera is nearly straight on. There are no added rails
or bearing posts in this drawing view; the shoulder is smoothly shaded.

Both spur gears are now generated by a rolling 20-degree rack, including
the root transition below the base circle. The chosen **18:32 ratio** uses
module 0.05875. **6,579,200 checks** of the actual extruded middle-plane
outlines across 257 poses find no intersection, with minimum radial
clearance **0.00083735**. An independent involute equation checks 5,184
flank points, with maximum tangential departure **0.00003265**. This
replaces the incompatible trapezoidal lower wheel.

Six annular jaws are part of each complete closed clutch solid. Their
working sides are radial planes; their opposite sides have curved lead-in
ramps. Insertion begins while the stationary output's slots are aligned.
The output starts only when a driving flank reaches its mate, then follows
the input at that contact phase. The sleeve remains locked during
withdrawal and coasts under a constant resisting load after the jaws clear.

- **1,984,543 actual front-surface checks** across 513 poses show no jaw
  penetration. The complete teeth also remain inside their root angular
  sectors, whose overlap bounds hold throughout the motion. Projection
  ambiguities at a vertical driving face are resolved by distance to its
  actual triangle, not by ignoring the contact region.
- **1,170 rays** against all six working flanks across 65 engaged poses
  recover zero contact gap within **1.58e-8** model units.
- **5,557,438 lever/follower surface checks** across 513 poses clear the
  sleeve envelope by at least **0.0210064**. **462 additional collar rays**
  verify contact on the actual active lip to **9.54e-8**. The follower
  traverses the groove's lost motion before each reversal of sleeve travel.
- **2,580 keyway rays** across 129 poses find at least **0.0060000**
  clearance from the actual feather surface. Separate bore rays check the
  shaft against the loose input member and both gears.
- All rebuilt meshes have closed edges, outward winding and consistent
  normals. Angle derivatives match reported speeds; engagement events and
  cycle boundaries preserve output angle; frame sizes from zero through
  0.4 seconds produce the same state at a given time.

The default cycle takes **2 seconds** and the fastest shaft turns about
**0.593 revolutions per second**. The six jaws, tooth ratio, dimensions,
clearances, travel and load are explicit reconstruction choices. Locking
is an ideal inelastic impact against a prescribed constant-speed input;
stress and elastic deformation are not modeled. The application explains
these limits. Reconstruction parameters are saved in 048-reconstruction.json.

All **eight dedicated mechanical tests passed**. The production build and
**2,911 numerical tests passed** (048-build.log and 048-full-tests.log,
118.6 seconds for the tests). The new 048 desktop/mobile playback check
also passed. **All eight browser tests passed** in 8.1 minutes, including
the all-507 render sweep, mobile controls and static-subdirectory hosting
(048-browser-tests.log). Four final source phases and two oblique
complete-model views are saved; the original 048
phase-0.25 capture is retained under its baseline filename. The review
gallery contains 168 source/complete-model comparisons.

## Confirmed 049 failures before its rebuild

The larger engraving implies approximately equal **45-degree miter gears**:
its upper-left heel is roughly (-298, -300) from the apex, and the toe/heel
slant ratio is about 0.62. The existing model uses **16:32 teeth**, a
26.565-degree pinion cone and a 0.40 slant ratio. Its ratchet radius is about
1.04 times the pinion radius; the drawing suggests about 0.46. These are
substantial proportion/ratio differences, in addition to the long upper
shaft and different camera view.

The actual pawl contact probe also fails. Across **1,025 poses**, **511 of
1,023 active-pawl poses** have an air gap, reaching **0.0175332**. Elsewhere,
**6,024 rendered tip vertices** lie inside ratchet teeth, with maximum depth
**0.0134688**. The beam itself sits 0.015 outside the wheel axially, so it
cannot provide the missing contact. Results and source coordinate estimates
are in 049-contact-baseline.json. The replacement must solve the pawl's
motion against its real tooth surfaces and address finite tooth pitch at
reversals. The old prescribed cosine lift is not contact evidence. With its 0.82-radian
input amplitude, a passive half-stroke advances the relative ratchet phase
by 3.28 radians, or about 7.308 pitches. The next drive therefore starts at
a different tooth phase; repeated strokes cannot be validated from a
single ideal speed-ratio equation.

## Rebuilt 049 ratchet and bevel rectifier

Three equal **40-tooth, 45-degree bevel gears** replace the old 16:32 pair.
The inner/outer axial ratio is **0.60/0.97**, and the ratchet radius is
**0.46** relative to the approximately unit bevel radius. The source's
short upper shaft, smaller ratchets, upright pawl arms and curved bearing
braces are reconstructed. Front and oblique views show the complete closed
solids. The radiating lines in Brown are bevel teeth, not section hatching;
the earlier suggestion that this movement needs a cutaway was incorrect.

The bevel teeth retain a back-cone involute approximation with conical
heels and toes. A local thickness factor of 0.999 closes the previous
excessive backlash without changing other bevel callers' default factor.
**6,976,320 actual triangle-surface checks across 129 poses** find no
intersection in either mesh. The smallest sampled gap is **0.00004779**;
the largest per-pose, per-mesh contact gap is **0.00007222**. This is
sampled contact evidence for the rendered approximation, not certification
of exact manufactured octoid conjugacy.

The opposed pawls now lift against the real ratchet outline and return
under ideal spring bias to physical heel stops. Each has a rounded nose,
true pivot bore, pin and torsion coil. The arms have bored keyways and
rotate with actual shaft feathers; the two bevel/ratchet members run loose
on the horizontal shaft. The upper gear fits its output shaft. Both shafts
terminate clear of each other.

- **2,918,638 pawl-surface checks across 1,025 poses** show no tooth
  penetration, with minimum clearance **0.000004984**.
- **257 rays** against the driving nose and actual tooth face measure a
  maximum gap of **0.000005357**. The overrunning pawl's lift follows the
  tooth ramp instead of a prescribed cosine.
- Pawl heels meet their stops within **1.05e-10** numerical error. Pivot
  clearance exceeds **0.001494**; the spring wire clears the pivot and
  stop by **0.008878** and **0.009250** respectively.
- **1,430 rays** from actual feather-surface samples verify at least
  **0.004000** keyway clearance. Further bore rays check both loose gears
  and 64 output-shaft rays verify the fixed fit within **1e-7**. Carrier
  arms clear the stationary posts axially by at least 0.025.
- Rigid meshes have closed edges, positive volume and outward normals.
  A bore ray exposed a microscopic seam at the final angle of the shared
  turned-surface helper; wrapping that angle to zero closes the seam.
  All 17 targeted clutch and bevel regression tests pass after that fix.

The chosen **40-degree input amplitude** advances four ratchet teeth per
half-stroke and **160 degrees of output per oscillation**. Both driving
strokes therefore begin on an actual working face. Tests also exercise
three nonintegral stroke amplitudes through four cycles each: these retain
the required lost motion at reversals. Output angle is continuous and
one-directional; derivatives match the reported speeds, and the prescribed
load/inertia balance never requires a pawl to pull. Frame steps from zero
through 0.4 seconds give the same state at a given time.

The displayed oscillation takes **2 seconds**, with maximum shaft speed
about **0.349 revolutions per second**. Tooth counts, dimensions, amplitude,
load and spring details are explicit reconstruction choices. Spring
return is quasistatic and engagement impacts are ideal; spring inertia,
wear and elastic stress are not simulated. The app states these limits.
Parameters and evidence are saved in 049-reconstruction.json. Seven
dedicated mechanical tests and the fixed-camera motion test pass. The
final production build passes, and **all 2,918 numerical tests pass** in
107.5 seconds after the output-shaft fit correction
(049-final-build.log and 049-final-full-tests.log).

The full browser run passed eight of nine tests, including the **all-507
render sweep**, mobile layouts, static-subdirectory hosting and 049's
playback, pause and orbit controls. 046 exhausted its 45-second test
budget during mobile scrolling while the numerical suite was also running;
the failure trace is preserved in 049-browser-timeout-046. A sequential
rerun against the final build passed both 046 and 049 in **40.0 seconds**,
with no assertion changes or longer timeouts. Thus all nine distinct
browser checks have passing results across the full run and focused rerun
(049-browser-tests.log and 049-final-browser-tests.log).

Five final source phases and two oblique views are saved for 049. Its old
captures remain under baseline filenames. Including the next 050/051
baselines, the gallery now contains **178 comparisons**.

## 050 and 051 baseline for the next rebuilds

Both official pages describe kinds of universal joints and mark their
animations unavailable. Saved page snapshots, Brown PDF page 22 (printed
page 18) and larger unmodified drawing crops are in artifacts/reference.
The existing factories are saved in 050-051-original-factories.txt, and
three source-comparison phases per model are in the gallery.

The current tubular arms, separate toroidal bearing eyes and bulky necks
do not follow the source's broad, curved fork silhouettes. 050's middle
member also needs its compact double-loop outline reconstructed in place
of the long exposed middle shaft. The cameras and relative shaft lengths
differ substantially from the drawings. Exact joint angles and dimensions
remain reconstruction choices; these drawings are not dimensioned.

The rendered joints also have confirmed interpart interference. The
existing yoke-arm tubes extend into their pivot openings and pass through
the cross or ring trunnions. A probe of actual triangle vertices, centers
and edge midpoints compares distinct moving members, excluding intended
fixed connections. Only closed individual solids are used as penetration
targets; open tube ends cannot generate the inside classification.

- **050:** 5,606,224 surface checks across 65 poses find **56,108 samples
  inside** the other member, reaching depth **0.0698337**. The worst witness
  is a middle-yoke arm inside a cross trunnion of radius 0.075.
- **051:** 3,812,876 checks find **25,009 samples inside**, reaching depth
  **0.0738605** at a yoke arm and the ring's trunnion.

The probe and detailed witnesses are saved in
scripts/probe-universal-joint-baseline.mjs and 050/051-contact-baseline.json.
No 050/051 production changes were made during the 049 rebuild. Their
current kinematic regression tests do not establish physical clearance.

This baseline describes the state before the following rebuild.

## 050 and 051: curved forks, real pivot bores and derived Cardan motion

Both universal joints now use broad curved straps and cylindrical bored
end lugs. The old tubes and separate decorative toroidal eyes let the arms
fill their own pivot openings. The new straps stop before each opening;
real pins pass through real bores, with retaining caps outside the forks.
050's exposed intermediate shaft and oversized necks are replaced by one
compact, continuous double fork. Shafts are shorter and thinner, and the
source cameras show the reconstructed broad fork silhouettes. The models
omit external supports, as do the engravings, and have no ground plane.

051 now has a solid cross. Its former ring interpretation was not supported
by Brown's thin central web. Plate 6, figure O8 in the 1820 English
Lanz–Betancourt *Analytical Essay* clearly shows a solid cross between
curved forks. Cornell's archived Clark collection editorial note also
suggests a relationship between that figure and Brown's drawings. This
supports the chosen topology, while the exact historical relationship
remains an inference. Sources, the enlarged O8 crop and photograph
provenance are recorded in artifacts/reference/README.md.

Motion is derived from perpendicular trunnion axes at each joint.
051 has the expected twice-per-turn output speed variation. In 050, the
two equal bends and correctly phased middle bearings produce constant
output speed; the middle member and both crosses vary in speed. Independent
trigonometric checks cover four turns, numerical angle derivatives agree
with the reported speeds, and multiple frame steps give identical states.
The chosen bends are 52 degrees per joint in 050 and 54 degrees overall in
051. The input makes one turn in **2 displayed seconds**. The fastest
shafts reach about **0.812** and **0.851 revolutions per second**, respectively.
Dimensions, angles, fits and caps are reconstructed; bearing friction,
elastic stress and external shaft support loads are not simulated.

Actual rendered geometry supplies the mechanical evidence:

- Every rigid solid has closed edges, positive volume and outward normals.
- **050:** 16,941,504 surface checks through 129 poses find **zero** samples
  penetrating another moving member. **051:** 6,887,552 checks find **zero**.
  These use triangle vertices, centers and edge midpoints in both directions
  for every pair of distinct moving members; fixed subparts of one member
  are excluded. This is sampled evidence, not a continuous collision proof.
- Across 257 nonaligned poses per joint, **37,008 rays** pass through the
  actual bearing geometry. Their first hits are the pin and bore skins,
  confirming that the straps do not fill the holes. Minimum radial clearance
  is approximately **0.0009755**, against a nominal 0.001.
- Further axial rays confirm **0.004000** minimum separation between the
  retaining caps and the outer fork faces.

Five dedicated mechanical tests and the existing model wiring checks cover
these changes. Dense reports are in 050-contact.json and 051-contact.json;
reconstruction parameters and final validation results are in the matching
050/051-reconstruction.json files. Five source phases and two oblique views
per joint replace the old comparisons; baseline images remain preserved.
The final build passes, and **all 2,923 numerical tests pass** in 113.2
seconds after the final source-pose registration. **All 11 browser tests
pass** in 9.1 minutes, including the all-507 render sweep, playback/pause/orbit
and mobile controls for both rebuilt joints, the previous rebuilt mechanisms,
catalog navigation and static-subdirectory hosting. The run used one browser
worker and needed no retries or assertion changes. Final logs are
050-051-build.log, 050-051-full-tests.log and 050-051-browser-tests.log.
The gallery contains **192 comparisons**, including the following 052/053
baselines.

## 052 and 053: source comparison and contact baselines

Three phases of each current model are saved beside their source images.
Both original factories are preserved under 052/053-original-factory.txt.
The official page snapshots and enlarged Brown PDF crops are in
artifacts/reference. No 052/053 production changes were made during the
universal-joint rebuild.

052's disk side view, unequal disk thicknesses, shaft lengths and bent
operating lever differ substantially from the present oblique model.
The current handle extends along the upper lever's line rather than
turning approximately a right angle at the pivot. Added support posts
and an oversized floor shadow also depart from the source composition.
An actual-skin probe inside the inserted studs' axial overlap performs
**8,256 rays across 129 locked poses**. The pin-to-hole wall clearance is
**0.039962 to 0.040629**, while the disk faces remain 0.12 apart and the
state reports full torque transmission. The studs are centered in the
oversized holes rather than loaded against a wall. The rebuilt clutch
must derive its engagement phase from real contact and preserve the
necessary take-up. Evidence: scripts/probe-pin-clutch-baseline.mjs and
052-contact-baseline.json.

053 needs the source's large central opening, longer double-clutch body,
short shaft stubs and front-view composition reconstructed. The existing
model compresses the clutch within broad bevel faces and adds prominent
external supports. A baseline probe checks **2,460,640 bevel-surface
samples over 65 poses**, across both mesh pairs and both directions. No
sample penetrates; the closest sampled gap is 0.001971 and the largest
pair minimum is 0.001990. These results concern the bevel skins only;
the clutch, key and selector still need their own contact review. The
old solid input gear's collapsed zero-radius bore contributes 384
zero-area faces. The probe excludes those faces from nearest-triangle
distance calculations and requires every resulting distance to be finite.
Evidence: scripts/probe-reversing-bevel-baseline.mjs and
053-bevel-contact-baseline.json.

A further jaw-only probe during the 052 rebuild checks **7,387,776 surface
samples in 198 fully inserted poses**, covering both driving directions
through three cycles. The opposed jaws remain **0.0313953 apart** while
the old state reports full torque transmission. This matches the clearance
left by teeth centered in the mating gaps, rather than loaded against a
driving flank. 053 therefore needs a real loaded jaw phase and take-up as
well as its proportion changes. The report excludes shafts, keys, gear
bodies and selector hardware; those remain separate review requirements.
Evidence: scripts/probe-reversing-clutch-baseline.mjs and
053-clutch-contact-baseline.json.

## 052: loaded stud contact, common shaft and bent operating lever

The rebuilt clutch follows the source's unequal disk sizes and thicknesses,
short left stub, continuous shaft, grooved collar, turned end knob and bent
operating lever. The left disk has a real sleeve bore around the output
shaft; the right disk and shaft slide together. The stud coupling supplies
their rotational connection. Brown does not detail the internal shaft
connection, so this arrangement is explicitly identified as a reconstruction.
The external drive and support bearings are outside the shown assembly.
The model has a front source view, an oblique inspection view and no ground.

A single rigid bell crank replaces the straight, separately drawn links.
Its perpendicular handle rotates about a bored fixed pivot. A second pin
connects the upper eye to a small bored shoe inside the annular collar
groove. The shoe stays parallel to the groove walls while following the
lever's arc; actual bores and retaining caps make both pivots inspectable.

The studs enter when aligned, then take up the available clearance before
driving. Their loaded phase is computed from the support planes of the
actual 256-sided pin and hole polygons, including the pin's relative
rotation. The chosen phase difference is **0.0117503 radians**. Contact
force uses the normal and torque arm at the actual supporting pin vertex.
The output then rotates with the input, remains driven through withdrawal,
and coasts against a prescribed opposing load once the pins are clear.
One operation advances the output by half a turn; the two opposite holes
allow the next engagement without an angle reset. Engagement is an ideal
rigid impact. Bearing friction, elastic stress and impact deformation are
not simulated. These assumptions and the unshown sleeve construction are
stated in the application and 052-reconstruction.json.

Independent evidence for the final geometry and motion:

- All rigid solids have closed edges, positive volume, nonzero-area faces
  and outward normals. The loose sleeve is hollow; the output disk has two
  real stud holes and a fitted central shaft bore.
- **21,416,862 surface checks through 179 poses** find **zero** samples
  penetrating another moving member. The probe adds 33 times inside the
  brief initial entry and 17 around release, which uniform sampling could
  miss. Every pair of distinct moving members is checked in both directions.
  Fixed subparts of one member are excluded. This is sampled evidence,
  not a continuous collision proof.
- **774 loaded-contact rays** through three engagements find a gap of
  **0.000011763** between the actual pin and hole skins along the line of
  their eccentric centers. The minimum support-plane clearance is 0.000005.
  This replaces the old all-around gap of about 0.04.
- **6,837 hardware rays** find minimum sleeve clearance **0.002974**,
  main-pivot clearance **0.000994**, shoe-pin clearance **0.000995**,
  shoe-to-groove-wall clearance **0.000009978** and cap clearance **0.005000**.
- Four cycles of independent motion checks verify continuous one-way
  output angle, angle derivatives, load balance, rigid perpendicular lever
  arms and half-turn advancement. Frame steps from zero through 0.4 seconds
  give identical states at a common time.

The final hardware inspection added a rear cap to retain the selector shoe
on its pin. The cap has 0.005 clearance behind the shoe and clears the
collar's groove floor; both are covered by the updated actual-skin checks.
Five dedicated mechanical tests pass, and **all 2,928 numerical tests pass**
in 114.6 seconds after that addition. The browser sweep and final-build
control verification are recorded in 052-reconstruction.json. The full
browser run passed **all 12 tests** in 9.6 minutes, including all 507 model
constructions, before the rear cap was added. Afterward the final build
passed in 8.4 seconds, and 052's playback, pause, orbit and mobile test
passed again in **10.2 seconds** against that build. The final numerical
suite and geometry probes also include the rear cap. No assertions were
relaxed and no retries were needed. Final logs are 052-final-build.log,
052-final-full-tests.log, 052-browser-tests.log and
052-final-browser-tests.log. Six source phases and two oblique views are
saved for 052.
The displayed operation takes **2 seconds**, with both the driving disk
and output shaft limited to **0.5 revolutions per second**. The gallery now
contains **197 comparisons**.
The original factory and baseline contact report remain preserved; three
baseline views were reproduced from that saved factory after the rebuild.

**037 remains mechanically unresolved; 053 onward remain pending.**

## 053: triangular reversing clutch and compact bevel train

Rebuilt 053 from the enlarged Brown scan and the official source page. Its
three equal bevel gears now have short conical tooth faces, a large central
opening and short shaft ends. The central clutch has the long waisted body
and triangular crown outline visible in the engraving. A bent selector
operates a pivoted shoe inside the groove; its main pivot, shoe pin and
control-rod pin have real bores and retaining caps. Both horizontal gears
turn on clearance bores around a common feathered output shaft.

The old four-dog clutch declared torque transmission with about **0.0314**
clearance at the nearest opposing skins. In the new construction, each of
12 triangular teeth reaches its loaded flank. Their slope requires a small
camming rotation while the sleeve moves axially. The model derives that
rotation from the available face gap and includes the selector's axial
holding force. Drive and selector power balance output power; the tooth
force remains compressive through insertion and withdrawal. The output
coasts to rest before engaging the opposite gear. Initial engagement is
an ideal rigid impact, with its angular impulse recorded.

The source does not specify the exact tooth counts, internal flank shape,
fits, selector joints, inertia or load. Those are reconstruction choices,
recorded in 053-reconstruction.json and the application's mechanical note.
The triangular flanks are helicoidal surfaces approximated by a radial
and angular mesh with small numerical clearance. Elastic stress, impact
deformation, bearing friction and manufactured bevel conjugacy are not
simulated. This does not claim an engineering production design.

Independent evidence for the final geometry:

- **968,518,924 surface checks through 229 poses** find **zero** penetrating
  samples among all 45 pairs of the ten member groups, in both directions.
  The poses include 33 initial-entry samples and 17 around release for
  each driving direction. Fixed subparts of a rigid member are excluded.
  This is sampled evidence, not a continuous collision proof.
- **74,304 crown-contact checks through 258 loaded poses** find a minimum
  gap of **0.00003744** and a largest per-tooth nearest gap of **0.00004172**.
  Every tooth is checked in both directions against actual opposing triangles.
- **6,976,320 bevel-surface checks through 129 poses** find no intersections.
  The nearest gap ranges from **0.00005404** to **0.00008125** over the two
  meshes and both probe directions.
- **4,355 hardware rays** find minimum loose-gear clearance **0.004996**,
  key-wall clearance **0.00001000**, main-pivot clearance **0.000999**,
  shoe-pin clearance **0.000799**, rod-pin clearance **0.000999**,
  shoe-to-groove-wall clearance **0.00001000**, and cap clearance **0.004000**.
- Every rendered rigid solid has closed edges, positive volume, nonzero-area
  faces and outward normals. Four cycles verify motion derivatives, torque
  balance, cam power, rigid lever geometry and frame-step independence.

Six 053 tests and the eight shared 048 jaw-clutch regressions pass. The
production build passes in **8.43 seconds**, and all **2,934 numerical tests**
pass in **114.9 seconds**. All **13 browser tests pass in 9.7 minutes**
against that final build, including every 507 model construction, 053
playback/pause/orbit/mobile controls, and static-subdirectory hosting. The
logs are 053-full-tests.log and 053-browser-tests.log; no retries or
weakened browser assertions were needed.
The outer npm command later returned exit 143 despite its complete passing
TAP, and an interactive direct rerun was also terminated. The same complete
suite was then run in a separate process with eight workers: all **2,934
tests pass in 106.1 seconds**, with explicitly recorded **exit code 0** and
no signal. The final numerical evidence is 053-numerical-exit-check.log and
053-numerical-exit-status.json. Production code and test assertions did not
change between these runs.
The complete operation takes **2 seconds** at default speed. The input
turns at **0.5 revolutions per second**, and the cammed output peaks at
**0.588 revolutions per second**. Six source views and two oblique views
are saved. Concentrating this small model's shadow map around the assembly
makes the tooth shadows crisp instead of blurring them into sleeve ripples.

## 054–055: next source comparisons

Saved the official pages, larger unchanged Brown scan crops, original
factories and three baseline views apiece. These have not been corrected.
054 currently has a large opening through both rims, round rim sections,
straight spokes and an oblique starting view. Brown shows a nearly complete
wheel with flat rim faces, waisted spokes and a small H-shaped piece at A.
An independent baseline probe finds **38,821 penetrating samples in 169,900
checks**, with depth up to **0.213868**, between its wheel pins/webs and the
pinion through 129 poses. Its uncapped open rims are excluded as inside-test
targets. The exact crossover construction needs investigation. 055 has a thick
pinion and thin exposed ring spokes absent from its engraving. A support-only
probe finds **184 penetrating samples in 78,432 checks**, up to **0.041175**
deep, where the rotating ring spokes pass through the pinion hub. Its
internal/external tooth contacts still need independent checking.
The gallery contains **208 comparisons**, including these uncorrected baselines.

**037 remains mechanically unresolved; 054 onward remain pending.**

## 054 rebuilt and verified

The right-angle mangle now has radial generated teeth, four waisted spokes,
a bored hub, a short input shaft and a captured crab guide. The source
stroke pitch supports 32 wheel positions. The shifted four-tooth involute
pinion keeps the small source outline; its contact map determines wheel
motion while the input rotates continuously. Two opposed guide faces keep
collar reactions compressive through reversal. Those guide sections and
the input bearing beyond shaft B are explicit reconstruction inferences.

The loaded model passes **41,869,586 bidirectional tooth checks through
195 poses** and **252,779,008 hardware checks through 99 poses**, with no
penetrating samples. Independent exact triangle distances at 48 positions
find gaps of **0.0000216–0.0000270**. All **23 unique solids** have closed
oriented edges, positive volume and outward normals at every triangle
corner. A 38-pose quasistatic force check uses only compressive tooth and
selected-guide reactions; its power residual is at most **0.41%**.

The full cycle requires sixteen input revolutions and displays in **16
seconds**. Source and oblique views have been inspected. The gallery now
contains **211 comparisons**. The original factory, false-positive pitch
identities and failing prototypes remain archived.

**All 2,941 numerical tests pass with exit code 0; the build and all 14
browser tests pass**, including all 507 canvases and the new 054 controls
check. Headless browser tests now run serially to avoid shared software-WebGL
contention; the earlier parallel timeouts and traces are preserved.
Full evidence: artifacts/review/054-reconstruction.json.

### 055 — rebuilt and verified

The coaxial train now uses source-proportioned **17/10/37 teeth**, common
25-degree involutes, and two independently rotating concentric outputs.
The ring's hidden support is an inferred cup web and bored sleeve; the
input shaft ends ahead of that web. Short shaft ends and a shallow assembly
replace the old overhangs and intersecting rear spokes.

Both working flanks retain **0.0000246–0.0000382** clearance in 2,049 exact
contour checks per pair, with no intersections. The contour method agrees
with independent triangle-distance measurements. All seven solids pass
closed-edge, volume, face-area and corner-normal checks. A 97-pose hardware
sweep performs **38,887,646** surface checks with no penetration. The input
runs at **0.5 revolution/second**; outputs A and C take 3.4 and 7.4 seconds
per revolution.

**All 2,945 numerical tests, the build, and all 15 browser tests pass**,
including all 507 canvases and the new 055 controls check. The final source
and oblique captures are inspected; the gallery contains **214 comparisons**.
Evidence: artifacts/review/055-reconstruction.json. An interactive source
contour overlay is in artifacts/review/055-source-alignment.html. It shows
the remaining differences between mechanically compatible involutes and
the engraving's schematic tooth shapes and spacing.

056 is rebuilt and integrated with a traced foreground headstock and eccentric
slot, 38/12 generated involutes, a bored sliding bearing and a correctly ordered
three-step pulley. Both shafts stop before each shift, and the pinion turns
alone while disengaged. Default playback is 4.1533 seconds per complete cycle.
Its 2,049-pose tooth sweep and 1,026-pose full-cycle sweep have no crossings;
97 hardware poses cover 85 pairs and 62,754,548 samples without penetration.
The 130-pose cam check transmits compressive power in both directions, and all
16 meshes are closed with outward normals. Build and all **2,950 numerical
tests pass**, and all **16 browser tests pass** with one worker, including the
complete 507-scene canvas sweep. Source residuals and the
inferred operating sequence are documented in artifacts/review/056-reconstruction-notes.md;
its actual-mesh overlay is artifacts/review/056-source-alignment.html. The gallery
now contains **220 comparisons**.

057 is rebuilt and verified. Its
18/10/34 custom involutes share base pitch and use different operating pressure
angles at the two meshes. Both pass 2,049 actual-contour contact phases with no
crossings. The corrected carrier runs between the rear sun drum and gear faces;
the ring has an inferred external annular bearing. A 97-pose, 128-pair audit
passes **997,119,928 bidirectional surface checks** with no penetrations. All
18 meshes have closed outward surfaces, and exact triangle checks retain small
positive gaps at both gears, four pulley contacts and the crossed cords.

Indexed source outlines favor 18/10/34, and the source overlay records remaining
involute-versus-schematic tooth differences, shorter sun tips and the crossed
band's rear passage behind the ring. The pinion spins once per second at default
speed; the near-cancelling differential gives a **174.4-second carrier orbit**.
The build, five focused mechanical tests, all **2,955 numerical tests**, and all
**17 browser tests pass**, including all 507 canvases. Both full-suite wrappers
report exit code 0 with no signal. All six source/oblique comparison frames and
the rear view are inspected; the gallery contains **226 comparisons**. Evidence
is in artifacts/review/057-reconstruction.json and its reconstruction notes.

058 is rebuilt and verified. Brown's
side elevation now aligns with the larger smooth pulleys, expanded gear spacing
and negative-x camera. A real flat band traverses four equal pulleys through
stopped shifts. Three 17/39, 26/30 and 40/16 involute pairs share a common output;
unselected inputs back-drive through genuinely bored nested sleeves. The counts
are compatible proportion estimates, not tooth counts specified by Brown.

Both torque flanks pass 2,049 phases per pair with no contour crossings and
24.142–27.522 microunits of clearance. A 97-pose, 117-pair hardware audit performs
**142,209,744 bidirectional surface checks** with no penetration. Independent
3D triangle checks confirm six gear contacts and fourteen band/tread contacts,
including both adjoining pulleys during traversal. All 17 solids are closed
with outward normals. Seven focused tests and the build pass. Default playback
is **14.7572 seconds** for the complete selector demonstration. All six final
source/oblique captures and the source overlay are inspected; the gallery now
contains **232 comparisons**. Evidence is in artifacts/review/058-reconstruction.json
and its reconstruction notes. All **2,962 numerical tests** and all **18 browser
tests pass**, including all 507 canvases and the new 058 controls check. Both
full-suite wrappers report exit code 0 with no signal.

059 is rebuilt and verified with 12/42 and 45/9 ordinary 30-degree involutes,
real independent bores, three smooth lower pulleys and a flat traversing band.
Both gear pairs pass 2,049 samples on each actual load flank over complete
relative tooth cycles: no crossings and maximum normal-force power error
0.317 percent. All 13 solids are closed with outward normals. A 97-pose,
66-pair hardware sweep has no penetration in 97,609,164 samples, and fourteen
independent 3D contact checks pass. The source overlay's measured residuals
are within 7.66 scan pixels. The old shared selector factory and 059 test are
archived; the production factory is removed after exact archive comparison.

Five focused mechanical tests, the build, and all **2,967 numerical tests**
pass. Default playback is **15.0095 seconds** per complete demonstration,
preserving the quick-mode 17.5-times back-drive of the small input gear.
All six integrated source/full captures are inspected; the gallery contains
**238 comparisons**. All **19 browser tests pass**, including all 507 canvases
and the new 059 controls check. Both full-suite wrappers report code 0 with no
signal; the browser run uses one worker and takes 754.558 seconds.
Evidence: artifacts/review/059-reconstruction.json and its reconstruction notes.

060 is rebuilt and verified with two permanent flat bands, source-sized pulleys, the exposed
shaft gap between lower banks and independently rotating loose pulleys. All
measured body/shaft outlines lie within seven scan pixels. Across 97 poses,
39 independent hardware pairs give 49,976,460 surface samples with no
penetrations; all 24 independent triangle-contact gaps are positive. Five
focused tests, the build and all 2,972 numerical tests pass. All six integrated
source/oblique frames are inspected; the gallery has 244 comparisons. All
20 browser tests pass, including all 507 canvases and the new 060 controls
test. Both full-suite wrappers exit zero with no signal (137.471 seconds for
numerical tests, 768.349 seconds for browsers).
Evidence: artifacts/review/060-reconstruction.json and reconstruction notes.

061 is rebuilt and verified with a compact differential enclosed in hollow source-sized
pulleys, real independent bores, a flat selector band and a flat weighted
friction curb. Section view exposes the hidden 26/20-tooth bevel train;
complete view preserves its physical enclosure. All 19 physical geometries
are closed with outward normals. A 97-pose, 153-pair sweep finds no
penetration in 171,138,216 samples. Four 129-phase directional mesh checks
find working gaps of 37.035–40.295 microunits and maximum pairwise contact-normal
power residual below 0.211 percent. All 61 exact contact/hardware rows and
motion checks pass. Measured source outline residuals are within nine scan
pixels. Five focused tests pass; all six integrated frames are inspected.
Playback takes 4.480 seconds per full demonstration; the gallery has 250
comparisons. All 2,977 numerical tests pass after restoring the legacy
constructor that 062 still depends on. All 21 browser tests pass, including
all 507 canvases and the new 061 controls check. Both wrappers exit zero
without a signal (141.701 seconds numerical, 795.392 seconds browser); the
build passes in 9.88 seconds. The first run's six numerical failures and one
browser sweep failure all had that missing-constructor cause, now repaired.
Evidence: artifacts/review/061-reconstruction.json and reconstruction notes.

062 is rebuilt and verified with four source-sized lower pulleys, two permanent flat bands
and a compact enclosed 34/20-tooth differential. An accessible configuration
select installs the auxiliary band open or crossed and restarts the demonstration.
The output subtracts or adds that side input in carrier mode. Neutral and shifts
explicitly stop the input; free differential dynamics are not assumed. Section
view exposes the enclosed train without changing physical mesh transforms.

Both configurations have 19 closed physical geometries with outward normals.
Their 97-pose, 152-pair hardware sweeps perform **437,678,550 total surface checks**
with no penetration. Eight directional mesh sweeps cover **1,032 loaded-flank
poses**, with 31.762–33.882 microunit working gaps and maximum contact-normal
power residual below 0.181 percent. All 145 exact triangle contact/clearance rows
pass, including the entire crossed free spans. Motion checks include 14,286
actual neutral-curve wrap samples. All 12 measured body/shaft source residuals
are within 13.5 scan pixels. Both obsolete legacy factories are archived and
removed; rebuilt 061 is unchanged.

All seven new 062 mechanical tests pass within the full **2,984-test numerical
suite** (wrapper code 0, no signal, 186.972 seconds). The build passes in 9.22
seconds. All **22 browser tests pass**, including the new configuration/section
controls test and all 507 canvases (wrapper code 0, no signal, one worker,
820.313 seconds). Both configurations set
the measured bounds and speed limits, giving a **4.7745-second** displayed cycle.
All twelve integrated source/complete frames, both overlays and desktop/mobile
controls are inspected; the gallery includes **262 comparisons**. Evidence:
artifacts/review/062-reconstruction.json and reconstruction notes.

063 remains mechanically unresolved; its production model is unchanged.
The official page has no animation. A scoped actual-surface probe at 309 poses
across three pin events confirms the active-pin identity but finds large gaps
where the existing animation flags claim contact: 0.171–0.394 between pin/drop
and 0.259–1.102 between pin/pawl. The pawl intersects the star throughout every
claimed engaged sample, and the striker, drop and pivot constructions also
need correction. The source's overlapping drop/pawl outlines and pivot anatomy
are being resolved before selecting a replacement. Evidence is in
artifacts/review/063-contact-baseline.json; factory, helpers and tests are archived.
All four baseline frames and three provisional source tracing overlays are
inspected. The initial fixed-upper-pivot planar study tracks a connected contact
branch across three pin events, but omits the star and cannot establish indexing.
The upper pawl joint moves with the spring-carried drop. Subsequent moving-hinge
studies include the star, finite pins and striker, and explore support, cam and
tooth geometry. None establishes repeated one-tooth advance. The simplified
solver omits some hinge/contact force coupling and a two-flank seated nose
constraint; clear sampled poses alone are not a working-mechanism result.
Corrected reverse-direction studies also fail indexing. Spon's figure 3186
repeats the source anatomy without resolving support dimensions. Sam Gallagher's
written reconstruction account is saved; his animation could not be retrieved
and was not inspected. Its failed-download placeholder is labeled accordingly.
The baseline itself finds 57,637 penetrating samples in 4,130,124 checks.
See artifacts/review/063-reconstruction.json and reconstruction notes.

064 is rebuilt and verified with a source-traced bored cam, finite pin and
half-cut sleeve, pivoted rolling follower, fitted constant-length curved leaf
spring and a conjugate cylindrical-worm-generated wheel. The spring releases
the cam dynamically; it settles before the pin catches. Maximum relative lead
is 2.403560 radians within the finite cut's 2.761272-radian allowance.

All 20 parts have closed outward surfaces; the deforming spring has five more
checked poses. The 104-pose, 165-pair complete hardware sweep and 65-pose loaded
worm sweep perform **335,677,456 combined surface checks with no penetration**.
Worm contact-normal power residual stays below 1.168 percent. Independent
spring energy/work, fixed-root/neutral-length, rolling contact, catch impact,
and time/contact-table convergence checks pass. The initial worm refinement
inherited a spherical cutter bound; the corrected cylindrical bound is verified
by a doubled-resolution generating study.

The current source comparison covers 86 boundary readings and three centers.
Maximum marked residuals are 3.752 pixels for the cam, 6.333 for the spring
stem, 5.124 for the lever, 10.745 for the regularized curl and 20.521 for the
regularized wheel teeth. The engraving does not establish an exact tooth count;
24 is a construction choice. Ten integrated source/complete views are inspected,
and the gallery has 272 comparisons. Playback takes 24 seconds per wheel cycle
to keep the visible worm at one revolution per second. The unmarked circular
roller retains its physical no-slip spin while its invisible symmetric axial
rotation is excluded from visible-speed measurement.

Seven focused tests pass. The first full numerical run passed 2,989 of 2,990:
a new visibility test incorrectly rejected a uniform vertex-color attribute.
That assertion is corrected; the initial complete 2,990-test and 22-browser-test
runs pass. Final mobile inspection then found a shared camera resize/reset bug:
aspect changed without fit distance, and reset retained drag inertia. Resizing
now preserves orbit, pan and relative zoom at the new fit distance; reset fits
the current viewport and clears pending inertia. Narrow-field views allow more
zoom-out room. Desktop, mobile, zoomed orbit and source overlay are inspected.
Two actual-vertex/reset tests and a rendered-foreground browser test cover the
failure. The rebuilt app and all **2,992 numerical tests pass** (code 0, no signal,
241.334 seconds). All **23 browser tests pass**, including all 507 canvases and
the new mobile/reset test (code 0, no signal, one worker, 865.566 seconds). Final evidence
is in artifacts/review/064-reconstruction.json and reconstruction notes.

**031's reopened worm audit is repaired, integrated and verified.** The
shared spherical cutter bound and neighboring-cell erosion are replaced by the
continuously refined cylindrical generator. Source inspection favors 29
regularized teeth over the earlier 30; the starting phase, shaft overhangs and
shaft thickness now follow that source fit. The unchanged Brown scan comparison
covers 71 boundary readings, with maximum errors below 23.736 pixels for the
wheel, 21.359 for the worm, 5.799 for the shaft and 4.001 for the hub. Tooth count,
pressure angle and hidden dimensions remain reconstruction choices.

The final 65-pose worm sweep and eight-pair hardware sweep perform **259,692,596
combined surface checks with no penetration**. Working gaps are 6.054–14.616
microunits; actual contact-normal power residual stays below 1.252 percent. All
six physical solids are closed with outward normals. Doubling the generating
search changes the radial field by at most 3.56e-15. Exact mesh/transform equality
connects the audited candidate to production; a new test reproduces the stored
profile through the runtime fallback. Other contact tables remain byte-identical.

All four focused worm tests and the model kinematics test pass; the build passes
in 12.369 seconds. Six integrated source/oblique frames and the final overlay
are inspected. Playback takes two seconds per input turn and 58 seconds per
complete wheel revolution. All **2,994 numerical tests pass** (code 0, no signal, 267.253 seconds). The
full browser run passes 23/24, including all 507 canvases and 031 controls.
057 hits its 45-second overall timeout during mouse movement, then passes
unchanged on isolated rerun in 29.8 seconds (wrapper code 0, no signal, 31.331
seconds). The initial full-run failure/exit/trace are preserved; this is combined
passing coverage rather than a zero-exit claim for that full invocation. Both
desktop/mobile frames are inspected. See
artifacts/review/031-reconstruction.json and reconstruction notes.

065 is rebuilt, integrated and verified. Its rounded tapered tappet advances ten regularized studs
one pitch per turn and finishes each index at rest. The source-shaped stop
has two finite locking flanks, a bored pivot and a sharp cam-contact corner.
A rear foot reaches the input notch while the main stop and tappet occupy
separate axial layers. Unrelated rails and face rings are removed.

All 22 solids are closed and outward. The final 94-pose, 143-pair sweep checks
**41,110,054 surface samples without penetration** beyond the 1e-6 tolerance.
Actual triangle-contact checks pass at 65 indexing poses and ten locked
orientations, with positive quasistatic reactions and no free velocity
direction in the dwell constraints. Maximum normal relative-speed residual
is 0.001822 model units/s. Initial strike impulses, loaded inertia and shaft
bearings remain idealized. Earlier rounded-toe contact loss, toe-foot
interference and mesh topology failures are archived with their failed results.

The inspected Brown overlay covers 77 boundary points and ten stud centers.
Maximum errors are 27.465 pixels at the cam, 22.940 at the tappet, 8.047 at the
stop and 6.055 at the output rim in the 1400-pixel crop. The irregular source
pattern is regularized; exact superposition is not claimed. A five-second
input cycle leaves about 0.398 seconds for the short indexing action.

All **six focused tests and 3,000 numerical tests pass** (full command code 0,
no signal, 235.987 seconds); the build passes in 12.429 seconds. Exact mesh
buffers and five pose transforms connect the audited candidate to production.
Nine integrated source/oblique frames are inspected; the gallery contains
284 comparisons. All **25 browser tests pass**, including all 507 canvases and the new 065
controls test (13.3 seconds). The full invocation exits 0 with no signal in
896.673 seconds, with no retries. Desktop and mobile captures are inspected. See
artifacts/review/065-reconstruction.json and reconstruction notes.

066 is rebuilt, integrated and verified. Its source-sized gravity weight, finite pin and
half-cut sleeve now use energy-balanced gravity/drag dynamics with exact
release/catch events. A fitted 26-tooth generated wheel and shifted solid
worm replace the old 20-tooth wire-worm arrangement. All **3,009 numerical
tests and 26 browser tests pass**, with no retries, along with the build. The 65-pose worm sweep passes 92,228,630 surface samples,
positive contact torque and a 1.494% maximum force-power residual. Complete
hardware and source-fit evidence is recorded in the 066 reconstruction notes.
Ten integrated frames, the source overlay and desktop/mobile views are
inspected. Complete hardware and worm sweeps total 448,000,888 sampled
checks without penetration. The four baseline images are preserved as
066-original-phase files; the current gallery has 292 comparisons.

067 is rebuilt, integrated and verified with a source-shaped scalloped plate,
finite pin and half-cut sleeve, event-resolved gravity motion and generated
24-tooth worm drive. All ten focused tests, **3,019 numerical tests and 27
browser tests pass**, along with the build. The complete candidate has
437,633,078 sampled hardware/worm checks with zero penetration; force and
energy audits pass. The common source overlay, ten integrated views and
desktop/mobile frames are inspected. Exact buffers and eight pose transforms
connect the audited candidate to production. The browser invocation exits 0
with no signal or retries in 960.355 seconds. Interrupted initial numerical
and build logs are preserved alongside successful rerun records. The gallery
contains 298 comparisons at the 067 checkpoint.

068 is rebuilt, integrated and verified. All **3,026 numerical tests and 28
browser tests pass**, along with the build. The browser invocation exits zero
with no retries in 970.409 seconds, including all 507 rendered canvases.
The replacement uses a traced tapered tooth, ten U notches and circular
locking hollows. All six solids pass topology and normal checks. Exact
buffers and ten pose transforms match the audited candidate. The corrected
motion passes **42,701,508 actual surface checks** over 83 poses and all
nine moving-part pairs, with no penetration above 1e-6. All 136 active
contact-force poses and twenty locking poses pass. Both load directions at
all ten notches clear at their seats and block attempted overtravel.

An exact entry knot prevents drift before contact; refinement keeps the
peak speed at 1.9517 rad/s. The four-second input cycle gives about 0.476
seconds for the index. Resisting load, bearing resistance and engagement
impacts are explicit quasistatic assumptions; unloaded coasting is not
certified. All seven focused tests pass. Ten integrated front/oblique frames,
the source overlay and desktop/mobile views are inspected. Earlier failed candidates and the
four original baseline images are preserved. Source-fit errors and detailed
evidence are in artifacts/review/068-reconstruction-notes.md.

The 068 checkpoint includes 314 gallery comparisons. Earlier inspected UI
images are preserved; fresh regression copies are archived separately.
At the 068 checkpoint, all 770 files matched its verification snapshot.

069 is rebuilt, integrated and verified with thirty asymmetric teeth and the
broad source-traced driver. All **3,034 numerical tests and 29 browser tests**
pass, with no retries, along with the build and eight focused tests. The full
browser run exits zero in 977.903 seconds, including all 507 rendered canvases. All six solids pass topology checks.
The actual sweep passes **38,176,776 surface checks** over 86 poses and nine
moving pairs. All 124 drive-force cases and 60 locking-force cases pass;
both seats at all thirty teeth clear and block attempted overtravel.

The final locking transition is resolved from actual Float32 rim-junction
contact, closing the two-tooth index exactly. A three-second input cycle gives
about 0.813 seconds for the index. The short internal pause assumes passive
bearing resistance, with a resisting load and idealized engagement impacts.
All ten integrated front/oblique frames and both candidate source overlays
are inspected. The complete 201-reading source fit has a largest residual
of 28.066 pixels on the 1150-pixel-wide Brown crop. Details, earlier failed
trials and reference limitations are preserved in the 069 reconstruction notes.
Both desktop/mobile captures are inspected. At the 069 checkpoint, all 775
verification files matched and twelve historical UI images were restored from verified backups.
The 069 checkpoint contains 324 comparisons, including failed baselines.

070 is rebuilt, integrated and verified; all eight focused tests,
**3,042 numerical tests, 30 browser tests and the build pass**. The full
browser invocation exits zero without retries in 1,007.116 seconds, including
all 507 rendered canvases. Both desktop/mobile captures are inspected. The source
arrangement has one stud inside the rim and adjacent studs locking against
its exterior. The measured circles and traced tappet need only a 1.103-pixel
spacing change and a 1.486-pixel tip adjustment. Closed-form contact events
give one exact 36-degree step per turn, including a short resisted pause
before final rim seating. All eighteen solids pass topology checks.

The full 070 sweep passes **452,216,700 actual surface checks** over 117
poses and 65 moving pairs without penetration above 1e-6. All 189 active
force cases and twenty locking-force cases pass. All twenty seats clear
and block attempted overtravel. The common source overlay retains 153
readings; the largest residual is 35.710 pixels at a stud center. Ten
candidate and ten integrated views plus the overlay are inspected. A
five-second cycle gives a 0.512-second main stroke. Original failed models
and coarse-stud trials are archived. All 780 verification files match, and
fourteen historical UI images are restored from verified backups. The 070
checkpoint contains 334 comparisons.

071 source, numerical and rendered baseline diagnosis is complete. Its current factory
is unchanged. The 44-pair working-surface sweep finds 2,813 penetrating
samples among 14,216,800 checks, including a guard/stud collision. All 97
claimed drive-force poses have the wrong output moment. The source has ten
marks on the main stud orbit and an additional inner circular mark whose
role remains unresolved. All 25 initial three-interior-stud opening trials
require disconnected motion and are rejected. Four baseline 3D frames are
inspected and hashed; the gallery now has 338 comparisons. Both official
070 and 071 animation tabs are unavailable.

071 remains mechanically unresolved after additional finite-pin studies. The
upper guard blocks the entering stud; source-like angled notches also jam.
Extra-pin, spacing and tip variants do not establish a valid replacement.
Fine long-tip projection exposes overdrive and high peak speed, not acceptance.
Detailed results and their limits are retained in its reconstruction record.

**037, 063 and 071 remain mechanically unresolved. 031, 064, 065, 066, 067,
068, 069 and 070 are verified. Review continues at 072; the complete
507-movement review remains active.**

072 now has a source-shaped isolated candidate; it is not integrated. Its
baseline sweep finds 3,990 penetrating samples in 38,555,868 checks. The
replacement uses four measured circular cam flanks, a finite rounded nose,
gravity release, the shaped hammer/workpiece and a supported blind pivot.
All fifteen solids pass topology checks. The complete candidate sweep passes
392,126,508 samples over 146 poses and 68 moving pairs without penetration
above 1e-6. All 192 physical contact-force cases pass. Rendered mass properties
match the motion model; the cycle energy residual is 3.17e-9 per unit mass.

The common 169-reading source fit has a maximum error of 14.388 pixels on the
1910-pixel crop. Eight baseline frames, nine candidate views and the overlay
are inspected. Failed event-classification and force-differentiation checks
are preserved with their corrections. All 780 files from the verified 070
production snapshot still match. Runtime export, integration, dependent tests
and full regression remain pending. See 072-reconstruction.json and notes.

072 is now rebuilt, integrated and verified. The runtime preserves all fifteen
audited mesh buffers and 1,245 gravity knots, while replacing startup polygon
union and integration with exported contours and exact contact equations.
The registry comparison covers 10,076 poses and all nine inspected candidate
transforms. Movement 353's dependent comparison is migrated. All sixteen
focused tests, **3,050 numerical tests**, the production build and **31 browser
tests** pass. The browser run renders all 507 movements with one worker and
no retries. All **785 verification source hashes** match after the run.

Eleven integrated 072 views, desktop/mobile controls and a scrolled mobile
notes view are inspected. Sixteen historical UI images are restored from
checked backups, with this run's replacements archived separately. Display
timing is three seconds per blow and twelve seconds per full cam revolution.
The prior candidate-only review and initial runtime join-boundary failure
remain archived. See 072-reconstruction.json and 072-reconstruction-notes.md.

073 baseline diagnosis now requires reconstruction. The enlarged source has
**ten ratchet teeth**, while the current factory and tests require eight.
The 174-pose working-surface sweep finds **2,209 penetrating samples** in
**5,069,142 checks**: each spring enters the opposite contact pad. At all 55
indexing force samples, the prescribed B/C contact normal is purely axial and
cannot provide the imposed in-plane deflection under frictionless contact.
Selected actual spring-skin distances also show a 0.00211075 gap at declared
pressing contact. The catch pad itself has the correct ratchet-driving force
sign. Six baseline frames are inspected and preserved.

073 has an isolated ten-tooth circular-flank profile and measured spring
centerlines. Its upper source flank fits thirty readings to 0.558-pixel RMS;
the driver circle fits twenty-nine readings to 2.166-pixel RMS. The source
animation is unavailable. Initial readings that hit lettering and an initial
biased spring centerline are preserved with their refinements. The original
profile study does not constitute a 3D replacement.

073 now has a coupled elastic/contact study with a source-fitted continuous
spring taper, independently checked gradients, and separate reactions on both
sides of a tooth seat. The selected planar leaf layouts lose wheel restraint
near release, even with C four times stiffer. Fixed-wheel diagnostic solves
confirm both tips clear the wheel's entire circumcircle after release, with
beam residuals below 1.49e-7. This is an unresolved 3D arrangement, not an
accepted replacement. Failed studies and cancelled superseded runs are
preserved in 073-elastic-checkpoint.json. All 785 verified production hashes
still match. Source review proceeds to 074 while 073 remains open.

074 baseline reconstruction is now required. Eight inspected source/comparison
frames show overly broad bevel faces, a missing central opening and long
shafts meeting at the common apex. The corrected 291-pose sweep finds
**14,340 penetrating gear samples in 8,652,012 checks**, with maximum depth
0.0546630, as C enters the still-stationary output. All three shaft pairs
intersect, producing another **316 penetrating samples**. Zero-area pole
triangles are excluded from the independently checked closed query boundary;
the earlier nonfinite-distance report and shaft-group probe failure are
preserved. Source tooth counts and pitch-cone ratios, a candidate rebuild
and physical entry/exit geometry remain pending. See 074-reconstruction.json
and 074-reconstruction-notes.md.

074 now has an isolated fitted contact candidate. Twenty source landmarks
fit to **12.168 pixels RMS**; a direct engraving overlay and the 3D views are
inspected. Its 32/40 tooth counts balance local tooth spacing and global rim
proportions; they are not claimed as exact source counts. Separate face
widths, short integral shafts and conical heel/toe surfaces restore the large
opening. Four end teeth receive contact-envelope relief.

All **87 solids** pass the closed-boundary and normal audit. The contact solve
completes three repeatable cycles, with local release maxima refined so a
receding flank does not drive the output. **93 force samples** have compressive
reactions with the correct moment ratio. Complete sampled hardware checks
and their exact counts are in 074-candidate-checkpoint.json. The ideal dwell
uses bearing friction, not a positive lock. At that candidate checkpoint,
runtime interpolation and final integration/regression remained pending.

074 is now **rebuilt and verified**. Its 5,047-knot runtime profile agrees with
20,184 independent contact solves to 3.1203e-7 radians. The actual interpolated
skins pass another **31,202,640 checks at 246 poses**, with no penetration over
1e-6. All 87 exported mesh buffers and world transforms match the audited
candidate, including 4,124 arbitrary times. Eleven integrated model views and
three UI frames are inspected. Input rotation takes eight display seconds.
Seven focused tests, **3,056 numerical tests**, the build and **31 browser
checks** pass against 789 frozen source hashes; all 507 entries rendered.
Eighteen historical UI screenshots were restored after saving the fresh
regression copies. See `074-integrated-checkpoint.json`.

075 requires reconstruction. The source shows a curved moving pawl and a
separate fixed holding pawl; the model instead has a large counterweight and
explicitly omits the holding pawl. The selected 102-pose audit finds **56,870
penetrating samples in 794,758 checks between independently moving parts**.
The rod pin enters the solid bar beneath a painted slot, and the carrier-hub
bevel shrinks its bore below the axle radius. The nominal ratchet bore also
degenerates to two XY points. Its co-rotating wheel/shaft overlap is recorded
separately as a possible integral join. Source tip readings and gravity-closing
directions are documented; exact tooth count and complete pawl contact remain
unresolved. Eight baseline mechanical views are inspected and preserved.
The baseline diagnosis is preserved in `075-reconstruction.json`.

075 is now **rebuilt and verified**, with both curved pawls, a real radial
slot and correctly bored joints. Its 14 finite solids pass topology checks;
21,004,344 independent-family surface checks find no penetration over 1e-6.
A further 1,028 finite-contact poses have maximum gap 6.5615e-7. The loaded
quasistatic model uses contact friction and omits inertia. Its 34-tooth profile
regularizes the drawing, and its cycle takes 2.4 seconds. Seven focused tests,
3,062 numerical tests, the build and all 31 browser checks pass against 794
frozen files. All 507 entries rendered. Thirteen integrated mechanical and UI
views are inspected; the eighteen historical screenshots were restored after
preserving fresh regression copies. See `075-integrated-checkpoint.json`.

076 is rebuilt and verified. Its complete coaxial driver turns clockwise,
its twenty-tooth count wheel turns counterclockwise, and its curved working
and holding pawls use actual bored joints and finite stops. The source pose
is the initial released condition; later turns start at the physical rest stop.
A twelve-second displayed revolution settles one tooth ahead after inertial
overtravel. The full driver and capped engraving section are both available.

Its 24 solids and mass/contact formulas pass independent checks. Three
simulated strikes count three teeth; loads 2 through 5 count one tooth per
revolution. The cache has a continuous primary-contact interpolation bound
within 1e-6, including all twenty tooth orientations. The production all-pair
screen covers 228 pairs, 207 poses and 54,642,530 actual surface samples with
no penetration beyond 1e-6. All 72 buffers and 44,150 poses match the candidate
exactly. Componentwise convergence failures remain recorded; a separate
assessment bounds the finest-step displacement difference by 0.223 source
pixels. Bearing resistance, material density and output load are reconstruction
assumptions. The contact-compatible regular teeth have ordered source-tip RMS
error 28.854 pixels; the source's spacing is irregular.

Eight focused tests, 3,069 numerical tests, the build and all 32 browser checks
pass against 802 frozen files. All 507 entries rendered. Eighteen integrated
mechanical/UI views are inspected, and historical screenshots were restored
after fresh regression copies were preserved. See `076-integrated-checkpoint.json`.

077 is rebuilt and verified. Its 24-pin wheel, high fulcrum, open spoke sectors,
bored joints and tapered finite pawls follow the source. The engaged pins fit
within 2.5 source pixels; the regular layout has overall RMS error 12.146 pixels.
Gravity, inertia and finite contact determine both free pawls and wheel motion.
Bidirectional output resistance and absolute angular damping are explicit
reconstruction assumptions. Each four-second displayed cycle advances one pin
pitch after the initial settling cycle, with about 82% moving time. Tiny
physical rollback is retained.

The 62-solid assembly passes 118,326,808 sampled surface checks at 275 poses.
Continuous primary-contact bounds remain within 1e-6. Secondary bounds keep
both pawls and fixed shafts separated, with real radial bearing clearances.
All 186 production buffers and 21,796 poses match the candidate exactly.
Observed finest-step displacement differs by at most 0.126338 source pixels.
Seven focused tests, all 3,075 numerical tests, the build and all 33 browser
checks pass against 812 frozen files. All 507 entries rendered. Fourteen
integrated images are inspected; eighteen historical browser images were
restored after fresh captures were preserved. See
`077-integrated-checkpoint.json` and `077-reconstruction-notes.md`.

078 is rebuilt and verified. Its 23 closed solids follow the engraving's
26-tooth open wheel, A-frame, rocker and nearly equal hooked pawls. The
undercut teeth are source supported; a hidden rear recess beneath the left
hook is an explicit reconstruction assumption. Finite contact, gravity and
inertia determine the free pawls and output wheel. Each four-second displayed
steady cycle advances one tooth clockwise, with physical startup settling
and tiny rollback retained.

Continuous face, layer, bore, capsule and frame bounds cover all 192
independent pairs through every interpolation interval and all 26 wheel
orientations within 1e-6. All 153,773 contact reactions pass independent
boundary and normal-cone checks. The final two time-step comparisons differ
by at most 0.187008 and 0.188089 source pixels; both pass, without a claim of
monotonically decreasing spatial error. Positive work residual decreases.

All 69 production buffers and 33,758 poses match the bounded candidate.
The production surface screen covers 307 poses and 84,041,118 mesh samples
without intrusion beyond tolerance. Seven focused tests, all 3,081 numerical
tests, the build and all 34 browser checks pass against 823 frozen inputs.
All 507 entries rendered. Fourteen integrated images and eight preview images
are inspected. Eighteen historical browser images were restored after fresh
copies were preserved. See `078-integrated-checkpoint.json` and
`078-reconstruction-notes.md`.

079 is rebuilt and verified. Its 37 closed solids follow the measured rim,
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
fresh copies are preserved. See `079-integrated-checkpoint.json` and
`079-reconstruction-notes.md`.

080 is rebuilt and verified. Its sixteen closed solids follow the finite
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
See `080-integrated-checkpoint.json` and `080-reconstruction-notes.md`.

081 is now rebuilt and verified. Its 24 closed solids follow the measured
six-tooth wheel, seven-tooth rack, spring and guide proportions. Finite tooth
contact, inertia, gravity and a Hookean spring determine motion. The hollow
rack, fixed internal mandrel and rear slot stop are explicit reconstruction
assumptions. The mandrel stays engaged while the lower guide is vacated at
high lift. Playback preserves startup and repeats the settled cycle in four
seconds.

All 17,746 positive contact reactions and energy checks pass. The loaded
surface screen covers all 183 independent pairs, 101 poses and 39,074,016
samples without intrusion beyond tolerance. Continuous hardware bounds cover
176 pairs; the other seven use finite gear/rack contact. New continuous spring
cell checks complete the earlier nonlocal-turn clearance bound. Projection of
the compressed trajectory is bounded to 0.002 engraving pixels over every
knot interval. Measured time-step agreement plus compression, projection and
spring deformation sensitivity totals 0.205304784 pixels; this is not a
continuum-error guarantee.

Production geometry and motion match the independent candidate. All 3,100
numerical tests, the build and the targeted 081 desktop/mobile browser check
pass. Thirteen final app/source/motion views are inspected; browser playback
averaged 52.41 fps with 1.5 ms 95th-percentile model updates. The 25 saved study
sources are unchanged, and the current map freezes 904 inputs. Earlier
failures remain archived. No new all-507 browser pass is claimed: the last
attempt timed out after movement 482. See [the 081 review](../artifacts/review/081-reconstruction-notes.md)
and its local integrated checkpoint.

**037, 063, 071 and 073 remain mechanically unresolved. 031, 064, 065, 066, 067,
068, 069, 070, 072, 074, 075, 076, 077, 078, 079, 080 and 081 are verified.
082 and 083 are under reconstruction; final mechanical qualification remains pending.
The complete 507-movement review remains active.**

## Completion requirements

Completion requires source comparisons and motion review for all 507 entries,
correction of every identified wrong topology/proportion/contact, inspection of
actual rendered clearances through motion, readable playback at default speed,
and the build, numerical tests, and browser checks against the final state.
The goal remains active until that evidence exists.
