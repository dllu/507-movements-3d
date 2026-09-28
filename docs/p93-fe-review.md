# Pass 93, lane p93-fe: fixes for audit 341–425

- **Reviewer:** Claude Opus 5.5, lane p93-fe (parent) with forked sub-lanes A (396), B (350, 360, 392) and C (355, 356, 364, 411, 425).
- **Audit:** `docs/p93-audit-341-425.md`. Captures under `/dev/shm/p93/fe/` (parent `cap/`, sub-lanes `A/`, `B/`, `C/`). No git writes.
- **Claims (p93-fe):**
  - Factories: `authored-{slotted-traverses,gyroscopes,oscillating-drum-ratchets,orthogonal-roller-indexers,parallel-rulers,door-closers,gig-saws,reed-escapements,self-recording-levels,eccentric-rotary-engines,oscillating-engines,disk-engines,rolling-friction-experiments,hyperbola-drawing}.js`
  - Parts and bakes: `door-closer-working-parts.js`, `reed-396-contact.js`, `reed-396-working-parts.js`, `gyroscope-rings.js`, `gyroscope-working-parts.js`, `roller-indexer-grooves.js`
  - Shared: `source-presentation.js`, `rotation-indicators.js`, `steam-section-kit.js`, `display-profiles.json`
- **Shared-file edits:**
  - `source-presentation.js`: only the 350 and 385 entries were edited.
  - `rotation-indicators.js`: one 347 entry was added.
  - `display-profiles`: only 385 and 396 were re-measured, confirmed by diff.
  - `steam-section-kit.js`: a family-wide colour change only; no geometry changed.
- **Targeted tests:** 192/192 pass. They cover `movement-{344,345,347,350,355,356,360,364,367,373,385,392,396,411,418,421–425}`, door-closer, ruler-349-367, double-traverse, reed-396 working parts, rotation-indicator, authored-loader and steam-engine-working-solids.
- **Unrelated failure:** `source-presentation.test.mjs` fails on 151, from another lane's in-progress work.

## Parent lane p93-fe: 385 (medium), 367 (medium); lows 344, 345, 347, 373, 418/421–424

Captures are in `/dev/shm/p93/fe/cap/` (private vite on port 46411, `/dev/shm/p93/fe/shots.mjs`). `tile-<id>.png` puts the plate beside the after views. Before captures are the auditor's `/dev/shm/p93/e/{cap,tiles,z}`. Screens are in `/dev/shm/p93/fe/scr/` (`disc.json`, `cf.json`, `bi.json`, `bi2.json`, `seams.log`).

### 385 (medium): agree; undrawn door, wall and hinges removed
- **Change.**
  - Source presentation now also removes the wall, the door panel, the three hinge knuckles with their leaves, and the two square socket blocks.
  - Each pin turns in one plain bored bearing boss: the socket fixed to the frame, and the socket fixed to the door. Each boss is 0.55 tall (y 2.30–2.85, bore 0.089 on the 0.085 pin) and replaces the block-plus-ring stack.
  - The door-side boss still carries its pin round the hinge axis as the door opens. That is the only trace of the door, and it is how "pins are brought together".
  - The camera box is refitted to the presented parts only. Without that, the linkage sat in the top half of an empty frame. `display-profiles` 385 was re-measured (min y 0 → 2.30).
  - Presentation note rewritten.
- **Files:** `door-closer-working-parts.js` (boss), `authored-door-closers.js` (fit), `source-presentation.js` (385 entry), `display-profiles.json/.js` (385 only).
- **Captures:** `cap/tile-385.png` (plate, default, ±55°, phase 0.45 twice, behind), `cap/cmp385.png` (before and after, default).
- **Screens:** coincident 0; intersections 0; disconnected: no detached parts (only the bore-clearance leads, as before); seams 0.
- **Tests:** `movement-385` now asserts that the door, bracket, hinges, handle and trim are removed and that each pin stands inside its 0.55 boss. It passes with `door-closer-working-solids` (14/14).
- **Residual:** the door-side boss moves on an arc about an axis that is not drawn. The plate crops the pins, so this is the minimal support.
- **Proposed ledger row:** assessment reasonable, visibleFlaws "".
  - Limits, replace the p90 sentence with: "p93: no door, wall or hinges; each pin turns in one plain bearing boss (frame socket fixed, door socket orbiting the undrawn hinge axis)."

### 367 (medium): agree; graduated ivory
- **Change.**
  - The strip is ivory #d6c089 (was #e3d6b4, which rendered almost as paper).
  - The 11 calibrated graduations are visible again as dark bars inlaid in slots cut through the ivory face layer. Majors are 0.105 long and minors 0.07, rising from the reading edge the arc crosses. Their tops sit 0.004 below the ivory face, so nothing is coplanar.
  - The positions are still the arc-incidence calibration, so each tick marks a true blade gap.
- **File:** `authored-parallel-rulers.js`, inside `graduatedArcParallelRuler` only. 322 and 323 go through other functions and are unchanged.
- **Captures:** `cap/tile-367.png` (plate, default, −55°, phases 0.33 and 0.67, zoom), `cap/367-dz.png` (default crop).
- **Screens:** coincident 0 flagged; intersections 0; the "tick <> through-pin" near-miss is a proximity lead, not a joint.
- **Tests:** new `movement-367` test (ivory luminance < 0.6, every tick visible and sunk 0.003–0.006). `movement-367` (10) and `ruler-349-367-solids` pass.
- **Proposed ledger row:** assessment reasonable, visibleFlaws "". Limits, append: "p93: ivory tinted and 11 calibrated graduations inlaid."

### 344, 345 (low): agree; one crank plate
- **Plate check.** At P, Brown draws the rod's eye as a whole circle over the crank's end, with the rod lines stopping at it. The rod eye is therefore in front of a single crank plate. The p71 double web was a lane choice, not a user requirement.
- **Change.**
  - The front web and its shaft-centre boss are removed. The crank is one plate, 0.06–0.285.
  - The rod eye rides a plain pin 0.035 in front of the web. The pin stands 0.02 proud of the eye.
  - The shaft end shows 0.02 proud of the web and clears the rod by 0.018 when the rod crosses O at dead centre.
  - Both movements go through the shared builder, so the change applies to both.
- **File:** `authored-oscillating-engines.js`.
- **Captures:** `cap/tile-344.png`, `cap/tile-345.png` (plate, default, +55°, top, phases 0.33 and 0.67). 345 phase 0.33 shows the rod crossing the shaft end.
- **Screens:** intersections 0 (`bi2.json`, after the web move); coincident 0; disconnected: the "pin <> rod" and "crank <> rod" leads are the rod-eye bearing and the 0.035 web gap.
- **Tests:** the double-web tests are replaced by "one crank plate with the rod eye pinned on its face". `movement-344` and `movement-345` pass (18).
- **Proposed ledger rows:** unchanged assessment. Remove any double-web wording from limits and append: "p93: single crank plate; rod eye pinned on its face."

### 347 (low): agree
- **Change.** A `rotation-indicators` entry gives the solid flywheel the shared quadrant cue.
- **Captures:** `cap/347-R.png`, `cap/steam-cmp.png` (column 1).
- **Tests:** `rotation-indicator` and `movement-347` pass.

### 373 (low): partly agree
- **Change.** The dial face is ivory #e2d3a8, not paper white.
- **Not changed:** the pulley already has four curved arms (`four-curved-arm-web-of-drive-pulley`). The audit's "straight spokes" is the curved web seen small.
- **Tests:** `movement-373` passes.

### 418, 421, 422, 423, 424 (low): agree; shared steam tint
- **Change.** `STEAM_COLORS.live` in the shared `steam-section-kit.js` goes from #f7f4ee to #dcc9a6, a faint warm tint below luminance 0.85. Exhaust stays #c9d4d6.
  - This is a colour change only: no geometry changes.
  - The kit also colours 347, 425 and the other steam movements that use it (the rubber-lined, double-elliptical, radial-piston and eccentric-shaft radial-piston engines, and the Dickson reversible drive). It is one family-wide look, as the audit asked.
- **Captures:** `cap/steam-cmp.png`. Rows are before, after default and after +55°, for 347, 418, 421, 422, 423 and 424.
- **Tests:** `movement-418` and `movement-421` to `movement-424`, `steam-engine-working-solids`, and `steam-seams-p88-s` pass.

### Not done
- **405 (low): not changed.** The board is shared by 403, 405 and 406 through `drawing-board-parts.js`. Its face is deliberately page-toned, and p90 disputed this finding. Tinting only the edge would change 403 and 406 too. Left for a drawing-board family pass.
- **Not attempted:** the remaining lows (353, 356, 368, 381, 400, 402, 404, 409 and 420) belong to files outside this lane's claims and are not quick.
- **Unrelated failure:** `source-presentation.test.mjs` fails on **151** (`bearing-(?:post|foot)-.*` no longer matches a part). That is another lane's in-progress 151 work, not this lane's entries.

---

## 396 (medium): heavy escape wheel; balance size and spacing (sub-lane p93-fe/A)

**Verified:** yes. The plate draws a thin toothed rim, about one tooth deep, and three slender curved crossings. The model's rim was 0.30 deep and its arms were 0.32–0.56 wide, widening outward. On the plate the balance rim is 1.64 tooth-tip radii and staff b is 1.82 tip radii from staff a. The model had 1.13 and 1.36.

**Change**
- **Wheel.** The inner radius is 1.22→1.34, so the rim is 0.18 deep against a 0.20 tooth depth. Each crossing arm is an arc band tapering from 0.27 at the hub to 0.15 at the rim; they used to widen to 0.56. The hub is 0.32. It is still one extrusion with the rim. The locking face is now raked back 0.05 pitch, so only the tooth point touches, like Brown's thorn teeth.
- **Layout at Brown's proportions.** Staff b is at −3.14, which is 1.83 tip radii (the plate gives 1.82). The balance rim's outer radius is 2.80, which is 1.63 tip radii (plate 1.64), and it clears staff a's boss by 0.08. Pin orbit i is 0.59, so the fork still carries the lever bank to bank. Pallet j is on a 1.435 arm, now a straight bar the width of the pallet. The guard pin keeps its clearance from the fork centre. The banking pins are placed where the tail's flank rests on them at ±5°; there was a 0.003 gap. The camera bounds and the display profile (396 only) were re-measured.
- **Why p90 failed, and the new event assignment.**
  - With j on a long arm, its path crosses the tooth circle almost tangentially. On the swing where the old model gave j its impulse, j moves down while the left-side teeth move up. The old "direct impulse" was a glancing, nearly radial contact (minimum power 0.079), and it was impossible at plate spacing.
  - The roles now follow the direction of motion:
    - On the clockwise swing (half-beat 0), the lower pallet g unlocks and the tooth drives it. That is the lever impulse through C, e and i, and upper detent f catches.
    - On the anticlockwise swing, f unlocks and the released tooth's locking face overtakes j as it rises across the line of centres. It drives j directly (minimum power 4.5, 57× the old value), then g catches.
    - On the clockwise swing, j passes back through the gap in front of the tooth locked on g.
  - The tooth phase fixes the lock points modulo the pitch: f at +38° and g at −37° on the tip circle, so the anchor is a "⊐" bracket like the plate's. The free-drop speed is 0.5→6 rad/s, so a released tooth can catch j.
- **Pallets.**
  - Each locking face is the exact arc about staff c through the locked tooth point, sampled at 240 chords (g) or 480 chords (f) with a sagitta under 2e-8. A resting tooth therefore neither recoils nor creeps as the lever turns.
  - g adds a straight impulse face that carries the tooth 4° while the lever moves from −2.3° to −0.5°.
  - The rendered anchor is the union of these outlines plus arms to the bar through c. It is still one plate in the wheel plane, with no pins or protrusions.
- **Bake.** It was regenerated: 4919 knots, one tooth per cycle, and `--check` passes. The generator finds g's exact rest angle and runs at a 2e-8 recoil tolerance. Contact pieces are culled by bounding circles.
- **Playback.** Impulses need contact at both ends of an interval, which excludes landing intervals, and a wheel speed above 1e-3 rad/s, which excludes lock-arc creep. The step reference is the baked rest angle.
- **Files:** `src/simulation/reed-396-contact.js`, `reed-396-working-parts.js`, `authored-reed-escapements.js`, `baked/reed-396-contact.js`, `scripts/generate-reed-396-contact.mjs` and `src/data/display-profiles.{json,js}` (396 entry only; checked by diff).

**Captures** (`/dev/shm/p93/fe/A/`)
- `before/396-*.png` and `after/396-*.png`: views d, L, R, T and B, phases p1–p4, and zoom zw.
- `after/tile-396.png` puts the plate beside all views.
- `after/cmp-396.png` shows the plate, before and after.
- `z/contacts.png` shows the j push at phases 0.784–0.798 and g's lock and impulse. `z/zooms.png` shows the anchor, j and the fork.
- The layout search harness is in `search/`.

**Tests**
- movement-396 and reed-396-working-parts: 17/17 pass. That includes a new proportions test: staff spacing and rim against the plate within 3%, rim clear of staff a, wheel rim no deeper than a tooth, and crossing arms under 0.3.
- Test tolerances changed, each with a stated reason:
  - The half-pitch step is 1e-8, because f's arc is chord-sampled.
  - The knot step bound is the free-drop speed × knot spacing (0.0059 rad).
  - The lock radius is 3e-16.
- The rendered-solid clearance minimum is −1.9e-7.
- camera-catalog passes. source-presentation stops at 151, which is another lane's.

**Screens**
- Body intersections: worst 1.2e-7, which is contact.
- Coincident faces: 0 flagged.
- Loop seams: 0.
- Disconnected parts: the same two pre-existing leads as the audit. One is a banking-pin "short-of-pin", which was dismissed: the lever now rests exactly on the pin at each bank, with a sampled gap of 0.007 at the pin's surface-sample spacing. The other is the free balance staff, whose bosses are removed by presentation.

**Proposed ledger row**
- **assessment:** minor. p91's recolours still stand, and the remaining limits are reconstruction choices, not visible defects. It could be argued as reasonable.
- **visibleFlaws:** "" (clear the balance-size flaw).
- **limits:** replace the p90 sentence "The plate's balance spacing is blocked…" with:

  > p93: Brown's proportions (staff b 1.83 tip radii from a, rim 1.63), thin rim and slender crossings; half-beat roles reassigned so the tooth drives g on the clockwise swing and j directly on the return (j's arm 1.435 long); locking faces are exact arcs about staff c; free drop 6 rad/s (the tooth snaps about 10° in 0.03 s); f can still receive work during withdrawal; balance motion prescribed.

---

# p93-fe/B evidence: 350, 360, 392

Scratch: `/dev/shm/p93/fe/B/` (server port 46422). Before captures for 360 and 392 are the audit's `/dev/shm/p93/e/z/360-r.png`, `392-w.png` and `392-w2.png`. Before captures for 350 are `cap/350-{d,L,B,T}-before.png` (`cap/350-grid-before.png`). The after tiles, with the plate beside d, L, R, B, T, p0.33 and p0.67, are `cap/tile-{350,360,392}.png`.

Files edited:
- `src/simulation/authored-slotted-traverses.js`
- `src/simulation/authored-oscillating-drum-ratchets.js`
- `src/simulation/authored-gig-saws.js`
- `src/data/source-presentation.js`: the 350 entry only. Every other entry is byte-identical; the diff touches lines 519–520 only.
- `tests/double-traverse-groove-solids.test.mjs`: the 350 test only.
- `tests/movement-360.test.mjs` and `tests/movement-392.test.mjs`: one new test each.

## 350: pin D carried on a plain slide rod
- **Verified.** Brown moves D "in the direction of the horizontal dotted line". Its drive was removed (base, shoe, rails and dashes) as undrawn, so D translated in empty air, 0.39 below the rail.
- **The auditor's first suggestion is wrong.** A lug hanging from the rail's end would move D with the bar, but D travels 4.5 times the bar's stroke. The dashed triangle on the plate is the lever's displaced position, not a carrier.
- **Fix.**
  - One plain round rod (r 0.06) is laid along Brown's dotted line, behind the lever (z −0.08) and below guides a, a.
  - D's shoe is one bored extrusion (0.34 × 0.22 × 0.32, bore clearance 0.006) sliding on the rod.
  - Pin D is shortened to stand from 0.10 inside the shoe's front face and stays clear of the rod.
  - The shoe and rod are no longer in the source-presentation removal list, and the note is updated. The dashes, base, O's rear support and the indices stay removed.
  - The rod is excluded from the camera fit (`beyondPlateCrop`), so the default framing is unchanged.
- **Captures:** `cap/tile-350.png`, `cap/350-d.png`, `cap/350-z.png` (pin on shoe on rod) and `z/350-rodrow.png` (rod end).
- **Screens.**
  - Disconnection: D is now one component (rod, shoe and pin) joined to the lever by the slot's 0.016 bore clearance, the same class as O. 0 floating.
  - Coincident faces: 0.
  - Intersections: worst solid 0.
  - Seams: clean.
- **Tests:** movement-350 8/8, double-traverse-groove-solids 5/5 (the 350 test now asserts the rod runs through the shoe over the stroke and pin D is seated in the shoe clear of the rod), analytic-linkage-joints 2/2, and the source-presentation check for 350/360/392 passes.
- **Ledger:** assessment reasonable; visibleFlaws "".
  - Limits (append): "p93: D rides in a bored shoe on one plain round rod laid along Brown's dotted input line (an ideal fixed guide with free ends, like O's bearing); it is the minimal carrier for the driven pin."

## 360: pawl eye seated on a drum boss
- **Verified.** Brown pivots the pawl on the drum's face, well inside the cord band. The model's drum is open inside r 0.47, and its rim bore is r 0.59. The pawl's eye (r 0.0575 at r 0.53) floated 0.105 in front of the thin annulus, on its inner edge.
- **Fix.**
  - One round boss (r 0.10), concentric with the pawl pin, is clipped to the rim bore (r 0.595) and merged into the drum body and rim.
  - It is a child of the loose drum, spanning z 0.31–0.575 with its back buried in the drum body. The pawl lies 0.01 in front of its face.
  - It clears the ratchet tips by 0.04.
- **Captures:** `z/360-row.png` (front and two obliques) and `cap/tile-360.png`.
- **Screens.**
  - Coincident faces: 0.
  - Intersections: worst solid 0. The new pin-in-boss coaxial pair (0.077) is the same fixed-pin-in-drum class as the existing pin-in-drum-body pair (0.06).
  - Disconnection: 0 detached. A new "short-of-pin" near miss between the ratchet and boss (0.0585) is only running clearance.
  - Seams: the known pawl-drop snap (0.87%, documented).
- **Tests:** movement-360 10/10, including a new test that the boss is rigid with the drum, the pawl sits 0.005–0.02 in front of it at 49 phases, the pin passes through it, and the eye stays inside the rim bore.
- **Ledger:** assessment stays minor; visibleFlaws unchanged ("The pawl drops from each crest in one frame.").
  - Limits (append): "p93: the pawl pivots on a round boss on the drum, concentric with its pin, so its eye sits wholly on metal as drawn."

## 392: round lug under the lower crosshead
- **Verified.** The plate draws a round lug below the lower block, carrying the rod's upper pin. The model's pin was centred on the block's bottom edge.
- **Fix.**
  - The lower block is now one extrusion: the rectangle united with a circle (r 0.18) centred on the wrist pin.
  - r 0.18 is the largest radius that keeps 0.015 above the flywheel rim at bottom stroke. At r 0.22 the lug would strike the rim.
  - The rod's eye (r 0.185) sits wholly on the lug. From the front the lug is almost covered by the eye; it shows in oblique views.
- **Captures:** `z/392-row.png` (front, oblique and mid-phase), `z/392-row2.png` (rod hidden, showing the lug, and from below) and `cap/tile-392.png`.
- **Screens:** coincident faces 0; intersections 0; disconnection 0 detached (the rod–block pair is bore clearance); seams clean.
- **Tests:** movement-392 10/10, including a new test that the block reaches one lug radius below the pin centre, the lug is wider than the pin, and it clears the rim at bottom stroke.
- **Ledger:** assessment reasonable; visibleFlaws "".
  - Limits (append): "p93: the lower wrist pin rides in a round lug (r 0.18) extruded with the lower block and centred on the pin, as drawn."

## Other notes
- No validation reports or bakes fingerprint these files. `display-profiles` 350 `motionBounds` predate the fixed rod. Only display timing uses them, and the rates are unchanged.
- The full `source-presentation.test.mjs` currently fails at 151 because of another lane's in-progress edit, not these changes. Earlier, a transient syntax error in `authored-helical-current-rotors.js` (another lane's edit) also blocked it.

---

# p93-fe/C evidence: 355, 356, 364, 411, 425

Captures are in /dev/shm/p93/fe/C/. `tiles/{before,after}-ID.png` show the plate beside the d/L/R/T/p1/p2 views. Zooms are in `z/`. Screens are in `scr/`.

## 355: gyroscope, ring A
- **Plate check.** Ring A is a broad flat band. At its left and right extremes, its two edges are about 15–18 px apart, about 0.2 units. The old bake was 0.10 wide radially and 0.12 deep, so it read as a wire.
- **Fix.** In `scripts/generate-gyroscope-rings.py`, `support355` is now `ring(1.8263, .2075, .07)`.
  - The inner edge stays at 1.72255, so disk C's rim at 1.69 keeps its clearance.
  - The band runs out to 1.93 and is 0.07 deep.
  - Only `support355` was rebaked in `src/simulation/generated/gyroscope-rings.js`. The 356 rings hash identical: outer 70fba5be0533, middle cde92d5cd3dd, inner 0a6f01e6f01d.
  - The script needs manifold3d==3.5.3, which is in a scratch venv at /dev/shm/p93/fe/C/venv.
- **Camera: disagree, forced.** Over 64 phases of the precession, the default view's projected extent already reaches |NDC x| = 0.911. The vertical extent is −0.55 to 0.59. The camera centres on pillar G, which is the precession axis.
  - Targeting the ring centre at 1.6× would crop disk C and ring A out of frame for about half of every precession.
  - The view looks small and off-centre at phase 0 only because the ring sweeps a 4.3-radius circle about the pillar. The camera is unchanged.
- **Captures:** `tiles/after-355.png`. The band is visible in the T and R views.
- **Tests:** movement-355, which gains a band test (width > 0.2, depth < 0.08, clear of disk C). Also gyroscope-working-interfaces.
- **Screens:** body intersections, worst solid 0. Coincident faces 0. Disconnected 0.
- **Proposed row:**
  - assessment: minor
  - visibleFlaws: "Default view is framed on the full precession sweep, so at phase 0 the ring sits right of centre and small."
  - limits, append: "p93: ring A rebaked as Brown's broad flat band (0.21 × 0.07). Framing kept on the whole precession sweep (|NDC x| 0.91), since a ring-centred 1.6× view would crop the rotor for half of each precession."

## 356: Bohnenberger pedestal (low finding)
- **Fix.** In `gyroscope-working-parts.js`, 356 branch:
  - The foot, the upper tier and the neck are replaced by one lathed trumpet pedestal. It has a foot of radius 1.0, a concave quadratic flare to a 0.33 waist, and a collar of radius 0.43 under the bearing post. The radii come from the plate's rows at 0.0135 per px.
  - The tier and neck meshes are removed.
  - The role is now `fixed-turned-trumpet-pedestal-of-Bohnenberger-machine`.
- **Captures:** `z/356-after.png` (plate, default, left, pedestal zoom) and `tiles/after-356.png`.
- **Tests:** in movement-356, the mesh count is now 21 (was 23), and there is a new lathe/flare assertion.
- **Screens:** clean (0 intersections, 0 coincident, 0 detached).
- **Seen but not fixed:** ring A in 356 is also drawn as a broad flat band in the plate.
- **Proposed limits, append:** "p93: pedestal is one turned trumpet (foot, flare, waist, collar) in place of stacked discs."

## 364: roller sleeves
- **Fix.** In `authored-orthogonal-roller-indexers.js`, each stud is now one turned pin.
  - Its shank (r 0.052) runs through the roller bore (0.055) and ends in a head of r 0.064. The head sits 0.004 clear of the roller's outer end and runs to 0.066 past it.
  - This closes the sleeve and retains the roller, matching Brown's capped rollers.
  - The head is creased-normal lathe geometry.
- **Groove bake.** The head first dipped 0.064 into the groove floor (body screen).
  - `scripts/generate-roller-indexer-grooves.mjs` now sweeps the head with the roller, and `src/simulation/baked/roller-indexer-grooves.js` was rebaked. The grooves are up to 0.068 deeper at the floor.
  - After this, the body screen's worst solid is 0.
- **Captures:** `z/364-cmp.png` (before the longer head), `z/364-cmp2.png` (closed heads) and `tiles/after-364.png`.
- **Tests:** movement-364 gains a stud/head test. roller-indexer-finite-envelope and groove-drive-working-solids pass.
- **Screens:** body 0, coincident 0, detached 0.
- **Residual:** the head relief shows as a narrow secondary step in the groove floor (`z/364-cmp3.png`), where Brown draws single groove lines.
- **Proposed row:**
  - assessment: minor
  - visibleFlaws: ""
  - limits, append: "p93: roller studs end in retaining heads that close the sleeves; the groove sweep includes the head, which leaves a slight relief step in the groove floors."

## 411: recording drum
- **Plate check.** Brown's drum carries dense lines round it, about 25 across its length.
- **Fix.** In `authored-self-recording-levels.js`, the paper is tinted #d2c6a5, which is warm and off-white.
- **Ruling.** It uses a 1024×1 DataTexture with 25 section lines (every fifth heavier) round the drum and plain margins.
  - The texture is mapped by an axial UV computed on the paper face only; the end faces and the bore sample the margin.
  - It adds no extra meshes, so nothing can z-fight.
  - The old LineLoop ruling stays removed by source-presentation.
- **Rotation cue.** The existing quadrant cue (rotation-indicators.js) is unchanged and still visible. The rings themselves are rotationally symmetric.
- **Captures:** `z/411-cmp.png` (ruled drum, front and oblique) and `tiles/after-411.png`.
- **Tests:** movement-411 gains a test for luminance < 0.85, the ruling texture and UVs.
- **Screens:** white screen, 0 hits on the drum. Its only hits across the five IDs are fluid (425 steam). Body 0; coincident 0.
- **Proposed row:**
  - assessment: reasonable
  - visibleFlaws: ""
  - limits, append: "p93: drum paper off-white with Brown's section ruling as a surface texture."

## 425: steam facets
- **Root cause.** The load-time `creaseNormalsIn` → `smoothFacetNormals` in `crease-normals.js` replaced the steam volumes' DynamicDraw normal attribute with a new static one computed at phase 0.
  - `setRegion` kept writing its old array, so later frames drew stale, tilted normals. Those showed as big fan triangles.
  - In the browser, 1152 of the cap vertex normals were tilted at phase 0.33 (`z/425-cmp3.png`, normal-material view).
- **Fix.** It was already made in the working tree by another lane, not by me: `crease-normals.js` now skips DynamicDraw geometry and writes in place. The steam geometry itself was sound (cap triangle |area| sum equals the polygon area, so there is no overlap).
  - After a server restart, the caps are uniform (`z/425-cmp4.png`, `tiles/after-425.png`).
  - No edit to `authored-eccentric-rotary-engines.js` was needed.
- **Tests:** movement-425 gains a regression test. It applies `creaseNormalsIn`, updates to phase 0.33, and checks that every cap normal has |z| > 0.999. The steam tests pass.
- **Screens:**
  - check-loop-seams: the 9.5% steam visibility pop at phase 0.5 (dead point) pre-exists.
  - The body screen hit a 4 GB heap out-of-memory on 425. The factory is unchanged and the coincident-face and disconnected-part screens are clean.
- **Proposed row:**
  - assessment: reasonable
  - visibleFlaws: ""
  - limits, append: "p93: steam caps shade flat (load-time normal smoothing no longer replaces dynamic steam normals)."

## Files touched
- src/simulation/generated/gyroscope-rings.js
- src/simulation/gyroscope-working-parts.js
- src/simulation/authored-orthogonal-roller-indexers.js
- src/simulation/baked/roller-indexer-grooves.js
- src/simulation/authored-self-recording-levels.js
- scripts/generate-gyroscope-rings.py
- scripts/generate-roller-indexer-grooves.mjs
- tests/movement-355.test.mjs, tests/movement-356.test.mjs, tests/movement-364.test.mjs, tests/movement-411.test.mjs and tests/movement-425.test.mjs

`authored-gyroscopes.js` and `authored-eccentric-rotary-engines.js` are unchanged. No source-presentation or rotation-indicators entries were changed.

## Claims
In /dev/shm/p93/claims, I made new claims for `gyroscope-working-parts.js`, `gyroscope-rings.js` and `roller-indexer-grooves.js`.
