export function syncElbowPawl(visual,state){
 const u=visual.root.userData,b=u.blocks,f=u.profile,[carrier,rod,pawl,output,slider]=state.qpos,c=Math.cos(carrier),s=Math.sin(carrier);
 b.slider.position.y=f.rodEnd[1]+slider;
 b.carrier.rotation.z=carrier;b.output.rotation.z=output;
 for(const [name,point,relative] of [['rod',f.crank,rod],['pawl',f.pawlPivot,pawl]]){
  b[name].position.set(c*point[0]-s*point[1],s*point[0]+c*point[1],0);b[name].rotation.z=carrier+relative;
 }
 u.physicsState=state;visual.root.updateMatrixWorld(true);
}
