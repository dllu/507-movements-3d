import { expansionEccentricOutline as trace } from '../data/expansion-eccentric-outline.js';

// The cam must bear on both fork rollers at once, as Brown's positive
// expansion eccentric does. Pass 99 redesign: the upper roller's pitch curve
// (its centre's path about the shaft) is a constant-diameter curve, the pitch
// radius plus the radius half a turn later being constant, built from odd
// harmonics only (eccentric, 3rd, 5th and 7th) fitted to Brown's visible edge
// landmarks. The cam edge is the inner envelope of the roller circle rolled
// round that pitch curve, so the rollers can follow it everywhere. Unlike the
// earlier smoothed cam, Brown's dimples are kept as true concave hollows (at
// the upper left, lower left and lower right, 23% of the edge, concave radius
// at least 122 px, far larger than the 31 px rollers, so they roll through
// them): a concave dent in the pitch curve is matched by a bulge half a turn
// round, which Brown's lobes supply. Landmarks fit to 3.62 px RMS (7.9 max;
// the old cam 3.93 / 8.9). The pitch diameter is 218.3 px against the rollers'
// 220.1 px centre spacing: with the fork pivoting at its measured eye the
// lower roller then runs 0.07..1.65 px clear while the upper bears on it.
// The edge is stored as a radial Fourier series (40 harmonics, within 0.035 px
// of the envelope). Designs: pass-51 lane m3-mujoco-cams, pass 97, pass 99.
export const expansionEccentricSpread = 4.05;
export const expansionEccentricCoefficients = [
  77.272004,
  12.968805,
  5.180826,
  0.096828,
  0.377075,
  -3.131302,
  5.057048,
  -0.095202,
  0.15273,
  0.967827,
  2.46014,
  -0.269311,
  0.433609,
  1.44279,
  -1.495073,
  -0.053455,
  -0.267489,
  -0.019934,
  -0.041667,
  0.01111,
  0.584493,
  -0.046559,
  -0.033654,
  0.309116,
  0.11793,
  0.00268,
  0.046526,
  0.011987,
  -0.186762,
  -0.097465,
  0.021819,
  -0.016506,
  -0.016332,
  0.075184,
  0.092203,
  -0.01894,
  -0.002783,
  0.058696,
  -0.025162,
  -0.008604,
  0.000207,
  -0.012747,
  -0.029346,
  -0.0173,
  0.035463,
  -0.009248,
  -0.002312,
  0.032807,
  0.007061,
  -0.006548,
  -0.001003,
  0.008738,
  -0.014884,
  -0.008987,
  0.004528,
  -0.006526,
  -0.006901,
  0.005204,
  0.015339,
  -0.002968,
  0.000269,
  0.010667,
  -0.004462,
  -0.004646,
  -0.000232,
  9.4e-05,
  -0.006213,
  -0.002612,
  0.005957,
  -0.003218,
  -0.001448,
  0.005996,
  0.003672,
  -0.001281,
  -0.000375,
  0.002829,
  -0.003745,
  -0.002969,
  0.001482,
  -0.001169,
  -0.002338,
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
