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
