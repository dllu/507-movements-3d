# Engines 326–345 source-match and solids pass

Scope: 326, 327, 332–341, 344 and 345 (steam-engine guides, parallel motions and
oscillating engines). Every movement was compared against `public/engravings/mm_NNN.png`
in its default and oblique review captures, re-framed to the plate crop
(`cameraDirection` (0.45, 0.28, 14), explicit plate-crop `cameraFitBounds`,
`cameraDistanceScale` 0.96–0.98; the full swept box is kept as `sweptBounds` where a
test needs it), stripped of parts Brown does not draw, and re-screened with
`node scripts/show-body-intersections.mjs ID --spacing=0.01 --samples=129`.
All linkage laws, official timings and phases are unchanged. Every production
movement here remains scripted/analytic; none uses MuJoCo.

Captures: `node scripts/review-movement-source-views.mjs --ids=… --output-dir=/dev/shm/engines-review`
(`ID-default.png`, `ID-oblique.png`; review artifacts are not committed).

## Results

Depths are worst solid / coaxial overlap across the sweep. "0.0000" pairs are intended
rolling or sliding contact.

| ID | Change | Worst before → after | Remaining flaws |
|---|---|---|---|
| 326 | Pillow block on the cap, deep foundation foot, lower slide bridge; piston rod runs behind the standard; indices removed; crank and wrist pins carried by crank and slide. | 0.053 / 0.0685 → frame-slot vs shoe-web sliding 0.0000 only | Brown hides the connecting rod in the hollow standard (dotted); the model keeps it in front because a rear rod would cross the shaft at top centre; the rendered piston rod is shortened (−7.7 vs official −17.75 units). |
| 327 | Undrawn outer frame posts and lower crossbase removed; flywheel moved behind beam and columns; plate-width columns with capitals; round-ended A guide straps; wider cylinder cover and gland; roller, crosshead, flywheel and crank indices removed; crank pin carried by the crank, wrist pin by the crosshead. | 0.0747 solid / 0.108 coaxial → roller-on-strap rolling 0.0000 only | Plate proportions differ from the official animation (longer rod, larger flywheel); the small collared shaft stub on the right column and the dotted hidden edge are omitted. |
| 332 | Bored lid deck, gooseneck radius support, sectioned pivot shaft, tapered lever plate, lathe vessel with blind bore; piston head and frame posts removed; pins owned by one member. | 0.0672 / 0.0833 → none | Vessel is taller than drawn so the 5.5-unit stroke stays enclosed; crosshead sits behind the links; plate vertical scale exceeds the official geometry. |
| 333 | Bored bracket pedestals over hatched ground, fish-bellied bored beam, cut-off left piston rod owning P; centre piston removed. | 0.1446 solid → none | Default t=0 has P at the bottom of its stroke, the plate shows the t=T/2 pose (official timing kept). |
| 334 | Plate-style bed, bearing and strap; roller and rack index marks removed. | 0.017 / 0.0612 → roller-A-on-rack-back tangency 0.0000 only | Plate proportions differ from the official animation. |
| 335 | Matched plate framing and parts; fixed bores for every pin. | 0.1487 / 0.1677 → none | F placement follows the official animation rather than the plate. |
| 336 | Cylinder casing with flanges, bed, cover, stuffing box and bands; rockshaft standard with diagonal frame; slotted bored lever; piston head removed. | 0.105 / 0.1975 → none | The plate's own proportions are inconsistent (rod scale). |
| 337 | Undrawn frame removed; bored pins and bosses; plate framing. | 0.09 / 0.1887 → none | Beam runs off the plate edge as drawn. |
| 338 | Same treatment as 337. | 0.10 / 0.1886 → none | None beyond reconstruction assumptions. |
| 339 | Solid bell casting with windows, slot box D, pedestal, gland and cover; bored pins. | 0.1444 / 0.1572 → none | Cylinder cover reads slightly heavy under camera tilt. |
| 340 | Pillar, beam, wall bracket and bare shaft F follow the plate; bored pins. | 0.04 / 0.1882 → none | Pillar-to-beam ratio follows the official animation (≈0.54) rather than the plate (≈0.85). |
| 341 | Separate footings, fish-bellied beam, closed cylinder; bored pins. | 0.1828 / 0.1547 → none | Uses the official animation's radius joint at M. |
| 344 | Closed round bored cylinder with lathe covers and gland collars; enclosed round piston; link-shaped crank carrying its live shaft and pin; broken-off bored rails (middle rail behind the cylinder, as Brown dashes it); transparent bore, cage walls, crank disk, trunnion front bearing and indices removed. | 0.1000 solid / 0.186 coaxial (fluid 0.035) → none | Brown draws the crank plate over the rod end; the model keeps the rod eye in front because a rear crankshaft would otherwise cut the rod at dead centre. Perspective makes the rear rails read slightly low. Plate cylinder is shorter than the official 5-unit bore. |
| 345 | Same builder as 344; trunnion rail behind the top cover with its bearing boss; plain crank block with a hidden rounded pedestal replaces the U-frame standards. | 0.1000 solid / 0.180 coaxial (fluid 0.035) → none | Same crank/rod layering note as 344; perspective lowers the rear rail slightly. |

## Reconstruction assumptions

- Shared rigid-body rule: every pin is a child of exactly one member; every other member
  carries a real bore (≈0.012 clearance) and crossing members are separated in z.
- 344/345 use one builder (`buildSourceOscillatingEngine`): the cylinder axis and rod lie
  at z 0.42, the crank at z 0.06–0.26 behind the rod, the rails behind the crank, and the
  trunnion rail behind the whole casing. Trunnion stubs stay within the barrel wall.
- 346 shares `rectangularRodPassageGeometry`, which is unchanged.

## Display-profile re-measurement needed

326, 327, 332, 333, 334, 335, 336, 337, 338, 339, 340, 341, 344, 345
(framing and geometry changed; `scripts/measure-display-profiles.mjs` was not run).
