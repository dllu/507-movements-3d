# Wave-5 lane w5b: movements 248–314

Pass-51 wave-5 lane working on the residuals in the ledger for 248, 251, 253,
260, 261, 262, 269, 276, 277, 279, 280, 281, 291, 294, 296, 299, 300, 301, 302,
304, 307, 313 and 314. Every ID was captured before and after (render beside the
engraving) and screened with
`node scripts/show-body-intersections.mjs ID --spacing=0.01 --samples=129`.
Some IDs also got finer scans.

## Per movement

### 248 (screw pipe coupling)
- **Change:** a true half-section as Brown draws it. Nut B and pipe C are cut on
  the axial plane (`cutawayHalfAngle = π/2`). Pipe A, its flange and its spigot
  are whole, because Brown draws A unhatched with a dashed bore.
- **Keeping the cut on the section plane:** the nut body sits in a
  counter-rotating holder, so its cut stays on the world section plane through
  B's three turns. The helical threads are clipped on the same plane
  (`localClippingEnabled`).
- **Intersections:** none → one coaxial 0.0001 seat between the nut shell and its
  own internal thread. It appears only because the shell is now a separate body.
- **Remaining:** thread friction and sealing are unsolved. The section faces are
  flat colour, not hatched.

### 251 (pile driver)
- **Change:** hooks A now bulge toward the rails and curl in to the tips, forming
  Brown's crescent horns. The stock swells from 0.18 to 0.32 through the bulge.
- **Guides:** short rear tip studs ride slot B's guide faces. The guides were
  shortened so the horn plates pass in front of them.
- **Intersections:** the 0.0000 toe/shelf seat only, before and after.
- **Remaining:** release is quasistatic, and the tip studs are inferred.

### 253 (check hooks)
- **Hooks:** long straight bars that lean 14° forward and end in a pointed
  forward barb. Stud D seats in the crook between bar and barb.
- **Fold direction:** the hooks now fold forward at rest and deploy back onto a
  stop behind them (`deployed-hook-angle-stop`). The flange backs off −0.9 rad
  before the fold (7.5–8.1 s).
- **Studs:** at 0°, 120° and 240°, as Brown places them.
- **Disk A:** opaque.
- **Display offset (added by the lane lead):** `update()` now opens at 4.45 s
  of the canonical cycle (`root.userData.displayTimeOffset`). Frame 0 shows
  Brown's pose: hooks deployed, studs just ahead of the barbs.
  `stateAtTime` and the timeline stay in canonical time. The two tests that pair
  `update()` with canonical times subtract the offset.
- **Intersections:** none → none (re-screened after the offset).
- **Remaining:** the rope web is translucent grey. Operation and lift are
  prescribed.

### 260 (differential screw drive)
- **Change:** screw C has a three-start square thread. The pitch is 0.16 with the
  lead kept at 0.48, so the visible hatching matches Brown and the feed is
  unchanged.
- **Where:** `differential-thread-solids.js`, 260 branch only. The outputs for
  266 and 275 are identical.
- **Report regenerated:** `docs/validation/260-266-275-thread-solids.json`, with
  `POSES=33 node scripts/review-differential-thread-solids.mjs`.
- **Intersections:** 0 penetrations at 33 poses; screw-to-nut gap 0.0015–0.0016.
- **Remaining:** the number of starts is a reconstruction choice.

### 261 (combination drive): no change
- **Why:** carrying D's drum-side strand in front of B to the inner circle is not
  buildable. The full-turn crank pin at radius 0.65 on B's front face crosses
  that strand every turn.
- **Alternatives rejected:** moving the drum in front of link C hits C, which
  passes within 0.18 of B's centre. Putting C behind B hides the drawn pin.
- **Intersections:** unchanged: weight eye/cord 0.0296, drum/cord 0.0007.

### 262 (eccentric cone drive, end view)
- **Stand E:** now a low footed cradle: foot at −0.97 (was −1.34), half-width
  0.80. Its height below B's rim is 0.22 of B's diameter, against Brown's 0.17.
- **Carrier bar:** replaced by a flush web in the cone's colour.
- **263:** its view is pixel-identical and keeps its taller standard.
- **Intersections:** only the cone/roller seat (0.0000).
- **Remaining:**
  - The cradle is still slightly tall.
  - B's offset swing dips below the feet in this view.
  - The pressing spring or weight is not drawn, so not rendered.

### 269 (mutilated rack): no change
- **Check:** fresh captures at 0, 1.6, 2.4 and 5.6 s confirm all four residuals.
  All are kinematic:
  - The handoff teeth are relieved stubs.
  - The closed end sits about 78 px right of the plate, because the gear tip
    must clear the bridge.
  - The camera fits the whole sweep, so the subject is small.
  - The rod leaves the frame at the stroke limit (maxNdc 1.16).
- **Intersections:** sampled-clear (minimum tooth clearance 0.0048).

### 276 (equal-diameter cam)
- **Stale claim:** "lobes narrower than drawn" is wrong. The overlaid curve
  follows Brown within a few px.
- **Fixed:** the rod ran about 134 px past the right roller. It now ends just
  past it with a convex end, and only the left hidden guide remains.
  `tests/movement-276.test.mjs` now expects one guide instead of two.
- **Intersections:** clear → clear.
- **Remaining:**
  - Brown's necks are about 7 px shallower than the equal-diameter law allows.
  - His lower lobe is turned about 5°.
  - The bar is flat where Brown draws a round rod.

### 277 (Colt ratchet)
- **Change:** spring c now bends like a leaf clamped in its hatched block, and
  its root stays fixed. The spring-to-dog clearance check uses the bent shape.
- **Intersections:** clear → clear.
- **Remaining:**
  - The hook works about 0.86 lower than drawn and the ratchet teeth are
    shallow. Both are kinematic: a dog in the page plane can only turn the face
    ratchet a full sixth at the axis height.
  - An undrawn detent is assumed.
  - The bend is a prescribed shape.

### 279 (sliding journal box)
- **Change:** dashed hidden edges for the crank-throw outline and the shaft
  circle. They draw only where something nearer covers them, so the lobe below
  the box shows its hidden part dashed.
- **Intersections:** clear.
- **Remaining:** the dashes are 1 px wide (a WebGL line limit), fainter than the
  engraving's.

### 280 (friction windlass)
- **Grip:** a turned handle (collar, neck, pear-shaped swell).
- **Posts:**
  - The lever post is 0.69 wide (was 0.30), with the fulcrum at its right edge.
  - The jaw post is widened.
- **Backstop:** hidden inside the rim by scaling it 0.93 about the wheel axis
  (`geometry.backstopScale`). Moving the ratchet forward would hit the jaw's rear
  cheek. The pawl gaps are kept, with a minimum of 0.00102.
- **Bake script:** `scripts/generate-friction-windlass-backstop.mjs` undoes the
  scale. A re-run reproduces `friction-windlass-backstop-data.js`
  byte-for-byte.
- **Intersections:** only the seated rim/flange contact (0.0000).
- **Remaining:**
  - The pawl pivots sit about 8 source px nearer the wheel than drawn.
  - The thin post under the wheel is undrawn.

### 281 (grooved disk follower)
- **Change:**
  - A keyed rear arm behind the disk, whose dashed outline shows through it.
  - Brown's dashed alternate lever at the other end of the swing.
- **Intersections:** clear.
- **Remaining:**
  - The dashed lever sits about 4–5° short of Brown's: the model swings 21.5°,
    Brown's about 24°.
  - The brace and rear bearing are inferred.
  - The perspective (field of view 14°) slightly lengthens the front lever.

### 291 (Arnold free escapement)
- **Wheel B:** the crown arc is removed, leaving plain ratchet teeth.
- **Notch g:** rebuilt without its self-folding end. It is layered at z −0.25 to
  0.198, behind hook k and A.
- **Impulse arm:** behind the wheel.
- **Hook k, stud a, stud i:**
  - Hook k is at z 0.20–0.47, with its foot under A.
  - Stud a is a short pin at z 0.48–0.60 in front of k.
  - Stud i is in the drawing plane only.
- **Stop d:** tilts with the lifted leaf.
- **Depths, before → after:**

  | Pair | Before | After |
  | --- | --- | --- |
  | stud a / hook k | 0.104 | 0 |
  | notch g / hook k | 0.055 (0.10 on a fine scan) | 0 |
  | tooth / notch g | 0.046 (0.13 on a fine scan) | 0 |
  | tooth / impulse arm | 0.046 | 0 |
  | stud a / A | 0.052 | 0 |
  | A / stud i | 0.056 | 0.0009 |
  | A / hook k | 0.055 | 0.0016 |
  | stop d / A | 0.024 | 0.0106 (the intended seat) |

- **Intended joints that remain:** f clamped in stud i (0.086), and the clamp
  screw at b.
- **Remaining:** stud a, hook k and notch g are kept apart by depth layering
  rather than by drawn plan shapes.

### 313 (common chronometer escapement)
- **Teeth:** a short, slightly undercut face (the root trails the tip by 0.07
  pitch) and a long back, as Brown draws them.
- **Passing spring TV:** held clear of V on the return pass.
- **Acting pass:** the detent lift is the larger of the schedule and the lift
  that keeps the leaf resting on V.
- **Jewel V:** radius 0.085 → 0.08.
- **Depths:**
  - tooth/P 0.019 → 0 (a fine scan had shown 0.022);
  - V/TV 0.011 → 0 (a fine scan had shown 0.026).
- **Remaining:**
  - V meets TV about 11° before the dead point, against Fritts's nominal 5°.
  - The detent can leave the tooth before the prescribed release.

### 314 (lever chronometer)
- **Change:** pallet C and nib A are cut by the swept outline of every tooth,
  with 0.0015 clearance. Build time rises from about 0.2 s to 0.45 s.
- **Depths:** tooth/C 0.037 → 0 (0.083 on a fine scan); tooth/nib 0.004 → 0.
- **Stale claim:** "lever arbor/pallet C" is wrong. The arbor/C depth is 0; the
  0.037 was tooth/C.

### 294 (cylinder escapement)
- **Change:** presentation only: rotate z 2.77 → 2.5 and camera
  `[-1,0.04,0.3]`. The band wall rises to mid-height with its curled cut end,
  and the passage is cut almost to the bottom edge. The axis is levelled.
- **295:** pixel-identical.
- **Intersections:** none.
- **Remaining:**
  - Supports are inferred.
  - A pivot shows faintly inside the curl.

### 296 (lever escapement)
- **Change:** hooked claw teeth with an undercut leading face and a long convex
  back.
- **Rebake:** `scripts/generate-lever-296-pallets.py` changed and
  `src/simulation/baked/lever-296-pallets.js` was rebaked; `--check` passes.
- **Intersections:** none. Minimum clearance 1.9e-6.
- **Remaining:** each back leaves its tip 30° off tangential, steeper than drawn.
  A flatter back notches the impulse faces.
- **Stale doc:** `docs/lever-296-contact-review.md` still describes the old
  tooth.

### 304 (Goodrich stud escapement): no change
- **Why:** the residuals are kinematic. The 30-pin half pitch sets the pallets
  6° apart.
- **A pins:** they keep their leading half because the pallets touch the whole
  −147° to −48° arc. Brown's D shapes all face left, so no working orientation
  can reproduce them.
- **Intersections:** none.

### 307 (three-legged escapement)
- **Plate:** re-traced so it is widest level with the hub, the neck is 0.71 W and
  the bottom is 0.26 W. This fixes "the slot sits lower".
- **Pallet A:** its insert is extended so it shows beside the upper leg.
- **306:** pixel-identical.
- **Stale claim:** "spears broad near the hub" is wrong; the legs follow Brown's
  taper.
- **Intersections:** 0.0000, touching contacts only.
- **Remaining:**
  - The legs are exactly 120° apart, where Brown draws about 132°, 106° and
    122°.
  - A is at the top of the hub, where Brown draws it about 40° to the right.
  - The impulse pins are hidden behind the leg roots.

### 299 (clock verge)
- **Framing:** a crop to about two near pitches (maxNdc 1.69, deliberate).
- **Camera:** `[0.02,0.02,-1]`.
- **Teeth:** 0.6 tall with concave backs (`toothBackExponent` 1.8; the default
  of 1 keeps 234 and 302 unchanged).
- **Starting pose:** `displayCycleOffset` 0.125, so the far pallet hangs
  down-left and the near pallet lies out right.
- **Hub and arbor:** shorter.
- **Intersections:** tangent contact only.
- **Remaining:**
  - The far teeth show solid, where Brown draws their tips as lines.
  - The pallets are short (verge law).

### 300 / 301 (Debaufre)
- **Pallet:** the drop is 0.45 of the half pitch, and the pallet is 0.475 thick
  (was 0.673).
- **Rebake:** `node scripts/generate-debaufre-300-301-pallet.mjs` gives input
  hash `3f0e592ff00efd3b` (supersedes `324f119c6062bae3` in
  `docs/debaufre-300-301-review.md`). Two runs are byte-identical.
- **Spacer drum:** pale; in 300 its radius is 0.30.
- **Collets:** brass.
- **301 camera:** field of view 8°, fit distance 41.1.
- **Lift-off:** now at most 0.0345.
- **Tests:**
  - The `movement-300` wheel-speed finite-difference tolerance is 4e-8 (was
    2e-8), because the drop is faster.
  - The plain-D negative-control threshold is 0.03 (was 0.05). The thinner D is
    struck 0.045 deep, so the control still fails clearly.
- **Intersections:** clear.
- **Remaining:**
  - The pallet is still thicker than Brown's ~0.28. Drops of 0.49 or more make
    the generator abort.
  - In 301 the strips show tooth-flank lumps.

### 302 (two-weight balance verge)
- **Change:**
  - `sourceCycleOffset` 0.25, so A and B hang from C as a V at t=0.
  - The crown arbor is trimmed inside the cup.
  - The hub radius is 0.2.
- **Intersections:** tangent contact only.
- **Remaining:**
  - The blades are short (verge law).
  - The V is wider (100°) than Brown's.
  - The teeth are coarser than Brown's.
  - The lower weight arrangement is inferred.

## Verification
- The combined run of the 51 related test files passes: 327/327.
- A re-run after the last edits passes: 50/50.
