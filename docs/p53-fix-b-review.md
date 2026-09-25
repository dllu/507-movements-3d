# Pass-53 lane p53-fix-b: rotated-view audit fixes (128-254)

Source: `/dev/shm/audit53/b/findings.json`. Each fix was checked in the default,
+60°, -70°, top and edge views at phases 0 and 0.37. The captures come from a
private non-watching Vite server.

## Hatched ground and ceiling (136, 145, 154, 164, 179)

These IDs had no shared helper. Each factory drew its own flat sheet of ink
stroke boxes (or, for 145, paper slabs with front-face strokes). The new shared
helper `src/simulation/ground-block.js` (`groundBlock`, `groundBlockMaterials`)
replaces them. It draws one solid block of pale ground colour. Only the side
faces carry a faint 45-degree hatch, from a procedural `DataTexture` with
box-projected UVs, so line spacing and angle stay the same on every face. The
top and bottom faces are plain. There is no ink rim line.

- 136: one block from the ground's left end to the upright's right edge. The
  undrawn post below ground and the ground-line bar were removed.
- 145: both ledges keep their extents and use block geometry and materials.
- 154: one block, 1.2 deep, under the base plates. This is presentation only
  and needs no rebake.
- 164: the ground and the ceiling platen are solid blocks inside the extents
  of the old line and hatch.
- 179: the foundation keeps its 170 x 21 source extent as a solid block.

Other movements with flat hatch or stroke notation that may need the same
treatment (not changed here because other lanes own those files):
- 333, `authored-marine-parallel-motions.js`: an ink stroke plate for the
  `*-hatched-ground` under each fixed lug.
- 95, `mujoco-inclined-disk`: LineSegments `wallHatch` on the frame.
- 106/107, `mujoco-barrel-cam/hatched-header.js`: header face strokes.
- 185: sectioned-wall hatch strokes.
- 500: case-section hatching.
- 419: flat ground-line box.

185 and 500 are deliberate cut sections and may stay.

## 143: pulley index stripe

The model is baked, so a presentation `remove: ['pulley-index']` entry was
used instead of a rebake. A browser probe confirmed the part is gone in
production, and the back face is plain.

## 159: slack cord

`ideal-cord-shape.js` no longer bows the cord sideways. The outgoing run leaves
the pulley tangentially and drops straight. Its extra length settles as a small
Chaikin-smoothed loop 0.18 above the bar on the bar's downhill side, then
reaches the eye from directly above. The loop fades in over the first 0.3 of
slack, so the shape stays continuous with the taut run. The largest downhill
reach is 1.12, down from a sideways bulge of 1.75. Length is preserved (error
below 2e-14), and the cord never visually crosses the bar (clearance at least
0.138 from the bar centreline). The asset was rebaked with
`scripts/bake-cord-treadle.mjs`, and `docs/validation/159-ideal-shape.json` was
regenerated.

The cord's z is 0.64, in front of the bar (0.05-0.29). The loop therefore rests
in front of the bar, not on it, which is a small liberty.
`scripts/review-cord-treadle-ideal-shape.mjs` was already stale: it assumes the
pre-7b65d09 four-point Bezier and crashes. It is not regenerated.

## 167: reversing groove

The engraving's straight band of constant width is the edge-on view of a planar
inclined groove. The groove centre is now `centerY - A cos(angle)`: the rising
and falling halves have opposite pitch and join smoothly. The drum turns at a
uniform rate, and the rod keeps its exact harmonic law. Because the groove is
steeper than before, the slot half-height went from 0.17 to 0.195 and the stud
radius from 0.075 to 0.065. With those changes the conservative spherical-fit
test passes.

At phase 0 the default view matches Brown: a straight parallel-edged band from
the upper-left silhouette to the stud, with the notch at the left edge. At other
phases or rotations the band is the ellipse, foreshortened near the silhouettes
as any real groove is. `docs/validation/167-solid-clearance.json` was
regenerated and has no intersections. `167-browser.json`, the packaged e2e
fingerprint, is now stale and was not rerun.

## 178: back-face z-fighting

The rear web of the guide disk had a back face coplanar with the two lands
(z = -0.66). The web now extends to z = -0.68, its rim is 1 cm inside the outer
radius, and its bore is 1 cm larger. No coplanar faces remain, and the top/back
view renders a clean face.

## 202: worm thread ends

The last partial turn, cut square, left knife-edged sickles. The thread now runs
out over one pitch before each end face: the virtual cylindrical worm's radius
above the root is scaled by a smoothstep to zero before the Hindley mapping.
Each end face is a clean root disc, the mesh stays manifold, and every new
surface point lies inside the old solid. `POSES=33 node
scripts/review-special-worm-solids.mjs`: 202 has 0 penetrations, minimum gap
0.00249 (unchanged). 264 is unchanged.

A first attempt clamped radially in mapped space. It cut across the flanks,
gave 0.008 penetrations, and was discarded.

## 249: orientation stripe

The white orientation index was removed from the factory, and the 249 test now
asserts that it is absent.

## 253: hook angle stops

The `deployed-hook-angle-stop` studs were removed from
`lifting-check-hook-parts.js` (Brown draws none). The deployed angle is
prescribed, so nothing depends on them. The reconstruction note and the 253
working-parts test were updated.

## Intersection screens

- 136, 145 (`show-body-intersections`): only the pre-existing pairs with the
  invisible motion envelope. The ground blocks are in no pair.
- 145 and 144 (`review-rocking-beam-assembly`, `review-lazy-tongs-assembly`,
  written to docs): 0 failing pairs.
- 164 (`review-knee-press-solids`, production model): no intersections. The
  generic screen loads the registry model instead.
- 179, 178: only the pre-existing coaxial link-eye pairs. The ground block and
  the rear web are in no pair.
- 154: the generic screen ran out of memory. The ground-block top is flush
  with the base plates' underside (seated), and the baked test passes.
- 167: `review-groove-drum-solids`: none.
- 202: `review-special-worm-solids`: 0 penetrations.
