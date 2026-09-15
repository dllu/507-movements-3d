import * as THREE from 'three';
import {plate,poly,circle,capsule,ring,disk,polygonClipping as clip} from './finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from './primitives.js';
import {disposeObject3D} from './dispose-model.js';
import {sourceTreadleDimensions as source,sourceTreadleParameters,sourceTreadleState} from './source-treadle-motion.js';
export function makeSourceTreadle(){
 const root=new THREE.Group(),g=sourceTreadleParameters(),blocks={},parts={},families={},materials=new Map();
 for(const name of ['disk','treadle','rod','fixed']){blocks[name]=new THREE.Group();root.add(blocks[name]);}
 const add=(name,geometry,family,color)=>{if(!materials.has(color)){const m=matte(color,{metalness:.15,roughness:.6});m.fog=false;materials.set(color,m);}const mesh=new THREE.Mesh(geometry,materials.get(color));mesh.name=name;blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;};
 const place=(name,geometry,family,point,color)=>{const mesh=add(name,geometry,family,color);mesh.position.set(...point,0);return mesh;};
 const rectangle=(x0,x1,y0,y1)=>poly([[x0,y0],[x1,y0],[x1,y1],[x0,y1]]);
 const pixel=p=>[(p[0]-source.diskCenter[0])*source.scale,(source.diskCenter[1]-p[1])*source.scale];
 const imagePoly=points=>poly(points.map(pixel));
 add('disk',ring(.184,source.diskRadius*source.scale,-.30,0,128),'disk',PALETTE.driver);
 add('diskHub',ring(.184,.238,0,.12,128),'disk',PALETTE.ink);
 place('crankPin',disk(.125,0,.88,128),'disk',g.pin,PALETTE.brass);
 place('crankRetainer',ring(.125,.165,.824,.88,128),'disk',g.pin,PALETTE.ink);
 place('crankFace',disk(.095,.88,.90,128),'disk',g.pin,PALETTE.white);
 const treadleShape=clip.difference(clip.union(rectangle(0,g.footLength,-.084,.084),poly(circle([0,0],.168,128)),poly(circle([g.armLength,0],.182,128))),poly(circle([0,0],.144,128)));
 add('treadle',plate(treadleShape,.30,.52),'treadle',PALETTE.driven);
 place('treadlePin',disk(.125,.52,.88,128),'treadle',[g.armLength,0],PALETTE.ink);
 place('treadleRetainer',ring(.125,.165,.824,.88,128),'treadle',[g.armLength,0],PALETTE.ink);
 const rodShape=clip.difference(clip.union(capsule([0,0],[g.rodLength,0],.05,64),poly(circle([0,0],.182,128)),poly(circle([g.rodLength,0],.182,128))),poly(circle([0,0],.129,128)),poly(circle([g.rodLength,0],.129,128)));
 add('connectingRod',plate(rodShape,.66,.82),'rod',PALETTE.brass);
 // The engraving's tapered pedestal is behind the disk, with a curved foot.
 const stand=new THREE.Shape();stand.moveTo(192,448);stand.bezierCurveTo(225,446,233,424,237,381);stand.lineTo(247,240);
 for(let i=1;i<=64;i++){const a=Math.PI*(1-i/64);stand.lineTo(281+34*Math.cos(a),240-34*Math.sin(a));}
 stand.lineTo(327,381);stand.bezierCurveTo(331,431,343,447,360,448);stand.closePath();
 add('diskStand',plate(clip.difference(imagePoly(stand.getPoints(64).map(p=>[p.x,p.y])),poly(circle([0,0],.184,128))),-.88,-.56),'fixed',PALETTE.frame);
 add('diskAxle',disk(.18,-.88,.18,128),'fixed',PALETTE.ink);
 const pedestal=clip.union(poly(circle(g.pivot,27*source.scale,128)),imagePoly([[421,418],[449,418],[449,460],[421,460]]),imagePoly([[394,418],[421,448],[379,448]]),imagePoly([[192,448],[449,448],[449,460],[192,460]]));
 const boredPedestal=clip.difference(pedestal,poly(circle(g.pivot,.144,128)));
 add('treadleFrontBearing',plate(boredPedestal,.56,.76),'fixed',PALETTE.frame);
 add('treadleRearBearing',plate(boredPedestal,-.88,-.56),'fixed',PALETTE.frame);
 add('base',plate(imagePoly([[192,448],[449,448],[449,460],[192,460]]),-.56,.56),'fixed',PALETTE.frame);
 place('treadleAxle',disk(.14,-.88,.84,128),'fixed',g.pivot,PALETTE.ink);
 place('pivotRetainer',ring(.14,.185,.764,.82,128),'fixed',g.pivot,PALETTE.ink);
 let disposed=false;
 const update=time=>{if(disposed)throw new Error('Movement has been disposed');const s=sourceTreadleState(time,g);blocks.disk.rotation.z=s.diskAngle;blocks.treadle.position.set(...g.pivot,0);blocks.treadle.rotation.z=s.treadleAngle;blocks.rod.position.set(...s.pin,0);blocks.rod.rotation.z=s.rodAngle;root.userData.state=s;root.updateMatrixWorld(true);};
 Object.assign(root.userData,{blocks,parts,families,geometry:g,source,hideGround:true,cameraFov:6,supportsRestart:true,mechanism:'source-treadle-crank-rocker',fidelity:'authored',reconstructionStatus:'reconstructed',reconstructionNote:'The pinned rod links the rocking treadle to the rotating disk. Joint positions and pedestal follow the engraving. Ideal linked motion is shown at a steady disk speed; foot force and flywheel dynamics are not simulated. Bearings and depth separation are reconstructed.',animationTiming:{authoredCyclePeriod:g.period,displayCycleDuration:g.period,playbackTimeScale:1}});
 markShadows(root);const bounds=new THREE.Box3();for(let i=0;i<=256;i++){update(g.period*i/256);bounds.union(new THREE.Box3().setFromObject(root,true));}bounds.expandByScalar(.03);root.userData.cameraFitBounds=bounds;root.userData.shadowCameraHalfExtent=7;update(0);
 return{root,focus:bounds.getCenter(new THREE.Vector3()),cameraDirection:new THREE.Vector3(.02,.03,15),update,reset:()=>update(0),dispose:()=>{if(disposed)return;disposed=true;disposeObject3D(root);}};
}
