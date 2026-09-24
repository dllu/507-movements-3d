# Pass-51 wave-2 lane w2f: movements 274–333

This lane worked through the pass-51 visual-audit items (docs/visual-audit-pass51.md) for 274, 275, 276, 278, 279, 280, 282–291, 293, 295, 299, 300, 303, 309–321, 329 and 333.
- Before and after captures came from `scripts/review-movement-source-views.mjs`.
- Intersections came from `scripts/show-body-intersections.mjs --spacing=0.01 --samples=129`.
- The "before" depths were measured on a read-only `git archive HEAD` export.

## Per movement

| ID | Correction | Worst intersection before → after | Remaining flaws |
|----|------------|-------------------------------------|-----------------|
| 274 | Guide arms B reshaped to Brown's lyre bands, which end in a spindle block. Parabola refit to the band's inner edge. Top bar given an ogee shape. White indices and rear bearing post removed. | 0.065 → clear (tube guides excluded as open meshes) | Balls sit slightly low and outboard. Rods F lean at full rise. Spindle speed and guide position are prescribed. |
| 275 | Broad rack spine with short teeth. Larger worm hub with thin fins. Collars and indices removed. Flatter camera. Thread-solids report regenerated. | clear → clear | Rack pitch 0.64 against Brown's ≈0.55. Rounded rack top not modelled. |
| 276 | Face-on camera, so the bar is level. Bar guides removed. Indices removed. | 0.038 → clear | Cam lobes narrower than drawn. Flat bar where Brown draws a round rod. |
| 278 | Crosshead, base and top rope anchor removed. Uprights cropped. B drawn as an open inverted U. Rope break above the crop, so only stub a shows. | 0.149 → spring seated in its anchors (intended). Spring/pin contact ≤0.006. | Rope eye is a ring, not a tongue plate. Arrest is prescribed. |
| 279 | Rod guides removed. Close crop on the crosshead. Heavier rod. Indices removed. | clear → clear | Crank disk drawn solid where Brown dashes it. Simplified gibs. |
| 280 | Ratchet and pawls moved behind the web, so the wheel shows a plain rim. Near face-on camera. Base and index removed. Post and lever pivot corrected. | 0.48 → 0.010 (jaw pivot × shoe, from the shared helper) | Thin frame beams where Brown draws timber posts. |
| 282 | Rack run shortened to 12 teeth on the long bar. White indices removed. Strut and guide-pin clash fixed. | 0.050 → clear (cord joints only) | Weight and pulley somewhat large. |
| 283 | Opaque barrels, cropped at Brown's break. White indices and gear indicator removed. Handle moved in front of the racks. | 0.130 → clear | Barrels narrower than drawn. |
| 284 | Face-on elevation. Added feet removed. White indices and beads removed. Rod moved in front of the crank plate. | 0.227 → clear (coaxial joints) | Carriage shorter than the plate's. Grey lower slide remains. |
| 285 | Flat side elevation, with the wheel edge-on. Columns replaced by one casting with an octagonal window. Indices removed. | 0.034 → clear | Short bed. No stepped foot. |
| 286 | Flat elevation cropped at the rod break. Guide standard and rod guides removed. Rod centred in the lifter. Indices removed. | 0 → 0 (seated contacts) | Toe pose and profile approximate. |
| 287 | Two opposed springs and balls as drawn (the patent has three). Front elevation. Indices removed. | 0.115 → 0.115 (leaf ends seated, intended) | Catalog title and archetype still say three-spring. |
| 288 | Index marks, contact marker and face highlights removed. | 0.064 → clear | Recoil is prescribed. |
| 289 | Wheel A drawn as a web with four lens windows. Indices removed. | 0.144 → clear | Deadbeat forcing is prescribed. |
| 290 | Seven hooked teeth. Indices removed. | 0.026 → 0.026 (tooth × pallet B at landing) | The landing overlap remains. |
| 291 | Balance a drawn as a plain notched disc. Indices removed. | 0.22 → 0.22 (existing leaf, stud and stop overlaps) | Those overlaps remain. The ledger's "none" claim was stale. |
| 293 | Close-up of the rim arc under roller A and pallet B. | clear → clear | Rim band wider than drawn. |
| 295 | Flat close-up of the pallets over the rim arc. Ground hidden. | clear → clear | 15-tooth pitch against the plate's ≈20. |
| 299 | Ground hidden. Nearly edge-on crop of the crown band. | 0 → 0 | Far-side teeth show between the near ones. |
| 300 | Sector yoke arc joins the spokes. Smaller spacer drum. Ground hidden. Camera softened. | clear → clear | Pallet thicker than drawn. |
| 303 | Leaning X of crossings. Narrow rim. F drawn as a dot. Camera nearer face-on. Ground and indices removed. | clear → clear | Thin rod. |
| 309 | Pendulum rod, bob and witnesses removed, which fixes the overflow. Ground hidden. | clear → clear | Locking comes from the motion law. |
| 310, 311 | Bob, bearing bracket and witnesses removed. Ground hidden. | clear / 0.0001 graze → unchanged | Legs are straight bars. |
| 312 | White witnesses removed. Ground hidden. | clear → clear | As before. |
| 309–312 | Gravity plates rebaked. Outlines are byte-identical; only the fingerprints changed. | | |
| 313 | Web wheel with four crossings. Roller drawn as a plain notched disc. Indices removed. | 0.093 → 0.093 (existing tooth × detent overlaps) | Those overlaps remain. |
| 314 | Windowed web escape wheel. Plain balance disk behind the lever. Markers removed. | 0.119 → 0.119 (lever arbor × pallet C, pre-existing) | Teeth are thin spikes. |
| 315 | Bearing posts (the cage), upper bearing, orbit circle and indices removed. | coaxial flexure seats only | Collar is a plain cone where Brown draws a bevel. |
| 316 | Suspension frame, pivot hub, swing index, mercury level disc, datum ring and centre marker removed. The rod now runs out of the top, as on the plate. | 0.085 → 0.085 (adjusting thread in its handle nut, intended) | Glass has zero thickness. The thread is illustrative. |
| 317 | Suspension frame, pivot hub, bob hub, white weight indices, centre marker and datum removed. | 0.275 → 0.275 (clamp C brazed to rod and bar, intended seat) | Bars are piecewise straight. |
| 318 | Rate scale redrawn as Brown's graduated band: three arcs with 13 radial divisions. End balls, rim bead and stud bracket removed. | 0.009 → 0.009 (spring × collet seat) | Pointer drawn as a plain arm, not Brown's tapered pointer. |
| 319 | White weight beads and screw slots removed. The balance spring and stud (not drawn by Brown) removed in presentation. | 0.119 → 0.094 (balance centre a × bar, coaxial). Arm × timing-screw stem 0.093 is pre-existing. | Arm/screw overlap at t remains. |
| 320 | Rotation indices and chain markers removed. | 0.051 deforming chain × demo handle, unchanged | As before. |
| 321 | Frame beam, great-wheel and barrel indices, and spring indices removed. | 0.139 spring × arbor, unchanged (pre-existing) | Spring path crosses the arbor. Detent T is a thin bar, not Brown's blade. |
| 329 | Demonstration clock starts at the plate's pose: B upper left, A high, arms upright. The official keyframes are kept by carrier angle. Closed barrel (the front opening is removed) with the plate's crop at the cylinder cover. White indices, including the generic gear face index, removed. | 0.058 → clear. Legs moved ahead of the flywheel. Side bosses moved outside B's tip orbit. Hub shortened clear of the main bearing. | Rim thicker than Brown's. Camera slightly oblique. |
| 333 | Clock offset by half a cycle, so the beam falls toward W as on the plate. The 15 rpm law is unchanged. | clear → clear | Brown's beam is steeper than the official stroke allows. The pivots are pedestals, where Brown draws hatched ground. |

## Notes

- The plate-pose offsets for 329 (carrier 140°) and 333 (half a turn) are applied to the wrapped input angle. Unwrapped travel and phase still count from the demonstration start, so one cycle closes exactly.
- Tests for 316–319 now assert that the undrawn datum, indices, hubs, stud and spring are absent from the presented model. Their kinematic laws are still checked, through the balance rim point and through the detached spring segments in the root frame.

- The ledger rows for 291, 313, 314, 317, 319, 320 and 321 claim "None in scoped checks". Those claims are stale: the pre-existing overlaps listed above remain.
- Helper modules changed:
  - `piston-guide-329-331-parts.js`: only `correctEpicyclicGuide` (329). 331's `correctSlottedGuide` and `finishPistonGuides` are untouched.
  - `baked/gravity-escapement-plates.js`: fingerprints only.
