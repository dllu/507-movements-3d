import { writeFile } from 'node:fs/promises';
import { makeSingleToothIndexCandidate } from './lib/single-tooth-index-candidate.mjs';
import { solidSurface, surfacePoints } from '../tests/helpers/solid-surface.mjs';
import { triangleTree, meshPairDistance } from './lib/star-mangle-pair-distance.mjs';

const name=process.env.CANDIDATE_PROFILE??'trimmed-source';
const {default:profile}=await import(`./lib/single-tooth-${name}-profile.mjs`);
const model=makeSingleToothIndexCandidate({profile}),{parts,families,geometry:p}=model.root.userData;
const data=Object.fromEntries(Object.entries(parts).map(([name,mesh])=>[name,
  {mesh,solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)}]));
const pairs=[];const names=Object.keys(parts);
for(let i=0;i<names.length;i++)for(let j=i+1;j<names.length;j++)if(families[names[i]]!==families[names[j]])
  pairs.push({a:names[i],b:names[j],checks:0,inside:0,maximumDepth:0});
const times=Array.from({length:65},(_,i)=>p.sourceAngle-.8+1.6*(i+.319)/65);
times.push(0,p.period/2,p.period);
for(const event of [p.entryTime,p.exitTime,p.sourceAngle-.2325,p.sourceAngle+.213,p.period+p.sourceAngle-Math.PI])
  for(const delta of [-1e-5,0,1e-5])times.push(event+delta);
const trees={driver:triangleTree(parts.driverPlate.geometry),output:triangleTree(parts.notchedPlate.geometry)};
const gaps=[];
for(const [index,time] of times.entries()) {
  model.update(time);model.root.updateMatrixWorld(true);
  for(const pair of pairs)for(const [a,b] of [[data[pair.a],data[pair.b]],[data[pair.b],data[pair.a]]]) {
    const matrix=b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
    for(const sample of a.points) {
      pair.checks++;const point=sample.clone().applyMatrix4(matrix);
      if(!b.solid.inside(point))continue;
      const depth=b.solid.distance(point);if(depth<=1e-6)continue;
      pair.inside++;pair.maximumDepth=Math.max(pair.maximumDepth,depth);
      pair.firstWitness??={time,source:a.mesh.name,target:b.mesh.name,point:point.toArray(),depth};
    }
  }
  if(index%10===0||index>=times.length-6) {
    const gap=meshPairDistance(trees.driver,trees.output,
      parts.notchedPlate.matrixWorld.clone().invert().multiply(parts.driverPlate.matrixWorld),.02);
    gaps.push({time,distance:gap.distance,witness:gap.witness});
  }
}
const report={movement:68,status:'isolated-quasistatic-hardware-audit',productionChanged:false,
  method:'Actual Float32 triangle vertices, edge midpoints and face centers in both directions for all nine independently moving solid pairs. Dense stroke samples, entry/exit, observed peak-speed locations, dwells and cycle seam. Penetration tolerance 1e-6. Selected exact triangle distances are also recorded. This is a clearance audit of the current sampled motion, not force or finite-inertia certification.',
  poses:times.length,pairs,checks:pairs.reduce((s,r)=>s+r.checks,0),inside:pairs.reduce((s,r)=>s+r.inside,0),gaps};
await writeFile(process.env.PROBE_OUTPUT??'artifacts/review/068-trimmed-hardware.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({poses:report.poses,pairs:pairs.length,checks:report.checks,inside:report.inside,issues:pairs.filter(r=>r.inside)});
if(report.inside)process.exitCode=1;
