# Belts, ropes and tackle 1–23: source-match pass

Pass 50. Parts were changed in a parallel lane. The primary agent integrated them,
re-measured display profiles, and inspected every production-route capture
beside its engraving.

## Common changes

- Parts Brown does not draw are removed: belt and rope flow markers, effort grips,
  backdrop frames, base rails, and movement 6's anchor tabs.
- A pulley fast on its shaft now carries that shaft inside its rotor. A sheave
  running on a fixed pin is bored (`makePulley({ bore })`, off by default;
  default output is byte-identical to the previous primitive).
- `makeHoistBlock` always bores its sheave. Only movements 15–22 import it.
- Tread and face index marks are kept.

## Relative-motion screen (lane run, pass 50)

Worst solid / coaxial overlap, before → after:

| Movement | Solid | Coaxial | Remaining |
| --- | --- | --- | --- |
| 1, 2 | 0.012 → 0.0034 | 0.135 → 0.0005 | Tread mark flush under the belt. |
| 3 | 0.044 → 0.044 | 0.653 → 0.129 | The static twisted belt produces false readings. Dense sampling finds at most 0.0007 real overlap. |
| 4 | 0.048 → 0.0048 | 0.141 → 0.0028 | Guides widened to ±3.3; the belt bow peaks at the crossing. |
| 5 | 0.0042 → 0 | 0.156 → 0 | The pivot bracket is not drawn. |
| 6 | 0.0008 → 0 | 0.164 → 0 | Belt ends are buried 0.07 in the lever bar where they attach. |
| 7 | 0.012 → 0.0029 | 0.124 → 0 | Tread mark contact only. |
| 8 | 0.012 → 0 | 0.179 → 0.0012 | Belt flush on the stepped tread. |
| 9, 10 | ≈0.002 → 0 | 0.76 / 0.89 → 0 | Belt flush on the cone. |
| 11 | 0.012 → 0.0038 | 0.673 → 0.0006 | Tread mark contact only. |
| 12, 13 | ≈0.004 → 0 | ≈0.16 → 0 | Open hooks on ceiling staples. |
| 14–22 | 0 → 0 | ≈0.1 → 0 | Rope-in-groove contacts up to 0.014; 15 has a 0.031 groove-edge cut where its rope leaves at an angle. |
| 23 | 0 → 0 | 0.248 → 0 | Weight rope ties into its eye (0.025). |

Tests: `tests/belts-1-23-clearance.test.mjs` (negative control for an unbored
sheave on a pin), plus the hoist, belt, pulley and model blocks for 1–23.

## Visual residuals

- 3: the weight drum reads large in perspective.
- 12: Brown's hand is not modelled; the free rope end hangs loose.
- 12–22: the ropes are smooth where Brown draws them twisted.
