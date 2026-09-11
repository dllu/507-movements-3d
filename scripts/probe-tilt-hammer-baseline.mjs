import{readFile,writeFile}from'node:fs/promises';
import{createHash}from'node:crypto';
import{createMovementModel}from'../src/simulation/registry.js';
import{solidSurface,surfacePoints}from'../tests/helpers/solid-surface.mjs';
import{triangleTree,meshPairDistance}from'./lib/star-mangle-pair-distance.mjs';

const catalog=JSON.parse(await readFile('src/data/movements.json','utf8'));
const model=createMovementModel(catalog.movements[71]),{blocks:b,geometry:p,stateAtTime}=model.root.userData;
const parts=['camBody','hammerBody','followerNose','anvilBody','anvilFace'];
const data=Object.fromEntries(parts.map(name=>[name,{mesh:b[name],solid:solidSurface(b[name].geometry),
  points:surfacePoints(b[name].geometry),tree:triangleTree(b[name].geometry)}]));
const pairs=[['camBody','hammerBody'],['camBody','followerNose'],['camBody','anvilBody'],['camBody','anvilFace'],
  ['hammerBody','anvilBody'],['hammerBody','anvilFace'],['followerNose','anvilBody'],['followerNose','anvilFace']]
  .map(([a,b])=>({a,b,checks:0,inside:0,maximumDepth:0}));
const phaseTime=phase=>(phase-p.initialCyclePhase)*p.lobeCyclePeriod;
const times=Array.from({length:129},(_,i)=>4*p.lobeCyclePeriod*(i+.319)/129);
for(let i=0;i<=128;i++)times.push(phaseTime(p.contactStartPhase+(p.gravityDropEndPhase-p.contactStartPhase)*i/128));
for(const phase of [p.contactStartPhase,p.contactEndPhase,p.gravityDropEndPhase])for(const delta of [-1e-5,0,1e-5])times.push(phaseTime(phase)+delta);
const distances=[];
for(const[index,time]of times.entries()){
  model.update(time);model.root.updateMatrixWorld(true);const state=stateAtTime(time);
  for(const pair of pairs)for(const[from,to,source]of[[data[pair.a],data[pair.b],pair.a],[data[pair.b],data[pair.a],pair.b]]){
    const matrix=to.mesh.matrixWorld.clone().invert().multiply(from.mesh.matrixWorld);
    for(const sample of from.points){
      pair.checks++;const point=sample.clone().applyMatrix4(matrix);
      if(!to.solid.inside(point))continue;
      const depth=to.solid.distance(point);if(depth<=1e-6)continue;
      pair.inside++;pair.maximumDepth=Math.max(pair.maximumDepth,depth);
      pair.firstWitness??={time,stage:state.stage,source,point:point.toArray(),depth};
    }
  }
  if(index>=times.length-9||index%16===0){
    const a=data.camBody,b=data.followerNose;
    const result=meshPairDistance(a.tree,b.tree,b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld),.1);
    distances.push({time,stage:state.stage,claimedContact:state.camContactEngaged,...result});
  }
}
const source=await readFile('src/simulation/authored-intermittent.js','utf8'),tests=await readFile('tests/models.test.mjs','utf8');
const factory=source.slice(source.indexOf('function fourLobeTiltHammer()'),source.indexOf('function springPressedRatchetIndex()'));
const testStart=tests.indexOf("test('movement 72 "),testEnd=tests.indexOf("\ntest(",testStart+1);
const archives=[['artifacts/review/072-original-factory.txt',factory],['artifacts/review/072-original-test.txt',tests.slice(testStart,testEnd)]];
for(const[file,text]of archives)await writeFile(file,text,{flag:'wx'});
const files=[...archives.map(([file])=>file),'artifacts/reference/mm_072.html','artifacts/reference/brown-072-detail.png','public/engravings/mm_072.png'];
await writeFile('artifacts/review/072-baseline-archives.json',JSON.stringify(await Promise.all(files.map(async file=>({file,sha256:createHash('sha256').update(await readFile(file)).digest('hex')}))),null,2)+'\n',{flag:'wx'});
const report={movement:72,status:'baseline-diagnosis',productionChanged:false,poses:times.length,pairs,
  checks:pairs.reduce((sum,row)=>sum+row.checks,0),inside:pairs.reduce((sum,row)=>sum+row.inside,0),distances,
  method:'Actual Float32 vertices, edge midpoints and triangle centers in both directions across eight working-part pairs: cam/hammer, cam/nose and each moving part against both anvil solids. Full turn plus dense lift/fall and both sides of entry, release and landing. Penetration tolerance 1e-6. This diagnostic does not certify the remaining support hardware or force law.',
  geometry:p,timing:model.root.userData.animationTiming,entry:stateAtTime(phaseTime(p.contactStartPhase)),
  release:stateAtTime(phaseTime(p.contactEndPhase)),landing:stateAtTime(phaseTime(p.gravityDropEndPhase))};
await writeFile('artifacts/review/072-working-surface-baseline.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({poses:report.poses,pairs:pairs.length,checks:report.checks,inside:report.inside,failures:pairs.filter(pair=>pair.inside),timing:report.timing});
