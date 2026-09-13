# Movement 087: integrated repeating clutch reconstruction

The application now uses the finite reconstruction previously checked through
four connected reversals. It replaces the old prescribed clutch/lever motion
with playback of the contact-integrated linkage, stud, jaw and feather-key
motion. The independently checked geometry was promoted into production
modules; regression tests compare all 213 solids and their articulation with
the preserved candidate. The bevel teeth retain their conical involute form.

Two reversals close at `37.5 * Math.PI` model time units: 27 jaw pitches divided
by the engaged output speed. At matching times within the seated plateau,
maximum coordinate differences are `7.994e-15` on the CW branch and `1.794e-13`
on the CCW branch. Velocity differences are below `1.7e-17`. The actual
interpolated endpoint is retained; it is not replaced with the initial state.
The motor angle continues unwrapped while the internal coordinates repeat,
so the input wheel and its spokes do not reset at the seam.

The production table retains 18,456 of 99,008 trajectory states. Reduction
preserves contact-event boundaries and bounds the difference between the
original and reduced linear interpolants by `2e-8` in each coordinate.
The complete cycle takes 24 seconds at default speed. Checking all table
intervals gives a peak rigid angular speed of 9.0071 rad/s and a duration-weighted
75th percentile of 0.58905 rad/s, within the project display limits. The
97-pose display measurement supplies updated bounds for 087; the other 506
display profiles are unchanged.

Validation completed:

- The production build passed. Vite retains the existing large-bundle warning.
- All 174 tests passed across `models.test.mjs`, `weighted-clutch.test.mjs`
  and `camera-catalog.test.mjs`, including camera containment for all 507
  models at three aspect ratios.
- The new tests verify geometry parity, rigid rod-pin closure, both sustained
  output directions, the continuous motor, the loop seam and finite contacts.
  Across 268 poses spanning four playback periods, minimum native jaw, stud
  and coupling gaps are respectively `-7.066e-8`, `-7.476e-9` and `-2.683e-12`.
  These small negative gaps are within the numerical clearance tolerance.
- The final browser run completed 24.2324 seconds and 491 frames without
  errors or unexpected warnings. Software-rendered throughput was 20.22 fps;
  the 95th-percentile model update took 0.30 ms. Playback scale is 1, the ground
  is hidden, and fog is disabled. Every recorded browser state agrees with
  the Node playback result within `1e-12`.
- All 13 captures were opened and inspected: the initial view and registered
  overlay, both transfers, oblique views, the two seam poses, and the actual
  desktop/mobile application. The moving hardware remains framed, the
  seam poses agree visually, and the bevel flanks shade consistently.

The fifth connected reversal also passes on both separately initialized
branches: 53,112 CW and 45,891 CCW fine states. Maximum coarse/fine coordinate
differences are 0.00017690 and 0.00012506; event-time differences are 0.00032921
and 0.00038251 model time units. Independent free-shaft checks pass. The extra
CCW held prefix supplies the precise period endpoint used above. These fifth
transfers have numerical and solid-pose checks, without a separate fifth-only
rendered checkpoint. No owned numerical or browser worker remains running.

**087 remains under review for source proportions and continuous clearance.**
The source overlay preserves the overall engraving layout, but the adjusted
rod pins still differ noticeably at their local scale: F's crank is about
102.15 source pixels versus 166.05 in the tracing, and G's is about 276.87
versus 232.44. Distributed landmark shifts reach 32 pixels in the 2780-pixel
reference. Hidden depths, gear ratios and friction remain reconstruction
choices. Sampled native contact and prior full-solid checks do not constitute
a proof of clearance at every time.

A new bounded contact-aware source-fit search at radii 20, 24, 28, 30 and
32 pixels did not yield a better accepted linkage. Its weighted objective can
prefer a slightly infeasible result over the known feasible warm start; this
does not show that the retained fit fails or that a better fit is impossible.
The existing checked fit is unchanged.

Production now differs from the old 086 baseline in four existing files:
the 087 builder/dispatch, its old test block, and the two display-profile
representations. The new 087 modules and trajectory are additional inputs.
Historical evidence and archived source files remain preserved. The new
`087-integrated-source-hashes.json` records this integration's source state;
it is not a declaration that every movement is mechanically verified.

The local evidence is `087-periodic-playback-closure.json`,
`087-integrated-playback-captures.json`, `087-integrated-playback-inspections.json`
and `087-integrated-playback-checkpoint.json`. Bulk trajectories, screenshots,
logs and build output remain outside Git. The complete 507-movement review
continues.
