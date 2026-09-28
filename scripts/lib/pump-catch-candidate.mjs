import * as THREE from 'three';
import source from './pump-catch-source.mjs';
import {poly,circle,plate,disk,ring,rotate,polygonClipping as clip} from '../../src/simulation/finite-plate-geometry.js';
import {conformingPlateMesh} from '../../src/simulation/conforming-plate-mesh.js';
import {PALETTE,matte,markShadows} from '../../src/simulation/primitives.js';
export {THREE};

const px=v=>v/source.scale,toWorld=([x,y])=>[px(x-source.center[0]),px(source.center[1]-y)];
const trace=commands=>{const p=new THREE.Path();for(const[c,...v]of commands)p[c](...v);return poly(p.getPoints(32).map(v=>toWorld(v.toArray())));};
const rectangle=r=>poly([[r.left,r.top],[r.right,r.top],[r.right,r.bottom],[r.left,r.bottom]].map(toWorld));
export function makePumpCatchCandidate(){
  const root=new THREE.Group(),parts={},families={},blocks={},profiles={},pivot=toWorld(source.catchPivot);
  for(const family of ['fixed','wheel','cam']){blocks[family]=new THREE.Group();root.add(blocks[family]);}
  blocks.catch=new THREE.Group();blocks.catch.position.set(...pivot,0);blocks.wheel.add(blocks.catch);
  const attach=(name,geometry,family,color,position=[0,0,0])=>{const m=new THREE.Mesh(geometry,matte(color,{metalness:.20,roughness:.58}));
    m.name=name;m.position.fromArray(position);blocks[family].add(m);parts[name]=m;families[name]=family;return m;};
  const bore=px(source.shaftRadius),clearBore=px(source.shaftRadius+1),pinRadius=px(source.catchPinRadius),outer=poly(circle([0,0],px(source.wheelOuter),256));
  const rim=clip.difference(outer,poly(circle([0,0],px(source.wheelInner),256))),upper=trace(source.upperSpoke);
  profiles.wheel=clip.difference(clip.union(rim,poly(circle([0,0],px(94),128)),...Array.from({length:4},(_,i)=>upper.map(rings=>rings.map(r=>r.map(p=>rotate(p,i*Math.PI/2)))))),poly(circle([0,0],clearBore,128)));
  attach('spokedLooseWheelA',conformingPlateMesh(plate(profiles.wheel,-.28,-.13)),'wheel',PALETTE.driven);
  attach('looseWheelHub',ring(clearBore,px(80),-.47,-.28,128),'wheel',PALETTE.driven);
  // B's pivot eye is a true circle concentric with its pin (radius 36 source
  // px, the lower bar's far edge distance). The traced eye bulge and the
  // outer bend corner are replaced: each bar edge runs straight to its foot
  // on the pin's perpendicular, inside the eye, and the eye is unioned on.
  const [cx,cy]=source.catchPivot,foot=(a,b)=>{const d=[b[0]-a[0],b[1]-a[1]],t=((cx-a[0])*d[0]+(cy-a[1])*d[1])/(d[0]**2+d[1]**2);return[a[0]+t*d[0],a[1]+t*d[1]];};
  const catchCommands=source.catch.flatMap(([c,...v])=>{
    const key=c+':'+v.join(',');
    if(key==='lineTo:315,611')return[['lineTo',...foot([145,818],[315,611])],['lineTo',...foot([337,565],[494,394])]];
    if(key==='quadraticCurveTo:306,589,320,578'||key==='lineTo:337,565'||key==='lineTo:373,620')return[];
    if(key==='lineTo:387,578')return[['lineTo',...foot([500,435],[387,578])],['lineTo',...foot([373,620],[169,847])]];
    return[[c,...v]];
  });
  if(catchCommands.length!==source.catch.length-1)throw Error('Pump catch eye trace changed');
  profiles.catch=clip.difference(clip.union(trace(catchCommands),poly(circle(pivot,px(36),192))),poly(circle(pivot,pinRadius+.001,96)));
  const catchGeometry=conformingPlateMesh(plate(profiles.catch,0,.13));catchGeometry.translate(-pivot[0],-pivot[1],0);
  attach('hookedCatchB',catchGeometry,'catch',PALETTE.brass);
  attach('catchPivotPin',disk(pinRadius,-.13,.145,96),'wheel',PALETTE.muted,[...pivot,0]);
  attach('catchPivotHead',disk(pinRadius*1.07,.145,.17,96),'wheel',PALETTE.muted,[...pivot,0]);
  profiles.cam=clip.difference(clip.union(trace(source.cam),poly(circle([0,0],px(65),128))),poly(circle([0,0],bore,128)));
  attach('pointedCamC',conformingPlateMesh(plate(profiles.cam,0,.13)),'cam',PALETTE.driver);
  attach('inputShaft',disk(bore,-.66,.51,128),'cam',PALETTE.muted);
  profiles.standard=clip.difference(trace(source.standard),trace(source.standardOpening),poly(circle([0,0],clearBore,128)));
  attach('frontBearingStandard',conformingPlateMesh(plate(profiles.standard,.21,.43)),'fixed',PALETTE.muted);
  attach('frontBearingLip',ring(clearBore,px(source.bearingRadius),.43,.49,128),'fixed',PALETTE.muted);
  attach('basePlinth',plate(rectangle(source.base),-.65,.60),'fixed',PALETTE.muted);
  // The stop's front face is shown on the beam. Its contact block extends
  // back to the catch layer; the beam itself stays behind the moving catch.
  attach('overheadBeam',plate(rectangle(source.topBeam),-.60,-.18),'fixed',PALETTE.muted);
  attach('overheadPost',plate(rectangle(source.post),-.60,-.18),'fixed',PALETTE.muted);
  attach('fixedTripStop',plate(rectangle(source.stop),-.18,.15),'fixed',PALETTE.muted);
  const setState=({wheelAngle=0,camAngle=0,catchAngle=0}={})=>{
    if(![wheelAngle,camAngle,catchAngle].every(Number.isFinite))throw Error('Nonfinite pump-catch pose');
    blocks.wheel.rotation.z=wheelAngle;blocks.cam.rotation.z=camAngle;blocks.catch.rotation.z=catchAngle;
    root.updateMatrixWorld(true);return root.userData.state={wheelAngle,camAngle,catchAngle};
  };
  root.userData={source,parts,families,blocks,profiles,setState,geometry:{pivot,bore,clearBore,pinRadius},hideGround:true,cameraFov:8,
    shadowCameraHalfExtent:5,shadowBias:-.00003,shadowNormalBias:.002,fidelity:'candidate',mechanism:'finite-hooked-catch-loose-wheel-pump-study',
    qualification:'Initial finite reconstruction of the source wheel, catch, cam, front bearing frame and trip stop. Pose control only. The rope, pump load, rear input belt, hidden pulley and rear bearing remain to be reconstructed. No contact-derived motion or complete mechanical qualification is claimed.'};
  setState();markShadows(root);return{root,setState,update:()=>{},cameraDirection:new THREE.Vector3(0,0,10)};
}
