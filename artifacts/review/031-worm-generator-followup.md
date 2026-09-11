# 031 · Worm generation follow-up

The shared cylindrical-ray bound and 031 production geometry are now corrected.
The source-fitted 29-tooth reconstruction is verified. Mechanical, numerical,
source and desktop/mobile checks pass. Browser coverage passes across the
23/24 full run and an unchanged rerun of 057 after an overall timeout; the
original failure and its trace are retained and qualified in the record. See
[the reconstruction notes](031-reconstruction-notes.md) and
[the review record](031-reconstruction.json).

The baseline's 5.813-percent actual normal-force power residual is preserved in
`031-reopened-worm-power.json`. The first corrected 30-tooth candidate passed
its 65-pose force/clearance, eight-pair hardware and generating-convergence checks.
Source inspection then favored 29 regularized teeth and different shaft
overhang/thickness. The final 29-tooth pair passes 65 worm poses with a maximum
1.252-percent power residual and 6.054–14.616 microunit working gaps. Its
combined hardware/contact audit checks 259,692,596 surface samples without
penetration, and all six physical solids close with outward normals.

The runtime fallback now shares the corrected continuous cylindrical hob
generator with offline studies. The stored 031 profile exactly matches fresh
generation, and other contact tables are byte-identical. The earlier notes and
trial evidence are retained in `031-initial-followup-notes.md` and the separate
`031-corrected-*` reports. Final evidence uses `031-source-29-*` and the
integrated captures/regressions.
