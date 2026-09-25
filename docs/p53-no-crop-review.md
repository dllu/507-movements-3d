# Pass 53: no cropped or broken-off parts (lane p53-no-crop)

Rule 2 of pass 53: Brown's squiggles, broken ends and plate crops are drawing
conventions. The model shows whole parts. The default camera may still frame
Brown's view, so long parts can run off its edges, but no part is cut when the
view is rotated or zoomed out. Deliberate section views that are hatched or
capped (for example 452, 464 and 467, the optional section toggles, the front
half-section on 482 and the treadle drill bevels) stay.

## Method

- Code search for `clippingPlanes`, shader `discard` breaks, `broken`/`ragged`
  outlines and crop-truncated geometry across `src/simulation` and
  `src/data/source-presentation.js`. Ledger limits that mention breaks or crops
  were also checked.
- A whole-model capture of all 507 movements from three directions, with the
  camera fitted to the full visible geometry (scratch capture script, since
  deleted). All sheets were inspected. Every changed ID was then recaptured in
  its default view beside the plate and zoomed out.

## Changes

| ID | Before | After |
|---|---|---|
| 76 | The large wheel was clipped to Brown's rim segment D by three planes. It had section caps and a "section / complete" view toggle. Tappet end B had a spur above the nose. | The complete spoked wheel is always shown; the clipping, caps and toggle are gone. The default view still frames Brown's window, so the rim runs off its edges. B follows Brown's lobe outline, turned and scaled about its joint so that his sharp upper-left corner falls on the finite contact nose. The contact trajectory was rebaked (`scripts/bake-jointed-tappet-motion.mjs`): converged, finest-step interpolated gap -4.9e-8. |
| 233 | A shader discarded the lantern wheel's plates, rims and trundles below a wavy world line. | The wheel is whole. |
| 239 | A shader discarded the gear body and hub below a jagged world line. | The gear is whole. The camera still frames the plate crop, so the gear runs off below the hub. |
| 86 | A plane clipped the rope at the plinth floor and another clipped the drive band at the plate's right edge. `source-presentation` removed the second pulley and the pump hardware. | The rope, band, second pulley with its standard, and the pump guides and crosshead are whole and shown. The framing is unchanged. The edge of the second pulley shows at the right edge of the default view. |
| 89 | A clip plane in the strap frame cut the eccentric rod a little beyond the flanges. | The rod is whole to its wrist eye, inside the same framing. |
| 410 | The plank was a short piece with ragged ends. | The plank is 12.3 long with square sawn ends and runs off the default view. |
| 344, 345 | The rails had broken zig-zag ends. | The rails are whole bars with square ends that run off both sides of the default view. |
| 103 | The bed had a jagged break at the right. | The bed ends square, flush with the guide end. |
| 105 | The frame was cut at Brown's break below the ram guide. The anvil and blank were removed. | The frame is whole with its lower jaw, and the anvil and blank are shown. The authored framing is unchanged; the whole press now shows inside it. |
| 119 | The beams had broken ends. | The beams are whole and run off both view edges. The camera fit excludes their extension and keeps Brown's beam extent. |
| 80 | The rack stem had a wavy broken bottom. | The stem runs on to a square end below the view. `cameraFitBounds` is pinned to the baked motion bounds. |
| 307 | The pendulum plate's neck had a ragged top. | The neck continues as a strap to a bored eye at the suspension point (y 20). The camera top is capped at Brown's neck top. |
| 482 | The troughs and quicksilver were clipped to a thin slab (two planes). | They are a clean half section, cut only at the front section plane, like cup H. There is no visible change in the default view. |
| 183, 184 | The piston rod had zig-zag broken ends. The back-weight rods were cut at the plate edge. | The piston rod has square ends 260 px past the plate each way. The weight rods run as far. The camera fit ignores the extensions (`runsPastCrop`) and keeps Brown's rod extent. |
| 186, 187, 188, 189 | The eccentric rods had notched broken left ends. | The rods run on whole to x -300 px, past the view. 186 and 188 clamp the camera fit to Brown's break; 187 and 189 already frame with invisible plate envelopes. |

## Inspected and left unchanged

- 142, 269, 336, 342, 343, 347, 330, 443, 452, 459, 247, 277 (the cylinder was
  already completed by the p53-parts lane), 283, 339 to 341, 477, 166, 156,
  168, 169, 178, 179, 276, 286, 348, 354, 84, 252, 308, 495, 299, 301, 292
  and 368. The parts are whole; only the camera crops them.
- Deliberate sections are kept: the friction-clutch and differential section
  toggles, the treadle drill bevel section, the pipe coupling thread section,
  the MuJoCo screw, press and slide section toggles, and the capped hatch
  sections on 452, 464 and 467. Liquid-surface clipping (wet gas meter,
  fountain balance) models a free surface and is not a cut part.
- **229 (remaining flaw):** the chain legs are still cut square at Brown's leg
  ends by two clip planes. The chain generator lays links only between those
  ends, so completing the legs needs a longer node path and more rendered
  links. That was not attempted in this pass.

## Tests

The following pass: `jointed-tappet` (9), `lantern-stop-233-contact`,
`movement-233`, `movement-239`, `opposed-spur-239-contact` (a crop pin was
replaced by an assertion that no break material exists), `pump-catch`,
`eccentric-strap`, `movement-410`, `drawing-gauge-solids`, `movement-344`,
`movement-345`, `engines-326-345-clearance`, `mujoco-leadscrew-slide`,
`mujoco-screw-press`, `mujoco-endless-rack`, `crossed-rack`, `movement-307`,
`pin-escapement-working-solids`, `movement-482`,
`quadrant-catch-finite-interfaces` (the framing check now skips `runsPastCrop`
parts), `movement-183`, `movement-184`, `movement-186` to `movement-189` (the
break landmarks now expect the whole rod; 186 also pins the camera at Brown's
break), `gab-joint-solids`, `source-presentation`, and the `models.test.mjs`
blocks for 103, 105 and 119.
