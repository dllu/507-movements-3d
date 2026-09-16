"""Keystone1904 Fig129–131 compass construction and finite first-contact bake.
Requires Python3, numpy, scipy and Shapely2.0.3. No native force validation.
"""
from pathlib import Path
from scipy.interpolate import PchipInterpolator
from shapely.ops import nearest_points
import sys
repo=Path(__file__).resolve().parents[1]
import numpy as np,math
r=3.05;b=r*np.array([math.cos(math.radians(102)),math.sin(math.radians(102))]);u=np.array([math.cos(math.radians(-14)),math.sin(math.radians(-14))]);v=np.array([math.cos(math.radians(92)),math.sin(math.radians(92))]);a,rad=np.linalg.solve(np.column_stack([-u,v]),b);n=rad*v;e=(b+n)/2;rot=math.pi/2-math.atan2(e[1],e[0]);M=np.array([[math.cos(rot),-math.sin(rot)],[math.sin(rot),math.cos(rot)]]);b=M@b;n=M@n;e=M@e;ri=np.linalg.norm(n-b)/2;ro=ri*1.25

from shapely.geometry import Polygon,Point
from shapely.affinity import rotate,translate
from shapely.ops import unary_union
import json
# Keystone Fig129: curved impulse face has radius equal to tooth-point orbit.
v=(n-b)/np.linalg.norm(n-b);normal=np.array([-v[1],v[0]]);pc=e-normal*math.sqrt(rad*rad-ri*ri)
a0=math.atan2(*(b-pc)[::-1]);a1=math.atan2(*(n-pc)[::-1]);arc=[pc+rad*np.array([math.cos(a),math.sin(a)])for a in np.linspace(a0,a1,49)]
heelangle=math.atan2(b[1],b[0]);tipangle=math.atan2(n[1],n[0]);root=[rad*np.array([math.cos(a),math.sin(a)])for a in np.linspace(tipangle,heelangle,33)]
arc[0]=b;arc[-1]=n
head=Polygon([*arc,*root[1:]]);D=e[1];pitch=2*math.pi/15
assert abs(np.linalg.norm(n)-rad)<1e-12
nominal_inner=ri;ri+=.002 # running allowance for the diametrically opposed heel
middle=(ri+ro)/2;width=(ro-ri)/2
start=math.radians(-10)+math.asin(width/middle);end=math.radians(186)-math.asin(width/middle)
lip_centers=[[middle*math.cos(a),middle*math.sin(a)]for a in[start,end]]
shell=unary_union([Polygon([(ro*math.cos(a),ro*math.sin(a))for a in np.linspace(start,end,385)]+[(ri*math.cos(a),ri*math.sin(a))for a in np.linspace(end,start,385)]),*[Point(middle*math.cos(a),middle*math.sin(a)).buffer(width,quad_segs=32)for a in[start,end]]])
assert head.is_valid and shell.is_valid and head.geom_type=='Polygon' and shell.geom_type=='Polygon'
rows=[];theta=math.radians(16);worst=0
for i in range(513):
 q=i/512;beta=math.radians(60)*math.cos(2*math.pi*q);actual=translate(rotate(shell,beta,origin=(0,0),use_radians=True),0,D);expanded=actual.buffer(.001,quad_segs=4)
 def collides(t):return any(rotate(head,t+j*pitch,origin=(0,0),use_radians=True).intersection(expanded).area>1e-11 for j in range(-2,4))
 for k in range(800):
  trial=theta-.001
  if collides(trial):
   lo,hi=trial,theta
   for _ in range(19):
    mid=(lo+hi)/2
    if collides(mid):lo=mid
    else:hi=mid
   theta=hi;break
  theta=trial
 else:raise RuntimeError('escaped')
 overlap=max(rotate(head,theta+j*pitch,origin=(0,0),use_radians=True).intersection(actual).area for j in range(15));worst=max(worst,overlap);rows.append([q,beta,theta])
 if i%64==0:print(q,math.degrees(theta),overlap,flush=True)

# Replace quasi-static free-flight jumps by finite C1 prescribed drops. The
# balance pauses just beyond release; no impulsive wheel teleport is retained.
knots=[rows[0]];offset=0.;drop_intervals=[]
for i in range(1,len(rows)):
    q,beta,theta=rows[i]
    theta=max(theta,rows[0][2]-pitch) # exact monotone closing rest, removing polygon tolerance drift
    if rows[i-1][2]-theta>.008:
        before=rows[i-1][2];start=q+offset;knots.append([start,beta,before]);duration=.045
        for j in range(1,33):
            u=j/32;smooth=u**3*(10-15*u+6*u*u)
            knots.append([start+duration*u,beta,before+(theta-before)*smooth])
        drop_intervals.append([start,start+duration]);offset+=duration
    else:knots.append([q+offset,beta,theta])
period=1+offset;knots=np.array(knots);knots[:,0]/=period
for interval in drop_intervals:interval[:]=[v/period for v in interval]
# Equal end states ensure a closed physical cycle, allowing the next tooth.
knots[-1,1]=knots[0,1];knots[-1,2]=knots[0,2]-pitch
balance=PchipInterpolator(knots[:,0],knots[:,1]);wheel=PchipInterpolator(knots[:,0],knots[:,2])
min_gap=1.;max_overlap=0.;moments={name:[]for name in['outer','entry','inner','exit']};witness=None
for i in range(1025):
    q=i/1024;beta=float(balance(q));theta=float(wheel(q));bs=float(balance(q,1));ws=float(wheel(q,1));actual=translate(rotate(shell,beta,origin=(0,0),use_radians=True),0,D)
    best=(1.,None,None)
    for j in range(15):
        tooth=rotate(head,theta+j*pitch,origin=(0,0),use_radians=True);overlap=tooth.intersection(actual).area
        if overlap>max_overlap:max_overlap=overlap;witness={'phase':q,'tooth':j,'area':overlap}
        if tooth.distance(actual)<best[0]:
            a,z=nearest_points(tooth,actual);best=(a.distance(z),np.array(a.coords[0]),np.array(z.coords[0]))
    gap,a,z=best;min_gap=min(min_gap,gap)
    if gap>1e-8 and gap<.003 and abs(bs)>.01 and not any(a<=q<=z for a,z in drop_intervals):
        normal=(a-z)/gap;wm=float(np.cross(a,normal));cm=float(np.cross(z-np.array([0,D]),-normal))
        surface_radius=np.linalg.norm(z-np.array([0,D]))
        mode='outer'if abs(surface_radius-ro)<1e-5 else'inner'if abs(surface_radius-ri)<1e-5 else'entry'if bs<0 else'exit'
        moments[mode].append([wm,cm])
report={'poses':1025,'maxOverlapArea':max_overlap,'overlapWitness':witness,'minimumGap':min_gap,'dropIntervals':drop_intervals,'reactionMoments':{key:{'samples':len(v),'wheelMin':min(x[0]for x in v),'cylinderMin':min(x[1]for x in v),'cylinderMax':max(x[1]for x in v)}for key,v in moments.items()if v}}
print(json.dumps(report,indent=2));assert max_overlap<1e-12 and min_gap>.0005,report
for name,values in moments.items():
    assert len(values)>20 and min(v[0]for v in values)>.05,(name,report)
assert max(v[1]for v in moments['entry'])<-.005,report
assert min(v[1]for v in moments['exit'])>.005,report
assert max(abs(v[1])for name in['outer','inner']for v in moments[name])<.015,report
Path('/dev/shm/cylinder44-audit.json').write_text(json.dumps(report,indent=2))
output={'source':'Keystone1904 Figs129–131; 10-degree curved face with inferred 2-degree nominal drop allowance','head':list(head.exterior.coords)[:-1],'shell':list(shell.exterior.coords)[:-1],'centerDistance':D,'innerRadius':ri,'outerRadius':ro,'heelRadius':r,'pointRadius':rad,'headCentroid':list(head.centroid.coords)[0],'curveCenter':pc.tolist(),'lipRadius':width,'lipCenters':lip_centers,'innerRunningAllowance':ri-nominal_inner,'point':n.tolist(),'heel':b.tolist(),'dropIntervals':drop_intervals,'knots':knots[:,0].tolist(),'balanceCoefficients':balance.c.T.tolist(),'wheelCoefficients':wheel.c.T.tolist(),'qualification':report}
text='// Offline generated by scripts/generate-cylinder-contact.py.\nexport default '+json.dumps(output,separators=(',',':'))+';\n'
file=repo/'src/simulation/baked/cylinder-contact.js'
if '--check'in sys.argv:assert file.read_text()==text
else:file.write_text(text)
print('bytes',len(text))
