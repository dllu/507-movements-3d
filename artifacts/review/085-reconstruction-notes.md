# Movement 085: two-wiper gravity stamp

Status: **rebuilt, integrated and verified** under the reconstruction
assumptions below. The all-507 review remains active.

The [original description](https://507movements.com/mm_085.html) specifies two
wipers on a continuously rotating shaft, lifting projection B on a rod that
returns under its own weight. The native Brown scan crop comes from PDF page
28, printed page 24: rectangle `[3180, 3820, 1220, 1350]` in
`brown-page-28-6000.png`. Its SHA-256 is
`11c27f369290b95e3cb9ecbf86e5baa8bba0e11e445f8442898ad3aa115fe9f7`.
The left edge clips part of the movement numeral; the mechanism is intact.
`085-source-provenance.json` retains the source hash and extraction details.

## Rejected baseline

Ten baseline views are inspected. The existing fan-shaped cams, long lateral
projection with a spherical nose, wide shaft-to-rod spacing and straight
support do not match the engraving. A 133-pose finite screen covers 30 closed
meshes, 225 independent pairs and 4,597,408 samples. It finds 177,125 samples
inside another family: the rotating shaft intersects the fixed bearing bridge
and its spherical end, and the moving travel marker intersects the top guide.
Maximum depth is 0.103931248 world units.

The analytic follower-contact error is only 9.42e-16, but that does not prove
physical motion. During the prescribed late lift, required vertical support
force per unit mass reaches -0.325066284 while the cam normal points upward.
Unilateral support cannot supply this downward pull. See
`085-baseline-surfaces.json`.

The first browser capture failed its warning check because it imported a
second Three.js instance. That report, ten uninspected images and the exact
script snapshot remain preserved. Reusing the engine's Vector3 constructor
produced `085-baseline-single-three-captures.json`: ten inspected views, no
errors or unexpected warnings.

## Source and finite reconstruction

Dark-stroke circle fits give shaft center `[437.987783, 469.609747]`, radius
26.751441 pixels, and hub center `[438.721209, 472.032268]`, radius 51.014375.
RMS residuals are 0.947169 and 1.496594 pixels, from 58 and 64 readings.
The inspected measurement overlay supports a common reconstructed axis at
the hub center. Visible contours use manual stroke-center traces at 240
source pixels per world unit.

The replacement has fifteen closed solids: the two independently traced wipers,
bored hubs, rotating input shaft, curved standard and raised border, rear
bearing arm, two bored guides and their brackets, square rod A, flat
projection B, flared stamp head and striking bed. Cam, rod and bearing occupy
separate depth layers. The head's side normals are smoothed without moving
its vertices; the end faces remain flat.

Depths, guide/bearing construction and the common axis are reconstruction
assumptions. The engraving omits the striking bed. Its assumed height permits
a forty-pixel drop from the source pose while retaining approximately nineteen
pixels of the rod inside the upper guide. The actual impact height and pad
dimensions are taken from rendered Float32 mesh bounds. The shaft and hubs
share matching bore surfaces; the rear bearing has separate clearance.

Twenty candidate views are inspected, including two source overlays and
front, oblique, rear, contact, release and impact views. The final ten are in
`085-refined-candidate-captures.json`, with no errors or unexpected warnings.
The silhouette closely follows the source. The candidate preview showed
small shadow stair steps on the hub and standard. Final integrated renders
apply the model's shadow settings through the actual engine and resolve that
issue; the final head shading and shadows are accepted.

## Motion and evidence

The study uses one ideal prismatic stamp coordinate, unit normalized mass,
gravity 9.81, rigid inelastic contact and a four-second clockwise shaft
revolution. Support comes from the actual cam mesh boundary clipped to the
flat projection's width. Backward Euler advances free fall and positive
contact impulses; there is no prescribed rod lift or release velocity.
The two source wipers produce different lifts and release conditions.

Initial eight-second runs at 1, 0.5 and 0.25 ms exposed time-step differences
of 0.432557 and 0.328101 source pixels near impact. A first independent force
audit also rejected the selected normal at cam vertices and the nominal
impact height's approximately 1.1e-7 discrepancy from the actual mesh.
Those failed reports and exact input snapshots remain intact.

The corrected model uses a vertical shared normal when a cam vertex supports
the interior of B's flat bottom, and the sloping face normal at B's corner.
It derives impact and pad limits from actual finite geometry. Corrected
0.25 and 0.125 ms runs contain 32,001 and 64,001 states. Their complete
piecewise-linear translation comparison differs by at most **0.193723966
source pixels**, passing the unchanged 0.25-pixel target. This is observed
numerical agreement, not a continuum-error guarantee. A partial recurrence
check compares seconds 1–4 with 5–8, with maximum displacement difference
6.18e-11 pixels; a complete playback seam remains to be established.

`085-corrected-reactions.json` independently checks all 54,699 positive
reactions, including both actual mesh boundaries and adjacent-face normal
cones. All pass. Maximum boundary error is 6.13e-15; maximum normal-cone
residual is 3.50e-13. Momentum, sampled position and energy identities pass.
The audit reports shaft work 10.426965, backward-Euler kinetic loss 5.452990,
contact drift work -5.175438 and energy change -0.201463 in normalized units.
Contact drift is explicitly retained; it is not labeled physical damping.
The ideal prismatic constraint supplies transverse forces and moments at
zero work; finite guide-bearing loads are not resolved.

`085-refined-candidate-surfaces.json` checks all 68 independent pairs at 101
poses, using 1,501,058 actual surface samples. All fifteen meshes are closed,
and there is no detected intrusion beyond 1e-6 world units. This sampled
screen does not establish continuous clearance.

## Complete playback and continuous clearance

Nine-second runs extend both refined step sizes to 36,001 and 72,001 states.
Their maximum difference remains 0.193723966 source pixels. The complete
four-second repeat compares seconds 1–5 with 5–9 at 32,001 states: maximum
displacement difference is 6.18e-11 pixels. Both endpoints rest on the bed with
zero velocity, while the cam advances exactly one revolution. The extended
spatial audit passes all 60,551 positive reactions and 121,102 boundary checks;
momentum and energy checks also pass. See `085-nine-second-agreement.json`
and `085-nine-second-reactions.json`.

Playback retains the original startup, then repeats this resting-endpoint
cycle. Compressing 40,001 states into 2,950 knots adds at most 0.000099171
source pixels. Runtime projection uses the actual cam boundary and striking
plane. An independent triangle-interval proof bounds its correction to
**0.002 source pixels throughout every interval**, including between sampled
poses. Time-step agreement, compression and the continuous projection bound
total **0.195823137 source pixels**. This combines observed numerical agreement
with bounded playback errors; it does not establish exact continuum dynamics.

The continuous hardware checker covers all 68 independent pairs: 63 have
whole-motion axis separation, one uses the complete cam/B triangle bound,
one has a complete bearing-bore bound, two use the actual guide-cap openings,
and one uses the nonpenetrating striking plane. The cam proof covers all 2,949
playback intervals, using 1,564,046 triangle intervals and adaptive subdivision.
The guide bounds include the entire rod travel and playback correction.
See `085-first-playback.json`, `085-first-playback-bound.json` and
`085-first-hardware-bound.json`.

## Production verification

The app now uses this reconstruction at four seconds per shaft revolution,
with continuous playback, full-motion camera bounds, hidden ground and no fog.
Production matches the independently verified candidate exactly: all 43
geometry buffers, 13,981 poses and 88,485 world transforms agree with zero
reported difference. The other 506 catalog and display-profile entries remain
unchanged.

All five focused tests, **all 3,108 numerical tests**, the production build
and the targeted desktop/mobile browser check pass. The browser check covers
paused startup, play/pause, continued animation beyond the first five seconds,
mobile framing and resumed motion. The build contains 420 modules and retains
the existing large-bundle warning.

All eighteen integrated source, overlay, motion, contact, rear, oblique,
desktop and mobile images are inspected and accepted. The live capture
reports 481 frames in 8.5164 seconds, averaging 56.36 fps with approximately
0.1 ms 95th-percentile model updates, without errors or unexpected warnings.

`085-integrated-checkpoint.json` records the final evidence and
`085-integrated-source-hashes.json` freezes the production inputs. The source
transition archives all five intentional changes to the prior 944-input map;
the other 939 inputs remain unchanged. All 23 prior movement 085 study sources,
71 current movement 083 sources and 43 current movement 082 sources remain
unchanged. Earlier failed studies and capture evidence remain preserved.
No new all-507 browser pass or completion of the catalog review is claimed.
