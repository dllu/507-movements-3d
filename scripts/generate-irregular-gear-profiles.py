import json,time,os
from shapely.geometry import Polygon
from shapely.ops import unary_union
from shapely.affinity import affine_transform
rows=json.load(open('/dev/shm/irregular-profile-input.json'))
output={}
for row in rows:
 start=time.time()
 def compound(parts):return unary_union([Polygon(p['outline']).buffer(p['buffer'],join_style=2) for p in parts]).buffer(0)
 blank=compound(row['blank']); cutter=compound(row['cutters'])
 original=blank
 if row['id']==191:
  actual=next(r for r in json.load(open('/dev/shm/irregular-contact-input.json'))['results'] if r['id']==191)
  cutter=unary_union([Polygon(triangle) for triangle in actual['trianglesB']])
 if row['id']!=201:
  cutter=cutter.buffer(.0012 if row['id']==191 else .0008,resolution=2)
  # Periodic cutter envelope; heavy geometry stays offline.
  for pose in row['poses']:
   blank=blank.difference(affine_transform(cutter,pose))
  pieces=list(blank.geoms) if blank.geom_type=='MultiPolygon' else [blank]
  blank=max(pieces,key=lambda p:p.area).simplify(.00015 if row['id']==191 else .00004,preserve_topology=True)
 if row['id']==191:blank=blank.buffer(-.0002,join_style=2).simplify(.00001,preserve_topology=True)
 areas=[];gaps=[]
 for pose in row['auditPoses']:
  other=affine_transform(compound(row['cutters']),pose)
  areas.append(blank.intersection(other).area);gaps.append(blank.distance(other))
 print(row['id'], 'seconds',time.time()-start,'area retained',blank.area/original.area,'max overlap',max(areas),'maxgap',max(gaps),'pts',len(blank.exterior.coords),'holes',len(blank.interiors),flush=True)
 output[str(row['id'])]={'outline':list(blank.exterior.coords),'holes':[list(hole.coords) for hole in blank.interiors],'retainedArea':blank.area/original.area,'maxOverlap':max(areas),'maximumGap':max(gaps),'minimumGap':min(gaps)}
json.dump(output,open('/dev/shm/irregular-profile-output.json','w'))

# Compact baked data; the browser only extrudes these contours.
for value in output.values():
 value['outline']=[[round(x,7),round(y,7)] for x,y in value['outline']]
 value['holes']=[[[round(x,7),round(y,7)] for x,y in hole] for hole in value['holes']]
with open(os.environ.get('BAKED_OUTPUT','src/simulation/generated-irregular-gear-profiles.js'),'w') as f:
 f.write('// Generated offline by scripts/generate-irregular-gear-profiles.py.\nexport default '+json.dumps({k:v for k,v in output.items() if k!='201'},separators=(',',':'))+';\n')
