import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeWiperStampCandidate} from './lib/wiper-stamp-candidate.mjs';
import {renderedPrism} from './lib/crossed-rack-mesh-prisms.mjs';
import {polygonClipping as clip,poly} from '../src/simulation/finite-plate-geometry.js';
import {readStudyReport,verifyStudySources,freezeStudySources} from './lib/study-report-io.mjs';

const input=process.env.PROBE_INPUT??'artifacts/review/085-first-playback-data.json';
const primaryFile=process.env.PROBE_PRIMARY??'artifacts/review/085-first-playback-bound.json';
const prefix=process.env.PROBE_PREFIX??'artifacts/review/085-first-hardware-bound';
const data=readStudyReport(input),primary=readStudyReport(primaryFile),topology=readStudyReport('artifacts/review/085-refined-candidate-surfaces.json');
verifyStudySources(primary.sources);verifyStudySources(topology.sources);assert(primary.passed&&topology.passed);assert.equal(primary.input,input);
assert.equal(primary.counts.intervals,data.knots.length-1);assert.equal(topology.topology.length,15);assert(topology.topology.every(t=>t.closed));
const model=makeWiperStampCandidate(),u=model.root.userData,names=Object.keys(u.parts),pad=1e-7,roundoff=1e-12,boxes={},points={};
for(const name of names) {
  const mesh=u.parts[name],p=mesh.geometry.attributes.position;
  const a=Array.from({length:p.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).toArray());points[name]=a;
  const low=[0,1,2].map(k=>Math.min(...a.map(p=>p[k]))),high=[0,1,2].map(k=>Math.max(...a.map(p=>p[k])));
  if(u.families[name]==='stamp'){low[1]+=data.range[0];high[1]+=data.range[1];}
  if(u.families[name]==='cam'){const r=Math.max(...a.map(p=>Math.hypot(p[0],p[1])));low[0]=low[1]=-r;high[0]=high[1]=r;}
  boxes[name]={low,high};
}
const rodBox=boxes.rectangularRodA;
const expandedRod=poly([[rodBox.low[0]-pad,-rodBox.low[2]+pad],[rodBox.high[0]+pad,-rodBox.low[2]+pad],
  [rodBox.high[0]+pad,-rodBox.high[2]-pad],[rodBox.low[0]-pad,-rodBox.high[2]-pad]]);
const guides={};
for(const name of ['boredGuide0','boredGuide1']) {
  // A coordinate permutation preserves every actual Float32 position in
  // doubles. It exposes the guide's X,-Z cap with extrusion along Y.
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float64Array(points[name].flatMap(([x,y,z])=>[x,-z,y])),3));
  const prism=renderedPrism(geometry),footprint=clip.union(...prism.triangles.map(t=>poly(t.points))),intersection=clip.intersection(footprint,expandedRod);
  assert.equal(intersection.length,0);guides[name]={validation:prism.validation,expandedRod,intersection,pad};geometry.dispose();
}
const sub=(a,b)=>a.map((v,k)=>v-b[k]),cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
function minimumRadius(triangle) {
  if(triangle.every((a,i)=>cross(sub(triangle[(i+1)%3],a),a.map(v=>-v))>=0))return 0;
  return Math.min(...triangle.map((a,i)=>{const d=sub(triangle[(i+1)%3],a),t=Math.max(0,Math.min(1,-(a[0]*d[0]+a[1]*d[1])/(d[0]**2+d[1]**2)));
    return Math.hypot(a[0]+t*d[0],a[1]+t*d[1]);}));
}
const bearing=renderedPrism(u.parts.rearBearingArm.geometry),bearingRadius=Math.min(...bearing.triangles.map(t=>minimumRadius(t.points))),
  shaftRadius=Math.max(...points.inputShaft.map(p=>Math.hypot(p[0],p[1]))),bearingMargin=bearingRadius-shaftRadius-pad;
assert(bearingMargin>0);
const pairs=[],unresolved=[];
for(const[i,a]of names.entries())for(const b of names.slice(i+1)) {
  if(u.families[a]===u.families[b])continue;
  const A=boxes[a],B=boxes[b],gaps=[0,1,2].map(k=>Math.max(A.low[k]-B.high[k],B.low[k]-A.high[k])),gap=Math.max(...gaps);
  const pair={a,b};
  if(gap>pad)pairs.push({...pair,method:'whole-motion separating axis',axis:gaps.indexOf(gap),margin:gap-pad});
  else if(a==='twoWipers'&&b==='flatProjectionB')pairs.push({...pair,method:'continuous finite-cam projection',certificate:primaryFile,guard:primary.guard});
  else if(a==='inputShaft'&&b==='rearBearingArm')pairs.push({...pair,method:'complete bearing bore',shaftRadius,bearingRadius,margin:bearingMargin,validation:bearing.validation});
  else if(guides[a]&&b==='rectangularRodA')pairs.push({...pair,method:'empty guide-cap intersection with expanded rod',...guides[a]});
  else if(a==='flaredStampHead'&&b==='strikingBed'&&A.low[1]>=B.high[1]-roundoff)
    pairs.push({...pair,method:'nonpenetrating strike plane',axis:1,gap:A.low[1]-B.high[1],minimumTranslation:data.range[0],roundoff});
  else unresolved.push({...pair,gaps});
}
const sources=freezeStudySources([input,primaryFile,'artifacts/review/085-refined-candidate-surfaces.json','scripts/bound-wiper-stamp-hardware.mjs',
  ...primary.sources.map(s=>s.file)],prefix);
const report={movement:85,status:'complete-continuous-hardware-bounds',passed:pairs.length===68&&!unresolved.length,productionChanged:false,mechanicsPassed:false,
  candidateIntegrated:false,input,primaryFile,range:data.range,pad,boxes,pairs,unresolved,sources,
  qualification:'All 68 independently moving mesh pairs are covered over the certified playback range and every shaft angle. Bounds use complete actual mesh vertices, finite cap unions with real guide holes, a rotation-invariant bearing bore, the nonpenetrating striking plane and the primary continuous cam/B certificate. This includes bounded playback projection. Material deformation, nonideal guide loads and final rendering remain separate.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({passed:report.passed,pairs:pairs.length,methods:pairs.reduce((m,p)=>(m[p.method]=(m[p.method]??0)+1,m),{}),unresolved,bearingMargin});
if(!report.passed)process.exitCode=1;
