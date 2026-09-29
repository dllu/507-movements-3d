# Pass 106 lane f3: review evidence (438, 439, 445, 446, 458, 463, 475, 489, 491, 499)

Source: `docs/p106-audit-426-507.md`. Captures are in `/dev/shm/p106/f3/` (before: `/dev/shm/p106/a426/`).
Files claimed: authored-oscillating-water-columns.js, authored-barker-reaction-mills.js,
authored-water-bucket-reciprocators.js, authored-self-acting-weirs.js, authored-two-bucket-well-pulleys.js,
authored-feathering-paddle-wheels.js, authored-bilge-ejectors.js (not edited), ejector-trap-working-parts.js,
authored-capstans.js, capstan-pawl-contact.js, capstan-pawl-profile.js (generated), authored-bourdon-pressure-gauges.js (not edited).

## 445 / 446 (medium): frozen stream, cone and sheet
- The one revolved water body (the stream, cone, crown, film and sheet) now uses the shared `waterStreamMaterial` streak look (431, 441–443).
  - The lathe has no vertex colours, so the tint goes on the material colour.
  - The streak coordinate v is the arc length downstream along the profile. The sheet's inner face mirrors the outer face, so both run downward.
  - The scroll is 8 whole tiles per turn of the integrated downward discharge (the existing mass-balanced `turn`). Streaks slow while the cone checks the flow, and the loop is seamless.
- The cutaway clones the water materials to add its clipping plane, and cloning drops the fresnel `onBeforeCompile` hook. The factory now copies the hook back after the cutaway.
- The supply conduit and the floor discharge channel each get a `flowingStreamSurface` current inside their still bodies, clear of every wall and of the stem.
- Captures: `445-10/12/50/52.png` (the full view changes 1136 and 1009 px between phases 0.10/0.12 and 0.50/0.52; it was 0 on the fluids), `m445.png`, and `446-0.png`.
- Loop seam check: clean.

## 438, 439, 463: static pours
- 438: the pour was already a `WaterStream`, but its 1.1 tiles/s streaks barely moved on the short fall. Streaks now run at 3.5 tiles/s with 3 across. The zoomed pour changes 771 px over 0.02 of the phase (`438z-a/b.png`).
- 439: the fall from the flume was a static `waterJetGeometry` tube scaled in y. It is now a `WaterStream` on a free-fall path (1.5 at the lip), rewritten in place as the bucket moves.
  - Its radius tapers 0.13 to 0.09 as before, and it still ends inside the pool (the existing plunge test passes).
  - The zoomed fall changes 13,345 px over 0.005 of the phase (`439z-a/b.png`).
- 463: the nappe keeps its flow-shaped `waterJetGeometry` but wears `waterStreamMaterial`. Its uv is rewritten each frame (v = arc length along the nappe), scrolling 16 whole tiles per cycle. The zoomed nappe changes 9,346 px (`463z-a/b.png`, `m463.png`).

## 458: black base, pour against the post
- The bucket floor was `darkMaterial` (black). It is now the stave `bucketMaterial`, so the tipped underside reads as a closed bottom.
- The pour left the far lip at x = 1.86, which is exactly the post's x (posts span |x| 1.76–1.96, front face z = −0.50), and ran down the post's face with its end at z −0.49…−0.54.
  - The drawn-aside bail now goes to |x| = 2.16, so the pour (half-width at most 0.13) falls at least 0.07 clear of the post.
  - A new test asserts that the pour's box never meets a post over the cycle.
- Captures: `m458.png` (default, tipping, zoom, side, below).
- Residual: in the default view the bucket still tips away from the viewer, so the far-lip pour partly hides behind the bucket body. Reversing the tip was rejected: the body would then swing back into the posts, which is why pass 72 chose this direction.

## 489: pin thicker than the plate
- The bucket plate section is now one extrusion: the 0.13 × H rectangle united with a round hub of r 0.24 (the pivot boss's radius), bored at 0.184 for the r 0.18 pin.
- The blind rear web uses the same section, unbored, so the hub is capped.
- Capture: `m489.png`. The screens are clean (0 slivers, 0 lips).

## 475: stepped neck at C
- D's pear profile now ends at the pipes' outer radii (C 0.54, B 0.47; they were 0.57 and 0.53).
- Pipes B and C have D's own wall there (bores 0.405 and 0.475 = R − 0.065). They butt on D's end rims (C from y 1.56, B to −1.16) instead of overlapping them.
- The rings use 128 segments in phase with D's 128-cell shell, so no pixel cracks show at the seam.
- D's water was 0.005 inside the wall measured across. At the flat shoulders that is under 0.002 along the normal, and it z-fought (dashes at the lower neck). It is now 0.006 off along the wall normal, and the B/C columns take D's end radii.
- Captures: `m475.png`, `475-bz.png` (before: `475-head-bz.png`).
- Other users of ejector-trap-working-parts.js: 476, 477 and 478 hash identically before and after (positions, transforms and visibility at t = 0, 0.7 and 1.9).

## 491: lay jump, faceted ratchet
- Lay: the travel is the hauled distance × `layTravelScale` (1.0016). The net one-turn haul per loop (2πr = 4.373) then moves the strand pattern exactly 49 repeats (a third of a lay). The seam diff between phases 0.9999 and 0 is 0 px (it was 4,113 px).
- Ratchet: `makeCrownRatchetGeometry` cuts each tooth into 16 slices. The ramp is a true helicoid, and the inner and outer skirts are round with radial normals.
- The pawl contact profile (`src/simulation/capstan-pawl-profile.js`) was regenerated with `scripts/generate-capstan-pawl-contact.mjs` against the new ramp.
  - The script's convex crest edges are now the ramp's inner and outer helices. The old chords and the diagonal ridge are gone.
  - The release phase (0.33085) and seat phase (−0.33293) are unchanged. The samples shift slightly.
- The finite-pawl clearance, seat and recoil tests pass.
- Captures: `m491p.png`. The pawl sits in the root at phases 0 and 0.97.
- The whole-model seam check and the pixel seam are both 0.
- Capture: `m491.png`.

## 499: sector teeth (no change, auditor disagreed with)
- The sector is already cut by the same `gear()` generator as the pinion (`elastic-gauge-working-parts.js`: 25° involute, addendum 0.7 m, dedendum 1.1 m).
  - Both have module 0.03667 (0.66 × 2 / 36 and 0.22 × 2 / 12).
  - The pinion tip is 0.2457 = r + 0.7 m.
- A 36-tooth involute simply has near-straight flanks and a wider tip land than a 12-tooth pinion, so the flat-topped look is the correct conjugate shape.

## Tests
- New: `tests/p106-f3-fixes.test.mjs` (7 tests).
- Updated: `tests/movement-491.test.mjs` (lay travel scale, whole repeats).
- The existing suites for 438, 439, 440, 445, 446, 458, 463, 475, 489 and 499, the ejector, well-bucket, weir, oscillating-column and fluid-rotor suites pass (134/134).
- Screens for 438–499 (disconnected, coincident, body intersections, loop seams) show no new flags. The remaining flags are pre-existing:
  - 445/446 water-to-water seams
  - 475's steam pipe A port lip
  - 458's bail on the rim
