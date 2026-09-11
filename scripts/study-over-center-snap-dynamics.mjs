import { readFile, writeFile } from 'node:fs/promises';

const cam = JSON.parse(await readFile('artifacts/review/064-source-cam-study.json', 'utf8'));
const turn = Math.PI * 2, rows = cam.rows, resolution = rows.length - 1;
const length = cam.parameters.followerLength, springArm = length / 2;
const minimumHeight = springArm * Math.sin(cam.trough.followerAngle);
const driverSpeed = 0.4, preload = 1, stiffness = 6;
const torque = gamma => {
  const coordinate = ((gamma % turn + turn) % turn) / turn * resolution;
  const index = Math.floor(coordinate), t = coordinate - index, a = rows[index], b = rows[index + 1];
  const angle = a.followerAngle + (b.followerAngle - a.followerAngle) * t;
  const derivative = a.followerDerivative + (b.followerDerivative - a.followerDerivative) * t;
  const height = springArm * Math.sin(angle) - minimumHeight;
  return -(preload + stiffness * height) * springArm * Math.cos(angle) * derivative;
};
const maximumSpringTorque = Math.max(...rows.map(row => torque(row.gamma)));
const damping = Number(process.env.CAM_DAMPING ?? maximumSpringTorque / 8);
const inertia = Number(process.env.CAM_INERTIA ?? 0);
const velocity = angle => torque(angle) / damping;
const cycleDuration = turn / driverSpeed, steps = Number(process.env.PROBE_STEPS ?? 180000), dt = cycleDuration / steps, cycles = 3;
const reportRows = [], events = [];
let angle = 0, angularSpeed = driverSpeed, attached = true, peakSpeed = driverSpeed, minimumReaction = Infinity, maximumLead = 0;
for (let i = 0; i <= cycles * steps; i += 1) {
  const time = i * dt, input = driverSpeed * time, freeSpeed = velocity(angle);
  const nextAttached = angle - input <= 1e-9 && freeSpeed <= driverSpeed && angularSpeed <= driverSpeed + 1e-9;
  if (nextAttached !== attached) events.push({ time, event: nextAttached ? 'pin-catch' : 'pin-release', inputAngle: input, camAngle: angle });
  attached = nextAttached;
  const speed = attached ? driverSpeed : inertia ? angularSpeed : freeSpeed;
  const pinReactionTorque = attached ? damping * driverSpeed - torque(angle) : 0;
  const acceleration = attached || !inertia ? 0 : (torque(angle) - damping * speed) / inertia;
  peakSpeed = Math.max(peakSpeed, speed); maximumLead = Math.max(maximumLead, angle - input);
  if (attached) minimumReaction = Math.min(minimumReaction, pinReactionTorque);
  if (i % 180 === 0) reportRows.push({ time, cycle: i / steps, inputAngle: input, camAngle: angle,
    camSpeed: speed, lead: angle - input, attached, springTorque: torque(angle), dampingTorque: -damping * speed,
    pinReactionTorque, acceleration, torqueResidual: torque(angle) - damping * speed + pinReactionTorque - inertia * acceleration });
  if (i === cycles * steps) break;
  if (attached) { angle = input + driverSpeed * dt; angularSpeed = driverSpeed; }
  else if (inertia) {
    const rhs = (q, v) => [v, (torque(q) - damping * v) / inertia];
    const a = rhs(angle, angularSpeed), b = rhs(angle + dt / 2 * a[0], angularSpeed + dt / 2 * a[1]);
    const c = rhs(angle + dt / 2 * b[0], angularSpeed + dt / 2 * b[1]);
    const d = rhs(angle + dt * c[0], angularSpeed + dt * c[1]);
    angle += dt / 6 * (a[0] + 2 * b[0] + 2 * c[0] + d[0]);
    angularSpeed += dt / 6 * (a[1] + 2 * b[1] + 2 * c[1] + d[1]);
    if (angle < input + driverSpeed * dt) { angle = input + driverSpeed * dt; angularSpeed = driverSpeed; }
  }
  else {
    const a = velocity(angle), b = velocity(angle + dt / 2 * a), c = velocity(angle + dt / 2 * b), d = velocity(angle + dt * c);
    angle = Math.max(input + driverSpeed * dt, angle + dt / 6 * (a + 2 * b + 2 * c + d));
  }
}
const cycleEnds = reportRows.filter(row => Math.abs(row.cycle - Math.round(row.cycle)) < 1e-10);
const summary = { cycles, stepsPerCycle: steps, cycleDuration, driverSpeed, preload, stiffness,
  springArm, damping, inertia, maximumSpringTorque, peakCamSpeed: peakSpeed, maximumCamLead: maximumLead,
  settledFreeTimePerCycle: reportRows.filter(row => !row.attached && Math.abs(row.camSpeed) < 0.001).length * 180 * dt / cycles,
  minimumPinReactionTorque: minimumReaction,
  maximumTorqueResidual: Math.max(...reportRows.map(row => Math.abs(row.torqueResidual))),
  releases: events.filter(row => row.event === 'pin-release').length,
  catches: events.filter(row => row.event === 'pin-catch').length,
  cycleEnds, events };
const report = { movement: 64, status: 'provisional-spring-cam-dynamics-study',
  method: 'A unit-preloaded linear spring acts downward at the middle of the massless fixed-length follower. Contact-normal virtual work determines cam torque from the source-cam study table. Free motion has optional cam inertia and viscous bearing resistance; the driving edge imposes a unilateral minimum angle. RK4 integrates free motion. Catch is an ideal inelastic reset to driver speed. A rendered spring, finite pin contact forces, impact energy, table interpolation and time-step convergence still require verification before production use. A residual formed from this ODE is an algebraic diagnostic, not an independent energy check.',
  summary, rows: reportRows };
await writeFile(process.env.PROBE_OUTPUT ?? 'artifacts/review/064-snap-dynamics-study.json', JSON.stringify(report, null, 2) + '\n');
console.log(summary);
if (summary.releases !== cycles || summary.catches !== cycles || summary.minimumPinReactionTorque < -1e-10
  || summary.maximumCamLead >= Math.PI - 0.381 || summary.maximumTorqueResidual > 1e-9) process.exitCode = 1;
