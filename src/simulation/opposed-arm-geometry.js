import * as THREE from 'three';
import {PALETTE,matte,markShadows} from './primitives.js';
import {add,sub,rotate,poly,circle,capsule,plate,disk,ring,polygonClipping as clip} from './finite-plate-geometry.js';

const sourceCenter=[406.29814582227056,777.9249240149841],sourceScale=400.22693572590316;
const source=p=>[(p[0]-sourceCenter[0])/sourceScale,(sourceCenter[1]-p[1])/sourceScale];
const measured={upperPawl:[657.1801948051948,524.5487012987013],lowerPawl:[654.8850364963504,1041.6770072992701],
 upperRod:[728.2536585365854,446.2219512195122],lowerRod:[731.2181208053692,1115.489932885906],slider:[1232.452865064695,769.3401109057302]};
const contour=(commands,transform)=>{
 const s=new THREE.Shape();
 for(const [op,...v]of commands){const p=[];for(let i=0;i<v.length;i+=2)p.push(...transform(v.slice(i,i+2)));
  if(op==='M')s.moveTo(...p);else if(op==='L')s.lineTo(...p);else if(op==='Q')s.quadraticCurveTo(...p);else throw Error(op);}
 return s.getPoints(16).map(p=>p.toArray());
};

// A single closed wheel: back, bore, flat web, and a crown of axial ramps.
// At a tooth division the ramp falls in the positive angular direction.
// A clockwise-moving pawl therefore meets the vertical driving face.
export function faceRatchetGeometry({innerRadius,outerRadius=1,boreRadius=.108,teeth=33,phase=.04480311998100515,
 back=-.075,web=-.025,valley=-.020,crest=.035,segments=24}={}){
 const vertices=[],normals=[],pitch=2*Math.PI/teeth;
 const point=(r,a,z)=>[Math.fround(r*Math.cos(a)),Math.fround(r*Math.sin(a)),Math.fround(z)];
 const tri=(a,b,c,normal)=>{
  const u=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)),v=new THREE.Vector3(...c).sub(new THREE.Vector3(...a));
  const cross=u.cross(v);
  if(cross.lengthSq()>1e-24){vertices.push(...a,...b,...c);for(const p of [a,b,c])normals.push(...(normal?normal(p):cross.clone().normalize().toArray()));}
 };
 const quad=(a,b,c,d,n)=>{tri(a,b,c,n);tri(a,c,d,n);},radial=sign=>p=>new THREE.Vector3(sign*p[0],sign*p[1],0).normalize().toArray(),
  rampNormal=p=>{const r2=p[0]**2+p[1]**2,slope=(crest-valley)/pitch;return new THREE.Vector3(slope*p[1]/r2,-slope*p[0]/r2,1).normalize().toArray();};
 for(let tooth=0;tooth<teeth;tooth++){
  for(let j=0;j<segments;j++){
   const angle=k=>phase+((tooth*segments+k)%(teeth*segments))*pitch/segments,
    a=angle(j),b=angle(j+1),za=valley+(crest-valley)*j/segments,zb=valley+(crest-valley)*(j+1)/segments,
    B0=point(boreRadius,a,back),B1=point(boreRadius,b,back),F0=point(boreRadius,a,web),F1=point(boreRadius,b,web),
    W0=point(innerRadius,a,web),W1=point(innerRadius,b,web),V0=point(innerRadius,a,valley),V1=point(innerRadius,b,valley),
    I0=point(innerRadius,a,za),I1=point(innerRadius,b,zb),O0=point(outerRadius,a,za),O1=point(outerRadius,b,zb),
    Q0=point(outerRadius,a,valley),Q1=point(outerRadius,b,valley),R0=point(outerRadius,a,back),R1=point(outerRadius,b,back);
   quad(B0,B1,R1,R0);quad(B1,B0,F0,F1,radial(-1));quad(F0,W0,W1,F1);
   quad(W1,W0,V0,V1,radial(-1));quad(V1,V0,I0,I1,radial(-1));quad(I0,O0,O1,I1,rampNormal);
   quad(R0,R1,Q1,Q0,radial(1));quad(Q0,Q1,O1,O0,radial(1));
  }
  const a=phase+tooth*pitch;
  quad(point(innerRadius,a,valley),point(innerRadius,a,crest),point(outerRadius,a,crest),point(outerRadius,a,valley));
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
 geometry.userData.faceRatchet={innerRadius,outerRadius,boreRadius,teeth,phase,back,web,valley,crest,segments};return geometry;
}

// Signed tetrahedral integrals of the actual rendered buffers, including their
// full 3D inertia tensor. Needed for radial-axis pawls, not just planar motion.
export function rigidFamilyMass(parts,families,family){
 let volume=0;const first=[0,0,0],second=Array.from({length:3},()=>[0,0,0]);
 for(const [name,mesh]of Object.entries(parts))if(families[name]===family){
  mesh.updateMatrix();const g=mesh.geometry,p=g.attributes.position,index=g.index;
  for(let i=0;i<(index?.count??p.count);i+=3){
   const v=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrix)),
    weight=v[0].dot(v[1].clone().cross(v[2]))/6,xyz=v.map(p=>p.toArray()),sum=[0,1,2].map(k=>xyz.reduce((s,p)=>s+p[k],0));
   volume+=weight;
   for(let j=0;j<3;j++){first[j]+=weight*sum[j]/4;for(let k=0;k<3;k++)second[j][k]+=weight*(sum[j]*sum[k]+xyz.reduce((s,p)=>s+p[j]*p[k],0))/20;}
  }
 }
 if(!(volume>0))throw Error('Nonpositive volume for '+family);
 const centroid=first.map(x=>x/volume),trace=second.reduce((s,row,i)=>s+row[i],0),inertia=second.map((row,i)=>row.map((v,j)=>(i===j?trace:0)-v)),
  centralInertia=inertia.map((row,i)=>row.map((v,j)=>v-volume*((i===j?centroid.reduce((s,c)=>s+c*c,0):0)-centroid[i]*centroid[j])));
 return{volume,centroid,second,inertia,centralInertia};
}

export function makeOpposedArmGeometry({phase=.04480311998100515,crest=.035,pivotZ=.09,
 sourceBeta={upper:.25,lower:.32},stroke=.24,segments=24,pawlLength=.22}={}){
 const root=new THREE.Group(),parts={},families={},blocks={},p={center:sourceCenter,scale:sourceScale,teeth:33,pitch:2*Math.PI/33,phase,
  outerRadius:1,innerRadius:338.90038109631433/sourceScale,crest,valley:-.02,pivotZ,sourceBeta,stroke,sourceSlider:source(measured.slider),arms:{},
  pawl:{halfWidth:.029,root:.03,length:pawlLength,sagitta:.008,halfThickness:.011}};
 for(const family of ['wheel','upperArm','lowerArm','upperRod','lowerRod','upper','lower','slider']){blocks[family]=new THREE.Group();root.add(blocks[family]);}
 const attach=(name,geometry,family,color,position=[0,0,0])=>{
  const mesh=new THREE.Mesh(geometry,matte(color,{metalness:.16,roughness:.58}));mesh.name=name;mesh.position.fromArray(position);
  parts[name]=mesh;families[name]=family;blocks[family].add(mesh);return mesh;
 };
 attach('wheelBody',faceRatchetGeometry({...p,segments}),'wheel',PALETTE.driven);
 attach('wheelRearHub',ring(.108,.19,-.14,-.075,256),'wheel',PALETTE.driven);
 attach('wheelAxle',disk(.108,-.16,.315,256),'wheel',PALETTE.muted);
 attach('wheelAxleRearCap',disk(.13,-.177,-.16,256),'wheel',PALETTE.muted);
 attach('wheelAxleFrontCap',disk(.122,.315,.330,256),'wheel',PALETTE.muted);
 // Both pawls have the same role, so they share one blade: two circular
 // arcs meeting at a point, springing from the full width of the radial
 // journal (which they overlap) and lying in the pawl's own plane. Local x is
 // radial, local -y points clockwise along the teeth.
 const blade=(()=>{
  const {halfWidth,root,length,sagitta}=p.pawl,tip=[0,-length],arc=(from,to,side)=>{
   const middle=[(from[0]+to[0])/2,(from[1]+to[1])/2],chord=Math.hypot(to[0]-from[0],to[1]-from[1]),
    normal=[side*(to[1]-from[1])/chord,-side*(to[0]-from[0])/chord],radius=(chord*chord/4+sagitta*sagitta)/(2*sagitta),
    center=[middle[0]-(radius-sagitta)*normal[0],middle[1]-(radius-sagitta)*normal[1]],
    a0=Math.atan2(from[1]-center[1],from[0]-center[0]),a1=Math.atan2(to[1]-center[1],to[0]-center[0]),
    sweep=Math.atan2(Math.sin(a1-a0),Math.cos(a1-a0));
   return Array.from({length:33},(_,i)=>[center[0]+radius*Math.cos(a0+sweep*i/32),center[1]+radius*Math.sin(a0+sweep*i/32)]);
  };
  return[...arc([-halfWidth,-root],tip,1),...arc(tip,[halfWidth,-root],1).slice(1)];
 })();
 for(const key of ['upper','lower']){
  const P=source(measured[key+'Pawl']),J=source(measured[key+'Rod']),psi=Math.atan2(P[1],P[0]),
   armFamily=key+'Arm',rodFamily=key+'Rod',armLow=key==='upper'?.205:.14,armHigh=armLow+.045,
   rodLow=key==='upper'?.265:.309,rodHigh=rodLow+.030,hubRadius=key==='upper'?.185:.275,
   a={pivot:P,rodJoint:J,pivotRadius:Math.hypot(...P),sourceAngle:psi,jointAngle:Math.atan2(J[1],J[0]),
    jointRadius:Math.hypot(...J),rodLength:Math.hypot(...sub(p.sourceSlider,J)),armLow,armHigh,rodLow,rodHigh};
  p.arms[key]=a;
  const body=clip.difference(clip.union(capsule([0,0],J,.057,64),poly(circle([0,0],hubRadius,256)),poly(circle(J,.102,128))),
   poly(circle([0,0],.115,256)),poly(circle(J,.035,96)));
  attach(key+'RadialArm',plate(body,armLow,armHigh),armFamily,PALETTE.driver);
  attach(key+'RodPin',disk(.032,armLow-.012,rodHigh+.003,96),armFamily,PALETTE.muted,[...J,0]);
  attach(key+'RodPinRearCap',disk(.046,armLow-.025,armLow-.012,96),armFamily,PALETTE.muted,[...J,0]);
  attach(key+'RodPinFrontCap',disk(.046,rodHigh+.003,rodHigh+.016,96),armFamily,PALETTE.muted,[...J,0]);
  const rodShape=clip.difference(clip.union(capsule([0,0],[a.rodLength,0],.0215,64),poly(circle([0,0],.082,128)),
   poly(circle([a.rodLength,0],.108,128))),poly(circle([0,0],.035,96)),poly(circle([a.rodLength,0],.035,96)));
  attach(key+'ConnectingRod',plate(rodShape,rodLow,rodHigh),rodFamily,PALETTE.muted);

  // The engraving does not reveal its out-of-plane return mechanism. This
  // candidate uses a radial journal beneath the arm and torsional preload.
  // The front circular fastener is fixed to the arm, covering the journal.
  const axisGeometry=g=>{g.rotateY(Math.PI/2);return g;};
  for(const [side,x0,x1]of [['inner',-.057,-.031],['outer',.031,.057]]){
   // Initially in a yz plane, then rotate into the radial journal axis.
   const lug=clip.difference(poly([[-armLow,-.022],[-pivotZ+.028,-.022],[-pivotZ+.028,.022],[-armLow,.022]]),
    poly(circle([-pivotZ,0],.012,96))),g=plate(lug,x0,x1);g.rotateY(Math.PI/2);g.rotateZ(psi);
   attach(key+side+'HingeLug',g,armFamily,PALETTE.muted,[...P,0]);
  }
  const pin=axisGeometry(disk(.010,-.069,.069,96));pin.rotateZ(psi);
  attach(key+'PawlRadialPin',pin,armFamily,PALETTE.muted,[...P,pivotZ]);
  for(const [side,lo,hi]of [['inner',-.075,-.069],['outer',.069,.075]]){
   const cap=axisGeometry(disk(.016,lo,hi,96));cap.rotateZ(psi);attach(key+side+'PawlPinCap',cap,armFamily,PALETTE.muted,[...P,pivotZ]);
  }
  attach(key+'PawlFastenerSeat',ring(.032,.054,armHigh,armHigh+.012,128),armFamily,PALETTE.brass,[...P,0]);
  attach(key+'PawlFastener',disk(.030,armHigh-.010,armHigh+.014,128),armFamily,PALETTE.muted,[...P,0]);
  const trimmed=poly(blade),journal=clip.difference(poly([[-.025,-.04],[.025,-.04],[.025,.025],[-.025,.025]]),poly(circle([0,0],.012,128)));
  attach(key+'Pawl',plate(trimmed,-p.pawl.halfThickness,p.pawl.halfThickness),key,PALETTE.brass);
  attach(key+'PawlJournal',axisGeometry(plate(journal,-.029,.029)),key,PALETTE.brass);
  a.pawlContour=trimmed;a.pawlTip=[0,-p.pawl.length];
 }
 const B=p.sourceSlider,sliderShape=clip.difference(clip.union(poly(circle([0,0],.127,128)),
  poly([[.05,-.081],[.297,-.081],[.297,.081],[.05,.081]])),poly(circle([0,0],.035,96)));
 attach('sliderB',plate(sliderShape,.358,.403),'slider',PALETTE.driver);
 attach('sliderJointPin',disk(.032,.248,.415,96),'slider',PALETTE.muted);
 attach('sliderRearPinCap',disk(.047,.235,.248,96),'slider',PALETTE.muted);
 attach('sliderFrontPinCap',disk(.047,.415,.430,96),'slider',PALETTE.muted);

 // Two independent fixed-length rods meet the same horizontal slider. Retain
 // the small measured source asymmetry instead of changing the rod lengths.
 const input=(sliderX=B[0])=>{
  const slider=[sliderX,B[1]],d=Math.hypot(...slider),gamma=Math.atan2(slider[1],slider[0]),arms={};
  for(const key of ['upper','lower']){
   const a=p.arms[key],cosine=(d*d+a.jointRadius**2-a.rodLength**2)/(2*d*a.jointRadius);
   if(Math.abs(cosine)>1)throw Error('Unreachable slider '+sliderX);
   const jointAngle=gamma+(key==='upper'?1:-1)*Math.acos(cosine),q=jointAngle-a.jointAngle,J=rotate(a.rodJoint,q),P=rotate(a.pivot,q);
   arms[key]={q,jointAngle,psi:a.sourceAngle+q,joint:J,pivot:P,rodAngle:Math.atan2(slider[1]-J[1],slider[0]-J[0]),
    closureError:Math.abs(Math.hypot(...sub(slider,J))-a.rodLength)};
  }
  return{slider,arms};
 };
 const setState=({sliderX=B[0],theta=0,upperBeta=sourceBeta.upper,lowerBeta=sourceBeta.lower}={})=>{
  const k=input(sliderX);blocks.wheel.rotation.z=theta;blocks.slider.position.set(...k.slider,0);
  for(const key of ['upper','lower']){
   const a=k.arms[key],beta=key==='upper'?upperBeta:lowerBeta;
   blocks[key+'Arm'].rotation.z=a.q;blocks[key+'Rod'].position.set(...a.joint,0);blocks[key+'Rod'].rotation.z=a.rodAngle;
   blocks[key].position.set(...a.pivot,pivotZ);
   blocks[key].quaternion.setFromAxisAngle(new THREE.Vector3(0,0,1),a.psi).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),beta));
  }
  root.userData.kinematics={sliderX,theta,upperBeta,lowerBeta,...k};root.updateMatrixWorld(true);return root.userData.kinematics;
 };
 const masses=Object.fromEntries(['wheel','upper','lower'].map(family=>[family,rigidFamilyMass(parts,families,family)]));
 root.userData={parts,families,blocks,geometry:p,source,input,setState,masses,hideGround:true,cameraFov:8,
  fullCameraDirection:new THREE.Vector3(0,0,10),shadowCameraHalfExtent:2.5,shadowBias:-.00003,shadowNormalBias:.005,
  mechanism:'opposed-arm-face-ratchet-drive',fidelity:'authored',
  qualification:'Source-scale 33-tooth crown interpretation with concealed radial pawl hinges. Axial dimensions, journal details and preload are reconstruction assumptions. Free pawl/output dynamics, contact and loaded operation are unverified. SourceBeta only sets a geometry-study pose.'};
 setState();markShadows(root);return{root,setState,update:()=>{},cameraDirection:new THREE.Vector3(0,0,10)};
}
