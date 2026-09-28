import * as THREE from 'three';
import {plate, poly} from './finite-plate-geometry.js';

// Shared hand-crank parts (pass 92, from p90-u2's 379/380 builders).
//
// A turned handle: a flared foot, a slim neck and a bulb closed by an
// elliptical dome, lathed about +y from its foot at y = 0. `side` lists
// [radius, height fraction] stations from the foot to the bulb's widest
// point; the profile is one smooth centripetal spline.
//
// Pass 98 (user: "make all the handles have the cylindrical portion be flush
// with the back side of the lever"): `shank` continues the profile below the
// foot as a straight cylinder of the foot's radius, down to y = -shank. A
// caller whose foot is sunk HANDLE_FOOT_EMBED into the lever's front face
// passes handleShank(leverThickness), so the grip runs through the lever and
// ends HANDLE_BACK_RECESS inside its back face: one turned piece, seated
// through the lever, with no floating foot and no coplanar end face. The
// crease at y = 0 lies inside the lever. shank = 0 (the default) builds the
// pre-pass-98 profile exactly.
export function turnedHandleGeometry({height, side, segments = 40, shank = 0}) {
  const [bulbRadius, bulbAt] = side.at(-1);
  const dome = [20, 40, 60, 78, 90].map((degrees) => {
    const angle = THREE.MathUtils.degToRad(degrees);
    return [bulbRadius * Math.cos(angle), bulbAt + (1 - bulbAt) * Math.sin(angle)];
  });
  const curve = new THREE.CatmullRomCurve3(
    [...side, ...dome].map(([radius, fraction]) => new THREE.Vector3(radius, fraction * height, 0)),
    false,
    'centripetal',
  );
  const profile = [
    ...(shank > 0 ? [new THREE.Vector2(0, -shank), new THREE.Vector2(side[0][0], -shank)] : [new THREE.Vector2(0, 0)]),
    ...curve.getSpacedPoints(64).map((point) => new THREE.Vector2(Math.max(0, point.x), point.y)),
  ];
  profile[profile.length - 1].x = 0;
  return new THREE.LatheGeometry(profile, segments);
}

// The usual crank handle, 379's proportions scaled to a handle of `height`
// whose bulb is `bulbRadius` across: foot 0.57, neck 0.43, waist 0.49 and
// bulb 1.0 of the bulb radius, at 0, 0.185, 0.37, 0.574 and 0.74 of the
// height (379: height 0.47, bulb 0.175).
export function standardTurnedHandleGeometry({height, bulbRadius, footRadius = 0.57 * bulbRadius, segments = 40, shank = 0}) {
  return turnedHandleGeometry({height, segments, shank, side: [
    [footRadius, 0], [0.43 * bulbRadius, 0.185], [0.49 * bulbRadius, 0.37], [0.86 * bulbRadius, 0.574], [bulbRadius, 0.74],
  ]});
}

// The handle's foot is sunk this far into the arm it stands on.
export const HANDLE_FOOT_EMBED = 0.012;

// Pass 98: a through-shank ends this far inside the lever's back face, so the
// grip is flush with the back without its end disc z-fighting the face.
export const HANDLE_BACK_RECESS = 0.005;

// Shank length for a handle whose foot is sunk `embed` into the front face of
// a lever `leverThickness` thick: the shank reaches to HANDLE_BACK_RECESS
// inside the back face.
export function handleShank(leverThickness, embed = HANDLE_FOOT_EMBED) {
  return Math.max(0, leverThickness - embed - HANDLE_BACK_RECESS);
}

// Plan outline of a crank arm whose ends are circular arcs concentric with
// the handle axis (at x = handleX) and the hub axis (at the origin): the
// convex hull of the two end circles, as [x, y] points.
export function crankArmOutline({handleX, handleEndRadius, hubEndRadius, segments = 96}) {
  const circlePoints = (cx, radius) => Array.from({length: segments}, (_, index) => {
    const angle = index * 2 * Math.PI / segments;
    return [cx + radius * Math.cos(angle), radius * Math.sin(angle)];
  });
  const points = [...circlePoints(handleX, handleEndRadius), ...circlePoints(0, hubEndRadius)];
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper = [];
  for (const point of sorted.reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), point) <= 0) upper.pop();
    upper.push(point);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

// One flat extrusion of crankArmOutline between bottomY and topY, lying in
// the horizontal plane (thickness along y), as 379's and 380's crank bars.
export function crankArmGeometry({handleX, handleEndRadius, hubEndRadius, bottomY, topY}) {
  return plate(poly(crankArmOutline({handleX, handleEndRadius, hubEndRadius})), bottomY, topY).rotateX(-Math.PI / 2);
}

// Pass 98: the same crank arm turning about the world x axis: the plan
// outline's x (towards the handle) runs along world y, its y along world z,
// and the arm is extruded along x between x0 and x1. A negative handleY hangs
// the handle below the shaft.
export function crankArmAcrossXGeometry({handleY, handleEndRadius, hubEndRadius, x0, x1}) {
  return plate(poly(crankArmOutline({handleX: handleY, handleEndRadius, hubEndRadius})), x0, x1)
    .applyMatrix4(new THREE.Matrix4().makeBasis(
      new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)));
}
