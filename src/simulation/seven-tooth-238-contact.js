import * as THREE from 'three';

const cross = (a, b) => a.x * b.y - a.y * b.x;
const perpendicular = p => new THREE.Vector2(-p.y, p.x);
const rotate = (p, a) => new THREE.Vector2(p.x * Math.cos(a) - p.y * Math.sin(a), p.x * Math.sin(a) + p.y * Math.cos(a));
function progress(q, start, end) {
  const u = THREE.MathUtils.clamp((q - start) / (end - start), 0, 1), span = end - start;
  return { value: u ** 3 * (10 - 15 * u + 6 * u * u), speed: 30 * u * u * (1 - u) ** 2 / span, acceleration: 60 * u * (1 - u) * (1 - 2 * u) / span ** 2 };
}

// The cleaned wheel already has this radial-monotone flank. Its finite B
// corner follows each actual straight edge, so no contact mesh search or
// profile cutting is needed during playback.
export function makeSevenTooth238Branch(d, cycle = 0) {
  const g = d.geometry, outline = d.workingParts.profile.outline, base = cycle * g.toothPitch;
  // plate() removes almost-collinear contour points before extrusion. Use
  // that actual cleaned contour, not the more finely sampled baked polygon.
  const contour = d.blocks.escapeWheel.userData.body.geometry.parameters.shapes[0].extractPoints(1).shape;
  const nearest = point => contour.reduce((best, p, i) => p.distanceToSquared(point) < contour[best].distanceToSquared(point) ? i : best, 0);
  // The flank runs from just past the last segment's root vertex to tip 0
  // (vertex 946 of the former 1099-vertex profile).
  const segment = outline.length / 7;
  let root = 6 * segment;
  for (let i = root; i < outline.length; i++) if (Math.hypot(...outline[i]) < Math.hypot(...outline[root])) root = i;
  const start = nearest(rotate(new THREE.Vector2(...outline[root + 1]), -base));
  const end = nearest(rotate(new THREE.Vector2(...outline[0]), -base));
  const step = contour[(start + 1) % contour.length].lengthSq() > contour[start].lengthSq() ? 1 : -1;
  const vertices = [], facetIndices = [];
  for (let i = start; ; i = (i + step + contour.length) % contour.length) {
    vertices.push(rotate(contour[i], base)); facetIndices.push(i);
    if (i === end) break;
    if (vertices.length > contour.length / 3) throw new Error('238 cleaned flank topology changed');
  }
  const radii = vertices.map(p => p.lengthSq());
  if (radii.some((r, i) => i && r <= radii[i - 1])) throw new Error('238 B flank must remain radial-monotone');
  const face = d.faceAt('B', 0), corner = face.tipPoint.clone().addScaledVector(face.normal, -.0005).sub(g.palletPivot);
  // Match the visible BufferGeometry coordinates, including Float32 rounding.
  corner.set(Math.fround(corner.x), Math.fround(corner.y));
  const pointAt = a => rotate(corner, a).add(g.palletPivot);
  let lo = g.lowPalletAngle, hi = g.highPalletAngle;
  for (let i = 0; i < 48; i++) { const mid = (lo + hi) / 2; if (pointAt(mid).lengthSq() < radii.at(-1)) lo = mid; else hi = mid; }
  const releaseAngle = (lo + hi) / 2;
  function at(a) {
    const point = pointAt(a), velocity = perpendicular(point.clone().sub(g.palletPivot)), acceleration = point.clone().sub(g.palletPivot).negate();
    const r2 = Math.min(radii.at(-1), point.lengthSq());
    let left = 0, right = vertices.length - 1;
    while (right - left > 1) { const mid = (left + right) >> 1; if (radii[mid] <= r2) left = mid; else right = mid; }
    const start = vertices[left], edge = vertices[left + 1].clone().sub(start), A = edge.lengthSq(), B = 2 * start.dot(edge), C = start.lengthSq() - r2;
    const u = THREE.MathUtils.clamp(2 * (-C) / (B + Math.sqrt(B * B - 4 * A * C)), 0, 1);
    const wheelPoint = start.clone().addScaledVector(edge, u), denominator = wheelPoint.dot(edge), du = point.dot(velocity) / denominator;
    const ddu = (velocity.lengthSq() + point.dot(acceleration) - du * du * A) / denominator;
    const numerator = cross(point, velocity) - cross(wheelPoint, edge) * du;
    const ratio = numerator / r2, second = (cross(point, acceleration) - cross(wheelPoint, edge) * ddu) / r2 - numerator * 2 * point.dot(velocity) / r2 ** 2;
    let angle = point.angle() - wheelPoint.angle(); while (angle > Math.PI) angle -= Math.PI * 2; while (angle < -Math.PI) angle += Math.PI * 2;
    // Outline is clockwise; its left normal points into the pallet. The wheel
    // receives the opposite reaction, resisting its CCW drive.
    const palletNormal = rotate(new THREE.Vector2(-edge.y, edge.x).normalize(), angle);
    return { angle, ratio, second, point, wheelPoint, palletNormal, wheelNormal: palletNormal.clone().negate(), edgeIndex: facetIndices[left], edgeParameter: u };
  }
  return { at, releaseAngle, initial: at(g.lowPalletAngle), release: at(releaseAngle), vertices };
}

export function finishSevenTooth238Contact(model) {
  const d = model.root.userData, g = d.geometry, b = d.blocks, branches = Array.from({length: 7}, (_, i) => makeSevenTooth238Branch(d, i)), branch = branches[0], oldUpdate = model.update;
  const nominal = { stateAtCycleCoordinate: d.stateAtCycleCoordinate, stateAtTime: d.stateAtTime };
  d.nominalKinematics238 = nominal;
  d.bContactBranch = { initialWheelAngle: branch.initial.angle, releaseWheelAngle: branch.release.angle, releasePalletAngle: branch.releaseAngle, profileUnchanged: true, contact: branch.at };
  d.stateAtCycleCoordinate = coordinate => {
    const s = nominal.stateAtCycleCoordinate(coordinate), q = s.cyclePhase, base = s.cycleIndex * g.toothPitch, branch = branches[(s.cycleIndex % 7 + 7) % 7], next = branches[((s.cycleIndex + 1) % 7 + 7) % 7];
    let a = s.palletAngle, av = s.palletAngularSpeed, aa = s.palletAngularAcceleration, beta = s.wheelAngle, bv = s.wheelAngularSpeed, ba = s.wheelAngularAcceleration;
    if (q < g.phases.bDrive.end) {
      const p = progress(q, g.phases.bDrive.start, g.phases.bDrive.end), span = branch.releaseAngle - g.lowPalletAngle;
      a = g.lowPalletAngle + span * p.value; av = span * p.speed / g.cyclePeriod; aa = span * p.acceleration / g.cyclePeriod ** 2;
      const c = branch.at(a); beta = base + c.angle; bv = c.ratio * av; ba = c.second * av * av + c.ratio * aa;
    } else if (q < g.phases.firstDrop.end) {
      const p = progress(q, g.phases.firstDrop.start, g.phases.firstDrop.end), span = g.highPalletAngle - branch.releaseAngle;
      a = branch.releaseAngle + span * p.value; av = span * p.speed / g.cyclePeriod; aa = span * p.acceleration / g.cyclePeriod ** 2;
      const travel = g.halfToothPitch - branch.release.angle;
      beta = base + branch.release.angle + travel * p.value; bv = travel * p.speed / g.cyclePeriod; ba = travel * p.acceleration / g.cyclePeriod ** 2;
    } else if (q >= g.phases.secondDrop.start) {
      const p = progress(q, g.phases.secondDrop.start, g.phases.secondDrop.end), start = g.toothPitch - g.dropAngle, travel = g.toothPitch + next.initial.angle - start;
      beta = base + start + travel * p.value; bv = travel * p.speed / g.cyclePeriod; ba = travel * p.acceleration / g.cyclePeriod ** 2;
    }
    let contact = s.contact;
    if (s.activePallet === 'B') {
      const c = (q >= g.phases.secondDrop.end ? next : branch).at(a), r = c.point.clone().sub(g.palletPivot), wheelVelocity = perpendicular(c.point).multiplyScalar(bv), palletVelocity = perpendicular(r).multiplyScalar(av);
      contact = { point: c.point, normal: c.wheelNormal, tangent: perpendicular(c.wheelNormal), wheelVelocity, palletVelocity, normalVelocityError: wheelVelocity.clone().sub(palletVelocity).dot(c.wheelNormal), slidingVelocity: wheelVelocity.clone().sub(palletVelocity).dot(perpendicular(c.wheelNormal)), actualWheelEdgeIndex: c.edgeIndex, actualEdgeParameter: c.edgeParameter, contactKind: 'finite-B-corner-on-existing-wheel-flank', wheelMoment: cross(c.point, c.wheelNormal), palletMoment: cross(r, c.palletNormal), nominalTipContact: false };
    }
    return { ...s, contact, palletAngle: a, palletAngularSpeed: av, palletAngularAcceleration: aa, wheelAngle: beta, wheelAngularSpeed: bv, wheelAngularAcceleration: ba, teethAdvanced: beta / g.toothPitch, freeDropState: s.freeDrop ? { progress: s.freeDropProgress, prescribed: true, actualWorkingSurfacesCheckedSeparately: true } : null, stage: s.activePallet === 'B' ? (s.drivingContact ? 'B-inner-corner-follows-existing-wheel-flank' : 'B-inner-corner-lock') : s.stage };
  };
  d.stateAtTime = time => d.stateAtCycleCoordinate(time / g.cyclePeriod);
  d.contactQualification.B = { finiteTipNormalCone: false, nominalTipReplacedByActualFlank: true, closestFlankImpulseValidated: true, forceValidated: false };
  d.transmission.workingBAdvance = branch.release.angle - branch.initial.angle;
  d.transmission.workingFirstDrop = g.halfToothPitch - branch.release.angle;
  d.transmission.workingSecondDrop = g.dropAngle + branch.initial.angle;
  d.dynamics.velocityContinuous = false;
  d.dynamics.scheduledHandoffVelocityContinuous = true;
  d.dynamics.facetedFlankImpactsPrescribed = true;
  d.reconstructionNote = 'B now bears through its finite inner corner on the existing seven-tip wheel flank, releasing at the preserved tip before the drop to C. The prior 4° half-swing, shortened B and 14.3% star-area reconstruction remain. Input oscillation, drops and small impacts at faceted flank joints are prescribed; friction, loaded capture and sustained oscillation are not simulated.';
  model.update = time => {
    oldUpdate(time); const s = d.stateAtTime(time);
    for (const part of [b.escapeWheel, b.escapeShaft]) { part.userData.rotor.rotation.z = s.wheelAngle; part.userData.angularSpeed = s.wheelAngularSpeed; }
    b.palletCarrier.rotation.z = s.palletAngle; b.palletCarrier.userData.angularSpeed = s.palletAngularSpeed;
    if (s.contact) { const marker = s.activePallet === 'B' ? b.bContactMarker : b.cContactMarker; marker.position.set(s.contact.point.x, s.contact.point.y, g.palletPlaneZ + .12); }
    d.kinematics = s; d.contacts = { BToothContact: s.activePallet === 'B' ? s.contact : null, CToothContact: s.activePallet === 'C' ? s.contact : null, freeDrop: s.freeDropState };
  };
  model.update(0); return model;
}
