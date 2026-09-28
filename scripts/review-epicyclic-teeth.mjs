import fs from 'node:fs';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createAuthoredEpicyclicTrainMovement} from '../src/simulation/authored-epicyclic-trains.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const catalog=JSON.parse(fs.readFileSync('src/data/movements.json')).movements,results=[];
for(const id of (process.env.IDS??'502,503,504,505').split(',').map(Number)){
 const model=createAuthoredEpicyclicTrainMovement(catalog[id-1]),u=model.root.userData,b=u.blocks;
 // 504: the correction renders one thick B (inputRowB) across all output planes and hides the
 // per-output rows, so the outputs are paired with the rendered B, as in review-503-504-contact-solids.
 const pairs=id===502?[[b.fixedSunA,b.compoundF],[b.outputD,b.compoundE],[b.compoundE,b.outputB]]:id===503?[[b.lowerC,b.planetB],[b.upperD,b.planetB]]:id===504?[[b.fixedA,b.inputRowB],...['E','F','G'].map(s=>[b.inputRowB,b.outputs[s]])]:[[b.sunA,b.planetB],[b.fixedRingC,b.planetB]];
 const parts=new Map();
 for(const gear of new Set(pairs.flat())){const rotor=gear.userData.rotor,children=rotor.children.filter((c,i)=>i===0||c.userData.bevelTooth),geometries=children.map(mesh=>{mesh.updateMatrix();let g=mesh.geometry.clone().applyMatrix4(mesh.matrix);if(g.index)g=g.toNonIndexed();for(const name of Object.keys(g.attributes))if(name!=='position')g.deleteAttribute(name);return g;});const geometry=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());parts.set(gear,{rotor,geometry,surface:solidSurface(geometry),points:surfacePoints(geometry)});}
 const row={id,poses:Number(process.env.POSES??33),queries:0,penetrations:0,maxDepth:0,worst:null};
 for(let f=0;f<row.poses;f++){
  model.update(u.transmission.nominalCarrierPeriod*f/(row.poses-1));model.root.updateMatrixWorld(true);
  for(const[a,b]of pairs)for(const[from,to]of[[a,b],[b,a]]){const x=parts.get(from),y=parts.get(to),matrix=y.rotor.matrixWorld.clone().invert().multiply(x.rotor.matrixWorld);
   for(const sample of x.points){const point=sample.clone().applyMatrix4(matrix);if(!y.surface.box.containsPoint(point))continue;row.queries++;if(!y.surface.inside(point))continue;const d=y.surface.distance(point,.05);if(d>1e-6){row.penetrations++;if(d>row.maxDepth){row.maxDepth=d;row.worst={frame:f,from:from.userData.role,to:to.userData.role,point:point.toArray()};}}}
  }
 }
 results.push(row);console.log(row);for(const p of parts.values())p.geometry.dispose();disposeObject3D(model.root);
}
fs.writeFileSync(process.env.REPORT??'docs/validation/502-505-gear-solids.json',JSON.stringify({method:'Actual rendered gear teeth/body vertices, edge midpoints and triangle centers tested bidirectionally with BVH surface containment at uniform carrier phases. Hubs, shafts, supports excluded. Depth capped at .05.',results},null,2)+'\n');
if(results.some(r=>r.penetrations))process.exitCode=1;
