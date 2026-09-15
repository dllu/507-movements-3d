import * as THREE from 'three';

export function makeDiagonalCatchUpdater(root){
 const names=['upper','lower','catch','piston','upperWeight','lowerWeight','catchWeight'];
 const groups=Object.fromEntries(names.map(n=>[n,root.getObjectByName('body:'+n)]));
 const section=root.getObjectByName('sectioned-piston-rod');
 const anchors=Object.fromEntries(['upperWeight','lowerWeight','catchWeight'].map(n=>[n,root.getObjectByName('anchor:'+n)]));
 if(!section||Object.values({...groups,...anchors}).some(v=>!v))throw new Error('Incomplete diagonal-catch assembly');
 const point=new THREE.Vector3();
 return q=>{
  groups.upper.rotation.z=q[0];groups.lower.rotation.z=q[1];groups.catch.rotation.z=q[2];
  groups.piston.position.y=q[3];section.position.y=-q[3];root.updateMatrixWorld(true);
  for(const [name,anchor]of Object.entries(anchors)){
   root.worldToLocal(anchor.getWorldPosition(point));point.z+=.24;groups[name].position.copy(point);
  }
  root.updateMatrixWorld(true);root.userData.kinematics={upper:q[0],lower:q[1],catch:q[2],piston:q[3]};
 };
}
