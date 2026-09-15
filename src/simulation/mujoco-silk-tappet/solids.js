import * as THREE from 'three';
import {matte, PALETTE, markShadows} from '../primitives.js';
import {disposeObject3D} from '../dispose-model.js';

// Contact-study solids, in the native carrier coordinates. These dimensions
// match the sphere, cylinder and boxes in physics.js, without visual erosion.
export function makeSilkTappetSolids(parameters) {
  const root=new THREE.Group(),carrier=new THREE.Group(),wheel=new THREE.Group(),parts={};
  carrier.name='carrier';wheel.name='wheel';wheel.position.x=parameters.station;
  root.add(carrier);carrier.add(wheel);
  const add=(name,geometry,parent,color)=>{
    const material=matte(color);material.fog=false;
    const mesh=new THREE.Mesh(geometry,material);mesh.name=name;parts[name]=mesh;parent.add(mesh);return mesh;
  };
  const hub=add('hub',new THREE.CylinderGeometry(.395,.395,.11,128),wheel,PALETTE.brass);
  hub.rotation.z=Math.PI/2;
  for(let i=0;i<parameters.teeth;i++) {
    const a=i*parameters.pitch+parameters.phase;
    const tooth=add('tooth'+i,new THREE.BoxGeometry(.11,.09,.044),wheel,PALETTE.brass);
    tooth.position.set(0,.435*Math.cos(a),.435*Math.sin(a));tooth.rotation.x=a;
  }
  const tappet=add('tappet',new THREE.SphereGeometry(.025,32,24),root,PALETTE.frame);
  tappet.position.set(parameters.station,0,parameters.height);
  const update=state=>{carrier.rotation.z=state.carrier;wheel.rotation.x=state.wheel;root.updateMatrixWorld(true);};
  markShadows(root);root.userData.hideGround=true;
  return {root,parts,update,dispose:()=>disposeObject3D(root)};
}
