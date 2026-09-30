# Pass 111, lane a: 027 central nub, 077 pawl physics

Scope: the user's two items. 027 had "a little nub in the middle recently which collides with the rollers" (screenshot `/dev/shm/p111/img/123.png`). 077's "two arms are jerky and don't behave physically when in fact they should gently fall down just due to gravity to the next pin". Scratch files and captures are in `/dev/shm/p111/a/`. No git writes.

## 027: central hub removed

- **Verified:** p109 added a lathed "domed central hub with knob" (`authored-gears-core.js`, r 0.14, top 0.29) on the groove floor. The rollers do not stop 0.18 from the axis, as the p109 note assumed: their drums sweep across the centre (closest drum vertex < 0.05 from the axis). Before the fix, `screen-body-intersections --ids=27 --samples=129` reported worst solid **0.1394 (domed-central-hub-with-knob × solid-pulley-drum)**.
- **Plate:** Brown draws a small knob at the centre. Because the rollers pass through that spot, it cannot be kept as a solid. A knob shrunk far enough to clear them would sit inside the drums' swept disc anyway, so shrinking was not an option either.
- **Change:** the hub is removed and replaced by a comment. The centre is now the plain groove floor where the six channels cross.
- **After:** `screen-body-intersections --ids=27 --samples=257`: worst solid **0.0000**. Disconnected-parts screen: 0 detached. Coincident faces: 0. Loop seams: clean.
- **Test:** new test in `tests/opening-gear-contact.test.mjs`. Over 256 phases it checks that no wheel mesh has the hub role and that no roller vertex enters any wheel solid by more than 1e-6. It also asserts the drums pass within 0.05 of the axis, which records why no knob can stand there.
- **Captures:** `k27_grid.png` (default, yaw ±40, pitch ±25, close-ups); `c27_grid.png` (8 phases, zoomed on the centre at yaw 35°, the user's viewpoint). The centre shows no nub, and the carrier and rollers pass over the bare floor.
- **Reports:** the file hash of `authored-gears-core.js` is fingerprinted by three reports. They were regenerated with their scripts, and only the hash changed:
  - `191-196-201-contact.json`: 513 poses.
  - `200-226-bevel-solids.json`: 33 poses.
  - `202-264-worm-solids.json`: 33 poses, via `POSES=33`, because the script's default is 17.
  - The 205/195/207 reports hash only their own functions, which are unchanged.
  - The report tests pass (34/34).

## 077: physically simulated pawls

### What was wrong
- The old bake came from an 8 s physical cycle played in 4 s, and it drove the lever with a warped clock. The lever dwelt, then whipped back at up to 1.27 rad/s (display), with kinks at each reversal. The display speed-up doubled time and quadrupled apparent gravity, so every pawl drop became a 0.1 s snap.
- Measured by dense sampling of the old and new samplers (8000 samples per cycle and 240 frames at 60 fps):

  | | old | new |
  | --- | --- | --- |
  | max lever speed (rad/s) | 1.27 | 0.385 |
  | max upper / lower pawl speed (rad/s) | 2.56 / 3.23 | 1.26 / 1.59 |
  | max step per 60 fps frame, upper / lower (rad) | 0.035 / 0.036 | 0.017 / 0.023 |
  | pawl velocity reversals above 0.05 rad/s, upper / lower | 7 / 8 | 4 / 4 |

  In the new motion the four reversals per pawl are ride up, fall, land and push.
- The old bake also predated the current C-shaped hook heads.

### The new simulation
- **Code:** `scripts/lib/alternating-peg-gravity-sim.mjs` is a planar rigid-body model. It is a validated rigid-body integration with contacts, not MuJoCo, because the non-convex C hooks against round pegs are exactly and cheaply expressible analytically.
- **Lever:** q(t) = 0.11 + 0.245 sin(2πt/4 + ψ), with q(0) = 0 on the rising stroke. This is Brown's drawn pose, and the amplitude and centre are unchanged.
- **Pawls:** each is a free rigid body about its pin on the lever. It has its true pivot inertia and centroid (from `familyMass` of the rendered pawl) and gravity 9.81, taking the wheel radius as 1 m. It feels the d'Alembert load of the moving pivot and very light pivot damping.
- **Wheel:** the same density, a 200 N·m dry-friction load, and light viscous damping.
- **Contacts:** pawl solid against all 24 pegs, with an exact analytic signed distance. The solid is the union of:
  - the socket and rim annular sector,
  - the two round lip caps,
  - the shank,
  - the eye.

  This agrees with the rendered outline to 4.8e-6 outside the solid. The contacts are velocity-level impulses solved by projected Gauss–Seidel:
  - zero restitution, so nothing bounces;
  - lubricated shear (viscous, capped at Coulomb μ 0.2), because plain Coulomb friction gave a 70 Hz stick–slip micro-chatter in the socket;
  - speculative gaps with a 1e-5 skin, so there is no penetration;
  - wheel stiction as a true impulse.
- **Integration:** dt = 1e-4. dt = 5e-5 gives the same trajectories.
- **Behaviour:** started from the drawn pose, the run locks after one cycle into a steady cycle that advances exactly one pitch. The cycle repeats to 1e-10–1e-16. Amplitudes of 0.2–0.245 all give the same one-pitch lock.
  - Each pawl, once released, falls freely under gravity. It either slides over the next peg's crown and drops into its socket, or lands on the next peg. It is then pushed.
  - Wheel motion is smooth while driven. The only abrupt events are the physical take-up impacts, when the pawl meets its peg after the free travel.
- **Bake:** `scripts/bake-alternating-peg-gravity.mjs` writes `src/data/alternating-peg-profile.js`: one steady cycle at 1 ms, 4001 rows, 297 KB (down from 1 MB).
  - The seam is closed exactly.
  - Each row is checked against the rendered pawl outlines and the true peg circles. The minimum clearance is +7.2e-6 and no row needed correction.
  - Physical time equals display time (4 s), so gravity reads at its true rate.
  - The file records the parameters and SHA-256 provenance of the simulator, the bake script, the geometry and the factory. `--check` verifies that provenance.
- **Motion sampler:** the `first` startup table is gone, so every cycle is the steady one with the wheel one pitch further on each time. Seeking, speed scaling and seams are unchanged.
- **Start pose:** at t = 0 the lever is in Brown's pose and both pawls are seated on their pegs. The wheel, pegs included, sits 0.27 pitch (4.1°) past Brown's peg phase, because that is where the steady cycle has it when q = 0.

### Verification
- **Screens:** body intersections at 257 samples, worst solid 0.0000. Disconnected parts: 0 detached. Coincident faces: 0. `check-loop-seams`: 0 seams, 0 pops.
- **Tests:** `tests/alternating-peg.test.mjs`, 10/10. The three motion tests were rewritten:
  - The lever equals the sinusoid at 4000 samples. There is one pitch per cycle, and the wheel rests 40–55% of the cycle. Rollback is under 1e-5 rad: a landing pawl nudges the wheel back at most 3e-6.
  - Each pawl's fastest motion is a fall of 0.5–2 rad/s, with clearance above 1e-4 to every peg 20 ms before it lands. No single step exceeds 0.01 rad, and there are no more than 4 velocity reversals.
  - At t 0.8 (upper) and 2.6 (lower), the driving peg bears on the socket back (offset 0.009 ± 3e-5 from the socket centre). There is no intrusion, and the pawl penetrates the peg when the wheel is turned back by 1e-4.
  - The solid-families test (all 20 poses) and the geometry tests are unchanged and pass.
- **Captures:**
  - `a77_side.png`: plate beside the default view.
  - `a77_strip.png`: 16 phases.
  - `falls.png`: 8 frames 50 ms apart through each pawl's fall.
  - `r77_grid.png`: yaw ±40, pitch ±25, a close-up and the side view.
  - `baked_curves.png` against `old_curves.png`: the lever, wheel speed and pawl angle and rate traces.
  - `b77_strip.png`: the old strip, as "before".

### Residuals and limits
- The wheel rests about 49% of the cycle. It stops at each lever reversal and during the take-up, which is inherent to a sinusoidal input. The old warped clock cut the rest to about 17% only by making the lever whip. The take-up ends in a real impact that jumps the wheel to speed.
- The spoked wheel starts 4.1° turned from the plate, as explained under "Start pose".
- Superseded historical tools now fail, because they read the removed `first` table:
  - `scripts/integrate-alternating-peg.mjs`
  - `scripts/export-corrected-alternating-peg.mjs`
  - `scripts/probe-alternating-peg-production-*.mjs`
  - `scripts/record-alternating-peg-integrated-review.mjs`

  No test runs them.

## Proposed ledger rows

- **027:** assessment `reasonable`; visibleFlaws empty; mujoco none. Limits: replace "p109: a domed central hub with knob." with "p109's domed central hub was removed in p111: the rollers sweep through the centre (drums within 0.05 of the axis), so Brown's central knob cannot stand there (0.139 solid overlap before; 0 over 256 phases after)."
- **077:** assessment `reasonable`; visibleFlaws empty. Set mujoco to mode `none`, evidence `scripts/lib/alternating-peg-gravity-sim.mjs`, note "Offline planar rigid-body impulse simulation (gravity pawls, inelastic lubricated peg contact, dry-friction wheel) baked to src/data/alternating-peg-profile.js; no MuJoCo." Limits:
  - Replace "Small rollback and startup take-up remain;" and "The recorded motion predates the new heads (same seat and contact, all sampled poses clear)." with "p111: the lever is one sinusoid (no whip). Both pawls are simulated rigid bodies with their real pivot inertia that fall freely under gravity onto the next pin and are then pushed; this was baked from a steady, exactly one-pitch cycle at 1:1 time against the current C heads (clearance ≥ 7e-6, no correction needed). The wheel rests about 49% of the cycle (at each lever reversal and during take-up, ending in a real impact). The drawn pose starts with the wheel 4.1° past Brown's peg phase. Density, load, lubrication and scale (wheel radius 1 m) are assumptions."
  - Keep the rest.
- **Full suite:** `node --test tests/*.test.mjs`: 4931/4931 pass.
