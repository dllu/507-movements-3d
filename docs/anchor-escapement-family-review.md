# Recoil and deadbeat anchor escapements: 288–289

Primary sources: [288](https://507movements.com/mm_288.html) and [289](https://507movements.com/mm_289.html), checked 2026-09-16. They share a caption distinguishing nonconcentric recoil faces from locking faces concentric with the anchor pivot. Both pages mark the animation unavailable; the engravings and caption are the references. Movement 303 shares a source module but its builder is unchanged.

**288 receives a qualified finite working-profile correction. 289 receives journal, structural-depth and framing corrections; its tooth/pallet handoff remains unresolved.**

## 288 working geometry

The original point-contact law already demonstrated recoil followed by forward impulse and free drop, with continuous positions. Its visible geometry did not implement that law: bevels extended tooth tips beyond their analytic locations, the source-profiled anchor cut through the wheel, and the left pallet's backing lay on the wrong side of its working face.

The wheel now uses the same raked tooth outline without contact-extending bevels. The left pallet has backing on the correct side; both finite pallet solids and the structural anchor are relieved by the swept wheel over the complete prescribed cycle. This is an offline analytic-envelope operation, not decorative tracing. A short front-layer strap joins the corrected left pallet to the old source-profiled anchor. It overlaps the pallet and anchor material while clearing the working tooth plane.

The existing four-second period, five-degree anchor swing, two-degree recoil, alternating tooth sequence and contact/drop laws remain unchanged. The visible marker is smaller so the working faces remain inspectable. The full escape wheel remains visible although the source crops its bottom.

## Both mechanisms

- The fixed wheel shaft now runs in an actual bored rotating hub and a close-fitting fixed bearing.
- A real anchor arbor reaches its rear journal; the former short decorative hub did not reach the fixed bearing.
- Rear bearings reach the structural standard; the shafts clear that standard. The standard is shortened to the mechanism's extent, and the display base is hidden.
- Fog and scene ground are disabled. Source-facing cameras fit sampled complete cycles; detached decorative crutch indexes are hidden. Minimum display period is four seconds.
- For 289, the structural arch moves forward out of the wheel plane while retaining overlap with its working pallets. Its original pallet solids, deadbeat lock law and impulse/drop schedule remain intact. The unresolved contact limitation is stated in the browser reconstruction note.

## Validation

```sh
node --test tests/anchor-escapement-working-solids.test.mjs \
  tests/movement-288.test.mjs tests/movement-289.test.mjs \
  tests/movement-303.test.mjs
```

29 tests pass: 24 existing regressions, including unchanged 303 behavior, and five new scoped tests. Finite tests sample actual rendered vertices, triangle centers and edge midpoints at 65 full-cycle poses plus either side of the handoff events. Selected working-pallet/anchor and journal interfaces for 288 execute 957,880 queries with minimum sampled clearance 0.001421. For 289, **only the corrected journals and structural arch** are qualified: 383,128 queries, minimum capped gap 0.005. Its working pallets are deliberately outside that passing claim.

452 active-contact poses for 288 retain a working face within 0.002014 of the analytic tooth tip. The face normal always opposes positive driving-wheel torque: the least opposing normalized dot product is −0.608. Thus the relief preserves a surface capable of resisting the intended driving direction; it does not merely remove interference. Positions remain continuous at landings/releases. The ideal velocity change at landing remains part of the prescribed law and is not an impact simulation.

Both models retain scene and GPU buffer identities during updates. Representative local cold construction is 107/29 ms; mean update over 1,000 calls is 0.0039 ms each. No CSG or profile generation runs during browser playback.

Final Chrome source/default/front/advanced views have no errors or camera clipping across 17 full-cycle poses. Maximum absolute projected X/Y is 0.890/0.869. Default rendering including shadow passes uses 36/40 draw calls and 28,544/17,552 triangles. These framing results do not qualify 289's unresolved working contact. Bulk artifacts remain in `/dev/shm/anchor-escapement-final-*`.

## Reproducing 288's finite profile

Use Node plus Python with `shapely==2.0.3` (its numpy dependency is also required):

```sh
node scripts/export-anchor-escapement-envelope.mjs /dev/shm/anchor-envelope-input.json
python scripts/generate-anchor-escapement-envelope.py /dev/shm/anchor-envelope-input.json
```

The exporter records the unchanged analytic wheel/anchor poses, original structural outline and exact pallet curves. The generator samples 2,049 cycle poses, unions the wheel sweeps in anchor coordinates, offsets the cutter by 0.0015 and simplifies by 0.00005. It checks resulting polygon validity. The checked-in baked outline is 96,220 bytes. Two runs produced identical SHA256 `cdad15ac2c2f0db7512596d258ffe227bd8f8d2add34a0a676503ff4551c5288` for `src/simulation/generated/anchor-escapement-envelopes.js`. A small finite clearance is retained; zero-gap force transmission and continuous collision certification are not claimed.

## Deferred 289 handoff

A naive sweep-clearance cut would erase up to approximately 0.316 scene units of the intended active right-pallet face. That result was rejected. Bounded experiments with a narrower tooth, swing reduced from five to two degrees, and impulse advance reduced from 1.35 to 0.35 degrees still removed over 0.11 of required active contact. Those experimental timing/profile changes were reverted.

The retained working geometry still has finite tooth/pallet interference. A separate 33-pose diagnostic measures penetration up to approximately 0.139 in the right pallet at cycle phase 0.625. This requires a compatible deadbeat pallet/tooth profile and handoff reconstruction, followed by the same active-face/reaction checks; hollowing away the intended face is not a solution. The existing exact concentric-lock point law alone is insufficient evidence for a functioning finite mechanism.

Neither mechanism validates passive pendulum energy balance, friction, impact restitution, driving torque or long-term timekeeping. Their motion remains analytically prescribed. Native contact dynamics may be useful for the unresolved deadbeat handoff once compatible finite geometry is established.
