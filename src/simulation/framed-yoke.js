import * as THREE from 'three';
import {plate,poly,circle,capsule,polygonClipping as clip} from './finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from './primitives.js';
import {disposeObject3D} from './dispose-model.js';

export const framedYokeDimensions = {
  scale:2.35/119, diskRadius:2.35, period:7,
  sourceCenter:[267,307], sourceWrist:[259,214],
  // Stems end where Brown breaks them off (raster rows 50 and 485); their
  // guides lie beyond the plate and are not drawn.
  upperStem:[40*2.35/119,(214-50)*2.35/119], lowerStem:[(214-485)*2.35/119,-118*2.35/119],
  stemHalfWidth:12*2.35/119,
};
const g=framedYokeDimensions;
g.crankRadius=Math.hypot(8,93)*g.scale;
g.sourcePhase=Math.atan2(93,-8);
g.wristRadius=11*g.scale;
export function framedYokeAtTime(time){
  const angle=g.sourcePhase-2*Math.PI*time/g.period;
  return {angle,x:g.crankRadius*Math.cos(angle),y:g.crankRadius*Math.sin(angle)};
}
const rect=(a,b,c,d)=>poly([[a,b],[c,b],[c,d],[a,d]]);
const disk=r=>poly(circle([0,0],r,128));

export function makeFramedYoke(){
  const root=new THREE.Group(),parts={},blocks={};
  for(const name of ['fixed','input','yoke']){blocks[name]=new THREE.Group();blocks[name].name=name;root.add(blocks[name]);}
  const materials=Object.fromEntries(['frame','driver','driven','ink','brass'].map(name=>{
    const m=matte(PALETTE[name],{roughness:.65,metalness:.12});m.fog=false;return[name,m];
  }));
  const add=(name,geometry,body,color)=>{const m=new THREE.Mesh(geometry,materials[color]);m.name=name;blocks[body].add(m);parts[name]=m;return m;};
  const xy=(name,shape,low,high,body,color)=>add(name,plate(shape,low,high),body,color);
  xy('driver-disk',disk(g.diskRadius),.05,.47,'input','driver');
  xy('front-supported-shaft',disk(.43),.06,.90,'input','ink');
  xy('stationary-front-bearing',clip.difference(disk(.81),disk(.433)),.49,.86,'fixed','frame');
  const wrist=xy('back-reaching-wrist',disk(g.wristRadius),-.50,.51,'input','brass');wrist.position.x=g.crankRadius;

  // Trace the broad frame in the engraving, relative to its source wrist.
  const trace=commands=>{
    const path=new THREE.Shape(),p=(x,y)=>[(x-267)*g.scale,(214-y)*g.scale];
    for(const [op,...v]of commands){
      if(op==='M')path.moveTo(...p(...v));
      else if(op==='L')path.lineTo(...p(...v));
      else path.quadraticCurveTo(...p(v[0],v[1]),...p(v[2],v[3]));
    }
    return poly(path.getPoints(24).map(v=>v.toArray()));
  };
  const outer=trace([['M',154,174],['L',395,174],['Q',440,174,440,247],['Q',440,321,405,332],['L',153,332],['Q',113,321,113,245],['Q',113,180,154,174]]);
  const inner=trace([['M',171,204],['L',388,204],['Q',408,204,405,251],['Q',403,303,378,304],['L',166,304],['Q',142,299,142,249],['Q',140,204,171,204]]);
  const end=110*g.scale;
  const slot=capsule([-end,0],[end,0],g.wristRadius+.0005,48);
  const bridge=clip.difference(capsule([-end,0],[end,0],20*g.scale,48),slot);
  const frame=clip.union(clip.difference(outer,inner),bridge,
    rect(-g.stemHalfWidth,g.upperStem[0],g.stemHalfWidth,g.upperStem[1]),
    rect(-g.stemHalfWidth,g.lowerStem[0],g.stemHalfWidth,g.lowerStem[1]));
  // Brown breaks both stems off. They run on whole, past the plate edge,
  // through plain rectangular guides clear of the frame at full stroke; each
  // guide is carried from behind by a web and a flange on the framing behind
  // the mechanism (z = zWall).
  const stroke=g.crankRadius,clearance=.004,wall=.09,guideHalf=.2,zWall=-.95;
  const upperGuide=[Math.max(g.upperStem[1],(214-174)*g.scale+stroke)+.08,0],lowerGuide=[Math.min(g.lowerStem[0],(214-332)*g.scale-stroke)-.08,0];
  upperGuide[1]=upperGuide[0]+2*guideHalf;lowerGuide[1]=lowerGuide[0]-2*guideHalf;
  const upperEnd=upperGuide[1]+stroke+.12,lowerEnd=lowerGuide[1]-stroke-.12;
  const stems=clip.union(rect(-g.stemHalfWidth,g.upperStem[1]-.01,g.stemHalfWidth,upperEnd),
    rect(-g.stemHalfWidth,lowerEnd,g.stemHalfWidth,g.lowerStem[0]+.01));
  xy('framed-grooved-yoke',clip.union(clip.difference(frame,slot),stems),-.47,-.17,'yoke','driven');
  for(const [name,[a,b]]of[['upper',upperGuide],['lower',lowerGuide]]){
   const low=Math.min(a,b),high=Math.max(a,b),hx=g.stemHalfWidth+clearance,hz=.15+clearance;
   const ring=new THREE.Shape([[-hx-wall,-.32-hz-wall],[hx+wall,-.32-hz-wall],[hx+wall,-.32+hz+wall],[-hx-wall,-.32+hz+wall]].map(p=>new THREE.Vector2(...p)));
   ring.holes.push(new THREE.Path([[-hx,-.32-hz],[-hx,-.32+hz],[hx,-.32+hz],[hx,-.32-hz]].map(p=>new THREE.Vector2(...p))));
   // Rotating the extrusion +90 degrees about x keeps the ring's y as z and
   // runs the extrusion downward from the guide's top (no mirroring).
   add(`stem-guide-${name}`,new THREE.ExtrudeGeometry(ring,{depth:high-low,bevelEnabled:false}).rotateX(Math.PI/2).translate(0,high,0),'fixed','frame');
   const webFront=-.32-hz-wall/2,web=add(`stem-guide-${name}-web`,new THREE.BoxGeometry(2*(hx+wall),high-low,webFront-zWall),'fixed','frame');
   web.position.set(0,(low+high)/2,(webFront+zWall)/2);
   const flange=add(`stem-guide-${name}-flange`,new THREE.BoxGeometry(.9,Math.max(.6,high-low),.07),'fixed','frame');
   flange.position.set(0,(low+high)/2,zWall-.035);
  }
  const bounds=new THREE.Box3(new THREE.Vector3(-3.55,-7.3,-.7),new THREE.Vector3(3.55,5.2,.95));
  let disposed=false;
  const update=time=>{if(disposed)throw new Error('Movement disposed');const state=framedYokeAtTime(time);blocks.input.rotation.z=state.angle;blocks.yoke.position.y=state.y;root.updateMatrixWorld(true);root.userData.state=state;};
  Object.assign(root.userData,{parts,blocks,mechanism:'measured-front-disk-framed-yoke',fidelity:'authored',simulationBackend:'analytic',reconstructionStatus:'verified',hideGround:true,supportsRestart:true,cameraFitBounds:bounds,
    animationTiming:{authoredCyclePeriod:g.period,displayCycleDuration:g.period,playbackTimeScale:1},
    reconstructionNote:'Measured crank and broad yoke, with a straight hidden groove. Brown breaks the stems off; they run on whole into plain rectangular guides just past the plate edge, each carried from behind by a web and flange. The front bearing represents a fixed external support whose mounting is omitted; the shaft is supported in front to clear the rear yoke.'});
  markShadows(root);update(0);
  return {root,update,reset:()=>update(0),focus:bounds.getCenter(new THREE.Vector3()),cameraDirection:new THREE.Vector3(.06,.04,15),dispose:()=>{if(!disposed){disposed=true;disposeObject3D(root);}}};
}
