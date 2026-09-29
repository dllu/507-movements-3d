# Pass 101, lane p101-f6: 426–507 audit fixes (444, 447, 452, 465, 506 and lows)

- **Reviewer:** Claude Opus 5.5, lane p101-f6, 2026-09-28. I integrated three sub-forks of this lane. No commits.
- **Audit:** `docs/p101-audit-426-507.md`.
- **Captures:** `/dev/shm/p101/f6/` for the mediums; `w/` (water lows), `p/` (pump lows) and `m/` (misc lows).
- **Server:** Vite on port 46046.
- **Claims (all p101-f6):**
  - authored-horizontal-overshot-water-wheels, persian-irrigation-wheels, eisach-pot-wheels, hydraulic-rams, oscillating-water-columns, reaction-ferries, lift-pumps, force-pumps, double-acting-pumps, diaphragm-pumps, chain-pumps, herons-fountains, balance-pumps, temperature-air-machines, atmospheric-hammers, expansion-steam-traps, mercury-gas-regulators, capstans, boat-detachers, stone-tongs, siphon-pressure-gauges, epicyclic-trains (not edited)
  - compound-epicyclic-corrections.js
  - lift-pump-working-parts.js, force-pump-working-parts.js, flexible-pump-working-parts.js

## Mediums

### 444: animated plume (authored-hydraulic-rams.js)
- **Change:** the static translucent bullet (`waterFountainGeometry`) is replaced by the group `continuous-high-level-water-jet-plume`. It holds twelve ballistic `WaterStream`s leaving the riser mouth nearly upright (5.6–8.2° tilt, 30° apart in azimuth). They rise to the drawn apex (y 4.05), part and fall away round it, and fade out at y 2.75. The streaks scroll with the loop.
- **Geometry details:**
  - The half-section is capped at 0.8 of the local radius of curvature, v³/(g·v_h), so no tube folds on itself at the apex.
  - The gauges differ slightly (0.030 + 0.0017·i).
  - The origins are staggered inside the riser.
- **Motion:** 6,702 pixels change between phase 0.30 and 0.31 in a close crop. The audit measured 0.
- **Captures:** `444-sheet.png` (default, zoom, rotated).
- **Tests:** `p88-pump-water-coincidence` allows only seams among the jet streams where they overlap in the column. These are overlaps between depth-write-off water, not depth fights. The coincident-face screen shows 0 flagged pairs.

### 447: ghost shadow (authored-reaction-ferries.js)
- **Cause:** pass 69 set `riverBed.receiveShadow = false`, but the render-time shadow policy switched it back on. That brought back the boat-shaped ghost and the bank's dark trapezoid.
- **Change:** the bed is tagged `userData.noShadow`.
- **Captures:** `447-sheet.png` (phases 0 and 0.3, rotated). The water is clean, with no ghost boat and no trapezoid.

### 452: bold, opaque check flaps (authored-double-acting-pumps.js)
- **Cause:** the flaps were opaque, but thin (0.05) and behind the section water's front face. The 0.34 water tinted them nearly invisible.
- **Change:**
  - The passage and chamber water now ends at z 0.585, 0.027 behind the flaps' front faces, so the flaps read crisp on the section.
  - The flaps are 0.086 thick with a rounded top. The knuckle radius is half the flap thickness, and the hinge axis is on the flap's centreline.
  - The hinge axes moved 0.018 left, so the seat-side faces close on the lips where they did before.
  - Each knuckle hangs from a short hanger block that runs into its wall, with 0.0015 running clearance. The degenerate 0.005 block is gone.
  - The flaps still swing 0.62 rad (diagonal pairs).
- **Captures:** `452-sheet2.png` (phase 0: flaps 1 and 3 open, flap 2 at 0.5), `452-sheet3.png` (close-ups), `452-sheet.png` (closed).
- **Tests:** `movement-452` and `flexible-pump-452-454-solids` pass 19/19. The coincident-face screen shows 0.

### 465: operator colour (authored-balance-pumps.js)
- **Change:** the jacket and arms are now brown cloth (0x6e5440) instead of the beam's orange, so the hands read on the hand bar and the figure reads against the beam.
- **Captures:** `465-sheet.png` (default, right, left).

### 506: bearing boss and bridge as one casting (compound-epicyclic-corrections.js)
- **Change:** the black drum and the grey box butted flush against it (with coincident faces at x ±0.12) are now one grey frame extrusion, 0.24 thick. It is a round boss (R 0.24, bored 0.122) with a flat bar (half-height 0.15) running back tangent into it through concave fillets (r 0.10) to the curved standard. `driverBearingPedestal` is removed from the model and from its blocks.
- **Captures:** `506-sheet.png` (default and three zooms).
- **Tests:** compound-epicyclic-supports (updated for the single casting), compound-epicyclic-geometry, epicyclic-family-clearance, movement-506 and movement-507 all pass. The coincident-face screen shows 0.
- **Reports:** `506-507-gear-solids.json` reproduced exactly through `review-compound-epicyclic-teeth.mjs` (REPORT to /dev/shm). Only the source hash of compound-epicyclic-corrections.js was updated.

## Lows (fixed by the lane's forks, reviewed here)
- **433:**
  - Fix: the board films taper to rounded tongues and use the water tint (opacity 0.3). They stay full width where they roll into the spill sheet.
  - Residual: a faint fresnel sheen at grazing angles.
- **441:** the tipping-pin post now ends 0.02 into the stream bed's top face. It no longer pokes below the bed.
- **442:**
  - The audit's "0.03 of each 1/12" is overstated: a pot pours through 24° of every 30° of wheel turn.
  - Fix: the pour is bolder, and a streaked sheet runs along the trough to the bank, 0.008 clear of the trough water.
  - Residual: the default camera hides most of the trough's inside.
- **445/446:**
  - Fix: the floating crown frustum is replaced by eight ballistic streams from the upper box's water surface, behind the cut plane.
  - Fix: the stepped collar at the orifice is gone. The column keeps the cone's top radius, and a short stream blends toward it.
  - Not visible: an unrelated `freeFall` factor always comes out 0 (its smoothstep bounds are reversed). It has no visible effect.
- **448:**
  - Fix: the lever is one flat curved bar with round eyes concentric with its pins and Brown's ring end.
  - Fix: the fulcrum bracket is cast with the head rim (boss, concave flanks, rib).
  - 449 is byte-identical (geometry hash 7453ef882b7ef5e1).
- **450/451:**
  - Fix: the handles end in rings.
  - Declined: 451's outlet loop. The plate's S is the air vessel's waisted wall, which the U outlet shares.
- **454:** the lever tapers to a rounded end; the T-grip is gone. 453 is byte-identical (1e9cc3ecec49fc3f).
- **462:**
  - Fix: the spout and bank sheets are denser and bluer (opacity 0.58).
  - Residual: from the near-level default camera the bank sheet reads as a band.
- **464:** the jet is ten wider streams (0.03 half-width) with faster streaks. About 12,450 changed pixels between phases, where the audit measured 57.
- **469:**
  - Fix: one base and one front lip run under both cisterns.
  - Declined: a shared partition. The plate draws two adjacent walls.
- **471:** the loop column and the back bar use the shared see-through style, so crank A and rod D show at every phase.
- **478:** lever D is one flat plate: the arm, the eye on the pivot, and a pear-shaped load made of circular arcs.
- **482:**
  - Cause: lever d and its stand cast the scythe onto the two well walls.
  - Fix: those walls take no shadows. The flag is pinned after `cutaway-section` re-enables receiving.
  - Shared-fix candidate: the shadow policy does not clear `receiveShadow` on objects tagged `noShadow`.
- **491:**
  - Fix: plain handspike ends; the deck is a closed plate; the ratchet foot is sunk 0.06 into the deck, so nothing shows through from below.
  - Declined: raising the ratchet's segments. The teeth have flat faces, one per tooth, and the pawl clearance test checks against that surface.
- **492:** the release lever is one constant-width circular arc (Brown's 8 px sagitta).
- **494:**
  - Fix: the sockets fit the tong points (0.004 clearance). The points bite at the lift, and the 0.026 near-miss is gone.
  - Disagree: the "different heights" finding is perspective. The bites are exact mirror images.
- **498:** a turned brass ferrule with chamfered ends laps 0.15 over the pipe and the glass, 0.003 clear of both.
- **504:** declined.
  - The camera already aims at the centre of the swept orbit.
  - The empty space is vertical, because the side view is flat.
  - The engine's fit-to-bounds distance is the floor; framing any tighter would crop the orbit at mid-cycle.

## Screens
- **Coincident faces:** 0 flagged pairs for 444, 447, 452, 465 and 506, and for the forks' IDs apart from the known 454 degenerate pair, which is allowed.
- **Disconnected parts:** the detached counts for 444, 447, 452, 465 and 506 match the audit baseline. 452's near-miss count fell from 32 to 28. The forks report no new detached parts, slivers or lips.

## Tests
- **Targeted run:** 66 test files covering the touched IDs and families: 464 pass. Five failures, all resolved:
  - Three files (503-504 contact, sector-press and toggle-press) failed only because the run started in `tests/`. From the repo root they pass 7/7.
  - `oscillating-column-working-interfaces` failed for 445 and 446 because `topPlume` is now a group of streams. The test now samples its mesh children, and it passes 6/6.

## Not mine
- `capstan-entwistle-solids` fails its hash on `authored-capstan-wheelwork.js`, another lane's file.
