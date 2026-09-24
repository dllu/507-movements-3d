# Pass-51 wave 3, lane w3a-catches

This lane covers 181, 182, 183, 184, 186, 188, 190, 247, 248, 251 and 253.
Each movement was captured with `scripts/review-movement-source-views.mjs`
against its engraving before and after the changes. Intersections were
screened with
`node scripts/show-body-intersections.mjs ID --spacing=0.01 --samples=129`.
Depths are in model units.

## 183 and 184: two-quadrant hand gear (rebuilt)

The previous model moved the handles along prescribed paths that went
through the tappet (arm and tip up to 0.2225) and drove the retaining pins
through the quadrant bands (0.1217). Its quadrant rims were about twice the
plate's thickness, and it used plain sectors and undrawn weights. It has
been replaced.

**Geometry.** All geometry is measured from plate 183, in pixels.

- Pivots are at (275,128) and (283,353).
- The upper handle has:
  - a curved hook arm with a knob at the end;
  - a quadrant with a narrow rim (radius 111–135), a crescent window and a toe;
  - its back-weight arm and eye in the same casting.
- The lower handle has:
  - an S-curved ball arm;
  - a quadrant with a 115–135 rim, a nosed left end and an anvil window;
  - a back-weight arm behind the piston rod, as Brown dashes it.
- The shafts are fixed, with sectioned ends. The piston rod is shown at its
  source width with broken ends. The back-weight rods are cut at the plate
  edge.
- There is no frame, guide, marker or weight block.

**Layers (back to front).** Weight rods; the lower weight arm; the piston
rod; the upper arm; the upper quadrant; the lower quadrant; the lower arm.
The tappet projects from the rod through all four front layers.

**The catches.**

- **Bottom catch:** a stud on the hidden part of the upper arm, which Brown
  draws dashed behind the lower quadrant. It sits just inside the lower
  quadrant's nosed rim.
- **Top catch:** a stud on the lower arm sits just inside the upper
  quadrant's toe.
- Each rim face is concentric with its own pivot. A held stud therefore puts
  no load on the holding handle until the rim end passes it.

**The motion.** It comes from an offline quasistatic solve,
`scripts/bake-quadrant-catch.mjs`. The piston moves harmonically. At each
step the tappet and the catches push the handles clear. Each handle then
falls toward its back-weighted side, at a limited rate, until the first
contact or its undrawn valve stop.

The resulting cycle:

1. **Up stroke.** The tappet lifts the lower handle. The upper handle is
   released only after about 38° of lift, once the tappet is high enough.
   Its arm then follows under the tappet up to its stop (55°).
2. **Top.** The lower handle slips off and drops about 1° onto the upper toe.
   The tappet finishes above the upper arm, as plate 184 draws it.
3. **Down stroke.** The tappet pushes the upper arm down. The lower handle is
   released at about 32° and rides the tappet top down to rest. The nose
   then takes the upper stud again.

The table is in `src/simulation/baked/quadrant-catch-motion.js`. It records
a sha256 of the parts source, and the test fails if the two drift apart.

**Poses.**

- 183 opens with the tappet top at the plate's y = 330, rising.
- 184 is the same rigid gear at the top of the stroke.

Brown's two engravings are not rigid rotations of each other. In 184 he
draws larger swings: the upper weight eye sits lower and the lower quadrant
is rotated further. This model keeps one consistent gear, so 184 differs
there.

**Intersections.**

- 183 before: 0.2225 (tappet into the arms) and 0.1217 (pins through the
  bands).
- 183 and 184 after: 0.0002, the seated stud-on-rim contacts only. The rod
  sits against the tappet at 0.0000.
- `scripts/review-quadrant-catch-solids.mjs` rewrites
  `docs/validation/183-current-solids.json` with worst depths 0.00020 (183)
  and 0.00020 (184).

**Obsolete files.** `scripts/review-quadrant-catch-interface-witnesses.mjs`
was removed because it depended on the old userData. The offline MuJoCo
study in `src/simulation/mujoco-quadrant-catch/` is unchanged and still not
used by production. `docs/movement-183.md` still describes the old
construction.

**Remaining.**

- The upper hook is drawn as a round knob, not Brown's curl.
- The lower nose reaches a little further left than the plate, over the rod.
- The upper stud shows through the open area left of the lower web, where
  Brown dashes the arm.
- For 184, the swings are smaller than Brown's.
- Weights, friction and impact are not solved.

## 181 and 182: diagonal catch

**What was wrong.** The reported roller-in-catch overlaps (up to 0.110) were
on the construction scaffold. That scaffold was what the synchronous
registry route, and so the intersection screen, actually built. The browser
never showed it: it plays the baked assembly.

**Changes.**

- The registry route now returns the baked assembly, driven by a compact key
  table that `scripts/bake-diagonal-catch.mjs` generates
  (`src/simulation/baked/diagonal-catch-keys.js` and
  `diagonal-catch-playback.js`).
- The old builder is kept as `createDiagonalCatchScaffold`. The contact
  studies now call it.
- The back-weight rods are trimmed each frame to the plate's lower edge.
- The tappet now sits on the rod face; before, it was 0.010 into the rod.
- The lower finger's hull is trimmed toward the plate's pointed horn.
- The projection, bake and clearance reports were regenerated in
  `docs/validation/181-*`.

**Intersections.** Before: 0.1095. After: only 0.0000 butt and seated
contacts.

**Remaining.**

- The lower finger's working edge is about 20 px past 181's horn tip; plates
  181 and 182 disagree there.
- The upper arm is about 20 px off near its hub.
- The eyes read as solid discs.

## 186 and 188: gab disengagers

**186.**

- Checked against the plate, the loop already follows the plate at t=0. The
  ledger's "hangs lower than a" is stale.
- The loop centreline was nudged into the middle of Brown's double lines, and
  the strap widened from 0.13 to 0.17.
- Intersections: clean before and after.
- Remaining: the rocker shoulder shows about 13 px left of the arm, and the
  catch tang is a solid plate where Brown draws a thin spring.

**188.**

- The leaf spring now rises from its foot on the rod along the plate's
  centreline to a free end just under a.
- A screwed clamp block now sits where Brown draws it.
- The strap was widened from 0.17 to 0.22 and the leaf from 0.15 to 0.20.
- Intersections: clean before and after. The rail tube is an open mesh, so it
  is not screened.
- Remaining: the conjugate cam rail still hangs below the rod at the engaged
  pose. Matching Brown's dashed edge would reverse the latch.

## 190: screw clamp

**Changes.**

- The handle is back at Brown's height, level with the holder crest.
- The release is limited to about 0.42 of a screw turn, so the handle clears
  the crest. The shoe now lifts 0.08.
- Bored plates are now built with true round bores, which closes the cheeks.
- The shoe was thinned, and the ink lines were lifted clear of the work and
  the thread.

**Intersections.** Before:

- 0.0283, shoe pin/bore (coaxial);
- 0.0173, shoe outline/work;
- 0.0121, cheek/shoe outline (coaxial);
- two open meshes.

After: only the seated shoe/work contact at 0.0000.

**Remaining.** The plank has no grain, and Brown's post through the plank is
not drawn.

## 247, 248, 251, 253

**247.**

- The weight bore was widened from 0.52 to 0.545, clearing a 0.0121 graze by
  the crank roller.
- The reload sling now runs in front of the rod; before, its hook went
  0.175 into the rod.
- After: only the sling's own joins and the foot resting on the seabed
  remain.
- The subject still sits high because the frame includes the full descent to
  the seabed.

**248.**

- The flange was reduced from 1.18 to 1.012, inside the nut's thread minor
  radius, as Brown's "small flange" suggests. The shoulder bore went from
  0.94 to 0.90.
- The separation lift went from 1.5 to 0.8, and the camera is now almost
  straight on.
- Intersections: 0.0859 → none. The cutaway shells are open meshes, so the
  screen is less certain there.
- A wedge cutaway still stands in for Brown's half-section.

**251.**

- Hook slot B is now a single top beam, and the hook ends are flat horns.
- The markers and indices are hidden.
- W is taller.
- The rope ends on the eye, and the camera is a flat front view.
- The undrawn anvil and small W were already fixed before this pass.
- Intersections: the ledger's "none" was stale. Before: markers 0.105, rope
  into the stem 0.070 and into the eye 0.081, W against a hook 0.0139. After:
  only the seated toe/shelf contact at 0.0000.

**253.**

- The contact markers are hidden, and the camera is a flat face view.
- The spring rings were already gone before this pass.
- Intersections: 0.1291 (markers) → none.
- The hooks are still short curled bars where Brown draws long barbed bars.

## Files

Written in this lane:

- `src/simulation/authored-quadrant-catches.js`
- `src/simulation/quadrant-catch-finite-parts.js`
- `src/simulation/baked/quadrant-catch-motion.js` (new)
- `scripts/bake-quadrant-catch.mjs` (new)
- `scripts/review-quadrant-catch-solids.mjs` (rewritten)
- `docs/validation/183-current-solids.json`

Changed by the forks:

- `src/simulation/authored-diagonal-catches.js`, `mujoco-diagonal-catch/*`,
  the diagonal-catch bake, keys and playback, and `docs/validation/181-*`;
- `src/simulation/authored-gab-disengagers.js`;
- the 190 path of `src/simulation/authored-clamps.js`;
- `authored-sounding-weights.js`, `authored-pipe-couplings.js`,
  `authored-pile-drivers.js`, `lifting-check-hook-parts.js` (used by 251 and
  253 only) and `authored-check-hooks.js`.
