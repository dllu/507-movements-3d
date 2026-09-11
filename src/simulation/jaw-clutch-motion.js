import * as THREE from 'three';

export function makeJawClutchMotion() {
  const p = { cycleDuration: 12, jawCount: 6, jawFraction: 0.36, jawHeight: 0.18,
    stroke: 0.54, overlap: 0.12, grooveLeft: 2.35, grooveRight: 2.60,
    followerRadius: 0.075, followerZ: 0.3375, leverLength: 1.15,
    pivotX: 2.525, pivotY: -1.25, lockPhase: 0.34, releasePhase: 0.72 };
  const pitch = 2 * Math.PI / p.jawCount, driveSpeed = -4 * pitch / p.cycleDuration;
  const contactPhase = (0.5 - p.jawFraction) * pitch;
  const lockedAdvance = (p.releasePhase - p.lockPhase) * p.cycleDuration * driveSpeed;
  const coastDuration = 2 * (-2 * pitch - lockedAdvance) / driveSpeed;
  const smooth = (u) => { const t = THREE.MathUtils.clamp(u, 0, 1); return t * t * (3 - 2 * t); };
  const stateAt = (time) => {
    const cycle = Math.floor(time / p.cycleDuration), t = time - cycle * p.cycleDuration;
    const phase = t / p.cycleDuration;
    let shift, side = 'right', play = 1;
    if (phase < 0.08) shift = p.stroke;
    else if (phase < 0.13) { shift = p.stroke; play = 1 - smooth((phase - 0.08) / 0.05); side = 'free'; }
    else if (phase < 0.275) { shift = p.stroke + (p.overlap - p.stroke) * smooth((phase - 0.13) / 0.145); side = 'left'; }
    else if (phase < 0.335) { shift = p.overlap * (1 - smooth((phase - 0.275) / 0.06)); side = 'left'; }
    else if (phase < 0.60) { shift = 0; side = 'left'; }
    else if (phase < 0.65) { shift = 0; play = smooth((phase - 0.60) / 0.05); side = 'free'; }
    else if (phase < p.releasePhase) shift = p.overlap * smooth((phase - 0.65) / (p.releasePhase - 0.65));
    else if (phase < 0.86) shift = p.overlap + (p.stroke - p.overlap) * smooth((phase - p.releasePhase) / (0.86 - p.releasePhase));
    else shift = p.stroke;
    const inputAngle = driveSpeed * time;
    const waitingAngle = driveSpeed * (cycle + p.lockPhase) * p.cycleDuration + contactPhase + 2 * pitch * cycle;
    let outputAngle, outputAngularSpeed, mode;
    if (phase < p.lockPhase) { outputAngle = waitingAngle; outputAngularSpeed = 0; mode = 'waiting'; }
    else if (phase <= p.releasePhase) {
      outputAngle = inputAngle + contactPhase + 2 * pitch * cycle;
      outputAngularSpeed = driveSpeed; mode = 'locked';
    } else {
      const coastTime = Math.min(t - p.releasePhase * p.cycleDuration, coastDuration);
      outputAngle = waitingAngle + lockedAdvance + driveSpeed * coastTime * (1 - coastTime / (2 * coastDuration));
      outputAngularSpeed = driveSpeed * (1 - coastTime / coastDuration);
      mode = coastTime < coastDuration ? 'coasting' : 'stopped';
    }
    const leftContact = p.grooveLeft - p.stroke + shift + p.followerRadius;
    const rightContact = p.grooveRight - p.stroke + shift - p.followerRadius;
    const followerX = side === 'left' ? leftContact : side === 'right' ? rightContact
      : THREE.MathUtils.lerp(leftContact, rightContact, play);
    const leverAngle = Math.asin((followerX - p.pivotX) / p.leverLength);
    const followerPoint = new THREE.Vector3(followerX, p.pivotY + p.leverLength * Math.cos(leverAngle), p.followerZ);
    return { time, phase, cycle, shift, inputAngle, inputAngularSpeed: driveSpeed,
      outputAngle, outputAngularSpeed, mode, locked: mode === 'locked',
      dogOverlap: Math.max(0, p.overlap - shift), tipGap: Math.max(0, shift - p.overlap),
      relativeAngle: THREE.MathUtils.euclideanModulo(outputAngle - inputAngle + pitch / 2, pitch) - pitch / 2,
      leverAngle, followerPoint, followerSide: side };
  };
  return { parameters: p, pitch, driveSpeed, contactPhase, coastDuration, stateAt };
}
