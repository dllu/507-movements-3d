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
| 304 | Before: pallet arbor 0.309 through the upper plate and bracket; pin-wheel hub 0.300 and spokes 0.129 over the fixed arbor. After: preferred-B pins and rivets 0.120 through the outer arm-to-bit bridge and 0.079 through the inner offset post and working block. | The upper plate and hub are bored, the spokes start at the hub, and the bracket stops at the plate rim; the undrawn base, indices and contact marker are removed. The outer bridge lies in the pin plane by design (only the inner arm doglegs), so clearing it needs a pallet redesign. |
| 347 | Central ball 0.487 into the conical heads (screened as fluid); crank socket and rod 0.230; crank arm 0.228 into the pin ball; open casing meshes. | Recorded. |
| 255–259 | Single rigid body; nothing to screen. | Rows stay `unknown`. |
| 137 | Synchronous authored-cams model only. Before: fork boss 0.250 over its fixed shaft; rolling wheels 0.232 over their pins. After: fork arms 0.184 into the pivot shaft; eccentric 0.151 into the outer bow; stretchable valve link up to 0.171. | The boss and rollers are bored in the synchronous model. Production plays baked geometry from `mujoco-expansion-eccentric/geometry.js`, which this screen does not cover. |
| 138 | Before: cam-bearing arm 0.169 over the input shaft. After: resting point 0.093 into the cam edge at one pose. | The arm ends at its bearing ring. The bake embeds this geometry and was regenerated with its saved options; the motion is unchanged. |
| 215 | 0.001 driver-pin graze; an open decorative highlight is excluded. | Clear at the sampled poses. |
| 445, 446 | No solid overlaps; the water shapes overlap each other by up to 0.40. | Clear for solids. |
| 496 | Before: white roll indices 0.010 into the bearing bridge. After: the yarn meets its package by 0.024 where it winds on; rolls 0.005 in the bridge. | The undrawn roll indices are removed. |
