import {roundedRackGear} from './coaxial-gear-geometry.js';
import {silkTraverseDimensions as s} from '../data/silk-traverse-dimensions.js';
export function makeSilkTraverseGears({samples=128,cutterSteps=4096}={}){
 const orbit=[(s.planetCenter[0]-s.diskCenter[0])/100,(s.diskCenter[1]-s.planetCenter[1])/100],distance=Math.hypot(...orbit);
 const module=2*distance/(s.sunTeeth+s.planetTeeth),sunPhase=Math.PI/6,line=Math.atan2(orbit[1],orbit[0]);
 const planetPhase=line+Math.PI-(Math.PI-s.sunTeeth*(line-sunPhase))/s.planetTeeth;
 const common={module,depth:.12,samples,cutterSteps,backlash:module*.02,radialClearance:module*.001,tipRadius:module*.05};
 const sun=roundedRackGear({...common,teeth:s.sunTeeth,boreRadius:.08,profileShift:.6,dedendum:1.02});
 const planet=roundedRackGear({...common,teeth:s.planetTeeth,boreRadius:.08,profileShift:-.6,dedendum:1});
 return {sun,planet,module,orbit,distance,sunPhase,planetPhase,ratio:s.sunTeeth/s.planetTeeth};
}
