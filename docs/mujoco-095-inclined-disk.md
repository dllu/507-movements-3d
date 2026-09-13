# 095 — inclined disk and upright follower

The catalog's `#/movement/095` route now uses MuJoCo contact to lift an upright
rod and turn the roller held in its fork. Only the vertical input shaft is
actuated. A revolution takes four seconds; playback integrates continuously.
The former synchronous registry model remains available to historical studies.

## Source reconstruction

Brown's [movement 095](https://507movements.com/mm_095.html) describes an upright
shaft carrying an oblique disk, which reciprocates a rod resting on its surface.
The enlarged fork detail in `public/engravings/mm_095.png` is interpreted as a
narrow roller with a radial axle. Brown's text does not specify its construction.
The old model used a sphere, a pin above that sphere, an excessively long rod,
a large added frame, rotation markers and a rim above the working surface.
Four baseline views and an enlarged source detail are inspected.

`scripts/measure-inclined-disk-source.mjs` fits complete raster ink runs. One
model unit represents 100 source pixels. Each disk face has 62 readings; their
independent line fits have 0.4392 and 0.5289 pixel RMS residuals. A common slope
regularizes the slight taper in the drawing. The reconstructed disk inclination
is 12.5663°, with 16.4671 pixels of thickness normal to its faces. Its center is
(190.8261, 236.9649) in the raster. The main shaft's two outlines give an
18.1087-pixel radius, with 23 readings on each side and 0.1739–0.2362 pixel line
RMS. Twenty-five readings on each rod side give a 6.0300-pixel radius and
0.1944–0.1997 pixel line RMS. The upright axes are regularized as vertical.

The rod is 110.0439 pixels from the shaft axis. The source's right disk extent
sets a 142.3759-pixel radius after accounting for inclination and thickness.
The left edge's break mark is completed to the same circular radius, adding
about ten pixels beyond the drawn cut. The entire disk remains available when
orbiting; the front source overlay does not substitute a thin bar for that disk.

The roller's 13.5-pixel radius and 8.4-pixel axial width are manual readings of
its edge view. Its ordinary axle passes through real bores in the wheel and
both fork cheeks. The cheek tops have flat mating faces beneath the bridge;
the rod abuts that bridge. Gravity settles the roller onto the measured disk,
placing its axis about three pixels below the manually read source center.
The fork's lower ends are regularized to clear the inclined face throughout a
turn. Its width, sloping shoulder, rounded ends and bearing clearance remain
reconstruction choices, rather than independently fitted hidden geometry.

The bell-shaped hub terminates on the disk's actual inclined underside and
joins the vertical shaft below. Its smooth flare follows the source silhouette;
the radial interpolation and hidden surface are inferred. The main bearing
bracket has a real shaft bore, a lower retaining collar and visible fasteners.
The hatched fixed support is represented by a bounded wall slab. The wall's
depth, bracket depth, fasteners, upper rod guide and the frame behind the disk
are inferred. That guide accommodates the full stroke without extending the
source-length rod. All 20 visible parts are closed solids.

The orange shaft assembly drives the blue fork and rod; the roller is brass,
and fixed supports are gray. Shared matte materials retain the complete 3D
surfaces. Fog and the ground plane are disabled. Camera bounds include the
entire moving assembly and rear guide frame. The catalog note discloses the
roller interpretation, added guide, hidden depths and completed disk edge.

## Contact model and limitations

Three native coordinates represent the input hinge about the upright axis,
the follower's vertical slide and the roller's radial hinge. Only the input
has an actuator. The rod guide and axle are ideal joints; finite hardware and
its clearances are checked separately. No output coordinate is prescribed
while stepping.

A finite octagonal prism supplies the disk's working flat face. Its native
vertices are checked against the visible tilted disk. A conservative bound on
all possible roller points lies within the prism's incircle, so its omitted
outer rim cannot participate in contact. This replaces an initial native
cylinder/cylinder pair that incorrectly reported a distant disk-edge contact.
The visible disk retains its complete circular rim.

The roller uses a native cylinder matching its outer radius and width. This
proxy fills the axle bore, which cannot contact the disk under the ideal hinge
and guide constraints. Its mass and full inertia tensor come from the bored
visible wheel. Input and follower mass properties likewise come from their
closed visible hardware at uniform density, normalized to unit input mass.

The model uses a 1 ms timestep, implicit integration, gravity, motor gains
10000/200, friction 0.3 and a 4 ms soft-contact response. Initial settling lasts
0.5 second. Playback starts with velocities for an already rotating input and
roller, avoiding an artificial initial skid. A separate test starts the roller
at rest and confirms that contact spins it. Removing contact lets the rod fall
and leaves an initially stationary roller at rest.

Contact shifts between the finite roller's edges as the disk's slope changes.
The guide reacts radial forces, and tangential contact can slip. Neither exact
no-slip rolling nor a zero-clearance follower trajectory is imposed. The
analytical finite-cylinder support height is used only for initialization and
independent trajectory checks. Restart is deterministic across different render
frame partitions. Friction, bearing compliance, wear and contact forces are
uncalibrated; this is a reconstruction of the described motion.

## Validation

Fifteen selected mechanism, runtime, engine and camera tests pass. Ten
uninterrupted revolutions (40 seconds) are checked at every 1 ms step. Maximum
height difference from the finite-roller support envelope is 0.00398 source
pixel, and maximum native soft penetration is 0.00388 pixel. The roller turns
passively at roughly 12.32–13.80 rad/s in the expected direction.

Thirty-three poses pass topology and camera checks across the 20 closed parts.
Their 1,324,642 independent surface samples find only intended roller/disk soft
contact, bounded by 0.00219 pixel of overlap. These sampled checks supplement
the continuous guide and working-face envelope bounds; they do not prove
continuous clearance between every pair of hardware surfaces.

Over the same ten turns, 1 versus 0.5 ms changes rod height by at most 0.02306
pixel; 0.5 versus 0.25 ms changes it by 0.01080 pixel. Doubling both the visible
circular resolution and collision-prism sides changes height by 0.00409 pixel.
Corresponding accumulated roller-angle differences, expressed at its rim,
are 0.38340, 0.04657 and 0.26870 source pixel. Those spin sensitivities remain
separate from the much smaller vertical differences and the uncertainty in
inferred friction and roller construction.

The production build and all eleven browser tests pass, including playback,
restart, nested static hosting, loading races, asset retry and shared-runtime
disposal. Fourteen final views are inspected: source front and overlay, four
front poses, oblique and rear views, the roller from two directions, the hub,
desktop, mobile and the scrolled mobile reconstruction note. The fork's flat
mating faces, finite roller contact, complete disk and rear supports are visible.
The camera and controls fit both tested viewport sizes.

Live playback averages 59.69 fps over 16.22 seconds in headless Chrome on this
machine. Mean physics/update time is 0.229 ms, with 0.400 ms at the 95th
percentile. There are no page errors or unexpected warnings. Existing Three.js
deprecation/readback notices and the build's large-chunk and guarded Node-import
warnings remain.

Local evidence uses `/dev/shm/095-source-final.json`, `095-tests-final.txt`,
`095-build-final.txt`, `095-browser-final.txt` and `095-final.json`. The separate
`095-final-inspection.json` records all inspected image hashes and verifies
the frozen source snapshots. The final test log is an unchanged copy of
`095-tests-b.txt`; only loader ordering and documentation changed afterward.
The eleven inspected candidate views precede the flat fork mating faces and
the final collision-prism alignment, and are superseded by the final capture.

## Reproduction

```sh
PROBE_PREFIX=/dev/shm/095-measured node scripts/measure-inclined-disk-source.mjs
TMPDIR=/dev/shm node --test tests/mujoco-inclined-disk.test.mjs tests/mujoco-runtime.test.mjs tests/engine.test.mjs tests/camera-resize.test.mjs
TMPDIR=/dev/shm npm run build
TMPDIR=/dev/shm npx playwright test tests/e2e/mujoco.spec.mjs --output=/dev/shm/095-browser-results
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/095-new-views node scripts/capture-mujoco-inclined-disk.mjs
```

The capture uses an existing Vite server on port 5174 and exclusive source
snapshots. Use fresh prefixes for repeated studies. Only one owned browser runs
at a time, and source/build files remain unchanged until it exits. Bulk evidence
stays outside Git.
