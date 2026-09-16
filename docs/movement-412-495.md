# Movements 412 and 495: base gearing and carried bevel pass

Primary references: [412](https://507movements.com/mm_412.html) and
[495](https://507movements.com/mm_495.html), their captions and local engravings.
Both official pages mark animation unavailable, so there is no independent 2D
motion oracle for these movements.

412 shows the **base wheel-work** in plan. Locking the drumhead to its independent
barrel gives direct drive; releasing that lock and holding the planet carrier
gives reversed output at one-third input speed. The existing 15/15/45 tooth
interpretation and stationary mode changes preserve these relationships. The
rendered view now presents this base gearing, a three-lobed bored carrier and its
actual planet journals. The separately inferred full-height capstan, transparent
barrel and selector hardware are omitted from the source view. The short input
spindle and face indicators retain readable motion. A twelve-second minimum
cycle keeps the two drive modes and intervening shifts legible.

412's inherited 20-degree teeth had small but measurable internal mesh
interference (about 0.00079 model units in the baseline sample). All four external
gears and the internal annulus now use matching 25-degree involutes, with module
0.12, common base pitch 0.341670 and 0.001 internal backlash. The analytic
transverse contact ratios are 1.35847 for sun/planet and 1.62602 for planet/ring.
The central shaft and each planet stud clear real openings in the gear bodies,
hubs and carrier. The three-lobed web is assembled from ideal arcs and strips;
no decorative tracing or browser cutting of working tooth profiles is involved.

495 is the equal-bevel Entwistle train: fixed A, carried B on shaft D's stud E,
and loose C with its attached drum. C turns twice per D revolution. The existing
common-apex conical geometry is reused. C was mounted half a tooth out of phase,
causing approximately 0.014 model units of sampled penetration. Correcting its
mount phase aligns both meshes. Its inherited shallow 0.145 tooth depth had a
virtual-gear contact ratio of only 0.916; a bounded 0.22-depth correction raises
that estimate to 1.32977 while retaining sampled finite clearance across the
complete tooth period. The planet is now actually bored for its shortened
stud; the input collar, fixed shaft bearings and independent output sleeve/drum
also have verified shaft passages. The output index no longer blocks its shaft
opening. The source bedplate remains, narrowed to a support rather than a broad
platform, and its rear standard's foot meets that plate. The six-second minimum
carrier cycle preserves the source's 2:1 speed ratio.

Both models explicitly disable material fog and omit the scene ground. Default,
source-facing and advanced-phase comparisons were captured on the shared Vite
server, with review artifacts retained only in RAM.

## Evidence and limits

`scripts/review-capstan-entwistle-solids.mjs` merges the **actual rendered tooth
and body meshes**, then tests surface vertices, edge midpoints and triangle
centers against the opposing solid in both directions. It records finite
triangle distances as well as containment. The committed report
`validation/412-495-gear-solids.json` samples 33 poses: the full prescribed 412
mode cycle and one complete 495 tooth period. Source hashes include the authored
factories, corrections, miter constructor and shared tooth/body primitives.
Shaft clearances, phase, common base pitch, contact ratios, material fog and
source-focused presentation have separate focused tests.

These are sampled geometric checks and ideal prescribed gearing laws, not a
loaded dynamics simulation or proof of continuous collision freedom. The bevel
profiles are the shared back-cone involute approximation, not generated octoid
flanks. Tooth counts, pressure angles, widths, fits and support depths are
reconstruction choices where the engravings are silent. Brown draws 495 in
section; the visualization supplies the complete rotatable solids. For 412,
the small exterior locking levers and hidden selector construction remain omitted;
its two states and at-rest changes are prescribed, without passive locking or
load-transfer validation. Hidden legacy parts and analytic selectors are retained
for compatibility, and the visible reconstruction note discloses the omission.

Final qualification: **21 focused tests pass**. The 33-pose rendered-solids audit
reports zero sampled penetrations in 1,496,257 queries for 412 and 441,886 for
495. Maximum nearest working-surface gaps are 0.000424 and 0.001852 model units.
The final independent-journal checks also cover axial seats: the carrier collar
is 0.32 long so it clears both side-gear hubs, and the planet hub starts at 0.32
above the common apex so it clears the collar's 0.28 radius. These are tested
separately from the working tooth surfaces.

Browser source/default/advanced captures produced no page errors. The base-only
412 view renders approximately 55,000 triangles including shadows; 495 about
57,000. The final collar/hub seat shortening followed those captures and is
covered by the independent-journal tests. Root integration supplies the final
packaged-browser check.
