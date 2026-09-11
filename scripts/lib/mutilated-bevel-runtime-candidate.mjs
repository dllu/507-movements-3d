import { makeMutilatedBevelCandidate } from './mutilated-bevel-candidate.mjs';
import { applySectorRelief } from './mutilated-bevel-tooth-relief.mjs';
import { makeMutilatedBevelSplineMotion } from './mutilated-bevel-contact-spline.mjs';
import { setSpin } from '../../src/simulation/primitives.js';

export function makeMutilatedBevelRuntimeCandidate(bake,relief){
  const model=makeMutilatedBevelCandidate(bake.parameters);applySectorRelief(model,relief);
  const motion=makeMutilatedBevelSplineMotion(bake.profile),{blocks:b,geometry:p}=model.root.userData;
  const stateAtTime=time=>{
    const coordinate=p.initialCyclePhase+time/p.period,A=motion.atCoordinate(coordinate),B=motion.atCoordinate(coordinate+.5),
      indexingA=A.derivative>1e-8,indexingB=B.derivative>1e-8;
    return{time,coordinate,driverAngle:-2*Math.PI*coordinate,angleA:A.angle,angleB:B.angle,
      inputAngularSpeed:-2*Math.PI/p.period,angularSpeedA:A.derivative/p.period,angularSpeedB:B.derivative/p.period,
      indexingA,indexingB,dwellA:!indexingA,dwellB:!indexingB,
      stage:indexingA&&indexingB?'both-outputs-contacting':indexingA?'index-A-dwell-B':indexingB?'index-B-dwell-A':'unforced-dwell',
      qualification:'Precomputed quasistatic contact motion with ideal bearing friction during unforced dwell. No positive lock or inertial dynamics is claimed.'};
  };
  model.update=time=>{
    const state=stateAtTime(time);setSpin(b.driverC,state.driverAngle);setSpin(b.gearA,state.angleA);setSpin(b.gearB,state.angleB);
    model.root.userData.kinematics=state;
  };
  Object.assign(model.root.userData,{mechanism:'isolated-mutilated-bevel-runtime-candidate',motion,stateAtTime,
    animationTiming:{authoredCyclePeriod:p.period},minimumDisplayCycleSeconds:p.period,
    qualification:'Isolated runtime candidate. Geometry construction still uses the study helper; final asset export, production integration, and regression are pending.'});
  model.update(0);return model;
}
