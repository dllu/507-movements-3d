import * as THREE from 'three';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import { capsule, circle, plate, poly, polygonClipping as clip } from './finite-plate-geometry.js';

const replace = (mesh, geometry) => { mesh.geometry.dispose(); mesh.geometry = geometry; };
const bore = (radius, inner, length, segments = 128) => boredLatheGeometry([
  { axial: -length / 2, radial: radius }, { axial: length / 2, radial: radius },
], inner, segments);
const mesh = (parent, geometry, material, role) => {
  const part = new THREE.Mesh(geometry, material); part.userData.role = role; parent.add(part); return part;
};

function boredBar(group, start, end, { width, depth, holes, eyes }) {
  const regions = [capsule(start, end, width / 2, 32), ...eyes.map(e => poly(circle(e.center, e.radius, 64)))];
  const geometry = plate(clip.difference(clip.union(...regions), ...holes.map(h => poly(circle(h.center, h.radius, 96)))), -depth / 2, depth / 2);
  const material = group.children[0].material; group.children.forEach(o => { o.visible = false; });
  return mesh(group, geometry, material, 'finite-bored-brake-link');
}

export function correctCraneBrakeJoints(root) {
  const d = root.userData, b = d.blocks, g = d.geometry;
  const dark = b.wheelHub.material, pinRadius = .075, pinBore = .079, fulcrumBore = .119;
  // The drum is bored clear inside the hub (r .29), which alone carries the
  // .134 bore; the two no longer share a coincident bore wall.
  replace(b.wheelBody, bore(g.wheelRadius, .286, g.wheelDepth, 192));
  replace(b.wheelHub, bore(.29, .134, .62));
  const origin = [0, 0], lower = g.lowerArmLocal.toArray(), handle = g.handleLocal.toArray();
  const short = boredBar(b.leverShortArm, origin, lower, { width: .12, depth: .14,
    holes: [{ center: origin, radius: fulcrumBore }, { center: lower, radius: pinBore }],
    eyes: [{ center: origin, radius: .17 }, { center: lower, radius: .145 }] });
  const long = boredBar(b.leverHandle, origin, handle, { width: .12, depth: .14,
    holes: [{ center: origin, radius: fulcrumBore }], eyes: [{ center: origin, radius: .17 }] });
  // Both rigid lever arms share the fulcrum eye; show only one coincident cap.
  // Trim the handle plate inside the common eye without cutting its load path.
  const handleRegion = clip.difference(long.geometry.userData.plate.polygons, poly(circle(origin, .165, 96)));
  replace(long, plate(handleRegion, -.069, .069));
  const anchor = boredBar(b.upperAnchorLink, g.upperBandEnd.toArray(), g.leverFulcrum.toArray(), { width: .085, depth: .10,
    holes: [{ center: g.upperBandEnd.toArray(), radius: pinBore }, { center: g.leverFulcrum.toArray(), radius: fulcrumBore }],
    eyes: [{ center: g.upperBandEnd.toArray(), radius: .15 }, { center: g.leverFulcrum.toArray(), radius: .17 }] });
  anchor.position.z = .59;
  const lowerRing = b.lowerEndpointJoint.children[0];
  replace(lowerRing, bore(.155, pinBore, .07).rotateX(Math.PI / 2)); lowerRing.position.z = .105;
  const lowerPin = mesh(b.lowerEndpointJoint, new THREE.CylinderGeometry(pinRadius, pinRadius, .56, 48).rotateX(Math.PI / 2), dark, 'lower-strap-pin-spanning-band-and-lever');
  lowerPin.position.z = -.12;
  // Strap eyes stand 0.003 proud of the strap faces instead of sharing them.
  const eyeProud = .003;
  const upperEye = mesh(root, bore(.15, pinBore, g.bandDepth + eyeProud * 2).rotateX(Math.PI / 2), b.brakeBand.material, 'bored-upper-brake-strap-eye');
  upperEye.position.set(g.upperBandEnd.x, g.upperBandEnd.y, g.bandPlaneZ);
  const lowerEye = mesh(b.lowerEndpointJoint, bore(.15, pinBore, g.bandDepth + eyeProud * 2).rotateX(Math.PI / 2), b.brakeBand.material, 'bored-lower-brake-strap-eye');
  lowerEye.position.z = g.bandPlaneZ - b.lever.position.z;
  replace(b.upperEndpointShaft.userData.rotor.children[0], new THREE.CylinderGeometry(pinRadius, pinRadius, .95, 48));
  replace(b.leverFulcrumShaft.userData.rotor.children[0], new THREE.CylinderGeometry(.115, .115, 1.24, 48)); b.leverFulcrumShaft.position.z = .16;
  const wheelPost = boredBar(b.wheelPost, [0, -2.15], origin, { width: .15, depth: .19,
    holes: [{ center: origin, radius: .134 }], eyes: [{ center: origin, radius: .20 }] }); wheelPost.position.z = -.35;
  const f = g.leverFulcrum.toArray();
  const fulcrumPost = boredBar(b.fulcrumPost, [f[0] + .18, -2.15], f, { width: .15, depth: .19,
    holes: [{ center: f, radius: fulcrumBore }], eyes: [{ center: f, radius: .18 }] }); fulcrumPost.position.z = -.35;
  // Brown draws the strap eyes, the anchor link and the lever as one flat
  // joint. Stack them tightly about the strap plane: the lever lies against
  // the strap's front face, the anchor link against its back, and the
  // lever's fulcrum eye is a boss reaching back to the link; every pin ends
  // just proud of the stack it joins.
  const bandFront = g.bandPlaneZ + g.bandDepth / 2 + eyeProud, bandBack = g.bandPlaneZ - g.bandDepth / 2 - eyeProud;
  const gap = .005, leverDepth = .14, linkDepth = .10, proud = .03;
  const leverZ = bandFront + gap + leverDepth / 2;
  b.lever.position.z = leverZ;
  lowerEye.position.z = g.bandPlaneZ - leverZ;
  lowerRing.position.z = leverDepth / 2 + .035 + .002;
  const linkZ = bandBack - gap - linkDepth / 2;
  anchor.position.z = linkZ;
  const stackBack = linkZ - linkDepth / 2, leverFront = leverZ + leverDepth / 2;
  const bossLow = linkZ + linkDepth / 2 + .001, bossHigh = leverZ - leverDepth / 2 - .001;
  const boss = mesh(b.lever, bore(.17, fulcrumBore, bossHigh - bossLow).rotateX(Math.PI / 2), short.material, 'lever-fulcrum-boss-reaching-the-anchor-link');
  boss.position.z = (bossLow + bossHigh) / 2 - leverZ;
  const pinSpan = (pin, radius, low, high) => {
    replace(pin, new THREE.CylinderGeometry(radius, radius, high - low, 48));
    return (low + high) / 2;
  };
  const lowerHead = leverZ + lowerRing.position.z + .035;
  lowerPin.geometry.dispose();
  lowerPin.geometry = new THREE.CylinderGeometry(pinRadius, pinRadius, lowerHead - (bandBack - proud), 48).rotateX(Math.PI / 2);
  lowerPin.position.z = (lowerHead + bandBack - proud) / 2 - leverZ;
  const fulcrumPin = b.leverFulcrumShaft.userData.rotor.children[0];
  b.leverFulcrumShaft.position.z = pinSpan(fulcrumPin, .115, stackBack - proud, leverFront + proud);
  const upperPin = b.upperEndpointShaft.userData.rotor.children[0];
  b.upperEndpointShaft.position.z = pinSpan(upperPin, pinRadius, stackBack - proud, bandFront + proud);
  d.workingParts = { short, long, anchor, lowerPin, upperEye, lowerEye, lowerRing, wheelPost, fulcrumPost, boss };
  d.flatBrakeJoint = { bandBack, bandFront, leverZ, linkZ, stackBack, leverFront };
}

export function correctSpatialPulley(pulley, shaftRadius) {
  const p = pulley.userData, hub = p.hub, dimensions = hub.geometry.parameters;
  replace(hub, bore(dimensions.radiusTop, shaftRadius + .004, dimensions.height));
  // The generic raised tread index crosses the working belt. Face indexes
  // retain a legible rotation reference without interrupting that surface.
  for (const child of p.rotor.children) if (child.geometry?.type === 'BoxGeometry'
    && !p.spokes.includes(child) && !p.faceIndicators.includes(child)) child.visible = false;
}

export function finishBandDrive(root, duration, note) {
  root.userData.hideGround = true; root.userData.minimumDisplayCycleSeconds = duration;
  root.userData.cameraFov = 8; root.userData.reconstructionNote = note;
  root.traverse(o => { for (const m of [].concat(o.material ?? [])) m.fog = false; });
}
