# Pass 103, lane a: 159, 211, 358, 483, 370

Files claimed: `authored-intermittent-core.js`, `authored-fusee-traverses.js`, `cord-traverse-working-parts.js`, `authored-dry-gas-meters.js`, `authored-mirror-polishers.js`, `mirror-s-link-click.js`, `mujoco-cord-treadle/*` (including the new `elastic-cord.js`), `baked/cord-treadle.js` and `cord-treadle-motion.js`.
Scratch and captures: `/dev/shm/p103/a/<id>/`.
Process note: I briefly ran `git stash` / `git stash pop` (about one second) while probing 211's old behaviour. The pop restored every tracked file cleanly, and the 159 sub-lane re-verified its edits and re-ran its bake and tests afterwards. That was a git write against the brief. It left no trace in the tree and won't be repeated.

## 211: the entry pin moved in to 2.4 radii from the wheel's edge (fixed)

**Finding checked, and the ledger's premise corrected.** The edge that matters is the swept relief corner just above the pin, not the plain rim.
- **Measured at HEAD:**
  - the pin centre is 0.301 from the wheel outline, i.e. 1.20 pin radii;
  - the gap from the pin's edge to the wheel's edge is 0.051 construction units, so the pin barely stands on the wheel face.
- **Brown does not draw it there.** On the raster (driver centre (339.1, 266.8), 18.8 px/unit), the pin is centred at (199.5, 242.5). That is 7.53 units from the wheel centre, against the model's 8.7. Its radius is about 0.24. It sits on the tongue's crown about 10° before the line of centres, roughly 3.7 radii inside the root-level relief.

**Why p101 found moving it in impossible, and the new route.**
- The guide law (`/dev/shm/p103/a/211/law.mjs`, `grid5.mjs`) requires three things together:
  - the pin must strike the tongue's hump arc, not its straight root (a check p101's grid lacked);
  - the strike must fall at or after the line of centres;
  - it must turn the pinion 36.25° by the 14.5° handoff.
- With all three, the search finds no tongue for any orbit below 8.7. The only solutions at 8.7 have margins of 0.2° or less.
- **New approach:** let the lock release a little before the line of centres, as Brown's pose shows (pin already on the crown). The pin then strikes early.
  - The wheel's relief is swept from the pinion's actual motion, so the plain rim is relieved for the early turn automatically.
  - The lock-arc test still holds: the plain rim occupies more than 97% of the dwell.
- Searching orbit, hump centre, hump radius and root with a lead gives solutions at 8.35 (lead ≥ 2.4°), 8.2 (lead ≥ 3.4°) and 8.0 (lead ≥ 8°).
- **Chosen: orbit 8.35 with a 2.5° lead**, which trades pin inset against the handoff speed step:
  - hump centre (4.6, −1.2) and contact radius 2.5, so the tongue keeps the same bean with its crown at 1.05;
  - the tip stays at x 6.12, inside the plate's 5.5–6.3;
  - pin radius 0.24, as measured on the plate;
  - the pin strikes 2.35° before the line of centres.

**Result:**

| | HEAD | now | Brown |
|---|---|---|---|
| pin centre to wheel edge | 0.301 (1.20 r) | 0.581 (2.42 r) | about 0.9 (3.7 r) |
| gap from pin edge to wheel edge | 0.051 | 0.341 | about 0.65 |
| pinion/wheel speed ratio at handoff to the teeth | 2.18 → 2.5 | 1.88 → 2.5 | — |
| peak pinion speed (display profile) | 1.389 | 1.300 | — |

- The minimum running guide clearance stays at 0.00276, with no penetration at any of 32,769 states.
- The handoff speed step is larger than before (1.88 → 2.5 against 2.18 → 2.5). It is the cost of the inset. Orbit 8.45 would give 2.0 → 2.5, but with only a 0.26 gap.

**Code** (`authored-intermittent-core.js`, 211 function only):
- `guideLeadPhase`; the pinion motion wraps the early push into the end of the previous turn;
- the sweep runs from −lead;
- the guide scan starts at the strike;
- `indexing` and the stage/output bookkeeping cover the pre-line push;
- the old "sliver" linear correction is removed.

Movements 063 and 212 in the same file pass unchanged.

**Captures:** `/dev/shm/p103/a/211/sheet211.png`.
- Row 1: plate, before, after.
- Row 2: before zoom, after zoom, after rotated zoom.
- Rows 3–4: phases 0.994, 0.01, 0.03 and 0.05, plus yaw/pitch ±40/±25.
- `cmp2.png`: plan geometry before and after.

**Tests:**
- `movement-211`: 5/5. Updated for:
  - the pre-line push (stage counts 1672/8010/3641/19446, engaged 1557, indexing 13323);
  - a strike-phase assertion;
  - the closest-guide tolerance, now 1e-8 (the running clearance is flat to 3e-9).
- `movement-063` and `movement-212` pass, and `display-tooth-passing` passes.

**Screens:**
- Seams 0; coincident 0; body intersections 0.
- Disconnected: the same single pre-existing near-miss group (the cropped pinion shaft) as at HEAD.

**Display profile:** `src/data/display-profiles.json` was re-measured for 159, 211 and 358 (`scripts/measure-display-profiles.mjs`). Only 211 and 358 changed.

## 358: band at the two-cord cap (shrunk; residual forced)

**New analysis of the alternatives the brief suggested:**
- **Flat strap.** Two straps must still sit side by side at the takeoff, so each is at most 0.076 wide. In the default view the strap leaves the fusee face-up, so it reads at most 0.076 wide against round cords of 0.070. That is no real gain, and it contradicts Brown's laid-rope hatching.
- **Double-start groove with offset halves.** A and B each wound on their own start, with B's cone cut deeper by slope × p/2 = 0.0315 so both take off at one radius. This fixes the radius but not the width: two interleaved starts halve each groove to p/2 = 0.076, the same cap.
- **Separated takeoff angles** (anchors raised or lowered so A and B leave at different angles):
  - A's free strand then lies over B's wound arc and diverges only as u²/2r. Clearing one cord diameter needs u ≥ √(2rD) ≈ 0.34, about 39° of arc at mid-cone.
  - Within that arc the two free strands cross at the same height, while the helix advances them only 0.015 axially.
  - So they collide unless one stacks over the other, which is the stretch case p99 already ruled out.
- **Longer fusee or fewer turns.** The model's fusee is already longer relative to its diameter than Brown's (1.52/1.72 = 0.88, against 130/174 px = 0.75), and ten turns are pinned by Sureda and the official animation.

Brown's band is about 0.85 of his own groove pitch, so on his proportions no two-cord takeoff can fit.

**Shrink:**
- The cords now stand at the cap: radius 0.032 → 0.035, and centre offset ±0.034 → ±0.03625, leaving 0.0025 between the cords where they meet.
- The cut groove's floor is 0.035 below the pitch line, flat to ±0.0715, with a 0.004 ramp to the knife-edge land at ±0.0755.
- Band diameter 0.064 → 0.070, i.e. 0.61 of Brown's ≈0.114 (was 0.56).

Files: `authored-fusee-traverses.js` (`CORD_RADIUS`, `CORD_OFFSET`) and the 358 branch of `cord-traverse-working-parts.js`. 352 and 362 use other branches.

**Captures:** `/dev/shm/p103/a/358/a-sheet.png` (before and after close-ups, then default and rotated views) and `cmp-def.png` (default view before and after).

**Tests:**
- `movement-358` and `cord-traverse-working-solids`: 20/20. The takeoff separation assert is now 0.0725.
- Both cords clear the cut fusee and each other over the full traverse.
- `fusee.test`: passes.

**Screens:** seams 0; detached 0, slivers 0, lips 0 (near-misses 20); coincident faces: the 4 known shaft-in-bore pairs (3.5e-6 relative area), as at HEAD.

## 483: left flag rod (re-examined; forced, no code change)

- **Sleeve in the case-wall colour.** This replaces 0.86 of undrawn rod with 0.86 of undrawn casing, which must also carry a slot for the flag arm at y 2.70. It is the rejected "extend the end board to the shelf" in another form.
- **Rod inside the 0.44 side wall (new, quantified; `/dev/shm/p103/a/483/lk.mjs`).**
  - The valve timing needs the symmetric crank-rocker (each space closes during exactly half a turn). That puts the rocker's mean direction perpendicular to the rod–crank line, i.e. along the wall.
  - The top arm then swings ±24.6° about the wall's own direction. Its tip moves ±0.5 in x, which is outside a 0.44 wall on both sides, so no bore in the wall can hold it.
  - The flag arms at the bellows' top and bottom, rocking 20°–69° to give the 1.04 stroke, would need about 0.4-long slots in the inner face even with the rod centre only 0.10 inside the wall.
  - A non-symmetric link breaks the half-turn exhaust law that B's D-cup relies on.
- **See-through wall.** This does not apply. The rod is not behind any drawn part (it stands in the open gap), and Brown dots nothing there.
- **Mechanically required.** A two-diaphragm meter needs both flags on the crank a quarter turn apart to pass the dead points, so the rod cannot be dropped.
- **Brown's own drawing shows the equivalent part.** In the same gap between the bellows top and the shelf, Brown draws A′'s flag arm and bracket (plate y 182–202 px). The left residual is that drawn part's mirror.
- The residual is unchanged: 0.86 of rod, with its arm and link, from 2.54 to 3.40. Brown's own gap is 0.76 (shelf underside at 3.32).
- **Tests:** `movement-483` and `gas-meter-working-solids` pass (untouched).

## 370: mirror height (re-checked with the p101 S-link; forced, no code change)

- **Probe** (`/dev/shm/p103/a/370/probe.mjs`, 65 poses): the only part crossing the lower rail's depth (z −0.21 to −0.01) below the rail top is the mirror axle, which spans z −0.48 to 0.20. The S-link, ratchet and sheave all lie behind the rail (z −0.37 to −0.25), and the keeper stays above y −0.09.
- **The binding constraint has not changed.** The axle's lowest point is −1.386 against the rail top at −1.41, a 0.024 margin, so the most the mirror can gain is 0.024/4.82: 0.591 → 0.596 of the bar. The p99 click journal pin that the S-link removed was never the binding constraint.
- **General bound.**
  - The axle must clear the rail top at the bottom of the stroke. The bar's end must cover the guide pins at the top of the stroke.
  - Together these give (1 − f)·L ≥ s + c, where c = 0.2 (bar past the pin) + 0.17 (pin to rail top) + 0.105 (axle radius) + 0.018 (clearance) = 0.49.
  - At Brown's stroke/bar ratio (0.368), f ≤ 0.63 − 0.49/L for any scale, so 0.73 is unreachable with the axle behind the bar.
  - At the model's L 4.82 and s 1.44, f ≤ 0.60. Reaching 0.73 would need L ≥ 7.2, a crank/bar ratio of 0.10 against Brown's 0.18.
- **Alternatives still excluded:**
  - A notch in the rail would now show through the see-through bar, and at 0.73 it would cut the 0.34 rail in two (axle bottom −2.03 against rail bottom −1.75).
  - A mirror between the bar and the rail sweeps both guide pins.
  - A rail in front of the bar reverses Brown's overlap.
- **Tests:** `movement-370` and `polishing-interfaces` pass (untouched).

## 159: the take-up no longer snaps (elastic, heavy driving cord; rebaked)

**Flaw, verified.** In the pass-101 bake the treadle is driven by MuJoCo's ideal inextensible tendon (hard limit, solref .002). At take-up (t ≈ 1.79 s) the resting treadle goes from 0 to −0.81 rad/s within one 9 ms sample: peak treadle angular acceleration 482 rad/s² (1 ms samples), 170 rad/s² over 4 ms differences, ramp to 0.6 rad/s in about 1 ms. The one-way visual chain is then forced dead straight (free links set to the straight span), a centreline peak of 901 units/s² with a visible kink at 1.84 s.

**Fix (new approach: the cord that drives the treadle is compliant and heavy, not massless and rigid).**
- New `src/simulation/mujoco-cord-treadle/elastic-cord.js`: tension-only cord law with two series compliances, both physical. The elastic stretch is strain-stiffening, e = (T/k)^(1/2) with k = 20000 (kg·unit/s² per unit²); that is about 0.93% working strain under the 1.9 kg treadle. The sag of the cord's own weight in the free diagonal run is the classical parabolic equivalent-modulus deficit d = w²s³/(24T²), with w for a 0.045-radius cord at 1100 kg/m³. The chord extension x = e(T) − d(T) is monotone, so T is solved from the chord. Damping (120) acts on the chord rate and fades in with the stretch (engage 0.03).
- `physics.js`: an optional `elasticCord` applies this tension through the spatial tendon's Jacobian every step (`qfrc_applied`, after `mj_fwdPosition`). The hard limit stays as a backstop at 5% strain, which is never reached. The default (ideal-cord) path is unchanged: the three regenerated ideal-scaled reports have identical summaries.
- `scripts/bake-cord-treadle.mjs`: native passive treadle, floor contact as before. The cord is tied shorter than the drawn taut length by its working stretch. A secant solve over the tied length (11.0881 against the drawn 11.1834) makes the treadle pass the ideal cord's angle at the loop start (the drawn crank phase) to 2.9e-8 rad. The treadle's range stays the same (−0.2262…0.3452 against −0.2257…0.3452). The legacy sag-amplitude channel is solved for the tied length. Its square-root onset is accepted at the finest refinement, since it is a fallback channel only.
- `cord-dynamics.js`: with `elastic`, the chain's free run gets the chord's length plus the sag deficit at the chord's static tension. The chain keeps the sag its weight implies while the tension builds, instead of being forced straight the instant the chord reaches the tied length. (Lengthening the links by the elastic stretch instead made the loop non-periodic, with closure 0.045 to 0.10; the sag form closes to 1.6e-12.)
- `baked/cord-treadle.js`: the reconstruction note now says the cord stretches slightly under load; the e2e prefix is kept.

**Results (before → after).**
- Peak treadle angular acceleration at take-up: 482 → 8.9 rad/s² with 1 ms samples, and 170 → 8.8 rad/s² over 4 ms differences.
- Ramp from rest to 0.6 rad/s: about 1 ms → 73 ms. Jerk: 4.8e5 → 1.0e3 rad/s³.
- Peak centreline acceleration of the visible cord during take-up: 901 → 320 units/s². Onset: 415 (ideal) against 70.
- The landing on the floor (t ≈ 0.1 s, 215 rad/s² over 4 ms) is a free fall onto the rigid floor. It is unchanged and was not part of the complaint.
- Bake: 2808 adaptive motion samples (was 3345; the adaptive count follows the new motion); chain closure 1.6e-12; velocity closure about 1e-11.

**Captures** (`/dev/shm/p103/a/159/`):
- `after-sheet.png`: plate, default, yaw ±40, pitch ±25 and close-up views.
- `takeup-zoom-cmp.png`: 1.68–1.90 s, before (top) against after (bottom). Before shows the forced-straight kink at 1.84 s; after straightens progressively.
- `takeup-cmp.png`: full-view strip.

**Tests.**
- `cord-treadle*`, `finite-cord-treadle`, `mujoco-baked-loops` and `sliver-joints-p86-7`: 152/152.
- `cord-treadle-baked` now uses the tied length.
- `cord-treadle-dynamics` has a new test: take-up treadle acceleration below 20 rad/s², visible-cord take-up peak below 500, and a valid retie.
- `models.test` 159: 1/1. e2e `cord-treadle.spec`: 1/1.

**Screens.**
- Loop seams: 0.
- Disconnected parts: 0 detached, 1 near-miss pair, as before (geometry unchanged).
- Coincident faces: 0.

**Reports and provenance.**
- `src/simulation/baked/assets/159.json.gz` and `159.provenance.json` were rebaked. The sources now include `elastic-cord.js`, all hashes match, and `cordModel` is recorded.
- `docs/validation/159-ideal-scaled-{coarse,fine,finer}-native.json` were regenerated (they fingerprint `physics.js`). Their summaries are byte-identical.
- The older `159-floor-passive-*` and `159-passive-*` reports were already stale against HEAD and were left as historical.

**Proposed ledger row.**
- Assessment: minor. The forced slack loop remains, and the user has accepted it.
- visibleFlaws: "The slack cord hangs in a loop under the crank pin for about a third of the turn (accepted by the user)."
- Limits, append: "p103: the cord that drives the treadle is elastic, heavy and tension-only (elastic-cord.js). Strain-stiffening stretch (about 0.9% working strain; stiffness assumed, softer than new hemp) is in series with the sag of its own weight, plus damping, applied through MuJoCo's tendon Jacobian. It is tied short by its working stretch so the loop-start pose matches the ideal cord. Take-up now ramps over about 70 ms (peak 8.9 rad/s², was 482), and the visible chain keeps its weight-sag while the tension builds (peak 320 units/s², was 901). The visible chain is still one-way coupled. The foot's landing on the rigid floor is an impact."
- mujoco: baked (the treadle's MuJoCo run now includes the elastic cord force).
