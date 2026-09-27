# Lane p80-1: close the confirmed disconnections for 162–280

Scope: the pass-79 confirmed rows (`/dev/shm/p79-triage/confirmed.json`) for 162, 173, 181, 182, 183, 184, 212,
213, 215, 232, 267, 276 and 280. The goal is that each part visibly joins its neighbour or runs on it with a snug
fit, with no new interpenetration and no change to the motion.

## Production files

Each change was made in the file the browser actually plays.

| ID | production path | change |
|---|---|---|
| 162 | baked `baked/water-governor.js` ← `mujoco-water-governor/solids.js` | gear hubs keyed to the shafts; rebaked |
| 173 | baked `baked/tappet-silk-traverse.js` → `mujoco-silk-tappet/assembly.js` | disk front face raised to the screw frame |
| 181, 182 | baked `baked/diagonal-catch.js` ← `mujoco-diagonal-catch/assembly.js` | rod-eye bore 0.105 → 0.062; rebaked |
| 183, 184 | `quadrant-catch-finite-parts.js` (+ `baked/quadrant-catch-motion.js`) | catch boss planes `M` → `XAM`; motion rebaked, identical |
| 212, 215 | `source-presentation.js` | loose frame bearings presented away |
| 213 | `authored-intermittent-core.js`, `split-rim-213-contact.js` | stud fills the split-ring bore; band removed |
| 232 | `lift-draw-pawl-232-working-parts.js`, `lift-draw-pawl-232-branch.js` | B's eye, A's journal and A's pin fitted |
| 267 | `authored-friction-clutches.js` | loose-hub bore +0.055 → +0.003; carrier bore keyed |
| 276 | `authored-equal-diameter-cams.js`, `source-presentation.js` | roller bore fitted; rear bearing presented away |
| 280 | `friction-family-working-parts.js` (`correctFriction280` only) | upper coupler pin 0.15 → 0.171 in a 0.174 eye |

## Changes

- **162: the gears were not fixed to their shafts, and the bearing rings were carried by nothing.**
  - The upper-input and gate-output bevels keep the shared 0.155 bevel bore. `bevel-train.js` is fingerprinted by the
    loop qualification, so it is unchanged.
  - Each shaft now carries a sleeve of that gear's colour (`upperInputSleeve`, `gateOutputSleeve`,
    r 0.10–0.155). The sleeve fills the bore and runs out to the gear's front face.
  - Each shaft also carries Brown's short hub against the gear back (`…Hub`, r 0.10–0.18, 0.12 long).
  - The shafts run 0.042 further, to the gear face.
  - The fixed grey rings `inputShaftBearing` and `outputShaftBearing` are gone. They stood a shaft length off the
    gears, where Brown draws the hub block against the gear.
  - Rebaked with `scripts/bake-water-governor.mjs`. The motion and closure are unchanged (maximum native error
    7.3e-5).
  - Regenerated `162-solid-clearance.json` and `162-baked-clearance.json`.
- **173: the screw frame stood 0.09 clear of the disk.** The disk is now z −0.40..−0.19, where it was −0.40..−0.28.
  - The rails are 0.37 deep at z −0.005, so their back faces and the bearing blocks' back faces bed on the disk.
  - The side views (`rot/T-173-0r`) show the frame flush on the disk.
  - The bake does not fingerprint `assembly.js`, so no rebake was needed.
  - Regenerated `173-assembly-clearance.json` and `173-source-fit.json`.
- **181/182: the rod eyes were loose on their 0.06 pins (0.045 radial).**
  - Every phase was checked first: all three eyes stay coaxial with their pins (0.000 in xy), and each lies 0.105
    along a 0.33 pin.
  - The "0.36" and "1.5 floating" readings were whole eye-and-rod components cut off by the loose bore. They were
    not misplaced eyes.
  - The eyes are now ring(0.062, 0.14), which matches Brown's small pin in a larger eye.
  - Rebaked with `scripts/bake-diagonal-catch.mjs`, which regenerated the keys module and `181-bake.json`.
- **183/184: the catch boss floated 0.12 in front of the wing.** The boss is cast on the wing: it stands from the
  wing's face (X) through A to M.
  - No lower-handle part shares A or X at that radius.
  - The rebaked motion table is identical (maximum row difference 0).
  - Regenerated `183-current-solids.json`, which was also stale against the factory. It still shows only seated
    contacts of 0.0005 or less.
- **212/215: fixed torus bearings hung loose on their shafts with no frame.** The frame was already presented away.
  The bearings now go too: `fixed-(?:driver-A|stop-wheel-B)-bearing` and
  `fixed-(?:crescent-driver|six-slot-wheel)-bearing`. Brown draws only the wheels and shaft sections, so both shafts
  end as plain stubs behind the wheels, as in 213.
- **213: a thin white ring showed between the stud and the split ring.**
  - The fixed stud now fills the ring's bore. The drum is r = inner − 0.002, set both in the core and in
    `finishSplitRim213`.
  - The brass torus band is removed. Its role was renamed to `fixed-friction-stud-drum-gripped-by-split-ring`.
  - The default view now reads as Brown's single inner circle.
- **232: handle B's bore on the output shaft showed a crescent (0.025).**
  - B's end is rebuilt: the traced bar, unioned with an r 0.16 boss (0.13 before, which left no wall), bored 0.1055
    on the 24-sided 0.105 shaft.
  - Carrier A's journal hole on that shaft goes from 0.17 to 0.1055.
  - A's upper pivot pin goes from 0.075 to 0.088 in the 0.09 bores of A and C. This also clears the screen's 0.015
    rigid gap.
- **267: the loose pulley hub showed a crescent on the shaft (0.05).** The hub bore is now shaft + 0.003, and the
  four-lobed carrier's bore equals the shaft (keyed).
- **276: the rear cam-shaft torus bearing hung loose with no support, and the roller treads showed a crescent on
  their axles.**
  - The bearing is presented away, like its post, arm and base. The yoke's relief eye still clears the bare shaft.
  - The tread bore goes from 0.40r to 0.35r on the 0.34r axle.
- **280: the upper coupler pin sat off-centre in its 0.174 eye.** The pin is now 0.171; the lower pin was already
  0.17.

## Evidence

- **Screen.** `node scripts/screen-disconnected-parts.mjs --ids=162,…,280`. Before: `/dev/shm/p80-1/before.json`.
  After: `/dev/shm/p80-1/after.json`.

  | ID | before (detached) | after |
  |---|---|---|
  | 162 | 2 (0.055, 0.047) | 0 |
  | 173 | 1 (0.09) | 0 |
  | 181 | 6 (floating 1.51, 0.36; eye 0.045) | 3, none persistent (catch and tappet release phases) |
  | 182 | 5 | 2, none persistent |
  | 183 | 3 (boss 0.12) | 1, the piston rod between tappet contacts, not persistent |
  | 184 | 3 (boss 0.12) | 1, likewise |
  | 212 | 2 | 0 |
  | 213 | 2 floating (stud assembly 0.52; rim 0.34) | 1 (see residuals) |
  | 215 | 2 | 0 |
  | 232 | 3 (0.025, 0.015) | 0 |
  | 267 | 1 (0.052) | 0 |
  | 276 | 2 (0.025, 0.015) | 0 |
  | 280 | 1 (0.024) | 0 |

- **Captures.** In `/dev/shm/p80-1/`:
  - `after/T-<id>-<n>.png`: the full, zoom and left views at the triage targets and phases. Compare with
    `/dev/shm/p79-triage/shots/`.
  - `views/<id>-default.png` and `views/<id>-oblique.png`.
  - `rot/T-<id>-0r.png`: back, side and top views for 162, 173, 212, 213, 215, 232, 267 and 276.
- **Intersections.** Run on the production (model-loader) route with `--spacing=0.01 --samples=129`.
  - 181, 213, 232 and 276: clear.
  - 162, 183 and 184: only seated contacts of 0.0005 or less.
  - 212 and 215: 0.0000 wheel contacts.
  - 173: the pre-existing hub/screw coaxial shaft overlaps (0.085, 0.05), which do not involve the moved parts.
  - 267: the pre-existing 0.072, 0.035 and 0.020 pairs. They are identical with the carrier-bore change reverted.
  - 280: the pre-existing 0.0000 flange contacts.
- **Tests.** 36 files, 173 tests, all pass: the water-governor suites, the 173 suites, the diagonal-catch suites,
  movements 63, 71, 181–184, 206, 211–213, 215, 225, 232, 235, 236, 240, 267, 276, 280 and 413,
  `quadrant-catch-finite-interfaces`, `split-rim-213-contact`, `lift-draw-pawl-232-solids`,
  `friction-family-working-solids`, `cam-272-276-solids` and `source-presentation`. Rewritten pins:
  - `water-governor-baked`: 40 meshes, and a check that each hub turns with its shaft and fits it.
  - 212 and 215: the lower bounds on the presented mesh count follow the removed bearings. 212 now also asserts that
    no bearing ring is left.
  - 213: the drum role and a bore-fit check.

## Residuals

- 213: the stop ring on its fixed stud and the ratchet on its arbor are two separately fixed axes that touch only
  through the face pin during indexing. Brown draws no frame, so the screen still sees two groups (0.34). This is
  not a visible defect.
- 162: the bevels themselves keep the 0.155 bore. The keyed sleeve fills it, so no gap is visible.
- 232: B's rounded end is r 0.16, slightly fuller than the 0.13 bar, to leave a wall round a shaft that is
  thicker than Brown's small pin.
