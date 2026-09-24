# Lane m17-audit-d: pass-52 audit follow-up (394, 443, 452, 459, 464, 488)

The fresh pass-52 audit (`/dev/shm/audit52/d/assessment.json`) found visible problems in six rows the ledger rated reasonable. Each was checked against its plate in default captures at four phases (0, ¼, ½ and ¾ of the cycle). Framing was checked with the motion bounds re-sampled in the browser, because the committed display profiles for these IDs are now stale. Nothing is committed. `docs/movement-status.json` and the display profiles were not edited.

## 394 Parsons endless rack

- **Diagnosis:** the "pale flange hole" is not a flange drawn in the background colour. The large and small flanges are blue and hidden behind or on the pinion. The pale patch is rack teeth that the offline flank cutter carved into spikes. The pinion slab (z −0.11..0.29) sweeps the middle of both straight rows at its crossovers, and the teeth there were cut back to the rack body. Face-on, this leaves a rounded bare area in the rack.
- **Fix:** `finishParsons394` (src/simulation/reversing-transmission-working-parts.js) now gives each cut straight tooth an uncut rear web (`uncut-rear-web-of-rack-tooth-behind-pinion-slab`, z −0.33..−0.13) in the full tooth outline. The web sits behind the pinion slab and clear of the large flange, whose front face is at −0.365. The rim body is deepened to the same rear plane, so the webs are seated on it. Face-on, every tooth now reads whole, as Brown draws it. The working flanks and the prescribed motion are unchanged.
- **Intersections:** clear before and after (`show-body-intersections 394`: no pairs).
- **Residual:** Brown's scalloped flange outline around the pinion is still not drawn. The rack face shows a slightly darker recess where the front half of a tooth is cut.

## 443 stream-driven Archimedes screw

- **Fix:** the fit box is widened left (−3.20 → −4.10) and up (3.30 → 3.75). The bracket's eye, its gooseneck bend and the shaft head now sit well inside the upper left. As on the plate, only the far run of the arm and the outer end of the trough leave the left edge.
- **Intersections:** geometry is unchanged.

## 452 double-acting pump

- **Change:** Brown shows the rod's plain top end just above the gland. The fit box top is now the rod end at the top of the stroke plus 0.10, so the end stays in view through the whole stroke.
- **Rod length:** the rod is 3.70 instead of 3.75. At bottom dead centre its end stands 0.10 above the gland top (2.868).
- **Stroke:** the engineered ±1.05 stroke is unchanged, so the frame is taller than Brown's crop.
- **Intersections:** clear (`show-body-intersections 452`: no pairs).

## 459 reciprocating well lift

- **Change:** the earlier crop let the lowered bucket sink out through the bottom edge, which reads as a framing error. The fit box bottom is now 0.34 below the lowered bucket's base. Both buckets stay whole through the stroke, and the well water they dip into is in view. The well walls continue below the frame edge, reading as the well going down.
- **Intersections:** geometry is unchanged. The known 0.009 pin/thread graze remains.

## 464 Heron's fountain

- **Spray:** the two glassy spray tubes are replaced by a willow plume like Brown's (`correctFountain` in src/simulation/fountain-balance-working-parts.js).
  - Each side has 16 fine streaks in three azimuth planes. They lean out to lower crowns and break into dashes as they fall back, more steeply than they rose.
  - The streaks are fixed-shape geometry at unit head, scaled with the ideal jet height, so no buffer is replaced during playback.
  - The central jet column is thinner.
- **Detached stream:** the stream hanging at the upper left was the schematic external pour into the basin. Brown draws no pour, so a new `source-presentation.js` entry removes `external-water-pour-into-open-upper-basin`. The pour's volume law remains in the model.
- **Intersections:** only fluid pairs, the jet leaving the nozzle. No solid pairs.

## 488 screw propeller

- **No change:** the audit read the authored 0.67 s (90 rpm) period. `correctMarineRotor` already sets `minimumDisplayCycleSeconds = 4`, and the loaded model plays one turn every 4 s (15 rpm; `animationTiming.displayCycleDuration = 4`), matching the other marine rotors. The 90 rpm is the disclosed hydrodynamic operating point.

## Display profiles to re-measure

`394, 443, 452, 459, 464`. Their fit geometry, visible parts or removal lists changed. For 464 the stale profile crops the new plume, because the engine intersects the authored fit with the profile once a removal applies.

## Tests

The following pass (101 tests):

- flexible-pump-452-454-solids
- fountain-balance-interfaces
- movement-394, movement-443, movement-452, movement-459, movement-464
- reversing-mangle-finite-guides
- reversing-transmission-tooth-contact
- reversing-transmission-working-solids
- source-presentation
- water-lifting-441-443-solids
- well-scoop-gutter-solids

movement-488 and marine-rotor-working-solids also pass (15 tests).
