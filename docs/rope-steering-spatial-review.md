# 490 spatial steering reconstruction

The [official plan and caption](https://507movements.com/mm_490.html) show the
handwheel/barrel shaft across the page, perpendicular to the two guide axes.
The old model put all three axes normal to the page. The new barrel axis is X;
the guides and rudder remain Z. Guide positions, tiller length and wheel scale
follow the engraving's main centers rather than its irregular line work. No
official animation is available.

## Corrections

The handwheel is now edge-on in the default plan view. The drum, wheel hub and
bearings have real shaft bores. Guide sheaves have finite grooves and bored hubs,
with separate fixed axles and supports. One continuous rope joins the tiller's
two clamps through the guides and five barrel turns. Reconstructed changes in
axial pitch join the helix tangentially to the free spans. Barrel and sheave
surfaces allow for the rope's actual thickness.

The old tiller-end calculation rotated opposite to the rendered lever. Its sign
now matches the actual transform; both rope ends follow their separate clamps.
The differential branch-length constraint still determines the tiller angle.
Equal smooth bows in the free spans accommodate the changing sum of taut branch
lengths. They keep the rope length nearly constant without changing the
wind-one/pay-out-the-other differential. The remaining relative arc-length
variation across 65 poses is about 0.00060%, from interpolation and quadrature;
the previous taut path varied by about 1.17%.

The eight-second cycle remains readable, ground and fog stay disabled, and the
persistent tube buffers introduced in the [performance pass](rope-steering-playback-review.md)
remain in use. The spatial curve uses 420 tube segments. After 100 warm-up
updates, 1,000 local timed updates including world matrices measured median
1.217 ms and P95 1.583 ms. These are CPU measurements, not browser guarantees.
The cheap screen reports no nonfinite data, scene growth or replacement geometry.

## Verification

```sh
node --test tests/movement-490.test.mjs tests/rope-steering-performance.test.mjs tests/steering-spatial-solids.test.mjs
```

All 13 tests pass. They check the differential constraint and derivatives,
rendered clamp/end coincidence, fixed length, frame bounds and stable GPU arrays.
Reference Three.js tube surfaces agree throughout 65 sampled poses. An independent
33-pose surface sweep checks the rendered rope against the drum, flanges, guides,
axles, supports, wheel, tiller and tip boss. Separate fastening clamps intentionally
contain the terminal rope ends. Every pair of nonneighbor tube cells has disjoint
bounding boxes at those poses, excluding sampled self-contact between distinct
reaches or barrel turns. This is a bounded sampled check, not continuous collision
or force validation.

Default/source and advanced oblique browser views were inspected; a 17-pose
visible-vertex sweep found no clipping (maximum NDC extent 0.853) and no browser
errors. Bulk evidence remains in `/dev/shm/rope17-*`.

## Remaining physical assumptions

The bow shapes, groove clearances, helix pitch transitions, depths and supports
are reconstructed. Tension, friction, gravity sag and axial creep on the drum
are not solved. Ideal imposed pitch-speed relations do not prove frictional
no-slip transport on the spatial helix. Rope markers illustrate payout and wrap
at their display interval; they are not tracked material knots through the end
fastenings. Brown's corroborating historical middle fastening is not imposed.
This is a corrected analytical layout and motion demonstration, not a passive
loaded steering simulation.


The subsequent timing follow-up also sets `minimumDisplayCycleSeconds=8`.
The production registry replaces a factory's target timing; the explicit minimum
and `tests/reviewed-cycle-timing.test.mjs` now enforce the reviewed eight-second
cycle through that path.
