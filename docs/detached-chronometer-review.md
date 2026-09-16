# 308 / 314: detached escapement and lever chronometer

This pass closes two concrete working-interface failures: **308's finite pin
locking catch** and **314's banking-tail interference**. It also corrects pin
mounting and selected pivot/journal interfaces. The complete escapements remain
partial reconstructions: their other prescribed contacts are not qualified.

## Primary references

The [308 caption and engraving](https://507movements.com/mm_308.html) describe one
impulse pallet I, a separately pivoted locking lever Q, and a pendulum-mounted
click C that unlocks Q on the acting vibration and yields on the return.
The [314 caption and engraving](https://507movements.com/mm_314.html) distinguish
locking-only pallets A/B from the direct balance impulse at C. Both official
pages mark animation unavailable; these are independently reconstructed laws.
The factories retain their existing supplementary historical source metadata.

## 308: a real finite locking interface

The old catch was a box beyond the ends of the axial pins: its minimum depth
was 0.54, while the pins ended at 0.53. Moving that box into the working plane
revealed interference during both withdrawal and premature return. The impulse
pallet was also drawn through pin centers, and the pin row floated outside its
supporting rim.

The corrected catch is a radius-0.025 rounded locking pad. At rest its center
lies beyond the active pin along the line from Q's pivot to that pin, with a
0.0005 nominal construction clearance. Its inward reaction opposes clockwise
wheel torque; initial detent rotation pulls the rounded pad away tangentially.
A −3° withdrawal and return during the last 20% of the wheel step clear both the
outgoing and incoming finite pins. The former early return completed after only
78% of the impulse interval.

The pad now spans depth 0.47–0.67, overlapping the pin working depth by 0.06. A
rigid bridge connects it to Q above the pin ends. The rim extends beneath every
pin, with longer spokes joining it to the hub. Wheel, pendulum and Q pivots gain
actual bores; Q's fixed arbor reaches its bored pivot eye and rail. The rounded
pad, its dimensions and its withdrawal schedule are inferred construction,
not dimensions supplied by Brown.

## 314: finite banking and arbors

The banking tail previously had a bevel beyond the prescribed stop corner;
this cut into both fixed banking pins by about 0.007 model units. Its replacement
uses the same flat outline and depth without that protruding bevel. Both actual
stop corners remain within 0.0015 of their respective finite pin surfaces.

The wheel hub and lever hub now have through bores, the lever has an arbor that
reaches its rear journal, and all three journal bodies have actual bores. Wheel
and balance shaft lengths are corrected so they clear the rear frame members.
This does not alter the alternating long/short wheel advances or the existing
balance/lever schedules.

Both models use source-facing framing fitted over the entire cycle, material
fog disabled, no ground/base display, and a four-second minimum display cycle.

## Verification

```sh
node --test tests/detached-chronometer-working.test.mjs \
  tests/movement-308.test.mjs tests/movement-314.test.mjs
```

All **23 tests pass**. The legacy 308 click test now explicitly records its
remaining contact gap instead of calling the prescribed return harmless.

| Check | Evidence |
| --- | --- |
| 308 rendered pin/catch/bridge and corrected pivot interfaces | 2,939,328 surface queries over 129 full-cycle poses plus event neighborhoods; minimum gap 0.00055247 |
| 314 rendered tail/banking pins and corrected shaft/journal/frame interfaces | 1,233,186 queries over 129 poses plus event neighborhoods; minimum gap 0.00080350 |
| 308 all 60 pins against the rounded catch | 4,097 full-cycle poses; minimum analytical clearance 0.00050000 |
| 308 active locking contact | 3,725 locked poses; 0.0005 nominal gap; reaction dot forward wheel tangent at most −0.64259 |
| 308 handoff | Continuous pad/wheel positions over the dense cycle; no pad teleport or pin penetration |
| 308 physical attachment | Pin-to-rim and pad-to-bridge overlap checked on actual solids |
| 314 stop proximity | Both actual banking corners reach their finite pins within 0.0015 |

Rendered-surface sampling uses vertices, edge midpoints and triangle centroids.
The circle/pad calculation independently covers each finite pin's complete
radial cross-section. These checks qualify the named interfaces, not all parts
of either escapement. Scene counts, geometry objects, position buffers, material
fog flags and the display-period minimum are also checked.

Final browser source/default/front/advanced captures have no browser errors or
camera clipping through 17 full-cycle poses:

| Movement | Maximum NDC extent | Draw calls | Triangles including shadows |
| --- | ---: | ---: | ---: |
| 308 | 0.884 | 184 | 18,816 |
| 314 | 0.887 | 118 | 43,436 |

Local cold factory measurements were 77/55 ms; mean update costs over 10,000
steps were 0.0110/0.0032 ms for 308/314. No sweep generation or physics solve runs
in the browser. Review images stay outside Git at
`/dev/shm/detached-chronometer-final-{308,314}-{default,front,advanced}.png`.

## Explicit remaining limits

**308:** The corrected catch's motion is prescribed. The old C–Q click law does
not physically drive it: the midpoint unlocking contact gap is about 0.06243.
The impulse tube I still follows pin centers instead of a compatible finite
contact surface. Bounded swept-profile experiments rejected clearance cuts
that removed the required active face; no hollowed impulse pallet was shipped.
The qualified catch therefore does not establish a working passive Airy clock.

**314:** The locking strips A/B, direct impulse strip C and curved fork retain
unvalidated working contact. A 65-pose preliminary diagnostic found about
0.0080/0.0114 wheel penetration at A/B and 0.0311 at C. Backing changes and a
reduced lever-amplitude experiment did not preserve compatible complete faces;
those experiments were reverted. The original wheel/pallet/lever law remains,
with its limitation stated in the browser note.

Neither model has validated train torque, impact, spring forces, friction,
pendulum/balance energy transfer or sustained running. MuJoCo is not claimed:
its force solution would not repair an incompatible prescribed geometry. A
future focused contact reconstruction should derive the remaining handoffs
before validating passive dynamics or baking a native trajectory.
