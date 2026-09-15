import {MeshoptSimplifier} from 'three/addons/libs/meshopt_simplifier.module.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {BufferAttribute,Float32BufferAttribute,Vector3} from 'three';
import {relieveWormWheel} from './relieve-worm-wheel.mjs';

// Offline only. Lock the periodic sector boundaries so instances still meet.
// The small radial relief is a rendering allowance, not a contact constraint;
// the resulting actual mesh must be checked against its mating worm.
export async function simplifyWormWheel(source,parameters,fine){
 await MeshoptSimplifier.ready;
 const p=source.attributes.position,n=source.attributes.normal,locks=new Uint8Array(p.count),half=Math.PI/parameters.teeth;
 for(let i=0;i<p.count;i++)if(Math.abs(Math.abs(Math.atan2(p.getY(i),p.getX(i)))-half)<1e-6)locks[i]=1;
 const [indices,error]=MeshoptSimplifier.simplifyWithAttributes(source.index.array,p.array,3,n.array,3,[0,0,0],locks,Math.floor(source.index.count*.02/3)*3,.001,['LockBorder','ErrorAbsolute']);
 const result=source.clone();result.setIndex(new BufferAttribute(indices,1));
 const positions=result.attributes.position;
 for(let i=0;i<positions.count;i++){
  const r=Math.hypot(positions.getX(i),positions.getY(i));
  if(r>.6){const scale=(r-.003)/r;positions.setXY(i,positions.getX(i)*scale,positions.getY(i)*scale);}
 }
 const compact=mergeVertices(result,1e-7);result.dispose();
 const repair=relieveWormWheel(compact,parameters,fine);
 compact.computeVertexNormals();
 const pos=compact.attributes.position,norm=compact.attributes.normal,positionsOut=Array.from(pos.array),normalsOut=Array.from(norm.array),indicesOut=Array.from(compact.index.array);let correctedFaceNormals=0;
 for(let i=0;i<indicesOut.length;i+=3){
  const ids=indicesOut.slice(i,i+3),v=ids.map(k=>new Vector3().fromBufferAttribute(pos,k)),normal=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));
  if(normal.lengthSq()<1e-22)continue;
  const stored=new Vector3();ids.forEach(k=>stored.add(new Vector3().fromBufferAttribute(norm,k)));
  if(normal.dot(stored)>0)continue;
  // Split only an opposed face's shading vertices; its surface and all
  // neighboring normals remain unchanged.
  correctedFaceNormals++;normal.normalize();
  for(let j=0;j<3;j++){indicesOut[i+j]=positionsOut.length/3;positionsOut.push(...v[j].toArray());normalsOut.push(...normal.toArray());}
 }
 compact.setAttribute('position',new Float32BufferAttribute(positionsOut,3));compact.setAttribute('normal',new Float32BufferAttribute(normalsOut,3));compact.setIndex(indicesOut);
 compact.userData={simplification:{sourceTriangles:source.index.count/3,triangles:compact.index.count/3,error,radialRelief:.003,lockedVertices:locks.reduce((s,v)=>s+v,0),repair,correctedFaceNormals}};
 return compact;
}
