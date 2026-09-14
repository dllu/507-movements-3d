# 123 — double-rack sector handoff

Movement 123 uses a reciprocating double rack, two toothed sectors, three
meshing spur gears and a curved transfer piece that catches two stops behind
the rack. MuJoCo drives only the rack; tooth and stop contact determine all
three rotor angles. Section view outlines the rack to expose the hidden stops
without changing its mass, collisions or motion. A complete rack cycle and
output revolution take six seconds after startup.

Brown's [123 caption](https://507movements.com/mm_123.html) describes the curved
piece carrying the rack across each change of sector engagement. The previous
model prescribed triangular rack motion and all three gear angles, with
instantaneous reversals and a decorative curved piece floating in front of
the center gear. Its added rails and frame, altered proportions and ground
are superseded. The new transfer piece attaches directly to the center gear.
The shaft bearings and rack guide remain ideal constraints, since their
supports are not drawn.

## Source measurements and necessary corrections

One model unit represents 100 pixels of `public/engravings/mm_123.png`.
`scripts/measure-sector-handoff-source.mjs` samples bounded ink runs on hubs,
shafts, gear outlines and rack rows. Circle fits place the side shafts at
(97.9443, 256.5520) and (387.5078, 255.5636), with radii 17.3098 and 18.1462
pixels. The model flattens their axes to y = 256.0578, preserving their mean
and horizontal separation. Adjacent gear axes are 144.7818 pixels apart.
The measured hub radii are 23.5589 and 25.6177 pixels. The rack stems and
flared ends follow a manually sampled outline; sector spoke windows use
curved contours interpreted from the engraving.

The drawing does not supply a mutually compatible set of teeth. Independent
centered and free-center involute fits prefer different counts on different
gears, and the two rack rows have different measured pitches. The left
unoccluded row gives 19.525 pixels and the right gives 21.260 pixels.
The side spur envelopes are visibly unequal despite the repeating sector
handoff requiring equal side-shaft rates. The reconstruction therefore uses:

- Three equal 36-tooth spur gears, module 4.02172 pixels, 20° pressure angle,
  addendum 0.8 module and dedendum 1.5 modules.
- Matching 38-tooth-reference sectors, module 6.38 pixels, profile shift −0.25,
  with 16 installed teeth and body half-span 75.7895°. Both point right in
  the initial source pose.
- Two conjugate rack rows at a common 20.0435-pixel pitch. A 0.15-pixel
  normal running clearance prevents root locking. Tooth roots extend
  0.2 pixel inside the rack core so each row belongs to one connected solid.

These counts regularize the source; they are not uniquely recovered engraving
counts. The compatible spur scan preferred 36 teeth with addendum 0.6 by its
radial residual, but addendum 0.8 retains more working overlap. Actual rendered
triangle edges, rather than that radial fitting metric, give the final errors:

| Part / sampled contour | Points | RMS error, pixels | Maximum, pixels |
| --- | ---: | ---: | ---: |
| Left sector | 449 | 5.08769 | 19.19861 |
| Right sector | 460 | 6.62466 | 26.42426 |
| Left spur | 375 | 9.43522 | 17.41649 |
| Center spur | 396 | 5.37793 | 13.71291 |
| Right spur | 364 | 4.84224 | 18.76064 |
| Left hub | 124 | 2.69783 | 4.33372 |
| Right hub | 72 | 2.36944 | 4.84056 |
| Left shaft | 142 | 1.32031 | 3.80946 |
| Right shaft | 154 | 1.36054 | 3.97081 |
| Left rack | 585 | 2.77397 | 9.67066 |
| Right rack | 618 | 4.08186 | 11.73630 |

The end teeth need relief during the nonuniform reversal. Sampling 1024
nominal poses trims only points within 0.5 radian of either sector end, by at
most 8.3460 pixels radially, with 0.15-pixel clearance. Central working flanks
retain their involutes. Rack end flanges step forward from the tooth layer
to pass above those sector ends, while preserving the front silhouette.
These are explicit geometric corrections. Without end relief, the nominal
path has 7.2202 pixels of tooth interference and native motion jams.

## Transfer cam and input motion

The hidden stops are indicated by dashed diamonds near (244, 126) and
(243, 401). Their working reconstruction is two cylindrical pins of radius
8 pixels at y = ±137.5 pixels relative to the center shaft. The dotted marks
do not establish a unique stop cross-section. Depth and stop diameter are
inferred, not measured precision dimensions. Centering this pair on the gear
axis moves both stops upward by 7.4422 source pixels.

Let R = 121.22 pixels be the sector pitch radius, a = 16π/38 its half-span,
and b = π/2 − a. During a half-cycle, the rack follows the linear rolling
law outside a < θ < π − a. Inside that tooth gap, its displacement magnitude
is R[a + (2b/π) sin(π(θ − a)/(2b))]. This joins linear strokes to a cosine
velocity reversal with continuous velocity and acceleration. The rack
half-stroke is 179.4869 pixels. This prescribed input is a reconstruction
assumption; no input crank or external drive is supplied by the engraving.

The transfer pocket is cut by the stop's relative path in the rotating center
gear during that reversal. Its pocket radius is 41.9869 pixels, wall thickness
5 pixels and nominal stop clearance 0.1 pixel. Swept circular caps are united,
and the mouth opens toward the shaft. A bounded 0.005-pixel contour reduction
removes almost-collinear Boolean fragments before constructing the visible
solid; the original fragments produced degenerate cap triangles.

The curved piece is rephased 180° from its engraved placement. At the source
pose, the left sector is engaged. A descending rack turns that shaft clockwise
and the center gear counterclockwise. Its upper stop approaches the bottom
handoff, so the center piece must start left and rotate downward. The drawn
right-hand placement approaches the opposite side. This small hidden piece
therefore does not superimpose on the source: its sampled inner/outer contour
errors are 69.0234 / 74.6081 pixels RMS. Rephasing is a working correction,
not a good source fit. Native control experiments remove cam contact or
restore the engraved phase and fail to complete the handoff.

## Native model and finite solids

The model has one rack slide, three rotor hinges, one rack position actuator,
no equalities and no tendons. Mass and full inertia are integrated from all
visible solids at a uniform density normalizing the left rotor family mass
to one. The three output coordinates have zero actuator force. Gravity is
active, hinge damping is 0.001 and a constant −0.02 model-unit torque resists
the center shaft. The input approaches one cycle per six seconds using a
0.25-second startup ramp. Playback speed scales viewer time and retains these
physical dynamics.

Defaults use a 1-ms timestep, Newton solver, 100 iterations, discrete
integration, zero working friction and a 2-ms soft-contact response. The
rack servo uses gains 10000/200. Friction, inertia, damping, drive gains and
loads are not calibrated machine properties. Contacts include both spur
meshes, the two sector/rack meshes and both stop/cam pairs. Other hardware
clearances are audited independently rather than enforced by collision masks.

Eighteen visible parts are closed, single-component, positively oriented
solids. Both shafts have ordinary bores in their attached gears and hubs.
The depth layers are: spurs 0–0.20, transfer cam 0.20–0.30, stops 0.20–0.32,
sectors and rack teeth 0.32–0.46, raised end flanges 0.46–0.60. The axial
arrangement is reconstructed. No ground or fog is displayed. Camera bounds
include both complete sectors, all spur gears and the full rack stroke.

## Validation

Compiled contact-cell vertices agree with their supplied visible-cell vertices
within 0.00000554 source pixel. The maximum visible-boundary approximation is
0.049232 pixel. Evaluating 721 independently prescribed nominal poses finds
no working-surface overlap; native dynamics are checked separately.

| Native run | Duration, seconds | Maximum penetration, pixels | Maximum rack input error, pixels | Maximum spur rolling error, pixels |
| --- | ---: | ---: | ---: | ---: |
| Defaults, ten cycles | 60.25 | 0.0287113 | 0.442466 | 0.101741 |
| Finer timestep and geometry, two cycles | 12.25 | 0.0258537 | 0.310380 | 0.082123 |
| Friction 0.1 and resisting torque −0.1, two cycles | 12.25 | 0.0504393 | 0.802116 | 0.117134 |

The finer run halves the timestep to 0.5 ms and collision tolerance to
0.025 pixel, doubles gear samples to 192, cutter steps to 4096 and end-relief
poses to 2048. All three runs remain finite without time resets and complete
their cycles. Both stop/cam pairs and both sector/rack pairs contact. Default
and finer output never retreat; the loaded run has a 0.00007092-radian initial
retreat. These combined refinement and load trials bound this reconstruction's
behavior, not converged contact forces or arbitrary operating speeds and loads.

Removing cam contact stalls the output near 1.58244 radians, with maximum
rack-command error 358.5637 pixels over 12.25 seconds. Restoring the engraved
cam phase limits the output to −0.81349 through +0.81569 radians and produces
80.8415 pixels of rack error. Disabling every rack/stop contact with gravity
and load absent leaves all three rotors still while the input rack moves.
These checks distinguish native transmission from prescribed output angles.

The all-hardware audit queries actual vertices, edge midpoints and triangle
centroids against opposing surfaces in both directions. Over 51 native poses
at 0.25-second intervals, 13,060,170 queries find zero unintended penetration.
Maximum working overlap is 0.040147 pixel. Same-rigid-family attachments are
excluded; the six named tooth and stop/cam pairs permit 0.1-pixel soft overlap.
Every other pair permits only 1e−6-world-unit numerical tolerance. Every
sampled vertex remains inside the camera bounds. These are finite samples,
not proof of continuous clearance over all configurations.

All 18 selected mechanism, runtime, engine and camera tests pass. They cover
closed connected solids, compiled collision cells, repeated passive handoff,
contact removal, incorrect cam phase and unrelieved-end stalls, section
toggling, deterministic seeking/restart and allocation disposal. The first
cam-control test incorrectly checked rack error only at the cycle endpoint,
where even a stalled rack could coincide with the command. It now checks the
maximum error throughout the cycle without changing the mechanism.

All 19 final integrated views are inspected, including the source overlay,
both handoffs, both sectioned stop contacts, working mesh details, rear and
oblique assemblies, repeated cycles and desktop/mobile controls. The full
stroke envelope makes the initial assembly occupy about half the view height;
zooming remains available. Headless playback averages 25.51 fps at 99.38% of
physical speed, with 18.019-ms mean and 29.800-ms p95 update time. There are no
page errors. Existing Three.js deprecation and screenshot readback warnings
remain. The production build passes with its existing large-chunk and guarded
Node-import warnings. All 39 MuJoCo browser checks pass, including 123 loading
beneath a static subdirectory, playback, pause, restart, section toggling,
mobile controls, navigation and re-entry. The final evidence manifest records
the production build and browser logs.

## Evidence and reproduction

Bulk evidence stays outside Git under `/dev/shm/123-`. Study scripts archive
their input bytes and verify them before writing reports. The final freeze
hashes reports, images, inspections, logs and the production build, preserving
historical source differences and failures:

- `baseline-a`: seven inspected old-model views; `source-a`: measured ink
  points and inspected overlay. `fit-a` and `spur-fit-a` compare independent
  counts/centers and a compatible equal-spur train.
- `dynamics-a/b/c`: root locking, then end-tooth jams. `poses-a/b` expose
  7.2202-pixel nominal interference; `poses-c` verifies the relieved path.
- `dynamics-d/e/f/g`: relieved geometry before topology cleanup; `dynamics-h`
  verifies the joined rack and cleaned cam. These are historical stages.
- `clearances-a/b`: rejected disconnected rack teeth and degenerate cam caps;
  `clearances-c`: first passing topology and complete-hardware audit.
- `candidate-a`: only three of fifteen captured views inspected; `candidate-b`:
  all fifteen inspected. Both precede final topology cleanup and integration.
- `comparison-final`, `poses-final`, `clearances-final`, `dynamics-final/fine/loaded`:
  final source comparison, imposed-path rejection check, full hardware and
  native trials. `dynamics-no-cam/wrong-phase` retain the control failures.
- `integrated-views-a`: all nineteen inspected registered-factory views and
  physical-speed measurement. `tests-a/b` retain the endpoint-assertion failure
  and corrected tests. `build-a` and `browser-a` record production checks.

The failed clearance audits stop before writing JSON; their logs and input
archives are retained. Evidence in shared memory is volatile across reboot;
the geometry, tests, measurement and reproduction scripts are committed.

```sh
PROBE_PREFIX=/dev/shm/123-new-source node scripts/measure-sector-handoff-source.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/123-new-dynamics DURATION=60.25 node scripts/probe-sector-handoff-dynamics.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/123-new-clearances node scripts/audit-sector-handoff-clearances.mjs
TMPDIR=/dev/shm node --test tests/mujoco-sector-handoff.test.mjs tests/mujoco-runtime.test.mjs tests/engine.test.mjs tests/camera-resize.test.mjs
TMPDIR=/dev/shm INTEGRATED=1 PROBE_PREFIX=/dev/shm/123-new-views node scripts/capture-sector-handoff-candidate.mjs
```

Capture expects an existing Vite server at `http://127.0.0.1:43926`, overridable
with `PROBE_BASE_URL`. Use fresh prefixes, one owned browser and unchanged
source/build files during capture. The all-507 review remains active.
