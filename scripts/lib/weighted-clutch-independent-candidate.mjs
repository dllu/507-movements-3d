import {makeWeightedClutchLostMotionCandidate,THREE} from './weighted-clutch-lost-motion-candidate.mjs';
export {THREE};

// Expose physical coordinates without the diagnostic slot/fork clamps. Keep
// the existing source and lost-motion factories intact for parity comparisons.
export function makeWeightedClutchIndependentCandidate(options={}){
 const model=makeWeightedClutchLostMotionCandidate(options),u=model.root.userData,
  phases=Object.fromEntries(Object.entries(u.gears).map(([name,g])=>[name,g.userData.rotor.rotation.z])),
  outputBase=u.blocks.shaft.quaternion.clone(),spin=new THREE.Quaternion(),axis=new THREE.Vector3(0,0,1);
 const setCoordinates=([leverAngle,shifterAngle,clutchShift,outputAngle],inputAngle=0)=>{
  if(![leverAngle,shifterAngle,clutchShift,outputAngle,inputAngle].every(Number.isFinite))throw Error('Invalid independent clutch coordinates');
  const link=u.linkage.atAngle(leverAngle);
  u.gears.input.userData.rotor.rotation.z=phases.input+inputAngle;
  for(const name of ['B','C'])u.gears[name].userData.rotor.rotation.z=phases[name]-u.geometry.mainRatio*inputAngle;
  u.gears.E.userData.rotor.rotation.z=phases.E+outputAngle/u.geometry.eRatio;
  u.gears.pinion.userData.rotor.rotation.z=phases.pinion-outputAngle;
  u.blocks.shaft.quaternion.copy(outputBase).multiply(spin.setFromAxisAngle(axis,outputAngle));
  u.blocks.D.quaternion.copy(u.blocks.shaft.quaternion);u.blocks.D.position.x=clutchShift;
  u.blocks.lever.rotation.z=leverAngle;u.blocks.quadrant.rotation.z=leverAngle;u.blocks.shifter.rotation.z=shifterAngle;
  u.blocks.bell.rotation.z=link.bellAngle;u.blocks.rod.position.set(...link.A,0);u.blocks.rod.rotation.z=link.rodAngle;
  model.root.updateMatrixWorld(true);
  return u.state={...link,leverAngle,quadrantAngle:leverAngle,shifterAngle,clutchShift,outputAngle,inputAngle};
 };
 return {...model,setCoordinates};
}
