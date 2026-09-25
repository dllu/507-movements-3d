# Pass-53 lane p53-fix-a: rotated-view audit fixes (1–127)

Source of findings: `/dev/shm/audit53/a/findings.json`. Each fix was inspected
in the default view and at least four rotated or oblique views (for example
rot60, oblique (5,3,12), top-back, side and back), at several motion phases,
using a private non-watching Vite server.

| ID | Audit problem | Change | Files |
|---|---|---|---|
| 054 | A was loose curved fragments, a wire rectangle and a stub | A is now one solid brass block (`crabBlock`) across the rim gap. It is cut by the swept silhouette of the collar through both crossovers (0.003 clearance), and a pair of radial bars (with feet on the inner rim) passes over the pinion's swept faces. This matches Brown's block plus radial bar. The exact thin collar-guide shells stay inside it as the slot lining, so the contact test is unchanged. The old bridge, stem and stemFoot were removed. | `src/simulation/star-mangle.js`, `src/simulation/star-mangle-guide.js` (new `starMangleCrabBlock`), `tests/star-mangle.test.mjs`, `scripts/probe-star-mangle-hardware-candidate.mjs` |
| 055 | From behind, the page-coloured web hid A and B | C's web is now a real lit accent-coloured six-armed web (arms 0.18 wide) behind the gears, not an unlit page-colour disc. A and B show through its windows from behind and from oblique views. | `src/simulation/coaxial-gears.js` |
| 081 | The rack-rod left its lower guide | The hollow rod now extends to `lowerGuide.bottom − stroke top (2.268) − 4 px`, so it stays through the guide at the top of the settled stroke. The motion (profile knots, mass = 1) is unchanged. The profile's `motionBounds.min.y` changed from −4.094 to −5.839, and the matching reference candidate was updated. | `src/simulation/spring-rack-geometry.js`, `scripts/lib/spring-rack-candidate.mjs`, `src/data/spring-rack-profile.js` |
| 027 | The grooves cut through the rim, leaving six loose sectors | The six sectors became one extruded wall: the disc minus six grooves with rounded ends (0.002 past the farthest roller excursion) and minus six triangular pockets. The rim is continuous. The wheel radius went from 1.78 to 1.84 so the rim keeps about 0.12 of material beyond the groove ends. The pockets keep their 1.63 outer radius. | `src/simulation/authored-gears-core.js` (`makeRadialSlotWheel`, `multipleGearing`) |
| 039 | Solid disc with short slits that looked like floating holes | The four web gaps now run from just outside the hub flange (0.53) to the rim. Their rim ends are filleted like Brown's rounded quarter corners, so the band between gear and rim reads as four arcs. The rim and hub ring keep it one rigid wheel. | `src/simulation/authored-gears-core.js` (`sunAndPlanet`) |
| 045 | The section was a painted floating board | Each half of the section is now an enlarged 35° sector of a grooved wheel. The section outline is revolved behind the plane about an axis at the section's outer edge, so the hatched cut face is unchanged from the front and rotated views show two grooved wheel sectors meeting at their rims. | `src/simulation/authored-gears-core.js` (`revolvedSectionSector`, `makeGroovedSection`) |
| 047 | The clutch halves were flat slabs of the half-section | The back clip plane and the back section caps were removed. Each turned member is now a clean half-cutaway: a round body of revolution behind the hatched axial section face. | `src/simulation/friction-clutch.js`, `tests/models.test.mjs` (47 block: one clip plane) |
| 093 | A round eye framed the shaft only at one instant | The lower stem is now a flat strap with an elongated slot that runs from the yoke to the lowest relative shaft position. The shaft end and hub are framed by the slot through the whole stroke. | `src/simulation/mujoco-scotch-yoke/geometry.js` |
| 108 | Open hollow drum; groove edges read as fins | A turned end cap and hub boss now close the barrel top, and the gear closes the bottom. The cap is visual-only and is not included in the normalized MuJoCo mass. | `src/simulation/mujoco-reverse-thread/geometry.js` |
| 119 | The slotted guide was hairline outlines | The solid guide bar is drawn by default (`setSectionView(false)`), as Brown draws it in front of the rack. The pinion shaft shows in its slot. The outline section view is still available as an option. | `src/simulation/mujoco-endless-rack/geometry.js`, `visual.js`, `tests/mujoco-endless-rack.test.mjs` |

## Intersections (`show-body-intersections --spacing=0.01 --samples=129`)

- 054: clear (2 bodies, 47 meshes).
- 027: roller/wall 0.0002. This is the ideal zero-clearance channel wall against the faceted roller, below the 0.001 threshold. The groove-end fillet is clear.
- 039: clear. 055: clear. 045: 0.0000 at the stationary section sectors' touching interface.
- 047: coaxial pairs involve the stationary section cap display faces (open ShapeGeometry) and the existing pivot pin. The checked member solids are unchanged, since clipping does not affect them.
- 081: only the spring/seat deforming contact, 0.0000.
- 093, 108, 119: the screen uses the synchronous registry models, not the production MuJoCo visuals. Their MuJoCo tests pass (the 093 strap lies in z 0.24–0.48, in front of hub and shaft at z ≤ 0.18, and below the wrist's slot band).

## Remaining limits

- 054: the block and bars are an inferred construction. Brown gives no depth, and the bars stand 0.5 in front of and behind the wheel faces to clear the pinion's swept face.
- 055: Brown leaves C's interior blank. The web arms now show between the gears in the front view.
- 081: the tail below the lower guide is about 2.3 long at rest, where Brown draws a short tail. It is needed for the settled stroke.
- 093: the shaft must end behind the strap because the yoke crosses the shaft axis at mid-stroke. When the yoke is below the shaft, the upper stem still passes in front of the hub.
- 039: from behind, the four web gaps read as radial slots in one plate.
- 045: the sector radii follow the section height (2.07 and 2.42), not the wheel ratio.
