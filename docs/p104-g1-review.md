# Pass 104, fix lane g1: stub shadows, 211's relief, 213, 221/222, 225 and the lows in the same files

Lane p104-g1 (Claude Opus 5.5), 2026-09-29. The working tree is HEAD `ad638ba` plus the other p104 lanes' uncommitted work. Vite ran on :46091. No git writes were made. The audit is `docs/p104-audit-171-255.md`. Captures are outside Git, under `/dev/shm/p104/g1/`:
- `NNN/tile.png`: the plate plus 8 views (default; phases .33 and .66; left; right; top; back; below).
- `ba/NNN.png`: the audit's default view (left) beside the new one (right).
- The zooms are named below.

## Files claimed

- `authored-gears-core.js`, `authored-intermittent-core.js` and `authored-elliptical-idler-gears.js`.
- These helpers, each used only by movements in the files above:
  - `mangle-rack-working-parts.js` (197/198)
  - `feed-worm-assembly-parts.js` (195/207)
  - `opposed-spur-239-working-parts.js`
  - `carrier-pawl-225-working-parts.js`
  - `variable-idler-gear-parts.js` (221/222)
  - `variable-drive-205-209-parts.js` (205/208/209)

**Unchanged movements, byte for byte:** every other movement built by the three factories is unchanged. The world-space vertex, transform, visibility and colour hash at t = 0.37 is identical between this tree and a copy with HEAD's versions of the nine files (`/dev/shm/p104/g1/hash-{new,head}.txt`). The 66 movements hashed are 24–26, 28–46, 63, 71, 73, 82, 83, 113–123, 125, 133, 139, 142, 155, 191–196, 198, 200, 202, 204–206, 212, 214–216, 226, 232, 233, 235–237 and 241.

## Stub-shadow policy used

Every shaft or arbor stub that stood well proud of its hub now ends 0.02–0.03 past the part it carries. Every part still casts shadows; nothing was tagged `noShadow`. This is the p101 treatment of 212, applied across the family.

## 199 (medium): the shadow of the lantern-pinion shaft read as a painted crank

- **Shafts:**
  - The pinion shaft now runs from the rear bearing (−0.60) to 0.03 past the front hub (0.32). It was −0.80…0.72.
  - The four guide-roller axles are now short heads, −0.215…0.185, just past the roller faces. They were −0.505…0.355 (this fixes the low).
- **Rails (low):** the two ink-black running strips were proud of the rack frame's front face and read as a black rim line along each rail. They are hidden; the rollers run on the frame's own edge.
- **Captures:** `199/tile.png`, `ba/199.png`. The shadow bar is gone from every view.
- **Tests:** `movement-199` passes 5/5. The depth envelope (z > 0.95, −0.59 / 0.31) and the visible-mesh floor (27) are updated.

## 208 (medium): the output shaft's shadow band and the hub-stub "claw"

- **Hub and input shaft:** the pin-wheel hub is now 0.30 long (±0.15, 0.06 proud of each face); it was 0.56 (−0.23…0.33). The input shaft ends 0.03 past it (±0.18); it was −0.98…0.52. This removes the claw blob, and from behind only a short stub shows.
- **Output shaft: not changed, and why.** The shaft runs 1.4 in front of the disc because it is the pinion's axis, and the pinion's teeth reach the pins. It is a real, fully visible shaft between Brown's end bearings, so it cannot be trimmed. The brief forbids disabling shadows on visible parts. Its band along the bottom of the face, and the half-shadowed pin row, are therefore its true shadow in the fixed key light. That stays as a residual; the lead should decide whether this one shaft may take `noShadow`.
- **Captures:** `208/tile.png`, `ba/208.png`.
- **Tests:** `movement-208` and `variable-drive-205-209-solids` pass.

## 210 (medium): the cam shaft's wedge shadow

- **Change:** Brown draws only the cut (hatched) shaft in the cam's boss. The stub is now the cam's depth plus 0.06 (±0.18); it was ±0.775. The wedge across the cam is gone.
- **Captures:** `210/tile.png`, `ba/210.png`.
- **Tests:** `movement-210` passes. The swept depth is z > 0.8 (it was 1.5, set by the old stub).

## 197, 201, 207, 209, 240 (lows): stub shadows

The same trim was applied in each:

| ID | Stub | Now | Was |
|---|---|---|---|
| 197 | pinion shaft | ends 0.02 past the guide-following collar (0.565) | 0.62 |
| 201 | input shaft | 0.03 past the eccentric gear (0.51) | 0.79 |
| 201 | carried shaft | 0.03 past the pinion hub (0.57) | 0.695 |
| 207 | both wheel shafts | ±0.38 | ±0.49 |
| 209 | both shafts | driver ±0.295; driven −0.295…0.37 (past the horn) | ±0.775 |
| 240 | shared shaft (seen in its default view; not in the audit) | 0.063…0.577 | −0.24…0.86 |

**Captures:** `ba/197.png`, `ba/201.png`, `ba/207.png`, `ba/209.png`, `ba/240.png`.

**Also fixed in these movements:**
- **201's belt (low).** It is now the shared flat band (width 0.20, thickness 0.024, no markers, as on the 1–23 belts), centred on the 0.28-wide pulley faces, in place of the laid round cord. Capture: `zE.png`. `movement-201` asserts a flat cross-section.
- **209's horns (low).** They no longer taper to needles. The band outside the pin's swept path keeps at least 0.058 to its ends, so each horn ends in the band's round end arc. The tip corner is 60° (it was 40° on a 0.018-wide sliver). The working (pin-side) face is unchanged. Two earlier attempts both failed "engaged pin bears on a horn" (gap 0.0129–0.0131 > 0.0125) and were dropped:
  - trimming each tip back to a semicircular cap;
  - a tangent disc.
  - Captures: `zD.png`, `hornplot.png`.
  - `movement-209` passes 6/6, including the fork-catch test (gap > 0.011, and < 0.0125 while engaged).

**Framing (not changed):** 197's framing (25–30%) and 209's framing (40%) are left, because each camera already fits the full stroke envelope.

## 211 (medium): the wavy, stepped relief after the last tooth

- **Before:** the relief between the plain locking rim and the last root space was the raw swept envelope of the pinion tips. It was a scalloped band from 8.886 to 8.906 (construction units), entered by a sampled step.
- **Change:** it is now:
  - one arc concentric with the wheel at the tooth-tip radius (8.876, the same circle as every tooth crest);
  - entered from the plain rim by a single smoothstep ramp, 9° wide and tangent to both arcs.

  The ramp starts at the latest angle at which it stays inside the swept envelope, so every clearance is kept or grown (only material is removed). The flank into the last root space is unchanged.
- **Ramp width:** a 12° ramp cut the plain locking rim below the test's 97%-of-dwell floor; 9° passes, with a visibly gentler shoulder than 6°.
- **Root floors:** each root floor was also the tip envelope, with 0.004 steps. It is now one arc at its run's lowest radius (material only). The faceting screen's `zigzag-outline` flag on the wheel is cleared: 30 zigzags went to 0, and the score went from 18.99 to 16.12, leaving only the hub ring's normal 10° facets.
- **Stubs (low):** the input shaft is ±0.27 (0.03 past the hub ring). The output shaft is −0.27…0.345 (0.03 past the guide's eye). Both were ±0.55.
- **Evidence:**
  - Polar samples of the rendered outline: the band is 2.0415 (model units) from 46.8° to 64.7°, where the tooth crests are also 2.0415 (`polar211.mjs`). The ramp runs from 35° to 46°.
  - Captures: `zC.png` (default and oblique zooms on the relief, and phase 0.5), `211/tile.png`.
- **Tests:** `movement-211` passes. The swept depth is z > 0.6.

## 213 (medium): the arbor and stud shadows read as clock hands

- **Change:**
  - The winding arbor runs from −0.39 to 0.14 (0.02 past the square's front face, 0.03 behind its back). It was −0.94…0.78.
  - The ring's centre stud runs from −0.03 to 0.26 (0.02 proud of the drum face). It was −0.73…0.69.
  - Brown draws only the hole in the square boss and the small hole in the drum.
- **Capture:** `ba/213.png`. Both hand-shaped shadows are gone.
- **Tests:** `movement-213` and `split-rim-213-contact` pass. The swept depth is z > 0.85.
- **Deferred (low):** widening the ring's six gaps to Brown's 1:1. The ring outline is the baked `split-rim-213` contact outline, so widening the gaps means re-baking it and re-checking the pin pickup.

## 221 (medium): pinion B was invisible against wheel B

- **Change:** the 15-tooth pinion B is now ochre (`PALETTE.accent`). It meshes with the orange elliptical C in front of the blue 32-tooth wheel B, so all three read apart. A stays blue; its mesh with wheel B reads by the teeth.
- **Captures:** `221/tile.png`, `zB.png` (4th panel), `ba/221.png`.
- **Tests:** `movement-221` and `variable-idler-solids` pass once the 221-222-223 report is regenerated.

## 222 (medium): link A–B stood 0.6 off A on a bare shaft

- **Change:**
  - **Links:** both drop 0.12:
    - C–B is at 0.215…0.305. It clears C's link boss (0.203) by 0.012; it was 0.185 off C's face.
    - A–B is at 0.315…0.405.
  - **A's boss:** A carries a boss in its own metal (r 0.30, bored for the shaft) from its hub (−0.12) to 0.005 behind the link's eye. The link now sits on A instead of on a bare shaft, as done for 232.
  - **Pins and shafts:**
    - The pin at C's centre runs from its boss to 0.02 past the C–B link (it ran to 0.575).
    - The A and B shafts end 0.03 past the A–B link (0.435). They ran to 0.625 and 0.605.
- **Checks:** the pin at C never passes under link A–B in plan. Its minimum distance to the A–B axis over 720 poses is 3.0 (`chk222.mjs`). The boss (r 0.3) is 1.57 or more from C's sweep and from B's teeth.
- **Captures:** `222/tile.png`, `zA.png` (panels 3 and 4), `ba/222.png`.
- **Tests:** `movement-222` passes. The overall depth is z > 1.15 (it was 1.3).

## 225 (low): the pawl eye sat 0.1 behind the carrier's eye on a bare pin

- **Change:**
  - **Carrier:** it moves back to 0.30…0.44, 0.005 in front of the pawl's eye (front 0.295), as Brown draws them flush. Now that they touch, the carrier would merge into the same-orange pawl, so it takes the ochre accent.
  - **Floor lug:** the lug runs forward to 0.295, 0.005 behind the carrier's lower eye (it was 0.18).
  - **Pins:** the hinge pin is now 0.135…0.47 and the floor pin −0.15…0.47. They were 0.08…0.60 and −0.05…0.65.
  - **Motion:** the baked return motion is keyed on planar geometry only and is unaffected.
- **Capture:** `zB.png` (panels 1 and 2).
- **Tests:** `carrier-pawl-225-contact` (the gap assert is now 0.004 < gap < 0.006; it was > 0.0949) and `movement-225` pass.

## 239 (low): the hub read only as a crescent shadow

- **Change:**
  - The hub boss takes a darker shade (×0.68) of the wheel metal, as on 212/235/241.
  - The arbor ends 0.03 past the hub (0.328); it ran to 0.445.
- **Capture:** `zB.png` (3rd panel).
- **Tests:** `movement-239` and `opposed-spur-239-contact` pass.

## 240 (low): tooth count, kept at 18 as a forced residual

- **Plate:** the tip spacing is about 18°, which suggests 20 teeth.
- **Trial:** I rebuilt the wheel with `toothCount = 20` and ran `movement-240` and `ratchet-stop-240-working-parts`. Ten of 15 tests failed:
  - stop C interpenetrates the wheel by 0.07;
  - C's top edge spans three tooth spaces instead of Brown's two;
  - the spring stop no longer rides the teeth.
- **Why it stays:** the three stop outlines and their offline free-run/drop paths are all cut to the 20° pitch. Going to 20 teeth means re-deriving all three stops.
- **Result:** reverted. 18 is recorded as forced.

## 027 (low, other lane's ID, in `authored-gears-core.js`): the drum read as a black disc from behind

- **Change:** the drum disc keeps the dark tone only on its front face (the recessed pocket and groove floors). Its rim and back face take the frames' blue.
- **Capture:** `ba/027-back.png`, `027/tile.png`.
- **Not done:** Brown's domed hub with its knob. The carrier's rollers pass within about 0.18 of the wheel centre at groove depth (they reach z 0.346), so a dome of 0.2 R above the web junction would cut through them.

## Not done

**Other lanes' IDs whose code lives in my files:**
- **032:** the rim band.
- **038:** the stepped-sector flank.
- **046:** the chain anchors.
- **226:** D's strap/stud keeper. It needs a keeper on frame A spanning D's face; no inferred geometry was added.

**Files not mine:**
- **116:** production is `mujoco-rack-rectifier/visual.js`, and the claim key `visual.js` is ambiguous.
- **203:** `authored-linkages.js`.
- **227 and 242:** `authored-belts.js`.
- **234 and 238:** `authored-escapements.js`.
- **104:** `authored-screws.js`.
- **149:** `authored-cam-arrays.js`.
- **117, 118, 123, 125 and 142:** these run from MuJoCo/baked modules in production, not from `authored-gears-core.js`.

## Screens

The screens were run over 27, 197, 199, 201, 207–211, 213, 221, 222, 225, 239 and 240 (`/dev/shm/p104/g1/{disc,cf}.json`).

**Coincident faces:**
- 197 (5 pairs) and 208 (1 pair): these are pinion/hub and disc/hub bores that share the shaft bore radius, hidden inside the bore by the shaft. The audit also found them.
- Every other movement: 0.

**Disconnected parts:**
- No new short-of-pin joints, open ends, slivers or lips.
- 208's output shaft and selector collar screen as a floating group, 0.80 from the pin wheel. That shaft is untouched: its undrawn bearings were hidden before this pass, and the screen now takes the pin wheel, not the pinion web, as the largest component. It is carried by the pinion web.
- 210's guides (0.025), 211's pinion group (0.019) and 213's stud (0.03) are the running clearances the audit already recorded.

## Validation reports regenerated

The pose counts are unchanged. No report with a `sourceCommit` field was touched.

| Report | Poses | Method | Result |
|---|---|---|---|
| `200-226-bevel-solids.json` | 33 | `review-200-226-bevel-solids.mjs` | 0 penetrations |
| `202-264-worm-solids.json` | 33 | `review-special-worm-solids.mjs` | |
| `191-196-201-contact.json` | 513 | `review-irregular-gear-contact.mjs` + `.py` | 0 overlap. 201's minimum gap is 0.00071 |
| `205-208-209-contact.json` | 513 planar; 167 pin-slot | export, `.py`, `review-208-pin-slots` and save scripts | 205 and 209: 0 overlap |
| `221-222-223-contact.json` | | `export-variable-idler-contact.mjs` + `.py` | |
| `feed-worm-195-working-faces.json` and `feed-worm-207-working-faces.json` | 17 each | `review-feed-worm-working-faces.mjs` | |
| `feed-worm-195-solids.json` | 17 | `review-feed-face-worm-solids.mjs`, POSES=17 | |

## Tests

After the report regeneration, 359 of 359 tests pass in these suites, together with `bevel-200-226-solids`, `irregular-gear-family`, `special-worm-solids` and `models` (run log: `/dev/shm/p104/g1/test2.log`):
- `movement-195`, `197`–`199`, `201`, `205`, `207`–`211`, `213`, `221`, `222`, `225`, `239` and `240`;
- `authored-loader`, `carrier-pawl-225-contact`, `feed-worm-assembly`, `feed-worm-wheel`, `mangle-contact`, `mangle-rack-working-contact` and `opposed-spur-239-contact`;
- `radial-pin-mangle-contact`, `ratchet-stop-240-working-parts`, `split-rim-213-contact`, `variable-drive-205-209-solids` and `variable-idler-solids`;
- `gears-24-46-source-match`.
