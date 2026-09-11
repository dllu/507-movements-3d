import{writeFile}from'node:fs/promises';
import{makeTiltHammerCandidate}from'./lib/tilt-hammer-candidate.mjs';
import{solidSurface,surfacePoints}from'../tests/helpers/solid-surface.mjs';
const model=makeTiltHammerCandidate(),{parts,families,geometry:p,motion}=model.root.userData;
const data=Object.fromEntries(Object.entries(parts).map(([name,mesh])=>[name,{mesh,solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)}]));
const names=Object.keys(parts),pairs=[];
for(let i=0;i<names.length;i++)for(let j=i+1;j<names.length;j++)if(families[names[i]]!==families[names[j]])
  pairs.push({a:names[i],b:names[j],checks:0,inside:0,maximumDepth:0});
const times=Array.from({length:65},(_,i)=>4*p.period*(i+.319)/65);
const{entry,release,landing}=motion.events;
for(const[a,b]of[[entry.time,release.time],[release.time,landing.time]])for(let i=0;i<=32;i++)times.push(a+(b-a)*i/32);
for(const event of [0,entry.time,release.time,landing.time,p.period])for(const delta of [-1e-6,0,1e-6])times.push(event+delta);
for(const time of times){
  model.update(time);model.root.updateMatrixWorld(true);
  for(const pair of pairs)for(const[a,b]of[[data[pair.a],data[pair.b]],[data[pair.b],data[pair.a]]]){
    const matrix=b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
    for(const sample of a.points){
      pair.checks++;const point=sample.clone().applyMatrix4(matrix);
      if(!b.solid.inside(point))continue;
      const depth=b.solid.distance(point);if(depth<=1e-6)continue;
      pair.inside++;pair.maximumDepth=Math.max(pair.maximumDepth,depth);
      pair.firstWitness??={time,stage:motion.stateAtTime(time).stage,source:a.mesh.name,target:b.mesh.name,point:point.toArray(),depth};
    }
  }
}
const report={movement:72,status:'isolated-candidate-hardware-audit',productionChanged:false,
  method:'Actual Float32 vertices, edge midpoints and triangle centers in both directions for every independently moving pair among all fifteen solids. Full input turn, dense lift/tip/fall samples and both sides of pickup, release, landing and cycle seams. Penetration tolerance 1e-6. This sampled clearance check does not establish contact forces or continuum collision freedom.',
  poses:times.length,pairs,checks:pairs.reduce((sum,row)=>sum+row.checks,0),inside:pairs.reduce((sum,row)=>sum+row.inside,0)};
await writeFile(process.env.PROBE_OUTPUT??'artifacts/review/072-candidate-hardware.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({poses:report.poses,pairs:pairs.length,checks:report.checks,inside:report.inside,issues:pairs.filter(pair=>pair.inside)});
if(report.inside)process.exitCode=1;
