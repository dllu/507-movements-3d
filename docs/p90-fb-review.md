# Pass 90, lane p90-fb: fixes from the 86–170 audit (docs/p90-audit-086-170.md)

Reviewer: Claude Opus 5.5, lane p90-fb (with two sub-forks). Date: 2026-09-27.

Scratch files and captures are in `/dev/shm/p90/fb/` (outside Git). Before captures are the auditor's, in `/dev/shm/p90/b/`.
- **Tiles:** `tiles/<ID>.png`. Top row: the plate, the default view, rotated +50°/+20°, rotated −50°/−15°. Bottom row: from behind, phase 0.33 and phase 0.67.
- **Zooms:** `z/`.

## Summary

| ID | Severity | Result |
|---|---|---|
| 98 | medium | Fixed. The front cover stays and uses the shared see-through style. |
| 148 | medium | Fixed. The gear is one spoked plate with broad spokes, and the groove is one U-section band. |
| 157 | medium | Fixed by a refit. Swing 95° → 74°, and it now stays short of pointing down; rod lean 18.4° → 7.8°. |
| 115, 121, 133 | medium | Deferred: `authored-gears-core.js` and `authored-intermittent-core.js` are owned by p90-fa. |
| 168, 169 | medium | Deferred: `authored-variable-cranks.js` is owned by p90-fc. |
| 147 | low | Fixed. Finial added. |
| 152 | low | Fixed. The board is elliptical. |
| 90, 91 | low | Not changed. I disagree with the finding, and the tried flare was reverted. |
| 132 | low | Not changed. I disagree: the parts already share one ground level. |
| 92, 146 | low | Not changed. Reasons below. |
| 153 | low | Deferred. The fix needs a contact rebake. |
| 116, 118, 122, 129, 134 | low | Deferred. Their files are owned by p90-fa. |
| 102, 109, 111, 127, 128, 164 | low | Not attempted. They are marginal or need physics rebakes. |

## 98: the groove island floated in the section view

**Verified.** `setSectionView(true)` hid `cover`, so the island `inner` had no visible link to the arm (auditor's `z/m98h.png`).

**Change** (`src/simulation/mujoco-endless-groove/geometry.js`):
- The cover stays visible.
- In section view it is drawn with `makeSeeThrough`, the shared style used for 63, 70 and 71. The pin and groove show through it, and the island reads as joined to the arm through the cover.
- The section toggle now swaps the cover between see-through and solid instead of hiding it.
- The cover's bottom face lies in the plane of the outer and inner plates' top faces at z 0.14. They face opposite ways, so they have no shared side to fight on, and the coincident-face screen confirms this.
- The reconstruction note in `visual.js` is updated. p90-fa's `visual.js` claim covers `mujoco-treadle/visual.js`, as its diff shows; I claimed this file as `mujoco-endless-groove__visual.js`.

**Bake:** rebaked `mujoco-098.json.gz` and its provenance.
- The physics XML hash is unchanged.
- Round trip 0.005 px; raw seam 0.004 px.

**Captures:**
- `tiles/98.png`
- `z/m98-after.png`: from behind with the disk hidden (the cover's floor now shows in the groove), oblique, and a front zoom of the pin in the groove.

**Screens:**
- Coincident faces: 0.
- Disconnected parts: 0 detached. The near-misses are the pin head in its groove.

**Tests:**
- `mujoco-endless-groove` 4/4. It now asserts the cover is visible and see-through in section view, and solid otherwise.
- `mujoco-baked-loops` 116/116.
- `models` 163/163.

**Proposed ledger row:**
- assessment: reasonable
- visibleFlaws: ""
- limits: replace "The grooved arm is drawn solid in front of the disk where Brown dashes it" with "The grooved arm's front cover is drawn see-through (shared style) where Brown dashes the groove".

## 148: wire-thin spokes and groove walls

**Verified.** Production is `geared-crank.js`, `geared-crank-frame.js` and `geared-crank-source.js`. `authored-gear-linkages.js` is a legacy route. The model had eight 0.11-wide capsule spokes and two separate 0.13-wide walls that touched the spokes only where they crossed them. Brown draws broad double-line spokes and a banded groove.

**Change:**
- **Gear:** the large gear is one extrusion from the shared `spokedWheelGeometry`:
  - the involute tooth outline;
  - eight spokes, 0.30 wide at the hub tapering to 0.24;
  - rim fillets 0.12;
  - the same 0.24 depth and plane as the old rim.

  The pinion is unchanged. The tooth outline is kept in `geometry.userData.toothOutline` for the teeth review, whose script was updated to read it.
- **Groove:** the groove is one closed U-section band swept along the groove centre line. Its two walls are joined by a floor. It spans z −0.14 to 0.09, the channel floor is at −0.07 (0.015 below the pin), and the band is sunk 0.06 into the gear plate. The channel width, band width and centre line are unchanged, so the documented reduced outer lobe stands.

**Validation:** regenerated `148-assembly` (FULL, 65 poses, 0 failing pairs), `148-frame-assembly` (0 failing) and `148-complete-teeth` (257 poses, overlap 0).
- `148-rocking-frame.json` is not regenerated. Its script `review-geared-crank-frame.mjs` was already broken before this pass: it reads a part `oblong-rocking-frame` that no longer exists. It records a rejected historical arrangement.

**Captures:** `tiles/148.png`, `z/m148-after.png` (front, oblique and rear zooms).

**Screens:**
- Coincident faces: 0.
- Disconnected parts: 0 detached. The only near-miss is the plate's 0.34 bore, which lies inside the bored hub ring of the same body.
- Seams: 0.

**Tests:** `geared-crank-frame` and `geared-crank` 5/5. The wall-clearance test now runs against the band; the pin clears it by more than 0.004 throughout.

**Proposed ledger row:**
- assessment: reasonable
- visibleFlaws: ""
- limits: keep the existing text, and append "The gear and its eight spokes are one plate; the groove is one U-section band sunk into its face."

## 157: the bell crank swung about 100° and the rod leaned

**Verified.** Production is `pinned-elbow.js`. The auditor's review of `authored-cranks.js` was not the production route. The earlier fit (the reach projection only) left the drawn pose next to the inner toggle:
- bell swing +20.8°/−74.7° about the drawn pose, 95° in total;
- the output arm turned to about −71°;
- the output rod leaned up to 18.4° from its guide line.

The rod's lower end was already on an ideal vertical guide.

**Change** (`scripts/fit-pinned-elbow-source.mjs`, which regenerates `src/simulation/pinned-elbow-fit.js` and `docs/validation/157-source-fit.json`):
- A second fit stage adjusts the same three centres by weighted least squares from the engraving. The crank pin gets 3× weight because it fixes the visible crank radius.
- Constraints:
  - both reach margins are at least 10 px;
  - the swing is within 30° of symmetric about the drawn pose;
  - the rod stays within 12° of vertical.
- The solver is a deterministic Nelder–Mead started from stage 1.

**Result:**
- swing +21.8°/−51.8° (74° in total); the output arm now stops at about −48°;
- rod lean at most 7.8°;
- crank radius 84.4 px, unchanged.

**Residual:**
- Joint shifts from the engraving are now 15.7 px (pin), 23.4 px (upper joint) and 17.8 px (pivot). Before they were 9–12 px.
- The input arm is 164 px where Brown draws 132 px, and the coupler 258 px where he draws 284 px.
- `docs/movement-157.md` records this.
- `157-assembly` was regenerated: 117 pairs, 0 failures. `157-oracle-comparison` does not fingerprint the fit file.

**Captures:** `tiles/157.png`, `z/m157-after.png` (phases 0, 0.22, 0.45, 0.635 and 0.8, including both swing extremes), `z/m157-wide.png` (before).

**Screens:**
- Coincident faces: 0.
- Disconnected parts: 0 detached, 0 short-of-pin.
- Seams: 0.

**Tests:** `pinned-elbow` 4/4. A new test asserts the swing is under 80°, the asymmetry under 30.5° and the rod lean under 8°.

**Proposed ledger row:**
- assessment: reasonable
- visibleFlaws: ""
- limits: replace with "Three joint centres shifted 16–23 px so the crank turns fully and the bell crank swings 74° (+22°/−52°) about the drawn pose, with the rod within 8° of vertical; the exact engraving fails over about 24% of a turn. The rod's guide point is off the plate."

## Lows fixed by the fork

**152: the undrawn rectangular board.**
- Production is `trammel-ellipsograph.js`.
- The board is now an elliptical sheet with a 0.4 margin round the traced ellipse. It is 0.1 thick, and its top stays at `paperTop`, so the ink line and the cross still rest on it.
- `scripts/review-trammel-assembly.mjs` was already failing: "Unclassified mesh". It now classes root-level meshes as fixed. `docs/validation/152-assembly.json` was regenerated: 65 poses, 0 failing.
- Screens:
  - Coincident faces: 0.
  - Disconnected parts: 0 detached. The existing 0.094 groove-wall lip is unchanged.
  - Seams: 0.
- Tests: `trammel-ellipsograph` 2/2.
- Capture: `tiles/152.png`.
- Proposed ledger row: reasonable, no visible flaws. Append to limits: "The paper is an elliptical sheet with a plain margin round Brown's ellipse."

**147: the missing finial.**
- Production is `baked/fan-governor.js`.
- A stepped turned finial and knob (`bulb-neck-finial`) now sit on the bulb carrier's neck and move with the bulb.
- The spindle top was trimmed from 3.5 to 2.75, so it stays inside the carrier bore at every lift.
- The camera bounds include the finial's sweep. No bake fingerprints this file.
- Screens:
  - Coincident faces: 0.
  - Disconnected parts: 0 detached. The existing crosshead/collar small-patch flag is unchanged.
  - Seams: 0.
- Tests: fan-governor 9/9. They now assert that the finial exists and that the spindle stays inside the neck.
- Captures: `tiles/147.png`, `z/m147-after.png`.
- Proposed ledger row: reasonable, no visible flaws. Append to limits: "The finial's step proportions are read from the plate; the dish underside is plain."

## Lows not changed, with reasons

- **90, 91:**
  - Both plates draw the stems' broken-off ends as ellipses, so the stems are round rods, not flat bars.
  - The fork tried flat flare plates at the stem roots. The round rod (r 0.145) then stood proud of the 0.24-thick flare, leaving visible steps (`z/m90-stem.png`). That is a worse flaw.
  - The flare was fully reverted. The sources and bakes are byte-identical to HEAD.
- **132:**
  - The bed block, the centre anvil foot and both column feet all bottom out at y −3.37. The bed overlaps the centre foot.
  - The "below the feet" look in the default view is perspective: the block stands nearer the camera. No change.
- **92:** the grey `rearSupport` arm is the minimal member that ties the fixed shaft to the guide frame. It is out of the default view. Removing it needs a MuJoCo rebake and would leave the shaft and guide unrelated. Kept.
- **146:**
  - On the plate, the yoke's lower part is hidden behind the disk (dotted).
  - Its visible upper outline is a rounded rectangle with slightly bowed sides. The present rounded rectangle is a fair reading.
  - Not changed.
- **153:** deferred.
  - The arms are thin, as reported.
  - But the arm faces are stud contact surfaces in a MuJoCo bake, and the input arm is split so the studs can pass beneath it.
  - Widening the arms needs a contact rebake and regenerating `153-*` validation. That is too much for a low finding.
- **102, 111 (thread land), 109 (0.023 lip), 127, 128 (thickness), 164 (small stroke):** not attempted. They are marginal at normal zoom, 102/109/111 are MuJoCo contact bakes, and 164 is realistic near dead centre.

## Deferred: files owned by other lanes

- **Owned by p90-fa (`authored-gears-core.js`):** 115 (spiky teeth), 133 (8-tooth pinion), 116 (thin front pawl), 118 (rack windows), 122 (lens-shaped link).
- **Owned by p90-fa (`authored-intermittent-core.js`):** 121 (click nose on the tooth tips). The bake config lives in `mujoco-reversible-click`, but the movement's geometry is in the claimed file.
- **Owned by p90-fa (`authored-belts.js`):** 129 (thin posts), 134 (lagging rim).
- **Owned by p90-fc (`authored-variable-cranks.js`):** 168 and 169 (remote rocker pivot).

## Other notes

- `screen-body-intersections.mjs` loads the legacy authored factories for 98 and 148, not the production MuJoCo and geared-crank models. Its worst pairs name parts that are not in production, so it does not screen these changes.
- `camera-catalog.test.mjs` fails at movement 377, which is outside this lane and is being changed elsewhere. It stops at the first failure, and every ID in this lane is earlier than 377 in its loop.
