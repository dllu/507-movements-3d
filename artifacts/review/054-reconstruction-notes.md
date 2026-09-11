# 054 reconstruction starting evidence

The reconstruction is now registered in the application. Its final evidence
is collected in 054-reconstruction.json. All 14 browser tests pass, including
the 507-canvas sweep. Serial execution avoids the software-WebGL contention
seen in the preserved parallel-run timeout reports.
The original factory is 054-original-factory.txt. Earlier prototype work
below is retained as historical evidence, followed by the integrated result.
The three baseline views and 054-contact-baseline.json show severe pinion
interference in every branch, including both crossovers. The wheel rims are
uncapped open tubes, so the baseline probe only uses closed pinion solids as
targets and samples actual wheel pins/webs against them.

Brown source: https://507movements.com/mm_054.html and brown-054-detail.png.
The engraving has radial rungs between flat annular rims, waisted spokes,
a short radial input shaft, and an H-shaped piece at A. The present model
instead has axial pins plus separate radial box webs, a large opening cut
through both round rims, and an oversized shaft. Its pitch-point velocity
identities do not establish contact of the rendered teeth.

Robinson, Principles of Mechanism (1896), printed pages 86 and 191, is the
closest newly found period construction reference: figure 104 photographs
a right-angle mangle wheel, and page 191 explicitly identifies its H-shaped
reversing piece. See ../reference/robinson-page-86.png and page-191.png, PDF
pages 106 and 211 respectively. It permits teeth on opposite edges of a
band instead of pins for this arrangement. The photograph is dark; do not
infer exact reverse-cam geometry without further investigation.

Working inference to investigate: the rung axes should be radial, hence
approximately parallel to the input pinion axis at engagement. The current
axial pins point directly through its tooth space and body. The existing
motion has a useful continuous path but needs a real H-piece/guide and a
generated mating profile; do not preserve it solely because the old tests
check its own pitch-point equations. Brown's hatching at A must not simply
be treated as a decorative section cut that can be removed.

Willis and Rose references saved alongside Robinson describe the usual
parallel-axis mangle wheels, and cannot by themselves establish Brown 054's
right-angle layout. No final topology, tooth count or dimensions selected.


Potential implementation resource: src/simulation/face-gear-geometry.js
already cuts a crown face using the actual involute shaper, including pitch
variation across its radial width. Its current API expects a backing disk,
so it cannot directly supply the two-sided open rungs needed here. Treat
its generating process as a reference, and keep the reversal-end shaping
and H-piece contact as separate unresolved requirements. The ordinary
planar C-strip mangle generator also cannot establish right-angle contacts.

## Historical 44-position reconstruction and contact tools

The candidate lives in 054-candidate-model.mjs and 054-candidate-guide.mjs.
The unused src/simulation/star-mangle-motion.js supplies its geometric path.
At that stage no existing production factory, shared gear helper, registry entry, numerical
test assertion or display profile has been replaced. The gallery still shows
the preserved baseline; candidate screenshots have separate filenames.

The working prototype has radial generated teeth, a flat inner annulus,
four waisted spokes, a larger bored hub and short radial input shaft. Its
outer annulus has shallow concave running faces for a rounded input collar.
Two curved crab ends retain that collar during crossover. A raised radial
bridge clears the pinion. These collar, groove and bridge sections are
inferred constructions: Brown does not supply their dimensions or sections.
The outer rim needs a shaft opening underneath the crab; a completely
closed flat ring would intersect the radial input shaft during crossover.

Current provisional parameters are 44 positions, six pinion teeth, three
omitted teeth, pitch radius 1.55, module 3.1/44, pinion depth 0.34 and input
speed 4 rad/s. They are not final source counts. The period is about 22.51 s.
The source phase places the crab near ten o'clock and aligns the four spokes
with the image. Capture script: scripts/capture-star-mangle-candidate.mjs.
Source, oblique and crossover screenshots have been visually inspected.
The model, guide, motion and cutter source snapshots are preserved as
054-prototype44-{model,guide,motion,cutter}.txt for this evidence.

scripts/lib/star-mangle-cutter.mjs cuts polar cross-sections of each radial
rung with the actual rack-generated involute pinion. The first finite-width
cutter left shoulder interpolation collisions. Extending the cutter by 0.04
at each axial end removes those collisions without applying the earlier
coarse radial-minimum relief. The current best data are
054-candidate-profiles-overtravel.json, generated with:

```
TOOTH_INDICES=0,1,20,39,40 STOCK_FACTOR=1.65 TANGENTIAL_FACTOR=1.05 CUTTER_OVERTRAVEL=0.04 CONSERVATIVE_RADIAL=0 CUTTER_STEPS=2048 RADIAL_BANDS=32 ANGULAR_SAMPLES=256 PROFILE_OUTPUT=artifacts/review/054-candidate-profiles-overtravel.json node scripts/explore-star-mangle-profiles.mjs
```

Ordinary teeth reuse the middle profile; both terminal teeth and their
immediate neighbors have separate profiles. The rendered teeth now end at
radius 1.78, using an interpolated final radial station, to clear the guide
collar where they join the outer rim. Old coarse/fine/tall data and failing
reports remain as historical evidence, not final validation.

- 054-candidate-contact-both-directions.json: 19,430,950 triangle-surface
  samples through 99 poses, no penetrating samples. This preceded the tiny
  outer-radius trim. It still finds a nearest gap as large as 0.001097.
- 054-candidate-hardware-trimmed.json: 96,778,006 bidirectional surface
  samples through 51 poses, zero penetration. This includes the raised
  bridge, narrowed crab ends, shallow running rim and trimmed tall teeth.
  Crossover guide gaps range from 0.00008631 to 0.00009692. Normal running
  guide contact distances still need a dedicated measurement.
- 054-candidate-exact-gap.json uses actual triangle/triangle closest points,
  including edge/edge minima and intersections. It confirms a real 0.001040
  gap at geometric path travel 66.50992820418958, not merely missed sampling.
  This rules out declaring the constant-rate candidate finished.
- 054-candidate-solids.json verifies all 21 distinct geometries: positive
  volume, nonzero faces, closed and consistently oriented edges, and normals
  facing the same way as their triangles. The first normal check caught
  smoothing across the sharp rim/guide boundaries; splitting those smoothing
  groups fixed it without changing triangle positions or contact geometry.
  The final oblique render was checked after this shading repair.

## Loaded contact: successful pilot, motion map still needed

The source promises alternating rotation, not uniform wheel speed. Keep
the current geometric wheel/collar path, but let tooth contact determine
its progress. At each path station lambda, hold the wheel and input-center
pose fixed and advance the pinion to its first driving-flank contact.
If that advance is delta(lambda), actual input travel is

    u = lambda + delta(lambda).

The final update must invert this relation, spin the pinion at constant u,
and evaluate the wheel/collar pose at lambda. A 0.0001-radian phase backoff
in the pilot leaves roughly 0.00002 model-unit surface clearance. The collar
continues on exactly the same guide curve; the wheel gains a small speed
ripple instead of being scripted to run uniformly while its teeth float.
This still needs monotonicity, derivatives, unilateral force, guide-force,
power and complete collision checks before integration.

scripts/explore-star-mangle-loaded-phase.mjs independently locates first
contact by triangle-BVH crossing and bisection. Its 19 pilot poses include
both crossovers and the worst floating point. All loaded gaps are between
0.000018906 and 0.000023383; the largest needed advance is 0.0043445 rad.
Results: 054-candidate-loaded-phase-pilot.json.

For an efficient bake, scripts/lib/star-mangle-angular-contact.mjs clips
each actual wheel triangle to the pinion's axial slab, then solves both
rotating vertex/edge event directions by circle/segment intersection.
scripts/check-star-mangle-angular-contact.mjs compares this exact polygon
method with the independent BVH pilot. All 19 agree within 4.17e-8 radians.
The optimized method takes at most about 0.215 s per tested pose here.
This is independent of nominal pitch-point velocity identities. The BVH
distance helper was also checked on separated and intersecting cubes.

## Historical next-work list after the 44-position pilot

1. Refine the source count BEFORE baking the motion map. Read-only polar
   measurement of Brown's rung strokes strongly favors 32 full-circle
   positions (0.4012 spectral amplitude; 44 is much weaker). The earlier
   44/6 prototype deliberately served to prove the geometry/contact method.
   A 32-position wheel with a four-tooth pinion has outer pinion radius
   0.290625, close to the engraving; one omitted tooth would give the small
   22.5-degree crab opening. These are candidates, not adopted parameters.
   Inspect actual generated four-tooth geometry before deciding: its
   undercut can be significant. The hidden pinion count is not established
   by the polar measurement. The existing raw stroke data and reproducible
   script are 054-source-pitch-measurement.json and
   scripts/measure-star-mangle-source-pitch.mjs.
2. Make guide bridge width/radial limits depend on the chosen opening.
   The current fixed half-angle 0.09 belongs to the larger 44/6 prototype.
   Keep the raised crossbar: the first center-plane version penetrated the
   pinion by 0.04418. The crab radial range 1.76..1.85 avoids its shaft bore;
   wider versions intruded on the shaft. Current collar radius is 0.10,
   offset 0.265, end-guide clearance 0.0001, radial bands 32, curve steps 512.
   Larger-module stock may need extra outer-end relief into the running rim
   to keep its ends below the collar. Regenerate and verify those changes.
3. Bake and invert the loaded phase map. Ordinary front/rear runs are
   periodic by tooth pitch; terminal regions need their separate profiles.
   Alternatively bake the entire path using worker_threads (48 CPUs are
   reported) and refine intervals where independent samples fail. This is
   numerical parallel work, not sub-agent delegation. No agents authorized.
4. Validate the map's interpolation, first-contact normal/force sign,
   nonuniform output speed and guide reactions. Then promote the finished
   model/data into src, replace the old 054 self-checking test, update the
   mechanical note/display profile, and run appropriate numerical/browser
   checks. The last full passing production checks remain those for 053;
   a full app suite was not rerun for this unused review prototype.

At the end of that 44-position pilot, 054 was still unfinished. The sections
below record its subsequent reconstruction. 037 and the remaining catalogue
reviews were still pending; the overall goal remains active.

## 32-position reconstruction and rejected standard pinion

The current review factory uses 32 positions, four pinion teeth and one
omitted rung. It retains the source-sized outer pinion radius 0.290625.
The guide bridge now depends on the smaller opening, and its crossbar
clears the entire pinion envelope. Cutting the actual rounded collar sweep
out of the rung ends removed collisions that a simple end taper missed.
The tiny bridge annulus also needed fewer arc samples to avoid degenerate
triangles. The source angle is now -0.42 radians (modulo a full turn).

The unshifted 32-position refined candidate has these separate reports:

- 054-candidate32-refined-tooth-contact.json: 21,483,162 bidirectional
  surface checks through 99 poses, no penetration, but gap up to 0.009309.
- 054-candidate32-refined-hardware.json: 111,241,002 bidirectional checks
  through 51 poses, no penetration. Crossover guide gaps 0.0000865–0.0000984.
- 054-candidate32-refined-solids.json: all 21 distinct geometries pass
  closed-edge, positive-volume, nondegenerate-face and normal checks.

Do not accept that geometry's loaded-motion bake. Adaptive interpolation
failed because its first-contact advance jumps by about 0.011791 radians
across a path interval of only 7.49e-7 radians. The bake was deliberately
terminated and its progress marked rejected-geometry. The detailed event
refinement is 054-candidate32-engagement-step.json. Independent triangle-BVH
distances around that station are saved in
054-candidate32-engagement-step-independent.json: contact is grazing near
the outer tooth tip, and microscopic changes in position lose that contact
before a later intersection. A continuous interpolant cannot fix that.

The next candidate uses a positive rack shift and trimmed addendum, with
30-degree pressure angle, shift coefficient 0.5 and addendum coefficient 1.
These are provisional reconstruction choices; verify actual contact transfer
before adoption. The optional parameters were added to boredSpurGeometry.
Default 4-, 6-, 16- and 32-tooth position arrays and outlines remain bitwise
unchanged (054-spur-default-regression.json). All eight existing 048 tests
pass (054-shared-gear-regression-tests.log). No production 054 registration
has changed. The contact-curve pilot must precede another full map bake.

## Integrated reconstruction

The shifted four-tooth pinion solved the grazing-contact discontinuity.
The complete periodic map has 5,705 nodes, 23,494 exact polygon-contact
queries and 17,112 final interpolation checks. Maximum phase error is
0.00003424 radians; a 0.00015-radian backoff retains clearance. Input phase
is strictly increasing (minimum derivative 0.680247). Both crossover
midpoints stop and reverse the wheel continuously. Input rotation remains
constant. The application displays sixteen input revolutions in a 16-second
full reversal cycle, instead of compressing them into two seconds.

The first one-sided guide failed a quasistatic reaction check, including
with no bearing drag. An opposing physical guide face now captures the
collar. Both faces pass actual surface clearance and ray-intersection checks.
The ideal external input bearing fixes X, follows Y²−Z²=R²−rp², and has
end stops at Z=±rp. Its supports lie beyond the source's cropped shaft B.
These guide and bearing sections are explicit construction inferences.

Final independent evidence before app checks:

- 195 loaded tooth poses, 41,869,586 bidirectional surface checks, no
  penetration; nearest sampled gap at most 0.00007355.
- 48 exact triangle-distance poses: gap 0.00002156–0.00002701, including
  the former grazing station and both crossovers.
- 99 hardware poses, 252,779,008 bidirectional checks, no penetration.
  Each of the four guide faces was checked at 34 crossover poses, with
  nearest gaps about 0.000086–0.000099.
- All 23 unique solids have closed, consistently oriented edges, positive
  volume, nonzero triangles and outward normals at all three corners.
  Sharp rung shoulders/caps retain creases. The inner annulus covers the
  enlarged rung roots, removing the earlier scalloped appearance.
- 38 quasistatic force poses have compressive tooth and selected-guide
  reactions and positive input torque. Power residual is at most 0.41%.
  Actual guide normal alignment exceeds 0.99992. Exact apex rays required
  a recorded 1e-9 offset from a tessellation seam. This is a contact and
  quasistatic load review, not a mass/inertia or stress simulation.

Production files are src/simulation/star-mangle{,-motion,-contact-motion,
,-geometry,-guide}.js and the two src/data/star-mangle-* data modules.
The review wrappers now call that production geometry. The original 054
test is archived; its pitch-point identities could not detect the original
intersections. Five new mechanical tests and two shifted-profile tests pass,
as do all 2,941 numerical tests with explicit exit code zero. The build
passes. All 14 browser tests pass (10.9 minutes), including the 507-canvas
sweep and 054 playback, pause, orbit and mobile controls. The Playwright
configuration now uses one worker because headless scenes share software
WebGL. The parallel failures and traces are preserved separately.
