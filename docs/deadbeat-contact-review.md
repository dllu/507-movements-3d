# 289: finite deadbeat handoff

This follow-up resolves the working tooth/pallet interference left explicit in
[the first anchor review](anchor-escapement-family-review.md). It changes 289's
working geometry and prescribed contact law together. Movement 288's geometry
and motion are unchanged; the separate 303 builder is unchanged.

## Source and reconstruction

The [official 289 page](https://507movements.com/mm_289.html) and engraving specify
concentric inner/outer locking faces, alternate impulse faces, and no wheel
recoil during repose. The original page has no available canvas animation.
The source's forward-raked teeth and lock/impulse corners were the mechanical
reference; the old model's timings were not treated as authoritative.

The former broad, oppositely raked teeth and quadratic impulse schedule did not
admit the complete working faces. Cutting clearance around that motion removed
substantial parts of the intended faces. The replacement uses:

- A 3° anchor swing, with the original arbor locations and 14.5-tooth pallet span.
- Thirty narrow, forward-raked teeth: each tip leads its root center by 7.8°;
  the root spans 3.6°. Tooth tip/root radii remain 2.416/2.05 model units.
- Exactly concentric locking arcs and a distinct impulse corner. Wheel advance
  is linear in anchor angle through each impulse, totaling 2° per half-beat;
  the following forward drop advances another 4°.
- Correct opposite pallet backing directions. An offline sweep relieves only
  interference behind the working surfaces, retaining over 97% of each blank's
  area. Continuous analytical face curves are included in the cutter before
  its 0.0005 clearance offset; this avoids scalloped load faces from discrete
  tip samples.
- Unbeveled working tooth tips. The structural arch stays in its previous front
  layer, physically overlapping both working pallet bodies; the pallets still
  occupy the wheel's working depth.

Dimensions and timing are inferred, not dimensions supplied by Brown. The
swing remains sinusoidal, with a four-second authored/display-minimum cycle.
The wheel advances one complete tooth per oscillation and rests exactly during
both locking intervals.

## Finite and contact evidence

Run:

```sh
node --test tests/deadbeat-working-contact.test.mjs \
  tests/anchor-escapement-working-solids.test.mjs \
  tests/movement-288.test.mjs tests/movement-289.test.mjs \
  tests/movement-303.test.mjs
```

All 33 checks pass, including the existing 288 and 303 regressions.

- The new wheel/pallet audit samples rendered vertices, edge midpoints and face
  centroids at 257 full-cycle poses plus both sides of every landing, impulse
  corner and release: 1,438,800 surface queries, minimum clearance 0.00049584.
- The existing family audit now includes both 289 working pallets as well as
  its arch and journals: 815,392 queries, without penetration.
- At 1,782 active poses, the closest actual finite working boundary lies within
  0.00054807 of the ideal active tip. The outward contact normal's dot product
  with forward wheel motion is at most −0.51131: it opposes driving torque on
  both locks and both impulse faces.
- On impulse-face interiors, the opposite unit reaction has positive power
  against the prescribed anchor velocity (minimum 0.23122 in model units).
  This checks the mechanically correct force direction, not a solved force
  magnitude or measured energy transfer.
- A 20,000-step continuity check finds no reverse wheel motion or position
  jumps; the largest wheel step is 0.00006868 radians. Event-neighborhood
  checks also retain continuous anchor and wheel positions.
- Both finite pallet bodies overlap the structural arch by at least 0.02 in
  the sampled attachment check. Scene geometry/buffer identities stay stable.

## Playback and limits

Final source/default/front/advanced browser views show no errors or camera
clipping through the full cycle (maximum NDC extent 0.869). The scene renders
40 draw calls and 14,240 triangles including shadows. One local cold factory
measurement took 60 ms; mean update cost over 10,000 steps was 0.00145 ms.
The baked profile module is only 6,098 bytes; no sweep generation runs in the
browser. Existing fog-free materials, hidden ground, and source-facing framing
are retained.

This is a finite-clearance, prescribed-motion reconstruction, not a passive
clock simulation. The 0.0005 construction clearance means close working-surface
proximity rather than a solved zero-gap force contact. The impulse corner and
landing impose idealized wheel velocity changes; friction, impact compliance,
train torque, pendulum energy balance and sustained running have not been
validated. MuJoCo was not needed to establish these analytical constraints,
and no native dynamics result is claimed.

## Reproduction

Requires Node with the project's dependencies and Python with Shapely 2.0.3:

```sh
node scripts/export-deadbeat-contact.mjs /dev/shm/deadbeat-contact-input.json
python scripts/generate-deadbeat-contact.py /dev/shm/deadbeat-contact-input.json
```

The exporter records the actual authored wheel outline, continuous face curves
and 4,097 wheel/anchor poses. The generator fails if any intended working-face
point ends more than 0.001 from the resulting solid; final maxima are
0.00052368 (left) and 0.00058025 (right), including endpoints. Two complete bakes
produce the same generated module SHA-256:

`763c17c863c8644cbae68cc4ff98b13db58197d398906a0e05ebf16a10cfefbe`

Bulk review captures are kept outside Git at
`/dev/shm/deadbeat-contact-final-289-{default,front,advanced}.png`.
