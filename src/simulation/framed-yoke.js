import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {plate,poly,polygonClipping as clip} from './finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from './primitives.js';
import {smoothShadeExtrusion} from './smooth-extrusion.js';
import {makeSeeThrough} from './see-through-part.js';
import {disposeObject3D} from './dispose-model.js';

// Brown's yoke carries a closed groove that runs right round a rounded
// island (his dotted lines behind the disk), and the disk's wrist runs round
// that loop once per turn. Along the loop's straight top and bottom runs the
// yoke moves like a slotted (Scotch) yoke; round its ends the wrist crosses
// from one run to the other. The wrist reaches only the crank radius either
// side of the shaft, so the loop's ends are semicircles whose outer points lie
// exactly there (a stadium): with straight vertical ends the wrist would have
// to cross them in an instant. The loop's half-height is fixed by the plate:
// in Brown's pose the wrist sits in the top run and the loop's centre is 53.5
// px above the shaft, so the half-height is 93 - 54 = 39 px.
export const framedYokeDimensions = {
  scale:2.35/119, diskRadius:2.35, period:7,
  sourceCenter:[267,307], sourceWrist:[259,214],
  // Loop centre in Brown's pose (raster), half-height of the groove's centre
  // line, the groove's drawn half-width and the drawn wall round it.
  sourceLoopCenterRow:253.5, sourceLoopHalfHeight:39, sourceGrooveHalfWidth:12, sourceWall:30,
  // Stems end where Brown breaks them off (raster rows 50 and 485); their
  // guides lie beyond the plate and are not drawn. Yoke-frame coordinates
  // about the loop centre.
  upperStem:[81*2.35/119,(253.5-50)*2.35/119], lowerStem:[(253.5-485)*2.35/119,-81*2.35/119],
  stemHalfWidth:12*2.35/119,
};
const g=framedYokeDimensions;
g.crankRadius=Math.hypot(8,93)*g.scale;
g.sourcePhase=Math.atan2(93,-8);
g.wristRadius=11*g.scale;
g.loopHalfHeight=g.sourceLoopHalfHeight*g.scale;
g.loopHalfWidth=g.crankRadius;
g.grooveHalfWidth=g.wristRadius+.01;
g.frameOffset=(g.sourceGrooveHalfWidth+g.sourceWall)*g.scale;
g.stroke=g.crankRadius-g.loopHalfHeight;

// Where the wrist sits in the loop, relative to the loop centre, when it is
// at (x, y) about the shaft: on a straight run while |x| <= R - h, otherwise
// on an end semicircle, upper half while the wrist is above the shaft.
export function loopOffset(x,y){
  const R=g.crankRadius,h=g.loopHalfHeight;
  const c=Math.min(1,Math.max(0,(Math.abs(x)-(R-h))/h));
  return Math.sign(y)*h*Math.sqrt(1-c*c);
}
export function framedYokeAtTime(time){
  const angle=g.sourcePhase-2*Math.PI*time/g.period;
  const x=g.crankRadius*Math.cos(angle),y=g.crankRadius*Math.sin(angle);
  return {angle,x,y,yokeY:y-loopOffset(x,y)};
}
const rect=(a,b,c,d)=>poly([[a,b],[c,b],[c,d],[a,d]]);
const disk=r=>poly(Array.from({length:128},(_,i)=>[r*Math.cos(i*Math.PI/64),r*Math.sin(i*Math.PI/64)]));
// Stadium about the loop centre: straight runs half the given width minus
// its end radius long, semicircular ends of that radius.
function stadium(halfWidth,radius,count=96){
  const points=[],straight=halfWidth-radius;
  for(const[cx,start]of[[straight,-Math.PI/2],[-straight,Math.PI/2]])for(let i=0;i<=count;i++){
    const a=start+Math.PI*i/count;points.push([cx+radius*Math.cos(a),radius*Math.sin(a)]);
  }
  return poly(points);
}
// Keep only the triangles of an extrusion that lie in the plane z (or, with
// keep false, all the others).
function capsAt(geometry,z,keep){
  const source=geometry.index?geometry.toNonIndexed():geometry,p=source.attributes.position,out=[];
  for(let i=0;i<p.count;i+=3){
    const flat=[0,1,2].every(k=>Math.abs(p.getZ(i+k)-z)<1e-6);
    if(flat===keep)for(let k=0;k<3;k++)out.push(p.getX(i+k),p.getY(i+k),p.getZ(i+k));
  }
  const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(out,3));
  if(source!==geometry)source.dispose();
  return result;
}

export function makeFramedYoke(){
  const root=new THREE.Group(),parts={},blocks={};
  for(const name of ['fixed','input','yoke']){blocks[name]=new THREE.Group();blocks[name].name=name;root.add(blocks[name]);}
  const materials=Object.fromEntries(['frame','driver','driven','ink','brass'].map(name=>{
    const m=matte(PALETTE[name],{roughness:.65,metalness:.12});m.fog=false;return[name,m];
  }));
  const add=(name,geometry,body,color)=>{const m=new THREE.Mesh(geometry,materials[color]);m.name=name;blocks[body].add(m);parts[name]=m;return m;};
  const xy=(name,shape,low,high,body,color)=>add(name,plate(shape,low,high),body,color);
  const diskMesh=xy('driver-disk',disk(g.diskRadius),.05,.47,'input','driver');
  // Brown's two centre circles (raster radii 22.5 and 42.5) are the shaft
  // end and the disk's own hub. No bearing or mounting is drawn, so the
  // shaft ends as a plain stub in front of the hub (p62), as in the rest of
  // the crank family; the unmounted fixed front bearing is removed.
  xy('disk-shaft-stub',disk(.43),.06,.90,'input','ink');
  const hubMesh=xy('disk-front-hub',clip.difference(disk(.84),disk(.433)),.47,.84,'input','driver');
  // The wrist runs through the disk (Brown's small circle on its face) and
  // back into the groove, stopping short of the groove floor.
  const wrist=xy('back-reaching-wrist',disk(g.wristRadius),-.35,.51,'input','brass');wrist.position.x=g.crankRadius;
  // Brown dots the groove and wrist behind the disk: the disk and its hub
  // are see-through in the shared style so the loop and wrist read (p98).
  makeSeeThrough(diskMesh);makeSeeThrough(hubMesh);

  // The yoke: one closed solid. A frame of constant wall round the groove,
  // the island inside it, the stems, and a floor under the groove.
  const R=g.loopHalfWidth,h=g.loopHalfHeight,w=g.grooveHalfWidth,o=g.frameOffset;
  const outer=stadium(R+o,h+o),band=clip.difference(stadium(R+w,h+w),stadium(R-w,h-w));
  // Brown breaks both stems off. They run on straight past the plate edge
  // and end cleanly beyond it at full stroke; no guides are added (p60).
  // Past the framed view (y -7.3..5.2) at every point of the stroke.
  const upperEnd=5.2+g.stroke+.15,lowerEnd=-7.3-g.stroke-.15;
  const body=clip.union(outer,
    rect(-g.stemHalfWidth,h+o-.02,g.stemHalfWidth,upperEnd),
    rect(-g.stemHalfWidth,lowerEnd,g.stemHalfWidth,-h-o+.02));
  const back=-.47,floorTop=-.37,front=-.17;
  const floor=plate(body,back,floorTop),face=plate(clip.difference(body,band),floorTop,front),bandCap=plate(band,back,floorTop);
  const pieces=[capsAt(floor,floorTop,false),capsAt(face,floorTop,false),capsAt(bandCap,floorTop,true)];
  const merged=mergeGeometries(pieces);
  const yokeGeometry=smoothShadeExtrusion(merged);
  for(const geometry of [floor,face,bandCap,...pieces,merged])geometry.dispose();
  add('framed-grooved-yoke',yokeGeometry,'yoke','driven');
  const bounds=new THREE.Box3(new THREE.Vector3(-3.55,-7.3,-.7),new THREE.Vector3(3.55,5.2,.95));
  let disposed=false;
  const update=time=>{if(disposed)throw new Error('Movement disposed');const state=framedYokeAtTime(time);blocks.input.rotation.z=state.angle;blocks.yoke.position.y=state.yokeY;root.updateMatrixWorld(true);root.userData.state=state;};
  Object.assign(root.userData,{parts,blocks,mechanism:'measured-front-disk-loop-groove-yoke',fidelity:'authored',simulationBackend:'analytic',reconstructionStatus:'verified',hideGround:true,supportsRestart:true,cameraFitBounds:bounds,
    animationTiming:{authoredCyclePeriod:g.period,displayCycleDuration:g.period,playbackTimeScale:1},
    reconstructionNote:'Measured crank and yoke. The wrist runs once round a closed groove that loops round a rounded island, as Brown\'s dotted lines show: the yoke moves as a slotted yoke along the loop\'s straight runs and the wrist crosses between runs round its semicircular ends, which reach exactly the crank radius (the drawn loop is wider than the wrist can reach). The disk is see-through. Brown breaks the stems off; they run on straight past the plate edge and end cleanly there, with no added guides. The shaft ends as a plain stub in front of the disk hub; like the rest of the crank family its bearing is not drawn or modelled.'});
  markShadows(root);update(0);
  return {root,update,reset:()=>update(0),focus:bounds.getCenter(new THREE.Vector3()),cameraDirection:new THREE.Vector3(.06,.04,15),dispose:()=>{if(!disposed){disposed=true;disposeObject3D(root);}}};
}
