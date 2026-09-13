# 103 — screw-driven guided slide

The catalog's `#/movement/103` route uses an axially fixed rotating screw and
an unpowered horizontal carriage. Contact between their complete matching
threads produces the carriage's travel. A three-turn advance and three-turn
return take eight seconds. The earlier reconstruction used round tube threads,
prescribed the output position, used a solid low bed and added separate braces
to the carriage.

Brown's [movement 103](https://507movements.com/mm_103.html) describes straight
slide motion produced by screw rotation. The engraving supplies neither an
input waveform nor the hidden guide and bed cross-sections. The reversing
drive, open-bay bed interpretation, finite shaft end and bed closure are
reconstructed so the complete mechanism can be viewed from every side.
The unhatched area under the way could also represent a recessed bed web;
the engraving does not uniquely determine this hidden construction.

## Source proportions

`scripts/measure-leadscrew-slide-source.mjs` samples complete ink-run midpoints
from the original 525-pixel image. One model unit represents 100 source pixels.
The screw axis is at Y = 231.1462. Its reconstructed root and crest diameters
are 25.6138 and 44.3862 pixels. The pitch is 29.6347 pixels and the external
square thread is 8.0436 pixels wide axially.

The headstock runs from X = 56.0169 to 112.3404, with its top at Y = 181.25.
The bottom bed beam occupies Y = 367.9353…395.3914. The slideway's raised rear
edge is at Y = 292.5833 and its underside at 319.3991. The completed bed ends
at X = 398; the upper way ends at 385. An inner shoulder at X = 127 retains
the drawn step beside the open bay. A short support closes the cropped right
end, leaving the bay open between the upper way and lower beam.

The carriage neck runs from X = 253.8846 to 279.5167 and reaches Y = 195.9286.
Its foot spans X = 215.6875…313.5, ending at Y = 303.9318. A single closed body
joins the bored neck to the curved haunch and foot. Shared internal closure
faces are removed, avoiding an artificial seam between these regions.
The haunch matches 61 independently sampled ink readings within **1.7198 pixels
RMS and 2.8802 pixels maximum**. Registered straight frame and carriage edges
stay within three pixels of their independent ink readings.

The 81 corresponding front thread-edge readings fit the engraving's repeated
straight diagonals within 1.2814 pixels RMS. A physical single-start helix has
a curved, steeper front projection. The corrected **right-handed** helicoid
retains pitch, diameter, width and the drawn direction, matching corresponding
finite crest edges within **2.6682 pixels RMS and 5.6583 pixels maximum**. The
comparison preserves turn and flank identity, rather than selecting the
nearest neighboring edge. The source overlay shows this necessary slope
correction directly.

The square drive end and axial collars follow manually read outlines and are
recentered on the screw axis. Both collars are bored to meet the core, with a
small axial gap at the headstock's left thrust face. The shaft tip is completed
with a short chamfer beyond the broken thread. Exact depths, chamfers and
clearances remain reconstruction assumptions.

## Guide, complete bodies and thread contact

The frame has a bored headstock, lower beam, inner shoulder, completed end
support and upper way. The raised rear edge of the way reproduces the visible
line behind the carriage. Its lower running surface supports the foot with
0.2-pixel vertical clearance. A hidden T-shaped key beneath the foot fits a
complete T-slot, with 0.3-pixel clearance at its retaining faces. The rear wall
also clears the carriage by 0.3 pixel. The ideal prismatic joint represents
these constraints; there are no simulated contacts against individual guide
faces or bearing races.

The rotor consists of a continuous core, solid square-thread ridge, square
input, two bored thrust collars and chamfered tip. The carriage has its single
bored body, guide key and matching internal thread. The fourteen physical
parts are closed solids. Visible threads use 256 angular segments per turn.
Their core/bore contours share clipping-transition angles with the thread
meshes. The actual moving solids supply mass and full inertia tensors at a
common uniform density, normalized to unit screw mass.

Ordinary MuJoCo [mesh collision uses convex hulls](https://mujoco.readthedocs.io/en/stable/XMLreference.html#asset-mesh),
so a single mesh around a whole thread would fill the grooves. The two threads
instead use 1,380 small convex helical sectors at 128 angular segments per turn.
Every axial truncation transition is included before constructing those hulls,
avoiding spurious wedges at the thread ends. Both complete mating flanks are
present. There is 0.1-pixel radial and axial thread clearance per side.

The native model has a screw hinge, one passive carriage slide and one rotary
actuator. There are no equality constraints, output motors, springs or periodic
state corrections. The input uses a cosine displacement with velocity
feedforward and gains 3000/60. Defaults are a 2 ms timestep, implicit integration,
Newton solving and a 20 ms soft-contact response. The contact surfaces are
frictionless; dry guide friction is modeled separately with a joint friction
limit of 0.05 times the carriage's weight, plus 0.02 viscous joint damping.
These friction and material values are reconstructed, not measured from a
historical machine. This is not a model of screw self-locking or guide wear.

Section view cuts the front of the carriage and upper way, exposing both the
matching thread and hidden retaining guide. The complete native bodies remain
active. Presentation caps are excluded from mass and contact, and do not cast
shadows onto themselves. Fog and ground are disabled; the full stroke has a
fixed camera envelope.

## Validation

The checks cover all physical solids, actual compiled contact mesh vertices
and faces, passive feed, loading of either flank, ten complete cycles, finite
hardware separation, shaft and guide retention, timestep/sector refinement,
section-cap fit and deterministic restart. Browser tests also cover loading
under a static subdirectory, play/pause, restart, section toggling and mobile
controls.

All sixteen selected mechanism/runtime/camera tests and all nineteen MuJoCo
production browser checks pass, including 097 and 098. The production build
passes with the existing large-bundle warning.

| Check | Measured result |
| --- | --- |
| Closed physical solids | 14 |
| Compiled vertices / independent face samples | 11,032 / 66,176 |
| Maximum contact-sector surface error | 0.039816 source pixel |
| Ten cycles / physical time | 10 / 80 seconds |
| Carriage stroke | 88.84297 source pixels |
| Maximum error from screw lead | 0.103591 source pixel |
| Native soft-contact penetration | 0.064417 source pixel |
| Actual visible thread penetration | 0.002350 source pixel |
| Contact-center distance from visible thread | 0.038838 source pixel |
| Minimum thread / guide retention | 37.05686 / 18.51932 source pixels |
| Minimum carriage-to-headstock clearance | 14.51932 source pixels |
| Independent finite-surface samples / poses | 5,162,448 / 33 |
| Travel difference, 2 ms versus 1 ms | 0.132625 source pixel |
| Travel difference, 1 ms versus 0.5 ms | 0.097799 source pixel |
| Travel difference, 128 versus 256 sectors at 1 ms | 0.115218 source pixel |
| Section-cap excess beyond actual surfaces | 0.000035 source pixel |

The native penetration includes the two slightly protruding convex sector
surrogates. It is bounded separately from penetration of the actual visible
meshes, whose stricter limit is 0.01 pixel. The visible-mesh and unrelated
hardware screen samples 33 poses over the first complete cycle. Native contact,
feed and retention are checked at every step for ten cycles; contact-center
surface distance is sampled every 0.2 second. The ten-cycle trace shows no backtracking outside
the first and last 0.1 second of each half-cycle, which allow reversal settling.
Refinement comparisons cover two full advance-and-return cycles. These are
sampled numerical checks of the reconstructed mechanism, not a continuous
collision proof or a measured historical friction model.

All eighteen final views were inspected: registered front and overlay,
both travel limits, mid-stroke and return, oblique and rear, thread/input/tip
details, guide and section views, desktop, mobile and the scrolled mobile note.
The carriage has no false neck-to-foot seam, the section caps have no broad
self-shadow hatching, and full-mechanism views retain the completed hardware.
Fine raster shadow edges remain visible at extreme detail zoom.

One complete real-time headless playback averaged **23.98 fps**, with physics
updates averaging **15.54 ms** and a **20.5 ms** 95th percentile. The full
eight-second physical period is retained at 1× speed. The capture reports no
page errors or unexpected console warnings; this is a software-rendered Chrome
measurement, not a performance guarantee for every device.

Frozen sources and all image hashes are verified in
`/dev/shm/103-final-inspection.json`. Supporting evidence is
`/dev/shm/103-source-qualified-final.json`, `/dev/shm/103-tests-final.txt`,
`/dev/shm/103-build-final.txt`, `/dev/shm/103-browser-final.txt` and
`/dev/shm/103-final.json`. These machine-local artifacts are kept outside Git;
the commands below regenerate the studies.

## Reproduction

```sh
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/103-new-source node scripts/measure-leadscrew-slide-source.mjs
TMPDIR=/dev/shm node --test tests/mujoco-leadscrew-slide.test.mjs tests/mujoco-runtime.test.mjs tests/engine.test.mjs tests/camera-resize.test.mjs
TMPDIR=/dev/shm npm run build
TMPDIR=/dev/shm npx playwright test tests/e2e/mujoco.spec.mjs --output=/dev/shm/103-browser-results
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/103-new-views node scripts/capture-mujoco-leadscrew-slide.mjs
```

The capture uses an existing Vite server on port 5174. Use fresh artifact
prefixes and one owned browser at a time; leave source and build files
unchanged while a browser study is active. Bulk evidence remains outside Git.
