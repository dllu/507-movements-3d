import {makeSelectorRackCandidate} from './selector-rack-candidate.mjs';
import {familyMass} from '../../src/simulation/finite-plate-geometry.js';

export function makeSelectorRackFreeCandidate() {
  const model = makeSelectorRackCandidate(), u = model.root.userData, setBase = model.setState;
  const mass = familyMass(u.parts, u.families, 'frame'), centroid = mass.centroid.slice(0, 2);
  const setState = ({camAngle = 0, selectorY = 0, center = [centroid[0], centroid[1] + selectorY], frameAngle = 0} = {}) => {
    if (![camAngle, selectorY, frameAngle, ...center].every(Number.isFinite)) throw Error('Nonfinite free-frame pose');
    const c = Math.cos(frameAngle), s = Math.sin(frameAngle);
    const rackX = center[0] - c * centroid[0] + s * centroid[1], frameY = center[1] - s * centroid[0] - c * centroid[1];
    setBase({camAngle, selectorY, rackX}); u.blocks.frame.position.y = frameY; u.blocks.frame.rotation.z = frameAngle;
    model.root.updateMatrixWorld(true);
    return u.state = {camAngle, selectorY, center: [...center], frameAngle, rackX, frameY};
  };
  u.frameMass = {...mass, normalizedInertia: mass.centralPolar / mass.volume}; u.frameCentroid = centroid;
  u.setState = model.setState = setState;
  u.qualification += ' The rack is now a free planar rigid body. Only out-of-plane motion is constrained; its two translations and angle must be solved from finite contact.';
  setState(); return model;
}
