const turn = 2 * Math.PI;
const wrap = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
const segmentClosest = (point, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], den = dx * dx + dy * dy;
  const t = den ? Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / den)) : 0;
  return [a[0] + t * dx, a[1] + t * dy];
};
const segmentDistance = (point, a, b) => {
  const at = segmentClosest(point, a, b);
  return Math.hypot(point[0] - at[0], point[1] - at[1]);
};

export function makeOpenRimTappetStudy({ shortening = 0, openingHalfAngle = .8, openingCenter = 0,
  centerDistance = 2.25, rimWidth = .08, interiorStud = false, seated = false } = {}) {
  const source = { outputRadius: 380.31637721344794, studOrbit: 318.1716903624607,
    driverRadius: 406.36372932885587, driverCenter: [1088.419670343494, 773.0476765349767],
    outputCenter: [444.32523090124755, 758.5299380953418] };
  const outputRadius = 1.28, scale = source.outputRadius / outputRadius;
  const studOrbit = source.studOrbit / scale, driverRadius = source.driverRadius / scale;
  const studRadius = .075, studCount = 10, pitch = turn / studCount, clearance = .00015;
  const lockAngle = interiorStud ? pitch : pitch / 2, studMount = interiorStud ? 0 : pitch / 2;
  const rimOuter = Math.hypot(centerDistance - studOrbit * Math.cos(lockAngle), studOrbit * Math.sin(lockAngle)) - studRadius - clearance;
  const rimInner = rimOuter - rimWidth;
  const lockSeat = lockAngle - Math.acos((centerDistance ** 2 + studOrbit ** 2 - (rimOuter + studRadius) ** 2)
    / (2 * centerDistance * studOrbit));
  const initialQ = seated ? lockSeat : 0;
  const sourceInputAngle = Math.atan2(source.driverCenter[1] - 729.5, 689 - source.driverCenter[0]);
  const c = Math.cos(sourceInputAngle), s = Math.sin(sourceInputAngle);
  const tappet = [[1018,714],[686,710],[692,749],[1028,812]].map(point => {
    const x = (point[0] - source.driverCenter[0]) / scale, y = (source.driverCenter[1] - point[1]) / scale;
    return [x * c + y * s - (point[0] < 800 ? shortening : 0), -x * s + y * c];
  });
  const endpoints = [-1, 1].map(sign => {
    const a = openingCenter + sign * openingHalfAngle;
    return [rimInner, rimOuter].map(r => [r * Math.cos(a), r * Math.sin(a)]);
  });
  const pinInTappet = point => {
    let inside = false, distance = Infinity;
    for (let i = 0; i < tappet.length; i++) {
      const a = tappet[i], b = tappet[(i + 1) % tappet.length];
      distance = Math.min(distance, segmentDistance(point, a, b));
      if ((a[1] > point[1]) !== (b[1] > point[1])
        && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside ? studRadius + distance : Math.max(0, studRadius - distance);
  };
  const pinInRim = point => {
    const radius = Math.hypot(...point), angle = wrap(Math.atan2(point[1], point[0]) - openingCenter);
    const outsideOpening = Math.abs(angle) >= openingHalfAngle;
    let distance = Math.min(...endpoints.map(([a,b]) => segmentDistance(point, a, b)));
    if (outsideOpening) distance = Math.min(distance, Math.abs(radius - rimInner), Math.abs(radius - rimOuter));
    const inside = outsideOpening && radius > rimInner && radius < rimOuter;
    return inside ? studRadius + distance : Math.max(0, studRadius - distance);
  };
  const atAngle = angle => {
    const c = Math.cos(angle), s = Math.sin(angle);
    return (advance, details = false) => {
      let depth = 0, witness = null;
      for (let stud = 0; stud < studCount; stud++) {
        const q = initialQ + studMount + stud * pitch - advance;
        const x = studOrbit * Math.cos(q) - centerDistance, y = studOrbit * Math.sin(q);
        const point = [x * c + y * s, -x * s + y * c];
        for (const [part, value] of [['tappet', pinInTappet(point)], ['rim', pinInRim(point)]]) {
          if (value > depth) { depth = value; if (details) witness = { part, stud, point }; }
        }
      }
      return details ? { depth, witness } : depth;
    };
  };
  const contactsAtAngle = (angle, advance, tolerance = 5e-6) => {
    const rows = [], c = Math.cos(angle), s = Math.sin(angle);
    const world = point => [c * point[0] - s * point[1] + centerDistance, s * point[0] + c * point[1]];
    for (let stud = 0; stud < studCount; stud++) {
      const q = initialQ + studMount + stud * pitch - advance;
      const x = studOrbit * Math.cos(q) - centerDistance, y = studOrbit * Math.sin(q);
      const point = [x * c + y * s, -x * s + y * c];
      const offer = (at, part, feature) => {
        const delta = [point[0] - at[0], point[1] - at[1]], distance = Math.hypot(...delta);
        if (Math.abs(distance - studRadius) > tolerance) return;
        const localNormal = delta.map(v => v / distance);
        const force = [c * localNormal[0] - s * localNormal[1], s * localNormal[0] + c * localNormal[1]];
        const contact = world(at), driverArm = [contact[0] - centerDistance, contact[1]];
        const cross = (a,b) => a[0] * b[1] - a[1] * b[0];
        rows.push({ stud, part, feature, point: contact, force, gap: distance - studRadius,
          outputMoment: cross(contact, force), inputMoment: cross(driverArm, force) });
      };
      for (let i = 0; i < tappet.length; i++) offer(segmentClosest(point, tappet[i], tappet[(i + 1) % tappet.length]), 'tappet', i);
      for (const [i, [a,b]] of endpoints.entries()) offer(segmentClosest(point, a, b), 'rim', `end-${i}`);
      if (Math.abs(wrap(Math.atan2(point[1], point[0]) - openingCenter)) >= openingHalfAngle) {
        const radius = Math.hypot(...point);
        for (const [name,r] of [['inner',rimInner],['outer',rimOuter]]) offer(point.map(v => v * r / radius), 'rim', name);
      }
    }
    return rows;
  };
  return { parameters: { studCount, pitch, studOrbit, studRadius, outputRadius, driverRadius, scale,
    centerDistance, rimOuter, rimInner, rimWidth, openingCenter, openingHalfAngle, shortening, clearance, interiorStud, lockAngle, studMount, lockSeat, initialQ, seated,
    sourceInputAngle, assemblyAngle: Math.atan2(source.outputCenter[1] - source.driverCenter[1], source.driverCenter[0] - source.outputCenter[0]) },
  tappet, atAngle, contactsAtAngle, lipschitzBound: studOrbit };
}

export function projectOpenRimTappet(study, { steps = 520, begin = 1.8, end = 4.5 } = {}) {
  const p = study.parameters, tolerance = 1e-8, rows = [], failed = [];
  const step = (end - begin) / steps; let advance = 0;
  for (let i = 0; i <= steps; i++) {
    const angle = begin + i * step, intrusion = study.atAngle(angle), initial = intrusion(advance), previous = advance;
    if (initial > tolerance) {
      let evaluations = 0, best = { depth: Infinity, advance };
      const firstAllowed = (low, high) => {
        const mid = (low + high) / 2, depth = intrusion(mid); evaluations++;
        if (depth < best.depth) best = { depth, advance: mid };
        if (depth - study.lipschitzBound * (high - low) / 2 > tolerance) return null;
        if (high - low < 1e-10) {
          for (const at of [low, mid, high]) if (intrusion(at) <= tolerance) return at;
          return null;
        }
        return firstAllowed(low, mid) ?? firstAllowed(mid, high);
      };
      const permitted = firstAllowed(advance, p.pitch + .05);
      if (permitted === null || permitted - advance > .03) {
        failed.push({ i, angle, advance, initial, permitted, best, evaluations, witness: intrusion(advance, true),
          reason: permitted === null ? 'No permitted forward pose' : 'Disconnected forward jump' });
        break;
      }
      advance = permitted;
    }
    rows.push({ angle, advance, speed: i ? (advance - previous) / step : 0,
      initialPenetration: initial, remainingPenetration: intrusion(advance) });
  }
  return { parameters: p, steps, begin, end, poses: rows.length, expectedAdvance: p.pitch, actualAdvance: advance,
    maximumSpeed: Math.max(...rows.map(row => row.speed)), failed, rows };
}
