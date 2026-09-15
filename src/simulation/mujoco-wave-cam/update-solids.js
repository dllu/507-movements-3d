export function waveCamPlaybackState(q,g){
 const [cam,rocker,rollerAbsoluteAngle]=q;
 return{cam,rocker,rollerAngle:rollerAbsoluteAngle-rocker,rollerCenter:[g.pivot[0]+g.arm*Math.cos(rocker),g.pivot[1]+g.arm*Math.sin(rocker),g.rollerZ],outputY:g.pivot[1]-g.leftLength*Math.sin(rocker),shoeX:g.pivot[0]-g.leftLength*Math.cos(rocker)-g.left[0]};
}
export function makeWaveCamUpdater(root,g){
 const blocks=Object.fromEntries(['cam','rocker','roller','output'].map(name=>[name,root.getObjectByName('body:'+name)]));
 return s=>{
  blocks.cam.rotation.y=s.cam;
  blocks.rocker.position.set(g.pivot[0],g.pivot[1],0);blocks.rocker.rotation.z=s.rocker;
  blocks.roller.position.set(...s.rollerCenter);blocks.roller.rotation.z=s.rocker+s.rollerAngle;
  blocks.output.position.set(g.left[0],s.outputY,0);
  root.updateMatrixWorld(true);root.userData.state=s;
 };
}
