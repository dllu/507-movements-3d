import json,os,math
from shapely.geometry import Polygon,MultiPoint
from shapely.ops import unary_union
from shapely.affinity import rotate
source=json.load(open('/dev/shm/208-pin-envelope.json'))
blank=unary_union([Polygon(t) for t in source['blank'] if Polygon(t).area>1e-12]);original=blank.area
cutter=unary_union([MultiPoint(p).convex_hull.buffer(.001,resolution=2) for p in source['cutters']])
for index in range(16):blank=blank.difference(rotate(cutter,index*360/16,origin=(0,0)))
blank=blank.simplify(.00015,preserve_topology=True);assert blank.geom_type=='Polygon'
outline=[[round(x,7),round(y,7)] for x,y in blank.exterior.coords]
with open(os.environ.get('BAKED_OUTPUT','src/simulation/generated-pin-slot-208.js'),'w') as f:f.write('// Generated offline by scripts/generate-208-pin-envelope.py.\nexport default '+json.dumps(outline,separators=(',',':'))+';\n')
print({'points':len(outline),'retainedArea':blank.area/original})
