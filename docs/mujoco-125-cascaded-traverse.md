# 125 — Three geared cranks and two cascaded links

The reconstruction in `src/simulation/mujoco-cascaded-traverse/` restores the measured
crank pins, unequal rods, broad curved links and short output stem. One native
actuator turns the right gear; MuJoCo tooth contacts and four ideal pin
connections drive all other coordinates. The catalog now loads this factory
through the shared MuJoCo runtime.

## Source interpretation

Brown's [engraving and caption](https://507movements.com/mm_125.html) describe a
more complex modification of 122. The modern reference explicitly assumes
vertical constraints for both horizontal links' central pins; Brown does not
illustrate those supports or uniquely specify their paths. This reconstruction
uses the same two ideal vertical guides and does not invent a visible frame.

The modern reference animation uses 19:23:29 gear ratios, left to right. These
counts are retained as an interpretation, not claimed as uniquely measured
from the irregular engraving. No vector outlines or animation implementation
were copied from that reference. Source measurements use the local 525-square
PNG, with 100 pixels per world unit.

Seven inspected baseline views show the old model's narrow straight links,
equal crank radii, oversized output stem and extra support frame. Its three
gear angles and both linkage solutions were prescribed. The new candidate
retains all measured crank and linkage-pin positions at the source pose.
Twenty independent circle fits, 1,418 unoccluded gear-edge samples, 530 rod-edge
points and 204 curved-link edge points support the reconstruction.

Initial radial measurements accidentally included rods inside the gear
silhouettes. Source revisions a and b and their exploratory fits are retained
as failed measurement approaches. Revision c excludes those angular sectors.
Neither the free-center radial fits nor independent tooth-tip cluster counts
uniquely establish the printed tooth counts. Four iterative tip-envelope circle
fits instead establish approximate gear axes independently of the tooth
profile. A least-squares adjustment gives compatible center distances with
one 6.313765-pixel module:

| Gear | Tip-envelope center, pixels | Compatible axis, pixels | Drawn hub-axis correction, pixels |
| --- | --- | --- | ---: |
| Left | 87.6300, 379.8572 | 87.6730, 379.8578 | 2.6431 |
| Middle | 220.3394, 380.1520 | 220.2617, 380.1523 | 0.3689 |
| Right | 384.3754, 378.3809 | 384.4101, 378.3800 | 6.1966 |

Hub and shaft radii are retained while their circles become concentric with the
physical gear axes. The source does not depict a consistent exact gear system.
Generated involute teeth use 20° pressure angle, profile shifts −0.5 / +0.5 /
−0.5, addendum 0.8 module, dedendum 1.5 module and rounded cutter tips of 0.12
module. Both mesh phases are conjugate. A 14.5° candidate fitted the drawing
slightly better but had greater native rolling error. A nominal analytical
contact ratio alone does not account for generated undercut.

Measured straight rod-edge offsets and circular ends replace the old equal
bars. Broad links use independently traced Bézier outlines. The upper link's
bottom control ordinates are fitted to 53 source points. The stem includes a
raised circular eye matching the internal contour. Ideal bearings, pin fits,
the two guides, hidden axial layers and eye/boss construction are inferred.
All moving bores have 0.15-source-pixel radial clearance; ordinary pin joints
supply their native constraints.

## Complete-pattern reach

The independent two-stage closure study follows the actual unequal,
noncollinear link-pin offsets with the inferred vertical guides. With the
corrected axes and retained 19:23:29 counts, all measured crank radii complete
437 right-gear turns at 180 continuation steps per turn. The middle and left
gears complete 551 and 667 turns. Minimum closure-Jacobian determinants are
0.355256 and 1.413716 for the lower and upper loops. No crank shortening is
needed. Sampled continuation is not a proof of continuous reach or native
stability.

An earlier 19:24:29 exploratory fit failed after about 4.3 turns; that result
used discarded gear axes/counts and does not apply to the current candidate.

## Rendered source agreement

Actual triangle slices are compared to the independent source ink points.
Radial-fit errors are not substituted for nearest rendered-edge distances.

| Feature | RMS, source pixels | Maximum, source pixels |
| --- | ---: | ---: |
| Left / middle / right gear | 3.0206 / 5.1902 / 4.5473 | 8.8828 / 12.2563 / 9.5168 |
| Left / middle / right hub | 1.9074 / 0.4799 / 4.1132 | 3.8570 / 1.2650 / 6.8252 |
| Three crank-pin circles | 0.2694–0.3734 | 1.2449 |
| Six link-pin circles | 0.2572–0.4130 | 1.3608 |
| Lower / upper central eye | 0.5683 / 0.8206 | 1.5486 / 2.0374 |
| Left rod, two edges | 0.3100 / 0.3274 | 0.7067 / 0.8045 |
| Middle rod, two edges | 1.2943 / 1.0270 | 4.3791 / 2.6516 |
| Right rod, two edges | 0.3951 / 0.6327 | 1.0109 / 1.3822 |
| Transfer rod, two edges | 0.4139 / 0.4720 | 0.8728 / 0.9825 |
| Lower link, two edges | 1.3928 / 0.8916 | 8.0646 / 1.3568 |
| Upper link, two edges | 0.6114 / 0.4990 | 1.3923 / 1.5100 |

Gear-profile regularization and the shifted right hub dominate residuals. One
lower-link edge sample near an end eye has a large residual; the unfiltered
measurement is retained. The source overlay provides the corresponding visual
comparison. Depths and hidden hardware cannot be inferred uniquely from this
front elevation.

## Native model and validation

There are eleven native coordinates: three gear hinges, four rod hinges, lower
link rotation and vertical travel, upper link rotation and output-stem travel.
Four site-connect equalities close the rod ends. Only the right-gear joint has
an actuator; no gear-ratio equality, passive servo or output path is supplied.
The two gear meshes also transmit rotation with the rod closures released and
gravity disabled. Removing middle-gear contact then leaves both passive gears
at rest. This isolates tooth transmission from forces carried by the rods.

The shared runtime owns stepping, seeking, reset and disposal. Gravity is
active, mass derives from the visible solids with a common density, and the
right rigid family is normalized to one mass unit. The input approaches one
turn per four seconds with a 0.25-second startup ramp. A whole pattern takes
about 1,748.25 seconds; it is not compressed into a short repeating animation.
Drive timing, damping, material density and load are inferred.

Thirty visible parts have positive volume and closed, oriented, nondegenerate
surfaces. Compiled collision-cell vertices agree with their intended geometry
within 0.00000296 source pixel across 10,012 vertices. The maximum collision-boundary approximation
is 0.024536 pixel. Only gear teeth have native collision geometry; ideal pins
and guides supply the other constraints.

All sixteen selected tests pass: five mechanism tests covering source pins and
solid topology, native coordinates and collision geometry, passive motion,
isolated tooth transmission and playback ownership; plus eleven shared
runtime, engine and camera checks.

The default 1 ms native run completes the entire 437-input-turn pattern
(1,748.25 seconds), with zero time resets or passive actuation. Maximum pin
closure error is 0.000665 source pixel, native tooth penetration 0.082175 pixel,
pitch-line rolling error 0.248558 pixel and input tracking error 0.252075 pixel.
The lower central pin travels from −0.368236 to 0.397775 world unit and the
output stem from −0.348307 to 0.310230, relative to the source pose.

A 495-pose actual-hardware audit replays recorded native states across the
whole pattern, including early poses and every sampled joint position/velocity
extremum. It makes 93,537,180 surface queries with zero unintended penetration.
Working gear overlap reaches 0.036413 source pixel against a 0.1-pixel
soft-contact allowance. Same-family attachments are excluded, other surfaces
permit only 1e−6 world-unit numerical tolerance, and every sampled vertex lies
inside the camera envelope. Sampling does not certify continuous clearance.

The preceding 0.0005-world-unit collision tolerance completed the full native
pattern, but its rendered-hardware audit failed at 1,140.161 seconds with
0.100865 pixel of working tooth overlap. That failure is retained. Tightening
the default collision tolerance to 0.00025 produces the qualified run above.

Three additional 12.25-second trials halve the timestep, double tooth/cutter
resolution, and apply a −1 output load with 0.1 friction. All retain passive
motion and zero resets; their native penetration maxima are 0.017152, 0.019834
and 0.020042 source pixel. Full-pattern timestep comparison is recorded below.
These checks do not establish force convergence or cover arbitrary loads.

The 0.5 ms run also completes all 1,748.25 seconds, with zero resets or passive
actuation. Maximum native penetration is 0.040244 pixel and pin closure error
0.000302 pixel. Comparing 174,824 common-time snapshots against the 1 ms run
gives output-stem differences of 0.046827 pixel maximum and 0.002707 pixel RMS;
the lower central guide differs by 0.083211 pixel maximum and 0.003731 pixel
RMS. Sampled travel-span changes are below 0.000229 pixel. The comparison
linearly interpolates 10 ms baseline snapshots onto refined timestamps.

Over the shorter three-turn trials, doubling tooth/cutter resolution changes
the output position by at most 0.020228 pixel and the sampled travel span by
0.006333 pixel. The loaded trial differs by at most 0.051541 pixel in output
position. These are measured position sensitivities, not force convergence.

All 23 integrated views are inspected, including four native travel extrema,
the last full-pattern sample, rear and axial views, and desktop/mobile controls.
Eight static images are byte-identical to the already inspected corrected
candidate; the remaining fifteen received direct inspection. No fog, ground
intrusion or camera clipping is observed. Mobile notes intentionally scroll
within their panel. Headless playback produces 388 frames in 12.0349 seconds
and advances 12.016 physical seconds: 32.24 fps and 99.84% physical speed.

The production build and all 41 MuJoCo browser cases pass. These cover lazy
loading beneath a static subdirectory, native playback, pause, deterministic
restart, mobile controls, navigation, retry and disposal. After changing only
125's reconstruction status and explanatory note, a second production build
and the focused 125 browser case pass. An initial focused invocation selected
zero cases because its regular expression was anchored before the test-file
prefix; its unsuccessful log is retained and is not counted as a test pass.
Twelve final registered-factory views are also directly inspected, including
the updated source overlay, native extrema, playback and scrolled mobile notes.
This final capture averages 32.82 fps at 99.83% physical speed.

## Reproduction and retained evidence

Use `TMPDIR=/dev/shm` for these scripts and exclusive `PROBE_PREFIX` values.
The machine's main filesystem is nearly full; generated outputs stay outside
Git. Measurements are reproducible from the tracked engraving and scripts.

- `measure-cascaded-traverse-source.mjs` → `/dev/shm/125-source-c.json`.
- `measure-cascaded-traverse-tooth-tips.mjs` reads `SOURCE_REPORT` and produced
  `/dev/shm/125-tips-a.json` plus its inspected envelope image.
- `fit-cascaded-traverse-gears.mjs` reads `SOURCE_REPORT` and `TIP_REPORT`;
  `/dev/shm/125-gear-fit-d.json` retains coupled count/axis/profile candidates.
- `probe-cascaded-traverse-reach.mjs` reads `SOURCE_REPORT` and `GEAR_REPORT`;
  `/dev/shm/125-reach-c.json` retains all 437-turn continuation trials.
- `fit-cascaded-traverse-links.mjs` produced `/dev/shm/125-link-fit-a.json`.
- `compare-cascaded-traverse-source.mjs` produced
  `/dev/shm/125-comparison-c.json` from the final collision geometry.
- `capture-cascaded-traverse-baseline.mjs` and
  `capture-cascaded-traverse-candidate.mjs` produced the baseline-a,
  candidate-a and candidate-b records and PNGs, followed by
  `/dev/shm/125-integrated-motion-a.json` and its 23-view inspection record.
- `audit-cascaded-traverse-clearances.mjs` produced
  `/dev/shm/125-clearances-c.json` from `DYNAMICS_REPORT=/dev/shm/125-dynamics-e.json`.
  Earlier a is the short candidate audit; b retains the full-pattern failure.
- `probe-cascaded-traverse-dynamics.mjs` retains each native trial's exact
  options, source snapshots, contacts and trajectory. Trials a–c compare
  initial profiles; d is the first complete-pattern run, e the tightened
  default, and f its full-pattern timestep refinement. Set `DURATION=1748.25`
  and, for f, `SIM_OPTIONS='{"timestep":0.0005}'`.
  `125-dynamics-time-b`, `125-dynamics-space-b` and `125-dynamics-load-b`
  retain the final shorter refinement/load trials.
- `compare-cascaded-traverse-dynamics.mjs` produced `/dev/shm/125-refinement-a.json`
  using `BASELINE_REPORT=/dev/shm/125-dynamics-e.json` and a JSON array of
  trial report paths in `TRIAL_REPORTS`.
- `/dev/shm/125-tests-b.log` records all sixteen passing selected tests.
- `/dev/shm/125-integrated-build-a` and `125-integrated-build-b` are the
  production builds; `/dev/shm/125-e2e-a.log` records 41 passing cases and
  `125-e2e-c.log` the passing focused final-build check. `125-e2e-b.log`
  retains the zero-selected-tests invocation.
- `/dev/shm/125-integrated-motion-b.json` and its inspection record retain the
  twelve final views. `/dev/shm/125-integration-evidence-a.json` verifies numerical
  archives against the final source and records source, artifact and build
  hashes. Post-study implementation differences are restricted to the
  reconstruction status and explanatory note; geometry and native physics
  are byte-identical. Bulk trajectories and images remain local review
  artifacts outside Git, reproducible from the tracked source and scripts.

Reports retain frozen source hashes and verify them at completion. Discarded
exploratory reports are evidence of those attempts, not current qualification.
