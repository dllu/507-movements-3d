# Pass 55 — cutaway lane (p55-cutaway)

Scope: Brown's sections rendered as ONE clean cutaway instead of translucent
stand-ins, chopped half-solids, open troughs, blue mercury and temperature
colours. IDs: 47, 285, 316, 389, 395, 418, 421, 425, 426, 436, 443, 448–451,
453–458, 462, 465–467, 469–473, 475, 477–483, 497, 500.

Evidence: before/after tiles (default, phase 0.5, rotated 60°, rotated −110°,
top/behind, engraving) in `/dev/shm/l1/before/b-ID.png` and
`/dev/shm/l1/final/f-ID.png`; intersection rows (HEAD vs working tree,
`show-body-intersections --spacing=0.01 --samples=129`) in `/dev/shm/l1/ix/`.

## Shared helpers (new)

- `src/simulation/cutaway-section.js`
  - `sectionGeometryByPlane(geometry, plane)`: plane section of any closed
    mesh. Merged parts are sectioned shell by shell; cut segments are chained
    into loops (coincident duplicate faces pair up, touching loops are split),
    loops nest by containment, and the caps reuse the exact cut points so the
    result stays watertight. Only where loops of one shell overlap is the
    region resolved with a polygon union (`polygon-clipping`). Group 0 =
    remaining surface, group 1 = cut faces. `sectionMeshInPlace` offsets the
    plane by 1.4e-4 so vertices lying exactly on an authored section plane
    (pipe axes) do not give degenerate cuts.
  - `sectionMeshInPlace(mesh, frame, {normal, point})`: cut a mesh on a plane
    given in model-root space; the part becomes opaque, cut faces a slightly
    darker plain shade (`cutFaceMaterial`).
  - `latheSectionGeometry(profile, {phiStart, phiLength})`: flat-shaded
    revolved solid with planar cut caps ("half-section of a lathe"); with a
    full sweep it is a crisp closed turned part. `tubeSectionMesh`,
    `boxShellSection`, `mercuryMaterial`, `solidMaterial`.
- `src/simulation/cutaway-presentations.js`: per-ID specs applied at the end
  of each factory (`applyCutawayFor(model, id, extra)`): `cut` (opaque walls
  cut on the plane), `water` (real water cut by a clipping plane on its own
  cloned material, so per-frame volume rebuilds keep working), `solid`
  (whole opaque parts where Brown draws an exterior), `hide` (tinted gas/air
  stand-ins, black outline rims), `mercury`, `prepare` (geometry fixes before
  the cut). A part wholly in front of the plane is removed. The result is
  recorded in `root.userData.cutawayPresentation`. Helpers `wholeTube`,
  `hoopBand`, `hollowVesselGeometry`, `boxWallsGeometry`.
- `src/simulation/cutaway-back-plates.js`: `addBackCover` — for face-on
  sections of casings extruded along z, the back cover as one plate spanning
  the radial envelope of the casing outlines (the cut removes only the front
  cover).

The default cameras of all these IDs look along +z, so every cut plane is a
z-plane facing the camera (z = 0 unless noted).

## Per movement

| ID | Change | |
| --- | --- | --- |
| 47 | Half-section members → ONE quarter cutaway (only the upper-near quarter removed, `clipIntersection` of z>0 and y>0); plain caps on both exposed faces (vertical cut face upper half; horizontal face from the same turned section, keyway angle shifted a quarter turn). Lower half and turned views are whole round bodies. | see table below |
| 285 | Translucent quill sleeve → opaque sleeve and end rings cut on z = 0 (it only translates along its axis, so the cut is stable); screw and nut show through the cut. | |
| 316 | Blue mercury → opaque silvery metal; the jar is Brown's glass and stays clear. | |
| 389 | Open-fronted stand channel → the flared cheeks and rack-guide straps are cut on z = 0 as a deliberate section round the whole rack (rear pawl supports/bridges already carry both pawl pivots and the eccentric shaft). | |
| 395 | Translucent tinted passage cores and thin black outline body ring → plug solid behind its two passage channels (0.14 deep, open toward the cut face), body a full grey annulus ported for the pipes, body/plug/port pipes cut on z = 0 (both plate figures). No fluid tints. | |
| 418 | Seat plate (stood 0.15 in front of the section) cut on the chest's existing plane z = 0.48. | |
| 421 | Cylinder wall, heads, flange, stuffing box, piston and trunk all cut on z = 0; added a minimal bearing standard on the rear of the head and a plain bearing carrying the crankshaft. | |
| 425 | Open casing/passage rings → back cover behind the section (radial envelope of casing, pear necks and abutment guide). | |
| 426 | Back cover behind the section; each steam port D is a whole round pipe instead of two flat slabs. | |
| 436 | Translucent trunk b → trunk, rings, top cover and inlet flume cut on z = 0; the stand-in "cutaway posts" removed. Runner/guides whole. | |
| 443 | Translucent screw casing → whole opaque casing (Brown draws a closed cylinder with the helix dotted as hidden); end rings are casing-coloured bands, not black rims. | |
| 448, 449 | Translucent barrel/pipes → barrel, suction pipe, spout (448) / delivery riser, flap bell, top cover, stuffing-box body (449) cut on z = 0; water cut on the same plane; outline rails removed. | |
| 450, 451 | Same treatment; black end rims and outline rails removed; 451's white air-cushion tint removed. | |
| 453 | Valve chest, chest floor, pipes and check housings cut on the pipe plane z = 0.55; bellows opaque. | |
| 454 | Chamber, bottom, clamp ring, pipes and check housings cut on z = 0.38; diaphragm opaque; outline rails removed. | |
| 455 | Three-sided trough apertures → whole round pipes. | |
| 456 | Suction pipe F → whole round pipe matching pipe H. | |
| 457 | Translucent solid "well" → lined hollow shaft cut on z = 0 with its water. | |
| 458 | Translucent panels → earth-lined shaft (back and side walls) cut on z = 0. | |
| 462 | Rising pipe and its water column cut on z = 0. | |
| 465 | Brown draws the barrels as exteriors: barrels, rod covers and check chambers opaque and whole. | |
| 466 | Ram-cylinder floor, cistern walls/floor, delivery chamber and pressure pipe cut on the existing z = 0 plane; ram water clipped. | |
| 467 | No change: already one clean z = 0 half-section with plain faces. | |
| 469 | Cisterns cut on z = 0.6 (in front of the wheel); screw barrel (Brown: closed tube), air receiver and air pipe opaque and whole; both baths one water colour (no temperature colour). | |
| 470 | Whole opaque cylinder (ported where the steam passage enters); the valve chest is the one cutaway, opened on z = 0.62 just behind the pitman so spool and pin show; black cylinder rings removed. | |
| 471 | Whole opaque moving cylinder B (Brown dots the piston as hidden); tinted air charges removed. | |
| 472 | Cylinder B, its heads and valve chest, pump D cylinder cut on z = 0; frame window opaque; tinted air chambers removed. | |
| 473 | Whole opaque outer tub and bell (Brown draws hooped vessels) with hoop bands in the vessel colour; tinted gas removed. | |
| 475 | Chamber D and pipes B, C cut on z = 0; black joint rims removed; water clipped. | |
| 477 | Casing was already a z = 0 half-section; valve D stem and seat a,a now cut on the same plane; working liquid one colour. | |
| 478 | Sphere C and outlet cut on z = 0; pipe A opaque, whole, one colour (no heat colour); translucent rims removed. | |
| 479, 480 | Tank wall/bottom/rim, bell skirt and crown, pipes (480: tubes a, b and rims) cut on z = 0; water clipped; tinted gas removed. | |
| 481 | Section across the drum axis: case and drum cut on z = 0.48 (front head and front rims removed), rear case head opaque; partitions whole; gas tints and water line removed. | |
| 482 | One cut on z = 0.29 through case walls, roof, cover, troughs, cup H and valve D; the separate flat "section face" plates replaced by true caps; quicksilver silvery; back panel fitted between the side walls (no z-fighting edge). | |
| 483 | Opaque back panel plus side panels (cabinet with its front removed); chest round B cut on z = 0; partition opaque; gas tints removed. | |
| 497 | Section across the shaft: volute cut on z = 0.5, front side, front inlet rim and front bearing removed, rear side opaque; outlet lips in casing colour. | |
| 500 | Face gauge is a whole round case (drum and back added, bezel seated on the dial), dial and pressure chamber opaque, red pressure tint removed. Brown's side figure stays his single clean section. | |

## Intersections

Worst sampled depths, HEAD (ef0d962) → working tree, `--spacing=0.01
--samples=129` (solid / coaxial; fluid, deforming and open-shell pairs are
not targets of the screen):

| ID | solid | coaxial | note |
| --- | --- | --- | --- |
| 47 | 0 → 0 | 0.0896 → 0.0896 | unchanged (cap ShapeGeometry is open) |
| 285, 389, 395, 418, 421, 425, 426, 436, 443, 448, 449, 451, 454, 456, 462, 466, 467, 469, 471, 472, 475, 480, 481, 497 | 0 → 0 | 0 → 0 | clear |
| 316 | 0.2427 → 0.2427 | 0 | pre-existing thread × adjuster block |
| 450 | 0 → 0 | 0 → 0.0099 | lever pin × delivery pipe, exposed now the pipe is opaque (was a translucent "fluid") |
| 453 | 0.0528 → 0.0528 | 0.0675 → 0.0675 | pre-existing bellows plate × pleat |
| 455 | 0 → 0 | 0.0872 → 0.0872 | pre-existing |
| 457 | 0 → 0 | 0.0227 → 0.0227 | pre-existing |
| 458, 473 | HEAD screen runs out of heap | 0 (with a 12 GB heap) | only seated check contacts in 473 |
| 465 | 0.1172 → 0.1172 | 0.0488 → 0.0488 | pre-existing operator figure |
| 470 | 0 → 0 | 0 → 0 | (an opaque closed chest gave 0.097 with the pitman; resolved by cutting the chest) |
| 477 | 0 → 0 | 0.0010 → 0.0010 | |
| 478 | 0.0800 → 0.0800 | 0.0494 → 0.0494 | pre-existing support upright × pipe A |
| 479 | 0.0899 → 0.0899 | 0 | pre-existing rope lug × rope |
| 482 | 0 → 0.1898 | 0 | valve-D skirts and cup-H rims dipping into the quicksilver seals: intended liquid seal, now counted "solid" because the quicksilver is opaque and the screen's fluid pattern matches "mercury" but not "quicksilver" |
| 483 | 0.0644 → 0.0644 | 0 | pre-existing crosshead × outlet |
| 500 | 0 → 0 | 0.0648 → 0.0648 | pre-existing |

Cut meshes pass the screen's watertight test except a few pipes whose
sections needed the polygon-union fallback (453 branch pipes, 454 delivery
branch, 449 riser, 466 pressure pipe; a handful of unmatched cap edges each),
which the screen therefore lists as open shells.

## Residuals (honest)

- Internal working parts stay whole, so pistons, runners and discs of
  larger radius stand in front of their cut casing (436 runner, 448–451
  buckets, 466 ram); this is the chosen cutaway convention.
- 450/451: the rectangular port window in the barrel is larger than the round
  pipe bore, so the background shows round the pipe end in rotated views.
- 482: the H cup rims coincide with the quicksilver volumes (pre-existing
  shaping), showing fine stripes where they meet.
- 483: the branch tubes pass through the new side panels (not flagged by the screen's pair set, visible as the tube crossing the panel).
- 500: the bottom pressure inlet passes through the new case drum (no bored
  boss); Brown's side section figure remains a half body by design.
- 395: passage channels are rectangular grooves (not half-round bores).
- 316: the pendulum rod's lower end is hidden in the opaque mercury.
- Water is cut by a clipping plane (no cap on the water's cut face; it is
  translucent). 478's condensate no longer fades with flow.
