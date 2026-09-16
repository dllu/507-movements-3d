# 429: source-preserving mating relief

Follow-up to the [rotary engine review](rotary-engine-427-429-review.md).
The [official animation](https://507movements.com/mm_429.html) supplies distinct
polygonal pistons, fixed shaft centers and equal opposite rotation. Its outlines
are a useful motion reference, but the previous finite-solid pass measured
0.0134534 units of piston penetration. That interference is now removed from
the displayed geometry.

## Construction

The left rotor stays unchanged. The right source polygon is cut offline by the
left rotor's relative sweep at 4,096 evenly spaced input angles. With center
distance D and left angle theta, the cutter in right-rotor coordinates is
`R(2 theta) * left - D * (cos(theta), sin(theta))`. A 0.0005 cutter allowance
provides running clearance; 0.00001 simplification limits tessellation cost.
Shaft holes and axial depth remain unchanged.

The corrected right outline retains **99.7526%** of its source area, adds no
material, and has maximum boundary displacement **0.014434** model units.
For scale, shaft spacing is 2.88; the engraving's approximate shaft-center
spacing is 171 pixels. The boundary shift is therefore about 0.86 source-image
pixels at that scale. The reference source polygons remain available separately
in metadata; the right visible rotor no longer claims to be the exact source
polygon.

The baked outline has 5,455 vertices. Generation is offline and reproduces
byte-for-byte; the browser only extrudes it. No live MuJoCo/contact solver is
needed for the prescribed equal-opposite rotation.

## Evidence and limits

[Saved contact evidence](validation/429-mating-contact.json) checks **1,025
interleaved poses** using the actual rendered triangle projections. The pistons
are parallel extrusions at the same depth, so planar overlap directly tests
finite interference. The unchanged source pair penetrated at 338 of these poses,
with maximum overlap area 0.0009429. The corrected pair has **zero sampled
overlap**. Separate finite-solid tests cover the casing, packing indicators and
working joints and no longer exempt the rotor pair from penetration checks.

The minimum/maximum sampled mating gaps are **0.000253 / 0.013372**; the original
pair's maximum gap was 0.002804. Removing interference therefore increases
clearance at some phases. **This is a nonpenetrating explanatory reconstruction,
not a validated steam-tight or continuously loaded conjugate rotor pair.**
Pressure sealing, packing compliance, positive torque transmission through every
phase and timing-gear details remain unresolved. A true manufacturing profile
would require more than the approximate source outlines. The old penetration
residual is resolved; those physical limitations remain explicit.

Browser default/oblique inspection compared the corrected model with the source.
A 17-pose framing sweep found no clipped vertices (maximum absolute projected
coordinate 0.832) and no browser errors. Bulk captures and exports stay
in `/dev/shm`.

```sh
node scripts/export-holly-contact.mjs
python3 scripts/generate-holly-mate.py
node scripts/export-holly-contact.mjs
python3 scripts/review-holly-contact.py
node --test tests/movement-429.test.mjs tests/rotary-engine-427-429-solids.test.mjs tests/holly-mating-profile.test.mjs
```

Python generation/review uses Shapely 2.0.3. Set `BAKED_OUTPUT` to a temporary
path to reproduce without replacing the checked-in profile. The saved audit
binds its results to hashes of production, source and generator/review code.
