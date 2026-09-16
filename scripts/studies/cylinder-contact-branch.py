"""Bounded REJECTED cylinder-contact experiment, not production motion.
Python3 + Shapely2.0.3 + numpy. Output must be a RAM path, e.g.
python3 scripts/studies/cylinder-contact-branch.py /dev/shm/cylinder43-study.json
An imposed balance and first-obstacle wheel search do not solve dynamics.
"""
import json,math,sys
from pathlib import Path
import numpy as np
from shapely.geometry import Polygon
from shapely.affinity import rotate,translate
output=Path(sys.argv[1]);assert str(output).startswith('/dev/shm/')
distance=3.;radius=3.05;pitch=2*math.pi/15
outer=math.hypot(radius*math.cos(math.pi/2+pitch/2),radius*math.sin(math.pi/2+pitch/2)-distance)
inner=math.hypot(radius*math.cos(math.pi/2+pitch/2-math.radians(21)),radius*math.sin(math.pi/2+pitch/2-math.radians(21))-distance)
shell=Polygon([(outer*math.cos(a),outer*math.sin(a))for a in np.linspace(0,math.pi,513)]+[(inner*math.cos(a),inner*math.sin(a))for a in np.linspace(math.pi,0,513)])
head=Polygon([(3.05,0),(2.67,.10),(2.67,.35)])
rows=[];theta=math.pi/2+pitch/2+.02;worst_overlap=0
for i in range(513):
    q=i/512;balance=math.radians(44)*math.cos(2*math.pi*q)
    actual=translate(rotate(shell,balance,origin=(0,0),use_radians=True),0,distance)
    expanded=actual.buffer(.0005,quad_segs=4)
    def collides(angle):
        return any(rotate(head,angle+j*pitch,origin=(0,0),use_radians=True).intersection(expanded).area>1e-11 for j in range(-2,4))
    for step in range(500):
        trial=theta-.001
        if collides(trial):
            lo,hi=trial,theta
            for _ in range(18):
                mid=(lo+hi)/2
                if collides(mid):lo=mid
                else:hi=mid
            theta=hi;break
        theta=trial
    else:raise RuntimeError('No first obstacle within bounded angular window')
    overlap=max(rotate(head,theta+j*pitch,origin=(0,0),use_radians=True).intersection(actual).area for j in range(15))
    worst_overlap=max(worst_overlap,overlap)
    rows.append([q,balance,theta])
jumps=[{'phase':rows[i][0],'advance':rows[i-1][2]-rows[i][2]}for i in range(1,len(rows))]
entry=max((v for v in jumps if v['phase']<.5),key=lambda v:v['advance'])
exit_jump=max((v for v in jumps if v['phase']>.5),key=lambda v:v['advance'])
report={'acceptedForProduction':False,'forceValidated':False,'reason':'First-contact search releases almost the whole exit advance in one sample; no opposing loaded exit impulse or continuous drop has been established.',
 'poses':len(rows),'clearance':.0005,'head':list(head.exterior.coords),'shell':'upper 180-degree half cylinder','balanceAmplitude':math.radians(44),'radii':[inner,outer],
 'actualMaximumOverlapAreaAll15Teeth':worst_overlap,'cycleAdvance':rows[0][2]-rows[-1][2],'largestEntryStep':entry,'largestExitStep':exit_jump,'states':rows}
output.write_text(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items()if k!='states'},indent=2))
