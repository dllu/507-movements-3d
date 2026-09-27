# Blender models for the figures in movements 12-22, 247, 420 (hauling
# hand), 376 (horse) and 377 (walker). Pass 82: the walker's trouser legs
# and the horse's legs are single continuous limbs, bent at the knee in the
# factories. Each part is built from overlapping
# primitives, unioned by a voxel remesh, smoothed, cut (the hand's rope
# channel) and decimated to a few thousand triangles, then written as one
# JSON file per part. Pack them with
#   node scripts/generate-figure-meshes.mjs <out-dir>
# Run inside Blender, either through the blender-mcp bridge (execute this
# file's text with FIGURE_OUT set) or headless:
#   blender --background --python scripts/blender/figures.py -- <out-dir>
# Units: the hand is in grip units (1 cm of hand = 0.031); the horse and
# walker are in their factories' own frames.
import sys
import bpy, bmesh, json, math
from mathutils import Vector, Matrix

def clear():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.meshes):
        if m.users == 0: bpy.data.meshes.remove(m)

def _align(p0, p1):
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    L = d.length
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    return L, Matrix.Translation((p0 + p1) / 2) @ q.to_matrix().to_4x4()

class Builder:
    def __init__(self):
        self.bm = bmesh.new()
    def sphere(self, c, r, scale=(1, 1, 1), rot=None, seg=24):
        m = Matrix.Translation(Vector(c))
        if rot is not None: m = m @ rot
        m = m @ Matrix.Diagonal((scale[0], scale[1], scale[2], 1))
        bmesh.ops.create_uvsphere(self.bm, u_segments=seg, v_segments=seg // 2, radius=r, matrix=m)
    def capsule(self, p0, p1, r0, r1=None, seg=20):
        r1 = r0 if r1 is None else r1
        L, m = _align(p0, p1)
        if L > 1e-6:
            bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=seg,
                                  radius1=r0, radius2=r1, depth=L, matrix=m)
        self.sphere(p0, r0, seg=seg)
        self.sphere(p1, r1, seg=seg)
    def chain(self, pts, radii, seg=20):
        for i in range(len(pts) - 1):
            self.capsule(pts[i], pts[i + 1], radii[i], radii[i + 1], seg)
    def box(self, c, size, rot=None):
        m = Matrix.Translation(Vector(c))
        if rot is not None: m = m @ rot
        m = m @ Matrix.Diagonal((size[0], size[1], size[2], 1))
        bmesh.ops.create_cube(self.bm, size=1.0, matrix=m)
    def cylinder(self, p0, p1, r, seg=32):
        L, m = _align(p0, p1)
        bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=seg,
                              radius1=r, radius2=r, depth=L, matrix=m)
    def lathe(self, profile, axis_rot=None, seg=48, center=(0,0,0), scale=(1,1,1)):
        # profile: list of (radius, height) along +Z, closed at ends with radius 0
        verts = []
        rings = []
        for (r, h) in profile:
            ring = []
            for k in range(seg):
                a = 2 * math.pi * k / seg
                ring.append(self.bm.verts.new((r * math.cos(a), r * math.sin(a), h)))
            rings.append(ring)
        for i in range(len(rings) - 1):
            for k in range(seg):
                a, b = rings[i][k], rings[i][(k + 1) % seg]
                c, d = rings[i + 1][(k + 1) % seg], rings[i + 1][k]
                self.bm.faces.new((a, b, c, d))
        self.bm.faces.new(list(reversed(rings[0])))
        self.bm.faces.new(rings[-1])
        m = Matrix.Translation(Vector(center))
        if axis_rot is not None: m = m @ axis_rot
        m = m @ Matrix.Diagonal((scale[0], scale[1], scale[2], 1))
        allv = [v for ring in rings for v in ring]
        bmesh.ops.transform(self.bm, matrix=m, verts=allv)
    def obj(self, name):
        me = bpy.data.meshes.new(name)
        self.bm.normal_update()
        self.bm.to_mesh(me)
        self.bm.free()
        o = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(o)
        return o

def process(o, voxel, smooth=0.5, smooth_iter=6, cutters=(), target_tris=3000, adaptivity=0.0):
    r = o.modifiers.new('remesh', 'REMESH')
    r.mode = 'VOXEL'; r.voxel_size = voxel; r.adaptivity = adaptivity
    if smooth_iter:
        s = o.modifiers.new('smooth', 'LAPLACIANSMOOTH')
        s.lambda_factor = smooth; s.iterations = smooth_iter
        s.use_volume_preserve = True
    for c in cutters:
        b = o.modifiers.new('bool', 'BOOLEAN')
        b.operation = 'DIFFERENCE'; b.object = c; b.solver = 'EXACT'
        c.hide_set(True); c.hide_render = True
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    tris = sum(len(p.vertices) - 2 for p in me.polygons)
    o2 = bpy.data.objects.new(o.name + '_p', me)
    bpy.context.scene.collection.objects.link(o2)
    if tris > target_tris:
        d = o2.modifiers.new('dec', 'DECIMATE')
        d.ratio = target_tris / tris
        d.use_collapse_triangulate = True
        dg = bpy.context.evaluated_depsgraph_get()
        me2 = bpy.data.meshes.new_from_object(o2.evaluated_get(dg))
        o2.modifiers.clear()
        o2.data = me2
    return o2

def export(o, path, extra=None):
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-6)
    bm.verts.index_update()
    verts = [[round(c, 5) for c in v.co] for v in bm.verts]
    tris = [[v.index for v in f.verts] for f in bm.faces]
    nonmanifold = sum(1 for e in bm.edges if len(e.link_faces) != 2)
    bm.free()
    data = {'positions': verts, 'triangles': tris}
    if extra: data.update(extra)
    with open(path, 'w') as f: json.dump(data, f)
    return {'verts': len(verts), 'tris': len(tris), 'nonmanifold': nonmanifold}

def export_grouped(o, path, extra=None):
    # Triangles ordered by material index; 'groupStarts' gives the first
    # triangle-index offset (in indices) of each material after the first.
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-6)
    bm.verts.index_update()
    verts = [[round(c, 5) for c in v.co] for v in bm.verts]
    faces = sorted(bm.faces, key=lambda f: f.material_index)
    tris = [[v.index for v in f.verts] for f in faces]
    mats = [f.material_index for f in faces]
    starts = [3 * mats.index(m) for m in sorted(set(mats))[1:]]
    nonmanifold = sum(1 for e in bm.edges if len(e.link_faces) != 2)
    bm.free()
    data = {'positions': verts, 'triangles': tris, 'groupStarts': starts}
    if extra: data.update(extra)
    with open(path, 'w') as f: json.dump(data, f)
    return {'verts': len(verts), 'tris': len(tris), 'nonmanifold': nonmanifold, 'groupStarts': starts}

def union_with(o, other):
    b = o.modifiers.new('union', 'BOOLEAN')
    b.operation = 'UNION'; b.object = other; b.solver = 'EXACT'
    other.hide_set(True); other.hide_render = True
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    o.modifiers.clear(); o.data = me
    return o

def with_material(o, index, count=2):
    for k in range(count):
        o.data.materials.append(bpy.data.materials.get('fig%d' % k) or bpy.data.materials.new('fig%d' % k))
    for poly in o.data.polygons: poly.material_index = index
    return o


def build_hand(OUT):
    clear()
    S = 0.031  # grip units per cm
    RHO = 1.1  # rope channel radius in cm (baked; remapped per rope at load)
    b = Builder()
    # Fingers wrap the rope in planes across it: (x, radius, MCP, PIP, DIP, tip) in cm.
    fingers = [
      ( 2.85, 0.90, (-1.0, 2.8), (-2.7, -0.7), (-0.9, -2.4), (0.9, -2.1)),
      ( 0.95, 0.93, (-1.3, 2.9), (-2.8, -0.9), (-0.8, -2.5), (1.0, -2.1)),
      (-0.95, 0.88, (-1.2, 2.8), (-2.7, -0.9), (-0.7, -2.4), (0.9, -2.0)),
      (-2.75, 0.78, (-0.9, 2.5), (-2.5, -0.8), (-0.8, -2.2), (0.7, -1.9)),
    ]
    W = (-5.4, 4.0, 0.6)   # wrist centre: palm axis runs down the rope toward the forearm
    for i, (x, r, mcp, pip, dip, tip) in enumerate(fingers):
        pts = [(x, *mcp), (x, *pip), (x, *dip), (x, *tip)]
        b.chain(pts, [r * 1.08, r, r * 0.93, r * 0.8])
        b.sphere((x, *mcp), r * 1.22)          # knuckle
        # metacarpal to the carpus
        c = (W[0] + x * 0.35, W[1] - 0.2, W[2] + 0.4)
        b.capsule((x, mcp[0] + 0.5, mcp[1] - 0.45), c, r * 1.45, 1.75)
    # flat dorsum slab over the metacarpals
    import mathutils
    axis = (Vector(W) - Vector((0, -1.2, 2.7))).normalized()
    q = Vector((0, 1, 0)).rotation_difference(axis).to_matrix().to_4x4()
    for t, wdt in ((0.3, 3.7), (0.55, 3.4), (0.8, 3.0)):
        c = Vector((0, -1.2, 2.7)).lerp(Vector(W), t)
        b.sphere(tuple(c), 1.0, scale=(wdt, 1.9, 1.35), rot=q)
    # palm mass / heel of the hand behind the rope
    b.sphere((-2.4, 2.6, 0.2), 2.3, scale=(1.3, 0.9, 0.8))
    b.sphere((0.5, 2.3, 0.6), 2.0, scale=(1.4, 0.8, 0.9))
    # wrist
    b.sphere(W, 2.2, scale=(1.0, 1.0, 0.8))
    # thumb: thenar, metacarpal, phalanges curling round the rope's top end
    T0 = (1.2, 3.3, -0.6)
    T1 = (3.9, 1.6, -1.6)
    T2 = (4.4, -0.9, -1.6)
    T3 = (3.5, -2.6, -0.4)
    b.sphere((0.6, 2.9, -0.9), 1.7, scale=(1.5, 1.0, 0.9))
    b.chain([T0, T1, T2, T3], [1.3, 1.05, 0.95, 0.82])
    o = b.obj('fist_cm')
    bmesh_m = Matrix.Diagonal((S, S, S, 1))
    o.data.transform(bmesh_m)
    # rope channel along X
    cb = Builder(); cb.cylinder((-0.5, 0, 0), (0.5, 0, 0), RHO * S, seg=48)
    cut = cb.obj('channel')
    p = process(o, 0.0045, smooth=0.9, smooth_iter=14, cutters=[cut], target_tris=3200)
    info = export(p, OUT + 'hand-fist.json', {'channelRadius': RHO * S, 'wrist': [c * S for c in W]})
    return info

def build_forearm(OUT):
    import math
    for n in ('forearm','cuff','forearm_p','cuff_p'):
        if n in bpy.data.objects: bpy.data.objects.remove(bpy.data.objects[n], do_unlink=True)
    S = 0.031
    def wavy(name, profile, seg=48, waves=0, amp=None, flat=1.0):
        bm = bmesh.new(); rings = []
        for j, (r, h) in enumerate(profile):
            ring = []
            for k in range(seg):
                a = 2 * math.pi * k / seg
                rr = r * (1 + (amp[j] if amp else 0) * math.cos(waves * a))
                # local: axis along -Y, cross-section in X (width) and Z (flattened)
                ring.append(bm.verts.new((rr * math.cos(a) * S, -h * S, rr * math.sin(a) * flat * S)))
            rings.append(ring)
        for i in range(len(rings) - 1):
            for k in range(seg):
                bm.faces.new((rings[i][k], rings[i + 1][k], rings[i + 1][(k + 1) % seg], rings[i][(k + 1) % seg]))
        bm.faces.new(rings[0]); bm.faces.new(list(reversed(rings[-1])))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
        o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o); return o
    # forearm from the wrist (y=0) down its length; oval section wider across the dorsum
    fore = wavy('forearm', [(1.2, -1.0), (2.2, -0.6), (2.55, 0.5), (2.7, 3.0), (3.2, 7.0), (3.6, 11.0), (3.7, 14.5), (3.6, 17.0), (2.0, 17.6)], flat=0.78)
    cuff = wavy('cuff', [(3.2, 11.8), (3.9, 12.2), (4.3, 13.5), (4.9, 15.5), (5.5, 17.3), (5.3, 17.8), (3.5, 17.8)], waves=9,
                amp=[0, 0.02, 0.04, 0.07, 0.10, 0.10, 0.0], flat=0.85)
    r1 = export(fore, OUT + 'hand-forearm.json')
    r2 = export(cuff, OUT + 'hand-cuff.json')

def build_walker(OUT):
    res = {}
    clear()
    import math
    F = 1.2
    # --- jacket: a loose smock seen from behind, inside the old lathe envelope
    prof = [(0.192,-0.24),(0.212,-0.19),(0.206,-0.06),(0.198,0.12),(0.212,0.31),(0.216,0.47),(0.29,0.545),(0.302,0.595),(0.27,0.645),(0.19,0.685),(0.11,0.71),(0.0,0.715)]
    b = Builder()
    b.lathe([(r*0.97, y) for r, y in prof[:-1]] , axis_rot=Matrix.Rotation(-math.pi/2, 4, 'X'), seg=40, scale=(0.78, 1, 1))
    # shoulders and upper back
    for s in (-1, 1):
        b.sphere((0.0, 0.575, s*0.235), 0.1, scale=(0.95, 0.85, 1.0))
    b.sphere((0.02, 0.44, 0), 0.15, scale=(1.0, 1.1, 1.35))
    o = b.obj('jacket')
    p = process(o, 0.008, smooth=0.8, smooth_iter=10, target_tris=2400)
    res['jacket'] = export(p, OUT + 'man-jacket.json')
    # --- head with ears and neck (skin); the face looks away, toward the drum
    b = Builder()
    b.sphere((0, 0.96, 0), 1.0, scale=(0.162, 0.192, 0.152))
    b.sphere((-0.05, 0.9, 0), 1.0, scale=(0.13, 0.12, 0.125))           # jaw
    b.capsule((-0.16, 0.95, 0), (-0.175, 0.9, 0), 0.028, 0.03)           # nose
    for s in (-1, 1):
        b.sphere((0.0, 0.94, s*0.152), 1.0, scale=(0.045, 0.06, 0.022))  # ears
    b.capsule((0.0, 0.66, 0), (0.0, 0.84, 0), 0.075, 0.07)               # neck
    o = b.obj('head')
    p = process(o, 0.006, smooth=0.7, smooth_iter=8, target_tris=1600)
    res['head'] = export(p, OUT + 'man-head.json')
    # --- close round cap with a band, covering the back of the head to the ears
    b = Builder()
    b.sphere((0.012, 0.975, 0), 1.0, scale=(0.178, 0.2, 0.168))
    b.capsule((0.012, 0.93, 0), (0.012, 0.95, 0), 0.0, 0.0)
    o = b.obj('capdome')
    cb = Builder()
    # cut away everything below a plane rising from the nape to the brow
    cb.box((0.0, 0.62, 0), (1.0, 0.6, 1.0), rot=Matrix.Rotation(math.radians(-24), 4, 'Z'))
    cb.sphere((0, 0.96, 0), 1.0, scale=(0.158, 0.188, 0.148))
    cut = cb.obj('capcut')
    p = process(o, 0.005, smooth=0.5, smooth_iter=4, cutters=[cut], target_tris=1400)
    res['cap'] = export(p, OUT + 'man-cap.json')
    # --- arms: sleeves from the shoulder out to a wide elbow and up to the wrist
    for side, name in ((1, 'man-arm-left'), (-1, 'man-arm-right')):
        b = Builder()
        S0 = (0.0, 0.57, side*0.26); E = (0.02, 0.73, side*0.6); Wr = (-0.19, 1.02, side*0.51)
        b.chain([S0, E, Wr], [0.092, 0.074, 0.062])
        b.sphere(S0, 0.1)
        b.capsule((-0.155, 0.975, side*0.525), (-0.185, 1.01, side*0.515), 0.068, 0.068)  # sleeve cuff
        o = b.obj(name)
        p = process(o, 0.007, smooth=0.7, smooth_iter=8, target_tris=1400)
        res[name] = export(p, OUT + name+'.json')
    # --- one continuous trouser leg, modelled straight down -y from the hip
    # pivot (y = 0) through the knee (y = -0.74) to the ankle (y = -1.44);
    # the factory bends it at the knee (src/simulation/figure-meshes.js).
    # Front (kneecap, shin) toward -x, calf and seat of the knee toward +x.
    b = Builder()
    b.chain([(0, 0, 0), (0, -0.36, 0), (0, -0.66, 0), (0, -0.74, 0), (0.008, -0.95, 0),
             (0, -1.24, 0), (0, -1.40, 0), (0, -1.44, 0)],
            [0.094, 0.09, 0.08, 0.077, 0.074, 0.064, 0.062, 0.06], seg=24)
    b.sphere((-0.03, -0.74, 0), 1.0, scale=(0.05, 0.06, 0.055))        # kneecap
    b.sphere((0.02, -0.93, 0), 1.0, scale=(0.06, 0.13, 0.062))         # calf
    p = process(b.obj('leg'), 0.007, smooth=0.6, smooth_iter=8, target_tris=3600)
    res['leg'] = export(p, OUT + 'man-leg.json')
    # --- laced shoe (pass 83), in the foot frame: flat sole at y = -0.05
    # with the 0.28 x 0.11 footprint, toe toward -x, the ankle at
    # (0.035, 0.05). A rounded toe box, the vamp rising over the instep and
    # the heel counter and quarters closing round the ankle, where the
    # trouser cuff comes down over them.
    b = Builder()
    # upper lofted from overlapping sections: (x, top height, half-width)
    upper = [(-0.128, -0.022, 0.030), (-0.105, -0.008, 0.043), (-0.075, 0.008, 0.050),
             (-0.04, 0.022, 0.052), (-0.01, 0.038, 0.050), (0.02, 0.058, 0.048),
             (0.045, 0.072, 0.047), (0.07, 0.07, 0.046), (0.095, 0.058, 0.045),
             (0.115, 0.045, 0.042), (0.128, 0.028, 0.036)]
    for i in range(len(upper) - 1):
        for k in range(6):
            f = k / 6
            x, top, w = [upper[i][j] * (1 - f) + upper[i + 1][j] * f for j in range(3)]
            b.sphere((x, (top - 0.05) / 2, 0), 1.0, scale=(0.018, (top + 0.05) / 2, w))
    b.sphere((upper[-1][0], (upper[-1][1] - 0.05) / 2, 0), 1.0, scale=(0.018, (upper[-1][1] + 0.05) / 2, upper[-1][2]))
    b.box((0.0, -0.044, 0), (0.25, 0.012, 0.104))                         # welt and sole
    for x in (-0.125, 0.125):
        b.cylinder((x, -0.05, 0), (x, -0.038, 0), 0.052 if x > 0 else 0.046)
    p = process(b.obj('shoe'), 0.004, smooth=0.8, smooth_iter=10, target_tris=1100)
    res['shoe'] = export(p, OUT + 'man-shoe.json')
    return res

def build_horse(OUT):
    res = {}
    clear()
    def path(b, pts, radii, zs=0.7, n=6):
        for i in range(len(pts) - 1):
            for k in range(n + 1):
                t = k / n
                p = [pts[i][j] * (1 - t) + pts[i + 1][j] * t for j in range(3)]
                r = radii[i] * (1 - t) + radii[i + 1] * t
                b.sphere(p, r, scale=(1, 1, zs), seg=20)
    b = Builder()
    b.sphere((0.06, 0.05, 0), 1, scale=(0.60, 0.29, 0.23))       # barrel
    b.sphere((-0.42, 0.04, 0), 1, scale=(0.22, 0.29, 0.20))      # chest
    b.sphere((0.50, 0.10, 0), 1, scale=(0.27, 0.28, 0.235))      # hindquarters
    b.sphere((-0.30, 0.25, 0), 1, scale=(0.18, 0.15, 0.15))      # withers
    for s in (-1, 1):
        b.sphere((-0.42, -0.13, s * 0.15), 1, scale=(0.13, 0.22, 0.09))   # shoulder / elbow
        b.sphere((0.36, -0.06, s * 0.15), 1, scale=(0.21, 0.26, 0.10))    # thigh / stifle
        # upper arm from the point of the shoulder back and down to the
        # elbow, which is centred on the foreleg's pivot (-0.425, -0.265,
        # +-0.22), so the forearm's top turns inside it at any swing.
        path(b, [(-0.52, -0.02, s * 0.14), (-0.425, -0.265, s * 0.21)], [0.08, 0.116], zs=0.8, n=6)
    path(b, [(-0.46, 0.14, 0), (-0.74, 0.40, 0), (-0.96, 0.63, 0), (-1.05, 0.74, 0)], [0.24, 0.17, 0.12, 0.095])
    # crest along the top of the neck, which carries the mane
    path(b, [(-0.42, 0.36, 0), (-0.66, 0.53, 0), (-0.90, 0.72, 0), (-1.02, 0.80, 0)], [0.05, 0.05, 0.045, 0.03], zs=0.5, n=5)
    # head: jowl, face, muzzle with the nose dropped
    path(b, [(-1.06, 0.71, 0), (-1.15, 0.58, 0), (-1.23, 0.46, 0), (-1.27, 0.40, 0)], [0.105, 0.088, 0.078, 0.074], zs=0.72)
    b.sphere((-1.09, 0.62, 0), 1, scale=(0.13, 0.12, 0.085))
    b.sphere((-1.28, 0.385, 0), 1, scale=(0.075, 0.07, 0.06))
    for s in (-1, 1):
        b.capsule((-1.02, 0.80, s * 0.05), (-0.99, 0.97, s * 0.07), 0.034, 0.008)   # ears
    b.sphere((0.74, 0.20, 0), 0.05)
    o = b.obj('horse')
    p = with_material(process(o, 0.01, smooth=0.8, smooth_iter=10, target_tris=4200), 0)
    # Brown's mane: a jagged row of hair locks standing up and back along
    # the crest from the poll to the withers (second material, the tail's).
    mb = Builder()
    crest = [(-1.0, 0.80), (-0.90, 0.735), (-0.66, 0.545), (-0.44, 0.375)]
    def crest_at(t):
        f = t * (len(crest) - 1); i = min(int(f), len(crest) - 2); a = f - i
        return [crest[i][k] * (1 - a) + crest[i + 1][k] * a for k in range(2)]
    count = 23
    for k in range(count):
        t = (k + 0.5) / count
        p0 = crest_at(max(0.0, t - 0.01)); p1 = crest_at(min(1.0, t + 0.01))
        ax, ay = p1[0] - p0[0], p1[1] - p0[1]; n = math.hypot(ax, ay); ax, ay = ax / n, ay / n
        nx, ny = -ay, ax                          # up from the crest
        if ny < 0: nx, ny = -nx, -ny
        back = 0.8                                # locks sweep toward the withers
        dx, dy = nx + back * ax, ny + back * ay; m = math.hypot(dx, dy); dx, dy = dx / m, dy / m
        length = (0.09, 0.13, 0.105, 0.145, 0.115)[k % 5] * (0.7 + 0.3 * math.sin(math.pi * t))
        base = crest_at(t)
        bx, by = base[0] - 0.012 * nx, base[1] - 0.012 * ny
        side = (0.012, -0.01, 0.006, -0.014, 0.0)[k % 5]
        mb.capsule((bx, by, 0.0), (bx + length * dx, by + length * dy, side), 0.034, 0.005, seg=16)
    mane = mb.obj('mane')
    for v in mane.data.vertices: v.co.z *= 0.55
    mane = with_material(process(mane, 0.004, smooth=0.4, smooth_iter=3, target_tris=1800), 1)
    res['body'] = export_grouped(union_with(p, mane), OUT + 'horse-body.json')
    # legs: each is one continuous limb hanging from the shoulder/hip pivot
    # (y = 0) through the knee or hock (the factory's bend pivot, y = -0.43),
    # cannon, fetlock and sloping pastern to the hoof, whose sole lies at
    # y = -0.86 with the toe forward (-x). The hoof is joined on exactly and
    # carries the second material. The factory bends each leg at the knee.
    def hoof():
        hb = Builder(); bm = hb.bm
        rings = [(-0.86, -0.073, 0.066, 0.052), (-0.775, -0.030, 0.042, 0.038)]
        vs = []
        for (y, cx, rx, rz) in rings:
            vs.append([bm.verts.new((cx + rx * math.cos(2 * math.pi * k / 32), y, rz * math.sin(2 * math.pi * k / 32))) for k in range(32)])
        for k in range(32):
            bm.faces.new((vs[0][k], vs[0][(k + 1) % 32], vs[1][(k + 1) % 32], vs[1][k]))
        bm.faces.new(list(reversed(vs[0]))); bm.faces.new(vs[1])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        return with_material(hb.obj('hoof'), 1)
    def lower_leg(b, hind):
        # knee or hock, cannon, fetlock with its ergot, pastern
        path(b, [(0.0, -0.44, 0), (0.002, -0.58, 0), (0.004, -0.70, 0)], [0.042 if hind else 0.040, 0.037, 0.039], zs=0.78, n=8)
        b.sphere((0.008, -0.735, 0), 1, scale=(0.05, 0.046, 0.04))          # fetlock
        b.sphere((0.04, -0.75, 0), 0.016)                                   # ergot
        path(b, [(0.006, -0.745, 0), (-0.014, -0.765, 0), (-0.03, -0.782, 0)], [0.036, 0.034, 0.036], zs=0.9, n=6)
    # foreleg: forearm with its muscle to the front, flat knee
    b = Builder()
    path(b, [(0.0, 0.03, 0), (-0.008, -0.16, 0), (0.0, -0.33, 0), (0.0, -0.41, 0)], [0.085, 0.07, 0.05, 0.045], zs=0.78, n=8)
    b.sphere((-0.02, -0.12, 0), 1, scale=(0.08, 0.14, 0.064))               # forearm muscle
    b.sphere((0.0, -0.43, 0), 1, scale=(0.05, 0.055, 0.042))                # knee (carpus)
    lower_leg(b, False)
    p = with_material(process(b.obj('foreleg'), 0.007, smooth=0.6, smooth_iter=8, target_tris=3200), 0)
    res['fore'] = export_grouped(union_with(p, hoof()), OUT + 'horse-foreleg.json')
    # hind leg: gaskin with its muscle to the rear, hock with its point
    b = Builder()
    path(b, [(0.0, 0.03, 0), (0.02, -0.16, 0), (0.004, -0.33, 0), (0.0, -0.41, 0)], [0.092, 0.074, 0.052, 0.046], zs=0.78, n=8)
    b.sphere((0.03, -0.11, 0), 1, scale=(0.088, 0.14, 0.066))               # gaskin muscle
    b.sphere((0.0, -0.43, 0), 1, scale=(0.052, 0.058, 0.044))               # hock
    path(b, [(0.012, -0.30, 0), (0.042, -0.40, 0), (0.05, -0.425, 0)], [0.022, 0.024, 0.026], zs=0.8, n=6)   # tendon to the point of the hock
    lower_leg(b, True)
    p = with_material(process(b.obj('hindleg'), 0.007, smooth=0.6, smooth_iter=8, target_tris=3200), 0)
    res['hind'] = export_grouped(union_with(p, hoof()), OUT + 'horse-hindleg.json')
    b = Builder()
    path(b, [(0, 0, 0), (0.1, -0.1, 0), (0.17, -0.3, 0), (0.2, -0.5, 0), (0.25, -0.64, 0)], [0.035, 0.05, 0.062, 0.05, 0.02], zs=0.55, n=6)
    p = process(b.obj('tail'), 0.006, smooth=0.6, smooth_iter=6, target_tris=700)
    res['tail'] = export(p, OUT + 'horse-tail.json')
    return res

def build_all(out):
    out = out.rstrip('/') + '/'
    report = {'hand': build_hand(out)}
    build_forearm(out)
    report['walker'] = build_walker(out)
    report['horse'] = build_horse(out)
    return report

if __name__ == '__main__' and '--' in sys.argv:
    print(build_all(sys.argv[sys.argv.index('--') + 1]))
elif 'FIGURE_OUT' in globals():
    result = {'parts': str(build_all(FIGURE_OUT))}
