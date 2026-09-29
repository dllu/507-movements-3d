# 208's slotted pinion (pass 101): clean, regular teeth instead of the raw
# pin-sweep envelope. Every tooth is one ideal symmetric outline: radial
# flanks from a root circle, filleted into the root, closed by a single
# circular cap tangent to both flanks. The pins (cylinders lying radial to the
# pinion) act as straight-sided bars, so radial flanks with a round top are
# the natural tooth; the addendum is kept small (tip r 1.03 on pitch r 1)
# because the inner ring's pins lag the rack law where they cross the strip.
# BETA (slot half-angle 0.087 rad: 0.174 wide at the pitch circle for 0.164
# pins) is the narrowest symmetric slot that clears every ring's sweep; the
# minimum clearance is then about 0.001 on both flanks. PHASE may turn the
# tooth pattern to bias the backlash to one flank (0: centred on the pins).
#
# The outline is then checked against the exported 3D pin sweep
# (scripts/export-208-pin-envelope.mjs -> /dev/shm/208-pin-envelope.json):
# the script fails if any swept pin section overlaps a tooth.
import json,math,os
from shapely.geometry import Polygon,MultiPoint
from shapely.ops import unary_union
SLOTS=16;PITCH=2*math.pi/SLOTS
ROOT=0.84;TIP=1.03;BETA=0.087;FILLET=0.012;PHASE=float(os.environ.get('PHASE','0'))
def arc(cx,cy,r,a0,a1,step=math.radians(1.5)):
  n=max(2,int(abs(a1-a0)/step)+1);return [(cx+r*math.cos(a0+(a1-a0)*i/n),cy+r*math.sin(a0+(a1-a0)*i/n)) for i in range(n+1)]
def period():
  lo,hi=BETA,PITCH-BETA;h=(hi-lo)/2;mid=PITCH/2
  rc=TIP/(1+math.sin(h));cap=rc*math.sin(h);tangent=rc*math.cos(h)
  fc=ROOT+FILLET;dt=math.asin(FILLET/fc);foot=fc*math.cos(dt)
  pts=[]
  pts+=arc(0,0,ROOT,0,lo-dt)[:-1]
  # root fillet into the flank at angle lo
  c=(fc*math.cos(lo-dt),fc*math.sin(lo-dt))
  pts+=arc(*c,FILLET,lo-dt+math.pi,lo+math.pi/2)[:-1]
  pts.append((foot*math.cos(lo),foot*math.sin(lo)))
  pts+=arc(rc*math.cos(mid),rc*math.sin(mid),cap,lo-math.pi/2,hi+math.pi/2)
  pts.append((foot*math.cos(hi),foot*math.sin(hi)))
  c=(fc*math.cos(hi+dt),fc*math.sin(hi+dt))
  pts+=arc(*c,FILLET,hi-math.pi/2,hi+dt-math.pi)[1:]
  pts+=arc(0,0,ROOT,hi+dt,PITCH)[1:-1]
  return pts,dict(capRadius=cap,capTangentRadius=tangent)
one,info=period()
outline=[]
for k in range(SLOTS):
  a=k*PITCH+PHASE;ca,sa=math.cos(a),math.sin(a)
  outline+=[(x*ca-y*sa,x*sa+y*ca) for x,y in one]
pinion=Polygon(outline);assert pinion.is_valid
src=os.environ.get('ENVELOPE','/dev/shm/208-pin-envelope.json')
if os.path.exists(src):
  cutters=[MultiPoint(p).convex_hull for p in json.load(open(src))['cutters']]
  gaps=[pinion.distance(c) if not pinion.intersects(c) else -pinion.intersection(c).area for c in cutters]
  info['minimumSweptPinClearance']=min(gaps);assert min(gaps)>0,'swept pins overlap the teeth'
outline=[[round(x,7),round(y,7)] for x,y in outline]
with open(os.environ.get('BAKED_OUTPUT','src/simulation/generated-pin-slot-208.js'),'w') as f:f.write('// Generated offline by scripts/generate-208-pin-envelope.py.\nexport default '+json.dumps(outline,separators=(',',':'))+';\n')
print({'points':len(outline),**info})
