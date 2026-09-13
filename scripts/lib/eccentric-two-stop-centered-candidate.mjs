import {makeEccentricTwoStopCompleteCandidate,THREE} from './eccentric-two-stop-complete-candidate.mjs';
import {poly,circle,plate,polygonClipping as clip} from '../../src/simulation/finite-plate-geometry.js';
import {conformingPlateMesh} from '../../src/simulation/conforming-plate-mesh.js';
export {THREE};

// A circular disk wheel turns about its own center. The engraving's inferred
// hidden axle and fitted rim center differ by about eleven pixels; record that
// discrepancy instead of turning the wheel into an unintended eccentric disk.
export function makeEccentricTwoStopCenteredCandidate(options={}) {
  const model=makeEccentricTwoStopCompleteCandidate(options),u=model.root.userData,mesh=u.parts.wheelB,
    {low,high}=mesh.geometry.userData.plate,trace=u.geometry.rim;
  mesh.geometry.dispose();mesh.geometry=conformingPlateMesh(plate(clip.difference(
    poly(circle([0,0],trace.radius/u.source.scale,512)),poly(circle([0,0],.14,128))),low,high));
  u.geometry.tracedRim=structuredClone(trace);
  u.geometry.rimCenterAdjustmentPixels=u.source.output.map((v,i)=>v-trace.center[i]);
  u.geometry.rim={center:u.source.output.slice(),radius:trace.radius};u.geometry.rearDiskCenterOffset=[0,0];
  u.qualification='Source-traced cam and finite stepped stops. Wheel B is concentric with the axle inferred from opposite stops; its circular outline shifts about eleven source pixels from the traced rim. The source-axis inference and hidden foot construction remain explicit reconstruction assumptions.';
  return model;
}
