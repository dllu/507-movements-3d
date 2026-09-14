import * as THREE from 'three';

// Smooth adjacent prism facets while retaining the machined shoulders. Match
// actual coincident positions, so nearby opposing walls remain independent.
export function smoothPrismNormals(geometry) {
 const positions=geometry.attributes.position,normals=geometry.attributes.normal,groups=new Map();
 const key=i=>[0,1,2].map(k=>positions.array[3*i+k].toFixed(8)).join(',');
 for(let i=0;i<positions.count;i++) {
  const k=key(i),n=new THREE.Vector3().fromBufferAttribute(normals,i),group=groups.get(k)??[];
  if(!group.some(v=>v.distanceToSquared(n)<1e-14))group.push(n);
  groups.set(k,group);
 }
 const result=new Float32Array(normals.array.length),threshold=Math.cos(Math.PI/6);
 for(let i=0;i<positions.count;i++) {
  const n=new THREE.Vector3().fromBufferAttribute(normals,i),average=new THREE.Vector3();
  for(const adjacent of groups.get(key(i)))if(n.dot(adjacent)>threshold)average.add(adjacent);
  average.normalize().toArray(result,3*i);
 }
 geometry.setAttribute('normal',new THREE.Float32BufferAttribute(result,3));return geometry;
}
