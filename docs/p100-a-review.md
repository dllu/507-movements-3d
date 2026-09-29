# Pass 100, lane a: 495, 496 and 497

These are the user's findings on 495–497 (`/dev/shm/p100/img/116–119.png`). Captures are in `/dev/shm/p100/a/` (outside Git):
- `before/` is the state at the start of the pass.
- `after/` is the new state.
- `cmp<id>.png` shows the plate, before and after.
- `tile-after-<id>.png` covers default, yaw ±40, pitch ±25, side, back, phase and close-up views.

Before-state screens were run on a `git archive HEAD` copy at `/dev/shm/p100/a/head`.

Files claimed:
- `authored-entwistle-gearing.js`
- `authored-throstle-spinning.js`
- `authored-fan-blowers.js`
- `spinning-fan-working-parts.js` (used only by 496 and 497)
- `src/data/display-profiles.{json,js}`: only the 496 and 497 entries changed.

## 495 Entwistle's gearing

**Checked against the plate.** The finding holds. The close-ups `before/495-teethA.png` and `before/495-teethC.png` show the stair notches from 116.png and 117.png along the turned tip band.

- **The stairs were not from the tooth builder.** All three wheels already used 25's builder (`makeMiterGear` → `bevelToothGeometry`). The pass-94 back-disc truncation re-lofted the teeth out to the plain back. It then clamped each flank vertex radially onto the tip-band cylinder, station by station. Wherever the cut line crossed a flank between two vertices, the clamp left a notch.
- **Tooth fix.** The shared builder's tooth is still used unchanged from toe to heel. Beyond the heel, `truncateEntwistleBevel` now cuts each station exactly:
  - every flank vertex slides down its own flank, keeping its fraction of the flank height, so the flank ends exactly on the band;
  - the tip arc becomes an arc of the band;
  - there are now 24 stations across the band, up from 8.

  Each flank edge is therefore one smooth line with no notches (`after/495-teethA.png`, `after/495-teethC.png`, `after/495-bteeth.png`). The toe-to-heel teeth and the back disc are unchanged.
- **Supports fix.** Each standard is now one closed casting in a single mesh:
  - A round eye concentric with D is extruded along D across the standard's width. It is bored 0.087 for the 0.085 shaft.
  - The post runs into the eye through tangent fillets: right standard R 0.34 / post ±0.22 / fillet 0.14; left standard R 0.40 / ±0.20 / 0.12.
  - Below the fillets, the post is Brown's elevation outline (the flared leg and the swept broken-off leg) extruded to the post's thickness.
  - The two parts share the post's flat faces. The two internal faces on the join plane are dropped, so there is no seam.
  - The slotted plates and the separate bearing cylinders are gone. The left leg stays straight beside drum C' down to y −0.20, clear of the drum rim.

  See `after/495-side2.png` (the end view that matches 118.png), `after/495-leftobl.png`, `after/495-leftback.png` and `after/495-rightback.png`.
- **Also fixed.** The faceting screen flagged the driving pulley's crown as a ridge (17°). It is now a smooth parabolic swell with 192 sides.

**Screens.**

| Screen | Before (HEAD) | After |
|---|---|---|
| Disconnected parts | 1 lip (the eye on the block), 1 short-of-pin | 0 lips, 0 slivers, 0 short-of-pin |
| Coincident faces | 0 | 0 |
| Faceting | 1 flag (pulley) | 0 |
| White parts | 0 | 0 |
| Body intersections | worst 0 | worst 0 |
| Loop seams | 0 | 0 |

**Validation.** `docs/validation/412-495-gear-solids.json` was regenerated with `scripts/review-capstan-entwistle-solids.mjs`. It keeps 33 poses. 495 has 0 penetrations over 4,827,004 queries, with a maximum sampled engagement gap of 0.00486, unchanged. 412's rows are identical.

**Tests.** `tests/capstan-entwistle-solids.test.mjs` now expects no separate standard bearings; the eye is part of each standard, and `shaftFits` passes on it. `tests/movement-495.test.mjs` passes.

## 496 Throstle spinning

**Checked against the plate.** Brown draws the roving and yarn as one thin line through the A and B nips, round the right of lower B and down to the flyer. The finding holds:
- The live yarn was 36 separate 8-sided cylinders (`makeDynamicCable`), which left notches at the joints.
- The roving pieces were flattened brass cylinders of other radii, so the diameter changed abruptly.
- The wrap ran at roll radius + 0.058 around a 0.026 yarn, so it floated 0.032 off the roll.

**Fix.**
- **One cord.** One continuous laid cord in the project's brown laid-rope style (`LaidRopeGeometry`, `PALETTE.rope`), radius 0.03. It runs from the roving's end through the A nip and the B nip, lies on the lower B roll from the nip to the exact tangent point toward the top eye (96.7°), then follows the existing path through the neck, along the flyer leg, through its foot eye and on to the package.
- **Contact with the rolls.** The 0.03 radius fills the 0.06 nip gaps, so the cord touches both rolls at each nip. Its centreline lies exactly one radius off the roll along the wrap: the float is gone.
- **Removed parts.** The flattened roving cylinders (`inputSliver`, `draftedFiber`) are removed.
- **Motion cue.** The lay travels with the front delivery speed. The lay length is adjusted slightly (0.1464) so that each cycle delivers a whole number of lay periods, and the loop closes on the same lay.
- **Wound yarn.** The yarn wound on the package uses the same cord.
- **Rolls.** The rolls are now 128-sided, so they stay round where the cord lies on them.

Captures: `after/496-wrap.png`, `after/496-wrap2.png`, `after/496-nipA.png`, `after/496-flyer.png`, and the rotated and phase views.

**Screens.**

| Screen | Before (HEAD) | After |
|---|---|---|
| Disconnected parts | 5 short-of-pin, 3 open ends | 0 short-of-pin, 2 open ends |
| Coincident faces | 0 | 0 |
| Faceting | 0 | 0 |
| Body intersections | worst 0 | worst 0 |
| Loop seams | 0 | 0 |

The 2 open ends that remain are the flyer-arm tube ends buried in the neck. They predate this pass.

**Interfaces.** Over 18.6M sampled checks, the cord cuts nothing. The minimum capped gap is 0.0019, which is the faceted strands against the inscribed roll polygon.

**Tests.** `tests/movement-496.test.mjs`:
- The yarn now starts at the roving's end, and its length is 8.47–8.48.
- The rendered cord is a single `LaidRopeGeometry` from the roving's end to the winding contact.
- A new test checks that the cord has constant radius, lies on the lower B roll (±2e-4) and cuts no roll.

In `tests/spinning-fan-working-interfaces.test.mjs`, the cord's surface points are now resampled every pose.

**Limit kept.** The lay runs at the front delivery speed along the whole cord, including the drafting zone, where the real roving is slower. The draft is shown by the roll speeds, not by thinning the cord.

## 497 Fan-blower

**Checked against the plate.** A 3× crop is at `/dev/shm/p100/a/plate497z.png`.
- Brown draws three broad curved arms cast with the hub. Each carries a separate thin curved blade plate on its broad end, and the blade runs on past the arm to its tip.
- Brown's scroll is within a few pixels of a circle round the fan axis. The spout's top wall sits half a radius below the axis, its mouth is 1.5 radii out, and a flange stands at the mouth.

The finding holds:
- The model had one-piece curved bars and no arms.
- The wall was a Catmull-Rom volute made from a polyline offset with flat facets.
- The blade tips stood about 0.2 clear of the wall at the closest point, with a varying gap.

**Fix.**
- **Housing.** The wall is one smooth-shaded extrusion (creased normals, 720-segment circle) of:
  - a circle concentric with the shaft, inside radius 3.36 and outside radius 3.48;
  - the tangential bottom spout wall;
  - the top spout wall meeting the circle at Brown's sharp corner;
  - the mouth flange (the separate lip boxes are gone).

  The side plates share the wall's outer outline. The wall's ends sit on the plates.
- **Impeller.** Three brass arms, cast with the hub, carry three separate orange blade plates.
  - Each blade is a circular arc of thickness 0.12, bowed toward the counter-clockwise turn, running the full 0.72 depth.
  - Each arm is a curved, flat 0.14-thick plate in the mid-plane. Its trailing edge runs along the blade's centreline, so it is welded into the plate.
  - At t = 0 the tips stand at about 55°, 175° and 295°, keeping Brown's 1, 5 and 9 o'clock layout.
  - The blade tips reach 3.300, leaving a uniform 0.06 clearance to the wall all the way round.
- **Other adjustments.**
  - The inlet spider standoffs now stand wholly on the plate (y ±1.30); they overhung the unbevelled inlet edge.
  - The airflow tracks now run out past the flange (x 5.12).
  - The existing cutaway on z = 0.5 still cuts the new wall. The shared spec in `cutaway-presentations.js` is unchanged and matches it by role.

**Screens.**

| Screen | Before (HEAD) | After |
|---|---|---|
| Disconnected parts | 1 lip | 0 lips, 0 slivers |
| Coincident faces | 2 flagged pairs | 0 |
| Faceting | 0 | 0 |
| White parts | 0 | 0 |
| Body intersections | worst 0 | worst 0 |
| Loop seams | 0 | 0 |

The 2 short-of-pin rows that remain are the shaft passing inside the spider's bearing. They predate this pass.

**Interfaces.** 5.0M checks, no cuts, minimum capped gap 0.0038.

**Tests.** `tests/movement-497.test.mjs`:
- There are three arms paired with the blades, and no separate lips.
- The flange ends the spout at `outletBounds.right`.
- A new test checks that every wall vertex outside the spout lies on the 3.36 or 3.48 circle, that the tip radius is 3.30, and that the clearance is 0.06.

## Other checks
- `node scripts/measure-display-profiles.mjs 495 496 497` updated only the 496 and 497 bounds and floors. 495's profile is unchanged.
- The routes are unchanged, because no factory's handled IDs changed.
