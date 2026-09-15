import {Vector3,Ray} from 'three';

// Correct outward excursions introduced by decimation against the original
// radial mesh. This is sampled repair, followed by a separate mating-mesh
// intersection check; it is not claimed as continuous containment proof.
export function relieveWormWheel(geometry,parameters,fine){
 const p=geometry.attributes.position,index=geometry.index,pitch=2*Math.PI/parameters.teeth,n=fine.angularSteps,m=fine.axialSteps;
 const vertices=[];
 for(let j=0;j<=m;j++)for(let i=0;i<=n;i++){const a=-pitch/2+pitch*i/n,r=fine.radii[j*(n+1)+i];vertices.push(new Vector3(Math.fround(r*Math.cos(a)),Math.fround(r*Math.sin(a)),Math.fround(parameters.depth*(j/m-.5))));}
 const groups=[],lookup=new Map(),ids=[];
 for(let i=0;i<p.count;i++){
  const r=Math.hypot(p.getX(i),p.getY(i)),a=Math.atan2(p.getY(i),p.getX(i)),z=p.getZ(i);
  const key=Math.abs(Math.abs(a)-pitch/2)<1e-6?'seam:'+Math.round(r*1e7)+':'+Math.round(z*1e7):[p.getX(i),p.getY(i),z].map(x=>Math.round(x*1e8)).join(':');
  if(!lookup.has(key)){lookup.set(key,groups.length);groups.push([]);}const id=lookup.get(key);groups[id].push(i);ids.push(id);
 }
 const ray=new Ray(),hit=new Vector3(),a=new Vector3(),b=new Vector3(),c=new Vector3(),q=new Vector3();
 const margin=.00004,minimumRadius=Math.min(...fine.radii),initial=Array.from({length:p.count},(_,i)=>Math.hypot(p.getX(i),p.getY(i)));
 const history=[];let misses=0;
 for(let pass=0;pass<=12;pass++){
  const shifts=new Float64Array(groups.length);let maximumViolation=0,violations=0;
  for(let triangle=0;triangle<index.count;triangle+=3){
   const indices=[index.getX(triangle),index.getX(triangle+1),index.getX(triangle+2)];
   a.fromBufferAttribute(p,indices[0]);b.fromBufferAttribute(p,indices[1]);c.fromBufferAttribute(p,indices[2]);
   const eligible=[a,b,c].map(v=>Math.hypot(v.x,v.y)>.6);
   if(!eligible.some(Boolean))continue;
   for(let u=0;u<=6;u++)for(let v=0;v<=6-u;v++){
    const weights=[u/6,v/6,1-(u+v)/6];q.set(0,0,0).addScaledVector(a,weights[0]).addScaledVector(b,weights[1]).addScaledVector(c,weights[2]);
    const radius=Math.hypot(q.x,q.y);if(radius<minimumRadius-margin)continue;
    const theta=Math.max(-pitch/2+1e-7,Math.min(pitch/2-1e-7,Math.atan2(q.y,q.x))),x=Math.max(0,Math.min(n-1,Math.floor((theta+pitch/2)/pitch*n))),z=Math.max(-parameters.depth/2+1e-7,Math.min(parameters.depth/2-1e-7,q.z)),y=Math.max(0,Math.min(m-1,Math.floor((z/parameters.depth+.5)*m)));
    ray.origin.set(0,0,z);ray.direction.set(Math.cos(theta),Math.sin(theta),0);
    let found=false;
    // Float32 grid vertices can lie on the neighboring side of an ideal
    // angular/axial boundary. Check adjoining cells before declaring a miss.
    for(const dy of [0,-1,1])for(const dx of [0,-1,1]){
     if(found||x+dx<0||x+dx>=n||y+dy<0||y+dy>=m)continue;
     const i=(y+dy)*(n+1)+x+dx,va=vertices[i],vb=vertices[i+1],vc=vertices[i+n+2],vd=vertices[i+n+1];
     found=Boolean(ray.intersectTriangle(va,vb,vc,false,hit)||ray.intersectTriangle(va,vc,vd,false,hit));
    }
    if(!found){misses++;continue;}
    const violation=radius-Math.hypot(hit.x,hit.y)+margin;if(violation<=1e-7)continue;
    violations++;maximumViolation=Math.max(maximumViolation,violation);
    const weight=weights.reduce((s,w,i)=>s+(eligible[i]?w:0),0),shift=violation*1.15/weight;
    for(let j=0;j<3;j++)if(eligible[j])shifts[ids[indices[j]]]=Math.max(shifts[ids[indices[j]]],shift);
   }
  }
  history.push({pass,violations,maximumViolation});
  if(!violations||pass===12)break;
  for(let group=0;group<groups.length;group++)if(shifts[group])for(const i of groups[group]){
   const r=Math.hypot(p.getX(i),p.getY(i)),scale=(r-shifts[group])/r;p.setXY(i,p.getX(i)*scale,p.getY(i)*scale);
  }
 }
 p.needsUpdate=true;
 const report={history,rayMisses:misses,maximumAdditionalRelief:Math.max(...initial.map((r,i)=>r-Math.hypot(p.getX(i),p.getY(i))))};
 return report;
}
