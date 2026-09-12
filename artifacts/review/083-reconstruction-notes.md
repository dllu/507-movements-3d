# Movement 083 reconstruction study

Status: **replacement seating and guide geometry checked; contact dynamics pending**.
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

## Finite seating, spring guides and input closure

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
remain unchanged. **083 still needs free-wheel/sector dynamics, force and energy
checks, continuous clearance, supports, final rendering and playback before
integration.** The finer 082 settling process remains active independently.

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
