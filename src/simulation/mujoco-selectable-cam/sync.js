// Apply native generalized coordinates to the independently authored meshes.
export function syncSelectableCamPhysics(model,state){
 const u=model.root.userData,b=u.blocks,g=u.geometry,v=u.valveGeometry;
 b.camRotor.rotation.z=state.shaft;b.slidingCarrier.position.z=state.carrier;
 b.lever.rotation.z=state.lever;b.followerRoller.rotor.rotation.z=state.roller;
 const x=g.leverPivot.x+g.outputArmLength*Math.cos(state.lever),y=g.leverPivot.y+g.outputArmLength*Math.sin(state.lever);
 u.valveBodies.rod.position.set(x,y,v.rodZ);u.valveBodies.rod.rotation.z=state.lever+state.rod;
 u.valveBodies.slider.position.set(v.guideX,g.sourceValvePinProjected.y-v.pinDistance+state.slider,v.rodZ);
 u.physicsState=state;model.root.updateMatrixWorld(true);
}
