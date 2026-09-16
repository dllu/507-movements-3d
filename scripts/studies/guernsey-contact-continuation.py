"""Rejected, bounded 402 contact-continuation study; never writes production.
The branch/bracketing failure is not a proof of mechanical impossibility.
Offline finite front tooth relief for 402; Python3, numpy and Shapely2 required.
Run: python3 scripts/studies/guernsey-contact-continuation.py
Requires NumPy, Shapely2 and SciPy. Expected to fail its local bracketing guard.
Preserves the prescribed timing; reports incomplete near-contact lock transfer.
"""
from pathlib import Path
import subprocess
repo=Path(__file__).resolve().parents[2]
subprocess.run(['node',str(repo/'scripts/export-guernsey-contact.mjs')],check=True,cwd=repo)
import json,math,numpy as np
from shapely.geometry import Polygon,LineString,Point
from shapely.affinity import rotate,translate
from shapely.ops import nearest_points,unary_union
x=json.load(open('/dev/shm/guernsey-input.json'));x['poses']=[q for q in x['poses'] if abs(q['time']*256-round(q['time']*256))<1e-9];g=x['g'];D=np.array([g['escapeWheelCenter']['x'],g['escapeWheelCenter']['y']]);pitch=g['escapeToothPitch']
head=Polygon([[g['escapeWheelRootRadius']-.045,-.07],[g['escapeWheelTipRadius'],0],[g['escapeWheelRootRadius']+.055,.095]])
profiles={}
for key,pts in x['profiles'].items():
 p=np.array(pts);t=p[1]-p[0];n=np.array([-t[1],t[0]])/np.linalg.norm(t)
 q=x['poses'][0 if key=='upper' else 512];a=q['lever'];N=np.array([[math.cos(a),-math.sin(a)],[math.sin(a),math.cos(a)]])@n
 wp=np.array([[math.cos(a),-math.sin(a)],[math.sin(a),math.cos(a)]])@p[0]
 sign=1 if np.cross(wp-D,N)>0 else -1
 # pallet material lies opposite the wheel's useful reaction normal
 curve=LineString(p); shape=curve.buffer(-sign*.075,single_sided=True,join_style=2)
 profiles[key]=shape
 print(key,'sign',sign,'area',shape.area)
scale=g['escapeWheelTipRadius']/.91
rear_foot=[[a*scale,b*scale]for a,b in[[.65,.20],[.91,0],[.905,.12]]]
head=Polygon(rear_foot)
cutters=[]
for q in x['poses']:
 for p in profiles.values():
  w=translate(rotate(p,q['lever'],origin=(0,0),use_radians=True),*-D)
  for j in range(15):
   c=rotate(w,-q['wheel']-j*pitch,origin=(0,0),use_radians=True)
   if c.distance(head)<.001:cutters.append(c)
head=head.difference(unary_union(cutters).buffer(.0005,quad_segs=3))
print('HEAD',head.geom_type,head.area)
# Disjoint front lands share the continuous rear foot; retain each working land.
heads=list(head.geoms) if head.geom_type=='MultiPolygon' else [head]
print("connected head area",head.area)
assert head.is_valid and head.area>.001
reports={key:{'maxGap':0,'wheelMin':1,'impulseMin':1,'closeSamples':0,'impulseSamples':0}for key in profiles};worst=0
for q in x['poses'][::4]:
 for key,p in profiles.items():
  world=rotate(p,q['lever'],origin=(0,0),use_radians=True)
  for j in range(15):
   h=translate(rotate(head,q['wheel']+j*pitch,origin=(0,0),use_radians=True),*D)
   worst=max(worst,h.intersection(world).area)
  con=q['contact']
  if not con or con['side']!=key:continue
  h=translate(rotate(head,q['wheel']+con['toothIndex']*pitch,origin=(0,0),use_radians=True),*D)
  a,b=nearest_points(h,world);gap=a.distance(b);
  if gap>reports[key]['maxGap']:reports[key]['maxGap']=gap;reports[key]['gapWitnessTime']=q['time']
  if gap>1e-8 and gap<.005:
   reports[key]['closeSamples']+=1
   a=np.array(a.coords[0]);b=np.array(b.coords[0]);n=(a-b)/gap;wm=float(np.cross(a-D,n));lm=float(np.cross(b,-n));reports[key]['wheelMin']=min(reports[key]['wheelMin'],wm)
   if con['mode']=='impulse':reports[key]['impulseSamples']+=1;reports[key]['impulseMin']=min(reports[key]['impulseMin'],lm*(-1 if key=='upper'else 1))
print('result',worst,reports)
assert worst<1e-10
for report in reports.values():
 assert report['wheelMin']>0 and report['impulseMin']>0 and report['impulseSamples']>=5
result={'heads':[list(p.exterior.coords)for p in heads],'rearFoot':rear_foot,'profiles':{k:list(p.exterior.coords)for k,p in profiles.items()},'report':{'poses':257,'maxOverlapArea':worst,'branches':reports,'runningAllowance':.0005,'completeLoadedHandoff':False}}
# Contact-constrained continuation of the wheel, then finite-time drops.
from scipy.interpolate import PchipInterpolator
rows=[]
def solve_pose(phase):
 q={'time':4*phase,'lever':g['leverAmplitude']*math.cos(2*math.pi*phase)}
 half=math.floor(2*phase);halfphase=2*phase-half;u=max(0,min(1,(halfphase-g['releaseHalfPhase'])/(g['landingHalfPhase']-g['releaseHalfPhase'])))
 q['wheel']=g['upperPalletReferenceAngle']-(half+u**3*(10-15*u+6*u*u))*g['halfToothAdvance']
 ps=[translate(rotate(p,q['lever'],origin=(0,0),use_radians=True),*-D)for p in profiles.values()]
 indexes=[[round((math.atan2(p.centroid.y,p.centroid.x)-q['wheel'])/pitch)+j for j in[-1,0,1]]for p in ps]
 def contact(theta):
  best=(9,None,None,None,None)
  for side,(p,js)in enumerate(zip(ps,indexes)):
   for j in js:
    h=rotate(head,theta+j*pitch,origin=(0,0),use_radians=True);gap=h.distance(p)
    if gap<best[0]:best=(gap,h,p,side,j)
  return best
 theta=q['wheel'];hit=contact(theta)
 for retreat in range(20):
  if hit[0]>.0003:break
  theta+=.0002;hit=contact(theta)
 else:raise RuntimeError(('No clear local seed',phase,hit[0]))
 for j in range(160):
  trial=theta-.001
  if contact(trial)[0]<.0003:
   low,high=trial,theta
   for k in range(14):
    mid=(low+high)/2
    if contact(mid)[0]<.0003:low=mid
    else:high=mid
   theta=high;hit=contact(theta);break
  theta=trial
 else:raise RuntimeError('No finite forward stop')
 a,b=nearest_points(hit[1],hit[2]);normal=(np.array(a.coords[0])-np.array(b.coords[0]))/a.distance(b)
 wm=float(np.cross(a.coords[0],normal));lm=float(np.cross(np.array(b.coords[0])+D,-normal))
 assert wm>0
 return [q['time']/4,q['lever'],theta,hit[3],hit[4],wm,lm]
rows=[solve_pose(i/512)for i in range(513)]
knots=[rows[0][:3]];offset=0;drops=[]
for i in range(1,len(rows)):
 q,beta,theta=rows[i][:3]
 if rows[i-1][3]!=rows[i][3] and rows[i-1][2]-theta>.008:
  low,high=rows[i-1],rows[i]
  for refinement in range(18):
   middle=solve_pose((low[0]+high[0])/2)
   if middle[3]==low[3]:low=middle
   else:high=middle
  knots.append([low[0]+offset,low[1],low[2]])
  before=low[2];start=high[0]+offset;drop_beta=high[1];knots.append([start,drop_beta,before]);duration=.04
  for j in range(1,33):
   u=j/32;smooth=u**3*(10-15*u+6*u*u);knots.append([start+duration*u,drop_beta,before+(high[2]-before)*smooth])
  drops.append([start,start+duration]);offset+=duration
  knots.append([q+offset,beta,theta])
 else:knots.append([q+offset,beta,theta])
period=1+offset;knots=np.array(knots);knots[:,0]/=period
for d in drops:d[:]=[v/period for v in d]
knots[-1,1]=knots[0,1];knots[-1,2]=knots[0,2]-pitch
lever=PchipInterpolator(knots[:,0],knots[:,1]);wheel=PchipInterpolator(knots[:,0],knots[:,2])
min_gap=9;max_overlap=0;contact_samples=[];overlap_witness=None
for i in range(1025):
 q=i/1024;beta=float(lever(q));theta=float(wheel(q));best=(9,None,None,None,None)
 for side,p in enumerate(profiles.values()):
  p=rotate(p,beta,origin=(0,0),use_radians=True)
  for j in range(15):
   h=translate(rotate(head,theta+j*pitch,origin=(0,0),use_radians=True),*D)
   overlap=p.intersection(h).area
   if overlap>max_overlap:max_overlap=overlap;overlap_witness=[q,side,j,beta,theta]
   if h.distance(p)<best[0]:best=(h.distance(p),h,p,side,j)
 min_gap=min(min_gap,best[0])
 a,b=nearest_points(best[1],best[2]);gap=a.distance(b)
 normal=(np.array(a.coords[0])-np.array(b.coords[0]))/gap
 wm=float(np.cross(np.array(a.coords[0])-D,normal));lm=float(np.cross(b.coords[0],-normal))
 drop=any(a<=q<=b for a,b in drops)
 contact_samples.append([q,best[3],best[4],gap,wm,lm,drop])
print('AUDIT',max_overlap,min_gap,overlap_witness,drops,flush=True)
assert max_overlap<1e-10 and min_gap>.00005,(max_overlap,min_gap)
assert all(s[4]>0 and s[3]<.0007 for s in contact_samples if not s[6])
result['motion']={'knots':knots[:,0].tolist(),'lever':lever.c.T.tolist(),'wheel':wheel.c.T.tolist(),'drops':drops,'contacts':contact_samples}
result['report']['continuation']={'poses':1025,'minGap':min_gap,'maxOverlapArea':max_overlap,'drops':drops,'maxNonDropGap':max(s[3]for s in contact_samples if not s[6]),'minWheelMoment':min(s[4]for s in contact_samples if not s[6]),'recoilPresent':True,'forceDynamicsValidated':False}
print('CONTINUATION',result['report']['continuation'],flush=True)
out=Path('/dev/shm/guernsey-unaccepted-continuation.js')
out.write_text('// Generated by scripts/generate-guernsey-contact.py; do not hand edit.\nexport const guernseyContact = '+json.dumps(result,separators=(',',':'))+';\n')
