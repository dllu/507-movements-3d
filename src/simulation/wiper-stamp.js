import {Box3,Vector3} from 'three';
import profile from '../data/wiper-stamp-profile.js';
import {makeWiperStampGeometry} from './wiper-stamp-geometry.js';
import {makeWiperStampPlayback} from './wiper-stamp-motion.js';

export function makeWiperStampDrive() {
  const model=makeWiperStampGeometry(),u=model.root.userData,motion=makeWiperStampPlayback(model,profile);
  Object.assign(u,{profile,motion,fidelity:'authored',reconstructionStatus:'rebuilt',mechanism:'two-wiper-flat-projection-gravity-stamp',
    playbackPeriod:profile.period,minimumDisplayCycleSeconds:profile.period,animationTiming:{authoredCyclePeriod:profile.period},
    sampledMotionBounds:profile.motionBounds,cameraFitBounds:new Box3(new Vector3(...profile.motionBounds.min),new Vector3(...profile.motionBounds.max)),
    stateAtTime:motion.sample,
    qualification:'The independently traced wipers, flat projection B, square rod, curved standard and flared head follow the engraving. Depths, shaft/bearing construction and rectangular guide bores reconstruct concealed details. The source omits the striking bed; its height permits a forty-pixel source-pose drop while keeping the upper guide engaged.',
    idealConstraints:'A constant clockwise shaft lifts the freely translating stamp through finite unilateral cam contact. Gravity and inertia determine release, overshoot and fall; the rigid bed absorbs impacts. The ideal prismatic guides constrain transverse motion and rotation. Normalized mass, gravity, rigid inelastic contact and concealed bed construction are explicit assumptions. Startup is retained, then a complete four-second shaft cycle repeats from a resting stamp pose. Playback correction is bounded to 0.002 source pixels.'});
  model.update=time=>{const state=motion.sample(time);model.setState(state);u.kinematics=state;};
  model.update(0);return model;
}
