import fs from 'node:fs';
import assert from 'node:assert/strict';
import source from './lib/weighted-clutch-source.mjs';
import {weightedClutchFitPoints} from './lib/weighted-clutch-source-fit.mjs';
import {makeWeightedClutchKeyCandidate} from './lib/weighted-clutch-key-candidate.mjs';
import {makeWeightedClutchDistributedCandidate,THREE} from './lib/weighted-clutch-distributed-candidate.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix='artifacts/review/087-distributed-source-tradeoffs',input='artifacts/review/087-first-distributed-geometry.json',
  parent=readStudyReport(input),models={previous:makeWeightedClutchKeyCandidate(),distributed:makeWeightedClutchDistributedCandidate(parent.options)},
  sources=freezeStudySources([...parent.sources.map(s=>s.file),input,
    'scripts/check-weighted-clutch-distributed-source-tradeoffs.mjs'],prefix),rows=[];
verifyStudySources(parent.sources);
for(const[name,model]of Object.entries(models)){
  const u=model.root.userData,L=u.linkage.parameters;
  model.setCoordinates([0,u.lostMotion.parameters.shifterRight,0,0,0],0);
  const world=(mesh,local=new THREE.Vector3())=>mesh.localToWorld(local.clone()),
    upper=u.source.bell.upperEnd.map((x,i)=>(i===0?x-u.source.origin[i]:u.source.origin[i]-x)/u.source.scale-L.G[i]),
    points={F:world(u.blocks.lever),A:world(u.parts.leverRodPin),G:world(u.blocks.bell),B:world(u.parts.bellRodPin),
      upper:world(u.blocks.bell,new THREE.Vector3(...upper,0)),E:world(u.gears.E),stud:world(u.parts.reversingStud)},
    projection=Object.entries(points).map(([key,p])=>{
      const pixel=[p.x*source.scale+source.origin[0],source.origin[1]-p.y*source.scale],
        delta=pixel.map((v,i)=>v-weightedClutchFitPoints[key][i]);
      return{name:key,pixel,delta,distance:Math.hypot(...delta)};
    }),E=points.E;
  function outerRadius(mesh){
    const p=mesh.geometry.attributes.position;let radius=0;
    for(let i=0;i<p.count;i++){
      const v=world(mesh,new THREE.Vector3().fromBufferAttribute(p,i));radius=Math.max(radius,Math.hypot(v.x-E.x,v.y-E.y));
    }
    return radius*source.scale;
  }
  const wheelRadius=outerRadius(u.parts.studWheelFront),studExtent=outerRadius(u.parts.reversingStud),pinExtent=outerRadius(u.parts.reversingStudPin),
    errors=projection.map(p=>p.distance);
  rows.push({name,projection,maximum:Math.max(...errors),mean:errors.reduce((s,v)=>s+v,0)/errors.length,
    rms:Math.sqrt(errors.reduce((s,v)=>s+v*v,0)/errors.length),wheelRadius,studExtent,pinExtent,
    studOverhang:studExtent-wheelRadius,pinInsideMargin:wheelRadius-pinExtent});
}
const measuredStudInsideMargin=source.wheelE.outer.radius-Math.hypot(...source.wheelE.stud.center.map((x,i)=>x-source.wheelE.hub.center[i]))-source.wheelE.stud.radius;
assert(rows[1].maximum<rows[0].maximum&&rows[1].rms<rows[0].rms);
assert(rows[1].mean>rows[0].mean&&rows[1].studOverhang>0&&measuredStudInsideMargin>0);
verifyStudySources(sources);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
  sources,rows,measuredStudInsideMargin,candidateAccepted:false,
  qualification:'Measured rendered-vertex and landmark tradeoffs, not a source-fidelity pass. Distributing changes reduces maximum and RMS landmark error but increases the mean, and the stud now protrudes beyond E where the source drawing contains it inside the rim. The native pin still fits within the wheel radius. The next fit must include the relative stud/rim contour constraint, rather than accepting a landmark-only improvement.'},null,2)+'\n',{flag:'wx'});
console.log({rows:rows.map(({projection,...r})=>r),measuredStudInsideMargin,candidateAccepted:false});
