import * as THREE from 'three';
import {createAuthoredStudDriveMovement} from '../authored-stud-drives.js';
import {plate,poly,circle,ring,disk,polygonClipping as clip} from '../finite-plate-geometry.js';
import {disposeObject3D} from '../dispose-model.js';

/** Source outline, with inferred bores, connected fittings and a physical return stop. */
export function makeSupportedWeightedBellCrank(){
 const model=createAuthoredStudDriveMovement({id:154}),u=model.root.userData,b=u.blocks,g=u.geometry;
 // Preserve the engraving's slightly unequal stud spacing; contact sets each lift's timing.
 b.pinAssemblies.forEach((assembly,i)=>{const p=g.sourceStudCenters[i];assembly.position.set((p.x-g.sourceDiskCenter.x)*g.sourceScale,(g.sourceDiskCenter.y-p.y)*g.sourceScale,0);});
 const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;mesh.rotation.set(0,0,0);};
 replace(b.diskBody,ring(.134,g.diskRadius,-g.diskDepth/2,g.diskDepth/2,128));
 replace(b.diskHub,ring(.134,g.hubRadius,.10,.24,96));
 replace(b.diskHubFace,ring(.134,g.hubRadius*.48,-.020,.018,96));
 for(const assembly of b.pinAssemblies){const {pin,face}=assembly.userData.blocks;replace(pin,disk(g.studRadius,.13-pin.position.z,g.studFrontZ-pin.position.z,96));replace(face,disk(g.studRadius*.72,-.022,.020,96));}
 replace(b.leverPivotCollar,ring(.114,g.leverPivotRadius,-.18,.18,96));
 replace(b.leverPivotFace,ring(.114,g.leverPivotRadius*.52,-.035,0,96));
 for(const [arm,L,h] of [[b.inputArm,g.inputArmLength,g.inputArmHalfWidth],[b.outputArm,g.outputArmLength,g.outputArmHalfWidth]]){
  const material=arm.children[0].material;
  for(const mesh of [...arm.children])if(mesh!==b.outputEye){mesh.removeFromParent();mesh.geometry.dispose();}
  const shape=clip.difference(clip.union(poly([[0,-h],[L,-h],[L,h],[0,h]]),poly(circle([L,0],h,96))),poly(circle([0,0],g.leverPivotRadius+.0002,96)));
  const body=new THREE.Mesh(plate(shape,-.10,.10),material);arm.add(body);arm.userData.blocks={body};
 }
 // A projecting pin connects the output arm to the rope at its centerline.
 replace(b.outputEye,disk(.045,-.16,.036,64));
 replace(b.weightEye,ring(.028,.084,-.035,.035,64));b.weightEye.position.y=.588;
 const bore=.104,hub=g.pulleyHubRadius,core=g.pulleyPitchRadius-g.cordRadius-.002;
 replace(b.pulleyHub,ring(bore,hub,-.18,.18,96));
 replace(b.pulleyCore,ring(hub+.0001,core,-.0925,.0925,128));
 replace(b.pulleyRearFlange,ring(hub+.0001,g.pulleyOuterRadius,-.0275,.0275,128));
 replace(b.pulleyFrontFlange,ring(hub+.0001,g.pulleyOuterRadius,-.0275,.0275,128));
 replace(b.pulleyIndex,new THREE.BoxGeometry(.22,.055,.024));b.pulleyIndex.position.x=.32;
 b.pulleyIndex.position.z=g.cordPlaneZ+.1595;
 const fixedMaterial=b.fixedFrame.children[0].material;
 const fixed=(name,geometry)=>{const mesh=new THREE.Mesh(geometry,fixedMaterial);mesh.name=name;b.fixedFrame.add(mesh);return mesh;};
 const theta=-g.sourceLeverRestAngle,r=.08;
 const point=new THREE.Vector2(.70,-g.inputArmHalfWidth-r).rotateAround(new THREE.Vector2(),theta).add(new THREE.Vector2(g.leverPivot.x,g.leverPivot.y));
 b.leverStop=fixed('physical-weight-return-stop',disk(r,.36,.56,96).translate(point.x,point.y,0));
 fixed('return-stop-standoff',disk(.045,-.46,.36,64).translate(point.x,point.y,0));
 fixed('return-stop-back-bracket',plate(poly([[point.x,point.y-.06],[g.leverPivot.x,point.y-.06],[g.leverPivot.x,point.y+.06],[point.x,point.y+.06]]),-.52,-.40));
 u.hideGround=true;u.cameraFov=18;u.supportsRestart=true;
 model.cameraDirection.set(.02,.03,15);model.reset=()=>model.update(0);model.dispose=()=>disposeObject3D(model.root);
 model.root.updateMatrixWorld(true);return model;
}
