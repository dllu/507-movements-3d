import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchCandidate,THREE} from './lib/weighted-clutch-candidate.mjs';
import {toWeightedClutchWorld} from './lib/weighted-clutch-linkage.mjs';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-open-rim-geometry',
  frozen=readStudyReport('artifacts/review/086-integrated-verified-source-hashes.json'),
  verify=()=>{for(const[file,sha]of Object.entries(frozen))assert.equal(hashStudyFile(file),sha,file);};
verify();
const sources=freezeStudySources(['scripts/probe-weighted-clutch-geometry.mjs','scripts/lib/weighted-clutch-candidate.mjs',
  'scripts/lib/weighted-clutch-source.mjs','scripts/lib/weighted-clutch-linkage.mjs','scripts/lib/study-report-io.mjs',
  'src/simulation/bevel-geometry.js','src/simulation/jaw-clutch-geometry.js','src/simulation/finite-plate-geometry.js',
  'src/simulation/conforming-plate-mesh.js','src/simulation/clutch-section-geometry.js','src/simulation/primitives.js'],prefix),
  model=makeWeightedClutchCandidate(),u=model.root.userData,cache=new Map(),rows=[];

function inspect(g){
  const p=g.attributes.position,n=g.attributes.normal,index=g.index,edges=new Map(),parents=[];
  let volume=0,degenerate=0,wrongNormals=0,minimumNormalDot=1,nonfinite=0;
  const find=x=>{while(parents[x]!==x){parents[x]=parents[parents[x]];x=parents[x];}return x;};
  for(let i=0;i<(index?.count??p.count);i+=3){
    const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j),[a,b,c]=ids.map(j=>new THREE.Vector3().fromBufferAttribute(p,j)),
      cross=b.clone().sub(a).cross(c.clone().sub(a));
    if(![...a.toArray(),...b.toArray(),...c.toArray()].every(Number.isFinite)){nonfinite++;continue;}
    if(cross.lengthSq()<1e-22){degenerate++;continue;}
    const triangle=parents.length;parents.push(triangle);volume+=a.dot(b.clone().cross(c))/6;
    const normal=ids.reduce((s,j)=>s.add(new THREE.Vector3().fromBufferAttribute(n,j)),new THREE.Vector3()).normalize(),
      normalDot=cross.normalize().dot(normal);minimumNormalDot=Math.min(minimumNormalDot,normalDot);if(!(normalDot>=0))wrongNormals++;
    const keys=[a,b,c].map(v=>v.toArray().join(','));
    for(let j=0;j<3;j++){
      const from=keys[j],to=keys[(j+1)%3],key=from<to?from+'/'+to:to+'/'+from,
        edge=edges.get(key)??{count:0,orientation:0,triangle};
      parents[find(triangle)]=find(edge.triangle);edge.count++;edge.orientation+=from<to?1:-1;edges.set(key,edge);
    }
  }
  const unmatched=[...edges].filter(([,v])=>v.count!==2||v.orientation!==0);
  return{triangles:parents.length,components:new Set(parents.map((_,i)=>find(i))).size,volume,degenerate,wrongNormals,nonfinite,
    minimumNormalDot,unmatchedEdges:unmatched.length,examples:unmatched.slice(0,3)};
}
for(const[name,mesh]of Object.entries(u.parts)){
  if(!cache.has(mesh.geometry))cache.set(mesh.geometry,inspect(mesh.geometry));
  rows.push({name,...cache.get(mesh.geometry)});
}
const issues=rows.filter(r=>r.components!==1||r.volume<=0||r.degenerate||r.wrongNormals||r.nonfinite||r.unmatchedEdges);

// Use the actual finite front-cap triangles of G, rather than an infinite
// lever line. A separating radial gap excludes contact at every E angle.
const g=u.parts.bellCrankG.geometry,p=g.attributes.position,index=g.index;
g.computeBoundingBox();const z=g.boundingBox.max.z,triangles=[];
for(let i=0;i<(index?.count??p.count);i+=3){
  const vertices=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+j):i+j));
  if(vertices.every(v=>v.z===z))triangles.push(new THREE.Triangle(...vertices));
}
assert(triangles.length>0);
const center=toWeightedClutchWorld(u.source.wheelE.hub.center),orbit=Math.hypot(...u.geometry.stud),
  studPosition=u.parts.reversingStud.geometry.attributes.position;
let studEnvelope=0;
for(let i=0;i<studPosition.count;i++)studEnvelope=Math.max(studEnvelope,Math.hypot(studPosition.getX(i),studPosition.getY(i)));
const point=new THREE.Vector3(),nearest=new THREE.Vector3();
function reach(angle){
  const state=model.setState({leverAngle:angle}),inverse=u.blocks.bell.matrixWorld.clone().invert();
  point.set(...center,0).applyMatrix4(inverse);point.z=z;
  let minimum=Infinity,maximum=0;
  for(const t of triangles){minimum=Math.min(minimum,t.closestPointToPoint(point,nearest).distanceTo(point));
    for(const v of [t.a,t.b,t.c])maximum=Math.max(maximum,v.distanceTo(point));}
  const annularGap=Math.max(minimum-(orbit+studEnvelope),orbit-studEnvelope-maximum);
  return{leverDegrees:angle*180/Math.PI,weightDegrees:state.weightAngle*180/Math.PI,bellDegrees:state.bellAngle*180/Math.PI,
    minimumRadius:minimum,maximumRadius:maximum,annularGap,excludedAtEveryWheelAngle:annularGap>1e-6};
}
const overCenter=u.linkage.parameters.overCenterAngle,reachRows=[0,10,20,30,40,overCenter*180/Math.PI,45,50,60,70,80,2*overCenter*180/Math.PI]
  .map(degrees=>reach(degrees*Math.PI/180));
let lo=overCenter,hi=2*overCenter;
assert(reach(lo).annularGap<0&&reach(hi).annularGap>0);
for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(reach(mid).annularGap>0)hi=mid;else lo=mid;}
const reachLimit=reach((lo+hi)/2);
let maximumRodLengthError=0,maximumPinCenterError=0,maximumOutputAxisError=0;
const jointRows=[];
for(let i=0;i<=360;i++){
  const state=model.setState({leverAngle:2*overCenter*i/360,outputAngle:2*Math.PI*i/360}),
    a=new THREE.Vector3(...u.linkage.parameters.armF,0).applyMatrix4(u.blocks.lever.matrixWorld),
    b=new THREE.Vector3(...u.linkage.parameters.armG,0).applyMatrix4(u.blocks.bell.matrixWorld),
    rodA=new THREE.Vector3(0,0,0).applyMatrix4(u.blocks.rod.matrixWorld),
    rodB=new THREE.Vector3(u.linkage.parameters.rodLength,0,0).applyMatrix4(u.blocks.rod.matrixWorld),
    lengthError=Math.abs(a.distanceTo(b)-u.linkage.parameters.rodLength),pinError=Math.max(a.distanceTo(rodA),b.distanceTo(rodB)),
    axisError=new THREE.Vector3(0,0,1).transformDirection(u.blocks.shaft.matrixWorld).distanceTo(new THREE.Vector3(1,0,0));
  maximumRodLengthError=Math.max(maximumRodLengthError,lengthError);maximumPinCenterError=Math.max(maximumPinCenterError,pinError);
  maximumOutputAxisError=Math.max(maximumOutputAxisError,axisError);jointRows.push({leverAngle:state.leverAngle,lengthError,pinError,axisError});
}
verify();verifyStudySources(sources);
const report={movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,sources,
  topology:{solids:rows.length,uniqueGeometries:cache.size,rows,issues,passed:issues.length===0},
  linkage:{maximumRodLengthError,maximumPinCenterError,maximumOutputAxisError,jointRows},
  studReach:{triangles:triangles.length,orbit,studEnvelope,reachRows,reachLimit,
    qualification:'Distance to actual G cap triangles excludes contact with the stud outer envelope at every E angle whenever annularGap is positive. Negative gap means only radial reach is possible. This is not a contact trajectory or a force/coupling model.'},
  qualification:'Closed Float32 solids and fixed-length joint geometry are screened independently of the unresolved reversal mechanism. This report does not qualify same-family attachments, all independent clearances, bevel/jaw working contact, gravity, lost motion or clutch actuation.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({solids:rows.length,uniqueGeometries:cache.size,issues,maximumRodLengthError,maximumPinCenterError,maximumOutputAxisError,reachLimit,reachRows});
assert(maximumRodLengthError<1e-12&&maximumPinCenterError<1e-12&&maximumOutputAxisError<1e-12);
if(issues.length)process.exitCode=1;
