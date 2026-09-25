import {makeCrossedGovernorUpdater} from './update-solids.js';
import * as THREE from 'three';
import {plate, poly, circle, capsule, ring, disk, sector, polygonClipping as clip} from '../finite-plate-geometry.js';
import {PALETTE, matte, markShadows} from '../primitives.js';
import {disposeObject3D} from '../dispose-model.js';
import {crossedGovernorGeometry} from './physics.js';
import {makeCrossedGovernorBevelPair} from './bevel-pair.js';

// Unregistered finite-solid assembly. Link planes are separated from the arms
// for real pin joints; the settled native study uses matching link offsets.
export function makeCrossedGovernorSolids() {
  const g = crossedGovernorGeometry(), root = new THREE.Group(), parts = {}, families = {}, blocks = {};
  const group = (name, parent = root) => { const b = new THREE.Group(); b.name = 'body:' + name; parent.add(b); blocks[name] = b; return b; };
  const rotor = group('rotor'), output = group('output', rotor), valve = group('valve');
  group('input');
  const materials = new Map();
  const add = (name, geometry, family, color, position = [0, 0, 0]) => {
    if (!materials.has(color)) { const m = matte(color); m.fog = false; materials.set(color, m); }
    const mesh = new THREE.Mesh(geometry, materials.get(color)); mesh.name = name; mesh.position.set(...position);
    blocks[family].add(mesh); parts[name] = mesh; families[name] = family; return mesh;
  };
  const hole = (p, r) => poly(circle(p, r, 96)), y = geometry => geometry.rotateX(-Math.PI / 2);
  add('spindle', y(disk(.10, (160 - 512) * g.scale, -.34, 96)), 'rotor', PALETTE.ink);
  add('pivotForkBridge', new THREE.BoxGeometry(.14, .08, .58), 'rotor', PALETTE.ink, [0, -.36, 0]);
  const forkStem = poly([[-.07, -.40], [.07, -.40], [.07, 0], [-.07, 0]]);
  const forkFront = clip.difference(clip.union(forkStem, hole([0, 0], .30)), hole([0, 0], .104));
  add('pivotForkFront', plate(forkFront, .21, .29), 'rotor', PALETTE.brass);
  add('pivotForkRear', plate(forkStem, -.29, -.21), 'rotor', PALETTE.ink);
  add('crossPin', disk(.10, -.30, .30, 96), 'rotor', PALETTE.ink);
  const arcRadius = 127 * g.scale;
  add('spreadBow', plate(sector(arcRadius - .075, arcRadius + .075, -Math.PI / 2 - .66, -Math.PI / 2 + .66, 128), .22, .32), 'rotor', PALETTE.brass);
  for (const sign of [-1, 1]) {
    const name = sign < 0 ? 'left' : 'right', arm = group(name + 'Arm', rotor), link = group(name + 'Link', rotor);
    const z = sign * g.layer, linkZ = sign * .275;
    const armShape = clip.difference(clip.union(capsule([0, -g.armLength + g.ballRadius * .6], [0, g.extension], .06),
      hole([0, 0], .18), hole([0, g.extension], .15)), hole([0, 0], .104), hole([0, g.extension], .074));
    add(name + 'Arm', plate(armShape, z - .06, z + .06), name + 'Arm', PALETTE.driven);
    add(name + 'Ball', new THREE.SphereGeometry(g.ballRadius, 48, 32), name + 'Arm', PALETTE.driver, [0, -g.armLength, z]);
    add(name + 'WristPin', disk(.07, Math.min(z, linkZ) - .08, Math.max(z, linkZ) + .08, 96), name + 'Arm', PALETTE.ink, [0, g.extension, 0]);
    const linkShape = clip.difference(capsule([0, 0], [0, g.linkLength], .13), hole([0, 0], .074), hole([0, g.linkLength], .074));
    add(name + 'Link', plate(linkShape, -.055, .055), name + 'Link', PALETTE.brass);
    link.position.z = linkZ;
    add(name + 'OutputPin', disk(.07, sign < 0 ? -.36 : .19, sign < 0 ? -.19 : .36, 96), 'output', PALETTE.ink);
  }
  // Two short radial pins leave the axial bore unobstructed. The stationary
  // rod's flanges capture the rotating collar from above and below.
  add('outputCollar', y(ring(.084, .205, -.10, .10, 128)), 'output', PALETTE.brass);
  add('valveRod', y(disk(.08, -.16, .74, 96)), 'valve', PALETTE.ink);
  add('lowerThrustFlange', y(ring(.079, .20, -.15, -.12, 96)), 'valve', PALETTE.ink);
  add('upperThrustFlange', y(ring(.079, .20, .12, .15, 96)), 'valve', PALETTE.ink);
  const bevel = makeCrossedGovernorBevelPair(); root.add(bevel.root);
  bevel.root.userData.blocks.input.name = 'body:inputBevel'; bevel.root.userData.blocks.output.name = 'body:outputBevel';
  for (const [name, mesh] of Object.entries(bevel.root.userData.parts)) { parts[name] = mesh; families[name] = name.startsWith('input') ? 'input' : 'rotor'; }
  const apexY = bevel.root.userData.parameters.apex[1];
  add('inputShaft', disk(.10, -169 * g.scale, -.18, 96).rotateY(Math.PI / 2), 'input', PALETTE.ink, [0, apexY, 0]);
  const update = makeCrossedGovernorUpdater(root, g);
  update({spindle: 0, leftSpread: g.spread, rightSpread: g.spread, outputY: g.outputY}); markShadows(root);
  Object.assign(root.userData, {parts, families, blocks, geometry: g, hideGround: true, simulationBackend: 'native-study', reconstructionStatus: 'in-review'});
  return {root, update, dispose: () => disposeObject3D(root)};
}
