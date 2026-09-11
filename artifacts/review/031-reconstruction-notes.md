# 031 · Cylindrical worm and generated wheel

The reopened worm audit is repaired, integrated and verified. The build,
four focused worm tests, the kinematic test and all 2,994 numerical tests pass.
Browser checks pass across the full run and one unchanged-test rerun, qualified
below. Six integrated source/oblique frames, the source overlay, and desktop
and mobile controls are inspected.

## Source and proportions

[Brown's page](https://507movements.com/mm_031.html) identifies a worm and
worm-wheel without specifying manufactured dimensions. The unchanged source
enlargement is `../reference/brown-031-detail.png`: PDF page 18, printed page 14,
rendered at scale-to 6000 and cropped at x610/y1320 with size 840×980.

One orthographic registration uses shaft center (384,562) and 270 pixels per
model unit. The wheel outside radius remains 4/3. Its irregular visible tooth
spacing favors **29 teeth**, replacing the previous 30-tooth construction.
A scoped Fourier study over the unobscured 230-degree outline gives amplitudes
21.637 for 29 teeth and 11.254 for 30. This supports a regularization choice;
it does not prove an exact historical manufacturing count. The starting wheel
phase is 1.5516232068 radians, with the screw phase synchronized to it.

The wheel pitch radius is 1.247311828, axial module 0.0860215054, worm pitch
radius 0.2, and center distance 1.447311828. The worm has 3.5 turns over
0.945855853 units. Its shaft has radius 0.0875, length 2.05, and an axial
offset of -0.1 to reproduce the unequal overhangs. The hidden depth and
20-degree axial pressure angle remain reconstruction choices.

The actual projected mesh contours are compared with **71 scoped boundary
readings**. Maximum/RMS residuals in the unchanged scan are:

| Boundary | Readings | Maximum pixels | RMS pixels |
| --- | ---: | ---: | ---: |
| Wheel | 47 | 23.736 | 8.527 |
| Worm | 14 | 21.359 | 13.155 |
| Shaft | 6 | 5.799 | 3.735 |
| Hub | 4 | 4.000 | 2.508 |

The 30-tooth candidate's wheel RMS was 13.909 pixels; the old shaft's maximum
was 29.25. The regular tooth geometry and screw silhouette cannot reproduce
every irregular source stroke. These are boundary comparisons under one
scale/center registration, not a complete image match or recovered depth.

## Geometry, force and clearance

The old shared generating code bounded a sphere instead of a cylinder around
the worm axis. It also eroded each radial cell to its neighbors' minimum,
which distorted working flank directions. The baseline cleared 12,592,563
surface samples at 17 poses but failed the actual normal-force power check
with a **5.813-percent** residual. The old clearance-only tests had passed.

The corrected cutter uses `(D ± sqrt(tipRadius²-z²))/cos(theta)`, independently
clips its finite axial length, and continuously refines the generating phase.
It does not apply neighboring-cell erosion. The wheel grid has 256 angular
samples per tooth and 32 axial intervals; the worm has 640 angular segments.
The generating hob has a quarter-module crest extension, and the radial cut
clearance is 0.0004.

Doubling generating phase and radial searches changes all 8,481 wheel samples
by at most **3.56e-15** units. The runtime fallback and offline studies now use
the same corrected implementation in `src/simulation/worm-wheel-profile.js`.
The precomputed profile exactly reproduces fresh runtime generation, including
mesh vertices and indices. Other stored contact tables remain byte-identical.
Regenerate only 031 with `node scripts/bake-worm-drive-profile.mjs`.

The final 65-pose worm sweep checks **100,919,780** actual triangle vertices,
edge midpoints and centers in both directions, finding no penetration. Exact
loaded-flank triangle gaps are **6.054–14.616 microunits**, output torque stays
positive, and the maximum normal-force input/output power residual is
**1.252 percent**. The regression test uses different phase samples.

The other eight independent hardware pairs are checked at 65 poses using
conservative transformed-box separation or actual bidirectional surface
samples. All **158,772,816** checks are clear. This gives **259,692,596 combined
surface checks**. All six physical solids have positive volume, outward normals
and paired oriented edges at 1e-9 coordinate precision. The white wheel plane
is a painted index. Fixed shaft/hub/thread joins belong to two rigid families;
their integral or fixed overlaps do not excuse interference between the
independent worm and wheel families.

The integrated default registry and audited candidate have identical mesh
position/normal/index buffers and world transforms at four checked poses,
including the painted index. Collision checks are sampled rather than a
universal continuous proof. Rotation is prescribed; loaded deflection,
bearings and friction are idealized. Worm sliding is not mislabeled as rolling
contact without slip.

## Rendering and verification

Ground and fog are absent. Source and oblique cameras fit the motion envelope;
six integrated frames are saved and inspected. Playback remains two seconds
per input turn, advancing one tooth. A complete wheel revolution takes **58
seconds**, preserving the real 29:1 reduction.

The four focused worm tests pass in 87.442 seconds: exact regeneration,
actual loaded-flank force moments, screw closure/profile, and 65-phase rendered
clearance. The model kinematics test also passes after replacing phase-zero
assumptions with the synchronized source starting phase. The build passes in
12.369 seconds. All **2,994 numerical tests pass** (code 0, no signal, 267.253
seconds). The full browser command passed **23 of 24 tests**, including all
507 canvases and the new 031 play/mobile/framing test. The first test, 057,
exceeded its 45-second overall deadline during a mouse move; completed
assertions had passed. The unchanged test/application passed on an isolated
rerun in **29.8 seconds** (wrapper code 0, no signal, 31.331 seconds). The full
run's exit code 1 and 915.765-second duration, its trace and the rerun are
retained. This is passing coverage across both runs, not a claim that the
original full command exited zero. Concurrent numerical work and software
rendering may have caused the slowdown; the trace alone cannot prove that.
Run later browser suites after heavy numerical work to reduce contention.

Desktop/mobile frames are inspected, and the production UI test checks actual
foreground margins and a stable reset. Process exits and qualification are
recorded in `031-reconstruction.json`. The gallery has 275 comparisons before
the subsequent 065 baseline captures.

Original factory, profile, helper, tests and three initial screenshots are
preserved. The earlier corrected 30-tooth candidate and its passing force,
hardware and convergence reports remain separate from this final 29-tooth
reconstruction. The overall catalog task remains active: 037 and 063 are
unresolved, and 065 onward still need review.
