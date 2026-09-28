import json,time,os
from shapely.geometry import Polygon,Point
from shapely.ops import unary_union
from shapely.affinity import affine_transform
import math
from shapely.geometry import Polygon as _P
rows=json.load(open('/dev/shm/irregular-profile-input.json'))
EASE=.002
# 191's reset step (p96): corner fillet of each squared step tooth, and how
# far below that fillet the wall-face relief stops.
FILLET=.05
WALL_TOP=.05
# The opening leaves residual micro-scallops of about 1e-5 in concave roots
# (the cutter's own corner arcs). A 1e-4 Douglas-Peucker pass keeps outline
# vertices only where the true curve bends; it moves the outline at most
# 1e-4, well inside the 0.0008 cutter clearance.
SMOOTH_TOLERANCE=.0001
def ease(shape):
 # Each cutter pose leaves a tiny cusp between neighbouring cuts, which
 # renders as a jagged, stair-stepped flank. A morphological opening by a
 # small disc removes only those cusps (it can only remove material), leaving
 # smooth flanks and roots and slightly eased corners.
 opened=shape.buffer(-EASE,resolution=32).buffer(EASE,resolution=32)
 pieces=list(opened.geoms) if opened.geom_type=='MultiPolygon' else [opened]
 return max(pieces,key=lambda p:p.area)
output={}

def hob_scroll(rack,name,cutter_offset,backlash):
 # Roll a straight-sided 14.5-degree rack along one sampled pitch spiral
 # (the low angle keeps the teeth near Brown's square form).
 # Arc 0 is the low side of the seam and arc P the high side; rack teeth
 # sit at cutter_offset+k*pitch, and each pose is clipped to a wedge that
 # never crosses the seam ray, so the reset step stays a plain radial wall.
 import numpy as np
 phi=np.array(rack['phis']);pts=np.array(rack[name]);pitch=rack['pitch'];add=rack['addendum'];ded=rack['dedendum']
 seg=np.hypot(*np.diff(pts,axis=0).T);arc=np.concatenate([[0],np.cumsum(seg)]);arc-=np.interp(0,phi,arc)
 perimeter=np.interp(2*math.pi,phi,arc)
 tang=np.gradient(pts,axis=0);tang/=np.hypot(*tang.T)[:,None]
 norm=np.stack([tang[:,1],-tang[:,0]],1);norm*=np.sign((norm*pts).sum(1))[:,None]
 on=(phi>=0)&(phi<=2*math.pi)
 blankPts=[tuple(p+add*n) for p,n in zip(pts[on],norm[on])]
 blank=_P(blankPts).buffer(0)
 # Gear tooth thickness pitch/2-backlash, so each rack tooth is pitch/2+backlash.
 w0=(pitch/2+backlash)/2;tn=math.tan(math.radians(14.5));top=add+.25
 def angle_of(p):return math.atan2(p[1],p[0])
 def wedge(lo,hi):
  lo=max(0,lo);hi=min(2*math.pi,hi);ps=np.linspace(lo,hi,160)
  dirs=[np.interp(x,phi,pts[:,0]) for x in ps],[np.interp(x,phi,pts[:,1]) for x in ps]
  ring=[(0,0)]+[(8*x/math.hypot(x,y),8*y/math.hypot(x,y)) for x,y in zip(*dirs)]
  return _P(ring).buffer(0)
 cuts=[]
 for s in np.arange(-pitch*1.2,perimeter+pitch*1.2,pitch/48):
  i=min(len(arc)-2,max(0,np.searchsorted(arc,s)-1));f=(s-arc[i])/(arc[i+1]-arc[i])
  q=pts[i]+(pts[i+1]-pts[i])*f;t=tang[i];n=norm[i];ph=phi[i]+(phi[i+1]-phi[i])*f
  polys=[]
  k0=math.floor((s-2*pitch-cutter_offset)/pitch);k1=math.ceil((s+2*pitch-cutter_offset)/pitch)
  for k in range(k0,k1+1):
   u=cutter_offset+k*pitch-s
   quad=[(u-(w0-ded*tn),-ded),(u+(w0-ded*tn),-ded),(u+(w0+top*tn),top),(u-(w0+top*tn),top)]
   polys.append(_P([tuple(q+a*t+b*n) for a,b in quad]))
  cutter=unary_union(polys)
  cuts.append(cutter.intersection(wedge(ph-1.1,ph+1.1)))
 gear=blank.difference(unary_union(cuts))
 pieces=list(gear.geoms) if gear.geom_type=='MultiPolygon' else [gear]
 return max(pieces,key=lambda p:p.area).simplify(.00004,preserve_topology=True)

for row in rows:
 start=time.time()
 if row.get('rack'):
  backlash=row['rack']['pitch']*.035
  pitch=row['rack']['pitch']
  driven=hob_scroll(row['rack'],'driven',-pitch/4,backlash)
  driver=hob_scroll(row['rack'],'driver',pitch/4,backlash)
  # Brown's step (p96): the radial wall is the flank of a full-width,
  # flat-topped tooth.  The clipped hob poses just past the seam (on the
  # extrapolated spiral, where no mate exists) chamfer that tooth's top
  # corner and leave a narrow pointed tip, so restore the square corner:
  # an annular sector on the high side of the seam ray, from the pitch
  # circle out to the tip circle, 0.3 pitch wide at the tip, unioned in
  # before the reset relief is swept from the mate.
  def square_step_tooth(gear,name):
   import numpy as np
   rack=row['rack'];phi=np.array(rack['phis']);pts=np.array(rack[name]);add=rack['addendum']
   at=lambda x:np.array([np.interp(x,phi,pts[:,0]),np.interp(x,phi,pts[:,1])])
   p0,p1=at(0),at(2*math.pi);high=0 if np.hypot(*p0)>np.hypot(*p1) else 2*math.pi
   ph=at(high);r=np.hypot(*ph);ray=math.atan2(ph[1],ph[0])
   step=.01 if high==0 else -.01;q=at(high+step);sense=np.sign(((math.atan2(q[1],q[0])-ray+math.pi)%(2*math.pi))-math.pi)
   # The sector ends mid-way along the tooth's existing flat top and its
   # outer edge continues that top's own line (fitted in radius against
   # angle), so the two merge without a step or a sliver.  Its inner edge
   # runs down to the low rim, so the whole wall is one straight radial line.
   # (The wall stands 0.003 inside the seam ray, clear of the mate's wall
   # where the two coincide at the reset.)
   span=sense*.3*pitch/(r+add);angles=np.linspace(ray+sense*.003/r,ray+span,24)
   rel=lambda x,y:sense*(((math.atan2(y,x)-ray+math.pi)%(2*math.pi))-math.pi)
   window=[(rel(x,y),math.hypot(x,y)) for x,y in gear.exterior.coords if 0<rel(x,y)<abs(span)*1.6]
   tip=max(q for _,q in window);top=[(a,q) for a,q in window if q>tip-.004 and a>abs(span)*.6]
   slope,level=np.polyfit([a for a,_ in top],[q for _,q in top],1) if len(top)>2 else (0,tip)
   outer=lambda a:level+slope*sense*(a-ray);tip=outer(ray);low=min(math.hypot(x,y) for x,y in gear.exterior.coords if abs(rel(x,y))<.02)+.002
   sector=[(low*math.cos(a),low*math.sin(a)) for a in angles[:2]]+[(outer(a)*math.cos(a),outer(a)*math.sin(a)) for a in angles[::-1]]
   # The corner itself is a small fillet (radius FILLET, tangent to the wall
   # and the top).
   u=np.array([math.cos(angles[0]),math.sin(angles[0])]);tv=sense*np.array([-u[1],u[0]]);corner=tip*u
   centre=corner-FILLET*u+FILLET*tv
   box=Polygon([tuple(corner+.001*u-.001*tv),tuple(corner-FILLET*u-.001*tv),tuple(centre),tuple(corner+FILLET*tv+.001*u)])
   sector=Polygon(sector).buffer(0).difference(box.difference(Point(*centre).buffer(FILLET,resolution=32)))
   merged=gear.union(sector)
   # The relievable strip: the wall face itself, 0.04 deep on the high
   # side, from the low rim up to WALL_TOP below the fillet.
   depth=sense*.04/r;wa=np.linspace(ray,ray+depth,8)
   strip=Polygon([(.5*math.cos(a),.5*math.sin(a)) for a in wa]+[((tip-FILLET-WALL_TOP)*math.cos(a),(tip-FILLET-WALL_TOP)*math.sin(a)) for a in wa[::-1]]).buffer(0)
   # And everything between the seam ray and that inset wall goes, so the
   # face is one straight line from the rim to the fillet.
   # (It starts at the top of the low side's rim beside the wall, so no
   # slot opens at the wall's foot.)
   foot=max([math.hypot(x,y) for x,y in gear.exterior.coords if -.008/r<rel(x,y)<-.001/r and math.hypot(x,y)<r-add]+[low])
   ta=np.linspace(ray,angles[0],4)
   trim=Polygon([(foot*math.cos(a),foot*math.sin(a)) for a in ta]+[((tip+.01)*math.cos(a),(tip+.01)*math.sin(a)) for a in ta[::-1]]).buffer(0)
   return max(getattr(merged,'geoms',[merged]),key=lambda g:g.area),strip,trim
  driven,drivenWall,drivenTrim=square_step_tooth(driven,'driven');driver,driverWall,driverTrim=square_step_tooth(driver,'driver')
  # The reset needs Brown's stepped relief: around the seam the high end of
  # each scroll swings past the other's step.  Cut the swept mate (plus a
  # small clearance) from each gear's low-side shelf only, the region just
  # after its step that Brown draws as a plain notch floor.
  import numpy as np
  def seam_shelf(name,pitches):
   rack=row['rack'];phi=np.array(rack['phis']);pts=np.array(rack[name])
   arc=np.concatenate([[0],np.cumsum(np.hypot(*np.diff(pts,axis=0).T))]);arc-=np.interp(0,phi,arc)
   hi=2*math.pi if name=='driven' else np.interp(pitches*pitch,arc,phi)
   lo=np.interp(np.interp(2*math.pi,phi,arc)-pitches*pitch,arc,phi) if name=='driven' else 0
   ps=np.linspace(lo,hi,200)
   ring=[(0,0)]+[(8*x/math.hypot(x,y),8*y/math.hypot(x,y)) for x,y in zip(np.interp(ps,phi,pts[:,0]),np.interp(ps,phi,pts[:,1]))]
   return Polygon(ring).buffer(0)
  def invert(pose):
   a,b,c,d,e,f=pose;det=a*d-b*c;ia,ib,ic,id_=d/det,-b/det,-c/det,a/det
   return [ia,ib,ic,id_,-(ia*e+ib*f),-(ic*e+id_*f)]
  poses=row['poses'];n=len(poses);near=[q for i,q in enumerate(poses) if min(i,n-1-i)<n*.08]
  clearance=.0025
  sweep=unary_union([affine_transform(driver,q) for q in near]).buffer(clearance,resolution=4)
  driven=driven.difference(sweep.intersection(seam_shelf('driven',1.6)))
  driven=max(getattr(driven,'geoms',[driven]),key=lambda g:g.area)
  sweep=unary_union([affine_transform(driven,invert(q)) for q in near]).buffer(clearance,resolution=4)
  driver=driver.difference(sweep.intersection(seam_shelf('driver',1.6)))
  driver=max(getattr(driver,'geoms',[driver]),key=lambda g:g.area)
  # Last, each step's squared corner brushes the other's wall as the steps
  # pass in the reset: ease each wall face (not the corner) by the other's
  # sweep, a shallow concave relief of about 0.02 near the wall's base.
  drivenBefore=driven
  sweep=unary_union([affine_transform(driver,q) for q in near]).buffer(clearance,resolution=4)
  driven=driven.difference(sweep.intersection(drivenWall))
  driven=max(getattr(driven,'geoms',[driven]),key=lambda g:g.area)
  sweep=unary_union([affine_transform(drivenBefore,invert(q)) for q in near]).buffer(clearance,resolution=4)
  driver=driver.difference(sweep.intersection(driverWall))
  driver=max(getattr(driver,'geoms',[driver]),key=lambda g:g.area)
  driven=max(getattr(g:=driven.difference(drivenTrim),'geoms',[g]),key=lambda g:g.area)
  driver=max(getattr(g:=driver.difference(driverTrim),'geoms',[g]),key=lambda g:g.area)
  driven=ease(driven).simplify(SMOOTH_TOLERANCE,preserve_topology=True)
  driver=ease(driver).simplify(SMOOTH_TOLERANCE,preserve_topology=True)
  areas=[];gaps=[]
  for pose in row['auditPoses']:
   other=affine_transform(driver,pose);areas.append(driven.intersection(other).area);gaps.append(driven.distance(other))
  print(row['id'],'seconds',time.time()-start,'max overlap',max(areas),'maxgap',max(gaps),'pts',len(driven.exterior.coords),len(driver.exterior.coords),flush=True)
  output['191']={'outline':list(driven.exterior.coords),'holes':[],'maxOverlap':max(areas),'maximumGap':max(gaps),'minimumGap':min(gaps),'toothProfile':'rack-hobbed-conjugate-scroll'}
  output['191driver']={'outline':list(driver.exterior.coords),'holes':[],'toothProfile':'rack-hobbed-conjugate-scroll'}
  continue
 def compound(parts):return unary_union([Polygon(p['outline']).buffer(p['buffer'],join_style=2) for p in parts]).buffer(0)
 blank=compound(row['blank']); cutter=compound(row['cutters'])
 original=blank
 if row['id']==191:
  actual=next(r for r in json.load(open('/dev/shm/irregular-contact-input.json'))['results'] if r['id']==191)
  cutter=unary_union([Polygon(triangle) for triangle in actual['trianglesB']])
 cutter=cutter.buffer(.0012 if row['id']==191 else .0008,resolution=2)
 # Periodic cutter envelope; heavy geometry stays offline. 201's 8193
 # rolling-pinion poses are unioned in batches before cutting.
 if row['id']==201:
  poses=row['poses']
  for i in range(0,len(poses),64):
   blank=blank.difference(unary_union([affine_transform(cutter,pose) for pose in poses[i:i+64]]))
 else:
  for pose in row['poses']:
   blank=blank.difference(affine_transform(cutter,pose))
 pieces=list(blank.geoms) if blank.geom_type=='MultiPolygon' else [blank]
 blank=max(pieces,key=lambda p:p.area)
 if row['id']!=191:blank=ease(blank)
 blank=blank.simplify(.00002 if row['id']==201 else SMOOTH_TOLERANCE,preserve_topology=True)
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
# A subset run (IRREGULAR_IDS) keeps the other ids' baked profiles.
target=os.environ.get('BAKED_OUTPUT','src/simulation/generated-irregular-gear-profiles.js')
prefix='// Generated offline by scripts/generate-irregular-gear-profiles.py.\nexport default '
merged={}
if os.path.exists(target):
 text=open(target).read()
 if text.startswith(prefix):merged=json.loads(text[len(prefix):].rstrip().rstrip(';'))
merged.update(output)
with open(target,'w') as f:
 f.write(prefix+json.dumps(merged,separators=(',',':'))+';\n')
