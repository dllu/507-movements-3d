# Lane m2-intermittent — pass-51 minor residuals (63, 67, 70, 71, 76, 84, 181–184, 187, 206, 211, 213–215, 217, 218, 235)

Captures were taken from the production routes on private non-watching dev servers, beside `public/engravings/mm_NNN.png`: default views and 8-phase strips. Intersection screens used `node scripts/show-body-intersections.mjs ID --spacing=0.01 --samples=129`. Proposed ledger text is given per ID; the ledger itself was not edited by this lane.

## Group A

Captures: 8- and 16-phase strips from production routes on a private server,
beside `public/engravings/mm_NNN.png`. Intersection screens used
`show-body-intersections.mjs ID --spacing=0.01 --samples=129`.

### 63: snap-action star counter (not changed)
- Tried narrowing the drop's hidden leg, moving its right edge about 35 source
  px inward with a knee kept inside the disk. The sliver is still there,
  because it is the leg itself. While the drop is held up and the pawl has
  fallen into the star, an open gap forms between the pawl's lobe and the pin
  disk, and the leg has to cross that gap to join the drop body to the hidden
  working tip. Reverted; the geometry and bake are unchanged.
- Brown also draws the pawl solid over the disk, with the drop's leg dashed
  behind it. So the hidden pin-to-leg contact matches the plate and is not a
  flaw.
- Intersections: 0 pairs before and after (5 bodies, open: none).
- Verdict: minor. The sliver is forced by the lift geometry.
- Proposed ledger text:
  (a) Default and 16-phase captures inspected beside the plate: Brown's broad
  hooked pawl in front of the disk, the drop's leg hidden behind it as he
  dashes it.
  (b) sampled-clear. Pass-51 m2 screen (0.01, 129): no pairs.
  (c) visibleFlaws: "While the drop is held up with the pawl fallen, a thin
  strip of the leg shows in the gap between the pawl's lobe and the disk; the
  leg has to cross that gap to reach its working tip." limits: "Start pose is
  7° of pin rotation from Brown's to show the drop at rest; the star is
  regular and held only by the pawl."

### 71: internal-guard tappet stud index (not changed)
- Measured: the tappet push takes 55.3° of B's turn (164.3° to 219.6°), and
  the studs cross the rim ring (0.66 to 0.86 of the centre distance) over
  most of that turn. The swept-stud notches are therefore 40° and 44° wide.
  At the rest pose they are centred at about 100° and 197° in the view, where
  Brown has about 135° and 217°. Brown's own ring is about as thick (dashed
  inner 0.69, outer 0.87), so his narrow notches could not pass the studs.
- The tappet is at 164°, matching Brown's 163°. The notches' position
  relative to the tappet is fixed by the push, so no pose change fixes both.
- Intersections: 0 pairs (2 bodies).
- Verdict: minor, forced.
- Proposed ledger text:
  (c) visibleFlaws: "The rim notches are about 40° wide and sit 20–35° from
  Brown's narrow slots; they are the swept path of the studs across the rim
  during the 55° push, which Brown's slot widths could not pass." limits: "".

### 206: double-stroke shared-pivot ratchet (not changed; a rebuild was tried and reverted)
- Finding (not previously recorded): Brown's hooked teeth (long back, steep
  undercut face) point so that the plate's wheel turns counter-clockwise.
  His right pawl pulls as the pin rises and his left pawl pushes as it falls.
  The model turns clockwise and drives on the long tooth backs, which is why
  its teeth read as "less hooked".
- Tried: a mirrored construction frame (root scale.x = -1) with Brown's
  undercut teeth and the pawl roles swapped. The stroke calibration closed
  (amplitude 6.74°). The pushing pawl reset cleanly. The pulling pawl cannot
  get back into an undercut (or even a radial) tooth space: any pawl turn or
  pivot motion reaches the face-contact point from behind the face or over
  the point. Only the pull stroke itself (dead travel) could seat it, and the
  continuous-drive construction does not model that. A tuned reset and a
  riding pawl both left either about 0.014 of penetration or a 0.17-unit
  jump. Reverted the whole function to HEAD, and the 206 test to HEAD.
- Intersections: 0 pairs (5 bodies).
- Verdict: minor.
- Proposed ledger text:
  (c) visibleFlaws: "Teeth are square-stepped where Brown's are hooked
  points; his hooks face a counter-clockwise drive (right pawl pulling as the
  pin rises), while the model drives clockwise on the long tooth backs."
  limits: "A mirrored rebuild with Brown's undercut teeth needs dead-travel
  pull-in of the pulling pawl, which the continuous two-stroke construction
  cannot model; contact exact by construction; the catalog archetype still
  says forty-four teeth."

### 211: pin-guided half-toothed wheel and locking pinion (changed)
- Change: `guideThickness` 0.72 → 1.15 construction units in
  `pinGuidedHalfToothIntermittentLockingDrive`. The guide piece now reads as
  Brown's broad bean-shaped tongue rather than a thin hooked rod. The working
  flank (the pin's epicycloid) is unchanged; only the far side grows.
- Intersections: 0 pairs before and after (2 bodies). The movement-211 tests
  (pin never penetrates the guide over 32,769 states) pass.
- Verdict: close to reasonable. The toothed arc (99° against Brown's 80°) and
  the 16-position pinion are forced by the one-turn index, and the tongue's
  working edge still curves up along the pin path.
- Proposed ledger text:
  (a) Default and 8-phase captures inspected beside the plate: fine square
  teeth on a short arc, rim just proud of the tips, plate-sized pinion, broad
  bean-shaped guide tongue.
  (b) sampled-clear. Pass-51 m2 screen (0.01, 129): no pairs after the
  thicker guide.
  (c) proposed assessment: reasonable. visibleFlaws: "". limits: "The
  toothed arc spans about 99° (Brown about 80°) and the pinion has 16
  positions, because a one-turn index needs them; the tongue's working edge
  follows the pin's epicycloid, so it curves upward; Brown's arc does not
  close kinematically, so about 22° of relocking is prescribed." (If the
  lead thinks the 99° arc is visible, keep minor with that as visibleFlaws.)

Files touched: src/simulation/authored-intermittent-core.js (one line in
211's function). No test edits remain: the 206 test edits were reverted, and
63, 71 and 206 source are identical to HEAD.
Tests: movement-211 (5/5 pass); movement-063, movement-071 and movement-206
(14/14 pass).

## 213, 214, 215, 235 (fork B)

Captures: default and 8-phase before (`/dev/shm/m2/before`, `/dev/shm/m2/bp`) and after (`/dev/shm/m2/B/a3`). Intersection screen: `show-body-intersections.mjs ID --spacing=0.01 --samples=129`.

### 235 — changed
- **Spring intersection fixed.** The return spring's tip lay inside the tappet body (0.0888), and the spring crossed the hinge boss when the tappet yielded (0.0280). The spring now bears up on the tappet's tail lobe behind the hinge with 0.008 clearance, as on Brown's plate. Its last span stays tangent to the lobe bottom in the tappet's frame, so it follows the lobe when the tappet yields.
- **Layering as Brown dashes it.** The tail lobe is a second tappet plate behind the arm: world z 0.01–0.19, arm 0.215–0.385, front hook 0.41–0.59. It is keyed with the front hook to a hinge pin, which moved from the arm to the tappet and turns in the arm's bore. The spring and its clamp also sit behind the arm, in the lobe's plane. Only the lobe's lower edge shows below the arm, and the spring's run shows below it.
- **Arm reshaped to the plate.** The thin 0.22 strip is now Brown's broad bar, 0.44 across, with a rounded end round the pivot.
- **Undrawn black hardware reduced.**
  - The tappet and holding-click noses take their parts' colours, so they read as rounded hook ends.
  - The star's large black hub, the tappet's hinge boss and the spring clamp take their parts' colours.
  - The fixed bearing washers are thin rims round the pins.
- Motion law and baked paths are unchanged (`generate-star-tappet-paths.mjs` output is byte-identical).
- Intersections: 0.0888 / 0.0280 → **none** (0.01 spacing, 129 samples).
- Visual verdict: reads as Brown's plate: a broad arm, the hooked tappet hinged near its left end with its tail behind the arm, a small spring under the arm, the star and the holding click.
- Proposed ledger:
  - (a) Default and 8-phase captures inspected beside the plate: Brown's broad arm with the hinged hooked tappet. Its tail lobe lies behind the arm, as Brown dashes it, and the small spring under the arm presses it up. The noses, hub and clamp are no longer black studs.
  - (b) sampled-clear. Pass-51 m2 screen (0.01, 129 samples): no pairs. The spring now bears on the tail lobe behind the arm with 0.008 clearance, instead of sinking 0.089 into the tappet.
  - (c) The holding click is a plain curved bar where Brown draws a broader hook.
- Proposed assessment: **reasonable**. visibleFlaws: "The holding click is a slimmer curved bar than Brown's hook, and the star's pivot pin still shows as a small black stud." limits: "Tappet return and holding-click drop follow prescribed clearance paths; spring force and impact are not simulated."

### 213 — no change (forced)
- Intersections: none before and after (0.01, 129 samples).
- Brown's own plate cannot be built with square teeth. On mm_213.png, the gap the pin sits under is about 9 px wide between ink walls. The pin ring is about 14 px across (outer), so Brown's pin cannot enter Brown's square gaps. A square-gap cutter was already tried (w3g): only 0.08-deep square teeth solve, about 40 % of Brown's height. The swept pin-envelope notches are the nearest working form. Shrinking the pin to Brown's size would narrow the gaps but make them shallower (the root rises by the radius change), so it would not make them read as square.
- Proposed ledger: (a) unchanged; (b) sampled-clear, pass-51 m2 screen: no pairs; (c) as now.
- Proposed assessment: **minor**. visibleFlaws: "The five stop teeth are rounded pin-swept notches where Brown draws square teeth." limits: "Brown's pin (≈14 px) is wider than his tooth gaps (≈9 px), so his square teeth cannot admit it; only 0.08-deep square teeth solve. Frictional retention and load capacity are prescribed."

### 214 — no change
- Intersections: none.
- Re-measured against mm_214.png:
  - Tooth width at the tips is about 35 % of the pitch in both Brown and the model (0.60 on 1.66–1.70 arcs). Tooth height is about 0.21 R in both. Only the slight flank taper (0.60 tip / 0.72 root) differs from Brown's parallel flanks.
  - Right finger: 34.5° above horizontal in both.
  - Left finger: 15° from vertical in the model, 11° on the plate, a 4° difference.
- These differences are at the limit of visibility.
- Proposed assessment: **reasonable**. visibleFlaws: "" (or "Tooth flanks taper slightly where Brown's are parallel; the left finger sits about 4° further right.") limits: "Square teeth are not conjugate, so the 10:12 ratio is prescribed with up to 0.04 rad play; finger lengths and the counterwheel finger angle are tuned for one blocking encounter per period; stop travel differs from the site's."

### 215 — no change (forced)
- Intersections: only the seated crescent/wheel contact at 0.0000.
- The pointed horns are the pickup/hand-off faces. The pin first meets the mouth there, and the crescent's lock ends there. `geneva-stop-215-contact.test.mjs` needs the pin or the crescent to hold a load face within 2.2e-5 through every handoff. Rounding the horns into Brown's ears removes those faces and leaves the wheel unsupported at pickup. Brown's shallow concaves use the same lock-radius-to-centre-distance ratio (≈0.5) as the model, so that apparent difference is only in how Brown drew it.
- Proposed assessment: **minor**. visibleFlaws and limits unchanged.

Files: `src/simulation/authored-intermittent-core.js` (`springTappetArmStarRatchet` spring curve only), `src/simulation/star-tappet-working-parts.js` (235-only helper), `src/data/source-presentation.js` (235 note).
Tests: `movement-235`, `star-tappet-working-parts`, `source-presentation` 14/14 pass; `generate-star-tappet-paths.mjs` output unchanged.

## Group C

### 67: gravity tumbler (`src/simulation/gravity-tumbler.js`)

- **Change.** Brown draws wheel B dotted behind tumbler E. E's plate is now translucent (opacity 0.72,
  no depth write, casts no shadow), so B's teeth and the worm read through E the way Brown's hidden
  lines do. The worm drive is no longer hidden while E swings round. Geometry and motion are unchanged.
- **Why not move the worm.** E turns once per worm-wheel turn in front of B, and its radius (≈2.4)
  is larger than the worm's distance from C (≈1.4). An opaque E must therefore hide the worm for about
  half of every turn. Brown shows only the pose where the mouth is over the worm.
- **Captures.** 8 phases before and after (`/dev/shm/m2/C/t67a.png`). The default view now matches
  the plate's B-dotted-behind-E reading.
- **Intersections.** Geometry is unchanged. The screen result is given below.
- **Proposed ledger text.**
  - (a) visual: "Default and 8-phase captures inspected beside the plate: E is translucent, so B
    and the worm read through it as Brown's dotted B, and the drive stays visible as E swings round."
  - (b) intersections: unchanged (see screen below).
  - (c) visibleFlaws: none. Limits: "Scalloped plate and generated 24-tooth worm; gravity/drag
    inferred."
- **Proposed assessment:** reasonable.

### 70: open-rim tappet (`src/simulation/open-rim-tappet.js`)

- **Finding.** The rim's inner face is already Brown's dotted circle. The measured ratio of that
  circle to the driver is 0.9142; the model's rimInner/rimOuter is 0.9142, which a test pins. The
  solid circle of C is the rim's exterior, as Brown's text requires. The "rim nearer C's edge"
  impression came from the rim band showing as a saturated band through a very thin (0.38) cover.
- **Change.** The cover opacity is raised from 0.38 to 0.72. The rim band now reads as a muted zone
  whose inner edge is the dotted circle, and tappet B and the studs still read through.
- **Captures.** 8 phases before and after (`/dev/shm/m2/C/t70b.png`).
- **Proposed ledger text.**
  - (a) visual: "Default and 8-phase captures inspected: C's cover is more opaque (0.72); the rim's
    inner edge sits on Brown's dotted circle (0.914 of C) and tappet B reads through."
  - (b) intersections: unchanged.
  - (c) visibleFlaws: none. Limits: "Short resisted pause and engagement impacts are idealized;
    stud spacing and tip adjusted slightly."
- **Proposed assessment:** reasonable.

### 76: jointed tappet (`src/simulation/jointed-tappet.js`) — no change

- The 17° bend at C and D at the rim's outer edge are the forced minimum found by lane u6. They
  tried the alternatives: a straight arm flings B past vertical; smaller overlaps give a
  near-singular, non-converging impact; a lower rest angle leaves the dog folded; 0.4 rad loses the
  count. None of these can be avoided without a rebake of a different mechanism. I found no
  alternative that keeps Brown's straight bar with a working count.
- Plate cropping of the partly drawn wheel matches Brown.
- **Proposed assessment:** minor (unchanged). Keep the existing visibleFlaws and limits.

### 84: selector rack (`selector-rack*.js`) — no change

- **Precise forced reason.**
  - Brown's pins (x = 802 and 1034 source px) sit either side of the slot bridge (864–944). They
    allow only −49…+77 px (≈2.4 pitches of 52.9 px in total), so the drawn fork permits about one
    step each way.
  - Whatever the fork width, the drawn slots (268 and 299 px long) cap the travel at about 242 px
    (≈4.6 pitches). No placement of the pins lets the cam reach all 13 teeth.
  - The current 1.5× fork already reaches that slot cap (−103…+139 px).
- **The trade-off.** A faithful fork halves the walk; the widened fork doubles it. The widened fork
  is kept.
- **Proposed limits text:** "Brown's drawn slots cap travel at ≈4.6 of the 13 tooth pitches, and his
  pin spacing beside the slot bridge at ≈2.4; fork A is widened 1.5× to reach the slot cap."
- **Proposed assessment:** minor. visibleFlaws: "Fork A is 1.5× wider than drawn; the rack walks two
  steps each way, so most teeth never meet the cam."

### Intersection screens (after; `show-body-intersections.mjs ID --spacing=0.01 --samples=129`)
- 67: no pairs (none → none; geometry unchanged). Proposed (b): sampled-clear, "Pass-52 screen: no pairs."
- 70: only zero-depth seated rim × stud0 (0.0000), same as before. sampled-clear.
- 76: section display caps vs clipped driver (0.050, 0.027, unchanged; not solid), dogStopPin/sector coaxial 0.0000. sampled-clear.
- 84: seated cam/tooth and pin/slot-end, 0.0000. sampled-clear.

## 181, 182 — diagonal-catch hand gear (baked)

- Changed (`src/simulation/mujoco-diagonal-catch/assembly.js`, rebaked with `scripts/bake-diagonal-catch.mjs`, unchanged input motion hash 186ae7de…): the dark tori over each back-weight arm end are removed. The hinge pins are slimmed from r 0.10 to r 0.06 and shown in light steel, so each rod eye reads as Brown's open ring round a small pin. The three fixed shaft heads are now light steel with 45° section hatching inside the dark boss rings, where before they read as black discs. Motion is unchanged. The regenerated files are `src/simulation/baked/assets/181.json.gz`, `baked/diagonal-catch-keys.js` (only the asset hash changed), `docs/validation/181-bake.json` and `docs/validation/181-baked-assembly-clearance.json` (37 meshes, 554 pairs, no intersections).
- Intersections (0.01, 129 samples): 0.0000 → 0.0000. Only the seated rod/eye and shoe/rod faces touch.
- Visual verdict: eyes and shafts now read like the plate. The finger and arm offsets remain. They are forced because plates 181 and 182 draw the same rigid catch with inconsistent finger and arm outlines, and one part cannot match both.
- Proposed ledger:
  (a) "Pass-51 m2 default and 8-phase captures inspected beside the plate: rod eyes are open rings on slim pins and the shafts are hatched sections in their bosses, as Brown draws them."
  (b) sampled-clear — "Pass-51 m2 screen on the rebaked assembly (0.01, 129 poses): 0.0000; baked-assembly clearance report regenerated (no intersections)."
  (c) assessment **reasonable**. visibleFlaws: "". limits: "Lower finger and upper arm sit about 20 px from each plate's outline because Brown's 181 and 182 draw the same catch inconsistently; one rigid part is a compromise between them."
- Note: `docs/validation/181-browser.json` still fingerprints the previous asset hash. It is a manual packaged-browser record, and I did not rerun it because that needs a dist build.

## 183, 184 — two-quadrant hand gear

- Changed (`src/simulation/quadrant-catch-finite-parts.js`): the hidden rear lip is intersected with the lower band's drawn outline. That trims its outer end corner, which poked about 5 source px out past the band's left end. The working inner face is unchanged. Rebaked `baked/quadrant-catch-motion.js` (maximum row change 0.0000 in all three columns; only the source hash changed) and regenerated `docs/validation/183-current-solids.json` (worst 0.00055 / 0.00053, seated).
- Intersections: 0.0005 (seated stud on lip) → 0.0005. No change.
- 184 phase search: 16 phases sampled. The top-of-stroke default (phase 0.5) already has the largest swings and is the closest pose. Plate 184 turns both handles about 82° from their plate-183 poses. It also draws the long ball-ended lever on the upper handle and the short hook on the lower, which is the opposite of 183. The solved gear's upper handle reaches only its 45° valve stop. Matching 184 would need different parts from 183, so the difference is forced by the plates.
- Proposed ledger 183:
  (a) "Pass-51 m2 default and 8-phase captures inspected: the lip no longer shows past the band's left end."
  (b) sampled-clear — "Pass-51 m2 screen: only seated contacts ≤0.0005."
  (c) assessment **reasonable**. visibleFlaws: "". limits: "Catches are hidden studs, lip and boss inside drawn outlines; a few px of the lip's working end can be seen through the band's window, where it physically lies; weights and friction not solved."
- Proposed ledger 184:
  (a) "Pass-51 m2 16-phase search: the top-of-stroke default is the closest pose to the plate."
  (b) sampled-clear — same note.
  (c) assessment **minor**. visibleFlaws: "Brown's 184 swings both handles about 80° further than 183 and swaps the ball lever and the hook between them; the model shows 183's parts at the top of the stroke, so the upper lever hangs about 25° low and hooked." limits: "Plates 183 and 184 cannot be the same rigid parts."

## 187 — two-handle gab disengager

- **Changes (`gab-disengager-187.js`):**
  - The cut rockshaft is now a light steel section with Brown's 45° hatching (ink strips just proud of its face). It was a solid black disc.
  - Brown's forked strap end is drawn: the two engraved lines along the broken-off left end of the eccentric rod and the inner break line. They are traced from mm_187 (y 233.5 and 246 px, curving out to the rod edges at x ≈ 100–111 px).
  - The motion law is unchanged.
- **Validation:** `docs/validation/186-187-cam-solids.json` was regenerated. Only 187's source hash and its mesh/pair counts changed (6→8 meshes, 11→19 pairs). It still reports no intersections.
- **Intersections:** none before and none after. The relative-motion screen (0.01 spacing, 129 samples) lists only the non-rendered camera-envelope guide.
- **Visual verdict:** reads as the plate: hatched shaft, forked rod end, crown and grips. The caption says only "modifications of 186", so the raised upper grip (the same action as 186's handle) is an inferred operation, not a contradiction of the text. Squeezing Brown's 32 px grip gap turns the handle only about 10°. A cam bearing on the pin gains at most 40 px of lift per radian (the pivot-to-pin distance), which gives about 7 px, not the 37 px the gab needs.
- **Proposed ledger:**
  - (a) Visual note: "Default and phase captures inspected beside the plate: hatched rockshaft section and forked rod end added; the upper grip is raised and its hidden cam lifts the gab."
  - (b) Intersections: sampled-clear, "Pass-51 m2 screen: none."
  - (c) Assessment: reasonable. visibleFlaws: "". Limits: "Operation is inferred (Brown's caption only says 'modification of 186'): the upper grip is raised like 186's handle, because squeezing Brown's 32 px grip gap turns it only ~10° and a cam on the pin can lift the gab at most ~7 px of its 37 px depth. The hidden cam is larger than Brown's dashed outline."

## 217 — grooved heart cam

- **Change (`heart-cam-217.js`):** the reconstructed lever about H and the fixed shaft H are no longer rendered. Brown draws the cam alone, so only stud A, named in the caption, rides the groove: a roller with a washer head and pin.
  - Its carrier frame still turns about H, so the stud follows the arc the plate-218 lever gives it.
  - Every position is still solved from the groove.
  - The camera now fits the cam alone.
- **Tests:** the source-presentation note and `tests/movement-217.test.mjs` were updated. The test now asserts that the lever and shaft H are not parts.
- **Intersections:** clear before and after (0.01 spacing, 129 samples).
- **Visual verdict:** matches the plate: the cam disc and symmetric double-walled heart groove, with the stud at e in the plate pose. Motion (8 phases): the stud runs in and out along the groove as the cam turns.
- **Proposed ledger:**
  - (a) Visual note: "Default and 8-phase captures inspected beside the plate: the cam is drawn alone as Brown draws it, with only stud A in its groove."
  - (b) Intersections: sampled-clear, "Pass-51 m2 screen: clear."
  - (c) Assessment: reasonable. visibleFlaws: "". Limits: "Stud A's carrier (the lever about H, drawn on plate 218) is an undrawn kinematic path; the backward/forward/dwell roller law is shown on 218, since 217 draws no catch or notch wheel."

## 218 — hinged catch and notch wheel

- **Changes (`authored-wool-comber.js`, `src/data/wool-comber-notch.js`, `scripts/generate-wool-comber-notch.mjs`):**
  - **Hook position:** G's hook now seats just inside F's rim (engaged radius 1.27 → 1.46 of rim 1.55; Brown's hook contact is at 1.03 rim radii). The hook radius is 0.085 → 0.065.
  - **Notches:** the regenerated relief notches are shallow. The depth is 0.157 (was 0.367) and the mouth is 0.167 wide, against Brown's roughly 0.1 × 0.125.
  - **Square root:** the generator now squares the root corner under the radial flank. That corner lies below the hook's flank contact, so the fit is unchanged. The oblique exit flank stays rounded, because squaring it loses the driving contact.
  - **Stale generator fixed:** the generator was calling the plate-217 factory, which no longer returns the transmission. It now uses `createWoolComberTransmission(217)` and reproduced the old file byte-for-byte before the change.
  - **Plate-218 layers:** catch G is stacked directly on the lever (layer 0.62–0.74 instead of about 1.0–1.1), so the lug pin into F is 0.56 long (was 0.94) and no longer shows as an oblique rod. The hinge pin sits on the lever through G's bore.
  - **Tongue:** the round wire "hook tongue" is hidden. Brown's lug is the flat end of G.
- **Tests:**
  - The negative-control notch in `tests/wool-comber-contact.test.mjs` is now a radial notch derived from the same seat (hook radius + milling clearance, same root). At the release pose it still penetrates by more than 0.017, while the relieved outline clears.
  - The plain-rim pass clearance pin moved from 0.028 to 0.02 in the 217/218 tests. The shallow notch lets the hook pass the notch corner at 0.021; it was 0.028. It is still ten times the 0.002 milling clearance.
  - `tests/movement-218.test.mjs` now asserts that the tongue is hidden.
- **Intersections:** clear before and after (0.01 spacing, 129 samples).
- **Visual verdict:** the notches now read as Brown's small step notches round the rim instead of deep keyway slots. G is Brown's arched bar with a flat end lug. There are still nine notches where Brown draws eight.
- **Proposed ledger:**
  - (a) Visual note: "Default and 8-phase captures inspected beside the plate: shallow rim notches, G stacked on the lever with a flat end lug."
  - (b) Intersections: sampled-clear, "Pass-51 m2 screen: clear."
  - (c) Assessment: minor. visibleFlaws: "Nine small notches where Brown draws eight; their exit flank is rounded." Limits: "The wheel advances a third of a turn per cycle, so the notch count must be a multiple of three; the oblique exit flank is the milled envelope of the hook's release arc. Cam projection touches the release boss at one instant."

