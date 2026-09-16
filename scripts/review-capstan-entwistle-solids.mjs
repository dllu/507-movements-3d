import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createAuthoredCapstanWheelworkMovement} from '../src/simulation/authored-capstan-wheelwork.js';
import {createAuthoredEntwistleGearingMovement} from '../src/simulation/authored-entwistle-gearing.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const catalog=JSON.parse(fs.readFileSync('src/data/movements.json')).movements,results=[];
for(const id of (process.env.IDS??'412,495').split(',').map(Number)){
 const model=(id===412?createAuthoredCapstanWheelworkMovement:createAuthoredEntwistleGearingMovement)(catalog[id-1]),u=model.root.userData,b=u.blocks;
 const pairs=id===412?b.planets.flatMap(planet=>[[b.sunGear,planet],[b.annulusGear,planet]]):[[b.fixedGearA,b.planetGearB],[b.outputGearC,b.planetGearB]];

 const parts=new Map();
 for(const gear of new Set(pairs.flat())){const rotor=gear.userData.rotor??gear,children=rotor.children.filter((c,i)=>i===0||c.userData.bevelTooth),geometries=children.map(mesh=>{mesh.updateMatrix();let g=mesh.geometry.clone().applyMatrix4(mesh.matrix);if(g.index)g=g.toNonIndexed();for(const name of Object.keys(g.attributes))if(name!=='position')g.deleteAttribute(name);return g;});const geometry=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());parts.set(gear,{rotor,geometry,surface:solidSurface(geometry),points:surfacePoints(geometry)});}
 const row={id,poses:Number(process.env.POSES??33),queries:0,penetrations:0,maxDepth:0,worst:null,pairs:pairs.map(([a,b])=>({pair:a.userData.role+'-'+b.userData.role,maximumSampledGap:0,minimumSampledGap:Infinity}))};
 for(let f=0;f<row.poses;f++){
  model.update(u.geometry.cycleDuration/(id===495?u.geometry.teeth:1)*f/(row.poses-1));model.root.updateMatrixWorld(true);
  for(let pair=0;pair<pairs.length;pair++){const[a,b]=pairs[pair];let gap=Infinity;for(const[from,to]of[[a,b],[b,a]]){const x=parts.get(from),y=parts.get(to),matrix=y.rotor.matrixWorld.clone().invert().multiply(x.rotor.matrixWorld);
   for(const sample of x.points){const point=sample.clone().applyMatrix4(matrix);if(y.surface.box.distanceToPoint(point)>.15)continue;row.queries++;const d=y.surface.distance(point,.15);gap=Math.min(gap,d);if(!y.surface.inside(point))continue;if(d>1e-6){row.penetrations++;if(d>row.maxDepth){row.maxDepth=d;row.worst={frame:f,from:from.userData.role,to:to.userData.role,point:point.toArray()};}}}
  }row.pairs[pair].maximumSampledGap=Math.max(row.pairs[pair].maximumSampledGap,gap);row.pairs[pair].minimumSampledGap=Math.min(row.pairs[pair].minimumSampledGap,gap);}
 }
 results.push(row);console.log(row);for(const p of parts.values())p.geometry.dispose();disposeObject3D(model.root);
}
fs.writeFileSync(process.env.REPORT??'docs/validation/412-495-gear-solids.json',JSON.stringify({sources:['src/simulation/authored-capstan-wheelwork.js','src/simulation/authored-entwistle-gearing.js','src/simulation/capstan-entwistle-corrections.js','src/simulation/primitives.js','src/simulation/authored-gears.js','src/simulation/bevel-geometry.js','src/simulation/bored-lathe-geometry.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')})),method:'Actual rendered gear teeth/body vertices, edge midpoints and triangle centers tested bidirectionally with BVH surface containment through one full programmed 412 mode cycle and one complete 495 tooth period. Hubs, shafts, supports excluded. Distances capped at .15; sampled closest points bound engagement gaps.',results},null,2)+'\n');
if(results.some(r=>r.penetrations))process.exitCode=1;
