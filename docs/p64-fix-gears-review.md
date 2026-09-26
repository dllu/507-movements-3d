# Pass 64: gear-family audit fixes (30, 37, 133, 204, 210, 216)

Lane p64-fix-gears. I compared each movement with `public/engravings/mm_NNN.png` in fresh
captures on the production route. Each tile shows the default view at four phases, ±60° about
vertical, back and top. Before and after tiles: `/dev/shm/p64-fix-gears/{before,after}/NNN.jpg`.
The captures are scratch files and are not in Git.

## 210: curved-slot rocker and guided bar (was FLAWED)

- Removed the undrawn rear strap that joined the two guide blocks and the shaft boss.
- Moved the guide blocks to the plate's positions (source y 487 and 22, so model y −2.19 and
  3.31).
- Lengthened the bar (−4.52 to 2.92) so that it stays in both guides over its whole stroke
  (0.567 to 2.150).
- Each guide is now one bored rectangular block rather than four coplanar boxes. This cleared
  8 same-look z-fights.
- The default framing now fits the arm's swept envelope, the roller and both guide blocks.
  The bar's overhang may crop at the ends of the stroke. The frame height dropped from 8.5 to
  under 6.3 units, so the mechanism now fills the frame as it does on the plate.
- The test now requires both guide blocks and the full arm swing to stay framed, instead of the
  bar's full swept length.
- Intersections: none before (sampled), none after (0.01 spacing, 129 poses, 4 bodies).

## 30: rectangular gears

- The pitch law has six 4k harmonics. I fitted them by least squares to x¹⁰+y¹⁰ squares for
  both conjugate pitch curves, with minimum curvature 0.02 so that both stay convex. The flats
  are now almost straight.
- The corners are at the kinematic limit. While a corner rolls on a convex mate's flat, the
  corner curvature is bounded by 1/r₁+1/r₂. Exact conjugate squares with sharp corners
  therefore do not exist: the conjugate of a true square is concave.
- Teeth are square. The rack generator has a 10° pressure angle, addendum 0.8 m and
  dedendum 1.0 m, which gives near-parallel flanks and broad flat tips.
- `rackGeneratedOutline` has new optional pressure-angle, addendum and dedendum parameters. The
  defaults are unchanged.
- Brown's rim line and hub ring are modelled as solids:
  - a full-depth toothed rim;
  - a recessed web;
  - a raised boss in the wheel's own colour, replacing the black hub disc.
- The noncircular contact test now measures engagement as the normal flank gap. A radial gap
  overstates the gap on near-radial flanks.
- Intersections: none (2 bodies). Meshes are closed.

## 37: conical stud gear

- Studs are stouter and shorter: radius 0.03 → 0.045 and front 0.12 → 0.06. The clearance cut
  was rebaked (`scripts/bake-conical-stud-profile.mjs`).
- A stud now stands about 0.15 proud of the stud cone (was 0.21). It remains a short nub where
  it crosses the silhouette, because it must reach past the toothed cone's addendum into the
  tooth spaces.
- Intersections: none (2 bodies, 47 meshes).

## 133: sector press

- Removed the two undrawn guide cheeks (`fixed-vertical-guide-along-platen-edge`). The platen
  spans the plain columns as Brown draws it.
- Tests no longer require the cheeks and now assert that none are present.
- The pass-49 overlap between a cheek and the crank shaft disappears with the cheek.
- Intersections: none (5 bodies).

## 204: skew hyperboloid rollers

- The camera changed from (2.7, 4.7, 13.2) to (0, 4.5, 13.2): square-on to the common
  generator, at the same elevation. In the default view the lower roller's near left end now
  overlaps the upper roller, and both the upper right and lower left end faces show, as on the
  plate.
- Brown's face ellipses are wider than a 40° crossing allows (about 0.5 against 0.34). I kept
  the crossing angle, because the waist is already more pinched than the plate's.
- Intersections: none (3 bodies).

## 216: mutilated external/internal gear reverser

- Tooth tips are wider: tip half-angle 1.88° → 3.0°, and the flank stations were widened to the
  collision limit. Tip width went from 0.073 to 0.116.
  - Wider tips (3.2° or more) intersect the adjacent sector tooth.
  - The ring's narrow root gaps limit square pinion teeth.
- Each tooth solid now reaches 0.04 into its root body, and the teeth share the body's bevel.
  The body chamfer no longer grooves across the tooth roots, which had made the root disc read
  as a large hub.
- A small bored boss (r 0.42) in the gear's own colour is flush with each sectioned shaft end,
  like Brown's hub rings.
- Intersections: the full 16,385-state polygon check passes, and the screen shows no solid
  pairs (2 bodies).
- Residual: the upper wheel is part of the same rigid compound as the ring, so it keeps the ring's
  colour and still reads weakly against the orange rear web.

## Reports regenerated

- `docs/validation/200-226-bevel-solids.json`
- `202-264-worm-solids.json`
- `191-196-201-contact.json`
- the variable-face contact report

Only their source fingerprints changed.
