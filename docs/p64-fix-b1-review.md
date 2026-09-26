# Pass 64, lane fix-b1: undrawn supports, chain ends and 243's spools

Audit input: `/dev/shm/audit64/b` (findings, tiles, seams). Captures: `/dev/shm/p64-fix-b1/tiles/<id>-after.jpg`
(plate plus eight views: default at phase 0 and 0.5, +60°, −70°, back, top, and two seam phases). The "before"
tiles are the audit tiles `/dev/shm/audit64/b/tiles/<id>.jpg`. Intersections come from
`show-body-intersections --spacing=0.01 --samples=129`; "before" ran on a `/dev/shm` copy holding the HEAD versions of
the touched files. `check-loop-seams` on all thirteen changed IDs: 0 seams above tolerance, 0 mid-cycle pops
(227 and 228 previously popped 4.3% and 3.6% at the pipe slots).

## 227, 228: finite hoist chains, no pipes or deck (`authored-belts.js`)

- **Removed:** the undrawn slotted deck plate and its two navel pipes (`addChainNavelPipes` is deleted). Links no
  longer pass into slots, so nothing pops.
- **Motion changed:** as on 229 (docs/p63-c-review.md), a finite chain cannot loop on a wheel that always turns one
  way. Each wheel now rocks the chain like a hoist: from Brown's pose it turns two links each way on a sine stroke
  (4 s period, same cycle length and nearly the same peak speed as the old continuous turn).
- **Chain:** one fixed set of whole links. 227 has 24 links (tail 15, head −9) and 228 has 26 ladder sections
  (tail 16, head −10). `finiteHoistChainBounds` sizes them so that both end joints stay at or below y = −5.9 (227)
  or y = −7.4 (228) throughout the stroke. That is below the plate's crop, so the ends never enter the default frame.
  Each link keeps its own render slot (slot = material index mod an even count), so identity and plate/loop parity
  never change.
- **Kept:** exact link pitch, chordal action, tooth/rung engagement and the alternating planes are unchanged.
- **Tests:** `movement-227/228` were rewritten from full-turn closure to hoist-stroke closure. They now check the
  finite chain, its handoffs and the chain ends staying below the crop. `chain-drive-working-parts` no longer
  expects pipes and now asserts that none exist.
- **Discrepancy:** the site's animations turn the wheels continuously. Here they reciprocate.
- **Intersections:** 227 went from 24 bodies / 50 meshes (deck mesh open) to 12 / 51 (no open meshes, no pairs).
  228 went from 51 / 99 (deck open) to 12 / 93 (no open meshes, no pairs).
- **Faces:** clean before and after.

## 243: flanged spools (`authored-belts.js`)

The two vertical driven pulleys are now Brown's spools: a drum 1.7 radii long between two flanges 1.2 drum radii
across and 0.3 radii thick. The band still runs round the middle of the drum. The shafts are a third of the drum's
diameter and 3.9 long, as on the plate; the pulley's hidden hub sits inside the shaft. The fit bounds were widened
to include the flanges and the longer shafts. Intersections: 6 bodies before and after, with no pairs. Faces: clean.

## Removed undrawn supports

| ID | Removed | How | Remaining end |
|---|---|---|---|
| 278 | floor sill joining uprights A | factory (`authored-safety-stops.js`) | uprights end plainly below the rack |
| 286 | back bar, two bored rod guides and webs, rock-shaft bearing arm and boss, base, seat supports, valve seat | factory (`authored-poppet-valves.js`) | rock shaft is a short stub behind the toe; rod ends in its poppet head |
| 305 | back bar, suspension cock boss, disc-arbor bush | `correctSinglePinParts` (`pin-escapement-working-parts.js`) | suspension pin runs just through the eye with its retaining head; disc arbor is a cut stub just behind the disc |
| 321 | back bar, arbor rear bearing, T stud boss | factory (`authored-going-barrels.js`) | T journal pin spans T's eye; barrel arbor ends 0.08 behind G |
| 327 | engine bed plate | factory (`authored-steam-engine-guides.js`, 327 only) | columns and cylinder end together at the cylinder foot |
| 329 | bed plate; doubled thin legs | factory (`authored-epicyclic-piston-guides.js`) | one broad flat bar (0.32 × 0.26) per leg, as Brown draws, ending at the cylinder foot |
| 332 | flat back tie from shaft A to the vessel | factory (`authored-marine-parallel-motions.js`, 332 branch) | shaft A is a stub ending 0.12 behind the lever |
| 340 | rocking barrel, trunnion pin and bracket at rod D; cylinder at rod C; wall bracket behind F | factory (`authored-direct-action-parallel-motions.js`, 340) | rods run straight past the crop and end cleanly; rod D still points at its off-plate rocking centre |
| 351 | both C-guides, their back bar and arm, pinion shaft bearing | `source-presentation` remove plus factory (back bar no longer built; shaft trimmed) | pinion shaft is a stub just behind the hub |
| 353 | helve post, foot, bearing bridge, rear fulcrum bearing; rear wiper-shaft bearing | factory (`authored-trip-hammers.js`) | fulcrum shaft ends in its front retainer and 0.05 behind the hub; wiper shaft ends 0.05 behind the wheel hub |

On 351 the guides stay in the model as kinematic references, but they are detached.

Tests updated: `movement-286`, `cam-281-286-solids` (286 support test rewritten), `pin-escapement-working-solids`
(dropped the removed bush), `movement-351` (guides detached), `stamp-trip-working-parts` (353 removed supports are
asserted detached), `movement-329` (two legs).

Intersections, as bodies/meshes before → after (pairs):

- 278: 29/79 → 29/78; the same seated leaf-spring and pawl contacts
- 286: 3/18 → 2/7; the poppet-head × seat contact is gone, and the two seated toe/lifter contacts are unchanged
- 305: 3/13 → 3/10; no pairs
- 321: 7/26 → 7/23; the same deforming spring-wire and rope contacts (the spring wire was already an open mesh)
- 327: 6/45 → 6/44; the same seated strap × roller contact
- 329: 4/32 → 4/29; no pairs
- 332: 7/19 → 7/18; no pairs
- 340: 7/22 → 6/16; no pairs
- 351: 3/38 → 3/29; no pairs
- 353: 3/30 → 3/25; the same coaxial anvil strike contact

`scan-bad-faces`: no ID got worse. 286 went from zfightSameLook 4 to 1, 351 from 13 to 8 and 353 from 9 to 7; the
rest are unchanged. 332 keeps its existing degenerate and sectionCover counts.

`docs/validation/141-review.json` was regenerated with `scripts/review-band-saw.mjs` because `authored-belts.js`
changed. Its `sourceCommit` is kept, and `band-saw-path` passes.

## 247: not changed (residual)

The audit flags the sea-bed slab and the reload sling as undrawn, and they are. But they are the model's only
working trigger surface and its only reload:

- the probe must strike something to trip the catch;
- the dropped weight must return to the rod to close the loop.

Removing them needs a new loop design, which should be the user's choice. Two options:

- a finite, non-looping playback;
- the dropped weight sinks away and a fresh weight fades in on a reset catch, with the slab replaced by nothing
  (the probe would then be pushed by an unseen bottom).

Neither was done in this pass.
