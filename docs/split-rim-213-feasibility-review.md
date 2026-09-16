# Movement 213: finite-pin feasibility before motion reconstruction

Historical read-only study, committed as `74940a7`. Reproduce it at that revision;
the later [finite contact reconstruction](split-rim-213-contact-review.md)
changes the radial flanks and invalidates this script's old-profile assertions.
No production geometry or playback was changed by the study itself. Run:

```sh
node scripts/check-split-rim-213-feasibility.mjs --branch
```

The [213 caption](https://507movements.com/mm_213.html) calls this another stop for the preceding mechanism's purpose. [212](https://507movements.com/mm_212.html) identifies that purpose as limiting winding revolutions. The 213 engraving shows a face pin and a partially toothed split ring; it does not prescribe a dimensioned radial tooth form or an exact motion law. The current implementation infers five installed teeth, 22 equivalent pitches and one pitch of indexing per input revolution. Those inferred dimensions must be compatible with the full pin, rather than treating its center as a point follower.

## A regular passage cannot fit the current pin

At closest approach, the pin-center distance from the stop axis is
`rho = centerDistance − facePinOrbitRadius = 1.896552809`.

For the current radial flanks, the regular gap's half angle is
`beta = pitch × (1 − topFraction) / 2 = 0.0913917863`.
The largest circle that can fit between these flanks at that radius has radius
`rho × sin(beta) = 0.173088162`. The actual pin radius is **0.191573744**,
so even centering it perfectly between the two flanks leaves **0.018485582**
overlap. Rotating the stop to favor either flank makes clearance to the other worse.

The perpendicular foot radius is **1.888637881**, strictly between the tooth root **1.7** and tip **2.124126229**. This is contact with the finite flank interiors, not an invalid infinite-line extrapolation. The actual rendered 32-sided pin contains a circle of radius **0.190651264**, which still exceeds the available space by **0.017563102** for every pin clocking.

The script checks the complete production outline and actual stop mesh. A point on the full pin circle at stop-local `[0.456297355, -1.832983969, 0]` penetrates the rendered mesh by **0.018485490**. These measurements establish a real finite-width incompatibility in a regular tooth passage. A phase-only playback change cannot fix it.

## The trial branch also fails continuity

The root trial in `/dev/shm/213-branch42.mjs` initially follows a clockwise contact branch, then its search accepts nearby *different* tooth gaps. The first such jump occurs at input **5.213605726 radians**, from output **0.717832219** to **0.429864606**, a discontinuity of **1.008292 pitches**. Only **0.252159 pitch** of continuous advancement precedes it. The subsequent roughly one-pitch jump and reported jam therefore do not constitute a valid two-pitch continuous motion.

The checked-in script's optional `--branch` control reproduces and rejects the first disconnected jump. Its angular search is diagnostic, not a validated passive-contact solver, and no trial path is baked into production.

## Bounded next construction

With the current pitch, centers, pin radius and radial flanks, the tooth-top fraction must be at most **0.291426061** even before adding running clearance. A trial fraction of **0.28** would allow radius **0.194652147**, giving **0.003078403** local side clearance while retaining finite teeth. The root would have only approximately **0.004979065** radial clearance below the pin, so it also needs explicit checking. This is a feasible *local passage*, not a validated mechanism or a recommendation to shrink geometry indiscriminately.

The next correction should generate the regular tooth flanks and one-pitch input/output relation together from the finite pin envelope, preserve a useful clockwise retaining normal, and continue the same contact branch through entry and exit. Then reconstruct both terminal shoulders with the finite pin and check reverse winding. Keep full pin radius, positive tooth material, split ring and the source's winding limit. Merely widening the passage does not establish one-pitch indexing, frictional holding, passive branch selection or terminal stopping. No native simulation, browser session or production rewrite was started in this study.
