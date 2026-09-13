// Promoted from scripts/lib/weighted-clutch-lost-motion-candidate.mjs; geometry parity is tested.
import {makeWeightedClutchCandidate,THREE} from './source-geometry.js';
import {makeAdjustedWeightedClutchLinkage,makeWeightedClutchLostMotion} from './lost-motion.js';
import source from './source.js';
import {toWeightedClutchWorld as world} from './linkage.js';
import {poly,circle,capsule,plate,disk,ring,polygonClipping as clip} from '../finite-plate-geometry.js';
import {conformingPlateMesh} from '../conforming-plate-mesh.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
export {THREE};

// A separate operating-proportion hypothesis. The measured source candidate
// stays immutable, so source departures can be compared directly.
export function makeWeightedClutchLostMotionCandidate({pinAdjustmentPixels=75}={}){
 const base=makeWeightedClutchCandidate(),root=base.root,u=root.userData,parts=u.parts,old=u.linkage.parameters,
  linkage=makeAdjustedWeightedClutchLinkage(pinAdjustmentPixels),L=linkage.parameters,
  coupling=makeWeightedClutchLostMotion(u.profiles.slot[0][0]),C=coupling.parameters;
 const replace=(name,g)=>{parts[name].geometry.dispose();parts[name].geometry=g;};
 const shape=(name,polygons)=>{
  const {low,high}=parts[name].geometry.userData.plate;replace(name,conformingPlateMesh(plate(polygons,low,high)));
 };
 const add=(name,g,family,parent,position=[0,0,0],color=PALETTE.muted)=>{
  const mesh=new THREE.Mesh(g,matte(color,{metalness:.17,roughness:.61}));mesh.name=name;mesh.position.fromArray(position);
  parent.add(mesh);parts[name]=mesh;u.families[name]=family;return mesh;
 };
 shape('weightedLever',clip.difference(clip.union(parts.weightedLever.geometry.userData.plate.polygons,
  poly(circle(old.armF,.059,96)),poly(circle([0,0],.176,128))),poly(circle(L.armF,.058,96)),poly(circle([0,0],.157,128))));
 // Preserve the measured front projection, but put the weight's rear surface
 // ahead of the shifter blade throughout the swing. It still overlaps F's
 // own plate, providing a solid attachment instead of a floating weight.
 parts.weightF.position.z=1.59;
 parts.leverRodPin.position.set(...L.armF,0);
 const upper=world(source.bell.upperEnd).map((v,k)=>v-L.G[k]);
 shape('bellCrankG',clip.difference(clip.union(capsule([0,0],upper,source.bell.upperHalfWidth/source.scale,96),
  capsule([0,0],L.armG,source.bell.lowerHalfWidth/source.scale,96),poly(circle([0,0],source.bell.pivot.radius/source.scale,128))),
  poly(circle([0,0],.113,128))));
 parts.bellRodPin.position.set(...L.armG,0);
 const rod=clip.difference(clip.union(capsule([0,0],[L.rodLength,0],.061,96),poly(circle([0,0],.092,96)),
  poly(circle([L.rodLength,0],.136,96))),poly(circle([0,0],.058,96)),poly(circle([L.rodLength,0],.074,96)));
 shape('connectingRod',rod);

 // The weighted member carries the quadrant. Two spacers connect their
 // feet outside the shifter hub while leaving room for its radial arm.
 const quadrant=clip.difference(clip.union(parts.slottedQuadrant.geometry.userData.plate.polygons,
  poly(circle([0,0],.225,128))),poly(circle([0,0],.157,128)));
 shape('slottedQuadrant',quadrant);u.profiles.quadrant=quadrant;u.families.slottedQuadrant='lever';
 replace('LeverFixedPivot',disk(.14,1.04,1.54,128));
 for(const[side,degrees]of [['Left',-120],['Right',-70]]){
  const a=degrees*Math.PI/180;
  add('quadrantSpacer'+side,disk(.011,1.15,1.45,96),'lever',u.blocks.lever,[.212*Math.cos(a),.212*Math.sin(a),0]);
 }
 shape('clutchShifterLever',clip.difference(clip.union(parts.clutchShifterLever.geometry.userData.plate.polygons,
  poly(circle([0,0],.176,128))),poly(circle([0,0],.152,128))));
 add('shifterInnerHub',ring(.142,.155,1.085,1.50,128),'shifter',u.blocks.shifter);
 const follower=[C.radius*Math.cos(C.followerAngle),C.radius*Math.sin(C.followerAngle)],elbow=[.05,.90],
  carrier=clip.difference(clip.union(capsule([0,0],elbow,.025,64),capsule(elbow,follower,.025,64),
   poly(circle([0,0],.20,128))),poly(circle([0,0],.142,128)));
 add('slotFollowerCarrier',conformingPlateMesh(plate(carrier,1.085,1.115)),'shifter',u.blocks.shifter);
 add('slotFollowerPin',disk(C.followerRadius,1.085,1.205,128),'shifter',u.blocks.shifter,[...follower,0]);
 add('clutchForkShoe',disk(C.shoeRadius,.17,.205,128),'shifter',u.blocks.shifter,[...C.collar,0]);
 const setState=({leverAngle=0,direction='leftward',inputAngle=0,outputAngle=0}={})=>{
  const pose=coupling.pose(leverAngle,direction),link=linkage.atAngle(leverAngle);
  base.setState({...pose,inputAngle,outputAngle});u.blocks.bell.rotation.z=link.bellAngle;
  u.blocks.rod.position.set(...link.A,0);u.blocks.rod.rotation.z=link.rodAngle;root.updateMatrixWorld(true);
  return u.state={...pose,...link,inputAngle,outputAngle};
 };
 u.linkage=linkage;u.lostMotion=coupling;u.sourceAdjustments={pinAdjustmentPixels,measuredPins:{A:old.A0,B:old.B0},adjustedPins:{A:L.A0,B:L.B0},
  weightDepth:1.59,quadrantSpacerAnglesDegrees:[-120,-70]};
 u.mechanism='weighted-clutch-lost-motion-hypothesis';
 u.qualification='Isolated lost-motion geometry hypothesis. The two rod pins move along their arms by an explicit source-pixel adjustment; fulcrums, weight and G upper arm stay measured. Quadrant/weight spacers and a coaxial shifter follower complete the hypothesized slot coupling. Diagnostic forward/return poses follow unilateral geometric limits; there is no time animation, gravity solution, stud contact trajectory or loaded clutch qualification.';
 setState();markShadows(root);return{root,setState,update:()=>{},cameraDirection:base.cameraDirection};
}
