"""Bounded rejected construction study; never emits production geometry/motion.

Requires Python 3, numpy and shapely. See the family review for commands.
The local continuation failure is not a proof of mechanical impossibility.
"""
import json
import math
import sys

import numpy as np
from shapely.affinity import rotate, translate
from shapely.geometry import Point, Polygon
from shapely.ops import unary_union

with open(sys.argv[1], encoding="utf-8") as stream:
    models = json.load(stream)


def turn(shape, angle):
    return rotate(shape, angle, origin=(0, 0), use_radians=True)


def local(shape, angle, distance):
    return translate(turn(translate(shape, 0, -distance), -angle), 0, distance)


report = {"installed": False, "scope": "Rejected finite profile/timing candidates; no force or dynamics validation."}
model = models["306"]
g = model["g"]
leg = unary_union([Polygon(t) for t in model["legTriangles"] if Polygon(t).area > 1e-14])
wheel = unary_union([turn(leg, k * math.tau / 3) for k in range(3)])
swept = unary_union([local(turn(wheel, s["wheelAngle"]), s["palletAngle"], g["centerDistance"]) for s in model["poses"]])
worst = (0, 0)
for state in model["poses"]:
    if state["contactKind"] != "direct-impulse":
        continue
    p = state["activeToothTip"]
    point = local(Point(p["x"], p["y"]), state["palletAngle"], g["centerDistance"])
    worst = max(worst, (point.distance(swept.boundary), state["t"]))
report["306"] = {"samples": len(model["poses"]), "largestActiveTipInsetInFullWheelSweep": worst[0], "time": worst[1], "rejection": "Cutting the complete old motion envelope removes material around the active impulse tip. Clearance alone cannot qualify that face."}

model = models["307"]
g = model["g"]
D = g["centerDistance"]
R = math.hypot(D, g["longToothRadius"])
r = g["impulsePinRadius"]
pieces = {}
for side in ["D-left", "E-right"]:
    rows = [s for s in model["poses"] if s["contactKind"] == "dead-lock" and ((s["halfPhase"] < g["releaseHalfPhase"] and s["startingLockSide"] == side) or (s["halfPhase"] >= g["landingHalfPhase"] and s["landingLockSide"] == side))]
    angles = [math.atan2(s["activePoint"]["y"]-g["palletPivot"]["y"], s["activePoint"]["x"])-s["palletAngle"] for s in rows]
    sign = 1 if side == "D-left" else -1
    arc = np.linspace(min(angles), max(angles), 65)
    front = [[math.cos(a)*(R-sign*.0005), D+math.sin(a)*(R-sign*.0005)] for a in arc]
    back = [[math.cos(a)*(R-sign*.13), D+math.sin(a)*(R-sign*.13)] for a in arc[::-1]]
    pieces[side] = Polygon(front+back)

# One simpler replacement for the inherited smoothstep: linear wheel advance
# during impulse, with the same end angles. This candidate is NOT installed.
rows_by_side = {}
for side in ["A-upper", "B-lower"]:
    rows = [dict(s) for s in model["poses"] if s["contactKind"] == "direct-impulse" and s["impulsePallet"] == side]
    points = []
    for s in rows:
        advance = g["impulseAdvance"]*(s["halfPhase"]-g["releaseHalfPhase"])/(g["impulseEndHalfPhase"]-g["releaseHalfPhase"])
        s["wheelAngle"] = math.pi-s["halfBeatIndex"]*math.pi/3-advance
        a = s["wheelAngle"]+s["activeIndex"]*math.tau/3+g["impulsePinPhaseOffset"]
        s["activePoint"] = {"x": .39*math.cos(a), "y": g["wheelCenter"]["y"]+.39*math.sin(a)}
        points.append(local(Point(.39*math.cos(a), .39*math.sin(a)), s["palletAngle"], D).coords[0])
    points = np.array(points)
    tangent = np.gradient(points, axis=0)
    normals = np.stack([-tangent[:, 1], tangent[:, 0]], axis=1)
    normals /= np.linalg.norm(normals, axis=1)[:, None]
    for i, s in enumerate(rows):
        a = s["palletAngle"]
        n = np.array([[math.cos(a), -math.sin(a)], [math.sin(a), math.cos(a)]]) @ normals[i]
        p = s["activePoint"]
        if p["x"]*n[1]-(p["y"]-g["wheelCenter"]["y"])*n[0] < 0:
            normals[i] *= -1
    pieces[side] = Polygon(np.vstack([points-(r+.0005)*normals, (points-(r+.14)*normals)[::-1]])).buffer(0)
    rows_by_side[side] = rows

leg = Polygon([[.12, -.055], [1.52, -.055], [1.70, .10], [1.88, 0], [1.70, .18], [1.50, .055], [.12, .055]])
wheel = unary_union([turn(leg, k*math.tau/3) for k in range(3)])
pins = unary_union([Point(.39*math.cos(k*math.tau/3-3*math.pi/4), .39*math.sin(k*math.tau/3-3*math.pi/4)).buffer(r, resolution=24) for k in range(3)])


def overlap(q, a):
    outer, inner = local(turn(wheel, q), a, D), local(turn(pins, q), a, D)
    return max(((outer if key[0] in "DE" else inner).intersection(part).area, key) for key, part in pieces.items())


# Check a bounded clockwise local seed before attempting continuation. The
# collision is with real candidate pin circles and all neighbours, not a point.
alpha = -g["pendulumAmplitude"]
trials = [(overlap(float(q), alpha)[0], float(q), overlap(float(q), alpha)[1]) for q in np.linspace(math.pi+.001, math.pi-.14, 72)]
best = min(trials)
report["307"] = {"candidate": "Concentric outer rests; one-sided pin-radius-offset faces generated from linear impulse advance.", "localContinuationSeed": {"time": 0, "palletAngle": alpha, "wheelAngleRange": [math.pi-.14, math.pi+.001], "samples": 72, "minimumOverlapArea": best[0], "wheelAngle": best[1], "interferingFace": best[2]}, "rejection": "No clear initial seed in this bounded local range. This rejects this candidate only, not all possible sharp-edged-pin/face reconstructions."}
assert worst[0] > .2, "Study no longer reproduces the rejected swept aperture"
assert best[0] > .001, "Study no longer reproduces the rejected local continuation seed"
with open(sys.argv[2], "w", encoding="utf-8") as stream:
    json.dump(report, stream, indent=2)
    stream.write("\n")
print(json.dumps(report, indent=2))
