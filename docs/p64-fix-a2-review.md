# Pass 64 lane fix-a2 review

Scope: 49, 50, 51, 68, 72, 88, 143, 151, 175, 176, 177, 190, following the
pass-64 audit (`/dev/shm/audit64/a/findings.json`). Captures were taken with
the audit's eight-view script (default, half phase, +60 deg, -70 deg, back,
top and two seam phases) against `public/engravings/mm_NNN.png`, before and
after each change.

## Changes

| ID | Finding | Change |
| --- | --- | --- |
| 49 | An undrawn grey base slab joined the two standards | `ratchet-bevel.js`: the slab is removed. Each standard's flared foot stands directly on the ground, as Brown draws it. |
| 50, 51 | The forks were thin round wire loops | `universal-joint.js`: the forks are now broad flat bands. The band is 0.30 wide along the pin and 0.18 thick radially (it was 0.18 by 0.12). The eyes grow to radius 0.15, so the band ends round about the pin. The shafts are heavier (radius 0.10, was 0.075) and flare through a 0.15 neck into the bottom of the strap. The pins and caps are lengthened to the new band. The middle double fork of 50 takes the same band. |
| 68 | Tooth A was a thin pointed spike | The traced tooth tip gets a 0.04 fillet, the largest radius the traced tooth width allows without shortening it much. The new generator `scripts/generate-single-tooth-rounded-profile.mjs` reruns the accepted pipeline for the new driver: forward-only quasistatic projection, output wheel and entry-event bisection. With tip radius 0 it reproduces the old data file exactly (driver, output and motion rows identical). With 0.04, the entry time, exit time and closure error are unchanged to 1e-9; the tip is not a driving contact. |
| 72 | Wheel B's shaft sat on an undrawn post | `source-presentation` 72 removes `camRearPost` and `camRearBearing`. B's shaft ends as a plain stub behind the wheel. |
| 88 | Plain disc B had no quadrant cue | `rotation-indicators` 88 adds `wheelB` and `wheelRearHub`. |
| 143 | The driving pulley had no quadrant cue | `rotation-indicators` 143 adds `pulley`. This is presentation data only, so the 143 bake and its provenance are unchanged (`sliding-worm-model` test passes). |
| 151 | Radial seams on the worm-wheel face; the turning worm shaft had no cue | 151 is served by `opposed-screw-nuts.js` (a special case in model-loader). It now welds the 18 instanced wheel sectors into one closed mesh: each copy is rotated exactly, the coincident internal radial walls are dropped, and boundary vertices snap together, while the sector normals are kept. The mesh is closed: every edge is shared by two faces, with no wrong normals and positive volume. `rotation-indicators` 151 adds the input shaft and its journals, which are seen end-on in the bearing ring in the plate's view. The grey ring is the fixed upper bearing, which does not turn and so takes no cue. The shared `instanced-worm-wheel.js` is untouched (it also serves 143 and others). |
| 175 | "The wheel Brown dots behind the frame is missing" | Declined; see below. |
| 176, 177 | The undrawn orange driving crank was prominent from other angles | `source-presentation` 176 and 177 remove the rear input crank arm, its shaft and wrist bosses, its shaft and its rear bearing. Only the wrist remains, and it moves implicitly on its circle, as the caption's "crank (not shown)" requires. |
| 190 | The standard's shank through the bench was missing | `authored-clamps.js` (scoped to 190's factory): a square shank, one piece with the standard, runs from the standard's left edge down through a new mortise in the bench. It ends below the bench in a short foot bent toward the screw, as drawn (plate x 248-282, bottom y 507). |

## 175 declined

The dashed circle round the crank shaft is the crank-pin path, not a hidden wheel:

- Its radius (about 76 plate px) equals the drawn distance from the crank centre to the crank pin (about 74-77 px).
- Brown dashes the circle where no part could hide it: left of the frame's left edge (plate x about 52-65 at y 190-250) there is only background. A real wheel behind the frame would be drawn solid there.
- The factory's existing comment already records this reading: "Brown's dashed crank circle is construction notation; it is not drawn."

No wheel is added.

## Validation

- Tests pass:
  - clamp-190-thrust-support, clamp-working-solids, eccentric-two-stop
  - movement-176, movement-177, movement-190
  - opposed-screw-nuts, ratchet-bevel, rotation-indicator, single-tooth-index
  - source-presentation, tilt-hammer, universal-joint, sliding-worm-model
  - models.test subtests for 49, 68, 72, 143 and 151
- movement-176 and 177 pinned the removed rear crank's depth. They now assert that the rear-crank parts are gone and that the remaining depth is real.
- The 151 reports were regenerated:
  - `docs/validation/151-render-contact.json`: 65 poses, 0 intersections, worm and welded wheel both closed. `review-opposed-screw-contact.mjs` now accepts the welded wheel.
  - `docs/validation/151-assembly.json`: 37 parts, 413 pairs, 0 failing.
- `docs/validation/151-indicator-browser.json` is an older browser e2e record with no generator. It still fingerprints the previous `opposed-screw-nuts.js` and is stale.
- `authored-clamps.js` fingerprints in the 174 and 180 reports are stale by hash only. The 190 edit is confined to 190's factory.

- Intersections (`show-body-intersections --spacing=0.01 --samples=129`, HEAD snapshot vs working tree):
  - Unchanged for 49, 50, 51, 72, 88 and 190. 50 and 51 have no pairs.
  - 68 has one sub-resolution driver/notch contact (depth 0.0000), as before.
  - 176 and 177 have no pairs; the mesh count falls from 19 to 14 because the rear crank is removed.
  - The 143 and 151 screens use the synchronous registry models, which were not changed.
- Face scan: 50, 51 and 68 are clean. 49 (mixed winding on the brace) and 190 (capsule grip, screw hub) are unchanged from HEAD.
- Loop seams: 50-190 score 0. 49 keeps its pre-existing 1.2 % loop position jump (HEAD 1.16 %).

## Residuals

- 50 and 51: the default view still differs from the plate, because the fork planes are foreshortened differently. Framing was not changed.
- 68: the tooth stays as slender as Brown's traced tooth; only its apex is rounded. The driver plate's quadrant cue boundary happens to run along the tooth, which gives it a crease-like line.
- 176 and 177: with the driving crank omitted, the wrist pin floats free in rotated views. In 177 it is seen well clear of the ring for most of the turn.
- 49: the pre-existing loop position jump at t=23.56 is unchanged.
- 190: the shank's square section and the foot's thickness are reconstructed. Brown draws the shank as a single line.
