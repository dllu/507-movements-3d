import * as THREE from 'three';
import { PALETTE, matte, markShadows } from './primitives.js';
import { bevelBodyGeometry, bevelToothGeometry } from './bevel-geometry.js';
const Z_AXIS = new THREE.Vector3(0, 0, 1);

export function makeMiterGear({
  axis,
  boreRadius = null,
  color,
  indexToothIndex = 0,
  innerDistance = 0.28,
  installedToothIndices = null,
  outerDistance = 1.08,
  pitchConeAngle = Math.PI / 4,
  teeth = 24,
  toothHeight = 0.14,
}) {
  const root = new THREE.Group();
  const rotor = new THREE.Group();
  const fullTurn = Math.PI * 2;
  root.add(rotor);
  root.quaternion.setFromUnitVectors(Z_AXIS, axis.clone().normalize());
  root.userData.rotor = rotor;

  const pitchRadiusAt = (distance) => distance * Math.tan(pitchConeAngle);
  const toothGeometry = bevelToothGeometry({
    teeth, innerDistance, outerDistance, pitchConeAngle, toothHeight,
  });
  const body = new THREE.Mesh(
    bevelBodyGeometry(toothGeometry, boreRadius ?? 0),
    matte(color, { metalness: 0.14, roughness: 0.63 }),
  );
  body.userData.bevelGearBody = true;
  rotor.add(body);
  const toothMaterial = matte(color, { metalness: 0.16, roughness: 0.58 });
  const indexToothMaterial = matte(PALETTE.white, { metalness: 0.04, roughness: 0.49 });
  const halfToothAngle = Math.PI / (2 * teeth) * 0.96;
  const toothMeshes = [];
  const installedIndices = installedToothIndices == null
    ? Array.from({ length: teeth }, (_, index) => index)
    : [...new Set(installedToothIndices)].sort((left, right) => left - right);
  const installedIndexSet = new Set(installedIndices);
  for (let index = 0; index < teeth; index += 1) {
    if (!installedIndexSet.has(index)) continue;
    const tooth = new THREE.Mesh(
      toothGeometry,
      index === indexToothIndex ? indexToothMaterial : toothMaterial,
    );
    tooth.rotation.z = index * Math.PI * 2 / teeth;
    tooth.userData.bevelTooth = true;
    tooth.userData.index = index;
    toothMeshes.push(tooth);
    rotor.add(tooth);
  }
  const outerFaceZ = toothGeometry.userData.root.z;

  const hub = new THREE.Mesh(
    Number.isFinite(boreRadius)
      ? makeCircularAnnulusGeometry({
        boreRadius,
        depth: outerDistance - innerDistance + 0.24,
        outerRadius: boreRadius + 0.095,
      })
      : new THREE.CylinderGeometry(0.17, 0.17, outerDistance - innerDistance + 0.2, 28),
    matte(PALETTE.ink, { metalness: 0.22, roughness: 0.5 }),
  );
  if (Number.isFinite(boreRadius)) {
    hub.position.z = (innerDistance + outerDistance) / 2;
  } else {
    hub.rotation.x = Math.PI / 2;
    hub.position.z = (innerDistance + outerDistance) / 2 + 0.02;
  }
  const outerPitchRadius = pitchRadiusAt(outerDistance);
  const inset = new THREE.Mesh(
    new THREE.TorusGeometry(outerPitchRadius * 0.56, 0.035, 8, 48),
    matte(PALETTE.ink),
  );
  inset.position.z = outerFaceZ + 0.018;
  const indicator = new THREE.Mesh(
    new THREE.BoxGeometry(outerPitchRadius * 0.46, 0.055, 0.025),
    matte(PALETTE.white, { roughness: 0.5 }),
  );
  indicator.position.set(outerPitchRadius * 0.47, 0, outerFaceZ + 0.035);
  rotor.add(hub, inset, indicator);

  root.userData.axis = axis.clone().normalize();
  root.userData.body = body;
  root.userData.boreRadius = boreRadius;
  root.userData.halfToothAngle = halfToothAngle;
  root.userData.hub = hub;
  root.userData.indicator = indicator;
  root.userData.indexToothIndex = indexToothIndex;
  root.userData.inset = inset;
  root.userData.innerDistance = innerDistance;
  root.userData.installedToothIndices = installedIndices;
  root.userData.missingToothIndices = Array.from(
    { length: teeth },
    (_, index) => index,
  ).filter((index) => !installedIndexSet.has(index));
  root.userData.mutilated = installedIndices.length < teeth;
  root.userData.outerDistance = outerDistance;
  root.userData.outerPitchRadius = outerPitchRadius;
  root.userData.pitchConeAngle = pitchConeAngle;
  root.userData.teeth = teeth;
  root.userData.toothHeight = toothHeight;
  root.userData.toothPitch = fullTurn / teeth;
  root.userData.looseOnShaft = Number.isFinite(boreRadius);
  root.userData.toothMeshes = toothMeshes;
  root.userData.toothProfile = 'back-cone-involute-approximation';
  root.userData.toothRadii = {
    largeRootRadius: toothGeometry.userData.root.radius,
    largeTipRadius: outerPitchRadius + toothGeometry.userData.height * 0.45 * Math.cos(pitchConeAngle),
    smallRootRadius: toothGeometry.userData.root.radius * innerDistance / outerDistance,
    smallTipRadius: (outerPitchRadius + toothGeometry.userData.height * 0.45 * Math.cos(pitchConeAngle)) * innerDistance / outerDistance,
  };
  return markShadows(root);
}

export function makeCircularAnnulusGeometry({ boreRadius, depth, outerRadius }) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, boreRadius, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 64,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}
