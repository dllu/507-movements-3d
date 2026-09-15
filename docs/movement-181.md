# Movements 181–182 — fitted tappet motion; latch reconstruction open

These engravings show opposite stages of one mechanism. The
[source description](https://507movements.com/mm_181.html) says the piston tappet
closes one valve handle, the diagonal catch transfers engagement, and the other
backweight opens its valve pair. Both variants share geometry and motion;
182 starts at the opposite end of the 18-second cycle.

## Handle fit and finite contact

The old model inferred handle travel from the weight pins alone. Its working
arms did not clear a narrow tappet. The [isolated baseline](validation/181-tappet-baseline.json)
stalled in both directions at both timesteps; widening the travel limits let
it pass. That ruled out merely narrowing the oversized shoe as a repair.

Each handle now uses one rigid fit to its working tip and weight pin in both
engravings, registered at its pivot. The fit also requires the held tip to clear
the shoe's right edge. Tip radii are 0.10 model units (eight source pixels).
The working-arm tracing receives one fixed similarity transform; it does not
change shape while moving. Angles are -0.995 radians for the upper handle and
-0.9446 for the lower. The fit is an explicit compromise between inconsistent
hand-drawn positions:

| Handle | Tip error in 181 | Tip error in 182 | Weight-pin error in each plate |
| --- | ---: | ---: | ---: |
| Upper | 10.37 px | 15.50 px | 10.70 px |
| Lower | 14.30 px | 6.43 px | 11.54 px |

The shoe spans registered source X pixels 170–193. The invented contact rollers
are removed. Contact now comes from the finite working-arm outline over the
whole shoe width, with a circumscribed approximation to the rounded tip.
The tappet moves continuously; its position determines the driven handle angle.
Contact progresses along the arm rather than following one material point.
A short prescribed seating interval finishes the handle's last approximately
1.2% of travel after the working surface clears the shoe.

The opposite handle stays caught during the drive, then returns separately.
Its return is constrained against the opposite shoe face until the tappet has
passed. This replaces the old simultaneous motion, which made the released
handle cross the tappet during overtravel. Valve fractions follow their own
handles. Return timing, seating and catch switching remain prescribed; they
are not yet a fully passive valve-gear simulation.

## Assembly and rendering

The previous repair added 0.12-radius bores around 0.11-radius shafts and
retained, bored weight-rod joints. The handle planes remain at -0.12 and +0.12.
The catch is now at +0.43, clear of the shoe thickness. Its exposed fixed shaft
ends at the back of the catch, an inferred cutaway of the unillustrated support.
The lower backweight arm runs behind the piston rod at -0.68, with a bored
sleeve connecting it to its handle; the engraving shows this arm obscured by
the rod. Depths are reconstruction assumptions.

The piston rod now has the engraving's 33-pixel width and wavy section cuts at
source rows 23 and 500. These are fixed viewing limits on a longer translating
rod, not physical ends or a telescoping member. The rendered section therefore
stays in that window while the attached shoe moves. Its inferred 0.17-unit
depth at z=-0.355 clears both the rear weight eye and the front working arm.

No ground, fog, added engine frame or floating contact markers are shown.
Both variants retain front full-motion framing, orbit controls and exact
Restart. The earlier unused-outline cleanup remains in place.

## Evidence and limits

The [updated native study](validation/181-tappet-study.json) drives only the
piston against one passive weighted handle at a time. Both fitted handles
complete their strokes at 0.00025- and 0.000125-second timesteps, without extra
travel. Disabled-contact controls and extra-travel controls also pass; all ten
runs remain stable. Final input error is 0.004905 model units, the expected
static gravity/servo offset. The largest measured soft-contact penetration is
0.000943 units. The study omits the catch and opposite handle; its masses,
friction, damping and valve stops are assumptions. It qualifies only the
isolated drive contact, not the complete mechanism.

Four targeted production tests pass. The two motion tests each check 1,201
poses, including finite polygon overlap between the shoe and both working arms,
source-feature residuals, continuous monotone piston strokes, handle continuity,
separate drive/return timing, contact migration and restart. They replace old
tests that asserted the incorrect weight-only angles and fixed-marker motion.
The two joint tests retain checks for bores, layers and retained weight eyes.

The [full assembly sweep](validation/181-current-solids.json) checks 49 meshes,
1,002 cross-body pairs and 8,690,134 finite-surface samples at 129 poses. It
finds **six remaining interfering pairs**, down from 16 before this repair
(and 68 before the initial joint repair). All six involve the old latch rollers
against catch surfaces or the catch's weight pin. The full audit deliberately
still exits nonzero. These sampled checks are not continuous collision proofs.

The production build and [desktop/mobile browser checks](validation/181-browser.json)
pass for both variants: playback, exact Restart, orbit/reset, no horizontal
overflow, no live WASM request and no page errors. The front screenshots were
inspected. The rod section now follows the engraving; the old catch profile
still visibly differs and remains unfinished.

Reproduce with:

- `node --test tests/movement-181.test.mjs tests/movement-182.test.mjs tests/diagonal-catch-assembly.test.mjs`
- `node scripts/probe-diagonal-catch-tappet.mjs`
- `node scripts/review-diagonal-catch-solids.mjs` (expected failure on the six unresolved latch pairs)

## Offline catch reconstruction experiment

The [coupled contact study](validation/181-transfer-study.json) now contains a
candidate continuous catch outline and finite finger surfaces, including the
lower finger's pointed tripping nose. This is an offline prototype; it has not
replaced the six-intersection scripted latch in production.

The candidate now completes both transfers instead of only the upward stroke.
The upper finger's toe extends two source pixels left and down along its existing
holding face. That lets the returning upper handle lift the catch and release
the lower heel. With the previous catch mass of 0.25, the lower handle then
caught again on its pointed nose. Reducing the inferred catch mass to 0.17 lets
the weighted lower handle clear that second contact and return fully.

- Both handles still hold passively in isolated tests at 0.00025- and
  0.000125-second timesteps, including with all friction coefficients zero.
  An external catch-lift pulse releases them; disabling contact prevents holding.
- The coupled model actuates only the piston. Both weighted handles and the
  catch remain passive. Three complete 18-second cycles reach all six endpoint
  stages at each of three timesteps: 0.0005, 0.00025 and 0.000125 seconds.
- The heavier 0.25 catch remains a failed control: it holds the lower handle
  partway through its return. Disabling contact also prevents the required
  switching sequence. Stable integration alone is not a passing transfer.
- The diagnostic now checks contact distance at **every solver step**, rather
  than only at the 20 ms output samples. Finite clearance is a separate gate;
  the transfer result does not establish a collision-free playback asset.
  The worst reported penetration is 0.001348 model units (about 0.108 source
  pixels), during the return. All three timesteps fail the clearance gate, so
  the qualification command still exits nonzero. Endpoint errors across the
  passing transfer trials stay below 0.000763 radians for the handles and
  0.004906 model units for the piston.

Exploratory weight trials were sensitive: a 0.16 catch completed some runs but
lost the upper latch at the finest timestep. Increasing the contact margin from
0.0002 to 0.001 also lost upper retention on a later return. Extending the upper
notch another two pixels and raising the lower nose two pixels did not fix that
larger-margin trial. Those variants are not the current candidate. The inferred
weight and the narrow release sequence remain reconstruction limitations.

The lower isolated fixture starts with the catch at +0.033 radians, just clear
of the holding face reached during the coupled ascent. Starting that fixture
at zero creates an initial overlap and a separation impulse; that is not a
valid retention test. The catch stop, masses, inertias and axial contact layers
are reconstruction assumptions. Connecting hardware and the full visible
assembly are not included in this contact model. Successful isolated controls
do not qualify the complete mechanism or its source fit.

The source overlay was inspected in both stages. The upper tripping finger
still falls short of the horn visible in 182, and the catch's upper contour
does not overlay both drawings well. Adding a separate opposite-side nose
jammed the first transfer in exploratory tests. Changes to physical cycle
period alone (6, 9 and 12 seconds) did not fix the unregistered reconstruction.
Further reconstruction must preserve both transfers while addressing the upper
finger and catch together, using the assembled closed pose and both source views.

Reproduce the prototype with `node scripts/probe-diagonal-catch-transfer.mjs`
(a nonzero exit now also reports a failed finite-contact-clearance gate). It writes the compact report above
and full traces to `/dev/shm/181-transfer-probe.json`.
`node scripts/preview-diagonal-catch-profiles.mjs` writes a source-overlay HTML
and PNG to `/dev/shm/181-candidate-profiles.*`. The source site's 181 page marks
its animation unavailable; the engraving and caption remain the reference.

## Offline contact projection

The [projected-motion check](validation/181-projected-contact-motion.json) takes
the second native cycle at a 0.00025-second timestep, records 9,001 poses at
2 ms spacing, and separates finite contact surfaces with small joint-position
corrections. It does not prescribe the transfer or actuate a handle. A smooth
correction during the final half-second of the settled bottom dwell removes
the residual settling offset so the loop closes exactly.

Only 17 recorded poses need contact projection; each converges within three
iterations. Including the loop correction, the largest angular change is
0.000783 radians (0.045 degrees), and the largest piston shift is 0.000477
model units (0.038 engraving pixels). Across 36,001 linearly interpolated poses
at 0.5 ms spacing, minimum separating-axis clearance is 0.00002966 units. An
independent intersection of the unsplit polygon unions at 901 poses finds zero
overlap, while the same check detects overlap in the uncorrected trajectory.
These are sampled contact-surface checks, not continuous collision proof.

Reproduce with `node scripts/project-diagonal-catch-motion.mjs`. It writes the
candidate trajectory to `/dev/shm/181-contact-motion.json`; no runtime physics
or projection is added to the browser. The complete connecting hardware,
visible catch/fingers and production bake are still missing. The raw native
probe intentionally retains its failed soft-contact-clearance result. Firmer
contact reduced penetration in exploratory runs, but expanding the margin
could lose the upper latch on a later return; those alternatives are not used.

## Next work

Finish reconstructing the actual hook/finger surfaces from both engravings. The current
nearly closed circular pockets and cylindrical latch rollers are not faithful
and still intersect. Passive transfer now works in the candidate contact model;
the projected contact motion now passes the sampled clearance check. Build and
validate the complete visible catch/finger assembly before publishing a bake.
The full catch/handle silhouettes still need comparison against both drawings. Do not mark either movement
fully reviewed or advance to 183 yet. The complete 507-movement goal remains active.
