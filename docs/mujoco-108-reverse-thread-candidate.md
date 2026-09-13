# 108 — reverse-thread traverse reconstruction in progress

Movement 108 is not yet mechanically qualified or integrated into the catalog's
asynchronous loader. The new modules in `src/simulation/mujoco-reverse-thread/`
are a contact-driven candidate, with measurement, dynamics and browser study
scripts. The historical catalog animation still needs replacement.

Brown's [108 caption](https://507movements.com/mm_108.html) describes a cylinder
with intersecting right- and left-handed grooves that drives a point from end
to end while rotation continues in one direction. The existing implementation
prescribes triangular follower travel with instant reversals, drawing raised
black tubes on an uncut cylinder. It assumes three turns per traverse and takes
about 55.44 seconds for a complete output cycle. Five baseline views were
captured and inspected; the frame, guide, groove count and working contact need
correction, and the ground remains visible in that historical model.

## Source measurements

`scripts/measure-reverse-thread-source.mjs` reads complete dark ink runs from
`public/engravings/mm_108.png`. One model unit represents 100 engraving pixels.
The measured barrel width is 94.44615 pixels and its height is 249.50284 pixels.
Frame rails, shaft, guide, slider and input wheel also have independent readings.

The source shows five crossings on the visible face. A fit to 82 paired groove
readings gives 42.84121 pixels of axial pitch and a first front crossing at
source height 168.12551. The median ink-outline gap is 12.6 pixels. This fit
assumes a circular cylinder and five turns per traverse. Its vertical center
residual is 8.28011 pixels RMS and 12.81040 maximum: the drawing's diagonals are
steeper and straighter than cylindrical projection permits at the observed
crossing spacing. Repetition count, end joins and assembly phase therefore
remain reconstruction choices, not dimensions stated by Brown. This is a fit
to center readings, not final validation of the rendered groove outlines.

The candidate uses complete frame rails, bored shaft bearings and guide slider,
a tapered arm, a bored shoe socket, a radial spindle, and a curved working shoe.
It includes an involute input wheel; 76 teeth and its generated root transition
are inferred because the source does not establish an exact tooth count.
The shaft is centered in the barrel, shifting its drawn center by about
5.29 pixels. The selected groove position places the initial follower at
source height 264.52 rather than the drawn point near 271. These corrections,
the groove silhouette, surface shading and hidden attachment still need review.
Fog and ground are disabled in the candidate.

## Contact reconstruction

A small round point can enter either branch of a crossing. An elongated shoe
must keep its ends guided beyond the region where both grooves overlap.
The historical discussion in [US4031765A](https://patents.google.com/patent/US4031765A/en)
describes this use of long swiveling followers and enlarged end turns. It
supports the mechanical approach; it does not establish the unseen hardware
in Brown's drawing.

The native model has a driven barrel hinge, passive follower slide and passive
radial shoe hinge. There is one input actuator and no output actuator or joint
equality. The groove is machined from a swept finite shoe footprint, with smooth
end reversals. Opposite-hand cuts are merged at their intersections. Convex
prisms fill the remaining lands, and the curved shoe is also divided into
prisms. A hull of an entire curved strip would add material below its concave
inner surface; dividing it into triangular prisms removes that discrepancy.

The geometry checks exposed and corrected a missing socket bore, small seam
inconsistencies, and cap winding that corrupted the thin-shoe inertia. The
current geometry/passivity tests pass. Twelve visible parts are closed and
have positive volume and consistent normals; the land mesh comprises multiple
closed patches resting on the barrel core. All 13,734 compiled contact vertices
agree with the rendered surfaces within 0.00003 source pixel. Independent convex
hull volumes agree with the visible contact solids within 0.000001 model-unit
cubed. Removing shoe contact leaves the output stationary with gravity and
initial output velocity disabled. Both native allocations are released.

## Dynamics evidence and outstanding work

These are prototype studies, not a completed mechanical qualification:

- A narrow flat shoe completed a native cycle, but did not preserve the drawn
  groove width. A wider flat shoe selected the wrong branch.
- A shorter curved shoe completed a native cycle but selected the wrong branch
  in Chrome. The original candidate capture checked input progress and page
  errors, so its `passed` flag did not establish correct output motion. That
  candidate is rejected. The capture now also checks output travel error.
- A longer curved shoe retained the intended branch in both native and browser
  studies, but the browser's travel tolerance still failed. Those early results
  predate the final mesh and inertia corrections and are diagnostic only.
- After those corrections, a full native cycle at a 20-second output period
  completes ten barrel revolutions with maximum travel deviation of 1.58269
  source pixels and native penetration of 0.039543 pixel. The shoe has a
  0.36-unit straight half-length, 0.05-unit end radius and 0.025-unit radial
  thickness, with a two-radian reversal blend. The timestep is 0.5 ms and the
  contact response is 2 ms. This establishes useful progress, but does not yet
  establish sufficiently uniform travel or robust crossing selection under load.

The browser study against that corrected geometry also retains the intended
traverse, but fails its one-pixel travel tolerance at 1.55345 pixels. There are
no page errors or unexpected warnings. Playback averages only 9.38 fps over
8.316 seconds, with 69.13 ms mean update time, so performance remains unresolved.
The current source overlay, both reversal views and socket detail were inspected;
this is not a completed inspection of all final views.

The remaining work includes tighter control of shoe yaw and groove clearance,
signed-load and long-cycle checks, timestep and mesh refinement, sampled visible
clearances through motion, a direct comparison of the final machined outlines
with the ink readings, smoother shading and acceptable live browser performance.
The final mechanism then needs catalog integration, production build, browser
regressions and inspection of the integrated desktop/mobile views. The current
two tests cover geometry and passivity only; they do not prove these remaining
requirements.

Local evidence includes `/dev/shm/108-source-b.json`, `108-baseline.json`,
`108-native-a.json` through selected later studies, `108-candidate-a.json`,
`108-candidate-b.json`, `108-geometry-fixed-a.txt`, `108-native-o.json` and
`108-candidate-tests-e.txt`, `108-candidate-c.json` and
`108-checkpoint-inspection.json`. Bulk reports and images remain outside Git.

## Reproduction

Use fresh output prefixes. These commands reproduce the current study settings,
which are explicitly supplied rather than relying on experimental defaults:

```sh
PROBE_PREFIX=/dev/shm/108-measured node scripts/measure-reverse-thread-source.mjs
TMPDIR=/dev/shm node --test tests/mujoco-reverse-thread-candidate.test.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/108-study DURATION=20 SIM_OPTIONS='{"shoeLength":0.36,"shoeRadius":0.05,"workingThickness":0.025,"curvedShoe":true,"reversalAngle":2,"timestep":0.0005,"contactTime":0.002,"period":20}' node scripts/probe-reverse-thread-dynamics.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/108-browser-study SIM_OPTIONS='{"shoeLength":0.36,"shoeRadius":0.05,"workingThickness":0.025,"curvedShoe":true,"reversalAngle":2,"timestep":0.0005,"contactTime":0.002,"period":20}' node scripts/capture-reverse-thread-candidate.mjs
```

The browser study uses an existing Vite server on port 5174. Run one owned
browser at a time and hold source/build files unchanged during capture. It
writes the report before asserting its one-pixel output-travel tolerance,
so a failed candidate retains diagnostic evidence. A recorded trajectory is
not an assertion of mechanical success.
