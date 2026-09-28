"""Build Holly's two rotors (movement 429) with Brown's rounded teeth.

Pass 90. Brown draws rounded, U-rooted, sinuous teeth and two long pistons per
rotor with packing strips in their tips; the official Canvas outlines have
narrow pointed teeth. Each rotor (source units: pitch radius 4, centres 8
apart, equal speeds in opposite senses) is its pitch disc plus
  - 18-pitch round tip lobes (circles of radius 0.33 centred on the pitch
    circle, kept above it) and
  - two pistons on the major axis, their tips concentric with the bore and
    slotted for packing strips,
less the sweep of the mate's lobes and pistons, which carves U-shaped roots
(the envelope of a round tip, so the pair is conjugate by construction) and
the two piston recesses. The right rotor is the left turned a quarter turn
(18 = 4*4 + 2 puts a tip opposite a root on the line of centres); a last swept
relief of the right by the finished left (clearance 0.0005 model units)
guarantees no overlap. Coordinates are written in model units (source * 0.36).
"""
import json, math, os
from shapely.affinity import affine_transform, rotate, scale as shp_scale
from shapely.geometry import Polygon, Point, box
from shapely.ops import unary_union

S = 0.36
R, N = 4.0, 18
BETA = 2 * math.pi / N
LOBE = 0.33                      # tip lobe radius (< BETA*R/4 = 0.349)
CD = 8.0
CASING = 5.333333
PISTON_TIP = CASING - 0.025   # 0.009 model units inside the bore: the tips seal the pockets
SAMPLES = 2048
TIP, ROOT = R + LOBE, R - LOBE

# Tips: round lobes centred on the pitch circle, kept above it; the roots are
# carved by the mate's lobes (below), so every root is the U-shaped envelope
# of a round tip and the pair is conjugate by construction.
pitch_disc = Point(0, 0).buffer(R, resolution=512)
def lobes(offset_deg):
    return unary_union([Point(R * math.cos(math.radians(offset_deg) + j * BETA), R * math.sin(math.radians(offset_deg) + j * BETA)).buffer(LOBE, resolution=64) for j in range(N)]).difference(pitch_disc)
def piston(angle_deg):
    # A broad rounded lobe (Brown's long piston) whose tip is an arc
    # concentric with the rotor, just inside the bore.
    half_base, half_tip = math.radians(17), math.radians(5)
    base_r = ROOT - 0.4
    pts = [(base_r * math.cos(-half_base), base_r * math.sin(-half_base))]
    shoulder = R + 0.55
    pts += [(shoulder * math.cos(-half_base * 0.75), shoulder * math.sin(-half_base * 0.75))]
    pts += [(PISTON_TIP * math.cos(a), PISTON_TIP * math.sin(a)) for a in [-half_tip + 2 * half_tip * k / 24 for k in range(25)]]
    pts += [(shoulder * math.cos(half_base * 0.75), shoulder * math.sin(half_base * 0.75))]
    pts += [(base_r * math.cos(half_base), base_r * math.sin(half_base))]
    hull = Polygon(pts).convex_hull
    p = hull.buffer(-0.16, resolution=48).buffer(0.16, resolution=48)
    # Tip arc exactly concentric (a band cut from the hull at the tip).
    p = p.union(hull.intersection(Point(0, 0).buffer(PISTON_TIP, resolution=512).difference(Point(0, 0).buffer(PISTON_TIP - 0.25, resolution=512))))
    p = p.intersection(Point(0, 0).buffer(PISTON_TIP, resolution=512))
    return rotate(p, angle_deg, origin=(0, 0))

pistons_left = unary_union([piston(90), piston(270)])
pistons_right = rotate(pistons_left, -90, origin=(0, 0))

def sweep_into_left(shape_right, clearance):
    cut = shape_right.buffer(clearance, resolution=8)
    parts = []
    for i in range(SAMPLES):
        th = math.tau * i / SAMPLES
        c, s = math.cos(-2 * th), math.sin(-2 * th)
        parts.append(affine_transform(cut, [c, -s, s, c, CD * math.cos(th), -CD * math.sin(th)]))
    return unary_union(parts)

def sweep_into_right(shape_left, clearance):
    cut = shape_left.buffer(clearance, resolution=8)
    parts = []
    for i in range(SAMPLES):
        th = math.tau * i / SAMPLES
        c, s = math.cos(2 * th), math.sin(2 * th)
        parts.append(affine_transform(cut, [c, -s, s, c, -CD * math.cos(th), -CD * math.sin(th)]))
    return unary_union(parts)

def largest(g):
    if g.geom_type == 'Polygon':
        return g
    return max(g.geoms, key=lambda p: p.area)

# Lobes the mate's pistons would strike are trimmed first, so that the
# lobe sweep carves roots but never the pistons.
lobes_left = lobes(90).difference(sweep_into_left(pistons_right, 0.03))
caps_left = unary_union([lobes_left, pistons_left])
caps_right = rotate(caps_left, -90, origin=(0, 0))
left_rotor = largest(unary_union([pitch_disc, caps_left]).difference(sweep_into_left(caps_right, 0.02)))
# Round off the thin horns left where a recess meets a root, and the small
# corners where a lobe meets its neighbouring root.
left_rotor = largest(left_rotor.buffer(-0.07, resolution=32).buffer(0.07, resolution=32))
# Packing-strip slots in the piston tips (0.20 wide, 0.32 deep).
slot_w, slot_d = 0.20, 0.32
def slot(angle_deg, grow=0.0):
    b = box(PISTON_TIP - slot_d - grow, -slot_w / 2 - grow, PISTON_TIP + 0.2, slot_w / 2 + grow)
    return rotate(b, angle_deg, origin=(0, 0))
left_rotor = left_rotor.difference(unary_union([slot(90), slot(270)]))
strip = lambda a: rotate(box(PISTON_TIP - slot_d + 0.006, -slot_w / 2 + 0.006, PISTON_TIP + 0.2, slot_w / 2 - 0.006), a, origin=(0, 0)).intersection(Point(0, 0).buffer(PISTON_TIP, resolution=512))
strips_left = [strip(90), strip(270)]

right_rotor = rotate(left_rotor, -90, origin=(0, 0))
before = right_rotor.area
right_rotor = largest(right_rotor.difference(sweep_into_right(left_rotor, 0.0005 / S)))
removed = (before - right_rotor.area) / before
strips_right = [rotate(s_, -90, origin=(0, 0)) for s_ in strips_left]

def out(poly):
    poly = shp_scale(poly, S, S, origin=(0, 0)).simplify(0.00002, preserve_topology=True)
    assert poly.geom_type == 'Polygon' and not poly.interiors
    coords = list(poly.exterior.coords)[:-1]
    return [[round(x, 7), round(y, 7)] for x, y in coords]

result = {
    'left': out(left_rotor), 'outline': out(right_rotor),
    'strips': {'left': [out(s_) for s_ in strips_left], 'right': [out(s_) for s_ in strips_right]},
    'pitchRadius': R * S, 'teeth': N, 'lobeRadius': LOBE * S, 'tipRadius': TIP * S, 'rootRadius': ROOT * S,
    'pistonTipRadius': PISTON_TIP * S, 'samples': SAMPLES, 'clearance': 0.0005,
    'rightReliefAreaFraction': removed,
}
with open(os.environ.get('BAKED_OUTPUT', 'src/simulation/generated-holly-mate.js'), 'w') as output:
    output.write('// Generated by scripts/generate-holly-mate.py; coordinates are model units.\nexport default ')
    json.dump(result, output, separators=(',', ':'))
    output.write(';\n')
print({k: v for k, v in result.items() if not isinstance(v, (list, dict))}, 'vertices', len(result['left']), len(result['outline']))
