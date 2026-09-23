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
