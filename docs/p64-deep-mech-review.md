# Pass 64, lane p64-deep-mech: review

Reviewer: Claude Opus 5.5 (lane p64-deep-mech). Captures came from the lane's
own dev server (port 44635). The before and after default views used
`scripts/review-movement-source-views.mjs`. Rotated views and motion phases
used a lane playwright script. Plate measurements were taken from the dark
pixels of `public/engravings/mm_NNN.png`. All captures are in
`/dev/shm/p64-deep-mech` (`before/`, `a1/`, `a2/`, `c211/`, `c261/`,
`c269b/`, `rot/`), outside Git.

Brief: each residual had been judged forced by earlier lanes. This lane went
back to Brown's plate and caption to test the assumptions behind that
judgement.

## Changed

### 261: cord D wraps a drum on B's front face (`authored-combination-drives.js`)

- **Plate.** D's right strand ends tangent to the left of the bold inner
  circle on B. That circle is about 27 px across against a 49 px crank
  radius. So D winds on a drum standing on B's front face, and the cord runs
  in front of B.
- **Why the old model was forced.** The crank pin's circle crosses every line
  that leaves the drum. So a pin rising from B's face through the cord's
  plane would strike the cord. The earlier fix hid the cord and drum behind B.
- **Redesign.** The pin now stands on a short crank arm keyed to the shaft end
  just in front of the drum. The pin therefore only occupies depths in front
  of the cord. The depth stack, front to back:
  1. link C;
  2. arm A;
  3. pulley E's front flange;
  4. the crank arm with its pin;
  5. drum, cord D and E's tread;
  6. disk B.
- **Other changes:**
  - Drum pitch radius changed from 0.22 to 0.35, B's axle circle from 0.16
    to 0.13, both per the plate.
  - E's journal, pivot G and the joint pins were lengthened to reach the new
    depths.
  - The hub starts inside B, which removes a coplanar face.
- **Captures:**
  - `a1/261-default.png`: D visibly wraps the drum on B's face.
  - `t261.png`: phases 0, 0.25 and 0.5, and ±60° and top views.
  - `trot.png`.
- **Intersections (0.01, 129 samples):**
  - Before: the tied cord eye (0.030) and cord on drum (0.0007).
  - After: the tied cord eye (0.0317, intended) and the pin seated on the
    crank arm (coaxial 0.0000). Nothing else.
- **Other checks:** faces clean; loop seam 0.
- **Test.** `tests/movement-261.test.mjs` pinned "drum lies behind B". It now
  requires:
  - the drum on B's front face;
  - the cord in front of B;
  - the crank pin and crank arm always in front of the cord.
  `spatial-linkage-solids` passes.

### 269: gear chosen to Brown's rack pitch (`authored-mutilated-racks.js`)

- **Plate measurements:**
  - Brown draws 18 gear teeth. His rack pitch lines are 118 px apart, which
    gives a pitch radius of 59 px.
  - His 17 rack teeth run 40 → 340 px, which is 300 px or about 15 of the
    gear's 20.3 px pitches. The 7- and 2-tooth groups are compressed to about
    17.5 px.
  - A gear of the same size at the pitch his 17 teeth need has 20 teeth
    (18.3 px).
- **Change:**
  - The gear now has 20 teeth. Pitch radius, frame height, groups and stroke
    rule are unchanged.
  - The teeth are phased half a pitch so that a tooth space faces each rack
    at zero rotation.
  - The closed end's width now comes from the plate's pixel scale.
  - The rack relief was rebaked. The same 12 transition-adjacent teeth are
    relieved; the working teeth stay full.
- **Result:**
  - The 17-tooth rack length is now 315 px against Brown's 300 px (was
    344 px).
  - The frame's inner length is 5.38 against 5.86 units (Brown 4.66).
  - The outer length-to-height ratio is 1.92 against 2.08 (Brown 1.71).
- **What was tried and why the rest is forced:**
  - Rolling all 17 teeth (tried, and captured in
    `/dev/shm/p64-deep-mech/t269.png`) makes the frame's length exactly
    Brown's. But at the limits, the gear sits 80 % outside the open end, and
    crosses the closed end in the front view. That is the pass-53 "flawed"
    finding, so it was reverted.
  - The gear's tip radius is 3.5 pitches. So teeth within about 3 pitches of
    either end cannot mesh while the gear stays in the yoke: three teeth of
    the upper-left group and one lower-right tooth idle.
  - The closed end must stand a tip radius (plus 0.05) beyond the stroke's
    last contact, 0.6 pitch into the 2-tooth group. That leaves it 2.1
    pitches (0.57 units) further out than Brown's quarter pitch. This
    distance is set by the gear radius, not by the pitch.
- **Captures:** `a2/269-default.png`; `t269b.png` (eight phases); `trot.png`.
- **Checks:** intersections clear (2 bodies). Loop seam 0. The faces scan
  shows only same-material flush joggles, as before.
- **Tests.** `tests/movement-269.test.mjs` updated:
  - Brown's plate count stays 18 while the model has 20.
  - The rack span is within 16 px of Brown's 300 px.
  - The closed-end width is checked in plate pixels.

### 211: 45-position wheel and 18-position pinion (`authored-intermittent-core.js`, the 211 function only)

- **Plate.** Brown's pinion tips fall every 20°: 13 teeth, with 5 positions
  missing where the lock faces the wheel. That is an 18-position pinion, not
  16. Eleven wheel teeth span about 88°.
- **Change:**
  - 45 : 18 at the same 5 : 2 ratio, so the pitch radii, plain rim and
    centre distance are unchanged.
  - Wheel pitch is 8°. Eleven teeth span exactly 88°.
  - The pinion has 13 teeth on 18 positions, the 5 missing ones centred on
    the lock.
  - The tooth tips stay inside the plain rim (8.88 < 9.1).
  - The first wheel tooth sits 3.5 pitches behind the pin, so its centre
    meets a pinion space.
  - The guide hands over at 22.5°.
  - The dedendum is now at least the addendum plus 0.09, so the swept
    0.08 clearance never cuts below the root.
  - Tooth and pocket angles are derived from the counts, not hard-coded.
- **Measured:**
  - Toothed arc 156° → 68° (was 157.5° → 58.5°).
  - Along the whole index (0–143°), the wheel stays at the 0.08 running
    clearance from the pinion, as before.
- **Residual (forced).** One pinion turn takes 360°/2.5 = 144° of wheel.
  - The plain rim therefore cannot resume before 180° − 144° = 36° in the
    wheel's frame. The cut arc (teeth plus relocking relief) spans 137°, the
    same as before, against Brown's roughly 95°.
  - The relocking relief after the last tooth grew from 19.5° to 29°.
  - Matching Brown's 88° arc with no relief would need a ratio near 3.3. At
    Brown's centre distance, that puts the wheel's pitch circle at his plain
    rim and shrinks the pinion by about 25 %.
  - 41 : 18 (Brown's measured 8.8° wheel pitch) was also computed. It makes
    the index 158°, which is worse.
- **Captures:**
  - `cmp211.png`: before, after, plate.
  - `t211.png`: seven phases through the index.
- **Checks:** intersections clear. Loop seam 0 (the velocity step at the loop
  point is the index start). The faces scan shows 2 mixed-edge extrusions,
  the same welded seams listed in pass 61.
- **Tests.** `tests/movement-211.test.mjs` updated to 45 : 18: 88° arc,
  5 missing positions, stage counts, 220° of pinion turn from the teeth.
  - Three float tolerances were widened by less than 2e-15, or 5e-8 for the
    sampled guide pass.
  - Movement 63 and the tests that load 211 (208, 210, 212) pass.

## Unchanged: residual shown to be forced

### 71: slit positions

- **Plate.** Brown's notches sit at about 129° and 217° about B. The static
  intersections of C's stud orbit with B's rim, from his radii, are at about
  143° and 230°. Brown draws the notches where C's orbit crosses the rim in
  the pose shown.
- **Why a working rim cannot match.** A working rim needs each slit where its
  stud actually crosses the rim.
  - The leaving stud crosses early in the push. The entering stud crosses
    near the end.
  - The push itself takes 55° of B. That is set by Brown's proportions: the
    stud orbit is 0.662 D and the struck stud sits 0.34 D from B's axis, so
    C turns about half as fast as B while pushed.
  - B therefore carries each slit 20–40° clockwise of the static
    intersection before the stud reaches it.
  - Brown's placement would need the whole 36° step of C to take about 8° of
    B.
- **Brown's tappet cannot explain it.** It is a triangle whose leading edge,
  at the struck stud's radius, is only about 6° ahead of its tip direction.
  So it would move the slits the wrong way.
- **Earlier findings stand.** The rest angle and tappet width move the
  slits by under 5°. A −8° rest angle loses contact.
- **Considered, not adopted.** Showing B about 30° further on at t = 0 would
  align the slits with Brown's, but would put the tappet mid-push and C's
  studs off Brown's positions.

### 208: slot ends

The pinion must slide along its shaft between the three rings, while stopped
and indexed.

- **Why a pin is always in a slot.** For continuous drive, some pin must be
  engaged at every wheel angle. So at any stop at least one pin of the
  engaged ring lies inside the pinion's outer circle, in a slot.
- **Why both ends must stay open.** Sliding to either neighbouring ring
  moves that pin axially out through the slot's end.
  - A slot closed at the inner end traps it on shifts inward. One closed at
    the outer end traps it on shifts outward.
  - Both ends must therefore be open, whatever the pin length or slab width.
- **Running alone would not fix it either.** It would need closed pockets
  and pins entering at most about 0.045 into the pinion's rim. Only then
  does the pins' drift along the shaft (the inner ring's is 0.11) fit
  between the neighbouring rings, with inner-neighbour room of 0.23. That
  was computed by sampling. It still fails the shift.
- **Result.** No change.

## Proposed ledger text

- **261:** assessment reasonable.
  - visibleFlaws: "".
  - limits: "Cord D winds on a drum on B's front face; the crank pin stands on
    a short crank arm keyed to the shaft end in front of the drum (Brown
    draws the pin on B's face, but there it would strike the cord); rope
    tension not simulated."
- **269:** assessment minor.
  - visibleFlaws: "The closed end stands about 2 pitches further from the
    last tooth than Brown's, so the frame is about 15 % longer; the gear has
    20 teeth against Brown's 18."
  - limits: "The gear is chosen at the rack pitch Brown's 17 teeth need in
    his frame. The gear's 3.5-pitch tip radius keeps it inside the yoke only
    if the stroke stops 0.6 pitch into each end group, so three upper-left
    teeth and one lower-right tooth never engage. The closed end and the
    rod's flat end are set back behind the gear. Handoff teeth are relieved
    at working depth and keep Brown's outline as a web behind the gear. The
    rod, which Brown breaks off, leaves the view at the stroke limit.
    Spoked web built by the shared filleted spoked-wheel builder."
- **211:** assessment minor.
  - visibleFlaws: "After the eleven teeth (88°, as drawn) the wheel is
    relieved at root depth for another 29° before its plain rim, so the cut
    arc spans about 137° against Brown's ~95°."
  - limits: "45 : 18 positions at 5 : 2 (Brown's 20° pinion pitch, 13 teeth,
    5-position lock). One pinion turn takes 144° of wheel, so the plain rim
    cannot resume sooner. About 30° of relocking is prescribed motion, cut
    by the swept pinion. The tongue's working edge follows the pin's
    epicycloid."
- **71:** unchanged.
  - visibleFlaws: unchanged.
  - limits: add "Brown draws the notches at the static orbit/rim
    intersections; a working slit lies where its stud crosses the rim during
    the 55° push, 20–40° clockwise of that."
- **208:** unchanged.
  - visibleFlaws: unchanged.
  - limits: replace the closed-end sentence with "Closed slot ends are
    impossible: when the stopped pinion slides to a neighbouring ring, the
    pin that is in a slot (one always is, for continuous drive) must leave
    through that slot's end."
