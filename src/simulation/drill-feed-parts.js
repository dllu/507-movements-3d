import * as THREE from 'three';
import {circle,plate,poly,polygonClipping as clip} from './finite-plate-geometry.js';
import {boredCylinderGeometry} from './piston-guide-parts.js';
import {helicalThread,threadAngles} from './mujoco-screw/thread-geometry.js';

export function boreBoxY(mesh,radius,offsetX=0){
 const p=mesh.geometry.parameters;
 const section=clip.difference(poly([[-p.width/2,-p.depth/2],[p.width/2,-p.depth/2],[p.width/2,p.depth/2],[-p.width/2,p.depth/2]]),poly(circle([offsetX,0],radius,64)));
 mesh.geometry.dispose();mesh.geometry=plate(section,-p.height/2,p.height/2).rotateX(-Math.PI/2);
}
export function replaceYJournal(mesh,outer,bore,length){
 mesh.geometry.dispose();mesh.geometry=boredCylinderGeometry(outer,bore,length);
}
// The helix is mapped from local Z to world Y. Three's positive Y rotation
// decreases the XZ azimuth, so negative local lead preserves advance=-lead*angle.
export function closeFeedThread(thread,nut,{inner,outer,low,high,lead,feedBaseY,nutY,nutLength}){
 const profile={inner,outer,low,high,width:lead/2,lead:-lead/(2*Math.PI),phase:low};
 thread.geometry.dispose();thread.geometry=helicalThread(profile,threadAngles(profile,64)).rotateX(-Math.PI/2);
 const mate={inner:inner+.004,outer:outer+.004,low:-nutLength/2,high:nutLength/2,width:lead/2-.006,lead:profile.lead,phase:low+feedBaseY-nutY+lead/2};
 const nutThread=new THREE.Mesh(helicalThread(mate,threadAngles(mate,64)).rotateX(-Math.PI/2),nut.material);
 nutThread.userData.role='complementary-fixed-nut-thread';nut.add(nutThread);
 thread.userData.threadProfile=profile;
 return nutThread;
}
