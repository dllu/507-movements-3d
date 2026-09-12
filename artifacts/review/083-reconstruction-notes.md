# Movement 083 reconstruction study

Status: **candidate clearance, conformal guides and input-energy balance established; motion refinement and repeated playback still pending**.
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
records the refinement and spatial-reaction audit that were then running.
The input-loading audit below adds later evidence. Numerical convergence,
backlash, guide reactions, supports, repeated playback and final rendering
still require qualification. All 904 production inputs and 43
current 082 study sources remain unchanged; no new browser/build pass is
claimed for these isolated study checks.

## Input loading and energy audit

The finest completed 0.125 ms run now passes its complete spatial audit:
**118,413 positive reactions**, 236,826 boundary/normal-cone checks and 64,000
discrete momentum checks. None is missing and neither radial travel stop is
loaded. Maximum boundary error is 2.425e-15 units and maximum momentum residual
is 4.652e-12. This completes the audit previously recorded as running in
`083-hardware-clearance-checkpoint.json`; the result is
`083-continuous-eighth-ms-reactions.json`.

`scripts/lib/spring-sector-loads.mjs` adds the prescribed shaft assembly and
ordinary-pin input rod to the three free rigid families. It derives the rod's
position, angular derivatives and input transmission from the line/circle
closure. An analytic bound over the full shaft range retains a rod axial
projection of at least 1.93254 units and an absolute input derivative of at
least 0.621348; the input transmission cannot reach a toggle in that domain.
Virtual work converts the required shaft impulse into a force along the
remote rod guide, allowing both pushing and pulling and absorption of work.

Direct integration of **18,092 signed tetrahedra** at 17 independently
transformed poses checks kinetic energy, gravity/spring potential and input
momentum. Maximum errors are 2.201e-11, 1.762e-12 and 7.872e-11 respectively.
The rod position and angle match the ordinary-pin linkage; its derivative
checks pass. Masses within the fixed shaft assembly are explicitly additive
lumped masses, including concealed overlaps. Springs remain ideal massless
Hookean elements. These are modeling assumptions, not original-machine mass
or material measurements.

`scripts/lib/spring-sector-saved-contact.mjs` reconstructs each recorded axis
directly for the loading audit. It selects no new contact. Comparison against
the full contact search at 256 states and 471 reactions gives exactly matching
gaps and Jacobians. Across both complete trajectories, all 177,671 reconstructed
impulses retain the free-coordinate momentum balance.

The energy audit includes input work, damping, wheel load, endpoint contact
work, backward-Euler velocity changes and spring-position losses. Its maximum
cumulative residual decreases with the step size:

| Integration step | Maximum residual, model units | Residual / work-and-loss scale |
| --- | ---: | ---: |
| 0.25 ms | 0.0000643878 | 0.000124274% |
| 0.125 ms | 0.0000322017 | 0.0000638841% |

Input-rod work matches generalized input work to 2.776e-17 units. Peak
interval-averaged rod force grows as the step shrinks around rigid impacts;
it is not a converged physical force or stress prediction. The fine run's
rod impulses range from -2.44394 to 2.78650 normalized units. Event times and
force/impulse extrema are retained in `083-bounded-input-loading-study.json`.
This consistent energy balance does **not** resolve the failed trajectory
comparison or establish a distribution of bearing/guide pressures.

`083-input-loading-checkpoint.json` freezes the completed loading evidence,
source hashes and the still-running 0.0625 ms trajectory. Individual guide
reaction distributions, motion convergence, reversal/repeat behavior,
external supports and final rendering/integration remain pending. All 904
production inputs and 43 current 082 study sources remain unchanged.

## Conformal guide surfaces and circular hub faces

The former rods had radius 0.015 inside radius-0.018 slider bores. Surface
checks expose the resulting 0.003-unit gap: those separated surfaces cannot
realize the assumed guide constraint without lateral play. The isolated
`spring-sector-guided-candidate.mjs` now uses matching 64-sided rod and bore
profiles. All changes remain in the prescribed shaft family.

The first twelve new renders also exposed an unshown teardrop-shaped lower
lip on each hub cover. The visible faces are now circular, matching B in the
source. Two thin backing plates behind the sectors cover their moving shaft
notches. This preserves the existing free plates and tooth dynamics. The
second set of twelve inspected source, overlay, front/rear/oblique, guide and
motion views confirms the corrected outline. Small guide-frame fragments
remain visible at the opening tops as part of the assumed hidden construction.
No new timed-playback acceptance is claimed.

`083-final-circular-guide-fit.json` verifies the new hardware. The original
free meshes, three free-family mass integrals and all four spring recipes
remain exactly identical. All unchanged part transforms and spring vertices
match at 25 poses, and the inherited state-update function is unchanged.
All **69 meshes** remain closed, outward oriented and nondegenerate.

Actual projected polygon/triangle separation covers the conformal bores
through axial travel. Separate triangle/envelope bounds keep the backing
plates clear of the slider housings. The **1,302 secondary pairs** pass across
the full guide travel; minimum margin is -2.077e-7 world units within 1e-6.
At 288 cardinal contact points over nine extreme/interior poses, maximum
rod and housing surface errors are 7.749e-10 and 6.605e-9 units. Both surfaces'
compressive normal cones support the required directions, with maximum error
8.882e-15.

Four axial bearing stations provide eight signed transverse force components.
Their contact matrix has rank five and a right inverse with residual
1.421e-14. Opposite walls realize either sign as compressive normal forces.
This spans every compatible ideal prismatic-guide force/moment combination
while allowing free radial sliding. Bearing pressure, compliance, friction
and material limits remain outside this idealization.

`083-guided-complete-clearance.json` combines fresh hardware bounds with the
unchanged primary and coil certificates, checking source hashes and exhaustive
pair accounting. The revised candidate has clearance for **all 1,384
distinct-family pairs and four spring self-surfaces across 64,000 intervals**.
The changed shaft mass is included in a fresh input-loading audit; the finer
normalized energy residual remains 0.0000638726% and decreases with the step.
See `083-circular-hub-input-loading.json` and the inspected captures recorded
in `083-circular-hub-motion-inspection.json`.

`083-guided-hardware-checkpoint.json` freezes this version and its evidence.
Motion convergence, reversal/repeat behavior, support assumptions in final
playback and production integration remain pending. The model is still an
isolated reconstruction study. Production and the 082 study are unchanged.

## Finer-run completion and landing sensitivity

The 0.0625 ms run has finished with **128,001 states**, no rejected trials and
no failed steps. Both the original and revised-guide candidates retain
continuous clearance across all 128,000 intervals; the revised candidate's
certificate is `083-guided-sixteenth-clearance.json`. Minimum primary margin
is -9.9999833e-7 units, within the unchanged 1e-6 tolerance.

Its comparison with 0.125 ms is **3.133324 source pixels**, failing the
0.25-pixel target and worsening the previous comparison. The first large
disagreement occurs near the rear-sector landing at 3.642 seconds: the finer
history contains a brief crown-face impact while the coarser history reaches
an edge-cross contact. The first coarse-knot error above the target is at
3.643875 seconds. Contact histories are retained in
`083-sixteenth-contact-transitions.json`; error localization is in
`083-sixteenth-refinement-localization.json`.

Three short runs start from the same finer state at 3.59 seconds and continue
for 0.23 seconds at 0.125, 0.0625 and 0.03125 ms. All retain continuous tooth
clearance. Their adjacent step comparisons differ by only 0.00562243 and
0.00874135 pixels. The same-step replay exactly reproduces all 3,681 original
finer states in time, free position, velocity and active set. Before the
landing, the two original histories already differ by up to 0.0184872 pixels
and 0.001931 model velocity units. This points to sensitivity to earlier
state error, without yet identifying a unique numerical cause.

The shared-state agreement does not qualify the full trajectory. The next
investigation must address accuracy of the approach to the crown edge and
subsequent repeat behavior. `083-sixteenth-impact-checkpoint.json` records the
completed runs, preserved failed comparison and replay control. No solver or
browser jobs remain running at this checkpoint; 083 remains outside production.

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

## Isolated BDF2 accuracy experiment

The first-order baseline and its archived failures remain intact. New study
modules use BDF2 only while the active finite-contact branch stays unchanged.
Position and velocity histories are both (4*current - previous)/3, with an
endpoint force and velocity weight of 2*dt/3. New contacts, releases and
supporting-feature changes fall back to the original backward-Euler projection
and are recursively resolved to at most one microsecond. Two stable intervals
rebuild history after a transition; pre-impact velocity must not manufacture a
rebound in a later multistep update. Continuous primary-solid bounds still
certify every accepted interpolated segment. No position is geometrically
reseated, and geometry, springs, masses, gravity and damping are unchanged.

The analytic controls in `083-bdf-controls.json` pass. Damped-oscillator position
errors decrease from 0.01198295 to 0.00302524 to 0.00075789 under step halving.
A quadratically moving support has less than 9e-14 final velocity error. A
plastic falling-body control has no rebound above 1.3e-17, with landing-time
errors of 0.00073014, 0.00019700 and 0.00004586 seconds. The original control's
single coarse landing-time threshold failed; its source and trajectory remain
in `083-bdf-control-failure*`. The clarification JSON corrects an initially
mislabelled diagnostic field: the failed assertion concerned landing time,
not rebound. The final control checks the measured refinement explicitly.

Shared-state replays from the earlier 3.59-second finer state cover 0.23 seconds.
The 1 ms and 0.5 ms BDF runs agree to 0.00786120 source pixels. The latter differs
from the 0.03125 ms backward-Euler replay by 0.00360827 pixels. These comparisons
are in `083-bdf-shared-impact-refinement.json`; they do not establish agreement
from the static initial state. The half-millisecond replay contains 541 accepted
intervals. All 817 positive reactions and 1,634 mesh-boundary checks pass, with
maximum method-specific momentum residual 1.3182e-13. The new clearance checker
uses the recorded BDF or backward-Euler position recurrence; the existing guide
transfer completes all 1,384 independent pairs and the four coil self-surfaces.

BDF equation impulses use a different force weight and history from the old
solver. Separate reaction and position checkers account for those equations;
the earlier backward-Euler input-work and energy audits are not qualifications
of this experiment. Full-cycle time-step agreement, energy, repeated motion and
integrated playback remain required.

The first two full eight-second BDF runs now finish: 1 ms has 9,827 accepted
intervals (7,610 BDF), and 0.5 ms has 17,760 (15,578 BDF). Both retain complete
guided-candidate clearance across all 1,384 independent pairs and the coils.
Their maximum difference is **0.479747 source pixels**, failing the 0.25-pixel
target. The maximum occurs at the front-sector landing near 7.7674 seconds.
The 1 ms run's 17,488 reactions and 34,976 mesh boundaries all pass, with
maximum momentum residual 1.184e-12. These runs took 283 and 432 seconds while
sharing CPU resources; no controlled performance benchmark is claimed.

A supplementary immediate-release control remains a deliberate failure in
`083-bdf-release-limit.json`. When a support initially accelerates downward
faster than gravity, the first backward-Euler interval retains contact for one
base step although the exact solution releases immediately. The resulting
velocity error halves with the step size. This exposes a general startup
limitation; the actual 083 initial state is separately solved static equilibrium.
The negative control also directly demonstrates that inadmissible impact
history produces a false rebound when passed to the smooth-branch stepper.
Neither finding is hidden by the passing oscillator and plastic-impact tests.

The 0.5 ms full run's **32,099 reactions and 64,198 boundaries** now also pass;
its maximum method-specific momentum residual is 5.213e-12. A full 0.25 ms run
is still active at this checkpoint (session 44116, Node PID 3947057,
`083-bdf-full-quarter-ms.log`). Its frozen solver sources must remain unchanged
until it terminates. There are no browser jobs from this study. The checkpoint
`083-bdf-motion-checkpoint.json` records the completed evidence, both failed
controls/comparisons and the outstanding run. Energy, motion refinement,
startup/release treatment, remaining reversal and repeated playback remain open.

## BDF energy accounting and bounded impact restart

The 0.25 ms full cycle finished with 33,612 accepted intervals and no failed
steps. Complete guided-candidate clearance still passes. Its difference from
0.5 ms is **0.479608 pixels**, failing the target again. Comparing 1 ms directly
with 0.25 ms gives 0.042877 pixels, but that does not erase either failed
adjacent comparison. Near 7.6196 seconds the half-millisecond run misses a brief
contact with tooth 31 and reaches tooth 30 directly. The other two runs first
touch tooth 31; the discrepancy subsequently grows toward the 7.7674-second
front-sector landing. This is another sensitive grazing event, not evidence
of full motion convergence. The detailed onset and contact histories are in
`083-bdf-late-error-onset.json` and `083-bdf-late-landing-transitions.json`.

The new five-family BDF energy audit uses the unchanged mesh-derived kinetic
energy, potential energy and input momentum. For BDF intervals, the difference
operator is `(current - 4*previous/3 + earlier/3)/(2*dt/3)`. Equation impulses
are multiplied by `dt/(2*dt/3)` for endpoint work quadrature. Velocity and spring
history terms use the same signed weights. A separate energy-history exchange
converts the weighted energy difference back to the actual endpoint change;
these signed numerical terms are not labelled physical damping. The residual
therefore compares independently evaluated mesh energy and momentum-derived
input work without silently reusing the old backward-Euler balance.

`083-bdf-bounded-input-energy.json` passes for all three complete cycles. The
maximum cumulative residual decreases from 2.50310e-5 to 6.70526e-6 to 1.83433e-6;
the finest normalized residual is **3.44209e-8** (0.00000344209 percent).
Oscillator and plastic-impact energy identities pass; every backward-Euler
interval agrees exactly with the old audit. The unchanged 20,124-tetrahedron
formula evidence and identical five-family masses are checked. Input rod
impulses are reported separately from endpoint force estimates; rigid impact
spikes are not finite material-force predictions. A first checker attempt used
the wrong candidate metadata label and failed before the audit; its log and
source are preserved. This energy evidence does not establish motion accuracy.

A separate event-restart variant now limits startup and two stable intervals
after each contact change to the event resolution, before allowing larger
steps. The original solver and all its reports remain unchanged. At a 1 us
event resolution, the immediate-release control's velocity error is bounded
to 2.936e-6 across three base step sizes, instead of depending on the base step.
Halving the event resolution halves that error. Its small initial false
reaction remains explicit. Plastic-impact stopping completes within 0.611 us
after first contact, without a history-induced rebound.

Four short replays start from the same saved state at 7.60225 seconds and run
for 0.2 seconds. The new 1 ms and 0.5 ms runs differ by 0.004047 pixels; the
original restart also passes that local comparison (0.003625 pixels). This
does not isolate the cause of the different full-cycle grazing histories.
The revised half-millisecond replay passes complete guided clearance, spatial
reactions and the new energy audit. Full revised cycles at 1 ms and 0.5 ms are
running; their outcome is required before any claim of improved full motion.

`083-bdf-energy-restart-checkpoint.json` records this state. The pending revised
full runs are sessions 26516 and 92422 (Node PIDs 3990058 and 3990130), with logs
`083-event-bdf-full-one-ms.log` and `083-event-bdf-full-half-ms.log`. Their 18
source archives are verified and must remain unchanged while they run. The
quarter-millisecond original-BDF run and all short controls are terminal.
All 904 production inputs, 43 treadle sources and 33 prior checkpoint sources
remain unchanged. No browser or app build was run for these isolated studies.

## Restart comparison and support-selection precision

Both revised full cycles have now finished: 10,216 intervals at 1 ms and
18,159 at 0.5 ms. Complete guided clearance and the BDF energy audit pass for
both. Their **0.483124-pixel** difference still fails motion refinement. The
bounded restart improves the isolated startup/impact controls but has not
resolved sensitivity to the earlier approach history. No further full-cycle
halving is started at this checkpoint.

The original reaction checker reports one failure in the revised 1 ms run,
at row 9,654 / 7.5359921875 seconds: its wheel Jacobian differs by 0.0621034.
An initial progress message incorrectly called this complete audit passed;
that statement was corrected after the terminal report was read. Its failed
report remains `083-event-bdf-full-one-ms-reactions.json`.

The failure is isolated to support selection in the checker. Its 1e-9 support
threshold includes a third crown vertex **3.60043e-10** units off the supporting
plane, enlarging a two-vertex edge into a triangular face. The resulting
arbitrary reconstructed point has the wrong moment arm. At 1e-12, the two
actual edges give the expected Jacobian. An independent closest-lines solution
using 1e-13 support selection places both points at z=-1.55064297118, within
their finite edge segments. Their 2.000001e-9 separation matches the contact
padding, and the wheel Jacobian **-1.02321620468** equals the solver value
exactly. `083-reaction-support-edge-proof.json` records all vertex projections,
line parameters and points. The 1e-9 negative control reproduces the failure;
`083-reaction-support-tight.json` passes without changing a mesh or motion state.

Full revised-trajectory audits with the stricter selection now pass: 18,055
reactions / 36,110 boundaries in the 1 ms run, and 32,676 / 65,352 in the 0.5 ms
run. All states are covered at stride one. Maximum wheel-Jacobian errors are
2.221e-15 and 2.665e-15; momentum residuals are 3.977e-13 and 1.332e-13.
Sessions 9665 and 27114 both exited zero. The original checker and all its
reports remain unchanged. The support-selection diagnosis does not explain
or remove the separate full-history motion discrepancy.

`083-event-bdf-completed-checkpoint.json` records the completed simulations,
energy and clearance evidence, preserved failed comparison and support
selection controls. No study solver, checker or browser remains running.
Production and the full 507 review remain unchanged and active, respectively.

## Exact contact-kernel acceleration

CPU profiling identifies SAT projections, temporary arrays and their collection
as the main contact cost. The isolated fast kernel keeps the original axis
order, arithmetic order, support ties, lift padding and gradients. It generates
cross axes lazily and computes projection extrema without temporary arrays.
Immutable sector/crown transforms are cached by their exact angles; every
query still evaluates the same translation envelope and pruning decisions.
The original contact helper and all prior studies remain unchanged.

`083-fast-contact-parity.json` records exact equality for 1,204 constraint
evaluations (including transitions and impacts), 230 seating queries, 5,580 raw
SAT intervals and 64 complete implicit steps. Cache revisits, signed zero,
changed bounds/padding/margins and unpruned scans are covered. The dynamics
factory source differs only in its contact provider. Paired query timings give
a 6.14-fold speed ratio in this process; this is not a controlled benchmark.

Full 1 ms and 0.5 ms replays reproduce **every stored state, impulse, active
feature, rejected trial and continuous-clearance statistic** exactly. Their
10,217 and 18,160 states take 61.60 and 87.38 seconds, compared with the earlier
284.12 and 494.60 seconds under their recorded workloads. The full 1 ms strict
reaction audit also reproduces all counts, errors and totals exactly. See
`083-fast-bdf-replay-parity.json` and `083-fast-reaction-parity.json`. These
checks establish computational equivalence and preserve the known motion
failure; they do not make it a passing trajectory.

The accelerated 0.25 ms event-restart cycle completes in 169.60 seconds with
33,980 accepted intervals, complete guided clearance and a passing energy
audit. Its comparison with 0.5 ms remains a failure at 0.483380 pixels. The
0.125 ms cycle finishes in 292.25 seconds with 65,860 intervals. This next
adjacent comparison **passes at 0.0503433 engraving pixels**, measured over
99,355 union knots. The largest difference is the front-sector lift near
7.767406 seconds. This is observed agreement for one full input cycle, not a
continuum-error bound or evidence of settled repetition.

Complete guided clearance covers all 69 meshes, 1,384 independent pairs and
four spring wires over the finer cycle. Its independent spatial audit passes
all 120,852 reactions and 241,704 boundaries; maximum wheel-Jacobian error is
3.109e-15 and momentum residual is 4.374e-14. The normalized energy residual
decreases from 3.526e-8 at 0.25 ms to 9.499e-9 at 0.125 ms. These checks do not
replace the remaining repeated-motion, support and presentation review.

## Second-cycle disagreement

Both step sizes now continue through sixteen seconds, carrying their own
eight-second positions, velocities and active contacts exactly. The join
utility checks all parameters, resume indices, complete source hashes and
boundary states before omitting the duplicate boundary row. It records the
bounded restart of numerical BDF history explicitly. The physical state is
unchanged. Two negative controls reject unequal step sizes and discontinuous
states; neither publishes an output report.

The complete 0.25 ms and 0.125 ms histories contain 68,032 and 131,833 states.
Their comparison **fails at 8.463231 pixels**, with the largest front-sector
difference near 13.678896 seconds. The wheel differs by up to 6.619087 pixels
and the rear sector by 6.776879 pixels. This failure supersedes the first-cycle
pass for any sixteen-second playback claim; all earlier results remain intact.

`083-fast-bdf-second-cycle-divergence.json` reproduces the comparison's full
199,377-knot maximum and records threshold crossings with bracketing states
and nearby contact transitions. Disagreement first exceeds 0.1 pixels at
10.693 seconds, 0.25 at 11.315875, 1 at 11.717375 and 8 at 13.325. The increase
is accumulated through several contact events, rather than appearing at the
eight-second join. This locates the disagreement without claiming its cause.

Complete guided clearance still passes through all 131,832 finer intervals,
and the full five-family energy audit passes with a normalized residual of
6.463e-9. The second-cycle spatial audit passes all 115,523 reactions and
231,046 boundary checks, bringing the complete finer history to 236,375
checked reactions. Maximum momentum residual is 7.594e-14.

A separate 0.25 ms replay starts from the finer trajectory's exact eight-second
state. It completes 34,113 intervals without failed steps. Its comparison
with the existing 0.125 ms continuation still **fails at 0.738183 pixels**,
but the difference is substantially smaller than the separate-start histories'
8.463231 pixels. This supports sensitivity to carried first-cycle error while
also exposing unresolved error introduced during the second cycle. It is not
a physical-instability diagnosis or a decomposition of nonlinear error.
`083-fast-bdf-shared-second-refinement.json` preserves this counterfactual.
Neither clearance nor energy establishes motion accuracy, and 083 remains
outside production.

SHA-verified consolidation of immutable, identical TXT archive copies recovers
about 1.42 GB in the first pass and 0.50 GB in a later pass. All original
sources, JSON, images and logs retain their bytes. The 904 production inputs,
43 treadle sources and 40 prior 083 checkpoint sources remain unchanged.
No app build or browser capture was needed for this isolated study change.
`083-fast-bdf-long-checkpoint.json` records the complete results and frozen
sources. All study jobs are terminal at this checkpoint. The full 507 review
remains active; longer motion accuracy, repeated playback and final support
and rendering review remain open.

## Variable-step second-order history

The preceding turn made progress: it established exact contact-kernel parity,
first-cycle agreement and a separate failure during the second cycle. Current
source hashes and terminal process handles were checked before continuing.

The equal-step solver's finer sixteen-second schedule contains 3,106
backward-Euler intervals larger than the 1 us event window. Those intervals
total 0.135338 seconds and arise while rebuilding equal-step history after
events. An isolated variable-step variant now retains quadratic history as
the interval changes, with growth bounded by two. For the ratio `r = dt/oldDt`,
the history increment is `r*r/(1+2*r)` times the previous state difference,
and the force/velocity weight is `dt*(1+r)/(1+2*r)`. Contact changes and two
stable small intervals still use backward Euler. Meshes, physical parameters,
contact constraints and continuous-solid certificates are unchanged.

Analytic controls check unequal-step quadratic motion and moving-contact
reactions at four ratios, reject excessive growth, and recover second-order
oscillator refinement. On a deliberately uneven one-second free-fall schedule,
position error decreases from 0.0343912 to 1.069e-11 world units. Plastic
stopping completes within 0.611 us without a rebound. Immediate-release error
still depends on finite event resolution and halves when that resolution
halves. These controls do not establish the actual mechanism's accuracy.

The new 0.25 ms full cycle has 35,336 intervals, including 711 backward-Euler
intervals, all at or below the event resolution. The 0.125 ms cycle has 67,058
intervals. Their comparison **passes at 0.00136539 engraving pixels** over
101,902 union knots. Complete guided clearance passes for both. Independent
spatial audits pass 64,012 reactions at 0.25 ms and 122,630 at 0.125 ms.

The energy and reaction checkers now reconstruct the unequal-step weights.
The signed velocity, spring and energy-history exchanges retain their original
interpretation. Uneven-step oscillator and impact energy identities pass, and
every backward-Euler interval matches the old energy audit exactly. Normalized
energy residual decreases from 8.004e-10 to 1.988e-10 with the finer base step.

The original equal-step 0.0625 ms cycle also finishes, preserving that separate
experiment. It has 129,678 states and agrees with 0.125 ms within 0.0510740
pixels. This is another first-cycle comparison; it does not qualify its longer
motion or replace the new variant's evidence.

## Longer variable-step motion and remaining grazing sensitivity

Both new trajectories continue through sixteen seconds with exact carried
states and explicit small numerical-history restarts at eight seconds. The
joined histories have 70,575 and 134,689 states. Their comparison still
**fails at 7.399579 pixels**, over 204,769 union knots. The largest difference
is the front-sector lift near 13.682968 seconds; the wheel and rear-sector
bounds reach 4.317025 and 4.655317 pixels. First-cycle improvement therefore
does not qualify the longer motion.

The new onset diagnostic places the first 0.1-pixel crossing near 12.69625
seconds and the 0.25-pixel crossing near 12.69975. The coarser trajectory briefly
catches front tooth 25 from 12.693913 to 12.694130 seconds, before reaching tooth
26 at 12.722846. The finer trajectory misses that brief contact and reaches
tooth 26 at 12.702802. This identifies the first large separation as a grazing
contact-history difference; it does not establish whether event timing, earlier
integration error or another solver tolerance dominates the approach error.

Complete guided clearance covers all 134,688 finer intervals, 1,384 independent
pairs and four spring wires across the two segments. The second segment's
energy audit passes with a normalized residual of 2.658e-10. Its 117,543
reactions and 235,086 boundary checks also pass, bringing the finer sixteen-
second history to **240,173 independently checked reactions**. These audits
retain the failed motion comparison and do not claim periodicity.

Twelve new diagnostic source, overlay, oblique, rear, guide and phase renders
are inspected. The measured outlines and ordinary-pin closure remain aligned,
and the full wheel and separated spring-guided sectors are visible. Small gray
guide-frame fragments remain visible at the opening tops; support presentation
and timed playback are still unfinished. The capture has no page errors or
unexpected warnings. Its single browser is closed. The capture and separate
inspection records are `083-variable-bdf-motion-captures.json` and
`083-variable-bdf-motion-inspections.json`.

A 0.25 ms first-cycle trial with a 0.1 us event window exposed the step-growth
stall described below. `083-variable-bdf-checkpoint.json` records the earlier
state with 56 frozen study sources. All 904 production inputs and
43 treadle study sources remain unchanged. Completed immutable TXT archive
copies were consolidated after SHA verification, including small 082/083
copies. Original files, JSON, images and logs retain their bytes.
No app build or production test rerun is claimed for these isolated changes.
The full 507 review and 083's remaining mechanical and visual work stay active.

## Clock round-off in the growth check

The 0.1 us trial continued consuming CPU after its log stopped advancing near
two seconds. Inspection of the owned process found stable contact history,
not a failed physical step: 190,658 stable intervals had accumulated at a
61.03515625 ns requested step. Subtraction of adjacent stored times represents
that step as 61.0351560404 ns. A proposed double step consequently has ratio
2.00000000687, beyond the integrator's purely relative growth allowance. Each
attempt to grow was split again, indefinitely retaining the tiny step.

Before stopping the diagnosed run, all 303,989 accepted states, rejected
trials, continuous certificates and source metadata were copied while it was
paused. The complete prefix reaches 2.022250427 seconds. Its lossless gzip
snapshot is 38,039,165 bytes, representing 304,717,641 uncompressed bytes;
streamed decompression reproduces the byte count and SHA exactly. Only after
that verification was the owned process terminated (session 12607, exit 143).
No saved state or source was edited. See
`083-variable-bdf-tenth-us-live-inspection.json`,
`083-variable-bdf-tenth-us-stall-snapshot.json` and the referenced compressed
prefix. This incomplete trace is preserved as failed study evidence.

A separate clock-aware variant adds an absolute allowance based on the spacing
of the time stamps to the nominal growth limit of two. An independent hard
ratio cap of 2.001 keeps the homogeneous history multiplier below 0.801.
The actual unequal-step equations are unchanged. The saved blocking predicate
is reproduced; translated-clock free-fall controls at 2, 4, 8 and 16 seconds
now need 16 intervals instead of 8,193–16,384. Twelve accepted-step comparisons
are exactly equal to the previous variant. The original variant and all its
completed evidence remain unchanged.

The corrected 0.25 ms / 0.1 us first-cycle trial is running in session 92271,
Node PID 6179, with output/log prefix `083-clock-bdf-tenth-us-full-quarter-ms`.
Its 21 source archives are verified. This does not yet qualify the trial's
motion or extend the previous auditors' fixed ratio tolerances to the finer
event scale. `083-clock-bdf-checkpoint.json` records 60 frozen study sources,
the preserved stopped prefix, controls and this pending run. The full 507 goal
remains active.

## Finer events and lossless segmented studies

The preceding goal turn made progress on variable-step accuracy and repaired
the clock-growth stall. The corrected 0.25 ms / 0.1 us first cycle now finishes
in 169.04 seconds with 37,667 accepted intervals and no failed steps. Complete
guided clearance passes. Its independent audit covers 67,403 reactions and
134,806 boundaries; normalized energy residual is 8.185e-10.

The new auditors account for time-stamp spacing when validating unequal-step
growth and reconstructing its coefficients. Their allowance includes rounding
of the new time stamp as well as the solver's growth comparison. A separate
hard represented-ratio cap of 2.002 remains below the unstable history range.
The physical momentum and energy equations, supporting-feature intersections,
normal cones and continuous geometry certificates are unchanged. The new energy
auditor exactly reproduces the earlier complete 0.25 ms variable-step audit.

New study reports use lossless gzip with bounded input chunks and compressor
backpressure. Controls reproduce native JSON bytes and parsed values, including
real trajectory rows, Unicode, escapes, empty arrays and JSON omission/null
behavior. They also check exclusive output publication. The packed runner
normalizes exactly to the prior clock-aware runner after substituting only
decoding, serialization, source storage and names; no integration operation
changes. Each decoded input segment must still fit in a JavaScript string.
No unbounded-reader claim is made.

Editable code retains separate snapshots. Generated evidence keeps its existing
exclusive output path and is referenced by its byte hash, avoiding additional
large JSON copies. Earlier files and archives retain their bytes. The completed
coarse continuation occupies 4,643,528 compressed bytes for 34,250,688 decoded
bytes; the finer first cycle occupies 8,435,065 for 65,011,071 bytes.

The new comparator accepts plain or compressed segments, checks exact carried
states and resume provenance, and compares their logical concatenation without
writing another full trajectory. It reproduces the earlier 7.399578-pixel
failure, every body maximum and all 204,769 union knots exactly. A discontinuous
join is rejected before publication. See `083-packed-report-controls.json` and
`083-packed-analysis-parity.json`.

The completed comparisons retain the same 0.25-pixel target:

| Compared settings | Duration | Maximum difference | Result |
| --- | ---: | ---: | --- |
| 0.25 ms, earlier 1 us variant versus corrected 0.1 us variant | 8 s | 0.00131295 px | Pass |
| The same settings, including the recorded clock-guard change | 16 s | 0.268962 px | Fail |
| 0.25 ms versus 0.125 ms, both with 0.1 us events | 8 s | 0.00103791 px | Pass |
| The same base-step comparison | 16 s | 3.534342 px | Fail |

The finer sixteen-second history has 138,438 states. Its first target crossing
is near 13.32625 seconds, and the largest front-sector difference is near
14.697684 seconds. These comparisons record both source provenance and numerical
settings; the first two do not isolate event resolution from the clock-guard
change. None qualifies the longer motion for playback.

Complete guided clearance covers all 138,437 finer intervals, 1,384 independent
pairs and four spring wires across the two segments. Their normalized energy
residuals are 2.077e-10 and 2.541e-10. Independent audits pass 125,950 and 119,530
reactions, totaling **245,480 reactions and 490,960 boundary checks**. Maximum
momentum residual is 1.396e-14. These checks retain the failed motion comparison.

The finer cycles advance 8.108177 and 7.990860 teeth. After removing the nearest
eight-tooth advance, the final two cycle endpoints differ by up to 0.541790
pixels, using the exact wheel-radius chord and radial sector displacements.
Their velocities also differ. This rejects a seamless repeat of those states;
it does not exclude later settling or establish a whole-cycle recurrence.
`083-packed-clock-tenth-us-endpoints.json` records the endpoint diagnostic.

The 0.0625 ms / 0.1 us first cycle has now completed successfully: 132,973
intervals in 599.96 seconds, with no failed steps. Its 124,699,808 decoded bytes
occupy 15,762,702 compressed bytes. It agrees with the 0.125 ms first cycle
within 0.00102219 pixels over 201,834 union knots. Complete guided clearance
passes, and its normalized energy residual is 5.409e-11. The independent
spatial reaction audit remains in progress; the energy audit does not replace
that check.

The finer continuation carries the exact final state into the second cycle
in session 47440, Node PID 90854, with prefix
`083-packed-clock-tenth-us-second-sixteenth-ms`. The first-cycle spatial audit
is session 78659, Node PID 89512, with prefix
`083-packed-clock-tenth-us-sixteenth-reactions`. Neither pending result is
claimed as passed.

The current study freezes 69 sources. All five completed trajectories have
finite states, strictly increasing time and their full requested durations;
continuations preserve exact carried states. Decoding all four packed reports
reproduces their producer byte counts and SHA-256 hashes. Production's 904
inputs, the 43 treadle sources and all 60 prior 083 study sources remain
unchanged, and all nine added scripts pass syntax checks. See
`083-packed-clock-bdf-checkpoint-validation.json` and
`083-packed-clock-bdf-checkpoint.json`. No browser, app build or production
test rerun is claimed in this step. Longer motion accuracy, repeated playback,
support presentation and the full 507 review remain open.

## Grazing contact and sensitivity to carried states

Both jobs pending at the packed-report checkpoint completed successfully. The
0.0625 ms first-cycle spatial audit passes all 132,973 intervals, 243,476
reactions and 486,952 boundary checks, with maximum momentum residual 6.283e-14.
The second cycle has 133,135 accepted intervals and no failed steps. Its
complete guided clearance and energy audit pass; normalized energy residual
is 7.142e-11. Its full spatial reaction audit has not been performed.

The 0.125 ms versus 0.0625 ms comparison over sixteen seconds **fails at
6.992124 pixels**, across 404,046 union knots. The first target crossing is
near 12.69975 seconds. In the coarser history the front arc catches tooth 25
at 12.693914856 seconds and releases it at 12.693972717 seconds, about 57.86 us
later. The finer history misses this brief contact and first reaches tooth 26
at 12.702806030 seconds. The new segmented onset diagnostic preserves exact
carried states and reproduces the earlier joined-input diagnostic's bins,
threshold crossings, bracketing states and contact windows exactly. See
`083-segmented-divergence-controls.json` and
`083-packed-clock-tenth-us-sixteenth-divergence.json`.

The controlled event comparison starts both second-cycle runs from the same
saved 0.125 ms first-cycle state. Solver code and physical parameters agree;
only the event window and its minimum step are halved, from 0.1 us to 0.05 us.
These runs **pass at 0.202838 pixels** over 128,197 union knots. Complete guided
clearance and energy checks pass for the new history; its normalized energy
residual is 2.588e-10. This isolates the event setting for this interval and
initial state, and does not establish convergence from the original startup.

Two local runs carry the identical state at 12.000000000034154 seconds from
the 0.0625 ms parent history. At base steps of 0.0625 ms and 0.03125 ms, both
with 0.1 us events, their next 1.5 seconds **agree within 0.000111698 pixels**
over 74,112 union knots. Both miss tooth 25. The finer local history passes
complete guided clearance; energy audits pass both histories with normalized
residuals 2.219e-10 and 6.293e-11. These local results do not qualify the
complete startup trajectory.

A third local run uses the same 0.03125 ms step and 0.1 us event setting, but
carries the 0.125 ms parent's state near twelve seconds. It retains the brief
tooth-25 catch. The two fine-step local runs begin with position differences
of at most 0.00343611 pixels. The wheel-speed difference is 8.315e-5 radians
per second; the plate-speed differences are 7.809e-5 and 6.210e-5 world units
per second. Their maximum positional disagreement grows to 3.698066 pixels
by 13.5 seconds. Both inputs retain their exact parent states;
their represented start times differ by 2.265e-11 seconds. The diagnostic
records analytic input-angle and input-velocity bounds for this clock offset,
below 4e-12 radians and 3.1e-12 radians per second respectively. Solver code,
time-step settings and physical parameters are identical. The coarse-seeded
local history also passes guided clearance and energy checks. See
`083-packed-clock-graze-seed-sensitivity.json`.

This establishes sensitivity to the carried state around the brief contact.
It explains why improving only the local step near the contact does not remove
the disagreement inherited from earlier integration. It does not identify
which complete history approximates the continuum solution or justify changing
the physical parameters to force a preferred tooth catch.

The finer complete cycles advance 8.108177 and 8.023727 teeth. Their final two
endpoints differ by up to **1.406439 pixels** after subtracting the nearest
eight-tooth advance. The largest reverse excursion in the second cycle is
0.188589 tooth. Repeated playback and the intended nearly continuous output
remain unqualified; `083-packed-clock-finer-cycle-motion.json` preserves these
diagnostics and the earlier coarser endpoint failure.

The complete 0.03125 ms / 0.1 us first cycle is running in session 52036, Node
PID 124791, with prefix `083-packed-clock-tenth-us-full-thirtysecond-ms`. The
two new diagnostics bring the frozen 083 study source count to 71. Production
and the existing 082/083 sources remain unchanged. No browser or production
build was run during this step. `083-grazing-state-checkpoint.json` verifies
all five newly completed trajectories, 21 supporting reports, source archives
and producer serialization hashes, and records the remaining live process.
The full 507 review remains active.

## Complete 0.03125 ms first cycle

The pending 0.03125 ms / 0.1 us first cycle completed with 260,579 accepted
intervals, no failed steps and 1,247.39 seconds of integration time. Its
244,869,210 decoded bytes occupy 30,417,319 compressed bytes. Compared with
the 0.0625 ms first cycle, the maximum difference is 0.00154025 pixels, below
the unchanged 0.25-pixel target. Complete guided clearance and the energy
audit pass; normalized energy residual is 1.267e-11. A complete independent
spatial reaction audit has not yet been performed at this resolution.

The second cycle carries this run's exact final state in session 23410, Node
PID 190188, with prefix `083-packed-clock-tenth-us-second-thirtysecond-ms`.
That continuation is still running. The passing first-cycle result does not
override the earlier sixteen-second failures or establish repeated playback.
The 71 existing 083 study sources and production inputs remain unchanged.
The 084 engraving review has started independently while this run continues.
`083-thirtysecond-start-checkpoint.json` records the verified first-cycle
trajectory, four passing reports, unchanged sources and the live continuation.

## Complete 0.03125 ms second cycle

The continuation recorded above has now completed successfully. It has 260,288
accepted intervals, no failed steps, 4,423 rejected trials and 1,348.63 seconds
of integration time. Its 239,447,984 decoded bytes occupy 30,393,195 compressed
bytes. The exact carried state joins the first cycle into 520,868 states over
sixteen seconds. Complete guided clearance and energy checks pass; the
normalized energy residual is 2.102e-11.

The 0.0625 ms versus 0.03125 ms comparison over both complete cycles **fails
at 6.925184 pixels**, across 786,477 union knots. The first 0.25-pixel crossing
is at 12.69978125 seconds. The finer run catches front tooth 25 from
12.693915649 to 12.693930664 seconds, about **15.015 microseconds**. The
0.0625 ms run misses that contact. The finer run next reaches tooth 26 at
12.723107666 seconds. This reproduces the earlier pattern of a small state
difference preceding a different brief contact; simply halving the base step
has not established agreement of the complete history.

A focused independent spatial audit covers all 2,292 consecutive intervals
from approximately 12.67 to 12.74 seconds, including that catch and the next
tooth engagement. All **2,864 reactions and 5,728 boundary checks pass**.
Maximum point-force Jacobian error is 1.111e-15 and discrete momentum residual
is 1.336e-14. This validates those recorded reactions, not the complete
trajectory's accuracy or its transitions between saved states. A full spatial
audit at this resolution remains unperformed.

The failure, onset diagnostic and focused audit are preserved in
`083-packed-clock-tenth-us-sixteen-thirtysecond-refinement.json`,
`083-packed-clock-tenth-us-thirtysecond-divergence.json` and
`083-packed-clock-thirtysecond-graze-reactions.json`.
`083-thirtysecond-complete-checkpoint.json` verifies the producer's decoded
byte count and hash, all supporting reports and unchanged inputs. All jobs
started for this continuation and its checks have finished. The 71 existing
083 study sources, 43 current 082 sources and 904 production inputs retain
their bytes. No production integration, repeated-playback qualification or
new app/browser test pass is claimed. The full review remains active.
