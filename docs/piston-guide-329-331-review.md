# Piston guides 329 and 331: finite working interfaces

This pass corrects finite gear, slot, guide, shaft and piston interfaces while retaining the existing analytical source motion. It does not simulate bearing loads, gear elasticity, cylinder pressure or friction.

## Source and motion

Both [329](https://507movements.com/mm_329.html) and [331](https://507movements.com/mm_331.html) have actual inline `ae.add_model` / `mm_present` animations. The raw source was inspected alongside the local engravings. Existing source dimensions and trajectory regressions remain unchanged:

- 329 uses a fixed 48-tooth internal gear and a carried 24-tooth planet. The opposite pitch-circle wrist traces a straight vertical line. The official animation explicitly replaces engraved plate C with a crank arm to expose the motion; this model retains that disclosed interpretation.
- 331 uses the original 3.75-unit crank throw, 1.25-unit journal radius and horizontal slot between the two D pillars. The journal drives exact sinusoidal crosshead translation.

Both retain the source four-second cycle through `minimumDisplayCycleSeconds`, rather than relying on overwritten timing metadata.

## 329 corrections

The planet now uses matching one-module addendum / 1.25-module dedendum. The ring's more finely sampled involute flanks have a 0.001 running backlash, with no protruding working bevel. Counts, pitch radii, center distance, indexing and analytical ratio are unchanged. The old sampled gear overlap of 0.000135 becomes approximately 0.000462 clearance; a tooth-cycle test also requires nearby working surfaces, not clearance alone.

The carried pin passes through a bored planet body and hub; the piston wrist enters a bored eye and collar. A real bored main bearing fits between the flywheel and carrier, joined to the fixed annulus by a rear web. Shorter carried/wrist pins clear that web and the fixed ring at the two dead centers. The main shaft ends behind the wrist plane, clearing the wrist's passage across the central axis. Tests retain more than 0.1 axial engagement at each named bored joint.

The old solid cylinder was behind the piston and did not contain its full stroke. The revised barrel is coaxial with the piston, has finite walls and a front inspection opening, and continues below the engraving's crop far enough to contain the complete stroke. A circular piston head fits the bore; the cover and gland have actual rod passages. The cylinder continuation and round piston section are inferred mechanical reconstruction, not a claim that the engraving specifies the hidden lower end. Existing frame-leg ends are retained; foundation details are not reconstructed.

## 331 corrections

The slot is now an unbeveled finite opening with a small running allowance. Its front trim follows the same ideal capsule, avoiding the old interpolated trim intrusion. The actual journal/slot audit changes from approximately −0.003926 penetration to +0.004279 clearance; retained working proximity is checked through the stroke.

The shoe return webs previously occupied the guide-post widths, penetrating by 0.168. Wider connected cheeks and outboard return webs embrace the actual pillars, with approximately 0.018 web clearance and 0.002 working-liner clearance. The guide-face strips sit within the fixed post envelope. The front cheeks connect to the yoke instead of floating behind it.

The shortened live shaft passes through actual bored bearing shells; the previous approximately 0.187 penetration becomes +0.00401 clearance. Rear diagonal braces connect the fixed journal to the frame. The gland is aligned with the rod and has real rectangular passages, including its bushing and supporting neck to the crossbase. A short neck connects the piston rod to the crosshead.

Rear support depths, journal/gland allowances and the gland-support neck are inferred finite construction. Their geometry is checked; loads and lubrication are not dynamically solved.

## Validation and limits

```sh
node --test tests/piston-guide-329-331-solids.test.mjs tests/movement-329.test.mjs tests/movement-331.test.mjs
```

All 21 checks pass. Two affected interface checks pass again after the final gland-neck correction. Tests cover actual gear surfaces over a complete tooth-mesh period, 33–65 full-cycle poses for named interfaces, retained joint engagement, complete piston containment, source trajectory regressions, stable scene/geometry identities, fog-free materials and four-second display timing. Finite samples qualify the named corrections; this is not an exhaustive continuous all-pairs collision certificate.

Source/default/front/rear browser review on port 43940 has no errors or viewport clipping. Final full-cycle maximum absolute NDC is 0.9259 / 0.8602 for 329 / 331, including the pin-length and gland-support corrections. Chrome is closed. Bulk review images remain outside Git at `/dev/shm/piston-guide-329331-{329,331}-{default,front,rear}.png`.

Analytical gearing and Scotch-yoke constraints are determinate here, so no MuJoCo trajectory or fluid simulation is introduced. The new supports and inspection sections remain explicit reconstruction assumptions.
