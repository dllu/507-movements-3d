import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makePumpCatchCompleteCandidate,THREE} from './lib/pump-catch-complete-candidate.mjs';
import {pumpCatchCompleteSources} from './lib/pump-catch-complete-sources.mjs';
import {surfaceTriangles} from '../tests/helpers/solid-surface.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const input=process.env.PROBE_INPUT??'artifacts/review/086-first-compressed-motion.json',hardwareFile=process.env.PROBE_HARDWARE??'artifacts/review/086-refined-hardware-bounds.json',
  prefix=process.env.PROBE_PREFIX??'artifacts/review/086-first-rope-bounds',data=readStudyReport(input),hardware=readStudyReport(hardwareFile);
assert(data.passed&&hardware.passed);verifyStudySources(data.sources);verifyStudySources(hardware.sources);
const sources=freezeStudySources([input,hardwareFile,'scripts/check-pump-catch-rope-bounds.mjs',...pumpCatchCompleteSources,'tests/helpers/solid-surface.mjs'],prefix),
  model=makePumpCatchCompleteCandidate(),u=model.root.userData,{radius:R,ropeRadius:r,ropeLength:L,z}=u.completeHardware,
  tolerance=1e-6,meshRounding=5e-7,arithmeticGuard=1e-10,cut=-.85,tail=.2,threshold=1e-8,rows=data.rows,
  qRange=Array.from({length:3},()=>[Infinity,-Infinity]),H=q=>q[2]+R*q[0];
// Isolated negative controls fill real openings without enlarging the body.
// Their unchanged outer bounds remain covered by the rigid motion certificate.
const fixture=process.env.PROBE_FIXTURE||null,fixtureParts={
  'solid-plinth':'basePlinth','blocked-crossbar':'pumpGuideCrossbar','closed-ferrule':'ropeLoadFerrule',
};
if(fixture){
  assert(Object.hasOwn(fixtureParts,fixture),'Unknown rope-bound fixture');
  const mesh=u.parts[fixtureParts[fixture]];mesh.geometry.computeBoundingBox();
  const box=mesh.geometry.boundingBox.clone(),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  mesh.geometry.dispose();mesh.geometry=new THREE.BoxGeometry(size.x,size.y,size.z).translate(center.x,center.y,center.z);
  mesh.geometry.computeBoundingBox();const filled=mesh.geometry.boundingBox;
  for(const key of ['x','y','z']){
    assert(filled.min[key]>=box.min[key]-tolerance&&filled.max[key]<=box.max[key]+tolerance,'Fixture must retain the certified outer envelope');
  }
}
let maximumH=-Infinity,minimumH=Infinity,slackHeightMax=-Infinity;
for(const row of rows){
  for(let k=0;k<3;k++){assert(row.q[k]>=hardware.range[k][0]-1e-12&&row.q[k]<=hardware.range[k][1]+1e-12);qRange[k][0]=Math.min(qRange[k][0],row.q[k]);qRange[k][1]=Math.max(qRange[k][1],row.q[k]);}
  maximumH=Math.max(maximumH,H(row.q));minimumH=Math.min(minimumH,H(row.q));
}
assert(qRange[0][0]>-Math.PI&&qRange[0][1]<.25&&qRange[2][0]>-1e-10&&minimumH>-1e-7&&qRange[2][1]-L< -R);
// H is linear on every playback interval. For left winding, available bow
// length equals H. For an unwound clamp, the lead-in length is at least its
// vertical drop, so available bow length <= y+R*sin(theta) <= H.
for(let i=1;i<rows.length;i++){
  const a=rows[i-1].q,b=rows[i].q,h0=H(a),h1=H(b),level=threshold-arithmeticGuard;
  if(Math.max(h0,h1)<level)continue;
  const values=[];if(h0>=level)values.push(a[2]);if(h1>=level)values.push(b[2]);
  if((h0<level)!==(h1<level)){const f=(level-h0)/(h1-h0);values.push(a[2]+f*(b[2]-a[2]));}
  slackHeightMax=Math.max(slackHeightMax,...values);
}
const Dmax=L+cut-tail-qRange[2][0],Dmin=L+cut-tail-slackHeightMax-arithmeticGuard;
assert(Dmin>0&&Dmax<4&&Number.isFinite(slackHeightMax));
// Bound the actual positive-weight Simpson sum used by the mesh generator.
// Each term sqrt(D²+c²)-D decreases as D grows. Lower sine/hypot guards and
// a conservative Dmax therefore give an upper bound for its solved amplitude.
function extraLower(A){
  let sum=0;for(let i=1;i<256;i++){
    const sine=Math.max(0,Math.abs(Math.sin(2*Math.PI*i/256))-1e-12),term=Math.max(0,Math.hypot(Dmax,A*Math.PI*sine)-Dmax-1e-12);
    sum+=(i%2?4:2)*term;
  }return sum/(3*256)-arithmeticGuard;
}
function amplitudeBound(extra){let low=0,high=1;assert(extraLower(high)>extra+arithmeticGuard);
  for(let i=0;i<48;i++){const middle=(low+high)/2;if(extraLower(middle)>extra+arithmeticGuard)high=middle;else low=middle;}
  return high+arithmeticGuard;
}
const amplitudeMax=amplitudeBound(maximumH),quietAmplitudeMax=amplitudeBound(threshold),innerRadius=(R-r)*Math.cos(.003/2)-meshRounding,
  upper={name:'winding-lead-and-upper-straight',min:[-R-r-meshRounding,cut-r-meshRounding,z-r-meshRounding],max:[R+r+meshRounding,R+r+meshRounding,z+r+meshRounding],radialMin:innerRadius},
  quiet={name:'taut-bow-and-all-end-straights',min:[-R-r-meshRounding,qRange[2][0]-L-r-meshRounding,z-r-meshRounding],
    max:[-R+r+meshRounding,cut+r+meshRounding,z+quietAmplitudeMax+r+meshRounding]},regions=[upper,quiet];
const radialBoxMin=b=>Math.hypot(...[0,1].map(k=>b.min[k]>0?b.min[k]:b.max[k]<0?-b.max[k]:0));quiet.radialMin=radialBoxMin(quiet);
for(let i=0;i<128;i++){
  const lo=i/128,hi=(i+1)/128,sineSquare=lo<=.5&&hi>=.5?1:Math.max(Math.sin(Math.PI*lo)**2,Math.sin(Math.PI*hi)**2),
    region={name:'slack-bow-'+i,min:[-R-r-meshRounding,cut-Dmax*hi-r-meshRounding,z-r-meshRounding],
      max:[-R+r+meshRounding,cut-Dmin*lo+r+meshRounding,z+amplitudeMax*sineSquare+r+meshRounding]};
  region.radialMin=radialBoxMin(region);regions.push(region);
}
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1],cross=(a,b)=>a[0]*b[1]-a[1]*b[0],sub=(a,b)=>a.map((v,k)=>v-b[k]),
  parts=new Map(Object.entries(u.parts).filter(([name])=>name!=='pumpRope').map(([name,mesh])=>{
    const triangles=surfaceTriangles(mesh.geometry).map(t=>[t.a,t.b,t.c].map(p=>p.applyMatrix4(mesh.matrixWorld).toArray())),vertices=triangles.flat(),
      bound=hardware.bodies.find(p=>p.name===name),projection=[],seen=new Set();
    for(const t of triangles){const p=t.map(v=>[v[0],v[2]]);if(Math.abs(cross(sub(p[1],p[0]),sub(p[2],p[0])))<1e-15)continue;
      const key=p.map(v=>v.join(',')).sort().join('|');if(seen.has(key))continue;seen.add(key);projection.push(p);}
    return[name,{name,mesh,triangles,vertices,bound,projection,radialMax:Math.max(...vertices.map(p=>Math.hypot(p[0],p[1])))}];
  }));
function axisMargin(a,b){return Math.max(...[0,1,2].map(k=>Math.max(a.min[k]-b.max[k],b.min[k]-a.max[k])))-arithmeticGuard;}
function xzMargin(region,triangle){
  const center=[(region.min[0]+region.max[0])/2,(region.min[2]+region.max[2])/2],half=[(region.max[0]-region.min[0])/2,(region.max[2]-region.min[2])/2];let best=-Infinity;
  const normals=triangle.map((p,i)=>{const d=sub(triangle[(i+1)%3],p),n=Math.hypot(...d);return[-d[1]/n,d[0]/n];});
  for(const n of [[1,0],[0,1],...normals]){const c=dot(center,n),width=half.reduce((s,v,k)=>s+v*Math.abs(n[k]),0),p=triangle.map(p=>dot(p,n));
    best=Math.max(best,c-width-Math.max(...p),Math.min(...p)-c-width);}
  return best-arithmeticGuard;
}
function clippedRadius(part,low){
  let maximum=0,vertices=0;
  for(const t of part.triangles){const points=[];for(let i=0;i<3;i++){
    const a=t[i],b=t[(i+1)%3],da=a[2]-low,db=b[2]-low;if(da>=0)points.push(a);
    if((da>=0)!==(db>=0)){const f=da/(da-db);points.push(a.map((v,k)=>v+f*(b[k]-v)));}}
    for(const p of points){vertices++;maximum=Math.max(maximum,Math.hypot(p[0],p[1]));}
  }assert(vertices);return maximum+arithmeticGuard;
}
function radialMinimumXZ(part){
  let minimum=Infinity;
  for(const t of part.projection){const p=t.map(v=>[v[0]+R,v[1]-z]),area=cross(sub(p[1],p[0]),sub(p[2],p[0])),signs=p.map((v,i)=>cross(v,p[(i+1)%3]));
    if(Math.abs(area)>1e-20&&(signs.every(v=>v>=0)||signs.every(v=>v<=0)))return 0;
    for(let i=0;i<3;i++){const a=p[i],d=sub(p[(i+1)%3],a),square=dot(d,d),f=square?Math.max(0,Math.min(1,-dot(a,d)/square)):0;minimum=Math.min(minimum,Math.hypot(...a.map((v,k)=>v+f*d[k])));}
  }return minimum;
}
const theta=qRange[0][1],s=Math.sin(theta),c=Math.cos(theta),controlDrop=Math.min(1/12,c/6-1/12-R*s*(1-c),c/12),
  transverseRate=6*(R*(1-c)+s/6)+3*s/12,clampLeadCoefficient=3*controlDrop-r*transverseRate/(3*controlDrop),
  clamp=parts.get('wheelRopeClamp'),clampMinY=Math.min(...clamp.vertices.map(p=>p[1])),clampMaxX=Math.max(...clamp.vertices.map(p=>p[0])),
  positiveStraightY=R*s*(1-c)-.25*c+r*s,
  clampProof={controlDrop,transverseRate,clampLeadCoefficient,clampMinY,clampMaxX,positiveStraightY,
    passed:controlDrop>0&&clampLeadCoefficient>0&&clampMinY>=0&&clampMaxX< -r&&positiveStraightY<0,
    qualification:'Wrapped tube vertices lie at nonpositive local Y for arc < pi. In the unwound cubic, center Y <= -3*controlDrop*t while the normal-section Y offset <= r*transverseRate*t/(3*controlDrop). Straight continuation has nonpositive Y for wheel angles >= -pi/2; more negative angles place it at X >= -r, outside the clamp. Bow regions clear the clamp by their global boxes. The omitted sub-1e-7 wrap is covered by the mesh tolerance.'};
assert(clampProof.passed);
const results=[],failures=[];
for(const [name,part]of parts){
  if(['pumpCrosshead','pumpOutputRod','ropeLoadFerrule'].includes(name)){
    const top=Math.max(...part.vertices.map(p=>p[1]+L));let margin,method;
    if(name==='ropeLoadFerrule'){
      margin=Math.min(radialMinimumXZ(part)-r-meshRounding,tail-r-top-meshRounding);method='straight-end-inside-ferrule-bore';
    }else {margin=-top-meshRounding;method='rope-entirely-above-translating-body';}
    const passed=margin>=-tolerance;results.push({name,passed,method,margin});if(!passed)failures.push({name,method,margin});continue;
  }
  const checks=[];
  for(const region of regions){
    let margin=axisMargin(region,part.bound.swept),method='whole-motion-box';
    if(margin< -tolerance&&['wheel','cam','fixed','band'].includes(part.bound.family)){
      margin=region.radialMin-part.radialMax-arithmeticGuard;method='radial-separation';
    }
    if(margin< -tolerance&&name==='ropeWindingRim'){
      margin=region.radialMin-clippedRadius(part,region.min[2])-arithmeticGuard;method='winding-bed-depth-slab';
    }
    if(margin< -tolerance&&name==='wheelRopeClamp'&&region===upper){margin=-meshRounding-R*1e-7;method='attached-clamp-tangent-halfspaces';}
    if(margin< -tolerance&&part.bound.family==='fixed'){
      margin=Infinity;for(const t of part.projection){margin=Math.min(margin,xzMargin(region,t));if(margin< -tolerance)break;}method='fixed-xz-projection';
    }
    const passed=margin>=-tolerance;checks.push({region:region.name,passed,method,margin});if(!passed)failures.push({name,region:region.name,method,margin});
  }
  results.push({name,passed:checks.every(c=>c.passed),checks});
}
verifyStudySources(sources);const report={movement:86,status:'continuous-deforming-rope-hardware-bounds',passed:!failures.length,input,hardwareFile,fixture,
  tolerance,meshRounding,arithmeticGuard,qRange,maximumH,minimumH,threshold,slackHeightMax,Dmin,Dmax,amplitudeMax,quietAmplitudeMax,innerRadius,clampProof,
  regions,results,failures,sources,productionChanged:false,mechanicsPassed:false,candidateIntegrated:false,
  qualification:'All playback intervals are covered by linear H bounds, a monotone upper bound for the actual amplitude solve, and 128 bow slabs aligned with the 512 rendered section intervals. Quiet regions cover taut bows and every end straight. Whole-motion body boxes, invariant radial ranges, actual fixed XZ triangle projections, the winding depth slab, clamp halfspaces and finite ferrule/rod geometry check all 41 other parts. This concerns the massless display rope and its hardware clearances; self-intersection and continuum dynamics require separate consideration.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,regions:regions.length,results:results.reduce((s,p)=>(s[p.passed?'passed':'failed']++,s),{passed:0,failed:0}),sources:undefined});if(!report.passed)process.exitCode=1;
