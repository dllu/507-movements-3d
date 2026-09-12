import * as THREE from 'three';
import measured from '../data/selector-rack-source.js';
import {conformingPlateMesh} from './conforming-plate-mesh.js';
import {PALETTE, matte, markShadows} from './primitives.js';
import {poly, circle, plate, ring, disk, polygonClipping as clip} from './finite-plate-geometry.js';
export {THREE};

const px = n => n / measured.scale;
const source = p => [px(p[0] - measured.center[0]), px(measured.center[1] - p[1])];
const sourcePoly = points => poly(points.map(source));
const rectangle = (left, top, right, bottom) => sourcePoly([[left, top], [right, top], [right, bottom], [left, bottom]]);
const trace = commands => {
  const path = new THREE.Path();
  for (const [command, ...values] of commands) path[command](...values);
  return path.getPoints(24).map(p => p.toArray());
};

export function makeSelectorRackBaseGeometry() {
  const root = new THREE.Group(), parts = {}, families = {}, blocks = {}, profiles = {};
  for (const name of ['fixed', 'cam', 'frame', 'selector']) {blocks[name] = new THREE.Group(); root.add(blocks[name]);}
  const attach = (name, geometry, family, color, position = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geometry, matte(color, {metalness: .2, roughness: .57}));
    mesh.name = name; mesh.position.fromArray(position); parts[name] = mesh; families[name] = family; blocks[family].add(mesh); return mesh;
  };
  const layers = {frame: [-.06, .06], cam: [-.045, .045], wheel: [-.22, -.12], selector: [.105, .195]};
  const outer = sourcePoly(trace([
    ['moveTo', 526, 421], ['lineTo', 526, 353], ['quadraticCurveTo', 526, 327, 552, 327],
    ['lineTo', 1268, 327], ['quadraticCurveTo', 1293, 327, 1293, 353], ['lineTo', 1293, 421],
    ['bezierCurveTo', 1360, 433, 1420, 490, 1444, 568], ['lineTo', 1716, 568], ['lineTo', 1716, 611], ['lineTo', 1444, 611],
    ['bezierCurveTo', 1423, 683, 1383, 744, 1322, 744], ['lineTo', 507, 744],
    ['bezierCurveTo', 437, 744, 398, 683, 379, 611], ['lineTo', 64, 611], ['lineTo', 64, 569], ['lineTo', 377, 569],
    ['bezierCurveTo', 393, 490, 436, 440, 526, 421],
  ]));
  const inner = [...measured.upper.flatMap(f => [f.root, f.tip])];
  const rightEnd = trace([
    ['moveTo', ...inner.at(-1)], ['bezierCurveTo', 1292, 486, 1317, 462, 1342, 479],
    ['bezierCurveTo', 1422, 529, 1429, 650, 1340, 699], ['quadraticCurveTo', 1311, 711, ...measured.lower.at(-1).root],
  ]);
  inner.push(...rightEnd.slice(1));
  for (const f of [...measured.lower].reverse()) inner.push(f.root, f.tip);
  inner.push([532, 704], ...trace([
    ['moveTo', 532, 704], ['bezierCurveTo', 451, 708, 419, 643, 429, 572],
    ['bezierCurveTo', 433, 504, 476, 462, ...measured.upper[0].root],
  ]).slice(1));
  profiles.opening = sourcePoly(inner);
  profiles.slots = measured.slots.map(s => rectangle(s.left, s.top, s.right, s.bottom));
  profiles.frame = clip.difference(outer, profiles.opening, ...profiles.slots);
  attach('slottedRackFrame', conformingPlateMesh(plate(profiles.frame, ...layers.frame)), 'frame', PALETTE.driven);

  // The small working cam has one projection. Its outline is a union with
  // the fitted round body; the much larger spoked wheel occupies a rear layer.
  const bore = px(measured.cam.shaftRadius + 1);
  const roundCam = poly(circle([0, 0], px(measured.cam.bodyRadius), 256));
  const lobe = sourcePoly([[...measured.center], ...measured.cam.lobe]);
  profiles.camOuter = clip.union(roundCam, lobe);
  profiles.cam = clip.difference(profiles.camOuter, poly(circle([0, 0], bore, 128)));
  attach('singleWorkingCam', plate(profiles.cam, ...layers.cam), 'cam', PALETTE.driver);
  attach('camHub', ring(bore, px(measured.cam.hubRadius), layers.cam[1], .092, 128), 'cam', PALETTE.driver);

  // One curved quadrant opening, repeated around the complete rear wheel.
  // The upper opening is occluded in the engraving, so this repetition is an
  // explicit reconstruction, not a measurement of its hidden boundary.
  const quadrant = trace([
    ['moveTo', 49, 17], ['lineTo', 163, 17], ['bezierCurveTo', 190, 17, 202, 24, 192, 49],
    ['bezierCurveTo', 175, 118, 122, 177, 52, 192], ['bezierCurveTo', 25, 202, 18, 189, 18, 164],
    ['lineTo', 18, 50], ['quadraticCurveTo', 40, 42, 49, 17],
  ]).map(p => p.map(px));
  const holes = [0, 1, 2, 3].map(i => poly(quadrant.map(([x, y]) => {
    const a = i * Math.PI / 2; return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
  })));
  profiles.wheel = clip.difference(poly(circle([0, 0], px(measured.wheel.outerRadius), 384)), poly(circle([0, 0], bore, 128)), ...holes);
  attach('fullCurvedSpokeWheel', plate(profiles.wheel, ...layers.wheel), 'cam', PALETTE.driver);
  attach('wheelHub', ring(bore, px(39), -.255, -.045, 128), 'cam', PALETTE.driver);
  attach('fixedCamAxle', disk(px(measured.cam.shaftRadius), -.35, .115, 128), 'fixed', PALETTE.muted);

  const yoke = sourcePoly(trace([
    ['moveTo', 782, 391], ['bezierCurveTo', 790, 311, 821, 272, 887, 232], ['lineTo', 887, 86], ['lineTo', 934, 86], ['lineTo', 934, 232],
    ['bezierCurveTo', 1014, 260, 1044, 310, 1054, 391], ['lineTo', 1014, 391],
    ['bezierCurveTo', 1002, 308, 973, 268, 923, 268], ['bezierCurveTo', 865, 268, 832, 310, 820, 391], ['lineTo', 782, 391],
  ]));
  const pinBores = measured.pins.map(p => poly(circle(source(p), px(measured.pinRadius + .5), 96)));
  const bosses = measured.pins.map(p => poly(circle(source(p), px(21), 96)));
  profiles.selector = clip.difference(clip.union(yoke, ...bosses), ...pinBores);
  attach('governorRodYoke', plate(profiles.selector, ...layers.selector), 'selector', PALETTE.accent);
  measured.pins.forEach((p, i) => {
    const position = [...source(p), 0];
    attach('suspensionPin' + i, disk(px(measured.pinRadius), -.082, .21, 96), 'selector', PALETTE.muted, position);
    attach('suspensionFrontHead' + i, disk(px(measured.pinHeadRadius), .21, .235, 96), 'selector', PALETTE.muted, position);
    attach('suspensionRearHead' + i, disk(px(measured.pinHeadRadius), -.105, -.082, 96), 'selector', PALETTE.muted, position);
  });

  // Rectangular through passages accommodate horizontal rack travel and the
  // governor's vertical selection. The solid guides do not contain the rod.
  for (const [i, left, right] of [[0, 143, 184], [1, 1618, 1659]]) {
    const shape = clip.difference(poly([[-.16, source([0, 727])[1]], [.16, source([0, 727])[1]],
      [.16, source([0, 444])[1]], [-.16, source([0, 444])[1]]]),
    poly([[-.085, source([0, 674])[1]], [.085, source([0, 674])[1]],
      [.085, source([0, 494])[1]], [-.085, source([0, 494])[1]]]));
    const geometry = plate(shape, source([left, 0])[0], source([right, 0])[0]);
    geometry.rotateY(Math.PI / 2);
    attach('rackGuide' + i, geometry, 'fixed', PALETTE.muted);
  }
  // The engraving's rear bearing standard is partly hidden by the wheel.
  // A finite rear block and a real shaft bore supply that support in 3D.
  const rearBearing = clip.difference(rectangle(875, 552, 941, 660), poly(circle([0, 0], px(measured.cam.shaftRadius + 1), 128)));
  attach('rearShaftBearing', plate(rearBearing, -.35, -.275), 'fixed', PALETTE.muted);
  const standard = clip.union(rectangle(671, 575, 1137, 611), rectangle(671, 575, 689, 1010), rectangle(1119, 575, 1137, 979));
  attach('rearBearingStandard', plate(standard, -.45, -.35), 'fixed', PALETTE.muted);
  const limits = {
    rackX: [Math.max(...measured.slots.map((s, i) => measured.pins[i][0] - s.right + measured.pinRadius)),
      Math.min(...measured.slots.map((s, i) => measured.pins[i][0] - s.left - measured.pinRadius))].map(px),
    selectorY: [px(611 - 674), px(568 - 494)],
  };
  const setState = ({camAngle = 0, rackX = 0, selectorY = 0} = {}) => {
    if (![camAngle, rackX, selectorY].every(Number.isFinite)) throw Error('Nonfinite selector-rack state');
    blocks.cam.rotation.z = camAngle; blocks.frame.position.set(rackX, selectorY, 0); blocks.selector.position.y = selectorY;
    root.updateMatrixWorld(true); return root.userData.state = {camAngle, rackX, selectorY};
  };
  root.userData = {parts, families, blocks, profiles, source: measured, geometry: {layers, limits}, setState,
    hideGround: true, cameraFov: 8, shadowCameraHalfExtent: 5, shadowBias: -.00003, shadowNormalBias: .003,
    mechanism: 'source-shaped-selector-double-rack-candidate', fidelity: 'candidate',
    qualification: 'Finite source-shaped single cam, complete rear wheel, irregular rack contours, genuine suspension slots and bored pin joints. Thicknesses, hidden guide/bearing hardware, common axis and obscured tooth contours are reconstruction assumptions. This is independent pose control; it supplies no contact-derived motion or force qualification.'};
  setState(); markShadows(root);
  return {root, setState, update: () => {}, cameraDirection: new THREE.Vector3(0, 0, 10)};
}
