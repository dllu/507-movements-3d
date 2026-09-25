import * as THREE from 'three';
import {backBar,footPillar,pinBoss,supportMaterial} from './back-plate-support.js';
import profile from '../data/spring-rack-profile.js';
import {makeSpringRackGeometry} from './spring-rack-geometry.js';
import {makeSpringRackPlayback} from './spring-rack-motion.js';

export function makeSpringRackDrive(){
 const model=makeSpringRackGeometry(profile.geometry),u=model.root.userData,motion=makeSpringRackPlayback(model,profile);
 Object.assign(u,{profile,motion,reconstructionStatus:'rebuilt',playbackPeriod:motion.displayPeriod,
  animationTiming:{authoredCyclePeriod:motion.displayPeriod},minimumDisplayCycleSeconds:motion.displayPeriod,
  stateAtTime:motion.sample,sampledMotionBounds:profile.motionBounds,
  idealConstraints:'Only the mutilated gear rotation is prescribed. Rack inertia, gravity, a compression spring, viscous guide resistance and finite tooth contact determine the lift and return. The six involute gear teeth and seven rack teeth regularize the engraving. The hollow rack, concealed sliding mandrel, rear travel-stop pin and slot, spring-end shaping, pressure angle and load parameters reconstruct details not specified in the drawing. The two-second physical cycle plays in four seconds. Startup motion is retained, followed by the repeating settled cycle.'});
 // Brown draws no frame. The fixed spring seat, lower rack guide, travel-stop
 // pin and gear axle are carried on a plain back bar hidden behind the rack
 // and the gear, standing on a foot below the rack's lowest reach.
 const parts=u.parts,box=name=>new THREE.Box3().setFromObject(parts[name]),zBack=-.3,bx=-1.327,
  seat=box('upperSpringSeat'),guide=box('lowerRackGuide'),stop=parts.fixedTravelStopPin.position,supports=new THREE.Group();
 supports.name='backBarSupports';
 const web=(b,role)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(.3,b.max.y-b.min.y,b.min.z-zBack),supportMaterial());
  m.position.set(bx,(b.min.y+b.max.y)/2,(b.min.z+zBack)/2);m.name=role;return m;};
 supports.add(backBar([{x:bx,y:(seat.min.y+seat.max.y)/2},{x:bx,y:-5.45}],{zFront:zBack,width:.24,role:'back-bar'}),
  backBar([{x:bx,y:0},{x:0,y:0}],{zFront:zBack,width:.24,role:'axle-arm'}),
  web(seat,'spring-seat-web'),web(guide,'rack-guide-web'),
  pinBoss({x:0,y:0,radius:.2,zBack,zFront:-.135,role:'axle-boss'}),
  pinBoss({x:stop.x,y:stop.y,radius:.043,zBack,zFront:-.125,role:'travel-stop-boss'}),
  footPillar({x:bx,yTop:-5.45,yFloor:-5.55,z:zBack-.05,width:.24,footDepth:.6,role:'back-bar-foot'}));
 model.root.add(supports);
 model.update=time=>{const state=motion.sample(time);model.setState(state);Object.assign(u.kinematics,state);};
 model.update(0);return model;
}
