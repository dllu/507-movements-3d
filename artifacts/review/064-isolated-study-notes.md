# 064 · Source and baseline review; isolated cam studies

Production 064 is unchanged. Its factory, two private construction helpers,
test and parameters are archived. Four baseline captures at authored cycle
fractions 0, 0.12, 0.2 and 0.65 are saved and inspected. The complete catalog
remains unfinished; 037 and 063 are mechanically unresolved.

## Source

[The official page](https://507movements.com/mm_064.html), saved as
`../reference/mm_064.html`, has no animation. A bottom worm drives wheel B and
its solid shaft. A radial pin drives the independent cam sleeve through its
half-cut end. Spring pressure resists the rising cam, then assists it past
over-center. The cam advances independently and rests until the pin catches it.
The half-cut end limits relative travel; it does not prescribe an exact
half-turn stroke.

The unchanged Brown enlargement is `../reference/brown-064-detail.png`,
PDF page 24, scale 6000, crop (1820,2420,1320,1250). It is inspected, along
with the whole page and the description on PDF page 25. The source shows a
narrow cam with a nearly straight right edge, a long horizontal pivoted
follower, a roller at its right end, and a curled leaf spring pressing on the
lever. The old broad cam, large frame and decorative rings do not match it.

The provisional source trace uses scan-pixel centers (1010,759) for the cam
shaft, (56,383) for the follower pivot and (1070,387) for its roller. At
200 pixels per model unit, the follower is 5.070039 units long and the roller
radius is 0.23. The cam has a real 0.305-radius bore in the isolated solid.
The current trace and its unchanged background are saved in
`064-source-tracing.html`; both the initial and revised overlays are inspected.

## Actual baseline defects

The current diagnostic checks six selected pairs at **106 poses** across one
worm-wheel turn, including release and catch boundaries. Actual Float32
triangle distances and closed-target containment give **7,690,790 checks and
411,993 penetrating samples**. This establishes defects, not a complete audit.

| Selected pair | Finding |
| --- | --- |
| Cam / roller rim | Intersecting skins at every pose; 3,522 penetrating samples, up to 0.014602 deep. The old radial contact error still reports zero. |
| Shaft pin / half-cut collar | 61 intersecting poses, including all 51 claimed engaged poses; penetration up to 0.052907. |
| Cam / solid shaft | Intersecting skins at every pose; no actual bore through the cam plate. |
| Sleeve / worm wheel | Intersecting at every pose; 68,794 penetrating samples, up to 0.221667 deep. |
| Worm thread / wheel | Intersecting skins at every pose; 331,315 tube surface samples lie inside the wheel, up to 0.102109 deep. |
| Follower / fixed pivot | Intersecting skins at every pose; the lever lacks a real pivot bore. |

The first probe used the open worm tube as a containment target. Its report,
log and exit record are preserved with `open-tube-target-diagnostic` in their
names. The corrected probe excludes that direction and retains tube-into-wheel
containment plus actual triangle distances. Its wrapper exits zero with no
signal in 22.995 seconds. Zero means the diagnostic completed successfully;
it does not mean the old mechanism passed.

## Isolated replacement studies

The cam study solves the finite roller against the actual Float32 outer
boundary of a source-traced extrusion, descending to the first supporting
contact component. It covers **721 cam orientations**. The source pose lies
just before a maximum follower lift at cam angle 0.182243 radians. The first
stable minimum follows at 1.345247 radians, a static drop of **66.635 degrees**.
Contact normals give positive supporting moments throughout.

That first minimum is not necessarily the final inertial settling angle.
A first trace had a small unwanted second torque reversal on its rounded
base. Replacing that region with a circular arc removes the broad radial bump
while retaining the source outline. Seventeen independently marked visible
cam points have maximum residual **3.752 pixels** and RMS **1.703 pixels**.
This is a scoped manual cam-outline comparison, not a claim about every part.
The first trace, reports and screenshots remain archived with `first-trace`.

The solid study constructs a bored cam and finite annular roller, plus a
rectangular pin and actual half-annular sleeve end. It checks **145 cam/roller
poses and 65 pin/collar positions**, using actual triangle distances and
bidirectional containment. The pin's driving offset includes its finite
width and the collar's inner corner. Available relative travel is 2.761272
radians; the checked range ends 0.005 radians short of that limit and covers
the provisional dynamic stroke. Authoritative counts, clearances and exit
status are in `064-source-cam-solids.json` and its exit record.

This verifies only those isolated solids. The contact-normal velocity check
compares a circular-roller follower law to finite facets, including a test
roller spin; it has a 0.01-unit-per-cam-radian tolerance. Physical no-slip spin
and all other hardware remain due. The verifier's first run failed because it
treated stored witness arrays as Vector3 instances; that script error was
fixed and the failed log is preserved with `witness-type-error` in its name.

## Provisional spring dynamics

`study-over-center-snap-dynamics.mjs` applies a preloaded linear spring at the
middle of a massless follower, obtains cam torque by virtual work, and
integrates optional cam inertia and viscous bearing resistance. A unilateral
driving edge prevents the cam falling behind the shaft pin. Catch is an ideal
inelastic reset to driver speed.

The first overdamped trial catches the cam before it settles and is not an
accepted reconstruction. Inertial trial A exceeds the finite half-cut travel;
trials B and D rebound substantially, and D has no settled interval. Trial C
(inertia 0.04, damping 0.12, preload 1, stiffness 6, driver speed 0.4 rad/s)
gives three releases and three catches. It passes the first static minimum,
settles on the circular base, and is below 0.001 rad/s for about **3.204 seconds
per cycle** before catch. Peak cam speed is **7.023 rad/s** and maximum relative
lead is **2.320478 radians**, within the half-cut clearance. Small reverse
motion, about 0.000246 rad/s, remains from the finite-facet/table representation.

Time-step trials use 90,000, 180,000 and 360,000 steps per 15.708-second input
cycle. Release/catch locations agree within 0.000053 radians and peak speed
within 0.000002 rad/s. This is time-step convergence on the same contact table;
it does not validate that table, the chosen mass/spring parameters, energy,
impact forces or a rendered spring. The reported torque residual is algebraic,
not independent evidence of energy conservation.

Visible-boundary harmonic sampling of the worm-wheel engraving favors 23 and
24 teeth nearly equally. It does not establish an exact count or justify the
old 20-tooth choice. A generated worm pair and regularized source proportions
must be selected and checked during the full construction.

No replacement factory is integrated. A complete spring, generated worm pair,
bored bearings and shafts, independent hardware/energy/contact verification,
rendered motion inspection, speed measurement and full regression are still
required. The last full production validation remains the completed 062 run:
2,984 numerical tests, 22 browser tests and the build passing. Production source
and tests have not changed during these 063/064 studies.
