// Closest points on two finite 3D segments, including parallel/degenerate cases.
export function cordSegmentDistance(a,b,c,d) {
  const u=b.map((x,k)=>x-a[k]),v=d.map((x,k)=>x-c[k]),r=a.map((x,k)=>x-c[k]);
  const dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0),clamp=x=>Math.max(0,Math.min(1,x));
  const uu=dot(u,u),vv=dot(v,v),uv=dot(u,v),ur=dot(u,r),vr=dot(v,r);
  let s=0,t=0;
  if(uu<1e-24&&vv<1e-24)return Math.hypot(...r);
  if(uu<1e-24)t=clamp(vr/vv);
  else if(vv<1e-24)s=clamp(-ur/uu);
  else {
    const determinant=uu*vv-uv*uv;
    s=determinant>1e-14*uu*vv?clamp((uv*vr-ur*vv)/determinant):0;
    t=(uv*s+vr)/vv;
    if(t<0){t=0;s=clamp(-ur/uu);}
    else if(t>1){t=1;s=clamp((uv-ur)/uu);}
  }
  return Math.hypot(...r.map((x,k)=>x+s*u[k]-t*v[k]));
}

export function cordSelfClearance(sections,radius,{excludedArc=0}={}) {
  const boxes=sections.map(([a,b])=>({min:a.map((x,k)=>Math.min(x,b[k])),max:a.map((x,k)=>Math.max(x,b[k]))}));
  let minimum=Infinity,pair;const starts=[0];
  for(const[a,b]of sections)starts.push(starts.at(-1)+Math.hypot(...a.map((x,k)=>x-b[k])));
  for(let i=0;i<sections.length;i++)for(let j=i+2;j<sections.length;j++) {
    if(starts[j]-starts[i+1]<excludedArc)continue;
    const a=boxes[i],b=boxes[j];
    const lower=Math.hypot(...a.min.map((x,k)=>Math.max(0,x-b.max[k],b.min[k]-a.max[k])));
    if(lower>=minimum)continue;
    const d=cordSegmentDistance(...sections[i],...sections[j]);
    if(d<minimum){minimum=d;pair=[i,j];}
  }
  return {gap:minimum-2*radius,pair};
}
