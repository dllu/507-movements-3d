export function makeWaterGovernorUpdater(root,g){
 const names=['rotor','sleeve','leftUpper','leftLower','rightUpper','rightLower','upperStud','lowerStud','inputShaft','outputShaft','upperInput','spindleDrive','gateOutput','upperLoose','lowerLoose'];
 const blocks=Object.fromEntries(names.map(name=>[name,root.getObjectByName('body:'+name)])),{rotor,sleeve}=blocks;
 const initial={lowerAngle:Math.asin((g.sleeveRadius-g.pivotRadius-g.elbowArm*Math.sin(g.initialSpread))/g.lowerLink)};
 return state=>{
  rotor.rotation.y=state.spindle;sleeve.position.y=state.sleeveY;
  for(const sign of [-1,1]){
   const name=sign<0?'left':'right',theta=state[name+'Spread'];blocks[name+'Upper'].rotation.z=sign*theta;
   blocks[name+'Lower'].position.set(sign*(g.pivotRadius+g.elbowArm*Math.sin(theta)),g.topY-g.elbowArm*Math.cos(theta),0);
   blocks[name+'Lower'].rotation.z=sign*(initial.lowerAngle+state.qpos[sign<0?2:4]+theta-g.initialSpread);
  }
  blocks.upperStud.rotation.y=state.upper;blocks.lowerStud.rotation.y=state.lower;
  blocks.inputShaft.rotation.x=state.spindle;blocks.outputShaft.rotation.x=state.output;
  blocks.upperInput.rotation.z=Math.PI/2-state.spindle;
  blocks.spindleDrive.rotation.z=Math.PI-Math.PI/30+state.spindle;
  blocks.gateOutput.rotation.z=Math.PI/2-state.output;
  blocks.upperLoose.rotation.z=Math.PI-Math.PI/30+state.upper;
  blocks.lowerLoose.rotation.z=Math.PI-Math.PI/30-state.lower;
  root.updateMatrixWorld(true);
 };
}
