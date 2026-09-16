// Prescribed, tread-indexed climbing gait. This solves placement, not human
// balance or ground reactions. A planted sole follows one material board;
// the free foot goes around the outside of the next board before landing.
export function treadmillLegState(time, index, geometry) {
  const { treadPitch, treadRadius, treadCount, wheelStartAngle, wheelPeriod,
    hipX, hipY, upperLength, lowerLength } = geometry;
  const speed = 2 * Math.PI / wheelPeriod;
  const cycle = 2 * treadPitch;
  const touchdownAngle = 40 * Math.PI / 180;
  const stanceFraction = 0.60;
  const phase = (speed * time + touchdownAngle - wheelStartAngle - treadPitch)
    / cycle + index / 2;
  const progress = phase - Math.floor(phase);
  const phaseRate = speed / cycle;
  let angle = touchdownAngle - cycle * progress;
  const planted = progress <= stanceFraction;
  // .0525 board half-thickness + .10 sole thickness + .0005 clearance.
  const normalOffset = 0.153;
  const radius = treadRadius + 0.04;
  const point = a => [radius * Math.cos(a) - normalOffset * Math.sin(a),
    radius * Math.sin(a) + normalOffset * Math.cos(a)];
  let [ankleX, ankleY] = point(angle);
  let velocityX = speed * ankleY, velocityY = -speed * ankleX;
  if (!planted) {
    const v = (progress - stanceFraction) / (1 - stanceFraction);
    const vRate = phaseRate / (1 - stanceFraction);
    const smooth = v ** 3 * (10 + v * (-15 + 6 * v));
    angle += cycle * smooth;
    const start = point(touchdownAngle - cycle * stanceFraction);
    const end = point(touchdownAngle);
    // Cubic Hermite endpoints match the board's position and velocity.
    // The outward arc clears intervening board edges before returning above
    // the next tread; angular interpolation alone cuts through its underside.
    const h = [2*v**3-3*v**2+1, -2*v**3+3*v**2, v**3-2*v**2+v, v**3-v**2];
    const dh = [6*v**2-6*v, -6*v**2+6*v, 3*v**2-4*v+1, 3*v**2-2*v];
    const startD = [speed*start[1]/vRate, -speed*start[0]/vRate];
    const endD = [speed*end[1]/vRate, -speed*end[0]/vRate];
    const pos = [0,1].map(i=>h[0]*start[i]+h[1]*end[i]+h[2]*startD[i]+h[3]*endD[i]);
    const vel = [0,1].map(i=>vRate*(dh[0]*start[i]+dh[1]*end[i]+dh[2]*startD[i]+dh[3]*endD[i]));
    ankleX = pos[0] + 1.80*(1-v)**2*Math.sin(Math.PI*v)**2;
    ankleY = pos[1] + 1.70*v**2*Math.sin(Math.PI*v)**2;
    velocityX = vel[0] + 1.80*((1-v)**2*Math.PI*Math.sin(2*Math.PI*v)
      - 2*(1-v)*Math.sin(Math.PI*v)**2)*vRate;
    velocityY = vel[1] + 1.70*(v**2*Math.PI*Math.sin(2*Math.PI*v)+2*v*Math.sin(Math.PI*v)**2)*vRate;
  }
  const dx = ankleX - hipX, dy = ankleY - hipY;
  const distanceSquared = dx * dx + dy * dy;
  const cosine = (distanceSquared - upperLength ** 2 - lowerLength ** 2)
    / (2 * upperLength * lowerLength);
  if (Math.abs(cosine) >= 1) throw new Error('Treadmill foot exceeds leg reach');
  const lowerAngle = Math.acos(cosine);
  const lowerAngularSpeed = -(dx * velocityX + dy * velocityY)
    / (upperLength * lowerLength * Math.sqrt(1 - cosine ** 2));
  const upperAngle = Math.atan2(dx, -dy)
    - Math.atan2(lowerLength * Math.sin(lowerAngle), upperLength + lowerLength * cosine);
  const upperAngularSpeed = (dx * velocityY - dy * velocityX) / distanceSquared
    - lowerLength * (upperLength * cosine + lowerLength) / distanceSquared * lowerAngularSpeed;
  const wheelAngle = wheelStartAngle - speed * time;
  const treadIndex = ((Math.round((angle - wheelAngle) / treadPitch) % treadCount) + treadCount) % treadCount;
  return { index, phase: phase * 2 * Math.PI, progress, planted, treadIndex,
    soleAngle: angle, ankleX, ankleY, upperAngle, lowerAngle,
    upperAngularSpeed, lowerAngularSpeed };
}
