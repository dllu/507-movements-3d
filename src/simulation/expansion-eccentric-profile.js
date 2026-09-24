import { expansionEccentricOutline as trace } from '../data/expansion-eccentric-outline.js';

// The cam must bear on both fork rollers at once, as Brown's positive
// expansion eccentric does. Its edge is a smooth radial Fourier curve about
// the shaft (engraving pixels) fitted jointly to the visible ink landmarks
// and to two-roller conjugacy with the fork pivoting at the measured eye, the
// rollers at their measured centres moved 4 pixels apart each. Over a
// turn the lower roller sits within -0.037..0.616 pixels of the cam
// while the upper roller touches it; visible landmarks fit to 4.84 pixels RMS
// (11.23 maximum). The traced outline's dimples, which no two-roller
// fork can follow, are smoothed away. Design: pass-51 lane u2 optimizer.
export const expansionEccentricSpread = 4;
export const expansionEccentricCoefficients = [
  78.1814565134,
  11.5253312204,
  3.6878300112,
  0.149068084,
  -0.0702779228,
  -1.3617431385,
  2.0448886584,
  -0.1432852424,
  0.0928010455,
  0.1034123751,
  0.1618266564,
  -0.0157742096,
  -0.0255234897,
];
export function expansionEccentricRadius(angle) {
  const c = expansionEccentricCoefficients;let r = c[0];
  for (let k = 1; 2 * k < c.length; k++) r += c[2*k-1]*Math.cos(k*angle) + c[2*k]*Math.sin(k*angle);
  return r;
}
export function expansionEccentricProfile(samples = 384) {
  return Array.from({length:samples},(_,i)=>{
    const a=2*Math.PI*i/samples,r=expansionEccentricRadius(a);return [r*Math.cos(a),r*Math.sin(a)];
  });
}

export function expansionForkLimits(profile, driverAngle, {upperRadius=31,lowerRadius=32,spread=expansionEccentricSpread} = {}) {
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
