# Reed escapement 396: finite working contact

Sources: [Brown movement 396](https://507movements.com/mm_396.html), its local engraving, and [Reed's US31999A patent](https://patents.google.com/patent/US31999A/en). The actual official HTML checked on 2026-09-16 marks Animated unavailable and has no inline model registration. The patent identifies G as the combined locking/lever-impulse pallet, F as a detent, and J as the direct balance impulse pallet. It does not specify the reconstruction's dimensions or timing.

## Corrected geometry and law

Previously F/G stopped 0.044 model units ahead of the wheel and J stopped 0.004 ahead. J also floated 0.17 from its staff and 0.05 from the roller. The nominal lock test compared only points in the XY plane; the rendered surfaces could not contact.

The replacement preserves the complete twelve-tooth wheel, puts finite F/G and J faces in the wheel plane, and provides rigid necks and a collar attaching them to their respective bodies. The crosspiece joins the crook. Three curved webs replace six straight spoke arms on the escape wheel, and the inferred balance spokes now reach its rim. Actual bored rear journals and connected standards support all three shafts. The wheel index is seated on its hub; redundant contact balls are hidden. The default camera faces the source and the model hides the ground, disables fog and specifies a six-second minimum display cycle.

The old lever bank mapping drove its active upper pallet farther into the wheel. With finite faces it remained trapped, producing only approximately 0.017 radians of wheel motion followed by recoil. Reversing the lever banks permits each selected pallet to withdraw outward. The original balance direction is retained. Radial-biased F/G lands provide actual resisting contacts; J has a lower vertical working land so its reaction assists the opposite balance stroke.

A reproducible offline continuation follows clockwise wheel tendency subject to the finite tooth/pallet polygons. It produces short loaded arcs, explicit unloaded drop at a prescribed maximum 0.5 radians/second, F capture, F withdrawal, direct J impulse and G capture. It advances exactly one tooth per four-second authored balance cycle. Playback interpolates the retained result and binary-searches time knots; it performs no contact solve or geometry construction. Event knots are refined offline where a straight interpolation chord would intersect a moving face. Public contact flags, rotor transforms and step progress use this new law. The original event law is available only as `nominalStateAtTime396`.

## Remaining qualification

This is a finite kinematic reconstruction, not a passive watch dynamics simulation. Balance/lever timing, drive speed, spring action, fork coupling, friction and impact are prescribed. In particular, the straight F land receives work during withdrawal; the patent's strict detent-only energy transfer is not established. This limitation appears in the viewer.

A short annular F land centered on the lever pivot would have zero lever moment nominally, but its radial reaction at the existing tip is about 48.08 degrees while the actual tooth's admissible corner-normal cone begins near 81.88 degrees. An actual annular candidate of radius 0.8845578612 penetrated the rendered wheel by 0.00028122 at world (1.572804, −0.643238, −0.08). Thus a nominal concentric face alone is not a solution. A follow-up should jointly reconstruct the incoming hooked/raked tooth flank, F's circular detent and the affected G/J branches. No load face was removed to conceal this issue.

## Reproduction and checks

```sh
node scripts/generate-reed-396-contact.mjs --check
node --test tests/movement-396.test.mjs tests/reed-396-working-parts.test.mjs
```

Focused tests cover actual rendered pallet/neck/wheel surfaces and journals across shifted poses and a later tooth cycle, additional off-knot contact checks, useful G/J normal directions, all newly attached parts, indexing/metadata continuity and retained geometry buffers. They do not certify the unresolved fork or general all-pairs clearance. Browser/source inspection and packaged playback are performed centrally by the integrating agent.

Final focused results: all five finite checks and all ten movement regressions pass. The rendered-solid sweep made 4,478,988 queries, with minimum signed gap −2.73e−8 (floating-point boundary error). Shifted samples between every pair of bake knots reached −7.71e−9; the greatest adjacent wheel-angle step is 0.00048828125 radians. Selected resisting wheel moments are at least 0.88493 for G and 0.57336 for J. Their corresponding output-power direction proxies are positive (J minimum 0.081688); these validate direction, not force magnitude or energy transfer through the unresolved fork.

The bake contains 5,415 knots, including 1,318 adaptive additions around changing contact. `--check` reproduces it byte-for-byte. SHA-256: `2b0add0905528160ee7592d34a9632efb79d9f3eff061bcc222bb032846cac7c`. RAM evidence: `/dev/shm/reed396-tests.log`, `/dev/shm/reed396-legacy-final.log`, `/dev/shm/reed396-check.log`, and `/dev/shm/reed396-annular-witness.mjs`. Root's preliminary source/oblique review reported no errors or clipping, maximum normalized extent 0.9015; final presentation is checked centrally.

Final root inspection confirms the source/default and oblique views, plus packaged
desktop playback and mobile resizing. No browser errors or sampled frustum clipping
were found; the maximum normalized extent is 0.901466. The production build and
packaged case pass. These presentation checks do not close the F/fork residuals.
