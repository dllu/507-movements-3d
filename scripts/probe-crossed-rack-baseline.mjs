import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createMovementModel} from '../src/simulation/registry.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const catalog=JSON.parse(await readFile('src/data/movements.json','utf8')),model=createMovementModel(catalog.movements[79]),u=model.root.userData,b=u.blocks,
 pawls=[],targets=[...b.rackRails.map((mesh,i)=>({name:'rackRail'+i,mesh})),...b.rackTeeth.map((mesh,i)=>({name:'rackTooth'+i,mesh}))],sources=[];
for(const key of ['leftPawl','rightPawl']){let i=0;b[key].traverse(mesh=>{if(mesh.isMesh)pawls.push({name:key+'/'+i++,mesh,points:surfacePoints(mesh.geometry)});});}
for(const target of targets)target.surface=solidSurface(target.mesh.geometry);
const pairs=pawls.flatMap(a=>targets.map(b=>({a,b,checks:0,penetrations:0,maximumDepth:0})));
for(let i=0;i<=192;i++){
 const coordinate=2*i/192,time=(coordinate-u.geometry.initialCyclePhase)/u.geometry.cyclesPerSecond;model.update(time);model.root.updateMatrixWorld(true);
 for(const pair of pairs){const matrix=pair.b.mesh.matrixWorld.clone().invert().multiply(pair.a.mesh.matrixWorld),surface=pair.b.surface;
  pair.a.mesh.geometry.computeBoundingBox();if(!pair.a.mesh.geometry.boundingBox.clone().applyMatrix4(matrix).intersectsBox(surface.box))continue;
  for(const sample of pair.a.points){const point=sample.clone().applyMatrix4(matrix);pair.checks++;if(!surface.box.containsPoint(point)||!surface.inside(point))continue;
   const depth=surface.distance(point);if(depth<=1e-6)continue;pair.penetrations++;if(depth>pair.maximumDepth){pair.maximumDepth=depth;pair.witness={coordinate,time,point:point.toArray(),depth};}
  }
 }
}
const seams=[.5,1,1.5,2].map(coordinate=>{const a=u.stateAtCycleCoordinate(coordinate-1e-8),b=u.stateAtCycleCoordinate(coordinate+1e-8);
 return{coordinate,physicalChange:b.rackDisplacement-a.rackDisplacement,renderedChange:b.renderedRackOffset-a.renderedRackOffset,pitch:u.geometry.toothPitch};}),
 rows=pairs.map(({a,b,...pair})=>({a:a.name,b:b.name,...pair}));
for(const file of ['scripts/probe-crossed-rack-baseline.mjs','src/simulation/authored-intermittent.js','src/simulation/registry.js','src/simulation/primitives.js','tests/helpers/solid-surface.mjs']){
 const bytes=await readFile(file),archive=`artifacts/review/080-surface-baseline-source-${sources.length}.txt`;await writeFile(archive,bytes,{flag:'wx'});sources.push({file,archive,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const report={movement:80,status:'original-finite-pawl-rack-screen',productionChanged:false,mechanicsPassed:false,poses:193,pairs:rows.length,
 checks:rows.reduce((s,p)=>s+p.checks,0),penetrations:rows.reduce((s,p)=>s+p.penetrations,0),maximumDepth:Math.max(...rows.map(p=>p.maximumDepth)),failedPairs:rows.filter(p=>p.penetrations),seams,sources,
 qualification:'Actual pawl surface samples are tested inside closed rack rails and tooth prisms. Only this direction is used because the original open-arc TorusGeometry hooks have uncapped tube ends. The test also records the finite rack body jumping at modulo-pitch resets. This is baseline evidence, not a continuous certificate.'};
report.passed=report.penetrations===0&&seams.every(s=>Math.abs(s.renderedChange-s.physicalChange)<1e-6);
await writeFile('artifacts/review/080-baseline-surfaces.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,failedPairs:report.failedPairs.length,sources:undefined});if(!report.passed)process.exitCode=1;
