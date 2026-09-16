# Fountain and balance-pump working interfaces: 464–465

This pass reuses finite plates, turned pipe walls, ported pump barrels, bored
links and persistent tube buffers. It uses analytic circular geometry and linkage
closure; neither mechanism needs tracing or a live browser physics solver.

The official [464](https://507movements.com/mm_464.html) and
[465](https://507movements.com/mm_465.html) pages mark their animations unavailable
(checked September 15, 2026). Their engravings and captions supply topology,
not dimensions or absolute timing.

## 464: Hero’s fountain

The intermediate water now occupies a semicircular bowl within a sealed air
enclosure. A circular-segment volume inversion gives its level, replacing the
old cylindrical-volume approximation. Lower vessel walls, top and bottom plates,
roof penetrations, the drain, air connection and central riser have finite open
passages. The nozzle and jet share an axis and the return streams start at the
jet apex and terminate at the upper water surface. Dynamic water and spray
geometry retain their buffers.

The existing prescribed transfer law, isothermal pressure law and ideal jet head
remain. The gas capacity neglects solid displacement. Streams are illustrative,
not solved fluid trajectories, and the hidden-flow loop reset is nonphysical.
The initial cycle pose has no jet; playback begins the pumping sequence.

## 465: balance pumps

A split platform admits the rocking beam and pitmans. The fulcrum, pitman eyes
and crossheads now have finite bores and aligned pins; the piston rods stop below
the wrist pins. Bored covers and side-ported cylinders admit the rods and delivery
branches. Delivery pipes run in front of the rods, with connected check chambers
and a flared common outlet. Intake pipes pass through actual foundation holes
and terminate below the inlet seats rather than extending through the checks.

Exact beam/pitman closure and opposite piston motion remain analytic. The
operator input, check timing and fluid transport remain prescribed. This is not
a pressure-driven check-valve or sealed-manifold simulation; losses, leakage and
operator dynamics remain outside this pass.

## Validation

The 22 existing checks cover source records, linkage closure, velocities,
conservation, pressure/head laws, loop behavior and renderer correspondence.
Three added checks sample actual rendered surfaces at 33 off-grid poses and
verify persistent geometry buffers. They cover the fountain bowl and pipe cores,
roof penetrations, pump rods/pistons/linkages against walls and deck, bored pins,
check seats/chambers and intake foundation holes. These selected surface samples
are not an exhaustive collision proof or a fluid solver validation.

Source/default/oblique browser review found no page errors. Full-cycle framing
stays inside normalized screen coordinates .881/.888 for 464/465 respectively.
