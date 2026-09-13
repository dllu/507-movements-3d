# 090 — eccentric with elongated yoke

The ordinary `#/movement/090` route uses live MuJoCo dynamics. A motor rotates
the eccentric shaft; contact drives the passive yoke through fixed guides.
The former registry model prescribed a cosine displacement despite positive
clearance on both sides. It remains available to historical synchronous tests;
the application's asynchronous loader selects this reconstruction.

## Source and geometry

The reference is `public/engravings/mm_090.png`, checked against Brown's scan
at PDF page 30 (printed page 26). The following page explains that the elongated
yoke eliminates the rod's vibrating motion while it works in fixed guides.
`scripts/measure-eccentric-yoke-source.mjs` reproduces circle fits to raster ink.

| Feature | Radius in source pixels | Fit RMS in pixels |
| --- | ---: | ---: |
| Eccentric | 89.7055 | 0.9877 |
| Shaft collar | 36.7012 | 0.5429 |
| Hatched shaft | 26.0726 | 0.5252 |

The collar supplies the common shaft axis at (230.4151, 273.1649). The eccentric
center is (277.4208, 272.4919), giving an eccentricity of 47.0105 pixels. The
separately fitted shaft center differs from the collar by 1.62 pixels; using
one physical axis is an explicit interpretation of the overlapping, hatched ink.
The circle fits are measurements of strokes, not exact engineering dimensions.

The yoke follows manually read stroke midlines, including extra readings around
its rounded ends. Closed cubic outlines are flattened with a 0.1-pixel chord
error bound. That bound describes curve tessellation, not agreement with the
engraving. One model unit represents 100 source pixels.

The bowed opening in the engraving cannot contain the full vertical sweep of
the measured circular eccentric. The working sides are made parallel, with
0.1 pixel of nominal running clearance and a 1-pixel margin beyond the center's
vertical travel. A swept capsule supplies the required opening; the larger
engraved top and bottom lobes are preserved. This rectifies both interference
and excess clearance in the ink. The correction is visible in the source
overlay and is disclosed in the viewer.
The maximum sampled change from the traced opening is 5.705 pixels in a
bidirectional comparison at <= 0.1-pixel spacing (upper bound 5.755 pixels).
This comparison is to the manually traced curve, not to all raster ink.

Brown shows short rod stubs and no guide hardware. The reconstructed round rods
extend 1.292 and 1.270 units from the yoke, compared with the depicted 0.52 and
0.80. These lengths keep both fixed guide bores engaged throughout the stroke.
The guide pedestals, rear shaft support and base are added hardware. Their bores
are actual holes, with positive radial clearance. The yoke and eccentric have
equal 0.24-unit thickness. Depth, supports, fits, rod extensions and uniform
density are assumptions, not recovered dimensions or material properties.

## Dynamics and approximations

There are two degrees of freedom and one actuator: a shaft hinge and a passive
yoke slider. Only the input motor's control is written during stepping. A
four-second clockwise turn is the default. Initial velocities describe an
already running input; restart restores that same state. Playback integrates
continuously and has no repeated recording or forced output-position curve.

There are three native collision geometries: the eccentric cylinder and two
boxes inside the yoke walls whose inner surfaces coincide with the straight
bearing faces. An independent distance check against the visible hole verifies
that it contains the entire circular sweep. The eccentric center remains
within the boxes' height for every shaft angle; the remaining curved opening
cannot make contact before a bearing face does. The cylinder's filled shaft
bore cannot reach the yoke. The visible eccentric has a real bore and a
256-sided perimeter (maximum circular sagitta about 0.0068 pixels).

The hinge and prismatic joint idealize shaft retention and fixed guides,
including restraint against rotation of the output rod. The visible bearings
are clearance-checked hardware, not additional contact constraints. Uniform
density is scaled to a unit input mass. Friction 0.05, slider damping 0.02,
motor gains, and a 4 ms soft-contact response are demonstration parameters.
This is not a calibrated force or wear prediction.

## Validation — 2026-09-13

The final state passes 18 focused numerical/geometry/runtime/camera tests and
seven production browser tests. The production build passes with the existing
large-chunk and browser-guarded Node `module` import warnings.

The mechanism tests verify two degrees of freedom and one actuator, deterministic
restart and frame partitioning, independent instances and disposal. Disabling
the only collision pair leaves a stationary yoke stationary while the input
turns: there is no hidden prescribed output. The native hole's distance from
the entire swept center segment gives 0.099999 pixel of circular clearance.
The contact boxes coincide with the rendered bearing faces and stay within the
yoke material.

Nine native poses check ten closed solids, the guide engagement and all visible
vertices against the full motion camera bounds. Across 350,836 independent
surface samples, maximum overlap is 0.000977 source pixel, confined to the
working yoke/eccentric contact. Ground is hidden and the base clears the yoke.

Three 40-second probes cover ten uninterrupted turns at different timesteps:

| Step | Maximum native penetration, px | Maximum difference from eccentric horizontal position, px |
| --- | ---: | ---: |
| 1 ms, production | 0.002813 | 0.102813 |
| 0.5 ms | 0.020124 | 0.117491 |
| 0.25 ms | 0.038634 | 0.107344 |

At 10 ms samples, the maximum slider difference is 0.220045 pixel for 1 versus
0.5 ms, and 0.129425 pixel for 0.5 versus 0.25 ms. RMS differences decrease from
0.041364 to 0.021967 pixel. The regression test compares the first pair every
1 ms and measures 0.225160 pixel, below its quarter-pixel tolerance. Brief
impact timing and peak soft penetration do not converge monotonically; these
are bounded display-position checks, not identical contact-force trajectories.

All twelve final views were inspected: source front and overlay, the four main
stroke positions, oblique, rear, contact and guide close-ups, desktop and mobile.
An 8.2164-second live browser run records 494 frames, approximately 60 fps.
Physics updates average 0.194 ms per frame (95th percentile 0.300 ms). Browser
errors and unexpected warnings are absent. Production checks cover nested
hosting, lazy WASM loading, navigation, pause, restart and mobile controls.

Final local evidence uses `/dev/shm/090-contact-*`: the three probe JSON files,
two comparison reports, test/build logs and the `views` capture and inspection
reports. Earlier `090-*` reports describe superseded bowed-face candidates;
their mass and contact geometry differ from the production reconstruction.

## Reproduction

```sh
TMPDIR=/dev/shm node --test tests/mujoco-eccentric-yoke.test.mjs
TMPDIR=/dev/shm npm run build
TMPDIR=/dev/shm npx playwright test tests/e2e/mujoco.spec.mjs --output=/dev/shm/090-browser-results
PROBE_PREFIX=/dev/shm/090-a node scripts/probe-mujoco-eccentric-yoke.mjs
PROBE_PREFIX=/dev/shm/090-b PROBE_OPTIONS='{"timestep":0.0005}' node scripts/probe-mujoco-eccentric-yoke.mjs
node scripts/compare-mujoco-eccentric-yoke.mjs /dev/shm/090-a.json /dev/shm/090-b.json
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/090-views node scripts/capture-mujoco-eccentric-yoke.mjs
```

The capture script uses an existing Vite server on port 5174. Output paths are
exclusive; choose a fresh prefix when repeating a study. Bulk reports, source
snapshots and screenshots remain outside Git. Browser captures must finish
before changing source or rebuilding.
