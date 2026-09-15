export function waterGovernorState(qpos,g){
 const radial=g.pivotRadius+g.elbowArm*Math.sin(g.initialSpread)-g.sleeveRadius;
 const initialSleeve=g.topY-g.elbowArm*Math.cos(g.initialSpread)-Math.sqrt(g.lowerLink**2-radial**2);
 return{qpos,spindle:qpos[0],leftSpread:g.initialSpread+qpos[1],rightSpread:g.initialSpread+qpos[3],sleeveY:initialSleeve+qpos[5],upper:qpos[6],lower:qpos[7],output:qpos[8]};
}
export function waterGovernorMotionBound(delta,g){
 return (g.pivotRadius+g.ballArm+g.ballRadius)*Math.abs(delta[0])+(g.ballArm+g.ballRadius)*Math.max(Math.abs(delta[1]),Math.abs(delta[3]))+(g.lowerLink+.13)*Math.max(Math.abs(delta[2]),Math.abs(delta[4]))+Math.abs(delta[5])+.666*Math.max(...delta.slice(6).map(Math.abs));
}
