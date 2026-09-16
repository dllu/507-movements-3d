import * as THREE from 'three';

// Thicken an oriented open triangle surface along its vertex normals. Boundary
// walls use separate vertices so their normals do not round the face edges.
export function finiteSurfaceShell(source,thickness){
 if(!source.index)throw new Error('Shell source must use shared indexed vertices');
 if(!(thickness>0))throw new RangeError('Shell thickness must be positive');
 const surface=source.clone();if(!surface.attributes.normal)surface.computeVertexNormals();
 const p=surface.attributes.position,n=surface.attributes.normal,sourceIndex=surface.index;
 const count=p.count,positions=[],indices=[],edges=new Map();
 for(const sign of[1,-1])for(let i=0;i<count;i++)positions.push(p.getX(i)+sign*thickness*n.getX(i)/2,p.getY(i)+sign*thickness*n.getY(i)/2,p.getZ(i)+sign*thickness*n.getZ(i)/2);
 for(let i=0;i<(sourceIndex?.count??count);i+=3){
  const ids=[0,1,2].map(j=>sourceIndex?sourceIndex.getX(i+j):i+j),[a,b,c]=ids;
  indices.push(a,b,c,a+count,c+count,b+count);
  for(let j=0;j<3;j++){const a=ids[j],b=ids[(j+1)%3],key=a<b?`${a},${b}`:`${b},${a}`;
   if(edges.has(key))edges.get(key).count++;else edges.set(key,{a,b,count:1});}
 }
 let boundaryEdges=0;
 for(const edge of edges.values()){
  if(edge.count>2)throw new Error('Cannot thicken a nonmanifold surface');
  if(edge.count!==1)continue;boundaryEdges++;
  const base=positions.length/3;
  for(const index of[edge.a,edge.a+count,edge.b+count,edge.b])positions.push(...positions.slice(index*3,index*3+3));
  indices.push(base,base+1,base+2,base,base+2,base+3);
 }
 const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));result.setIndex(indices);result.computeVertexNormals();result.computeBoundingBox();result.computeBoundingSphere();
 result.userData={...source.userData,shellThickness:thickness,sourceVertexCount:count,boundaryEdges};surface.dispose();return result;
}
