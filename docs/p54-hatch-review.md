# Pass 54: hatch notation review (lane p54-hatch)

Rule applied: Brown's hatching is engraving notation for cut solids. Cut faces,
shaft ends, ground blocks and deliberate sections are now plain solid faces, in
the part's own colour or a slightly darker shade. There are no hatch strokes,
hatch textures, shader stripes or comb strips. Deliberate sections that show
internals (47, 248, 366, 467, 500's second figure) stay as sections; only their
hatching is gone. 181 and 182 were left alone because another lane owns them.

Evidence: captures from a non-watching Vite server on port 44412, with seven
views each (default t0 and t0.5, rotated 60 degrees, oblique, top-back, side,
back). Before and after tiles are in `/dev/shm/t2/tiles/<id>-pre.png` and
`/dev/shm/t2/tiles/<id>.png`. I checked every after capture.

## Shared helpers

| Helper | Change | IDs affected |
| --- | --- | --- |
| `src/simulation/ground-block.js` | The side-face hatch DataTexture is removed. Sides are a plain, slightly darker ground shade (0xcfc9bb) and the top/bottom are 0xe2ddd1. `spacing` is still accepted and ignored. | 136, 145, 154, 164, 179, and now 333 and 419 |
| `src/simulation/section-hatch.js` | Deleted. Its paper disc with ink stripes was redundant: the shafts already end at that plane in their own (ink) material. | 90, 91, 150 |
| `src/simulation/mujoco-barrel-cam/hatched-header.js` | Deleted. The header is now a real solid beam: the same trapezoid, extruded z ±0.50 (was ±0.20), in frame colour, with no stroke sheet or ink edge line. | 106, 107 |
| `src/simulation/mujoco-bow-drill/shaft-finish.js` | Deleted. It was a shader stripe on the spindle end. | 124 |
| `src/simulation/mujoco-bell-crank/finish.js` | Removed `applyBellCrankShaftFinish`, a shader hatch on the fixed pulley shaft end. | 126 |
| `src/simulation/clutch-section-geometry.js` | Removed the hatch LineSegments. The caps are now the part colour ×0.85, not lightened toward paper. | 47 |

## Per ID

- **45** (`authored-gears-core.js`, `makeGroovedSection`): removed the translucent hatch LineSegments on the enlarged section sectors. The sectors are plain.
- **47** (`friction-clutch.js` plus the clutch helper): the section caps are plain darker faces with no lines.
- **73** (`authored-intermittent-core.js`): C's fixed block loses its ink stroke mesh and is now a plain frame-grey solid, not paper. The test mesh count went from 12 to 11.
- **86** (`pump-catch-rear-drive.js`): the rear input band had a dark diagonal stripe texture copying Brown's hatched runs. It is now a plain leather band (0x9b8f6f). The test now asserts there is no map. Residual: the band's travel has no visual cue.
- **90, 91** (MuJoCo eccentric yoke and triangular eccentric geometry): the hatched shaft-end disc is removed, so the plain shaft end shows.
- **95** (`mujoco-inclined-disk/geometry.js`): removed the `wallHatch` LineSegments band from the wall block.
- **106, 107**: the header is a real solid beam, 1.0 deep, plain frame grey. It reads as a solid from the back and from below.
- **124, 126**: shader hatch removed from the spindle and shaft ends.
- **136, 145, 154, 164, 179**: the ground and platen blocks have plain faces. For 164, `knee-press.js` now calls `solidBlock` (was `hatchedLine`). For 136 and 154 I also renamed the block roles `engraved-hatched-ground-block` and `hatched-ground-block` to `fixed-ground-block`.
- **150** (`selectable-cam-valve.js`): the hatched discs are removed from both shaft ends. The rear end is trimmed from z 1.90 to 0.02 behind the hub's rearmost slide position (1.42), so the shaft is now 2.54 long instead of 3.02. I measured the radius against the plate: 0.56 is 35 plate pixels, the same as the hatched circle, and 0.47 of the largest cam in both plate and model, so the radius is unchanged. Residual: the carrier slides 1.02 along the shaft, so at any phase the shaft stands up to about 1.0 proud of one end of the stack. The sliding selection requires this.
- **185** (`authored-locomotive-valve-gears.js`): the sectioned engine wall bands lose their stroke boxes. The roles are renamed without "hatched". The floating quadrant is untouched (outside this lane).
- **186, 187, 189** (`gab-disengager-18x.js`): the rockshaft hatch strips and strokes are removed. 186's white shaft is now muted steel. 187's black painted fork lines are replaced by the rod's front 0.012 skin with the strap seams cut as fine grooves (real joints, same rod colour). The rod body stops at the skin.
- **244** (`authored-belts.js`): shaft A's paper face with ink strips is now a plain disc in the shaft's own material. Residual: the drum's steady rotation now has no visible cue. The floating stops C and C' are outside this lane.
- **248** (`authored-pipe-couplings.js`): `sectionHatchGeometry` and the stroke meshes are removed. Nut B's cut faces are driven ×0.85 and pipe C's are frame ×0.87. The external thread on C is now in C's metal (was black ink), the internal thread in B's colour (was brass), and the seat ring in C's metal (was black). The threads no longer read as black rings.
- **333** (`authored-marine-parallel-motions.js`): the black comb-strip "hatched ground" feet are replaced by plain solid ground blocks (3.3s wide, 0.40s tall) under each lug. R's block is now deep enough to carry its lug (z 0.10–0.48). Intersections: clear before and after.
- **365** (`authored-skew-roller-feeds.js`): the seeded streak DataTextures on the rod and rollers are removed, so the surfaces are plain. The undrawn marker patches stay hidden. Residual: the spin of the smooth rollers and the rod feed are not visually cued.
- **366** (`authored-treadle-drills.js`): the bevel section keeps its plain cut face. The ink stroke mesh is removed.
- **388** (`authored-planer-feeds.js`): the diagonal ink "grain hatching" on the plank face is replaced by faint lengthwise wood grain. It is short irregular streaks, a slightly darker shade of the plank, moving with the feed, so the feed stays legible without hatch strokes.
- **419** (`authored-self-rocking-cradles.js`): the black 0.05-thick ground-line bar is replaced by a plain ground block (6.8 × 0.24 × 1.40). It carries cradle E and also the rear drive standard at z −0.94, which previously stood beside the floor. `groundFloorY` is lowered to match.
- **452, 482**: I checked these and they already had plain section faces, with no hatch geometry in the code. No change.
- **467** (`authored-robertson-jacks.js`): `hatchedSectionPolygons` is replaced by `plainSectionFace`: one plain face per cut, in the part's material ×0.88. The base is frame grey, the ram red and the cylinder blue. The test is updated to assert one plain mesh per cut.
- **500** (`authored-diaphragm-pressure-gauges.js`): the second figure is rebuilt as the real gauge cut on its axial plane. A new `halfRevolvedSolid` helper sweeps closed profiles through the back half turn, with plain cut faces at z = 0. The case (front lip, drum wall, back wall with its passage hole), clamp ring, glass (translucent), dial, spindle, pinion and corrugated disk A are revolved about the gauge axis. Disk A has a fixed-topology profile that deforms every frame, and its rim is now seated 2 px in the clamp ring. The pressure pipe and foot flange are revolved about the pipe axis, joined to the back wall by a short nipple. Sector e and the rod are unchanged. The figure is no longer paper-thin from above. Residual: the nipple bore ends at the pipe wall (no elbow is modelled), so on the cut face the passage looks closed where it meets the pipe.

## Intersections (show-body-intersections, spacing 0.01, 129 samples, after)

- 73: none. 244: none new (coaxial 0.0000 pulley and brake block, as before). 333: none, before and after.
- 419: only the band-attachment deforming pairs (0.108), as before. The new ground block adds nothing.
- 500: only the existing coaxial ball joint (0.065) and the disk-boss pair (0.017). The section-figure solids add nothing.
- 248: coaxial 0.0001 nut shell and internal thread, as before.
- 106, 107, 150: cam-groove and pin, and cam-plate and axle, pairs as before. The header and the trimmed shaft add nothing.
- 186, 187, 189: only pairs with invisible camera envelopes. The new 187 skin is in no solid pair.

## Tests

All passed: 213 tests across the movement tests for 073, 179, 185–189, 244, 248, 333, 365, 366, 388, 419, 467 and 500, plus the friction-clutch, grooved-friction, knee-press, marine-parallel, MuJoCo (barrel, serpentine, eccentric yoke, triangular eccentric, inclined disk, bow drill, bell crank), pipe-coupling, pump-catch, selectable-cam, weighted-bell-crank and other clutch test files. `tests/models.test.mjs` fails on 134 (rope in `authored-belts.js`, a function I did not touch) and on 475 "visibly animates" (bilge ejectors). Other lanes' concurrent edits cause both. `tests/source-presentation.test.mjs` passed.
