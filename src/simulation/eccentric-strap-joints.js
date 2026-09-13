import * as THREE from 'three';
import {circle, disk, plate, poly, polygonClipping} from './finite-plate-geometry.js';

const rectangle = (left, bottom, right, top) => poly([
  [left, bottom], [right, bottom], [right, top], [left, top],
]);
const hole = (x, y, radius) => poly(circle([x, y], radius, 128));

// These fittings complete the rod beyond the engraving's broken-off end.
// All sliding/hinged joints have actual bores and small running clearances.
export function makeEccentricStrapJoints({rodLength, innerCouplingX, drivenMaterial, fastenerMaterial}) {
  const flangeThickness = .17, outerCouplingX = innerCouplingX + flangeThickness;
  const flangeBoltRadius = .065, flangeBoreRadius = .067;
  const pinRadius = .13, wristBoreRadius = .132, eyeRadius = .25;
  const eyeHalfDepth = .15, forkInnerZ = .155, forkOuterZ = .39;
  const guideClearance = .003, crossheadHalfHeight = .36;
  const mesh = (geometry, material, role) => {
    const result = new THREE.Mesh(geometry, material); result.userData.role = role; return result;
  };
  const flangeShape = polygonClipping.difference(rectangle(-.28, -.46, .28, .46),
    hole(0, -.31, flangeBoreRadius), hole(0, .31, flangeBoreRadius));
  const flange = (x, role) => {
    const geometry = plate(flangeShape, -flangeThickness / 2, flangeThickness / 2);
    geometry.rotateY(Math.PI / 2);
    const result = mesh(geometry, drivenMaterial, role); result.position.x = x; return result;
  };
  const innerCouplingPlate = flange(innerCouplingX, 'inner-bolted-eccentric-rod-flange');
  const outerCouplingPlate = flange(outerCouplingX, 'outer-bolted-eccentric-rod-flange');
  const left = innerCouplingX - flangeThickness / 2, right = outerCouplingX + flangeThickness / 2;
  const couplingBolts = [-1, 1].map(sign => {
    const bolt = new THREE.Group(); bolt.position.set((left + right) / 2, sign * .31, 0);
    bolt.userData.role = 'through-bolt-clamping-both-eccentric-rod-flanges';
    const shank = disk(flangeBoltRadius, -(right - left) / 2, (right - left) / 2, 128);
    shank.rotateY(Math.PI / 2);
    bolt.add(mesh(shank, fastenerMaterial, 'flange-bolt-shank'));
    for (const side of [-1, 1]) {
      const cap = disk(.105, 0, .10, 6); cap.rotateY(side * Math.PI / 2);
      const part = mesh(cap, fastenerMaterial, side < 0 ? 'flange-bolt-head' : 'flange-bolt-nut');
      part.position.x = side * (right - left) / 2; bolt.add(part);
    }
    return bolt;
  });

  const rodStartX = right;
  const rodShape = polygonClipping.difference(polygonClipping.union(
    rectangle(rodStartX, -.12, rodLength, .12), hole(rodLength, 0, eyeRadius)),
  hole(rodLength, 0, wristBoreRadius));
  const eccentricRod = mesh(plate(rodShape, -eyeHalfDepth, eyeHalfDepth), drivenMaterial,
    'rigid-eccentric-rod-with-bored-wrist-eye');
  const rodEndEye = new THREE.Group(); rodEndEye.position.x = rodLength;
  rodEndEye.userData.role = 'wrist-eye-center-on-solid-eccentric-rod';

  const crosshead = new THREE.Group(); crosshead.userData.role = 'forked-line-constrained-output-crosshead';
  const cheekShape = polygonClipping.difference(rectangle(-.30, -crossheadHalfHeight, .42, crossheadHalfHeight),
    hole(0, 0, wristBoreRadius));
  const cheeks = [[-forkOuterZ, -forkInnerZ], [forkInnerZ, forkOuterZ]].map(([low, high]) =>
    mesh(plate(cheekShape, low, high), drivenMaterial, 'bored-crosshead-cheek'));
  const bridge = mesh(plate(rectangle(.27, -crossheadHalfHeight, .42, crossheadHalfHeight),
    -forkInnerZ, forkInnerZ), drivenMaterial, 'crosshead-bridge-clear-of-swinging-eye');
  crosshead.add(...cheeks, bridge);
  const wristPin = new THREE.Group(); wristPin.userData.role = 'wrist-pin-through-eye-and-two-crosshead-cheeks';
  const pinShank = mesh(disk(pinRadius, -forkOuterZ, forkOuterZ, 128), fastenerMaterial, 'wrist-pin-shank');
  wristPin.add(pinShank);
  for (const [low, high] of [[-forkOuterZ - .08, -forkOuterZ], [forkOuterZ, forkOuterZ + .08]]) {
    wristPin.add(mesh(disk(.185, low, high, 64), fastenerMaterial, 'wrist-pin-retaining-head'));
  }

  const makeGuide = (minimumX, maximumX, sliderY, sign, material) => {
    // In this section x becomes depth z; y remains vertical after rotation.
    // The channel base sets y clearance, and its two lips retain z alignment.
    const insideY = crossheadHalfHeight + guideClearance, outsideZ = .48;
    const section = poly([[-outsideZ, .28], [-forkOuterZ - guideClearance, .28],
      [-forkOuterZ - guideClearance, insideY], [forkOuterZ + guideClearance, insideY],
      [forkOuterZ + guideClearance, .28], [outsideZ, .28],
      [outsideZ, insideY + .13], [-outsideZ, insideY + .13]]
      .map(([x, y]) => [x, sign * y]));
    const geometry = plate(section, minimumX, maximumX); geometry.rotateY(Math.PI / 2);
    const guide = mesh(geometry, material, 'fixed-horizontal-crosshead-channel');
    guide.position.y = sliderY; guide.userData.side = sign < 0 ? 'lower' : 'upper'; return guide;
  };
  return {innerCouplingPlate, outerCouplingPlate, couplingBolts, eccentricRod, rodEndEye,
    crosshead, wristPin, makeGuide, cheeks, bridge, pinShank,
    dimensions: {outerCouplingX, rodStartX, flangeThickness, flangeBoltRadius, flangeBoreRadius,
      pinRadius, wristBoreRadius, eyeRadius, eyeHalfDepth, forkInnerZ, forkOuterZ,
      guideClearance, crossheadHalfHeight, outputStemStartX: .42}};
}
