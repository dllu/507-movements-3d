// Promoted from scripts/lib/weighted-clutch-key-candidate.mjs; geometry parity is tested.
import {makeWeightedClutchIndependentCandidate,THREE} from './independent-geometry.js';
export {THREE};

// The fifth coordinate exposes the real angular clearance between the
// existing shaft feather and D's keyed bore. Geometry remains unchanged.
export function makeWeightedClutchKeyCandidate(options={}){
 const model=makeWeightedClutchIndependentCandidate(options),u=model.root.userData,
  original=model.setCoordinates,axis=new THREE.Vector3(0,0,1),relative=new THREE.Quaternion();
 function setCoordinates([q,s,x,shaftAngle,clutchAngle=shaftAngle],inputAngle=0){
  if(!Number.isFinite(clutchAngle))throw Error('Invalid clutch angle');
  const state=original([q,s,x,shaftAngle],inputAngle);
  u.blocks.D.quaternion.copy(u.blocks.shaft.quaternion).multiply(relative.setFromAxisAngle(axis,clutchAngle-shaftAngle));
  model.root.updateMatrixWorld(true);return u.state={...state,shaftAngle,clutchAngle};
 }
 return {...model,setCoordinates};
}
