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
document the varying traverse speed, completed rim and inferred guides.

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
node --test tests/mujoco-runtime.test.mjs tests/mujoco-treadle.test.mjs tests/mujoco-spring-sector.test.mjs tests/mujoco-eccentric-yoke.test.mjs tests/mujoco-triangular-eccentric.test.mjs tests/mujoco-crank-slider.test.mjs tests/mujoco-scotch-yoke.test.mjs tests/mujoco-variable-crank.test.mjs tests/mujoco-inclined-disk.test.mjs tests/mujoco-heart-cam.test.mjs tests/mujoco-grooved-heart.test.mjs tests/engine.test.mjs tests/camera-resize.test.mjs
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

The 097 migration passes 15 selected mechanism/runtime/camera tests and thirteen
production browser tests. Its 270 measured groove-face points have 2.1721-pixel
RMS distance from the fitted profile. Ten turns keep timestep and mesh position
differences below 0.15 source pixel and native soft penetration below 0.00618
pixel. Thirty-three poses pass over 2.08 million independent surface samples.
Fourteen final views are inspected and live playback averages 30.22 fps.
The source fit gives varying traverse speed; the cylindrical pin, ideal guides,
raised bar axis and enlarged retaining rim remain explicit reconstruction choices.
