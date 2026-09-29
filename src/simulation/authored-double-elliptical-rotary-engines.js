import * as THREE from 'three';
import {plate,poly,circle,polygonClipping} from './finite-plate-geometry.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';
import {
  HOLLY_LEFT_PROFILE_PATHS,
  HOLLY_RIGHT_PROFILE_PATHS,
} from './movement-429-source-profiles.js';

import hollyMate from './generated-holly-mate.js';
import { multiArea, pointInPolygon, safeClip, sectionPlate, setSteamRegions, steamVolume } from './steam-section-kit.js';

const FULL_TURN = Math.PI * 2;

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function sampleSourcePath(path, arcSampleCount = 28) {
  if (path[0] === 0) {
    const points = [];
    for (let index = 1; index < path.length; index += 2) {
      points.push(new THREE.Vector2(path[index], path[index + 1]));
    }
    return points;
  }
  if (path[0] !== 2 && path[0] !== 4) {
    throw new Error(`Unsupported Holly profile path type ${path[0]}`);
  }
  let startAngle = path[4];
  let endAngle = path[5];
  if (path[0] === 4) {
    while (endAngle < startAngle) endAngle += FULL_TURN;
  } else {
    while (endAngle > startAngle) endAngle -= FULL_TURN;
  }
  const points = [];
  for (let sample = 0; sample <= arcSampleCount; sample += 1) {
    const angle = THREE.MathUtils.lerp(
      startAngle,
      endAngle,
      sample / arcSampleCount,
    );
    points.push(new THREE.Vector2(
      path[1] + path[3] * Math.cos(angle),
      path[2] + path[3] * Math.sin(angle),
    ));
  }
  return points;
}

function chainSourceProfile(paths) {
  const remaining = paths.slice(0, 8).map((path) =>
    sampleSourcePath(path));
  const points = remaining.shift();
  const connectionGaps = [];
  while (remaining.length > 0) {
    const endpoint = points.at(-1);
    let bestDistance = Infinity;
    let bestIndex = -1;
    let reverse = false;
    for (let index = 0; index < remaining.length; index += 1) {
      const startDistance = endpoint.distanceTo(remaining[index][0]);
      if (startDistance < bestDistance) {
        bestDistance = startDistance;
        bestIndex = index;
        reverse = false;
      }
      const endDistance = endpoint.distanceTo(remaining[index].at(-1));
      if (endDistance < bestDistance) {
        bestDistance = endDistance;
        bestIndex = index;
        reverse = true;
      }
    }
    const next = remaining.splice(bestIndex, 1)[0];
    if (reverse) next.reverse();
    connectionGaps.push(bestDistance);
    points.push(...next.slice(1));
  }
  connectionGaps.push(points.at(-1).distanceTo(points[0]));
  let signedAreaTwice = 0;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const next = points[(index + 1) % points.length];
    signedAreaTwice += point.x * next.y - next.x * point.y;
  }
  if (signedAreaTwice < 0) points.reverse();
  return {
    connectionGaps,
    maximumConnectionGap: Math.max(...connectionGaps),
    points,
    signedArea: Math.abs(signedAreaTwice) / 2,
  };
}

function makeProfileGeometry(profile, scale, depth) {
  const shape = new THREE.Shape();
  const first = profile.points[0];
  shape.moveTo(first.x * scale, first.y * scale);
  for (const point of profile.points.slice(1)) {
    shape.lineTo(point.x * scale, point.y * scale);
  }
  shape.closePath();
  shape.holes.push(new THREE.Path(circle([0,0],0.364,128).map(p=>new THREE.Vector2(...p))));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    bevelSegments: 1,
    bevelSize: 0.025,
    bevelThickness: 0.025,
    curveSegments: 1,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function capsulePoints(halfCenterDistance, radius, z, arcSamples = 56) {
  const points = [];
  for (let sample = 0; sample <= arcSamples; sample += 1) {
    const angle = -Math.PI / 2 + Math.PI * sample / arcSamples;
    points.push(new THREE.Vector3(
      halfCenterDistance + radius * Math.cos(angle),
      radius * Math.sin(angle),
      z,
    ));
  }
  for (let sample = 0; sample <= arcSamples; sample += 1) {
    const angle = Math.PI / 2 + Math.PI * sample / arcSamples;
    points.push(new THREE.Vector3(
      -halfCenterDistance + radius * Math.cos(angle),
      radius * Math.sin(angle),
      z,
    ));
  }
  return points;
}

function makeClosedTube(points, radius, material, role) {
  const curve = new THREE.CatmullRomCurve3(
    points,
    true,
    'centripetal',
  );
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(
      curve,
      points.length * 2,
      radius,
      9,
      true,
    ),
    material,
  );
  tube.userData.role = role;
  return tube;
}

function makePackingStrips(paths, scale, material, prefix) {
  return paths.slice(8).map((path, index) => {
    const points = sampleSourcePath(path);
    const xs = points.map(({ x }) => x);
    const ys = points.map(({ y }) => y);
    const minimumX = Math.min(...xs);
    const maximumX = Math.max(...xs);
    const minimumY = Math.min(...ys);
    const maximumY = Math.max(...ys);
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(
        Math.max(0.07, (maximumX - minimumX) * scale),
        Math.max(0.07, (maximumY - minimumY) * scale),
        0.030,
      ),
      material,
    );
    strip.position.set(
      (minimumX + maximumX) * scale / 2,
      (minimumY + maximumY) * scale / 2,
      0.625,
    );
    strip.userData.role = `${prefix}-radial-packing-strip-${index + 1}`;
    return strip;
  });
}

function doubleEllipticalRotaryEngine(movement) {
  const root = new THREE.Group();
  const cycleDuration = 4;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const sourceScale = 0.36;
  const sourceCenterDistance = 8;
  const centerDistance = sourceCenterDistance * sourceScale;
  const halfCenterDistance = centerDistance / 2;
  const leftCenter = new THREE.Vector3(-halfCenterDistance, 0, 0);
  const rightCenter = new THREE.Vector3(halfCenterDistance, 0, 0);
  const sourceOuterHousingRadius = 6;
  const sourceInnerHousingRadius = 5.333333;
  const outerHousingRadius = sourceOuterHousingRadius * sourceScale;
  const innerHousingRadius = sourceInnerHousingRadius * sourceScale;
  const sourceShaftRadius = 1;
  const shaftRadius = sourceShaftRadius * sourceScale;
  const sourceProfilePhaseOffset = -Math.PI / 2;
  // The conjugate 1:-1 law keeps the major axes a quarter turn apart
  // (left π/2 + θ, right −θ), so both rotors' arms are parallel only at
  // θ = −π/4 + kπ/2. The playback opens at θ = −π/4, where both arms lean
  // up to the right at 45° as Brown draws them (his read about 65°, which
  // no conjugate phasing reaches).
  const openingInputAngle = -Math.PI / 4;
  const leftProfile = chainSourceProfile(HOLLY_LEFT_PROFILE_PATHS);
  const rightProfile = chainSourceProfile(HOLLY_RIGHT_PROFILE_PATHS);

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const leftAngle = inputAngle;
    const rightAngle = -inputAngle;
    const leftAngularSpeed = inputSpeed;
    const rightAngularSpeed = -inputSpeed;
    const leftAngularAcceleration = inputAcceleration;
    const rightAngularAcceleration = -inputAcceleration;
    const leftMajorAxisAngle = Math.PI / 2 + leftAngle;
    const rightMajorAxisAngle = rightAngle;
    const leftReferenceRadial = new THREE.Vector3(
      Math.cos(leftMajorAxisAngle),
      Math.sin(leftMajorAxisAngle),
      0,
    );
    const rightReferenceRadial = new THREE.Vector3(
      Math.cos(rightMajorAxisAngle),
      Math.sin(rightMajorAxisAngle),
      0,
    );
    const leftReferenceRadius = 5.324122 * sourceScale;
    const rightReferenceRadius = 5.324122 * sourceScale;
    const leftReferencePoint = leftCenter.clone().addScaledVector(
      leftReferenceRadial,
      leftReferenceRadius,
    );
    const rightReferencePoint = rightCenter.clone().addScaledVector(
      rightReferenceRadial,
      rightReferenceRadius,
    );
    const leftReferenceTangent = new THREE.Vector3(
      -leftReferenceRadial.y,
      leftReferenceRadial.x,
      0,
    );
    const rightReferenceTangent = new THREE.Vector3(
      -rightReferenceRadial.y,
      rightReferenceRadial.x,
      0,
    );
    const leftReferenceVelocity = leftReferenceTangent.clone()
      .multiplyScalar(leftReferenceRadius * leftAngularSpeed);
    const rightReferenceVelocity = rightReferenceTangent.clone()
      .multiplyScalar(rightReferenceRadius * rightAngularSpeed);
    const leftReferenceAcceleration = leftReferenceTangent.clone()
      .multiplyScalar(leftReferenceRadius * leftAngularAcceleration)
      .addScaledVector(
        leftReferenceRadial,
        -leftReferenceRadius * leftAngularSpeed ** 2,
      );
    const rightReferenceAcceleration = rightReferenceTangent.clone()
      .multiplyScalar(rightReferenceRadius * rightAngularAcceleration)
      .addScaledVector(
        rightReferenceRadial,
        -rightReferenceRadius * rightAngularSpeed ** 2,
      );
    return {
      centerDistanceResidual: leftCenter.distanceTo(rightCenter)
        - centerDistance,
      conjugateAngularSpeedResidual:
        leftAngularSpeed + rightAngularSpeed,
      inputAcceleration,
      inputAngle,
      inputSpeed,
      leftAngle,
      leftAngularAcceleration,
      leftAngularSpeed,
      leftCenter: leftCenter.clone(),
      leftMajorAxisAngle,
      leftReferenceAcceleration,
      leftReferencePoint,
      leftReferenceVelocity,
      rightAngle,
      rightAngularAcceleration,
      rightAngularSpeed,
      rightCenter: rightCenter.clone(),
      rightMajorAxisAngle,
      rightReferenceAcceleration,
      rightReferencePoint,
      rightReferenceVelocity,
      sourceProfilePhaseConstraintResidual:
        leftMajorAxisAngle + rightMajorAxisAngle - Math.PI / 2,
    };
  };

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    return {
      ...stateAtInputAngle(openingInputAngle + inputAngularSpeed * cycleTime),
      cycleTime,
      phase: cycleTime / cycleDuration,
    };
  };

  const geometry = {
    centerDistance,
    cycleDuration,
    halfCenterDistance,
    innerHousingRadius,
    inputAngularSpeed,
    leftCenter: leftCenter.clone(),
    openingInputAngle,
    leftProfilePointCount: leftProfile.points.length,
    outerHousingRadius,
    rightCenter: rightCenter.clone(),
    rightProfilePointCount: rightProfile.points.length,
    shaftRadius,
    sourceCenterDistance,
    sourceInnerHousingRadius,
    sourceOuterHousingRadius,
    sourceProfilePhaseOffset,
    sourceScale,
    sourceShaftRadius,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.25,
    roughness: 0.54,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.34,
    roughness: 0.42,
  });
  const leftMaterial = matte(PALETTE.driver, {
    metalness: 0.20,
    roughness: 0.44,
  });
  const rightMaterial = matte(PALETTE.driven, {
    metalness: 0.22,
    roughness: 0.44,
  });

  // Pass 71: Brown draws the casing in section. It is one plate cut on the
  // front plane z = zCut, holding both bores and the two port channels, which
  // run straight through the necks into the throats between the bores; the
  // back cover closes it behind. The pistons fill the bores' whole depth.
  const zCut = 0.70, zBack = -0.52;
  const rectangle=(left,bottom,right,top)=>poly([[left,bottom],[right,bottom],[right,top],[left,top]]);
  const neckTop = outerHousingRadius + 0.85, portBore = 0.26, portOuter = 0.475;
  const outerSection=polygonClipping.union(poly(circle([-halfCenterDistance,0],outerHousingRadius,512)),
    poly(circle([halfCenterDistance,0],outerHousingRadius,512)),
    rectangle(-halfCenterDistance,-outerHousingRadius,halfCenterDistance,outerHousingRadius),
    rectangle(-portOuter,-neckTop,portOuter,neckTop));
  const boreSection=polygonClipping.union(poly(circle([-halfCenterDistance,0],innerHousingRadius+0.00006,512)),
    poly(circle([halfCenterDistance,0],innerHousingRadius+0.00006,512)));
  const portChannels = {
    induction: polygonClipping.difference(rectangle(-portBore,0,portBore,neckTop+0.01),boreSection),
    eduction: polygonClipping.difference(rectangle(-portBore,-neckTop-0.01,portBore,0),boreSection),
  };
  const rearHousing = sectionPlate(polygonClipping.difference(outerSection,boreSection,portChannels.induction,portChannels.eduction),
    zBack, zCut, frameMaterial, 'fixed-double-lobed-cylinder-around-both-elliptical-pistons');
  root.add(rearHousing);
  const outerHousingWall = sectionPlate(outerSection, -0.68, zBack, frameMaterial, 'fixed-solid-back-cover-of-double-lobed-casing');
  outerHousingWall.material = [frameMaterial, frameMaterial];
  root.add(outerHousingWall);

  const leftRotor = new THREE.Group();
  leftRotor.position.copy(leftCenter);
  leftRotor.userData.role =
    'left-Holly-conjugate-toothed-elliptical-piston';
  // Pass 90: both rotors are the generated rounded conjugates (Brown's
  // U-rooted sinuous teeth and packing-stripped pistons); the official Canvas
  // outlines, whose teeth are narrow spikes, stay recorded in sourceProfiles.
  const leftPiston = new THREE.Mesh(
    makeProfileGeometry({points:hollyMate.left.map(p=>new THREE.Vector2(...p))}, 1, 1.2),
    leftMaterial,
  );
  leftPiston.position.z = 0.09;
  leftPiston.userData.role =
    'left-rounded-conjugate-elliptical-piston';
  leftRotor.add(leftPiston);
  // Brown's packing strips, one inset flush in each piston tip.
  const packingMaterial = matte(PALETTE.ink, { metalness: 0.2, roughness: 0.5 });
  const makeStrips = (outlines, prefix) => outlines.map((outline, index) => {
    const shape = new THREE.Shape(outline.map((p) => new THREE.Vector2(...p)));
    const strip = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { bevelEnabled: false, curveSegments: 1, depth: 1.2 }).translate(0, 0, -0.6), packingMaterial);
    strip.position.z = 0.09;
    strip.userData.role = `${prefix}-piston-tip-packing-strip-${index + 1}`;
    return strip;
  });
  const leftPackingStrips = makeStrips(hollyMate.strips.left, 'left');
  leftRotor.add(...leftPackingStrips);
  root.add(leftRotor);

  const rightRotor = new THREE.Group();
  rightRotor.position.copy(rightCenter);
  rightRotor.userData.role =
    'right-Holly-conjugate-toothed-elliptical-piston';
  const rightPiston = new THREE.Mesh(
    makeProfileGeometry({points:hollyMate.outline.map(p=>new THREE.Vector2(...p))}, 1, 1.2),
    rightMaterial,
  );
  rightPiston.position.z = 0.09;
  rightPiston.userData.role =
    'right-rounded-conjugate-elliptical-piston';
  rightRotor.add(rightPiston);
  const rightPackingStrips = makeStrips(hollyMate.strips.right, 'right');
  rightRotor.add(...rightPackingStrips);
  root.add(rightRotor);

  const leftShaft = cylinderAlongZ(shaftRadius, 1.30, darkMaterial, 36);
  leftShaft.position.copy(leftCenter);
  // Set into the solid back cover, so the fixed shaft is carried by the casing.
  leftShaft.position.z = 0.04;
  leftShaft.userData.role = 'left-piston-shaft-in-fixed-bearing';
  const rightShaft = cylinderAlongZ(shaftRadius, 1.30, darkMaterial, 36);
  rightShaft.position.copy(rightCenter);
  // Set into the solid back cover, so the fixed shaft is carried by the casing.
  rightShaft.position.z = 0.04;
  rightShaft.userData.role = 'right-piston-shaft-in-fixed-bearing';
  root.add(leftShaft, rightShaft);

  // ---- steam (pass 71) -------------------------------------------------------------------------
  // The working space is the two bores less the two pistons. The piece open
  // to the top throat takes live steam, which presses the pistons apart; the
  // pockets each piston carries round against the bore stay at inlet
  // pressure until they open into the bottom throat and are released there.
  const steamZ = [zBack + 0.015, zCut - 0.015];
  const steam = {
    live: steamVolume('live-steam-between-the-pistons-at-the-top', ...steamZ, { sealed: true }),
    carried: steamVolume('steam-carried-round-between-the-lobes-and-the-bore', ...steamZ, { sealed: true }),
    exhaust: steamVolume('exhaust-steam-between-the-pistons-at-the-bottom', ...steamZ, { sealed: true }),
    induction: steamVolume('live-steam-in-top-induction-channel', ...steamZ, { sealed: true }),
    eduction: steamVolume('exhaust-steam-in-bottom-eduction-channel', ...steamZ, { sealed: true }),
  };
  for (const mesh of Object.values(steam)) root.add(mesh);
  // The working faces run with small clearances (up to 0.0134 at the mesh),
  // so the outlines are grown by 0.012 and the bores shrunk by 0.012 to
  // divide the space where the faces seal.
  const grow = (outline, distance) => {
    let area = 0;
    for (let i = 0; i < outline.length; i += 1) {
      const [ax, ay] = outline[i];
      const [bx, by] = outline[(i + 1) % outline.length];
      area += ax * by - bx * ay;
    }
    const sign = area > 0 ? 1 : -1;
    return outline.map((point, i) => {
      const [px, py] = outline[(i + outline.length - 1) % outline.length];
      const [nx, ny] = outline[(i + 1) % outline.length];
      const tx = nx - px;
      const ty = ny - py;
      const length = Math.hypot(tx, ty) || 1;
      return [point[0] + sign * distance * ty / length, point[1] - sign * distance * tx / length];
    });
  };
  const leftOutline = grow(hollyMate.left.filter((_, i) => i % 3 === 0), 0.012);
  const rightOutline = grow(hollyMate.outline.filter((_, i) => i % 3 === 0), 0.012);
  const workingSpace = polygonClipping.union(poly(circle([-halfCenterDistance,0],innerHousingRadius-0.012,512)),
    poly(circle([halfCenterDistance,0],innerHousingRadius-0.012,512)));
  const placeOutline = (outline, center, angle) => [[outline.map(([x, y]) => [
    center.x + x * Math.cos(angle) - y * Math.sin(angle), center.y + x * Math.sin(angle) + y * Math.cos(angle)])]];
  const throatY = Math.sqrt(innerHousingRadius ** 2 - halfCenterDistance ** 2);
  // The channel steam runs down to the working space's own outline, across
  // the 0.012 strip in each mouth, so a piece open to a throat and the
  // channel above or below it draw as one body of steam (no double sheet).
  const channelSteam = {
    induction: safeClip('difference', rectangle(-portBore, 0, portBore, neckTop + 0.01), workingSpace),
    eduction: safeClip('difference', rectangle(-portBore, -neckTop - 0.01, portBore, 0), workingSpace),
  };
  const topMouth = rectangle(-portBore, throatY - 0.12, portBore, throatY + 0.2);
  const bottomMouth = rectangle(-portBore, -throatY - 0.2, portBore, -throatY + 0.12);
  const opens = (piece, mouth) => multiArea(safeClip('intersection', [piece], mouth)) > 1e-4;
  const piecesAt = (state) => {
    const pieces = safeClip('difference', workingSpace,
      placeOutline(leftOutline, leftCenter, state.leftAngle), placeOutline(rightOutline, rightCenter, state.rightAngle));
    const out = { live: [], carried: [], exhaust: [], large: 0 };
    for (const piece of pieces) {
      if (opens(piece, topMouth)) out.live.push(piece);
      else if (opens(piece, bottomMouth)) out.exhaust.push(piece);
      else {
        const area = multiArea([piece]);
        if (area > 1e-3) out.carried.push(piece);
        if (area > 0.2) out.large += 1;
      }
    }
    return out;
  };
  // Release events: a carried pocket opens into the bottom throat. Found by
  // sampling one revolution; the exhaust space is shown blowing down for 12°
  // after each.
  const releaseAngles = [];
  const releaseFractions = [];
  {
    const samples = 120;
    let previous = null;
    for (let i = 0; i <= samples; i += 1) {
      const angle = FULL_TURN * i / samples;
      const pieces = piecesAt(stateAtInputAngle(angle));
      const exhaustArea = multiArea(pieces.exhaust);
      if (previous !== null && pieces.large < previous.large) {
        releaseAngles.push(angle);
        // isothermal mixing of the released pocket into the exhaust space
        releaseFractions.push(THREE.MathUtils.clamp((exhaustArea - previous.exhaustArea) / exhaustArea, 0, 1));
      }
      previous = { large: pieces.large, exhaustArea };
    }
  }
  const blowdown = 12 * Math.PI / 180;
  const exhaustPressure = (angle) => {
    let pressure = 0;
    releaseAngles.forEach((release, k) => {
      const since = THREE.MathUtils.euclideanModulo(angle - release, FULL_TURN);
      pressure = Math.max(pressure, releaseFractions[k] * (1 - THREE.MathUtils.smootherstep(since, 0, blowdown)));
    });
    return pressure;
  };
  const steamReport = { releaseAngles, releaseFractions };
  const updateSteam = (state) => {
    const pieces = piecesAt(state);
    // Set together, so abutting volumes draw as one closed body of steam.
    setSteamRegions([
      { mesh: steam.live, region: pieces.live, pressure: 1 },
      { mesh: steam.carried, region: pieces.carried, pressure: 1 },
      { mesh: steam.exhaust, region: pieces.exhaust, pressure: exhaustPressure(THREE.MathUtils.euclideanModulo(state.inputAngle, FULL_TURN)) },
      { mesh: steam.induction, region: channelSteam.induction, pressure: 1 },
      { mesh: steam.eduction, region: channelSteam.eduction, pressure: 0 },
    ]);
    steamReport.last = { carried: pieces.carried.length };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    leftRotor.rotation.z = state.leftAngle;
    updateSteam(state);
    rightRotor.rotation.z = state.rightAngle;
  };

  const sourceState = stateAtInputAngle(0);
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'holly-double-conjugate-toothed-elliptical-pistons-counterrotating-one-to-one-between-central-steam-ports',
    blocks: {
      portChannels,
      steam,
      leftPackingStrips,
      leftPiston,
      leftRotor,
      leftShaft,
      outerHousingWall,
      rearHousing,
      rightPackingStrips,
      rightPiston,
      rightRotor,
      rightShaft,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      leftAndRightRotationIndependent: false,
      operatingDegreesOfFreedom: 1,
    },
    dynamics: {
      pressureExpansionCutoffLeakageFrictionInertiaAndLoadsModeled: false,
      profileContactModel:
        'The two conjugate source profiles supply the exact 1:-1 phase law. The right working face is relieved by the left rotor’s complete relative sweep with small clearance; forces, sealing and backlash dynamics are not solved.',
      steamPath:
        'Steam enters at the top center between the rotors and leaves at the bottom center as shown by Brown’s arrows; chamber thermodynamics are not solved.',
    },
    fidelity: 'authored',
    geometry,
    steamReport,
    mechanism:
      'Holly’s two distinct conjugate toothed elliptical piston profiles turn about fixed centers eight source units apart. The left piston turns counterclockwise while the right turns clockwise at exactly the same speed. Their source profiles contain the required quarter-turn major-axis offset; the right working outline receives a small swept mating correction, so left angle plus right angle remains zero and their teeth stay phased. Steam enters between them from the top and drives the rotors apart toward the enclosing double-lobed cylinder before exhausting below.',
    motion: {
      cycleDuration,
      inputAngularSpeed,
      leftDirection: 'counterclockwise',
      leftRevolutionsPerCycle: 1,
      rightDirection: 'clockwise',
      rightRevolutionsPerCycle: -1,
      speedRatioRightToLeft: -1,
    },
    sourceAnimation: {
      available: true,
      independentlyReconstructed: true,
      officialCanvasCyclePeriod: 4,
      officialCanvasCyclesPerMinute: 15,
      officialCanvasLeftRotationMultiplier: 1,
      officialCanvasModelPresent: true,
      officialCanvasRightRotationMultiplier: -1,
      reason:
        'The official Movement 429 Canvas model supplies two separate ten-path conjugate profiles, fixed pivots at (0,0) and (8,0), opposite unit rotation multipliers, and a 15-cycle-per-minute demonstration.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      leftAngle: sourceState.leftAngle,
      leftCenter: sourceState.leftCenter.clone(),
      leftMajorAxisAngle: sourceState.leftMajorAxisAngle,
      leftReferencePoint: sourceState.leftReferencePoint.clone(),
      rightAngle: sourceState.rightAngle,
      rightCenter: sourceState.rightCenter.clone(),
      rightMajorAxisAngle: sourceState.rightMajorAxisAngle,
      rightReferencePoint: sourceState.rightReferencePoint.clone(),
    },
    matingCorrection: {...hollyMate, outline: undefined, left: undefined, strips: undefined},
    sourceProfiles: {
      leftConnectionGaps: [...leftProfile.connectionGaps],
      leftMaximumConnectionGap: leftProfile.maximumConnectionGap,
      leftPathCount: HOLLY_LEFT_PROFILE_PATHS.length,
      leftPoints: leftProfile.points.map(({ x, y }) => [x, y]),
      leftSignedArea: leftProfile.signedArea,
      rightConnectionGaps: [...rightProfile.connectionGaps],
      rightMaximumConnectionGap: rightProfile.maximumConnectionGap,
      rightPathCount: HOLLY_RIGHT_PROFILE_PATHS.length,
      rightPoints: rightProfile.points.map(({ x, y }) => [x, y]),
      rightSignedArea: rightProfile.signedArea,
    },
    sourceReference: {
      brownPlate429: {
        imageHeight: 525,
        imageWidth: 525,
        leftShaftApproximateCenterPixels: [177, 273],
        measurementUncertaintyPixels: 11,
        rightShaftApproximateCenterPixels: [348, 273],
        steamPortsApproximateCenterlinePixels: 263,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'this is Holly’s patent double-elliptical rotary engine',
          'there are two elliptical pistons',
          'the pistons are geared together',
          'steam enters between the pistons',
          'the pistons rotate in opposite directions',
          'the rotary engine can be converted into a pump',
        ],
        engravingEvidence:
          'Brown’s cutaway shows two intermeshing toothed noncircular pistons on fixed side-by-side shafts, a top-center induction arrow, a bottom-center eduction arrow, a clockwise arrow on the right piston, and packing strips at the housing contacts.',
        officialCanvasEvidence:
          'The official model fixes the piston pivots at source coordinates (0,0) and (8,0), defines distinct left and right conjugate profiles with ten paths apiece, rotates the left profile by +cyclePos and the right by -cyclePos, and encloses them with radius-5.333333 inner and radius-6 outer end arcs.',
        reconstructionDisclosure:
          'The original reference profiles, centers, housing radii, opposite directions, 1:-1 speed ratio, source pose, and four-second demonstration come from the official Canvas model. The displayed right profile is generated from the unchanged left rotor’s relative sweep to remove interference while retaining over 99.7 percent of its original area. Brown gives no absolute scale, axial depth, pressure, cutoff, leakage, friction, backlash, inertia, loads, or separate timing-gear detail; those unprovided physical properties are not asserted.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 429',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      centerConstraint: 'rightCenter-leftCenter=[8*sourceScale,0]',
      conjugateRotation: 'rightAngularSpeed=-leftAngularSpeed',
      sourcePhaseConstraint:
        'leftMajorAxisAngle+rightMajorAxisAngle=pi/2',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.85, -3.06, -0.73),
    new THREE.Vector3(3.88, 3.06, 0.75),
  );
  root.userData.cameraDistanceScale = 1.03;
  root.userData.cameraDirection = new THREE.Vector3(5.1, 3.6, 12.2);
  root.userData.groundFloorY = -3.06;
  root.userData.hideGround=true;
  root.userData.solidReview={housingRadialClearance:0.00006,
    qualification:'Generated rounded conjugate rotors (pass 90: round tip lobes on the pitch circle, roots carved by the mate\'s lobes, pistons with inset packing strips, recesses swept by the mate\'s pistons; the official Canvas outlines are recorded, not rendered), bored shafts, closed double-circle working casing and open central port throats. Sampled actual-profile overlap and clearance are qualified separately in the saved contact report. Exact pressure, sealing, packing compression and load response are not modeled.'};
  root.traverse(object=>{for(const material of object.material?[].concat(object.material):[])material.fog=false;});
  markShadows(root);
  for (const mesh of Object.values(steam)) { mesh.castShadow = false; mesh.receiveShadow = false; }
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredDoubleEllipticalRotaryEngineMovement(
  movement,
) {
  if (movement.id !== 429) return null;
  return doubleEllipticalRotaryEngine(movement);
}
