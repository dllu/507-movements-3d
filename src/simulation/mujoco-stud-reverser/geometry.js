import * as THREE from 'three';
import {createAuthoredStudDriveMovement} from '../authored-stud-drives.js';
import {plate,poly,circle,polygonClipping as clip} from '../finite-plate-geometry.js';
import {disposeObject3D} from '../dispose-model.js';

// Reconstruction hypothesis: raise the inner input arm above the disk studs,
// retaining only its distal driving face at the original working depth.
export function makeRelievedStudReverser({inputContactMinimum=1.4}={}){
 const model=createAuthoredStudDriveMovement({id:153}),u=model.root.userData,b=u.blocks,g=u.geometry,arm=b.inputArm;
 const material=arm.children[0].material,L=g.leverInputLength,h=g.leverInputHalfWidth;
 if(!(inputContactMinimum>h&&inputContactMinimum<L-h))throw new RangeError('Invalid relieved arm length');
 for(const mesh of [...arm.children]){arm.remove(mesh);mesh.geometry.dispose();}
 const rectangle=(l,r)=>poly([[l,-h],[r,-h],[r,h],[l,h]]);
 const working=new THREE.Mesh(plate(clip.union(rectangle(inputContactMinimum,L),poly(circle([L,0],h,96))),-.10,.34),material);
 working.name='distal-input-driving-face';
 const raised=new THREE.Mesh(plate(rectangle(0,inputContactMinimum),.14,.34),material);raised.name='raised-inner-input-arm';
 arm.add(working,raised);arm.userData.blocks={working,raised};g.inputContactMinimum=inputContactMinimum;
 u.hideGround=true;u.cameraFov=18;u.supportsRestart=true;
 model.cameraDirection.set(.02,.03,15);model.reset=()=>model.update(0);model.dispose=()=>disposeObject3D(model.root);
 model.root.updateMatrixWorld(true);return model;
}
