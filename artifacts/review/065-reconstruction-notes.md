# 065 · Tappet index with a two-ended stop

The rebuilt model is integrated and verified. The archived baseline remains available for comparison. The official page marks
animation unavailable; its HTML is saved as `../reference/mm_065.html`.
The unchanged Brown enlargement is `../reference/brown-065-detail.png`, from
PDF page 24 (printed page 20), scale-to 6000, crop x3150/y2710/1400×870.
That reference is inspected. Four integrated baseline frames at authored phases
0, 0.03, 0.08 and 0.5 are saved and inspected. Their hashes are recorded in
`065-reconstruction.json`. They confirm the oblique presentation, narrow
tappet, angular stop and added rails/face rings differ from the source.
The visible motion does not override the failing actual-surface evidence.

## Confirmed baseline defects

The original factory, its notched driver, studded disk and stop helpers, and
its model test are archived as `065-original-*`. A scoped actual-surface
diagnostic covers **180 poses over three index events and 27 independent pairs**.
Of **5,803,952** surface checks, **297,242** penetrate in **13 pairs**.
The diagnostic completes with exit code zero; this is successful diagnosis,
not passing mechanics. See `065-contact-baseline.json` and its log.

Confirmed pair penetrations include:

| Pair | Penetrating samples | Maximum depth |
| --- | ---: | ---: |
| Driver / driven disk | 10,573 | 0.024978 |
| Driver / stop | 44,013 | 0.116601 |
| Driven disk / stop | 176,649 | 0.091601 |
| Tappet / driven disk | 30,714 | 0.021800 |
| Stop / fixed pivot | 5,400 | 0.051601 |

The other affected pairs are tappet/studs 0, 8 and 9, and stop/studs 0, 1, 2,
3 and 9 during the three checked events. All sampled claimed tappet/stud,
stop/stud and stop/driver contacts return zero actual triangle distance while
their solids intersect; zero distance is not evidence of valid touching.
The two closest studs during dwell also intersect the stop in the sampled poses.

`centeredExtrusion` expands the shape by up to 0.025 through bevels. In 065 this
expands the nominally tangent disks into each other, thickens the tappet and
stop beyond their contact equations, and expands their axial extents. That
shared helper has many later callers; do not silently change all of them while
repairing this one model. The stop overlaps the driven disk in depth and has
no physical bore around its independent fixed pivot. Removing bevel expansion
alone will not resolve the whole assembly.

An isolated **unbeveled** study confirms that distinction. Only the driver,
tappet and stop extrusions are rebuilt without their bevels; production is
unchanged. Across the same 180 poses, **106,849 of 3,259,828 samples** still
penetrate in 11 pairs. Disk/disk interference disappears, but stop/disk
penetration reaches 0.07, tappet/disk 0.005, and the unbored pivot 0.03.
The finite tappet still enters its active studs at two event-edge poses per
cycle, reaching 0.010079. Stop/stud interference reaches 0.012332.
Working contact gaps also reach about 0.001017 with the old 22-sided pins,
consistent with the polygonal radius sagitta absent from the ideal-circle
equations. These issues remain even without the outward bevel expansion.
See `065-unbeveled-outline-study.json` and its log; exit zero again records
diagnostic completion rather than mechanical acceptance.

## Baseline source interpretation

[Brown's description](https://507movements.com/mm_065.html) is explicit: the
clockwise left disk carries a fixed tappet; each turn advances the right disk
one stud. A stop on a fixed center puts one end between the output studs and
the other against the input rim. The notch allows the passing stud to depress
the stop, and its trailing side restores the lock after tappet withdrawal.
The Brown enlargement shows ten studs, including the lower-left one obscured
in the smaller website image. The two ends of the stop and its pivot are
therefore real constraints, rather than decorative prescribed motion.

The archived factory prescribed a sinusoidal stop angle and derives a notch
and stud-contact curve from it. Its analytic contact flags cannot establish
correct finite contact, clearance, positive reaction or locking. The reconstruction therefore needed to check the actual finite tappet entry/withdrawal, both stop
contacts, adjacent stud lock and a physical shaft/bearing depth arrangement.
The unrelated support rails and face rings were flagged for source review.

Preliminary readings in the unchanged enlargement put the input center near
(352,415), output center near (1016,417), and stop pivot near (686,737). At about
260 pixels per unit, the disks have a small positive rim gap. The straight
lower tappet face appears roughly 65 pixels from the input center, much more
than the old 0.07-unit offset. These are working measurements, not accepted
dimensions. The drawing shows a pose shortly before the tappet reaches the
leftmost stud. These readings guided the subsequent finite-contact construction.

031 is verified with the qualified browser rerun recorded in its notes.
064 is also verified; 037 and 063 remain mechanically unresolved. The full 507-model
task remains active.

## Integrated reconstruction

The finite tapered tappet uses its lower straight face and a tangent circular
tip to advance one pitch and finish at zero output speed. A source-fitted
two-flank stop touches adjacent studs during dwell. Its angle is solved from
the passing stud; the actual finite cam corner follows the corresponding
notch. The bored stop and tappet occupy separate axial layers, while the
stop’s rear foot reaches the input disk. The visible hubs cap their shafts.
All 22 solids belong to input, output, stop or fixed hardware families.
Integral joins within a family are permitted.

An initial rounded toe lost cam contact by up to 0.005904 at entry. That study
is retained as `065-finite-planar-study.json`. The selected sharp contact
corner follows the engraving. The first complete candidate sweep found
34,146 penetrating samples in the toe foot and two mesh topology issues.
Narrowing that foot, reversing the bore-wall orientation and simplifying
sub-Float32 cam steps removed those defects. Original and corrected study
reports are retained; they are not silently relabeled as passing.

The final **94-pose, 143-pair hardware sweep passes 41,110,054 actual-surface
checks**, with no penetration beyond the 1e-6 tolerance. All **22 solids** have
positive volume, outward normals and paired oriented edges. See
`065-candidate-final-hardware.json` (process exit 0).

The first 65-pose force study failed its 0.006 normal relative-speed limit
because of facet error. Refined 2,048-sided pins and a finer rounded tip pass:
maximum actual normal relative-speed residual is **0.001822 model units/s**,
and working gaps are 0–1.973e-7. Contact reactions for a unit resisting output
torque are positive: minimum tappet reaction 0.736212 and cam reaction
0.263368. The largest relative power ratio is 10.306 percent near vanishing
transmitted power; acceptance uses the absolute normal-speed residual, not
a claim of uniformly small relative power error. Ten dwell orientations
and 7,200 trial directions in output/stop velocity space find no escape
direction, with worst constraint margin −0.346840. See
`065-candidate-refined-forces.json` (exit 0). These are quasistatic rigid-contact
checks. Initial strike impulses, loaded inertia, elasticity and grounded
shaft bearings remain idealized.

An 8,193-pose off-grid cam check measures at most 2.427e-7 deviation from the
rendered Float32 polygon and 0.004323 radians of edge-normal error, with a
monotonic polar contour. See `065-cam-resolution.json` (exit 0).

Exact buffer hashes for all 22 parts and world transforms at five poses
connect this audited candidate to the integrated model. The factory and
contact construction are now `src/simulation/tappet-stud-stop.js` and
`tappet-stud-stop-contact.js`; historical scripts re-export them. The old
065 factory and its two exclusive helpers are archived and removed; the
studded-disk helper remains for its other callers.

## Source and display evidence

The source overlay is inspected. It uses one orthographic origin (352,415)
and scale of 260 pixels per model unit. **77 boundary readings** give these
maximum/RMS residuals in pixels: cam 27.465/9.380, tappet 22.940/9.220,
stop 8.047/4.413, output rim 6.055/2.761, input hub 3.408/1.754 and output
hub 9.407/6.166. Ten regularized stud centers have maximum/RMS residuals
21.479/12.851. Brown’s uneven stud pattern and stylized notch do not establish
exact conjugate dimensions. These are sampled outline errors, not a whole-image
registration or a claim of exact superposition. See `065-source-outline.json`
and `065-source-overlay.png`.

The default input turn takes **five seconds**, with a roughly 0.398-second
index and a 50-second complete output revolution. A model-specific minimum
cycle time preserves this short action while the existing speed limits and
slower user-selected cycle targets remain effective.

All **six focused tests** and all **3,000 numerical tests** pass. The numerical
command exits 0 with no signal in 235.987 seconds. The build passes in 12.429 seconds. Nine integrated source/oblique frames
and the overlay are inspected and hashed. All **25 browser tests pass**, including all 507 canvases and the new 065
controls/framing test (13.3 seconds). The full command exits 0 with no signal
in 896.673 seconds, with no retries. Both desktop and mobile captures are
inspected and hashed. Final source hashes, original failed diagnostics and
all exit statuses are retained in `065-reconstruction.json`.
