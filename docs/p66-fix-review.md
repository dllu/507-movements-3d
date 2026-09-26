# Pass 66, lane p66-fix: 236, 286, 351, 498

Reviewer: Claude Opus 5.5 (lane p66-fix), 2026-09-26. Each ID was checked against `public/engravings/mm_NNN.png`
and the pass-66 audit (`/dev/shm/audit66/findings.json`). Captures are outside Git in `/dev/shm/p66-fix/`:

- `review/ID-{default,oblique}.png` and `defaults.jpg` come from `review-movement-source-views`.
- `t236.jpg`, `t286.jpg`, `t351b.jpg`, `z351.jpg` and `t498.jpg` show phases, rotated and back views, and close-ups.

"Before" intersections and face scans ran on a `/dev/shm` copy that holds the HEAD versions of the touched files.

## 236 alternating pawls (`authored-intermittent-core.js` `alternatingTwoPawlContinuousRatchet`, `alternating-pawl-236-working-parts.js`)

The idle pawl used to follow a prescribed outward lift. It swung up to about a tooth height clear of the rim near
phase 0.15, and pawl b hung well left of the wheel at phases 0.65 to 0.85. It now rides the teeth in the wheel plane:

- **Resting solve.** At each instant the idle pawl is swung in about its hinge until it first touches the tooth
  outline. The solve is analytic: the toe circle is tested against every outline corner and edge, and the pawl's
  straight flanks against the tooth corners (and the reverse).
- **Drops.** Where the toe slips off a tooth corner, the pawl drops with a prescribed angular acceleration
  (900 rad/cycle²) until it lands on the next flank. There are two clicks per return stroke.
- **Driving strokes and handoff.** These are unchanged. The resting angle meets the drive angle exactly at each
  reversal.
- **Shared flank outline.** The pawl's flank polylines are now one shared definition, `geometry.pawlFlankPolylines`.
  The working-parts body outline is built from it, so the solve and the mesh match.

Results over the cycle:

- The idle pawl rests on a toe or a flank for 94.6% of the cycle.
- The largest toe clearance is 0.215, reached during a drop or while the flank bears on a tip (was 1.26).
- The test that pinned the old lifted-clear design is rewritten as "rides the teeth". It checks that the pawl rests
  for more than 90% of the cycle, that the toe clearance stays under 0.25, and that the drops are continuous.
- The reconstruction note and contact qualification now describe the resting solve.

Checks:

- Intersections: none before; after, only a 0.0000-depth resting contact between pawl c and the wheel.
- Seams: 0.
- Faces: unchanged (zfightSameLook 3).
- The shared-file tests for 63, 71, 206, 211, 225, 235 and 240 pass.

## 286 toe and lifter (`authored-poppet-valves.js`)

Brown breaks the lifting rod off at the foot of the plate and draws no valve. The caption says the rod raises "the
valve", but that valve is off the plate.

- The flared poppet-valve disc is removed.
- The rod now continues straight past Brown's break. It runs one extra lift plus 0.6 below the old end, so its plain
  cut end stays below the view over the whole lift.
- Framing is unchanged: the fixed `cameraFitBounds` still crop the rod, which is acceptable because it is a whole
  part.
- Tests now assert that no poppet head is built.
- Intersections: unchanged (toe-to-lifter contact only, depth 0.0000).
- Faces: unchanged.

## 351 gravity stamp (`stamp-trip-working-parts.js` `correctStampParts` and new `squareStampTeeth`, `authored-stamps.js` rest height and note)

**Before.** The rack had 25° involute teeth that read as triangular sawteeth, and the mutilated pinion had thin,
hooked teeth.

**Rack.** The rack now has Brown's square teeth:

- flanks at 6° to the tooth axis;
- 0.40 of the pitch thick at the pitch line;
- 0.10 above and 0.20 below the pitch line.

**Pinion.** Each pinion tooth is generated as the envelope the rack cuts as it rolls on the pitch circle. The
envelope is solved per radius over 3000 roll positions. So the pair is conjugate and the analytic pitch-line lift is
exact, with no interference, while both members read as square teeth. The pinion teeth have rounded ends and a
slight undercut neck.

**Backlash.** It is asymmetric: 0.0008 on the leading (lifting) flank and 0.004 on the trailing flank. The release
and pickup projection then has room to move.

**Rest height.** The stamp's lowered rest moved from −0.25 to −0.30. At the old height the entering square tooth
struck the end face of a rack tooth, which gave a 0.13 jump. Now it meets the rack tooth's lower flank, and the
largest per-sample jump is 0.019.

**Other changes.**

- The geometry fields now describe the new teeth: `rackToothTipX` and `rackToothRootX`, and `gearRootRadius` and
  `gearOuterRadius`.
- The rack bar's toothed edge moved to the new root line.
- The note is updated.

**Checks.**

- Largest driving-flank gap: 0.00095.
- Smallest tooth clearance over the cycle: 0.0005.
- Intersections: none before and none after.
- Seams: 0.
- Faces: unchanged (zfight 1, zfightSameLook 8, as at HEAD).

## 498 siphon gauge (`authored-siphon-pressure-gauges.js`, new `serif-numerals.js`)

**Before.** The seven-segment numerals looked like digital-display digits.

**Glyphs.** They are replaced by solid bold italic serif numerals. The outlines are the digit glyphs of Liberation
Serif Bold Italic, extracted to TrueType path strings in `serif-numerals.js`. That font is under the SIL Open Font
License 1.1; the copyright and licence notice are in the file header.

**Size and placement.** Each glyph is 0.30 tall and 0.025 thick, like the old digits, and is scaled 0.72 on the same
placements. There are eight: the scale's 0 to 6 and the left "0" tag. The style matches Brown's figures.

No other movement renders numerals, so there was no house style to match. `authored-epicyclic-trains.js` (502 to
507) still builds its letters from strokes in `makeSourceLetter`, but that file belongs to another lane.

**Checks.**

- Intersections: unchanged (internal fluid overlaps only; the mesh count dropped from 65 to 34 as the segments went).
- Faces: clean.
- Seams: 0.

## Checks run

- Loop seams (`--ids=236,286,351,498`): 0 seams, 0 pops.
- Tests, all passing:
  - `alternating-pawl-236-contact`, `movement-236`;
  - `movement-{063,071,206,211,225,235,240}`, `carrier-pawl-225-contact`, `ratchet-stop-240-working-parts`;
  - `movement-286`, `cam-281-286-solids`;
  - `movement-351`, `stamp-trip-working-parts`;
  - `movement-498`, `mercury-instrument-working-solids`, `movement-499`.
