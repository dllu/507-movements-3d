# Pass 61 lane p61-a review: 252, 256, 262/263, 264, 272, 273

Reviewer: Claude Opus 5.5 (lane p61-a). Captures were made from a freshly restarted non-watching dev server
(port 44531) under /dev/shm/h1 (`before/`, `a1`–`a4`, `c252`, `c26y`, `c264`, `c4`): each shows the default
view beside the plate, three rotated views and motion frames. Intersections were screened with
`node scripts/show-body-intersections.mjs ID --spacing=0.01 --samples=129`.

## 252: one-piece standard and slotted bar C
- Before: separate stepped head, a post, two box rails and an end block. The head's flares ended at ±0.9
  against rails whose outer edges were at ±1.1, so the junction was stepped and the slot ran open to the head.
- Now the fixed frame is one extrusion (`fixed-one-piece-standard-and-slotted-bar-c`). Its outline is the
  standard (continuing below Brown's break as the kept support), two circular coves (r 0.95) tangent to the
  head face and to the bar edges, and the bar (half-height 1.3, about Brown's bar-to-slot ratio of 2.3) running
  on past the crop to a closed end. The slot C hole has a rounded left end just clear of the coves, as drawn,
  and a rounded closed right end. Camera fitting still uses only the plate's extent. The roller front
  flanges moved 0.02 forward to clear the arm's 0.025 edge bevel.
- Intersections: before, 0.005 (the flange against the yoke arm bevel). After, no pairs.
- Verified in `a1/252-default.png` and `c4/t252.png` (default, oblique, rear-oblique and side views): the
  bar joins the head smoothly with no step or seam.

## 256: crowned pulley
- The rim's top and bottom edges on the plate are convex arcs, about 5.5 px of sagitta on a 212 px radius.
  The tread is now a lathed circular-arc crown (crest 2.65, edges 2.58, crown 0.07) with crease normals, so it
  shades smoothly. The archetype in the factory and `movements.json` is renamed `crowned-tread-…`, and the
  rotation-cue role is renamed to match.
- Intersections: 0 pairs (one rigid rotor).
- Verified in `a4/256-default.png` (the curved edges match the plate) and `c4/t256.png`.

## 262/263: one shared model
- Before: 262 used a splayed-leg end-view stand with an emissive material hack. 263 used a hand-built flared
  pedestal with flat-face normals, which rendered dark. 263 also kept a link bar with joint balls at each cone
  end, while 262 had a round boss.
- Now both IDs build exactly the same parts; only the camera, the FOV and the `presentationView` tag differ.
  A test asserts identical mesh roles and vertex counts across the two IDs.
  - Standard E is one crossed-web pedestal: a foot plate and two orthogonal webs with circular-quadrant coves
    rising to a neck, with a cradle fitted to nut E. This matches Brown's footed cradle in the end view and the
    flared standard in the side view. It is built from `plate()` extrusions plus a box, merged, with flat
    outward normals. A test checks that the winding agrees with the normals and that the volume is positive.
  - B's large end carries Brown's round boss in both views. The small-end carrier bar was removed; D's core
    now runs 0.1 into B's small end.
  - The emissive hack was removed. `round-large-end-boss-round-screw-D` was added to 263's rotation cues.
- Kept: roller C's inferred guide post (it is still the only carrier of C). There is no laid rope in this model.
- Intersections: only the working cone/roller contact (0.0000) in both IDs.
- Verified in `a2/262-default.png`, `a2/263-default.png` and `c26y/t.png`: rotated views show identical
  models and a light-grey, correctly lit stand.

## 264: visible differential
- The wheel turns once in 2 s (30 rpm) and the worm at 3000 rpm. The display loop is the full beat of
  10,100 worm turns = 202 s, played in real time, and every part is exactly back in phase at 202 s. The needles
  part by about 18° in 10 s and by a full turn over the loop.
- `display-timing.js` gained an opt-in `root.userData.authoredPlaybackTimeScale`, set to 1 for 264. The
  global sustained-speed cap would otherwise slow the worm back to one turn per second and hide the effect.
- The worm-solid report (`docs/validation/202-264-worm-solids.json`) was regenerated: 0 penetrations.
- Intersections: 0 pairs.
- Verified in `c264/t.png`: motion frames at quarter-beats show the two needles at different angles.
- Loop-seam checker: 252/256/262/263/272/273 score 0. The checker flags 264 at the loop point only because its
  fixed 4e-4 s bracket spans 0.13 rad of steady 3000 rpm worm rotation, so 264 was added to
  `LOOP_SEAM_ALLOWLIST` in `tests/loop-seams.test.mjs` with that reason. The movement-264 test asserts exact
  closure at the beat.
- Residual: at 60 Hz the worm thread (50 rev/s) and the wheel teeth (50 teeth/s, 0.83 per frame) strobe. The
  needles, the part that carries the demonstration, move smoothly at 0.5 rev/s.

## 272: rod bears on a chamfer square to it
- Before: the rod's yellow ball shoe touched the conical/trough face at about 51° from its axis.
- Now the disk has three working surfaces:
  - The trough face, whose rim is Brown's first wavy line.
  - A narrow chamfer, 0.56 along its slant (Brown's band between the two wavy lines), whose generator is
    perpendicular to the rod.
  - A rim bevel parallel to the rod, running back to a rear face two-thirds of the height, as drawn.

  Because the bevel is parallel to the rod, the wave carries the chamfer straight along the rod axis. The
  contact stays mid-chamfer (0.275–0.280 of 0.56 along the slant) and within 12.3° of the rod axis all
  cycle. The stroke is 0.43, twice per turn.
- The rod end is a shallow dome in the rod's own colour: a sphere cap of radius 0.6 across the rod's 0.15
  radius, 0.019 high. It reads as Brown's square end. The contact is solved numerically: a golden-section
  search over the material angle plus bisection along the rod. The chamfer radius uses a cancellation-free
  quadratic root.
- The coincident "working band" skin was removed, and the rotation cue now lists only the disk body.
- Guides were re-referenced so they sit at the same distance from the rod end.
- Intersections: 0 pairs.
- Verified in `a3/272-default.png` and a zoomed crop (`272-contact.png`): the rod end abuts the chamfer band
  square, as in the plate. Rotated views and frames are in `c4/t272.png`.

## 273: corner eyes clear the guides
- At full spread (half span 2.364) the link eyes (r 0.21) reached 2.574 and entered the horizontal guides,
  whose inner ends were at 2.56 (reported 0.0139 overlap against the depth straps). The horizontal guides now
  sit at 2.9 (inner end 2.66, 0.086 clear) and the A/B rods are 0.1 longer, so rod engagement beyond the
  guides is unchanged (0.144).
- A test asserts eye-to-guide clearance of more than 0.08 at 12,000 poses.
- Intersections: before, 0.0139 (4 pairs). After, 0 pairs.
- Verified in `c4/t273.png`: at the widest frame there is a visible gap between the B eye and its guide.

## Proposed ledger text
- **252**: reasonable. visibleFlaws "". limits: "D's stroke (3.6) is shorter than the official animation's so its
  crossbar stays below slot C; the standard continues below Brown's break and the bar past his crop; running
  clearances and friction are unvalidated." Intersections sampled-clear (p61: 0 pairs).
- **256**: reasonable. visibleFlaws "". limits: "Belt contact, tension and slip are not qualified because no belt
  is drawn; the crown is a circular arc sized from the plate."
- **262/263**: minor. visibleFlaws: "Roller C's inferred guide post and arm (not drawn by Brown) show beside B
  in the end view." limits: "One shared model (only the camera differs); stand E's foot is about a quarter
  wider across the axis than Brown's so it shows beside B's lowest rim; pressing spring not drawn; ideal
  rolling; the screw returns after three turns." Intersections sampled-clear (cone/roller contact only).
- **264**: reasonable. visibleFlaws "". limits: "Plays in real time at 30 rpm / 3000 rpm worm so the needles
  visibly part (full lap in the 202 s loop); the worm thread and fine teeth strobe at 60 Hz; generated worm
  mate has intentional cutter clearance; loaded meshing unvalidated."
- **272**: reasonable if the ledger's remaining "dome gradient" note is judged gone on review (the rim now
  shows distinct face, chamfer and bevel facets). limits: "Gravity preload assumed; the rod end is a
  0.019-high dome so it bears smoothly as the chamfer tilts up to 12°; friction and loads not simulated."
  Intersections sampled-clear (0 pairs).
- **273**: reasonable. visibleFlaws "". limits unchanged. Intersections sampled-clear (p61: 0 pairs; the
  guides were moved 0.1 outward to clear the eyes).

## Files
- `src/simulation/authored-crossed-slots.js`, `authored-pulley-forms.js`, `authored-eccentric-cone-drives.js`,
  `authored-differential-worm-drives.js`, `authored-beveled-cams.js`, `authored-rhombus-linkages.js`
- `src/simulation/display-timing.js` (opt-in `authoredPlaybackTimeScale`)
- `src/data/rotation-indicators.js` (entries for 256, 263 and 272), `src/data/movements.json` (256 archetype)
- `docs/validation/202-264-worm-solids.json` (regenerated)
- tests: `loop-seams` (264 allowlist entry), `movement-252`, `slot-family-clearance`, `movement-256`, `cone-friction-solids`, `movement-264`,
  `movement-272`, `cam-272-276-solids`, `movement-273`

Display profiles to re-measure: 252, 256, 262, 263, 264, 272, 273.
