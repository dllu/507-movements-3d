# Shared finishing pass for outlines cut offline by sweeping a cutter through
# many poses (shapely differences). Each pose leaves a tiny cusp between
# neighbouring cuts, and those cusps render as jagged, stair-stepped flanks
# and banded roots. A morphological opening by a small disc removes only the
# cusps (it can only remove material, so no new contact can appear) and eases
# convex corners by the disc radius. A Douglas-Peucker pass then keeps
# vertices only where the true curve bends; it moves the outline at most
# `tolerance`, which callers keep well inside their cutter clearance.
EASE_RADIUS = 0.002
SMOOTH_TOLERANCE = 0.0001

def ease(shape, radius=EASE_RADIUS, tolerance=SMOOTH_TOLERANCE):
    opened = shape.buffer(-radius, resolution=32).buffer(radius, resolution=32)
    pieces = list(opened.geoms) if opened.geom_type == 'MultiPolygon' else [opened]
    largest = max(pieces, key=lambda p: p.area)
    return largest.simplify(tolerance, preserve_topology=True) if tolerance else largest
