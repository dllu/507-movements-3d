import * as T from 'three';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {circle,poly,plate,polygonClipping as clip} from './finite-plate-geometry.js';
import {makeBoredPlanarLink} from './bored-planar-link.js';
import {fitPistonGuide} from './piston-guide-parts.js';
import {retainTraverseCord} from './cord-traverse-working-parts.js';
const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};
const ring=(r,b,l)=>boredLatheGeometry([{axial:-l/2,radial:r},{axial:l/2,radial:r}],b,72);
const add=(parent,geometry,material,role)=>{const m=new T.Mesh(geometry,material);m.userData.role=role;parent.add(m);return m;};
const role=(root,name)=>{let result;root.traverse(o=>{if(o.userData.role===name)result=o;});return result;};
function bandSheave(pulley,r,bore){
 const rotor=pulley.userData.rotor,material=pulley.userData.tread.material;
 for(const o of rotor.children)o.visible=false;
 const profile=[[-.105,r+.018],[-.053,r+.018],[-.043,r-.043],[.043,r-.043],[.053,r+.018],[.105,r+.018]].map(([axial,radial])=>({axial,radial}));
 const geometry=bore>0?boredLatheGeometry(profile,bore,128):new T.LatheGeometry([new T.Vector2(0,profile[0].axial),...profile.map(p=>new T.Vector2(p.radial,p.axial)),new T.Vector2(0,profile.at(-1).axial)],128);
 const body=add(rotor,geometry,material,'finite-recessed-band-sheave');body.rotation.x=Math.PI/2;body.position.z=.16;pulley.userData.workingGroove=body;
 const index=add(rotor,new T.BoxGeometry(r*.42,r*.045,.010),pulley.userData.faceIndicators[1].material,'white-face-spin-index');index.position.set(r*.48,0,.272);
}
export function correctReciprocatingCordParts(root,id,update){
 const d=root.userData,b=d.blocks,g=d.geometry;
 if(id===359){
  // The analytic radius is the cord centreline; reserve its finite radial thickness.
  replace(b.spindle,new T.CylinderGeometry(g.spindleRadius-.037,g.spindleRadius-.037,4.03,48));
  const sleeve=role(root,'loose-crossbar-guide-hole-around-spindle');replace(sleeve,ring(.24,g.spindleRadius-.033,.20));sleeve.rotation.set(0,0,0);
  for(const cord of b.cordBranches){retainTraverseCord(cord,.035,240);for(const marker of cord.userData.markers)marker.visible=false;}
  d.minimumDisplayCycleSeconds=8;
 }else if(id===374){
  bandSheave(b.eccentricPulley,g.eccentricPulleyRadius,0);bandSheave(b.treadleRoller,g.treadleRollerRadius,.074);
  // The solid eccentric disk is keyed to the offset shaft through a rear drive arm.
  const arm=add(b.shaftRotor,new T.BoxGeometry(g.eccentricity+.28,.23,.16),b.shaftPin.material,'eccentric-shaft-to-sheave-drive-arm');arm.position.set(-g.eccentricity/2,0,0);
  for(const [bearing,r,bore,length]of[[b.shaftBearing,.23,.109,.30],[b.treadlePivotBearing,.20,.079,.22]]){replace(bearing,ring(r,bore,length));bearing.rotation.x=Math.PI/2;}
  b.shaftBearing.position.z=-.15;b.treadlePivotBearing.position.z=-.21;
  replace(b.shaftPin,new T.CylinderGeometry(.105,.105,.90,40));replace(b.treadlePivotPin,new T.CylinderGeometry(.075,.075,.92,32));
  // Shorten the standards to support journal undersides instead of blocking the bores.
  for(const [post,axisY,r]of[[b.shaftPost,g.shaftCenter.y,.23],[b.pivotPost,g.treadlePivot.y,.20]]){
   const bottom=-2.57,top=axisY-r+.025,height=top-bottom;replace(post,new T.BoxGeometry(.24,height,.38));post.position.set(post.position.x,(bottom+top)/2,-.24);
  }
  const treadleBody=b.treadleBeam;
  const web=clip.difference(poly([[-.30,-.085],[g.treadleRadius+1.26,-.085],[g.treadleRadius+1.26,.085],[-.30,.085]]),poly(circle([0,0],.079,64)),poly(circle([g.treadleRadius,0],.074,64)));
  replace(treadleBody,plate(web,-.15,.15));treadleBody.position.x=0;
  replace(b.rollerAxle,new T.CylinderGeometry(.070,.070,.62,32));b.rollerAxle.position.z=.22;
  // Pin is behind the treadle web; the web's local fulcrum receives a real bearing eye.
  const eye=add(b.treadle,ring(.16,.079,.16),treadleBody.material,'bored-moving-treadle-fulcrum-eye');eye.rotation.x=Math.PI/2;eye.position.z=.16;
  d.minimumDisplayCycleSeconds=9;
 }else{
  const material=b.connectingRod.children[0].material;
  for(const child of b.connectingRod.children)child.visible=false;
  const rod=makeBoredPlanarLink({length:g.connectingRodLength,width:.16,eyeRadius:.185,boreRadius:.139,depth:.14},material);rod.userData.role='finite-bored-saw-connecting-rod';b.connectingRod.add(rod);
  const old=b.connectingRod.userData.setEndpoints;b.connectingRod.userData.setEndpoints=(a,c)=>{old(a,c);rod.userData.setEndpoints(new T.Vector3(a.x,a.y,.64),new T.Vector3(c.x,c.y,.64));};
  const crankPin=b.crankRotor.userData.crankPin;replace(crankPin,new T.CylinderGeometry(.135,.135,.96,40));crankPin.position.z=.14;
  const wrist=b.sawAssembly.userData.lowerWrist;replace(wrist,new T.CylinderGeometry(.13,.13,.82,40));wrist.position.z=.05;
  for(const rail of b.guideRails){rail.position.x=rail.userData.side*.38;rail.position.z=.28;}
  for(const table of b.tableParts){const outer=7.5*g.sourceScale,inner=.175,width=outer-inner;replace(table,new T.BoxGeometry(width,.20,2.15));table.position.x=Math.sign(table.position.x)*(outer+inner)/2;}
  const frameMaterial=b.tableParts[0].material;
  for(const x of[-.38,.38]){
   const bottom=-3.34,top=g.upperGuideTop;
   const post=add(b.frame,new T.BoxGeometry(.16,top-bottom,.20),frameMaterial,'rear-saw-guide-standard');post.position.set(x,(top+bottom)/2,-.78);
  }
  for(const rail of b.guideRails){const join=add(b.frame,new T.BoxGeometry(.105,.14,.82),frameMaterial,'guide-cheek-to-rear-standard');join.position.set(rail.position.x,rail.position.y,-.38);}
  const post=role(root,'fixed-crankshaft-bearing-standard');replace(post,new T.BoxGeometry(.24,.86,.30));post.position.y=-2.93;
  const journal=add(b.frame,ring(.25,.104,.30),frameMaterial,'bored-fixed-crankshaft-journal');journal.rotation.x=Math.PI/2;journal.position.set(0,g.crankCenter.y,-.45);
  const shaft=add(b.crankRotor,new T.CylinderGeometry(.10,.10,.95,40),b.crankRotor.userData.hub.material,'crankshaft-through-fixed-journal');shaft.rotation.x=Math.PI/2;shaft.position.z=-.32;
  b.workingRod=rod;b.workingJournal=journal;b.workingShaft=shaft;d.minimumDisplayCycleSeconds=5;
 }
 d.workingPartsReview={status:'selected-finite-interfaces',residual:id===359?'Cord pitch geometry remains prescribed, including a smoothed unwinding transition and common tied anchorage; flywheel energy, hand force, cord tension and terminal-knot contact are not solved.':id===374?'The source circle constraints and ideal no-slip belt transport are analytic; foot force, inertia, belt compliance and friction are not solved.':'The slider-crank law is exact for the reconstructed lengths; the upper spring follows the source tangent-circle drawing, with a prescribed preload proxy rather than an elastic force solution.'};
 fitPistonGuide(root,update,d.geometry.cyclePeriod??d.geometry.demonstrationPeriod??d.motion.inputCycleDuration);d.cameraDirection=new T.Vector3(.8,.5,15);
}
