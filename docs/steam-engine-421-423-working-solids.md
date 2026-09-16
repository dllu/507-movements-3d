# Working solids in steam engines 421–423

This family pass preserves the existing analytical slider and four-bar laws and
reuses the bored-link, bored-journal, planar-boolean and full-cycle camera helpers.
No live physics or hand-traced ornamental outline is needed for these corrections.
The primary references are [421](https://507movements.com/mm_421.html),
[422](https://507movements.com/mm_422.html) and
[423](https://507movements.com/mm_423.html). All three have official Canvas
constructions. Their crank/rod ratios, sector endpoints and valve phases remain
those recorded by the original implementations. Brown's drawings guide the
cutaway layout; hidden depths and running clearances are reconstructed.

421 previously translated its piston/trunk at z = 0.38 through a gland centered
at z = 0, with the pitman farther forward at z = 0.72. All now share the cylinder
axis. A real bored gland replaces an intersecting torus; curved trunk side walls
stay within its bore, and a bored upper rim clears the rod. The piston includes
an explicit inspection cutout for its bored pitman eye and rear pin seat. The
piston radius now nearly meets the cylinder side walls. The excessive lower
cylinder depth is reduced to match the source's proportions, with positive
clearance at both dead centers. A crank arm replaces the invented large solid
wheel: the engraving's outer circle is only a dashed reference. The upper steam
indicator has a true central opening around the trunk.

422's thick rectangular vane and sealing block crossed the finite end walls,
and its inner arc crossed the vane. Radial wedge solids now fit the available
angle, with a curved sealing head and a 0.01 radial clearance. A bored rear
shaft bearing replaces the crossing inner arc and reaches the foundation through
a foot. The slide valve moves in an actual open chest; its stem has a passage,
and the former rail through the moving block is now a lower guide.

423 uses bored connecting rods in separate depth planes, both fitted to the
same long crank pin. Wrist pins reach both rod planes. Piston hubs now connect
the vanes to their shafts through real bores. The curved heads follow the
cylinder arcs, and radial end-wall wedges clear the vanes near the shaft as well
as at the outer radius. Its exact common-crank closure and overlapping power
stroke remain unchanged.

All three use near-front default views, measured cycle bounds, no fog and no
ground plane. The four-second authored cycle and existing readable display
scaling remain intact.

## Verification and limits

```sh
node --test tests/movement-421.test.mjs tests/movement-422.test.mjs \
  tests/movement-423.test.mjs tests/steam-engine-working-solids.test.mjs
```

The new regression queries actual rendered triangle surfaces in both directions
over 65 poses for the gland/trunk/rod, sector vane/head/end-wall, valve/chest,
rod layering, pins and piston hubs. These selected interfaces show no sampled
penetration beyond 0.00002 model units. It also checks actual bored-eye locations
against the pins, continuous framing, and fog/ground settings. This is a bounded
finite-surface regression, not an exhaustive collision proof.

These remain explanatory engine cutaways. They do not simulate pressure,
compression, leakage, friction, bearing loads or self-starting torque. The 422
valve and rocking law are prescribed, and its output crank stub does not invent
a complete rotary conversion linkage absent from the plate. Transparent steam
regions indicate chambers rather than physical fluids. Inspection openings,
rear supports and housing sections are inferred; no pressure-tight housing or
manufacturable sealing assembly is claimed. The 423 official Canvas starting
phase differs from the still engraving, while retaining the same linkage.
