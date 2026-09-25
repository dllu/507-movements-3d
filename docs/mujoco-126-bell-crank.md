# 126 — Pulley and bell crank

The catalog now uses `src/simulation/mujoco-bell-crank/`: a native MuJoCo
pulley, bell crank and two flexible cords with ordinary hinged pin attachments.
Source proportions, passive force transmission, sampled clearances and playback
are checked with the reconstruction limits below. Seven inspected baseline views showed a
spoked pulley where Brown draws a solid face, narrow straight lever arms in
place of the curved source outline, oversized pulley proportions and an added
support frame, guide rails and handles.

The [original caption](https://507movements.com/mm_126.html) describes a
bell-crank lever changing force direction. It does not specify a driving
stroke, return load, rope properties, axial depths or the hidden bearings.
Those require explicit reconstruction assumptions. The pulley, two cord
attachments and fixed bell-crank pivot provide the visible topology.

Preliminary bounded ink-band circle fits use the 525-square local engraving.
The circle-overlay image was inspected; front/rear offsets and the hatched
shaft still require interpretation. Values are image coordinates in pixels:

| Circle | Center | Radius | RMS |
| --- | --- | ---: | ---: |
| Pulley outer rim | 156.587, 148.385 | 79.453 | 0.757 |
| Pulley inset | 157.174, 148.136 | 61.416 | 0.656 |
| Pulley hub | 156.237, 150.054 | 26.918 | 0.458 |
| Pulley shaft | 156.864, 150.929 | 15.633 | 0.430 |
| Bell pivot outer eye | 396.757, 349.302 | 24.823 | 0.648 |
| Bell pivot inset | 395.762, 348.718 | 17.625 | 0.325 |
| Bell pivot pin | 394.879, 349.194 | 7.902 | 0.303 |
| Input eye | 227.131, 348.590 | 19.666 | 0.413 |
| Input pin | 225.746, 350.516 | 8.245 | 0.289 |
| Output eye | 388.813, 490.647 | 18.197 | 0.770 |
| Output pin | 388.932, 491.298 | 8.207 | 0.344 |

The partial pivot-pin fit has only 49 points; the other fits have 94–120.
These preliminary circle fits alone do not establish coaxial geometry, a
working rope radius, the curved lever silhouette or working contact. The
subsequent reconstruction and rendered comparisons are recorded below.

Run `scripts/capture-bell-crank-baseline.mjs` against Vite using
`PROBE_BASE_URL`, and `scripts/measure-bell-crank-source.mjs` for the circle
measurements. Use `TMPDIR=/dev/shm` and exclusive `PROBE_PREFIX` paths.
The initial retained records are `/dev/shm/126-baseline-a.json` with seven PNGs,
and `/dev/shm/126-source-a.json` with its measured-circle overlay. All eight
images were inspected. Scripts freeze inputs and verify their hashes; generated
images and measurements remain outside Git. Subsequent native motion, rendered
clearance, source comparison and integration checks are recorded below.

A separate edge study, `scripts/measure-bell-crank-edges.mjs`, records 68 paired
input-arm and 58 paired output-arm contour stations. Its inspected overlay
tracks the curved sides. The left and right cord ink envelopes average
15.377 and 18.168 pixels across 59 and 67 stations. These include stroke and
hatch thickness and are not yet physical rope diameters. The retained report
and overlay are `/dev/shm/126-edges-a.json` and `126-edges-a.png`.

## Reconstructed geometry

`fit-bell-crank-source.mjs` fits cubic normal offsets to each arm's two
independently measured contours. The source pin distances are 169.138309 and
142.228723 pixels; the previous clean 7:6 ratio is replaced by their measured
ratio. Circular end bosses preserve the visible eye contours above the arms.
The pulley now has a solid face, recessed inner field, concentric hub and
separate hidden groove/flanges. No support frame or handles are added.

Fitting one hidden pitch circle to both cord centerlines gives a 75.392-pixel
pitch radius and 1.932281-pixel centerline RMS residual. The reconstructed
constant rope radius is 8.430556 pixels, inferred from the mean hatched ink
envelope. That width does not uniquely establish the material boundary. In
particular, a round rope at this pitch radius extends about four pixels above
the engraving's top rim. This source inconsistency is retained explicitly.
The source-tangent input end is at (72.0400, 326); the output end is at
(510, 499). Their ideal slide directions follow the initial rope spans.

Actual rendered triangle slices, not just fit residuals, give these source
errors in `/dev/shm/126-comparison-b.json`:

| Feature | RMS, source pixels | Maximum, source pixels |
| --- | ---: | ---: |
| Pulley rim / inset | 0.7571 / 0.7941 | 2.2509 / 2.6204 |
| Concentric hub / fixed shaft | 1.2856 / 1.8918 | 2.6986 / 3.3720 |
| Pivot outer eye / inset / pin | 0.6483 / 0.3247 / 0.3029 | 2.2037 / 0.8007 / 0.5646 |
| Input eye / pin | 0.4126 / 0.2892 | 1.1073 / 0.7805 |
| Output eye / pin | 0.7700 / 0.3441 | 2.9382 / 0.7892 |
| Four arm edges | 0.2148–0.3413 | 0.7722 |
| Left / right cord ink envelopes | 1.4044 / 2.5900 | 2.9109 / 6.6712 |

The cord grips, raised eyes, axial layers, bearing clearances and metal/rope
materials are reconstruction assumptions. The first flat-ended candidate
missed the full eye circles where they overlap the arms; raised bosses correct
that mismatch. All seventeen final visible parts have positive volume and
closed, oriented, nondegenerate surfaces. Each cord now ends in an open grip
behind the lever. The grip has a bored eye around its measured pin and turns
on a native hinge. Its 14-pixel offset keeps the rope end outside the solid
pin; a 2.5-pixel seat holds the terminal cord section through an ideal weld.
Both cords occupy the pulley-groove plane. Pin/eye radial clearance is 0.15
source pixel. These hidden fittings are inferred, not measured source details.

## Native model and earlier trials

This section retains the earlier trials and rejected settings. The finished
model's measurements follow in the qualification section.

The native candidate has one actuated input endpoint, a passive pulley hinge,
a passive bell-crank hinge and a loaded output endpoint. Both cords consist
of finite rotating capsule sections with native ball connections, pulley
friction and nonlocal self-contact. Local overlapping capsule caps are
excluded; mass partitions cylindrical material. No output path or pulley-angle
formula is supplied. The shared runtime owns stepping, reset and disposal.

The current default has 64 input and 12 output sections, a 1 ms timestep and
a four-second, ±0.5-world-unit input stroke. Metal density is normalized to
unit lever mass; rope density is inferred as 12% of that value. A constant
two-unit output load and gravity provide return tension. No bending stiffness
is supplied. These material and drive values are illustrative, not calibrated.

The corrected eight-second trial g completes without resets or passive
actuation. Bell travel is −0.298987 to 0.302028 radians and output travel
−0.421386 to 0.419368 world unit. Maximum native penetration is 0.067725 source
pixel and maximum cord-connection error 0.125117 pixel. The friction-zero
ablation moves the lever while pulley travel stays below 0.001784 radian over
two seconds, compared with approximately 0.69 radian under friction.
All four mechanism tests pass: closed source hardware, native endpoint and
actuator topology, passive force transfer/friction ablation, and complete-state
playback determinism and disposal. These are candidate checks, not final
mechanical qualification.

An optional planar reduction retains each section's two translations and
in-plane rotation. The full model's maximum departure from the source planes
is 0.000024 source pixel over eight seconds. Trial h, with the same geometry
and planar coordinates, completes without a reset; sampled output differences
reach 0.379676 pixel versus the full model, and pulley pitch-line differences
reach 0.954764 pixel. These position sensitivities do not establish force
convergence. The planar option is not yet the default.

The first candidate's fifteen views are inspected, including source overlay,
groove and pin details, oblique/rear/axial views and two cycles. Its initial
uniform rope/metal density produced excessive cord sag and waviness. Playback
produced only 55 frames and advanced 2.666 physical seconds in 12.326 wall
seconds, so that version is unsuitable for public playback. The lighter rope
and reduced section count have a second fifteen-view inspection using the
planar option. Cord sag is substantially reduced; the source overlay, pin
details and native motion views are inspected. Playback produces 177 frames,
advancing 8.716 physical seconds in 12.089134 wall seconds: 14.64 fps and
72.10% physical speed. This is improved but remains unsuitable for final
integration. Mild face-shadow artifacts and provisional pin clamps remain.
A 2 ms full-3D trial and
a conjugate-gradient solver trial reset early; their failed reports are
retained. Neither failure qualifies as a completed motion trial.
The separate planar trial i also resets at 2 ms; reducing coordinates does
not justify increasing the timestep.

## Candidate evidence

- `/dev/shm/126-fit-a.json`: contour and common groove fit.
- `/dev/shm/126-comparison-a.json` and `126-comparison-b.json`: rendered
  source distances before and after raised eye bosses.
- `/dev/shm/126-dynamics-a.json`: first heavy-rope trial; b is the failed
  larger-timestep trial. Trials c–e compare lighter rope and section counts.
- `/dev/shm/126-dynamics-f.json`: failed CG trial; g is the corrected full
  model, h the planar reduction. `126-planar-comparison-a.json` compares g/h.
- `/dev/shm/126-dynamics-no-friction-a.json`: passive pulley ablation.
- `/dev/shm/126-candidate-a.json` and its inspection record: fifteen first
  candidate views and measured poor playback performance.
- `/dev/shm/126-candidate-b.json` and its inspection record: fifteen revised
  planar-model views, current geometry and measured playback performance.
- `/dev/shm/126-tests-a.log`: four passing mechanism tests.

Use `SIM_OPTIONS` JSON, `DURATION` and exclusive `PROBE_PREFIX` values with
`probe-bell-crank-dynamics.mjs`. It retains failures and stops on a native
reset. `capture-bell-crank-candidate.mjs` runs the complete native state against
Vite; reduced joint snapshots are deliberately unsupported for flexible cords.
All study inputs are frozen and checked at completion. Final native timestep
and section refinement, all-hardware clearance, finished attachment geometry,
readable playback and production integration were subsequently addressed below.

## Qualification of the hinged-cord reconstruction

The final model retains all six coordinates of every cord section: 64 input
and 12 output sections, plus two passive grip hinges. The input endpoint is
the only actuator. The two terminal sections are welded to their grips;
interior sections retain ball connections. Pulley torque comes from native
cord friction. The four-second cycle and 1 ms timestep remain unchanged.

Multiple convex contact points are disabled for this rounded capsule/drum
contact. MuJoCo's default can return several points for a capsule/cylinder
pair; see its [collision documentation](https://mujoco.readthedocs.io/en/latest/computation/#multiple-contacts).
The serial four-second profile `126-contact-profile-a.json` measured 6.451
seconds with multiple contacts and 2.112 seconds with one contact per pair,
including contact auditing. Mean active contacts fell from 85.19 to 23.70.
This preserves full 3D coordinates; the planar reduction remains optional.

Trial n advances ten cycles (40 seconds) with no reset, nonfinite state or
passive actuator force. Maximum native contact penetration is 0.031135 source
pixel; maximum endpoint-connection error is 0.103541 pixel. Bell travel is
−0.298157 to 0.302338 radians, and output travel −0.423894 to 0.419725 world
unit. Separate eight-second trials at output loads 1 and 4, around the default
2, also finish without resets or passive actuation; maximum penetration is
0.032341 pixel and connection error 0.104179 pixel. Loads and material values
remain illustrative. The friction-zero mechanism test keeps pulley rotation
below 1e−9 radian while the cord still moves the lever.

Trials j/k/l/m compare the same hinged geometry over eight seconds:

| Change from default | Maximum output difference, source pixels | Bell-tip difference | Pulley pitch-line difference |
| --- | ---: | ---: | ---: |
| 0.5 ms timestep | 0.072011 | 0.082765 | 0.132833 |
| 96 input / 20 output sections | 0.483253 | 0.225373 | 0.152416 |
| Multiple contact points enabled | 0.126484 | 0.156796 | 1.347155 |

These are same-time comparisons with linear interpolation of 20 ms samples,
not force-convergence claims. Local grip rotations are more sensitive to
section count: the output grip differs by up to 0.175916 radian, corresponding
to 2.462825 pixels at its 14-pixel offset. The ideal cord has no bending
stiffness; this local angular difference is retained as a limitation.

The rendered-surface audit checks both directions of each moving hardware
pair, using vertices, edge midpoints and triangle centroids. The 65-pose
eight-second audit performs 1,136,791 queries with zero unintended penetration.
Maximum pulley/rope surface penetration is 0.005865 pixel; cord/grip overlap
is below 0.000089 pixel. A further 29 poses through 40 seconds perform 494,542
queries, again with no unintended penetration. Only the named pulley contacts
and cord seats allow 0.1 pixel of native compliance. Pin bores receive no
special allowance. Every sampled part stays inside the camera envelope.

Nonlocal cord-span capsule bounds over 2,000 native samples through 40 seconds
remain separated by at least 1.940296 pixels on the input cord and 9.963596
pixels on the output. Local neighbors within 2.2 rope radii of intervening
arclength are excluded. The minimum three-point bend radius is 67.957731
pixels, compared with the 8.430556-pixel rope radius. These finite pose and
surface samples do not prove continuous clearance or local tube injectivity.

Both cords render as the shared three-strand laid rope (`laid-rope.js`) on a
centripetal curve through the native section points; each path starts at a
cord end, so its arc length is the material coordinate (pass 53 replaced the
earlier strand-shading shader). The shaft's section hatching remains fixed while the pulley turns.
A tighter shadow camera and −0.0004 bias remove the arm-face shadow artifacts;
the more aggressive −0.001 trial detached the pin shadow and was rejected.
Section view removes the front pulley face and hub to reveal the groove.
The source-rim/rope discrepancy remains visible and stated in the viewer note.

The fifteen-view candidate c inspection includes source overlay, groove,
pins, both travel directions, rear and axial views. It records 388 frames in
12.0395 seconds, advancing 11.966 physical seconds: 32.23 fps and 99.39% of
real time. Seven finish views and five shadow/grip views are also inspected;
the material pass retains the same playback rate. These are headless-browser
measurements on this machine, not a cross-device performance guarantee.

The final source comparison is `126-comparison-c.json`; rigid contours retain
the errors above, and the left/right cord RMS values are 1.402146/2.592287
pixels. Native trials j–p, timestep/section/contact comparisons, clearance
reports a/b and cord-clearance reports a/b are retained under `/dev/shm/126-*`.
The final selected mechanism, engine and shared-runtime run passes 13 tests
(`126-tests-d.log`); the private production build also passes. Six packaged
browser tests pass (`126-e2e-b.log`): 126 loading, playback, pause, restart,
section view and mobile controls; catalog search/filtering; generic controls;
the complete model-loading sweep; mobile layouts; and static-subdirectory
hosting. The loading sweep takes nine minutes; it is a rendering regression
check, not mechanical qualification of the other movements.

All eighteen final integrated views in `126-integrated-a.json` are inspected,
including source overlay, close pins/groove, native motion, rear/axial views,
desktop and mobile catalog layouts. Mobile notes scroll fully (421-pixel
viewport, 1,000-pixel contents). Final playback records 392 frames in 12.0344
wall seconds and advances 11.966 physical seconds: 32.57 fps and 99.43% physical
speed. There are no page errors. Existing Three.js deprecation notices and
screenshot-readback warnings are retained. Close pin shadows still show the
finite shadow map's edge aliasing; arm-face acne is absent.

Local durable evidence is retained as verified gzip objects under
`artifacts/review/126-completion-20260914/manifest.json`. The prior candidate
archive remains available separately. Generated measurements, captures and
build output stay outside Git.
