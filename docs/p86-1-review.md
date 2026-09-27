# Pass 86, lane p86-1: pawls, clicks and stops in `authored-intermittent-core.js`

Reviewer: Claude Opus 5.5, lane p86-1. Date: 2026-09-27.

Scope: the user's named IDs 82, 211, 232, 233, 235, 237, 240 and 241, then a sweep of 63, 71, 73, 83, 121, 155, 206, 212,
213, 214, 215, 225 and 236.

Captures are kept outside Git in `/dev/shm/p86/p86-1/`:
- `before/tile-ID.png` and `after/tile-ID.png`: the plate beside the default view at four phases, ±60°, back, top and
  the seam phases. They were made with `cap.mjs` and `tile.py`, which are copies of the p84-e harness.
- `aID/`: after close-ups of each pawl or stop contact at several phases, including the hold (`t.png`, `z.png` and
  `c.png`).
- `bID/`: the matching before close-ups.
- `sweep/tile-ID.png`: the sweep IDs, which were left unchanged except 236.
- `screens/inter.json` and `screens/disc.json`: the intersection and disconnected-parts screens after the changes.

No factory changed which IDs it handles. No report in `docs/validation` fingerprints any file this lane changed. The
baked tables that were regenerated are `baked/star-tappet-paths.js` (235) and `baked/ratchet-stop-240-paths.js` (240);
both pass their generators' `--check`.

## 211: the tongue now arches up and droops, as drawn

**Complaint.** The banana was oriented opposite to the engraving.

**Cause.** The working flank was the pin's epicycloid at the full 2.5 ratio. That path always curls upward, so the
tongue did too, over the 22.5° of wheel that the pin had to drive. In Brown's plate the tongue is a frown: it rises from
the hub and droops to its tip. The pinion's teeth also run right up to the pin on the upper side.

**Change** (`authored-intermittent-core.js`, 211 only):
- **Pinion teeth.** The five missing positions are shifted one pitch below the line of centres, to −60…+20°. The
  nearest upper tooth is now at +40°, which is the closest that still clears the plain rim in the dwell (0.16 to
  spare). It keeps 13 teeth, as Brown draws. The wheel's first tooth moves 2.5 pitches behind the pin (was 3.5), so
  its teeth run up to the pin, as drawn.
- **Tongue.** The top is one true circular arc (the crown): centre (4.5, −1.75), radius 2.5, construction units. A
  straight root runs tangent into it from a boss round the pinion's shaft, and the arc droops to a rounded tip. The
  underside is the concentric arc, so the tongue keeps one thickness (0.8).
- **Pin and push.** The pin sits at 8.7 on the wheel (just inside the plain rim) and strikes the crown's rising side.
  The pinion's angle during the push is solved from the pin/arc contact, with a 0.012 running clearance, instead of
  being prescribed at 2.5. The pin's mounting angle is chosen so the push ends exactly on the tooth mesh at 14.5° of
  wheel. The pinion then turns at 2.2–2.3× the wheel, stepping up to the mesh's 2.5 at the handoff (a 10% speed step,
  where it was 0→2.5 at the strike before).
- **Boss.** The coordinator asked for the sliver joint to be fixed. The guide's boss (r 1.45) now surrounds the shaft
  and sits on the pinion's hub ring all round (bored to the pinion's bore). The tongue grows out of it, as Brown draws.
- **Pinion depth.** The pinion is 0.32 deep (was 0.4) and the pin starts at 0.165, so the pin passes over the
  pinion's teeth. The guide sits 0.005 proud of the wheel's face.

**Checks.**
- Pin/guide clearance is ≥ 0.0025 over the whole cycle.
- Position is continuous at the strike and at the handoff.
- The sliver screen's boss/hub-ring "cap" row is gone (0 slivers).
- The intersection screen is clear.
- The detached row (the pinion group, 0.0186 from the wheel) is the lock's running clearance, as before.

**Captures.** `a211/t.png` (default view at four phases beside the plate), `a211/z.png` (the pin on the crown at six
phases and rotated) and `after/tile-211.png`.

**Tests.** `tests/movement-211.test.mjs`, 5/5, updated:
- the missing positions;
- the boss, crown and droop;
- the push ratio (bounded 0.9–3);
- continuity and the 2.5 ratio after the handoff;
- new stage counts.

**Residual.** Relief after the teeth grows by one pitch, to about 37°, because the teeth moved one pitch towards the
pin. The cut arc is unchanged (about 137°).

## 232: plain holes in A, an oblong finger on C

**Complaints.**
- A floating curved piece near a pawl's tip.
- The pawl was a trapezoid, not an oblong.
- Should A be fixed or rocking?

**A: fixed or rocking?**
- B turns on the wheel's axis, and the equal links make B and C a parallelogram. With A fixed, C would swing in and
  out along a single arc about A's top pin and re-enter the space it left. That cannot give the caption's "traveling
  backward over the circumference, again drops between two teeth … and draws with it the wheel".
- The rocking carrier is the reading that works. A's outline also encloses the wheel's axis.
- A stays a carrier journalled on the wheel shaft.

**Floating piece.** This was the crescent of carrier plate left between the curved slots that were cut for the fixed
"guide pins". The slots, both fixed pins (`fixed-A-upper-guide-pin`, `fixed-frame-A-lower-mount-bolt`) and the undrawn
brace (`232-fixed-guide-pin-support`) are removed. Brown's two small holes stay plain holes in A.

**Pawl C.**
- **Finger.** C's working end is now an oblong finger in the wheel's plane, 0.15 wide. Its working side lies along the
  square tooth's radial face (0.004 off it). Its flat end sits 0.012 above the root, so it fills the space.
- **Band.** The band ends flush with the finger.
- **Motion.**
  - The finger backs off the face as it lifts, and rises 0.07 clear of the tips.
  - It drops 0.02 behind the face (the backlash), takes that up while the wheel stands, then draws.
  - During the draw it moves rigidly with the wheel.

**Checks.** The finger/wheel polygon overlap is 0 at 240 phases. The intersection and disconnected screens are clear
(0 detached).

**Captures.** `a232/t.png` (finger in the space at six phases and two rotated views) and `after/tile-232.png`.

**Tests.** `movement-232` 8/8 and `lift-draw-pawl-232-solids` 6/6. They now check:
- the finger's backlash and lift;
- the contact on the working side;
- no guide pins, slots or brace (new test).

## 233: a flat latch with a slanted end, borne on one stave

**Complaint.** The latch hardly engaged the pins and couldn't lock the wheel.

**Before.** The latch was a tapered cam whose face was the envelope of a stave, with a 4° lift, so a stave slid past
under it.

**Change** (`authored-intermittent-core.js` and `lantern-stop-233-working-parts.js`).
- **Shape.** Brown's straight flat bar (0.715 wide, centred on its pivot), with its end cut on a 62° slant and a 0.04
  fillet at the tip.
- **Rest pose.**
  - The underside rests on the lower stave (0.004).
  - The tip stands just clear of the upper stave's side, between the two.
  - The slant faces the upper stave across Brown's drawn lash. Turning the wheel clockwise by 6.7° brings the upper stave
    onto the slant, which then drives the bar down onto the lower stave, so it locks.
- **Lift.** Solved, not prescribed: the least lift that keeps the bar 0.002 clear of every stave (a gravity follower).
  - Turned counterclockwise, the lower stave lifts the bar up to 10.3°.
  - The bar falls off the tip just before the pitch completes and lands on the next stave.
  - The table is 2048 steps with monotone cubic interpolation.
- **Rest block.** The undrawn latch rest block is removed; the stave bears the latch.

**Captures.** `a233/t.png` (the ride and fall) and `a233/z.png` (the tip between two staves, at rest and rotated).

**Tests.**
- `movement-233`, 8/8. The latch test is rewritten for the bar, the slant, the solved lift and the fall. The latch's
  finite-difference tolerances are relaxed (speed 1e-4 relative, acceleration 30%) because the lift is now a spline
  through a solved table.
- `lantern-stop-233-contact`, 5/5. It now requires that a stave bears the bar in ≥ 85% of latch states.

## 235: raked star and a smooth crescent click

**Complaint.** The grey click was awkward. Raise its pivot and give the teeth more rake.

**Change** (`authored-intermittent-core.js` and `star-tappet-working-parts.js`; baked paths regenerated).
- **Teeth.** Each working face now runs 8° from root to tip (was 25°), with the long back taking the rest, as the plate
  shows.
- **Click pivot.** The eye is raised 12 px on the plate, from (159, 153) to (159, 141).
- **Click shape.** One smooth crescent: a round eye (r 0.14), one circular arc bowed round outside the points, and an
  even taper to a rounded nose that seats low on the face (20% up from the root). It was a band, a corner and a
  straight hook.
- **Tappet beak.** The beak's lower edge leaves its nose further round (−2.6 rad), so its body clears the steeper face.
- **Baked paths.** `generate-star-tappet-paths.mjs` was rerun: tappet lift is now up to 0.432 and click lift up to
  0.456 (26°).

**Captures.** `a235/t.png` (click at three phases), `a235/tt.png` (tappet) and `after/tile-235.png`.

**Tests.** `movement-235` 8/8 (updated pivot, face span, lift bounds) and `star-tappet-working-parts` 5/5.

## 237: no ball on the pawl

**Change** (`crown-pawl-237-working-parts.js`).
- **Nose.** The pawl is one curved plate, even width, whose rounded end is the working nose: radius 0.054, about the
  old nose centre. The black ball is hidden.
- **Plate.** 0.044 thick radially, and curved with the crown (its tangential coordinate scales with radius), so the
  nose's front lies on each radial tooth face across the thickness.
- **Taper.** The width swells into the nose only at its end.

**Checks.** The plate's minimum gap to the teeth is 0.0008 (nose 0.00014).

**Captures.** `a237/t.png`.

**Tests.** `crown-pawl-237-contact` updated: the nose ball is hidden and the plate itself reaches the teeth. With
`movement-237`, 13/13.

## 240: teeth raked as drawn, stop C rebuilt from the plate

**Complaints.**
- The teeth raked opposite to the engraving.
- Stop C was nothing like Brown's.

**Teeth.** Each tooth now rises steeply from its root to a short tip and runs back down a long ramp: tips at 0.27–0.31
pitch, where they were at 0.69–0.73. The steep faces meet a clockwise turn, so the stops lock clockwise and the wheel
runs free counterclockwise. The drive now turns counterclockwise.

**Backlash.** Each drive runs the wheel about 0.11 pitch past (advance = q + 4q⁶(1−q)), then lets it slip back. So each
stop falls off the tip into the root and meets the steep face. Without this the toe could only reach its seat at the
instant of the drop.

**Toe seat.** 35% up the steep face from the root, where it was 55% up.

**Stop C.**
- **Pivot.** C turns on its own drawn hole, raster (213.75, 386.25), where it used to turn about the S-lever's anchor.
  Its tip is at (238.75, 347.5).
- **Outline.** Traced from the plate: a tapered block rising to its upper right tip, which is the toe on the steep face;
  a short right edge; a lower edge that curls down into a round knob. The top edge is lowered 5–17 px on the plate so it
  clears the teeth at C's 32° lift.
- **Pin and collar.** C's pin and collar are slimmer (r 0.047 / 0.1).
- **S-spring.** A separate flat band anchored at its leaf eye, raster (255, 455). It bends to follow C: each vertex
  turns about C's pivot by C's angle, weighted from 0 at the loop to 1 at C.
- **Stays down.** Because C turns on its own hole, its toe cannot be lifted off the face at rest. It can only leave or
  re-enter a space by riding the ramp, so C stays down through every stroke, as Brown draws it. The hook and straight
  stops still alternate.

**Baked paths.** `generate-ratchet-stop-240-paths.mjs` was rerun with the advance law. Maxima are 0.13, 0.098 and
0.556.

**Checks.** The whole-plate solid clearance passes for every stop, and C is no longer detached.

**Captures.** `after/tile-240.png` and `a240/c.png` (C seated at the tooth, riding, and the S-spring).

**Tests.**
- `movement-240`, 8/8. Updated for:
  - the counterclockwise direction, the backlash and the closure;
  - C's pivot and anchor;
  - C always engaged.
  The legacy point-model overtravel check is dropped; the finite retaining moment is checked in the working-parts
  file.
- `ratchet-stop-240-working-parts`, 5/5. The moment sign is flipped, and the per-sample angle step is loosened to
  0.0075 for the overshoot.

## 241: rounded click on a real eye, simpler comma tooth

**Complaints.**
- The yellow click was too sharp and not properly attached at its hinge.
- The orange tooth was needlessly complex.

**Click.**
- **Shape.** A smooth crescent: a round eye (r 0.2) on its pivot pin, one circular arc (sag 0.42) bowed over the teeth,
  and an even taper to a rounded nose (r 0.045).
- **Seat.** At rest the nose sits in the root, touching the lock face and the next ramp.
- **Kinematics.** They follow the nose centre against the tooth outline grown by the nose radius (circumscribed corner
  arcs), where they used to follow a knife point at the root vertex. Minimum nose clearance is −6e-16.

**Tooth.** The source horn (working tip and flanks unchanged) is joined to a round head by a straight neck. The curl and
the separate body are gone.

**Captures.** `a241/t.png` (the click) and `a241/t2.png` (the tooth).

**Tests.**
- `movement-241`, 8/8. It adds the `rounded-tip-corner` face type, and the plate check measures the nose centre.
- `single-tooth-241-contact`, 5/5. The holding check is now nose-on-face, and the continuity check measures the nose
  centre.
- The contact solve is slower: `movement-241` takes 13 s.

## 82: not changed

**Tried.** Both pawls given the upper pawl's traced outline and eye, turned about the wheel axis to the lower arm's
pivot, in `mujoco-treadle/geometry.js`.

**Result.** `bake-mujoco-movement.mjs 82 --dry-run` no longer closes a loop: best 1.76 px at `ratchetBody` against the
0.5 px tolerance. The live pawls did not seat reliably. The lower pawl's arm radius (313 px) differs from the upper's
(331 px), and its torsion spring was tuned for its own outline.

**Reverted.** The file was restored with `git checkout -- src/simulation/mujoco-treadle/geometry.js`. It held only this
lane's edit.

**Needs.** A re-tuned MuJoCo pair (spring, seats) and a rebake.

## Sweep

- **236.** Each pawl's eye boss is enlarged to r 0.14 (it was 0.1 round a 0.075 bore, a 0.025 wall). Toes are
  unchanged. `movement-236` 8/8 and `alternating-pawl-236-contact` 5/5.
- **206, not fixed.** At the hold the left end of the double pawl bears on the outer part of the tooth, not in the root
  (`/dev/shm/p86/p86-1/s206/t.png`).
- **225, not fixed.** The nose bears high on the steep face and never reaches the root. The bar rides the tips on the
  return (`s225/t.png`). The ledger already records this.
- **214, not fixed.** The finger stops end in needle points; Brown's fingers are rounded. The stops are point contacts,
  so rounding them needs the grown-outline treatment used for 241.
- **Reviewed, no pawl-shape change:** 63, 71, 73, 83, 121, 155, 212, 213, 215. 83, 121 and 155 are baked MuJoCo from
  other files.

## Checks run

- **Tests.** `node --test`: 211, 232 (×2), 233 (×2), 235 (×2), 236 (×2), 237 (×2), 240 (×2), 241 (×2), with the
  sweep and loader tests in `/dev/shm/p86/p86-1/final-tests.log`.
- **Loop seams.** `check-loop-seams --ids=211,232,233,235,237,240,241`: 0 seams, 0 pops, 0 errors.
- **Camera fit.** The camera-fit test, filtered to these IDs (`/dev/shm/p86/p86-1/camera-mine.test.mjs`): pass.
- **Intersections.** `screen-body-intersections`: worst solid 0 on all seven.
- **Disconnected parts.**
  - 232 is at 0 detached.
  - 211's sliver is gone.
  - 240's C is no longer detached.
  - The other detached rows (233 roller and latch pivots, 235 click, 240 parked hook and straight stops, 241 driver
    hub) match the earlier `/dev/shm/p86/sliver.json` screen.
