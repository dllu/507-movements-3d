# Lane m19-audit-c: audit-52 visible flaws in rows rated reasonable (262, 265, 289, 321, 336, 376, 377)

A fresh audit (`/dev/shm/audit52/c/assessment.json`) found visible problems in seven rows the ledger rates reasonable.
Captures came from a private non-watching Vite server (port 44348) using `scripts/review-movement-source-views.mjs`, plus 4-phase stills.
They are stored in `/dev/shm/m19/{before,after,ph}` and are not in Git.
Intersections were screened with `scripts/show-body-intersections.mjs ID --spacing=0.01 --samples=129`.

## Changes

| ID | Change | Intersections | Proposed |
|---|---|---|---|
| 262 | **Problem:** at Brown's proportions, B's offset lowers its rim 26 px (of a 55 px radius) half a turn after the plate pose, so B hid the whole stand. **Fix:** standard E's foot plate now spreads 48 px either side of the neck (Brown draws 36) and sits 3 px lower. Its ends and the flaring leg roots stay visible beside B at every pose, so B always sits on the foot. Movement 263 uses its own pedestal and is unchanged. | clear → clear (cone/roller working contact 0.0000 only; 263 the same) | reasonable |
| 265 | **Problem:** the roller shaft followed the local drum tangent and swung through about 15°. **Fix:** the shaft now keeps Brown's fixed slope (the generator tangent at his contact station) and slides endwise with the roller. The rounded tread rides the concave drum, so the shaft only rises and falls parallel to itself, as a spring-pressed shaft would. The tread torus has 20 tube segments so the contact up to about 12° off its lowest point stays on the mesh. Tests now check contact on the tread tube and the fixed axle direction. | clear → clear | reasonable |
| 289 | **Problem:** the teeth were thin spikes, and the arch sat over the upper tips. **Teeth:** they are now ratchet-shaped and nearly touch at the root. Each has a long back slope to the unchanged forward-leaning tip and a short front face. The root is 30 px deep, as drawn. **Arch:** its inner edge between the pallet shoulders is a smooth curve that clears the tip circle by 14 px at the top, leaving Brown's thin top band. Its outer edge is smoothed by corner cutting. **Pallets:** the backing was rebaked (`export-deadbeat-contact.mjs` then `generate-deadbeat-contact.py`). Both working faces stay within 0.0006 of the analytic curves, and the kept-area ratios are 0.966 (left) and 0.972 (right). | clear → clear | reasonable |
| 321 | **Problem:** a winding turn lifts the weight a full drum turn above its plate-pose height, and Brown hangs it just under G, so the wound weight rose over the teeth. **Fix:** the rope drum is smaller (pitch radius 0.20, was 0.34; it is still outside the bored arbor). The weight hangs so that at the top of its travel it stays 0.1 below G's tips. The camera bounds now include its lowest point. The test for the weight's plate-station height is replaced by two checks: the weight never comes within 0.08 of G's tips, and at the plate pose it is lower than Brown's station by less than half a drum turn. | known (seated spring ends 0.091 only) → unchanged | reasonable (weight 0.67 lower than drawn at the plate pose) |
| 336 | **Problem:** the camera bounds cropped the swept crosshead (top 4.89) and the lever's pin end (bottom −1.36). **Fix:** the bounds now include both. The crosshead stays in view at the top of its stroke (maxNdc 1.067 → 0.866). The subject is about 20% smaller. | clear → clear | reasonable |
| 376 | **Problem:** the horse was a toy figure. **Fix:** it is now modelled from rounded side-view outlines drawn to Brown's horse: a deep barrel with chest and rounded croup, a crested neck carried forward, and a long head with the nose dropped. The legs have tapered forearm or gaskin segments, cannons with fetlocks, round knee caps and hooves. The tail is a flowing tapered strand. The gait, bobbing and hoof contact are unchanged. The leg tops are round about the hips so a swinging leg never rises into the belly. `neck` is now exported in `blocks`, so the axle-clearance test covers it. | clear → clear | reasonable |
| 377 | **Figure:** the walker is remodelled. He now has a lathe-turned jacket with broad shoulders and a hem just above the hips, a neck and head, and a closed round cap with a band. His arms bend up to the rail through wide elbows and have hands. He wears darker trousers. The hips moved out to ±0.20 so the raised thigh passes beside the narrower lower jacket. **Post:** the slanted post (Brown's flat plank) now stands in front of the drum between the spur wheel and the man. Its top is above the wheel's right rim, and its foot is on the ground just left of his feet. It lies in the plane x = 1.16, clear of the boards, rail and man. | clear → clear (the arm tubes and rail remain open tubes, as before) | reasonable |

## Residuals

- **262:** Brown's foot is narrower (36 px either side against 48), so the plate-pose foot is a quarter wider than drawn. At his width, B's offset hides the whole stand for half of each turn.
- **321:** The weight hangs 0.67 lower than drawn at the plate pose. To stay clear of G after winding, it must hang at least a drum half-turn below the wound position.
- **336:** The crosshead and the lever's pin end stay in view, so the frame is about 20% taller than the plate crop.
- **377:** The figure is still smaller than Brown's man (FIGURE_SCALE 0.8 against the drum) and his legs are slimmer than the engraved trousers. The thigh and shin radii are limited by the jointed-leg clearances.

## Tests run

All passed:

- movement-265, cone-friction-solids, movement-262, movement-263, movement-289, deadbeat-working-contact, anchor-escapement-working-solids, movement-288, movement-303
- movement-321, maintaining-clock-interfaces, maintaining-clock-bake
- movement-336, marine-parallel-solids, engines-326-345-clearance
- movement-376, movement-377, treadwheel-working-solids, treadmill-gait-solids, source-presentation

No docs/validation report fingerprints these files.

## Follow-up (321, 377)

| ID | Change | Intersections | Proposed |
|---|---|---|---|
| 321 | **Measurement:** Brown's weight box top (raster 451) is only 13 px below his G's lowest teeth (438). Our G reaches that height, so the weight has to be near the top of its travel at the plate pose. **Why the old setup could not:** the lift from the plate pose (t = 0, R just re-engaged) to the post-winding top equals the rope paid out during winding and recovery. That was half a drum turn (0.63). **Fix:** winding still takes an eighth of the cycle, keeping the spring's 45° lag and its visible hairpin opening. It now starts on a whole larger-ratchet tooth (19/24 to 22/24 of the cycle). The spring recovers in the last twelfth. The lift is now 5/24 of a drum turn (0.26). At the plate pose the weight's top hangs 0.34 below G's tips (Brown: 0.19 below his G), and at the top of its travel it clears the tips by 0.08. The plate-pose centre is 0.28 below Brown's station (was 0.67). **Tests:** the landmark test now checks the station within the new lift and tolerance, and that the weight's top never reaches G. The canonical times are computed from the phases. The hairpin test also samples the exact end of winding. | known (seated spring ends 0.091 only) | reasonable |
| 377 | **Scale:** the figure is scaled up to Brown's man. The jacket, head and arms use scale 1.2 (was 0.8). The trouser legs are full: thigh 0.74 long with radius 0.09, shin 0.70 with radius 0.075. A trouser seat joins the hips. **Knee:** thigh and shin are now coplanar, with a lay-figure knee. The thigh ends in a knee ball, and the shin's top sits just under it. Past a right-angle bend, the shin's top slides down just far enough to clear the thigh; the pivots, lengths and ankle stay exact. **Lean and rail:** the upper body leans 18° toward the drum about the hip line. The hands grip the rail at chin height in front of the face. **Gait:** the stepping band moves lower (touchdown 18°, was 30°). The hip stands at (2.5, 0.75) from the axis; a sweep showed this is the closest station where the long legs clear every board. The board phase at t = 0 is set (wheel start 14.4°) so the plate pose has one leg at the end of its stance and the other knee raised onto a higher board. The stepping stays locked to the boards. **Ankle:** in the air, the ankle turn is eased from 60° toward 63° (the raw gait reaches 79°), so the shoe clears the cuff. Planted soles still lie flat on their boards. **Helper:** `treadmill-gait.js` (used only by 377) takes an optional `touchdownAngle`. **Tests:** the pinned leg lengths are updated. The touchdown-continuity test now uses the actual touchdown angle; it had hard-coded 40° and missed the stance edges. | clear → clear | reasonable |

**Follow-up residuals:**

- **321:** The weight hangs 0.28 lower than Brown's box centre, because our G is 0.2 larger at the bottom than his.
- **377:** The standing leg reaches forward to the drum instead of standing straight under him. The hip must stand about a unit out from the boards so the long bent knee clears them. The shoe turn in the air is eased rather than following the gait's sole angle.

**Follow-up tests (all pass):** movement-321, maintaining-clock-interfaces, maintaining-clock-bake, movement-377, treadmill-gait-solids, treadwheel-working-solids.

## Posture pass (377)

**Asked for:** Brown's upright stance, with the torso vertical, the standing foot directly under the hips and the other knee raised.

**Result:** the torso is now upright (lean 0, was 18°). The hands grip a rail just above and in front of the cap, with the elbows raised. The legs, gait timing and board clearances are unchanged.

**Forced residual: the standing foot cannot be under the hips.**
- Each sole sits on a radial board. The next board up (25.7° higher) has its tip at r = 1.68, overhanging the foot.
- So the standing shin must leave the ankle leaning at least about 20° away from the drum. A knee bent toward the drum always drives the shin into that board.
- A sweep confirmed it. Hips from x = 1.8 to 2.1 and y = 1.2 to 1.8 above the axis, legs from 0.74/0.70 to 0.84/0.80, and touchdown from 22° to 30° all either exceed leg reach or push the shin 0.03–0.23 into the board above.
- The hip must therefore stand about a unit out from the boards (2.5, 0.75), and the legs reach forward to them.
- Brown's drum has about 25 level, stair-like treads, where a foot can sit under the man. Matching that would mean redesigning the drum's 14 radial boards (their count is pinned by tests and the mechanism description), so it was not done here.

**Checks:** intersections clear (0.01 spacing, 129 poses). movement-377, treadmill-gait-solids and treadwheel-working-solids pass.

## Integration note (lead)

The 24-tread drum redesign for 377 was not accepted (kept in git stash "377-drum-redesign-rejected"): it stood the walker on the drum top, well above Brown's axle-height station, and his thigh and shin segments separated visibly at the knee. 377 keeps the committed upright walker on radial boards and stays minor.
