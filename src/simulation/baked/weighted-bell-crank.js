import * as THREE from 'three';
import {loadBakedBundle,makeBakedRigidMovement} from './playback.js';
import {weightedCordGeometry,updateWeightedCord} from '../mujoco-weighted-bell-crank/sync.js';
export function makeWeightedBellCrankModel(bundle){
 const model=makeBakedRigidMovement(bundle,{mechanism:'passive-three-stud-weighted-bell-crank',slideAxes:{weight:'y'},note:'Three disk studs lift the weight through an elbow and a cord over the pulley. Cord tension returns the elbow onto a stop. The stop, bearings and rope fittings are reconstructed; the weight follows an ideal vertical guide.'});
 const g=bundle.cordGeometry,cord=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshStandardMaterial({color:0x41413b,roughness:.65,metalness:.12,fog:false}));
 cord.name='weighted-cord';cord.castShadow=true;cord.receiveShadow=true;model.root.add(cord);
 const rigidUpdate=model.update;
 model.update=time=>{rigidUpdate(time);const state=model.root.userData.state;updateWeightedCord(cord,g,model.root.userData.blocks.weight.position.y,weightedCordGeometry(g,state.qpos.lever));};
 model.reset=()=>model.update(0);model.root.userData.cameraFov=18;model.root.userData.reconstructionStatus='reconstructed';model.update(0);return model;
}
export async function makeBakedWeightedBellCrank(){return makeWeightedBellCrankModel(await loadBakedBundle(new URL('./assets/154.json.gz',import.meta.url)));}
