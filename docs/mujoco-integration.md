# MuJoCo integration

MuJoCo is the default engine for future reconstruction work. Movement 082 is
the first production integration, imported from `codex/082-mujoco-pilot`.
Its ordinary `#/movement/082` route now advances the passive pawls and wheel
through live dynamics. The isolated `mujoco-082.html` preview remains available.
Movement 083 also runs live physics through the shared runtime: a pinned input
rod rocks two passive spring-guided sectors against a complete crown wheel.
See its [reconstruction and numerical limits](mujoco-083-spring-sectors.md).
Movement 090 uses the same runtime for an eccentric driving a passive yoke:
two joints, one motor and three primitive collision geometries. Its
[source reconstruction and checks](mujoco-090-eccentric-yoke.md) document the
straight bearing faces, inferred guides and finite running clearance.
Movement 091 adds a constant-width triangular cam driving a passive vertical
yoke, including both end dwells. Its [source fit and checks](mujoco-091-triangular-eccentric.md)
document the corrected sweep opening and the inferred mounting hardware.
Movement 092 uses the same runtime for an ordinary crank and passive crosshead.
Its [measured geometry and joint checks](mujoco-092-crank-slider.md) cover curved
cast spokes, the small source offset and a wrist constraint closing the linkage.
Movement 093 uses a disk-mounted wrist contacting the straight faces of a
passive Scotch yoke. Its [source fit and contact checks](mujoco-093-scotch-yoke.md)
document the small slot correction, extended stems and reconstructed guides.
Movement 094 uses a powered spiral plate to move a passive bolt in a held
radial plate. Its [source fit and contact checks](mujoco-094-variable-crank.md)
document the measured spiral, reconstructed stepped bolt and corrected slot fit.
Movement 095 uses an inclined disk to lift a passive rod and turn its fork-held
roller. Its [source reconstruction and contact checks](mujoco-095-inclined-disk.md)
cover measured disk faces, the radial axle interpretation and complete supports.
Movement 096 uses a heart cam to drive a passive horizontal bar and roller
against an added return spring. Its [source corrections and contact checks](mujoco-096-heart-cam.md)
cover the finite roller envelope, smooth reversals and inferred guides.
Movement 097 uses both faces of a measured heart-shaped groove to drive a
passive bar through a cylindrical pin. Its [source fit and contact checks](mujoco-097-grooved-heart.md)
document the Archimedean spiral flanks, short reversals, completed rim and inferred guides.
Movement 098 uses a disk-mounted crank pin to drive a passive hinged arm.
Its [source fit and contact checks](mujoco-098-endless-groove.md) document the
rear groove, section control and corrected crank orbit for full groove circulation.
Movement 099 uses a reversing disk to drive a passive feed rod and free roller
between adjacent turns of a spiral rail. Its
[source fit and contact checks](mujoco-099-spiral-feed.md) describe the corrected
pitch, completed rod, bored guide and section view exposing the roller.
Movement 100 uses crank-wrist contact with the straight slot faces of a passive
lever. Its [source reconstruction and contact checks](mujoco-100-quick-return.md)
cover the measured axis offset, full lever, ideal sliding contact and quick-return timing.
Movement 101 uses a hanging slotted lever to drive a passive horizontal bar.
Its [source fit and contact checks](mujoco-101-slotted-bar.md) cover the completed
handle, bored guides, small slot correction and extended bar end.
Movement 102 uses matching helical threads to drive the axial travel of a
rotating nut on a fixed bolt. Its [source reconstruction and contact checks](mujoco-102-screw.md)
cover the corrected helix slope, complete square threads, conical hexagon
chamfers, running clearance and nut section view.
Movement 103 uses a rotating leadscrew to drive a passive horizontal carriage
through matching threads. Its [source reconstruction and contact checks](mujoco-103-leadscrew-slide.md)
cover the integral curved carriage, completed bed, inferred retaining guide,
thread clearance, guide friction and section view.
Movement 104 uses an ideal MuJoCo gear constraint with a generated matching
worm wheel. Either the screw turns the held carriage's wheel, or the wheel
moves the carriage along a held screw. Its [reconstruction and limits](mujoco-104-worm-saddle.md)
distinguish ideal transmission reactions from tooth contact dynamics, which
are omitted along with backlash and tooth friction.
Movement 105 uses an ideal screw coupling and captured swivel to lower a
guided ram onto a rigid blank, with native contact at the working faces.
Its [source reconstruction and limits](mujoco-105-screw-press.md) cover corrected
thread handedness and shape, a surrounding guide, inferred lower frame,
finite hardware clearances and section views of the threads and swivel.
Movement 106 uses native groove-wall contact to drive a passive guided rod
from a rotating barrel. Its [source reconstruction and contact checks](mujoco-106-barrel-cam.md)
cover the corrected uniform stroke, rounded working pin, complete recessed
groove, measured hanging guides and inferred rigid follower attachment.
Movement 107 extends the same contact model to a repeating serpentine groove.
Its [source reconstruction and checks](mujoco-107-serpentine-cam.md) describe
the inferred eleven repetitions, uniform working flanks, smooth reversals,
narrower working pin needed to avoid undercut, and short rod's guide engagement.
Movement 108 now uses a passive swiveling shoe in intersecting reverse-thread
grooves. It is integrated under review: the [reconstruction record](mujoco-108-reverse-thread-candidate.md)
documents improved stroke uniformity alongside unresolved contact peaks,
mesh/timestep sensitivity and the projected groove/source discrepancy.

## Shared runtime

- `MovementEngine.create(container, movement, options)` asynchronously prepares
  a model, then attaches it to the existing Three.js scene. An optional abort
  signal prevents a completed load from attaching after navigation away.
- `model-loader.js` selects migrated factories. Other movements continue through
  the synchronous `registry.js` factory used by historical numerical studies.
  New application integrations should use the asynchronous loader, including
  when comparing 082 with its old registry reconstruction.
- `mujoco/load.js` loads the pinned official `@mujoco/mujoco` 3.13.0 package once
  per page. Its single-threaded WASM asset ships with the static site, loads
  lazily, and uses relative URLs beneath any hosting subdirectory.
- `createMujocoSimulation` owns each compiled MJCF model and data allocation.
  A mechanism supplies its initial state and actuator controls before each step.
  Partial initialization failures and repeated disposal release allocations safely.
- `createPhysicsPlayback` maps absolute display time to integer physics ticks.
  Pause does not step; speed changes time advancement; Restart restores the
  initial state. Seeking backward resets and integrates forward. There is no
  periodic playback seam or recorded trajectory.
- A physics model's `dispose()` owns its WASM and Three.js resources. The viewer
  removes that root before cleaning up its environment, avoiding double disposal.

Physics models supply their own timing and motion bounds. The old measured
display profile for a movement must not be applied to a different reconstruction.
Three.js groups receive the simulated body poses, with MuJoCo's wxyz quaternion
components reordered to Three.js xyzw. Visible hardware remains independent of
the collision approximation, so both boundaries need verification.

## What to migrate next

Prioritize the contact-sensitive ratchets, catches and clutches, including the
remaining 073 reconstruction and the bespoke 075/077/087 solvers.
Keep their traced source geometry, replace passive trajectory logic with joints,
contacts and loads, then compare engagement and clearances through repeated cycles.
Ordinary rigid linkages such as 089 can use hinges, sliders and loop constraints.

MuJoCo provides joint, contact, tendon and equality constraints. Concave contact
surfaces need a suitable representation; a single convex hull of a ratchet would
erase its tooth valleys. The 082 pilot decomposes the working plate outlines into
convex pieces. See the official [engine overview](https://mujoco.readthedocs.io/en/stable/overview.html)
and [collision documentation](https://mujoco.readthedocs.io/en/stable/computation/index.html#collision).

Using the engine does not establish the missing details of an engraving. For
082, the lower pawl spring is inferred, the equalizer uses a fitted joint
constraint, and belt shape/spin use a geometric approximation. Fluid machines,
flexible belts and other non-rigid behavior need a suitable model or a stated
approximation. Preserve those distinctions when migrating the collection.

## Validation

```sh
node --test tests/mujoco-runtime.test.mjs tests/mujoco-treadle.test.mjs tests/mujoco-spring-sector.test.mjs tests/mujoco-eccentric-yoke.test.mjs tests/mujoco-triangular-eccentric.test.mjs tests/mujoco-crank-slider.test.mjs tests/mujoco-scotch-yoke.test.mjs tests/mujoco-variable-crank.test.mjs tests/mujoco-inclined-disk.test.mjs tests/mujoco-heart-cam.test.mjs tests/mujoco-grooved-heart.test.mjs tests/mujoco-endless-groove.test.mjs tests/mujoco-spiral-feed.test.mjs tests/mujoco-quick-return.test.mjs tests/mujoco-slotted-bar.test.mjs tests/engine.test.mjs tests/camera-resize.test.mjs
npm run build
npx playwright test tests/e2e/mujoco.spec.mjs tests/e2e/camera-resize.spec.mjs
```

The focused physics tests include fifteen live 082 cycles, native pawl/tooth and
strap clearance, pin closure, deterministic restart, frame-independent stepping,
isolated model state and allocation cleanup. Browser checks cover loading on
demand, nested static hosting, pause/restart, navigation during loading and mobile
controls. The [pilot report](mujoco-082-pilot.md) records the mechanical assumptions
and bounded contact evidence; migration of the whole collection remains ongoing.

The initial 082 integration passed 13 focused tests and five browser tests,
including recovery from an unavailable WASM asset and cleanup in the standalone
preview. Seven production catalog views are inspected: desktop, four advancing
strokes, oblique and mobile. An 8.216-second run averages 23.7 fps in headless
Chrome on this machine. These captures precede only the final material-allocation
and preview-cleanup changes; the final build and browser suite include both.
The production build retains the existing large-application-chunk warning and
MuJoCo's browser-guarded Node `module` import warning.

Adding 083 brings the focused suite to 17 passing tests and six passing browser
tests. Both migrated movements now have fifteen-cycle native contact and pin
checks. The 083 report includes separate timestep refinement and the remaining
sensitivity in brief sector drops; it is integrated with those limits explicit.

The 090 migration passes 18 focused tests and seven browser tests, with twelve
inspected views. Ten-turn checks bound timestep sensitivity below a quarter
source pixel; a live browser capture averages 60 fps. Its bearing faces use
primitive colliders coincident with the visible solid. The rest of the opening
is independently checked against the complete circular sweep.

The 091 migration passes 22 selected mechanism/geometry/runtime/camera tests
and eight production browser tests. Its ten-turn timestep and cam-mesh
refinement checks stay within a tenth source pixel. Twelve views are inspected;
live browser playback averages 60 fps. The cam/yoke opening has a conservative
continuous sweep bound, and the output depends only on native contact and loads.

The 092 migration passes 21 selected numerical/geometry/runtime/camera tests
and nine production browser tests. Thirty-three native poses pass over a million
independent solid-surface checks. Ten-turn timestep refinement stays within
0.042 source pixel, twelve final views are inspected and live playback averages
60 fps. The pin and guide constraints are ideal joints; the visible hardware
and source fit are documented separately from their dynamics.

The 093 migration passes 15 selected mechanism/runtime/camera tests and nine
production browser tests. Ten-turn timestep refinement stays below 0.09 source
pixel. Thirty-three poses pass over 1.15 million independent surface checks
with only bounded wrist/yoke soft contact. Twelve final mechanism/application
views and an additional scrolled mobile note view are inspected; live playback
averages 60 fps. Removing contact and reversing the load confirm passive output
and operation of both working faces.

The 094 migration passes 15 selected mechanism/runtime/camera tests and ten
production browser tests. Ten adjustments keep timestep and spiral-mesh
refinement differences below 0.09 source pixel. Thirty-three poses pass over
2.77 million independent surface samples with only bounded bolt/groove soft
contact. Fourteen views are inspected and live playback averages 37.58 fps.
The radial guide is ideal, and the demonstration covers radius adjustment;
clamping and subsequent crank operation remain outside this model.

The 095 migration passes 15 selected mechanism/runtime/camera tests and eleven
production browser tests. Ten turns keep timestep sensitivity below 0.024 source
pixel in rod height and 0.384 pixel at the roller rim. Thirty-three poses pass
over 1.32 million independent surface samples with only bounded roller/disk soft
contact. Fourteen final views are inspected and live playback averages 59.69 fps.
The finite working face has a continuous envelope bound; the roller's radial
axle, ideal guides, fixed supports and friction remain reconstruction assumptions.

The 096 migration passes 15 selected mechanism/runtime/camera tests and twelve
production browser tests. Ten turns keep timestep sensitivity below 0.020 source
pixel in bar position and 0.304 pixel at the roller rim. Thirty-three poses pass
over 2.26 million independent surface samples with only bounded cam/roller soft
contact. Fourteen final views are inspected and live playback averages 59.94 fps.
The roughly 11-pixel cam correction, 6-pixel bar alignment shift, smooth reversals
and inferred return spring are explicit in the reconstruction and viewer note.

The corrected 097 uses two Archimedean spiral flanks with short smooth reversals.
Its earlier varying-speed harmonic fit was incorrect and is superseded. Fifteen
selected tests pass; ten turns keep native follower error on the flanks below
0.067 source pixel and travel-speed error over 100 ms below 1.218%. The corrected
walls differ from 270 measured ink points by 8.3850 pixels RMS. Fourteen corrected
views are inspected. See the movement document for finite-pin reversal relief,
source corrections and timestep sensitivity.

The corrected 098 crank pin completes one lap of the oblong groove per revolution.
Its earlier lower-branch return was incorrect and is superseded. The crank radius
is corrected to 123.1877 source pixels and its axis shifted 0.7826 pixel to reach
both radial ends. Four mechanism tests pass, including ten complete laps at
three timesteps and two mesh resolutions. Native penetration stays below 0.03027
pixel; maximum timestep/mesh angular sensitivity is 0.362° near the dead centers.
The two-second physical period preserves circulation under gravity and friction.
The measured rear groove, section cover, finite working pin and bearings remain.

Both corrected movements pass the production build and all 15 MuJoCo browser
tests. Fourteen 097 views and eighteen 098 views are inspected; frozen source
and image hashes are verified in the separate correction inspection reports.

The 099 migration passes 15 selected mechanism/runtime/camera tests and fifteen
production browser tests. Its 487 measured spiral points match the finite
centerline within 2.5316 pixels RMS. Ten feed-and-return cycles keep native
soft penetration below 0.00381 pixel, timestep feed differences below 0.012
pixel and roller-rim differences below 0.573 pixel. Thirty-three poses pass
over 9.19 million independent surface samples. Sixteen final views are
inspected and playback averages 28.16 fps. The corrected spiral pitch, lowered
guide, extended rod and reversing motor are explicit reconstruction assumptions;
only the disk is actuated. The complete spiral takes about nine seconds to assemble in
headless Chrome, with its loading indicator visible during compilation.

The 100 migration passes 15 selected mechanism/runtime/camera tests. Its native
lever gives a quick-return ratio of approximately 2.113:1, matching the measured
crank and pivot geometry. The settled slot and lever match independent source
readings within 2.454 and 2.800 pixels RMS respectively. Ten cycles keep soft
penetration below 0.05151 source pixel and timestep differences below 0.043°.
Thirty-three poses pass 1,039,962 independent surface samples without unintended
intersections. The complete rear wheel, measured shaft offset and full output
extension are retained; the frictionless wrist, flat output section and bearings
are explicit reconstruction assumptions.
All fifteen final views were inspected, playback averages 60.00 fps, and the
production build and all sixteen MuJoCo browser checks pass.

The 101 migration passes 15 selected mechanism/runtime/camera tests. Independent
source readings match its corrected slot and outer lever body within 0.746 and
0.365 pixels RMS. Native contact drives a 148.7134-pixel horizontal stroke with
no measured backtracking over ten swings. Both bored guides retain the bar;
31 poses pass 935,316 independent surface samples without unintended
intersections. Soft penetration stays below 0.00594 pixel and timestep
differences below 0.03574 pixel. All sixteen final views are inspected and
playback averages 60.00 fps. The small slot widening, extended bar, completed
handle, symmetric drive and ideal frictionless bearings are explicit assumptions.
The production build and all seventeen MuJoCo browser checks pass.

The 102 migration passes 22 selected mechanism/runtime/camera/catalog tests.
Complete helical thread contact drives a passive axial nut slide, with a
150.3503-pixel stroke over five turns in each direction. The engraving's
exaggerated thread slope is corrected while retaining pitch and diameter.
Ten cycles retain the nut, with native penetration below 0.04170 pixel and
31 poses passing 5,629,476 independent finite-surface checks without
intersections. Compiled contact-sector error is below 0.04687 pixel; timestep
and sector refinements change travel by less than 0.11256 and 0.07867 pixel.
All eighteen final views are inspected and real-time headless playback
averages 28.37 fps. The build and all eighteen MuJoCo browser checks pass;
102 passes again after the final shadow-map adjustment. The fixed bolt,
ideal coaxial alignment, 0.3-pixel running clearance, frictionless contact
and reversing input are explicit reconstruction assumptions.

The 103 migration passes 16 selected mechanism/runtime/camera tests and all
nineteen MuJoCo browser checks. Its carriage haunch matches 61 independent ink
readings within 1.7198 pixels RMS; the physical helix corrects the drawn slope
while retaining pitch, diameter and direction. Ten cycles retain the carriage
and guide. Two-cycle 2 ms/1 ms travel differences stay below 0.132625 pixel.
Thirty-three poses over the first cycle pass 5,162,448 finite-surface samples,
with only intended thread penetration below 0.002350 source pixel.
All eighteen final views are inspected, and headless playback averages
23.98 fps at the full eight-second physical period. The build passes.
The ideal bearings and guide, open-bay bed interpretation, completed ends,
friction values and reversing drive are explicit reconstruction assumptions.

The 104 migration passes four mechanism tests, eleven runtime/engine/camera
tests and the four existing 031 worm-drive tests. Its ideal gear constraint
transmits motion and static loads in both input arrangements; removing that
constraint stops the passive output. Ten cycles per mode retain the guide.
Eighteen native poses pass 33,097,524 finite-surface samples, with intended
worm/wheel overlap below 0.008249 pixel. The build and all twenty MuJoCo
browser checks pass, including the input selector and final shadow adjustment.
All seventeen final views are inspected. Headless playback averages 13.87 fps,
with 0.220 ms mean physics/update time; rendering is the measured limit.
The matching visible surfaces do not imply native tooth contact simulation:
tooth friction, backlash, impacts and self-locking remain omitted.

The 105 migration passes four mechanism tests, eleven runtime/engine/camera
tests, the production build and all 21 MuJoCo browser tests. Its C frame
matches 139 ink readings within 1.48018 pixels RMS; matching square helices
retain source pitch and correct the previous thread handedness. Ten strokes
reach the rigid blank and return, with native penetration below 0.002225 pixel.
Seventeen poses pass 3,949,752 finite-surface samples with only intended
ram/blank contact. Minimum key engagement remains 11.08320 source pixels.
Halving the timestep changes travel by less than 0.011155 pixel.
All nineteen final views are inspected and headless playback averages
39.10 fps, with mean physics/update time 0.150 ms. The screw, swivel and guide
use ideal constraints; thread contact, friction and self-locking are omitted.
The hidden bearing, key, depths, completed lower frame, anvil, rigid blank
and reversing drive are explicit reconstruction assumptions.

The 106 migration passes four mechanism tests, eleven runtime/engine/camera
tests, the production build and all 22 MuJoCo browser tests. Its corrected
groove matches 161 independent ink readings within 3.74299 pixels RMS.
Ten revolutions retain both guides and complete every stroke, with position
error below 0.019514 source pixel and speed variation below 1.40215% over
100 ms intervals on the uniform flanks. Thirty-three poses pass 5,935,008
finite-surface samples, with only intended pin/land overlap below 0.001688
pixel. Native penetration stays below 0.004653 pixel. Timestep and mesh
refinement change travel by less than 0.031875 pixel. All sixteen final
views are inspected; live headless playback averages 36.32 fps at physical
speed. The rounded pin, rigid head attachment, depths and ideal bearings
and guides are stated reconstruction assumptions. Output motion comes
from contact, with no output actuator, spring or equality.

The 107 migration passes four new mechanism tests, all four 106 regressions,
eleven shared tests, the production build and all 23 MuJoCo browser tests.
Ten full barrel turns complete 220 half-strokes, with follower error below
0.103872 source pixel and guide engagement above 8.03050 pixels. Forty-three
poses pass 13,327,862 surface samples with only intended pin/land contact.
The final narrower working pin avoids pitch-curve undercut under either load.
Its eleven repetitions are inferred from the source fit; the caption does not
specify a count. All sixteen final views are inspected, and headless playback
averages 19.84 fps at the physical two-second output cycle. The native model
has only an input actuator; output motion comes from groove-wall contact.

The 108 integration passes four mechanism and three shared-runtime tests, the
build and all 24 MuJoCo browser regressions. Nineteen integrated views are
inspected, including desktop/mobile controls and notes. Playback averages
20.88 fps at 99.00% physical speed over 22 seconds. Six native output cycles
retain the chosen groove; contoured shoe sides reduce p95 stroke-speed error
from 9.05% to 1.47844%. The longer run nevertheless reaches 0.36499 source pixel
of contact penetration, and mesh/timestep studies fail the 0.1-pixel bound.
The projected groove pattern also differs from the engraving. This mechanism
is available for review, with final mechanical qualification still open.
