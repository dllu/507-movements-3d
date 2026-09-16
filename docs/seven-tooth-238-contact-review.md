# Movement 238 — bounded finite pallet correction

The B-flank residual below is historical; the [finite B-impulse follow-up](seven-tooth-238-loaded-branch-review.md) closes its geometric contact and normal-velocity mismatch without further profile cutting. Dynamic capture remains unvalidated.

The [primary engraving and caption](https://507movements.com/mm_238.html) show a seven-point wheel D and two pallets B/C on one carrier about A. The fetched page has no registered `add_model`/`mm_present` animation. The geometry is undimensioned. This pass removes the original large wheel/pallet intersections and connects the previously detached C working bar, but **does not qualify a complete loaded escapement**.

## Reconstruction and source differences

The source wheel center, A pivot, B root and all seven original star tips remain fixed. B/C now have one-sided, closed working plates, narrow mounts contained within their footprints, and rear straps joining the source carrier. The rear C strap is an inferred attachment, not a traced source outline. Wheel and carrier hubs have real arbor bores. Nominal contact dots are hidden; indices sit on the solids. Ground/fog are disabled, the returned camera faces the engraving, and display playback takes at least six seconds per authored four-second cycle.

A bounded compatibility study found the former 8° half-swing and 20.57° impulse split the finite-cut star into separate regions. The installed reconstruction uses a **4° half-swing and 5° impulse**, followed by 20.7143° of prescribed drop per beat. B's reconstructed endpoint is about 25.7 source pixels shorter than its drawn endpoint. This is a material source-fit assumption, not an exact reconstruction.

The cutter samples both complete pallet strips at 1,025 cycle poses and repeats the cuts sevenfold. Conservative farthest-visible chords then remove macro notches, with every chord contained in the cleared polygon. The resulting single connected star retains all seven tips, removes **13.1381%** of the original planar area, and has a boundary Hausdorff difference of **0.064782 model units**. It has 1,099 outline vertices and a 45,702-byte baked module; no contour cutting runs in the browser. The complete visible model has 10,312 triangles.

## Finite evidence and contact limits

The actual rendered wheel is tested in both directions against both working plates, mounts and rear carrier at 65 poses spanning lock, impulse, drop and cycle closure. Across 4,444,180 signed-distance queries, minimum sampled separation is **0.00009352** model units. At 17 full-cycle journal poses, minimum arbor clearances are **0.00397169** at A and **0.00397341** at D. Rear strap attachment points lie inside the actual carrier solid. GPU buffers remain stable, and newly added meshes cast shadows and ignore fog.

The nominal working plane is about **0.00050001** from each preserved tip. Its reaction resists wheel rotation (moment magnitude at least **0.60105**) and has the correct B/C pallet impulse sign (magnitude at least **0.18624**) at the selected working poses. These moment checks alone do not establish force transmission:

- **C:** the opposing pallet normal lies inside the actual finite wheel-tip normal cone at the sampled lock/impulse poses. Both incident edge projections onto the candidate outward reaction are negative; the least-negative is −0.499915. Its nominal point law also has the expected matched normal velocity. This qualifies the selected geometric C contact, not passive impact or sustained oscillation.
- **B:** conservative smoothing improves the early tip's support cone, but the late pose `q=0.339` still has an incident-edge projection **+0.0187784**, so the nominal reaction is outside that corner's normal cone. Earlier, another cut flank is closer than the nominal tip. At `q=0.22`, actual surface sampling finds that flank at **0.000103320** gap and resisting wheel moment **−0.901095**, but relative velocity along the nominal pallet normal is **−0.0167867 model units/s**. That pair has not been shown to be a compatible loaded impulse branch. A regression retains both witnesses rather than silently treating clearance or a point-law residual as proof of contact.

Lock, impulse, drop, pallet bias and reset remain prescribed. Position and velocity are continuous through all scheduled boundaries; passive bias, impacts, friction and sustained oscillation are not validated. No MuJoCo study was added because the unresolved B contact branch must first be made geometrically coherent. The viewer and `contactQualification` metadata state this limitation.

## Reproduction

Requires project npm dependencies, Node 18 and Python 3 with Shapely **2.0.3**. Bulk temporary inputs are placed in `/dev/shm`.

```sh
python3 scripts/generate-seven-tooth-238-profiles.py
python3 scripts/generate-seven-tooth-238-profiles.py --check
node --test tests/seven-tooth-238-working-parts.test.mjs tests/movement-238.test.mjs
```

The byte-identical regeneration check passes (`/dev/shm/seven238-bake-check.log`). The focused suite has **14 passing tests** (`/dev/shm/seven238-final-tests.log`), including updated legacy nominal-law tests whose titles now distinguish point kinematics from finite contact. Root's final default/oblique browser review found no errors or clipping (maximum NDC **0.86177**, 28 draw calls, 20,624 triangles including shadows); screenshots are `/dev/shm/family42-final-238-default.png` and `/dev/shm/family42-final-238-oblique.png`.

The final production build passes in 23.23 seconds. The packaged desktop,
playback and mobile-resize case passes in 3.7 seconds. The final construction
screen reports 133 ms construction and 0.247 ms sampled update P95, with no
object/geometry growth or flags. These CPU measurements exclude import, GPU
rendering and browser loading. Bulk evidence is under `/dev/shm/family42-*`.
