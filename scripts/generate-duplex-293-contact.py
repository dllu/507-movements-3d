"""Offline finite duplex reconstruction; requires numpy, scipy and shapely.

The balance is prescribed. Clockwise wheel tendency is continued against the
finite notched roller, including forced silent-beat recoil. The crown pallet is
a finite offset/cutter envelope, not a point-locus tube. This does not solve
spring energy, friction, impact, or passive watch operation.
"""
import json
import math
from pathlib import Path
import sys
import numpy as np
from scipy.optimize import brentq
from shapely.affinity import rotate, translate
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import nearest_points, unary_union

COUNT=2048
D=math.hypot(4*.00965,539*.00965)
RR=.44
R=D-RR+.06
ROOT=4.10
PITCH=2*math.pi/15
AMP=math.radians(52)
RUNNING=.0002
PIN=.105
ORBIT=3.55
roller_points=[(RR*math.cos(a),RR*math.sin(a)) for a in np.linspace(-math.pi/2+math.radians(19),3*math.pi/2-math.radians(19),192)]+[(0,-.18)]
roller=Polygon(roller_points)
tooth_points=[(ROOT-.09,-.16),(R,0),(ROOT-.09,.16)]
tooth=Polygon(tooth_points)
def balance(t):return -AMP*math.cos(2*math.pi*t)
def parts(a,b):
    return translate(rotate(roller,b,origin=(0,0),use_radians=True),0,D),[rotate(tooth,a+j*PITCH,origin=(0,0),use_radians=True) for j in [-1,0,1,2]]
def gap(a,b):
    rol,ts=parts(a,b)
    return min(rol.distance(t) if not rol.intersects(t) else -math.sqrt(rol.intersection(t).area) for t in ts)
initial=brentq(lambda a:gap(a,-AMP)-RUNNING,math.pi/2,math.pi/2+.1,xtol=1e-13)
knots=[[0,initial]]
def advance(t0,a0,t1,depth=0):
    b=balance(t1);goal=a0-6*(t1-t0)
    if gap(goal,b)<RUNNING:
        right=goal+.0005
        while gap(right,b)<RUNNING and right<goal+.04:right+=.0005
        if right>=goal+.04:raise RuntimeError('Disconnected contact branch')
        a=brentq(lambda x:gap(x,b)-RUNNING,goal,right,xtol=1e-12)
    else:a=goal
    if any(gap(a0*(1-u)+a*u,balance(t0*(1-u)+t1*u)) < -1e-9 for u in [.23,.51,.79]):
        if depth>=20:raise RuntimeError(f'Interpolation failed at {t0}')
        middle=(t0+t1)/2
        advance(t0,a0,middle,depth+1)
        advance(middle,knots[-1][1],t1,depth+1)
    else:knots.append([t1,a])
for i in range(COUNT):advance(i/COUNT,knots[-1][1],(i+1)/COUNT)
if abs(initial-knots[-1][1]-PITCH)>1e-8:raise RuntimeError('Incorrect index closure')
k=np.array(knots)
def pin(a,b,j=0):
    p=np.array([ORBIT*math.cos(a+j*PITCH),ORBIT*math.sin(a+j*PITCH)-D]);c=math.cos(b);s=math.sin(b)
    return np.array([c*p[0]+s*p[1],-s*p[0]+c*p[1]])
ps=np.array([pin(a,balance(t)) for t,a in k]);v=np.gradient(ps,k[:,0],axis=0)
n=np.array([-v[:,1],v[:,0]]).T;n/=np.maximum(np.linalg.norm(n,axis=1)[:,None],1e-15)
ix=np.where((k[:,0]>=.296)&(k[:,0]<=.333))[0]
blank=Polygon(np.vstack([ps[ix]+(PIN+.0005)*n[ix],(ps[ix]+(PIN+.18)*n[ix])[::-1]]))
# Forward useful face and separately relieved silent return. The head connects
# to a raised arm above the crown pins; no required working face is moved away.
cutters=[]
for j in [-1,0,1,2]:
    for lo,hi,allowance in [(0,.5,.0005),(.5,1,.003)]:
        path=[pin(a,balance(t),j) for t,a in k if lo<=t<=hi]
        cutters.append(LineString(path).buffer(PIN+allowance,resolution=24))
head=blank.difference(unary_union(cutters))
if head.geom_type=='MultiPolygon':head=min(head.geoms,key=lambda p:p.distance(Point(ps[np.argmin(abs(k[:,0]-.31))])))
head=head.simplify(.000002,preserve_topology=True)
if not head.is_valid or head.area<.02:raise RuntimeError('No useful finite pallet remains')
# Contact fields are computed offline from the actual finite profiles.
samples=[];wheel_moments=[];balance_moments=[]
for t,a in k:
    b=balance(t);mode=0;contact=[0,0,0,0];best=(1e10,None,None)
    for j in range(15):
        p=pin(a,b,j);near=nearest_points(head,Point(p))[0];q=np.array(near.coords[0]);dist=np.linalg.norm(p-q);normal=(p-q)/dist;g=dist-PIN
        if g<best[0]:best=(g,j,q)
        if .298<t<.328 and g<.001 and j==0:
            nw=np.array([math.cos(b)*normal[0]-math.sin(b)*normal[1],math.sin(b)*normal[0]+math.cos(b)*normal[1]])
            pw=np.array([ORBIT*math.cos(a),ORBIT*math.sin(a)]);wm=float(np.cross(pw,nw));bm=float(np.cross(q,-normal))
            if wm>.1 and bm>.1:
                mode=2;contact=[float(q[0]),float(q[1]),wm,bm];wheel_moments.append(wm);balance_moments.append(bm)
    if mode==0:
        rol,ts=parts(a,b);target=min(ts,key=lambda p:p.distance(rol));pw,pr=nearest_points(target,rol);pw=np.array(pw.coords[0]);pr=np.array(pr.coords[0]);dist=np.linalg.norm(pw-pr)
        if dist<.001:
            nw=(pw-pr)/max(dist,1e-15);radial=np.linalg.norm(pr-np.array([0,D]));mode=1 if abs(radial-RR)<.0003 else 3
            contact=[float(pr[0]),float(pr[1]),float(np.cross(pw,nw)),0]
    samples.append([round(float(t),15),round(float(a),15),mode,*[round(x,12) for x in contact]])
if len(wheel_moments)<10:raise RuntimeError('No sustained useful crown impulse')
out=dict(period=4,displayOffset=.30,pitch=PITCH,distance=D,rollerRadius=RR,toothRadius=R,pinPhase=0,pinRadius=PIN,pinOrbit=ORBIT,runningClearance=RUNNING,roller=roller_points,tooth=tooth_points,pallet=list(head.exterior.coords)[:-1],neck=list(head.buffer(-.015).exterior.coords)[:-1],armEnd=list(head.representative_point().coords[0]),samples=samples,evidence=dict(samples=len(samples),palletArea=head.area,impulseSamples=len(wheel_moments),minimumWheelMoment=min(wheel_moments),minimumBalanceMoment=min(balance_moments)))
text='// Generated offline by scripts/generate-duplex-293-contact.py; no live contact solve.\nexport const duplex293Bake = '+json.dumps(out,separators=(',',':'))+';\n'
target=Path(__file__).resolve().parents[1]/'src/simulation/baked/duplex-293-contact.js'
if '--check' in sys.argv:
    if target.read_text()!=text:raise RuntimeError('Duplex bake differs')
else:target.write_text(text)
print(json.dumps(out['evidence']))
