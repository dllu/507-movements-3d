import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { circle, plate, poly, polygonClipping as clip } from './finite-plate-geometry.js';

// Riveted chain pin along Z: a shank spanning the outer plates with a
// chamfered head on each end. Each head is sunk slightly into its plate and
// stands proud of the plate face, so no pin end lies flush with (and
// z-fights) the link face it passes through.
export function headedChainPinGeometry({
  embed = 0.008,
  headRadius,
  proud = 0.012,
  radius,
  span,
  segments = 28,
}) {
  const half = span / 2;
  const chamfer = Math.min(proud * 0.5, (headRadius - radius) * 0.8);
  const profile = [
    [0, -half - proud],
    [headRadius - chamfer, -half - proud],
    [headRadius, -half - proud + chamfer],
    [headRadius, -half + embed],
    [radius, -half + embed],
    [radius, half - embed],
    [headRadius, half - embed],
    [headRadius, half + proud - chamfer],
    [headRadius - chamfer, half + proud],
    [0, half + proud],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const source = new THREE.LatheGeometry(profile, segments);
  source.rotateX(Math.PI / 2);
  const geometry = toCreasedNormals(source, Math.PI / 5);
  source.dispose();
  geometry.userData = {
    embed,
    headRadius,
    pinRadius: radius,
    proud,
    span,
  };
  return geometry;
}

// Links alternate as in a plate chain: inner links carry one central bored
// plate, outer links straddle them with two side plates and own both pins.
// Shared by 334's suspension chain D and 342's beam-segment chain.
export function makePlateChainLink({
  chainMaterial,
  darkMaterial,
  geometry,
  nominalPitch,
  outer,
  role = 'articulated-link-of-D-suspension-chain',
  width,
}) {
  const { chainInnerHalfDepth, chainLineZ, chainOuterHigh, chainOuterLow,
    chainPinRadius } = geometry;
  const plateDepth = geometry.chainOuterPlateDepth ?? 0.04;
  const link = new THREE.Group();
  link.userData.flexibleChainElement = true;
  link.userData.nominalArcPitch = nominalPitch;
  link.userData.outerLink = outer;
  link.userData.role = role;
  const eyeRadius = width * 0.47;
  const boreRadius = chainPinRadius + 0.008;
  const outline = clip.union(
    poly([[0, -width * 0.27], [nominalPitch, -width * 0.27],
      [nominalPitch, width * 0.27], [0, width * 0.27]]),
    poly(circle([0, 0], eyeRadius, 48)),
    poly(circle([nominalPitch, 0], eyeRadius, 48)),
  );
  const bored = clip.difference(outline,
    poly(circle([0, 0], boreRadius, 48)),
    poly(circle([nominalPitch, 0], boreRadius, 48)));
  const plateSpans = outer
    ? [[chainOuterLow, chainOuterLow + plateDepth],
      [chainOuterHigh - plateDepth, chainOuterHigh]]
    : [[chainLineZ - chainInnerHalfDepth, chainLineZ + chainInnerHalfDepth]];
  const plates = plateSpans.map(([low, high]) => {
    const mesh = new THREE.Mesh(plate(outer ? outline : bored, low, high),
      chainMaterial);
    mesh.position.x = -nominalPitch / 2;
    if (!outer) {
      mesh.userData.bores = [
        { x: 0, y: 0, radius: boreRadius },
        { x: nominalPitch, y: 0, radius: boreRadius },
      ];
    }
    mesh.userData.role = outer
      ? 'chain-outer-side-plate'
      : 'chain-inner-bored-plate';
    return mesh;
  });
  const body = new THREE.Group();
  body.position.x = nominalPitch / 2;
  body.userData.role = 'chain-side-plate-between-adjacent-pins';
  body.add(...plates);
  const pinGeometry = outer ? headedChainPinGeometry({
    headRadius: Math.min(chainPinRadius * 1.35, eyeRadius * 0.8),
    proud: geometry.chainPinHeadProud ?? 0.012,
    radius: chainPinRadius,
    span: chainOuterHigh - chainOuterLow,
  }) : null;
  const pins = outer ? [0, nominalPitch].map((x, index) => {
    const pin = new THREE.Mesh(index ? pinGeometry.clone() : pinGeometry,
      darkMaterial);
    pin.position.set(x - nominalPitch / 2, 0,
      (chainOuterHigh + chainOuterLow) / 2);
    pin.userData.role = x === 0 ? 'chain-link-start-pin' : 'chain-link-end-pin';
    body.add(pin);
    return pin;
  }) : [null, null];
  const startAnchor = new THREE.Object3D();
  startAnchor.position.z = chainLineZ;
  startAnchor.userData.role = 'analytic-chain-link-start';
  const endAnchor = new THREE.Object3D();
  endAnchor.position.set(nominalPitch, 0, chainLineZ);
  endAnchor.userData.role = 'analytic-chain-link-end';
  link.add(body, startAnchor, endAnchor);
  return {
    body,
    endAnchor,
    endBoss: plates[0],
    endPin: pins[1],
    link,
    plates,
    startAnchor,
    startBoss: plates[0],
    startPin: pins[0],
  };
}
