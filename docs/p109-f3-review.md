# Pass 109, lane f3: review evidence

- **Reviewer:** Claude Opus 5.5, lane p109-f3, with three forked helpers for the low findings (352/353/374/376, 390/398/412, and 439/456/457/459/466).
- **Date:** 2026-09-29.
- **Server:** private Vite on port 46163.
- **Captures:** paths are relative to `/dev/shm/p109/f3/`. `fin-NNN.png` holds the plate, then phase 0.3, an oblique view at phase 0.6, and a rear view at phase 0.45. The helpers' captures are in `A/`, `B/` and `C/`.
- **Git:** no git writes.

## Shared-helper proofs

- **Geometry hashes, byte-identical before and after:**
  - 227, 228 and 229: `chain-drive-working-parts.js`, where 227's builder was only exported as `pinnedOuterLinkGeometry`.
  - 463: `chain-weir-working-parts.js`.
  - 477 and 478: `ejector-trap-working-parts.js`.
  - 502–505 and 507: `compound-epicyclic-corrections.js` and `authored-epicyclic-trains.js`.
- **Tool:** `hash.mjs` hashes every mesh's attributes, world matrix, colour and visibility at phases 0 and 0.37.
- **`flexible-pump-working-parts.js`:** used only by 453 and 454.

## Medium findings

### 431: static water
- **Change:** the head-race, sluice and tail-race body (`channelWater`) now wears the shared `waterStreamMaterial` (one-sided, in the fluid tint).
  - v is the time of flight along x. The speed is 0.35 in the head pond, 3.4 through the opening and down the apron, and eases to 1.9 along the race.
  - So a single seamless scroll (5 tiles per 6 s loop) moves every streak at its local speed.
  - The existing sub-surface flow sheet stays.
- **Result:** the default view over 5% of the cycle now shows water change across the pond and race (`m431.png`, `431-d.png`). Before, only the wheel changed.
- **Screens:**
  - An intermediate double-sided material made the water faces fight the leaf and jambs. With the one-sided material, 0 pairs are flagged.
  - Disconnected parts: the same as the audit (the documented free-standing flume).
- **Tests:** `movement-431` passes.

### 453 / 454: the shared joint builder
Both changes are in `flexible-pump-working-parts.js`.

- **Beam and lever pins:** each is now a lathe that spans only the beam or lever and the link, with a 0.035 × 0.025 head in front of the link.
  - 453: z −0.21 to 0.42 (it was ±0.48).
  - 454: z −0.135 to 0.42.
- **Lower joint:** the lug is cast in the plate's or clamp's colour, where it was black.
  - Its eye radius equals the link eye's (0.199 on 453, 0.209 on 454).
  - It spans z 0.05 to 0.28, 0.01 behind the link.
  - The pin runs through the lug's full depth (from 0.04) and the link, and has a head.
  - So the eye reads full from behind, and the front reads as one lug plus one link plus one pin head, not a stack of black discs.
  - 454's clamp is a group, so the lug takes the clamp's child material. An intermediate build had rendered it white, which is now fixed.
- **Captures:** `m453.png`, `fin-453.png`, `fin-454.png`, `454-oz.png`.
- **Tests:** `movement-453`, `movement-454`, `flexible-pump-452-454-solids` and `p88-pump-water-coincidence` pass.
- **Screens:** unchanged or better. On 453, near-misses went from 20 to 18. On 454, from 9 to 8.
- **Residual:** 454's lug foot overhangs the r 0.2 centre clamp to the front by about 0.1, as the old clevis did.

### 462: chain
- **Change:** the continuous tube is hidden. The chain is now 24 pinned links on the 24 carriers, alternating:
  - outer links, built by 227's builder in bored form (two side plates at z ±0.018–0.046);
  - inner links, a single plate at z ±0.014 in a lighter dark grey.
- **Pins:** the carrier cross-shafts are the pins, so no pins are added or duplicated.
- **Pitch:** each link spans the chord between its carriers. On the wheels the chord is 2.6% shorter than the arc pitch, which is taken up by scaling along the link.
- **Captures:** `m462.png`, `m462b.png` (side view: plates edge-on in the wheel plane) and `fin-462.png`.
- **Tests:** `movement-462` and `chain-weir-interfaces` pass.
- **Screens:** 0 detached, 1 near-miss (the same as the audit), 0 coincident.

### 464: static jets
- **Change:** each jet keeps its ballistic `WaterStream` path but uses the shared material with a stronger streak map.
  - The map has three slugs per tile (alpha 0.3–1), 2.4 tiles/s rounded to whole tiles per loop, one across.
  - v is the time of flight, so the slugs run outward from the spire tip at the water's local speed.
- **Result:** the jet zoom changes 63,897 px over 0.25 s (it was 3,327). See `m464.png`.
- **Tests:** `movement-464` passes.
- **Screens:** unchanged.

### 475 / 476: frozen ejector water
All changes are in `ejector-trap-working-parts.js`, plus the closed fork body's UVs in `authored-steam-siphon-pumps.js`.

- **Water material:** B, D and C (475) and the fork water (476) wear the shared streak material in the light water tint.
- **UVs:** u runs round the bore and v is a flow coordinate, so streaks slow in D's belly and quicken in C (and in 476's stem).
- **Spill sheet:** the discharge over C is now a streaked spill sheet. Its UVs run up the column and out and down the crown.
- **Scroll:** the scroll is the cumulative discharge (whole tiles per loop). The streaks stand while the steam purges, creep as the water rises, run during discharge and stop at shut-off.
- **Free surfaces:** these keep the plain water material.
- **Results:** default-view change over phases 0.60–0.62 is 6,777 px on 475 and 19,961 px on 476. Both were 0.
- **Captures:** `m475.png`, `m475b.png`.
- **Tests:** `movement-475`, `movement-476` and `ejector-trap-working-solids` pass.
- **Screens:** unchanged (475 keeps its one lip).

### 506: bevels, arrangement and topology (expanded by the user's report)

**Topology against the plate and caption:**
- The wiring was already Brown's:
  - A carries a and h. a meshes b, which is united with c.
  - h meshes g, which is united with f.
  - The arm k-l is fast on m-n and carries the united d and e.
  - c meshes d, and e meshes f.
  - Every pair has perpendicular axes and a common apex.
- The arrangement was wrong:
  - Brown draws h as the *outer*, larger wheel on A (on g) and a as the *inner* one (on b).
  - With b 40 > g 32, a stood at x −2.0, outside h at −1.6. h's lower half ran through b's teeth, and its teeth broke through g (the user's stray gold fragment on the grey disc).
- d outer and e inner on the carrier were already right.

**Rebuild:**
- **Counts:** a 20, b 36, c 21, d 16, e 10, f 13, g 43, h 34. The carried train's apex is at y 0.35.
- **Clearances these give:**
  - h clears b's rim, and h's toe clears a's heel by 0.05 (h's face is the outer 14%).
  - c stays inside a's toe, d stays under g and outside f.
  - The carried compound's swept radius (1.32) and head l (x 1.23–1.35) stay inside a's toe (1.44) when the arm swings to A's side. This is the one deliberate departure from Brown's proportions: in his drawing l would strike a.
- **Frame:** the standard's arm and upper bearing are raised 0.40, shaft A ends inside a, the head is shortened, and the hub k is shortened (it touched f's hub).
- **Teeth:** the shared tooth builder (as 025 and 495) with creased-smooth normals (24 flank and 12 tip samples) and 192-sided bodies.
- **Mesh phases:** fitted by the new `scripts/fit-506-bevel-phases.mjs`.
- **Ratios:** b-c −5/9, f-g 34/43, carrier 3083/26961, d-e −47411/53922.

**Validation:**
- **Gear solids:** `review-compound-epicyclic-teeth.mjs` at 33 poses: 1,142,765 queries, 0 penetrations, flank gaps 0.0083–0.0089. Merged into `docs/validation/506-507-gear-solids.json`; the 507 rows and slow window are unchanged, and the hashes are refreshed.
- **Full assembly:** every rigid body against every other over one whole carrier turn (193 poses; `allpairs506.mjs`). No moving-body interpenetration. The only hits are frame castings' intended joins and hidden index bars.
- **Screens:**
  - `screen-body-intersections` at 257 samples: solid 0, coaxial 0.
  - Coincident faces: 0. The axle end that lay flush in head l is now buried 0.02.
  - Disconnected parts: 0 detached. The 2 short-of-pin items are g 0.11 under the standard's arm and the shaft 0.05 over the base.
- **Captures:** `m506a.png` (plate, default, phase 0.3), `m506b.png` (oblique, below, back, top), `m506c.png` (the user's angle and two more) and `fin-506.png`.
- **Tests:** `movement-506`, `movement-507`, `compound-epicyclic-*` and `epicyclic-family-clearance` pass (29). `movement-506` was updated for the new counts and ratios.
- **Other files:**
  - The 506 display profile was re-measured (motion bounds only).
  - `503-504-contact-solids.json` was reproduced exactly; only its source hash changed.
  - `docs/movement-506-507.md` has a p109 section.
- **Residuals:** the bevel flanks are the back-cone approximation. d (accent) and e (brass) are both yellowish.

## Lows

| ID | Change | Evidence |
|---|---|---|
| 352 | The hook eye bar is 0.048 over the 0.045 shank, and the shank end is buried in the eye. | `A/m352.png`; tests pass; screens unchanged |
| 353 | The wipers' base widens to about 0.65 R (0.72 rad). The working face, barb and contact law are unchanged. | `A/m353.png`; 129-phase clearances pass |
| 374 | The treadle is one extrusion: a round fulcrum eye, tapering to 60% with a round end. The pin spans only the bearing and the eye. | `A/m374.png`, `A/374-free.png` |
| 376 | The 16 square cheeks become one continuous inner flange ring per face. | `A/m376.png`; tests updated |
| 390 | **Not changed, disputed.** The overrunning pawls measure ≤ 0.0014 from the ratchet outline at 41 phases. They ride the crests on the arm, then drop at a finite rate. | `B/gap390.mjs` |
| 398 | The output wheel carries the shared quadrant cue (`applyRotationIndicator`). | `B/m398.png` |
| 412 | Each pawl is one line-and-arc outline: the eye concentric with its pin, tangent sides, and a sloped wedge nose matching the notch. The lower pawl's tail is one tangent arc. | `B/m412.png`, `B/m412b.png`; `412-495-gear-solids.json` hash-only regeneration |
| 439 | The lifting valve's stem slides in a minimal bored guide bar cast across the bucket. It is not drawn by Brown and is hidden in the default view. | `C/m439.png`; 201-phase test |
| 456 | The suction column and pour use the streak material with stronger alpha, at 2.5 tiles/s. | `C/m456.png`; the pour zoom changes 4,422 px (was 879) |
| 457 | Uses 458's p107 tipping law: a quarter yaw, then a tip in the view plane. The pour is in profile. | `C/m457.png`; display profile re-measured |
| 459 | The worm core overruns each thread end by 0.006. | `C/m459.png`; coincident flags 1 → 0 |
| 466 | Lathes use 160 segments. The flange underside is Brown's single chamfer. The plunger and crosshead are steel grey. | `C/m466.png`; the faceting score for the ram is 21.6 → 7.8 |
| 469 | The stopped dwell is 6% of the loop (it was 14%: operation end 0.82, reset start 0.88). Bubbles swell in as they leave the pipe, which removed a pop the check-loop-seams screen found after the retiming. | Loop-seam check clean; display profile re-measured; `movement-469` updated for the dwell midpoint |
| 473 | Each pull rope is made fast by a turn of rope round the lever end (a ring seated on the bar's top) and hangs from its bottom. | `m473.png`; screens clean; profile unchanged (the ring is marked rotationally symmetric) |
| 492 | The tongue's knee is the largest tangent arc between its two runs, so it is one smooth curve. The hook bar is 0.13 on a 0.34 bend (was 0.11 on 0.31); a 0.14 bar jams the released tongue. | `m492.png`; `movement-492` and `boat-detacher-contact` pass; profile re-measured |

## Tests and screens run

- **Targeted tests:** 41 files, 354 pass and 0 fail (`tests.log`). A later rerun of the 453, 454, 469, 473 and 506 tests after the final edits also passed.
- **Screens:**
  - Disconnected parts and coincident faces for 431, 453, 454, 462, 464, 469, 473, 475, 476, 492 and 506: no regressions against `/dev/shm/p109/a/`.
  - `check-loop-seams` for the same IDs: 0 seams, 0 pops.
  - White parts for 453, 454, 462, 473, 492 and 506: 0.
