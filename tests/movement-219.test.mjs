import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));
const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function disposeModel(root) {
  const geometries = new Set();
  const materials = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (Array.isArray(object.material)) {
      object.material.forEach((material) => materials.add(material));
    } else if (object.material) {
      materials.add(object.material);
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vectorNear(actual, expected, tolerance, message) {
  assert.ok(
    actual.distanceTo(expected) <= tolerance,
    `${message}: expected ${expected.toArray()}, received ${actual.toArray()}`,
  );
}

function signedGeometryVolume(geometry) {
  const positions = geometry.attributes.position;
  const indices = geometry.index.array;
  let volume = 0;
  for (let index = 0; index < indices.length; index += 3) {
    const first = new THREE.Vector3().fromBufferAttribute(
      positions,
      indices[index],
    );
    const second = new THREE.Vector3().fromBufferAttribute(
      positions,
      indices[index + 1],
    );
    const third = new THREE.Vector3().fromBufferAttribute(
      positions,
      indices[index + 2],
    );
    volume += first.dot(second.clone().cross(third)) / 6;
  }
  return volume;
}

test('movement 219 is one eccentric crown wheel and one keyed long pinion', () => {
  const movement = catalog.movements[218];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    geometry,
    mechanism,
    sourceAnimation,
  } = model.root.userData;

  assert.equal(movement.id, 219);
  assert.equal(movement.number, '219');
  assert.equal(
    movement.title,
    'Variable circular motion by crown-wheel and pinion',
  );
  assert.equal(movement.category, 'Bevel gearing');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'eccentric-circular-crown-wheel-sliding-involute-pinion',
  );
  assert.equal(archetype, movement.archetype);
  assert.equal(
    mechanism,
    'eccentric-crown-wheel-with-long-fixed-pinion',
  );
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.sourceUrl, movement.sourceUrl);

  assert.equal(blocks.crownRing.parent, blocks.crownAssembly.userData.rotor);
  assert.equal(blocks.crownHub.parent, blocks.crownAssembly.userData.rotor);
  assert.equal(blocks.crownShaft.parent, blocks.crownAssembly.userData.rotor);
  assert.equal(blocks.crownSpokes.length, 4);
  assert.ok(blocks.crownSpokes.every(
    (spoke) => spoke.parent === blocks.crownAssembly.userData.rotor,
  ));
  assert.equal(blocks.crownTeeth.length, geometry.crownTeethCount);
  assert.ok(blocks.crownTeeth.every(
    (tooth) => tooth.parent === blocks.crownAssembly.userData.rotor,
  ));
  assert.equal(blocks.pinion.parent, model.root);
  assert.equal(blocks.pinionCollar.parent, blocks.pinion.userData.rotor);
  assert.equal(blocks.pinionShaft.parent, model.root);
  assert.equal(blocks.pinionSplineRibs.length, 4);
  assert.ok(blocks.pinionSplineRibs.every(
    (rib) => rib.parent === blocks.pinionShaft.userData.rotor,
  ));
  assert.equal(blocks.pinion.userData.axiallySliding, false);
  assert.ok(geometry.pinionDepth > geometry.maximumPitchRadius
    - geometry.minimumPitchRadius + geometry.crownToothRadialDepth,
    'the long pinion face spans the whole relative-radius range');
  assert.equal(blocks.pinion.userData.keyedToShaft, true);
  assert.ok(blocks.pinion.userData.axis.distanceTo(X_AXIS) < 1e-12);
  assert.ok(blocks.pinionShaft.userData.axis.distanceTo(X_AXIS) < 1e-12);
  assert.ok(blocks.crownAssembly.userData.axis.distanceTo(Z_AXIS) < 1e-12);
  assert.ok(Math.abs(
    blocks.pinion.userData.axis.dot(blocks.crownAssembly.userData.axis),
  ) < 1e-12, 'the crown and pinion axes are perpendicular');

  const frameParts = [];
  model.root.traverse((object) => {
    if (/frame|rail|backdrop/.test(object.userData.role ?? '')) {
      frameParts.push(object);
    }
  });
  assert.deepEqual(frameParts, [],
    'the source-only study has no invented stationary support bars');
  assert.ok(model.root.userData.cameraFitBounds?.isBox3);
  disposeModel(model.root);
});

test('movement 219 preserves the official eccentric source construction', () => {
  const model = createMovementModel(catalog.movements[218]);
  const {
    blocks,
    canonicalTimes,
    geometry,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate219;

  assert.equal(
    sourceReference.sourceUrl,
    'https://507movements.com/mm_219.html',
  );
  assert.match(
    sourceReference.officialDescription,
    /crown-wheel is placed eccentrically to the shaft/i,
  );
  assert.deepEqual(plate.rasterCrownGeometricCenter.toArray(), [219, 255]);
  assert.deepEqual(plate.rasterShaftCenter.toArray(), [265, 278]);
  assert.deepEqual(plate.rasterPinionCenter.toArray(), [291, 220]);
  assert.deepEqual(plate.rasterShaftFarPoint.toArray(), [489, 75]);
  assert.equal(plate.rasterCrownOuterRadius, 143);
  assert.equal(plate.rasterPinionRadius, 14);
  const rasterEccentricity = plate.rasterCrownGeometricCenter.distanceTo(
    plate.rasterShaftCenter,
  ) / plate.rasterCrownOuterRadius;
  assert.ok(rasterEccentricity > 0.3 && rasterEccentricity < 0.4);
  assert.ok(Math.abs(
    geometry.eccentricity / geometry.crownPitchCircleRadius
      - rasterEccentricity,
  ) < 0.1, 'the modeled offset preserves the conspicuous source eccentricity');
  const rasterPinionRay = plate.rasterPinionCenter.clone().sub(
    plate.rasterShaftCenter,
  ).normalize();
  const rasterShaftRay = plate.rasterShaftFarPoint.clone().sub(
    plate.rasterShaftCenter,
  ).normalize();
  assert.ok(rasterPinionRay.dot(rasterShaftRay) > 0.9,
    'the source pinion lies on the long sliding-shaft direction');

  model.update(canonicalTimes.sourcePoseNearestRadius);
  const sourceState = model.root.userData.kinematics;
  near(sourceState.crownAngle, geometry.sourcePoseAngle, 0,
    'source crown angle');
  near(sourceState.pitchRadius, geometry.minimumPitchRadius, 3e-16,
    'source pinion is at the nearest eccentric radius');
  vectorNear(
    sourceState.eccentricCenter,
    new THREE.Vector3(
      -geometry.eccentricity,
      0,
      geometry.crownBodyCenterZ,
    ),
    2e-16,
    'source eccentric-circle center',
  );
  near(
    blocks.crownRing.userData.geometricCenter.x,
    geometry.eccentricity,
    0,
    'wheel-local geometric-center offset',
  );
  assert.ok(Math.hypot(blocks.crownHub.position.x, blocks.crownHub.position.y) < 1e-12,
    'the hub remains at the true arbor, not the crown-circle center');
  assert.ok(sourceState.contactAxialPosition < geometry.averagePitchRadius);
  assert.ok(sourceState.contactPoint.x > 0);
  assert.ok(sourceState.contactPoint.y === 0);
  disposeModel(model.root);
});

test('movement 219 uses equal pitch travel for forty crown teeth and a true involute pinion', () => {
  const model = createMovementModel(catalog.movements[218]);
  const {
    blocks,
    geometry,
    pitchTravelFromZero,
    transmission,
  } = model.root.userData;

  assert.equal(geometry.crownTeethCount, 40);
  assert.equal(geometry.pinionTeethCount, 8);
  assert.match(model.root.userData.toothCountRationale, /schematic/i);
  assert.equal(blocks.pinion.userData.teeth, geometry.pinionTeethCount);
  assert.equal(blocks.pinion.userData.toothProfile, 'true-involute');
  near(blocks.pinion.userData.pressureAngle, THREE.MathUtils.degToRad(20), 0,
    'pinion pressure angle');
  near(blocks.pinion.userData.module, geometry.module, 0,
    'pinion module');
  near(
    2 * geometry.pinionPitchRadius / geometry.pinionTeethCount,
    geometry.module,
    0,
    'pinion pitch diameter law',
  );
  near(geometry.circularPitch, Math.PI * geometry.module, 6e-17,
    'common circular pitch');
  near(
    geometry.cyclePitchTravel,
    geometry.crownTeethCount * geometry.circularPitch,
    2e-15,
    'one crown cycle contains forty equal pitch lengths',
  );
  near(
    FULL_TURN * geometry.pinionPitchRadius / geometry.pinionTeethCount,
    geometry.circularPitch,
    6e-17,
    'one pinion tooth has the same pitch length',
  );
  near(
    transmission.averageSpeedRatio,
    geometry.crownTeethCount / geometry.pinionTeethCount,
    0,
    'whole-cycle tooth ratio',
  );

  const angles = geometry.toothBodyAngles;
  const travels = geometry.toothPitchTravels;
  assert.equal(angles.length, geometry.crownTeethCount);
  assert.equal(travels.length, geometry.crownTeethCount);
  near(angles[0], 0, 1.1e-17, 'first crown tooth angle');
  near(angles[geometry.crownTeethCount / 2], Math.PI, 3e-15,
    'opposite crown tooth angle');
  let minimumAngularPitch = Infinity;
  let maximumAngularPitch = -Infinity;
  for (let index = 0; index < geometry.crownTeethCount; index += 1) {
    const nextIndex = (index + 1) % geometry.crownTeethCount;
    const nextAngle = nextIndex === 0 ? FULL_TURN : angles[nextIndex];
    const pitchTravel = pitchTravelFromZero(nextAngle)
      - pitchTravelFromZero(angles[index]);
    near(pitchTravel, geometry.circularPitch, 1.2e-14,
      `crown tooth pitch ${index + 1}`);
    near(travels[index], index * geometry.circularPitch, 2e-15,
      `stored crown tooth travel ${index + 1}`);
    const angularPitch = nextAngle - angles[index];
    minimumAngularPitch = Math.min(minimumAngularPitch, angularPitch);
    maximumAngularPitch = Math.max(maximumAngularPitch, angularPitch);

    const tooth = blocks.crownTeeth[index];
    near(tooth.userData.bodyAngle, angles[index], 0,
      `tooth ${index + 1} body angle`);
    near(tooth.userData.pitchTravel, travels[index], 0,
      `tooth ${index + 1} pitch travel`);
    near(Math.hypot(tooth.position.x, tooth.position.y),
      tooth.userData.pitchRadius, 5e-16,
      `tooth ${index + 1} lies on the eccentric pitch locus`);
    near(tooth.rotation.z, angles[index], 0,
      `tooth ${index + 1} is radial to the true arbor`);
    assert.equal(tooth.userData.radialToArbor, true);
  }
  assert.ok(maximumAngularPitch / minimumAngularPitch > 1.65,
    'angular tooth spacing expands where the relative radius contracts');
  assert.ok(signedGeometryVolume(blocks.crownTeeth[0].geometry) > 0,
    'each crown tooth is a closed outward-facing solid');
  disposeModel(model.root);
});

test('movement 219 preserves eccentric contact and exact rolling through 32,769 states', () => {
  const model = createMovementModel(catalog.movements[218]);
  const {
    geometry,
    solidClearanceAtInputTravel,
    stateAtInputTravel,
    transmission,
  } = model.root.userData;
  let minimumRadius = Infinity;
  let maximumRadius = -Infinity;
  let maximumCircleError = 0;
  let maximumMeshPitchError = 0;
  let maximumRollingError = 0;

  for (let index = 0; index <= 32768; index += 1) {
    const inputTravel = index / 32768 * FULL_TURN;
    const state = stateAtInputTravel(inputTravel);
    minimumRadius = Math.min(minimumRadius, state.pitchRadius);
    maximumRadius = Math.max(maximumRadius, state.pitchRadius);
    const planarContact = new THREE.Vector2(
      state.contactPoint.x,
      state.contactPoint.y,
    );
    const planarEccentricCenter = new THREE.Vector2(
      state.eccentricCenter.x,
      state.eccentricCenter.y,
    );
    maximumCircleError = Math.max(
      maximumCircleError,
      Math.abs(
        planarContact.distanceTo(planarEccentricCenter)
          - geometry.crownPitchCircleRadius
      ),
    );
    const bodyContact = planarContact.clone().rotateAround(
      new THREE.Vector2(),
      -state.crownAngle,
    );
    near(
      bodyContact.distanceTo(new THREE.Vector2(geometry.eccentricity, 0)),
      geometry.crownPitchCircleRadius,
      1.5e-15,
      `body pitch-circle contact ${index}`,
    );
    vectorNear(
      state.pinionCenter,
      new THREE.Vector3(
        geometry.pinionAxialCenterX,
        0,
        geometry.pinionCenterZ,
      ),
      0,
      `fixed long-pinion center ${index}`,
    );
    near(state.contactAxialPosition, state.pitchRadius, 0,
      `contact travels along the pinion face ${index}`);
    near(
      state.pinionCenter.z - state.contactPoint.z,
      geometry.pinionPitchRadius,
      6e-17,
      `pinion pitch contact ${index}`,
    );
    near(
      state.speedRatio,
      state.pitchRadius / geometry.pinionPitchRadius,
      2e-15,
      `instantaneous relative-radius ratio ${index}`,
    );
    near(
      state.pinionAngularSpeed * geometry.pinionPitchRadius,
      state.crownAngularSpeed * state.pitchRadius,
      5e-16,
      `rolling pitch speed ${index}`,
    );
    near(state.crownSurfaceVelocity.x, 0, 0,
      `crown axial velocity ${index}`);
    near(state.crownSurfaceVelocity.y,
      state.pinionRotationalSurfaceVelocity.y, 5e-16,
      `transverse rolling velocity ${index}`);
    near(state.pinionSurfaceVelocity.x, 0, 0,
      `no axial slip at the pitch point ${index}`);
    maximumMeshPitchError = Math.max(
      maximumMeshPitchError,
      state.centeredMeshPitchInvariant,
    );
    maximumRollingError = Math.max(
      maximumRollingError,
      state.rollingSpeedError,
    );
    const clearances = solidClearanceAtInputTravel(inputTravel);
    assert.ok(clearances.pinionRootToCrownBody > 0.25);
    assert.ok(clearances.shaftToCrownBody > 0.52);
    assert.ok(clearances.pinionFaceMargin > 0.04);
    assert.ok(clearances.shaftTravelMargin > 0.3);
  }

  near(minimumRadius, geometry.minimumPitchRadius, 3e-16,
    'minimum eccentric radius');
  near(maximumRadius, geometry.maximumPitchRadius, 0,
    'maximum eccentric radius');
  assert.ok(maximumCircleError < 1.5e-15);
  assert.ok(maximumMeshPitchError < 1.5e-14);
  assert.ok(maximumRollingError < 5e-16);
  near(
    transmission.minimumSpeedRatio,
    geometry.minimumPitchRadius / geometry.pinionPitchRadius,
    0,
    'minimum speed ratio',
  );
  near(
    transmission.maximumSpeedRatio,
    geometry.maximumPitchRadius / geometry.pinionPitchRadius,
    0,
    'maximum speed ratio',
  );
  assert.ok(transmission.maximumSpeedRatio
    / transmission.minimumSpeedRatio > 1.7);
  disposeModel(model.root);
});

test('movement 219 analytic rates, axial travel, and five-turn closure agree exactly', () => {
  const model = createMovementModel(catalog.movements[218]);
  const {
    geometry,
    pitchTravelFromZero,
    stateAtInputTravel,
    transmission,
  } = model.root.userData;
  const step = 2e-5;
  let maximumRadiusDerivativeError = 0;
  let maximumPinionRateError = 0;
  let maximumAxialAccelerationError = 0;
  for (let index = 0; index < 4096; index += 1) {
    const inputTravel = (index + 0.37) / 4096 * FULL_TURN;
    const before = stateAtInputTravel(inputTravel - step);
    const state = stateAtInputTravel(inputTravel);
    const after = stateAtInputTravel(inputTravel + step);
    const finiteRadiusDerivative = (after.pitchRadius - before.pitchRadius)
      / (2 * step);
    const finitePinionDerivative = (after.pinionAngle - before.pinionAngle)
      / (2 * step);
    const finiteAxialAcceleration = (
      after.contactAxialSpeed - before.contactAxialSpeed
    ) / (2 * step / geometry.inputAngularSpeed);
    maximumRadiusDerivativeError = Math.max(
      maximumRadiusDerivativeError,
      Math.abs(finiteRadiusDerivative - state.pitchRadiusDerivative),
    );
    maximumPinionRateError = Math.max(
      maximumPinionRateError,
      Math.abs(
        finitePinionDerivative * geometry.inputAngularSpeed
          - state.pinionAngularSpeed
      ),
    );
    maximumAxialAccelerationError = Math.max(
      maximumAxialAccelerationError,
      Math.abs(finiteAxialAcceleration - state.contactAxialAcceleration),
    );
  }
  assert.ok(maximumRadiusDerivativeError < 4e-10);
  assert.ok(maximumPinionRateError < 2e-9);
  assert.ok(maximumAxialAccelerationError < 8e-9);

  const source = stateAtInputTravel(0);
  const farthest = stateAtInputTravel(Math.PI);
  const closure = stateAtInputTravel(FULL_TURN);
  near(source.pitchRadiusDerivative, 0, 1.6e-16,
    'nearest-radius reversal speed');
  near(farthest.pitchRadiusDerivative, 0, 3e-16,
    'farthest-radius reversal speed');
  near(source.contactAxialSpeed, 0, 1.3e-16,
    'source contact-travel reversal');
  near(farthest.contactAxialSpeed, 0, 2e-16,
    'far contact-travel reversal');
  near(closure.crownAngle - source.crownAngle, FULL_TURN, 0,
    'one crown turn');
  near(
    closure.pinionAngle - source.pinionAngle,
    transmission.outputTurnsPerInputTurn * FULL_TURN,
    4e-15,
    'five-turn pinion pitch closure',
  );
  near(closure.pinionCenter.x, source.pinionCenter.x, 0,
    'fixed-pinion closure');
  near(
    pitchTravelFromZero(geometry.sourcePoseAngle + FULL_TURN)
      - pitchTravelFromZero(geometry.sourcePoseAngle),
    geometry.cyclePitchTravel,
    0,
    'positive periodic pitch integral',
  );
  near(
    pitchTravelFromZero(geometry.sourcePoseAngle - FULL_TURN)
      - pitchTravelFromZero(geometry.sourcePoseAngle),
    -geometry.cyclePitchTravel,
    0,
    'negative periodic pitch integral',
  );
  disposeModel(model.root);
});

test('movement 219 runtime binds every rigid transform while 262 remains authored', () => {
  const model = createMovementModel(catalog.movements[218]);
  const {
    blocks,
    canonicalTimes,
    geometry,
  } = model.root.userData;
  for (const time of Object.values(canonicalTimes)) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = model.root.userData.kinematics;
    near(blocks.crownAssembly.userData.rotor.rotation.z, state.crownAngle, 0,
      'rendered crown angle');
    vectorNear(blocks.pinion.position, state.pinionCenter, 0,
      'rendered long-pinion center');
    near(blocks.pinion.userData.rotor.rotation.z, state.pinionAngle, 0,
      'rendered pinion angle');
    near(blocks.pinionShaft.userData.rotor.rotation.z, state.pinionAngle, 0,
      'rendered splined-shaft angle');
    vectorNear(blocks.contactMarker.position, state.contactPoint, 0,
      'rendered pitch contact');
    const ringCenterWorld = blocks.crownRing.localToWorld(
      new THREE.Vector3(geometry.eccentricity, 0, 0),
    );
    vectorNear(ringCenterWorld, state.eccentricCenter.clone().applyMatrix4(model.root.matrixWorld), 2e-15,
      'rendered eccentric-ring center');
    const sampledTooth = blocks.crownTeeth[7];
    const expectedToothWorld = sampledTooth.position.clone().applyAxisAngle(
      Z_AXIS,
      state.crownAngle,
    );
    vectorNear(
      sampledTooth.getWorldPosition(new THREE.Vector3()),
      expectedToothWorld.applyMatrix4(model.root.matrixWorld),
      2e-15,
      'rendered rigid crown tooth',
    );
    const pinionWorldAxis = Z_AXIS.clone().applyQuaternion(
      blocks.pinion.getWorldQuaternion(new THREE.Quaternion()),
    );
    assert.ok(Math.abs(pinionWorldAxis.dot(X_AXIS.clone().applyAxisAngle(Z_AXIS, model.root.rotation.z))) > 1 - 1e-12);
    assert.ok(model.root.userData.contact.rollingDirection.distanceTo(Y_AXIS) < 1e-12);
    near(model.root.userData.contact.rollingSpeedError, 0, 5e-16,
      'runtime no-slip error');
  }

  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 6.0);
  assert.ok(size.y > 5.2);
  assert.ok(size.z > 3.2);
  let meshCount = 0;
  model.root.traverse((object) => {
    if (object.isMesh) meshCount += 1;
  });
  assert.ok(meshCount >= 55);
  assert.ok(model.cameraDirection.z > 0);

  const movement507 = createMovementModel(catalog.movements[506]);
  assert.equal(catalog.movements[506].id, 507);
  assert.equal(catalog.movements[506].fidelity, 'authored');
  assert.equal(movement507.root.userData.fidelity, 'authored');
  assert.notEqual(
    movement507.root.userData.archetype,
    model.root.userData.archetype,
  );
  disposeModel(movement507.root);
  disposeModel(model.root);
});
