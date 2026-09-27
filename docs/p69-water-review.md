# Pass 69 — water lane (430, 433–436) and the shared water-stream helper

Reviewer: Claude Opus 5.5 — pass-69 water lane. Captures in `/dev/shm/p69-water`
(`before/`, `after/`, `review-after/`; not in Git).

## Shared helper: `src/simulation/water-stream.js`

One cheap, continuous look for moving water, replacing streamline tubes,
droplet beads and jointed jet segments. The API is documented in the file
header; in short:

- **Paths** (built once): `ballisticPath` (projectile law from a mouth or lip,
  ending at a height, a duration or a stop predicate), `guidedPath` (along a
  channel/guide curve at a set speed), `joinPaths` (e.g. flume floor then its
  fall, one path), `solveBallisticSpeed` (launch speed through a target).
  Every sample carries speed and time of flight.
- **`WaterStream(path, options)`**: one swept mesh (elliptic section: a round
  jet or a sheet) with no joints or gaps. The section follows continuity —
  area ∝ flow·v0/v, split between width and thickness by `widthExponent` —
  plus optional `spread` (break-up), `fadeIn/fadeOut` and `foam` whitening
  at the strike. `setFlow(q)`/`setPath(p)` rewrite the same buffers; per frame,
  `update(time)` only scrolls the texture offsets.
- **Look**: `waterStreamMaterial` — the palette fluid tint, translucent,
  `depthWrite` off, no fog (as `water-volume.js`), a fresnel term that
  densifies and pales grazing views, and a procedural streak map plus
  matching normal detail generated once from typed arrays (no canvas, so it
  also runs offline). The texture's v coordinate is time of flight, so
  streaks move at the local water speed and stretch as a jet accelerates;
  the scroll rate is rounded to whole tiles per playback cycle so the loop is
  seamless.
- **`WaterSpray`**: a capped (≤ 64) instanced droplet burst, deterministic and
  periodic over the cycle, for foam where a stream strikes.
- Streams and sprays never cast or take shadows (accessors override any later
  `markShadows` pass: a translucent sheet's shadow read as a dark stain).
- `collectWaterStreams(root)` returns one `update(time)` for all of them.

Finding while building it: a sheet wound against its own normals is flipped
by three.js's double-sided lighting and renders dark from above; the helper
winds outward (test `water-stream.test.mjs` pins it). The older
`waterJetGeometry` in `water-volume.js` (not this lane's file) uses the same
inverted winding and may be darkening other movements' jets.

### Performance note

Geometry is written at build time only (and on `setFlow`); playback touches
two texture offsets per stream and ≤ 64 instance matrices per spray. Node
timings of `model.update` (5000 frames): 430 117 µs (was 41 µs; the cost is
the new bent-pocket water clipping, not the streams), 433 10 µs (7), 434
19 µs (11), 435 15 µs (13), 436 16 µs (12). Browser review route, before →
after: draw calls 102→73, 60→64, 85→106, 118→134, 506→142; triangles
35.5k→34.4k, 29.2k→28.0k, 45.7k→64.7k, 63.8k→81.8k, 59.2k→112.5k (436's
helical vanes). One shared shader program and one texture upload serve
every stream. No physics runs in the browser.

## 430 Overshot water-wheel

- **Buckets**: each partition is now Brown's bent, slanted board — a short
  start rising from the sole at a slant (knee at r 2.33, 3.4° ahead) and a
  long lip bent back toward the following bucket (tip at r 2.62, 17° ahead),
  measured on the dotted plate outlines. The hidden flat divider and hooked
  lip are gone.
- **Pocket water** is clipped from the actual pocket between two bent boards
  and never rises above the lower lip tip (the pocket's spill point), so the
  buckets spill naturally from just below the horizontal and are empty by
  about 48° below it; the fill law's drain moved to match (72°–115° of
  travel, was 137°–164°).
- **Headrace** shortened to end just right of the crown, as the plate draws
  it; its water is one continuous stream along the flume and off its end on
  the projectile path whose channel speed (1.95 u/s) lands it in the bucket
  mouths at the filling position, with foam and a small splash.
- **Spill**: the water the buckets shed leaves the wheel's edge at the lower
  right with the rim's downward speed and falls as one sheet to the tail
  floor, spreading and whitening, with a capped splash — Brown's falling
  water beside the wheel.
- Captures: `after/430-*`, `review-after/430-default.png`.
- Intersections: before and after only fluid (water) contacts; no solid pairs.

## 433 Horizontal overshot water-wheel

- The spout water and jet are one continuous stream: down the spout floor,
  out of the mouth along the spout axis at the speed its own fall gives it
  (v = √(2gh), 6.4 u/s), and on a true projectile path to the floats, with
  foam and a capped splash where it strikes. The old separate box of spout
  water is hidden, the jet no longer arcs upward (the old Bézier did).
- The broken water leaves the floats as three thin falling sheets shed
  downstream of the strike, with Brown's falling drops beside them.
- Residual: with the reconstructed rotation the shed water falls under the
  left and front of the runner; Brown's spray is under the right and front.
- Captures: `after/433-*`, `review-after/433-default.png`.

## 434 Fourneyron turbine (plan)

- Counts and radii from the plate by polar sampling of the lines: **8**
  fixed guides A (plate 72–136 px) inside the heavy ring (142 px), **18**
  buckets on the outer wheel B (to 205 px). Was 6/16 with the guides to 0.56
  of the wheel radius; now 0.69 as drawn.
- Curvature from traced vane lines: guides sweep ~40° clockwise going out;
  buckets sweep the **opposite** way (~17°, mostly near the rim). Before,
  both swept the same way.
- The shaft now rises through the guides' open centre (Brown's small
  circle); the central water cylinder is hidden.
- Water: one continuous sheet per guide passage from the centre, out between
  the guides, through the buckets and off the rim as a short falling sheet.
- Velocity-triangle torque diagnostic updated for the new radii.

## 435 Warren central-discharge turbine (plan)

- Vane curvature reversed to match the traced plate lines: the fixed outer
  guides a are nearly radial at the rim and bend hard to run tangentially
  into the wheel (exponential bend, 17.5° total); the runner b buckets are
  steepest at the eye and straighten outward (10°). Direction unchanged.
- Radii from the plate: guides 2.53–3.45 (bold ring 155 px of 213), runner
  1.86–2.43 (eye 115 px), hub 0.55 (34 px) with the shaft end showing in it;
  the four arms now reach the runner ring.
- Water: one continuous sheet per representative passage, in through the
  guides, through the runner and falling through the open centre.

## 436 Jonval turbine (section)

- **Helical vanes**: shutes a and buckets c are now helicoidal screw surfaces
  (every radial line turns by the same angle with depth, along a parabola):
  the shutes run straight down and bend toward +θ at their foot, the buckets
  take the water axially and bend it back, as Brown's section draws them.
  Buckets keep their slight tangent. Counts from the near-half line spacing:
  16 shutes and 28 buckets (were 12 flat pitched plates and 18 segmented
  vertical slats).
- These curves whirl the water counter-clockwise seen from above, so the
  runner now turns counter-clockwise (the old clockwise choice contradicted
  the drawn vane curves; Brown gives no direction).
- **Chute mouth open**: the trunk wall is cut away across the chute mouth
  (floor to roof, full chute width), so the channel is no longer blocked.
- Water: one continuous sheet down the chute's back half into the trunk,
  which stands full over the shutes (a cut water body).

## Residuals

- All water remains illustrative prescribed motion, not solved flow.
- 433: shed water falls to the left/front, Brown's to the right/front.
- 434/435: the translucent passage sheets slightly soften the vane edges in
  plan; flow is drawn at mid-height in the passages.
- 436: casing corner rings and vane-row boundary rings remain (earlier
  design); water below the runner is not drawn (Brown draws none).

## Checks

- Intersections (`show-body-intersections --spacing=0.01 --samples=129`),
  before (HEAD copy) and after, all five IDs: no solid pairs; only water
  (fluid) contacts.
- Faces (`scan-bad-faces`): 430 mixed/zfight findings cleared (pocket water
  wound consistently, boards stand on the sole ring rather than overlapping
  it); remaining counts are same-look coplanar faces and the parked
  (undrawn) vertices of the pocket-water buffers.
- Loop seams (`check-loop-seams --ids=430,433-436`): no seams, no pops.
- Tests: movement-430/433/434/435/436, turbine-433-435-solids,
  water-wheel-430-432-solids, fluid-rotor-436-438-solids (its 437 case fails
  on another lane's volute change), reviewed-cycle-timing, and the new
  water-stream test.
