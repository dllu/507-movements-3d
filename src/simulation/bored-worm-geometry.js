import * as THREE from 'three';

// Add a constant through-bore to the Z-axis worm produced by
// cylindricalWormGeometry. Only the planar end caps are replaced; the
// generated working flanks and their normals remain unchanged.
export function boreWormGeometry(source,bore){
 if(source.index)throw new Error('Expected the unindexed cylindrical worm');
 source.computeBoundingBox();
 const low=source.boundingBox.min.z,high=source.boundingBox.max.z;
 const p=source.attributes.position,n=source.attributes.normal,positions=[],normals=[];
 const capPoints=[new Map(),new Map()];
 const emit=(vertices,normal)=>{for(const v of vertices){positions.push(...v.toArray());normals.push(...normal.toArray());}};
 for(let i=0;i<p.count;i+=3){
  const v=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,i+j));
  const side=v.every(q=>Math.abs(q.z-low)<1e-7)?0:v.every(q=>Math.abs(q.z-high)<1e-7)?1:-1;
  if(side<0){for(let j=0;j<3;j++){positions.push(...v[j].toArray());normals.push(n.getX(i+j),n.getY(i+j),n.getZ(i+j));}continue;}
  for(const q of v){
   const radius=Math.hypot(q.x,q.y);if(radius<1e-10)continue;
   const angle=Math.atan2(q.y,q.x),key=Math.round(angle*1e9),old=capPoints[side].get(key);
   if(!old||radius>old.radius)capPoints[side].set(key,{angle,radius,point:new THREE.Vector2(q.x,q.y)});
  }
 }
 const hole=bore.map(([x,y])=>new THREE.Vector2(x,y));
 if(THREE.ShapeUtils.isClockWise(hole))hole.reverse();
 for(const [side,z] of [[0,low],[1,high]]){
  const outer=[...capPoints[side].values()].sort((a,b)=>a.angle-b.angle).map(q=>q.point);
  if(outer.length<3)throw new Error('Missing worm end cap');
  const minimumRadius=Math.min(...outer.map(q=>q.length()));
  if(hole.some(q=>q.length()>=minimumRadius))throw new Error('Bore must fit within the worm root');
  const triangles=THREE.ShapeUtils.triangulateShape(outer,[hole]),points=[...outer,...hole];
  for(const face of triangles){
   const vertices=face.map(k=>new THREE.Vector3(points[k].x,points[k].y,z));
   const normal=new THREE.Triangle(...vertices).getNormal(new THREE.Vector3());
   if((normal.z>0)!==Boolean(side))vertices.reverse();
   emit(vertices,new THREE.Vector3(0,0,side?1:-1));
  }
 }
 for(let i=0;i<hole.length;i++){
  const a=hole[i],b=hole[(i+1)%hole.length];
  const v=[new THREE.Vector3(a.x,a.y,low),new THREE.Vector3(a.x,a.y,high),new THREE.Vector3(b.x,b.y,high),new THREE.Vector3(b.x,b.y,low)];
  const normal=new THREE.Vector3(a.y-b.y,b.x-a.x,0).normalize();
  emit([v[0],v[1],v[2]],normal);emit([v[0],v[2],v[3]],normal);
 }
 const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));result.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
 result.userData={...source.userData,bore:bore.map(p=>[...p])};return result;
}
