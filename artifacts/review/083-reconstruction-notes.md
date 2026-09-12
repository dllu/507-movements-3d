# Movement 083 reconstruction study

Status: **existing mechanical baseline rejected; reconstruction pending**.
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
