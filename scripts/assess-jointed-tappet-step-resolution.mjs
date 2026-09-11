import{readFile,writeFile}from'node:fs/promises';import{createHash}from'node:crypto';import * as THREE from'three';
import{makeJointedTappetCandidate}from'./lib/jointed-tappet-candidate.mjs';
const input='artifacts/review/076-refined-step-convergence.json',study=JSON.parse(await readFile(input,'utf8')),candidate=makeJointedTappetCandidate(),u=candidate.root.userData,p=u.geometry,
  comparisons=study.comparisons.map(c=>({...c,maximumStateDifference:Math.max(...c.maximumAngleErrors)})),last=comparisons.at(-1),e=last.maximumAngleErrors,radii={};
for(const[name,mesh]of Object.entries(u.parts)){
 const family=u.families[name];if(family==='fixed'||family==='driver')continue;mesh.updateMatrix();const pos=mesh.geometry.attributes.position;
 for(let i=0;i<pos.count;i++){const q=new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(mesh.matrix);radii[family]=Math.max(radii[family]??0,Math.hypot(q.x,q.y));}
}
const bounds={tappet:radii.tappet*e[0],dog:Math.hypot(...p.B)*e[0]+radii.dog*(e[0]+e[1]),wheel:radii.wheel*e[2],holding:radii.holding*e[3]},sourcePixelBounds=Object.fromEntries(Object.entries(bounds).map(([k,v])=>[k,v*p.scale])),
  maximumSourcePixelBound=Math.max(...Object.values(sourcePixelBounds)),stateDifferenceRatio=last.maximumStateDifference/comparisons[0].maximumStateDifference,
  energyRatios=study.runs.slice(1).map((r,i)=>r.energy.positiveEnergyDefect/study.runs[i].energy.positiveEnergyDefect),failures=[];
if(maximumSourcePixelBound>.5)failures.push('Successive finest trajectories differ by more than half a source pixel');
if(stateDifferenceRatio>.5)failures.push('Successive finest maximum-state differences do not reduce by at least half');
if(energyRatios.some(v=>v>.6))failures.push('Positive energy defect does not reduce with finer time resolution');
for(const r of study.runs)if(Math.abs(r.finalTeeth-1)>1e-6||Math.abs(r.final.x[0]-.3)>1e-6||Math.abs(r.final.x[1])>1e-6||r.minimumGap< -2e-9)failures.push('Endpoint or unilateral clearance failed');
const sources=[];for(const file of ['scripts/assess-jointed-tappet-step-resolution.mjs','scripts/lib/jointed-tappet-candidate.mjs',input,'artifacts/review/076-directed-step-convergence.json','artifacts/review/076-refined-dense-first-count.json'])sources.push({file,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
const report={movement:76,status:'observed-spatial-step-resolution-assessment',productionChanged:false,mechanicsPassed:false,passed:failures.length===0,selectedStep:study.runs.at(-1).dt,comparisons,radii,worldDisplacementBounds:bounds,sourcePixelBounds,maximumSourcePixelBound,stateDifferenceRatio,energyRatios,sources,failures,
 priorFailuresRetained:'Both original convergence reports keep their nonzero exit status. The refined run passes its absolute angle threshold but fails strict monotonic reduction of every coordinate. This assessment separately considers the maximum state difference and the induced maximum displacement of actual body vertices.',
 qualification:'Observed successive-step stability at the selected resolution, for the chosen mass/load/damping model. A half-source-pixel displacement criterion is used for engraving fidelity, while unilateral solver clearance remains 2e-9. These bounds compare numerical trajectories; they are not a proof of the exact continuous dynamics or of future cached interpolation.'};
await writeFile('artifacts/review/076-spatial-step-resolution.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({passed:report.passed,selectedStep:report.selectedStep,sourcePixelBounds,maximumSourcePixelBound,stateDifferenceRatio,energyRatios,failures});process.exitCode=report.passed?0:1;
