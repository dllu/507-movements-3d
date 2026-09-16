# Spinning and fan family: 496–497

## Primary references

[496](https://507movements.com/mm_496.html) specifies faster front drawing rolls B, slower back rolls A, and a rotating throstle that twists and winds the yarn. Its page supplies no official canvas animation. [497](https://507movements.com/mm_497.html) supplies a three-blade, counterclockwise canvas animation and specifies air entering circular side openings before discharge through the spout. The existing four-second fan revolution follows that animation. Pages and engravings checked 2026-09-16.

The pass retains analytically prescribed motion and source topology. No decorative tracing, new force simulation or browser CSG is used.

## Mechanical corrections

496:

- The roller flutes now fit inside their nominal radius. Opposed roller centers leave a small finite nip opening, with flattened input/drafted roving passing through it rather than thick cylinders crossing the roller surfaces. The 1:2 back/front speed ratio remains unchanged.
- Roller bodies and bearings have shaft bores. Bridges connect the bearings to the standards; face indexes clear the journal ends and bores.
- The bobbin barrel and flanges have real bores around the independently rotating spindle. The barrel supports the illustrated wound yarn instead of leaving a large gap. The spindle's whorl is bored, and its lower journal clears the whorl.
- The spindle ends below the yarn guide. A slotted hollow neck supports the upper guide while admitting the yarn. The live yarn passes outside the front lower roller, down through the upper guide, out the neck slot, alongside the flyer, through its arm eye and to the winding radius. The original flyer arm ended at the eye center and blocked the hole; its endpoint now joins the eye perimeter.
- The existing dynamic cable uses 36 fixed cylinder meshes. Updates change their transforms, not their geometry buffers. The revised route is continuous through a complete cycle; measured curve length is 5.4735685–5.4735697 scene units across 65 poses. Length is effectively constant at this sampling resolution; this does not constitute elastic-string validation.
- The display bed is hidden, the camera bounds follow visible hardware, and a slightly leftward view exposes the bobbin. A minimum twelve-second display cycle makes each of the six flyer revolutions take two seconds without changing any ratio.

497:

- Actual old blade tips reached roughly 3.63 scene units, although metadata claimed 3.05. The blade outline is scaled to a measured radius of 3.30, clearing the volute and tongue throughout rotation; metadata now reflects that radius.
- A single continuous finite wall follows the actual side-plate outline. The old independently interpolated short wall panels are hidden. The spout remains open.
- Shaft bearings have close bores and spider supports connected to the inlet rim/casing. The impeller hub is bored and its index clears the bore.
- Intake paths avoid the hub and stationary spiders, continue outward through the impeller region, and leave through the open spout. Transparent materials have depth writing and opaque shadows disabled so the blades remain visible.
- Minimum display cycle is four seconds, matching the official animation. The near-front view shows the blade hand and volute arrangement.

Both models disable material fog and hide scene ground. Shared bored-lathe and finite-plate components are reused; there is no expensive offline generation for these shapes.

## Validation

```sh
node --test tests/spinning-fan-working-interfaces.test.mjs \
  tests/movement-496.test.mjs tests/movement-497.test.mjs
```

17 tests pass: 13 existing source/kinematic/continuity/framing tests and four scoped tests. The existing yarn-length range is updated for the longer hardware-clearing route. The camera test bounds visible meshes rather than the hidden display bed.

The finite audit uses actual rendered mesh vertices, edge midpoints and face centroids at 17 poses spanning each complete authored cycle. Intermediate phases are slightly offset to avoid repeatedly sampling identical roller-flute angles. Extra sections through shaft triangles catch thin journals between ordinary cylinder sample points. Each moving cable cylinder's complete world transform is refreshed every pose; its cached local geometry is invariant.

- 496: 8,112,400 selected queries; minimum sampled gap 0.003917 scene units. Checks include opposed rolls, roving/nips, shaft journals, bobbin bores, and the posed live yarn against rollers, spindle, neck, guides, flyer arms and bobbin hardware.
- 497: 7,945,732 selected queries; minimum sampled gap 0.003839. Checks include impeller/casing, inlet rims and spiders, shaft journals, and airflow markers against the hub and stationary passages.
- No selected penetration exceeds the 1e-5 tolerance. This is a bounded sampled audit, not exhaustive continuous collision certification.
- Tests also retain scene objects and GPU buffers across updates, and verify timing, fog/ground flags and explicit motion limitations.
- Chrome source/default/front/advanced-phase review found no errors or cycle clipping. Final maximum absolute projected vertex coordinates: 0.790 (496), 0.787 (497). Render counts including passes/shadows: 308 calls / 46,392 triangles and 69 calls / 40,532 triangles. Bulk captures/logs remain in `/dev/shm`.
- Representative local cold construction: about 75/60 ms; mean update over 1,000 calls: 0.082/0.016 ms. No new geometry is generated during playback.

## Remaining limits

496 still prescribes drafting, flyer and bobbin rates. The nominal delivery/take-up speed equation is retained, but fiber compression, gripping friction, twist mechanics, yarn tension and passive bobbin drag are not solved. Flattened roving and the small nip clearance are a visual reconstruction, not validated textile contact. Existing wound turns remain a fixed illustrative package: the live thread is neither deposited into that package nor prevented from crossing its decorative turns. Package growth and a traversing winding guide are absent. Selected finite checks exclude those decorative yarn/package interactions.

497's particles are explanatory streamlines, not fluid parcels. Their clearance from the hub and stationary passages does not establish clearance from rotating blades, pressure rise, efficiency, or a solved flow field. The impeller is driven at the source's prescribed display rate. No MuJoCo or CFD qualification is claimed for either mechanism.
