# Pass 65, lane p65-c: 247, 312, 463, 466, 470, 488, 491, 498

Reviewer: Claude Opus 5.5 (lane p65-c), 2026-09-26. Captures are outside Git in `/dev/shm/p65-c/`:
`before/ID-default.png` and `after/ID-{default,oblique}.png` come from `review-movement-source-views`. The `aNNN.png`,
`bNNN.png` and `cNNN.png` tiles show phases, ±60° yaw, back and top views, and close-ups. "Before" intersections and
face scans ran on a `/dev/shm` copy that holds the HEAD versions of the touched files.

## 247 sounding weight (`authored-sounding-weights.js`, `release-mechanism-working-parts.js` 247 functions)

This follows the lead's decision.

**Sea bed.** The 4.2 × 0.9 × 2.4 sediment slab is replaced by a plain thin sea-bottom surface. It is a
`groundBlock` 24 wide, 0.04 thick and 3.4 deep, and its top is the contact plane.
- In the default view it rises in as a thin ground band under the probe foot.
- Its ends never enter the frame.
- The caption implies it: the weight detaches on striking bottom.

**Sling removed.** The rope sling, basket, hook and second hauling hand are gone, together with their opacity
logic.

**New loop reset.** The view still follows the lowered rod down to recovery. Above the recovered pose, the display
frame stops following. The sequence is:
1. 7.3–8.5 s: the rod is hauled up on its sounding line, clean out of the top of the view.
2. While the rod is out of view, the detent is released and the catch set (8.5–9.1 s).
3. The spent weight, left on the bottom below the view, fades out (8.5–8.75 s).
4. A fresh weight fades in, already seated on the catch above the view (9.1–9.35 s).
5. 9.4–11.1 s: the re-armed rod is lowered back into Brown's pose.

The line hand hauls in with the rod. No fade or teleport is ever on screen, and the test asserts this against the fit
bounds. Timeline keys changed from `manualReload*`/`weightSeated` to `rodHauledClear`, `spentWeightGone`,
`catchReset`, `freshWeightShown` and `reloadedDescentBegins`. The 247 source-presentation note was updated.

**Checks.**
- Intersections, before at 0.02: rope pairs plus three sling pairs. The slab exhausts the heap at 0.01.
- Intersections, after at 0.01: the old line/knot/eye/hand-tail rope contacts, and the probe-foot/bed touch at 0.0000.
- Faces: unchanged (mixed 1, degenerate 1, zfightSameLook 2, sheet 2).
- Seams: 0.

## 463 self-acting weir (`authored-self-acting-weirs.js`)

The head water can no longer stand above the turned upper leaf. It is capped 0.06 under the leaf's upstream top edge,
which drops as the leaf turns.

The notch overflow now follows the head over the lowered notch sill as a sharp-crested weir: `q ∝ h^1.5`, scaled so
that the ordinary head gives the ordinary flow. The open, turned leaf therefore spills a full sheet over its crest, as
Brown's right-hand figure shows. The old sheet shut off while the leaf was open. At flood the closed-leaf sheet is
thicker than before.

- Test: the old pin "notch stream off while open" was replaced. The test now requires open-leaf overflow above
  ordinary, and the head below the turned leaf's top at 201 phases.
- Intersections at 0.02 (0.01 exhausts the heap): only fluid pairs. The nappe versus leaf-body pair of 0.36 is the
  known inside-test artifact of the double-sided sheet, as in p64; it was 0.33 before.
- Seams: the old 2.6% bed-flow pop remains.

## 466 hydrostatic press (`hydraulic-force-parts.js`, press branch)

Brown's fulcrum post is a slender upright under the right side of the lever eye. The post (half-width 0.07) now
stands 0.22 right of the fulcrum and joins the fulcrum boss. The ball pendant hangs plumb from the pin beside the post
instead of in front of it. The rim bracket was lengthened to 0.86 so that the post's foot still lands on it.

- Intersections: water and check-disk seat pairs only, the same as before.
- Faces: unchanged.
- Seams: the old 1% reservoir-water pop remains.

## 470 steam hammer (`authored-steam-hammers.js`)

**Frame and cylinder.**
- The cylinder is Brown's broad one: outer radius 0.44 → 0.66, bore 0.56, with a matching piston.
- The standard's uprights are slender (window half-width 0.64 → 0.86) and deep enough (±0.74) for the crown to ring
  the barrel.
- The chest is now Brown's small box, 0.44 wide, saddled onto the barrel over the spindle line.
- The barrel's admission port was narrowed to the chest and turned to face it. It uses `sidePortedShell` with a
  half-angle of 0.2 rad.

**Valve gear.**
- The rocker is at Brown's proportions: fulcrum 0.40, arms 0.45/0.40.
- The long valve rod runs down the inside of the right upright to a short hand lever on a boss on the leg.
- The lever's long arm runs to Brown's upright handle post, which has a ball top. The post slides vertically in
  Brown's two brackets from the leg, and the lower bracket runs on past the post as a short foot.
- A pin on the post rides in a slot at the lever end. The slot length follows from `arm/cos(amplitude)`.
- The lever swings ±12°. The spool strokes ±0.058, where the old gear stroked ±0.10.
- Linkage closure is exact.

**Tests.** The spool-stroke threshold was changed from 0.15 to 0.1, which pinned the old gear. New checks cover the
post line, the pin on the lever axis, and the pin staying within the slot.

**Checks.**
- Intersections before: piston-rod/steam fluid and the face/anvil touch.
- Intersections after: the same pairs only. A pass that placed the lever and post coplanar, and the rocker lug inside
  the broader barrel, was fixed before the final run.
- Faces: clean.
- Seams: the old steam-chamber visibility pop inside the closed barrel rises from 5% to 7.2%, because the chamber is
  wider. It is not visible.

## 488 screw propeller (`marine-rotor-working-parts.js`, `authored-screw-propellers.js`)

The old camera (15, 1, 10) looked 56° along the shaft, so one blade showed its face and the other its edge. Brown
looks at the screw almost square to the shaft, slightly from the left and above, because he shows the left collar's
face. The camera is now (−1.6, 1.4, 15), and both blades read with equal breadth.

The displayed pitch is now 4.75 per turn, the physical screw's pitch ratio of 3.75 m on 3.60 m. Before, it was 3.75
on a 4.56 screen diameter.

A strictly consistent constant-lead helicoid cannot show both blades face-on from one side view. Brown's broad faces
are therefore still only partly matched. This is recorded as a residual.

- Intersections: none.
- Faces: clean.
- Seams: 0.

## 491 capstan (`authored-capstans.js`, `capstan-finite-parts.js`)

- The deck is cut away under the crown ratchet's exact 18-sided footprint, so the ratchet is let into the deck and
  they no longer share a face. backToBack went from 1 (area 4.09) to 0.
- The handspike socket rims now stand proud from the head surface (−0.012 to 0.075) with an opening a little larger
  than the socket. The 8 z-fight pairs are gone.
- Intersections: none, before at 0.02 and after at 0.01 with a larger heap.
- Faces: zfight 8 → 0 and backToBack 1 → 0. The only remaining pair is barrel/collar zfightSameLook 1, which is
  invisible.
- Seams: 0.

## 498 siphon gauge (`authored-siphon-pressure-gauges.js`, `mercury-instrument-parts.js` 498 branch)

- **U-tube.** It is now Brown's tall, narrow tube, with the legs 0.46 from the centre instead of 0.76. The right-hand
  scale moves with the open leg.
- **Pipe.** It starts at −4.40, past the new −3.9 crop. Relative to the leg spacing it now matches Brown's run of
  about 3.3 spacings.
- **Left "0" mark.** Brown's mark is now a tick and numeral on a small tag grooved round the pressure leg, at the
  datum. `grooveScaleBoard` takes a side argument for this.
- **Cock.** The handwheel is replaced by Brown's plug cock:
  - a round bored body between two flanges;
  - a small plug head on top;
  - a T handle below, made of a flared neck and a flat cross bar.

  The passage stays open.
- **Checks.**
  - Intersections: mercury/meniscus fluid pairs only.
  - Faces: clean.
  - Seams: 0.

## 312 Bloxam gravity escapement (`authored-gravity-escapements.js`, 312 only; baked 312 entry)

**Fork pins.** The pins now differ by side:
- E is 0.45 below the arbor (it was 0.62).
- F is 0.50 above the arbor, on Brown's returned hook.

The pendulum and the arms share axis C, so beat timing does not depend on pin height.

**Branch shapes.**
- **Left branch (A–E).** Brown's J is one tangent arc from A that bottoms out level with E, then a short straight run
  in under the arbor to E.
- **Right branch (B–F).** Brown's hook is a tight arc of radius 0.32 below B, turning back on itself. It is then
  tangent to a straight run leftward, above the arbor, to F.
- The fingers to the pallet stems are unchanged in kind.

**Rebake.** Only 312 was rebaked (`generate-gravity-escapement-plates.mjs 312`). The 309, 310 and 311 entries were
compared as JSON against the pre-run file and are byte-identical.

**Checks.**
- Engagement (`check-gravity-escapement-engagement 312` at phases 0.05, 0.3, 0.55 and 0.8): A and B still lock, with
  gaps of 0.0067–0.0072, the same as before.
- Intersections: clear.
- Faces: zfightSameLook 9, as before.
- Seams: 0. The old periodMismatch of 0.148 is unchanged.
- The movement-312 arm test was rewritten for the tangent arc, the tangent straight run, and the E/F heights.

## Tests

The following files pass, 140/140:
- `movement-{247,309,310,311,312,463,466,470,488,491,498}`
- `release-mechanism-working-parts`
- `chain-weir-interfaces`
- `hydraulic-force-solids`
- `hammer-working-interfaces`
- `marine-rotor-working-solids`
- `capstan-491-finite`
- `mercury-instrument-working-solids`
- `gravity-escapement-working-solids`
- `source-presentation`
