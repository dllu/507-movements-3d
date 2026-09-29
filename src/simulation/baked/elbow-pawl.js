import * as THREE from 'three';
import {loadBakedBundle,makeBakedRigidMovement} from './playback.js';
export function makeElbowPawlModel(bundle){
 const note='The pinned rod rocks the elbow, and the pawl feeds the wheel by tooth contact. Choosing the other installation reverses the feed. The pawl is turned over and remounted; supports, the upper input guide, tooth spacing and resisting load are reconstructed.';
 const models=Object.fromEntries(Object.entries(bundle.installations).map(([side,b])=>[side,makeBakedRigidMovement(b,{mechanism:'passive-elbow-pawl-feed',slideAxes:{slider:'y'},note})]));
 const root=new THREE.Group(),bounds=new THREE.Box3();for(const model of Object.values(models)){root.add(model.root);bounds.union(model.root.userData.cameraFitBounds);}
 root.traverse(o=>{if(o.material)o.material.fog=false;});
 // p101: the pinned input rod was the lever's own orange and read as part of
 // it where they overlap at the joint; it is shown in steel grey.
 for(const model of Object.values(models))model.root.traverse(o=>{if(o.name!=='body:rod'&&o.name!=='body:slider')return;o.traverse(m=>{if(!m.isMesh)return;m.material=[].concat(m.material).map(mat=>{const c=mat.clone();c.color.setHex(0x7e8584);return c;});if(m.material.length===1)m.material=m.material[0];});});
 let side='right',disposed=false;
 Object.assign(root.userData,models.right.root.userData,{cameraFov:18,cameraFitBounds:bounds,configuration:'right',configurationLabel:'Pawl installation',configurations:[{id:'right',label:'Right — as engraved'},{id:'left',label:'Left — turned over'}],reconstructionStatus:'reconstructed'});
 const update=time=>{if(disposed)throw new Error('Movement has been disposed');const model=models[side];model.update(time);root.userData.state=model.root.userData.state;root.userData.blocks=model.root.userData.blocks;};
 root.userData.setConfiguration=value=>{if(!models[value])throw new RangeError('Unknown pawl installation');side=value;root.userData.configuration=value;for(const [name,m]of Object.entries(models))m.root.visible=name===side;update(0);};
 root.userData.setConfiguration('right');
 return{root,focus:bounds.getCenter(new THREE.Vector3()),cameraDirection:new THREE.Vector3(.02,.03,15),update,reset:()=>update(0),dispose:()=>{if(disposed)return;disposed=true;for(const model of Object.values(models))model.dispose();}};
}
export async function makeBakedElbowPawl(){return makeElbowPawlModel(await loadBakedBundle(new URL('./assets/155.json.gz',import.meta.url)));}
