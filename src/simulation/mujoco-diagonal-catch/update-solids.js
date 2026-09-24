import * as THREE from 'three';

// Brown sections every back-weight rod at the lower edge of the drawing, the
// same fixed line that cuts the piston rod. Each rod hangs from its moving eye
// and is trimmed to that line in every pose.
export const DIAGONAL_CATCH_ROD_EDGE_Y=(234-500)*.0125;

export function makeDiagonalCatchUpdater(root){
 const names=['upper','lower','catch','piston','upperWeight','lowerWeight','catchWeight'];
 const groups=Object.fromEntries(names.map(n=>[n,root.getObjectByName('body:'+n)]));
 const section=root.getObjectByName('sectioned-piston-rod');
 const anchors=Object.fromEntries(['upperWeight','lowerWeight','catchWeight'].map(n=>[n,root.getObjectByName('anchor:'+n)]));
 if(!section||Object.values({...groups,...anchors}).some(v=>!v))throw new Error('Incomplete diagonal-catch assembly');
 const rods=Object.fromEntries(Object.keys(anchors).map(n=>{
  const rod=groups[n].children.find(o=>o.isMesh&&/vertical-rod/.test(o.name));
  if(!rod?.geometry.parameters?.height)throw new Error('Missing diagonal-catch weight rod');
  return[n,rod];
 }));
 const point=new THREE.Vector3();
 return q=>{
  groups.upper.rotation.z=q[0];groups.lower.rotation.z=q[1];groups.catch.rotation.z=q[2];
  groups.piston.position.y=q[3];section.position.y=-q[3];root.updateMatrixWorld(true);
  for(const [name,anchor]of Object.entries(anchors)){
   root.worldToLocal(anchor.getWorldPosition(point));point.z+=.24;groups[name].position.copy(point);
   // The rod butts against the underside of its eye ring (outer radius .14).
   const rod=rods[name],length=Math.max(.02,point.y-.14-DIAGONAL_CATCH_ROD_EDGE_Y);
   rod.scale.y=length/rod.geometry.parameters.height;rod.position.y=-.14-length/2;
  }
  root.updateMatrixWorld(true);root.userData.kinematics={upper:q[0],lower:q[1],catch:q[2],piston:q[3]};
 };
}
