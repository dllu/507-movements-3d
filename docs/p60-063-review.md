# Pass 60 · p60-063 lane (movement 63, snap-action star counter)

This pass applies the user's corrections from a screenshot of the previous state.

## Changes

- **The disk is opaque.** The orange driving disk is no longer see-through.
  The dark drop now lies in front of the disk (z −0.33…−0.15) instead of behind
  it. The pins stand out from the disk's front face (to z −0.13), through the
  whole thickness of the drop.
- **The pawl is flush with the star.** The light pawl spans z −0.09…0.15,
  exactly the star's faces (it was −0.22…0.04). The pins end 0.04 behind it.
- **The pins strike only the drop.** The drop's leg is now Brown's broad
  pointed wedge (`brownLeg()` in `snap-counter-63-mechanism.js`). It has a
  straight right edge at x ≈ 891 source px and a filleted tip at y ≈ 800 source
  px, lower than the old 781. Its straight lower-left edge runs up to the lobe's
  inner edge at (716, 584). This follows the dashed wedge on Brown's
  enlargement and the user's red line. The drop plate is thicker: 0.18 instead
  of 0.08. The pins ride the lower-left edge and escape past the tip.
- **Motion law.** The solver now pushes only the drop. The pawl rides up with
  the drop and is kept out of the star by turning up on its screw (never past
  the striker). Gravity lowers it onto the star. The nose slides out of its
  space, over the next point and into the next space while the drop rises.
  When the pin escapes the tip, the spring throws the drop down and the seated
  nose turns the star.
- **Bake.** Rebaked with fingerprint 6148de4b:

  | Measure | Value |
  |---|---|
  | Advance per event | −36.0002° (normalised to exactly one point) |
  | Repeat error between events | 4e-6 rad |
  | Drop lift | 21.4° |
  | Rest | 59 of 360 steps |
  | Snap | drop fall and star drive in under 0.1 event |
  | Seams | none: delta and rho return to their start values |

- **See-through.** Brown dots the drop's leg and the disk's rim behind the
  pawl's lobe, so the pawl is the see-through part (`makeSeeThrough`). It is
  tagged with the role `see-through-broad-hooked-pawl-plate`.
- **Stages.** The `lifting-pawl-and-drop` stage no longer exists. The stages
  are rest, lifting-drop, drop-falling and star-drive.

## Checks (planar, baked event)

| Pair | Closest | Note |
|---|---|---|
| Pins to pawl | 20.7 px in plan | The pins never reach the pawl, even in plan, and they are also behind it in depth. |
| Pins to drop | 2.0 px | Contact clearance for 275 pin-steps. |
| Nose to star | 2.0 px | Contact clearance. |
| Stop pin | 0.6 px at rest | |
| Striker at rest | 1.27 px (0.005 units) | Only the striker limits the pawl's rise. It never bears in the steady cycle. |

## Intersections

`show-body-intersections.mjs 63 --spacing=0.01 --samples=129` found no pairs,
both before and after the change: 5 bodies, 17 meshes, no open meshes.

## Evidence

All captures come from a freshly restarted private server on port 44514.

| What | File |
|---|---|
| Default view beside the plate | `/dev/shm/y5/final/63-default.png` |
| Oblique view | `/dev/shm/y5/final/63-oblique.png` |
| Views at phases 0 and 0.5: yaw ±60°, side, rear, top, zoomed out | `/dev/shm/y5/final-views.png`, from `/dev/shm/y5/raw/final/63-*.png` |
| Motion strips through one pin event (phases 0.05, 0.5, 0.8, 0.9, 0.94, 0.99) | `/dev/shm/y5/final/63-strip-face.png`, `63-strip-oblique.png` |
| Close-up of the engagement (phases 0.05, 0.4, 0.8, 0.9), face and oblique | `/dev/shm/y5/final/63-zoom-face.png`, `63-zoom-oblique.png` |
| Before | `/dev/shm/y5/before/63-default.png` |

The zoomed captures show a pin on the drop leg's lower-left edge at phase 0.4
and at the tip at phase 0.8. The pawl's lobe is clear of every pin. In the
oblique view the pawl's front face is flush with the star's.

## Remaining limits and discrepancies

- Brown dashes the leg behind the disk. The model puts the drop in front of the
  opaque disk, at the user's direction. The leg's lower part therefore shows
  over the disk below the lobe.
- The lift is taken entirely by the leg, not by the pins acting on the lobe
  first, contrary to Brown's text ("a pin escapes the pawl first"). This is
  also at the user's direction.
- The drive is quasi-static with an unloaded star. The nose turns the star
  while the pawl hangs about 1 px below the striker. A variant in which the
  pawl yields to the striker before a loaded star turns fails: Brown's nose
  rides out of its space.
- The whole pawl plate is see-through, not just the lobe, so that it stays one
  plate.
- The framing changed slightly (maxNdc 0.866, previously 0.873). The display
  profile for 63 may need re-measuring.
