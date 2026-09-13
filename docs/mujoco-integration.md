# MuJoCo integration

MuJoCo is the default engine for future reconstruction work. Movement 082 is
the first production integration, imported from `codex/082-mujoco-pilot`.
Its ordinary `#/movement/082` route now advances the passive pawls and wheel
through live dynamics. The isolated `mujoco-082.html` preview remains available.

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
remaining 073 and 083 reconstructions and the bespoke 075/077/087 solvers.
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
node --test tests/mujoco-runtime.test.mjs tests/mujoco-treadle.test.mjs tests/engine.test.mjs tests/camera-resize.test.mjs
npm run build
npx playwright test tests/e2e/mujoco.spec.mjs tests/e2e/camera-resize.spec.mjs
```

The focused physics tests include fifteen live 082 cycles, native pawl/tooth and
strap clearance, pin closure, deterministic restart, frame-independent stepping,
isolated model state and allocation cleanup. Browser checks cover loading on
demand, nested static hosting, pause/restart, navigation during loading and mobile
controls. The [pilot report](mujoco-082-pilot.md) records the mechanical assumptions
and bounded contact evidence; migration of the whole collection remains ongoing.

The integrated build passes all 13 focused tests above and five browser tests,
including recovery from an unavailable WASM asset and cleanup in the standalone
preview. Seven production catalog views are inspected: desktop, four advancing
strokes, oblique and mobile. An 8.216-second run averages 23.7 fps in headless
Chrome on this machine. These captures precede only the final material-allocation
and preview-cleanup changes; the final build and browser suite include both.
The production build retains the existing large-application-chunk warning and
MuJoCo's browser-guarded Node `module` import warning.
