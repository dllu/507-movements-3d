import * as THREE from 'three';
import {makeWaterGovernorBevels} from './bevel-train.js';

// Native collision uses the convex hull of each actual conical body. Filling
// its bore is harmless for this contact pair: the pin's minimum radius (.16)
// exceeds the bore (.155), and all shaft/link contacts with this hull are off.
export function waterGovernorBackingAssets(){
 const v=makeWaterGovernorBevels();
 try{
  const apex=new THREE.Vector3(...v.root.userData.parameters.lowerApex);
  return ['upper','lower'].flatMap(name=>['Body','Tooth0'].map(kind=>{
   const mesh=v.root.userData.parts[name+'Loose'+kind],p=mesh.geometry.attributes.position,vertices=[];
   for(let i=0;i<p.count;i++)vertices.push(...new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).sub(apex).toArray());
   return `<mesh name="${name}-${kind==='Body'?'backing':'tooth'}-mesh" vertex="${vertices.join(' ')}"/>`;
  })).join('');
 }finally{v.dispose();}
}
