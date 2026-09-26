import * as THREE from 'three';
import source from './source.js';
import {makeScrewPressProfile} from './profile.js';
import {threadAngles,helicalThread,polygonCylinder} from '../mujoco-screw/thread-geometry.js';
import {plate,poly,circle,turned,disk,ring,polygonClipping as clip} from '../finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
import {makeScrewPressSection} from './section.js';
export {THREE};
const rectangle=(l,b,r,t)=>poly([[l,b],[r,b],[r,t],[l,t]]);
const cubic=(a,b,c,d,count=32)=>Array.from({length:count+1},(_,i)=>{const t=i/count;return a.map((v,k)=>(1-t)**3*v+3*(1-t)**2*t*b[k]+3*(1-t)*t*t*c[k]+t**3*d[k]);});
const alongY=g=>g.rotateX(-Math.PI/2);
const alongX=g=>g.applyMatrix4(new THREE.Matrix4().set(0,0,1,0,1,0,0,0,0,1,0,0,0,0,0,1));

export function makeScrewPressGeometry(options={}) {
  const f=makeScrewPressProfile(options),e=source.edges,root=new THREE.Group(),parts={},families={},blocks={};
  const add=(name,g,family,color)=>{
    if(!blocks[family]){blocks[family]=new THREE.Group();root.add(blocks[family]);}
    const mesh=new THREE.Mesh(g,matte(color,{metalness:.15,roughness:.6}));mesh.name=name;parts[name]=mesh;families[name]=family;blocks[family].add(mesh);return mesh;
  };
  const screwAngles=threadAngles(f.external,f.segments),nutAngles=threadAngles(f.internal,f.segments);
  add('screwCore',alongY(polygonCylinder(f.coreRadius,f.external.low,f.external.high,screwAngles)),'screw',PALETTE.driver);
  add('externalThread',alongY(helicalThread(f.external,screwAngles)),'screw',PALETTE.driver);
  const head=clip.difference(rectangle(f.y(e.hubBottom),-f.hubDepth,f.y(e.hubTop),f.hubDepth),poly(circle([f.barY,0],f.barRadius+.001,128)));
  add('head',alongX(plate(head,-f.hubHalf,f.hubHalf)),'screw',PALETTE.driver);
  const tip=Array.from({length:33},(_,i)=>{const a=Math.PI*i/64;return[f.y(e.hubTop)+.13*Math.sin(a),.10*Math.cos(a)];});
  add('headCap',alongY(turned([[f.y(e.hubTop),0],...tip],128)),'screw',PALETTE.driver);
  add('handle',disk(f.barRadius,f.x(source.barEnds[0]),f.x(source.barEnds[1]),128).rotateY(Math.PI/2).translate(0,f.barY,0),'screw',PALETTE.driver);
  for(const [name,w] of Object.entries(source.weights)) {
    const [rx,r]=w.radii.map(x=>x/100),cx=f.x(w.center[0]),bore=f.barRadius+.001,extent=Math.sqrt(1-(bore/r)**2),profile=[];
    for(let i=0;i<=64;i++){const t=extent*(2*i/64-1);profile.push([cx+rx*t,r*Math.sqrt(Math.max(0,1-t*t))]);}
    add(name+'Weight',turned(profile,128).rotateY(Math.PI/2).translate(0,f.barY,0),'screw',PALETTE.driver);
  }
  add('neck',alongY(disk(f.bearing.neck,f.bearing.top,f.external.low,128)),'screw',PALETTE.driver);
  add('thrustPin',alongY(disk(f.bearing.radius,f.bearing.bottom,f.bearing.top,128)),'screw',PALETTE.driver);
  const capBore=f.bearing.neck+.003;
  add('ramCap',alongY(ring(capBore,f.ramRadius,f.capBottom,f.ramTop,192)),'ram',PALETTE.driven);
  const ramProfile=[[f.ramBottom,0],[f.ramBottom,f.ramRadius],[f.capBottom,f.ramRadius],
    [f.capBottom,f.bearing.radius+.003],[f.bearing.floor,f.bearing.radius+.003],[f.bearing.floor,0]];
  add('ram',alongY(turned(ramProfile,192)),'ram',PALETTE.driven);
  const keyShape=rectangle(-.03,f.ramBottom+.05,.03,f.ramTop-.03);
  add('key',plate(keyShape,-f.ramRadius-.04,-f.ramRadius+.008),'ram',PALETTE.driven);
  const bore=clip.union(poly(circle([0,0],f.ramRadius+.003,192)),rectangle(-.033,0,.033,f.ramRadius+.043));
  const guide=clip.difference(rectangle(f.x(e.guideLeft),-f.guideDepth,f.x(e.guideRight),f.guideDepth),bore);
  // A vertical extrusion maps profile coordinates (x, -z) into world (x, z).
  add('guide',alongY(plate(guide,f.y(e.guideBottom),f.y(e.guideTop))),'frame',PALETTE.frame);
  const housingProfile=[[f.y(e.nutBottom),f.internal.outer],[f.y(e.nutBottom),f.flangeRadius],
    [f.y(e.lowerFlangeTop),f.flangeRadius],[f.y(e.lowerFlangeTop),f.nutRadius],
    [f.y(e.upperFlangeBottom),f.nutRadius],[f.y(e.upperFlangeBottom),f.flangeRadius],
    [f.y(e.nutTop),f.flangeRadius],[f.y(e.nutTop),f.internal.outer]];
  add('nutHousing',alongY(turned(housingProfile,f.segments)),'frame',PALETTE.frame);
  add('internalThread',alongY(helicalThread(f.internal,nutAngles)),'frame',PALETTE.frame);
  const left=f.axis[0]+100*(f.internal.outer+.018),outerX=e.frameOuter,innerX=e.frameInner;
  const outer=[...cubic([left,e.nutTop],[299,e.nutTop],[outerX,221],[outerX,280]),[outerX,f.axis[1]-100*(f.baseBottom+.10)],
    ...cubic([outerX,f.axis[1]-100*(f.baseBottom+.10)],[outerX,f.axis[1]-100*f.baseBottom],[315,f.axis[1]-100*f.baseBottom],[280,f.axis[1]-100*f.baseBottom]).slice(1)];
  const baseTop=f.anvilBottom,baseLeft=f.axis[0]-44;
  const contour=[...outer,[baseLeft,f.axis[1]-100*f.baseBottom],[baseLeft,f.axis[1]-100*baseTop],
    [innerX-.20*100,f.axis[1]-100*baseTop],
    ...cubic([innerX-20,f.axis[1]-100*baseTop],[innerX,f.axis[1]-100*baseTop],[innerX,470],[innerX,435]).slice(1),
    [innerX,326],...cubic([innerX,326],[innerX,298],[278,e.nutBottom],[left,e.nutBottom]).slice(1)].map(f.world);
  // Brown breaks the frame off below the ram guide (a drawing convention);
  // the frame is modelled whole with its lower jaw, anvil and blank, and the
  // default view runs on down to the foot of the jaw so the struck blank shows.
  const presentedContour=contour;
  add('frame',plate(poly(presentedContour),-f.frameDepth,f.frameDepth),'frame',PALETTE.frame);
  add('anvil',alongY(disk(.35,f.anvilBottom,f.workBottom,192)),'frame',PALETTE.frame);
  add('blank',alongY(disk(f.blankRadius,f.workBottom,f.workTop,192)),'frame',PALETTE.accent);
  Object.assign(root.userData,{source,profile:f,parts,families,blocks,screwAngles,nutAngles,frameContour:contour,presentedFrameContour:presentedContour,
    hideGround:true,shadowCameraHalfExtent:3,shadowBias:-.00002,shadowNormalBias:.001});
  const section=makeScrewPressSection(root,parts,blocks,f,housingProfile,ramProfile);
  Object.assign(root.userData,{section,setSectionView:section.set,localClippingEnabled:true});
  markShadows(root);root.updateMatrixWorld(true);
  for(const cap of section.caps)cap.castShadow=false;
  return {root,focus:new THREE.Vector3(.15,-.5,0),cameraDirection:new THREE.Vector3(1,1.5,10)};
}
