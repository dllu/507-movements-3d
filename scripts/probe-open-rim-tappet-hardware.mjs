import { writeFile } from 'node:fs/promises';
import { makeOpenRimTappetCandidate } from './lib/open-rim-tappet-candidate.mjs';
import { solidSurface, surfacePoints } from '../tests/helpers/solid-surface.mjs';
import { triangleTree, meshPairDistance } from './lib/star-mangle-pair-distance.mjs';

const model = makeOpenRimTappetCandidate(), {parts,families,geometry:p,motion} = model.root.userData;
const cache = new Map();
const data = Object.fromEntries(Object.entries(parts).map(([name,mesh]) => {
  if (!cache.has(mesh.geometry)) cache.set(mesh.geometry,{solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)});
  return [name,{mesh,...cache.get(mesh.geometry)}];
}));
const pairs = [], names = Object.keys(parts);
for(let i=0;i<names.length;i++) for(let j=i+1;j<names.length;j++) if(families[names[i]]!==families[names[j]])
  pairs.push({a:names[i],b:names[j],checks:0,inside:0,maximumDepth:0});
const angles = Array.from({length:65},(_,i)=>2*Math.PI*(i+.319)/65);
for(const stage of motion.stages) for(const fraction of [.1,.3,.5,.7,.9]) angles.push(stage.begin+fraction*(stage.end-stage.begin));
for(const event of [p.entryAngle,p.firstCornerAngle,p.tipSideAngle,p.lastCornerAngle,p.releaseAngle,p.rimEntryAngle,p.exitAngle,0,2*Math.PI])
  for(const delta of [-1e-6,0,1e-6]) angles.push(event+delta);
const trees = Object.fromEntries(['rim','tappet','stud0'].map(name=>[name,triangleTree(parts[name].geometry)]));
const gaps=[];
for(const [index,angle] of angles.entries()) {
  const time=angle-p.initialInputPhase; model.update(time);model.root.updateMatrixWorld(true);
  for(const pair of pairs) for(const [a,b] of [[data[pair.a],data[pair.b]],[data[pair.b],data[pair.a]]]) {
    const matrix=b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
    for(const sample of a.points) {
      pair.checks++;const point=sample.clone().applyMatrix4(matrix);
      if(!b.solid.inside(point))continue;
      const depth=b.solid.distance(point);if(depth<=1e-6)continue;
      pair.inside++;pair.maximumDepth=Math.max(pair.maximumDepth,depth);
      pair.firstWitness??={time,angle,stage:motion.atTime(time).stage,source:a.mesh.name,target:b.mesh.name,point:point.toArray(),depth};
    }
  }
  if(index%10===0||index>=angles.length-6) for(const name of ['tappet','rim']) {
    const gap=meshPairDistance(trees[name],trees.stud0,parts.stud0.matrixWorld.clone().invert().multiply(parts[name].matrixWorld),.02);
    gaps.push({time,angle,part:name,distance:gap.distance,witness:gap.witness});
  }
}
const report={movement:70,status:'isolated-candidate-hardware-audit',productionChanged:false,
  method:'Actual Float32 triangle vertices, edge midpoints and face centers, both directions for all independently moving solid pairs. The front cover remains included in the physical audit. Full turn, samples of every contact feature, and both sides of exact events and cycle seams. Penetration tolerance 1e-6. Selected exact triangle distances also recorded. Does not certify finite-inertia impacts.',
  poses:angles.length,pairs,checks:pairs.reduce((s,r)=>s+r.checks,0),inside:pairs.reduce((s,r)=>s+r.inside,0),gaps};
await writeFile(process.env.PROBE_OUTPUT??'artifacts/review/070-candidate-hardware.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({poses:report.poses,pairs:pairs.length,checks:report.checks,inside:report.inside,issues:pairs.filter(r=>r.inside)});
if(report.inside)process.exitCode=1;
