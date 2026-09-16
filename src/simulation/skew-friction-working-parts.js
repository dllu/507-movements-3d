import * as THREE from 'three';
import { boredLatheGeometry } from './bored-lathe-geometry.js';

// A small radial allowance exceeds the convex meridian's chord error. Thus
// polygonal rotation cannot put a facet outside the nominal smooth axode.
export function correctSkewFrictionParts(root) {
  const b = root.userData.blocks, g = root.userData.geometry;
  const bore = 0.099, radialAllowance = 0.0001;
  const replace = (mesh, geometry) => { mesh.geometry.dispose(); mesh.geometry = geometry; };
  const annulus = (radius, length, segments) => boredLatheGeometry([
    { axial: -length / 2, radial: radius },
    { axial: length / 2, radial: radius },
  ], bore, segments);
  for (const wheel of [b.driver, b.driven]) {
    const p = wheel.userData.blocks;
    const geometry = boredLatheGeometry(wheel.userData.profile.map(point => ({
      axial: point.y, radial: point.x - radialAllowance,
    })), bore, 96);
    geometry.rotateX(Math.PI / 2);
    replace(p.body, geometry);
    p.body.userData.exactRuledHyperboloid = false;
    p.body.userData.nominalRuledHyperboloid = true;
    for (const cap of p.endCaps) replace(cap, annulus(g.radiusAtAxial(g.bodyHalfLength - 0.035) - 0.002, 0.12, 80));
    for (const hub of p.endHubs) replace(hub, annulus(0.2, 0.34, 48));
    // Generator stripes were finite rods on the working surfaces. Retain the
    // old diagnostic nodes, but show rotation with flush end-face inlays.
    p.materialStripe.visible = false;
    for (const index of p.endFaceIndexes) {
      replace(index, new THREE.PlaneGeometry(g.endRadius * 0.6, 0.07));
      const phase = index.userData.markerPhase, side = Math.sign(index.position.z);
      index.position.set(Math.cos(phase) * g.endRadius * 0.52,
        Math.sin(phase) * g.endRadius * 0.52, side * (g.bodyHalfLength + 0.085));
      index.material = index.material.clone();
      index.material.side = THREE.DoubleSide;
      index.material.polygonOffset = true;
      index.material.polygonOffsetFactor = -1;
      index.material.polygonOffsetUnits = -1;
      index.userData.flushInlay = true;
    }
  }
  b.contactLine.visible = false;
  b.contactMarkers.forEach(marker => { marker.visible = false; });
  // The posts meet the underside of each ring, not the rotating shaft.
  b.bearingPosts.forEach((post, i) => {
    const ring = b.bearingRings[i], bottom = -2.34;
    const top = ring.position.y - 0.2;
    post.userData.setEndpoints(new THREE.Vector3(ring.position.x, bottom, ring.position.z),
      new THREE.Vector3(ring.position.x, top, ring.position.z));
  });
  root.traverse(object => {
    for (const material of [object.material].flat().filter(Boolean)) material.fog = false;
  });
  root.userData.hideGround = true;
  root.userData.minimumDisplayCycleSeconds = 6;
  root.userData.finiteFriction = { bore, shaftRadius: 0.095, radialAllowance,
    axialSegments: 128, angularSegments: 96, contactLaw: 'prescribed equal counterrotation',
    validatedDynamics: false };
  root.userData.reconstructionNote = 'Equal skew-shaft hyperboloids roll transversely while sliding along their common generator. The 1:−1 speed ratio is prescribed; friction, preload and available driving torque are not simulated. Finite mesh facets have a small running clearance. Shaft angle, dimensions and supporting frame are inferred.';
}
