import json
from shapely.geometry import Polygon
from shapely.ops import unary_union
from shapely.affinity import affine_transform
rows=json.load(open('/dev/shm/205-209-contact.json'))
results=[]
for row in rows:
 pairs=[[unary_union([Polygon(t) for t in triangles]) for triangles in pair] for pair in row['pairs']]
 maximum=0;count=0;gaps=[]
 for pose in row['poses']:
  closest=[]
  for (a,b),transform in zip(pairs,pose):
   other=affine_transform(b,transform);overlap=a.intersection(other).area;maximum=max(maximum,overlap);count+=overlap>1e-10;closest.append(a.distance(other))
  gaps.append(min(closest))
 result={'id':row['id'],'poses':len(row['poses']),'overlap':maximum,'penetratingPairPoses':count,'maximumClosestGap':max(gaps)};results.append(result);print(result,flush=True)
json.dump(results,open('/dev/shm/205-209-planar-report.json','w'))
