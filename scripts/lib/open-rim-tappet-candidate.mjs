import * as THREE from 'three';
import defaultProfile from './open-rim-tappet-profile.mjs';
import { makeOpenRimTappetMotion } from './open-rim-tappet-motion.mjs';
import { turnedClutchGeometry } from '../../src/simulation/clutch-section-geometry.js';
import { PALETTE, matte, markShadows } from '../../src/simulation/primitives.js';

export function makeOpenRimTappetCandidate({ profile = defaultProfile } = {}) {
  const motion = makeOpenRimTappetMotion(profile), p = motion.parameters;
  const root = new THREE.Group(), input = new THREE.Group(), output = new THREE.Group();
  root.add(input,output); root.rotation.z = p.assemblyAngle;
  input.position.x = p.centerDistance / 2; output.position.x = -p.centerDistance / 2;
  const parts = {}, families = {};
  const add = (name, geometry, parent, color) => {
    const mesh = new THREE.Mesh(geometry,matte(color,{ metalness:.15,roughness:.64 }));
    mesh.name = name; parent.add(mesh); parts[name] = mesh; families[name] = parent === input ? 'input' : 'output'; return mesh;
  };
  const drum = (radius, low, high, angularSegments = 256) => turnedClutchGeometry(
    [[low,0],[low,radius],[high,radius],[high,0]],{ angularSegments });
  const plate = (ring, low, high) => {
    const shape = new THREE.Shape(ring.map(point => new THREE.Vector2(...point)));
    const geometry = new THREE.ExtrudeGeometry(shape,{depth:high-low,bevelEnabled:false});
    geometry.translate(0,0,low); return geometry;
  };
  const arcSegments = Math.ceil((2 * Math.PI - 2 * p.openingHalfAngle) / (2 * Math.PI) * 4096);
  const phases = Array.from({length:arcSegments+1},(_,i) => p.openingHalfAngle + (2 * Math.PI - 2 * p.openingHalfAngle) * i / arcSegments);
  const rim = [...phases.map(a => [p.rimOuter * Math.cos(a),p.rimOuter * Math.sin(a)]),
    ...[...phases].reverse().map(a => [p.rimInner * Math.cos(a),p.rimInner * Math.sin(a)])];
  add('driverCover',drum(p.driverRadius,.25,.4,1024),input,PALETTE.driver);
  add('rim',plate(rim,-.02,.25),input,PALETTE.driver);
  add('tappet',plate(profile.tappet,-.02,.25),input,PALETTE.brass);
  add('driverFrontHub',drum(.25,.4,.46),input,PALETTE.brass);
  add('driverShaft',drum(.175,-.35,.5),input,PALETTE.muted);
  add('outputPlate',drum(p.outputRadius,-.26,-.08,1024),output,PALETTE.driven);
  const pin = drum(p.studRadius,-.08,.22,4096);
  for (let i = 0; i < p.studCount; i++) {
    const angle = i * p.pitch;
    const stud = add(`stud${i}`,pin,output,PALETTE.brass);
    stud.position.set(p.studOrbit * Math.cos(angle),p.studOrbit * Math.sin(angle),0);
  }
  add('outputFrontHub',drum(.26,-.08,.02),output,PALETTE.brass);
  add('outputShaft',drum(.175,-.35,.1),output,PALETTE.muted);
  const update = time => {
    const state = motion.atTime(time); input.rotation.z = state.inputAngle; output.rotation.z = state.outputAngle;
    root.userData.kinematics = state;
  };
  const setSectionView = enabled => {
    root.userData.sectionView = Boolean(enabled);
    parts.driverCover.visible = !enabled;
  };
  root.userData = {parts,families,blocks:{input,output},geometry:p,profile,motion,setSectionView,sectionView:false,
    mechanism:'open-rim-tappet-stud-index',fidelity:'authored',reconstructionStatus:'candidate',
    hideGround:true,cameraFov:8,fullCameraDirection:new THREE.Vector3(0,0,10),
    shadowCameraHalfExtent:6,shadowBias:-.00012,shadowNormalBias:.005,
    animationTiming:{authoredCyclePeriod:p.period},minimumDisplayCycleSeconds:5,
    idealConstraints:'The input tappet drives one stud, then the closing rim seats it after a short pause. This quasistatic model assumes a resisting output load, passive bearing resistance during the pause and ideal engagement impacts.'};
  update(0); markShadows(root);
  return {root,update,motion,cameraDirection:new THREE.Vector3(0,0,10)};
}
