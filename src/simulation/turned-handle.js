import * as THREE from 'three';
import {plate, poly} from './finite-plate-geometry.js';

// Shared hand-crank parts (pass 92, from p90-u2's 379/380 builders).
//
// A turned handle: a flared foot, a slim neck and a bulb closed by an
// elliptical dome, lathed about +y from its foot at y = 0. `side` lists
// [radius, height fraction] stations from the foot to the bulb's widest
// point; the profile is one smooth centripetal spline.
export function turnedHandleGeometry({height, side, segments = 40}) {
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
    new THREE.Vector2(0, 0),
    ...curve.getSpacedPoints(64).map((point) => new THREE.Vector2(Math.max(0, point.x), point.y)),
  ];
  profile[profile.length - 1].x = 0;
  return new THREE.LatheGeometry(profile, segments);
}

// The usual crank handle, 379's proportions scaled to a handle of `height`
// whose bulb is `bulbRadius` across: foot 0.57, neck 0.43, waist 0.49 and
// bulb 1.0 of the bulb radius, at 0, 0.185, 0.37, 0.574 and 0.74 of the
// height (379: height 0.47, bulb 0.175).
export function standardTurnedHandleGeometry({height, bulbRadius, footRadius = 0.57 * bulbRadius, segments = 40}) {
  return turnedHandleGeometry({height, segments, side: [
    [footRadius, 0], [0.43 * bulbRadius, 0.185], [0.49 * bulbRadius, 0.37], [0.86 * bulbRadius, 0.574], [bulbRadius, 0.74],
  ]});
}

// The handle's foot is sunk this far into the arm it stands on.
export const HANDLE_FOOT_EMBED = 0.012;

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
