import * as THREE from 'three';

// Lower edge of Brown's drawing. The whole back-weight rods and the piston
// rod are long enough that their ends stay beyond it in every pose.
export const DIAGONAL_CATCH_ROD_EDGE_Y=(234-500)*.0125;

export function makeDiagonalCatchUpdater(root){
 const names=['upper','lower','catch','piston','upperWeight','lowerWeight','catchWeight'];
 const groups=Object.fromEntries(names.map(n=>[n,root.getObjectByName('body:'+n)]));
 const anchors=Object.fromEntries(['upperWeight','lowerWeight','catchWeight'].map(n=>[n,root.getObjectByName('anchor:'+n)]));
 if(Object.values({...groups,...anchors}).some(v=>!v))throw new Error('Incomplete diagonal-catch assembly');
 const point=new THREE.Vector3();
 return q=>{
  groups.upper.rotation.z=q[0];groups.lower.rotation.z=q[1];groups.catch.rotation.z=q[2];
  groups.piston.position.y=q[3];root.updateMatrixWorld(true);
  for(const [name,anchor]of Object.entries(anchors)){
   // Each rod hangs straight from its eye, carrying its weight below.
   root.worldToLocal(anchor.getWorldPosition(point));point.z+=.24;groups[name].position.copy(point);
  }
  root.updateMatrixWorld(true);root.userData.kinematics={upper:q[0],lower:q[1],catch:q[2],piston:q[3]};
 };
}
