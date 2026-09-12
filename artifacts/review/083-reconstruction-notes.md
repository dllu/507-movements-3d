# Movement 083 reconstruction study

Status: **complete candidate clearance established; motion refinement and loading still pending**.
The separate shared shadow correction below changes rendering only. This
study began while the finer movement 082 settling run continued.

The [original description](https://507movements.com/mm_083.html) specifies two
oppositely toothed arcs C fast on a common rockshaft B, one working on each
side of wheel D. Rod A receives reciprocating rectilinear motion. Springs
must allow each arc to rise over the teeth during its return. Only one arc
is drawn; the spring and guide construction are not specified.

The inspected native image is `artifacts/reference/brown-083-detail.png`, a
1120 × 1250 crop at `[480, 3820, 1120, 1250]` of the 4814 × 6000 scan of PDF
page 28 / printed page 24. `083-source-provenance.json` records its source
hash and crop. The smaller public engraving was also inspected.

Six baseline renders cover the upright sector, both reversals, return,
oblique and rear views. The source sector is a broad plate with rounded
triangular openings. The model instead uses three narrow straight bars and
a separate tubular toothed shoe, with exposed springs and an added frame.
The input rod slope and tooth/plate proportions also need correction. Hidden
depth, the second sector and supporting hardware require an explicit
reconstruction rather than an assumption that the existing geometry is correct.

The baseline prescribes wheel rotation from nominal pitch radii and raises
the returning shoe with a sine-squared envelope, independently of actual
tooth contact. A bidirectional finite-surface screen at 65 phases finds
**4,632 penetrating samples in 3,585,304 checks** across 1,036 selected pairs.
The maximum measured depth is 0.062958 world units. The screen includes all
36 wheel teeth and the wheel body against both sets of 13 sector teeth and
their rims. All tooth solids and the wheel body are closed and outward-wound.
Both tubular rims have 18 open boundary edges, so their surfaces are checked
against closed targets but they are not used as interior tests. An earlier
screen also tested the open interiors; it found no rim intrusions and all
4,632 tooth intrusions remain in the corrected screen. Both reports are
preserved. The screen excludes the other hardware and is a sampled diagnostic,
not a continuous all-parts bound. Both front and rear tooth pairs penetrate.

Preliminary source measurements fit the rod-eye outer/inner circles and the
rockshaft-eye outer circle with RMS residuals of 0.873, 0.565 and 1.251 pixels.
The measured crank pin spacing is 213.122 pixels. Manually selected rod edges,
sector sides, both opening contours and the wheel's lower edge are plotted
on the native image and inspected. They are layout targets, not final splines
or qualified manufacturing dimensions. Tooth count, pitch, profiles, hidden
depth, springs, guides and contact kinematics remain open.

Local evidence is `083-baseline-captures.json`, `083-baseline-inspections.json`,
`083-baseline-closed-target-surfaces.json`, `083-first-source-measurements.json` and its
inspection record. The local `083-baseline-checkpoint.json` freezes this
study against the original 904-input production state. The shared shadow
correction is the only subsequent production-source change; its updated map
is `083-shadow-source-hashes.json`.

## Counted sector profile and static candidate

The first radial tooth trace accidentally selected wheel ink at −108° and
suppressed the adjacent real sector tip. Its overlay is preserved and rejected.
The corrected mask and bounded stroke widths recover eight clear tips. A
nearest-pitch fit to those tips alone favors 63 full-circle divisions, but its
full overlay adds an extra tooth in the obscured center. Inspection of an
enlarged central crop identifies four intervening sector tips, giving a
12-tooth arc. Assigning the visible tips ordinals `[0,1,2,7,8,9,10,11]` favors
57 full-circle divisions. This is a reconstruction choice from the drawing,
not an original specified tooth count or manufacturing dimension.

A uniform straight-flanked profile fitted to 299 visible radial readings has
tip/root radii 509.483/487.825 pixels and a short-face angular fraction of
0.333950. Its radial RMS residual is 5.231 pixels; the maximum is 23.015 pixels.
The drawing's rounded, uneven strokes and overlap are not reproduced exactly.
Both the rejected 13-tooth overlay and the revised 12-tooth overlay are inspected
and preserved. These measurements support a provisional layout, not contact
qualification.

`scripts/lib/spring-sector-candidate.mjs` builds an isolated static model with
broad pierced plates, rounded openings, asymmetric teeth, the measured crank
and ordinary rod eye, and a complete horizontal crown wheel. The hidden rear
plate has reversed teeth. The 38-tooth crown and its depth follow a provisional
equal-circular-pitch layout; they remain to be established by finite contact.
The crown teeth have flat face normals and no enlarging bevels. An initial
inward-winding error was caught before rendering and corrected; its source
and diagnostic remain archived.

All **47 finite meshes** are closed, outward-wound and nondegenerate. A static
screen of all **298 distinct rigid-family pairs** checks **126,530 surface
samples** and finds **62 intrusions** across ten sector/crown tooth pairs, with
maximum depth **0.040880 world units**. The arbitrary initial crown phase is
not seated. No clearance or mechanical pass is claimed. Moving a whole plate
upward would also require replacing the current circular hub/shaft construction
with a justified spring guide; the candidate deliberately contains no such
unqualified animation. Rectilinear input closure and supporting bearings remain
open as well.

Four candidate renders and four subsequent renders are actually inspected:
front source comparison, registered overlay, oblique and rear. The broad plate,
openings, rod slope, wheel envelope and shaft length now follow the source
closely. Tooth seating, the central outline and rear-plate visibility remain
unfinished. The initial capture assertion rejected library/driver warnings;
the final harness removes its duplicate Three import and records the existing
clock/shadow deprecations and screenshot readback notices explicitly. It passes
with no JavaScript errors or unexpected warnings.

Local evidence includes `083-corrected-tooth-measurements.json`,
`083-counted-uniform-profile.json`, `083-tooth-profile-inspections.json`,
`083-reviewed-candidate-solids.json`, `083-reviewed-candidate-captures.json`,
their inspection record and `083-static-candidate-checkpoint.json`. All 904
production inputs still match the shadow-fix map; the prior build and 3,100-test
result therefore apply to unchanged production. The finer 082 settling job
continues independently. Neither candidate is integrated.

## Prior finite seating, spring guides and input closure

The latest candidate separates each moving sector from the hub fast on B.
Two parallel radial rods guide each sector through bored slider housings;
compression springs press those housings downward. The fixed hub cover hides
shaft clearance in the moving plate. This paired-guide construction is an
explicit reconstruction of the unshown spring support, not a detail established
by the engraving. It preserves angular clocking on B while allowing radial
rise. Guide travel is currently −0.06 to +0.18 world units. The existing capped
coil generator changes pitch and radius while preserving its reference
quadrature length and wire thickness; spring self-contact and load qualification
remain open.

The input rod now closes through its ordinary pin on the crank. Its remote
end follows a straight line parallel to its source position; that remote guide
is unshown. Constant rod length, pin coincidence and the remote endpoint's
actual mesh transform are checked at 117 geometry poses. These prescribed
shaft-angle poses do not establish a time law or driving load.

`scripts/lib/spring-sector-contact.mjs` decomposes each rendered plate into
**479 triangular prisms** and checks them against all **38 finite crown teeth**.
It intersects the separating-axis overlap intervals for translation along
the actual radial guide. Taking the highest exit determines where a plate
approaching from above first clears the crown. The calculation uses the
rendered Float32 faces, face normals and edge cross-products, with 2e-9 world
padding. Convexity is checked; no nominal pitch circle substitutes for contact.
Eighteen unpruned comparisons match the pruned results exactly. Tightening the
direction deduplication and convexity tolerances preserves all 117 results.

At the original wheel phase, the required rise is 0.083051 units. A phase scan
finds a better source pose at wheel angle 0.0723393 rad and rise 0.0297244 units
(6.539 engraving pixels). An independent edge/triangle intersection check
finds no intrusion there. Lowering the sector by 0.0001 units produces a
0.0000449601-unit penetration, confirming that the contact location is real.
Across the separate 117-pose grid over shaft angles ±0.22 rad and one wheel
tooth pitch, required lifts range from 0.030548 to 0.098203 units. The complete
sector stays at least 0.055481 units above the wheel body's top plane on that
grid. This is sampled angular evidence, not a continuous envelope or dynamics.

The first guide placement collided with the shaft and crank: 6,805 penetrating
samples are preserved in `083-first-guided-seat-solids.json`. Lowering the
guide assembly removes those collisions. All **67 meshes** are closed,
outward-wound and nondegenerate in nine seated geometry poses. An independent
screen of all **1,320 distinct-family pairs**, including each deforming spring,
finds **zero intrusions in 2,591,486 samples**. It does not check spring
self-intersection or prove clearance between the sampled poses.

Seven actual renders are inspected: source, registered overlay, oblique, rear,
both shaft-angle limits and a close view of the guides. Hub B stays fixed,
the rod stays connected, and the guides are visible behind the plates. Small
portions of the guide frame show through the opening tops, and the hub cover
adds a visible lower lip; those unshown details remain subject to final visual
review. The complete wheel is visible in every full-model view. The close-up
intentionally isolates the guides. Browser capture passes without JavaScript
errors or unexpected warnings.

Evidence is `083-strict-finite-seating.json`, `083-lowered-guided-seat-solids.json`,
`083-first-guide-poses.json`, `083-guided-candidate-captures.json`, its inspection
record and `083-guided-candidate-checkpoint.json`. Source and failure archives
are retained. All 904 production inputs and the 41 saved 082 study sources
remained unchanged at that checkpoint. The following dynamics stage supersedes
the crown direction, axle-family assignment and sampled seating values here.
The finer 082 settling process was still active at this earlier checkpoint.

## Free wheel and radial sector dynamics

The candidate now integrates the output wheel angle and both sector lifts.
Only shaft input is prescribed. Actual mesh mass and inertia, gravity,
ideal massless compression springs and bearing damping determine free motion;
unilateral finite-tooth contact supplies impulses. Startup is seated once.
Later sector positions are not reset to a static seating solution.

The first dynamic run exposed the crown ramps facing opposite to the engraving
and produced backward net motion. Reversing the crown ramps corrects that
geometry; all 38 teeth remain closed and outward-wound. The output axle now
turns with wheel D and fits its matching hub bore. Guide housings meet their
plates at faces, removing a small overlapping volume before deriving mass.

The finite-contact routine now supplies analytic shaft and wheel derivatives
from its actual separating-axis features. All **256 derivative comparisons**
at 128 nonuniform poses agree with central differences within 5.024e-10.
An early height exclusion preserves the prior algorithm's lifts, body bounds
and pair counts exactly on the same current geometry. These checks do not yet
qualify feature transitions or the contact normal cone.

Independent integration of the actual tetrahedron vertex velocities and
heights checks both radial force equations at 32 free states. Maximum force
discrepancy is 4.318e-9; wheel inertia agrees within 1.422e-13. This checks free
forces and inertia, not contact reactions, guide loads or whole-trajectory
energy balance. Common material density is normalized to one unit of moving
sector mass; stiffness and damping remain reconstruction choices.

The corrected crown with a four-second input period still slips substantially,
advancing only 0.852182 teeth in two cycles. With the same parameters and an
eight-second period, a 0.004-second-step run advances **15.877151 teeth** in two
cycles. Its 4,001 states have no rejected or failed steps, with minimum reported
gap -1.411e-15 world units. However, the wheel still retreats by as much as
**0.323447 teeth** from a preceding maximum. This remains an exploratory result;
it does not establish acceptable backlash or a final animation speed. Both
earlier unsatisfactory dynamic runs are preserved.

For the corrected crown, 117 independent seating poses pass; required lift
ranges from 0.0124541 to 0.0982033 units, with at least 0.0372785 units above the
wheel-body plane. Lowering a seated plate by 0.0001 units creates a detected
penetration, preserving the independent negative control. Nine actual poses
from the slower trajectory pass the complete distinct-family screen:
**67 parts, 1,280 pairs, 2,632,342 samples, zero intrusions**. Reassigning the
output axle to the wheel family accounts for the smaller pair count. These
samples do not prove continuous clearance or spring self-clearance.

All twelve trajectory renders are inspected, including the registered source
overlay, both reversals, intermediate states, oblique/rear views and a guide
close-up. The ordinary input pin stays connected and full-model views retain
the complete wheel. The unshown guide frame and hub-cover lip still need
visual refinement; external supporting bearings are absent. The browser
reports no JavaScript errors or unexpected warnings.

`083-dynamics-checkpoint.json` freezes 20 study dependencies and records the
force, derivative, seating, dynamics, surface and image evidence. All 904
production inputs remain unchanged, retaining the previous build and 3,100-test
result. The replacement is **not integrated**. Contact reactions and feature
transitions, input/guide loads, trajectory energy, time-step refinement,
continuous clearance, supports and final playback remain open.

## Spatial reaction audit, interpolation failure and corrected startup

The complete 0.004-second-step trajectory now passes an independent spatial
reaction audit. All **7,147 positive impulses** have intersecting supporting
features on the actual solids. The 14,294 boundary and normal-cone checks pass,
including incident-face support halfspaces to reject an internal triangulation
face masquerading as a physical boundary. Contact-point wheel and input
Jacobians agree within 2.443e-15 and 3.886e-16 respectively. Discrete free-body
momentum residual is at most 8.786e-12. No guide stop is loaded in this run.
`083-slower-drive-reactions.json` preserves every reverse-motion interval's
sampled torques; valid contact at stored states does not validate the whole path.

Indeed, sampling the midpoint of all 4,000 intervals finds **54 contact-envelope
intrusions**, with worst radial deficit 0.000198594 units. An independent
complete-mesh screen at that witness confirms a front-sector/crown-tooth
penetration of 0.0000434297 units. The failed reports are
`083-slower-drive-midpoints.json` and `083-midpoint-witness-solids.json`.
Halving the time step to 0.002 seconds also changes the two-cycle advance
from 15.877151 to 12.887304 teeth; maximum trajectory discrepancy reaches
194.416 engraving pixels. The earlier visually plausible run is rejected
for playback, despite its passing node-level reactions and nine-pose screen.

The initial wheel angle had been selected to seat the **upright** source pose
and then reused with the shaft tilted to -0.22 radians. That preloads the
sectors above a stable resting position and releases stored gravitational and
spring energy as the drive starts. A one-pitch energy scan and bounded local
minimizations at the actual initial shaft angle locate the lower-energy seat
at wheel angle **0.033189177145424485 radians**. Both one-sided energy slopes
point toward this minimum. Three nonnegative contact forces balance the static
preload with residual free velocity below 6.107e-16; the first driven step
retains the full prescribed input acceleration. The reproducible study and
force check are `scripts/study-spring-sector-initial-seat.mjs` and
`083-static-initial-equilibrium.json`.

With that initial phase supplied explicitly, otherwise unchanged 0.002- and
0.001-second-step runs advance 8.117590 and 8.127550 teeth over one eight-second
cycle. This avoids the large startup divergence, but their maximum displacement
difference is still **4.19131 pixels**, above the unchanged 0.25-pixel target.
Wheel retreat remains 0.215674 and 0.231829 teeth. These runs are not qualified
for final playback. The 0.0005-second-step run subsequently completed all
16,001 states without failed or rejected steps, advancing 8.100822 teeth.
Its comparison with 0.001 seconds reduces the maximum difference to
**1.703677 pixels**, still above the unchanged target. The subsequent
0.00025-second-step run completed 32,001 states, advancing 8.105902 teeth with
no failed or rejected solver steps. Its comparison with 0.0005 seconds reduces
the discrepancy to **0.451570 pixels**, which still fails the target. These
fixed-step runs do not have the continuous contact protection introduced below.
No default physics or geometry was changed to
force the result, and the replacement remains separate from production.

All twelve renders of the 0.001-second trajectory are inspected, including
the registered overlay, both reversals, intermediate states, oblique/rear
views and guide detail. The ordinary input pin stays connected and the full
wheel is visible. The source proportions remain close; the unshown hub-cover
lip, exposed guide fragments and missing external bearings still need work.
No JavaScript errors or unexpected browser warnings occur. These stills do
not overrule the refinement or continuous-path failures.

`083-equilibrium-start-checkpoint.json` records the initial evidence;
`083-equilibrium-refinement-checkpoint.json` records the completed 0.0005-second
run and the then-pending refinement. Converged motion, backlash, input/guide loads,
trajectory energy, supporting bearings and final app playback remain open.

## Continuous primary clearance and step rejection

`scripts/lib/spring-sector-sweep.mjs` now bounds both complete sector/crown
pairs throughout each interpolation interval. It uses the actual 479 convex
plate cells per side and 38 crown wedges. Fixed-axis endpoint separations are
reduced by analytic second-derivative chord bounds for wheel rotation, exact
sinusoidal shaft input and linear radial lift. A separate height bound keeps
each plate above the wheel body. The world-space tolerance remains 1e-6, with
an additional 1e-10 arithmetic allowance. Other hardware and spring
self-contact are outside this certificate.

The check reproduces the independently confirmed coarse intrusion and rejects
a whole-turn rotation whose endpoints appear identical. Finite-state guards
reject invalid input. Applying it to the complete previous 0.0005-second run
finds **21 penetrating intervals**. That failure is preserved in
`083-equilibrium-half-ms-continuous-sweep.json`; clearer endpoint poses and
smaller fixed steps alone did not remove all crossings.

The new `scripts/study-spring-sector-continuous-dynamics.mjs` rejects a trial
when the continuous bound fails, then integrates both halves from their
carried states using the unchanged implicit contact equations. It never
replaces a state with a geometric seat. The known coarse failure is repaired
with five accepted steps instead of one: 0.002, 0.0005, 0.00025, 0.00025 and
0.001 seconds. Their primary geometry is continuously bounded. Independent
mesh checks at all ten endpoints/midpoints total **3,188,220 samples with no
intrusion above tolerance**. All eight contact reactions and the discrete
momentum check also pass.

A complete eight-second cycle with maximum step 0.001 seconds now has
**8,048 accepted intervals**, 48 clearance-driven rejections and no failed
steps. All **292,979,392** sector-cell/crown-wedge interval pairs are accounted
for by the bounds and exclusions. The minimum certified separation is
-9.99995e-7 units, within tolerance; the plate remains at least 0.0355550 units
above the wheel-body plane. The geometry path uses linear free-coordinate
interpolation and the exact prescribed shaft law; this certificate must be
re-established if a future playback changes that path.

All **14,981 positive reactions** in that full run pass the independent spatial
audit, including 29,962 boundary/normal-cone checks. No contact is missing and
no guide stop is loaded. The maximum discrete momentum residual is 7.846e-12.
The run advances 8.103779 teeth and still retreats by up to 0.226850 teeth.
Its comparison with the finer fixed-step reference differs by 3.05519 source
pixels. Continuous clearance is therefore established separately from
numerical accuracy; this is not accepted final playback.

The finer runs at maximum steps of 0.00025 and 0.000125 seconds have now
finished with 32,001 and 64,001 states, no rejected trials and no failed steps.
Both pass continuous tooth clearance. Their free-coordinate disagreement is
**0.947596 source pixels**, failing the unchanged 0.25-pixel target. The wheel
advances 8.105902 and 8.090721 teeth respectively. The failure is retained in
`083-continuous-eighth-ms-refinement.json`. Clearance does not establish motion
accuracy; the candidate remains outside production.

## Complete candidate hardware and spring clearance

`scripts/check-spring-sector-hardware.mjs` bounds all **1,198 secondary pairs**
over the full guide travel `[-0.06, 0.18]`, shaft angles `[-0.22, 0.22]` and
arbitrary wheel rotation. Most parts separate by bounds in the common shaft
frame or by height above the wheel. The remaining checks use actual projected
triangles for the shaft's swept notch, four round slider bores, input pin bore
and eight guide-window pairs. The rod's ordinary-pin linkage supplies its
angular bound. Correlated spring/slider motion retains the moving seat plane;
the wire stays outside the guide rod's cylinder.

The minimum hardware bound is **-2.012e-7 world units**, within the 1e-6
tolerance and its explicit rounding allowance. The near-zero values are the
intended spring-seat contacts. A guide rod deliberately shifted by 0.02 units
fails its housing-bore check. Independently transforming the rendered vertices
at 45 extreme/interior poses confirms the enclosing bounds. The verified
report is `083-hardware-verified-travel-bounds.json`.

`scripts/check-spring-sector-coils.mjs` covers self-clearance of all four
identical finite wires over the same full travel. Their centerline spans
range from 0.042 to 0.282 units. Polar-angle bounds separate nearby cells;
neighboring cells stay on opposite sides of their shared section plane.
Interval determinants preserve local surface orientation, including Float32
rounding. The proof coordinates and side-face winding match the actual indexed
wire; maximum coordinate discrepancy is 1.482e-8 units. Separate-turn tube
bounds examine 400,960 parameter-interval pairs and retain a **0.0006693-unit
margin** at maximum compression. All 52 sampled wire states remain closed,
outward oriented and nondegenerate. See `083-coil-verified-travel-bounds.json`.

`scripts/check-spring-sector-clearance.mjs` verifies source hashes, exhaustive
pair accounting, trajectory containment in the hardware domain, and complete
primary interval accounting. It combines the 1,198 secondary bounds with
76 sector/crown and six sector/body-plane pairs. The current 0.125 ms study
therefore has continuous clearance for **all 1,280 distinct-family pairs and
four spring self-surfaces through all 64,000 intervals**. The minimum primary
bound is -9.99993e-7 units; the plate/body margin is 0.0355393 units. This applies
to the current candidate and its exact interpolation law, including its
explicit hidden-guide construction assumption. It does not qualify missing
supports or a future playback path.

`083-complete-candidate-clearance.json` records that combined check.
`083-hardware-clearance-checkpoint.json` freezes the completed evidence and
records the next refinement and spatial-reaction audit. Numerical convergence,
backlash, input/guide loads, energy, supports, repeated playback and final
rendering still require qualification. All 904 production inputs and 43
current 082 study sources remain unchanged; no new browser/build pass is
claimed for these isolated study checks.

## Shared framing-marker shadow correction

The baseline renders showed isolated shadow spots beyond the visible model.
`markShadows` was re-enabling shadows on camera-framing guides after their
constructors had disabled them. These transparent meshes are now excluded
explicitly from casting and receiving shadows.

Constructing all 507 catalog entries finds 66 such guides across 53 movements;
every guide now has shadows disabled. Six new renders are inspected against
their originals. Pose data matches exactly, the source panel is unchanged,
and the changed pixels are confined to the former marker shadows. Genuine
part shadows remain. The build and all 3,100 numerical tests pass against
the updated source map. The selected topology and contact results are
bitwise unchanged by the shadow fix. `083-shadow-checkpoint.json` records
these checks. No final mechanical acceptance of 083 or all-507 browser pass is claimed.
The complete review remains active.
