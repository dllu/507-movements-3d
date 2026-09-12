import * as THREE from 'three';
import {makePumpCatchCandidate} from './pump-catch-candidate.mjs';
import {poly,circle,capsule,plate,disk,ring,turned,polygonClipping as clip} from '../../src/simulation/finite-plate-geometry.js';
import {conformingPlateMesh} from '../../src/simulation/conforming-plate-mesh.js';
import {PALETTE,matte,markShadows} from '../../src/simulation/primitives.js';
export {THREE};

// The two hatched horizontal source runs are interpreted as a separate input
// band behind the loose wheel. The second pulley, rear bearings and return
// path are omitted in the engraving; their completion is explicit here.
export function makePumpCatchRearDriveCandidate(){
  const model=makePumpCatchCandidate(),u=model.root.userData,source=u.source,corePartNames=Object.keys(u.parts),scale=source.scale,
    radius=((source.rearRuns.lower[0]+source.rearRuns.lower[1])-(source.rearRuns.upper[0]+source.rearRuns.upper[1]))/(4*scale),
    halfWidth=((source.rearRuns.upper[1]-source.rearRuns.upper[0])+(source.rearRuns.lower[1]-source.rearRuns.lower[0]))/(4*scale),
    contactRadius=radius-halfWidth,segments=1024,innerRadius=contactRadius/Math.cos(Math.PI/segments),outerRadius=innerRadius+2*halfWidth,
    separation=4.3,low=-.95,high=-.72,bore=u.geometry.bore,clearBore=u.geometry.clearBore,webRadius=contactRadius-.13,
    bandLength=2*separation+2*Math.PI*radius,remote=new THREE.Group();
  remote.position.x=separation;model.root.add(remote);u.blocks.remoteInput=remote;
  const attach=(name,geometry,family,color,group=u.blocks[family],position=[0,0,0])=>{
    const mesh=new THREE.Mesh(geometry,matte(color,{metalness:.22,roughness:.58}));mesh.name=name;mesh.position.fromArray(position);group.add(mesh);u.parts[name]=mesh;u.families[name]=family;return mesh;
  };
  const flangeRadius=outerRadius+.025,rimProfile=[[low-.05,webRadius-.002],[low-.05,flangeRadius],[low,flangeRadius],[low,contactRadius],
    [high,contactRadius],[high,flangeRadius],[high+.05,flangeRadius],[high+.05,webRadius-.002]],
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
  // Circumscribe the inner belt polygon around the analytic pulley cylinder.
  // Both rotating pulley meshes stay inside that cylinder at every angle.
  const bandProfile=clip.difference(capsule([0,0],[separation,0],outerRadius,segments/2),capsule([0,0],[separation,0],innerRadius,segments/2)),
    bandGeometry=conformingPlateMesh(plate(bandProfile,low,high)),band=attach('inputDriveBand',bandGeometry,'band',0xffffff,model.root),
    uv=[];
  const distanceAt=(x,y)=>{
    if(x<0){let angle=Math.atan2(y,x);if(angle> -Math.PI/2)angle-=2*Math.PI;return 2*separation+Math.PI*radius+radius*(-Math.PI/2-angle);}
    if(x>separation)return separation+radius*(Math.PI/2-Math.atan2(y,x-separation));
    return y>=0?x:2*separation+Math.PI*radius-x;
  };
  // A material pattern conveys belt motion without extra collars intersecting
  // the band. UVs retain the physical distance around the complete loop.
  const flat=bandGeometry.index?bandGeometry.toNonIndexed():bandGeometry;
  if(flat!==bandGeometry){band.geometry=flat;bandGeometry.dispose();}
  const p=flat.attributes.position;
  for(let i=0;i<p.count;i+=3){
    const points=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,i+k)),normal=new THREE.Triangle(...points).getNormal(new THREE.Vector3()),front=Math.abs(normal.z)>.5,
      row=points.map(v=>{const r=Math.hypot(v.x<0?v.x:v.x>separation?v.x-separation:0,v.y);return[distanceAt(v.x,v.y)/bandLength,front?(r-innerRadius)/(outerRadius-innerRadius):(v.z-low)/(high-low)];});
    if(Math.max(...row.map(v=>v[0]))-Math.min(...row.map(v=>v[0]))>.5)for(const v of row)if(v[0]<.5)v[0]+=1;
    for(const v of row)uv.push(...v);
  }
  flat.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  const pixels=new Uint8Array(128*32*4);for(let y=0;y<32;y++)for(let x=0;x<128;x++){
    const stripe=((x+2*y)%128)<14,c=stripe?[75,69,55]:[155,143,111],i=(y*128+x)*4;pixels.set([...c,255],i);
  }
  const texture=new THREE.DataTexture(pixels,128,32,THREE.RGBAFormat);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=THREE.RepeatWrapping;texture.wrapT=THREE.RepeatWrapping;texture.repeat.x=32;texture.needsUpdate=true;
  band.material.map=texture;band.material.roughness=.85;band.material.metalness=0;
  const coreSetState=model.setState,setState=state=>{
    const result=coreSetState(state);remote.rotation.z=result.camAngle;texture.offset.x=result.camAngle*radius/bandLength*texture.repeat.x;model.root.updateMatrixWorld(true);return result;
  };
  model.setState=setState;u.setState=setState;u.rearDrive={corePartNames,radius,halfWidth,contactRadius,innerRadius,outerRadius,separation,low,high,bandLength,segments,
    maximumRadialRenderingGap:innerRadius-contactRadius*Math.cos(Math.PI/segments),
    qualification:'A complete equal-pulley input band and rear supports reconstruct the omitted drive. Radius and band width follow the visible horizontal runs; spacing, section, hidden spokes and depths are assumptions. Ideal no-slip motion is imposed at the neutral band radius; finite traction and belt stresses are not solved. Wheel/catch geometry and mass are unchanged.'};
  u.qualification='Core plus reconstructed rear input apparatus. Pump rope, load hardware, capture dynamics and complete mechanical qualification remain pending.';
  u.shadowCameraHalfExtent=8;setState();markShadows(model.root);return model;
}
