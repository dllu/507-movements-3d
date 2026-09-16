import json
from shapely.geometry import Polygon
from shapely.ops import unary_union
from shapely.affinity import affine_transform
source=json.load(open('/dev/shm/irregular-contact-input.json'))
results=[]
for row in source['results']:
 a=unary_union([Polygon(t) for t in row['trianglesA']]);b=unary_union([Polygon(t) for t in row['trianglesB']])
 overlap=[];gap=[]
 for pose in row['poses']:
  other=affine_transform(b,pose);overlap.append(a.intersection(other).area);gap.append(a.distance(other))
 result={'id':row['id'],'poses':len(row['poses']),'period':row['period'],'projectedTriangles':len(row['trianglesA'])+len(row['trianglesB']),'maximumOverlapArea':max(overlap),'penetratingPoses':sum(area>1e-10 for area in overlap),'minimumGap':min(gap),'maximumGap':max(gap)}
 print(result,flush=True);results.append(result)
report={'sources':source['sources'],'method':'Union actual rendered gear-body/tooth triangles projected onto their common XY working plane, then check intersection area and separation at513 interleaved poses over the full motion cycle, including cycle closure. XY clearance is sufficient for these parallel planar solids; projection conservatively includes bevels. Shafts, hubs and supports are excluded. This does not prove continuous-time contact or transmitted load.','results':results}
json.dump(report,open('docs/validation/191-196-201-contact.json','w'),indent=2)
if any(row['penetratingPoses'] for row in results):raise SystemExit(1)
