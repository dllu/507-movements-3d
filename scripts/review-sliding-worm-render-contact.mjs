import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {Matrix4,Triangle,Vector3} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {makeSlidingWormModel} from '../src/simulation/baked/sliding-worm.js';
import {slidingWormDimensions as g} from '../src/simulation/sliding-worm-kinematics.js';
import {triangleTree,meshPairDistance} from './lib/star-mangle-pair-distance.mjs';
const bundle=JSON.parse(fs.readFileSync('/dev/shm/143-candidate.json')),model=makeSlidingWormModel(bundle);
try{
 const worm=model.root.getObjectByName('bored-worm'),wheel=model.root.getObjectByName('generated-wheel'),pieces=[];
 for(let i=0;i<wheel.count;i++){const matrix=new Matrix4();wheel.getMatrixAt(i,matrix);pieces.push(wheel.geometry.clone().applyMatrix4(matrix));}
 const whole=mergeGeometries(pieces);pieces.forEach(p=>p.dispose());
 const trees=[triangleTree(worm.geometry),triangleTree(whole)],rows=[],count=Number(process.env.POSES??65),threshold=1e-5;
 const topology=[];
 for(const [name,geometry]of [['worm',worm.geometry],['wheel-sector',wheel.geometry]]){
  const edges=new Map();let volume=0,wrongNormals=0,faceIndex=0;
  // Walk every stored triangle so each face is compared with its own stored
  // normals (surfaceTriangles drops zero-area faces, which would misalign them).
  const count=(geometry.index?.count??geometry.attributes.position.count)/3,corner=k=>geometry.index?geometry.index.getX(k):k;
  for(;faceIndex<count;faceIndex++){
   const f=new Triangle(...[0,1,2].map(j=>new Vector3().fromBufferAttribute(geometry.attributes.position,corner(faceIndex*3+j))));
   if(f.getArea()<=1e-16)continue;
   volume+=f.a.dot(f.b.clone().cross(f.c))/6;
   const cross=f.b.clone().sub(f.a).cross(f.c.clone().sub(f.a)),normal=cross.clone().set(0,0,0);
   for(let j=0;j<3;j++)normal.add(cross.clone().fromBufferAttribute(geometry.attributes.normal,corner(faceIndex*3+j)));
   if(cross.lengthSq()>1e-22&&cross.dot(normal)<=0)wrongNormals++;
   const keys=[f.a,f.b,f.c].map(v=>v.toArray().map(x=>Math.round(x*1e6)).join(','));if(new Set(keys).size<3)continue;
   for(let j=0;j<3;j++){const a=keys[j],b=keys[(j+1)%3],key=[a,b].sort().join('/'),edge=edges.get(key)??{count:0,direction:0};edge.count++;edge.direction+=a<b?1:-1;edges.set(key,edge);}
  }
  topology.push({name,volume,wrongNormals,unmatchedEdges:[...edges.values()].filter(e=>e.count!==2||e.direction!==0).length});
 }
 for(let i=0;i<count;i++){
  const input=2*Math.PI*(i+.613)/count;model.update(input/(2*Math.PI)*g.period/g.teeth);
  const contact=meshPairDistance(trees[0],trees[1],wheel.matrixWorld.clone().invert().multiply(worm.matrixWorld),threshold);
  rows.push({input,separationLowerBound:contact.distance,exactDistance:contact.witness?contact.distance:null,testedTriangles:contact.testedTriangles});
  if(i%8===0)console.log(rows.at(-1));
 }
 const files=['/dev/shm/143-candidate.json.gz','scripts/review-sliding-worm-render-contact.mjs','scripts/lib/star-mangle-pair-distance.mjs','src/simulation/baked/sliding-worm.js','src/simulation/sliding-worm-kinematics.js'];
 const report={movement:143,method:'Actual baked worm skin against all triangles of all 22 rendered wheel instances, including end caps and sector walls. Closest-point traversal is bounded at 1e-5; a null exactDistance means separation is at least that bound, not that an exact distance was measured. 65 offset poses span one input turn; generating geometry repeats each wheel tooth.',sources:files.map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')})),summary:{poses:count,intersections:rows.filter(r=>r.separationLowerBound===0).length,minimumSeparationLowerBound:Math.min(...rows.map(r=>r.separationLowerBound))},topology,rows};
 fs.writeFileSync('docs/validation/143-render-contact.json',JSON.stringify(report,null,2)+'\n');console.log({summary:report.summary,topology});whole.dispose();
}finally{model.dispose();}
