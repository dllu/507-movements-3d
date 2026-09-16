import * as THREE from 'three';
import {makeSolidWorm} from './solid-worm.js';
import {makeInstancedWormWheel} from './instanced-worm-wheel.js';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {specialWormParameters} from './special-worm-parameters.js';
import {specialWormCuts} from '../data/special-worm-wheel-profiles.js';
export function makeSpecialWormWheel(id,boreRadius,material){
 const mesh=makeInstancedWormWheel(specialWormParameters[id],specialWormCuts[id],boreRadius,material);
 mesh.userData.profile='offline-synchronized-finite-worm-envelope';
 mesh.userData.clearance=specialWormCuts[id].clearance;return mesh;
}
export function correctGloboidalWorm(root){
 const b=root.userData.blocks,p=specialWormParameters[202],virtualLength=2*p.pitchRadius*.6;
 const source=makeSolidWorm({length:virtualLength,radius:p.wormRadius,pitch:p.wormPitch,shaftRadius:.085,handedness:-1,angularSteps:128});
 const geometry=source.userData.thread.geometry;
 geometry.rotateZ(Math.PI*virtualLength/p.wormPitch+Math.PI/2);
 const position=geometry.attributes.position;
 for(let i=0;i<position.count;i++){
  const x=position.getX(i),y=position.getY(i),s=position.getZ(i),r=Math.hypot(x,y),beta=s/p.pitchRadius;
  const addition=r>.087?p.pitchRadius*(1-Math.cos(beta)):0;
  position.setXYZ(i,x*(r+addition)/r,y*(r+addition)/r,p.pitchRadius*Math.sin(beta));
 }
 geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 b.wormThread.geometry.dispose();b.wormThread.geometry=geometry;b.wormThread.material.color.copy(b.wormBody.material.color);
 b.wormThread.userData.integralThread=true;b.wormThread.userData.boreRadius=.086;
 b.wormBody.visible=false;b.wormBody.userData.replacedByIntegralThread=true;
 source.userData.thread.material.dispose();
 const rotor=b.wheel.userData.rotor,old=rotor.children[0];
 const wheel=makeSpecialWormWheel(202,.107,old.material);old.removeFromParent();old.geometry.dispose();rotor.add(wheel);b.generatedWheel=wheel;
 rotor.children.find(m=>m.geometry?.type==='TorusGeometry')?.removeFromParent();
 const hub=rotor.children.find(m=>m.geometry?.type==='CylinderGeometry');
 const hp=hub.geometry.parameters;hub.geometry.dispose();hub.geometry=boredLatheGeometry([{radial:hp.radiusTop,axial:-hp.height/2},{radial:hp.radiusTop,axial:hp.height/2}],.107,64);hub.userData.boreRadius=.107;
 b.wheel.userData.toothProfile=wheel.userData.profile;
 for(const object of[b.baseRail,b.rearPost,b.wheelBearingBridge,...b.wormBearings,...b.wormBearingSupports])object.removeFromParent();
 for(const marker of b.contactMarkers)marker.removeFromParent();
 root.traverse(o=>{for(const material of(Array.isArray(o.material)?o.material:[o.material]))if(material)material.fog=false;});
 root.userData.hideGround=true;root.userData.materialsIgnoreSceneFog=true;
 root.userData.cameraFitBounds=new THREE.Box3(new THREE.Vector3(-2.55,-2.48,-.8),new THREE.Vector3(2.55,2.9,.8));
 root.userData.reconstructionNote='The single-start hourglass worm advances the 60-tooth wheel one tooth per turn. The concave form follows the engraving; thread section, working widths and shaft fits are reconstructed.';
 root.userData.contactQualification={method:'offline finite synchronized cutter envelope',loadedContactCount:'not established',clearance:specialWormCuts[202].clearance};
}
