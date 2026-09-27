import * as THREE from 'three';
import source from './source.js';
import {makeTreadleRatchetLinkage,treadleSourcePoint as point} from './linkage.js';
import {plate,poly,circle,capsule,ring,disk,rotate,add,sub,polygonClipping as clip} from '../finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from '../primitives.js';

// One pawl for both arms. Both pivots sit at the same radius, so the same
// outline, turned about the wheel axis, seats identically on either arm. It is
// a band of even width between two concentric circular arcs, bowed away from
// the wheel as Brown draws it, grown from a round bored boss. Its end is cut
// along the tooth's steep face and its inner corner is the nose that seats in
// the root. The outline is given in the pawl's frame at the source pose: the
// pivot at the origin and the nose in the root `advance` radians ahead of it.
export const treadlePawl={advance:.36,width:.07,arcRadius:.62,bossRadius:.108,noseRound:.002};
export function treadlePawlOutline({pivot,...options}){
 // Built with the pivot on the x axis, then turned, so both arms get the same vertices.
 const turn=Math.atan2(pivot[1],pivot[0]);
 return canonicalPawlOutline({pivot:[Math.hypot(...pivot),0],...options}).map(polygon=>polygon.map(ring=>ring.map(q=>rotate(q,turn))));
}
function canonicalPawlOutline({pivot,rootRadius,outerRadius,pitch,shortFaceFraction,advance,width,arcRadius,bossRadius,noseRound}){
 const unit=v=>{const l=Math.hypot(...v);return[v[0]/l,v[1]/l];},dot=(a,b)=>a[0]*b[0]+a[1]*b[1],
  pivotAngle=Math.atan2(pivot[1],pivot[0]),rootAngle=pivotAngle+advance,
  nose=sub(rotate([rootRadius,0],rootAngle),pivot),
  face=unit(sub(rotate([outerRadius,0],rootAngle+shortFaceFraction*pitch),rotate([rootRadius,0],rootAngle))),
  // Inner arc through the nose; centre line (radius arcRadius+width/2) through the pivot.
  a=arcRadius,b=arcRadius+width/2,d=Math.hypot(...nose),x=(b*b-a*a+d*d)/(2*d),h=Math.sqrt(b*b-x*x),
  along=[nose[0]/d,nose[1]/d],across=[-along[1],along[0]],
  centres=[1,-1].map(s=>[along[0]*x+across[0]*h*s,along[1]*x+across[1]*h*s]),
  // The centre lies on the wheel side, so the band bows outward.
  centre=centres.sort((p,q)=>Math.hypot(...add(p,pivot))-Math.hypot(...add(q,pivot)))[0],
  angleOf=p=>Math.atan2(p[1]-centre[1],p[0]-centre[0]),start=angleOf([0,0]),
  wrap=v=>Math.atan2(Math.sin(v),Math.cos(v)),noseAngle=start+wrap(angleOf(nose)-start),
  // Outer arc meets the face line: centre + R u = nose + s face.
  R=arcRadius+width,w=sub(nose,centre),B=dot(w,face),s=-B+Math.sqrt(B*B-(dot(w,w)-R*R)),tip=add(nose,[face[0]*s,face[1]*s]),
  tipAngle=start+wrap(angleOf(tip)-start),back=start-Math.sign(noseAngle-start)*bossRadius/arcRadius,
  arc=(r,from,to,n=64)=>Array.from({length:n+1},(_,k)=>add(centre,rotate([r,0],from+(to-from)*k/n))),
  // A small round on the nose keeps the corner solid; it still reaches the root.
  noseCut=[nose,add(nose,[face[0]*noseRound,face[1]*noseRound])],
  band=[...arc(arcRadius,back,noseAngle-Math.sign(noseAngle-start)*noseRound/arcRadius),...noseCut.slice(1),tip,...arc(R,tipAngle,back)];
 return clip.union(poly(band),poly(circle([0,0],bossRadius,128)));
}
// Geometry and linkage candidate. Wheel and pawl motion are deliberately
// supplied separately until the actual finite-contact dynamics are solved.
export function makeTreadleRatchetCandidate({shortFaceFraction=source.ratchet.shortFaceFraction,treadleInset=.055,rodEndOffset=.12,pawl:pawlOptions={}}={}){
 const linkage=makeTreadleRatchetLinkage({treadleInset}),p=linkage.parameters,initial=linkage.atTime(0),
  root=new THREE.Group(),parts={},families={},blocks={},profiles={},scale=source.scale,
  attach=(name,g,family,color,position=[0,0,0])=>{
   blocks[family]??=new THREE.Group();if(!blocks[family].parent)root.add(blocks[family]);
   const mesh=new THREE.Mesh(g,matte(color,{metalness:.14,roughness:.62}));mesh.name=name;mesh.position.fromArray(position);
   blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;
  },bored=(outline,holes)=>clip.difference(outline,...holes.map(([at,r])=>poly(circle(at,r,128)))),
  rootRadius=source.ratchet.rootRadiusPixels/scale,outerRadius=source.ratchet.outerRadiusPixels/scale,
  pitch=2*Math.PI/source.ratchet.teeth,wheelPoints=[],pawl={...treadlePawl,...pawlOptions},pawlNoses={};
 for(let i=0;i<source.ratchet.teeth;i++){
  const a=source.ratchet.tipPhase+i*pitch,span=(1-shortFaceFraction)*pitch,
   tip=rotate([outerRadius,0],a),valley=rotate([rootRadius,0],a+span),
   middle=tip.map((v,k)=>(v+valley[k])/2),bulge=rotate([.018,0],a+span/2),control=middle.map((v,k)=>v+bulge[k]);
  for(let j=0;j<=24;j++){const t=j/24;wheelPoints.push(tip.map((v,k)=>v*(1-t)**2+2*t*(1-t)*control[k]+t*t*valley[k]));}
 }
 profiles.wheel=poly(wheelPoints);
 attach('ratchetBody',plate(bored(profiles.wheel,[[[0,0],.17]]),-.078,.078),'wheel',PALETTE.driven);
 attach('ratchetFace',ring(.17,1,.078,.087,256),'wheel',PALETTE.driven);
 attach('wheelAxle',disk(.167,-.15,.39,128),'fixed',PALETTE.muted);
 for(let i=0;i<2;i++){
  const a=p.arms[i],name=a.name,af=name+'Arm',tf=name+'Treadle',rf=name+'Rod',pf=name+'Pawl',
   armShape=bored(clip.union(capsule([0,0],a.armRodLocal,.027,32),poly(circle([0,0],source.circles.wheelHub.radius/scale,128)),
    poly(circle(a.pawlLocal,pawl.bossRadius,128)),poly(circle(a.armRodLocal,.105,128))),
    [[[0,0],.17],[a.pawlLocal,.032],[a.armRodLocal,.032]]);
  attach(name+'ArmBody',plate(armShape,a.armPlane-.03,a.armPlane+.03),af,PALETTE.driver);
  const pawlZ=i===0?-.041:.041,pawlPivot=initial.arms[i].pawlPivot,
   pawlShape=bored(treadlePawlOutline({pivot:pawlPivot,rootRadius,outerRadius,pitch,shortFaceFraction,...pawl}),[[[0,0],.034]]);
  profiles[pf]=pawlShape;pawlNoses[name]=sub(rotate([rootRadius,0],Math.atan2(pawlPivot[1],pawlPivot[0])+pawl.advance),pawlPivot);attach(name+'PawlBody',plate(pawlShape,pawlZ-.03,pawlZ+.03),pf,PALETTE.brass);
  attach(name+'PawlPin',disk(.031,pawlZ-.033,a.armPlane+.033,128),af,PALETTE.muted,[...a.pawlLocal,0]);
  const toe=rotate(sub(point(source.treadles[name==='upper'?'upperToe':'lowerToe']),p.fulcrum),-a.sourceTreadleAngle),
   leverOutline=clip.union(capsule([0,0],toe,.027,32),poly(circle([0,0],.15,128)),
    capsule([a.rodLocal[0],0],a.rodLocal,.028,32),poly(circle(a.rodLocal,.11,128)),
    capsule([p.strapLocal[0],0],p.strapLocal,.028,32),poly(circle(p.strapLocal,.07,128))),
   treadleShape=bored(leverOutline,[[[0,0],.047],[a.rodLocal,.032],[p.strapLocal,.027]]);
  attach(name+'TreadleBody',plate(treadleShape,a.treadlePlane-.035,a.treadlePlane+.035),tf,PALETTE.driver);
  const rodTopZ=a.armPlane+rodEndOffset,rodBottomZ=a.treadlePlane+(i===0?rodEndOffset:-rodEndOffset),L=a.rodLength;
  attach(name+'RodUpperEye',ring(.034,.104,rodTopZ-.025,rodTopZ+.025,128),rf,PALETTE.brass);
  attach(name+'RodLowerEye',ring(.034,.104,rodBottomZ-.025,rodBottomZ+.025,128),rf,PALETTE.brass,[L,0,0]);
  // A rigid rod with parallel Z-axis eyes can have a fixed axial offset.
  // This sheared prism retains that offset while rotating about Z.
  const beam=new THREE.BoxGeometry(L-.15,.045,.045).translate(L/2,0,0),positions=beam.attributes.position;
  for(let j=0;j<positions.count;j++)positions.setZ(j,positions.getZ(j)+rodTopZ+(rodBottomZ-rodTopZ)*positions.getX(j)/L);
  beam.computeVertexNormals();beam.computeBoundingBox();beam.computeBoundingSphere();attach(name+'RodBody',beam,rf,PALETTE.brass);
  attach(name+'RodTopPin',disk(.031,a.armPlane-.032,rodTopZ+.028,128),af,PALETTE.muted,[...a.armRodLocal,0]);
  attach(name+'RodBottomPin',disk(.031,Math.min(a.treadlePlane-.038,rodBottomZ-.028),Math.max(a.treadlePlane+.038,rodBottomZ+.028),128),tf,PALETTE.muted,[...a.rodLocal,0]);
  const strapZ=i===0?p.radius:-p.radius;
  attach(name+'StrapPin',disk(.026,Math.min(a.treadlePlane-.038,strapZ-.009),Math.max(a.treadlePlane+.038,strapZ+.009),128),tf,PALETTE.muted,[...p.strapLocal,0]);
  attach(name+'StrapEye',plate(bored(capsule([0,0],[0,.075],10/scale,32),[[[0,0],.028]]),strapZ-.006,strapZ+.006),name+'StrapEye',PALETTE.belt);
 }
 const width=(source.pulley.axialEdges[1]-source.pulley.axialEdges[0])/scale,
  pulleyRadius=(p.radius-.006)*Math.cos(Math.PI/256)-1e-6,
  pulleyMesh=attach('pulleyBody',ring(.035,pulleyRadius,-width/2,width/2,256),'pulley',PALETTE.brass,[...p.pulley,0]);
 pulleyMesh.rotation.y=Math.PI/2;
 const shaft=attach('pulleyAxle',disk(.032,-.42,.42,128),'fixed',PALETTE.muted,[...p.pulley,0]);shaft.rotation.y=Math.PI/2;
 for(const [index,edges] of [[944,977],[1083,1117]].entries()){
  const [x0,x1]=edges.map(x=>(x-source.center[0])/scale),bottom=point([0,1160])[1],top=point([0,650])[1],
   side=bored(poly([[-.09,bottom],[.09,bottom],[.09,top],[-.09,top]]),[[[0,p.pulley[1]],.035]]),
   post=attach('pulleyPost'+index,plate(side,x0,x1),'fixed',PALETTE.muted);post.rotation.y=Math.PI/2;
  const foot=new THREE.BoxGeometry(x1-x0+.2,.07,.3);attach('pulleyFoot'+index,foot,'fixed',PALETTE.muted,[(x0+x1)/2,bottom+.035,0]);
 }
 attach('treadleAxle',disk(.044,-p.radius-.2,p.radius+.2,128),'fixed',PALETTE.muted,[...p.fulcrum,0]);
 const pedestal=poly([[192,1100],[192,1071],[240,1065],[272,1024],[269,995],[281,967],[308,955],[330,971],[343,1025],[374,1061],[400,1070],[400,1100]].map(point));
 for(const sign of [-1,1])attach('pedestal'+sign,plate(bored(pedestal,[[p.fulcrum,.047]]),sign*p.radius+(sign>0?.08:-.16),sign*p.radius+(sign>0?.16:-.08)),'fixed',PALETTE.muted);
 const strapGeometry=new THREE.BufferGeometry(),strap=attach('strap',strapGeometry,'strap',PALETTE.belt);
 const setStrap=cable=>{
  const points=cable.points.map(v=>[...v]);points[0][1]+=.075;points.at(-1)[1]+=.075;
  const vertices=[],indices=[];
  for(let i=0;i<points.length;i++){
   const q=points[i],n=i===0?[0,0,1]:i===points.length-1?[0,0,-1]:[0,(q[1]-p.pulley[1])/p.radius,q[2]/p.radius];
   for(const [x,t] of [[-1,-1],[1,-1],[1,1],[-1,1]])vertices.push(q[0]+x*10/scale,q[1]+t*.006*n[1],q[2]+t*.006*n[2]);
  }
  for(let i=0;i+1<points.length;i++)for(let j=0;j<4;j++){const a=4*i+j,b=4*i+(j+1)%4,c=b+4,d=a+4;indices.push(a,b,c,a,c,d);}
  indices.push(0,2,1,0,3,2);const end=4*(points.length-1);indices.push(end,end+1,end+2,end,end+2,end+3);
  for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
  strapGeometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));strapGeometry.setIndex(indices);strapGeometry.computeVertexNormals();strapGeometry.computeBoundingBox();strapGeometry.computeBoundingSphere();
 };
 const setState=({time=0,wheelAngle=0,pawlAngles=[0,0]}={})=>{
  const s=linkage.atTime(time);blocks.wheel.rotation.z=wheelAngle;
  // Mean circumferential rolling speed of the two strap legs. Axial creep
  // and a small circumferential slip remain in this broad-pulley model.
  const pulleyAngle=(s.cable.frontLength-s.cable.rearLength-initial.cable.frontLength+initial.cable.rearLength)/(2*p.radius);
  pulleyMesh.rotation.x=pulleyAngle;
  for(let i=0;i<2;i++){
   const a=p.arms[i],state=s.arms[i],name=a.name;blocks[name+'Arm'].rotation.z=state.armAngle;
   blocks[name+'Treadle'].position.set(...p.fulcrum,0);blocks[name+'Treadle'].rotation.z=state.treadleAngle;
   blocks[name+'Pawl'].position.set(...state.pawlPivot,0);blocks[name+'Pawl'].rotation.z=pawlAngles[i];
   blocks[name+'Rod'].position.set(...state.top,0);blocks[name+'Rod'].rotation.z=Math.atan2(state.bottom[1]-state.top[1],state.bottom[0]-state.top[0]);
   blocks[name+'StrapEye'].position.set(...(i===0?s.cable.front:s.cable.rear),0);
  }
  setStrap(s.cable);root.updateMatrixWorld(true);root.userData.kinematics={...s,wheelAngle,pawlAngles,pulleyAngle};
 };
 root.userData={parts,families,blocks,profiles,linkage,geometry:{source,pulleyRadius,width,rootRadius,pitch,pawl,pawlNoses,options:{shortFaceFraction,treadleInset,rodEndOffset}},setState,setStrap,
  mechanism:'isolated-treadle-ratchet-candidate',fidelity:'candidate',hideGround:true,cameraFov:8,
  qualification:'Candidate geometry and equalizer linkage with externally supplied free wheel/pawl motion. Pulley rotation is a rolling approximation with axial creep. Complete mechanical qualification and pulley traction remain pending.'};
 setState();markShadows(root);return{root,setState,update:()=>setState(),cameraDirection:new THREE.Vector3(0,0,10)};
}
