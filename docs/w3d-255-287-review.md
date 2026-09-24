# Pass-51 wave-3 lane w3d-255-287 review

Reviewer: Claude Opus 5.5. Date: 2026-09-23. Each movement's default render was compared side by side with Brown's engraving, before and after, using `scripts/review-movement-source-views.mjs`. Intersection screens used `scripts/show-body-intersections.mjs ID --spacing=0.01 --samples=129`.

| ID | Change | Worst unintended overlap before -> after | Intersections |
| --- | --- | --- | --- |
| 255-259 | Straight edge-on elevation (`cameraDirection (0,0,1)`, fov 8), which exposes both hub collars and the groove outlines. Undrawn white face and rim speed indices removed. 255's dark flange rings no longer stand past the flange edge. | 0 -> 0 | Sampled-clear: single rigid rotor. Bores (0.008 clearance) are covered by `pulley-family-review.test.mjs`. There is no rope or belt to probe, because the plates draw none and none is rendered. |
| 261 | Parts reordered front to back. Link C is in front of B, and the crank pin (radius 0.11) runs from B's front face to C. The drum, cord D and E's tread sit behind B. B's bearing arm and gusset moved back. Arm A crosses in front of E. | crank pin in B 0.12 -> 0; cord D through crank pin 0.117 -> 0; pin against rim ring 0.005 -> 0 | Known and intended: tied cord eye at weight 0.030, cord resting on drum 0.0007 |
| 262 | Camera now looks along the screw from its outer end (+x), which puts C whole above B's rim, D below centre, and E in front. 263's output is unchanged. | 0 -> 0 | None in scoped checks |
| 264 | Plate remeasured: wheel spacing 0.38 -> 0.53, which gives a visible gap. The needles are long tapered spikes through the shaft (2.0 and 2.32 long). The shaft ends and the sleeve were changed to match. The worm offset is ±0.265, with a 264-only clearance of 0.0035. Profiles were regenerated; 202 is byte-identical. | 0 -> 0 | Sampled-clear. `202-264-worm-solids.json` shows 0 penetrations over 33 poses. |
| 269 | Teeth are tapered 14.5° meshing forms. Groups are 4/4/7/2 per the plate. Frame proportions were remeasured. A bug where the relief sweep used the unclamped stroke was fixed. The camera is flat, the ground is hidden, and the index and contact markers are removed in source presentation. | 0 -> 0 | Sampled-clear (minimum tooth clearance 0.0048) |
| 271 | The lever is now a triangular plate around its three bores, as drawn; before it was an X of arms. | 0 -> 0 | Sampled-clear; only the cord touches its own pulley and span |
| 276 | No change. The cam outline overlays the plate within a few pixels. Brown's valleys are not consistently equal-diameter (63 to 71.5 px). | 0 -> 0 | None in scoped checks |
| 277 | Hammer stroke 30° -> 42.3° (1000 cycle samples). The hammer belly was retraced and the ground is hidden. | 0 -> 0 | Sampled-clear |
| 278 | The rope eye is now a flat tongue plate b seated on B. The brass spring anchors are removed. Spring c is split round pin b, with its tips seated under B's head, which is carried forward (inferred) and slotted for pin b. | spring ends in anchors 0.110 -> gone; spring against pin 0.005 and against eye 0.0063 -> gone | Only the cables' own segment joints and seated pawl/tooth contact remain |
| 279 | The crank is now a lobed throw plate. The hub (0.36) and bearing sit behind it, so the dashed hidden parts are concealed. | 0 -> 0 | None in scoped checks |
| 280 | The eccentric shoe is thinned from ±0.14 to ±0.12 in depth. This edits only the 280 function of the shared `friction-family-working-parts.js`. | jaw journal/shoe 0.010 -> 0 | Only zero-depth seated flange-on-rim contact remains |
| 281 | No change. It agrees with the plate apart from the listed residuals. | 0 -> 0 | None in scoped checks |
| 285 | The handwheel is replaced by the plate's T crank bar with a turned grip. The block names are kept for callers. | 0 -> 0 | None in scoped checks |
| 287 | No change. The only mismatch is the catalog title and archetype saying three springs where the plate draws two. The catalog is left alone. | unchanged | Spring ends seated in their clamps (disclosed) |

## Residuals

- **255-259:** Contact, tension and slip are not qualified, because no belt is drawn. The dark rings sit slightly into the faces. Without the indices, the spin of the smooth pulleys is hard to see.
- **261:** The drum-side strand of D disappears at B's rim, where Brown carries it to the inner circle.
- **262:** Standard E is taller than Brown's low cradle. The eccentric carrier bar shows. The spring or weight that holds C down is not drawn.
- **263 (not in this lane):** Roller C is near the small end of the cone, but the plate draws it near the large end.
- **264:** Perspective shows one wheel's inner face.
- **269:**
  - Two stub teeth at each handoff; Brown's staggered spacing would jam the gear.
  - The closed end sits farther right than drawn, to give stroke clearance.
  - The subject is still smaller than on the plate.
  - The rod and collar leave the view briefly at the stroke limit (maxNdc 1.17).
- **271:** The existing text stands.
- **276:** The model follows the 180° valley, so the necks at 60° and 300° are about 8 px deeper than drawn.
- **277:**
  - The hook still works about 0.86 lower than drawn, and the teeth are shallow. A higher hook pulls off the teeth, and deeper teeth let the dog cut into the ratchet.
  - The 42.3° stroke comes from an earlier reconstruction, not from a plate measurement.
  - The mainspring stirrup is not modelled, and the spring turns as a rigid piece.
- **278:** The spring seat collar and B's forward head block are inferred, and the head block's edges show faintly.
- **279:**
  - Hidden edges are not drawn dashed.
  - The throw's lobe below the box renders solid where Brown partly dashes it.
  - maxNdc 2.0 comes from the rods running off frame, a deliberate crop like Brown's broken rods.
- **280:**
  - Ratchet teeth peek out at the rim's upper right.
  - The posts are thinner than the plate's.
  - The grip is a block where Brown draws a turned handle.
- **281:** The groove is a wide dark band where Brown draws a narrow rimmed groove.
- **285:**
  - The catalog title still says handwheel.
  - The caption's "wheel" could also be read as a wheel seen edge-on.
  - The quill clamp lever is a flat bar.
- **287:** The spindle pokes above the top collar where Brown draws a dome finial.

Physics residuals (friction, load, slip) are unchanged and out of scope.
