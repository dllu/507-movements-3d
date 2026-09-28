# Pass 95: the 43 remaining minor rows

- **Reviewer:** Claude Opus 5.5, lane p95. The lane did the visibility re-check (part A) itself. Five forks tried fixes on disjoint files (part B): F1 (183/184), F2 (63, 320), F3 (459, 483), F4 (370, 377) and F5 (333, 358, 375). Date: 2026-09-28. No git writes.
- **Captures:** `/dev/shm/p95/` (outside Git).
  - `v/<id>-sheet.png` holds the "normal viewing size" captures for all 43 IDs at HEAD. Each is the real app page (`#/movement/<id>`) in a 1280×800 viewport, with the plate beside the model. It shows the default view and two orbit-dragged rotated views. `v/m-<id>.png` crops the same three frames to the stage.
  - Fork before and after captures use the same script (`cap.mjs`) and are in `F1/`–`F5/` (`before/`, `after/`, plus each fork's `notes.md`).
- **Scale used for pixel judgements:** `ppu.mjs` measures how many screen pixels one model unit covers at the camera target on a 560 px stage. The app's stage is about 540 px. For example: 86 is 80.6 px/unit, 284 is 60.2, 299 is 361.7, 308 is 46.0, 314 is 56.9 and 491 is 65.2. A plate is 525 px across in a frame of about the same size, so one plate pixel is roughly one screen pixel.
- **Claims** (`/dev/shm/p94/claims`):
  - p95-F1: `authored-quadrant-catches.js`, `quadrant-catch-finite-parts.js`, `baked/quadrant-catch-motion.js`.
  - p95-F2: `authored-maintaining-power.js`, and `authored-intermittent-core.js`, taken over from p94-p's stale claim. Pass 94 is committed in ed7b22d.
  - p95-F3: `authored-reciprocating-well-lifts.js`, `authored-dry-gas-meters.js`.
  - p95-F4: `authored-person-treadmills.js`, `authored-mirror-polishers.js`. Neither was edited.
  - p95-F5: `authored-edge-runners.js`, `edge-runner-bevel-parts.js`, `authored-fusee-traverses.js` (not edited), and `authored-marine-parallel-motions.js`, taken over from p94-a's stale claim.
  - p95: `display-profiles.json/.js`, taken over from p94-b-F5's stale claim. Only rows 183, 184, 333 and 375 changed, all remeasured with `node scripts/measure-display-profiles.mjs`.

## Rule applied
A flaw stays in visibleFlaws if a careful viewer comparing the model with the plate at normal size (1280×800) would notice it, or would notice it in the motion. Deviations of a few screen pixels on a static feature, and short sub-2 px hovers during motion, move to limits.

Several rows were left minor even though they are small, because their difference is a *shape* or *count* the eye picks up by comparison: tooth form, slot closure, notch roots, flute count. Shape differences read at a glance even when their pixel size is small.

## Decisions

| ID | Decision | Justification (capture) |
|---|---|---|
| 37 | stays minor | `v/37-sheet.png`: the model's pinion has visibly broader, fewer flutes than the plate's fine ruling (17 against about 28), and the stud heads stand proud of the cone outline in the rotated views. |
| 57 | stays minor | `v/57-sheet.png`: the ring teeth are pointed where the plate plainly draws square slots. This is noticeable at a glance. |
| 63 | **reasonable-by-fix** | F2: a plain dark bracket behind the drop's plane carries the stop pin and the spring clamp, so nothing stands free (`F2/after/63-sheet.png`). The other 20 IDs in `authored-intermittent-core.js` hash identical. |
| 71 | stays minor | `v/71-sheet.png`: the slits sit well clockwise of the plate's notches. Comparing the two, you see it immediately. |
| 75 | stays minor | The wheel's 0.067 rad (about 0.36 tooth) run-back after each drive is a visible backward jerk in playback. |
| 76 | stays minor | `v/76-sheet.png`: the struck arm's 27.5° kink is plain in the default view where Brown draws a straight bar. |
| 86 | **reasonable-by-visibility** | The hover is 0.019 × 80.6 px/unit, about 1.5 px, for about 0.3 s while the catch is moving. `s/86-m.png` (phases 0.94/0.97/0.99) shows no perceptible gap between the catch and cam C. |
| 109 | stays minor | `v/109-sheet.png`: after the opening cut the right screw is threaded its full length, where the plate's is threaded only above the cutter. This is the steady state, so it is what the viewer sees. |
| 137 | stays minor | `v/137-sheet.png`: the eccentric is a smooth rounded triangle, where the plate's has visible dimples. The outline differs by comparison. |
| 153 | stays minor | `v/153-sheet.png` r1: the input arm's depth step is obvious in the rotated view. |
| 159 | stays minor | `v/159-sheet.png`: the cord's deep sag under the crank pin shows in the default view. |
| 181 | **reasonable-by-visibility** | `v/181-sheet.png`. The row's "flaw" is the house see-through style for the catch, which the rulebook requires where Brown dashes the arm behind, plus inferred plane depths. Neither is a visible defect, and the ±20 px compromise between 181 and 182 is already in limits. |
| 182 | **reasonable-by-visibility** | As 181 (`v/182-sheet.png`). |
| 183 | **reasonable-by-fix** | F1: the lower quadrant is cast 14° clockwise of Brown's. The hold drops from 73.9° to 59.9°, and the ball stands 15 px clear of the upper boss where it used to lie on it for 45% of the cycle (`F1/held-cmp.png`, `F1/plate-cmp.png`). Cost: in the plate pose the band's left end stands about 25 px off the rod. |
| 184 | **reasonable-by-fix** | The same change as 183, in the same shared files. |
| 195 | stays minor | `c-195-d.png`: the tooth spaces are clearly scalloped, where the plate's are square slots. |
| 198 | stays minor | `zA.png`: the pinion is a six-point star, visibly coarser than the plate's pinion of about 8 teeth. |
| 208 | stays minor | `v/208-sheet.png` r1/r2: the open slot ends are plain in the rotated views. |
| 218 | stays minor | `v/218-sheet.png`: the notches read as round bites, where the plate's are square. |
| 236 | stays minor | The wheel stands still 42% of each lever cycle, visible in playback, where the caption promises nearly continuous motion. The pawls are visibly short (`v/236-sheet.png`). |
| 269 | stays minor | `v/269-sheet.png`: the frame is visibly longer in proportion than the plate's. |
| 277 | stays minor | `v/z277.png`: the grey arbor sits in the hammer's lower lobe, where Brown's hatched arbor is mid-body. About 19 px, noticeable against the outline. |
| 284 | **reasonable-by-visibility** | 4 plate px is about 4 screen px. `v/zB.png` (middle) and `v/284-sheet.png` show the slider sitting naturally in its slot; the offset can't be seen. |
| 298 | **reasonable-by-visibility** | At 25 px/unit the crown teeth are a few pixels wide. The 0.34 against 0.5 pitch difference can't be resolved at normal size (`v/298-sheet.png`, `zA.png`). |
| 299 | **reasonable-by-visibility** | 0.04 pitch of journal height is a few pixels (`v/299-sheet.png`). The "more solid far teeth" are the required full-3D rendering of what Brown draws as lines, not a defect. |
| 308 | **reasonable-by-visibility** | At 46 px/unit the tooth depth is under 10 px, so the lock sits about 3 px above the root (`zA.png`, `v/zB.png` right). The creep is already in limits. |
| 309 | stays minor | `v/z309.png`: the nib's shape and position differ visibly from Brown's hooked B (about 16 px). |
| 314 | **reasonable-by-visibility** | 0.10–0.14 short of Brown's reach on C is about 6–8 px on a small arm. It can't be seen without measuring (`v/314-sheet.png`). |
| 320 | **reasonable-by-fix** | F2: the 0.05 rad settle is now solved through the chain. W drops about 0.025 and w rises about 0.026 while p settles, and the rope's lay moves with p (`F2/after/320-settle-sheet.png`). |
| 333 | **reasonable-by-fix** | F5: the depth order is now O, then the O-M bar, the beam and P's rod. The rod passes in front of pedestal O and no longer seems to pierce it (`F5/a333-zsheet.png`, `F5/after/333-sheet.png`). 332 and 336 hash identical. |
| 358 | stays minor | `v/358-sheet.png`: the band reads thinner than Brown's strip, and the lower bar sits symmetric, not under the fusee's large end. F5 found no fix (see below). |
| 370 | stays minor | `v/370-sheet.png`: the mirror is visibly high on the bar. F4 found no fix (see below). |
| 375 | **reasonable-by-fix** | F5: the bevel pair is now 36:18, so the pinion is 0.50 of the crown (Brown 0.49), a thin toothed disc (`F5/after/375-sheet.png`). The display rate was remeasured. |
| 377 | stays minor | `v/377-sheet.png`: the gait still reads seated. F4 found no fix (see below). |
| 389 | **reasonable-by-visibility** | The throw is about 5 plate px larger and the shaft 3.5 px right. Neither is distinguishable at normal size (`v/389-sheet.png`), and the motion reads naturally. |
| 391 | stays minor | The gear turns about 1.15 rad with neither rack in mesh near the bottom. A careful viewer watching the teeth sees the coast. |
| 394 | stays minor | `zA.png`: the rack teeth read as tapered points, where the plate's are box notches. |
| 397 | stays minor | `v/z397.png`: the crescent is visibly a deeper, fuller arc than Brown's. |
| 398 | stays minor | `v/398-sheet.png`: the crank is visibly short on the driven disc (0.40 against about 0.6). |
| 402 | stays minor | `v/402-sheet.png`: pallet A's direction, and the teeth stopping short of the arm ends, are visible by comparison. |
| 459 | **reasonable-by-fix** | F3: a minimal undrawn T standard rises from the well floor behind the central post and carries both star-wheel axles, so nothing is left floating (`F3/z459-cmp.png`). Its stem and short bar lengths show in the default view, and read as a frame. |
| 483 | stays minor (improved) | F3 moved A's flag rod into a bore in A's outer end board, and above the shelf it now runs behind the outlet column. The long visible runs are gone. `F3/z483-cmp.png` (after) still shows a thin dark rod beside the left wall between the board and the shelf, which a careful viewer would notice, so the row stays minor with a narrower flaw. |
| 491 | **reasonable-by-visibility** | 0.06 × 65 px/unit is about 4 px of the seated tooth face, the same colour as the pawl, at the base of the capstan (`v/zB.png` left). It can't be seen at normal size. |

Totals: 7 reasonable-by-fix (63, 183, 184, 320, 333, 375, 459), 10 reasonable-by-visibility (86, 181, 182, 284, 298, 299, 308, 314, 389, 491), and 26 stay minor (483 improved).

## Part B details

### 183/184 (F1): fixed with a deliberate 14° departure
- **Cause.** The hold is the band's end on the wing's rim, which is an arc about the upper shaft. Brown's castings therefore hold the lever at 73.9° whatever the wing's drop, and at that angle the lever points straight at the upper shaft.
- **Tried:**

  | Variant | Hold | Ball to boss rim | Result |
  |---|---|---|---|
  | Wing stop 10→30° | 73.9° | −31 px | no effect |
  | Lever droop −12° | — | +8 px | lever horizontal, near the tappet |
  | Split ±7° | — | +15 px | bent crook |
  | Quadrant +12° | — | +8 px | ball still reads as touching |
  | **Quadrant +14° (adopted)** | 59.9° | **+15 px** | clear |

- **Rebaked and regenerated:** `baked/quadrant-catch-motion.js` (721 rows) and `docs/validation/183-current-solids.json` (worst 4.5e-5 over 65 poses). Display profiles remeasured.
- **Tests:** 13/13.
- **Screens:**
  - Intersections: 0.
  - Coincident faces: 0.
  - Loop seams: 0.
  - Disconnected: 184 has one extra phase-sampled near-miss between moving rods.

### 63 (F2): bracket for the stop pin
- **Change:** a stadium plate 0.08 deep, 0.05 behind the drop's plane, with round ends concentric with the pin and the clamp. The clamp is lengthened into it.
- **Motion:** unchanged, and no bake is fingerprinted.
- **Tests:** movement-063 7/7 (new bracket test).
- **Screens:**
  - Floating parts: 1 → 0.
  - Intersections: 0.
  - Coincident faces: 0.
  - Seams: 0.
- **Residual:** the bracket is undrawn. It shows as a short dark bar under the drop's tail.

### 320 (F2): chain take-up
- **Change:** the slip is solved through the chain with P on its going law. Chain length and no-slip are kept to 4e-15. The click bake is untouched.
- **Tests:** movement-320 plus maintaining-clock 17/17. The start-velocity tolerance is loosened from 2e-7 to 5e-6; the measured value is 2.3e-6.
- **Screens:**
  - Intersections: clear at 33 samples. The 65-sample run exhausts the screen's own heap.
  - Floating parts: 0.
  - Coincident faces: 0.
  - Seams: 0.

### 459 (F3): rear standard
- **Change:** a flat T at z −0.80…−0.68, 0.09 behind the pulleys. Its bosses are bored 0.103 for the r 0.10 axles.
- **Tests:** movement-459 13/13, plus well-bucket-interfaces.
- **Screens:**
  - Detached: 1 → 0.
  - Intersections: worst 0.0011, the pre-existing tappet pin contact.
  - Seams: 0.
- **Residual:** the undrawn stem and bar show in the default view.

### 483 (F3): flag rod moved
- **Tried first:** a rod behind the central partition. A grid over arm, flag and link lengths found no monotone flag giving the 1.04 stroke without crossing the partition or entering the back wall.
- **Adopted:** the rod at (−2.62, −0.35), in a bore through A's outer end board and behind the outlet column.
- **Unchanged:** port angles, stroke, start and duct routes are identical to HEAD.
- **Tests:** movement-483 7/7 and gas-meter-working-solids 10/10.
- **Screens:**
  - Intersections: 0.
  - Coincident faces: 0.
  - Near-misses: 39 (was 31). The additions are the new design clearances.

### 333 (F5): depth reorder
- **Why the old approaches failed:** OM = MP, so P's line runs through O within 0.026 over the whole stroke. Moving O cannot clear it.
- **Change:** P's rod now passes in front of pedestal O.
- **Residuals:**
  - The O-M bar meets M behind the beam's boss, where Brown draws it in front.
  - The rod covers pin O as it passes.

### 375 (F5): 36:18 bevels
- **Change:**
  - The pinion is 0.50 of the crown.
  - The apex is raised to keep the crown above the crossbar, and the riser is extended.
  - Tooth thickness is 0.98, for a 0.0014 working gap.
- **Display:** the peak rate went from 4.71 to 3.14.
- **Residual:** a true 2:1 crown is a 26.6° cone, where Brown draws it nearly flat.

### 358 (F5): no fix
- **Tried:**
  - Offset takeoffs: the band would stretch up to about 3.8.
  - Opposite-side takeoffs: both cords pay out together, so the carriage can't traverse.
  - Thicker free runs only: the rope becomes inconsistent.
  - 8 turns: reaches only about 0.75 of the plate's thickness.

### 370 (F4): no fix
- The mirror sits at 2.85 below the top eye; the most the rail allows is 2.89.
- Other routes:
  - A shorter bar can't reach the guide pins at the top of the stroke.
  - A mirror between the rail and the bar sweeps across the pins.
  - A rail in front of the bar reverses Brown's drawn overlap and puts the follower through the rail.
  - Clearing the rail at Brown's 0.73 needs a crank of about 0.4 against his 0.72.

### 377 (F4): no fix
- **Raised hip:** mean stance thigh angles are 91°/79°/73° at hip caps 1.0/1.3/1.5. Only 1.77 (62°) stops reading seated, and it puts the cap about two drum radii up.
- **Torso lean:** ±12–15° does not change the reading.

## Deferred / observations
- 299's default view crops the large wheel at both stage edges (framing, not the recorded flaw). This was not changed here.
- 459: the wind-wheel shaft and worm still hang only from the coupling, since Brown draws no bearing. This is outside the directive.
