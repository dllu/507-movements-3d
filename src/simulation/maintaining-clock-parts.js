import * as THREE from 'three';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import { plate, poly, circle, capsule, polygonClipping as clip } from './finite-plate-geometry.js';
import clickPaths from './baked/maintaining-clock-clicks.js';
const TAU=2*Math.PI;
const tube=(r,h,b)=>boredLatheGeometry([{radial:r,axial:-h/2},{radial:r,axial:h/2}],b,64);
const replace=(o,g)=>{o.geometry.dispose();o.geometry=g;};
const turn=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];
const difference=(a,b)=>[a[0]-b[0],a[1]-b[1]];
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

export function ratchet(mesh,{radius,bore,teeth,hand,phase,depth}){
  const pitch=TAU/teeth,outline=[];
  for(let i=0;i<teeth;i++)for(const[r,a]of [[radius,0],[radius*.84,.90*pitch]])outline.push(turn([r,0],phase+hand*(i*pitch+a)));
  const geometry=plate(clip.difference(poly(outline),poly(circle([0,0],bore,64))),-depth/2,depth/2);
  replace(mesh,geometry);mesh.userData.ratchetProfile={outline,radius,bore,teeth,hand,phase,depth};return outline;
}

// A prescribed geometric follower: intersect the toe-center orbit with the
// outward-offset polygon edges/vertices. This checks finite toe radii rather
// than guessing a sinusoidal lift from nominal pitch circles. No force solve.
export function makeFollower(group,wheel,center,outline,depth=.12,bakeKey){
  const base=group.rotation.z,oldBody=group.children.find(o=>o.userData.role?.endsWith('-body'));
  const length=oldBody.geometry.parameters.width,pivot=[group.position.x-center[0],group.position.y-center[1]];
  const a=turn([length,0],base),sign=Math.sign(cross(a,pivot))||1;
  const bow=length>3?.24:0;
  const centerAt=x=>[x,sign*bow*Math.sin(Math.PI*x/length)];
  const band=[1,-1].flatMap(side=>Array.from({length:65},(_,j)=>{
    const t=side===1?j/64:1-j/64,x=length*t,y=sign*bow*Math.sin(Math.PI*t),dy=sign*bow*Math.PI/length*Math.cos(Math.PI*t),d=Math.hypot(1,dy);
    return[x-side*.04*dy/d,y+side*.04/d];
  }));
  group.children.forEach(o=>o.visible=false);
  const shape=clip.difference(clip.union(poly(band),poly(circle([0,0],.13,48)),poly(circle([length,0],.055,32))),poly(circle([0,0],.082,48)));
  const body=new THREE.Mesh(plate(shape,-depth/2,depth/2),oldBody.material);body.userData.role='finite-bored-clock-click';group.add(body);
  const pin=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,.30,32),oldBody.material);pin.rotation.x=Math.PI/2;pin.userData.role='clock-click-journal-pin';
  // The journal belongs to the parent, so only the bored click turns about it.
  pin.position.copy(group.position);group.parent.add(pin);
  const supportCount=Math.ceil((length-.16)/.025);
  const supports=[...Array.from({length:supportCount+1},(_,i)=>{
    const p=centerAt(.13+(length-.13)*i/supportCount);return[Math.hypot(...p),.044,Math.atan2(p[1],p[0])];
  }),[length,.057,0]];
  function angleAt(relativeWheelAngle){
    const polygon=outline.map(p=>turn(p,relativeWheelAngle));let lift=-.30;
    for(const[L,r,localAngle]of supports){
      const take=q=>{const d=difference(q,pivot),candidate=sign*wrap(Math.atan2(d[1],d[0])-base-localAngle);if(candidate>lift&&candidate<.65)lift=candidate;};
      for(let i=0;i<polygon.length;i++){
        const A=polygon[i],B=polygon[(i+1)%polygon.length],edge=difference(B,A),h=Math.hypot(...edge),normal=[edge[1]/h,-edge[0]/h];
        // Determine exterior independently of handedness/winding.
        if(normal[0]*(A[0]+B[0])+normal[1]*(A[1]+B[1])<0){normal[0]*=-1;normal[1]*=-1;}
        const P=[A[0]+r*normal[0],A[1]+r*normal[1]],v=difference(P,pivot),u=[edge[0]/h,edge[1]/h],dot=v[0]*u[0]+v[1]*u[1],disc=dot*dot-(v[0]*v[0]+v[1]*v[1]-L*L);
        if(disc>=0)for(const t of [-dot-Math.sqrt(disc),-dot+Math.sqrt(disc)])if(t>=0&&t<=h)take([P[0]+t*u[0],P[1]+t*u[1]]);
        const d=difference(A,pivot),D=Math.hypot(...d);
        if(D>0&&D<=L+r&&D>=Math.abs(L-r)){
          const x=(L*L-r*r+D*D)/(2*D),y=Math.sqrt(Math.max(0,L*L-x*x));
          for(const s of [-1,1])take([pivot[0]+x*d[0]/D-s*y*d[1]/D,pivot[1]+x*d[1]/D+s*y*d[0]/D]);
        }
      }
    }
    return base+sign*lift;
  }
  const path=clickPaths[bakeKey];
  const playbackAngleAt=path ? angle=>{
    const phase=((angle/path.pitch)%1+1)%1,coordinate=phase*path.phaseScale,knots=path.knots;
    let lo=0,hi=knots.length-1;
    while(hi-lo>1){const mid=(lo+hi)>>1;if(knots[mid][0]<=coordinate)lo=mid;else hi=mid;}
    const a=knots[lo],b=knots[hi],t=(coordinate-a[0])/(b[0]-a[0]);
    return a[1]+t*(b[1]-a[1]);
  } : angleAt;
  // Keep the exact construction available to offline bakers and comparisons;
  // playback only searches the small periodic table.
  return{group,body,pin,wheel,pivot,length,base,sign,outline,angleAt,playbackAngleAt,bakeKey,
    bakeSignature:{pivot,length,base,sign,outline},
    update(angle){group.rotation.z=playbackAngleAt(angle);}};
}

export function correctEndlessMaintainingChain(root){
  const b=root.userData.blocks,g=root.userData.geometry;
  for(const[key,pulley]of [['A',b.ratchetPulley],['B',b.goingPulley],['S',b.smallPulley],['L',b.largePulley]]){
    const rotor=pulley.userData.rotor,body=rotor.children.find(o=>o.userData.role.endsWith('-body')),hub=rotor.children.find(o=>o.userData.role.endsWith('-hub'));
    const width=body.geometry.parameters.height,R=g.radii[key],bore=key==='A'||key==='B'?.132:.082;
    const clearanceRadius=g.chainRadius+.005;
    const outer=[[-width/2,R+.05],[-.075,R+.05],...Array.from({length:17},(_,i)=>{const z=clearanceRadius*(i/8-1);return[z,R-Math.sqrt(Math.max(0,clearanceRadius**2-z*z))];}),[.075,R+.05],[width/2,R+.05]].map(([axial,radial])=>({axial,radial}));
    replace(body,boredLatheGeometry(outer,bore,96));replace(hub,tube(Math.max(.13,R*.19),width*1.45,bore));
    for(const o of rotor.children)if(/roughened-flange|chain-groove|rotation-spoke/.test(o.userData.role))o.visible=false;
    pulley.userData.workingBody=body;pulley.userData.workingHub=hub;
  }
  for(const[size,carrier,length]of [['small',b.smallCarrier,1.25],['large',b.largeCarrier,1.35]]){
    const hanger=carrier.children.find(o=>o.userData.role?.endsWith('hanger'));hanger.children.forEach(o=>o.visible=false);hanger.position.z=.42;
    const shape=clip.difference(clip.union(capsule([0,0],[0,-length],.065,16),poly(circle([0,0],.14,48))),poly(circle([0,0],.082,48)));
    const eye=new THREE.Mesh(plate(shape,-.075,.075),hanger.children[0].material);eye.userData.role='bored-moving-weight-hanger';hanger.add(eye);
    const pin=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,.80,32),eye.material);pin.rotation.x=Math.PI/2;pin.position.z=.12;carrier.add(pin);
    b[`${size}Weight`].position.z=.20;b[`${size}Hanger`]=eye;b[`${size}Axle`]=pin;
  }
  // The laid rope keeps its buffers (constant length) and closes its lay seam itself.
  const mesh=b.ratchetPulley.userData.rotor.children.find(o=>o.userData.role==='ratchet-wheel-riding-on-arbor-p');
  const center=[b.ratchetPulley.position.x,b.ratchetPulley.position.y];
  b.pawl.position.z=g.chainPlaneZ+mesh.position.z;
  const length=b.pawl.children[0].geometry.parameters.width,p=turn([length,0],b.pawl.rotation.z),angle=Math.atan2(b.pawl.position.y-center[1]+p[1],b.pawl.position.x-center[0]+p[0]);
  const outline=ratchet(mesh,{radius:.76,bore:.132,teeth:g.ratchetToothCount,hand:1,phase:angle+.05*g.ratchetToothPitch,depth:.16});
  const follower=makeFollower(b.pawl,mesh,center,outline,.12,'320-p');b.finiteClicks=[follower];
  replace(follower.pin,new THREE.CylinderGeometry(.08,.08,1.05,32));follower.pin.position.z=.125;
  const support=new THREE.Mesh(new THREE.BoxGeometry(.16,.35,.20),b.fixedFrame.children[0].children[0].material);
  support.position.set(b.pawl.position.x,b.pawl.position.y+.175,-.45);b.fixedFrame.add(support);
  root.userData.updateClockInterfaces=state=>follower.update(state.pulleys.A.angle);
  root.userData.hideGround=true;root.userData.minimumDisplayCycleSeconds=12;
  root.userData.reconstructionNote='The endless chain preserves its length and no-slip travel through the prescribed winding cycle. Grooves and moving journals have finite clearances. Click motion is a geometric follower; weight forces, friction and the passive ratchet handoff are not dynamically validated.';
}

export function correctGoingBarrel(root){
  const b=root.userData.blocks,g=root.userData.geometry;
  const bearing=b.fixedFrame.children.find(o=>o.userData.role==='fixed-coaxial-going-barrel-bearing');
  replace(bearing,tube(.34,.35,.142));b.rearBearing=bearing;
  replace(b.barrelHub,new THREE.CylinderGeometry(.14,.14,2.55,40));b.barrelHub.position.z=.10;
  const wheelBody=b.greatWheel.userData.rotor.children[0],wheelHub=b.greatWheel.userData.rotor.children[1];
  const sourceShape=wheelBody.geometry.parameters.shapes.clone();
  const hole=new THREE.Path();hole.absarc(0,0,.142,0,TAU,false);sourceShape.holes.push(hole);
  const wheelGeometry=new THREE.ExtrudeGeometry(sourceShape,{depth:.30,bevelEnabled:false,curveSegments:32});wheelGeometry.translate(0,0,-.15);replace(wheelBody,wheelGeometry);
  replace(wheelHub,tube(g.greatWheelPitchRadius*.19,.405,.142));b.greatWheelBody=wheelBody;b.greatWheelHub=wheelHub;
  const ratchetHub=new THREE.Mesh(tube(.28,.10,.142).rotateX(Math.PI/2),b.largeRatchetMesh.material);ratchetHub.position.z=-.02;b.largeRatchet.userData.rotor.add(ratchetHub);b.largeRatchetHub=ratchetHub;
  for(let i=0;i<3;i++){const a=i*TAU/3,spoke=new THREE.Mesh(new THREE.BoxGeometry(1.30,.14,.10),b.largeRatchetMesh.material);spoke.position.set(.9*Math.cos(a),.9*Math.sin(a),-.02);spoke.rotation.z=a;b.largeRatchet.userData.rotor.add(spoke);}
  replace(b.barrelBody,tube(g.barrelFaceRadius,.43,.142));
  replace(b.ropeDrum,tube(g.ropeDrumPitchRadius-.035,.24,.142));b.ropeDrum.position.z=1.19;
  // Bring each click into its own ratchet layer; their pivots retain the source planar positions.
  b.clickR.position.z=b.barrel.position.z+b.barrelRatchet.position.z;
  b.clickT.position.z=b.largeRatchetMesh.position.z;
  const setups=[['R',b.clickR,b.barrelRatchet,g.barrelRatchetPitchRadius*1.04,g.barrelRatchetToothCount,-1,.142,.16],['T',b.clickT,b.largeRatchetMesh,g.largeRatchetOuterRadius,g.largeRatchetToothCount,1,g.largeRatchetInnerRadius,.19]];
  b.finiteClicks=[];
  for(const[name,pawl,mesh,radius,teeth,hand,bore,depth]of setups){
    const p=pawl.userData.contact,phase=Math.atan2(p.y,p.x)+hand*.05*TAU/teeth;
    const outline=ratchet(mesh,{radius,bore,teeth,hand,phase,depth});
    const follower=makeFollower(pawl,mesh,[0,0],outline,.12,`321-${name}`);follower.name=name;b.finiteClicks.push(follower);
    replace(follower.pin,new THREE.CylinderGeometry(.08,.08,name==='R'?.99:.80,32));
    follower.pin.position.z=name==='R'?.395:-.25;
  }
  // An exposed front groove explains the rope's otherwise hidden barrel contact.
  const wrap=new THREE.CatmullRomCurve3(Array.from({length:65},(_,i)=>{const a=Math.PI-1.7*Math.PI*i/64;return new THREE.Vector3(g.ropeDrumPitchRadius*Math.cos(a),g.ropeDrumPitchRadius*Math.sin(a),1.48);}));
  b.ropeWrap=new THREE.Mesh(new THREE.TubeGeometry(wrap,128,.035,10,false),b.rope.material);b.ropeWrap.userData.role='exposed-weight-rope-barrel-wrap';root.add(b.ropeWrap);
  root.userData.updateClockInterfaces=state=>{
    b.finiteClicks[0].update(state.barrelAngle-state.largeRatchetAngle);
    b.finiteClicks[1].update(state.largeRatchetAngle);
    root.userData.contacts={...state.contacts,nominalPitchReferencesOnly:true};
  };
  root.userData.hideGround=true;root.userData.minimumDisplayCycleSeconds=20;
  root.userData.cameraFitBounds.min.y=-5.15;root.userData.cameraFitBounds.max.z=1.90;
  root.userData.reconstructionNote='The weight, spring and winding sequence are prescribed. The two clicks follow finite opposite-handed ratchets geometrically; their impact, spring bias and passive handoff are not force-validated. The maintaining spring uses an ideal torque law and a constant-length illustrative curve. The front rope groove exposes the inferred winding drum.';
}
