import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeSpringSectorCandidate} from './lib/spring-sector-candidate.mjs';
const model = makeSpringSectorCandidate(), spring = model.root.userData.springs[0], coil = spring.coil,
 p = coil.geometry.userData.coil, N = p.segments, M = p.sides, W = 2 * Math.PI * p.turns,
 r = p.wireRadius, ease = .5 / p.turns, span = [p.span - .18, p.span + .06],
 Rmin = coil.radiusAt(span[1]), Rmax = coil.radiusAt(span[0]), rounding = 2e-7;
// Adapted from the 081 cell proof, using 083's actual 128 by 12 wire mesh.
// A section's radial/tangential ellipse has exact angular support
// atan(r * B / sqrt(R^2-r^2)); this stays useful at maximum guide extension.
assert(Rmin > r);
const shape=t=>{
 if(t<ease){const u=t/ease;return[ease*(u**3-u**4/2)/(1-ease),(3*u*u-2*u**3)/(1-ease)];}
 if(t>1-ease){const u=(1-t)/ease;return[1-ease*(u**3-u**4/2)/(1-ease),(3*u*u-2*u**3)/(1-ease)];}
 return[(t-ease/2)/(1-ease),1/(1-ease)];
};
const maxPitch=span[1]/(1-ease),maxB=maxPitch/Math.hypot(W*Rmin,maxPitch),
 angularDeviation=Math.atan(r*maxB/Math.sqrt(Rmin**2-r**2))+rounding/(Rmin-r),angularStep=W/N,
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
let minimumDeterminant=Infinity,leaves=0,maxDepth=0,maximumDegreeError=0,maximumCoordinateError=0;const failures=[];
const nominalSpan=(span[0]+span[1])/2;
model.setState({lifts:[p.span-nominalSpan,p.span-nominalSpan]});
for(const c of unique){
 const mid=(span[0]+span[1])/2,nominal=boxAt(mid,mid,c);
 const triangles=c.triangles.map(ids=>{
  const v=ids.map(i=>c.vertices[i].map(a=>evaluate(a,nominal))),value=det(...v)[0];
  return value>0?ids:[ids[0],ids[2],ids[1]];
 });
 // Match the proof's local coordinates and outward triangles to the actual
 // indexed wire. Internal cell caps are proof surfaces; side faces must
 // have exactly the renderer's winding, not an independently chosen one.
 const recipe=coil.geometry.userData.coil,positions=coil.geometry.attributes.position,index=coil.geometry.index,
  theta=Math.PI-W*(c.i+.5)/N,ct=Math.cos(theta),st=Math.sin(theta),
  centerY=recipe.bottom+r+nominalSpan*(shape(c.i/N)[0]+shape((c.i+1)/N)[0])/2;
 for(let j=0;j<2*M;j++){
  const k=c.i*M+j,dx=positions.getX(k)-spring.x,dz=positions.getZ(k)-spring.guideZ,
   actual=[ct*dx+st*dz-recipe.radius,positions.getY(k)-centerY,-st*dx+ct*dz],
   expected=c.vertices[j].map(a=>evaluate(a,nominal)[0]);
  maximumCoordinateError=Math.max(maximumCoordinateError,...actual.map((v,i)=>Math.abs(v-expected[i])));
 }
 for(let j=0;j<M;j++)for(let face=0;face<2;face++){
  const actual=[0,1,2].map(k=>index.getX(6*(c.i*M+j)+3*face+k)-c.i*M);
  assert.deepEqual(actual,triangles[4*j+face]);
 }
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
    expand=(v,e)=>[v[0]-e,v[1]+e],
    av=a.map(v=>expand(evaluate(v,box),rounding)),
    bv=b.map((v,i)=>expand(evaluate(diff(v,a[i]),box),2*rounding)),
    dv=d.map((v,i)=>expand(evaluate(diff(v,a[i]),box),2*rounding));
   minimum=Math.min(minimum,det(av,bv,dv)[0]);
  }
  if(minimum<=1e-10&&depth<14){const mid=(lo+hi)/2;check(lo,mid,depth+1);check(mid,hi,depth+1);return;}
  leaves++;maxDepth=Math.max(maxDepth,depth);minimumDeterminant=Math.min(minimumDeterminant,minimum);
  if(minimum<=1e-10)failures.push({cell:c.i,lo,hi,minimum});
 };check(...span);
}
// Actual Float32 triangles stay within r + centerline chord error of the
// analytic centerline. Bound every cell pair whose start indices differ by
// more than half a turn, over the complete compression range.
const partition = 1024, chordError = Math.hypot(W*W*Rmax, span[1]*1.5/ease/(1-ease))/(8*N*N),
 tubeRadius = r + chordError + rounding;
let nonlocalMargin = Infinity, nonlocalWitness = null, nonlocalPairs = 0;
for(let i=0;i<partition;i++)for(let j=i+partition/(2*p.turns)+1;j<partition;j++){
 const lo=(j-i-1)/partition, hi=(j-i+1)/partition,
 sine=Math.ceil(lo*p.turns)<=Math.floor(hi*p.turns)?0:Math.min(Math.abs(Math.sin(Math.PI*p.turns*lo)),Math.abs(Math.sin(Math.PI*p.turns*hi))),
 radial=2*Rmin*sine, vertical=span[0]*(shape(j/partition)[0]-shape((i+1)/partition)[0]),
 margin=Math.hypot(radial,vertical)-2*tubeRadius;
 nonlocalPairs++;
 if(margin<nonlocalMargin){nonlocalMargin=margin;nonlocalWitness={i,j,radial,vertical};}
}
const passed=nonadjacentWedgeMargin>0&&adjacentPlaneMargin>0&&failures.length===0&&nonlocalMargin>0,
 report={movement:83,status:"continuous-finite-coil-self-clearance",productionChanged:false,mechanicsPassed:false,passed,span,rounding,radii:[Rmin,Rmax],angularDeviation,angularStep,nonadjacentWedgeMargin,adjacentPlaneMargin,
 nonlocal:{partition,pairs:nonlocalPairs,chordError,tubeRadius,minimumMargin:nonlocalMargin,witness:nonlocalWitness},
 uniqueCellShapes:unique.length,cellIntervalLeaves:leaves,maxDepth,minimumDeterminant,maximumDegreeError,maximumCoordinateError,failures,
 argument:['Nonadjacent cells with start indices at most half a turn apart have disjoint polar-angle wedges throughout compression.',
 'Adjacent cells lie on opposite sides of their shared section plane; the bound includes a 1e-6 rounding allowance.',
 'Interval determinants keep every closed-cell triangle oriented relative to its interior chord point throughout the span range; triangulated cells retain the source mesh winding.',
 'The nonlocal tube bound covers cell pairs whose start indices are more than half a turn apart. Combined, these address every cell pair.'],
 qualification:'Continuous bounds cover all four identical finite spring wires over the full guide travel. Coordinate intervals include Float32 rounding. Local orientation, adjacent section planes and nonlocal tube separation exclude wire self-contact; spring material stress and guide loads remain unqualified.'};

// Confirm the rendered wires remain closed and outward oriented at travel
// extremes and interior spans. Every spring must use the same wire recipe.
const topology = [];
for(let sample=0;sample<=12;sample++){
 const lift=-.06+.24*sample/12;
 model.setState({lifts:[lift,lift]});
 for(const spring of model.root.userData.springs){
  const geometry=spring.coil.geometry, positions=geometry.attributes.position, normals=geometry.attributes.normal,
   index=geometry.index, recipe=geometry.userData.coil, winding=new Map();
  for(const key of ['turns','segments','sides','wireRadius','referenceLength'])assert.equal(recipe[key],p[key]);
  let volume=0,degenerate=0,wrongNormals=0;
  for(let i=0;i<index.count;i+=3){
   const ids=[0,1,2].map(j=>index.getX(i+j)),v=ids.map(j=>new THREE.Vector3().fromBufferAttribute(positions,j)),
    face=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));
   volume+=v[0].dot(v[1].clone().cross(v[2]))/6;
   if(face.lengthSq()<1e-22)degenerate++;
   if(face.dot(ids.reduce((sum,j)=>sum.add(new THREE.Vector3().fromBufferAttribute(normals,j)),new THREE.Vector3()))<=0)wrongNormals++;
   const keys=v.map(q=>q.toArray().join(','));
   for(let j=0;j<3;j++){
    const a=keys[j],b=keys[(j+1)%3],key=a<b?a+'/'+b:b+'/'+a,e=winding.get(key)??{count:0,orientation:0};
    e.count++;e.orientation+=a<b?1:-1;winding.set(key,e);
   }
  }
  const unmatched=[...winding.values()].filter(e=>e.count!==2||e.orientation!==0).length;
  topology.push({family:spring.family,lift,volume,degenerate,wrongNormals,unmatched});
 }
}
report.topology=topology;
report.passed&&=maximumCoordinateError<=rounding&&topology.every(v=>v.volume>0&&!v.degenerate&&!v.wrongNormals&&!v.unmatched);
const prefix=process.env.PROBE_PREFIX??'artifacts/review/083-coil-travel-bounds',
 files=['scripts/check-spring-sector-coils.mjs','scripts/lib/spring-rack-coil.mjs','scripts/lib/spring-sector-candidate.mjs',
 'scripts/lib/spring-sector-source.mjs','scripts/lib/spring-sector-linkage.mjs','src/simulation/finite-plate-geometry.js',
 'src/simulation/clutch-section-geometry.js','src/simulation/primitives.js'];
report.sources=files.map((file,i)=>{
 const archive=prefix+'-source-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);
 return{file,archive,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
});
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({...report,sources:undefined,topology:undefined});if(!report.passed)process.exitCode=1;
