# Movement 402: Guernsey's paired-balance escapement

The [official caption and plate](https://507movements.com/mm_402.html) specify one anchor rigidly joined to a lever carrying external and internal toothed sectors. They drive two balance wheels in opposite directions. The fetched page has no inline `add_model` or `mm_present` registration; its animation tab is unavailable. The existing factory cites [Guernsey's patent US35373A, figure 6](https://patents.google.com/patent/US35373A/en). Source centers, one driving wheel, both sector directions, and the shared rigid lever are retained.

The original pallet geometry was a radius-0.12 tube whose center followed the nominal tooth-tip locus. It therefore enclosed the tooth rather than providing a working surface: at t=0.2, tooth0 penetrated the upper tube by 0.0912772 model units while reported point error was 2.78e−17. Point coincidence did not establish contact.

## Finite working parts

The pallets are now sided finite plates. Offline relief considers both pallets and all 15 neighboring teeth throughout the cycle; it retains distinct working lands rather than cutting away the pallet faces. The compact wheel heel is defined by rear-stock points (0.65,0.20), (0.91,0), and (0.905,0.12). Its outer radius is about 0.91292, within 0.003 of the old 0.91 envelope. The relieved front lands overlap a continuous rear foot by 0.001 axially, and each rear foot overlaps the wheel's annular web. The rear feet and front anchor arms occupy separate axial layers. The tooth relief, stepped rear stock and axial layering are reconstruction assumptions; the source does not dimension these features.

Both sector/pinion pairs now use matching 30° involutes, module 0.05, addendum 0.045 and 0.001 backlash allowance. The partial sectors use their source-derived pitch radii directly; an artificial integer full-wheel tooth count is unnecessary. Base pitch is shared with the ten-tooth pinions. Nominal transverse contact ratios are 1.1915 external and 1.2321 internal. Actual sampled working-flank gaps stay below 0.000872 model units. Both balances retain their prescribed gearing relations and opposite angular velocities.

The shaft passages extend through hubs, fixed bearings and the underlying spokes and arm/frame ends. The two projected-overlapping balance rims occupy separate axial planes; their pinions retain the common sector plane. Extended spoke/hub stock keeps those connections physical. Flush/inboard geometry replaces floating contact dots and the escape wheel has a compact annular web. The returned camera is near frontal, fog and ground are disabled, and the display cycle has a six-second minimum.

## Motion and qualification

The full loaded escapement is **not corrected yet**. Under the retained prescribed timing, the upper pallet has no holding samples within 0.005 of the wheel; its largest gap is about 0.01166. The early lower impulse at t=2.92 has about 0.00403 gap. Later portions of both impulse branches have close, properly oriented finite faces. The viewer explicitly identifies unresolved upper holding and lower-impulse separation. The old zero point-locus residual remains available as a nominal reference, now labelled accordingly; it is not presented as finite contact evidence.

A bounded forward-contact continuation was attempted on the same compact geometry. Its independently sampled stops all had positive resisting wheel moments and closed by one tooth, but sampling did not establish a continuous release path. A small apparent penetration near a branch switch was an event/interpolation concern, not proof of mechanical impossibility. After release refinement, the local seed/bracketing search failed at normalized phase 0.239990234375; that failed search likewise does not prove there is no admissible path. **No continuation motion was exported or installed.** The reproducible rejected study remains in `scripts/studies/guernsey-contact-continuation.py` and writes only a RAM candidate if its strict assertions ever pass. It needs SciPy in addition to the geometry dependencies.

The investigation also found a specific off-grid miss in the original sampled relief: at t=0.9599609375 the retained nominal law gave 0.000003236 penetration depth (overlap area 6.0e−10). That single pose was added to the cutter and actual rendered-solid regression. This small geometric correction does not resolve the larger holding-law problem.

The focused audit checks the original t=0.2 failure, seventeen full-cycle poses, the off-grid witness, and points around impulse/drop boundaries. All teeth, rear feet and web are checked against both finite pallets and front arms. Both gear meshes are checked for clearance and near working flanks; source-profile size, real shaft passages, front-land/rear-foot/rim stock connectivity, pallet/arm attachment and stable geometry buffers are tested. Independent global nearest pairs come from the actual rendered outline segments. Incident rendered triangle normals must contain the opposed reaction in each face/corner normal cone, and the corresponding wheel and lever moments must have the appropriate signs. A ray along a corner force need not remain inside the solid, so that stronger and sometimes incorrect ray criterion is not used as a substitute for the actual normal cone.

The generator requires Python3, NumPy and Shapely2, plus the repository's Node dependencies. It invokes the scoped exporter and keeps intermediate geometry in `/dev/shm`:

```sh
python3 scripts/generate-guernsey-contact.py --check
node --test tests/guernsey-working-solids.test.mjs tests/movement-402.test.mjs
node scripts/screen-movement-batches.mjs --ids=402 --out=/dev/shm/guernsey-screen.json
```

No native dynamics or force validation is claimed. Balance spring energy, escape-wheel drive torque, friction, impacts and response to shocks remain unvalidated. This pass delivers compact, clear working geometry and qualified sector meshes while leaving the finite holding/transfer law explicitly queued.

## Final bounded result

**17/17 focused tests pass**, including the existing nominal-law regressions, in 4.90 seconds. Actual 3D minimum sampled working separation is 0.00048296 after adding the off-grid witness. The qualified portions of the two impulse branches have gaps 0.000570–0.001799; wheel reaction moments are positive and upper/lower lever moments have opposite useful signs. These figures do not qualify the separated upper holding branch.

`python3 scripts/generate-guernsey-contact.py --check` reproduces the geometry byte for byte. Logs: `/dev/shm/guernsey-final-tests.log` and `/dev/shm/guernsey-bake-check.log`. The rejected continuation can be reproduced with `python3 scripts/studies/guernsey-contact-continuation.py`; its expected guard failure was reproduced in `/dev/shm/guernsey-rejected-study.log` and must not be bypassed or treated as exported motion.

CPU screening reports 156.0 ms construction, 0.193 ms update P95, 53,832 visible triangles and no object or geometry growth. It excludes browser imports and GPU cost. Parent source/default review accepted the compact wheel and near-frontal camera with no errors or clipping (maximum normalized extent approximately 0.846); final packaged review is integrated centrally.

After the final spoke bores, root repeated source/default and oblique inspection,
the production build and the packaged desktop/playback/mobile case. They pass;
sampled maximum normalized extent is 0.846384 with no browser errors or clipping.
The final CPU screen has no flags or new geometry/objects (172.7 ms construction,
0.235 ms update P95). The upper holding/transfer law remains unresolved.
