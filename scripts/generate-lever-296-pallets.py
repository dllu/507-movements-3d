"""Generate finite 296 lock/impulse lands with continuous swept triangle cutters.
Requires NumPy and Shapely; exports profiles only, no browser cutter/physics.
The hooked tooth supports the lock normals that a radial triangle cannot.
"""
import math,json,numpy as np
from shapely.geometry import Polygon,Point,MultiPoint
from shapely.affinity import rotate,translate
from shapely.ops import unary_union,nearest_points
S=3.5/235;W=np.array([3*S,0.]);P=np.array([0.,3.5]);B=np.array([-221*S,3.5-25*S]);D=np.linalg.norm(B-P);base=math.atan2(*(B-P)[::-1]);A=math.radians(68);E=math.radians(15);bank=math.atan2(.68*math.sin(E),D-.68*math.cos(E));pitch=2*math.pi/15;R=198*S
N=4096
L=D-.68-.04;FORK_W=math.sqrt(.085**2-.04**2);Q=math.hypot(L,FORK_W);corner=math.atan2(FORK_W,L)
def limit(beta):
 dist=math.hypot(D-.68*math.cos(beta),.68*math.sin(beta));alpha=math.atan2(-.68*math.sin(beta),D-.68*math.cos(beta));h=math.acos(max(-1,min(1,(dist*dist+Q*Q-.085**2)/(2*dist*Q))))
 return alpha-math.copysign(corner-h,beta)
bank=-limit(E)
rot=lambda p,a: np.asarray(p)@np.array([[math.cos(a),math.sin(a)],[-math.sin(a),math.cos(a)]])
def pose(t):
 h=math.floor(2*t);u=2*t-h;side=1 if h%2==0 else -1;beta=-side*A*math.cos(math.pi*u);angle=limit(max(-E,min(E,beta)));progress=(bank-side*angle)/(2*bank)
 if progress<.5:adv=0
 elif progress<.9:adv=(progress-.5)/.4*math.radians(8)
 else:
  z=(progress-.9)/.1;adv=math.radians(8)+math.radians(4)*(z*z*(3-2*z))
 return beta,angle,2*math.pi/3-h*pitch/2-adv,progress,side
# tip and actual finite tooth polygon preserve source-like sharp/raked outline
T=np.array([[2.37,-.15],[R-.20,.02],[R,0],[2.53,.13]])
profiles=[]
for side in [1,-1]:
 # nominal active tooth index 0 on left, -2 on right
 pts=[]
 for u in np.linspace(.0,1,4097):
  # choose phases via monotone fork progress interval from lock start to impulse end
  t=u/2+(0 if side==1 else .5);beta,f,a,progress,s=pose(t)
  if 0<=progress<=.9:
   toothIndex=0 if side==1 else -2
   pts.append(rot(W+rot([R,0],a+toothIndex*pitch)-P,-f))
 pts=np.array(pts);pts=np.array([p for j,p in enumerate(pts) if j==0 or np.linalg.norm(p-pts[j-1])>1e-8]);tang=np.gradient(pts,axis=0);norm=np.array([-tang[:,1],tang[:,0]]).T;norm/=np.linalg.norm(norm,axis=1)[:,None]
 # Choose material side using the active midpoint reaction.
 mid=len(pts)//2;f=0;point=P+pts[mid];n=norm[mid]
 if np.cross(point-W,n)<0:norm=-norm
 inner=pts-.18*norm;blank=Polygon(np.vstack([pts,inner[::-1]])).buffer(0)
 # include all swept neighboring teeth, in pallet local coords
 cutters=[];previous={}
 for i in range(N+1):
  beta,f,a,progress,s=pose(i/N)
  for j in range(-4,3):
   tri=rot(W+rot(T,a+j*pitch)-P,-f)
   if np.linalg.norm(tri.mean(0)-pts.mean(0))<1.5:
    for indices in [[0,1,3],[1,2,3]]:
     cutters.append(MultiPoint(np.vstack([previous.get(j,tri)[indices],tri[indices]])).convex_hull.buffer(.0005,resolution=8))
   previous[j]=tri
 out=blank.difference(unary_union(cutters)).buffer(0)
 if out.geom_type=='MultiPolygon':out=max(out.geoms,key=lambda p:p.area)
 profiles.append(out)
 out=out.simplify(.000002,preserve_topology=True);profiles[-1]=out
 print('Pallet',side,'area',out.area,flush=True)

from pathlib import Path
import sys
payload=dict(pallets=[list(p.exterior.coords)[:-1] for p in profiles],necks=[list(p.buffer(-.015).exterior.coords)[:-1] for p in profiles],centers=[list(p.representative_point().coords[0]) for p in profiles],tooth=T.tolist(),bank=bank,forkLength=L,forkHalfWidth=FORK_W,cornerRadius=Q,cornerAngle=corner,centerDistance=D,axisAngle=base,wheelCenter=W.tolist(),palletPivot=P.tolist(),balanceCenter=B.tolist(),balanceAmplitude=A,engagementAngle=E,tipRadius=R,pitch=pitch)
text='// Generated offline by scripts/generate-lever-296-pallets.py.\nexport const lever296Parts = '+json.dumps(payload,separators=(',',':'))+';\n'
target=Path(__file__).resolve().parents[1]/'src/simulation/baked/lever-296-pallets.js'
if '--check' in sys.argv:
 if target.read_text()!=text:raise RuntimeError('Lever296 profiles differ')
else:target.write_text(text)
print('Vertices',sum(len(p.exterior.coords) for p in profiles))
