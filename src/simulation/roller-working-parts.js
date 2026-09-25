import * as THREE from 'three';
import {ring, turned, sector, plate, poly, circle, polygonClipping} from './finite-plate-geometry.js';
import {boredCylinderGeometry} from './piston-guide-parts.js';

function replace(mesh, geometry) {
  mesh.geometry.dispose();
  mesh.geometry = geometry;
}
function mesh(parent, geometry, material, role) {
  const part = new THREE.Mesh(geometry, material);
  part.userData.role = role;
  parent.add(part);
  return part;
}
function paintCylinder(part, radius, length, angle, span) {
  replace(part, new THREE.CylinderGeometry(radius + .00005, radius + .00005,
    length, 16, 1, true, Math.PI / 2 - angle - span / 2, span));
  part.position.x = part.position.z = 0;
  part.castShadow = false;
  part.userData.surfacePaint = true;
}
function correctSkewRollers(root) {
  const {blocks: b, geometry: g} = root.userData;
  // The source isolates the rollers and stock. Its omitted supports should not
  // be replaced by a stand or floating guide collars that hide the crossing.
  b.frame.visible = false;
  replace(b.rodBody, new THREE.CylinderGeometry(g.rodRadius, g.rodRadius, g.rodBodyLength, 256));
  for (const body of b.rollerBodies)
    replace(body, new THREE.CylinderGeometry(g.rollerRadius, g.rollerRadius, g.rollerBodyLength, 256));
  for (const rim of b.rollerEndRims) rim.visible = false;
  for (const index of b.rollerFaceIndexes) {
    index.position.y = index.userData.side * (g.rollerBodyLength / 2 + .014);
    // Brown draws plain roller ends; the face dots are not shown.
    index.visible = false;
  }
  // Brown shades the stock and rollers with dark lengthwise hatching, so the
  // feed and spin cues are painted as dark grain streaks rather than white.
  const grain = new THREE.MeshStandardMaterial({color: 0x23262b, roughness: .6, metalness: .1});
  for (const index of b.rollerTreadIndexes) {
    paintCylinder(index, g.rollerRadius, g.rollerBodyLength * .62, 0, .10);
    index.material = grain;
  }
  for (const marker of b.rodMarkers) {
    paintCylinder(marker, g.rodRadius, .060, marker.userData.baseAngle, .22);
    marker.material = grain;
  }
  root.userData.updateWorkingParts = () => {
    for (const marker of b.rodMarkers) marker.scale.y = Math.max(0, Math.min(1,
      (marker.position.y - g.lowerMarkerWrapY) / .10,
      (g.upperMarkerWrapY - marker.position.y) / .10));
  };
  root.userData.minimumDisplayCycleSeconds = g.inputCyclePeriod;
  root.userData.workingRollerReview = {
    interfaces: 'Smooth tangent cylinders with surface paint rather than protruding markers at the working contacts.',
    residual: 'Point-contact no-slip rates are analytical. Roller synchronization, preload, friction and elastic contact patches are not solved. The stock is a fixed material viewing window.',
  };
}
function rebuildWheel(wheel, radius, bore, width, spokes, phase = 0) {
  const rotor = wheel.userData.rotor, old = [...rotor.children];
  const dark = old[0].material, color = old.find(o => o.userData.role === 'radial-wheel-spoke').material;
  const index = wheel.userData.indexMark;
  rotor.clear();
  const inner = spokes ? radius - .15 : bore;
  // A spoked wheel's rim is the wheel itself, not a black tyre: same colour as its spokes.
  const rim = mesh(rotor, ring(inner, radius, -width / 2, width / 2, 256), color, 'finite-bored-wheel-tread');
  const hubRadius = Math.max(radius * .13, .08);
  const hub = mesh(rotor, ring(bore, hubRadius, -width * .61, width * .61, 128), dark, 'bored-wheel-hub');
  const radialSpokes = [];
  for (let i = 0; i < spokes; i++) {
    const start = hubRadius - .02, end = inner + .02, angle = phase + i * Math.PI * 2 / spokes;
    const spoke = mesh(rotor, new THREE.BoxGeometry(end - start, .095, width * .58), color, 'connected-radial-wheel-spoke');
    spoke.rotation.z = angle;
    spoke.position.set(Math.cos(angle) * (start + end) / 2, Math.sin(angle) * (start + end) / 2, 0);
    radialSpokes.push(spoke);
  }
  if (spokes) {
    // Put the index on a spoke instead of leaving it suspended in the opening.
    index.rotation.z = phase;
    index.position.set(Math.cos(phase) * radius * .36, Math.sin(phase) * radius * .36, width * .29 + .017);
  } else index.position.z = width / 2 + .009;
  // Brown draws plain wheels; the white spin index stays allocated but hidden.
  index.visible = false;
  rotor.add(index);
  wheel.userData.workingParts = {rim, hub, spokes: radialSpokes};
  for (const part of old) if (part !== index) part.geometry.dispose();
}
function correctExperiment(root) {
  const {blocks: b, geometry: g} = root.userData;
  rebuildWheel(b.largeWheel, g.largeWheelRadius, .116, .42, 4, Math.PI / 4 - g.drumStartAngle);
  for (const wheel of b.carriageWheels) rebuildWheel(wheel, g.carriageWheelRadius, .066, .14, 0);
  const pulleyRotor = b.drivePulley.userData.rotor, material = pulleyRotor.children[0].material;
  for (const child of [...pulleyRotor.children]) {pulleyRotor.remove(child); child.geometry.dispose();}
  // A real groove at the belt plane: the .034-radius cord touches its bottom
  // and clears both walls, including the straight tangent runs.
  const z = g.beltPlaneZ - b.drivePulley.position.z;
  // Brown's pulley is an open wheel: a grooved rim on four curved-sided
  // arms around a hub, like the web of 371.
  const rimInner = .40;
  const profile = [[z - .09,rimInner],[z - .09,.53],[z - .045,.53],
    [z - .038,.466],[z + .038,.466],[z + .045,.53],[z + .09,.53],[z + .09,rimInner]];
  b.workingPulley = mesh(pulleyRotor, turned(profile, 256), material, 'bored-pulley-with-finite-belt-channel');
  const openings = [];
  const openingRim = rimInner - .012, halfSpan = Math.PI / 4 - Math.asin(.05 / openingRim), apex = .20;
  const cornerX = openingRim * Math.cos(halfSpan), cornerY = openingRim * Math.sin(halfSpan);
  const arcCentre = (cornerX ** 2 + cornerY ** 2 - apex ** 2) / (2 * (cornerX - apex)), arcRadius = arcCentre - apex;
  const cornerAngle = Math.atan2(cornerY, cornerX - arcCentre);
  for (let k = 0; k < 4; k++) {
    const centre = Math.PI / 4 + k * Math.PI / 2, c = Math.cos(centre), s = Math.sin(centre), local = [];
    for (let i = 0; i <= 32; i++) {const a = -halfSpan + 2 * halfSpan * i / 32; local.push([openingRim * Math.cos(a), openingRim * Math.sin(a)]);}
    for (let i = 1; i < 48; i++) {const a = cornerAngle + (2 * Math.PI - 2 * cornerAngle) * i / 48; local.push([arcCentre + arcRadius * Math.cos(a), arcRadius * Math.sin(a)]);}
    openings.push(poly(local.map(([x, y]) => [x * c - y * s, x * s + y * c])));
  }
  b.pulleyWeb = mesh(pulleyRotor, plate(polygonClipping.difference(poly(circle([0, 0], rimInner, 192)), poly(circle([0, 0], .116, 96)), ...openings), z - .035, z + .035), material, 'four-curved-arm-web-of-drive-pulley');
  b.pulleyHub = mesh(pulleyRotor, ring(.116, .17, z - .09, z + .09, 128), material, 'bored-hub-of-drive-pulley');
  replace(b.chassis, new THREE.BoxGeometry(1.62, .13, .18));
  b.chassis.position.z = -.19;
  b.axleHangers = [];
  for (const pin of b.carriageAxlePins) {
    replace(pin, new THREE.CylinderGeometry(.060, .060, .58, 64));
    pin.position.z = .10;
    const hanger = mesh(b.wagon, new THREE.BoxGeometry(.11, .25, .12), pin.material, 'wagon-axle-hanger-behind-wheel');
    hanger.position.set(pin.position.x, pin.position.y + .10, -.14);
    b.axleHangers.push(hanger);
  }
  const bedTop = b.wagonBed.position.y + .09;
  for (const [i, spec] of [[-1.40,.14,.50],[-1.20,.16,.60],[-.40,.15,.56],[-.20,.13,.45]].entries()) {
    const [x, width, height] = spec, load = b.fixedLoads[i];
    replace(load, new THREE.BoxGeometry(width, height, .43));
    load.position.set(x, bedTop + height / 2, .10);
    load.rotation.z = 0;
  }
  replace(b.testWeight, new THREE.BoxGeometry(.42, 2 * (g.testWeightLoadedY - bedTop), .45));
  b.weightGuide.visible = false;
  b.tetherBracket = mesh(b.wagon, new THREE.BoxGeometry(.30, .055, .04), b.tether.material, 'tether-anchor-on-front-of-right-axle');
  b.tetherBracket.position.set(-.12, g.indicatorCenter.y, .385);

  // Brown does not specify the indicator's internal transmission. Show its
  // housing and input passage, not a misleading exposed spring crossed by a
  // radial tether with zero torque arm. The existing spring state is retained
  // as the explicitly calibrated force-indication model.
  replace(b.dialFace, boredCylinderGeometry(.54, .078, .04));
  b.dialFace.position.z = .455;
  b.dialRim.position.z = .46;
  b.spiralSpring.visible = false;
  // Rolling-contact annotation dots are not drawn by Brown.
  for (const marker of b.contactMarkers) marker.visible = false;
  // Leave a small angular opening on the left for the tether.
  const shape = sector(.51, .55, -Math.PI + .075, Math.PI - .075, 128);
  const housing = mesh(root, plate(shape, 0, .19), b.dialRim.material,
    'indicator-housing-with-radial-input-port');
  housing.position.set(g.indicatorCenter.x, g.indicatorCenter.y, .24);
  b.indicatorHousing = housing;
  replace(b.base, new THREE.BoxGeometry(6.20, .16, .22));
  b.base.position.set(-.10, -.54, 1.05);
  const endpoints = [[[-2.03,-2.15],[-1.65,-.54]],[[.35,-2.15],[-.03,-.54]],[[.35,-.54],[2.77,.425]]];
  for (const [i, [a,c]] of endpoints.entries()) {
    const beam = b.supportBeams[i], dx = c[0]-a[0], dy = c[1]-a[1];
    replace(beam, new THREE.BoxGeometry(Math.hypot(dx,dy), .16, .22));
    beam.position.set((a[0]+c[0])/2, (a[1]+c[1])/2, 1.05);
    beam.rotation.z = Math.atan2(dy,dx);
  }
  replace(b.largeAxle, new THREE.CylinderGeometry(.11, .11, 1.46, 64));
  b.largeAxle.position.z = .48;
  replace(b.indicatorPost, new THREE.BoxGeometry(.18, 1.75, .22));
  b.indicatorPost.position.set(2.77, .415, 1.05);
  replace(b.indicatorShelf, new THREE.BoxGeometry(1.48, .12, .82));
  b.indicatorShelf.position.set(2.05, .425, .70);
  root.userData.minimumDisplayCycleSeconds = g.demonstrationPeriod;
  root.userData.workingRollerReview = {
    interfaces: 'Four connected drum spokes, bored wheels and drive pulley, separated carriage chassis and loads, belt groove and indicator input passage.',
    residual: 'Rolling rates are analytical. The load schedule and force-to-pointer calibration reproduce the reported observation; they do not solve reactions, slip, inertia, or an internal tether-to-spring transmission. The test weight is a manually moved teaching aid.',
  };
}
export function correctRollerParts(model, id) {
  if (id === 365) correctSkewRollers(model.root); else correctExperiment(model.root);
  const root = model.root, bounds = new THREE.Box3();
  root.userData.hideGround = true;
  root.traverse(o => {for (const material of [].concat(o.material ?? [])) material.fog = false;});
  for (let i = 0; i <= 64; i++) {
    model.update(root.userData.minimumDisplayCycleSeconds * i / 64);
    root.updateMatrixWorld(true);
    root.traverseVisible(o => {if (o.geometry) {o.geometry.computeBoundingBox(); bounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}});
  }
  root.userData.cameraFitBounds = bounds.expandByScalar(.04);
  root.userData.cameraDistanceScale = 1.02;
  model.cameraDirection = id === 365 ? new THREE.Vector3(-6, 5, 15) : new THREE.Vector3(.45, .65, 15);
  model.update(0);
}
