# 110 — selectable half-nut traverse candidate

`src/simulation/mujoco-half-nut/` reconstructs the engraving with opposite-hand
fine screws, two rocking half-nuts, a sliding rod and the long selector lever.
Native thread contact drives the rod and produces repeated reversals. This is
an isolated candidate: the catalog still uses the existing authored 110.
Playback performance, broader dynamics and source interpretation remain open.

## Source reconstruction

Brown's [110 caption](https://507movements.com/mm_110.html) describes a spool
traverse whose operator selects one of two half-nuts on opposite-hand screws.
The left casting hides the screw in the engraving, whereas the right screw
hides most of its casting. The reconstruction interprets these as near and far
half-cylinders relative to the drawing plane. The roller and lower rod have
parallel X axes; the half-nuts open toward opposite Z directions. This hidden
orientation is an interpretation, not a measured section drawing.

The source script measures 44 edges and two thread patterns from the 525-pixel
engraving. One model unit represents 100 source pixels. The measured axis
spacing is 126.1214 pixels, and the left and right pitches are 5.4862 and
5.2819 pixels. A common 5.3841-pixel pitch gives equal nominal traverse speeds.
The plain neck fixes the 12.8684-pixel shaft radius; the thread crest radius
is 19.8686 pixels. Half-pitch thread depth is inferred separately from the neck.

Actual transformed mesh extents differ from 1,100 sampled edge readings by
**0.79919 pixel RMS and 2.83752 pixels maximum** in the initial source pose.
That metric covers outlines and crest extents, not every projected thread
flank. The real helices correct the drawing's varying pitch and diagonal
stroke geometry. The shaft axes are straightened and the two lever knobs use
a common X coordinate. Depth, hidden roots, arm bends and attachment details
are reconstructed. The inactive casting's outer section compensates for its
tilt in the source pose; its working bore remains cylindrical when selected.

Twenty closed mesh parts retain the measured frame, nut, collar and arm
widths. The near arm extends visibly onto the casting's outer face. Bearing
bores accommodate the roller and sliding rod. Both halves of the selector
lever remain visible. Fog and ground are disabled.

## Contact and selection

The roller has a driven hinge. The carriage has a passive X slide and an
actuated X hinge that rocks between ±0.10 radian. There is no traverse actuator,
axial spring, screw equality or periodic position reset. Disabling contact
leaves an initially stationary rod still while the roller turns.

Square male ridges contact female ridges whose tips have 0.8-pixel relief on
each axial flank. This inferred taper allows the open edges to withdraw while
the nut rocks. An unrelieved square female profile jammed during withdrawal.
The nominal root/flank clearance is 0.1 pixel. Visible female ridges and their
native convex sectors share vertices; the angular partition faces are removed
from the visible exterior. Roller cores and nut castings also participate in
contact, so those solids cannot be silently ignored during engagement.

Native geometry has 3,388 collision geoms. All 27,285 compiled mesh vertices
match their construction vertices within 0.00000236 source pixel. This checks
compilation and transforms; it is not a general continuous hull-error proof.
Mass and full inertia are integrated from the closed visible parts at uniform
density, normalized to roller mass 1. Small rigid attachment overlaps remain
part of this uncalibrated mass estimate.

The demonstration operates the selector automatically at rod positions ±20
pixels, using a 0.45-second smooth command. The roller turns at 60 rpm. The
operator's support of the selector weight is represented by a compensation
torque evaluated from the current pose. Reading cached bias forces instead
made the result depend on render-frame timing; the regression now checks exact
replay across different frame partitions. Selector stops at ±0.10 radian and
slide limits at ±28 pixels are inferred. The current traverse stays inside
±22 pixels, clear of the axial limits. Bearings, guides, stops, automatic
selection and gravity normal to the engraving plane are explicit assumptions.

Defaults use a 2 ms timestep, 8 ms soft-contact response, frictionless working
faces, implicit integration and position servos on the roller and selector.
The 18-second timing metadata is a nominal display estimate, not a proven
periodic orbit. Neither load capacity nor contact forces are calibrated.

## Current evidence and remaining work

A 21-second native run makes three selections at 3.712, 11.692 and 19.706
seconds. It reaches −21.7324 to +21.9566 pixels, with maximum native penetration
0.12672 pixel. The largest rod step is 0.12262 pixel. These measurements show
repeated engagement; they do not establish uniform instantaneous speed or
long-duration robustness. A previous 4 ms version without selector stops
reached 0.44636-pixel penetration and is not retained.

Seven candidate and shared-runtime tests pass, covering closed solids, neutral
clearance, compiled vertices, passive traverse, repeated reversals, deterministic
restart/seeking and native disposal. A separate 21-pose audit makes 5,960,312
surface queries with no unintended cross-family intersections. Its sampled
nut/roller penetration reaches 0.01244 pixel. The audit permits up to 0.15 pixel
for intended contact and checks all rendered vertices against the camera
bounds. It excludes rigidly attached parts and does not prove continuous
clearance between samples.

Sixteen final views are inspected: source front and overlay, both selection
directions, rear and oblique assemblies, close-ups and debug views exposing
each female thread. The debug views hide only the casting mesh; its native
mass and contacts remain active. Some hard shadows remain prominent.

The final headless browser trial averages **12.82 fps at 62.86% of physical
speed** over 12.0864 seconds. Mean update cost is 56.77 ms per rendered frame,
with 65.40 ms at the 95th percentile. This is still too slow for integration.
There are no page errors; warnings are the existing Three.js deprecation and
GPU readback notices. The production build passes with existing large-chunk
and guarded Node-import warnings. It does not include this unregistered
candidate; native tests and direct browser imports exercise the new files.

Next work is reducing contact cost while preserving withdrawal and engagement,
then checking refined timesteps/meshes, longer runs, loads and working-stroke
speed. Catalog integration and its browser regressions remain pending. Current
source and dynamics evidence must be revisited when those changes affect it.

Local evidence is outside Git: `/dev/shm/110-source-b.json`,
`110-comparison-b.json`, `110-dynamics-i.json`, `110-candidate-tests-c.txt`,
`110-clearances-a.json`, `110-candidate-b.json`,
`110-candidate-b-inspection.json` and `110-build-a-log.txt`.

## Reproduction

Use fresh output prefixes; scripts preserve source snapshots and refuse to
overwrite existing evidence. The capture expects a Vite server on port 5174.
Keep one owned browser at a time and do not change its inputs during capture.

```sh
PROBE_PREFIX=/dev/shm/110-source-b node scripts/measure-half-nut-source.mjs
PROBE_PREFIX=/dev/shm/110-new-comparison node scripts/compare-half-nut-source.mjs
TMPDIR=/dev/shm node --test tests/mujoco-half-nut-candidate.test.mjs tests/mujoco-runtime.test.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/110-new-dynamics DURATION=21 node scripts/probe-half-nut-dynamics.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/110-new-clearances node scripts/audit-half-nut-clearances.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/110-new-views node scripts/capture-half-nut-candidate.mjs
TMPDIR=/dev/shm npm run build -- --outDir /dev/shm/110-new-build
```
