import json
from shapely.geometry import Polygon
from shapely.ops import unary_union
from shapely.affinity import affine_transform
source=json.load(open('/dev/shm/variable-idler-contact.json'));results=[]
for row in source['rows']:
 polygons=[unary_union([Polygon(t) for t in p['triangles']]) for p in row['parts']]
 overlaps=[];gaps=[];activeGaps=[];worst=None
 for pose in row['poses']:
  poseGap=[]
  for pair,(a,b) in enumerate(row['pairs']):
   other=affine_transform(polygons[b],pose['transforms'][pair]);area=polygons[a].intersection(other).area;gap=polygons[a].distance(other);overlaps.append(area);poseGap.append(gap)
   if worst is None or area>worst['area']:worst={'phase':pose['phase'],'pair':pair,'area':area}
  gaps.append(min(poseGap));activeGaps.append(poseGap[pose['active']] if pose['active'] is not None else max(poseGap))
 result={'id':row['id'],'poses':len(row['poses']),'penetratingPairPoses':sum(a>1e-10 for a in overlaps),'maximumOverlapArea':max(overlaps),'maximumClosestGap':max(gaps),'maximumActiveGap':max(activeGaps),'worst':worst};print(result,flush=True);results.append(result)
json.dump({'sources':source['sources'],'method':'Intersection of actual rendered gear triangle projections over full cycles and 223 transition-neighborhood poses; parallel planar gear solids. Includes sector webs and hubs; excludes other hubs, guides, links and journals, which have scoped finite-solid tests. Max active gap compares each continuously meshing 221/222 pair and the active 223 pair.','results':results},open('docs/validation/221-222-223-contact.json','w'),indent=2)
