import * as THREE from 'three';
import {makePumpCatchCoreGeometry} from './pump-catch-core.js';
import {poly,circle,capsule,plate,disk,ring,turned,polygonClipping as clip} from './finite-plate-geometry.js';
import {conformingPlateMesh} from './conforming-plate-mesh.js';
import {PALETTE,matte,markShadows} from './primitives.js';
import {makeLaidRopeMesh} from './laid-rope.js';
export {THREE};

// The two hatched horizontal source runs are Brown's laid rope: an endless
// rope drive behind the loose wheel, in the grooves of a sheave on the cam
// shaft and of a second sheave beyond the plate's right edge. The second
// sheave, rear bearings and return path are omitted in the engraving; their
// completion is explicit here.
export function makePumpCatchRearDriveGeometry({model=makePumpCatchCoreGeometry()}={}){
  const u=model.root.userData,source=u.source,corePartNames=Object.keys(u.parts),scale=source.scale,
    radius=((source.rearRuns.lower[0]+source.rearRuns.lower[1])-(source.rearRuns.upper[0]+source.rearRuns.upper[1]))/(4*scale),
    halfWidth=((source.rearRuns.upper[1]-source.rearRuns.upper[0])+(source.rearRuns.lower[1]-source.rearRuns.lower[0]))/(4*scale),
    contactRadius=radius-halfWidth,segments=1024,innerRadius=contactRadius/Math.cos(Math.PI/segments),outerRadius=innerRadius+2*halfWidth,
    separation=4.3,low=-.95,high=-.72,bore=u.geometry.bore,clearBore=u.geometry.clearBore,webRadius=contactRadius-.13,
    bandLength=2*separation+2*Math.PI*radius,remote=new THREE.Group();
  remote.position.x=separation;model.root.add(remote);u.blocks.remoteInput=remote;
  const attach=(name,geometry,family,color,group=u.blocks[family],position=[0,0,0])=>{
    const mesh=new THREE.Mesh(geometry,matte(color,{metalness:.22,roughness:.58}));mesh.name=name;mesh.position.fromArray(position);group.add(mesh);u.parts[name]=mesh;u.families[name]=family;return mesh;
  };
  // Grooved sheave rims: a round-bottomed groove whose bottom carries the
  // rope (radius halfWidth) on the neutral radius, with flared cheeks.
  const ropeRadius=halfWidth,middle=(low+high)/2,grooveRadius=ropeRadius*1.04,flangeRadius=outerRadius+.025,
    groove=Array.from({length:17},(_,k)=>{const a=Math.PI*(k/16);return[middle-grooveRadius*Math.cos(a),radius-grooveRadius*Math.sin(a)];}),
    rimProfile=[[low-.05,webRadius-.002],[low-.05,flangeRadius],[middle-grooveRadius-.06,flangeRadius],[middle-grooveRadius,radius+.01],
      ...groove,[middle+grooveRadius,radius+.01],[middle+grooveRadius+.06,flangeRadius],[high+.05,flangeRadius],[high+.05,webRadius-.002]],
    web=clip.intersection(u.profiles.wheel,poly(circle([0,0],webRadius,512)));
  for(const[prefix,family,group]of [['rearDrive','cam',u.blocks.cam],['remoteDrive','remoteInput',remote]]){
    attach(prefix+'Rim',turned(rimProfile,segments),family,PALETTE.driver,group);
    attach(prefix+'Web',conformingPlateMesh(plate(web,-.85,-.81)),family,PALETTE.driver,group);
    attach(prefix+'Hub',ring(bore,.30,-1.04,-.63,128),family,PALETTE.driver,group);
  }
  attach('rearShaftExtension',disk(bore,-1.43,-.66,128),'cam',PALETTE.muted);
  attach('remoteInputShaft',disk(bore,-1.43,-.60,128),'remoteInput',PALETTE.muted,remote);
  attach('rearBearingStandard',conformingPlateMesh(plate(u.profiles.standard,-1.28,-1.08)),'fixed',PALETTE.muted);
  attach('rearBearingLip',ring(clearBore,.235,-1.08,-1.04,128),'fixed',PALETTE.muted);
  const floor=(source.center[1]-source.base.top)/scale,bottom=(source.center[1]-source.base.bottom)/scale,
    remoteStandard=clip.difference(poly([[-.7,floor],[.7,floor],[.7,floor+.13],[.24,-.23],[.24,.19],[-.24,.19],[-.24,-.23],[-.7,floor+.13]]),
      poly([[-.43,floor+.16],[.43,floor+.16],[0,-.50]]),poly(circle([0,0],clearBore,128)));
  attach('remoteBearingStandard',conformingPlateMesh(plate(remoteStandard,-1.28,-1.08)),'fixed',PALETTE.muted,u.blocks.fixed,[separation,0,0]);
  attach('remoteBearingLip',ring(clearBore,.235,-1.08,-1.04,128),'fixed',PALETTE.muted,u.blocks.fixed,[separation,0,0]);
  const baseLeft=(source.base.left-source.center[0])/scale,baseRight=(source.base.right-source.center[0])/scale;
  attach('rearBaseExtension',plate(poly([[baseLeft,bottom],[baseRight,bottom],[baseRight,floor],[baseLeft,floor]]),-1.43,-.65),'fixed',PALETTE.muted);
  attach('remoteBase',plate(poly([[separation-.8,bottom],[separation+.8,bottom],[separation+.8,floor],[separation-.8,floor]]),-1.43,-.60),'fixed',PALETTE.muted);
  // The endless laid rope on the neutral radius, round both sheaves: along
  // the top from A's sheave to the remote one, round it, back along the
  // bottom and round A's sheave (clockwise seen from the front).
  const loop=new THREE.CurvePath(),at=(x,y)=>new THREE.Vector3(x,y,middle),arc=(cx,from,to)=>{
    const curve=new THREE.Curve();curve.getPoint=t=>{const angle=from+(to-from)*t;return at(cx+radius*Math.cos(angle),radius*Math.sin(angle));};return curve;};
  loop.add(new THREE.LineCurve3(at(0,radius),at(separation,radius)));
  loop.add(arc(separation,Math.PI/2,-Math.PI/2));
  loop.add(new THREE.LineCurve3(at(separation,-radius),at(0,-radius)));
  loop.add(arc(0,-Math.PI/2,-3*Math.PI/2));
  const band=makeLaidRopeMesh(loop,matte(0xb08d57,{roughness:.86,metalness:0}),{radius:ropeRadius,closed:true,tubularSegments:1024});
  band.name='inputDriveRope';model.root.add(band);u.parts[band.name]=band;u.families[band.name]='band';
  const coreSetState=model.setState,setState=state=>{
    const result=coreSetState(state);remote.rotation.z=result.camAngle;
    // The sheaves turn anticlockwise for a positive angle, carrying the rope
    // against the loop's clockwise parameter.
    band.userData.setTravel(-result.camAngle*radius);model.root.updateMatrixWorld(true);return result;
  };
  model.setState=setState;u.setState=setState;u.rearDrive={corePartNames,radius,halfWidth,ropeRadius,contactRadius,innerRadius,outerRadius,separation,low,high,bandLength,segments,
    maximumRadialRenderingGap:innerRadius-contactRadius*Math.cos(Math.PI/segments),
    qualification:'A complete endless laid-rope drive on two equal grooved sheaves and rear supports reconstruct the omitted drive. Sheave radius and rope diameter follow Brown\'s two hatched horizontal runs; spacing, groove section, hidden spokes and depths are assumptions. Ideal no-slip motion is imposed at the rope\'s centre radius; finite traction and rope stresses are not solved. Wheel/catch geometry and mass are unchanged.'};
  u.qualification='Core plus reconstructed rear input apparatus. Pump rope, load hardware, capture dynamics and complete mechanical qualification remain pending.';
  u.shadowCameraHalfExtent=8;setState();markShadows(model.root);return model;
}
