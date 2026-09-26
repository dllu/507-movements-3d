# Pass 63, lane c: audit fixes for 229, 86, 160, 183/184, 373, 419 and 238

Captures: `/dev/shm/p63-c/tiles/<id>-before.jpg` and `<id>-after.jpg`. Each is the plate plus eight
views: default at phase 0 and 0.5, +60°, −70°, back, top, and two seam phases. Default and oblique
review renders are in `/dev/shm/p63-c/review/`. Close-ups are `z86.jpg`, `z183.png` and `z238.jpg`.
Intersections come from `show-body-intersections --spacing=0.01 --samples=129`. The "before" run used a
`/dev/shm` copy with the HEAD versions of these files. `check-loop-seams` on
229, 160, 183, 184, 373, 419 and 238 found 0 seams above tolerance and 0 mid-cycle pops.

## 229: toothed-link chain and fourteen-pitch wheel (`authored-belts.js`)

- **Removed:** the undrawn deck bar and its two splayed navel pipes. The fixed clipping cuts on the
  chain legs are also gone.
- **Why the motion changed:** a finite open chain cannot loop seamlessly on a wheel that always
  turns one way. The old model faked an endless chain, so links popped at the cuts (phase 0.186).
- **New motion:** the wheel now works as a chain hoist. From Brown's pose it pays out the left leg
  four links, lifting the right leg, then winds it back on a smooth cosine stroke (4 s).
- **Chain ends:** the chain is one fixed set of 20 whole links. At phase 0 the left end is Brown's
  rounded end link, with its pin 0.96 pitch radii below the wheel centre. The right end is two links
  past the plate's crop at the top of the stroke, so it never enters the default frame.
- **Kinematics unchanged:** exact link pitch, chordal action and tooth engagement are kept. Each
  handoff now keeps every node and link.
- **Scope:** 227 and 228 keep their pipes.
- **Tests:** `tests/movement-229.test.mjs` was rewritten from full-turn closure to hoist-stroke
  closure and finite-chain handoffs. `tests/chain-drive-working-parts.test.mjs` now uses 229's leg
  bounds instead of the pipe deck.
- **Seams:** 0 pops.
- **Intersections:** before 25 bodies, 54 meshes, no pairs. After 13 bodies, 43 meshes, no pairs.
- **Faces:** clean.
- **Discrepancy:** the site's animation turns the wheel continuously. Here it reciprocates as a hoist.

## 86: pump rope through the base (`pump-catch.js`)

No change. The plinth already has a real rectangular passage (x −1.60…−0.96, z −0.63…0.16) that
the rope and pump rod drop through.

- A ray test at the rope line (x −1.273, z −0.49) finds no plinth material. The same test hits
  the plinth all round the passage.
- Over the whole cycle, the rope at plinth height spans z −0.49…0.096 (slack bow), inside the
  passage.
- Near eye level (+60°, side views) the slab's own rim hides the opening, so the rope only appears to
  pierce the slab.
- An elevated view (`z86b.png`) shows the rope passing through the open passage.

The finding is a viewing-angle effect, not a collision.

## 160: spring-pole end block (`mujoco-spring-return-treadle/solids.js`, rebaked)

The undrawn grey `springClamp` block at the bow's fixed end is removed. The bow now ends at Brown's
cut, as the plate draws it.

- The block was not part of the MuJoCo model, so physics is unchanged.
- The production bundle holds the visual object, so it was rebaked with
  `node scripts/bake-spring-treadle.mjs`: 2001 samples, closure 2.6e-15, maxFKError 3.1e-7.
- Tests: `spring-treadle-baked` and `spring-treadle-solids` pass.
- Intersections: the registry screen is unchanged; it covers only the older synchronous
  envelope/fluid pairs.
- Stale fingerprints: `docs/validation/160-*-clearance/hardware.json` fingerprint solids.js, but
  they were already stale at HEAD and were not regenerated.

## 183/184: back-weight rods (`authored-quadrant-catches.js`)

Each straight rod now hangs 0.02 behind its eye's plate, joined by a short pin through the rod end and
the eye, as in 181/182.

- **183 upper rod:** the eye is on the quadrant in layer X. The rod moved from z −0.66…−0.58 to
  −0.24…−0.16, and the pin shrank from 0.52 to 0.17 long. This removes the 90° horizontal-pin kink.
  The rod's gap behind the quadrant holds nothing else at that side of the gear.
- **Eyes in layer W:** these rods (183 lower; both on 184) keep essentially the same place, about
  0.04 forward.
- **Pin ends:** each pin's rear end sits inside the rod, so no new coplanar faces appear
  (zfightSameLook stays at 5).
- **Intersections, 183 and 184:** before and after are the same, only seated contacts
  (0.0005 stud × lip, 0.0001 boss × stud).

## 373: belt continuity (`authored-rolling-friction-experiments.js`)

The two open strand stubs are replaced by one flat-belt run that continues past the crop. It wraps a
plain driving pulley of equal radius (the strands are parallel), a clone of the drawn pulley, on a
bare shaft stub. There is no post, standard or base.

- The pulley sits beltFreeLength + 3.2 along the strands and turns with the drawn pulley.
- Every added part is flagged `beyondPlateCrop`. The default framing is unchanged and the pulley
  appears only in rotated views.
- Test: `movement-373` was updated for the endless band and the pulley.
- Intersections: before 6 bodies, 88 meshes, no pairs. After 7 bodies, 91 meshes, no pairs.

## 419: rocker E (`authored-self-rocking-cradles.js`)

The bent tube rocker and the separate flat bed bar (with an open gap between them) are replaced by
one extruded solid circular segment.

- **Shape:** a flat top at y −2.66 (the bed the standards stand on) over the roll-radius arc
  (R 3.68, half-chord 2.54, sagitta 1.02). Brown's proportions are sagitta/half-chord ≈ 0.39; this
  one is 0.40.
- **Placement:** it keeps the bed's depth, behind wheel A.
- **Test:** `movement-419` checks the new role.
- **Intersections:** the old open-mesh flag on the tube rocker is gone. The only remaining pairs are
  the intended band-seating overlaps (0.108, before and after).
- **Framing:** the segment is slightly wider than the old bed (±2.54 vs ±2.275).

## 238: pallet C (`seven-tooth-238-working-parts.js`)

Pallet C is now the hooked end of the arm itself.

- **Old web:** a 0.28-radius disc hull round the carrier. It left a rounded stub below C and a V-gap
  between the C pad and the arm's outer edge.
- **New web:** the hull of the pad and the arm's own outer-edge outline, out to 0.72 from the tip.
- **Outline:** one continuous hooked-end outline, from the outer edge over the top straight into C's
  working face. It is the same extruded outline in both layers.
- **Sliver:** a 0.00065-area sliver that the swept cut isolated is dropped.
- **No rebake:** the working faces and the sweep are unchanged, and the sweep bake does not depend on
  this file.
- **Intersections:** unchanged (zero-depth B contact only).

## Tests run

- `movement-229`
- `chain-drive-working-parts`
- `band-saw-path` (after regenerating `docs/validation/141-review.json` with
  `scripts/review-band-saw.mjs`; the `sourceCommit` field was kept)
- `movement-183`, `movement-184`, `quadrant-catch-finite-interfaces`
- `movement-373`, `roller-working-solids`
- `movement-419`, `dead-socket-cradle-solids`
- `movement-238`, `seven-tooth-238-contact`
- `spring-treadle-baked`, `spring-treadle-solids`

All pass.
