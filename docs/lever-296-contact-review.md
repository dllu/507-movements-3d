# Movement 296: finite lever escapement

This supersedes the disconnected-pallet residual in `duplex-lever-working-parts.js` / the earlier family review. Movement 293 is unchanged.

## Source and reconstruction

The [official caption and engraving](https://507movements.com/mm_296.html) describe a rigid anchor B and lever E–C, a balance-mounted pin entering notch E near mid-vibration, and alternate impulses from wheel through pallets and lever to balance. On 2026-09-16 the actual page still marked the Animated tab unavailable; its HTML contained no canvas or animation registration. `public/engravings/mm_296.png` supplies the source geometry.

The previous pallets floated above the wheel, while the fork followed the balance with the wrong sign. The replacement uses finite fork corners against the circular pin, a bore through the anchor, and connected stepped pallet necks reaching the wheel plane. Closed-form pin/corner closure gives opposite fork rotation and ±4.334° banks. The pin transfers between cheeks continuously at mid-vibration and clears the mouth beyond the prescribed ±15° engagement window. Finite banks attach to the rear support; both shafts pass through actual openings.

Hooked teeth and offline swept-tooth pallet lands retain concentric locking faces and useful impulse faces. Each half-beat advances 12°: 8° through the impulse land followed by 4° free drop. The fifteen-tooth wheel advances clockwise by one tooth per complete oscillation. A radial triangular tooth could not support the required lock normal, so its heel was raked; the generator subtracts swept individual triangles, preserving the concave working outline. This is a mechanical reconstruction, not a contour tracing. Source-fit residuals remain: the visible teeth and straight spokes are narrower/straighter than the broader curved source silhouettes.

## Evidence

Command:

```sh
node --test tests/lever-296-finite-contact.test.mjs tests/movement-296.test.mjs tests/duplex-lever-interfaces.test.mjs tests/movement-293.test.mjs
python scripts/generate-lever-296-pallets.py --check
```

The focused and neighbor run passes 20 tests. Its finite sweep makes 17,709,140 bidirectional surface queries over full-cycle off-grid poses and denser entry/exit samples. Minimum sampled separation is +0.000001882; the failure tolerance is 0.000002. Selected pairs include teeth/rim against both pallets, their necks/bridges and anchor/fork/C body; the balance pin against fork parts; banks against lever parts; and anchor/lever against the arbor. Separate retained checks cover rear journals and the C tab. This is selected-interface sampling, not exhaustive global collision certification.

Actual pallet triangles give resisting wheel moments ≥0.54828 and useful opposite lever moments ≥1.26337, with contact distance ≤0.00050114. Lock-face lever moment is below 0.01. Repeated-cycle samples also test the actual tooth corner normal cone. The exact finite fork-corner branch gives assisting balance moment ≥0.59692 during impulse. Tests cover closure/rates, monotonic repeated-cycle indexing, attachment overlap, physical bores, visible depth overlap, and retained GPU buffers.

The generator's byte-for-byte check passes. It uses NumPy/Shapely offline and emits 417 profile vertices (including closing vertices counted by the generator), with no cutter or physics work in playback. Bake SHA-256: `7363129489f467b0ccbfb4597a11880be73fcda91b1b12016f698439d94aedc7`. RAM logs: `/dev/shm/lever296-final-tests.log`, `/dev/shm/lever296-generator-check.log`.

Root independently inspected final default/oblique renders against the engraving: no browser errors or clipping; maximum NDC 0.87755, 100 draws, 23,584 shadow triangles. Captures/report use `/dev/shm/family48-contact-final`. The source-facing view hides the ground, disables fog, fits the swept geometry, and preserves a six-second minimum display cycle.

## Remaining limits

Balance motion, wheel timing and holding/preload remain prescribed. The pallet profiles include 0.0005 running clearance, whose load take-up is not simulated. Entry, banking, impulse/drop transitions and fork-cheek transfer are position-continuous but are idealized impact/velocity transitions; restitution, spring energy, friction and sustained loaded operation are unvalidated. No MuJoCo or passive-energy claim is made. Fork/wheel accelerations are explicitly uncomputed (`null`), rather than false zero values. The bank size, pin rounding, hooked heel and stepped axial connections are inferred; this is not a manufacturing design or a fully qualified passive watch escapement.

Final integration passes the production build (22.88 seconds), scoped CPU screen
and all seven packaged desktop/playback/mobile cases (18.4 seconds). The CPU
screen excludes imports and GPU work. See [review progress](review-progress.md)
for the combined pass record.
