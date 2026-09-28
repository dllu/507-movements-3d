import {makeWormSaddleProfile} from './mujoco-worm-saddle/profile.js';

// Movement 151's worm and wheel. Brown hatches about 36 fine teeth on the
// wheel, so the measured 104 stub-tooth worm is refined to half its axial
// pitch: 36 teeth keep the same pitch radius, every tooth and thread depth is
// halved, and the worm keeps its outer diameter (its axis rises by the saved
// depth, toward the plate's measured worm centre).
export function opposedScrewWormProfile(){
 const base=makeWormSaddleProfile(),teeth=36,pitch=base.pitch/2,lead=pitch/(2*Math.PI),pitchRadius=teeth*lead;
 const wormTip=base.wormTip,wormRoot=wormTip-(base.wormTip-base.wormRoot)/2;
 const wormPitchRadius=wormRoot+(base.wormPitchRadius-base.wormRoot)/2,distance=pitchRadius+wormPitchRadius;
 const wheelRadius=distance-wormRoot+(base.wheelRadius-(base.distance-base.wormRoot))/2;
 const hobTip=wormTip+(base.hobTip-base.wormTip)/2,tipHalfWidth=base.tipHalfWidth/2;
 const rootHalfWidth=tipHalfWidth+(wormTip-wormRoot)*Math.tan(base.pressureAngle);
 return {teeth,depth:base.depth,pressureAngle:base.pressureAngle,pitch,lead,pitchRadius,distance,wheelRadius,wheelRoot:distance-hobTip,
  wormRoot,wormTip,wormPitchRadius,tipHalfWidth,rootHalfWidth,hobTip,phase:0,clearance:base.clearance};
}
