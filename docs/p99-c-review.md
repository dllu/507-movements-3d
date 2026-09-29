# Pass 99, lane p99-c: 80, 132, 134, 137, 146, 159, 247

Reviewer: Claude Opus 5.5, pass-99 lane c. Scratch captures are in `/dev/shm/p99/c/` (`*-b-*` before, `*-a-*` after, `*-tile.png` beside the plate `public/engravings/mm_NNN.png`).

## 132: bed block (fixed)
- **Finding, verified.** The bed was a 0.35-high block whose top is Brown's bed line (raster 482). It floated 0.17 above the ground, and a separate "centre anvil foot" sat behind it at the plinths' level. Brown draws one low block standing on the hatched floor (rows 481–503) between the plinths.
- **Change** (`twinObliqueRodTogglePressMotion` in `authored-cranks.js`):
  - The ground is now Brown's floor line, 0.34 below the bed top (raster 503; it was 0.52).
  - The bed spans from the ground up to the bed line.
  - The centre foot is removed.
  - The two plinths (0.2 high) stand on the same ground, and each column sinks 0.02 into its plinth.
- **Captures.** `132-a-tile.png` shows the default, yaw 40/pitch −15 and side views beside the plate. `132-b-tile.png` is the before set.
- **Tests.**
  - `tests/toggle-press-frame.test.mjs` now requires two plinths, no centre foot, a bed whose bottom is on the plinths' ground, and a bed top at `bedTopY`. It passes.
  - The `models.test` 132 block passes.
- **Screens.**
  - Coincident faces: 0. Seams: 0.
  - The disconnected-part screen still lists the bed as "floating", 1.19 from a plinth. It stands on the implied ground: 132 hides the ground plane, so the screen has no floor mesh to join it to.
- **Reports.** `authored-cranks.js` is fingerprinted by the 146, 156, 157, 158, 159 and 160 reports. They were regenerated with their scripts. Only the hash lines changed, and pose counts are unchanged. `140-dimensions.json` has a `sourceCommit` field and was not touched.

## 134: rope band (fixed)
- **Change** (`octagonal-rope-cage.js`):
  - The rope is wound four turns side by side round the eight beam noses. The caption says "once or more times".
  - It keeps the octagonal helix, and the same brown laid rope of radius 0.05.
  - The lead per turn is one rope diameter plus 0.006, so adjacent turns never touch.
  - The drum is 0.56 wide (was 0.5), so the band (half-width 0.212 plus the rope radius) fits between the end wheels. The guides sit at ±0.212.
  - Rotated and side views now show Brown's broad wound band. From the default view it reads as a thicker band.
- **Captures.**
  - `134-a-tile.png`: default, rotated and close-up views beside the plate.
  - `134-a-side2.png`: a side view showing four turns between the wheels, and an under view.
- **Tests.**
  - The `models.test` 134 block (renamed "four turns side by side") passes. It asserts 4 turns, a lead of more than 2r + 0.004, and a band inside the wheels, and it keeps every octagon, feed and seam check.
  - The seam tolerance is 4e-4 (was 2e-4). A turn later the nose arcs are resampled slightly differently, which is 0.03 engraving px.
  - `single-wrap-drum.test.mjs` now expects 8 × 4 ± 1 beam pitches. It passes, and so does `rope-drum-hardware`.
- **Screens.** Coincident faces: 0. Disconnected parts: 0. Seams: 0.

## 137: dimples kept (fixed)
- **Why the earlier cam lost them.** It fitted a radial Fourier edge directly to the traced edge, then projected it for conjugacy. That averaged every dimple against the lobe half a turn round, and left three convex lobes.
- **New design** (`expansion-eccentric-profile.js`):
  - The upper roller's pitch curve is designed first. Its polar radius about the shaft uses only the constant term plus odd harmonics (1, 3, 5 and 7). So pitch radius(θ) + pitch radius(θ + π) is constant, and both rollers can bear at once.
  - The cam edge is the inner envelope of the 31 px roller rolled round that curve, so it can always be followed.
  - The harmonics were fitted, least squares, to Brown's visible edge landmarks.
- **Result.**
  - The landmarks fit to 3.62 px RMS and 7.9 px maximum. The old cam gave 3.93 and 8.9.
  - Three true concave hollows appear: at the upper left, the lower left and the lower right. They make up 23% of the edge, with a concave radius of at least 122 px, so the 31 px rollers roll through them.
  - The pitch diameter is 218.3 px (centre spacing 220.1). With the pivoting fork, the lower roller runs 0.07 to 1.65 px clear. That is 0.07 to 1.42 px in the bake; it was 0.06 to 1.33.
  - The edge is stored as a 40-harmonic radial series, within 0.035 px of the envelope.
- **Rebake.** The four probes (coarse, time-refined, mesh-refined and fine) were rerun, then `compare-expansion-eccentric-prototype` (fine difference 0.084 px) and `bake-expansion-eccentric`.
  - The loop starts at cam angle 2e-5.
  - The seam is 0.020 px in position and 0.24 px/s in velocity.
  - Penetration is 1e-5.
  - Upper-roller slip is 0.29 px/s.
  - `137.json.gz`, `137.provenance.json` and `docs/validation/137-physics-prototype.json` were regenerated.
- **Captures.** `137-a-tile.png` shows phases 0, 0.33 and 0.66, a rotated view, the plate and the before view. `137/ov2.png` overlays the new edge on the plate.
- **Tests.**
  - `expansion-eccentric-profile` now requires at least three concave runs, more than 15% of the edge concave, and every concave radius above 100 px. The play limit is now 1.7.
  - `expansion-eccentric-bake`: the lower gap limit is now 1.5.
  - The `models.test` 137 block passes, and so does `mujoco-baked-loops`.

## 247: reset lift shortened (partly fixed; the lift is still undrawn)
- **Proof that nothing drawn can lift the weight.**
  - Lying on the bottom, the weight's lower opening is about 0.07 above the bottom, but the probe foot hangs 1.23 below the catch seat.
  - So for the catch to get under the weight, the foot would have to be 1.16 below the bottom.
  - The foot is narrower than the bore, so it cannot lift the weight either.
  - When the rod rises out, the sprung catch passes the top rim with its seat facing up, so it cannot lift the weight.
  - A lift of at least 1.37 by something undrawn is therefore unavoidable for reuse. The user asked for exactly that: lift it slightly and re-engage from above.
- **Change** (`authored-sounding-weights.js`, plus exact slide rates in `release-mechanism-working-parts.js`):
  1. The rod rises out of the spent weight.
  2. It is lowered back into the weight where it lies on the bottom. The top rim cams the catch in, and the catch rides down the bore. The rod stops with the foot 0.12 above the bottom.
  3. Only then is the weight slid straight up the rod that runs through it. It passes the catch slowly and the catch springs out under it.
  4. The weight rises 0.08 above the seat and is set down on it at rest.
  5. The rod carries it into Brown's pose.
- **Effect.** The weight is off the bottom and not on the catch for 1.6 s (9.7–11.3 s). It was 3.9 s, including a 2.8 s motionless hover. It is moving the whole time and guided by the rod, and it never hangs still.
- **Captures.** `247-a-tile.png` shows 6.5, 8.3, 9.6, 10.2, 10.6, 11.0, 11.4 and 12.2 s, plus a rotated view at 10.4 s. `247-b-tile.png` is the before set.
- **Tests.**
  - `movement-247.test.mjs`: 9 pass. The p99 reload test checks that:
    - the weight is on the bottom while the rod enters;
    - the weight moves at every sample of its off-bottom interval, which is under 2 s;
    - the catch cams in and springs out without cutting the weight;
    - the probe never touches the bottom;
    - the weight is set down at rest and the loop closes.
    The rate test moved its samples off the two rim windows, where the catch angle is limit-bound.
  - `release-mechanism-working-parts`: 5 pass.
- **Screens.** Coincident faces: 0. Seams: 0. Disconnected parts: 0 detached. Two transient near-miss groupings of the bottom and the grounded weight are reported, which is the known behaviour.

## 80: shorter, rarer reset (partly fixed; the reset is still undrawn)
- **Why it cannot be removed.** Brown draws no way to release both hooks: both torsion-sprung pawls always bear into the teeth. A lever-driven release would need an undrawn cam or stop. So a looping animation still needs a let-down that nothing drawn performs.
- **Change** (`scripts/bake-crossed-rack-mujoco.mjs`, `crossed-rack-motion.js`):
  - Three lifting swings instead of two. The rack rises 5.95 pitches; 16 teeth allow it.
  - The loop is now 32 physical seconds (16 displayed).
  - The reset is shorter and gentler:
    - the rack is lifted 0.10 off the hooks (was 0.14);
    - it is let down six pitches over 2.75 s physical;
    - it is released and reseated.
  - All of this takes 4.7 of 32 physical seconds (15%), against 5.4 of 24 (22.5%) before. The rest of the lever's fourth swing runs free.
  - The display rack speed stays at or below 1.89/s, and no step exceeds 0.008 at 240 Hz.
  - It starts seated at Brown's pose, and the loop closes with a position residual of 3.5e-7.
  - The `returning` flag now reads the profile's `liftEnd`.
- **Rebake.** `src/data/crossed-rack-profile.js` was regenerated.
  - Periodic residual: 3.5e-7 in position.
  - Minimum contact gap: 4.8e-4.
  - Rendered overlap: 0.
  - MuJoCo 3.13.0; the package lock is unchanged.
- **Captures.** `80-a-tile.png` shows 8 phases, including the reset at 0.66–0.86 and a rotated view. `80-b-tile.png` is the before set.
- **Tests.** `crossed-rack.test.mjs`: 9 pass. The loop is 16 s. It checks 2 pitches for each of three swings, the rollback, a reset limited to 4.7 s that lets the rack down more than 5 pitches, and the clearance samples through 16 s.

## 146: loop width (forced; not changed)
- **Proof.**
  - The yoke slides only vertically. The wrist is on Brown's crank circle, R = 93.3 px.
  - The loop's centre line must reach exactly ±R:
    - it must reach at least R to hold the wrist at 3 and 9 o'clock;
    - it can reach no further, or the wrist would have to cross the island.
  - Brown's loop ends are at −110 and +125 px.
- **Alternatives tried.**
  - The largest crank the drawn disk allows (radius 119 px, wrist radius 11 px) is 108 px, and that moves the drawn wrist 15 px.
  - Widening only the outer end walls would leave the wrist without its outer wall at the top half of each end. Under gravity, that wall carries the yoke.
  - Thickening the end walls would break the constant 30 px wall that Brown draws.
- **Status.** It is kept as is: the frame is 270 px wide against Brown's 327. The residual is stated.

## 159: slack cord (forced; not changed)
- **Proof.**
  - Brown's pin is 75 px from the disk centre and 73.6° off the direction to the guide. The guide is 230.6 px from the disk centre.
  - The pin-to-guide distance ranges from 155.6 to 305.6 px. At the drawn pose it is 221.4 px.
  - The treadle eye has only 9 px of drop left before the tip meets the floor, but the cord needs 66 px.
- **Alternatives.**
  - Making the drawn pose the nearest approach means rotating the drawn pin by 74°. The full 150 px taut stroke then lifts the eye 52° above the pivot, and the tip enters the guide pulley at raster (276, 117). This is true whatever the start angle.
  - A taut cord needs the throw cut to at most about 46–60 px (Brown draws 75) as well as the pin rotated.
  - Keeping the drawn pin angle and still taut needs a throw of at most 12.5 px.
- **Status.** Every option changes two drawn features. The honest slack is kept.

## Claims and deferred
- **Claimed:**
  - `authored-cranks.js`, `toggle-socket-disk.js` (unchanged), `framed-yoke.js` (unchanged)
  - `octagonal-rope-cage.js`
  - `authored-sounding-weights.js`, `release-mechanism-working-parts.js`
  - `crossed-rack*.js` and `crossed-rack-profile.js`
  - `expansion-eccentric-profile.js`
  - `cord-treadle-motion.js` (unchanged)
  - the directories `mujoco-expansion-eccentric`, `mujoco-cord-treadle` and `mujoco-crossed-rack` (all unchanged)
- **Deferred, file owned by p99-d.** `src/data/display-profiles.{js,json}` should be re-measured for 80, 132, 134, 137 and 247 with `node scripts/measure-display-profiles.mjs 80 132 134 137 247`:
  - 132's floor rose 0.18;
  - 80's rack rises higher;
  - 134's band is wider in z;
  - 137's cam changed;
  - 247's timeline changed.
