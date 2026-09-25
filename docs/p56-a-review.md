# Pass 56, lane p56-a: movements 1-127 (26, 32, 48, 52, 53, 86, 89, 90, 91, 95, 96)

Reviewer: Claude Opus 5.5 (lane p56-a), 2026-09-25.

Sources: the findings in `/dev/shm/audit56/a/findings.json` and the tiles in the
same folder, plus the `visibleFlaws` for each ID in `docs/movement-status.json`.
After the fixes, every ID was captured on the production route in eight views:
the plate, the default view at two phases, rotated +60 and -60, back, top, and a
2.4x zoomed-out oblique. The captures are in `/dev/shm/m56a/final/t<ID>.png`
(scratch, not committed). Intersections were screened with
`scripts/screen-production-intersections.mjs` at 0.01 spacing and 129 samples;
86 used 0.025 spacing and 65 samples because the finer screen ran out of memory.

New helper: `src/simulation/wall-guide-hardware.js` (`wallGuide`). It builds a
bored guide boss with a narrow web running straight back to a framing member. In
the plate's front view the web is hidden behind the boss and the rod. Only this
lane's IDs (90, 91, 95, 96) use it.

## Changes

| ID | Change | Worst intersection before -> after |
|---|---|---|
| 26 | The crown wheel's face teeth now share the wheel body's material, so the wheel and its teeth are one blue wheel. Before, the teeth were a separate near-black material. | sampled-clear -> 0 (no solid pairs) |
| 32 | Only one wheel is faced, as Brown's text says ("one is sometimes faced with leather"). The small driver wears a matte tan leather band round its rim. The large wheel is one plain body with a rough matte tread in its own colour. The near-black tyres on both wheels are gone. | sampled-clear -> 0 |
| 48 | The vertical operating rod keeps Brown's section and continues whole to the operator's hand (plate 12's hand, rope tail removed, scale 0.8), which grips it well below the plate. The bell-crank fulcrum pin's shank runs back to a small flange on the framing behind the clutch (`pinWallBracket`). Default framing is held by `cameraFitBounds`, set to the previously measured swept box. | pins in bores at 0.002 -> 0.0020 coaxial (running clearance), no solid pairs |
| 52 | The lever handle no longer tapers to a spike. It runs at even width 0.62 past Brown's break to a round-ended grip. The fulcrum pin's shank runs back to a small flange on the framing. Framing is held by `cameraFitBounds`. | sampled-clear -> 0 |
| 53 | The hanging operating rod tapers over Brown's drawn length, then continues at even width to a hand (scale 0.5) well below the plate. The fulcrum pin's shank runs back between the bevel wheels to a small flange on the framing. Framing is held by `cameraFitBounds`. | sampled-clear -> 0 |
| 86 | Two stout hangers (r 0.04) continue the pillar lines from the guide crossbar down to the lower bed, which is widened to +/-0.46. The bed and the pump barrel under it now hang from the frame instead of from the thin guide rods only. The candidate lib is mirrored. | zero-depth working contacts -> 0 (fixedTripStop/hookedCatchB contact) |
| 89 | The pale inset disc is gone. The raised sheave face is now the same material as the sheave, so it reads as a low cast step. | sampled-clear -> 0 |
| 90 | The rods run on whole past Brown's break into fixed guides just past the plate edge (centre +/-2.62). One plain tie bar behind the rods, hidden by them in front view, carries both guide webs and the shaft's rear bearing. It has a round boss hidden behind the sheave. The source-presentation `remove` list is dropped. Framing is unchanged (same x = 2.97 box). | 0.00001 -> 0.00001 (yoke/sheave working contact) |
| 91 | Same scheme with an upright tie bar. Each rod end stays at least half-way into its guide bore at full retraction and passes out at full extension. The earlier visible frame (posts and crossbars) is removed. Framing is unchanged (same y box). | 0.00031 -> 0.00030 (liner0/cam intended contact) |
| 95 | The rod continues whole past Brown's top crop into a guide just above the plate edge. A web carries the guide back to a slender post (0.1, narrower than the rod) standing on the wall top, directly behind the rod. The wall's depth is extended back to z -1.35 so it can carry the post. The run past the crop is a child mesh of the drawn rod, kept out of the native mass so the validated dynamics are unchanged. | 0.00002 -> 0.00003 (disk/roller working contact) |
| 96 | The bar is split into Brown's drawn length (to 2.22) and a coaxial run on to 2.70, which passes through two guides just past the plate's right edge. The webs sit on a plain rear frame bar, hidden behind the bar, that also holds the cam shaft's rear bearing. The spring and spring seat stay undisplayed. | 0.00006 -> 0.00006 (cam/roller working contact) |

Parts past the crop are flagged `userData.beyondPlateCrop`, or
`beyondPlateCropBelowY` for the rods of 48 and 53. They stay out of the plate
framing and out of the per-model camera-bounds tests. Default views frame the
same boxes as before; the checks below confirm this.

## Visual verdicts (production captures)

- 26: one blue crown wheel with blue teeth in every view. Reasonable.
- 32: tan leather band on the driver only; the large wheel is plain. Faces are plain in every view. Reasonable.
- 48: the rod runs off the bottom of the default view. The hand is visible only on zoom-out or in the top view. The flange sits behind the pivot. Rotated views show a small flange plate on framing that is not modelled.
- 52: an even-width handle with a round grip end. The flange shows only in rotated views.
- 53: the rod runs off the bottom. The hand shows on zoom-out and top views. The flange sits far back between the wheels.
- 86: from the far oblique, the bed and barrel hang on four rods from the crossbar; the outer two are visibly heavier.
- 89: uniform orange sheave with a subtle raised boss. Reasonable.
- 90: the guides appear at the extreme left and right of the default view, just past the plate edge. The tie bar shows only from the back and top.
- 91: the guides appear at the top and bottom edges of the default view. The tie bar shows only from the back and rotated views.
- 95: the guide shows at the top edge of the default view. A short sliver of the post shows between the disk's lower edge and the wall top.
- 96: the guides and a narrow strip of the rear frame show just past the plate edge on the right.

## Residuals (honest)

- 48, 52, 53: the fulcrum flanges stand for machine framing that is not modelled. In rotated views each reads as a small plate on unseen framing. A floor column was tried and rejected, because it adds a prominent undrawn upright below the pivot in Brown's default view. The main shafts of these clutches still have no bearings; that was not in the findings.
- 90, 91, 96: each tie bar is a self-contained frame member. It carries the guides and the shaft bearing, but is not itself grounded.
- 95: the guide post is an inferred support. The rod's run past the crop is massless in the physics (a visual child of the drawn rod).
- 91: the rod's run past the crop adds yoke mass. The timestep and chord refinement test still passes (0.081 / 0.048 px).
- 89 (not in findings): the rod still ends at its open wrist eye with no crosshead, because presentation removes it.

## Proposed ledger text

- 26: assessment reasonable. visibleFlaws: none. limits: unchanged.
- 32: assessment reasonable. visibleFlaws: none. limits: "Friction transmission assumes ideal geometric rolling rather than calibrated traction; which wheel carries the leather facing is inferred."
- 48: assessment minor. visibleFlaws: "The fulcrum bracket's flange sits on framing that is not modelled (visible as a small plate when rotated)." limits: add "Operating rod continued to an inferred operator's hand below the plate."
- 52: assessment minor. visibleFlaws: "The fulcrum bracket's flange sits on framing that is not modelled (visible when rotated)." limits: add "Handle continued past Brown's break to an inferred grip end."
- 53: assessment minor. visibleFlaws: "The fulcrum bracket's flange sits on framing that is not modelled (visible when rotated)." limits: add "Operating rod continued to an inferred operator's hand."
- 86: assessment reasonable. visibleFlaws: none. limits: "The pump barrel and hangers below the bed are inferred; pump internals not modelled."
- 89: assessment reasonable. visibleFlaws: none. limits: unchanged.
- 90: assessment reasonable (or minor if the edge guides are judged undrawn). visibleFlaws: none. limits: "Guides, rod runs, tie bar and rear bearing inferred past the plate edge; the yoke is a true ellipse..." (keep the MuJoCo note).
- 91: assessment reasonable. visibleFlaws: none. limits: "Guides, rod runs, tie bar and rear bearing inferred past the plate edge; opening corrected by up to 3.36 px."
- 95: assessment reasonable. visibleFlaws: none (a short sliver of the guide post shows between disk and wall). limits: "Rod guide on a post on the extended wall inferred; the rod's run past the crop is massless in the native model; roller reconstructed."
- 96: assessment reasonable. visibleFlaws: none. limits: "Bar run, guides and rear frame inferred past the plate edge; physics keeps the undrawn return spring; smoothed reversals."

Intersections: all IDs sampled-clear on the production route (numbers above).
MuJoCo: 90, 91, 95, 96 remain live; the others are unchanged (none).

## Tests run

All passing: jaw-clutch, pin-clutch, reversing-clutch, pump-catch (pinned part
count 45 -> 47 for the two hangers), eccentric-strap, mujoco-eccentric-yoke,
mujoco-triangular-eccentric (rod-end assertion now checks at least half guide
engagement), mujoco-inclined-disk (rod-top assertion now uses `g.rodTop` and the
plate edge), mujoco-heart-cam, crown-gear-contact, source-presentation,
opening-camera-motion, gears-24-46-source-match, opening-gear-contact,
one-way-clutch-working-solids, and the models.test blocks for movements 26, 32,
48, 52, 53, 86, 89, 90, 91, 95 and 96. The bounds tests in the four MuJoCo test
files now skip parts flagged `beyondPlateCrop`.

The whole-file sha256 fingerprints of `authored-gears-core.js` were regenerated:
`docs/validation/200-226-bevel-solids.json`, `202-264-worm-solids.json` (POSES=33)
and `191-196-201-contact.json`. Results are identical and only the hash changed.
The fingerprint covers the current file, including other lanes' uncommitted
edits. bevel-200-226-solids, special-worm-solids, irregular-gear-family and
variable-drive-205-209-solids pass.
