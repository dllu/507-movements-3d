# 109 — change-gear thread-cutting frame

Movement 109 now loads a MuJoCo reconstruction in the catalog, **under review**.
The lead screw drives a guided cutter while a pair of involute gears turns the
workpiece. Connected square threads replace the old detached round tubes.
Material disappears at the cutter's angular position and stays removed on
return strokes. The source interpretation and close-up shading still need work.

Brown's [109 caption](https://507movements.com/mm_109.html) describes uniform
cutter travel and changing the cut pitch by changing the end wheels. It does
not specify tooth counts, hidden supports, depth, cutting forces or a reversing
drive. The current viewer uses one reconstructed gear pair; it has no gear
selection control.

## Source reconstruction

One world unit represents 100 engraving pixels. The measurement script samples
complete ink runs around manually seeded edges and thread turns. Filled right
end faces use their outer ink boundary. Those assignments are interpretation,
not automatic identification of each screw turn.

The measured shaft spacing in front projection is 101.3561 pixels. The two
outer gear radii are 53.2358 and 77.4672 pixels. Their sum exceeds that spacing.
The reconstruction fits both rims with a **52:76** tooth pair and staggers the
parallel shaft axes by **76.2284 pixels in depth** to provide the actual gear
center distance. The bored top and bottom beams follow that diagonal in plan.
Neither these tooth counts nor the depth stagger is uniquely established by
the drawing.

The lead screw has measured pitch 20.9944 pixels and crest width 8.3770 pixels.
The depicted work screw has approximately 18.6227-pixel pitch and appears to
have the same hand. That conflicts with the external gear pair: the shafts
turn oppositely, and the cutter advances one lead-screw pitch per input turn.
The mechanically consistent cut therefore has the **opposite hand and
30.6842-pixel pitch**. Preserving the gear proportions requires this visible
correction to the right screw. The true cylindrical helices also project with
shallower slopes than the drawing's nearly straight diagonal thread lines.

Independent comparison with the actual Float32 meshes, in the initial
orthographic source pose, gives:

| Feature | Readings | RMS difference | Maximum difference |
| --- | ---: | ---: | ---: |
| Frame, carriage, arm, shaft, crest and gear extents | 805 | 0.8028 px | 4.2808 px |
| Lead thread shoulders, retaining assigned source turns | 236 | 3.9837 px | 10.4300 px |
| Work thread shoulders, nearest edge of the corresponding face | 146 | 9.3854 px | 20.3523 px |

The work metric cannot establish turn correspondence because the turn count
and hand differ. Shoulder metrics do not account for occlusion by the nut or
uncut stock. These are geometric comparison measurements, not qualification of
an exact overlay. The actual source overlay exposes the corrections.

## Hardware and material removal

Nineteen closed solids form the frame, screws, gears, carriage and tool.
The carriage has a matching internal square thread and a retained key in a
rear T-slot. The hidden guide sits behind the complete input gear; an earlier
candidate intersected its rim and was corrected. Bearings, guide depth,
cutter form, attachment rigidity and 0.2-pixel nominal clearance are inferred.
Gear flanks and root transitions are generated from an involute rack cutter.

The workpiece consists of a permanent core and finished ridge, plus a
complementary helical volume filling the uncut groove. Their full volumes sum
to the original cylindrical blank. A closed radial cap follows the finite
tool's leading face. The maximum reached work angle controls removal, so
reversing the shafts cannot regrow material. Restart restores the initial
partially cut source pose. A short unthreaded end remains above the gears,
where carriage clearance limits the cutting stroke. This is a geometric
illustration of a single cut; chip formation, successive depth passes and
tool withdrawal are omitted.

There are faint helical shadow seams on the nominally smooth uncut blank,
visible in close-ups where complementary solids meet. Removing those rendering
artifacts remains open. Fog and ground are disabled. The camera bounds include
the complete assembly and both carriage limits.

## Native motion and checks

MuJoCo supplies three coordinates, one input actuator and two ideal joint
equalities. The work angle is −52/76 times the lead angle, and the carriage
advance follows the lead pitch. Bearings and the carriage guide are ideal
joints. **There are no native collision geoms or cutting forces**: visible
thread and tooth clearances are audited separately. This model does not claim
to establish force transmission through physical tooth or thread contact.

Mass and full inertia are integrated from the visible initial solids with a
common inferred density. Workpiece inertia remains fixed as material is
removed. Gravity, implicit integration and a 1 ms timestep are used. Only the
lead shaft is actuated; disabling both equalities leaves the work shaft still
and lets the uncoupled carriage fall.

An inferred 24-second cycle provides uniform working travel with short smooth
reversals. The blends join with continuous velocity and acceleration. Default
working speed is 17.5259 source pixels per second, with the lead shaft turning
about 0.835 revolution per second. The return retraces the cut groove.

Four mechanism tests and three shared runtime tests pass. They check solid
topology, complete blank volume, monotonic removal, native coupling under
opposite diagnostic loads, passivity, disposal, restart and deterministic
playback. There are 66,368 triangles in the initial assembly. The diagnostic
loads are uncalibrated, not established operating limits.

Ten complete cycles (240 seconds), checked at every native step, give:

| Measurement | Maximum |
| --- | ---: |
| Input-angle error | 0.006007 rad |
| Gear equality error | 0.00004645 rad |
| Screw-feed equality error | 0.0002287 px |
| Carriage error from the intended travel law | 0.019868 px |
| Travel-speed error over 100 ms on uniform flanks | 0.6361% |

Halving the timestep lowers the maximum travel-law error to 0.013700 pixel.
Comparing 481 matched half-second samples changes carriage position by at most
0.008763 pixel. This is a sampled position sensitivity check, not convergence
of cutting forces.

Seventy-three native poses pass 28,082,266 independent surface queries, using
vertices, triangle centroids and edge midpoints of the transformed solids.
There are no sampled unintended intersections above the 0.0001-pixel reporting
threshold. The rear guide retains at least 23.6827 pixels of engagement; the
nut overlaps at least 24.5995 pixels of thread. All vertices remain inside the
camera bounds. Rigidly attached parts are excluded from cross-family checks.
This is a finite sampled audit, not a continuous interference proof.

Eight additional engine/camera tests pass. Twenty integrated browser images
are inspected, including desktop, mobile and the scrolled mobile notes panel.
The seventeen mechanism images have identical hashes to the previously
inspected candidate images. Live playback averages 32.41 fps at 99.96% of
physical speed over 26.044 seconds. Mean update time is 0.343 ms and p95 update
time is 1.100 ms. There are no page errors or unexpected warnings. The build
passes with its existing large-chunk and guarded Node-import warnings.
All 25 production MuJoCo browser tests pass, covering nested hosting, lazy
loading, playback/restart, controls, navigation races, asset retry and disposal.

## Reproduction and local evidence

```sh
PROBE_PREFIX=/dev/shm/109-new-source node scripts/measure-thread-cutting-source.mjs
SOURCE_REPORT=/dev/shm/109-new-source.json PROBE_PREFIX=/dev/shm/109-new-comparison node scripts/compare-thread-cutting-source.mjs
TMPDIR=/dev/shm node --test tests/mujoco-thread-cutting.test.mjs tests/mujoco-runtime.test.mjs tests/engine.test.mjs tests/camera-resize.test.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/109-new-dynamics node scripts/probe-thread-cutting-dynamics.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/109-new-clearances node scripts/audit-thread-cutting-clearances.mjs
TMPDIR=/dev/shm npm run build
TMPDIR=/dev/shm npx playwright test tests/e2e/mujoco.spec.mjs --output=/dev/shm/109-new-e2e
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/109-new-browser node scripts/capture-thread-cutting-candidate.mjs
```

The capture uses an existing Vite server on port 5174. Use fresh prefixes and
one owned browser at a time; leave source and build files unchanged during
capture. Reports preserve source hashes. Bulk evidence stays outside Git.

Current local evidence includes `/dev/shm/109-source-c.json`,
`109-comparison-a.json`, `109-tests-final.txt`, `109-dynamics-final.json`,
`109-dynamics-half.json` and `109-refinement.json`. Five baseline images and
seventeen initial candidate images have separate hash-verified inspection
records. They retain the source and shading limitations described above.
Final clearance and integrated browser evidence is in `109-clearances-final.json`,
`109-browser-final.json` and `109-browser-final-inspection.json`; shared test and
build logs are `109-engine-tests.txt` and `109-build-final.txt`.
The production browser log is `109-e2e-final.txt` (25 passed in 5.1 minutes).
