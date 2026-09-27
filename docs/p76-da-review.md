# Pass 76, lane da: confirmed disconnections in 86, 145, 170, 273, 373 and 454

This pass fixes the confirmed visible disconnections from the pass-74 screen (`docs/p74-disconnected-screen.md`).
Each fix was checked with `node scripts/screen-disconnected-parts.mjs --ids=… --jobs=1`, which loads the production
model through `model-loader.js`, including baked routes and source presentation. Every confirmed gap listed below
now reads as joined.

## Per movement

| ID | Confirmed gap (p74) | After | Change |
|---|---|---|---|
| 86 | post B beside the plinth, 0.079 | joined (no detached parts) | `pump-catch-complete-geometry.js`: the plinth slab's left end runs to post B's right face (`min(base.left, post.right)`). Brown draws the slab abutting the post on the ground line. |
| 145 | wrist bearing ring 0.068; pin rings 0.025–0.032 | joined (no detached parts) | `authored-linkages.js` (145 rocking-beam factory only). Each pin's retaining torus has a bore equal to the 0.105 pin, so it grips the pin. `seatPinRing` places each ring on the front face of the frontmost link it retains, and the pin ends flush in the ring. The loose `bearing-ring-at-moving-standard-wrist` spacer is removed in presentation: Brown draws no ring between the standard and the rod. The standard's upright now runs down into its foot channel and stands on the channel floor. Before, it hovered over the open slot, a 0.025 gap that the screen also flagged. |
| 170 | bow short of the right arm, 0.112 | joined (no detached parts) | `mujoco-crossed-governor/solids.js`. The bow was a flat band 0.22–0.32 in front of both arm planes, touching neither arm nor the spindle. It is now a band spanning both arm planes (z ±0.20), built from seven stacked layers. The spindle passes through a square seat in its middle, where Brown draws the hatched band. Each arm swings radially through its own window in the bow. A window covers the baked spread range 0.517–0.761 rad, plus the arm's half-width and a 0.012 rad clearance. The bow's ends were extended from ±0.66 to ±0.86 rad so that the windows stay inside it. Rebaked with `node scripts/bake-crossed-governor.mjs`: the motion is unchanged and only the serialized geometry changed. `docs/validation/170-solid-clearance.json` and `170-baked-solid-clearance.json` were regenerated: 129 poses, no intersections. |
| 273 | front retaining rings, 0.035 | rings joined | `authored-rhombus-linkages.js` (`makeCornerPin`). The ring's bore equals the pin, the ring seats on the front link's face (z 0.30), and the pin ends flush in the ring. |
| 373 | wagon body above its chassis, 0.045 | joined | `authored-rolling-friction-experiments.js`. The bed and sides are lowered by 0.045, so the bed sits on the chassis top. The loads settle to the bed as before. |
| 454 | fulcrum ring, 0.015 | joined | `flexible-pump-working-parts.js` (454 branch only; the 453 collar is unchanged). The collar grips the 0.21 fulcrum pin and seats on the lever's front face (z 0.115). The fixed pin ends flush in the collar. |

## Fresh captures

The captures are in `/dev/shm/p76-da/{before,after}/ID-default.png` and `ID-oblique.png`. There are also rotated and
phase views, `after/ID-v0..3.png`: ±60° about the vertical, top and back, at phases 0.2/0.5/0.7/0.9. Close views of
170 at 35 units (fov 8°) show both arms passing through their windows in the bow from the front, back, top and side.
The default view of 170 still reads as Brown's bow lying in front of the arms. Its ends now reach about 0.3 rad past
the arms at the drawn pose, where Brown's reach about 0.1 rad past them. This is needed because the baked spread
reaches 0.761.

## Intersections (`show-body-intersections --spacing=0.01 --samples=129`)

- 145, 273, 373 and 454: no solid pairs; only fluid and deforming entries, as before.
- 170: the tool screens the registry model, not the baked route. The baked production solids were checked by
  `review-crossed-governor-baked-solids.mjs`: 129 poses, 2229 pairs, no intersections.
- 86: the full-density run exhausts the 4 GB heap, at both 0.01 and 0.02 spacing. At 0.03 spacing and 33 samples
  there is only the zero-depth working contact `fixedTripStop x hookedCatchB`.

`scan-bad-faces` finds nothing new on the changed parts. The only new entry is a same-look coplanar pair between
373's wagon bed and its sides.

## Residuals left alone (out of scope)

- 273: the four split guides keep a 0.025 running clearance round their rods (near-miss).
- 454: the delivery branch passes through its chamber port with about 0.023 clearance.
- 373: the tether's end next to the indicator is open, and the driving-shaft stub stops 0.056 short of the pulley web.
