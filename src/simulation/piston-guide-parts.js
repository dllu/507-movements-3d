import * as THREE from 'three';
import {boredLatheGeometry} from './bored-lathe-geometry.js';

export function boredCylinderGeometry(radius,bore,length) {
  return boredLatheGeometry([{axial:-length/2,radial:radius},{axial:length/2,radial:radius}],bore,64);
}

export function boredJournal(radius,bore,length,material) {
  const mesh=new THREE.Mesh(boredCylinderGeometry(radius,bore,length),material);
  mesh.rotation.x=Math.PI/2;
  return mesh;
}

export function fitPistonGuide(root,update,period) {
  root.userData.hideGround=true;
  root.traverse(o=>{for(const material of [].concat(o.material??[]))material.fog=false;});
  const bounds=new THREE.Box3();
  for(let i=0;i<=64;i++) {
    update(period*i/64);root.updateMatrixWorld(true);
    // Parts run on past Brown's crop (userData.beyondPlateCrop) stay out of the fit.
    root.traverse(o=>{if(!o.isMesh)return;for(let p=o;p;p=p.parent)if(p.userData.beyondPlateCrop)return;bounds.union(new THREE.Box3().setFromObject(o));});
  }
  root.userData.cameraFitBounds=bounds.expandByScalar(.03);
  root.userData.cameraDistanceScale=1.02;
  update(0);
}
