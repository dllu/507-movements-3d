# 125 — Three geared cranks and two cascaded links

The candidate in `src/simulation/mujoco-cascaded-traverse/` restores the measured
crank pins, unequal rods, broad curved links and short output stem. One native
actuator turns the right gear; MuJoCo tooth contacts and four ideal pin
connections drive all other coordinates. Catalog integration and final
mechanical qualification are pending.

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

## Native model and current validation

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
within 0.00000283 source pixel. The maximum collision-boundary approximation
is 0.049826 pixel. Only gear teeth have native collision geometry; ideal pins
and guides supply the other constraints.

All five targeted tests pass: source pins/solid topology, native coordinates and
collision geometry, passive motion, isolated tooth transmission, and playback
ownership/determinism. A 34-pose actual-hardware audit makes 6,424,776 surface
queries with zero unintended penetration. Working gear overlap reaches
0.075631 source pixel against a 0.1-pixel soft-contact allowance. Same-family
attachments are excluded, other surfaces permit only 1e−6 world-unit numerical
tolerance, and every sampled vertex lies inside the camera envelope. Sampling
does not certify continuous clearance.

The first candidate's 15 views were inspected. The corrected candidate has a
second 15-view capture. Its 12.0483-second headless playback produced 406 frames
and advanced 12.032 physical seconds, about 33.70 fps and 99.86% physical speed.
The full native pattern, refined and loaded trials, broader hardware sampling,
final view inspection, production build and catalog browser checks remain
pending before public integration and verification.

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
  `/dev/shm/125-comparison-b.json` from the corrected geometry.
- `capture-cascaded-traverse-baseline.mjs` and
  `capture-cascaded-traverse-candidate.mjs` produced the baseline-a,
  candidate-a and candidate-b records and PNGs.
- `audit-cascaded-traverse-clearances.mjs` produced
  `/dev/shm/125-clearances-a.json` and its successful terminal log.
- `probe-cascaded-traverse-dynamics.mjs` retains each native trial's exact
  options, source snapshots, contacts and trajectory. Trials a–c compare
  initial profiles; d is the complete-pattern run.
- `/dev/shm/125-tests-a.log` records all five passing native tests.

Reports retain frozen source hashes and verify them at completion. Discarded
exploratory reports are evidence of those attempts, not current qualification.
