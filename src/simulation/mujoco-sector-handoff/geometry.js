import * as THREE from 'three';
import source from './source.js';
import {sectorHandoffTravel} from './profile.js';
import {relieveSectorHandoffEnds} from './end-relief.js';
import {simplifyCamOutline} from './cam-outline.js';
import {roundedRackGear} from '../coaxial-gear-geometry.js';
import {plate,poly,circle,ring,disk,capsule,polygonClipping as clip} from '../finite-plate-geometry.js';
import {segmentClampContactCells} from '../mujoco-segment-clamp/contact.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
export {THREE};
export function makeSectorHandoffGeometry({spurTeeth=36,spurPhase=.02863430804053197,sectorTeeth=38,sectorModule=.0638,installedTeeth=16,sectorShift=-.25,stopRadius=.08,stopOffset=1.375,camWall=.05,camClearance=.001,camPhase=0,rackClearance=.0015,endRelief=true,reliefSteps=1024,reliefClearance=.0015,samples=96,cutterSteps=2048,collisionTolerance=.0005}={}){
 if(![spurTeeth,sectorTeeth,installedTeeth,samples,cutterSteps].every(Number.isInteger)||spurTeeth<12||sectorTeeth<20||installedTeeth<4||installedTeeth>=sectorTeeth/2||samples<32||cutterSteps<128||![spurPhase,sectorShift,camPhase].every(Number.isFinite)||![sectorModule,stopRadius,stopOffset,camWall].every(v=>Number.isFinite(v)&&v>0)||![camClearance,collisionTolerance,rackClearance].every(v=>Number.isFinite(v)&&v>=0))throw new RangeError('Invalid 123 geometry options');
 if(!Number.isInteger(reliefSteps)||reliefSteps<128||!Number.isFinite(reliefClearance)||reliefClearance<0)throw new RangeError('Invalid 123 end-relief options');
 const root=new THREE.Group(),blocks={},parts={},families={},cells={},contactApproximation={},sectorProfiles={},D=source.distancePixels/100,R=sectorTeeth*sectorModule/2,pitch=Math.PI*sectorModule,a=installedTeeth*Math.PI/sectorTeeth,spurModule=D/spurTeeth,sectorPhase=Math.PI/sectorTeeth;
 const f={source,D,spurTeeth,spurModule,spurPhase,sideSpurPhase:Math.PI/spurTeeth-spurPhase,sectorTeeth,sectorModule,sectorPhase,sectorShift,installedTeeth,R,pitch,halfSpan:a,stopRadius,stopOffset,camWall,camClearance,camPhase,rackClearance,samples,cutterSteps,positions:{left:[-D,0,0],center:[0,0,0],right:[D,0,0],rack:[0,0,0]},halfStroke:-sectorHandoffTravel(Math.PI/2,R,a).position};
 const local=([x,y])=>[(x-source.axis[0])/100,(source.axis[1]-y)/100];
 for(const[n,p]of Object.entries(f.positions)){blocks[n]=new THREE.Group();blocks[n].position.fromArray(p);root.add(blocks[n]);}
 const add=(name,g,family,color)=>{const mesh=new THREE.Mesh(g,matte(color,{metalness:.15,roughness:.6}));mesh.name=name;blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;};
 for(const n of ['left','center','right']){
  const shaft=n==='center'?.175:source.circles[n+'Shaft'].radius/100,hub=n==='center'?.24:source.circles[n+'Hub'].radius/100;
  const g=roundedRackGear({teeth:spurTeeth,module:spurModule,depth:.2,boreRadius:shaft,addendum:.8,dedendum:1.5,tipRadius:.12*spurModule,samples,cutterSteps});g.rotateZ(n==='center'?spurPhase:f.sideSpurPhase);g.translate(0,0,.1);add(n+'Spur',g,n,n==='center'?PALETTE.driven:PALETTE.driver);
  add(n+'Shaft',disk(shaft,-.1,n==='center'?.2:.51,128),n,PALETTE.ink);
  if(n!=='center'){
   add(n+'Collar',ring(shaft,hub,.2,.32,128),n,PALETTE.driver);
   const full=roundedRackGear({teeth:sectorTeeth,module:sectorModule,depth:.14,boreRadius:shaft,addendum:1,dedendum:1.25,profileShift:sectorShift,tipRadius:.12*sectorModule,samples,cutterSteps}),points=full.userData.outline.map(p=>p.clone().rotateAround(new THREE.Vector2(),sectorPhase)).filter(p=>Math.abs(Math.atan2(p.y,p.x))<=a+1e-10).sort((p,q)=>Math.atan2(p.y,p.x)-Math.atan2(q.y,q.x)).map(p=>p.toArray());
   const back=[];for(let i=0;i<=64;i++){const angle=a+Math.PI/2+(Math.PI-2*a)*i/64;back.push([hub*Math.cos(angle),hub*Math.sin(angle)]);}
   const outline=poly([...points,...back]),holes=[];
   for(const sign of [-1,1]){const path=new THREE.Shape();path.moveTo(.22,sign*.37);path.lineTo(.33,sign*.8);path.bezierCurveTo(.62,sign*.65,.82,sign*.40,.84,sign*.20);path.bezierCurveTo(.65,sign*.17,.47,sign*.17,.36,sign*.18);path.closePath();holes.push(poly(path.getPoints(24).map(p=>p.toArray())));}
   sectorProfiles[n]={points,back,holes:[poly(circle([0,0],shaft,128)),...holes]};add(n+'Sector',plate(clip.difference(outline,...sectorProfiles[n].holes),.32,.46),n,PALETTE.driver);full.dispose();add(n+'Hub',ring(shaft,hub,.46,.49,128),n,PALETTE.driver);
  }
 }
 // Both rack rows share a conjugate cutter and pitch. Their center locations
 // differ from the irregular engraved rows by the documented regularization.
 const m=sectorModule,alpha=Math.PI/9,corner=.12*m,normalBottom=R-1.25*m+sectorShift*m+rackClearance,normalRoot=R+m+sectorShift*m+rackClearance,cn=normalBottom+corner,ct=pitch/4-1.25*m*Math.tan(alpha)-corner*(1/Math.cos(alpha)-Math.tan(alpha));
 const tooth=[[-(pitch/4+(normalRoot-R-sectorShift*m-rackClearance)*Math.tan(alpha)),normalRoot]];
 for(let i=0;i<=16;i++){const angle=Math.PI+alpha+(Math.PI/2-alpha)*i/16;tooth.push([-ct+corner*Math.cos(angle),cn+corner*Math.sin(angle)]);}tooth.push([ct,normalBottom]);
 for(let i=1;i<=16;i++){const angle=-Math.PI/2+(Math.PI/2-alpha)*i/16;tooth.push([ct+corner*Math.cos(angle),cn+corner*Math.sin(angle)]);}tooth.push([pitch/4+(normalRoot-R-sectorShift*m-rackClearance)*Math.tan(alpha),normalRoot]);
 const rootHalf=D-normalRoot,teeth=[];f.rackRootHalf=rootHalf;f.rackTipHalf=D-normalBottom;
 const joinedTooth=[[tooth[0][0],normalRoot+.002],...tooth,[tooth.at(-1)[0],normalRoot+.002]];
 for(const sign of [-1,1])for(let k=-8;k<=7;k++)teeth.push(poly(joinedTooth.map(([t,n])=>[sign*(D-n),k*pitch+t])));
 const shape=new THREE.Shape();shape.moveTo(228,25);shape.lineTo(264,25);shape.lineTo(264,81);shape.lineTo(297,82);shape.lineTo(281,100);shape.lineTo(source.axis[0]+100*rootHalf,100);shape.lineTo(source.axis[0]+100*rootHalf,433);shape.lineTo(296,433);shape.lineTo(315,454);shape.lineTo(267,454);shape.lineTo(267,496);shape.bezierCurveTo(266,510,231,508,227,496);shape.lineTo(227,453);shape.lineTo(185,453);shape.lineTo(200,433);shape.lineTo(source.axis[0]-100*rootHalf,433);shape.lineTo(source.axis[0]-100*rootHalf,100);shape.lineTo(209,100);shape.lineTo(193,82);shape.lineTo(228,81);shape.closePath();
 const rackOutline=poly(shape.getPoints(20).map(p=>local(p.toArray()))),strip=poly([[-rootHalf,-3],[rootHalf,-3],[rootHalf,3],[-rootHalf,3]]),rackPoly=clip.union(clip.intersection(rackOutline,strip),...teeth);add('rack',plate(rackPoly,.32,.46),'rack',PALETTE.driven);
 // Raised end flanges bridge over the passing sector ends while retaining the
 // engraved front silhouette. Their axial step is reconstructed hardware.
 for(const[name,low,high]of [['upperEnd',1.54,3],['lowerEnd',-3,-1.74]])add(name,plate(clip.intersection(rackOutline,poly([[-1,low],[1,low],[1,high],[-1,high]])),.46,.60),'rack',PALETTE.driven);
 f.endRelief={enabled:endRelief,steps:reliefSteps,clearance:reliefClearance};
 if(endRelief)for(const n of ['left','right']){const s=sectorProfiles[n],relief=relieveSectorHandoffEnds(s.points,rackPoly,{centerX:n==='left'?-D:D,radius:R,halfSpan:a,steps:reliefSteps,clearance:reliefClearance}),g=plate(clip.difference(poly([...relief.outline,...s.back]),...s.holes),.32,.46);parts[n+'Sector'].geometry.dispose();parts[n+'Sector'].geometry=g;const{outline:_,...description}=relief;f.endRelief[n]=description;}
 for(const sign of [-1,1])add(sign===1?'upperStop':'lowerStop',disk(stopRadius,.2,.32,96).translate(0,sign*stopOffset,0),'rack',PALETTE.ink);
 // The transfer piece is rephased to the left at the source pose. Its open
 // pocket is cut by the returning stop's relative path through the tooth gap.
 const path=[];for(let i=0;i<=192;i++){const theta=a+(Math.PI-2*a)*i/192,y=sectorHandoffTravel(theta,R,a).position+stopOffset;path.push([y*Math.sin(theta),y*Math.cos(theta)]);}
 const sweep=r=>clip.union(...path.slice(1).map((p,i)=>capsule(path[i],p,r,48)));
 const mouth=Math.max(...path.map(p=>p[0]))-.002,outer=sweep(stopRadius+camClearance+camWall),cavity=sweep(stopRadius+camClearance),open=poly([[mouth,-1],[1,-1],[1,1],[mouth,1]]);
 const simplified=simplifyCamOutline(clip.difference(outer,cavity,open)),cam=plate(simplified.polygons,.2,.30);cam.rotateZ(camPhase);add('transferCam',cam,'center',PALETTE.brass);f.camPath=path;f.camPocketRadius=f.halfStroke-stopOffset;const{polygons:_,...simplification}=simplified;f.camBoundarySimplification=simplification;
 for(const name of ['leftSpur','centerSpur','rightSpur','leftSector','rightSector','rack','upperStop','lowerStop','transferCam']){const{cells:c,...approx}=segmentClampContactCells(parts[name].geometry,collisionTolerance);cells[name]=c;contactApproximation[name]=approx;}
 const rackOutlineView=new THREE.LineSegments(new THREE.EdgesGeometry(parts.rack.geometry,20),new THREE.LineBasicMaterial({color:PALETTE.ink}));
 rackOutlineView.name='section-outline-of-double-rack';blocks.rack.add(rackOutlineView);
 const setSectionView=enabled=>{root.userData.sectionView=Boolean(enabled);parts.rack.visible=!enabled;rackOutlineView.visible=Boolean(enabled);};
 const bounds=new THREE.Box3(new THREE.Vector3(-2.9,-4.5,-.15),new THREE.Vector3(2.9,4.35,.65));
 Object.assign(root.userData,{source,profile:f,blocks,parts,families,cells,contactApproximation,hideGround:true,cameraFitBounds:bounds,sampledMotionBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},shadowCameraHalfExtent:5,shadowBias:-.00002,shadowNormalBias:.002,setSectionView});setSectionView(false);markShadows(root);root.updateMatrixWorld(true);return{root,focus:bounds.getCenter(new THREE.Vector3()),cameraDirection:new THREE.Vector3(1.3,1,10)};
}
