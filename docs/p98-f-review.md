# Pass 98 lane f: 046, 212, 248

User findings (binding): 046's fusee looked irregular from above (should be one smooth Archimedean spiral), 212's orange finger was too sharp (lengthen it, round its corners), 248's threads had missing faces.

Captures are in `/dev/shm/p98/f/` (outside Git). `before/` holds HEAD, served from a `git archive` copy on the same port. `after/` holds the new state. The side-by-side comparisons are `cmp46.png`, `cmp212.png` and `cmp248.png`.

Claimed files: `fusee-geometry.js`, `fusee-motion.js`, `authored-intermittent-core.js` (only `fiveSlotGenevaWindingStop`), `geneva-212-contact.js` and `authored-pipe-couplings.js`.

## 046 fusee: tier risers on one Archimedean spiral

- **Plate.** Brown draws flat stepped tiers, and the stepped form is kept. The pass-96 tiers were concentric discs, each with a short spiral climb lobe ending in a radial step. From above these lobes read as irregular bulges (the user's 107.png).
- **Change.** The chain centre line is now one Archimedean spiral, `r(θ) = 0.56 + 0.23·θ/2π`.
  - Each of the three tiers is a flat snail plate spanning one turn of that spiral. Its riser sits `riserGap` inside the spiral, and it ends in a radial step.
  - All three steps lie on one radius. Tier k starts exactly where tier k−1 ends, so from above the risers trace a single continuous spiral.
  - Each shelf is a spiral band of constant width.
  - The chain lies level on its shelf against the riser above. At the step it runs down the next riser, still on the spiral, in a 1.25 rad two-parabola descent onto the shelf below.
  - The contact radius now grows continuously, so leverage grows smoothly with no radius steps.
- **Mesh.** The body is one closed mesh. The top-disc fan and the base annulus are split at the step so no T-junctions remain, and the watertight/outward test passes.
- **Chain over a step.** A chain leaving the fusee part-way down a descent would send its straight span back through the next tier's wide end, just behind the step. Instead the contact is lifted (`stepLift`) so the span rides over the step's top edge until it clears radially.
  - The lift is at most 0.125.
  - A cubic ease carries the lift back to the tier path. The ease length grows with the lift, keeping the edgewise bend within the pins' bores. Pin/bore clearance is at minimum 0.00055 (HEAD: 0.00073).
- **Lowest tier.** It now carries a full turn less 0.03 rad, so the source pose (5.0 rad left on the fusee) sits level on the lowest tier.
- **Captures.**
  - Default, top and rotated views: `after/t46.png`.
  - Top-down views: `after/top46.png`, against the user's 107.png.
  - Step, descent and anchor close-ups: `after/c46.png`, `after/d46.png`, `after/anc46.png`, `after/anz.png`.
  - Before/after: `cmp46.png`.
- **Tests.** `tests/fusee.test.mjs` passes 9/9, including:
  - a new test that the riser radius is linear in angle, each tier starts where the one above ends, and there is one radial pitch per step;
  - a rewritten seating test: seated pins are backed by the spiral riser, and descending pins run on it;
  - the pin/bore, leaf-separation, fusee-triangle and self-clearance sweeps.

  The `models.test.mjs` block for movement 46 is updated (the contact sits on the lowest tier, and its radius is on the spiral) and passes.
- **Screens.** Body intersections: worst 0. Disconnected parts: 0 detached, 4 near-misses (HEAD had 6). Coincident faces: 0. Loop seams: 0.
- **Residuals.**
  - The span to the barrel still slopes up to about 6.4°, and about 6.0° at the source pose. Lowering the barrel coil reduced this to 4.4° but made the span clip the tiers, so it was reverted.
  - While the contact passes the first ~0.7 rad after a step, the chain rides over the step edge and then drops back onto its descent. This is quick but continuous.
  - Each step face is a flat radial face, and it reads bright when it faces the key light.
- **Deferred (file owned by p98-a).** `authored-gears-core.js` still sets `root.userData.fuseeForm = 'stepped-tiers-with-spiral-climb-lobes'`. It should become, say, `'stepped-tiers-on-one-archimedean-spiral'`. Nothing tests this string.

## 212: lengthened, rounded winding finger

- **Plate.** Brown's finger is a horned tooth between the U-shaped and C-shaped reliefs. In the source construction its top arc (r 4.5) meets both relief circles tangentially, leaving zero-angle cusps. These were the user's "way too sharp" point (103.png).
- **Geometry.** The finger arc now reaches raw radius 4.7 (4.5 before; the rim is 4.0). Each end is rounded by a 0.2-raw (0.084) fillet tangent to the finger arc and to its relief circle.
  - Relief and fillet arcs are sampled densely (1024 and 256 segments), so the polyline stays within about 1e-6 of the true circle where B's slot mouth bears on it.
  - 4.8 was tried and bottomed in the slot; 4.7 leaves 0.040 slot-bottom clearance.
- **Contact law (`geneva-212-contact.js`).** B's angle is the most advanced of the geometrically valid constraints:
  1. B's slot mouth corner riding in A's left relief, from input angle 0.004;
  2. A's rounded leading corner bearing on the flank, from 0.347;
  3. the mouth on that fillet, from 0.812;
  4. the unchanged rim-corner pocket drive, from 0.831 to the lock at 0.956.

  Each constraint also checks that its contact point lies on the drawn feature spans. The concentric hold on the arc is still in the law but no longer occurs. Rates are closed form for the tail and central differences of the closed-form angle elsewhere.
- **Terminal contact.** It is taken from the final pose: the rounded corner on the shoulder beside the convex a–b sector. The marker, the limit contact point and the normal follow it.
- **Other movements.** In the same core file, 63, 71, 73, 82, 83, 121, 155, 206, 211, 213–215, 225, 232, 233, 235–237, 240 and 241 hash identical to HEAD (geometry plus world matrices at three times).
- **Captures.** `cmp212.png`: default, rotated, and close-ups at phases 0/0.03/0.06/0.1.
- **Tests.**
  - `tests/geneva-212-contact.test.mjs` passes 7/7. New: a dense 121-pose sweep (profile clearance at least −2.2e-6, matching HEAD's mesh tolerance; slot-bottom clearance 0.040), and a stage-by-stage reaction test for the new regimes with their actual face distances and clockwise moments.
  - `tests/movement-212.test.mjs` passes 5/5. Updated: finger radius, fillet tangency, a no-cusp turning test, outline counts, and the terminal contact on the rounded corner and the shoulder at the final pose.
  - `geneva-stop-working-solids`, 205–211 and 213–215 pass.
- **Screens.** Body intersections: worst 0. Disconnected parts: 0 detached. Coincident faces: 1 pair of 4e-5 relative area, the same as HEAD (a touching contact).
- **Residual.** The rounded corner lags the old cusp early in each index. B's terminal partial advance is therefore 40.5° (262.0° in total at HEAD; the source says 46°). The display still opens two indexes in, as drawn.

## 248: closed half-section threads

- **Cause.** Both threads were full helices cut by a render-time clip plane with double-sided material. That left their interiors open at the section, which were the missing faces the user saw.
- **Change.** Each thread is now built as a closed solid over the kept half only, with flat section faces at the cut drawn in its part's section material (geometry group 1).
  - C's thread is static.
  - B's thread is held in a counter-rotated frame, like B's body. There B's rotation is the same helix with its phase moved by −lead·θ. It is rebuilt in place into preallocated buffers when the nut angle changes (about 1.3 ms per update while unscrewing).
  - No clip planes remain on the threads.
  - Each thread's root face sits 0.002 inside the core or nut wall it is cut from. This removes the thread/core coincident-face pairs; the remaining 3 pairs are the pre-existing flange-on-seat contacts.
- **Captures.** `after/t248.png`, `cmp248.png` (default, rotated, zoom, unscrewing, separated, and interior views with pipe A hidden).
- **Tests.**
  - `tests/pipe-coupling-solids.test.mjs`: a new test that both threads are watertight, outward, wholly behind the section plane, carry two material groups and have no clip planes, with B's thread checked at 25 nut poses. The complementary-thread sweep now takes B's surface per pose.
  - `tests/movement-248.test.mjs` passes 8/8.
- **Screens.** Body intersections: worst 0. Disconnected parts: 0 detached. Coincident faces: 3 pairs (HEAD had 5).

No saved validation report fingerprints these files, so none needed regeneration. No rebake was needed.
