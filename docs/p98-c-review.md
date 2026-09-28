# Pass 98, lane c: eye-centring fixes

Source: the p97 eye-centring audit (`/dev/shm/p97/eyes/report.md`). Each flag was checked in the default view, a view looking along the pin, and ±40° yaw / ±20–25° pitch views. It was also checked by sampling the part's outline radius d(θ) about the pin in the pin's own frame (`/dev/shm/p98/c/probe.mjs`). Captures are in `/dev/shm/p98/c/{before,after}/`. The comparison sheets are `after/sheet-<id>.png`, which show the before row above the after row.

## Fixed

- **348 (`authored-double-stroke-slots.js`).** The rounded lower end of rod B was centred 0.5 source units below pin C1 (offset 0.089 on R 0.18). The rod now ends at C1 plus its half-width (`sourceRodBottomY = -(65 + 1)`), so the end is a half-circle about the pin. d(θ) is 0.180 all round.
- **161 (`mujoco-ball-governor/solids.js`, rebaked `161.json.gz`).** The head was a faceted traced polygon, and the top pins sat off-centre in its ears (0.42–0.49 R). The head now has three parts:
  - a stadium of radius 0.165 between the two top pins, so both ears are arcs concentric with the pins;
  - Brown's raised top over the spindle;
  - the tapered lower tab.

  The bake was rerun with `scripts/bake-ball-governor.mjs`. Motion, closure and increment are identical; only the solids hash, the bytes and the bundle sha changed. `docs/validation/161-solid-clearance.json` was regenerated with the same poses and status.
- **190 (`authored-clamps.js`).** The shoe end of the holder cheek was an egg shape, with radius 0.39 below and 0.48 to the left of the shoe pin. The traced end, from the first to the last traced point within reach, now lies on an arc of r 0.44 about the pin. It blends back into the traced edges over 10 points on each side. d(θ) is 0.440 over about 220°.
- **164 (`knee-press.js`).** The changes to the lever and cheeks are:
  - The curved lever's knee lobe is an arc of r 0.42 about the knee pin; it was offset 0.21 R.
  - The lever's top end is an arc of r 0.28 about the upper pin.
  - Both arcs blend into the traced edges over 0.15–0.2 of arc length.
  - The upper cheeks are rebuilt as the convex hull of an r 0.45 circle about the upper pin and Brown's two top corners: straight sides and a concentric arc, replacing the traced egg.

  `docs/validation/164-solid-clearance.json` was regenerated with the same poses and status.
- **345 (`authored-oscillating-engines.js`).** The round top of the lower bearing block was centred 0.2 source units (0.12) below crankshaft O. It is now concentric with O, and its r 0.48 matches the crank end, as the ledger's own limits note says.
- **307 (`authored-three-legged-escapements.js`).** The suspension cock behind the pendulum was a box centred 0.15 above the pin. It is now one flat plate with a half-round lower end of r 0.35 about the pin and straight sides rising 0.6.
- **165 (`mujoco-wave-cam/solids.js`, rebaked `165.json.gz`).** The output pin moves transversely by -0.068 to -0.001 in the bake, but the upright's eye was centred at 0, an offset of up to 0.068 (0.21 R). The eye and bar are now centred at -0.0345, the middle of that travel, so the worst offset is 0.034 (0.10 R). The slot keeps its -0.12 to 0.015 allowance. With a slot trimmed to the travel, the native-cycle review found pin/upright overlaps, so the allowance stays. `docs/validation/165-solid-clearance.json` was regenerated with the same 150 poses. Its one "unexpected" pair, `wavedCam/rollerWheel` at depth 0.0079, is reproduced exactly with the HEAD solids.js, so it predates this change.

## Verified, no change

- **278.** The pawl eye is exactly concentric: d(θ) is 0.145 over its round half. The flag came from the bar's shoulders. The apparent offset in the close-up comes from perspective: the pin stands 0.03 proud and the default camera is slightly oblique. The axial view (`before/s278ax.png`) is concentric.
- **482.** Lever d's end is concentric (d(θ) 0.095). The flagged mount is the slotted hanger, a slot and not an eye.
- **171.** The mount is a curved die block that slides in the link slot, not an eye. Its bore is concentric.
- **310.** The pins and legs are both rigid on `wheelRotor`. A pin at the root of a leg is not an eye joint, and the "phase dependence" is an artefact of the side-on axis.
- **493.** The pin passes through a rectangular block. The side arm's round end is concentric (a bored link rod).

## Screens and tests

- Screens for 161, 164, 165, 190, 307, 345 and 348:
  - disconnected parts: 0 detached and 0 slivers. 161 has 2 lips, the same count as at HEAD.
  - coincident faces: 0.
  - body intersections: 161 is 0.2347 and 165 is 0.275, identical to HEAD.
  - loop seams: 0.
- Tests: knee-press, ball-governor (solids and baked), wave-cam (all five), movement-190, 174, 180, 306, 307, 344, 345, 348 and 278, clamp-190/tailstock/working, three-leg-dead-rest, p59-visual-fixes, engines-326-345-clearance, single-clamp-baked, mujoco-baked-loops and authored-loader all pass. The `models.test.mjs` blocks for 161, 164, 165 and 174 pass.
- 180 fingerprints `authored-clamps.js`, so its chain was rerun. `qualify-single-clamp-cycle` → `probe-single-clamp` → `bake-single-clamp` produced identical results, with only the hashes and UUIDs changed. `review-single-clamp-existing` and `review-bench-clamp-existing` (174) were rerun with the same poses. The packaged `tests/e2e/single-clamp.spec.mjs` was rerun against a scratch build and passes, and `180-browser.json` was updated.
- `docs/validation/165-projection.json` was left as it was, even though it fingerprints `mujoco-wave-cam/solids.js`. It was already stale before this pass: it pins the `profile.js` and `solid-surface.mjs` hashes from ec466a4. Rerunning it now reports a 37.8 px error, which comes from the later `profile.js` correction (b808131) and not from this change. The projection does not include the upright. This needs a separate decision.
