# Annular and stud escapements: 290 / 292

The [290 source](https://507movements.com/mm_290.html) supplies the seven-tooth
wheel inside a suspended annulus; [292](https://507movements.com/mm_292.html)
specifies alternate front/rear studs and concentric deadbeat pallets. Both pages
were checked directly: Animated is unavailable and neither contains a canvas
model. Timing remains independently reconstructed. These regular mechanical
curves need analytical construction, not raster tracing.

## Corrections

- **290:** thicken each pallet outward from the wheel center. The old backing
  direction, relative to the distant suspension, put the left block through the
  teeth. Remove bevels from working surfaces and use a 0.0001 outward allowance.
  Place the short supporting bridges in the front layer where they overlap both
  pallet backing and annulus while clearing the wheel. Replace the round torus
  with the engraving's flat annulus. Add a real disk/hub bore, fixed journals,
  and an arbor reaching the suspension journal.
- **292:** connect all four spokes to both hub and rim without blocking the
  shaft passage. Replace the faceted rim with a circular finite ring, bore the
  wheel hub and fixed bearings, and extend the pallet arbor into its journal.
  Replace floating indicators with small flush face marks.
- Both reuse `annular-stud-working-parts.js`, omit the invented pedestal and
  invisible framing box, fit visible geometry across the full cycle, disable
  ground/fog, and retain a minimum four-second display cycle. No geometry is
  rebuilt during playback. The separate 304 builder is unchanged.

## Evidence

```sh
node --test tests/annular-stud-working-solids.test.mjs \
  tests/movement-290.test.mjs tests/movement-292.test.mjs \
  tests/movement-304.test.mjs
```

All 31 checks pass. Rendered surface samples at 257 cycle poses and landing/
release neighborhoods make 4,004,150 finite queries for 290 and 1,290,020 for
292's corrected interfaces. Minimum gaps are 0.000024 and at least 0.005,
respectively. The 292 number **does not include its unresolved working pallets**.
The 290 sweep includes the complete wheel against both pallets, bridges,
annulus and rods, plus its shaft interfaces.

At 834 active poses, 290's actual finite boundary stays within 0.000073 of the
intended tooth tip. The reaction normal's dot product with clockwise wheel
motion is at most −0.675, opposing drive on both pallets. Separate solid overlap
checks verify both bridge attachments and all four 292 spoke attachments.
Geometry/buffer identity and visible-cycle bounds remain stable.

Default and oblique source comparisons, plus 17-pose browser checks, show no
errors or camera clipping. Maximum NDC extent is 0.889 for 290 and 0.883 for
292. The full stud wheel remains available even though Brown cropped it.
Review captures live outside Git in
`/dev/shm/annular-stud29-after-{290,292}-{default,oblique}.png`.

## Remaining limits

290 has qualified finite clearance along a **prescribed** recoil/drop path.
Its ideal landing velocity change, pendulum energy balance, friction and impact
forces have not been passively simulated. Close clearance is not a solved
force contact.

292 still has an incompatible finite stud/pallet handoff. A preliminary
65-pose sweep found up to 0.0577 model units of penetration into working blocks
and 0.0517 into arms/bridges; an impulse-edge tube also intersects a stud.
Those working faces and timing are deliberately retained pending a coherent
contact reconstruction, rather than hollowing away the intended lock faces.
The corrected journals and attachments do not qualify the mechanism as a whole.
