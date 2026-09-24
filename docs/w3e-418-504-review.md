# Pass-51 wave-3 lane w3e: movements 418–504

Reviewer: Claude Opus 5.5 (primary agent), 2026-09-23. Each ID was captured
before and after with `scripts/review-movement-source-views.mjs` (render beside
`public/engravings/mm_NNN.png`) and screened with
`scripts/show-body-intersections.mjs ID --spacing=0.01 --samples=129`.
Intersection values are the worst solid pair (fluid illustration pairs are
listed separately where relevant).

| ID | Change | Intersections before → after |
| --- | --- | --- |
| 418 | Guide D is now one solid slotted casting hung from its screw: the bell-shaped window narrows to the upper-pin slot, and the curved slot's edges are the two arcs D. Rod B lies in front of the casting as Brown draws it. The recess has inward lips. Valve A is broader and lower, with a tall pin block. White valve and roller indices removed. | none → none |
| 423 | Not changed. At the capture tool's 850×850 stage the casing top is not cropped (maxNdc 0.915), so the ledger's crop claim is stale. | unchanged |
| 437 | Buckets c are four flat 52° sectors round the hub, tilted 0.35 rad about their radial centre line. The floor keeps four slim arms under the buckets instead of eight open spokes. The scroll has a bolting flange with 11 lugs. The white runner marker is removed. | no solid pairs → no solid pairs. Fluid-only: static escape streams touch the rotating floor arms and vanes by ≤0.066 (illustration). |
| 441 | Float channels are about half as wide (half-width 0.07–0.095) and so are their water cores. The stream is an open band running off both sides and below the frame, not a bounded tank. | pass-49 0.0747 → no solid pairs (only intended bucket-in-stream fluid overlap) |
| 442 | Box pots are replaced by closed, finite lozenge shells: pointed spindles 1.24 long lying along the axle, with an inward mouth slot. The water cell is refitted inside them. | 0.275 pots dipping in the stream (intended) → same |
| 443 | Camera moved to [-0.3, 0.5, 1]. The screw axis now reads at about 40° like the plate's, the paddle disc opens (cos 0.49), and the trough sits at the upper left. | camera only |
| 444 | Brown's lower tank is added in section: floor, end walls, back wall and water drawn behind the ram. The head vessel's near wall is cut away. The waste efflux leaves past the disk rim rather than through the stem. | 0.0536 → 0.0000 (seated disk) |
| 445/446 | The falling stream is waisted. The sheet leaving the plate bells outward and then falls almost plumb. The checked cone is concave. White tracer beads are removed by presentation. | none → none |
| 459 | Spur worm wheels are replaced by pinned star wheels (12 square pins on a small boss). The blade star is replaced by a horizontal wind wheel of upright vanes between annular boards, seen edge-on as Brown's band. White index removed. Flat long-lens elevation cropped at the curbs; gallows posts, top beam and base removed. | worst 0.1181 tappet pivot × arm (pre-existing, pass-49 0.1049). New: star pins graze the worm thread by ≤0.030 during engagement. Other pairs are unchanged coaxial shaft/hub fits. |
| 463 | Leaves are 0.26-thick planks (Brown's ≈1/9 of the upper leaf), with pivots at ±t/2 so the closed faces still meet at x = 0. | clear → clear |
| 466 | Ram and pump cylinders are opaque back-half sections instead of glass. The lever post stands on a bracket from the tank rim instead of passing through the tank. The delivery check chamber is moved clear of the pump barrel, and the pressure pipe is rerouted. | 0.0437 → 0.0000 (seated check disks) |
| 467 | Base box narrowed: the right wall now stands just outside the cylinder seal (width 2.76 → 2.14). The lever and thumb screw are no longer ghosted by the shared ram material. The feed pipe is rerouted clear of the thumb-screw tip. | 0.0134 → 0.0000 (seated screw tip) |
| 468 | The default view closes on the front main's middle joint (frames, straps, hinge, ball) from above and in front, and keeps it through the flexing cycle. Zooming out still shows the whole crossing. | framing only; the pre-existing winch cable/rotor coaxial fits (≤0.239) are unchanged |
| 470 | The valve pitman is a bored link one plane in front of the lever and spool, carried on finite pins. | 0.0416 → 0.0000 (seated hammer face) |
| 474 | Risers are within about 5° of plumb: feet at x ±1.40 and tops at ±1.60 (was 12°). This is limited by the lid radius and pivot collars. The camera is lowered to about 10° elevation. White globe spots and steam beads are removed. | none → none |
| 481 | Box feet are replaced by Brown's low flared humps hugging the case. | no solid pairs; the known gas/water envelope fluid overlaps remain |
| 482 | Not changed. | known: mercury seat volume × valve D skirt 0.190 (mercury envelope, unchanged) |
| 492 | The tackle fall is bent round the eye's top bar through its hole and rises with the hook. The release rope is bent through the lower eye's bore round the bar on the pull side, clear of the lever boss. | 0.0945 → 0.0339 (joints between cylinder segments of the same cable) and 0.010 (rope bend grazing the lever arm's eye boss) |
| 496 | Long-lens axial camera, so rolls A and B read as end sections. The spindle runs on below the bobbin through the rail bearing to a small grooved whorl and a footstep. | 0.023 yarn × package/self (unchanged) |
| 500 | Not changed: the sectional side view is still missing. | unchanged |
| 503 | Sleeve F is a square block. White arm and shaft indices are removed. `docs/validation/503-504-contact-solids.json` was regenerated (0 penetrations). | none → none |
| 504 | Fit bounds keep the full orbit's screen extent but only a shallow depth. The train is slightly larger; a full-turn arm keeps it centred on A. | none → none |

## Residuals

- 418: the coupler-locus slot droops at its ends (exact kinematics), where
  Brown's arc curves up.
- 441/443/442: Brown's ruled water is still a translucent solid band or box.
- 459: worm and star-wheel meshing is not conjugate-qualified. The wind wheel
  and the upper shaft float without the removed gallows, as in the plate.
- 466: the pump still shows a translucent water column. The ram floor is a
  full disc.
- 467: the base is still wider than Brown's because it houses the pump and
  screw.
- 468: Brown's two separate views (plan and elevation) are one oblique close
  view.
- 470: the steam pipe and valve gear remain on the right.
- 492: sharp rope bends made of chained cylinder segments self-overlap at
  their joints.
- 496: the display profile's motion bounds predate the longer spindle, so
  the default view crops the footstep until
  `scripts/measure-display-profiles.mjs 496` is rerun. Lanes may not run it.
- 500: the dial face and the sectional side view are not reproduced.
- 504: the full carrier orbit limits how large the side elevation can be.
- Display profiles should be re-measured for 437, 441, 442, 444, 445, 446,
  459, 463, 466, 467, 468, 474, 481, 492, 496, 503 and 504.
