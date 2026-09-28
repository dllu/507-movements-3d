import { expansionEccentricOutline as trace } from '../data/expansion-eccentric-outline.js';

// The cam must bear on both fork rollers at once, as Brown's positive
// expansion eccentric does. Its edge is a smooth radial Fourier curve about
// the shaft (engraving pixels). It starts from a fit of the eccentric and the
// three lobes to the visible ink landmarks (odd harmonics, so the breadth
// across the two rollers stays nearly constant) and is then corrected
// iteratively for two-roller conjugacy with the fork pivoting at the measured
// eye and the rollers at their measured centres moved 4 pixels apart each.
// Over a turn the lower roller sits within -0.026..1.216 pixels of the cam
// while the upper roller touches it; visible landmarks fit to 3.93 pixels
// RMS (8.90 maximum). The rounded three-lobed edge keeps Brown's lobes and
// swings the rollers through 39 pixels a turn (the earlier smoothed cam gave
// 28); the traced outline's sharper dimples, which no two-roller fork can
// follow, are not kept. Design: pass-51 lane m3-mujoco-cams.
// Pass 97: 4.05 pixels (was 4). At 4 the fork pinched the cam by 0.03 px once
// a turn, which stalled the cam for a moment in the simulation and flung the
// lower roller up to four times its rolling speed. At 4.05 the lower roller
// runs 0.06..1.33 px clear of the cam while the upper roller bears on it.
export const expansionEccentricSpread = 4.05;
export const expansionEccentricCoefficients = [
  77.720491,
  13.305481,
  3.987685,
  0.227362,
  -0.379537,
  -3.008065,
  5.536802,
  -0.320232,
  0.311695,
  0.04689,
  0.102686,
  -0.167941,
  -0.230691,
  -0.031237,
  -0.119506,
  -0.025029,
  -0.023546,
  0.0647,
  -0.020479,
  0.047664,
  0.009167,
  0.020034,
  -0.003314,
  -0.000143,
  0.024905,
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
