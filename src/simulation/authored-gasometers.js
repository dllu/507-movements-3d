import * as THREE from 'three';
import {CUTAWAY_SPECS, applyCutawayFor} from './cutaway-presentations.js';
import {PALETTE, markShadows, matte} from './primitives.js';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {circle, plate, poly, polygonClipping as clip} from './finite-plate-geometry.js';
import {horizontalPlate} from './horizontal-turbine-solids.js';
import {curvedPipeWall, mergePassageParts} from './finite-fluid-passages.js';
import {applyRotationIndicator} from './rotation-indicator.js';

// Movements 479 and 480, Brown's two gasometers, rebuilt in pass 74 from
// the plates. Both are sections through a bell A standing in a water-filled
// tank B that Brown draws as a masonry pit sunk in the ground: a hatched
// coping at ground level, a lining wall round the pit and a floor, under
// which the two gas pipes run out in a channel. The bells are taller than
// they are wide, as drawn. Scene units: 1 unit = 105 plate pixels at twice
// the plate's size (k = 0.0095 unit per 2x pixel), measured from the plates.

const FULL_TURN = Math.PI * 2;
const K = 0.0095;

const planCircle = ([x, z], r, n = 96) => poly(circle([x, -z], r, n));
const annulus = (inner, outer, holes = []) => clip.difference(planCircle([0, 0], outer, 160),
  ...(inner > 0 ? [planCircle([0, 0], inner, 160)] : []), ...holes);
const squareWithHole = (half, hole, holes = []) => clip.difference(
  poly([[-half, -half], [half, -half], [half, half], [-half, half]]), planCircle([0, 0], hole, 160), ...holes);

function addMesh(parent, geometry, material, role) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.role = role;
  parent.add(mesh);
  return mesh;
}

// Thin-walled bell: cylindrical skirt from its open rim (local y = 0) to the
// shoulder, closed by a spherical cap of the given rise (optionally with a
// central opening for a sleeve).
function bellGeometry({radius, wall, skirtHeight, rise, opening = 0}) {
  const sphere = (radius * radius + rise * rise) / (2 * rise);
  const center = skirtHeight + rise - sphere;
  const capY = (r, s) => center + Math.sqrt(Math.max(0, s * s - r * r));
  const inner = radius - wall;
  const points = [];
  // outer meridian from rim to cap top (or opening), inner back down.
  points.push(new THREE.Vector2(inner, 0), new THREE.Vector2(radius, 0), new THREE.Vector2(radius, skirtHeight));
  const steps = 40;
  for (let i = 1; i <= steps; i += 1) {
    const r = THREE.MathUtils.lerp(radius, opening, i / steps);
    points.push(new THREE.Vector2(Math.max(r, 1e-4), capY(r, sphere)));
  }
  const innerSphere = sphere - wall;
  for (let i = steps; i >= 1; i -= 1) {
    const r = THREE.MathUtils.lerp(inner, opening, i / steps);
    points.push(new THREE.Vector2(Math.max(r, 1e-4), capY(r, innerSphere)));
  }
  points.push(new THREE.Vector2(inner, skirtHeight - 0.001), new THREE.Vector2(inner, 0));
  const geometry = new THREE.LatheGeometry(points, 128);
  return {capY: (r) => capY(r, sphere), geometry, innerCapY: (r) => capY(r, innerSphere)};
}

// Brown's tank B is a pit in the ground: one solid block of masonry and
// earth with the round pit sunk in it, a floor, and under the floor a
// channel along which each pipe runs out to the edge of the block.
function buildPit(root, material, {pitRadius, groundY, floorY, slabHalf, channelHeight, pipes, pipeOuter, tubeHole, footRadius = 0, footHeight = 0}) {
  const floorThickness = 0.14;
  const channelTop = floorY - floorThickness, channelBottom = channelTop - channelHeight;
  const baseBottom = channelBottom - 0.45;
  const square = poly([[-slabHalf, -slabHalf], [slabHalf, -slabHalf], [slabHalf, slabHalf], [-slabHalf, slabHalf]]);
  const tube = tubeHole ? [planCircle([0, 0], tubeHole + 0.004, 64)] : [];
  const pipeHoles = pipes.map((x) => planCircle([x, 0], pipeOuter + 0.004, 64));
  const slot = (x) => {
    const side = Math.sign(x), w = pipeOuter + 0.02;
    const x0 = x - side * w, x1 = side * (slabHalf + 0.01);
    return poly([[Math.min(x0, x1), -w], [Math.max(x0, x1), -w], [Math.max(x0, x1), w], [Math.min(x0, x1), w]]);
  };
  const channel = clip.union(...pipes.map((x) => clip.union(slot(x), planCircle([x, 0], pipeOuter + 0.02, 64))));
  const ground = addMesh(root, mergePassageParts([
    horizontalPlate(clip.difference(square, planCircle([0, 0], pitRadius, 160)), floorY, groundY),
    horizontalPlate(clip.difference(square, ...pipeHoles, ...tube), channelTop, floorY),
    horizontalPlate(clip.difference(square, channel, ...tube), channelBottom, channelTop),
    horizontalPlate(clip.difference(square, ...tube), baseBottom + footHeight, channelBottom),
    // (the flanged foot of tube b is let into the underside of the ground)
    horizontalPlate(clip.difference(square, ...(footRadius ? [planCircle([0, 0], footRadius + 0.004, 96)] : tube)), baseBottom, baseBottom + footHeight),
  ].filter((part) => part.attributes.position.count > 0)), material, 'fixed-ground-and-masonry-pit-forming-tank-B');
  return {baseBottom, channelBottom, channelTop, ground};
}

// A gas pipe rising through the floor, bent out along the channel to the
// edge of the ground block.
function pipePath(x, topY, runY, endX, bend) {
  const side = Math.sign(endX - x);
  const path = new THREE.CurvePath();
  path.add(new THREE.LineCurve3(new THREE.Vector3(x, topY, 0), new THREE.Vector3(x, runY + bend, 0)));
  const arc = new THREE.Curve();
  arc.getPoint = (t, target = new THREE.Vector3()) => target.set(
    x + side * bend * (1 - Math.cos(t * Math.PI / 2)), runY + bend - bend * Math.sin(t * Math.PI / 2), 0);
  path.add(arc);
  path.add(new THREE.LineCurve3(new THREE.Vector3(x + side * bend, runY, 0), new THREE.Vector3(endX, runY, 0)));
  return path;
}

// Pass 87: the water is ONE closed body with no internal faces, so nothing
// divides it where the bell's wall used to be once the bell has lifted. It is
// a stack of horizontal layers, layer i filling plan region regions[i] between
// levels i and i+1. Only the true boundary is emitted: each layer's side
// walls, the bottom of the first, the top of the last, and at each interface
// the part of one layer's region not covered by its neighbour's. The levels
// (floor, bell rim, inner and outer water) move every frame; the topology does
// not, so an update only rewrites the vertex heights.
function layeredWater(regions) {
  const positions = [], normals = [], levels = [];
  const toVectors = (ring) => {
    const points = ring.slice(0, -1).map(([x, y]) => new THREE.Vector2(x, y));
    return points.filter((p, i) => p.distanceTo(points[(i + 1) % points.length]) > 1e-9);
  };
  const cap = (multipolygon, level, up) => {
    for (const [outerRing, ...holeRings] of multipolygon) {
      const contour = toVectors(outerRing), holes = holeRings.map(toVectors);
      const all = [...contour, ...holes.flat()];
      for (const triangle of THREE.ShapeUtils.triangulateShape(contour, holes)) {
        let [a, b, c] = triangle.map((i) => all[i]);
        // world (x, y, z) = (plan x, level, -plan y): +y needs clockwise in plan.
        const ccw = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) > 0;
        if (ccw === up) [b, c] = [c, b];
        for (const p of [a, b, c]) {positions.push(p.x, 0, -p.y);normals.push(0, up ? 1 : -1, 0);levels.push(level);}
      }
    }
  };
  const walls = (multipolygon, low, high) => {
    for (const polygon of multipolygon) {
      polygon.forEach((ring, index) => {
        let points = toVectors(ring);
        // outer rings anticlockwise, holes clockwise: the material is on the left.
        if (THREE.ShapeUtils.isClockWise(points) === (index === 0)) points = points.reverse();
        const n = points.length;
        const edgeNormal = (i) => {
          const a = points[i], b = points[(i + 1) % n];
          return new THREE.Vector2(b.y - a.y, -(b.x - a.x)).normalize();
        };
        const vertexNormal = (i, edge) => {
          const here = edgeNormal(edge), other = edgeNormal(edge === i ? (i + n - 1) % n : i);
          return here.dot(other) > Math.cos(Math.PI / 6) ? here.clone().add(other).normalize() : here;
        };
        for (let i = 0; i < n; i += 1) {
          const j = (i + 1) % n, a = points[i], b = points[j], na = vertexNormal(i, i), nb = vertexNormal(j, i);
          const quad = [[a, na, low], [b, nb, low], [b, nb, high], [a, na, low], [b, nb, high], [a, na, high]];
          for (const [p, q, level] of quad) {positions.push(p.x, 0, -p.y);normals.push(q.x, 0, -q.y);levels.push(level);}
        }
      });
    }
  };
  regions.forEach((region, i) => {
    walls(region, i, i + 1);
    if (i === 0) cap(region, 0, false);
    const next = regions[i + 1];
    if (!next) {cap(region, i + 1, true);return;}
    cap(clip.difference(region, next), i + 1, true);
    cap(clip.difference(next, region), i + 1, false);
  });
  // Fix winding against the authored normals (walls were emitted unordered).
  for (let t = 0; t < positions.length; t += 9) {
    const p = (k) => new THREE.Vector3(positions[t + 3 * k], levels[t / 3 + k], positions[t + 3 * k + 2]);
    const face = new THREE.Vector3().subVectors(p(1), p(0)).cross(new THREE.Vector3().subVectors(p(2), p(0)));
    const want = new THREE.Vector3(normals[t] + normals[t + 3] + normals[t + 6], normals[t + 1] + normals[t + 4] + normals[t + 7], normals[t + 2] + normals[t + 5] + normals[t + 8]);
    if (face.dot(want) < 0) {
      for (let k = 0; k < 3; k += 1) {
        [positions[t + 3 + k], positions[t + 6 + k]] = [positions[t + 6 + k], positions[t + 3 + k]];
        [normals[t + 3 + k], normals[t + 6 + k]] = [normals[t + 6 + k], normals[t + 3 + k]];
      }
      [levels[t / 3 + 1], levels[t / 3 + 2]] = [levels[t / 3 + 2], levels[t / 3 + 1]];
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  const levelOf = Uint8Array.from(levels);
  const setLevels = (heights) => {
    const position = geometry.attributes.position;
    for (let i = 0; i < levelOf.length; i += 1) position.setY(i, heights[levelOf[i]]);
    position.needsUpdate = true;
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  };
  geometry.userData.waterLayers = {count: regions.length};
  return {geometry, setLevels};
}

// Brown's water: outside the bell at the free level, inside it at the level
// held down by the gas pressure, joined under the bell's rim.
function buildWater(root, material, {floorY, regions, role}) {
  const {geometry, setLevels} = layeredWater(regions);
  const body = addMesh(root, geometry, material, role);
  let heights = null;
  const set = (next) => {heights = next;setLevels(next);};
  return {body, floorY, get heights() {return heights;}, set};
}

function presentSection(root) {
  root.userData.cameraDirection = new THREE.Vector3(0.15, 0.3, 15);
  root.userData.cameraFov = 10;
  root.userData.hideGround = true;
  root.userData.minimumDisplayCycleSeconds = 8;
  root.traverse((object) => {
    for (const material of [].concat(object.material ?? [])) material.fog = false;
  });
}

function fitBounds(root, update, period) {
  const box = new THREE.Box3();
  for (let i = 0; i <= 32; i += 1) {
    update(period * i / 32);
    root.updateMatrixWorld(true);
    root.traverse((object) => {if (object.isMesh && object.visible) box.union(new THREE.Box3().setFromObject(object));});
  }
  update(0);
  root.userData.cameraFitBounds = box.expandByScalar(0.03);
  root.userData.cameraDistanceScale = 1.02;
}

// ---------------------------------------------------------------- 479
function singleLiftCounterweightedGasometer(movement) {
  const root = new THREE.Group();
  const cycleDuration = 8;
  const px = (value) => (value - 510) * K;
  const py = (value) => 0.20 + (605 - value) * K;

  // Plate 479 (2x pixels): water at 605, ground at 525, pit floor at 945,
  // pit walls at 275/740, bell skirt at 300/720 from its rim at 655 to its
  // shoulder at 190, crown at 125; pulleys centred at y 92, radius 60; balls
  // centred near y 445, radius 55-60; pipes 450-475 and 520-548, tops 598.
  const waterY = py(605);
  const groundY = py(525);
  const floorY = py(945);
  const pitRadius = (740 - 275) / 2 * K;
  const bellRadius = 2.0, bellWall = 0.05;
  const skirtHeight = (655 - 190) * K, rise = (190 - 125) * K;
  const topRimY = py(655);
  const strokeSceneUnit = 1.7;
  const pulleyRadius = 60 * K;
  const pulleyCenters = [-1, 1].map((side) => new THREE.Vector3(side * (bellRadius - bellWall / 2 + pulleyRadius), py(92), 0));
  const ballRadius = 0.55;
  const topBallY = py(445);
  const pipeXs = [-0.35, 0.35];
  const pipeOuter = 0.125, pipeInner = 0.085, pipeTopY = py(598);
  const bandWidth = 0.2, bandThickness = 0.1;

  // Quasi-static balance: the bell's weight less the counterweights is
  // carried by the gas pressure on the bell's area, which holds the water
  // inside the bell below the free level by h = p / (rho g).
  const sceneUnitsPerMetre = 8 / 3;
  const bellAreaSquareMetre = Math.PI * (bellRadius / sceneUnitsPerMetre) ** 2;
  const bellMassKilogram = 300, counterweightMassKilogram = 110, gravity = 9.80665, waterDensity = 998;
  const gaugePressurePascal = (bellMassKilogram - 2 * counterweightMassKilogram) * gravity / bellAreaSquareMetre;
  const headSceneUnit = gaugePressurePascal / (waterDensity * gravity) * sceneUnitsPerMetre;
  const innerWaterY = waterY - headSceneUnit;

  const stateAtTime = (time) => {
    const phase = THREE.MathUtils.euclideanModulo(time / cycleDuration, 1);
    const descent = strokeSceneUnit * 0.5 * (1 - Math.cos(FULL_TURN * phase));
    const descentRate = strokeSceneUnit * 0.5 * Math.sin(FULL_TURN * phase) * FULL_TURN / cycleDuration;
    const bellY = topRimY - descent;
    return {
      bellY,
      counterweightY: topBallY + descent,
      falling: descentRate > 0,
      gasVolumeSceneUnit3: Math.PI * (bellRadius - bellWall) ** 2 * (bellY + skirtHeight - innerWaterY),
      phase,
      pulleyAngle: descent / pulleyRadius,
      rising: descentRate < 0,
      volumeRateSceneUnit3PerSecond: -Math.PI * (bellRadius - bellWall) ** 2 * descentRate,
    };
  };

  const masonry = matte(0xa9a296, {roughness: 0.9});
  const bellMaterial = matte(PALETTE.driven, {metalness: 0.2, roughness: 0.45, side: THREE.DoubleSide});
  const metal = matte(PALETTE.frame, {metalness: 0.25, roughness: 0.45});
  const waterMaterial = matte(PALETTE.fluid, {opacity: 0.42, roughness: 0.2, transparent: true, side: THREE.DoubleSide});
  waterMaterial.depthWrite = false;
  const pulleyMaterial = matte(PALETTE.accent, {metalness: 0.2, roughness: 0.45});
  // Pass 96: the bands are the shared rope/belt brown (they were near-black ink).
  const bandMaterial = matte(PALETTE.belt, {metalness: 0.05, roughness: 0.7});
  const weightMaterial = matte(PALETTE.driver, {metalness: 0.24, roughness: 0.43});

  const pit = buildPit(root, masonry, {pitRadius, groundY, floorY, slabHalf: 4.3, channelHeight: 0.32, pipes: pipeXs, pipeOuter});
  const pipeRunY = (pit.channelTop + pit.channelBottom) / 2;
  const gasPipes = pipeXs.map((x, index) => {
    const path = pipePath(x, pipeTopY, pipeRunY, Math.sign(x) * 4.3, pit.channelTop - pipeRunY - 0.01);
    const mesh = addMesh(root, curvedPipeWall(path, pipeInner, pipeOuter, 160, 40), metal,
      index === 0 ? 'fixed-left-gas-inlet-through-bottom-of-B' : 'fixed-right-gas-outlet-through-bottom-of-B');
    mesh.userData.flowPath = path;
    return mesh;
  });

  const bell = bellGeometry({radius: bellRadius, wall: bellWall, skirtHeight, rise});
  const bellA = new THREE.Group();
  bellA.userData.role = 'one-open-bottomed-inverted-vessel-A-rising-in-water-tank';
  const bellShell = addMesh(bellA, bell.geometry, bellMaterial, 'open-bottomed-domed-vessel-A');
  root.add(bellA);

  // One water body in three layers: floor to just under the rim (the whole
  // pit), rim to the inner level (inside and outside the bell's wall), inner
  // to free level (outside only).
  const gap = 0.004;
  const pipeHoles = pipeXs.map((x) => planCircle([x, 0], pipeOuter + gap, 64));
  const outerWater = annulus(bellRadius + gap, pitRadius - gap);
  const water = buildWater(root, waterMaterial, {floorY, role: 'one-connected-water-column-in-tank-B-inside-and-outside-A', regions: [
    annulus(0, pitRadius - gap, pipeHoles),
    clip.union(annulus(0, bellRadius - bellWall - gap, pipeHoles), outerWater),
    outerWater,
  ]});

  // Pulleys: plain flanged discs on short axle stubs, as Brown draws them.
  const tread = pulleyRadius - bandThickness / 2;
  const pulleys = pulleyCenters.map((center, index) => {
    const group = new THREE.Group();
    group.position.copy(center);
    group.userData.role = `fixed-axis-counterweight-pulley-${index + 1}`;
    const rotor = new THREE.Group();
    group.add(rotor);
    const wheel = addMesh(rotor, boredLatheGeometry([
      {radial: tread + 0.07, axial: -0.16}, {radial: tread + 0.07, axial: -0.11},
      {radial: tread, axial: -0.11}, {radial: tread, axial: 0.11},
      {radial: tread + 0.07, axial: 0.11}, {radial: tread + 0.07, axial: 0.16},
    ], 0.075, 96), pulleyMaterial, 'plain-flanged-pulley-disc');
    wheel.rotation.x = Math.PI / 2;
    applyRotationIndicator(wheel);
    const axle = addMesh(group, new THREE.CylinderGeometry(0.07, 0.07, 0.44, 40), metal, `counterweight-pulley-axle-${index + 1}`);
    axle.rotation.x = Math.PI / 2;
    root.add(group);
    return {axle, group, rotor, wheel};
  });

  const counterweights = pulleyCenters.map((center, index) => {
    const side = Math.sign(center.x);
    const ball = addMesh(root, new THREE.SphereGeometry(ballRadius, 48, 32), weightMaterial, `counterweight-C-${index + 1}`);
    ball.position.set(center.x + side * pulleyRadius, topBallY, 0);
    return ball;
  });

  // Flat bands: one leg down to the crown just inside the shoulder, a lap
  // over the pulley, the other leg down to the ball.
  const lapShape = new THREE.Shape();
  lapShape.absarc(0, 0, tread + bandThickness, 0, Math.PI, false);
  lapShape.absarc(0, 0, tread, Math.PI, 0, true);
  const bandLaps = pulleyCenters.map((center, index) => {
    const lap = addMesh(root, new THREE.ExtrudeGeometry(lapShape, {depth: bandWidth, bevelEnabled: false, curveSegments: 48}).translate(0, 0, -bandWidth / 2),
      bandMaterial, `flat-band-lap-on-pulley-${index + 1}`);
    lap.position.copy(center);
    return lap;
  });
  const bandLeg = (role) => addMesh(root, new THREE.BoxGeometry(bandThickness, 1, bandWidth), bandMaterial, role);
  const innerBands = [0, 1].map((index) => bandLeg(`taut-inner-band-${index + 1}-to-A`));
  const outerBands = [0, 1].map((index) => bandLeg(`taut-outer-band-${index + 1}-to-C`));
  const legX = (center, sign) => center.x + sign * (tread + bandThickness / 2);
  const attachX = bellRadius - bellWall / 2;
  // The band end rests on the crown at its inner edge, where the crown is highest.
  const attachLocalY = bell.capY(attachX - bandThickness / 2);

  const update = (time) => {
    const state = stateAtTime(time);
    bellA.position.y = state.bellY;
    water.set([floorY + gap, state.bellY - gap, innerWaterY, waterY]);
    pulleyCenters.forEach((center, index) => {
      const side = Math.sign(center.x);
      pulleys[index].rotor.rotation.z = side * state.pulleyAngle;
      counterweights[index].position.y = state.counterweightY;
      const innerX = legX(center, -side), outerX = legX(center, side);
      const attachY = state.bellY + attachLocalY;
      const ballTop = state.counterweightY + ballRadius;
      innerBands[index].position.set(innerX, (center.y + attachY) / 2, 0);
      innerBands[index].scale.y = center.y - attachY;
      outerBands[index].position.set(outerX, (center.y + ballTop) / 2, 0);
      outerBands[index].scale.y = center.y - ballTop;
    });
  };

  const geometry = {
    ballRadius, bandThickness, bandWidth, bellMassKilogram, bellRadius, bellWall, counterweightMassKilogram, cycleDuration,
    floorY, gaugePressurePascal, groundY, headSceneUnit, innerWaterY, pipeTopY, pipeXs, pitRadius, pulleyCenters, pulleyRadius,
    rise, skirtHeight, strokeSceneUnit, topBallY, topRimY, waterY,
  };
  root.userData = {
    animationTiming: {authoredCyclePeriod: cycleDuration, targetCycleDuration: 4},
    archetype: movement.archetype,
    blocks: {bandLaps, bellA, bellShell, counterweights, gasPipes, innerBands, outerBands, pit, pulleys, water},
    fidelity: 'authored',
    geometry,
    mechanism: 'The open-bottomed vessel A stands in the water of tank B, a masonry pit, and is partly balanced by the two weights C on bands over two pulleys. Gas enters through the left pipe and leaves through the right, both rising through the floor of B above the water; as gas enters, A rises and the weights fall, and the reverse. The water inside A stands below the free level by the head of the gas pressure, which is set by the weight of A less the weights C.',
    reconstruction: 'Proportions are measured on Brown’s plate. The pit is round in plan and the ground is shown as a square block; the pipes run out in a channel under the floor. Brown’s pose is the top of the stroke; the bell falls 1.7 units and returns. Pressure is quasi-static.',
    sourceAnimation: {available: false, reason: 'The official Movement 479 page marks Animated unavailable.'},
    sourceReference: {officialPage: movement.sourceUrl, plate: 'Brown 1868, Movement 479', pixelScale: 'x=(px2-510)*0.0095, y=0.20+(605-py2)*0.0095 (2x pixels)'},
    stateAtTime,
    update,
  };
  root.userData.workingPartsReview = {status: 'measured-proportions', residual: 'Gas flow and pressure transients are not solved; the fill cycle is prescribed.'};
  update(0);
  presentSection(root);
  fitBounds(root, update, cycleDuration);
  markShadows(root);
  water.body.castShadow = false;water.body.receiveShadow = false;
  return {cameraDirection: root.userData.cameraDirection, root, update};
}

// ---------------------------------------------------------------- 480
function centerGuidedGasometer(movement) {
  const root = new THREE.Group();
  const cycleDuration = 8;
  const px = (value) => (value - 487) * K;
  const py = (value) => 0.20 + (560 - value) * K;

  // Plate 480 (2x pixels): water at 560, ground at 495, pit floor at 900,
  // pit walls at 200/770; bell skirt 240/725 from its rim at 690 to its
  // shoulder at 240, crown rising to 150 where it meets sleeve a (walls
  // 430-445 / 520-535); tube b 455-520 from y 50 down through the floor to
  // its foot at 1000; pipes 375-400 and 575-600, tops at 510.
  const waterY = py(560);
  const groundY = py(495);
  const floorY = py(900);
  const pitRadius = (770 - 200) / 2 * K;
  const bellRadius = (725 - 240) / 2 * K, bellWall = 0.05;
  const skirtHeight = (690 - 240) * K;
  const sleeveOuter = (535 - 430) / 2 * K, sleeveInner = (520 - 445) / 2 * K;
  const tubeOuter = (520 - 455) / 2 * K, tubeInner = tubeOuter - 0.05;
  // Crown: a spherical cap through the shoulder and the sleeve at y 150.
  const capAtSleeve = (240 - 150) * K;
  const capCenter = (sleeveOuter ** 2 + capAtSleeve ** 2 - bellRadius ** 2) / (2 * capAtSleeve);
  const sphere = Math.hypot(bellRadius, capCenter);
  const rise = capCenter + sphere;
  const midRimY = py(690);
  const amplitude = 0.85;
  const tubeTopY = py(50), tubeBottomY = py(1000);
  const pipeXs = [px(387.5), px(587.5)];
  const pipeOuter = 0.12, pipeInner = 0.08, pipeTopY = py(510);

  const sceneUnitsPerMetre = 8 / 3;
  const bellAreaSquareMetre = Math.PI * (bellRadius / sceneUnitsPerMetre) ** 2;
  const bellMassKilogram = 100, gravity = 9.80665, waterDensity = 998;
  const gaugePressurePascal = bellMassKilogram * gravity / bellAreaSquareMetre;
  const headSceneUnit = gaugePressurePascal / (waterDensity * gravity) * sceneUnitsPerMetre;
  const innerWaterY = waterY - headSceneUnit;

  const stateAtTime = (time) => {
    const phase = THREE.MathUtils.euclideanModulo(time / cycleDuration, 1);
    const bellY = midRimY + amplitude * Math.sin(FULL_TURN * phase);
    const rate = amplitude * Math.cos(FULL_TURN * phase) * FULL_TURN / cycleDuration;
    return {bellY, falling: rate < 0, phase, rising: rate > 0,
      volumeRateSceneUnit3PerSecond: Math.PI * ((bellRadius - bellWall) ** 2 - sleeveOuter ** 2) * rate};
  };

  const masonry = matte(0xa9a296, {roughness: 0.9});
  const bellMaterial = matte(PALETTE.driven, {metalness: 0.2, roughness: 0.45, side: THREE.DoubleSide});
  const sleeveMaterial = matte(PALETTE.accent, {metalness: 0.25, roughness: 0.42, side: THREE.DoubleSide});
  const metal = matte(PALETTE.frame, {metalness: 0.25, roughness: 0.45});
  const waterMaterial = matte(PALETTE.fluid, {opacity: 0.42, roughness: 0.2, transparent: true, side: THREE.DoubleSide});
  waterMaterial.depthWrite = false;

  const pit = buildPit(root, masonry, {pitRadius, groundY, floorY, slabHalf: 4.3, channelHeight: 0.30, pipes: pipeXs, pipeOuter, tubeHole: tubeOuter,
    footRadius: tubeOuter + 0.30, footHeight: 0.06});
  const pipeRunY = (pit.channelTop + pit.channelBottom) / 2;
  const gasPipes = pipeXs.map((x, index) => {
    const path = pipePath(x, pipeTopY, pipeRunY, Math.sign(x) * 4.3, pit.channelTop - pipeRunY - 0.01);
    const mesh = addMesh(root, curvedPipeWall(path, pipeInner, pipeOuter, 160, 40), metal,
      index === 0 ? 'fixed-left-gas-outlet-through-bottom-of-B' : 'fixed-right-gas-inlet-through-bottom-of-B');
    mesh.userData.flowPath = path;
    return mesh;
  });

  // Fixed tube b, from its foot in the ground up through the floor to above
  // the bell, with the flanged foot Brown draws.
  const tubeB = new THREE.Group();
  tubeB.userData.role = 'fixed-central-tube-b-guiding-integral-moving-sleeve-a';
  const bottomOfTube = pit.baseBottom;
  const tubeShell = addMesh(tubeB, boredLatheGeometry([
    {radial: tubeOuter + 0.30, axial: bottomOfTube}, {radial: tubeOuter + 0.30, axial: bottomOfTube + 0.06},
    {radial: tubeOuter, axial: bottomOfTube + 0.06}, {radial: tubeOuter, axial: tubeTopY},
  ], tubeInner, 96), metal, 'fixed-hollow-shell-of-central-tube-b');
  root.add(tubeB);

  // Bell A with its integral sleeve a.
  const bell = bellGeometry({radius: bellRadius, wall: bellWall, skirtHeight, rise, opening: sleeveOuter});
  const bellA = new THREE.Group();
  bellA.userData.role = 'one-open-bottomed-inverted-vessel-A-with-integral-sleeve-a';
  const bellShell = addMesh(bellA, bell.geometry, bellMaterial, 'open-bottomed-domed-vessel-A-around-sleeve-a');
  const sleeveTop = skirtHeight + capAtSleeve;
  const sleeveA = addMesh(bellA, boredLatheGeometry([
    {radial: sleeveOuter, axial: 0}, {radial: sleeveOuter, axial: sleeveTop},
  ], sleeveInner, 96), sleeveMaterial, 'sliding-sleeve-a-secured-within-A');
  // Brown draws A's bottom closed by a base from the skirt to sleeve a, which
  // the two fixed pipes pass through with running clearance. It sits 0.003
  // above the rim so that no face of it lies on the skirt's or sleeve's.
  // Pass 104: it butts against a's outer wall instead of running half into
  // it, so on Brown's section the base's and the sleeve's cut faces meet
  // edge to edge rather than overlapping in one plane (they flickered).
  const baseThickness = 0.05, baseLift = 0.003, pipeClearance = 0.03;
  const baseHoles = pipeXs.map((x) => planCircle([x, 0], pipeOuter + pipeClearance, 64));
  const baseA = addMesh(bellA, horizontalPlate(annulus(sleeveOuter, bellRadius - bellWall / 2, baseHoles),
    baseLift, baseThickness), bellMaterial, 'base-of-vessel-A-from-skirt-to-sleeve-a-pierced-by-the-pipes');
  root.add(bellA);

  // One water body in four layers: floor to under the base (the whole pit
  // round b); the base's own depth (outside A, between a and b, and in the
  // clearance round each pipe); above the base to the inner level (inside A
  // as well); inner to free level (outside A and between a and b, which is
  // open to the air at the top of a).
  const gap = 0.004;
  const pipeHoles = pipeXs.map((x) => planCircle([x, 0], pipeOuter + gap, 64));
  const outerWater = annulus(bellRadius + gap, pitRadius - gap);
  const sleeveGapWater = annulus(tubeOuter + gap, sleeveInner - gap);
  const clearanceWater = clip.union(...pipeXs.map((x) => clip.difference(planCircle([x, 0], pipeOuter + pipeClearance - gap, 64), planCircle([x, 0], pipeOuter + gap, 64))));
  const water = buildWater(root, waterMaterial, {floorY, role: 'one-connected-water-column-in-tank-B-round-b-and-inside-and-outside-A', regions: [
    annulus(tubeOuter + gap, pitRadius - gap, pipeHoles),
    clip.union(outerWater, sleeveGapWater, clearanceWater),
    clip.union(annulus(sleeveOuter + gap, bellRadius - bellWall - gap, pipeHoles), outerWater, sleeveGapWater),
    clip.union(outerWater, sleeveGapWater),
  ]});

  const update = (time) => {
    const state = stateAtTime(time);
    bellA.position.y = state.bellY;
    water.set([floorY + gap, state.bellY - gap, state.bellY + baseThickness + gap, innerWaterY, waterY]);
  };

  const geometry = {
    amplitude, baseThickness, bellMassKilogram, bellRadius, bellWall, cycleDuration, floorY, gaugePressurePascal, groundY, headSceneUnit,
    innerWaterY, midRimY, pipeTopY, pipeXs, pitRadius, rise, skirtHeight, sleeveInner, sleeveOuter, sleeveTop, tubeInner,
    pipeClearance, tubeOuter, tubeTopY, waterY,
  };
  root.userData = {
    animationTiming: {authoredCyclePeriod: cycleDuration, targetCycleDuration: 4},
    archetype: movement.archetype,
    blocks: {baseA, bellA, bellShell, gasPipes, pit, sleeveA, tubeB, tubeShell, water},
    fidelity: 'authored',
    geometry,
    mechanism: 'Vessel A carries the central sleeve a, which slides on the fixed tube b standing in the centre of the masonry tank B, so A rises and falls square without counterweights. A\u2019s base joins its skirt to a and is pierced with running clearance by the two fixed pipes, through which the water inside A joins the tank. Gas enters by the right pipe and leaves by the left, both rising through the floor of B and A\u2019s base above the water. The water inside A stands below the free level by the head of the gas pressure, set by the weight of A; between a and b, open to the air at the top, it stands at the free level.',
    reconstruction: 'Proportions are measured on Brown’s plate. The pit is round in plan and the ground is shown as a square block; the pipes run out in a channel under the floor and b stands on a flanged foot in the ground. Brown’s pose is mid-stroke. Pressure is quasi-static.',
    sourceAnimation: {available: false, reason: 'The official Movement 480 page marks Animated unavailable.'},
    sourceReference: {officialPage: movement.sourceUrl, plate: 'Brown 1868, Movement 480', pixelScale: 'x=(px2-487)*0.0095, y=0.20+(560-py2)*0.0095 (2x pixels)'},
    stateAtTime,
    update,
  };
  root.userData.workingPartsReview = {status: 'measured-proportions', residual: 'Gas flow and pressure transients are not solved; the fill cycle is prescribed.'};
  update(0);
  presentSection(root);
  fitBounds(root, update, cycleDuration);
  markShadows(root);
  water.body.castShadow = false;water.body.receiveShadow = false;
  return {cameraDirection: root.userData.cameraDirection, root, update};
}

export function createAuthoredGasometerMovement(movement) {
  if (movement.id === 479) return applyCutawayFor(singleLiftCounterweightedGasometer(movement), movement.id);
  // A's base is cut on Brown's section with the rest of A.
  if (movement.id === 480) return applyCutawayFor(centerGuidedGasometer(movement), movement.id,
    {cut: [...CUTAWAY_SPECS[480].cut, 'base-of-vessel-A-from-skirt-to-sleeve-a-pierced-by-the-pipes']});
  return null;
}
