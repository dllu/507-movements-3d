# Pass 82 lane p82-fig: continuous figure limbs (376, 377) and bounded fixes (391, 393, 438, 474, 491, 492, 500)

Captures: /dev/shm/p82-fig/{before,before-rot,final,final-rot} (default beside the plate; ±60° about vertical, top, back),
figure close-ups /dev/shm/p82-fig/{m377,kk,h376,hz,z393,z391}.png. Blender was used (bridge on 127.0.0.1:9876) for the
new leg meshes.

## Figure pipeline
- `scripts/blender/figures.py`: the walker's thigh and the horse's forearm, gaskin, cannon and hoof parts are replaced by
  one continuous limb each: `man-leg` (hip through a modelled knee with kneecap and calf to the ankle), `horse-foreleg`
  (forearm muscle, flat knee, cannon, fetlock with ergot, sloping pastern) and `horse-hindleg` (gaskin, hock with its
  point and tendon, cannon, fetlock, pastern). Each horse leg carries its hoof, joined by an exact boolean union, as a
  second material group (`export_grouped`, `groupStarts`). All parts closed, 0 non-manifold edges.
- The hand, cuff, forearm, horse body and tail, jacket, head, cap, arms and shoe regenerate byte-identical (checked by
  comparing every packed entry against the previous `baked/figure-meshes.js`).
- `src/simulation/figure-meshes.js`: material groups from `groupStarts`, and `bendingLimbGeometry()`, which bends a limb
  modelled straight down -y at its knee pivot: above the knee unchanged, below it a rigid turn about the pivot (exactly the
  old knee-group transform), and between a circular fillet tangent to both parts, so the surface stays continuous at any
  bend. The fillet radius exceeds the limb's inner half-width (377: 0.11 vs 0.08; 376: 0.20), so it never folds through.

## 377 walker
- One trouser leg per side hangs from the hip pivot and bends each frame with the gait's knee angle (0.70–2.30 rad); the
  separate shin capsule and the lay-figure knee gap are gone. The cuff runs down into the shoe's top, so the shoe is
  attached. The seat now lies on the hip axis (radius 0.105) and its ends run into the leg tops.
- Gait, pivots, limb lengths, sole/board contact and ankle easing are unchanged.
- Intersections (0.01, 129): only designed joint overlaps between deforming legs and their neighbours: seat/leg at the hip
  0.073 and leg/shoe at the cuff 0.026. Before: none (the legs were apart). Faces: legs clean.
- Residual: the gait still reads somewhat seated from behind; shoes are thin sole-box slippers.

## 376 horse
- Each leg is one continuous tapered limb from the shoulder or stifle to the hoof, bent at the knee/hock pivot. The old
  cannon and hoof meshes are removed; each hoof keeps an empty marker in the knee frame with its sole box, which drives
  the unchanged hoof-on-tread lowering.
- Intersections: leg tops embedded in the shoulder and stifle masses (0.053, 0.051) and the tail root (0.050), by design as
  before. Faces: legs clean.
- Residual: the horse remains stylized (mane ridge, not Brown's hair); the leg tops show as rounded masses where a raised
  foreleg leaves the shoulder.

## 391
- Brown's small circle under the tip of C's short arm is now a knob carried on C (a boss in C's plate and a stud on its
  face), so nothing floats when C swings. C's rest angle is prescribed; Brown draws no fixed stop. The note is updated.
- Intersections: unchanged pre-existing spring end-leg overlaps (0.017, 0.016); knob clear.

## 393
- The upright spindle stops on a squared clamp block. The carrier's upper end passes straight through a mortise in the
  block, is held by a set-screw on the front face, and its tail stands out the far side, as drawn. The carrier no longer
  enters the round spindle. The bends are rounded to the strip's thickness. Intersections: none.

## 438
- The flume runs on straight along its own slope to 14 units long, so its upper end leaves every rotated view. No trestle
  was added. Intersections: only the known fluid pairs. Framing is unchanged (fixed fit bounds).

## 474
- The globe, arms, trunnions, collars and risers are opaque. Brown dots nothing, so the see-through style is not used.
  Intersections: fluid pairs only.

## 491, 492
- The capstan's cable lead is now 12 units long; 492's release rope is 16 and its tackle falls are 14. The ends leave every
  rotated view. The framing bounds are fixed, so the default views are unchanged. Intersections at 0.02: none. (The 0.01
  screen runs out of memory on the long ropes.)

## 500
- The face view now has Brown's stem below the case: a bored sleeve 0.80 across over the inlet pipe, from the case to
  y = -4.90, and a hex union nut 1.19 across and 0.37 deep. The inlet pipe runs to the nut's face. Sizes are measured on
  the plate. The fit bounds were extended to y = -5.35. Intersections (0.02): only the pre-existing ball-joint and
  diaphragm pairs.

## Tests
Rewritten for the new designs: `tests/treadmill-gait-solids.test.mjs` (the legs are checked vertex by vertex against the
boards, jacket and rail, and the cuff must reach the shoe), `tests/weighted-rack-selector-contact.test.mjs` (the knob is
fixed in C), and `tests/elastic-gauge-working-solids.test.mjs` (500's collar is the stem).
