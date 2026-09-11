import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {makeCrossedRackCandidate} from './lib/crossed-rack-candidate.mjs';
import {renderedPrism} from './lib/crossed-rack-mesh-prisms.mjs';
const input=process.env.PROBE_INPUT??'artifacts/review/080-amplitude016-finest-dynamics.json',prefix=process.env.PROBE_PREFIX??'artifacts/review/080-finest-secondary-bounds',
 data=JSON.parse(fs.readFileSync(input)),u=makeCrossedRackCandidate(data.geometry).root.userData,parts=[],pairs=[],issues=[],
 dot=(a,b)=>a[0]*b[0]+a[1]*b[1],cross=(a,b)=>a[0]*b[1]-a[1]*b[0],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],
 ranges=[0,1,2].map(i=>data.rows.reduce((r,s)=>[Math.min(r[0],s.x[i]),Math.max(r[1],s.x[i])],[Infinity,-Infinity])),
 qrange=[-data.parameters.amplitude,data.parameters.amplitude],roundoff=1e-12;
assert.equal(data.failures.length,0);
const hull=points=>{
 const unique=Array.from(new Map(points.map(p=>[p.join(','),p])).values()).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const half=list=>{const result=[];for(const p of list){while(result.length>1&&cross(sub(result.at(-1),result.at(-2)),sub(p,result.at(-1)))<=0)result.pop();result.push(p);}return result;};
 return[...half(unique).slice(0,-1),...half([...unique].reverse()).slice(0,-1)];
};
const rotatingProjection=(v,n,range)=>{
 const A=dot(v,n),B=-v[1]*n[0]+v[0]*n[1],values=range.map(a=>A*Math.cos(a)+B*Math.sin(a)),phase=Math.atan2(B,A);
 for(let k=Math.ceil((range[0]-phase)/Math.PI);k<=(range[1]-phase)/Math.PI;k++){const a=phase+k*Math.PI;values.push(A*Math.cos(a)+B*Math.sin(a));}
 return[Math.min(...values)-roundoff,Math.max(...values)+roundoff];
};
for(const [name,mesh]of Object.entries(u.parts)){
 const p=mesh.geometry.attributes.position,points=[];let zmin=Infinity,zmax=-Infinity;
 for(let i=0;i<p.count;i++){points.push([p.getX(i)+mesh.position.x,p.getY(i)+mesh.position.y]);zmin=Math.min(zmin,p.getZ(i)+mesh.position.z);zmax=Math.max(zmax,p.getZ(i)+mesh.position.z);}
 parts.push({name,mesh,family:u.families[name],hull:hull(points),zmin,zmax});
}
const extent=(part,n)=>{
 let low=Infinity,high=-Infinity;
 for(const v of part.hull){let r;
  if(part.family==='fixed')r=[dot(v,n),dot(v,n)];
  else if(part.family==='rack'){const d=ranges[0].map(y=>dot(v,n)+y*n[1]);r=[Math.min(...d),Math.max(...d)];}
  else if(part.family==='lever')r=rotatingProjection(v,n,qrange);
  else{const P=rotatingProjection(u.geometry.anchors[part.family],n,qrange),R=rotatingProjection(v,n,ranges[part.family==='left'?1:2]);r=[P[0]+R[0],P[1]+R[1]];}
  low=Math.min(low,r[0]);high=Math.max(high,r[1]);
 }
 return[low-roundoff,high+roundoff];
};
const normals=part=>part.hull.map((p,i)=>{const d=sub(part.hull[(i+1)%part.hull.length],p),L=Math.hypot(...d);return[d[1]/L,-d[0]/L];});
const minimumRadius=geometry=>{
 const p=geometry.attributes.position,index=geometry.index;let minimum=Infinity;
 for(let i=0;i<(index?.count??p.count);i+=3){
  const t=[0,1,2].map(j=>{const k=index?index.getX(i+j):i+j;return[p.getX(k),p.getY(k)];}),area=cross(sub(t[1],t[0]),sub(t[2],t[0]));
  if(Math.abs(area)>1e-16&&t.every((v,j)=>cross(sub(t[(j+1)%3],v),v.map(v=>-v))*Math.sign(area)>=0))return 0;
  for(let j=0;j<3;j++){const a=t[j],d=sub(t[(j+1)%3],a),square=dot(d,d),f=square?Math.max(0,Math.min(1,-dot(a,d)/square)):0;minimum=Math.min(minimum,Math.hypot(a[0]+f*d[0],a[1]+f*d[1]));}
 }
 return minimum;
};
const bore=(plate,shaft)=>{
 const minimum=minimumRadius(plate.mesh.geometry),p=shaft.mesh.geometry.attributes.position;let maximum=0;
 for(let i=0;i<p.count;i++)maximum=Math.max(maximum,Math.hypot(p.getX(i),p.getY(i)));
 return{method:'coaxial-mesh-radius',minimum,maximum,lower:minimum-maximum-roundoff};
};
const slot=(rack,shaft)=>{
 const prism=renderedPrism(rack.mesh.geometry),remaining=new Map(prism.boundary.map(e=>[e.a.join(','),e])),loops=[];
 while(remaining.size){const start=remaining.values().next().value.a,loop=[];let current=start;
  do{const e=remaining.get(current.join(','));assert(e);remaining.delete(current.join(','));loop.push(e);current=e.b;}while(current.join(',')!==start.join(','));loops.push(loop);
 }
 const holes=loops.filter(loop=>loop.reduce((s,e)=>s+cross(e.a,e.b),0)<0);assert.equal(holes.length,1);const edges=holes[0];
 for(const e of edges)for(const f of edges)assert(dot(sub(f.a,e.a),e.normal)>-1e-10,'Convex rendered slot');
 const p=shaft.mesh.geometry.attributes.position;let radius=0;for(let i=0;i<p.count;i++)radius=Math.max(radius,Math.hypot(p.getX(i),p.getY(i)));
 const lower=Math.min(...edges.flatMap(e=>ranges[0].map(y=>dot(sub([0,-y],e.a),e.normal)-radius)))-roundoff;
 return{method:'convex-slot-eroded-by-shaft-radius',edges:edges.length,radius,rackYRange:ranges[0],lower};
};
for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){
 const a=parts[i],b=parts[j];if(a.family===b.family)continue;let result;
 if(a.name==='slottedRack'&&['leftHookWeb','rightHookWeb'].includes(b.name))result={method:'separate-primary-prism-bounds',primary:true};
 else if(a.name==='slottedRack'&&b.name==='fixedFulcrum')result=slot(a,b);
 else if(a.name==='taperedLever'&&b.name==='fixedFulcrum'||['left','right'].some(k=>a.name===k+'Pawl'&&b.name===k+'PawlPin'))result=bore(a,b);
 else{
  const z=Math.max(a.zmin-b.zmax,b.zmin-a.zmax);
  if(z>=0)result={method:'invariant-depth-separation',lower:z};
  else{
   let best={lower:-Infinity};
   for(const n of [[1,0],[0,1],...normals(a),...normals(b)]){
    const A=extent(a,n),B=extent(b,n),lower=Math.max(A[0]-B[1],B[0]-A[1]);if(lower>best.lower)best={lower,axis:n,a:A,b:B};
   }
   result={method:'global-convex-hull-projection',...best};
  }
 }
 const row={a:a.name,b:b.name,...result};pairs.push(row);if(!result.primary&&result.lower<0)issues.push(row);
}
const sources=['scripts/bound-crossed-rack-secondary.mjs','scripts/lib/crossed-rack-mesh-prisms.mjs','scripts/lib/crossed-rack-candidate.mjs','scripts/lib/crossed-rack-source.mjs',input].map((file,i)=>{
 const archive=prefix+'-source-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);return{file,archive,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
});
const report={movement:80,status:'continuous-secondary-clearance-bounds',productionChanged:false,mechanicsPassed:false,passed:issues.length===0,
 completeTrajectory:true,independentPairs:pairs.length,secondaryPairs:pairs.filter(p=>!p.primary).length,qrange,ranges,roundoff,pairs,issues,sources,
 qualification:'Actual mesh vertices and triangle radii establish invariant depth separation, coaxial bearing clearance and a shaft disk wholly inside the rendered convex slot. All other secondary pairs use complete projected mesh convex hulls with exact sinusoidal rotation extrema over the full input and free-coordinate ranges; independent angle/height ranges are conservative. The two hook/rack pairs require their separate continuous triangle certificate.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({passed:report.passed,independentPairs:pairs.length,secondaryPairs:report.secondaryPairs,
 methods:pairs.reduce((s,p)=>(s[p.method]=(s[p.method]??0)+1,s),{}),issues,minimum:Math.min(...pairs.filter(p=>!p.primary).map(p=>p.lower))});if(!report.passed)process.exitCode=1;
