# Movements 371 and 394: finite supports and reversing guide interfaces

This is a bounded source/support/guide correction. **Neither movement's tooth
mesh is contact-qualified.** The measured tooth interference below remains a
separate working-profile reconstruction task; nominal pitch residuals do not
certify those finite teeth.

## Source evidence

[371](https://507movements.com/mm_371.html) specifies a uniformly rotating pinion
passing through the left opening between two toothed wheel faces and producing
alternating output. [394](https://507movements.com/mm_394.html) specifies Parsons's
endless rack, side grooves and two unequal concentric pinion flanges. Both pages
were fetched and checked for actual inline model definitions: neither has
`ae.add_model` or `mm_present` registration. The unavailable label is not the
sole basis for that conclusion. The visible outlines use ideal circular and
elliptical geometry rather than tracing drawing noise.

## 371: source pose and finite carrier

The initial pose now starts at the rear-face terminal. This puts the opening
below the left shaft, matching the engraving, while preserving the full nine
input revolutions per alternating cycle. `stateAtInputTravel` retains its
original phase convention; `stateAtTime` includes the declared `sourceInputTravel`
offset. The 60-degree opening remains engineered and visibly larger than the
engraving; this is not an exact source-shape match.

Four analytic rounded windows replace the narrow, disconnected lobed web. Its
outer radius overlaps the rim, and its source-facing orientation places the web
arms along the source axes. The output index is a small flush mark on the shaft
end, so it does not float across a window.

The moving shaft collar and bridge, fixed output bearing, output hub, web and
bearing post now have actual holes/notches around the shafts. Two finite carrier
shoes enclose the fixed rails with rectangular openings that permit both the
front/rear slide and the small radial excursion at transfer. These supports are
inferred; Brown does not specify the carrier guide construction.

Actual rendered surface checks over 17 full-cycle poses give minimum shaft/
support clearance about **0.00494**, moving input collar/bridge clearance
**0.00496**, and rail/shoe clearance **0.00400**. The web/rim overlap is checked
as actual solid membership, not only matching radii. Nominal pitch markers are
hidden because their locations are not finite contact witnesses.

## 394: open finite guide mouths and connected rack

The old tube rails were centered on the mathematical flange envelopes, placing
wall thickness inside the flange. The inner arc also folded inside the swept
flange volume because the flange radius exceeds the small crossover radius.
It is replaced by an open mouth and finite outer semicircular working wall,
with straight entry lips. The working wall remains near the full flange at
handoff; the correction does not raise the flange out of the guide plane.

Both guides are fixed to the translating rack with planar webs and spacers
outside the pinion sweep. The conspicuous off-center hoops were rack guide
walls, not displaced shaft flanges. The actual unequal flanges remain coaxial
with the pinion; their rim accents are now inset within their working radius.
The guide shape and one-plus-three-pitch handoff allocation remain inferred,
not recovered source dimensions.

The rack teeth previously ended about **0.14** short of their body. A finite
closed stadium frame now connects their outer roots. The input guide contains
an actual transverse capsule opening, allowing the prescribed ±0.1 shift. Its
location and rod length keep the rod through the guide for the complete stroke,
including crossover overtravel, while its end collar clears. An inclined
support connects that guide to the bed.

The final scoped surface checks give:

- Rod/guide minimum clearance **0.004969**.
- End collar/guide minimum clearance **0.072162**.
- Full flanges/rim accents to guide walls and attachments: minimum **0.000591**.
- Maximum nearest working-wall gap during selected handoffs: **0.000787**.
- Pinion to guide walls/attachments: minimum **0.156121** in the tested poses.

The circular working normals point through the flange axis and therefore
supply **zero ideal shaft torque**. The prescribed angular handoff assumes
no-slip friction; preload, friction capacity, pickup and passive reversal are
not solved. A near wall and a zero pitch-speed residual do not validate that
frictional transmission.

## Remaining finite tooth witnesses

Phase means fraction of the full 27-second authored cycle for 371 and the
8-second authored cycle for 394, including 371's new source-pose offset.

| Movement/pair | Phase | Penetration | Witness in target-local coordinates |
| --- | ---: | ---: | --- |
| 371 pinion / annular wheel body | 0.0625 | 0.073963 | (−0.378273, 1.910888, 0.0000374) |
| 371 pinion / face tooth 11 | 0.3125 | 0.037495 | (0.285433, −0.0212064, −0.00000537) |
| 394 pinion / rack tooth 10 | 0.9375 | 0.087369 | (0.00472479, −0.00312385, 0.0600000) |

371's finite face depth and pinion require a joint three-dimensional tooth/root
profile, including the terminal rollover. 394 needs a compatible internal-rack
and pinion profile through the transverse switch; merely cutting the intersecting
volumes would not establish a useful driving flank. The scoped regressions
bound these existing residuals without requiring them to remain nonzero, allowing
future corrections to improve them.

## Checks and presentation

```sh
node --test tests/reversing-transmission-working-solids.test.mjs tests/movement-371.test.mjs tests/movement-394.test.mjs
```

**22 checks pass**: 17 existing motion/source regressions and five new finite
support, guide contact, residual and scene/framing checks. Geometry identities
remain stable during playback. Camera bounds use actual visible vertices over
the complete mechanism cycle; ground and fog are disabled. The minimum display
beat is three seconds per 371 input revolution (27 seconds for the full cycle),
and eight seconds for the complete 394 rack cycle.

Root's source/default/oblique review found no errors or clipping, with full-cycle
normalized extents **0.90744 / 0.91180** after the final index and support corrections.
Evidence: `/dev/shm/family45-reversing-browser-review.json`.
No native simulation or browser physics was introduced in this pass.
