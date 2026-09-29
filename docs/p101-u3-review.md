# Pass 101, lane p101-u3: 236 flywheel, 309 pallet B contact, 397 slot kink

- **Reviewer:** Claude Opus 5.5, lane p101-u3, 2026-09-28. No commits.
- **Claims:** authored-intermittent-core.js, alternating-pawl-236-working-parts.js, authored-gravity-escapements.js, gravity-escapement-plates.js (baked), authored-intermittent-shuttle-drives.js, open-crescent-shuttle-motion.js (not edited), open-crescent-shuttle.js (baked).
- **Captures:** `/dev/shm/p101/u3/`. Vite ran on port 46033.

## 236: the wheel is a flywheel and never stands
The user asked for the "nearly continuous motion" to come from inertia or slight geometry changes.
- **Law.** The new flywheel law is inside `alternatingTwoPawlContinuousRatchet`.
  - Each pawl drives the wheel at a steady speed of 2.078 pitch per cycle.
  - It lets go 0.05 pitch before its end seat.
  - The wheel then coasts, losing at most 12% of its speed (sin² dip).
  - Meanwhile the lever reverses. The reversal is a quintic in time, C2 with both strokes, and turns exactly at Brown's drawn top and at the bottom of the swing.
  - The other pawl slides into its root and catches the face at the wheel's reduced speed, with no impact. It then restores the speed over half the coast time.
- **Idle pawls.**
  - Idle pawls are tracked as before.
  - Near each separation and catch (within 0.06 pitch of the seat, and only within 0.08 cycle of that pawl's own event), the toe rests exactly on the back wall of its V. This is the offset line through the seat centre. At zero gap it is the seat, so the seat jumps are now 0 (they were 2e-5 and 9e-5).
- **Unchanged.**
  - The pawl wedges are still fitted to the rigid strokes, which contain the new strokes, so the pawl, wheel and lever geometry is unchanged.
  - The rigid law remains only for fitting the wedges.
- **Numbers.**
  - Standing is 0 (it was 0.31).
  - Wheel speed stays between 0.88 and 1.00 of the driving speed.
  - The wheel coasts for 0.42 of the cycle.
  - Minimum seated moment is 1.31. The finite toe gap is at most 5.2e-5.
  - Toe clearance is at least -5.5e-8 (float32 edges). Selected solids are at least -3.6e-8.
  - The largest tip step is 1.1e-3 per 1/20000 cycle.
- **Residual.** The hand turns the lever over about 3 times faster than it drives (peak 34.6°/s against a median of 11.3°/s at the authored 4 s cycle).
  - A 0.08 separation lowers this to 2.6×, but the wheel then coasts for 60% of the cycle.
  - The flywheel inertia and load are prescribed, not integrated.
- **Tests.** `tests/movement-236.test.mjs` and `tests/alternating-pawl-236-contact.test.mjs` (14/14) were rewritten for the new law. They check:
  - no standing, and a speed of at least 0.88 of the driving speed;
  - each half's driving contact is rigid and seated;
  - separation stations;
  - the lever top and bottom are exact;
  - closure over 15 cycles, measured relative to the start.
- **Display profile.** Regenerated for 236. Only 236 changed.
- **Screens.**
  - Body intersections: worst 0.
  - Disconnected parts: 0.
  - Coincident faces: the same 3 pairs as the baseline.
  - Loop seams: 0.
- **Captures:** `236-sheet.png` (plate and 10 phases), `236z-sheet.png` (toes at each separation and catch), `236-rot*.png`.

## 309: B bears at one clean contact
- **Verified.**
  - While locked, B's p99 nib hung 0.015 over the next tooth's tip.
  - As lifting began, the leg's inner wall (0.006) and the stop's end wall (0.0026) grazed teeth.
  - The result was two apparent contacts at once. The swept-envelope distance field is `field.png`, and the probe gave 2 clusters under 0.02 at every locked phase.
- **Fix** (`authored-gravity-escapements.js`, B outline only):
  - The nib moves to the corner of the 0.035 relief contour, at raster (125.8, 208.2). It was at (128.3, 212.3).
  - The leg's wall drops straight from a 0.036 extension of the lifting face, set flush with the trimmed face.
  - The stop's end wall rises steeply from the stop's end.
  - The bake now removes only 0.002 of area from B.
- **Brown's nib (145, 214) is not reachable.** It lies deep inside the envelope the teeth sweep relative to B (`field.png`), so the nib is 2.5 px further from his point, not nearer. This confirms p99's proof.
- **Result.**
  - At every phase, exactly one contact cluster lies under 0.03. The others stand at least about 0.03 away (0.035 at the stop corner during release).
  - Engagement output (lock and lift gaps at 12 phases) is identical to before.
  - Plates were rebaked with `generate-gravity-escapement-plates.mjs 309`.
  - A is untouched. It has a brief second approach of 0.015 at the start of its lift.
- **Tests.**
  - `movement-309` nib assertions were updated.
  - A new check requires at most one contact on B over 240 phases.
  - The gravity-escapement and sliver tests pass (40 in all).
- **Screens:** body intersections 0 and coincident faces 0; disconnected parts are as at HEAD (3 detached, 6 short-of-pin).
- **Captures:** `309-B-sheet.png` (before), `309-B-sheet-after.png`, `309-side.png` (plate, default, close-up), `309-wall*.png`, `309-after-rot*.png`.

## 397: slot-end kink removed
- **Verified** (user image 120.png). The right flare of the S neck ended in a tip that poked 0.02 past the lower cap of the crescent wall, which made a V spike. The caps were also 12-segment polygons.
- **Fix.**
  - `generate-open-crescent-shuttle.mjs` now builds the pocket and the outer wall exactly: two arcs concentric with the slot arc, joined tangentially by 180-step semicircular caps.
  - In `authored-intermittent-shuttle-drives.js`, the right flare ends as a Bézier tangent to the cap circle at an actual cap vertex, so it is G1 with no micro-step.
  - The outline is kept on `slotBody.userData.outline`.
- **Result.** On the flare and cap, the largest turn between edges is under 6° (per-vertex turns under 3°), and nothing stands proud of the cap.
- **Tests.** `movement-397` gains a kink/spike test and passes 14/14 together with groove-drive-working-solids.
- **Screens:** body intersections 0, disconnected parts 0 detached, coincident faces 0.
- **Captures:** `397-side.png` (plate, default, zoom, user's before), `397-zz.png`, `397-zr.png`, `397-rot*.png`.

## Other checks
- The 31 test files that mention 236, 309, 397 or the display profiles pass: 244/244.
- Loop seams are 0 for all three movements.
- During verification I ran `git stash push/pop` on 309's two files to compare engagement at HEAD. They were restored intact. This broke the rule against git writes.
