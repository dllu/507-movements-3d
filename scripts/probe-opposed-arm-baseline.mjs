import fs from 'node:fs';
import {createMovementModel} from '../src/simulation/registry.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const catalog=JSON.parse(fs.readFileSync('src/data/movements.json')),model=createMovementModel(catalog.movements[78]),u=model.root.userData,b=u.blocks,
 cache=new WeakMap(),part=(name,mesh)=>{if(!cache.has(mesh.geometry))cache.set(mesh.geometry,{solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)});return{name,mesh,...cache.get(mesh.geometry)};},
 pawls=['upperPawlBody','upperPawlContactFinger','upperPawlPivotHub','lowerPawlBody','lowerPawlContactFinger','lowerPawlPivotHub'].map(k=>part(k,b[k])),
 wheel=[part('wheelWeb',b.wheelWeb),part('wheelRim',b.wheelRim),part('wheelHub',b.wheelHub),...b.wheelTeeth.map((m,i)=>part('wheelTooth'+i,m))],
 pairs=pawls.flatMap(a=>wheel.map(b=>({a,b,checks:0,inside:0,maximumDepth:0})));
for(let i=0;i<=192;i++){
 const coordinate=2*i/192,time=(coordinate-u.geometry.initialCyclePhase)/u.geometry.cyclesPerSecond;model.update(time);model.root.updateMatrixWorld(true);
 for(const pair of pairs)for(const[a,b]of[[pair.a,pair.b],[pair.b,pair.a]]){
  const matrix=b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
  if(!a.solid.box.clone().applyMatrix4(matrix).intersectsBox(b.solid.box))continue;
  for(const sample of a.points){
   pair.checks++;const point=sample.clone().applyMatrix4(matrix);if(!b.solid.inside(point))continue;
   const depth=b.solid.distance(point);if(depth<=1e-6)continue;pair.inside++;
   if(depth>pair.maximumDepth){pair.maximumDepth=depth;pair.witness={time,coordinate,from:a.name,to:b.name,point:point.toArray(),depth};}
  }
 }
}
const rows=pairs.map(({a,b,...rest})=>({a:a.name,b:b.name,...rest}));
const report={movement:79,status:'original-finite-pawl-wheel-screen',productionChanged:false,mechanicsPassed:false,poses:193,pairs:rows.length,
 checks:rows.reduce((a,p)=>a+p.checks,0),inside:rows.reduce((a,p)=>a+p.inside,0),maximumDepth:Math.max(...rows.map(p=>p.maximumDepth)),failedPairs:rows.filter(p=>p.inside),
 qualification:'Read-only screen of actual pawl body, finger and pivot-hub surfaces against every physical wheel web, rim, hub and tooth, in both directions. Both old authored cycles are sampled at 193 poses. This is finite-surface baseline evidence, not a continuous certificate.'};

const files=['scripts/probe-opposed-arm-baseline.mjs','src/simulation/authored-intermittent.js','src/simulation/primitives.js','src/simulation/registry.js','tests/helpers/solid-surface.mjs'];
const {createHash}=await import('node:crypto');report.passed=report.inside===0;report.sources=files.map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
fs.writeFileSync('artifacts/review/079-baseline-pawl-wheel-surfaces.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,failedPairs:report.failedPairs.length,sources:undefined});process.exitCode=report.passed?0:1;
