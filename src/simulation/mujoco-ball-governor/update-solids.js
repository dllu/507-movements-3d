import {governorGeometry,governorEquilibrium} from './equilibrium.js';
export function makeBallGovernorUpdater(root){
  const g=governorGeometry(),names=['rotor','sleeve','output','leftUpper','leftLower','rightUpper','rightLower'];
  const blocks=Object.fromEntries(names.map(name=>[name,root.getObjectByName('body:'+name)]));
  const {rotor,sleeve,output}=blocks;
  const input=root.getObjectByName('inputBody').parent,outputGear=root.getObjectByName('outputBody').parent;
  return state => {
    rotor.rotation.y = state.spindle;
    sleeve.position.y = state.sleeveY;
    output.position.y = state.sleeveY;
    for (const sign of [-1,1]) {
      const name = sign<0?'left':'right', theta=state[name+'Spread'];
      const upper=blocks[name+'Upper'], lower=blocks[name+'Lower'];
      upper.rotation.z=sign*theta;
      const elbowR=g.pivotRadius+g.elbowArm*Math.sin(theta), elbowY=g.topY-g.elbowArm*Math.cos(theta);
      lower.position.set(sign*elbowR,elbowY,0);
      // Native lower hinge coordinate, preserving its actual closure residual.
      const qIndex=sign<0?2:4;
      const initialLower=governorEquilibrium(g.initialSpread,g).lowerAngle;
      lower.rotation.z=sign*(initialLower+state.qpos[qIndex]+theta-g.initialSpread);
    }
    input.rotation.z=-Math.PI/2+state.spindle*30/36;
    outputGear.rotation.z=-Math.PI/2-Math.PI/30-state.spindle+.0062;
    root.updateMatrixWorld(true);
  };
}
