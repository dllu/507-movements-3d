# Pass 99, lane p99-b: residual flaws in 57, 71, 76, 218, 236, 240

- **Reviewer:** Claude Opus 5.5, lane p99-b (forks for 076 and 236), 2026-09-28.
- **Claims:** band-epicyclic.js, band-epicyclic-gears.js, authored-intermittent-core.js, authored-wool-comber.js, jointed-tappet.js, alternating-pawl-236-working-parts.js, ratchet-stop-240-contact.js, ratchet-stop-240-working-parts.js.
- **Captures:** `/dev/shm/p99/b/` (outside Git). `before/` holds HEAD (`m<id>.png`: plate, default, yaw 40/pitch 25). `after/` holds the new state (`n<id>.png` montages; per-view files `<id>-d|r|r2|z*.png`).

## 057: square-topped teeth by a standard 16/9/34 train
- **Verified.** 18/10/34 on one orbit is not a standard train (18 + 2 × 10 = 38), so the planet's one base circle forced a 35° internal and a 17° external operating pressure angle; the ring teeth came to points. That is forced only while all three counts are kept.
- **Plate re-measured.** Brown's pitch radii (plate px, detail image scale): sun about 152, planet about 85, ring about 325, orbit 225. So sun/planet ≈ 0.56 and ring/sun ≈ 2.14. 16/9/34 gives 0.5625 and 2.125 and satisfies 16 + 2 × 9 = 34. So one module fits Brown's proportions exactly. The ring keeps Brown's 34 teeth; the sun has 16 (counted 18) and the planet 9 (the plate is ambiguous between 10 and 12).
- **Fix** (`band-epicyclic-gears.js`, used only by 057):
  - One module (0.1125) and one 20° pressure angle at both meshes. The internal and external working angles are both exactly 20°.
  - Planet profile shift +0.4, so its nine teeth are not undercut.
  - Tips and roots: sun 0.97/0.755, planet 0.615/0.41, ring 1.865/2.05. The ring tip was raised from 1.845 to 1.865 because at 1.845 its corner swept into the planet's radial flank below its base circle (2 crossings a sample over half the cycle). At 1.89, contact was lost.
  - Flat tip lands: sun 0.087, planet 0.109, ring 0.099 (0.77–0.97 module). The old ring tips were points.
  - Contact ratios: external 1.14, internal 1.12 (the old internal was 1.11).
  - The drums and bands are unchanged. The carrier now orbits once in 57.5 s (it was over 200 s), because 16/1.2 and 34/2.2 no longer nearly cancel. The pinion's orbit is now visible within a minute, which the caption asks for.
- **Captures:** `after/n57.png` (plate, default, +40/+25, −40/−25 at phase 0.3), `after/c57.png` (before and after crop of the ring/planet mesh).
- **Tests:** `tests/band-epicyclic.test.mjs` 7/7. The involute-contact test (257 poses, both meshes: no crossings, 0.00002–0.000031 working gap, power balance) passes unchanged. The orbit-period assertion is now 50–70 s. A new p99 test covers the counts, the equal 20° angles and land ≥ 0.75 module. The `tests/models.test.mjs` count assertion is updated to 16/9/34.
- **Residual:** sun and planet counts differ from Brown's hand count by 2 and 1, while their sizes match his.

## 071: rim slits (forced; tappet now on Brown's line, slits 5° nearer)
- **Geometry, measured on the detail image.** B's centre is at (905,720) and C's at (435,765), with C at 180°.
  - Brown's tappet A lies on 161.3°. HEAD showed it on 156.3°.
  - Upper slit: outer mouth 136.5°, inner end 121.6°.
  - Lower slit: outer mouth 211.2°, inner end 219°.
  - These are close to the static intersections of C's stud orbit with B's rim circles (139° and 221°).
- **Why the slits must lag (proof).**
  - A slit is where B's rim is when a stud crosses it.
  - C is locked until A meets the struck stud, at B = 164.3°. So no stud can cross before then.
  - During the push, B turns 55° (to 219.6°) while C turns one pitch (36°).
  - The entering stud reaches the rim's outer circle only after C has advanced 11.6° of that pitch, and it is fully inside only at the end. The leaving stud crosses between 9° and 26.8° of C's advance.
  - So in any pose where A is on Brown's line, each slit sits clockwise of the static crossing by the turn B makes before that stud reaches it. This is at least the 3° to contact, plus the turn that the stud's 9–12° of advance takes.
  - Showing the slits at Brown's angles would need B turned by 20–40°, which moves A the same amount off his line.
  - A thinner rim would shorten the slits, but the inner face must stay on the lock studs (0.657 cd) and the outer circle is Brown's (0.861 cd).
- **Fix** (`internalGuardTappetStudIndex` only): phase 0 now shows A on Brown's 161.3° (was 156.3°, 5° off), 3° before contact.
  - Upper slit: outer mouth 115.9° (Brown 136.5°, was 110.9°); inner 82.3° (Brown 121.6°).
  - Lower slit: outer mouth 173.8° (Brown 211.2°, was 168.8°); inner 213.8° (Brown 219°, was 208.8°).
  - The slits themselves are unchanged (they are cut in B's frame), and so are the lock and tappet contacts.
- **Captures:** `after/n71.png` (plate, before, after default, +40/+25, phases 0.1 and 0.2).
- **Tests:** `tests/movement-071.test.mjs` 6/6. A new p99 test covers the phase-0 tappet angle and contact within 3.5°.
- **Residual (forced):** the slits run 21° (upper) and 37° (lower) clockwise of Brown's at their outer mouths. At the inner ends the lower is 5° off and the upper 39°. The upper runs more steeply because the rim is 0.2 cd thick.

## 218: square lug in square notches
- **Verified.** G's lug was a capsule with a round tip, and F's notches were milled to that round tip. Brown draws both square.
  - The round tip was not needed for the drive. The notch had to be relieved only because the rocker began its return while G was still lifting out at e, and finished it while G dropped in at C. The lug therefore moved sideways inside the notch.
- **Fix** (218 only; 217's law, notch profile and geometry are byte-identical):
  - **Lug.** G's lug is a straight bar, 0.18 wide, with a flat end through the old tip's lowest point and r 0.025 corners (`lugOutline`). It stays part of G's single outline. The hidden seat marker is the same tip prism.
  - **Rocker law.** The rocker holds still from e until G has lifted clear (phase 0.55–0.575), and again from the start of the drop at C (0.95–1). It returns in between on the same quintic. The drop and lift are pure turns about G's hinge, along the lug's axis.
  - **Notches.** They are milled to the square lug's own entry/exit envelope in 218's motion. The generator `scripts/generate-wool-comber-notch.mjs` adds `square218` to `src/data/wool-comber-notch.js`; 217's `profile` is unchanged.
    - Result: a flat root 0.13 long (the lug's flat end), flanks along the lug axis (which leans about 17° off the wheel radius, as G's release direction does), and r 0.027 root corners.
    - The flanks diverge about 5° outward, from the swing about the hinge.
  - **Clearance.** It is now the square tip outline's signed distance to F's outline (parity along the outward ray). The dwell ride height is solved for the lowest lug corner (0.0005 clear of the plain rim).
  - **Clearances (8192 samples).** Engaged: 0.0020 (the milling clearance). Riding: minimum 0.0005. Minimum overall: 0.0005.
- **Captures:** `after/n218.png` (plate, default, ±40 rotated, zooms of lug and notches at phases 0–0.99, rotated zoom).
- **Tests:**
  - `wool-comber-contact` (218 take-up now uses the square outline: bounded take-up and a tangential flank reaction both ways) and `movement-217`/`-218`: 20/20.
  - The ride test now checks the constant ride radius and 0.0005 grazing.
  - A new p99 test checks the flat root, the small corners, and the rocker at rest through lift and drop.
- **Residual:** the notch flanks lean with G's release direction and diverge 5°. They are square-cornered, not radial.

## 240: C's handle is a slim neck and knob
- **Verified.** The "chunky" curl was a filled wedge. C's upper polygon closed from its second serration tip straight down to the knob's top. That filled the space above the neck where Brown letters "C", and the traced top line ran 20–30 plate-local px below Brown's.
- **Fix** (`ratchet-stop-240-working-parts.js`):
  - The block's left edge now drops from the second tip to the handle's top line at Brown's foot (`blockFoot` [170,219]).
  - The handle's top line is retraced higher on Brown's line: knob top → (130,227) → (200,213) → (330,187).
  - The neck is Brown's width, and the knob, underside, serrated top, toe, hole, spring and motion are unchanged.
- **Captures:** `after/240-d|r|r2.png`, `a240c.png` (after) vs `b240c.png` (before), and `o240.png` (outline overlaid on the plate at ×4).
- **Tests:** `movement-240` and `ratchet-stop-240-working-parts`: 15/15. A new p99 test checks that the region above the neck is open and the knob, neck and block are solid.

## 236 (fork)

Fork of lane p99-b. Edits are confined to `alternatingTwoPawlContinuousRatchet` in `src/simulation/authored-intermittent-core.js`. The fork's `faceKnee` builder option and `movement.p99Study236` override hook, used only by its offline studies, were stripped at integration. The 236 tests still pass 14/14, and the other 18 IDs on the file hash identically to HEAD. Tests changed: `tests/movement-236.test.mjs` and `tests/alternating-pawl-236-contact.test.mjs`.

Scratch files are in `/dev/shm/p99/b/236/`. They include:
- the design studies: `evalp.mjs`, `nm.mjs` and the `nm*_*.json` results;
- the geometry hashes: `hash.mjs` and `hash-*.json`;
- the captures in `cap/`.

### Finding (verified)
The wheel stood for 0.42 of each lever cycle. The cause was lost motion after each reversal: b lost 46% of its swing and c lost 30%.

### What changed
- **Drive shares.** b and c no longer drive exactly one tooth each. They split the cycle's two teeth by leverage: b drives 1.175 teeth (`longDriveTeeth`) and c drives 0.825.
  - A returning pawl retreats by its own share plus the other pawl's share, which is exactly two pitches. So it still drops into a root.
  - With equal shares, b (on the longer lever arm, 84 px against 62 px) idled through spare stroke.
- **Lever law.** The hand stroke is now a rounded triangle wave, `asin(0.9 sin x)/asin(0.9)`: a steady rate with brisk, smooth reversals. `k = 0` is the old cosine.
- **Layout, re-solved** under the constraints below:
  - The lever's top is exactly Brown's drawn angle; p94 had it 2° above.
  - Amplitude 14.7° (was 19°).
  - b's end seat is at 147° (was 148°). c is three teeth back.
  - The face leans 21° (crest start 0.143 pitch; was 0.08, about 12°). This keeps it at or below the smallest pawl obliquity during drive (ψ 21.9°), so the drive load still seats the toe.
- **Result.** Standing is 0.310 of the cycle (was 0.421): b 0.135 and c 0.175.

### Why zero is impossible with Brown's straight pawls and saw teeth (numbers)
1. **Seating versus landing.** A seated toe is held by the drive load only while ψ ≥ λ through the stroke. ψ is the pawl line's lean from the tangent at the seat, and λ is the face's lean. For the toe to drop straight into its root at the reversal, the face must lean at least as far as the pawl at landing (λ ≥ ψ_land). Otherwise it lands on the next back and slides back after the reversal, which is the lost motion. ψ falls by about 30° over each stroke (b 57°→22°, c 61°→32°). So both conditions hold only if ψ is constant, and the lost motion is about h·(tan ψ_land − tan λ).
2. **Clearance of the tooth behind.** A straight bar of one breadth, centred on its eye with the toe at its corner, clears the tooth behind only when ψ_min is at least about 21°. With Brown's lengths (2.86 and 2.07), ψ at his noses is only 8.6° and 14.9°, so the bars cross the tooth behind. This is also why the pawls stay short: b 2.56 and c 1.38.
3. **Searches** (Nelder–Mead over end seat, bias, share and amplitude, with the face lean fitted each time):
   - Straight centred bars, drawn lever pose, self-seating: the floor is 0.305–0.31 under every variant tried. These were c 2 or 3 teeth back, 0 or 6° friction allowance, and a length-fidelity weight.
   - One tooth per cycle instead of two: 0.29, because the loss scales with the stroke.
4. **The option not taken.** Two-slope ("relieved") faces, meaning a short radial step up to a knee at 0.055–0.08 with the tooth above cut back along the landing arc, cut standing to 0.06–0.07 (0.003 with invalid seats). The cost:
   - The crests move 0.25–0.4 pitch forward, so the teeth read as pinwheel teeth (`cap/sheet-b.png`).
   - No straight bar centred on its eye then clears the tooth behind (bar offset ≥ 1.0).
   - It would need visibly bowed pawls (sagitta about 0.27 on b).
   - I rejected it as a larger departure from the plate than the dwell.

### Checks
- **Other movements unchanged.** The geometry and matrix hashes at t = 0, 0.37 and 1.3 are identical before and after for the other 18 IDs on this file: 63, 73, 82, 83, 121, 155, 206, 211–215, 225, 232, 233, 235, 237 and 241. 71 and 240 are edited by the parent lane.
- **Tests: `tests/movement-236.test.mjs` and `tests/alternating-pawl-236-contact.test.mjs` pass, 14/14.** They were updated to assert:
  - two teeth per cycle and b's 1.175 share;
  - the lever at the engraving angle at the top;
  - each half-stroke's travel equal to its share;
  - standing below 0.32;
  - a profile stride per tooth;
  - a continuity limit of 4e-6 (up from 2e-6), because a returning toe may still be sliding into its root as the lever reverses.
- **Contact numbers:**

  | Check | Value |
  |---|---|
  | Minimum seated moment | 1.31 |
  | Finite toe gap | ≤ 5.1e-5 |
  | Selected solids | ≥ −6.9e-8 |
  | Idle-track seat jumps | 2.3e-5 and 9.0e-5 rad |
  | Bar centred on its eye | within 1.3e-4 |

- **Screens:**
  - disconnected parts: 0;
  - coincident faces: the 3 pre-existing pairs (the p94 baseline was 3);
  - body intersections: worst 0;
  - loop seams: 0.
- **Captures:** `cap/sheet-n.png`. It shows the plate, the old default, the new default, rotated views (yaw ±40, pitch ±25), phases 0.25/0.5/0.75, and toe close-ups at phases 0, 0.1, 0.45 and 0.6.

## 076 (fork)

Lane p99-b (fork). No production change. Both ledger flaws were re-examined, and both are forced by the plate's geometry. The numbers are below. Scratch files are in `/dev/shm/p99/b/76/`:
- `exp.mjs`: a one-step-size dynamics harness over two strike cycles, using the production integrator.
- `env.mjs` / `env.png`: B's frame swept by the wheel over the baked cycle.
- `seat.mjs`, `rel.mjs`.
- Captures: `before/` (default, ±40/±25 rotations, bar close-up, seat zooms at phases 0.2–0.3) and `sheet76.png` (plate, views, envelope plot).

### Struck-arm kink (27.5°)

- **Brown's own layout does not work.** Stud D sits at mid-rim (787 px from the common axis), and the straight bar crosses that orbit between C (696 px) and its end (880 px). For the stud to pass, the bar's end must drop inside 722 px. That needs cos ψ ≤ 0.010 about C, a swing of about 101° from the drawn pose. B would be flung round.
- **Tip-only strike.** The reconstruction sets D's orbit so the stud catches only the arm's tip. With a concentric orbit, the tip's distance from the axis is symmetric about the radial through C. The stud therefore holds the arm from its rest angle ψr (measured from that radial) to past the mirror angle −ψr.
- **The conflict.** B's nose reaches the roots only when C→nose points at the axis (nose angle about 184° about C). The drive runs at nose angles 182°→162°. For a straight bar, that puts the struck arm within about ±12° of the radial during the drive.
  - A straight bar resting at restQ 0.48 has ψr ≈ 0.80 rad, so the swing is about 1.6 rad.
  - A straight bar with a low rest that keeps ψr small leaves B hung folded on a tooth back.
- **Simulations** (production integrator, dt 2.5e-4, two cycles):

| Design | Result |
|---|---|
| Straight, rest 0.48, overlap 0.05 | q reaches −1.38 (79° swing), overtravel 1.56 teeth, the tappet ends off its rest (q 0.32, B folded −0.93): fails |
| Straight, rest 0.48, overlap 0.02 | Contact projection infeasible at the strike: fails |
| Straight, rest 0 or −0.05, overlaps 0.006–0.02 | First strike counts. B then stays hung folded (α −0.55 to −0.61) and the second strike counts nothing: fails |
| Kink 0.40 | Works, overtravel 1.39 teeth (1.16 now) |
| Kink 0.30 | Works, overtravel 1.46–1.49 teeth, strike speed 2.6–4.1 rad/s (1.95 now), struck arm resting 10° off Brown's angle |
| Kink 0.20 | Overtravel 1.51–1.53 teeth |
| Kink 0.10 | Tappet does not return to rest; overlap 0.03 flings B (27 rad/s) |

- **Decision.** A smaller kink swaps one visible defect for worse ones: the ratchet visibly overshoots about half a tooth, the strike is harder, and the arm rests off the plate. The 0.48 kink is kept. Its rest pose also puts the struck arm exactly on Brown's drawn angle.

### B's wedge narrower than the valley

- **At the seat** (t 1.494 s of the 6 s strike, q −0.287), the back of the tooth below leaves the nose at −58.5° in B's frame. B's straight lower flank leaves the nose tangent at about −20° (−23° at 0.11 from the nose, −32.5° at 0.19 on the lobe curve).
- **Relative rotation.** While B is in contact, it turns 0.68 rad (39°) clockwise relative to the wheel, 0.405 rad (23°) of it after the seat. The wheel must advance 1.16 teeth. B's lever (0.884) is about equal to the contact radius, so B's rotation matches the wheel's and the relative rotation is about twice the advance.
- **The seat can't move to the end of contact.** The nose is closest to the axis (the root) at mid-contact. Only 0.44 tooth of advance happens before it, while the nose moves inward.
- **Envelope measurements.** Rigid-B poses (α = 0: approach, drive, rest) bring the lower tooth to −47° at 0.025 from the nose and to −39° at 0.1–0.2. The folded-return envelope reaches −41° and −36°.
- **Rotating the flank.** For a flank tangent to the nose circle, the clearance (rigid / folded) is:

| Flank angle | Clearance |
|---|---|
| −20° (now) | 0.0037 / 0.0017 |
| −26° | 0.0020 / 0.0001 |
| −28° | 0.0014 / −0.0007 |
| −32° | −0.0005 / −0.0049 |

  The binding points lie within 0.05 of the nose, so neither a concave flank nor a flank-contact dynamics change can buy more than about 6°. That would take the gap from 36° to about 30° at zero clearance, which is not visible.
- **Reshaping the tooth backs doesn't help.** Steeper backs near the root move the same swept points into B.

### Tests and screens

- `tests/jointed-tappet.test.mjs`: 13/13 pass.
- The production files, profile and dynamics lib are byte-identical to HEAD. The lib was edited temporarily for the experiments and then restored.
- No report or bake needed regenerating.

### Proposed ledger row

- **assessment:** minor (unchanged).
- **visibleFlaws:** "B's point seats in the root but is a narrower wedge than the valley (lower flank about 36° off the tooth back); the struck arm's kink is 27.5° where Brown draws the bar straight." (Unchanged; both forced.)
- **limits (append):** "p99: both residuals re-examined and forced. Straight bar: with Brown's C and a stud concentric with the axis, a tip-only strike holds the arm symmetrically about the radial through C, while B drives only near that radial. Straight bars either swing 79° with 1.56-tooth overtravel (rest 0.48) or leave B hung folded so the second strike loses its count (rest ≤ 0); kinks of 0.1–0.4 raise overtravel to 1.39–1.53 teeth and the strike speed up to 4 rad/s. Wedge: B turns 0.68 rad relative to the wheel while in contact, 0.405 of it after the seat, which is at mid-contact where the nose is closest to the axis. Swept tooth outlines come within 0.05 of the nose at −47° to −36°, so the lower flank can gain at most about 6° (to −26°, 0.0001 clearance) against the back's −58.5°."

## Screens and hashes
- **Disconnected parts:** 0 detached for 57, 71, 218 and 240's working parts. 240's 2 detached and 217's 1 are the same as HEAD (HEAD `git archive` copy in `/dev/shm/p99/b/head`). 57 has 11 near-miss pairs (HEAD 10), 2 of them short-of-pin as at HEAD. 0 slivers and 0 lips.
- **Coincident faces:** 0 pairs for 57, 71, 217, 218 and 240. The 236 fork reports its same 3 pre-existing pairs.
- **Loop seams:** clean except 217's 0.63 velocity kink, which is identical at HEAD.
- **Body intersections:**
  - 71, 217, 218 and 240: worst 0.
  - 57: the screen errors both here and at HEAD. This is pre-existing and unrelated; 57's own contact and bearing tests cover its solids.
  - 236: worst 0 (fork).
- **Byte-identity:**
  - The other 18 IDs routed to `authored-intermittent-core.js` hash identically to HEAD (vertex buffers and world matrices at 4 times).
  - 217's hash is identical to HEAD, so the notch data's `profile` is unchanged.
- **Tests:**
  - `band-epicyclic` 7/7; `movement-071` 6/6.
  - `movement-217`, `movement-218` and `wool-comber-contact` 20/20.
  - `movement-240` and `ratchet-stop-240-working-parts` 15/15.
  - `movement-236` and `alternating-pawl-236-contact` 14/14; `jointed-tappet` 13/13.
  - The `tests/models.test.mjs` blocks for 57 and 71 pass. 218 and 240 have no block there.
- **Reports:** no docs/validation report or bake fingerprints the changed files (`src/data/wool-comber-notch.js` was regenerated by its own script), so none was regenerated.
