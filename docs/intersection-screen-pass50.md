# Pass 50 relative-motion screens for rows without a finite-interface review

Command: `node scripts/show-body-intersections.mjs ID --spacing=0.01 --samples=129`.
Depths are the worst solid, coaxial or fluid overlap between rigid bodies across the sampled cycle.
A single-body screen (255–259) has no relative motion to test and establishes nothing.
Rows stay `unknown` or `known`; these screens are not clearance certificates.

| ID | Worst overlaps | Action |
| --- | --- | --- |
| 269 | Before: frame end 0.120 and input rod 0.119 into the gear; teeth 0.100; shaft 0.100 through the post. After: teeth 0.069 during the three rack handoffs only. | The frame's closed end is extended past the gear tips; the teeth are thinned with 0.03 radial clearance; the shaft is shortened; the undrawn post is removed from the presentation. Brown's frame closes one tooth past the last rack, which a full gear cannot reach, so this departs from the plate. |
| 281 | Before: lever 0.220 coaxial with the fulcrum pin; white disk index 0.069 into the follower pin. After: none. | The lever gets a bored eye at the fulcrum; the undrawn white indices are removed and the view is Brown's front elevation. |
| 286 | Before: toe body 0.304 coaxial with the fixed rock shaft. After: only 0.0000 working contacts. | The rock shaft is made rigid with the toe, as the caption describes. |
| 216 | Before: rotating rear web 0.113 through the fixed pinion shaft. After: a 0.0014 transition-tooth graze, below the screen spacing. | The pinion shaft ends in front of the web, and the detached rear pinion bearing is removed from the presentation. Any rigid web joining the central sector and the ring must pass the pinion axis, so the pinion needs a front support, which is not modelled. |
| 277 | Before: cylinder body 0.578 coaxial with its arbor and post; ratchet and hub 0.149 over the arbor; hammer shaft 0.151 through its bearing arm. After: dog A's pivot 0.139 in its unbored stretchable link; dog A 0.126 into ratchet B; lock 0.12 into its spring and 0.07–0.091 into the cylinder; spring C 0.095 into dog A. | The cylinder, ratchet and hub are bored; the undrawn base, posts, bearing arm and white indices are removed, and the view is Brown's side elevation. The dog, spring and lock need a contact rework. |
| 304 | Pallet arbor 0.309 through the upper plate and bracket; pin-wheel hub 0.300 over the fixed arbor; pins and quarter-arc up to 0.119 through the pallets. | Recorded; this needs bores and an escapement contact rework. |
| 347 | Central ball 0.487 into the conical heads (screened as fluid); crank socket and rod 0.230; crank arm 0.228 into the pin ball; open casing meshes. | Recorded. |
| 255–259 | Single rigid body; nothing to screen. | Rows stay `unknown`. |
