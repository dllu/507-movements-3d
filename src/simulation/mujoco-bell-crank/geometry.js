import * as THREE from 'three';
import source from './source.js';
import {bellCrankCordPath} from './cord-path.js';
import {bowDrillTube} from '../mujoco-bow-drill/geometry.js';
import {plate,poly,circle,ring,disk,polygonClipping as clip} from '../finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
export {THREE};

export function makeBellCrankGeometry({amplitude=.5,cordSegments=64,outputSegments=12,cordRadius=source.cord.radiusPixels/100}={}){
 if(!Number.isFinite(amplitude)||amplitude<0||!Number.isFinite(cordRadius)||cordRadius<=0||![cordSegments,outputSegments].every(n=>Number.isInteger(n)&&n>=8))throw new RangeError('Invalid 126 geometry options');
 const root=new THREE.Group(),blocks={},parts={},families={};
 const local=([x,y],z=0)=>[(x-source.axis[0])/100,(source.axis[1]-y)/100,z];
 const centers={pulley:local(source.circles.pulleyRim.center),bell:[0,0,0],fixed:[0,0,0],cord:[0,0,0]};
 for(const[n,p]of Object.entries(centers)){blocks[n]=new THREE.Group();blocks[n].position.fromArray(p);root.add(blocks[n]);}
 const add=(name,g,family,color)=>{const mesh=new THREE.Mesh(g,matte(color,{metalness:.1,roughness:.6}));mesh.name=name;blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;};
 const xy=p=>local(p).slice(0,2),translated=(g,p)=>g.translate(...p);
 const outlines=[];
 for(const a of Object.values(source.arms)){
  const side=(name,t)=>{const offset=a.contours[name].coefficients.reduce((s,c,i)=>s+c*t**i,0);return a.from.map((v,i)=>v+t*(a.to[i]-v)+offset*a.normal[i]);};
  outlines.push(poly([...Array.from({length:129},(_,i)=>side('left',i/128)),...Array.from({length:129},(_,i)=>side('right',1-i/128))].map(xy)));
 }
 const eyes=['input','pivot','output'];
 const silhouette=clip.union(...outlines,...eyes.map(n=>poly(circle(xy(source.circles[n+'Eye'].center),source.circles[n+'Eye'].radius/100,192))));
 const bores=eyes.map(n=>poly(circle(xy(source.circles[n+'Pin'].center),source.circles[n+'Pin'].radius/100+(n==='pivot'?.0015:0),128)));
 add('lever',plate(clip.difference(silhouette,...bores),.18,.30),'bell',PALETTE.brass);
 const pivot=xy(source.circles.pivotPin.center),inset=xy(source.circles.pivotInset.center);
 add('pivotBoss',plate(clip.difference(poly(circle(xy(source.circles.pivotEye.center),source.circles.pivotEye.radius/100,192)),poly(circle(inset,source.circles.pivotInset.radius/100,128))),.30,.35),'bell',PALETTE.brass);
 for(const n of ['input','output'])add(n+'Eye',plate(clip.difference(poly(circle(xy(source.circles[n+'Eye'].center),source.circles[n+'Eye'].radius/100,192)),poly(circle(xy(source.circles[n+'Pin'].center),source.circles[n+'Pin'].radius/100,128))),.30,.35),'bell',PALETTE.brass);
 for(const n of ['input','output'])add(n+'Pin',translated(disk(source.circles[n+'Pin'].radius/100,-.09,n==='output'?.56:.37,128),local(source.circles[n+'Pin'].center)), 'bell',PALETTE.ink);
 add('pivotPin',translated(disk(source.circles.pivotPin.radius/100,-.18,.37,128),[...pivot,0]),'fixed',PALETTE.ink);
 const outer=source.circles.pulleyRim.radius/100,insetRadius=source.circles.pulleyInset.radius/100,shaft=source.circles.pulleyShaft.radius/100,hub=source.circles.pulleyHub.radius/100;
 const pitchRadius=source.cord.pitchRadiusPixels/100,drumRadius=pitchRadius-cordRadius;
 if(drumRadius<=shaft||cordRadius>=.095)throw new RangeError('126 rope does not fit its groove');
 add('drum',ring(shaft+.0015,drumRadius,-.10,.10,256),'pulley',PALETTE.driven);
 add('backFlange',ring(shaft+.0015,outer,-.14,-.10,256),'pulley',PALETTE.driven);
 add('frontFlange',ring(insetRadius,outer,.10,.14,256),'pulley',PALETTE.driven);
 add('frontFace',ring(shaft+.0015,insetRadius,.10,.125,256),'pulley',PALETTE.driven);
 add('pulleyHub',ring(shaft+.0015,hub,.125,.17,192),'pulley',PALETTE.driven);
 add('pulleyShaft',translated(disk(shaft,-.24,.19,128),centers.pulley),'fixed',PALETTE.ink);
 const inputPin=local(source.circles.inputPin.center),outputPin=local(source.circles.outputPin.center,.47),inputEnd=local(source.cord.inputEnd),outputEnd=local(source.cord.outputEnd,.47);
 const preliminary=bellCrankCordPath(inputEnd,inputPin,centers.pulley,pitchRadius,cordSegments);
 // Lift the chordal discretization by its worst circular sagitta, plus 0.02 px.
 const sectionLength=preliminary.length/cordSegments,initialLift=sectionLength**2/(8*pitchRadius)+.0002;
 const inputPath=bellCrankCordPath(inputEnd,inputPin,centers.pulley,pitchRadius+initialLift,cordSegments);
 const outputPoints=Array.from({length:outputSegments+1},(_,i)=>outputPin.map((v,k)=>v+i/outputSegments*(outputEnd[k]-v)));
 add('inputCord',bowDrillTube(inputPath.points,inputPath.points.map(()=>cordRadius)),'cord',PALETTE.driver);
 add('outputCord',bowDrillTube(outputPoints,outputPoints.map(()=>cordRadius)),'cord',PALETTE.driven);
 const outputDirection=new THREE.Vector3(...outputEnd).sub(new THREE.Vector3(...outputPin)).normalize().toArray();
 const profile={amplitude,cordSegments,outputSegments,cordRadius,pitchRadius,drumRadius,initialLift,centers,inputPin,outputPin,inputEnd,outputEnd,inputPath,outputPoints,outputDirection};
 const setSectionView=enabled=>{root.userData.sectionView=Boolean(enabled);for(const n of ['frontFlange','frontFace','pulleyHub'])parts[n].visible=!enabled;};
 const bounds=new THREE.Box3(new THREE.Vector3(-3.5,-2.1,-.4),new THREE.Vector3(2,3.05,.7));
 Object.assign(root.userData,{source,profile,blocks,parts,families,hideGround:true,setSectionView,cameraFitBounds:bounds,sampledMotionBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},shadowCameraHalfExtent:5,shadowBias:-.00002,shadowNormalBias:.001});
 setSectionView(false);markShadows(root);root.updateMatrixWorld(true);
 return{root,focus:bounds.getCenter(new THREE.Vector3()),cameraDirection:new THREE.Vector3(1,1,10)};
}
