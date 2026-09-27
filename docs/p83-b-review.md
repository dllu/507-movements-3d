# Pass 83, lane p83-b: 466, 474, 455, 483

Reviewer: Claude Opus 5.5, lane p83-b. Date: 2026-09-27.

The captures are in `/dev/shm/p83-b/`, outside Git:
- `base/NNN-tile.png`: before (phases 0, 0.25, 0.5 and 0.75, rotated, back, plate).
- `final/NNN-default.png` and `final/NNN-oblique.png` (from `review-movement-source-views.mjs`), plus `final/all.png`, which tiles all four beside their plates.
- `a466/`, `a474/`, `a455/`, `a483/`: after, with rotated, zoomed and hidden-part views.

Loop seams: `check-loop-seams --ids=455,466,474,483` reports 0 seams, 0 pops and 0 errors.

## 466 Hand-pumped hydrostatic press

**Default pose.** The lever angle was `rest + A cos(stroke)`, so phase 0 and the whole hold and let-down showed the lever at the top of its stroke, nearly level. It is now `rest - A sin(stroke)`:
- Stroke 0 is Brown's pose: the lever on his plate slope (fulcrum to crosshead, -13.8°), at mid-stroke, going down.
- The top of the stroke is at 3π/2 and the bottom at π/2.
- Delivery is counted from the top of the first stroke, less the half stroke already made at the rest pose. After each whole cycle the delivered length is exactly n strokes, and the twelve strokes still deliver exactly 12 strokes, so the volume and Pascal laws are unchanged.
- The fulcrum at phase 0 sits exactly on Brown's pin (315, 142.5 px).
- The hold and the let-down also show the plate slope.

**Brown's thin line.** It is now a light cord (radius 0.8 px), modelled as follows:
- **Upper end:** a loop round the fulcrum pin, in front of the lever. The pin was lengthened by 0.025 to carry the loop; this is a hitch, not a motion pin.
- **Lower end:** tied into the ball at its upper right. The tie point is chosen so that the pin's swing changes the span as little as the ball allows. The pin swings about 5 px sideways. The residual span change while pumping is 0.0076.
- **Length:** the longest span while pumping, so the cord never stretches. It is only ever taut or slack.
- **Slack:** it bows out of the plate, toward the viewer, so the front view keeps Brown's straight line. The bow is up to about 0.06 while pumping and about 0.15 when the ball is lifted to let the ram down.
- **Load:** Brown does not say what the line is for, so the cord carries no load.

Captures: `a466/tile.png` (phases 0, 0.02, 0.4, 0.9; rotated; bow during let-down and during pumping, zoomed; zoom on the pin and ball) and `final/466-default.png`.

**Tests.**
- The delivery test in `movement-466.test.mjs` now follows the new stroke convention: rest, bottom, top, next rest.
- A new test covers the plate-slope pose at phase 0 and during hold and let-down, the ram down at phase 0, and the cord. The cord is never stretched, is nearly taut while pumping (spread < 0.01, sag < 0.08) and slackens when the ball lifts.
- `hydraulic-force-solids.test.mjs` passes unchanged: 18/18 across the two files.

**Proposed ledger (466)**
- assessment: reasonable
- visibleFlaws: (none)
- limits (append): Brown's thin line from the lever pin to the ball is read as a light cord that carries no load. It is just taut while pumping and bows out of the plate when the ball is lifted. The lever starts on Brown's plate slope at mid-downstroke.

## 474 Hero's aeolipile

**Dashed line.** The flared bowl mouth rose to y 0.38, inside the lid (0.34–0.50), and the lid overhung it by 0.01. That overhang cast a hairline shadow, and shadow-map aliasing broke it into dashes round the bowl. Now:
- The mouth ends flush under the lid at the lid's underside, y 0.34.
- The lid radius equals the mouth radius (1.82).

The rim and oblique zooms (`a474/A-rim.png`, `A-rimL.png` against `b-rim.png`) show a clean joint and no dashes.

**Riser banding.** I found none in current captures:
- The p74 close-up (`/dev/shm/p74-c/a474c/474-closeR.png`) showed fine horizontal striations on the risers. That was while the risers were still translucent, before pass 81 made them opaque.
- At 1400 px zooms (`a474/L-crop-riser.png`, `c-tile.png`) the riser shading is smooth.
- Contrast-stretching by 4× shows only 8-bit quantisation steps.
- The only jagged edge left is the globe's shadow across the left riser in close zoom, which is a shadow-map limit.

**Test:** a new test checks that the bowl mouth meets the lid underside and that the lid edge is flush with the mouth. `movement-474` and `thermal-steam-469-474-solids` pass, 16/16.

**Proposed ledger (474)**
- assessment: reasonable
- visibleFlaws: (none)
- limits (append): The bowl's mouth ends flush under the lid.

## 455 Old rotary pump

**Is the web needed?** Yes:
- The web is the only thing that carries the drum on the shaft and transmits the drive torque. Brown shows no shaft inside the ring, so the drive lies behind the section plane.
- It does not add sealing: the drum's end faces run against the covers either way. It must stay for support and drive.

**Change.** The web now takes the rear cover's plain paper finish, following the existing convention that everything behind the section plane is left blank as on the plate. The drum's cut ring stays orange. The default now reads as Brown's ring with a blank interior (`final/455-default.png`). In rotated views (`a455/tile.png`) the web reads as the closed back of the drum.

**Test:** a new test checks that the web stays on the rotor, shares the rear cover's material, differs from the drum body, and that the shaft reaches the web. `movement-455` and `rotary-pump-455-456-solids` pass.

**Proposed ledger (455)**
- assessment: reasonable
- visibleFlaws: (none)
- limits (append): The drum's rear web carries the drum on the shaft and is finished plain like the rear cover, since both lie behind Brown's section.

## 483 Dry gas meter

**Ducts.** They were rerouted so that nothing shows between the shelf and the boards:
- **Under the shelf:** each duct now drops only 0.11–0.30 below the shelf and runs straight back into the thick back wall. The front duct of each close pair runs lower (A-inner and A'-inner at 3.10; A-outer and A'-outer at 3.29), so no drop meets a run.
- **Inside the wall:** the ducts use the two cored layers. Layer 0 holds A-inner and A'-inner; layer 1 holds A-outer and A'-outer, and A-outer goes up over A'-outer's entry to 3.60. Each duct leaves the wall at its board's own level (1.90–2.30).
- **Into the boards:** the four fixed boards now run back to the wall (z -1.90), as fixed boards bolted to the case back would. Each has a passage cored in it that turns out of the board face into its measuring space, and the liner ends flush with that face.
- **Result:** the board-top hooks and the long drops are gone.
- Captures: `a483/tile.png`, `tile2.png` (from below), `tile3.png` (back wall hidden: liners in the wall and the boards).

**Left flag rod: left, because it is forced.**
- The flag must turn the rod's rocking into x travel, so its arm must point roughly along z at mid-stroke. The rod must therefore stand inside chamber A's x-span (plate travel -1.84 to -0.80). It must also rise to B's spindle crank above the shelf.
- Brown draws nothing that covers x -2.3 to -0.6 between the bellows top and the crank.
- Moving the rod behind the end board or the column (x ≈ -2.6) would need long horizontal flag arms across the top and bottom of chamber A. That would be worse.
- About 3.0 of its 8.4 length shows in the front view: 1.58 above the shelf, 0.86 between the bellows and the shelf, about 0.6 below, and the V notches.

**Crank disc and eccentric: left, because they are forced.**
- Two links from rods a quarter turn apart must drive one spindle. Each link sweeps across the spindle axis.
- The sheave and the disc keep either rod from passing over the other's pin, and keep the spindle top clear.
- In the front view the disc shows edge-on, like Brown's bar and knob.

**Tests.**
- A new test in `gas-meter-working-solids.test.mjs` checks that every duct point inside the case lies within 0.4 of the shelf underside or inside its board, and that each duct ends on its board face below the bellows top.
- The existing clearance screen now covers the ducts against the extended boards, whose bores are real. It passes.
- `movement-483` and `gas-meter-working-solids` pass, 16/16 plus the new test.

**Proposed ledger (483)**
- assessment: minor
- visibleFlaws: The left flag rod, which Brown does not draw, shows as a thin rod behind chamber A: above the shelf, between the bellows and the shelf, and through the V notches. The spindle's crank disc and eccentric are inferred where Brown shows only a bar and a knob.
- limits (append): The four ducts drop just below the shelf, run in passages cored in the back wall and enter their fixed boards, which run back to the wall, through passages cored in the boards. The left flag rod must stand within chamber A's span and rise to the spindle crank, and no drawn part covers that span.

## Checks

Intersection screen (0.01 spacing, 129 samples, `/dev/shm/p83-b/screen.txt`):
- **466:**
  - The only new pairs are the cord's own ends, as intended: the cord runs into its loop on the pin (depth 0.0095) and is tied into the ball (0.0072).
  - The cord is an open tube, deliberately, because both ends are buried.
  - The other pairs are the existing fluid and contact pairs.
- **474:** only the steam cores (fluid), as before.
- **455:** no solid pairs.
- **483:** only the leather/plate "deforming" pairs (depth 0), as before. No duct/board or duct/wall overlap.

Targeted tests, all passing:
- `movement-466`, `hydraulic-force-solids`
- `movement-474`, `thermal-steam-469-474-solids`
- `movement-455`, `rotary-pump-455-456-solids`
- `movement-483`, `gas-meter-working-solids`
- `models`, `movement-456/467/475/484`: 203/203
