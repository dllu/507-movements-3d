# One-way clutch family: 360, 361, 415

Primary references: [360](https://507movements.com/mm_360.html), [361](https://507movements.com/mm_361.html), [415](https://507movements.com/mm_415.html), and their original engravings. All three pages mark the animation unavailable (checked 2026-09-16); no official 2D timing oracle exists for this pass.

## Working corrections

**360 — oscillating loose drum and flywheel.** The former uniform output could move more slowly than the driving drum while the pawl purported to drive it. The output now coasts positively at a prescribed 0.20 rad/s, catches a finite radial tooth face, shares drum speed while locked, and releases when the drum slows to the coast speed. Capture occurs at 0.717572 s and release at 2.800380 s in each six-second beam oscillation. The continuous, unwrapped output advances six of sixteen teeth per oscillation; the marked wheel closes after 48 seconds. The speed change at capture is an ideal prescribed impact, not a solved inertia response.

The ratchet now has steep working faces and sloping overrun backs. Its bored hub attaches to the shaft; the drum carries a bored pawl hinge and a small rounded working nose. That rounding, hinge dimensions, and tooth phase are inferred mechanical geometry, not details claimed to be measured from the engraving. The finite arm clears the ratchet and drum groove. A real closed cord groove occupies the cord's axial plane; spokes reach the flywheel rim.

The free-overrun pawl path is baked by `node scripts/generate-oscillating-drum-pawl.mjs`. A bounded angular search finds a continuous finite-clearance path, with quarter-interval interpolation checks; playback only interpolates 1,537 stored angles. The exact locking interval is separate from that path. Public contact flags, tooth phase, speed and displayed angle share the corrected law. Flywheel inertia, spring forces, friction, impact loss and load are not integrated. This geometry does not establish passive pawl self-engagement under arbitrary loads.

**361 — axial pin clutch.** The old two pins shared an angular center while overlapping axially. The output now leads the pulley by `asin((0.06 + 0.06) / 0.36) = 0.339837` radians: the perpendicular finite pins meet on their sides. Circumferential mesh vertices are aligned to this contact normal, giving a shared rendered-surface witness. The original stopped axial engagement/disengagement and free-running schedule remain. Loose sheave/hub/flange passages and fixed bearing passages are real bores. The two sheaves have closed finite grooves around the belt cross-section. Shifting under load, impact synchronization, fork friction and belt tension remain outside this prescribed demonstration.

**415 — reversible internal friction pawls.** The old pawls sat ahead of the rim's entire working depth. The rim now reaches their common working plane, and each pawl has a finite inner-rim mating face and a bored eye on a lever-mounted pin. The opposite selection and output direction laws are retained. Shaft bores continue through the lever, hubs, spokes and web. White contact spheres that intruded into the rim are hidden. Friction, cord tension, self-wedging and load capacity remain unqualified; this is selected finite fit plus prescribed reversible motion.

All three retain their scene and geometry buffers during playback, remove fog/ground, use bounds sampled through the full authored cycle, and request a minimum twelve-second display cycle. Root performs the integrated source/default/oblique browser review.

## Focused evidence

Run:

```sh
node --test tests/movement-360.test.mjs tests/movement-361.test.mjs tests/movement-415.test.mjs tests/one-way-clutch-working-solids.test.mjs
```

All 35 checks pass (26 legacy and nine focused regressions). The finite tests cover 257 poses of 360 nose/arm versus working ratchet and nearby drum surfaces; exact locked speed/contact; repeated cycles and the marked 48-second closure; full-cycle 361 pin separation and actual contact witnesses; finite belt cross-sections and journal bores; both 415 pawl faces throughout reversal; and the bored hinge/hub/web/spoke interfaces. They also check retained buffers and public state consistency.

Measured 360 locked nose/ratchet gap is about `1.1e-7`; arm/ratchet minimum is about `0.00367`. The 415 inner-circle faceting produces at most `1.52e-5` sampled overlap, tested with a separately declared `1.7e-5` tessellation tolerance. Other selected clearance checks use `2e-6`. These are bounded rendered-solid samples and explicit contact witnesses, not an exhaustive collision proof or a load simulation. Cord attachments, remote frame joints and unsampled contact extrema are not globally qualified by this suite.
