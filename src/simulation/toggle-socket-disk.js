import * as THREE from 'three';

// A circular plate with two blind spherical seats and flared rod entrances.
// sign=1 opens downward; sign=-1 mirrors the complete solid for the lower disk.
export function toggleSocketDisk({radius,depth,offset,ballRadius,openingRadius,sign=1,offsetY=0}) {
 const openingDepth=depth/2-offsetY;
 const seatRadius=ballRadius+.002,segments=128,steps=32,positions=[],indices=[];
 const vertex=p=>{positions.push(p[0],p[1]*sign,p[2]);return positions.length/3-1;};
 const triangle=(a,b,c,hint)=>{
  const va=new THREE.Vector3().fromArray(positions,a*3),vb=new THREE.Vector3().fromArray(positions,b*3),vc=new THREE.Vector3().fromArray(positions,c*3);
  const n=vb.clone().sub(va).cross(vc.clone().sub(va));
  if(n.dot(new THREE.Vector3(hint[0],hint[1]*sign,hint[2]))<0)indices.push(a,c,b);else indices.push(a,b,c);
 };
 const ring=(r,y,x=0)=>Array.from({length:segments},(_,i)=>vertex([x+r*Math.cos(i*2*Math.PI/segments),y,r*Math.sin(i*2*Math.PI/segments)]));
 const wall=(rings,x,inward)=>{for(let j=0;j<rings.length-1;j++)for(let i=0;i<segments;i++){
  const k=(i+1)%segments,a=rings[j][i],b=rings[j][k],c=rings[j+1][k],d=rings[j+1][i],angle=(i+.5)*2*Math.PI/segments,h=[Math.cos(angle)*(inward?-1:1),0,Math.sin(angle)*(inward?-1:1)];
  triangle(a,b,c,h);triangle(a,c,d,h);
 }};
 const cap=(y,holes)=>{
  const contour=Array.from({length:segments},(_,i)=>new THREE.Vector2(radius*Math.cos(i*2*Math.PI/segments),radius*Math.sin(i*2*Math.PI/segments)));
  const rings=holes.map(x=>Array.from({length:segments},(_,i)=>new THREE.Vector2(x+openingRadius*Math.cos(i*2*Math.PI/segments),openingRadius*Math.sin(i*2*Math.PI/segments))));
  const ids=[contour,...rings].flat().map(p=>vertex([p.x,y,p.y]));
  for(const t of THREE.ShapeUtils.triangulateShape(contour,rings))triangle(...t.map(i=>ids[i]),[0,Math.sign(y),0]);
 };
 cap(depth/2+offsetY,[]);cap(-openingDepth,[-offset,offset]);
 wall([ring(radius,-openingDepth),ring(radius,depth/2+offsetY)],0,false);
 for(const x of [-offset,offset]){
  const rings=[ring(openingRadius,-openingDepth,x),ring(seatRadius,0,x)];
  for(let i=1;i<steps;i++){const a=i*Math.PI/(2*steps);rings.push(ring(seatRadius*Math.cos(a),seatRadius*Math.sin(a),x));}
  wall(rings,x,true);
  const pole=vertex([x,seatRadius,0]),last=rings.at(-1);
  for(let i=0;i<segments;i++)triangle(last[i],last[(i+1)%segments],pole,[0,-1,0]);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 geometry.userData={outerRadius:radius,depth,offset,ballRadius,seatRadius,openingRadius,openingDepth,offsetY,sign,segments,steps};
 return geometry;
}
