# Pass-51 wave-2 lane w2d: cranks, screws and linkages

This lane covers audit items from `docs/visual-audit-pass51.md` for 94, 95, 98, 104, 105, 108, 109, 127, 143, 145–147, 149–151, 156, 162, 163, 166, 168, 169, 178, 203 and 231. IDs 107 (cams), 113 (gears-core) and 129 (belts) belong to other lanes.

Each production route was captured with `scripts/review-movement-source-views.mjs`, which composites the render beside `public/engravings/mm_NNN.png`, and the renders were compared by eye before and after the changes.

## Changes

| ID | Change | Residual |
| --- | --- | --- |
| 94 | Source presentation removes the rim lugs, brackets and shaft support. | The white bands are real gaps where the groove crosses a slot. |
| 95 | Flat side elevation. The gantry is removed, and the wall carries a hatched corner band. | The wall is still a block behind the hatch. |
| 98 | Mirrored rear view (`scale [-1,1,1]`, camera `-z`), with a translucent disk over the grooved arm as the plate dashes it. The rear frame is omitted in the MuJoCo geometry. | The mirror reverses the drawn rotation sense. |
| 104 | Unchanged. | The worm thread reads heavier than the plate. It generates the saddle wheel's cut, so thinning it needs a regenerated wheel. |
| 105 | The frame is broken off at the plate's row 451. Presentation removes the anvil and blank. | The ram stops on an undrawn physics blank. |
| 108, 109 | Flat elevations with `cameraFov 14`. The 109 rails are square bars. | The 108 groove reads as chevrons, not crossing diamonds. |
| 127 | The lever is split into two arms seated on the back face of the pinion rim, behind the racks. Nothing crosses the pierced web. | none |
| 143 | `cameraDistanceScale 1.08` stops the pulley clipping at the frame edge. | none |
| 145 | The beam is one-armed: an eye at the left and a squared boss on the hatched shaft at its right end, with the 13-unit arm kept. Presentation removes the centre column and foot, wheel post, slider rail and white indices. The right ledge and the framing envelope are trimmed. | The pivot stays at source (24, 20); the plate measures about (25.8, 19.2). |
| 146 | Stems end where the plate breaks them off (raster rows 50 and 485). The undrawn stem guides are removed from the factory. | The guides lie beyond the drawing. |
| 147 | Flat front camera with `cameraFov 12`. | The ramps are still two blocks. They are physics contact surfaces, so reshaping them needs a new native bake. |
| 149 | Presentation removes the rear bearing bar, rod guides and slides. | The rods end in open eyes rather than broken ends. |
| 150 | Nearly end-on view down the camshaft. A z-mirror (`rotate [0,π,0]` + `scale [-1,1,1]`) puts the shaft end in front of the stepped cams, as in the plate. Presentation removes the end collars, bearing rings, white ticks and indices, and the oversized framing envelope. | The shaft end is dark rather than hatched. The cam face and depth interpretation is still open. |
| 151 | Presentation removes the white input-shaft mark. No frame is visible, so the ledger's "added frame" wording is stale. | none |
| 156 | The rod is broken off 205 raster px below its eye. Presentation removes the crosshead and slider pin. Fit bounds cover only the drawn members. | none |
| 162 | Unchanged. | The bevels are oversized. `bevel-train.js` is in the native loop qualification, so resizing them needs requalification. |
| 163 | The legged table is now two nested slender inverted-U brackets in `mujoco-belt-governor/solids.js`, rebaked with `scripts/bake-belt-governor.mjs`. | The frame stands in front of the belt; the plate is ambiguous about the order. |
| 166 | The slide and guides are removed from the factory. The rod is broken off beyond the disk rim (280 raster px), and the disk is now centred in the frame. The rod loop is slimmer. | none |
| 168, 169 | The pitman and rocker are slimmed to tapered bars. | none |
| 178 | Production removes the tool slide solids, guide rails, end stops, stroke witness and white index. The rod is drawn broken off at raster (37.5, 157.5). | none |
| 203 | The arm is now a J hook: the top limb runs right with a rounded end, and a tangent straight slot continues from the circular slot. The straight arm passes behind the hook, as the plate dashes it. Presentation removes the white indices. | The slot runs longer and the lower lobe is broader than drawn, to carry the 218° stroke. |
| 231 | Links and shafts are slimmed, and a long forward output rod is added. The white indices are removed. | The link-length and assembly-branch fit to the plate is approximate. The rod overlays the output crank in the default pose. |

## Evidence

The intersection helper builds registry models, so it only covers authored routes (127, 145, 178, 203, 231). The other IDs rely on their production validation scripts.

- **Sampled clear, no failing pairs:**
  - Authored routes: 127, 145, 203 and 231. For 178, the only pair is a 0.034 coaxial overlap between the rod beam and its own eye.
  - Production reports:
    - 143-assembly: 65 poses.
    - 143-render-contact: 0 intersections. The worm topology now reports 12 wrong normals, caused by the committed `solid-surface` helper change, not this lane.
    - 145-assembly and 146-assembly: 129 poses each.
    - 156-assembly.
    - 163-solid-clearance and 163-baked-clearance.
    - 166-, 168- and 169-solid-clearance.
    - 178-current-solids.
- **Unchanged-motion reports rerun because they fingerprint `authored-cranks.js`:** 140-dimensions, 144-assembly, 156- to 158-oracle-comparison, 159-source-clearance, 160-spatial-band and 160-authored-review.
- **Not rerun:**
  - The playwright browser reports 166-, 168-, 169- and 178-browser.
  - The 150 passive-physics reports. The 150 factory is unchanged, so they still match it.
