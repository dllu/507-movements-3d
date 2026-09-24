# Lane m11-forced-intermittent: new constructions for 63, 71, 206, 211, 213, 215, 218

The previous lane (m2, `docs/m2-intermittent-review.md`) judged these residuals
forced. This lane looked for new constructions that remove each visible
difference.

Method:
- Captures came from production routes on a private non-watching server (port
  44335), shown beside `public/engravings/mm_NNN.png`. For each ID there are
  before and after default views, plus 4-, 8- and 12-phase strips.
- Intersection screens used `node scripts/show-body-intersections.mjs ID
  --spacing=0.01 --samples=129`.
- The ledger was not edited. Proposed ledger text is given for each ID.

## 213: split-rim face-pin winding stop (changed; square teeth now work)

**New construction.** The m2 finding ("only 0.08-deep square teeth solve") held
because two things were fixed together: the tooth root and the pin's rounded
envelope notch. Three changes break that link.

1. **Brown's pin size.** The pin's inked ring is 15.7 px across on mm_213. The
   old 9.58 px fit included the ink blur. The pin radius is now 7.8 px (0.1916 →
   0.156). Pin, gap and tooth are now each about half a pitch, as Brown draws
   them.
2. **A Geneva trial law.** `scripts/generate-split-rim-213-contact.mjs` has been
   rewritten.
   - The old trial law was a quintic. In the new law, while the pin's bearing is
     within half a pitch of the line of centres, the wheel turns with the pin.
     The pin therefore runs straight in and out of a parallel-sided gap.
   - The wheel is a real polygon: the radial tops minus the gap slots. Gaps
     are 0.281 wide, teeth 0.245 at the tips.
   - Tooth tops are at 1.84, just below the pin's closest approach (1.897). The
     root is at 1.55: a free-clearance depth of 0.29, like Brown's teeth of
     about 16 px.
   - The pin drives on the top corners. Each corner has a 0.008 fillet, so it
     always bears on a smooth face.
   - The retaining forward and reverse branches are solved on this profile as
     before. Only the uncut rim, at the two terminal shoulders, is cut by the
     solved path. The shoulders are exact radial steps.
3. **Rendered gaps 0.0006 wider than the solved ones.** Sampled Hermite
   playback rounds each sudden pickup; the extra width stops the wheel from
   being led into the pin.

**Results.**
- Visual: the five teeth read as Brown's square teeth, with the pin just under
  the tips between the middle teeth. There is no visible corner relief: the
  pin's approach path clears the tops.
- Take-up is 0.00047 rad. Hysteresis is 0.026. The largest playback step is
  0.0155. The index is exactly one pitch per turn.
- Intersections: none before, none after.

**Test changes, with reasons.**
- The pin radius and the turns between stops (5.7999 → 5.8097) are re-pinned,
  as are the analytic margins that follow from them. Those margins are
  `sourceActiveProgress`, `sourceIndexProgress`, the rim margins and the
  closing rates.
- The driving-moment floor stays at 0.9, except while the wheel speed is below
  0.01. At the first and last touch the pin sits high on the corner, and the
  arm dips to 0.853.
- The normal-cone tolerance is now 1e-3. The fillet faces are about 2e-4 long,
  and their float32 normals carry about 5e-4 of rounding.
- The "useful normals" inputs are now 5.55–5.75, because the index now starts
  after 5.50.

**Proposed ledger.**
- (a) "Pass-51 m11 default and 8-phase captures inspected beside the plate:
  five square teeth with parallel gaps and a flat root; Brown's smaller pin
  (7.8 px) just under the tips."
- (b) sampled-clear: "m11 screen (0.01, 129): no pairs."
- (c) assessment: **reasonable**.
  - visibleFlaws: "".
  - limits: "Tooth tips sit at 1.84, recessed about 14 px inside the uncut rim,
    where Brown's are nearer it. The pin drives on 0.008-filleted top corners
    through a Geneva-style index. Frictional retention, impact at pickup and
    load capacity are prescribed."

## 215: crescent-pin six-slot stop (changed; rounded ears)

**New construction.**
- `scripts/generate-geneva-stop-215-contact.mjs` rolls a ball of radius 0.13
  (about 0.22 source units) into every horn where a lock arc meets its slot
  mouth. That is 10 horns; the terminal sector's own corners are left alone.
- The lock arc and the relieved mouth are kept up to the ball's tangent points.
- This runs before the entry roots are solved, so the baked handoff sees the
  rounded ears. The data file was regenerated.
- The m2 objection was that rounding "removes the load faces". It does not:
  - At pickup the crescent still covers the rest of the concave, so the lock
    holds until the pin bears on the mouth.
  - The contact tests (compressive pin face with torque above 2.3, and
    |gap| < 2.2e-5 for the pin or the crescent through every handoff) pass
    unchanged.
- A ball of 0.16 or more no longer fits the horn, which the pin-path cuts
  have already narrowed.

**Results.**
- Visual: the horns are now rounded knobs.
- Intersections: only the seated crescent/wheel contact, 0.0000, as before.
- Tests: 215 contact, movement-215 and geneva working-solids pass, 16/16.

**Proposed ledger.**
- (a) "m11 default and 8-phase captures: the concave locks end in rounded
  ears at the slot mouths."
- (b) sampled-clear: "m11 screen: only the seated crescent/wheel contact
  (0.0000)."
- (c) assessment: **reasonable**.
  - visibleFlaws: "".
  - limits: "The ears are slimmer than Brown's knobs because the lock arcs
    follow the source animation's deeper construction. Reverse motion needs
    assisting bias."
  - If the lead counts the slimmer ears as visible, keep the assessment minor
    with that note as the visibleFlaws.

## 218: hinged catch and notch wheel (changed; eight notches)

**New construction.**
- Plate 218 now draws Brown's eight notches.
- The roller turns 3/8 back and 3/4 forward, which keeps the caption's 1:2
  ratio. The net 3/8 advance is exactly three of eight notch pitches.
- The rocker parts are turned by the 15° difference, so the D pose (plate 218)
  is unchanged. At D, the rocker, catch and hook positions match 217's
  caption-law transmission to within 1e-12.
- Plate 217 draws no notch wheel, so it keeps the caption's 1/3 and 2/3 and
  its groove.
- The notch cutter profile, generated from 217, still clears the 3/8 hook arcs.
  The contact tests pass.
- Code change: `outputPlateFocus` parameters in `groovedCamWoolComberRollerMotion`.
  The roles for 218 now read "eight-notch".

**Tests.** 217, 218 and wool-comber-contact pass, 17/17. The 218 law test was
rewritten: it checks the 3/8 law, three-pitch closure and the D-pose match
with 217. The shared-scalar comparison with 217 was removed.

**Intersections:** none for 218 (and none for 217).

**Proposed ledger.**
- (a) "m11 default and 8-phase captures: eight shallow notches as Brown
  draws; G stacked on the lever with a flat end lug."
- (b) sampled-clear: "m11 screen: none."
- (c) assessment: **reasonable**.
  - visibleFlaws: "".
  - limits: "Plate 218's roller turns 3/8 back and 3/4 forward (the caption's
    1:2 ratio) instead of the caption's 1/3 and 2/3, so Brown's eight notches
    close on a three-pitch advance. 217 keeps the caption law. The oblique
    exit flank of each notch is the milled envelope of the hook's release
    arc. The cam projection touches the release boss at one instant. The
    catalog archetype still says nine-notch."
  - Keep minor if the lead counts the oblique exit flank as visible.

## 71: internal-guard tappet stud index (changed; slanted slits)

**New finding.** Brown's notches are narrow slanted slits cut along the
stud's path, not radial sectors. The stud crosses the rim obliquely in B's
frame. The old ~40° notch was the angular *range* of that crossing.

**New construction.**
- The rim pieces are now the annulus less the two channels the entering and
  leaving studs actually sweep during the push. Channel width is the stud
  radius plus 0.02; built with polygon-clipping.
- Where a stud only grazes the inner lock face, the clearance tapers to its
  actual overlap, so the lock face is never gouged.
- The inner lock circle is circumscribed, so its chords never reach inside the
  lock radius.
- The front plate is cut the same way.
- Motion is unchanged.

**Tests.** The rim check in `movement-071.test.mjs` now measures the stud
circles against the actual rim polygons; maximum penetration is 0. The control
is now "an uncut annulus is struck" instead of "narrowed sectors". 4/4 pass.

**Intersections:** none before, none after.

**Proposed ledger.**
- (a) "m11 default and 8-phase captures: the rim's notches are narrow
  slanted slits along the studs' paths, as Brown draws them."
- (b) sampled-clear: "m11 screen: no pairs."
- (c) assessment: minor.
  - visibleFlaws: "The two slits sit about 20–35° clockwise of Brown's, and the
    upper one runs more steeply through the rim."
  - limits: "The slits' place relative to the tappet is fixed by when each
    stud crosses the rim during the push; the tappet matches Brown's 163°."

## 206: shared-pivot double-stroke ratchet (changed; hooked points)

**New finding.** The model's teeth already had Brown's lean: the short steep
face on the clockwise side, and the long back on the counter-clockwise side,
which the fingers push clockwise. What read as "square-stepped" was the flat
land (0.24 pitch) between the face and the back.

**New construction.**
- The land is removed. Each tooth is now a sharp tip over a face undercut by
  0.04 pitch, with a straight back from the tip to the next root.
- With a longer back, 0.33 depth (root 2.11 → 2.05) keeps both drive forces
  within 62° of the back's normal. The existing test bound is −0.47.
- The right working point moves to 0.28 of the face. The right contact now
  meets the engraved angle within 0.03°.
- The rocker amplitude recalibrates to 6.70°.

**Tests.** The movement-206 exhaustive checks pass unchanged, 5/5:
- clockwise on both strokes;
- no pawl penetration;
- reset clearance;
- contact and torque.

Re-pinned: root radius, tooth phases, right face fraction and the amplitude
band (6.65–6.8°).

**Intersections:** none before, none after.

**Proposed ledger.**
- (a) "m11 default and 8-phase captures: the teeth are Brown's hooked
  points, a sharp tip over a slightly undercut face."
- (b) sampled-clear: "m11 screen: no pairs."
- (c) assessment: **reasonable**.
  - visibleFlaws: "".
  - limits: "The fingers push clockwise on the long tooth backs (Brown's hooks
    imply a counter-clockwise drive on the short faces, whose pull-in the
    continuous two-stroke construction cannot model). The teeth are 0.33 deep,
    about twice Brown's shallow teeth, to keep the back-drive forces within
    62° of the face normal. Contact is exact by construction. The catalog
    archetype still says forty-four teeth."
  - Keep minor if the lead counts the depth as visible.

## 63: snap-action star counter (not changed; forced, with the new options refuted)

The three new options all fail.

1. **Widen the pawl lobe.** All 1,536 grid samples of the strip were mapped
   back into the pawl's frame at the rest pose. Sampling covered the visible
   drop area outside the pawl, disk and star at phases 0.80, 0.85 and 0.90. At
   rest, every one lies over the pin disk, outside the traced lobe. The pawl
   is in front of the disk, so any lobe large enough to cover the strip would
   show as extra pawl over the disk at Brown's pose.
2. **Put the leg behind the disk.** The leg is already the rearmost layer.
   - At phases 0.8–0.9 the lobe and the disk no longer overlap. A gap of
     roughly 20–50 source px opens between them, so there is no hidden
     corridor from the drop to the leg's working tip.
   - Routing the leg behind the star fails: the star shaft passes through the
     drop's layer, and the star's point gaps would show the leg.
3. **Shorten the time the gap shows.** The pawl reaches its new space at 0.89
   of the event, and the drop must stay up until then. The drop already falls
   at about 0.92, so an earlier release gains at most about 2 % of the event.

**Intersections:** none.

**Proposed ledger.** Unchanged, minor.
- visibleFlaws: "While the drop is held up with the pawl fallen (about
  0.75–0.92 of each event), a thin strip of the leg shows in the gap between
  the pawl's lobe and the disk."
- limits: "Covering the strip would need extra pawl over the disk at Brown's
  pose, because the pawl lies in front of the disk. The pawl must be seated
  before the drop falls. Start pose is 7° of pin rotation from Brown's."

## 211: pin-guided half-toothed wheel and locking pinion (not changed; forced)

**Measurements (mm_211).**
- Pinion: tooth tips about 75 px, about 18 positions (about 20° each). About
  3.5 positions are missing where the wheel's rim runs.
- Wheel: toothed arc from about 90° to 170°, 9–12 teeth. The pitch-radius
  ratio is about 2.3–2.5.

**Why the arc cannot be shorter.** The single concave lock must face the rim
again after each index, so every index is one full pinion turn: 144° of wheel
at 2.5.
- The arc's teeth drive the pinion only at the pitch ratio. The pin on the
  guide also drives at the pitch ratio, since it sits on the wheel's pitch
  circle and the guide is its epicycloid.
- So an arc of about 80° can drive only about 200° of the pinion. The rest
  must be missing positions or prescribed relocking:
  - finer teeth do not help (the arc length in pinion turns is fixed by the
    ratio);
  - 7 of 18 positions would have to be missing, where Brown shows about 3.5;
  - a higher ratio (about 4.5) would contradict the drawn sizes.
- A Geneva-style pin in the guide was also rejected. The pin sits at about
  0.62 of the centre distance, so it would turn the pinion only about 77°
  while the wheel turns about 103°. It gains nothing.
- A half-turn index would need a second lock zone, and Brown draws teeth
  there.

**Proposed ledger.** Unchanged, minor. visibleFlaws: "The toothed arc spans
about 99° where Brown's spans about 80°."

## Files

- `src/simulation/authored-intermittent-core.js` (my IDs only):
  - one import line (polygon-clipping helpers from `finite-plate-geometry.js`);
  - `internalGuardTappetStudIndex` (71);
  - `sharedPivotDoubleStrokeRatchet` (206);
  - `splitRimFacePinWindingStop` (213: pin radius).
- 213:
  - `scripts/generate-split-rim-213-contact.mjs` (rewritten);
  - `src/simulation/baked/split-rim-213-contact.js` (regenerated);
  - `src/simulation/split-rim-213-contact.js` (reconstruction note).
- 215:
  - `scripts/generate-geneva-stop-215-contact.mjs`;
  - `src/simulation/geneva-stop-215-contact-data.js` (regenerated).
- 218: `src/simulation/authored-wool-comber.js` (plate-218 parameters only).
- Tests:
  - `tests/movement-071.test.mjs`
  - `tests/movement-206.test.mjs`
  - `tests/movement-213.test.mjs`
  - `tests/split-rim-213-contact.test.mjs`
  - `tests/movement-218.test.mjs`

The `--check` mode of the 213 generator reproduces the bake byte for byte. No
`docs/validation` report fingerprints these files.
