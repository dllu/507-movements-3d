# Rack outputs 282–283

Primary references: [282](https://507movements.com/mm_282.html) and
[283](https://507movements.com/mm_283.html). 282 has no official animation;
283 has an embedded Canvas model. The existing reconstruction retains its
half-turn handle stroke, equal opposite rack motion and 40/10/40/10 stroke/dwell
sequence. The original analytical pin/slot, rack travel and constant-length
cord equations remain unchanged.

Both movements now use the shared `rack-pinion-parts.js`: 25-degree involutes
and compatible straight rack flanks, with a 0.001 tooth-thickness allowance
on each member and 0.006 extra root depth. Teeth share circular/base pitch,
and phases place teeth opposite spaces. The sector in 282 is cut from that
same profile; its previous rectangular tooth overlays are removed. 368 also
reuses this helper in the same family pass.

282's straight slot and concentric guide are actual openings. The disk pin has
0.003 side clearance; the guide pin passes through its finite curved slot. The
pivot has a real bore. Disk, index and hub depths clear the lever, and new
bored rear bearings and bridges connect the disk/pivot to the frame. Short
rear hangers join the upper guide to the posts. The cord now lies in the
pulley's groove, with an appropriately offset sheave surface, connected solid
flanges and bored axle. Its fixed attachment studs and hanging weight share
the cord plane. The earlier model put the cord forward of the sheave.

283's piston barrels were 0.33 units behind the pistons; both now share one
axis. The barrels have inner walls, with 0.005 nominal piston clearance.
Actual bedplate passages admit the rods and descending racks. Open guide
channels surround each rack body while clearing the pinion tips; former solid
blocks overlapped moving parts. Shoulders join the offset rack bars to their
piston rods. A bored rear bearing supports the pinion axle, and its rotating
hub has a true shaft bore. Diagnostic contact dots are removed.

Both have source-facing default cameras, measured full-cycle bounds, no fog
and no ground plane. Construction is analytical; there is no new live physics
or expensive offline contact bake. Ideal involutes and circular slots are
appropriate here, so no ornamental contour tracing was needed.

## Verification and limits

```sh
node --test tests/movement-282.test.mjs tests/movement-283.test.mjs \
  tests/rack-output-solids.test.mjs
```

The new finite-interface regression samples actual rendered surfaces in both
directions through 65 full-cycle poses: slots, upper guide, pivot, disk/lever
layers, sector/rack and pinion/rack teeth, pulley/cord, journals, pump guides,
bedplate passages and piston/barrel. The selected surfaces show no sampled
penetration beyond 0.00002 model units. The existing dense analytical tests
check the motion laws separately. This is not exhaustive collision or loaded
contact qualification.

Default/source and oblique browser captures were inspected, with no errors.
All sampled moving vertices fit the default view; maximum projected coordinates
are about 0.905 and 0.916. The 283 cylinders remain long enough for the full
half-turn rack stroke, extending farther below the table than the abbreviated
engraving. 282 retains the previously documented longer cord needed to keep
the weight clear of the pulley through its entire travel.

Neither prescribed motion simulates backlash take-up, bearing forces or load
response. The cord is represented by a constant analytical centerline and
short cylindrical segments, with small running clearance at the sheave;
flexibility, knots and tension dynamics are not simulated. The pump cutaway
does not model check valves, compressible air or pressure forces. Tooth depths,
clearances and hidden support construction are inferred.
