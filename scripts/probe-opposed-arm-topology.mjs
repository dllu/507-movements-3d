import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {makeOpposedArmCandidate,rigidFamilyMass} from './lib/opposed-arm-candidate.mjs';
const options=JSON.parse(process.env.GEOMETRY_OPTIONS||'{}'),model=makeOpposedArmCandidate(options),u=model.root.userData,rows=[];
for(const [name,mesh]of Object.entries(u.parts)){
 const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,index=g.index,edges=new Map(),parents=[];
 let volume=0,degenerate=0,wrongNormals=0,minimumNormalDot=1;
 const find=x=>{while(parents[x]!==x){parents[x]=parents[parents[x]];x=parents[x];}return x;};
 for(let i=0;i<(index?.count??p.count);i+=3){
  const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j),[a,b,c]=ids.map(j=>new THREE.Vector3().fromBufferAttribute(p,j)),cross=b.clone().sub(a).cross(c.clone().sub(a));
  if(cross.lengthSq()<1e-22){degenerate++;continue;}
  const triangle=parents.length;parents.push(triangle);volume+=a.dot(b.clone().cross(c))/6;
  const normal=ids.reduce((s,j)=>s.add(new THREE.Vector3().fromBufferAttribute(n,j)),new THREE.Vector3()).normalize(),normalDot=cross.normalize().dot(normal);
  minimumNormalDot=Math.min(minimumNormalDot,normalDot);if(normalDot<0)wrongNormals++;
  const keys=[a,b,c].map(v=>v.toArray().join(','));
  for(let j=0;j<3;j++){
   const from=keys[j],to=keys[(j+1)%3],key=from<to?from+'/'+to:to+'/'+from,edge=edges.get(key)??{count:0,orientation:0,triangle};
   parents[find(triangle)]=find(edge.triangle);edge.count++;edge.orientation+=from<to?1:-1;edges.set(key,edge);
  }
 }
 const unmatched=[...edges].filter(([,v])=>v.count!==2||v.orientation!==0);
 rows.push({name,triangles:parents.length,components:new Set(parents.map((_,i)=>find(i))).size,volume,degenerate,wrongNormals,minimumNormalDot,unmatchedEdges:unmatched.length,examples:unmatched.slice(0,3)});
}
const closure=[];
for(let i=0;i<=1000;i++){
 const sliderX=u.geometry.sourceSlider[0]+u.geometry.stroke*(2*i/1000-1),state=u.setState({sliderX});
 for(const key of ['upper','lower']){
  const arm=state.arms[key],a=u.geometry.arms[key],rodEnd=new THREE.Vector3(a.rodLength,0,0).applyMatrix4(u.blocks[key+'Rod'].matrixWorld),
   pivot=new THREE.Vector3(...a.pivot,0).applyMatrix4(u.blocks[key+'Arm'].matrixWorld);
  closure.push({sliderX,key,rodError:rodEnd.distanceTo(new THREE.Vector3(...state.slider,0)),pivotError:Math.hypot(pivot.x-arm.pivot[0],pivot.y-arm.pivot[1]),radiusError:Math.abs(Math.hypot(...arm.joint)-a.jointRadius)});
 }
}
const issues=rows.filter(r=>r.components!==1||r.volume<=0||r.degenerate||r.wrongNormals||r.unmatchedEdges),maximumClosure=Object.fromEntries(['rodError','pivotError','radiusError'].map(key=>[key,Math.max(...closure.map(r=>r[key]))]));
if(Object.values(maximumClosure).some(v=>v>1e-12))issues.push({closure:maximumClosure});
// Independent analytic box tensors, with translation and rotation, exercise
// diagonal and product-of-inertia terms of the tetrahedral integration.
const box=new THREE.Mesh(new THREE.BoxGeometry(.3,.5,.7));box.position.set(.12,-.31,.28);box.rotation.set(.23,-.42,.18);box.updateMatrix();
const actual=rigidFamilyMass({box},{box:'box'},'box'),V=.3*.5*.7,c=box.position.toArray(),R=new THREE.Matrix3().setFromMatrix4(box.matrix).elements,
 D=[V*(.5**2+.7**2)/12,V*(.3**2+.7**2)/12,V*(.3**2+.5**2)/12],central=Array.from({length:3},(_,i)=>Array.from({length:3},(_,j)=>D.reduce((s,d,k)=>s+R[3*k+i]*d*R[3*k+j],0))),
 expected=central.map((row,i)=>row.map((v,j)=>v+V*((i===j?c.reduce((s,x)=>s+x*x,0):0)-c[i]*c[j]))),
 massErrors={volume:Math.abs(actual.volume-V),centroid:Math.max(...actual.centroid.map((v,i)=>Math.abs(v-c[i]))),inertia:Math.max(...actual.inertia.flatMap((row,i)=>row.map((v,j)=>Math.abs(v-expected[i][j]))))};
if(Object.values(massErrors).some(v=>v>1e-8))issues.push({massErrors});
const sources=[];
for(const file of ['scripts/probe-opposed-arm-topology.mjs','scripts/lib/opposed-arm-candidate.mjs','src/simulation/finite-plate-geometry.js'])sources.push({file,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
const report={movement:79,status:'isolated-crown-geometry-check',productionChanged:false,mechanicsPassed:false,options,rows,issues,maximumClosure,closurePoses:1001,massErrors,masses:u.masses,sources,
 qualification:'Closed component and positive-volume checks on every rendered Float32 mesh; exact fixed-length rod closure across a slider sweep; 3D mass tensor checked against a transformed box. Contact, finite joint clearance, pawl return and output dynamics remain unverified.'};
await writeFile(process.env.PROBE_OUTPUT??'artifacts/review/079-first-candidate-topology.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({solids:rows.length,issues,maximumClosure,massErrors,masses:u.masses});if(issues.length)process.exitCode=1;
