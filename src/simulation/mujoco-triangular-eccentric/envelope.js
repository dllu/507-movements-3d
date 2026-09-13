const cache=new Map();
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);

/** Conservative convex opening for the cam in the translating yoke's frame. */
export function triangularEccentricEnvelope(profile) {
  const key=[profile.width,profile.smallRadius].join(',');if(cache.has(key))return cache.get(key);
  const angularSteps=2048,chordTolerance=.0001,runningAllowance=.003;
  const outline=profile.outline(chordTolerance),points=[];
  for(let i=0;i<angularSteps;i++) {
    const angle=i*2*Math.PI/angularSteps,c=Math.cos(angle),s=Math.sin(angle);
    const center=(profile.extreme(angle).value+profile.extreme(angle,-1).value)/2;
    for(const [x,y] of outline)points.push([x*c-y*s,x*s+y*c-center]);
  }
  points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const chain=sequence=>{
    const result=[];
    for(const p of sequence){while(result.length>1&&cross(result.at(-2),result.at(-1),p)<=1e-13)result.pop();result.push(p);}
    return result;
  };
  const hull=[...chain(points).slice(0,-1),...chain(points.reverse()).slice(0,-1)];
  // Every cam point is within R of the shaft, and the yoke center is R-Lipschitz
  // in angle. Thus a pose differs from its nearest sample by at most 2R*pi/N.
  // Add the chord error and clearance for the passive yoke's bearing play.
  const samplingBound=2*Math.PI*profile.largeRadius/angularSteps+chordTolerance;
  const offset=samplingBound+runningAllowance;
  const normals=hull.map((p,i)=>{
    const q=hull[(i+1)%hull.length],dx=q[0]-p[0],dy=q[1]-p[1],length=Math.hypot(dx,dy);
    return [dy/length,-dx/length];
  });
  const boundary=hull.map((p,i)=>{
    const a=normals[(i+hull.length-1)%hull.length],b=normals[i],denominator=1+a[0]*b[0]+a[1]*b[1];
    return p.map((v,k)=>v+offset*(a[k]+b[k])/denominator);
  });
  const result={boundary,angularSteps,chordTolerance,runningAllowance,samplingBound,offset};cache.set(key,result);return result;
}
