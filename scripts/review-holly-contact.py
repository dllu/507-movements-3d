"""Independent interleaved-pose audit of rendered Holly rotor triangle projections."""
import hashlib
import json
import math
from shapely.affinity import affine_transform
from shapely.geometry import Polygon
from shapely.ops import unary_union
source=json.load(open('/dev/shm/holly-contact.json'))
left,right=[unary_union([Polygon(t) for t in triangles]) for triangles in source['rendered']]
results=[]
for i in range(1025):
    angle=math.tau*(i+0.413)/1025
    cosine,sine=math.cos(2*angle),math.sin(2*angle)
    transformed=affine_transform(left,[cosine,-sine,sine,cosine,
        -source['centerDistance']*math.cos(angle),-source['centerDistance']*math.sin(angle)])
    results.append((transformed.intersection(right).area,transformed.distance(right)))
report={'poses':len(results),'maximumOverlapArea':max(r[0] for r in results),
    'penetratingPoses':sum(r[0]>1e-10 for r in results),'maximumGap':max(r[1] for r in results),
    'minimumGap':min(r[1] for r in results),
    'method':'Intersection and distance of actual rendered rotor triangle projections at 1025 interleaved poses. Parallel solid extrusions share the same axial span. Shafts, packing, pressure, sealing and torque are outside this profile audit.',
    'sources':[]}
for file in ['src/simulation/authored-double-elliptical-rotary-engines.js','src/simulation/movement-429-source-profiles.js','src/simulation/generated-holly-mate.js','scripts/export-holly-contact.mjs','scripts/generate-holly-mate.py','scripts/review-holly-contact.py']:
    report['sources'].append({'file':file,'sha256':hashlib.sha256(open(file,'rb').read()).hexdigest()})
print({k:v for k,v in report.items() if k not in ['sources','method']})
json.dump(report,open('docs/validation/429-mating-contact.json','w'),indent=2)
