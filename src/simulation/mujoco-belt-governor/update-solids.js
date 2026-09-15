export function makeBeltGovernorUpdater(root,g,{beltSeamSpacing=2.4}={}){
 const names=['rotor','sleeve','leftUpper','leftLower','rightUpper','rightLower','shoe','bell','rod','fork','belt','loose'];
 const blocks=Object.fromEntries(names.map(name=>[name,root.getObjectByName('body:'+name)])),{rotor,sleeve,shoe,bell,rod,fork,belt}=blocks;
 const initial={lowerAngle:Math.asin((g.sleeveRadius-g.pivotRadius-g.elbowArm*Math.sin(g.initialSpread))/g.lowerLink)};
 const radius=g.pulleyRadius+.026,length=8.96+Math.PI*radius,seams=blocks.belt.children.filter(o=>o.name.startsWith('beltSeam'));
 return state=>{
  rotor.rotation.y=state.spindle;sleeve.position.y=state.sleeveY;
  for(const sign of [-1,1]){const name=sign<0?'left':'right',theta=state[name+'Spread'];blocks[name+'Upper'].rotation.z=sign*theta;blocks[name+'Lower'].position.set(sign*(g.pivotRadius+g.elbowArm*Math.sin(theta)),g.topY-g.elbowArm*Math.cos(theta),0);blocks[name+'Lower'].rotation.z=sign*(initial.lowerAngle+state.qpos[sign<0?2:4]+theta-g.initialSpread);}
  shoe.position.set(state.followerX??0,g.sleeveY+state.qpos[6]-g.grooveDrop,0);bell.rotation.z=state.bellAngle;rod.position.set(g.bellX+g.outputArm*Math.cos(state.bellAngle),g.bellY+g.outputArm*Math.sin(state.bellAngle),0);rod.rotation.z=state.rodAngle;
  fork.position.set(g.bellX+g.outputArm,state.forkY,0);belt.position.y=state.forkY;blocks.loose.rotation.y=state.looseAngle??0;for(let i=0;i<seams.length;i++){const mesh=seams[i],s=i*beltSeamSpacing+((state.beltDistance??0)%beltSeamSpacing+beltSeamSpacing)%beltSeamSpacing;mesh.visible=s<=length;const distance=Math.min(s,length);
   if(distance<4.48){mesh.position.set(4.48-distance,0,radius);mesh.rotation.set(0,0,0);}
   else if(distance<4.48+Math.PI*radius){const a=Math.PI/2+(distance-4.48)/radius;mesh.position.set(radius*Math.cos(a),0,radius*Math.sin(a));mesh.rotation.set(0,Math.PI/2-a,0);}
   else{mesh.position.set(distance-4.48-Math.PI*radius,0,-radius);mesh.rotation.set(0,Math.PI,0);}
  }root.updateMatrixWorld(true);
 };
}
