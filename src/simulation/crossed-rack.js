import * as THREE from 'three';
import profile from '../data/crossed-rack-profile.js';
import {makeCrossedRackGeometry} from './crossed-rack-geometry.js';
import {sampleCrossedRackMotion} from './crossed-rack-motion.js';
import {backBar,footPillar,pinBoss,slideSleeve,supportMaterial} from './back-plate-support.js';

export function makeCrossedRackDrive(){
 const model=makeCrossedRackGeometry(profile.geometry),u=model.root.userData;
 Object.assign(u,{profile,reconstructionStatus:'rebuilt',playbackPeriod:profile.playbackPeriod,playbackDuration:profile.playbackDuration,
  animationTiming:{authoredCyclePeriod:profile.playbackPeriod},minimumDisplayCycleSeconds:profile.playbackPeriod,
  sampledMotionBounds:profile.motionBounds,stateAtTime:sampleCrossedRackMotion,
  // Frame Brown's crop: the complete stem runs on below it.
  cameraFitBounds:new THREE.Box3(new THREE.Vector3(...profile.motionBounds.min),new THREE.Vector3(...profile.motionBounds.max)),
  qualification:'Measured source contours, joint centers and sixteen teeth per side follow the engraving. Axial layers, concealed hook-toe relief, pin construction and regular pitch reconstruct details absent or irregular in the source.',
  idealConstraints:'Only the lever is prescribed. An ideal prismatic rack constraint imposes the source-described straight path; the shaft and slot alone are not claimed to form a complete linear guide. Gravity, moving-pivot inertia, viscous drag and finite frictionless tooth contact determine rack height and both free pawl angles. Common density, zero extra payload, input amplitude and period are reconstruction assumptions. Startup seating, physical handoff rollback and finite whole-rack lift are retained. The eight-second physical input cycle plays in four seconds. Input stops at a zero-speed reversal after nine display seconds; the ten-second demonstration holds its final pose for explicit replay.'});
 // Brown draws no frame. The fixed fulcrum runs back into a boss on a plain
 // back bar hidden behind the rack; below Brown's crop the stem slides in a
 // closed guide channel that always holds its square end, and the bar
 // stands on a foot below the channel.
 const g=u.geometry,sx=x=>(x-g.center[0])/g.scale,stemLeft=sx(556),stemRight=sx(683),stemX=(stemLeft+stemRight)/2,
  stemWidth=stemRight-stemLeft,zBack=-.52,barX=.24,guideTop=-5.3,guideBottom=-7.05,floorY=-7.3,wall=.06,
  supports=new THREE.Group();supports.name='backBarSupports';
 const guide=slideSleeve({center:new THREE.Vector3(stemX,(guideTop+guideBottom)/2,0),axis:'y',length:guideTop-guideBottom,
  innerWidth:stemWidth+.03,innerDepth:.15,wall,zWall:zBack,role:'stem-guide-channel'});
 const floorPlate=new THREE.Mesh(new THREE.BoxGeometry(stemWidth+.03+2*wall,wall,.15+2*wall),supportMaterial());
 floorPlate.position.set(stemX,guideBottom-wall/2,0);floorPlate.name='stem-guide-channel-bottom';
 supports.add(backBar([{x:0,y:0},{x:barX,y:0},{x:barX,y:guideBottom}],{zFront:zBack,width:.2,role:'back-bar'}),
  pinBoss({x:0,y:0,radius:.095,zBack,zFront:-.298,role:'fulcrum-boss'}),guide,floorPlate,
  footPillar({x:barX,yTop:guideBottom,yFloor:floorY,z:zBack-.05,width:.2,footDepth:.6,role:'back-bar-foot'}));
 u.blocks.fixed.add(supports);
 model.update=time=>{const state=sampleCrossedRackMotion(time);u.setState(state);Object.assign(u.kinematics,state);};
 model.update(0);return model;
}
