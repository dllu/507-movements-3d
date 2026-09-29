import * as THREE from 'three';
import clip from 'polygon-clipping';
import {matte,PALETTE,markShadows} from './primitives.js';
import {slottedSectorToothProfiles} from './slotted-sector-teeth.js';
import {spokedWheelParameters,spokedWheelWindow} from './spoked-wheel.js';

export function makeSlottedSector(){
 const root=new THREE.Group(),period=4,distance=1.55,crankRadius=.9,diskRadius=1.115;
 const radius=1.3,teeth=28,depth=.14,pinRadius=.149,slotHalfWidth=.15;
 const near=.60,far=2.70,outer=.29,phase=Math.atan2(-.03,.9);
 const pose=Math.atan2(distance+crankRadius*Math.sin(phase),crankRadius*Math.cos(phase))-Math.PI/2;
 const profiles=slottedSectorToothProfiles({radius,teeth,webRadius:1.17,pressureAngle:14.5*Math.PI/180,addendum:.8,dedendum:1});
 const driver=matte(PALETTE.driver),driven=matte(PALETTE.driven),rackMaterial=matte(PALETTE.brass),frame=matte(PALETTE.frame),dark=matte(PALETTE.ink),brass=matte(PALETTE.brass);
 const ring=(r,cx=0,cy=0)=>Array.from({length:129},(_,i)=>[cx+r*Math.cos(i*2*Math.PI/128),cy+r*Math.sin(i*2*Math.PI/128)]);
 const capsule=(r,a,b)=>{const points=[];for(let i=0;i<=64;i++){const t=i*Math.PI/64;points.push([r*Math.cos(t),b+r*Math.sin(t)]);}for(let i=0;i<=64;i++){const t=Math.PI+i*Math.PI/64;points.push([r*Math.cos(t),a+r*Math.sin(t)]);}points.push(points[0]);return points;};
 const solid=(rings,z,thickness,material,parent,name)=>{
  const shape=new THREE.Shape(rings[0].map(p=>new THREE.Vector2(...p)));
  for(const r of rings.slice(1))shape.holes.push(new THREE.Path(r.map(p=>new THREE.Vector2(...p))));
  const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false,curveSegments:32}),material);mesh.position.z=z;mesh.name=name;parent.add(mesh);return mesh;
 };
 const rect=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1],[x0,y0]];
 const pin=(r,z,h,parent,x,y,material,name)=>solid([ring(r,x,y)],z,h,material,parent,name);
 const disk=new THREE.Group();disk.position.y=distance;root.add(disk);
 const diskMesh=solid([ring(diskRadius),ring(.18)],-.18,.12,driver,disk,'disk');
 solid([ring(.285),ring(.18)],-.195,.16,driver,disk,'disk-hub');
 const crankPin=pin(pinRadius,-.065,.275,disk,crankRadius,0,brass,'crank-pin');
 const shaft=pin(.175,-.24,.23,root,0,distance,dark,'driver-shaft');
 const jaw=new THREE.Group();root.add(jaw);
 // Pass 101: Brown draws eleven sector teeth; the fan spans 11 pitches.
 const sectorTeeth=11,start=-Math.PI/2-sectorTeeth/2*2*Math.PI/teeth,end=-Math.PI/2+sectorTeeth/2*2*Math.PI/teeth;
 // Pass 97: the web is a clean symmetric three-spoke sector, one extrusion.
 // The two side bars and the middle spoke share one width; each window is
 // the classical two straight spoke edges plus arcs concentric with the
 // pivot (rim inside and hub band), filleted, and the windows mirror about
 // the sector's bisector. The fan's side edges are the side bars' outer
 // edges and meet the root circle at the tooth span's ends.
 const webOuter=1.17,web={bar:.19,rimInner:.99,hubArc:.42,hubFillet:.1,rimFillet:.08};
 const sideCentre=Math.asin(web.bar/2/webOuter),spokePitch=(end-start)/2-sideCentre;
 const apex=web.bar/2/Math.sin(spokePitch);
 const fan=[[0,apex],...Array.from({length:129},(_,i)=>{const a=start+(end-start)*i/128;return[webOuter*Math.cos(a),webOuter*Math.sin(a)];}),[0,apex]];
 const windowParams={...spokedWheelParameters({spokes:4,outerRadius:webOuter,rimInnerRadius:web.rimInner,spokeWidth:web.bar,hubArcRadius:web.hubArc,hubFillet:web.hubFillet,rimFillet:web.rimFillet,filletSegments:16,arcSegments:256}),spokes:2*Math.PI/spokePitch,phase:start+sideCentre};
 const webWindows=[0,1].map(i=>{const w=spokedWheelWindow(windowParams,i);return[...w,w[0]];});
 let union=clip.union([fan],[ring(.3)],[capsule(outer,near,far)],[rect(-.17,0,.17,near)]);
 const holes=[ring(.19),capsule(slotHalfWidth,near,far),...webWindows];
 for(const h of holes)union=clip.difference(union,[h]);
 if(union.length!==1)throw Error('Sector and slotted arm must form one connected solid');
 const body=solid(union[0],0,depth,driven,jaw,'slotted-sector');
 const toothMeshes=[];
 for(let i=0;i<sectorTeeth;i++){const mesh=solid([profiles.tooth.map(p=>p.toArray())],0,depth,driven,jaw,'sector-tooth');mesh.rotation.z=-Math.PI/2+(i-(sectorTeeth-1)/2)*2*Math.PI/teeth;toothMeshes.push(mesh);}
 solid([ring(.30),ring(.19)],-.015,.18,driven,jaw,'pivot-hub');
 const pivot=pin(.18,-.08,.27,root,0,0,dark,'pivot-shaft');
 const rack=new THREE.Group();root.add(rack);
 const rackRoot=-radius+profiles.rackRoot,rackBottom=-1.66;
 // The drawn bar cannot span both fixed guides over the full stroke. Extend
 // its bare ends by the required travel while preserving the toothed region;
 // each end keeps 0.3 past its guide's outside face at full travel, as drawn.
 const halfTravel=radius*Math.asin(crankRadius/distance),guideCenters=[-2.26,1.97];
 const barCenter=(guideCenters[0]+guideCenters[1])/2;
 const rackHalfLength=(guideCenters[1]-guideCenters[0])/2+halfTravel+.45;
 const rackBody=solid([rect(barCenter-rackHalfLength,rackBottom,barCenter+rackHalfLength,rackRoot)],0,depth,rackMaterial,rack,'rack-bar');
 const rackTeeth=[];
 for(let i=0;i<10;i++)rackTeeth.push(solid([profiles.rack.map(p=>[p.x+(i-4.5)*profiles.pitch,p.y-radius])],0,depth,rackMaterial,rack,'rack-tooth'));
 const guides=[];
 for(const x of guideCenters){
  const g=new THREE.Group();g.position.x=x;root.add(g);guides.push(g);
  const width=.25,top=-1.12,bottom=-2.02;
  solid([rect(-width/2,bottom,width/2,top)],-.13,.08,frame,g,'guide-back');
  solid([rect(-width/2,bottom,width/2,rackBottom-.02)],-.05,.24,frame,g,'guide-lower');
  solid([rect(-width/2,-radius+profiles.module+.02,width/2,top)],-.05,.24,frame,g,'guide-upper');
  solid([rect(-width/2,bottom,width/2,top)],.19,.08,frame,g,'guide-front');
  for(const y of [-1.24,-1.88])pin(.055,.27,.03,g,0,y,dark,'guide-bolt');
 }
 const stateAtTime=time=>{const angle=phase-2*Math.PI*time/period,x=crankRadius*Math.cos(angle),y=distance+crankRadius*Math.sin(angle),rocker=Math.atan2(y,x)-Math.PI/2;return{angle,x,y,rocker,rackX:radius*rocker};};
 const update=time=>{const s=stateAtTime(time);disk.rotation.z=s.angle;jaw.rotation.z=s.rocker;rack.position.x=s.rackX;root.userData.state=s;};
 update(0);markShadows(root);root.traverse(o=>{if(o.material)o.material.fog=false;});
 const bounds=new THREE.Box3(new THREE.Vector3(barCenter-rackHalfLength-halfTravel-.05,-2.1,-.3),new THREE.Vector3(barCenter+rackHalfLength+halfTravel+.05,3.1,.35));
 Object.assign(root.userData,{fidelity:'authored',mechanism:'crank-pin-slotted-sector-horizontal-rack',simulationBackend:'analytical',hideGround:true,supportsRestart:true,cameraFitBounds:bounds,minimumDisplayCycleSeconds:period,animationTiming:{authoredCyclePeriod:period},geometry:{period,distance,crankRadius,diskRadius,radius,teeth,depth,pinRadius,slotHalfWidth,near,far,phase,pose,rackRoot,rackBottom,rackHalfLength,halfTravel,guideCenters,barCenter},profiles,bodyRings:union[0],slotRing:holes[1],blocks:{disk,diskMesh,crankPin,shaft,jaw,body,toothMeshes,pivot,rack,rackBody,rackTeeth,guides},stateAtTime,reconstructionNote:'The crank pin swings the slotted sector, whose teeth drive the rack. The bare rack ends extend beyond the engraving to stay in both guides throughout the stroke. Tooth proportions and hidden depths are reconstructed.'});
 return {root,update,reset:()=>update(0),cameraDirection:new THREE.Vector3(.12,.08,10),focus:new THREE.Vector3(0,.45,0)};
}
