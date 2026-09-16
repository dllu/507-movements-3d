# 506–507: source-facing supports and mounting

The primary GPT-6 Astra agent compared final default and oblique rendered views
with the local engravings during pass 47. The official [506](https://507movements.com/mm_506.html)
and [507](https://507movements.com/mm_507.html) captions were rechecked; neither
provides a registered animation. This is a later review, distinct from original
model authorship.

506 now has a continuous curved standard, a compact upper bearing bridge, a
lower bearing seated on the base and a driver bearing connected to the standard.
Shorter main, driver and planet shafts remove the long unsupported extensions.
The crank starts downward as in the engraving. The unsupported compound index
bars are hidden, while the input and carrier marks remain attached. Supports
have real shaft bores; the top bridge no longer crosses the main shaft.

507 starts with the compound planet on the left. Both spur tooth-count sums are
even, so this half-turn mounting retains the existing mating tooth phases. Its
output shaft is shortened, the output bearing has a real bore and curved foot,
and the bottom main bearing meets the base. The old solid output-bearing arm
through the shaft is removed. Near-frontal cameras reproduce the source layouts;
users can orbit to inspect the conical tooth faces and nested sleeves.

No transmission ratio, tooth profile or running speed changed. In particular,
507 still advances its output by 0.0144 degrees per carrier revolution. Both
remain analytical gear trains, without live or baked MuJoCo motion.

## Evidence and limits

The 28 focused checks pass, including two new bidirectional rendered-surface
sweeps against the changed supports at 17 shifted full-carrier-cycle phases.
The support audit exposed an initial lower-bearing/sleeve overlap; shortening
the bearing corrected it. The existing 506 framing check now uses actual mesh
vertices instead of rotating loose local bounding boxes. The source mounting
phase requires a two-ulp-scale tolerance for subtraction in its unwrapped-angle
check; the motion itself remains continuous.

```sh
node --test tests/compound-epicyclic-supports.test.mjs tests/compound-epicyclic-geometry.test.mjs tests/movement-506.test.mjs tests/movement-507.test.mjs tests/epicyclic-family-clearance.test.mjs
IDS=506 POSES=33 node scripts/review-compound-epicyclic-teeth.mjs
IDS=507 POSES=33 node scripts/review-compound-epicyclic-teeth.mjs
```

Repeated actual gear-surface audits find no penetration above 1e-6: 706,898
queries for 506 and 1,636,039 for 507. Maximum sampled working gaps are 0.008307
for 506, 0.003978 for 507's bevels and 0.000153 for its spur layers. These are
finite running clearances, not loaded zero-backlash contact. Earlier slow-bevel
period evidence remains in [the working-gear review](movement-506-507.md).

Final source/default and oblique browser views have no errors or sampled
full-cycle clipping. Maximum normalized screen extents are 0.784616 and 0.749106.
RAM evidence is under `/dev/shm/family47-epicyclic-*` and
`/dev/shm/family47-{506,507}-gear-solids.*`.

The cast contours and hidden support depths are inferred, not pixel tracings.
506's tooth counts and exact gear/support proportions remain reconstructed;
507's wheel-C spokes remain inferred from an edge-on drawing. Back-cone involute
flanks approximate exact bevel conjugacy. The selected surface sweeps do not
prove continuous all-pairs clearance, load capacity, friction or passive backlash
take-up. These limitations remain in the status ledger.

Final integration: the production build, CPU screen and packaged desktop/playback/
mobile checks pass. See the forty-seventh pass in [review progress](review-progress.md)
for the combined validation record.
