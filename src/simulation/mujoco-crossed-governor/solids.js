import {makeCrossedGovernorUpdater} from './update-solids.js';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
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
  // The bridge spans only between the fork plates' inner faces; running on
  // through them, its ends and sides lay in the plates' faces and z-fought.
  add('pivotForkBridge', new THREE.BoxGeometry(.14, .08, .42), 'rotor', PALETTE.ink, [0, -.36, 0]);
  const forkStem = poly([[-.07, -.40], [.07, -.40], [.07, 0], [-.07, 0]]);
  const forkFront = clip.difference(clip.union(forkStem, hole([0, 0], .30)), hole([0, 0], .104));
  add('pivotForkFront', plate(forkFront, .21, .29), 'rotor', PALETTE.brass);
  add('pivotForkRear', plate(forkStem, -.29, -.21), 'rotor', PALETTE.ink);
  add('crossPin', disk(.10, -.30, .30, 96), 'rotor', PALETTE.ink);
  const arcRadius = 127 * g.scale;
  // Brown's bow is fixed across the spindle (his hatched band) and the two
  // arms pass through it. It is a deep band spanning both arm planes: the
  // spindle passes through a square seat in its middle, and each arm swings
  // radially through its own window, whose angular extent covers the baked
  // spread range (0.517-0.761 rad) plus the arm's half-width and clearance.
  // The bow's ends stand where Brown draws them, about 0.69 rad from the
  // spindle (0.17 past the drawn arms), so each window runs out through the
  // bow's end: at wide spread the arm leaves the open-ended slot between the
  // bow's front and back plates and returns into it.
  const bowInner = arcRadius - .075, bowOuter = arcRadius + .075, bowEnd = .69, window = [.475, bowEnd + .05];
  const bow = sector(bowInner, bowOuter, -Math.PI / 2 - bowEnd, -Math.PI / 2 + bowEnd, 128);
  const armWindow = sign => sector(bowInner - .01, bowOuter + .01,
    -Math.PI / 2 + sign * (sign < 0 ? window[1] : window[0]), -Math.PI / 2 + sign * (sign < 0 ? window[0] : window[1]), 32);
  const spindleSeat = poly([[-.10, -arcRadius - .2], [.10, -arcRadius - .2], [.10, -arcRadius + .2], [-.10, -arcRadius + .2]]);
  const armSpan = g.layer + .06 + .01, seat = .10, core = g.layer - .06 - .01, back = armSpan + .025;
  const bowLayers = [
    [bow, -back, -armSpan], [clip.difference(bow, armWindow(-1)), -armSpan, -seat],
    [clip.difference(bow, armWindow(-1), spindleSeat), -seat, -core], [clip.difference(bow, spindleSeat), -core, core],
    [clip.difference(bow, armWindow(1), spindleSeat), core, seat], [clip.difference(bow, armWindow(1)), seat, armSpan],
    [bow, armSpan, back]];
  add('spreadBow', mergeGeometries(bowLayers.map(([profile, low, high]) => plate(profile, low, high))), 'rotor', PALETTE.brass);
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
