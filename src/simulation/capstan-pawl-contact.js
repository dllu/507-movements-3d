import * as THREE from 'three';
import { capstanPawlSamples } from './capstan-pawl-profile.js';
const FULL_TURN = 2 * Math.PI;
function appendTriangle(positions, first, second, third) {
  for (const point of [first, second, third]) {
    positions.push(point.x, point.y, point.z);
  }
}

function appendQuad(positions, first, second, third, fourth) {
  appendTriangle(positions, first, second, third);
  appendTriangle(positions, first, third, fourth);
}

function polarPoint(radius, height, angle) {
  return new THREE.Vector3(
    radius * Math.cos(angle),
    height,
    radius * Math.sin(angle),
  );
}

export function makeCrownRatchetGeometry({
  bottomHeight,
  highHeight,
  innerRadius,
  lowHeight,
  outerRadius,
  phaseOffset,
  toothCount,
}) {
  const positions = [];
  const toothPitch = FULL_TURN / toothCount;
  for (let tooth = 0; tooth < toothCount; tooth += 1) {
    const startAngle = phaseOffset + tooth * toothPitch;
    const endAngle = startAngle + toothPitch;
    const lowInner = polarPoint(innerRadius, lowHeight, startAngle);
    const lowOuter = polarPoint(outerRadius, lowHeight, startAngle);
    const highInner = polarPoint(innerRadius, highHeight, endAngle);
    const highOuter = polarPoint(outerRadius, highHeight, endAngle);
    const bottomStartInner = polarPoint(
      innerRadius,
      bottomHeight,
      startAngle,
    );
    const bottomStartOuter = polarPoint(
      outerRadius,
      bottomHeight,
      startAngle,
    );
    const bottomEndInner = polarPoint(
      innerRadius,
      bottomHeight,
      endAngle,
    );
    const bottomEndOuter = polarPoint(
      outerRadius,
      bottomHeight,
      endAngle,
    );

    appendQuad(positions, lowInner, highInner, highOuter, lowOuter);
    appendQuad(
      positions,
      lowOuter,
      highOuter,
      bottomEndOuter,
      bottomStartOuter,
    );
    appendQuad(
      positions,
      highInner,
      lowInner,
      bottomStartInner,
      bottomEndInner,
    );
    appendQuad(
      positions,
      highOuter,
      highInner,
      bottomEndInner,
      bottomEndOuter,
    );
    appendQuad(
      positions,
      lowInner,
      lowOuter,
      bottomStartOuter,
      bottomStartInner,
    );
    appendQuad(
      positions,
      bottomStartInner,
      bottomStartOuter,
      bottomEndOuter,
      bottomEndInner,
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}


export const capstanPawlDimensions = Object.freeze({
  pivotRadius: 1.23, pivotHeight: -1.04, length: 0.47, tipRadius: 0.07, tipLead: 0.12,
  innerRadius: 1.37, outerRadius: 1.79, lowHeight: -1.50,
  highHeight: -1.27, bottomHeight: -1.61, toothCount: 18,
});

export const capstanPawlLeadAngle = Math.atan2(capstanPawlDimensions.tipLead,
  capstanPawlDimensions.pivotRadius + capstanPawlDimensions.length*Math.cos(Math.asin(
    (capstanPawlDimensions.highHeight+capstanPawlDimensions.tipRadius+0.00012-capstanPawlDimensions.pivotHeight)/capstanPawlDimensions.length)));

// The offline table follows actual crown triangles. Two columns retain the
// contact envelope separately from the prescribed continuous drop trajectory.
export function capstanPawlProfile(phase) {
  const coordinate = ((phase % 1 + 1) % 1) * (capstanPawlSamples.length-1);
  const i = Math.floor(coordinate), alpha = coordinate-i;
  const [p0,c0] = capstanPawlSamples[i], [p1,c1] = capstanPawlSamples[i+1];
  const pitch = p0+(p1-p0)*alpha, contactPitch = c0+(c1-c0)*alpha;
  const airborneClearance = Math.max(0,capstanPawlDimensions.length*(Math.sin(pitch)-Math.sin(contactPitch)));
  return {phase:coordinate/(capstanPawlSamples.length-1),pitch,contactPitch,airborneClearance,falling:airborneClearance > 1e-7};
}
