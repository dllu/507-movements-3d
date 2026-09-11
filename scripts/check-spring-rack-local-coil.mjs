import fs from 'node:fs';
import {makeSpringRackCandidate} from './lib/spring-rack-candidate.mjs';
import {makeSpringRackCoil} from './lib/spring-rack-coil.mjs';
const data=JSON.parse(fs.readFileSync('artifacts/review/081-seamed-playback-data.json')),
 model=makeSpringRackCandidate(data.geometry),p=model.root.userData.geometry,spring=p.spring,
 referenceSpan=spring.top-spring.bottom-2*spring.wireRadius,
 coil=makeSpringRackCoil({...spring,referenceSpan}),N=512,M=16,W=2*Math.PI*spring.turns,r=spring.wireRadius,ease=.5/spring.turns,
 span=[referenceSpan-data.range[1],referenceSpan-data.range[0]],Rmin=coil.radiusAt(span[1]),Rmax=coil.radiusAt(span[0]);
const shape=t=>{
 if(t<ease){const u=t/ease;return[ease*(u**3-u**4/2)/(1-ease),(3*u*u-2*u**3)/(1-ease)];}
 if(t>1-ease){const u=(1-t)/ease;return[1-ease*(u**3-u**4/2)/(1-ease),(3*u*u-2*u**3)/(1-ease)];}
 return[(t-ease/2)/(1-ease),1/(1-ease)];
};
const maxPitch=span[1]/(1-ease),maxB=maxPitch/Math.hypot(W*Rmin,maxPitch),
 angularDeviation=Math.asin(r*maxB/(Rmin-r)),angularStep=W/N,
 nonadjacentWedgeMargin=angularStep-2*angularDeviation;
// Disks at ring i lie in its tangent-normal plane. Neighboring complete
// rings lie on opposite sides, so the two adjoining cells meet only there.
let adjacentPlaneMargin=Infinity;
for(let i=1;i<N;i++)for(const sign of [-1,1]){
 const [h,dh]=shape(i/N),[hj,dhj]=shape((i+sign)/N),
  centerProjection=(Rmin**2*W*Math.sin(angularStep)+span[0]**2*dh*Math.abs(hj-h))/Math.hypot(W*Rmax,span[1]*dh),
  tangentDifference=2*Math.hypot(2*W*Rmax*Math.sin(angularStep/2),span[1]*Math.abs(dh-dhj))/(W*Rmin),
  margin=centerProjection-r*tangentDifference-1e-6;
 adjacentPlaneMargin=Math.min(adjacentPlaneMargin,margin);
}
// Interval arithmetic for each closed mesh cell. A positive determinant
// for every outward triangle, relative to a point on its interior chord,
// keeps its radial projection oriented and excludes local surface folding.
const plus=(a,b)=>[a[0]+b[0],a[1]+b[1]],neg=a=>[-a[1],-a[0]],minus=(a,b)=>plus(a,neg(b)),
 times=(a,b)=>{const q=[a[0]*b[0],a[0]*b[1],a[1]*b[0],a[1]*b[1]];return[Math.min(...q),Math.max(...q)];},
 det=(a,b,c)=>plus(minus(times(a[0],minus(times(b[1],c[2]),times(b[2],c[1]))),times(a[1],minus(times(b[0],c[2]),times(b[2],c[0])))),times(a[2],minus(times(b[0],c[1]),times(b[1],c[0])))),
 linear=(constant=0)=>[constant,0,0,0,0,0,0],diff=(a,b)=>a.map((v,i)=>v-b[i]),
 evaluate=(a,box)=>a.slice(1).reduce((sum,v,i)=>plus(sum,times([v,v],box[i])),[a[0],a[0]]);
// Variables are R, span, a0, b0, a1, b1; a and b are the vertical and
// azimuthal components of the unit section binormal. Their extrema are
// monotone in span because constant wire length makes R decrease.
const unique=[];
for(let i=0;i<N;i++){
 const [h0,d0]=shape(i/N),[h1,d1]=shape((i+1)/N),key=[h1-h0,d0,d1].map(v=>v.toFixed(12)).join(',');
 if(unique.some(c=>c.key===key))continue;
 const vertices=[];
 for(let end=0;end<2;end++)for(let j=0;j<M;j++){
  const phi=2*Math.PI*j/M,theta=(end?-.5:.5)*angularStep,cs=Math.cos(theta),sn=Math.sin(theta),
   x=linear(r*Math.cos(phi)*cs),y=linear(),z=linear(r*Math.cos(phi)*sn);
  x[1]=cs-1;x[4+2*end]=r*Math.sin(phi)*sn;
  y[2]=(end?.5:-.5)*(h1-h0);y[3+2*end]=-r*Math.sin(phi);
  z[1]=sn;z[4+2*end]=-r*Math.sin(phi)*cs;vertices.push([x,y,z]);
 }
 for(let end=0;end<2;end++){
  const theta=(end?-.5:.5)*angularStep,x=linear(),y=linear(),z=linear();
  x[1]=Math.cos(theta)-1;y[2]=(end?.5:-.5)*(h1-h0);z[1]=Math.sin(theta);vertices.push([x,y,z]);
 }
 const triangles=[];for(let j=0;j<M;j++){const k=(j+1)%M;triangles.push([j,M+j,M+k],[j,M+k,k],[2*M,j,k],[2*M+1,M+k,M+j]);}
 unique.push({key,i,d0,d1,vertices,triangles});
}
const boxAt=(lo,hi,c)=>{
 const rl=coil.radiusAt(hi),rh=coil.radiusAt(lo),components=d=>{
  const bl=lo*d/Math.hypot(W*rh,lo*d),bh=hi*d/Math.hypot(W*rl,hi*d);
  return[[Math.sqrt(1-bh*bh),Math.sqrt(1-bl*bl)],[bl,bh]];
 };
 return[[rl,rh],[lo,hi],...components(c.d0),...components(c.d1)];
};
let minimumDeterminant=Infinity,leaves=0,maxDepth=0,maximumDegreeError=0;const failures=[];
for(const c of unique){
 const mid=(span[0]+span[1])/2,nominal=boxAt(mid,mid,c);
 const triangles=c.triangles.map(ids=>{
  const v=ids.map(i=>c.vertices[i].map(a=>evaluate(a,nominal))),value=det(...v)[0];
  return value>0?ids:[ids[0],ids[2],ids[1]];
 });
 let solidAngle=0;
 const edgeWinding=new Map();
 for(const ids of triangles){
  const v=ids.map(i=>c.vertices[i].map(a=>evaluate(a,nominal)[0])),length=v.map(a=>Math.hypot(...a)),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),
   determinant=det(...v.map(a=>a.map(x=>[x,x])))[0];
  solidAngle+=2*Math.atan2(determinant,length[0]*length[1]*length[2]+dot(v[0],v[1])*length[2]+dot(v[1],v[2])*length[0]+dot(v[2],v[0])*length[1]);
  for(let j=0;j<3;j++){const a=ids[j],b=ids[(j+1)%3],key=Math.min(a,b)+':'+Math.max(a,b);edgeWinding.set(key,(edgeWinding.get(key)??0)+(a<b?1:-1));}
 }
 maximumDegreeError=Math.max(maximumDegreeError,Math.abs(solidAngle-4*Math.PI));
 if([...edgeWinding.values()].some(v=>v!==0)||Math.abs(solidAngle-4*Math.PI)>1e-10)throw Error('Invalid source cell winding');
 const check=(lo,hi,depth=0)=>{
  const box=boxAt(lo,hi,c);let minimum=Infinity;
  for(const ids of triangles){
   const a=c.vertices[ids[0]],b=c.vertices[ids[1]],d=c.vertices[ids[2]],
    av=a.map(v=>evaluate(v,box)),bv=b.map((v,i)=>evaluate(diff(v,a[i]),box)),dv=d.map((v,i)=>evaluate(diff(v,a[i]),box));
   minimum=Math.min(minimum,det(av,bv,dv)[0]);
  }
  if(minimum<=1e-10&&depth<14){const mid=(lo+hi)/2;check(lo,mid,depth+1);check(mid,hi,depth+1);return;}
  leaves++;maxDepth=Math.max(maxDepth,depth);minimumDeterminant=Math.min(minimumDeterminant,minimum);
  if(minimum<=1e-10)failures.push({cell:c.i,lo,hi,minimum});
 };check(...span);
}
const passed=nonadjacentWedgeMargin>0&&adjacentPlaneMargin>0&&failures.length===0,
 report={movement:81,passed,span,radii:[Rmin,Rmax],angularDeviation,angularStep,nonadjacentWedgeMargin,adjacentPlaneMargin,
 uniqueCellShapes:unique.length,cellIntervalLeaves:leaves,maxDepth,minimumDeterminant,maximumDegreeError,failures,
 argument:['Nonadjacent cells within half a turn have disjoint polar-angle wedges throughout compression.',
 'Adjacent cells lie on opposite sides of their shared section plane; the bound includes a 1e-6 rounding allowance.',
 'Interval determinants keep every closed-cell triangle oriented relative to its interior chord point throughout the span range; triangulated cells retain the source mesh winding.',
 'The existing nonlocal check covers cells farther than half a turn apart. Combined, these address every cell pair.'],
 qualification:'Continuous bounds apply to the analytic coordinates used to generate the indexed wire. Float32 topology and shading orientation are separately checked at travel poses. Positive determinant continuation excludes cell folding; it is not a bound on spring material stress.'};
fs.writeFileSync('artifacts/review/081-local-coil-bounds.json',JSON.stringify(report,null,2)+'\n');console.log(report);if(!passed)process.exitCode=1;
