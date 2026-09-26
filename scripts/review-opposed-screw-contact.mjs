import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {Matrix4} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {makeOpposedScrewNuts} from '../src/simulation/opposed-screw-nuts.js';
import {triangleTree,meshPairDistance} from './lib/star-mangle-pair-distance.mjs';
import {surfaceTriangles} from '../tests/helpers/solid-surface.mjs';
const model=makeOpposedScrewNuts();
try{
 const worm=model.root.getObjectByName('horizontal-input-worm'),wheel=model.root.getObjectByName('generated-worm-wheel'),pieces=[];
 // The production wheel is one welded mesh of its sectors; older builds instanced them.
 if(wheel.isInstancedMesh)for(let i=0;i<wheel.count;i++){const matrix=new Matrix4();wheel.getMatrixAt(i,matrix);pieces.push(wheel.geometry.clone().applyMatrix4(matrix));}
 const whole=wheel.isInstancedMesh?mergeGeometries(pieces):wheel.geometry.clone();pieces.forEach(p=>p.dispose());
 const trees=[triangleTree(worm.geometry),triangleTree(whole)],rows=[],count=Number(process.env.POSES??65),threshold=1e-5;
 const topology=[];
 for(const [name,geometry]of [['worm',worm.geometry],[wheel.isInstancedMesh?'wheel-sector':'welded-wheel',wheel.geometry]]){
  const edges=new Map();let volume=0,wrongNormals=0,faceIndex=0;
  for(const f of surfaceTriangles(geometry)){
   volume+=f.a.dot(f.b.clone().cross(f.c))/6;
   const cross=f.b.clone().sub(f.a).cross(f.c.clone().sub(f.a)),normal=cross.clone().set(0,0,0);
   for(let j=0;j<3;j++)normal.add(cross.clone().fromBufferAttribute(geometry.attributes.normal,geometry.index?geometry.index.getX(faceIndex*3+j):faceIndex*3+j));
   if(cross.lengthSq()>1e-22&&cross.dot(normal)<=0)wrongNormals++;faceIndex++;
   const keys=[f.a,f.b,f.c].map(v=>v.toArray().map(x=>Math.round(x*1e6)).join(','));if(new Set(keys).size<3)continue;
   for(let j=0;j<3;j++){const a=keys[j],b=keys[(j+1)%3],key=[a,b].sort().join('/'),edge=edges.get(key)??{count:0,direction:0};edge.count++;edge.direction+=a<b?1:-1;edges.set(key,edge);}
  }
  topology.push({name,volume,wrongNormals,unmatchedEdges:[...edges.values()].filter(e=>e.count!==2||e.direction!==0).length});
 }
 for(let i=0;i<count;i++){
  const input=2*Math.PI*(i+.613)/count;model.root.userData.blocks.worm.rotation.x=input;model.root.userData.blocks.wheel.rotation.z=input/18;model.root.updateMatrixWorld(true);
  const contact=meshPairDistance(trees[0],trees[1],wheel.matrixWorld.clone().invert().multiply(worm.matrixWorld),threshold);
  rows.push({input,separationLowerBound:contact.distance,exactDistance:contact.witness?contact.distance:null,testedTriangles:contact.testedTriangles,witness:contact.witness});
  if(i%8===0)console.log(rows.at(-1));
 }
 const files=['scripts/review-opposed-screw-contact.mjs','scripts/lib/star-mangle-pair-distance.mjs','src/simulation/opposed-screw-nuts.js','src/simulation/worm-gear-geometry.js','src/simulation/instanced-worm-wheel.js','src/simulation/mujoco-worm-saddle/wheel-data.js'];
 const report={movement:151,method:'Actual candidate worm skin against all triangles of the rendered wheel (its 18 sectors welded into one closed mesh, end caps included). Closest-point traversal is bounded at 1e-5; a null exactDistance means separation is at least that bound, not that an exact distance was measured. 65 offset poses span one input turn; generating geometry repeats each wheel tooth.',sources:files.map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')})),summary:{poses:count,intersections:rows.filter(r=>r.separationLowerBound===0).length,minimumSeparationLowerBound:Math.min(...rows.map(r=>r.separationLowerBound))},topology,rows};
 fs.writeFileSync('docs/validation/151-render-contact.json',JSON.stringify(report,null,2)+'\n');console.log({summary:report.summary,topology});whole.dispose();
}finally{model.dispose();}
