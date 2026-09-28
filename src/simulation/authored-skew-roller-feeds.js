import * as THREE from 'three';
import {correctRollerParts} from './roller-working-parts.js';
import {applyRotationIndicator} from './rotation-indicator.js';
import {
  PALETTE,
  makeBeam,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function cylinderAlongAxis(
  radius,
  length,
  material,
  axis,
  segments = 40,
  openEnded = false,
) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(
      radius,
      radius,
      length,
      segments,
      1,
      openEnded,
    ),
    material,
  );
  cylinder.quaternion.setFromUnitVectors(Y_AXIS, axis.clone().normalize());
  return cylinder;
}

function torusNormalToAxis(
  majorRadius,
  tubeRadius,
  material,
  axis,
  segments = 56,
) {
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(majorRadius, tubeRadius, 10, segments),
    material,
  );
  torus.quaternion.setFromUnitVectors(Z_AXIS, axis.clone().normalize());
  return torus;
}

function skewRollerHelicalRodFeed(movement) {
  const root = new THREE.Group();

  const inputCyclePeriod = 10;
  const inputAngularSpeed = FULL_TURN / inputCyclePeriod;
  const rollerRadius = 0.47;
  const rollerBodyLength = 2.72;
  const rollerShaftLength = 3.52;
  // The rod radius is chosen so one roller turn gives exactly half a rod
  // turn: rodRadius = 2 * rollerRadius * sin(15 deg) = 0.243. The plate's rod
  // is about 0.58 of the roller radius, so this is also closer to Brown than
  // the earlier 0.23. With a half turn and a whole number of feed bands per
  // roller turn, the checkered feed cue repeats exactly at the cycle seam.
  const rodRadius = 2 * rollerRadius * Math.sin(THREE.MathUtils.degToRad(15));
  const rodAxisX = 0;
  const rodAxisZ = 0;
  const contactY = 1.40;
  const axisHalfAngle = THREE.MathUtils.degToRad(15);
  const includedAxisAngle = axisHalfAngle * 2;
  const cosineSkew = Math.cos(axisHalfAngle);
  const sineSkew = Math.sin(axisHalfAngle);
  const frontAxis = new THREE.Vector3(cosineSkew, sineSkew, 0);
  const rearAxis = new THREE.Vector3(cosineSkew, -sineSkew, 0);
  const centerOffsetZ = rollerRadius + rodRadius;
  const frontRollerCenter = new THREE.Vector3(
    rodAxisX,
    contactY,
    centerOffsetZ,
  );
  const rearRollerCenter = new THREE.Vector3(
    rodAxisX,
    contactY,
    -centerOffsetZ,
  );
  const frontContactPoint = new THREE.Vector3(
    rodAxisX,
    contactY,
    rodAxisZ + rodRadius,
  );
  const rearContactPoint = new THREE.Vector3(
    rodAxisX,
    contactY,
    rodAxisZ - rodRadius,
  );
  const rodAxialAdvancePerInputRadian = rollerRadius * cosineSkew;
  const rodRotationPerInputRadian = -rollerRadius * sineSkew / rodRadius;
  const rodAxialVelocity = rodAxialAdvancePerInputRadian
    * inputAngularSpeed;
  const rodAngularSpeed = rodRotationPerInputRadian
    * inputAngularSpeed;
  const axialAdvancePerRollerTurn =
    rodAxialAdvancePerInputRadian * FULL_TURN;
  const rodRotationPerRollerTurn =
    rodRotationPerInputRadian * FULL_TURN;
  const screwLead = FULL_TURN * rodAxialVelocity / rodAngularSpeed;

  // Feed bands: the stock is painted in bands of this pitch, alternate bands
  // with their quadrant cue turned a quarter turn (a checker), and the bands
  // travel with the stock. Three band pairs pass per roller turn.
  const rodFeedBandPitch = axialAdvancePerRollerTurn / 6;
  const rodBodyBottom = -1.03;
  const rodBodyTop = 3.87;
  const rodBodyLength = rodBodyTop - rodBodyBottom;
  const lowerMarkerWrapY = -0.82;
  const upperMarkerWrapY = 3.66;
  const markerWindowLength = upperMarkerWrapY - lowerMarkerWrapY;
  const rodMarkerCount = 9;
  const rodMarkerPitch = markerWindowLength / rodMarkerCount;
  const rodMarkerBaseCoordinates = Array.from(
    { length: rodMarkerCount },
    (_, index) => lowerMarkerWrapY + (index + 0.5) * rodMarkerPitch,
  );

  const rollerSurfaceState = ({
    axis,
    center,
    contactPoint,
    signedAngularSpeed,
  }) => {
    const rollerRadiusVector = contactPoint.clone().sub(center);
    const rollerAngularVelocity = axis.clone()
      .multiplyScalar(signedAngularSpeed);
    const rollerSurfaceVelocity = new THREE.Vector3().crossVectors(
      rollerAngularVelocity,
      rollerRadiusVector,
    );
    const rodRadiusVector = new THREE.Vector3(
      0,
      0,
      contactPoint.z - rodAxisZ,
    );
    const rodSurfaceVelocity = new THREE.Vector3(
      0,
      rodAxialVelocity,
      0,
    ).add(new THREE.Vector3().crossVectors(
      Y_AXIS.clone().multiplyScalar(rodAngularSpeed),
      rodRadiusVector,
    ));
    const normal = rollerRadiusVector.clone().normalize();
    const slipVelocity = rollerSurfaceVelocity.clone()
      .sub(rodSurfaceVelocity);
    return {
      axis: axis.clone(),
      axisNormalDot: axis.dot(normal),
      center: center.clone(),
      contactPoint: contactPoint.clone(),
      normal,
      normalSeparationError:
        center.distanceTo(contactPoint) - rollerRadius,
      rodRadiusVector,
      rodSurfaceVelocity,
      rollerAngularVelocity,
      rollerRadiusVector,
      rollerSurfaceVelocity,
      signedAngularSpeed,
      slipSpeed: slipVelocity.length(),
      slipVelocity,
    };
  };

  const contactsAtConfiguredRates = () => ({
    front: rollerSurfaceState({
      axis: frontAxis,
      center: frontRollerCenter,
      contactPoint: frontContactPoint,
      signedAngularSpeed: inputAngularSpeed,
    }),
    rear: rollerSurfaceState({
      axis: rearAxis,
      center: rearRollerCenter,
      contactPoint: rearContactPoint,
      signedAngularSpeed: -inputAngularSpeed,
    }),
  });

  const stateAtInputAngle = (inputAngle) => {
    const rodAxialDisplacement = rodAxialAdvancePerInputRadian
      * inputAngle;
    const rodAngle = rodRotationPerInputRadian * inputAngle;
    const markerStates = rodMarkerBaseCoordinates.map(
      (baseCoordinate, index) => {
        const unboundedY = baseCoordinate + rodAxialDisplacement;
        const wrappedY = lowerMarkerWrapY + positiveModulo(
          unboundedY - lowerMarkerWrapY,
          markerWindowLength,
        );
        return {
          baseAngle: index * FULL_TURN / rodMarkerCount,
          baseCoordinate,
          index,
          materialAxialCoordinate: baseCoordinate,
          unboundedY,
          wrapIndex: Math.floor(
            (unboundedY - lowerMarkerWrapY) / markerWindowLength,
          ),
          wrappedY,
          worldAngle: rodAngle + index * FULL_TURN / rodMarkerCount,
        };
      },
    );
    return {
      completedInputTurns: inputAngle / FULL_TURN,
      contacts: contactsAtConfiguredRates(),
      frontRollerAngle: inputAngle,
      frontRollerAngularSpeed: inputAngularSpeed,
      inputAngle,
      markerStates,
      rearRollerAngle: -inputAngle,
      rearRollerAngularSpeed: -inputAngularSpeed,
      rodAngle,
      rodAngularSpeed,
      rodAxialDisplacement,
      rodAxialVelocity,
      stage: 'continuous-simultaneous-rod-rotation-and-longitudinal-feed',
    };
  };

  const stateAtTime = (time) => stateAtInputAngle(
    inputAngularSpeed * time,
  );

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.18,
    roughness: 0.62,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.44,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.56,
  });
  const rodMaterial = matte(PALETTE.driven, {
    metalness: 0.15,
    roughness: 0.54,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const baseY = -1.18;
  const frame = new THREE.Group();
  frame.userData.fixed = true;
  frame.userData.role = 'fixed-bearings-for-two-skew-roller-shafts';
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(4.40, 0.16, 3.02),
    frameMaterial,
  );
  base.position.set(0, baseY, 0);
  base.userData.role = 'fixed-bed-under-skew-roller-feed';
  frame.add(base);

  const rollerSpecifications = [
    {
      axis: frontAxis,
      center: frontRollerCenter,
      contactPoint: frontContactPoint,
      name: 'front',
      spinSign: 1,
    },
    {
      axis: rearAxis,
      center: rearRollerCenter,
      contactPoint: rearContactPoint,
      name: 'rear',
      spinSign: -1,
    },
  ];
  const bearingRings = [];
  const bearingPosts = [];
  for (const specification of rollerSpecifications) {
    for (const side of [-1, 1]) {
      const bearingCenter = specification.center.clone().addScaledVector(
        specification.axis,
        side * (rollerBodyLength / 2 + 0.27),
      );
      const ring = torusNormalToAxis(
        0.145,
        0.048,
        frameMaterial,
        specification.axis,
        48,
      );
      ring.position.copy(bearingCenter);
      ring.userData.role = 'fixed-ring-bearing-on-oblique-roller-axis';
      ring.userData.roller = specification.name;
      ring.userData.side = side;
      frame.add(ring);
      bearingRings.push(ring);
      const post = makeBeam(
        new THREE.Vector3(
          bearingCenter.x,
          baseY + 0.10,
          bearingCenter.z,
        ),
        bearingCenter,
        { color: PALETTE.frame, depth: 0.13, thickness: 0.15 },
      );
      post.userData.role = 'fixed-post-supporting-oblique-roller-bearing';
      post.userData.roller = specification.name;
      post.userData.side = side;
      frame.add(post);
      bearingPosts.push(post);
    }
  }

  const rodGuideSpecifications = [
    { centerY: -0.81, role: 'lower-hidden-marker-wrap-guide' },
    { centerY: 3.65, role: 'upper-hidden-marker-wrap-guide' },
  ];
  const rodGuides = rodGuideSpecifications.map(({ centerY, role }) => {
    const guide = new THREE.Mesh(
      new THREE.CylinderGeometry(
        rodRadius + 0.070,
        rodRadius + 0.070,
        0.34,
        36,
        1,
        true,
      ),
      frameMaterial,
    );
    guide.position.set(rodAxisX, centerY, rodAxisZ);
    guide.userData.role = role;
    frame.add(guide);
    return guide;
  });
  root.add(frame);

  const rollerAssemblies = [];
  const rollerSpinRotors = [];
  const rollerBodies = [];
  const rollerShafts = [];
  const rollerEndRims = [];
  const rollerFaceIndexes = [];
  const rollerTreadIndexes = [];
  for (const specification of rollerSpecifications) {
    const assembly = new THREE.Group();
    assembly.position.copy(specification.center);
    assembly.quaternion.setFromUnitVectors(Y_AXIS, specification.axis);
    assembly.userData.axis = specification.axis.clone();
    assembly.userData.name = specification.name;
    assembly.userData.role =
      'fixed-axis-alignment-for-one-oblique-driven-roller';
    const spinRotor = new THREE.Group();
    spinRotor.userData.axisInAssemblyCoordinates = Y_AXIS.clone();
    spinRotor.userData.role =
      'rotating-roller-body-and-shaft-on-oblique-axis';
    spinRotor.userData.spinSign = specification.spinSign;
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(
        rollerRadius,
        rollerRadius,
        rollerBodyLength,
        56,
      ),
      driverMaterial,
    );
    body.userData.role = 'one-of-two-oblique-friction-drive-rollers';
    body.userData.name = specification.name;
    spinRotor.add(body);
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, rollerShaftLength, 64),
      darkMaterial,
    );
    shaft.userData.role = 'shaft-fixed-to-oblique-friction-roller';
    shaft.userData.name = specification.name;
    spinRotor.add(shaft);
    for (const side of [-1, 1]) {
      const rim = torusNormalToAxis(
        rollerRadius,
        0.038,
        darkMaterial,
        Y_AXIS,
        64,
      );
      rim.position.y = side * rollerBodyLength / 2;
      rim.userData.role = 'dark-end-rim-on-oblique-friction-roller';
      rim.userData.roller = specification.name;
      rim.userData.side = side;
      spinRotor.add(rim);
      rollerEndRims.push(rim);
      const faceIndex = new THREE.Mesh(
        new THREE.BoxGeometry(rollerRadius * 0.58, 0.028, 0.052),
        whiteMaterial,
      );
      faceIndex.position.set(
        rollerRadius * 0.36,
        side * (rollerBodyLength / 2 + 0.024),
        0,
      );
      faceIndex.userData.role =
        'white-face-index-showing-oblique-roller-spin';
      faceIndex.userData.roller = specification.name;
      faceIndex.userData.side = side;
      spinRotor.add(faceIndex);
      rollerFaceIndexes.push(faceIndex);
    }
    const treadIndex = new THREE.Mesh(
      new THREE.BoxGeometry(0.052, rollerBodyLength * 0.62, 0.035),
      whiteMaterial,
    );
    treadIndex.position.x = rollerRadius + 0.018;
    treadIndex.userData.role =
      'white-longitudinal-index-showing-oblique-roller-spin-rate';
    treadIndex.userData.roller = specification.name;
    spinRotor.add(treadIndex);
    rollerTreadIndexes.push(treadIndex);
    assembly.add(spinRotor);
    root.add(assembly);
    rollerAssemblies.push(assembly);
    rollerSpinRotors.push(spinRotor);
    rollerBodies.push(body);
    rollerShafts.push(shaft);
  }

  const rodSpinRotor = new THREE.Group();
  rodSpinRotor.position.set(rodAxisX, 0, rodAxisZ);
  rodSpinRotor.userData.axis = Y_AXIS.clone();
  rodSpinRotor.userData.role =
    'rotating-material-window-for-longitudinally-fed-cylindrical-rod';
  const rodBody = new THREE.Mesh(
    new THREE.CylinderGeometry(
      rodRadius,
      rodRadius,
      rodBodyLength,
      48,
      1,
      false,
    ),
    rodMaterial,
  );
  rodBody.position.y = (rodBodyBottom + rodBodyTop) / 2;
  rodBody.userData.role =
    'long-cylindrical-rod-driven-between-two-oblique-rollers';
  rodSpinRotor.add(rodBody);
  // The stock carries the shared quadrant cue with alternate bands of
  // rodFeedBandPitch turned a quarter (a checker), and the bands travel
  // with the rod's axial feed: the band offset is a shader uniform, so the
  // stock stays one fixed solid in its viewing window.
  applyRotationIndicator(rodBody, { axis: 'y' });
  const rodFeedOffset = { value: 0 };
  {
    const material = rodBody.material;
    const installCue = material.onBeforeCompile;
    material.onBeforeCompile = (shader) => {
      installCue(shader);
      shader.uniforms.rodFeedOffset = rodFeedOffset;
      shader.uniforms.rodFeedPitch = { value: rodFeedBandPitch };
      shader.fragmentShader = shader.fragmentShader
        .replace('uniform float rotationIndicatorStrength;',
          'uniform float rotationIndicatorStrength;\nuniform float rodFeedOffset;\nuniform float rodFeedPitch;')
        .replace('float rotationQuadrant = rotationXY.x * rotationXY.y;',
          'float rotationQuadrant = rotationXY.x * rotationXY.y'
          + ' * (mod(floor((vRotationIndicator.z - rodFeedOffset) / rodFeedPitch), 2.0) < 0.5 ? 1.0 : -1.0);');
    };
    const cacheKey = material.customProgramCacheKey;
    material.customProgramCacheKey = () => `${cacheKey()}-365-rod-feed`;
  }
  const updateRodFeedBands = (axialDisplacement) => {
    rodFeedOffset.value = positiveModulo(axialDisplacement, 2 * rodFeedBandPitch);
  };
  const rodMarkers = rodMarkerBaseCoordinates.map((baseCoordinate, index) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.042, 18, 12),
      whiteMaterial,
    );
    const baseAngle = index * FULL_TURN / rodMarkerCount;
    marker.position.set(
      Math.cos(baseAngle) * (rodRadius + 0.018),
      baseCoordinate,
      Math.sin(baseAngle) * (rodRadius + 0.018),
    );
    marker.userData.baseAngle = baseAngle;
    marker.userData.baseCoordinate = baseCoordinate;
    marker.userData.index = index;
    marker.userData.role =
      'periodic-white-material-marker-showing-rod-feed-and-spin';
    rodSpinRotor.add(marker);
    return marker;
  });
  root.add(rodSpinRotor);

  const update = (time) => {
    const state = stateAtTime(time);
    rollerSpinRotors[0].rotation.y = state.frontRollerAngle;
    rollerSpinRotors[1].rotation.y = state.rearRollerAngle;
    rodSpinRotor.rotation.y = state.rodAngle;
    updateRodFeedBands(state.rodAxialDisplacement);
    rodMarkers.forEach((marker, index) => {
      marker.position.y = state.markerStates[index].wrappedY;
    });
    root.userData.updateWorkingParts?.(state);
    root.userData.currentState = state;
    root.userData.contacts = {
      frontRollerToRod: state.contacts.front,
      rearRollerToRod: state.contacts.rear,
      maximumSlipSpeed: Math.max(
        state.contacts.front.slipSpeed,
        state.contacts.rear.slipSpeed,
      ),
    };
  };

  root.userData = {
    archetype:
      'opposed-equal-and-opposite-skew-roller-helical-rod-feed',
    blocks: {
      base,
      bearingPosts,
      bearingRings,
      frame,
      rodBody,
      rodFeedOffset,
      rodGuides,
      rodMarkers,
      rodSpinRotor,
      rollerAssemblies,
      rollerBodies,
      rollerEndRims,
      rollerFaceIndexes,
      rollerShafts,
      rollerSpinRotors,
      rollerTreadIndexes,
    },
    contactsAtConfiguredRates,
    degreesOfFreedom: {
      actuatedPhysicalRollers: 2,
      dependentCoordinates: [
        'rod longitudinal displacement',
        'rod angle about its own axis',
      ],
      independentSynchronizedDriveCoordinates: 1,
      input:
        'equal-and-opposite rotation of the two friction rollers; Brown does not show the external synchronizing drive',
      note:
        'with positive no-slip contact, the two roller surface velocities uniquely determine both components of the rod screw motion',
      storedEnergyStates: 0,
    },
    dynamics: {
      contactModel:
        'ideal positive rolling friction at two diametrically opposite point contacts; force, preload, compliance, and slip coefficient are not specified by Brown',
      sourceSpecifiesInputSpeedOrInertia: false,
      synchronizationDisclosure:
        'the engraving omits how the two rollers are powered; equal magnitudes and opposite signed spins are the compatibility condition for simultaneous no-slip contact in the reconstructed symmetric geometry',
    },
    fidelity: 'authored',
    geometry: {
      axialAdvancePerRollerTurn,
      axisHalfAngle,
      centerOffsetZ,
      contactY,
      cosineSkew,
      frontAxis: frontAxis.clone(),
      frontContactPoint: frontContactPoint.clone(),
      frontRollerCenter: frontRollerCenter.clone(),
      includedAxisAngle,
      inputAngularSpeed,
      inputCyclePeriod,
      lowerMarkerWrapY,
      markerWindowLength,
      rearAxis: rearAxis.clone(),
      rearContactPoint: rearContactPoint.clone(),
      rearRollerCenter: rearRollerCenter.clone(),
      rodAngularSpeed,
      rodAxialAdvancePerInputRadian,
      rodAxialVelocity,
      rodAxisX,
      rodAxisZ,
      rodBodyBottom,
      rodBodyLength,
      rodBodyTop,
      rodFeedBandPitch,
      rodMarkerCount,
      rodMarkerPitch,
      rodRadius,
      rodRotationPerInputRadian,
      rodRotationPerRollerTurn,
      rollerBodyLength,
      rollerRadius,
      rollerShaftLength,
      screwLead,
      sineSkew,
      upperMarkerWrapY,
    },
    markerMaterialCoordinates: rodMarkerBaseCoordinates.slice(),
    mechanism:
      'two-opposed-oblique-axis-friction-rollers-turning-equal-and-opposite-to-give-one-vertical-cylindrical-rod-simultaneous-longitudinal-and-rotary-motion',
    officialDescription: movement.description,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      pageMarksAnimationUnavailable: true,
      sourcePrescribedTiming: false,
    },
    sourceReference: {
      brownPlate365: {
        contactRegionCenter: new THREE.Vector2(250, 292),
        frontRollerLowerLeftShaftEnd: new THREE.Vector2(84, 411),
        frontRollerUpperRightShaftEnd: new THREE.Vector2(496, 209),
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 10,
        rearRollerLeftShaftEnd: new THREE.Vector2(18, 296),
        rearRollerRightShaftEnd: new THREE.Vector2(496, 302),
        rodBottomCenter: new THREE.Vector2(250, 518),
        rodCenterlineX: 250,
        rodTopCenter: new THREE.Vector2(251, 38),
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'one cylindrical rod lies between two rollers',
          'the two roller axes are oblique to each other',
          'roller rotation produces longitudinal rod motion',
          'roller rotation simultaneously produces rotary rod motion',
        ],
        engravingEvidence:
          'the plate shows a vertical slender rod pinched between a rear roller and a crossing front roller, with exposed shafts proving the two roller-axis directions',
        reconstructionDisclosure:
          'the symmetric ±15-degree axes, equal roller sizes, speed, and ideal no-slip synchronization are measured-and-engineered reconstruction choices because Brown supplies no dimensions, drive connection, speed, or contact section',
      },
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        publicationYear: 1908,
      },
    },
    stateAtInputAngle,
    stateAtTime,
    timeline: {
      demonstrationPeriod: inputCyclePeriod,
      note:
        'one deliberately uniform turn of each roller demonstrates unbounded screw feed; the physical rod does not reverse or reset because Brown supplies no finite stroke',
    },
    transmission: {
      axialLaw:
        'rod axial speed = roller radius * roller angular speed * cos(axis half-angle)',
      compatibilityLaw:
        'diametrically opposed symmetric roller axes require equal-magnitude opposite-signed roller angular speeds for both no-slip equations to agree',
      rotationLaw:
        'rod angular speed = -(roller radius / rod radius) * roller angular speed * sin(axis half-angle)',
      screwLeadLaw:
        'axial displacement per rod radian = -rod radius * cot(axis half-angle)',
      velocityResolution:
        'the common roller-surface component parallel to the rod gives translation, while opposite transverse components match the rod peripheral velocities and give spin',
    },
    visualizationDisclosure: {
      eulerianRodWindow:
        'the uniformly cylindrical stock remains in a fixed viewing window; its surface is painted as a checker of quadrant-cue bands that travel with the exact unbounded axial displacement and turn with the rod angle, so both the feed and the spin show',
      markerWrap:
        'surface-painted marker identities fade at the viewing-window edges before wrapping; their unbounded material coordinates remain available in state',
      reason:
        'an actually unbounded translating rod would eventually leave any finite camera view',
    },
  };

  update(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.18, -1.27, -1.54),
    new THREE.Vector3(2.18, 4.02, 1.54),
  );
  root.userData.groundFloorY = -1.26;
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(5.2, 3.4, 8.6),
    root,
    update,
  };
}

// Brown shades the stock and rollers with broken lengthwise hatch lines:
// engraving notation, not surface markings. The rod and rollers keep plain
// surfaces; the undrawn marker patches and tread indexes stay hidden.
function hideUndrawnMarkers(model) {
  const {blocks: b} = model.root.userData;
  for (const marker of b.rodMarkers) marker.visible = false;
  for (const index of b.rollerTreadIndexes) index.visible = false;
  model.update(0);
}

export function createAuthoredSkewRollerFeedMovement(movement) {
  if (movement.id !== 365) return null;
  const model = skewRollerHelicalRodFeed(movement);
  correctRollerParts(model, 365);
  hideUndrawnMarkers(model);
  return model;
}
