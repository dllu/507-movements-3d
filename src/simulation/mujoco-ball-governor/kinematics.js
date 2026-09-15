import {governorGeometry,governorEquilibrium} from './equilibrium.js';
const g=governorGeometry(),initialSleeve=governorEquilibrium(g.initialSpread,g).sleeveY;
export const ballGovernorState=qpos=>({qpos,spindle:qpos[0],leftSpread:g.initialSpread+qpos[1],rightSpread:g.initialSpread+qpos[3],sleeveY:initialSleeve+qpos[5]});
