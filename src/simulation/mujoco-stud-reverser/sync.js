export function syncStudReverser(model,state){
 const u=model.root.userData,b=u.blocks,[disk,bar,lever]=state.qpos;
 b.diskRotor.rotation.z=disk;b.slidingBar.position.x=bar;b.lever.rotation.z=lever;
 for(const guide of b.guideRollers)guide.userData.rotor.rotation.z=-bar/u.geometry.guideRollerRadius;
 for(const marker of [b.directContactMarker,b.returnInputContactMarker,b.returnOutputContactMarker])marker.visible=false;
 u.physicsState=state;model.root.updateMatrixWorld(true);
}
