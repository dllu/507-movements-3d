# Pass 101 fix lane f5

- **Scope.** Medium findings for 351, 366, 406, 411, 420 and 431 from the p101 audits (`docs/p101-audit-341-425.md`, `docs/p101-audit-426-507.md`), plus quick lows: 360, 365, 366 (bearings), 369, 372, 373, 378, 388, 390, 400, 403, 408, 412, 416, 417 and 419.
- **Captures.** They are in `/dev/shm/p101/f5/`, served by vite on port 46045:
  - `<id>-sheet.png`: the plate and the default, rotated and zoomed views.
  - `low-sheet0..2.png`: the plate, default, L and B views for each low.
- **Claims.** Lane p101-f5 claimed:
  - The factory file of every ID above.
  - `stamp-trip-working-parts.js`. Its `correctTripHammerParts` (used by 353) is unchanged.

## Medium findings

### 351: rack and pinion from the shared involute builder
- **Finding confirmed.** The rack teeth were thin fins, about ⅓ of the pitch. The pinion teeth were envelopes of those fins.
- **New tooth builder.** A new `involuteStampTeeth` cuts both members from the shared rack/pinion builder:
  - The pinion tooth is one tooth of `rackPinionGeometry`'s outline.
  - The rack tooth uses `rackToothGeometry`'s flank law.
  - Both use a 20° pressure angle, the squarest flank that leaves the 18-tooth virtual pinion free of undercut at addendum 0.13. There is a guard for this.
  - Both use one circular pitch, with tooth = gap on the pitch line (0.001 backlash each).
- **Counts.** Still 8 pinion teeth and 8 rack teeth, all of them used.
- **Conjugate mesh.** The driving flank gap is a constant 0.00094 through every handoff. The first draft had a bent embedded rack flank that drifted 1.5% per tooth; this was caught and fixed.
- **Carried release.** The release and pickup projection runs unchanged on the new teeth:
  - Withdrawal gap: 0.0005.
  - No penetration over the cycle.
- **Collar.** The top collar's full-depth part now stops at 0.27 of the rod width. It still reaches the tooth tips and clears the root disk.
- **Clean-up.** The unused square-tooth code (`squareStampTeeth`) was removed.
- **Captures:** `351-sheet.png`.

### 366: lever eyes on fixed pins
- **Finding confirmed.** Each square lever bar had its bore cut right through its width. The two ends butted a long black drum, whose faces z-fought.
- **Fix.**
  - Each lever now carries a round eye (r 0.16), concentric with its fulcrum, in its own extrusion.
  - The drums are hidden.
  - Each short fixed pin (r 0.08) runs from 0.02 behind its post to 0.02 in front of the lever.
  - Each post is one plate: a tapered stem whose sides run tangent into a round head bored for the pin. The upper post is clipped to sit over the frame's top arm.
- **Bearings (the low finding).** The three torus rings are now bored bosses:
  - The upper boss is 0.10 long, keeping 0.02 clearance to the pinion retainers, and its bridge is thinned to 0.08.
  - The input-bearing bridge was moved 0.015 so it no longer overhangs the column.
  - The hidden spin index was moved inside the 0.105 guide bore.
- **Screens.**
  - The drum flicker is gone. The only remaining coincident-face pair is the pre-existing pinion body against its own hub.
  - The upper-arm lip and the crank-grip near-miss are unchanged from before.
- **Captures:** `366-sheet.png`, `416-366.png`.

### 406: the thread is shared hemp
- **Change.** The thread segments, looped end, knot and bight all use the rope-brown material (`PALETTE.rope`, roughness 0.78), as sibling 405 does.
- **Captures:** `406-sheet.png`, which includes 405.

### 411: socketed handle and pivot boss
- **Push handle.** It now lies in the arch's own plane (z 0.34) and ends on the arch tube's centre line at the (-1.25, 1.44) knot, so the two tubes join as one member. It no longer lies tangent across the brace. Its free end is rounded (a capsule).
- **Pivot boss.** A bored boss (r 0.20) is cast on the arch apex, concentric with the pivot, and the arch tube runs into its sides.
- **Pivot pin.** A short pin (r 0.08) runs from inside the boss to 0.025 in front of the pendulum eye. The eye is re-bored to fit (r 0.17, bore 0.084), and the pendulum rod reaches into it.
- **White index.** It is hidden.
- **Captures:** `411-sheet.png`, `411-sheet2.png`.
- **Not fixed.** The pencil trace is still a 1 px line, because WebGL ignores line width.

### 420: the bell hangs from something
- **Constraint.** Source presentation removes the old post and arm (`fixed-overhead-bell-support`). That file is owned by lane u5.
- **Fix.** A new group, `fixed-bell-hanger-behind-bell`:
  - A pin (r 0.07) passes through the canon loop's opening and rests at its bottom.
  - A 0.14 beam runs straight back from the loop to a small wall plate.
  - From the default view the bell hides the beam and plate; only the pin's end shows inside the loop. Every rotated view shows the bell carried.
- **Screen.** The bell group is still "floating" in the disconnect screen, because the wall plate stands for an undrawn wall.
- **Captures:** `420-sheet.png`.

### 431: spokes reach both rims
- **Change.** Each rim carries its own eight spokes in its own plane. They run from inside the hub to the rim tube's centre line (0.18 deep, inside the 0.21 tube), so no spoke ends in the air. The rear set has its own role names.
- **Captures:** `431-sheet.png`. The zoom there hides the float boards.

## Low findings

- **360.** The drum body and rim are muted grey instead of orange.
- **365.** The rear roller is brass.
- **369.** The auditor's cause was wrong: the normals are already creased (0 bad normals). The pale wash was Fresnel reflection at grazing angles. The cheek paint is now non-metallic with roughness 0.9, and the wash is gone (`369-sheet2.png`).
- **372.**
  - The output miter is muted grey instead of the hoop's blue.
  - `makePitchConeGear` is unchanged, so edge-runners (the other importer) is untouched.
- **373.**
  - The wagon wheels are brass.
  - A dark case back (r 0.535) now sits behind the ivory dial.
- **378.** The rigid connecting rod is muted grey instead of rope brown.
- **388.** Both shafts end 0.05 in front of the rollers instead of 0.43, so there is no "clock hand". The plank is still thin; this was not addressed.
- **390.** The loose band pulleys are muted grey.
- **400.** Cam C is brass.
- **403.**
  - The brace sits at 3.6 from the crossing, along the chord with its upper edge at the guide pins (which Brown dots behind it). It was at 3.05.
  - The brace is a lighter second blue.
- **408.** The legs are the same lighter second blue.
- **412.** The carrier (hub, three-lobed web and lugs) is muted grey.
- **416.** The treadle pivot pin is concentric in its lug and stands only 0.01 proud. It keeps its 0.004 running clearance, which the family solids test requires.
- **417.** Slide C is orange.
- **419.** Wheel B is muted grey.
- **Not done.**
  - 420's skin tint: `hauling-hand.js` is shared with 377 and belts.
  - 366's pre-existing hub coincident-face pair.

## Validation

- **Reports regenerated** (hash-only changes, same pose counts of 33):
  - `docs/validation/368-372-contact-solids.json`
  - `docs/validation/412-495-gear-solids.json`
- **Screens:** disconnected-parts and coincident-faces were run for 351, 366, 373, 388, 403, 406, 411, 416, 417, 420 and 431. The results are in `/dev/shm/p101/f5/disc*.json` and `cf*.json`.
  - Every remaining item was there before this pass, except 420's wall-mounted hanger (explained above).
  - 351's floating pinion group is now only a near-miss.
- **Tests:** the movement tests for every ID, plus the family solids, loader and screen-regression tests (see the final report).
