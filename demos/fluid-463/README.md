# Movement 463: isolated fluid experiment

Open **http://localhost:5188/demos/fluid-463/** while the demo server is running.
The same directory is available at `/demos/fluid-463/` on an existing project Vite server.

To start a separate server from the repository root:

```sh
node node_modules/vite/bin/vite.js --host 0.0.0.0 --port 5188 --strictPort
```

All prototype code and evidence live in this directory. No production movement,
registry, dependency manifest, shared renderer, or main review artifact is changed.
The demo uses the existing Three.js installation. It does not import Splash or
Particles4All: this is a small WebGL experiment to evaluate moving water before a
larger GPU solver integration.

## Try it

1. Let the initial reservoir settle. Water spills through the upper leaf's notch.
2. Press **Flood pulse** to increase inlet flow for nine simulated seconds. The
   automatic gate model responds to the measured upstream/downstream water levels.
3. Drag the gate slider to open the leaves manually; this disables automatic mode.
4. Switch **Smooth water** to **Fluid particles** to see the underlying simulation.
5. Try **Side view**, orbit, pause/resume, reset, and the three detail levels.

Light is the default, including on mobile. Balanced and Fine increase particle
counts and CPU cost. Simulation time slows under load; fixed integration steps
are preserved. The fps readout uses actual elapsed frame time. A nine-second
flood can therefore take longer than nine wall-clock seconds on a slow device.

## What is simulated

`fluid.js` implements a three-dimensional position-based fluid with gravity,
spatial-grid neighbor lists, three density-constraint iterations per 1/60-second
step, a Poly6 kernel, a small artificial-pressure term, and velocity smoothing.
An approximate kernel integral over solid half-spaces supplies missing wall
density. Water collides with oriented gate panels, the notch sides, channel floor,
and flume side/end walls. The downstream end is open. Equal particle volumes,
inlet additions, and outlet removals are counted explicitly.

The upper gate has one rotational degree of freedom. The lower leaf follows the
upper bottom edge through a geometric overlap-contact relation. Automatic motion
uses a hydrostatic panel-pressure torque integral and the lower leaf's mechanical
advantage, with explicit approximate inertia and hinge damping. No periodic gate
animation is used. Downstream level estimation rejects sparse falling jets.

`water-renderer.js` renders particle sphere depths and thickness, filters the
surface depth, reconstructs normals, and composites absorption, refraction, and
approximate environment reflections against the actual scene depth. The water
surface follows simulated positions; it is not a fixed tube or height animation.
The renderer uses WebGL2 float render targets. Its particles view skips the water
compositing passes and is useful for inspection and slower hardware.

## Limits relevant to adoption

- This is an appearance and interaction prototype, not an accepted reconstruction
  of 463. Dimensions, gate mass/damping, and water parameters are illustrative.
- Gate forces use a hydrostatic approximation, not resolved particle pressure or
  two-way transfer of collision impulses to rigid bodies. Falling jets, unsteady
  pressure, sediment transport, and structural loads are not modeled accurately.
- Density enforcement is approximate. Particle conservation is exact, but that
  does not establish incompressibility or energy conservation. Boundary density
  near edges/corners, coarse narrow-slot flow, and impacts need further work.
- Panel contacts use positional collision projection. The numerical checks cover
  the tested runs, not all possible trajectories or continuous swept collisions.
  Decorative rails and shafts are rendered but are not separate fluid colliders.
- The screen-space surface is approximate and can look rounded at low particle
  counts. Rendered splats are larger than collision particles; scene-depth
  rejection limits their overlap with hardware. This is not exact meshing.
- The CPU solver is deliberately self-contained and costs substantial frame time.
  Sustained high-resolution use would benefit from a GPU solver. No hardware-GPU
  performance claim should be inferred from a headless software-rendering check.
- Supports one demo at a time. The main catalog, its animation timing, and its
  tests have not been migrated to this architecture.

## References

- Macklin and Müller, [Position Based Fluids](https://matthias-research.github.io/pages/publications/pbf_sig_preprint.pdf), SIGGRAPH 2013. Algorithmic reference; no source code copied.
- [Splash](https://github.com/matsuoka-601/Splash): potential WebGPU MLS-MPM solver and surface-rendering reference for a later experiment.
- [Particles4All](https://github.com/matsuoka-601/Particles4All): potential WebGPU fluid/rigid-body solver for future coupling work.
- [Original movement 463](https://507movements.com/mm_463.html).

## Verification

Run the prototype checks from the repository root:

```sh
node demos/fluid-463/check-fluid.mjs
node demos/fluid-463/check-browser.mjs
```

The browser check requires the demo server on port 5188. Evidence is written to
this directory only. `verification.json` and `browser-verification.json` record
the results. Screenshots show desktop water, particle inspection, and mobile.
