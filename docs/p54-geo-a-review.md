# Pass 54, lane p54-geo-a: break cuts, floating parts and construction geometry

Scope: 39, 45, 54, 63, 100, 118, 142, 159, 160, 172, 173, 180, 181, 182, 185,
197, 198, 213, 238, 244, 247. I checked each one in six views (default at phases
0 and 0.5, yaw 60, yaw -70, back and top) with `/dev/shm/t4/cap.mjs` (a copy of
the audit-b capture on port 44414), plus close-ups where needed. I looked at the
before and after captures.

## Decisions applied

- Break lines are not modelled. Each part now has a real end: a rounded eye,
  a square end or a rounded rod end.
- Nothing floats. Every fixed stop or block now sits on a post, a strap or a
  wall face. Where Brown crops the support, the added support is slim and sits
  behind the moving parts.
- Hatching is plain, rims are not black, and marker colours are removed
  (181/182 shaft heads and tappet face, 54 terminal teeth).

## Per movement

| ID | Change | Files |
|---|---|---|
| 39 | Connecting rod modelled whole: full `rodLength` (3 × centre distance) with a rounded upper eye on a wrist pin. `cameraFitBounds` keeps Brown's framing, so the rod runs off the top. | authored-gears-core.js (`sunAndPlanet`) |
| 45 | Removed the floating enlarged-section wedges. The grooves show on the wheels' own V-grooved rims, which mesh at contact. Camera fits the wheels. | authored-gears-core.js (`groovedFrictionGears`, removed `revolvedSectionSector` and `makeGroovedSection`) |
| 54 | Crab block made smaller (half-width 0.38, half-height 0.52, bars 0.455–0.51 and 0.14 wide, still clear of moving parts, which reach up to \|z\| 0.424). The two terminal teeth are no longer brass. | star-mangle-guide.js, star-mangle.js |
| 63 | Striker and stop pin are plain steel pins with no ink rim tori. The stop pin stands on a slim fixed strap behind the drop. The strap also carries a clamp block that holds the leaf spring's end. | authored-intermittent-core.js (`snapActionStarCounter`) |
| 100 | Production (MuJoCo) lever tail is now one closed turned round rod on the drawn tail centreline with a hemispherical end, replacing the traced flat oblique-cut outline. The legacy authored factory was changed the same way. | mujoco-quick-return/geometry.js, authored-cranks.js |
| 118 | Pitman ends in a rounded crank-end eye with a pin instead of the jagged notch. | mujoco-stroke-doubler/geometry.js |
| 142 | The guide rail's post and bridges, the stud's rear post and the base are no longer removed. The rail and stud are carried, mostly below the crop. | source-presentation.js |
| 159 | Pulley pad on a slim post from the floor. The slack cord is now one smooth arc toward the downhill side, with no loop or curl. Rebaked. | mujoco-cord-treadle/solids.js, ideal-cord-shape.js, 159 asset and provenance |
| 160 | Bow end block and pulley pad each on a slim post from the floor. Rebaked. | mujoco-spring-return-treadle/solids.js, 160 asset and provenance |
| 172 | The jagged crosshead stub is now a square crosshead block riding in a closed fixed guide frame. | authored-curve-generators.js |
| 173 | The jagged tappet-support and foot blocks now have square ends and are joined by one upright frame post behind the guide rod's plane. | mujoco-silk-tappet/assembly.js |
| 180 | Stile and board now have square ends (their bounding rectangles). Rebaked. | mujoco-single-clamp/solids.js, 180 asset, docs/validation/180-bake.json |
| 181/182 | Plain steel shaft heads with no hatch lines. Tappet face is plain, with no hatch lines. Rods and eyes are one mid-steel instead of black. Whole piston rod with square ends that travels with its tappet (it was a fixed window with zigzag ends). Back-weight rods are fixed length and hang to cast weights below the picture. Bake bounds are clipped to Brown's picture, so the framing is unchanged. Rebaked. | mujoco-diagonal-catch/assembly.js, update-solids.js, scripts/bake-diagonal-catch.mjs, baked 181 asset and keys, docs/validation/181-bake.json |
| 185 | Quadrant plate thickened back to seat on the engine wall's front face (z −0.5), which it overlaps across the top band. | authored-locomotive-valve-gears.js |
| 197 | The square frame is now a solid pale-blue plate with the rack on its face. The C-guides stand on their side mounts, which are no longer removed. The pinion shaft is driven from the front, so the rear carriage is removed and nothing passes through the plate. | mangle-rack-working-parts.js, source-presentation.js |
| 198 | The main frame is a solid plate with a horizontal slot along its travel for the fixed pinion shaft and bearing. | authored-gears-core.js (`fixedPinionLiftedMangleRack`) |
| 213 | Removed the two orphaned rear bearing tori, whose arms were already removed. One of them was the loose collar with no shaft. | source-presentation.js |
| 238 | B and C are anchor-coloured blocks. Each face reaches back through the wheel depth onto a broad web on the anchor, replacing the brass or yellow tabs on thin pins. | authored-escapements.js, seven-tooth-238-working-parts.js |
| 244 | C and C′ now run back to the fixed stop post, which is no longer removed. The shaft-A end was already plain. | authored-belts.js, source-presentation.js |
| 247 | The sea bottom is a solid sediment bed (4.2 × 0.9 × 2.4) whose top is the contact plane, replacing the thin sheet. | authored-sounding-weights.js |

## Intersections (`show-body-intersections`, 0.01, 129)

- **181, 182:** clear. A first version of the cast weights overlapped the piston rod by 0.046. The weight radius was cut to 0.16, and they are now clear by about 0.03.
- **39, 54, 63:** no pairs.
- **45:** one zero-depth rolling groove contact (intended).
- **100, 118:** the script screens the older synchronous authored models. Those pairs predate this pass and do not involve changed parts. Production is covered by `mujoco-quick-return` (hardware separation) and `mujoco-stroke-doubler`, and both pass.
- **197, 198, 213:** no pairs.
- **238:** only the intended zero-depth working contact at B. The first version's web touched the wheel at z = 0.27, so the web and face now stop 0.01 behind the wheel.
- **244:** one zero-depth coaxial contact between the pulley and the block (the intended brake contact).
- **247:** only the reload-sling rope rows.
- **142, 159, 160, 172, 173, 180:** the script screens older synchronous or authored models, not the baked or MuJoCo production assemblies. The regenerated production clearance reports (160, 172, 173) show no failures.
- **185:** the screen shows pre-existing rows (slot end × rockshaft 0.040, handle × suspension rod 0.0225). None involves the quadrant or the wall.

## Regenerated validation

- `docs/validation/159-ideal-shape.json`: maximum amplitude is now 2.24 (lateral control offset), and length error stays below 2e-14.
- `docs/validation/160-solid-clearance.json`: no failures.
- `docs/validation/172-clearance.json`: no intersections.
- `docs/validation/173-assembly-clearance.json`: no intersections.

## Residuals

- **54:** the crab keeps its collar-retaining channel topology and the radial bars. It is still larger than Brown's small block, because an outer shell has to retain the collar through both crossovers.
- **142, 159, 160, 173, 172, 63, 244:** the added supports are visible where Brown crops them.
- **159:** slack is shown as one wide in-plane arc (up to about 1 unit of sideways reach), a length-preserving illustration.
- **197:** the shaft's rise-and-fall bearing lies outside the drawing.
- **198:** the shaft slot shows as a light stripe through the carrier's opening.
- **39:** the upper wrist pin's beam or crosshead is not drawn.
- **39:** the flywheel's four web slits remain as through-slits when seen from behind.
