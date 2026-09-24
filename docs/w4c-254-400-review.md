# Pass-51 wave-4 lane w4c (254–400) review

Reviewer: Claude Opus 5.5 (lane w4c-254-400), 2026-09-23. I captured every ID
before and after the changes with `scripts/review-movement-source-views.mjs` on a
private non-watching dev server and compared each render with its plate.
Intersections come from `scripts/show-body-intersections.mjs ID --spacing=0.01
--samples=129`. The "before" run used a `git archive HEAD` copy of the tree and
the "after" run used the working tree.

## Changes and verdicts

| ID | Change | Worst depth before → after | Verdict |
|---|---|---|---|
| 260 | The short standard gains concave flared knee webs, matching the plate's bracketed standard | 0 → 0 | matches |
| 266 | The movable bearing upright is as wide and deep as the nut, with concave fillets into its foot plate (inverted T) | 0 → 0 | matches |
| 267 | Removed the white rim, tread, shaft and arm-tip indices. The large arrow is now Brown's short arrow just outside the rim at about 1–2 o'clock. The plate does draw an arrow, so it is kept small rather than deleted | 0.0720 → 0.0720 (pre-existing pivot pin × spring) | matches |
| 273 | Presentation removes 8 white slider stripes and pin dots | 0.0139 → 0.0139 | matches |
| 280 | Added a broad rear standard behind the wheel, a post behind the travelling jaw, a head joining them, and a block that carries the sloping brace foot. All sit behind the barrel | 0 → 0 | matches the plate frame |
| 281 | The follower head is brass, not white | 0 → 0 | matches |
| 291 | Spring f is brass and stud a is dark (not white) | 0.2200 → 0.2200 | ok |
| 296 | The impulse pin is dark | 0 → 0 | ok |
| 313 | Jewels are muted grey, not white | 0.0186 → 0.0186 | ok |
| 314 | The roller pin is dark | 0.0374 → 0.0374 | ok |
| 331 | Presentation removes the white rim tick, the wrist disk, the spin index and the crosshead index | 0.1200 → 0.1200 (the index overlaps are gone; the crossbase × rim overlap is pre-existing) | ok |
| 341 | The grasshopper working pins P, I, L, M and W and the crank pin are dark | 0 → 0 | ok |
| 342 | The masonry pier is a mid stone tone (0x7d776d) instead of the pale 0xb9b1a2 | 0 → 0 | better |
| 350 | Added a broad round-topped standard on the output bar behind the lever. It runs behind the fixed pin O bearing and support (z −0.76..−0.58) and joins the rail back through a web | 0 → 0 | matches |
| 351 | No change (see residuals) | — | residual |
| 354 | Disk and far-face rim are translucent in place of Brown's dashed hidden lines, so the plate's open ring reads with the stem through it. The white wrist cap is brass | 0 → 0 | matches |
| 355 | Plate crop of the opening pose, using a reduced depth range as a view-fit proxy. `sweptBounds` holds the full precession | 0.0003 → 0.0003 | framing fixed; the ring leaves the frame briefly while precessing |
| 360 | Presentation removes the white indices and cord markers. The factory hides the cord-end ball knots, which stay as anchor frames | 0.1150 → 0.1150 (all coaxial, pre-existing) | matches |
| 364 | Presentation removes the white driver, roller and output indices and the groove marker | 0 → 0 | matches |
| 366 | The frame is a C-bracket (the left upright is removed, so it is open on the left) | 0 → 0 | matches |
| 375 | Presentation camera y 0.07 → 0.01; the factory sets `cameraFov` 16 | 0 → 0 | flatter; the pan interior still shows slightly |
| 377 | Level camera nearer the side (presentation [1, 0.02, 0.62]). The man moved to the far end of the drum (z −0.45), with his back to the viewer. The hand rail runs at head height in front of him, along the drum | 0.1506 → 0.1506 (figure self-overlap, pre-existing) | improved |
| 378 | The log is centred under the mean blade span (x 1.36 → 1.71) | 0.0040 → 0.0040 | improved |
| 380 | Presentation removes the two white indices | 0 → 0 | matches |
| 382 | The mirror glass is opaque silvered grey (metalness 0.78). The back bracket is dark iron, not orange | 0 → 0 | better |
| 384 | Plate crop: point at the left, screw running right. `sweptBounds` holds the full revolution | 0 → 0 | framing fixed; the arm leaves the frame on the left during its turns |
| 386 | Rounds widened from 0.19 to 0.23, the widest that stays clear (0.25 overlaps adjacent rounds by 0.0125 at t=4.06) | 0 → 0 | broader |
| 394 | Presentation removes the flange-guide walls, mouths and attachments that drew the black D-loop and bar | 0 → 0 | matches |
| 399 | Presentation removes the two white swivel-nut indices; the exposed threads are steel grey | 0.0175 → 0.0175 | matches |

The after run also reports 360 frame-base × flywheel-rim (coaxial 0.035). Neither
part changed, so it is a pre-existing pair that now appears in the listing.

## Residuals

- 351: framing is height-limited. The capture opens at t=0 at the carried apex,
  and the stamp then falls 3.47 to its impact dwell. Cropping to the opening pose
  would hide the head for most of the cycle, and the fit box already equals the
  motion bounds.
- 377: Brown mixes an end view of the geared wheel with a side view of the drum.
  The camera sits between them. The man's hip still stands above the drum top:
  lowering him to the side made the tread-indexed gait penetrate boards and his
  torso, so the height is kept.
- 378: at t=0 the saw is raised clear above the log; the plate shows the teeth
  on the log.
- 375: perspective still opens the pan slightly.
- 354: the hub and retainer show dimly through the translucent disk.

## Tests

Tests updated for legitimate changes:
- 267: no white roles.
- 273: indices detached; mesh count 48 → 40.
- 360, 364, 380: indices detached.
- helicograph-working-parts: the full cycle is checked against `sweptBounds`, and
  the crop against the opening pose.

`docs/validation/260-266-275-thread-solids.json` was regenerated with `POSES=33`.
Results are unchanged; only the fingerprints changed.
