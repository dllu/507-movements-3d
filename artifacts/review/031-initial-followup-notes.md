# 031 · Worm generation follow-up

Movement 064's force/clearance work found an incorrect cylinder-ray bound in
the older shared worm-wheel generating code. The old expression included the
worm's axial X distance, which instead bounds a sphere. For an X-axis worm,
the cylinder condition is `(r cos(theta) - D)^2 + z^2 <= tipRadius^2`.
The correct radial interval starts at
`(D - sqrt(tipRadius^2 - z^2)) / cos(theta)`; finite worm length also clips it.
The generating sweep must cover that cylindrical intersection.

The independent refined generator used by 064 now has the corrected bounds.
Its 65-pose actual-solid sweep is clear, and the maximum normal-force power
residual is 1.17 percent. Doubling its phase and radial search resolution changes
the generated radial field by only 2.23e-15 model units.

031 still uses its previously baked shared profile. Its two existing worm
regression tests pass, but those tests do not check the actual contact-normal
power ratio. A fresh 17-pose audit now checks 12,592,563 actual surface samples with no
penetration, but finds a maximum contact-normal power residual of **5.8132
percent**, above the 2-percent criterion used for 064. Working gaps range
from 0.001195 to 0.001390. The corresponding force/geometry issue is therefore
confirmed by this diagnostic, rather than inferred only from generator code.
See `031-reopened-worm-power.json` and its log (completed with exit code 1).
The original factory, profile, helper and worm tests are archived.

An isolated corrected cylindrical-hob profile is generated in
`031-corrected-worm-profile.json`; it is not integrated. Its initial 17-pose candidate sweep completes with exit code 0: 27,256,083
checks, no penetration, 12.849–19.892 microunit working gaps and maximum
normal-force power residual 1.017 percent. See `031-corrected-worm-power.json`.
This is promising isolated evidence. A longer sweep, topology/source inspection,
shared fallback correction, integration and final regression are still due. Continue the narrower audit before counting
031 as fully reviewed: inspect loaded-flank normal power through a full worm turn,
correct the shared fallback bound and regenerate a profile if required, then
repeat contact/clearance, source rendering and regression checks. Preserve the
older baked data and evidence before replacing them.

No 031 production geometry has changed during the 064 reconstruction. The
shared helper only gained optional explicit profile/resolution inputs; its
old fallback bound and the 031 baked profile still need this follow-up.
