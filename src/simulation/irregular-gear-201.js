import * as THREE from 'three';
import { involuteSpurOutline } from './smooth-extrusion.js';

// Movement 201's irregular driving gear and the eight-tooth pinion carried on
// the rocking arm.
//
// Pitch curve. scripts/trace-irregular-gear-201.py traces Brown's gear: the
// mid-tooth curve of the drawn outline, fitted about the region's centroid by
// a five-harmonic Fourier series, with one tangency point where his pinion
// hides the mesh. In the driver's own frame (origin on its shaft, plate pose)
//   p(u) = centre + R(u) (cos u, sin u),
// a smooth, closed, star-shaped curve (its one concave stretch has a radius of
// curvature 1.7, over four times the pinion's). Its perimeter is 18 of
// Brown's tooth pitches; the pinion's pitch circle is 8 of them.
//
// Motion. The driver turns uniformly about its fixed shaft. The pinion's
// pitch circle rolls without slipping on the outside of p(u), so its centre
// lies on the offset curve p(u) + rho N(u), and it is also held on the fixed
// arm length L from the carrier pivot. For each driver angle the contact
// parameter u solves |S + R(phi)(p(u) + rho N(u)) - pivot| = L on the branch
// through the plate pose (Newton from a continuation table). Rolling gives the
// pinion's angle: psi = phi + alpha(u) + s(u)/rho + psi0, where alpha is the
// normal's direction and s the arc length. Velocities follow by implicit
// differentiation. The driver's teeth are generated offline by that same
// rolling pinion (scripts/generate-irregular-gear-profiles.py), so the pair is
// conjugate by construction.
export const irregularDriver201 = {
  teeth: 18,
  pinionTeeth: 8,
  centre: [-0.416604, -0.300765],
  radiusCoefficients: [0.7688839, 0.0812727, 0.0438232, -0.0946104, 0.179555, 0.0299843,
    0.0489431, -0.0001472, -0.0178685, -0.0141563, 0.0126844],
  // Tooth proportions in modules: square-ish teeth as Brown draws them.
  addendum: 0.9,
  pinionDedendum: 1.15,
  pressureAngle: THREE.MathUtils.degToRad(20),
};

const GAUSS5 = [
  [-0.906179845938664, 0.236926885056189], [-0.538469310105683, 0.478628670499366],
  [0, 0.568888888888889], [0.538469310105683, 0.478628670499366], [0.906179845938664, 0.236926885056189],
];
const TWO_PI = Math.PI * 2;

export function makeIrregularDrive201({ shaft, pivot, carrierLength, platePinionCenter, inputAngularSpeed }) {
  const d = irregularDriver201, c = d.radiusCoefficients, harmonics = (c.length - 1) / 2;
  const centre = new THREE.Vector2(...d.centre);
  // R(u) and its first two derivatives.
  const radius = (u) => {
    let r = c[0], r1 = 0, r2 = 0;
    for (let k = 1; k <= harmonics; k += 1) {
      const a = c[2 * k - 1], b = c[2 * k], cs = Math.cos(k * u), sn = Math.sin(k * u);
      r += a * cs + b * sn; r1 += k * (-a * sn + b * cs); r2 -= k * k * (a * cs + b * sn);
    }
    return [r, r1, r2];
  };
  // Pitch point, tangent derivative and curvature in the driver frame.
  const curve = (u) => {
    const [r, r1, r2] = radius(u), cs = Math.cos(u), sn = Math.sin(u);
    const x1 = r1 * cs - r * sn, y1 = r1 * sn + r * cs;
    const x2 = r2 * cs - 2 * r1 * sn - r * cs, y2 = r2 * sn + 2 * r1 * cs - r * sn;
    const speed = Math.hypot(x1, y1), tangent = new THREE.Vector2(x1 / speed, y1 / speed);
    return {
      point: new THREE.Vector2(centre.x + r * cs, centre.y + r * sn),
      tangent, normal: new THREE.Vector2(tangent.y, -tangent.x), speed,
      curvature: (x1 * y2 - y1 * x2) / speed ** 3,
    };
  };
  const normalAngle = (u, normal) => {
    const cs = Math.cos(u), sn = Math.sin(u);
    return u + Math.atan2(cs * normal.y - sn * normal.x, cs * normal.x + sn * normal.y);
  };
  // Arc length: a 1024-panel table, exact within a panel by 5-point Gauss.
  const panels = 1024, panelWidth = TWO_PI / panels, cumulative = new Float64Array(panels + 1);
  const gauss = (a, b) => { let sum = 0; const h = (b - a) / 2, m = (a + b) / 2; for (const [x, w] of GAUSS5) sum += w * curve(m + h * x).speed; return sum * h; };
  for (let i = 0; i < panels; i += 1) cumulative[i + 1] = cumulative[i] + gauss(i * panelWidth, (i + 1) * panelWidth);
  const perimeter = cumulative[panels];
  const arcLength = (u) => {
    const turns = Math.floor(u / TWO_PI), local = u - turns * TWO_PI, i = Math.min(panels - 1, Math.floor(local / panelWidth));
    return turns * perimeter + cumulative[i] + gauss(i * panelWidth, local);
  };
  const circularPitch = perimeter / d.teeth, module = circularPitch / Math.PI;
  const pinionPitchRadius = d.pinionTeeth * circularPitch / TWO_PI;
  const rho = pinionPitchRadius;
  const offset = (u) => { const k = curve(u); return { k, center: k.point.clone().addScaledVector(k.normal, rho) }; };
  const rotate = (v, a) => new THREE.Vector2(v.x * Math.cos(a) - v.y * Math.sin(a), v.x * Math.sin(a) + v.y * Math.cos(a));
  const perp = (v) => new THREE.Vector2(-v.y, v.x);
  const residual = (u, phi) => {
    const { k, center } = offset(u), world = rotate(center, phi).add(shaft), arm = world.clone().sub(pivot);
    const derivative = rotate(k.tangent.clone().multiplyScalar(k.speed * (1 + rho * k.curvature)), phi);
    return { f: arm.lengthSq() - carrierLength ** 2, df: 2 * arm.dot(derivative), k, world, arm, derivative };
  };
  const newton = (u, phi) => {
    for (let i = 0; i < 40; i += 1) {
      const { f, df } = residual(u, phi), step = f / df;
      u -= step;
      if (Math.abs(step) < 1e-15) break;
    }
    return u;
  };
  // Plate pose branch: the offset-curve crossing nearest Brown's pinion.
  let start = 0, best = Infinity;
  for (let i = 0; i < 4096; i += 1) {
    const u = TWO_PI * i / 4096, a = residual(u, 0), b = residual(u + TWO_PI / 4096, 0);
    if (Math.sign(a.f) !== Math.sign(b.f)) {
      const distance = a.world.distanceTo(platePinionCenter);
      if (distance < best) { best = distance; start = u; }
    }
  }
  // Continuation table over one clockwise (inputAngularSpeed < 0) driver turn.
  const direction = Math.sign(inputAngularSpeed), steps = 2048, table = new Float64Array(steps + 1);
  table[0] = newton(start, 0);
  for (let i = 1; i <= steps; i += 1) table[i] = newton(table[i - 1], direction * TWO_PI * i / steps);
  const turnShift = table[steps] - table[0];
  if (Math.abs(Math.abs(turnShift) - TWO_PI) > 1e-9) throw new Error(`201 contact does not close one turn: ${turnShift}`);
  const contactParameter = (phi) => {
    const x = phi / (direction * TWO_PI) * steps, turns = Math.floor(x / steps), local = x - turns * steps;
    const i = Math.min(steps - 1, Math.floor(local)), f = local - i;
    return newton(turns * turnShift + table[i] + (table[i + 1] - table[i]) * f, phi);
  };
  const u0 = table[0];
  // A pinion tooth space (tooth centres lie at multiples of 2 pi / 8) faces
  // the contact in the plate pose, as a driver tooth enters it there.
  const psi0 = Math.PI - Math.PI / d.pinionTeeth - arcLength(u0) / rho;

  const stateAt = (phi, omega = inputAngularSpeed) => {
    const u = contactParameter(phi), { k, world, arm, derivative } = residual(u, phi);
    const pinionCenter = world, fromShaft = world.clone().sub(shaft);
    // du/dphi from d/dphi |W - pivot|^2 = 0 with dW/dphi = J(W - S) + R o' du/dphi.
    const dudphi = -arm.dot(perp(fromShaft)) / arm.dot(derivative);
    const dWdphi = perp(fromShaft).addScaledVector(derivative, dudphi);
    const pinionCenterVelocity = dWdphi.clone().multiplyScalar(omega);
    const carrierAngle = Math.atan2(arm.y, arm.x);
    const carrierAngularSpeed = (arm.x * pinionCenterVelocity.y - arm.y * pinionCenterVelocity.x) / arm.lengthSq();
    const alpha = normalAngle(u, k.normal), s = arcLength(u);
    const pinionAngle = phi + alpha + s / rho + psi0;
    const pinionAngularSpeed = omega * (1 + (k.curvature * k.speed + k.speed / rho) * dudphi);
    const contactNormal = rotate(k.normal, phi);
    const contactPoint = rotate(k.point, phi).add(shaft);
    const contactAngle = phi + alpha;
    const contactAngularSpeed = omega * (1 + k.curvature * k.speed * dudphi);
    const driverSurfaceVelocity = perp(contactPoint.clone().sub(shaft)).multiplyScalar(omega);
    const pinionSurfaceVelocity = pinionCenterVelocity.clone().add(perp(contactPoint.clone().sub(pinionCenter)).multiplyScalar(pinionAngularSpeed));
    return {
      contactParameter: u, contactArcLength: s, contactAngle, contactAngularSpeed, contactNormal,
      contactTangent: perp(contactNormal), contactPoint, pitchCurvature: k.curvature,
      pinionCenter, pinionCenterVelocity, pinionAngle, pinionAngularSpeed, carrierAngle, carrierAngularSpeed,
      driverSurfaceVelocity, pinionSurfaceVelocity,
      rollingInvariant: pinionAngle - phi - alpha - s / rho,
      pitchTangencyError: contactPoint.distanceTo(pinionCenter) - rho,
    };
  };
  // Driver-frame outlines: pitch curve and the addendum blank the pinion cuts.
  const sampled = (count, distance) => Array.from({ length: count }, (_, i) => {
    const k = curve(TWO_PI * i / count); return k.point.clone().addScaledVector(k.normal, distance);
  });
  const addendum = d.addendum * module;
  const pinionOutline = involuteSpurOutline({
    teeth: d.pinionTeeth, pitchRadius: rho, rootRadius: rho - d.pinionDedendum * module,
    outerRadius: rho + d.addendum * module, pressureAngle: d.pressureAngle, flankSamples: 64, tipSamples: 32, rootSamples: 32,
  });
  return {
    perimeter, circularPitch, module, pinionPitchRadius: rho, addendum, psi0,
    driverTeeth: d.teeth, pinionTeeth: d.pinionTeeth, centre, radiusCoefficients: [...c],
    pitchPoint: (u) => curve(u), arcLength, stateAt, pitchOutline: (n = 2048) => sampled(n, 0),
    blankOutline: (n = 4096) => sampled(n, addendum), pinionOutline,
    minimumPitchRadiusFromShaft: Math.min(...sampled(4096, 0).map((p) => p.length())),
    maximumPitchRadiusFromShaft: Math.max(...sampled(4096, 0).map((p) => p.length())),
  };
}
