import * as THREE from 'three';
import measured from '../data/wiper-stamp-source.js';
import {poly, circle, plate, ring, disk, turned, polygonClipping as clip} from './finite-plate-geometry.js';
import {conformingPlateMesh} from './conforming-plate-mesh.js';
import {PALETTE, matte, markShadows} from './primitives.js';
export {THREE};

const px = n => n / measured.scale;
const source = p => [px(p[0] - measured.center[0]), px(measured.center[1] - p[1])];
const sourcePoly = points => poly(points.map(source));
const rectangle = (left, top, right, bottom) => sourcePoly([[left, top], [right, top], [right, bottom], [left, bottom]]);
const trace = commands => {
  const path = new THREE.Path(); for (const [command, ...values] of commands) path[command](...values);
  return path.getPoints(48).map(p => p.toArray());
};

export function makeWiperStampGeometry() {
  const root = new THREE.Group(), parts = {}, families = {}, blocks = {}, profiles = {};
  for (const family of ['fixed', 'cam', 'stamp']) {blocks[family] = new THREE.Group(); root.add(blocks[family]);}
  const attach = (name, geometry, family, color, position = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geometry, matte(color, {metalness: .22, roughness: .58}));
    mesh.name = name; mesh.position.fromArray(position); blocks[family].add(mesh); parts[name] = mesh; families[name] = family; return mesh;
  };
  const layers = {cam: [0, .10], bearing: [-.55, -.36], standard: [-.60, -.26]};
  const bore = px(measured.shaftRadius), bearingBore = px(measured.shaftRadius + 1), rod = measured.rod, b = measured.projection;
  profiles.wipers = ['upperWiper', 'lowerWiper'].map(name => sourcePoly(trace(measured[name])));
  profiles.camOuter = clip.union(poly(circle([0, 0], px(measured.hubRadius), 256)), ...profiles.wipers);
  profiles.cam = clip.difference(profiles.camOuter, poly(circle([0, 0], bore, 128)));
  attach('twoWipers', conformingPlateMesh(plate(profiles.cam, ...layers.cam)), 'cam', PALETTE.driver);
  attach('boredCamHub', ring(bore, px(measured.hubRadius), -.12, 0, 128), 'cam', PALETTE.driver);
  attach('frontHubLip', ring(bore, px(measured.hubRadius), .10, .14, 128), 'cam', PALETTE.driver);
  attach('inputShaft', disk(px(measured.shaftRadius), -.58, .16, 128), 'cam', PALETTE.muted);

  profiles.standard = sourcePoly(trace(measured.standard));
  profiles.standardInset = sourcePoly(trace(measured.standardInset));
  attach('curvedStandard', plate(profiles.standard, ...layers.standard), 'fixed', PALETTE.muted);
  attach('standardRaisedBorder', conformingPlateMesh(plate(clip.difference(profiles.standard, profiles.standardInset), -.26, -.20)), 'fixed', PALETTE.muted);
  profiles.bearing = clip.difference(clip.union(sourcePoly(trace(measured.bearingArm)), poly(circle([0, 0], px(measured.hubRadius), 128))),
    poly(circle([0, 0], bearingBore, 128)));
  attach('rearBearingArm', plate(profiles.bearing, ...layers.bearing), 'fixed', PALETTE.muted);

  // Each guide has a real rectangular through passage along Y. Its side
  // bracket meets the collar at a face, not inside the moving rod.
  for (const [i, commands, top, bottom] of [[0, measured.guide, 126, 185], [1, measured.lowerGuide, 746, 795]]) {
    const guide = sourcePoly(trace(commands)), join = 381;
    const bracket = clip.intersection(guide, rectangle(join, top - 1, 566, bottom + 80));
    attach('guideBracket' + i, plate(bracket, -.47, -.13), 'fixed', PALETTE.muted);
    const outer = poly([[source([274, 0])[0], -.47], [source([join, 0])[0], -.47],
      [source([join, 0])[0], -.13], [source([274, 0])[0], -.13]]);
    const opening = poly([[source([rod.left - 1, 0])[0], rod.z - rod.depth / 2 - .01],
      [source([rod.right + 1, 0])[0], rod.z - rod.depth / 2 - .01],
      [source([rod.right + 1, 0])[0], rod.z + rod.depth / 2 + .005],
      [source([rod.left - 1, 0])[0], rod.z + rod.depth / 2 + .005]]);
    // Coordinates here are X,Z. Rotation sends the extrusion to +Y and
    // reverses its second coordinate, so reflect Z before making the mesh.
    const reflect = polygons => polygons.map(rings => rings.map(points => points.map(([x, z]) => [x, -z])));
    const geometry = plate(reflect(clip.difference(outer, opening)), source([0, bottom])[1], source([0, top])[1]);
    geometry.rotateX(-Math.PI / 2); attach('boredGuide' + i, geometry, 'fixed', PALETTE.muted);
  }

  attach('rectangularRodA', plate(rectangle(rod.left, rod.top, rod.right, rod.bottom), rod.z - rod.depth / 2, rod.z + rod.depth / 2), 'stamp', PALETTE.driven);
  profiles.projection = rectangle(b.left, b.top, b.right, b.bottom);
  attach('flatProjectionB', plate(profiles.projection, rod.z + rod.depth / 2, .12), 'stamp', PALETTE.accent);
  const head = turned([...measured.head.profile].reverse().map(([y, r]) => [source([0, y])[1], px(r)]), 128);
  // Smooth the turned side's shading across section stations, retaining
  // the exact finite positions and the flat end-face normals.
  const hp = head.attributes.position, hn = head.attributes.normal, sideNormals = new Map();
  const vertexKey = i => [hp.getX(i), hp.getY(i), hp.getZ(i)].join(',');
  for (let i = 0; i < hp.count; i++) if (Math.abs(hn.getZ(i)) < .999999) {
    const key = vertexKey(i), normals = sideNormals.get(key) ?? [], n = new THREE.Vector3().fromBufferAttribute(hn, i);
    if (!normals.some(old => old.distanceToSquared(n) < 1e-14)) normals.push(n);
    sideNormals.set(key, normals);
  }
  for (let i = 0; i < hp.count; i++) if (Math.abs(hn.getZ(i)) < .999999) {
    const normal = sideNormals.get(vertexKey(i)).reduce((sum, n) => sum.add(n), new THREE.Vector3()).normalize();
    hn.setXYZ(i, normal.x, normal.y, normal.z);
  }
  head.rotateX(-Math.PI / 2);
  attach('flaredStampHead', head, 'stamp', PALETTE.driven, [source([measured.head.centerX, 0])[0], 0, rod.z]);

  // The engraving does not draw the ore bed. This explicit rigid impact
  // surface leaves 19 source pixels of rod inside the upper guide at rest.
  attach('strikingBed', plate(rectangle(218, measured.head.bottom + 40, 442, measured.floor), -.74, .26), 'fixed', PALETTE.muted);
  for (const name of ['strikingBed', 'flaredStampHead', 'flatProjectionB']) parts[name].geometry.computeBoundingBox();
  const strikeY = parts.strikingBed.geometry.boundingBox.max.y, minimumStampY = strikeY - head.boundingBox.min.y;
  const pad = parts.flatProjectionB.geometry.boundingBox;
  const setState = ({camAngle = 0, stampY = 0} = {}) => {
    if (![camAngle, stampY].every(Number.isFinite)) throw Error('Nonfinite stamp state');
    blocks.cam.rotation.z = camAngle; blocks.stamp.position.y = stampY; root.updateMatrixWorld(true);
    return root.userData.state = {camAngle, stampY};
  };
  root.userData = {parts, families, blocks, profiles, source: measured, setState,
    geometry: {layers, minimumStampY, strikeY, projection: {left: pad.min.x, right: pad.max.x, bottom: pad.min.y, top: pad.max.y},
      assumedRestDropPixels: 40, guideEngagementAtRestPixels: 185 - rod.top + minimumStampY * measured.scale},
    hideGround: true, cameraFov: 8, shadowCameraHalfExtent: 5, shadowBias: -.00003, shadowNormalBias: .002,
    mechanism: 'finite-two-wiper-flat-projection-stamp-candidate', fidelity: 'candidate',
    qualification: 'Source-shaped independent wipers, flat projection B, square rod, curved standard and flared stamp. Depths, bored guides and bearing construction are inferred. The source omits the striking bed; its height permits a 40-pixel drop from the source pose while retaining both guides. Pose control only; no contact-derived motion, force, impact or continuous-clearance qualification.'};
  setState(); markShadows(root);
  return {root, setState, update: () => {}, cameraDirection: new THREE.Vector3(0, 0, 10)};
}
