# Pass 62, lane p62-shapes: review

Reviewer: Claude Opus 5.5 (lane p62-shapes). Captures came from the lane's own
dev server (port 44604). Default views used
`scripts/review-movement-source-views.mjs`. Rotated and phase views used a
lane playwright script that orbits the camera about the fitted target. All
captures are in `/dev/shm/p62-shapes/cap` and `/dev/shm/p62-shapes/final`,
outside Git.

## Changed

- **55** (`coaxial-gears.js`): C's web is now one plain face behind the gears,
  with no arms or windows, so C's interior reads blank as Brown draws it.
  - Screen (0.01, 129): clear. Faces: clean.
- **221** (`authored-elliptical-idler-gears.js`): the new depth order, front to
  back, is: arm; C and pinion B; wheels A and B; groove plate g–h.
  - The plate now lies behind C and the A/B wheel plane, as Brown dashes it.
  - The plate hangs from C on one post at the ellipse centre. Across the whole
    cycle, B's wheel stays 0.33 clear of that post and A's stays 0.55 clear.
  - Shaft D now runs only forward of C.
  - B's spindle runs back through its wheel into the groove.
  - The plate no longer covers B's pinion hub or C.
  - Screen: clear.
  - Contact report regenerated. Results are unchanged; only the source hashes
    changed.
  - The test that pinned the old front-plate layout was rewritten to require
    the rear layout, with shaft D clear of B's plane.
- **381** (`source-presentation.js`): the camera now looks straight down onto
  Brown's main figure, the plan, with the throat at the left.
- **384** (`authored-helicographs.js`), **502** (`epicyclic-family-corrections.js`),
  **504** and **507** (`authored-epicyclic-trains.js`): new framing.
  - Each view now frames Brown's pose whole and centred, plus part of the
    sweep, instead of the whole sweep. Gains are about 1.3× for 384, 504 and
    507, and 1.18× for 502.
  - 502 still keeps A, D and F's whole orbit in view.
  - Near the far side of the turn, B (502), the carried wheels (504, 507) and
    the wheel (384) leave the frame briefly. This is why the review script
    reports maxNdc above 1 for these IDs.
  - The tests that pinned whole-orbit framing were rewritten. They now require
    the source pose to be inside the frame and the frame to be tighter than
    the orbit.
  - The 503–504 contact report was regenerated: hashes only.
- **391** (`weighted-rack-selector-contact.js`): the working link is now joined
  into C's arm by a web, and C's arc ends at the link end (endAngle −0.85).
  - C now reads as one broad curved arm, not a fork.
  - Contact, torque and continuity tests pass.
  - Screen: unchanged. Only the intended hooks of spring d on its stud and
    anchor show (0.0175 and 0.0166).
- **475** (`ejector-trap-working-parts.js`): the water is now a light,
  clearly watery blue (0x8fd3ee at opacity 0.62) instead of a dark teal tint.
  The filled rear half and the level in C now read as water.
- **482** (`cutaway-presentations.js`, 482 entry and an opt-in flag): the
  quicksilver draws just behind the cup and valve skirts on the shared cut
  plane, using a polygon offset. The stripes are gone.
- **500** (`authored-diaphragm-pressure-gauges.js`): the section's pointer is
  clipped at the section plane, so it no longer stands in front of the cut.

## Unchanged: judged reasonable

- **54**: in the front elevation, block A is about 0.21 of the wheel diameter
  high. Brown's is about 0.26, so A is not larger in elevation. The collar
  channel and bars show only when the view is turned, and they are needed to
  carry the collar through both crossovers.
- **63**: following the user's direction, the drop lies in front of the disk
  and the pawl plate is see-through. The leg crossing the disk reads
  coherently in all phases.
- **229**: each link's V tooth seats in a matching V notch, with flats between
  the notches as in Brown. Brown's own notches lean differently from one to
  the next; the symmetric V is their average.

## Unchanged: residual forced

- **71**: the slits are the channels the studs sweep through the rim.
  - Measured against the tappet: our slits are at −64° and +28°; Brown's are
    at −33° and +47°.
  - Neither of the two free parameters moves the entering slit by more than
    5°:
    - rest angle 1.2° to 10°;
    - tappet half-width 0.02 to 0.07.
    A −8° rest angle loses contact.
- **211**: Brown's arc, measured from the teeth, is about 88° at an 8° pitch
  (not 80°). Ours is 99° at 9°. A 44-position wheel would push the tooth tips
  past the plain rim at Brown's centre distance, and would force a smaller
  pinion.
- **137**: in Brown's traced edge, the dimple at 4 o'clock sits opposite a
  flank that is also drawn low. The breadth across the fork there is 144 px,
  against about 156 px elsewhere. A 31 px roller bridging that 34 px-wide
  dimple would drop 5 px, but the fork's play is 1.2 px.
- **261**: Brown's crank pin sits at radius 44 px and the drum at 26 px, so the
  pin's circle crosses every tangent from the drum. A cord in front of B would
  be struck by the pin. The alternative is to put C behind B, which would hide
  the crank pin that Brown draws over B.
- **269**: Brown's 17 teeth fit in about 14.5 of his own pitches, so his groups
  overlap. Contiguous handoff at the gear's pitch needs 17 pitches.
- **370**: the click carrier, pawl and pin occupy every depth from the bar to
  the front of the ratchet, out to beyond the ratchet's radius. The lower rail
  and guide pins sit directly behind the bar, with a 0.01 gap. So a panel
  larger than the ratchet cannot sit behind it.
- **500** (rotation): with the section figure 0, 1.5 or 3 units further right,
  it still overlaps at 60° (tested). Avoiding the overlap would take a gap
  about three times the plate's, which would shrink the default figure.
