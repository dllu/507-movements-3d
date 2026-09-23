# Verge and crown-wheel family review (pass 49)

Movements 234, 298, 299 and 302 share `makeCrownEscapeWheel` and the verge
pallets of `vergeAndCrownWheelEscapement` in
[authored-escapements.js](../src/simulation/authored-escapements.js). All four
keep the existing analytical tip/pallet law; MuJoCo is not used.

Reviewer: Claude Opus 5.5 — primary agent, 2026-09-23. Production-route
captures (`scripts/review-movement-source-views.mjs`) were inspected beside
each engraving before and after the correction.

## Defects found

A new rendered-solid audit,
[audit-verge-crown-clearances.mjs](../scripts/audit-verge-crown-clearances.mjs),
compares every visible mesh carried by the verge with every visible mesh on the
crown-wheel rotor in both directions. Before correction (129 phases):

| Movement | Deepest penetration | Pair |
| --- | --- | --- |
| 234 | 0.08584 | right release edge / crown tooth |
| 298 | 0.05464 | right pallet neck / tip ridge |
| 299 | 0.11250 | right release edge / crown tooth |
| 302 | 0.16088 | right pallet carrier / crown tooth |

Causes:

1. **Right pallet body on the tooth side.** The tip law places each active tip
   on the local `y = 0` plane of its pallet. At the right pallet the
   counterclockwise tip moves toward local `+y`, so the pallet must lie at
   `y > 0`; it was built at `y < 0`, overlapping the tooth it was meant to
   stop. The left pallet was already correct.
2. **Symmetric teeth.** The crown teeth were symmetric triangular prisms,
   which cannot escape in only one direction and whose leading flank crosses a
   pallet plane at small pallet angles. Brown's 302 (and the verge
   convention in 234/299) show saw teeth: an axial leading face and inclined
   back. Crops of the 302 plate confirm the leading faces in the arrow
   direction.
3. **Oblique radial tip.** A radial tip edge is not parallel to either pallet
   plane; its outer corner always reaches the plane first. The tooth was
   centred on the contact orbit, so its outer half entered the face.
4. **Diagnostic solids.** Dark tip ridges, 302's tooth-tip witness sphere and
   the white contact-marker spheres all intersected pallets by construction.

## Correction

- Saw teeth: axial leading face in the running direction, back spanning 0.62
  pitch, radial span `[contactRadius − depth, contactRadius]` so the outer tip
  corner is the contact point. Tooth count, orbit, tip height and the solved
  contact law are unchanged.
- Each pallet's neck, face, release edge and (302) carrier lie on the side
  away from the teeth (`pallet.userData.bodySide`).
- Tip ridges removed; 302's rotation witness moved onto the wheel face inside
  tooth 0; contact markers still track the contact (`userData.active`) but do
  not render.

## Evidence

- Dense audit, 513 phases, 0.02 surface spacing
  (`--samples=513 --spacing=0.02`): 234 has no sampled penetration; 298, 299
  and 302 report only the working tip touching its face (< 1e-5).
- [verge-crown-working-solids.test.mjs](../tests/verge-crown-working-solids.test.mjs)
  checks all four at 97 phases, checks the saw profile and outer contact
  corner, and includes a negative control that restores the old right-pallet
  side (> 0.02 penetration detected).
- The 32 existing 234/298/299/302 movement tests pass, with the marker
  assertions updated to hidden/active.

Scope: verge-carried meshes against crown-rotor meshes only. The crown arbor,
fixed frame, 298's contrate train and 302's lower pinion are not part of this
audit.

## Remaining limits

- **234:** the pallets are plain rectangular plates rather than Brown's hooked
  flags A; the frame is added. Recoil/impulse loads are prescribed.
- **298:** the lower-left source wheel is drawn face-on in the vertical plane
  with saw teeth; the model shows the 32-pin contrate wheel horizontal. The
  drum-like crown in the plate is interpreted as the crown wheel edge-on; that
  interpretation is not re-derived here.
- **299:** Brown's edge-on section shows two tall teeth; the model's full crown
  shows all thirteen from an oblique camera, so the source view is not
  reproduced directly.
- **302:** pallets A/B are small blocks rather than the drawn blades, and the
  source's second, lower weight is shown opposite the upper one on a rigid arm
  as inferred.

All four still use prescribed balance/foliot motion with ideal drops; impact,
friction and escapement energy are not solved.

## Other pass-49 visual inspections

The same captures were inspected for the other movements lacking a
movement-specific finite-interface review. Their intersection status remains
unknown; these notes record what was visible.

- **300/301 (Debaufre):** teeth are much broader than Brown's thin hooked
  teeth; the wheel spokes read as loose sticks crossing the hub; 301's side
  elevation is not framed side-on (pallet arbor end-on, wheels close together
  with the half-disk pallet between them).
- **303 (Graham):** symmetric saw teeth, thin bar arms instead of the D–C–E
  anchor, a post in line with the wheel and rendered contact markers. Corrected
  later in this pass; see the [303 anchor review](graham-303-anchor-review.md).
- **304 (pin wheel):** pins and pallet broadly follow the source, but the
  pallet is a thin V instead of Brown's broad plate hung from a disk; white
  index markers sit at the hub and pallet tip.
- **309 (Mudge):** faithful arm/fork-pin layout; round disk weights instead of
  balls, and an added rectangular frame.
- **310 (three-legged gravity):** faithful pallet frame and three-legged wheel.
- **311 (double three-legged):** the arms are curved, crossing 3D rods rather
  than Brown's planar diamond of straight arms; the layout is hard to read.
- **312 (Bloxam):** broadly faithful; added trapezoid frame; T-headed teeth
  approximate the drawn stops.
- **269 (mutilated racks):** faithful; an added stand supports the gear.
- **277 (Colt):** broadly faithful cylinder, ratchet and hammer; the dog and
  spring are small and hard to see at the default distance.
- **347 (disk engine):** conical heads and ball seat are shown as a translucent
  drum rather than Brown's section; crank and flywheel read correctly.
