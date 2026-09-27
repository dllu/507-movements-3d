# Pass 70, lane p70-b: 370, 389, 399, 402, 412, 415

Reviewer: Claude Opus 5.5, lane p70-b, 2026-09-26. Each change answers the visible flaw recorded in
`docs/movement-status.json` and was checked against `public/engravings/mm_NNN.png`. Captures are outside Git in
`/dev/shm/p70-b/`:

- `before/` and `after/` hold `ID-{default,oblique}.png` from `review-movement-source-views`;
- `s/` holds phase and rotated views (`s399`, `s370`, `s402`, `s412`, `s415`, `s415r`, zoomed `z415`).

Intersections: `show-body-intersections --spacing=0.01 --samples=129`, one ID at a time. Loop seams:
`check-loop-seams --ids=370,389,399,402,412,415` reports 0 seams, 0 pops, 0 errors. Faces: `scan-bad-faces`.

## 412 capstan wheel-work (`authored-capstan-wheelwork.js`, `capstan-entwistle-corrections.js`)

**Flaw:** the pawl eye pins stood as short stubs because the drumhead is omitted.

- The drumhead that carries the pawls stands above the wheel-work. It would cover the whole plan, and Brown omits
  it. So the pins now end on the parts that pivot on them: each pin is exactly the pawl's thickness and sits flush in
  its eye (`{upper,lower}-pawl-eye-pin-flush-in-eye`). No stub stands proud (`after/412-oblique.png`, `s412-tile.png`).
- The reconstruction note now states that the drumhead carrying the pawls is omitted.
- `docs/validation/412-495-gear-solids.json` was regenerated (0 penetrations).
- **Intersections:** before, seated tooth contact only; after, the same (three idler/annulus pairs at 0.0000).

## 415 Dickson's reversible drive (`authored-dickson-reversible-drives.js`, `one-way-clutch-working-parts.js` `correctDicksonParts`)

**Flaw:** Brown's pawls lie flatter than the model's, and the wheel was the older thick dark disc.

- **Pawl attitude.** Measured on the plate, the engaged C runs from its pin at 15.6 degrees and meets the rim about
  15 degrees above the horizontal. The lifted B stands at about 47 degrees. The contact phase is now 0.28 rad
  (was 0.55), so seated C lies at 16.9 degrees (was 36.9). Its line passes 0.026 from the centre; Brown's passes
  about 0.02. The full lift is 0.52 rad (was 0.48), which puts the lifted B at about 46 degrees.
- **Wheel.** Brown's rim is slim: outer to inner radius is about 169/159 px. The outer radius is now 1.95
  (was 2.12), and the rim depth is 0.48 (was 0.78). The web and hub are moved up behind lever A. The wheel is now a
  light grey (0xe0e1da), opaque plain disc (it was dark translucent blue). It keeps the shared quadrant cue.
- **Knock-on fixes.**
  - Lever A's white tail pin used to stand 0.15 behind the lever and would have cut the moved web. It now starts
    just inside the lever's back face.
  - The web and lever bores were widened inside their hubs. This removes three coplanar faces (two of them already
    there before this pass).
  - `scan-bad-faces`: before, zfight 3; after, only the same-look pawl/eye pairs.
- **Tests.** `tests/movement-415.test.mjs` now expects nearly radial pawls. The lifted pawl's rim gap threshold is
  0.05 (was 0.09); the actual gap is 0.054. The mid-shift gap threshold is 0.012 (actual 0.016).
- **Intersections:** before, the p69 set (cord ties 0.037/0.020, cord grazes 0.008, coaxial bearings); after, the
  same set plus the seated pawl/rim working contacts at 0.0000.

## 402 Guernsey's escapement (`authored-guernsey-escapements.js`)

**Flaw:** the bar from the pivot toward the wheel hub was not modelled.

- **Reading of the plate.** The bar runs from the anchor's pivot boss down to a round boss concentric with the escape
  wheel. It lies in front of the wheel: the wheel teeth it covers are dotted. It is read as the fixed bridge (cock)
  that carries both fixed arbors.
- **Model.** `fixed-bridge-carrying-lever-and-escape-wheel-arbors` is one plate at z 0.67–0.77, in front of every
  moving part (lever hub top 0.64). It is a 0.20-wide bar with a 0.22 boss at the pivot and a 0.42 boss at the
  wheel (Brown's is about 27 px, 0.45). It uses the shared see-through style. The two fixed arbors now run up to its
  front face and end flush in its bores. See `after/402-default.png` and `s402-tile.png`.
- **Test.** `guernsey-working-solids` expects every mesh to cast shadows; that check now exempts see-through parts,
  which by the shared style cast none.
- **Intersections:** before, clear; after, clear.

## 399 chain repair link (`authored-chain-repair-links.js`)

**Flaw:** at the loose starting pose the nuts sat at different heights; Brown draws them level.

- The nut centres sit at ±(S/2 − 1.005), so they are level when the half separation S is 2.01. The loose separation
  is now 2.41, so the tight pose after two turns is exactly 2.01.
- Playback now starts at Brown's pose, made up tight with the nuts level. It loosens two turns (loose at mid-cycle)
  and tightens back. The law is `turns = 2 * 0.5 * (1 + cos(2 pi t / 8))`, with `geometry.sourceTime = 4` giving
  the offset on the old loose-start clock.
- The loop is seamless (`check-loop-seams`). See `after/399-default.png` and `s399-tile.png`.
- **Tests.** `tests/movement-399.test.mjs` reads the loose-start clock through `sourceTime`. The finite-difference
  tolerance is now 2.5e-10, the round-off bound for a ~2.2 separation over 4e-6.
- **Intersections:** before, none; after, none. Faces are clean.

## 370 mirror polisher (`authored-mirror-polishers.js`)

**Flaw:** the mirror sits a little higher on the bar than Brown's.

- **Measurement at the bar's scale** (width 0.58, crank radius 84 px = 0.72 in both):
  - Brown's mirror centre is 330 px (2.74) below the top eye, and the model's is 2.85. The mirror is correct
    against the eye.
  - The model's bar ran 5.38 below the eye, about 1.2 × Brown's.
  - The lower rail sits 3.90 below the upper rail, against Brown's 2.88.
- **Change.** The bar now ends where Brown's does, just past the lower rail's bottom edge near the top of the stroke:
  4.82 long, so 1.05 × the eye-to-rail distance. It still covers both guide pins at the top of the stroke. The mirror
  now sits 0.59 of the way down the bar (was 0.53; Brown 0.73). See `after/370-default.png` and `s370-tile.png`.
- **Why the rest is forced.** The mirror's axle crosses the lower rail's depth, because the bar is in front of the
  rail and the ratchet and mirror are behind it, as drawn. At the bottom of the stroke the axle clears the rail top by
  only 0.017. So neither the mirror nor the rail can move toward Brown's relative position without the axle passing
  through the rail. Brown's own proportions carry it through the rail.
- **Intersections:** before, rod × lower ball 0.061, rod × strap 0.012, stem × ball 0.011 (follower-internal);
  after, the same three.

## 389 eccentric lifting jack (`authored-eccentric-jacks.js`)

**Flaw:** the upper stop sits one tooth higher than drawn, and the throw was 20 px against Brown's 14.

- **Plate re-measured by pixel rows.** The tooth flats fall at y 71.5 … 203, so the pitch is 16.4 px. The teeth are
  12 px deep (root x 242.5, tip 254.5), which confirms the model's 0.21. Brown's stop nose is 48.5 px, three
  pitches, above the lifting nose.
- **Throw.** The rocking eccentric works as a slider crank on the lifting nose, so the nose travel is little more
  than twice the throw. The travel must cover:
  - one pitch;
  - the stop's ride-out (1.1 × depth, about 0.24);
  - the lifting nose's ride-down.

  A parameter sweep that required full seating of both pawls and clear finite solids over 257 poses gave these
  results:
  - The ride-down margin can drop from 0.23 to 0.20. At 0.16 and below, the lifting nose fails to re-seat for most
    throws.
  - The least clear throw is 0.315. The adopted throw is 0.32 (18.7 px, was 19.8 px).
  - The shaft moves 3.5 px right of Brown's (was 2.6 px) to keep the strap 0.02 clear of the tooth tips.
  - Brown's 14 px (0.24) needs teeth about 7 px deep, which is not his 12.
- **Stop on the drawn tooth: forced.** With the stop on Brown's tooth, the lifting horn (Brown's outline, 26 px below
  the stop's eye at rest) rises and turns into the eye by about 0.05 once the rack has risen one pitch. This holds
  for every throw from 0.24 to 0.34, every tooth depth from 6 to 12 px, and pitch 15.5 or 16.4 px. Keeping the drawn
  tooth would need the pawls in different depth planes, which the rules forbid, or a redrawn horn or eye.
- **Tests.** `jack-389-contact` and `movement-389` pass unchanged: the strap clears the teeth by more than 0.02, and
  the seat, overtravel, click and speed bounds hold.
- **Intersections:** before, none; after, none.

## Residuals

- 389: the stop is one pitch higher than drawn; the throw is 18.7 px against 14; the shaft is 3.5 px right. Each is
  forced as described above.
- 370: relative to the rails, the mirror still sits higher than Brown's (0.59 of the way down the bar against 0.73),
  forced by the axle's clearance over the rail.
- 412: the drumhead stays omitted, and the pins end flush in the pawl eyes.
- 415: the wheel face carries the shared quadrant cue in light grey.
- 402: the bridge is a reading of Brown's bar. Its bosses are circles and its width is 0.20.

Framing or geometry changed for 370 (the bar is shorter), 399 (source pose), 402 (bridge) and 415 (the wheel is
smaller, which changes the camera fit). The integrator should regenerate their display profiles.
