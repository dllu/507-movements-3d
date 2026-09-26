# Pass 64 lane p64-fix-a1: support pruning and rotation cues (130–171)

Audit source: `/dev/shm/audit64/a/findings.json`. Captures (before in
`/dev/shm/p64-fix-a1/before/`, after in `/dev/shm/p64-fix-a1/views/`, tiled in
`/dev/shm/p64-fix-a1/tiles/`) cover the default pose at t=0 and t=0.5, ±60–70°
yaw, back, top and the two seam phases, each beside the plate.

Production routes matter here: 130 and 138 play baked MuJoCo bundles, 149 and
147 play baked bundles decorated at load time, and 140, 157 and 167 are built
by their own single-movement files (`toggle-punch.js`, `pinned-elbow.js`,
`reversing-groove-drum.js`). The edits below are made in those production
files.

| ID | Change | Evidence |
| --- | --- | --- |
| 130 | Quadrant cue on the baked eccentric disc (`body:cam`, turned about the shaft axis). | tiles/130-views.jpg |
| 132 | Platen-end guide plates, shoes and webs are no longer built. The columns are turned round shafts with a moulded base on each plinth and a flared capital, set 0.36 further back behind the platen, as Brown draws. | tiles/132-views.jpg |
| 135 | Triangular tappet and its boss take the accent colour, distinct from the orange disc; the disc carries the quadrant cue. | tiles/135-views.jpg |
| 138 | The baked geometry no longer adds the rear post, guide arms or shaft bearing. The guide brackets stand free and the shaft ends as a stub. The cam takes the accent colour; the carrier disc and hub carry the cue. Rebaked with the fine probe (loop seam 3e-11 px; penetration 0.063 px). | tiles/138-views.jpg |
| 140 | The rear plate's lower part now runs on behind the pedestal web (hidden from the front), so from behind it is visibly carried to the base. Its drawn lower edge stays at Brown's y=400. | views/140-back.png |
| 145 | No wheel pedestal or bearing ring, and no beam-shaft flange. The wheel shaft is a 0.72 stub; the beam's fixed shaft runs only through the beam eye. | tiles/145-views.jpg |
| 147 | At load, the small undrawn rear bracket at the lever fulcrum is cut from the baked fixed body. The fulcrum pin through the lever end and the shaft's lower bearing remain. | custom/147-side90.png |
| 149 | At load, the rear bearing bar, both rod guides and the visible slides are removed. The rods are rebuilt with no lower eye and end cleanly at Brown's break. The pivot and cam shafts are cut to short stubs. The baked slide bodies remain invisible so the rods keep their off-plate guide motion. | tiles/149-views.jpg |
| 157 | Guide channel, crosshead, slider pin, bearing rings and square mounting plates are all removed. The broad output rod hangs from the bell-crank arm, runs past the break and ends cleanly; its guide point lies off the plate. Axles are stubs. | tiles/157-views.jpg |
| 167 | The grey U-frame (arms, guide bush, back rail) is removed. A driver-coloured core closes the drum ends, which previously showed the black groove-floor cap. | tiles/167-views.jpg, z167.png |
| 171 | The foot bar under the guide columns and the bracket behind the trunnion are no longer built. The eccentric sheaves carry the cue. | tiles/171-views.jpg |

## Residuals

- 132: Brown's columns look slightly thicker (about 0.45 against 0.40). The platen hangs from the lower disc with no guide, which is kinematically ideal.
- 140: from behind, a 0.48-high gap remains below the left part of the rear plate, as the plate draws its bottom edge above the base. The plate is joined through the web.
- 147: the lever fulcrum pin at Brown's break has no visible support. It is kept as the fixed pivot.
- 149 and 157: rod swing still follows the baked or ideal guide below the plate, which is not shown.
- 167: a hairline seam shows between the drum core and the end annulus in the top view.
- 171: the trunnion shaft and bearing face stand free, as does Brown's hatched trunnion.

## Intersections and checks

`show-body-intersections --spacing=0.01 --samples=129` screens the synchronous
registry model. For 130, 138, 140, 147, 149, 157 and 167 that is the legacy
offline factory, not the production visual, so their production changes were
checked separately. Those checks were the bake and playback tests
(`twin-cam-baked`, `variable-cam-bake`, `fan-governor-baked`), the
`review-pinned-elbow-assembly`, `review-groove-drum-solids`,
`review-toggle-punch-clearance` and `review-twin-cam-bake` reports (all without
failing pairs), and `scan-bad-faces`.

- 147 (sync `authored-governors.js`): the lever post and bracket are removed.
  The post-to-bulb intersection of 0.277 and the bracket-to-bulb intersection of
  0.037 are gone. The shaft passing through the solid bulb and neck (0.95 and
  0.26) predates this change.
- 145: no pairs. 132: only the toggle-bar end joints and the shaft in its bores;
  the new columns are clear. 135: no pairs. 171: 0.028 between the astern rod
  pin and the die rod, which predates this change.
- Bad faces: the new 132 columns, 138, 140, 149, 157 and 167 are clean.
  Pre-existing flags remain on 132's head layers and 135's hex nuts.
- Loop seam 138: 0 above tolerance.
