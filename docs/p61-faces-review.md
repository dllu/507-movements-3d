# Pass 61 — faces lane (p61-faces)

User findings: 360's sector spokes sat outside the rims; 334's toothed segment
had floating teeth and a stray orange knob on the rack; 347's cutaway showed
only a shadow in the upper chamber. Plus an all-movement scan for spurious and
wrong faces.

Captures: fresh non-watching server on port 44536, restarted after each edit;
scratch images under `/dev/shm/h6` (`before/`, `b1/` = before; `a1`–`a3/`,
`after/`, `f/` = after). Not committed.

## 360 — rocking beam with two cord sectors

- **Change** (`src/simulation/authored-oscillating-drum-ratchets.js`): the two
  round tube rims and six separate spoke bars are now **one flat extruded
  plate** (`rocking-beam-double-sector-plate`, built with
  `finite-plate-geometry`). It has two flat-ended rims concentric with the
  pivot, each ±0.52 rad (Brown draws about ±28°). Each rim carries a broad
  horizontal arm and two narrower diagonal arms at ±0.40 rad. The arms butt
  into the rim's inner edge well inside its ends, as the plate shows.
- The plate's small hub ring fits the existing dark pivot hub, which is now
  hole-sized.
- The cord wrap `sectorBaseWrap` changed from 0.64 to 0.50, so each cord ends
  at its rim's outer end as drawn. The rim still covers the drive cord from
  its vertical tangent (−0.38) to its end. The cord-length laws are unchanged.
- The unused tube-arc helpers were removed.
- The background flywheel keeps its plain spokes (no fillets). Its four spokes
  had been full-diameter boxes that duplicated each other in pairs, which
  z-fought invisibly. Each is now one hub-to-rim arm
  (`one-way-clutch-working-parts.js`, 360-only line).
- Verified in `a3/360-*` and `after/360-default.png`: default, rotated ±60°,
  oblique, back and a zoom on the rims. The spokes land inside the rims and
  the cords run over the rim ends.
- Intersections (production screen, 65 poses): no solid pairs. The existing
  coaxial frame/flywheel and cord/weight pairs are unchanged.
- Remaining: at t=0 the beam sits at its −0.38 rad extreme (the existing
  phase), while Brown draws it level.

## 334 — rack and toothed beam segment

- **Change** (`authored-beam-engine-parallel-motions.js`): sector C's rim and
  its 17 involute teeth are now **one plate** (the rim's polygon unioned with
  every tooth profile). Before, the rim stopped 0.025 short of the tooth root
  circle, so the teeth floated.
- The 17 tooth meshes remain as hidden analytic references. They keep the
  tooth-phase and swept-contact tests meaningful, and they share the plate's
  exact profile.
- The stray orange knob was `rounded-upper-end-of-rack-B`, a cylinder placed
  at the foot of the rack teeth. Brown draws nothing there, so it was removed.
- Verified in `a1/334-*`: default, two zooms on the segment and the rack foot,
  rotated, oblique and back views.
- Intersections: the worst solid depth is still 0.0000 (backing-roller
  contact only).

## 347 — disk engine cutaway

- **Cause:** the fixed radial diaphragm lay in the world XY half-plane above
  the shaft, which is exactly Brown's section plane. Its face covered the whole
  upper chamber, and the key light's shadow left the rest dark.
- **Change** (`authored-disk-engines.js`): the diaphragm now stands in the
  **rear horizontal half-plane** (world XZ, z<0). It stays out of the
  section, and Brown omits it in any case. The kinematics were re-derived for
  that plane:
  - the slot direction is normalize(−n_z, 0, n_x), with the sign chosen so it
    points back;
  - the transmission and contact texts were updated to match;
  - the disk orientation, angular velocity and acceleration still follow from
    the same frame.
- The bow and collars, which are fixed to the disk, were re-expressed in the
  new disk frame. At the engraving phase they are identical in world space.
- The ink slot lips lay flush on the slot walls (coplanar faces, a dark rim),
  so they are hidden.
- The cut casing no longer receives cast shadows. Without this, its own upper
  wall blacks out the opened upper chamber under the key light.
- Verified in `a2/347-*` (motion strip at 0, ¼, ½ and ¾, zooms, rotated views
  and a top view) and `a3/347-*`: both halves of the chamber now read open.
  The bow arcs over the casing at every phase.
- Intersections: production screen worst solid 0.0000.
- The scanner flags the committed (HEAD) 347 as `sectionCover` (the diaphragm
  in the clip plane, 1.0% of diagonal²) and passes the corrected model.
- Tests: `movement-347.test.mjs` was rewritten for the rear diaphragm (slot
  y=0 with z<0; canonical slot directions (0,0,−1), (−sinβ,0,−cosβ) and
  (sinβ,0,−cosβ)).

## Face scan — `scripts/scan-bad-faces.mjs`

The scan loads every movement through `model-loader` (the browser route:
authored, baked or special factory, then source presentation), poses it at
t=0 and checks each visible mesh. It flags:

- **inward**: closed components with negative signed volume on single-sided
  materials;
- **shading**: stored normals that oppose the triangle winding;
- **mixed**: manifold edges walked the same way by both neighbouring
  triangles;
- **degenerate**: zero-area triangles;
- **zfight**: coplanar, coincident, same-facing overlapping faces in
  different materials. `zfightSameLook` lists the same overlaps in identical
  materials, which are invisible;
- **backToBack**: coincident opposite faces where either side is
  double-sided;
- **sheet**: open single-plane components;
- **sectionCover**: large viewer-facing faces within 0.5% of the diagonal of a
  clipping or section plane.

Usage: `node scripts/scan-bad-faces.mjs --ids=1-507 --jobs=3 --out=/dev/shm/…`.
The full run takes about 10 minutes with 3 jobs. Final run:
`/dev/shm/h6/scan-final.json`. 506 of 507 loaded; 302 errored inside
`authored-escapements.js`, which another lane is editing. Totals: inward 4,
shading 13, mixed 48, backToBack 97, sectionCover 33, sheet 111, zfight 338
pairs (120 IDs), zfightSameLook 1289, degenerate 219 meshes.

### Reviewed and fixed here

- **198**: the `mangle-rack-working-parts.js` hub was rebuilt as `ring(0.083
  bore, 0.0758 outer)`, which is inside out and sat in the pinion's running
  clearance. It is now hidden when its outer radius does not exceed the bore.
- **331**: the "planed inner face" strips lay entirely inside the pillars,
  with every face flush with the pillar's. This drew a z-fighting dark stripe.
  They are now hidden (`piston-guide-329-331-parts.js`, used by 331 only).
- **347** lips and **360** duplicate spokes, as above.

### Reviewed, judged intended or harmless

- **sectionCover**: 184, 187, 270, 332, 335, 336, 425, 445, 446, 453, 467,
  469, 472, 481 are drawn parts (levers, heads, drum heads, back walls) that lie
  in or near a section plane but are shown by Brown. The captures show them
  reading correctly.
- **mixed**: 47–49, 130, 132, 137, 167, 191, 196, 211, 331, 411 are welded
  seams in extruded or half-section solids. The captures show normal shading.
  430–466 are water-stream geometry.
- **zfight**: mostly flush coloured hubs and bosses on wheel faces (for
  example 214 and 502). No flicker is visible in the captures at default
  zoom. Largest remaining: 482 (quicksilver vs cup skirt; fluid now excluded),
  254, 268, 493, 414.
- **27 sheets**: the dark single-triangle floors of the disc's triangular
  pockets. They read as pocket floors.
- **400**: 32% of the TubeGeometry return spring's triangles have inverted
  shading. The coils look acceptable in a zoom; left as a note.

### For other lanes (not edited here)

| IDs | Finding | Owner |
|---|---|---|
| 269 | `joggled-flat-end-of-input-rod-behind-gear` box inside out (inward + shading 100%) | p61-a/b |
| 280 | `free-end-turned-hand-grip` lathe inside out | p61-a/b |
| 286 | `web-joining-rod-guide-to-back-bar` ×2 boxes inside out | p61-a/b |
| 298 | wire-loop pallets: small inverted-shading patches (~2%) | horology |
| 321 | `maintaining-spring-S-S-prime-curved-wire` all normals inverted (shading 100%) | horology |
| 262/263 | no inward faces now (the old inverted supports are gone); 263 retains one small flush journal/boss z-fight | p61-a |
| 254, 260, 268, 290, 315, 318, 323, 326 | flush hub or boss faces of another colour (zfight) | 250–330 lanes |
| 287 | leaf springs: 8 mixed edges each | 250–330 lanes |
| 302 | factory throws (`crownWheel.userData.indicator` undefined) — could not be scanned | horology |
| 82–126 | no inward, shading or sectionCover findings; 125 loaded from its baked bundle on the final run; only zfight/degenerate triage entries | MuJoCo lane |

## Tests

- New `tests/p61-faces.test.mjs`:
  - 360: one plate, all points inside the rim span, cord wrap within the rim;
  - 334: one connected sector plate, teeth proud of the root, no knob;
  - 347: diaphragm rear and edgewise, lips hidden, slot on the rear plane;
  - a scan regression on 347, 198, 331 and 360.
- Updated `movement-347.test.mjs` and `movement-360.test.mjs` (role list).
- Pass: movement-334/335/347/360/361/197/198/331, marine-parallel-solids,
  engines-326-345-clearance, p59-visual-fixes,
  one-way-clutch-working-solids, mangle-rack-working-contact, p61-faces.
- Two tests fail from other lanes' concurrent work: `authored-loader` fails on
  302's escapement factory, and `source-presentation` fails on 288's
  removal patterns.
