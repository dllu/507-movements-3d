import * as THREE from 'three';
import { expansionEccentricOutline as trace } from '../data/expansion-eccentric-outline.js';

export function expansionEccentricProfile(samples = 384) {
  const points = [
    ...trace.visibleRuns[0], [92,302], [80,300], [68,302],
    ...trace.visibleRuns[1], [72,152], [82,153], [94,149],
  ].map(([x,y]) => new THREE.Vector3(x-trace.shaft[0], trace.shaft[1]-y, 0));
  const curve = new THREE.CatmullRomCurve3(points, true, 'centripetal');
  return Array.from({length:samples},(_,i)=>{
    const p=curve.getPoint(i/samples);return [p.x,p.y];
  });
}

export function expansionForkLimits(profile, driverAngle, {upperRadius=31,lowerRadius=32,spread=0} = {}) {
  const c=Math.cos(driverAngle),s=Math.sin(driverAngle);
  const polygon=profile.map(([x,y])=>[c*x-s*y,s*x+c*y]);
  const pivot=[trace.forkPivot[0]-trace.shaft[0],trace.shaft[1]-trace.forkPivot[1]];
  const gap=(side,angle)=>{
    const r=trace.rollerCenters[side],local=[r[0]-trace.forkPivot[0],trace.forkPivot[1]-r[1]+(side==='upper'?spread:-spread)];
    const ca=Math.cos(angle),sa=Math.sin(angle),p=[pivot[0]+ca*local[0]-sa*local[1],pivot[1]+sa*local[0]+ca*local[1]];
    let minimum=Infinity;
    for(let i=0;i<polygon.length;i++){
      const a=polygon[i],b=polygon[(i+1)%polygon.length],dx=b[0]-a[0],dy=b[1]-a[1];
      const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));
      minimum=Math.min(minimum,Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy));
    }
    return minimum-(side==='upper'?upperRadius:lowerRadius);
  };
  const root=side=>{
    // Search outward from the central cam region, then refine the nearest
    // separating contact. Far branches on the opposite side are irrelevant.
    const sign=side==='upper'?1:-1;
    let last=-.25*sign,lastGap=gap(side,last);
    for(let i=1;i<=200;i++){
      const next=(-.25+.5*i/200)*sign,nextGap=gap(side,next);
      if(lastGap>=0&&nextGap<=0){
        let a=last,b=next;for(let j=0;j<35;j++){const m=(a+b)/2;if(gap(side,m)>=0)a=m;else b=m;}
        return (a+b)/2;
      }
      last=next;lastGap=nextGap;
    }
    throw Error('No fork contact branch found');
  };
  const lower=root('lower'),upper=root('upper');
  return {lower,upper,width:upper-lower,gap};
}
