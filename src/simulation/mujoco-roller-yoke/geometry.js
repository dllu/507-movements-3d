import * as THREE from 'three';
import source from './source.js';
import {makeRollerYokeProfile} from './profile.js';
import {plate,poly,circle,disk,ring,capsule,polygonClipping as clip} from '../finite-plate-geometry.js';
import {convexPlateCells} from '../mujoco/convex-plate.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
export {THREE};
export function makeRollerYokeGeometry(options={}){
 const root=new THREE.Group(),parts={},families={},blocks={},profile=makeRollerYokeProfile(options),s=source,L=s.lines,R=s.meanPitchRadius,roller=s.rollerRadius,railZ=.35;
 for(const name of ['input','yoke','upper','lower','fixed']){blocks[name]=new THREE.Group();root.add(blocks[name]);}
 const add=(name,g,family,color,pos=[0,0,0])=>{const m=new THREE.Mesh(g,matte(color,{metalness:.18,roughness:.55}));m.name=name;m.position.fromArray(pos);blocks[family].add(m);parts[name]=m;families[name]=family;return m;};
 const xy=([x,y])=>[(x-s.axis[0])/100,(s.rollerMidpointY-y)/100],rect=(x0,y0,x1,y1)=>poly([[x0,y0],[x1,y0],[x1,y1],[x0,y1]].map(xy));
 const cam=clip.difference(poly(profile.points),poly(circle([0,0],s.shaftRadius,192)));add('cam',plate(cam,-.12,.12),'input',PALETTE.driver);add('shaft',disk(s.shaftRadius,-.24,.24,192),'input',PALETTE.ink);
 const upperY=(s.rollerMidpointY-L.topCrossbarBottom)/100,lowerY=(s.rollerMidpointY-L.bottomCrossbarTop)/100;
 const leftX=(L.leftRailLeft+L.leftRailRight)/2,rightX=(L.rightRailLeft+L.rightRailRight)/2;
 add('leftRail',plate(rect(L.leftRailLeft,L.topCrossbarBottom,L.leftRailRight,L.bottomCrossbarTop),railZ-.06,railZ+.06),'yoke',PALETTE.driven);
 add('rightRail',plate(rect(L.rightRailLeft,L.topCrossbarBottom,L.rightRailRight,L.bottomCrossbarTop),railZ-.06,railZ+.06),'yoke',PALETTE.driven);
 // Cheeks occupy only the front layer, meeting the rails without doubled volume.
 add('leftCheek',plate(rect(L.leftCheekLeft,162,L.leftCheekRight,229),railZ+.06,railZ+.115),'yoke',PALETTE.driven);
 add('rightCheek',plate(rect(L.rightCheekLeft,162,L.rightCheekRight,229),railZ+.06,railZ+.115),'yoke',PALETTE.driven);
 add('upperBar',plate(rect(83,L.topCrossbarTop,180,L.topCrossbarBottom),.24,.46),'yoke',PALETTE.driven);
 add('lowerBar',plate(rect(84,L.bottomCrossbarTop,177,L.bottomCrossbarBottom),.24,.46),'yoke',PALETTE.driven);
 // Small collars preserve the visible rail fasteners at the two crossbars.
 for(const [end,y0,y1]of [['Upper',L.topCrossbarBottom,L.topCrossbarBottom+8],['Lower',L.bottomCrossbarTop-6,L.bottomCrossbarTop]])for(const [side,x]of [['Left',leftX],['Right',rightX]]){
  add(side+end+'Collar',plate(rect(x-9,y0,x+9,y1),.41,.46),'yoke',PALETTE.driven);
 }
 for(const [side,x]of [['Left',leftX],['Right',rightX]]){
  add(side+'Nut',plate(rect(x-6,L.bottomCrossbarBottom,x+6,L.bottomCrossbarBottom+6),.24,.46),'yoke',PALETTE.driven);
  add(side+'BoltEnd',disk(.03,(s.rollerMidpointY-L.bottomCrossbarBottom-11)/100,(s.rollerMidpointY-L.bottomCrossbarBottom-6)/100,48),'yoke',PALETTE.ink,[(x-s.axis[0])/100,0,railZ]).rotation.x=-Math.PI/2;
 }
 for(const [name,sign]of [['upper',1],['lower',-1]]){
  const y=sign*R,pinRadius=name==='upper'?.0376:.0405;
  add(name+'Roller',ring(pinRadius+.001,roller,-.20,.20,192),name,PALETTE.brass);
  const barY=sign>0?upperY:lowerY,foot=(x)=>[(x-s.axis[0])/100,barY];
  const legs=clip.union(capsule(foot(106),[-.06,y+sign*.06],.012,24),capsule(foot(155),[.06,y+sign*.06],.012,24),poly(circle([0,y],.103,96)));
  const boundary=poly([[-1,Math.min(barY,y)-.12],[1,Math.min(barY,y)-.12],[1,Math.max(barY,y)+.12],[-1,Math.max(barY,y)+.12]]);
  const trim=sign>0?poly([[-1,-3],[1,-3],[1,barY],[-1,barY]]):poly([[-1,barY],[1,barY],[1,3],[-1,3]]);
  const fork=clip.difference(clip.intersection(legs,boundary,trim),poly(circle([0,y],pinRadius,64)));
  add(name+'Fork',plate(fork,.24,.29),'yoke',PALETTE.driven);
  add(name+'Pin',disk(pinRadius,-.205,.31,64),'yoke',PALETTE.ink,[0,y,0]);
  blocks[name].position.set(0,y+s.initialQ,0);
 }
 const stemRadius=.097,stemTop=(s.rollerMidpointY-27)/100,stemUpperBottom=(s.rollerMidpointY-L.topCrossbarTop)/100,stemLowerTop=(s.rollerMidpointY-330)/100,stemEnd=(s.rollerMidpointY-479)/100;
 const alongY=(name,r,lo,hi,family,color)=>add(name,disk(r,lo,hi,96),family,color,[0,0,railZ]).rotateX(-Math.PI/2);
 alongY('upperStem',stemRadius,stemUpperBottom,stemTop,'yoke',PALETTE.driven);
 alongY('lowerStem',stemRadius,stemEnd,stemLowerTop,'yoke',PALETTE.driven);
 alongY('lowerCollar',.20,(s.rollerMidpointY-323)/100,(s.rollerMidpointY-L.bottomCrossbarBottom)/100,'yoke',PALETTE.driven);
 alongY('lowerBoss',.155,stemLowerTop,(s.rollerMidpointY-323)/100,'yoke',PALETTE.driven);
 const guideCenter=(s.axis[1]-(L.lowerGuideTop+L.lowerGuideBottom)/2)/100,guideHalf=(L.lowerGuideBottom-L.lowerGuideTop)/200;
 const guide=clip.difference(poly([[-.48,-.19],[.48,-.19],[.48,.19],[-.48,.19]]),poly(circle([0,0],stemRadius+.003,96)));
 add('guide',plate(guide,-guideHalf,guideHalf),'fixed',PALETTE.muted,[0,guideCenter,railZ]).rotation.x=Math.PI/2;
 blocks.yoke.position.y=s.initialQ;
 const camGeometry=parts.cam.geometry;
 Object.assign(root.userData,{source:s,profile,parts,families,blocks,geometry:{rollerRadius:roller,rollerZHalf:.20,meanPitchRadius:R,stemRadius,stemEnd,stemLowerTop,guideCenter,guideHalf,railZ},hideGround:true,shadowCameraHalfExtent:4,shadowNormalBias:.0005,shadowBias:-.00002});
 // Collision cells are for the live simulation only; baked playback never
 // reads them, so they are decomposed on first use (as in 113).
 Object.defineProperty(root.userData,'collision',{configurable:true,enumerable:true,get(){const collision=convexPlateCells(camGeometry);Object.defineProperty(root.userData,'collision',{value:collision,writable:true,configurable:true,enumerable:true});return collision;}});
 markShadows(root);root.updateMatrixWorld(true);const bounds=new THREE.Box3();for(const q of [profile.minimum,profile.maximum]){blocks.yoke.position.y=q;blocks.upper.position.y=q+R;blocks.lower.position.y=q-R;root.updateMatrixWorld(true);bounds.union(new THREE.Box3().setFromObject(root,true));}blocks.yoke.position.y=s.initialQ;blocks.upper.position.y=s.initialQ+R;blocks.lower.position.y=s.initialQ-R;root.updateMatrixWorld(true);
 // Include the complete rotating cam envelope as well as the yoke stroke.
 const camR=Math.max(...profile.points.map(p=>Math.hypot(...p)));bounds.expandByPoint(new THREE.Vector3(-camR,-camR,-.24));bounds.expandByPoint(new THREE.Vector3(camR,camR,.24));bounds.expandByScalar(.025);root.userData.cameraFitBounds=bounds;
 return{root,focus:bounds.getCenter(new THREE.Vector3()),cameraDirection:new THREE.Vector3(2,1,10)};
}
