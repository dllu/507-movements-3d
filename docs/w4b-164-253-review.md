# Wave-4 lane w4b-164-253 review

Re-audit fixes for IDs 164–252. Each item was checked in a fresh
`review-movement-source-views.mjs` capture before and after the change (captures are kept
outside Git under `/dev/shm/w4b/{A,B,C,D}`). Intersections were screened with
`show-body-intersections.mjs --spacing=0.01 --samples=129`.

## Changed

| ID | Change | Worst intersection before → after |
|---|---|---|
| 164 | `knee-press.js` slabs are replaced by hatched ground and platen lines | the screen loads an old factory, so these are not screened |
| 168 | Added a whole-cycle framing envelope to `variable-radius-crank.js`, so the rocker stays in frame | the screen loads an old factory |
| 171 | Hid the white indices on the sheave and die (source-presentation) | 0.028 rod-pin × die-rod (already known) |
| 179 | Grey slab → hatched ground line; indices hidden | only rod-in-eye joins |
| 185 | Hatched sectional wall; one broad notched quadrant plate; removed doubled eccentric rims and white indices | pin-in-eye 0.094 and rails × rockshaft 0.05 (untouched parts) |
| 191 | Removed the seam outlines and index dots, so there is no white rectangle in the notch | clear → clear |
| 194 | Wheel-coloured face and hub, narrow dark groove; index hidden; shaft shortened | 0.066 universal joint (known; the ledger's sampled-clear is stale) |
| 197 | Camera fitted to the starting pose (full sweep kept in `sweptBounds`), face-on; undrawn rails, mounts and rear web removed | 0.070 → clear as presented |
| 198 | Same framing as 197; guide rollers are plain discs | 0.075 cross-tie post × link (known; the ledger's claim is stale) |
| 201 | Removed the 3D "A" label and the guide bracket | clear |
| 205 | Shafts trimmed to the hubs (no shadow stripes) | 0.0000 touches |
| 212 | Markers and highlights hidden; smaller hubs; no arbor shadow stripes | clear |
| 213 | Tooth, speed and pin indices hidden; no shadow stripes | clear |
| 214 | Opaque darker teardrop fingers; hub sits inside the finger | clear |
| 218 | Face-on camera; white ring, index and markers removed; flat S lever; broad arched catch G with end lug | coaxial 0.159 / 0.090 → clear (bores added) |
| 219 | Solid slotted web in place of the cross-arms; lower camera | clear |
| 222 | Stripes and markers hidden; C and A in separate planes with a double-width idler B | solid 0.107 → clear |
| 225 | Base block, indices and contact marker hidden | marker pairs 0.055 → clear |
| 227 | Flat pierced plate links and flat loop links; broad concave-flank teeth; profiles regenerated | clear |
| 230 | Slender coupling rods with eye bosses; indices hidden | clear |
| 231 | Tighter fit box (maxNdc 0.75 → 0.94) | clear |
| 232 | Ink coupler pins; indices and marker hidden | marker pairs 0.030 → clear |
| 234 | `hideGround` | 0.0000 tangent contacts |
| 235 | Indices and markers hidden | 0.089 / 0.028 spring anchor seating (intended) |
| 236 | Indices and marker hidden | clear |
| 237 | Thin open cup crown with upright rim teeth; camera lowered to about 24°; return rebaked (`crown-pawl-237-return.js`, max ramp error 0.046) | clear |
| 239 | Wheel broken off below the hub (world-space discard, like 233); index hidden; fitted to the plate's crop | 0.0000 |
| 240 | Indices and witnesses hidden | 0.070 leaf-spring attachments (known, unchanged) |
| 241 | Indices and click witness hidden; no hub shadow stripe | 0.0000 seated |
| 242 | White index stripe removed | 0.035 seated strap eye |
| 244 | Index stripe and the undrawn post joining C and C' removed | 0.0000 seated |
| 245 | Level front elevation; index hidden | clear |
| 246 | Pivot B is a dark ringed pivot, not a white ball | clear |
| 251 | Continuous top beam B across the posts | 0.105 → 0.0000 seated |
| 252 | Tall broken-off fixed standard; slimmer arm bands | 0.005 arm × roller flange (pre-existing) |

## Not changed (reasons)

- **165**: The roller radius is part of the MuJoCo quasistatic bake and the wave profile. Changing it means rebaking.
- **172, 176, 177**: The framing is set by the swept slider or crank circle. Refitting it would crop the motion in mid-cycle.
- **182**: The upper finger is baked geometry shared with 181. Changing it needs a rebake.
- **188**: A larger notch tab collides with the leaf spring. The hidden cam rail is working geometry.
- **196**: Lengthening A's lobe dropped the carrier's minor stroke below the tested 0.1, so the change was reverted.
- **203**: The slot must sweep 180° for the 218.84° stroke. That sweep, not a broad body, is what makes the outline a C. A true narrow J needs a different slot law. The ledger's claim of a broader lower lobe is stale: the body matches the plate's proportions.

## Notes

- Hashes regenerated in the validation reports (results unchanged):
  - `191-196-201-contact`
  - `205-208-209-contact`
  - `200-226-bevel-solids`
  - `202-264-worm-solids`
  - `219-224-414-contact`
  - `221-222-223-contact`

  These depend on the file hash of `authored-gears-core.js` and the other factories. If another lane edits those files, regenerate the reports again.
- `model-loader.js` routes 164, 165, 168, 181 and 182 to dedicated or baked modules. `show-body-intersections.mjs` still loads the old authored factories for 164 and 168.
