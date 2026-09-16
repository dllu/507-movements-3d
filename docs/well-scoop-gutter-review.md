# Water lifting family 459–461

Primary references: [459 reciprocating well lift](https://507movements.com/mm_459.html), [460 Fairbairn bailing scoop](https://507movements.com/mm_460.html), [461 swinging gutters](https://507movements.com/mm_461.html), and their local engravings. These pages provide static captions/plates and no available official canvas animation. Dimensions, rates, colors and structural sections are reconstructed; ideal mechanical outlines replace decorative tracing.

## 459 — useful geometry correction; contact qualification remains open

The old rope wrapped two upper semicircles, then connected their vertical inner tangents with a horizontal segment, producing unsupported right-angle corners. It now uses exact circular quarter-wraps and a horizontal common top tangent. The fixed rope length is updated without changing bucket stroke or the prescribed pulley law. The cord is centered in real bored pulley grooves; both hub bores clear their axles. The spring-like tube thread is replaced by a finite closed helical flight meeting its core, using the existing screw geometry builder. Bucket shells now have finite tapered walls, and the lower shaft support has an actual bore aligned with the tilting carrier. Outboard receivers clear the moving buckets instead of cutting through them.

**459 remains partial.** The spur-like worm wheels are not a validated conjugate worm mate. Exchange, bucket tipping and tappet motion remain prescribed; the finite bucket/tappet force transfer is not established (the visible tappet pads remain axially separated from the bucket bails). No passive selector stability, engagement impact, rope tension, slip or water capture solution is claimed. The tests qualify the rope/groove, hub/axle and bucket/receiver interfaces, not the worm exchange as a complete working machine.

## 460 — scoop joints, supports and contained water

The valid analytic four-bar solution is retained, including all five selectable notch radii. The pitman is now a pair of finite bored plates outside the scoop and beam, with matching extended pins. Scoop side plates have bored trunnion and pitman bosses; the hangers no longer end inside solid geometry. Beam adjustment positions are distinct cut seats with material between them. Their pin-seat construction is a reconstruction of the engraved notched adjustment.

The sloping banks and lowered foundation clear the full scoop stroke. The fixed journals have finite bores and standards reaching their supporting banks. The receiver lies below the scoop outlet and clears the rotating trunnion bosses. A fixed-buffer, horizontally clipped water cell replaces the rectangular block that visibly protruded through the V floor. Its convex inset outline and width remain within the actual floor and side plates. Fill is still prescribed rather than conserved: this change qualifies containment, not hydraulic volume, slosh or pumping rate.

## 461 — open gutter and valve geometry

The former floors occupied the water paths, junction boxes were solid cubes, and flaps were mounted outside the conduits. The reconstructed gutter now has a connected finite back wall and side walls with open elbow chambers and terminations. Water markers lie inside those passages. Flaps have real hinge bores and supporting pins inside the chambers; their state and rendered angles share a positive opening convention in each outgoing branch's local frame. The central spindle terminates in the bored rear structural spine, clearing the nearby channel wall. The bottom scoop has a matching open section, and the old solid reservoir rim is removed.

The assembly remains one prescribed rigid pendulum. Flap timing and water transport are illustrative; valve seat sealing, pressure, water-volume conservation and passive one-way pumping are not qualified. Open passages and clear flap sweeps alone do not prove hydraulic rectification.

## Checks and playback

All three retain their authored analytic laws and enforce their complete 9.0, 7.6 and 5.8 second cycles through `minimumDisplayCycleSeconds`. Viewer ground is hidden and materials ignore fog. Source/default/front/advanced Chrome reviews report no errors; 17-pose framing sweeps give maximum NDC 0.917, 0.871 and 0.865. Final 460 water captures are retained in `/dev/shm`, alongside the earlier family captures.

The scoped regressions check stable object/geometry identities; exact rope tangent directions; finite rope/groove, hub/axle and bucket/receiver clearances; 65-pose bidirectional scoop/ground/journal and gutter/flap/support interfaces; actual notch openings; and a separate 129-pose test that refreshes the changing water surface before checking the scoop floor and sides. These are bounded sampled finite checks, not a whole-scene collision or passive physics proof.

```
node --test tests/well-scoop-gutter-solids.test.mjs tests/movement-459.test.mjs tests/movement-460.test.mjs tests/movement-461.test.mjs
```
