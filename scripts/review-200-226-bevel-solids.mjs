import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createAuthoredGearMovement} from '../src/simulation/authored-gears.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const catalog=JSON.parse(fs.readFileSync('src/data/movements.json')).movements,results=[];
for(const id of (process.env.IDS??'200,226').split(',').map(Number)){
 const model=createAuthoredGearMovement(catalog[id-1]),u=model.root.userData,b=u.blocks;
 const pairs=id===200?[[b.driver,b.upperOutput],[b.driver,b.lowerOutput]]:[[b.inputGearB,b.shaftGearF],[b.inputGearB,b.hollowDriveGear],[b.sideGearC,b.planetGearD],[b.outputGearE,b.planetGearD]];

 const parts=new Map();
 for(const gear of new Set(pairs.flat())){const rotor=gear.userData.rotor??gear,children=rotor.children.filter((c,i)=>i===0||c.userData.bevelTooth),geometries=children.map(mesh=>{mesh.updateMatrix();let g=mesh.geometry.clone().applyMatrix4(mesh.matrix);if(g.index)g=g.toNonIndexed();for(const name of Object.keys(g.attributes))if(name!=='position')g.deleteAttribute(name);return g;});const geometry=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());parts.set(gear,{rotor,geometry,surface:solidSurface(geometry),points:surfacePoints(geometry)});}
 const row={id,poses:Number(process.env.POSES??33),queries:0,penetrations:0,maxDepth:0,worst:null,pairs:pairs.map(([a,b])=>({pair:a.userData.role+'-'+b.userData.role,maximumSampledGap:0,minimumSampledGap:Infinity}))};
 for(let f=0;f<row.poses;f++){
  model.update(u.transmission.inputCyclePeriod/(id===200?u.geometry.driverTeeth:u.geometry.teeth)*f/(row.poses-1));model.root.updateMatrixWorld(true);
  for(let pair=0;pair<pairs.length;pair++){const[a,b]=pairs[pair];let gap=Infinity;for(const[from,to]of[[a,b],[b,a]]){const x=parts.get(from),y=parts.get(to),matrix=y.rotor.matrixWorld.clone().invert().multiply(x.rotor.matrixWorld);
   for(const sample of x.points){const point=sample.clone().applyMatrix4(matrix);if(y.surface.box.distanceToPoint(point)>.15)continue;row.queries++;const d=y.surface.distance(point,.15);gap=Math.min(gap,d);if(!y.surface.inside(point))continue;if(d>1e-6){row.penetrations++;if(d>row.maxDepth){row.maxDepth=d;row.worst={frame:f,from:from.userData.role,to:to.userData.role,point:point.toArray()};}}}
  }row.pairs[pair].maximumSampledGap=Math.max(row.pairs[pair].maximumSampledGap,gap);row.pairs[pair].minimumSampledGap=Math.min(row.pairs[pair].minimumSampledGap,gap);}
 }
 results.push(row);console.log(row);for(const p of parts.values())p.geometry.dispose();disposeObject3D(model.root);
}
fs.writeFileSync(process.env.REPORT??'docs/validation/200-226-bevel-solids.json',JSON.stringify({sources:['src/simulation/authored-gears.js','src/simulation/bevel-200-226-corrections.js','src/simulation/primitives.js','src/simulation/bevel-geometry.js','src/simulation/bored-lathe-geometry.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')})),method:'Actual rendered gear teeth and bodies sampled bidirectionally at vertices, edge midpoints and triangle centers with BVH containment across one input tooth period. Hubs, shafts and supports excluded. Distances capped at .15.',results},null,2)+'\n');
if(results.some(r=>r.penetrations))process.exitCode=1;
