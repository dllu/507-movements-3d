import json,os
from smooth_profile_ease import ease
from shapely.geometry import Polygon
from shapely.ops import unary_union
from shapely.affinity import affine_transform
rows=json.load(open('/dev/shm/205-209-contact.json'))
def outline(p):return [[round(x,7),round(y,7)] for x,y in p.exterior.coords]
cam=unary_union([Polygon(t) for t in rows[0].get('generationPairs',rows[0]['pairs'])[0][0]]).buffer(-.001,resolution=2).simplify(.00001,preserve_topology=True)
camArea=cam.area
camCutter=unary_union([Polygon(t) for t in rows[0]['generationPairs'][0][1]]).buffer(.0005,resolution=2)
for pose in rows[0]['generation']:cam=cam.difference(affine_transform(camCutter,pose))
cam=ease(cam);print({'camRetainedArea':cam.area/camArea},flush=True)
row=rows[1];a,b=[unary_union([Polygon(t) for t in triangles]) for triangles in row.get('generationPairs',row['pairs'])[0]];blank=b;original=blank.area;cutter=a.buffer(.0007,resolution=2)
for p in row['generation']:
 a,b,d,e,x,y=p;det=a*e-b*d
 inverse=[e/det,-b/det,-d/det,a/det,(b*y-e*x)/det,(d*x-a*y)/det]
 blank=blank.difference(affine_transform(cutter,inverse))
blank=blank.simplify(.00002,preserve_topology=True)
if blank.geom_type=='MultiPolygon':
 print({'pieceAreas':sorted([p.area for p in blank.geoms],reverse=True)},flush=True);blank=max(blank.geoms,key=lambda p:p.area)
assert blank.geom_type=='Polygon';blank=ease(blank);result={'cam205':outline(cam),'driven209':outline(blank)}
with open(os.environ.get('BAKED_OUTPUT','src/simulation/generated-variable-drive-205-209.js'),'w') as f:f.write('// Generated offline by scripts/generate-205-209-profiles.py.\nexport default '+json.dumps(result,separators=(',',':'))+';\n')
print({'camPoints':len(result['cam205']),'drivenPoints':len(result['driven209']),'retainedDrivenArea':blank.area/original},flush=True)
