import json,os,math
from shapely.geometry import Polygon,MultiPoint
from shapely.ops import unary_union
from shapely.affinity import rotate
source=json.load(open('/dev/shm/208-pin-envelope.json'))
blank=unary_union([Polygon(t) for t in source['blank'] if Polygon(t).area>1e-12]);original=blank.area
cutter=unary_union([MultiPoint(p).convex_hull.buffer(.001,resolution=2) for p in source['cutters']])
for index in range(16):blank=blank.difference(rotate(cutter,index*360/16,origin=(0,0)))
# Morphological opening (can only remove material): it clears the swept
# cutter's per-pose cusps (zigzags). OPEN stays small: the slender hooked
# tooth tips left between the three rings' pin sweeps are the working teeth
# and a larger opening would cut them away.
OPEN=float(os.environ.get('OPEN','0.002'))
if OPEN>0:
  blank=blank.buffer(-OPEN,resolution=32).buffer(OPEN,resolution=32)
  blank=max(getattr(blank,'geoms',[blank]),key=lambda g:g.area)
blank=blank.simplify(.0001 if OPEN>0 else .00015,preserve_topology=True);assert blank.geom_type=='Polygon'
outline=[[round(x,7),round(y,7)] for x,y in blank.exterior.coords]
with open(os.environ.get('BAKED_OUTPUT','src/simulation/generated-pin-slot-208.js'),'w') as f:f.write('// Generated offline by scripts/generate-208-pin-envelope.py.\nexport default '+json.dumps(outline,separators=(',',':'))+';\n')
print({'points':len(outline),'retainedArea':blank.area/original})
