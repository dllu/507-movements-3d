# Pass 64 — escapement fix lane 2 (312, 314)

Captures are not in Git. They are in `/dev/shm/p64-fix-esc2/`:

- `before/ID-default.png` and `after1/ID-default.png`: the render beside the plate. `cmp312.png` and `cmp314.png`
  stack before over after.
- `hub-cmp.png`: 312's hub region before (left) and after (right).
- `v312-tile.png` and `v314-tile.png`: after, from the back, the front at phases 0.25/0.5/0.75/0, ±60° about
  vertical, and the top.

## 312 Bloxam gravity (`authored-gravity-escapements.js`, rebaked `baked/gravity-escapement-plates.js`)

**Audit finding.** Both pallet arms had a sharp kink halfway down, at a "shoulder" at (±0.74, C − 2.95). The lower
branch was a polyline, running from the stop down to a second corner at (±0.82, wheel − 0.18) and then back up to
the pallet stem.

**Plate.** Brown draws each arm straight from C to its stop A or B. Below the stop the plate continues in a curved
band that bends in under the wheel centre. On the left it is a J that ends under the arbor, and it carries the
slot E.

**Change.**

- The arm now runs straight from C to the lock point. It is still Bloxam's 20° tangent construction, so the
  straight line meets the locking circle square at the lock.
- Below the lock, the arm continues as one circular arc. The arc is tangent to the straight arm at the lock and
  curves in under the wheel centre to the fork pin (E or F). Its radius is fixed by that tangency and the fork-pin
  end point.
- A short straight finger then rises from the fork pin to the pallet-face stem. This part is unchanged.
- The two arms are mirror images. On Brown's right arm, the branch leaves B as a hook and returns to F above the
  arbor. The model keeps its mirror symmetry, with F below the arbor on the pendulum's fork.
- The white `markerMaterial` on the two outer locking detents was replaced with the dark stop material. The white
  blocks showed from the back and side views.
- Only 312 was rebaked (`node scripts/generate-gravity-escapement-plates.mjs 312`). The 309, 310 and 311 entries are
  byte-identical to the previous file, confirmed by comparing their JSON. The arm cut removes only 0.0018 of 1.61
  (the shaft), and the right arm keeps its full blank.

**Checks.**

- Intersections (`--spacing=0.01 --samples=129`): clear before (ledger) and clear after.
- Faces: only the existing `zfightSameLook` between spoke and tooth boxes (9).
- `check-gravity-escapement-engagement 312` at phases 0.05, 0.3, 0.55 and 0.8: A and B still lock with gaps
  0.0067–0.0072.
- Loop seams: 0.
- New test: each arm has no kink from C to the stop. The lower branch leaves the straight arm tangentially, lies on
  one circle, and ends at the fork pin.

**Remaining.**

- The arcs sweep lower than Brown's bands, reaching the lower rim, because the fork pins sit below the arbor.
- The right branch does not copy Brown's hook back to F above the arbor.

## 314 lever chronometer (`authored-lever-chronometers.js`, 314 source-presentation note)

**Finding.** Plain back bars and bearing bosses joined the three arbors and the banking pins behind the balance
disc, and they showed through the wheel's windows. Brown draws no frame.

**Change.**

- The bars, bosses and their helper code were removed. The fixed group now contains only the two banking pins,
  which Brown draws.
- The wheel arbor, lever arbor and balance staff, and the banking pins, now end as plain stubs 0.10 behind the
  balance disc (z −0.50, previously −0.80).
- The 314 source-presentation note was updated.
- The 309 and 314 redesigns from the deep-horology lane are untouched: the C blade, crescent, disc and motion law
  are unchanged.

**Checks.**

- Intersections: before, wheel/crescent 0.0001 and wheel/C 0.0000 (from the deep-horology review). After: the same.
- Faces: the back-bar pair is gone. Only the invisible same-look crescent overlap remains.
- Loop seams: 0.
- Test: `detached-chronometer-working` now requires the fixed parts to be exactly the banking pins.

## Tests

The following pass (58 in all):

- `movement-309` through `movement-314`
- `gravity-escapement-working-solids`
- `detached-chronometer-working`
- `source-presentation`
