# Pass 62 — horology lane (284, 288, 291, 295, 296, 298, 309, 314, 316, 318, 360)

Captures (not in Git): `/dev/shm/p62-horology/before/ID-default.png` and
`/dev/shm/p62-horology/after/ID-default.png` (render beside the plate), plus
rotated tiles `/dev/shm/p62-horology/rot-*.png`, phase tiles and 2-D contact
plots in the same directory. Intersection screens were run one at a time
(`show-body-intersections --spacing=0.01 --samples=129`). Loop seams
(`check-loop-seams --ids=…`) are 0 for all eleven IDs.

## 284 saw-mill feed (authored-saw-feeds.js)

- The catch is rebuilt as Brown's scroll: a circular-arc stem and a clothoid
  scroll with a round terminal, fitted to the plate's ink (about 1 px), with a
  pointed claw web whose lower edge sweeps in one cubic into the scroll's
  underside. The old throat notch is gone.
- The hook now hangs where Brown draws it (the claw point at t = 0 is within
  4 px of his pocket, and the curl within about 1 px). The drawn slider
  setting (65 px below a) cannot sweep far enough for the claw to drop behind
  the next tooth; 9 px lower is the least setting that feeds (3–8 px were
  tried on the solved motion and fail). The catch is built from that hinge,
  so the slider stands 9 px low on its feed screw (a feed setting) while the
  hook stays in place.
- The claw's working edge rises 8° into the stem, as Brown's does. His rises
  about 16°; above about 9° it cuts into the tooth above (0.6 px² overlap at
  12°).
- Brown's click length is used (no extension). The gig-back now settles the
  wheel relative to the actual click seat. The measured overtravel is 0.057
  pitch. Tests have been rewritten: overtravel is measured, and a new test
  checks the hook against Brown's position.
- Intersections: before clear, after contact-level only (0.0001 ratchet/click,
  0.0000 ratchet/catch).

## 288 recoil anchor (authored-plate-escapements.js)

- Brown's 33 teeth. His pallet corners c and d stand almost exactly five
  pitches apart, which locks both pallets at once. Each pallet is now set
  3.25 px outward, which makes the span five and a half pitches. The working
  window is about 6–8 px of total spread; 4 px jams and 8+ px skips teeth.
- Intersections: 0.0000 (contact).

## 291 Arnold detent (authored-plate-escapements.js)

- Wheel B was re-measured with centre (145.5, 327), tips 119.5 px and roots
  101 px. The balance is now at Brown's (77, 186) with a 48 px roller. Stop d
  stands at Brown's x of 188–199 and reaches 218, 5 px below his 213, so the
  tips lock on its face.
- Plate time now picks the return swing, so A rests on its banking at t = 0.
- Intersections: only intended spring/stud and spring/hook contacts
  (≤ 0.009).

## 295 cylinder (authored-plate-escapements.js)

- Brown's plan draws two phases of the one cylinder, about 17° either side of
  the wheel top. The plan is turned −17° so the single cylinder stands at his
  right-hand position, with pallet c inside the passage. The view spans his
  whole drawing, so b and a stand to its left as drawn. No duplicate cylinder
  is added.
- Brown's left-hand position (b about to pass lip B) is another phase of the
  same motion and is not shown at t = 0.
- The model is shared with 294, which is unchanged.
- Note for integration: the rotation changes the root. The display profile
  for 295 (motionBounds) is rotation-invariant for the wheel but should be
  re-measured by the lead.
- Intersections: 0.0001 (contact).

## 296 lever (authored-plate-escapements.js)

- Pallets are as drawn, each turned a few degrees about B (right 2°, left 3°;
  4–7 px at the pallets). Measured wheel motion while the lever swings:
  - Before: 0.26 pitch on one beat and 0.31 on the other, then a 0.45 pitch
    free run with the lever at rest.
  - After: 0.44 (0.03 recoil) and 0.51 pitch while the lever swings, with only
    0.08 free.
- Intersections: 0.0000.

## 298 geared verge (authored-geared-balance-verge.js)

- Each loop's top now arches 0.2 above the arbor top (Brown's loops stand
  about 8 px over the rod). The wire still hugs the arbor low on its sides,
  where it is soldered. The working helix is unchanged.
- Intersections: clear.

## 309 Mudge gravity (authored-gravity-escapements.js, baked plates)

- The left arm's B end is now blunt: a well-rounded outer corner at Brown's
  (101.7, 202.5) running straight into the lifting face. It no longer ends in
  a square end cut that left a point.
- Plates were re-baked with `generate-gravity-escapement-plates.mjs 309`; only
  `left-pallet-plate` changed.
- Intersections: clear.

## 314 lever chronometer — no change (forced residuals)

- Lengthening C to 1.60–1.74 (with C turned −16° to +12° about the staff)
  always strikes a locked tooth on the return (0.05–0.096 solid overlap).
  1.50 stays.
- The speed overshoot before the catch (peak 1.73× C's speed) comes from the
  fixed release-to-catch window. An earlier release removes it but breaks the
  A-lock pose and speed continuity. It was left as is.

## 316 mercurial pendulum (authored-compensation-pendulums.js)

- The mercury is cut on the plane facing the camera (the shared cutaway
  `cutMercury`, passed from the factory only for 316). The rod's lower end
  now shows standing in it, as in Brown's section. The glass stays whole and
  clear.
- Intersections: unchanged pre-existing screw-seat pairs. The rod/mercury
  fluid depth changed from 0.50 to 0.095 (intended immersion).

## 318 regulator (watch-balance-parts.js `correctWatchRegulator`, 318 only; source-presentation note)

- Removed the front cock bar and the back-bar arm and post to stud R, since
  both crossed the balance spring. Brown draws neither. Stud R is left as the
  small drawn stud. The regulator's fixed ring stays concentric with the
  staff, hidden under the lever's ring.
- The back bar keeps only the staff bearing and the scale plate.
- Intersections: only the spring-to-collet seat (0.009).

## 360 oscillating drum (authored-oscillating-drum-ratchets.js export)

- Display time runs a quarter beam period ahead of the physical timeline
  (`timeline.displayTimeOffset`), so t = 0 shows the beam level as Brown draws
  it.
- The flywheel spokes are set back by the flywheel's advance over that shift,
  so they stand upright at t = 0.
- `stateAtTime` keeps the physical timeline. The 360 test now checks
  `update(t)` against `stateAtTime(t + offset)` and adds a level-beam test.
- Intersections: unchanged cord and frame contacts.

## Tests

Run and passing:

- movement-284, plate-escapements, movement-298, movement-309,
  gravity-escapement-working-solids
- movement-314, 316, 317, pendulum-journals, 318, 319, 360
- source-presentation

rotation-indicator has one failure, on 251, which belongs to another lane.
