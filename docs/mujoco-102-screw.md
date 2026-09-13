# 102 — common screw bolt and traveling nut

The catalog's `#/movement/102` route now uses matching solid helical threads.
MuJoCo actuates the nut's rotation; contact with the fixed bolt drives its
passive axial slide. Five turns raise the nut by five pitches, followed by
five turns back down, in a twelve-second cycle. The previous reconstruction
used round tubes for threads, prescribed axial motion and an added guide frame.

Brown's [movement 102](https://507movements.com/mm_102.html) describes a common
screw and nut converting circular motion into rectilinear motion. It does not
specify which component is held, an input waveform, dimensions in depth or
thread clearance. Holding the bolt and turning the nut is the reconstructed
operating arrangement. The nut's axial path is straight, while each point on
the rotating nut follows a helix.

## Source fit and geometric correction

One model unit represents 100 engraving pixels. The measurement script samples
complete dark ink runs, fitting head and nut edges and corresponding repeated
thread edges independently of the model. The head axis is at X = 226.4079,
with its underside at Y = 187.9545. The nut is recentered by 0.4079 pixel onto
that axis. Its initial upper and lower surfaces are at Y = 407.1250 and
465.2174. The completed tip reaches Y = 479.

| Feature | Reconstruction |
| --- | --- |
| Head hexagon circumradius | 64.9035 pixels |
| Nut hexagon circumradius | 64.2490 pixels |
| Thread crest diameter | 77.2838 pixels |
| Core diameter, manually measured | 55 pixels |
| Single-start pitch | 30.0624 pixels |
| External square-thread axial width | 11.2728 pixels |
| Radial and axial clearance, each side | 0.3 pixel |

The head and nut are true hexagons with conical chamfers, rather than scaled
hexagon bevels. Their projected side and front edges match independent source
readings within 1.1441 and 1.4615 pixels RMS, with respective maxima of 2.5316
and 2.5213 pixels. Those figures cover the sampled edges, not a complete
automatic silhouette comparison. Chamfer depth, root diameter and rounded
tip profile are reconstructed from the drawing.

The engraving exaggerates the diagonal thread slope. Its 286 repeated edge
readings fit a planar straight-line construction to 1.2078 pixels RMS, but
that construction cannot be a single-start helix at the drawn pitch and
diameter. The reconstruction retains pitch, diameter, thread width and drawn
direction, correcting the slope to a continuous **left-handed** helix.
The source caption does not establish handedness; that choice follows the
visible diagonal direction. Corresponding finite rendered crest edges match
the readings to **5.8628 pixels RMS and 11.7254 pixels maximum**. The comparison follows the same turn
and upper/lower edge, rather than hiding the difference by selecting a nearby
turn. The source overlay makes this slope correction visible.

## Complete solids and physical model

The fixed bolt consists of a cylindrical core, square helical ridge, hexagonal
head and rounded tip. The moving nut has a bored hexagonal body and matching
internal helical ridge. All six parts are closed solids. Core and thread use
the same angular grid, as do the nut bore and its ridge, so their surfaces
abut. The head and tip meet the core at axial planes. Thread ends are clipped
to those planes, with the mesh grid including every clipping transition.

The visible geometry uses 256 angular segments per turn, with analytic smooth
normals on the helical flanks and round surfaces. Chamfer normals follow their
cones, while hexagonal sides retain planar normals. The nut mass and full
inertia tensor come from its two actual closed solids, normalized to unit
mass. Section caps are excluded from mass and contact geometry.

MuJoCo uses the [convex hull of each mesh for ordinary mesh collision](https://mujoco.readthedocs.io/en/stable/XMLreference.html#asset-mesh).
A single mesh for the whole screw would therefore fill its grooves. Here,
each complete thread is decomposed into 64 small convex sectors per turn,
with 830 sectors in total. Their angular grid includes the exact axial
clipping transitions, avoiding protruding wedges at the truncated ends.
Both external and internal working flanks participate; there is no
sparse follower replacing the nut's thread. The sector hulls approximate
the helicoid, and their geometric error is checked against the separate
visible triangle surfaces.

The native model has two degrees of freedom: a nut hinge and a coaxial passive
slide. Only the hinge has an actuator. There are no equality constraints,
output springs, output motors or periodic state corrections. The fixed bolt
and ideal coaxial alignment replace a separately simulated mounting fixture
and radial bearing contact. There is no collision against the head or tip;
the qualified travel retains full thread engagement and clears both ends.

Defaults are a 2 ms timestep, implicit integration, Newton contact solving,
a 4 ms contact response, gravity along the screw axis and zero sliding
friction. Input gains are 3000/60, with velocity feedforward. The reversing
input is a cosine displacement, smoothly slowing through the ends of each
five-turn stroke. Friction, material properties, drive and damping are not
calibrated to a historical machine; this model does not demonstrate frictional
self-locking.

The section control removes the front half of the visible nut and supplies
matching moving cut faces. The complete physical nut remains active. The
bolt stays whole so the mating square threads remain recognizable. The fixed
bolt is neutral gray and the driven nut orange. Ground
and fog are disabled, and the shadow map is concentrated around the mechanism.

## Validation

The automated checks cover closed-solid topology, compiled native mesh faces,
passive feed with contact removed, opposite axial loads, deterministic
restart and seeking, ten full cycles, finite hardware clearance, timestep
and sector refinement, and section-cap fit. Source measurements, native
results and rendered views are retained outside Git with frozen input hashes.

All 22 selected mechanism, runtime, camera and catalog tests pass. The 6,632
compiled native vertices match the visible thread boundary within 0.000001
pixel. Another 39,776 face samples bound the convex working-flank approximation
and protrusion by 0.04687 pixel. The section caps remain within 0.00340 pixel
of the physical nut at 2,608 samples across 36 angular positions.

Ten complete cycles cover 120 seconds and 60,000 steps:

| Measurement | Result |
| --- | ---: |
| Maximum deviation from ideal pitch travel, including running clearance | 0.26490 pixel |
| Maximum native soft penetration | 0.04170 pixel |
| Sampled contact-center error against either visible thread | 0.04445 pixel |
| Full measured axial stroke | 150.3503 pixels |
| Minimum thread length below the nut's lower face | 2.7410 pixels |
| Minimum head clearance | 69.0791 pixels |
| Maximum input tracking error | 0.94860° |

Thirty-one poses pass 5,629,476 independent finite-surface checks without
intersections, and all visible vertices stay inside the camera envelope.
There is no measured interior backtracking; that check excludes the first
and last 0.1 second of each half-cycle where clearance settles at reversal.
The contact sample count is 1,799,259. These positional checks do not claim
converged impact forces or certify a manufactured screw.

Over two full cycles, halving the timestep from 2 to 1 ms changes axial
position by at most 0.11256 pixel; 1 versus 0.5 ms gives 0.06120 pixel.
At the same 1 ms timestep, increasing the sector count from 64 to 128 per
turn changes axial position by at most 0.07867 pixel. These errors remain
below the stated 0.3-pixel running clearance.

With gravity and contact removed, the nut rotates while its initially
stationary axial slide remains still. Separate axial loads of ±2 with a
held input select the opposite flanks, settling at approximately ±0.22128
pixel from ideal pitch travel. Restart, frame partitioning and seeking
reproduce identical native states, and disposal releases both allocations.

All eighteen final views were inspected: source comparison and overlay,
stroke limits and intermediate positions, front/oblique/rear views, thread,
head and tip details, three nut sections, and desktop/mobile layouts.
The real-time headless browser study averages **28.37 fps** over 12.233 seconds,
with a mean physics update of 8.85 ms and a 95th percentile of 12.5 ms.
It reports no page errors or unexpected warnings. This measures desktop
headless playback; the mobile checks cover layout and controls.

The production build and all eighteen MuJoCo browser checks pass, including
102 playback, pause, restart, section toggling and navigation. After the final
shadow-map extent adjustment, the 102 browser check passes again. Local
evidence is `/dev/shm/102-source-qualified-final.json`, `102-tests-b.txt`,
`102-build-final-b.txt`, `102-browser-final.txt`,
`102-browser-shadow-final-b.txt` and `102-final.json`.
`102-final-inspection.json` records inspected image hashes, frozen sources
and validation evidence. Bulk artifacts remain outside Git.

## Reproduction

```sh
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/102-new-source node scripts/measure-screw-source.mjs
TMPDIR=/dev/shm node --test tests/mujoco-screw.test.mjs tests/mujoco-runtime.test.mjs tests/engine.test.mjs tests/camera-resize.test.mjs
TMPDIR=/dev/shm npm run build
TMPDIR=/dev/shm npx playwright test tests/e2e/mujoco.spec.mjs --output=/dev/shm/102-browser-results
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/102-new-views node scripts/capture-mujoco-screw.mjs
```

The capture uses an existing Vite server on port 5174. Use fresh artifact
prefixes, one owned browser at a time, and unchanged source/build files during
capture. Detail views intentionally zoom beyond the canvas; full mechanism
views and the normal application camera retain the entire travel envelope.
