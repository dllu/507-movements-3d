# 110 — selectable half-nut traverse

`src/simulation/mujoco-half-nut/` reconstructs the engraving with opposite-hand
fine screws, two rocking half-nuts, a sliding rod and the long selector lever.
Native thread contact drives the rod and produces repeated reversals. The
catalog now loads this reconstruction at physical speed. It remains under
review: instantaneous speed, contact convergence and source interpretation
are not fully qualified.

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

Native geometry has 1,812 collision geoms. All 14,631 compiled mesh vertices
match their construction vertices within 0.00000236 source pixel. This checks
compilation and transforms; it is not a general continuous hull-error proof.
The working threads use 32 angular divisions, with additional stations at
clipped ends. Their maximum circular chord sag is below 0.097 source pixel;
this geometric discretization bound does not bound soft-contact penetration.
Visible and native thread sectors retain matching vertices. Shafts, bearings
and guides keep their existing finer circular sections.
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
The 16-second timing metadata matches measured same-direction selection
intervals of 15.984–16.020 seconds over the 68-second run. It is a display
estimate, not an exact periodic orbit or a position reset. Neither load
capacity nor contact forces are calibrated.

## Current evidence and remaining work

A 68-second native run makes nine selections, including four complete
same-direction selection intervals. It reaches −21.7423 to +21.8132 pixels,
with maximum native penetration 0.10285 pixel and maximum rod step 0.11057
pixel. The first three selections occur at 3.730, 11.732 and 19.734 seconds.
There are no nonfinite states or prescribed position resets.

Over 605 working intervals of 100 ms, speed error has a 14.8561% p95 and
53.8638% maximum. The analysis excludes the selector's 0.45-second movement
and 0.30 seconds of settling, and retains the remaining stroke through its
approach to the next selection. Each stroke differs from an ideal screw line
of the specified lead, fitted with a median axial offset, by at most 0.25604
source pixel at the sampled poses. Thus the visible traverse is close to
linear, but uniform instantaneous speed is not established.

The following 21-second comparisons all retain three selections. The axial
loads are ±0.1 in the model's normalized units; they are sensitivity checks,
not a calibrated load rating.

| Variant | Maximum native penetration, source pixels | Traverse range, source pixels |
| --- | ---: | --- |
| Default, 32 divisions / 2 ms | 0.08057 | −21.7423 to +21.8031 |
| 32 divisions / 1 ms | 0.10610 | −21.6916 to +21.7006 |
| 64 divisions / 2 ms | 0.12672 | −21.7324 to +21.9566 |
| Axial load +0.1 | 0.06861 | −21.6020 to +21.6998 |
| Axial load −0.1 | 0.10180 | −21.7716 to +21.7698 |

The half timestep and finer mesh differ from the default sampled axial
trajectory by at most 0.20287 and 0.29984 pixel respectively. Penetration does
not converge monotonically. Negative load increases p95 working speed error
to 35.1329%. Longer loaded runs, friction sensitivity and contact-force
convergence remain open. A previous 4 ms version without selector stops
reached 0.44636-pixel penetration and is not retained.

Thirteen mechanism, shared-runtime and engine tests pass, covering closed solids, neutral
clearance, compiled vertices, passive traverse, repeated reversals, deterministic
restart/seeking and native disposal. A separate 27-pose audit makes 4,414,170
surface queries with no unintended cross-family intersections. Its sampled
nut/roller penetration reaches 0.07852 pixel. It includes the long-run native
penetration witness and later selections through 68 seconds. The audit permits up to 0.15 pixel
for intended contact and checks all rendered vertices against the camera
bounds. It excludes rigidly attached parts and does not prove continuous
clearance between samples.

Sixteen final integrated views are inspected: source front and overlay, both selection
directions, rear and oblique assemblies, close-ups and debug views exposing
each female thread. The debug views hide only the casting mesh; its native
mass and contacts remain active. Some hard shadows remain prominent.

The 32-division candidate browser trial averages **23.68 fps at 99.53% of
physical speed**, compared with 12.82 fps and 62.86% for the original
64-division candidate. Mean update cost falls from 56.77 to 23.49 ms per
rendered frame, and p95 falls from 65.40 to 31.80 ms. No page errors occur;
warnings are the existing Three.js deprecation and GPU readback notices.
The production build includes the registered 110 and passes with its existing
large-chunk and guarded Node-import warnings.

The final registered-factory capture averages **22.44 fps at 98.87% physical
speed** over 12.0321 seconds. Mean update cost is 24.85 ms and p95 is 31.90 ms.
It has no page errors. All 26 production MuJoCo browser regressions pass,
including 110's loading beneath a static subdirectory, pause/restart, mobile
controls and navigation away and back. The suite also exercises asynchronous
loading failures and native disposal.
Further work concerns speed ripple, contact
convergence, longer loaded runs, friction, close-up shadows and source
interpretation. Integration is an improvement, not final mechanical qualification.

## Performance decisions

Fixed-pose profiling identified collision processing as the dominant cost;
kinematics and the constraint solver were much cheaper. Switching off
multi-contact generation, changing CCD tolerance and grouping convex cells
into rigid child bodies gave insufficient benefit. One recentered grouping
also increased peak penetration to 0.26349 pixel.

A conservative spatial pair filter reproduced all 211 recorded states of the
64-division trajectory exactly, including velocities and contact counts, but
only reduced step cost from 3.029 to 2.520 ms. Its JavaScript filtering cost
was 0.769 ms per step and compilation was slower. It is not retained. Early
filter prototypes used negative margins for unused pairs; MuJoCo still
evaluated those pairs and produced invalid distance measurements. Those
failed runs are not qualification evidence.

Reducing angular divisions preserves native collision handling and cuts the
measured default cost to 1.445 ms per step over 68 seconds, with compilation
around 2.2 seconds instead of 6.5 seconds. No custom collision filter or
runtime contact-pair mutation is present in the integrated implementation.

Local evidence is outside Git: `/dev/shm/110-source-b.json`,
`110-comparison-c.json`, `110-dynamics-i.json`, `110-dynamics-j.json`,
`110-dynamics-k.json`, `110-dynamics-l.json`, `110-dynamics-m.json`,
`110-dynamics-n.json`, `110-tests-d-log.txt`, `110-clearances-b.json`,
`110-candidate-c.json`, `110-candidate-c-inspection.json`,
`110-integrated-build-b-log.txt`, `110-integrated-c.json` and
`110-integrated-c-inspection.json`, `110-integrated-browser-log.txt` and
`110-integrated-final-review.json`. Profiling and rejected prototypes are
retained under `110-profile-a`, `110-pairs-a`, `110-clusters-a/b` and
`110-preselection-a/b/c`, with immutable input snapshots. These historical
snapshots include experimental code and earlier metadata, not the final
catalog registration. Current native tests exercise the integrated defaults.

## Reproduction

Use fresh output prefixes; scripts preserve source snapshots and refuse to
overwrite existing evidence. The capture expects a Vite server on port 5174.
Keep one owned browser at a time and do not change its inputs during capture.

```sh
PROBE_PREFIX=/dev/shm/110-new-source node scripts/measure-half-nut-source.mjs
PROBE_PREFIX=/dev/shm/110-new-comparison SOURCE_REPORT=/dev/shm/110-new-source.json node scripts/compare-half-nut-source.mjs
TMPDIR=/dev/shm node --test tests/mujoco-half-nut-candidate.test.mjs tests/mujoco-runtime.test.mjs tests/engine.test.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/110-new-dynamics DURATION=68 node scripts/probe-half-nut-dynamics.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/110-new-clearances node scripts/audit-half-nut-clearances.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/110-new-views INTEGRATED=1 node scripts/capture-half-nut-candidate.mjs
TMPDIR=/dev/shm npm run build -- --outDir /dev/shm/110-new-build
```

`SIM_OPTIONS` accepts JSON overrides for the dynamics probe, clearance audit
and direct factory capture. `TIMES` accepts a JSON array for the clearance
audit. The extended 27-pose audit adds 21.2, 21.202, 35.978, 51.98, 67.976 and
68 seconds to its default samples. Catalog captures use registered defaults.
The production browser run uses `tests/e2e/mujoco.spec.mjs` with the isolated
build served at `/` and `/portable/`; its local server and configuration are
`/dev/shm/110-integrated-server.mjs` and
`/dev/shm/110-integrated-playwright.config.mjs`.
