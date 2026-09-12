# Movement 085: two-wiper gravity stamp

Status: source-shaped reconstruction and refined dynamics study; **not yet
integrated or mechanically qualified**. The all-507 review remains active.
Production remains exactly at the 944-input movement 084 checkpoint.

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

The candidate has fifteen closed solids: the two independently traced wipers,
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
The silhouette closely follows the source. Small shadow stair steps on the
hub and standard remain a rendering item before final acceptance.

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

## Remaining work

Bound every independent pair continuously, including cam/B contact and the
inferred guide/bed arrangement. Prepare compact playback with a verified
startup and complete repeat seam, then qualify its interpolation clearance.
Resolve the remaining shadow details, integrate the model and catalog timing,
and run appropriate numerical, build and browser checks against the final
production state. The current app still uses the rejected baseline.

`085-first-study-checkpoint.json` freezes the current study and its evidence.
All 944 production inputs, 71 current movement 083 sources and 43 current
movement 082 sources remain unchanged. No new full-suite or app-integration
pass is claimed for this isolated study.
