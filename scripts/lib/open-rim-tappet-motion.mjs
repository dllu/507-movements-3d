const turn = 2 * Math.PI;
const wrap = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
const rotate = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
const dot = (a,b) => a[0] * b[0] + a[1] * b[1];
const cross = (a,b) => a[0] * b[1] - a[1] * b[0];
const safeAcos = value => Math.acos(Math.max(-1, Math.min(1, value)));
const nearestAngle = (angles, near) => angles.map(a => near + wrap(a - near))
  .sort((a,b) => Math.abs(a - near) - Math.abs(b - near))[0];

// Exact contacts for the source quadrilateral: leading side, rounded stud
// around its first corner, tip side, second corner, then the closing rim.
// The circular rounding belongs to the finite stud, not to the tappet mesh.
export function makeOpenRimTappetMotion(profile) {
  const p = profile.parameters, vertices = profile.tappet;
  const edge = index => {
    const a = vertices[index], b = vertices[(index + 1) % vertices.length];
    const d = [b[0] - a[0], b[1] - a[1]], length = Math.hypot(...d);
    return { a, b, normal: [d[1] / length, -d[0] / length] };
  };
  const first = edge(2), tip = edge(1), end = [p.rimOuter * Math.cos(-p.openingHalfAngle), p.rimOuter * Math.sin(-p.openingHalfAngle)];
  const pinAt = q => [p.studOrbit * Math.cos(q), p.studOrbit * Math.sin(q)];
  const seatedPin = pinAt(p.initialQ), seatedArm = [seatedPin[0] - p.centerDistance, seatedPin[1]];
  const entryOffset = safeAcos((dot(first.normal, first.a) + p.studRadius) / Math.hypot(...seatedArm));
  const entryBase = Math.atan2(seatedArm[1], seatedArm[0]) - Math.atan2(first.normal[1], first.normal[0]);
  const entryAngle = nearestAngle([entryBase - entryOffset, entryBase + entryOffset], 3);
  const cornerEvent = (vertex, normal, near) => {
    const point = vertex.map((v,i) => v + p.studRadius * normal[i]), radius = Math.hypot(...point);
    const delta = safeAcos((p.studOrbit ** 2 - p.centerDistance ** 2 - radius ** 2) / (2 * p.centerDistance * radius));
    return nearestAngle([delta - Math.atan2(point[1], point[0]), -delta - Math.atan2(point[1], point[0])], near);
  };
  const firstCornerAngle = cornerEvent(vertices[2], first.normal, 3.443);
  const tipSideAngle = cornerEvent(vertices[2], tip.normal, 3.519);
  const lastCornerAngle = cornerEvent(vertices[1], tip.normal, 3.622);
  const tipRadius = Math.hypot(...vertices[1]);
  const releaseQ = -safeAcos((p.centerDistance ** 2 + p.studOrbit ** 2 - (tipRadius + p.studRadius) ** 2)
    / (2 * p.centerDistance * p.studOrbit));
  const releasePin = pinAt(releaseQ), releaseArm = [releasePin[0] - p.centerDistance, releasePin[1]];
  const releaseAngle = nearestAngle([Math.atan2(releaseArm[1], releaseArm[0]) - Math.atan2(vertices[1][1], vertices[1][0])], 3.639);
  const closingOffset = safeAcos((p.rimOuter ** 2 + dot(releaseArm, releaseArm) - p.studRadius ** 2)
    / (2 * p.rimOuter * Math.hypot(...releaseArm)));
  const closingBase = Math.atan2(releaseArm[1], releaseArm[0]) + p.openingHalfAngle;
  const rimEntryAngle = nearestAngle([closingBase - closingOffset, closingBase + closingOffset], 4.08);
  const finalQ = p.initialQ - p.pitch, finalPin = pinAt(finalQ), finalArm = [finalPin[0] - p.centerDistance, finalPin[1]];
  const exitAngle = nearestAngle([Math.atan2(finalArm[1], finalArm[0]) + p.openingHalfAngle], 4.093);
  const stages = [
    { begin: entryAngle, end: firstCornerAngle, kind: 'line', feature: 2, edge: first, nearQ: -.25 },
    { begin: firstCornerAngle, end: tipSideAngle, kind: 'corner', feature: 2, vertex: vertices[2], nearQ: -.55 },
    { begin: tipSideAngle, end: lastCornerAngle, kind: 'line', feature: 1, edge: tip, nearQ: -.60 },
    { begin: lastCornerAngle, end: releaseAngle, kind: 'corner', feature: 1, vertex: vertices[1], nearQ: -.625 },
    { begin: rimEntryAngle, end: exitAngle, kind: 'corner', feature: 'rim-end', vertex: end, nearQ: finalQ },
  ];
  if (stages.some(s => !(s.end > s.begin)) || rimEntryAngle <= releaseAngle) throw new Error('Unexpected source tappet contact order');
  const atAngle = angle => {
    const stage = stages.find(s => angle >= s.begin && angle < s.end);
    if (!stage) {
      const q = angle < entryAngle ? p.initialQ : angle < rimEntryAngle ? releaseQ : finalQ;
      return { angle, outputAngle: q, advance: p.initialQ - q, outputSpeed: 0, indexing: false,
        stage: angle < entryAngle || angle >= exitAngle ? 'rim-locked' : 'bearing-resisted-pause', contact: null };
    }
    let q, point, force;
    if (stage.kind === 'line') {
      force = rotate(stage.edge.normal, angle);
      const delta = safeAcos((force[0] * p.centerDistance + dot(stage.edge.normal, stage.edge.a) + p.studRadius) / p.studOrbit);
      const base = Math.atan2(force[1], force[0]);
      q = nearestAngle([base - delta, base + delta], stage.nearQ);
      point = pinAt(q).map((v,i) => v - p.studRadius * force[i]);
    } else {
      point = rotate(stage.vertex, angle); point[0] += p.centerDistance;
      const radius = Math.hypot(...point), base = Math.atan2(point[1], point[0]);
      const delta = safeAcos((p.studOrbit ** 2 + radius ** 2 - p.studRadius ** 2) / (2 * p.studOrbit * radius));
      q = nearestAngle([base - delta, base + delta], stage.nearQ);
      const pin = pinAt(q); force = pin.map((v,i) => (v - point[i]) / p.studRadius);
    }
    const inputMoment = cross([point[0] - p.centerDistance, point[1]], force), outputMoment = cross(point, force);
    const outputSpeed = inputMoment / outputMoment;
    return { angle, outputAngle: q, advance: p.initialQ - q, outputSpeed, indexing: outputSpeed < -1e-4,
      stage: stage.feature === 'rim-end' ? 'rim-closing' : `tappet-${stage.kind}-${stage.feature}`,
      contact: { part: stage.feature === 'rim-end' ? 'rim' : 'tappet', feature: stage.feature, point, force, inputMoment, outputMoment } };
  };
  const parameters = { ...p, entryAngle, firstCornerAngle, tipSideAngle, lastCornerAngle, releaseAngle, rimEntryAngle, exitAngle,
    releaseQ, releaseAdvance: p.initialQ - releaseQ, advancePerCycle: p.pitch, period: turn,
    initialInputPhase: p.initialInputPhase ?? p.sourceInputAngle - p.assemblyAngle, cycleClosureError: 0 };
  const atTime = time => {
    const absoluteAngle = time + parameters.initialInputPhase, cycle = Math.floor(absoluteAngle / turn);
    const state = atAngle(absoluteAngle - cycle * turn);
    return { ...state, time, cycle, inputAngle: absoluteAngle, inputSpeed: 1,
      outputAngle: state.outputAngle - cycle * p.pitch, advance: state.advance + cycle * p.pitch, cycleClosureError: 0 };
  };
  return { parameters, stages, atAngle, atTime };
}
