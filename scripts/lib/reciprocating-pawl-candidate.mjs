import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';
import {makeReciprocatingPawlStudy,reciprocatingPawlSource,pawlSourcePoint} from './reciprocating-pawl-contact-study.mjs';
import {turnedClutchGeometry} from '../../src/simulation/clutch-section-geometry.js';
import {PALETTE,matte,markShadows} from '../../src/simulation/primitives.js';

const rotate=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)],
  sub=(a,b)=>a.map((v,i)=>v-b[i]),add=(a,b)=>a.map((v,i)=>v+b[i]),
  close=p=>[...p,p[0]],poly=p=>[[close(p)]],
  circle=(center,r,count=512)=>Array.from({length:count},(_,i)=>add(center,[r*Math.cos(i*2*Math.PI/count),r*Math.sin(i*2*Math.PI/count)]));
const capsule=(a,b,r)=>{
  const angle=Math.atan2(b[1]-a[1],b[0]-a[0]),points=[];
  for(const [center,start] of [[b,angle-Math.PI/2],[a,angle+Math.PI/2]])for(let i=0;i<=128;i++)
    points.push(add(center,[r*Math.cos(start+Math.PI*i/128),r*Math.sin(start+Math.PI*i/128)]));
  return poly(points);
};
const plate=(polygons,low,high)=>{
  const clean=ring=>{
    const points=[];
    for(const p of ring){const q=p.map(Math.fround),last=points.at(-1);if(!last||last[0]!==q[0]||last[1]!==q[1])points.push(q);}
    if(points[0][0]===points.at(-1)[0]&&points[0][1]===points.at(-1)[1])points.pop();
    let changed=true;
    while(changed){changed=false;
      for(let i=0;i<points.length;i++){
        const a=points[(i+points.length-1)%points.length],b=points[i],c=points[(i+1)%points.length],
          d=sub(c,a),v=sub(b,a),length=Math.hypot(...d),projection=v[0]*d[0]+v[1]*d[1];
        if(length>0&&projection>=0&&projection<=length*length&&Math.abs(v[0]*d[1]-v[1]*d[0])/length<1e-7){
          points.splice(i,1);changed=true;break;
        }
      }
    }
    return points;
  };
  const shapes=polygons.map(([outer,...holes])=>{
    const shape=new THREE.Shape(clean(outer).map(p=>new THREE.Vector2(...p)));
    shape.holes=holes.map(r=>new THREE.Path(clean(r).map(p=>new THREE.Vector2(...p))));return shape;
  });
  const geometry=new THREE.ExtrudeGeometry(shapes,{depth:high-low,bevelEnabled:false,curveSegments:1});
  geometry.translate(0,0,low);geometry.userData.plate={low,high};return geometry;
};
const turned=(profile,count=512)=>turnedClutchGeometry(profile,{angularSegments:count});
const disk=(r,low,high)=>turned([[low,0],[low,r],[high,r],[high,0]]);
const ring=(inner,outer,low,high)=>turned([[low,inner],[low,outer],[high,outer],[high,inner]]);
const spline=points=>new THREE.SplineCurve(points.map(p=>new THREE.Vector2(...p))).getPoints(128).map(p=>p.toArray());


// A pawl is one smooth plate: a round boss bored for its pin, two smooth
// cubic edges of equal thickness, straight flanks that lie just inside the
// two walls of the seated tooth valley, and the finite contact nose as the
// round of the wedge tip. The flanks turn `relief` radians inward from the
// walls so the wedge fills the valley without touching either wall.
export function smoothPawlOutline({nose,noseRadius:r,normals,start,startDirection,thickness,startThickness=thickness,relief=.05,
  startHandle=.35,endHandle=.35,samples=96}){
  const unit=v=>{const l=Math.hypot(...v);return v.map(x=>x/l);},perp=v=>[-v[1],v[0]],
    dot2=(a,b)=>a[0]*b[0]+a[1]*b[1],cross2=(a,b)=>a[0]*b[1]-a[1]*b[0],scale=(v,k)=>v.map(x=>x*k);
  const u=unit(add(normals[0],normals[1])),half=Math.acos(Math.max(-1,Math.min(1,dot2(u,normals[0])))),
    reliefs=Array.isArray(relief)?relief:[relief,relief];
  // Half the valley angle is pi/2 - half; each flank turns in by its relief
  // (one value, or one per wall in `normals` order).
  const flankHalf=Math.PI/2-half-(reliefs[0]+reliefs[1])/2;
  if(!(flankHalf>.05))throw new Error('Valley too narrow for a wedge pawl tip');
  const along=(thickness/2-r)/Math.tan(flankHalf),edges=normals.map((n,index)=>{const relief=reliefs[index];
    // Flank direction: along the wall, away from the root, turned toward u.
    let f=unit(perp(n));if(dot2(f,u)<0)f=scale(f,-1);
    const turn=Math.sign(cross2(f,u)),c=Math.cos(turn*relief),s=Math.sin(turn*relief);f=[f[0]*c-f[1]*s,f[0]*s+f[1]*c];
    let m=perp(f);if(dot2(m,n)<0)m=scale(m,-1);
    const tangent=sub(nose,scale(m,r)),end=add(tangent,scale(f,along/Math.cos(flankHalf)));
    return{n,f,m,tangent,end,relief,left:cross2(scale(u,-1),sub(end,nose))>0};
  });
  const d0=unit(startDirection),left=perp(d0),bezier=(a,b,c,d)=>Array.from({length:samples+1},(_,i)=>{
    const t=i/samples,v=1-t;return[0,1].map(k=>v*v*v*a[k]+3*v*v*t*b[k]+3*v*t*t*c[k]+t*t*t*d[k]);});
  const edge=e=>{
    const s0=add(start,scale(left,(e.left?1:-1)*startThickness/2)),chord=Math.hypot(...sub(e.end,s0));
    return[...bezier(s0,add(s0,scale(d0,startHandle*chord)),add(e.end,scale(e.f,endHandle*chord)),e.end),e.tangent];
  };
  const [a,b]=edges[0].left?edges:[edges[1],edges[0]],edgeA=edge(a),edgeB=edge(b);
  // Nose arc from a's tangent point round the tip (the side facing -u) to b's.
  const angleA=Math.atan2(-a.m[1],-a.m[0]),angleB=Math.atan2(-b.m[1],-b.m[0]),tip=Math.atan2(-u[1],-u[0]);
  let sweep=angleB-angleA;while(sweep>0)sweep-=2*Math.PI;
  const wrap=x=>((x%(2*Math.PI))+2*Math.PI)%(2*Math.PI);
  if(wrap(angleA-tip)>-sweep)sweep+=2*Math.PI;
  const arc=Array.from({length:24},(_,i)=>{const t=angleA+sweep*(i+1)/25;return add(nose,[r*Math.cos(t),r*Math.sin(t)]);});
  return{outline:[...edgeA,...arc,...edgeB.slice().reverse()],axis:u,flankHalf,along,edges};
}
// Wheel-local wall normals of the tooth valley at the nose seat.
export function seatWallNormals(points,seat,radius){
  const list=points.map((a,i)=>{const b=points[(i+1)%points.length],d=sub(b,a),t=Math.max(0,Math.min(1,
    ((seat[0]-a[0])*d[0]+(seat[1]-a[1])*d[1])/(d[0]*d[0]+d[1]*d[1]))),c=add(a,d.map(v=>v*t)),delta=sub(seat,c),l=Math.hypot(...delta);
    return{distance:l,normal:delta.map(v=>v/l)};}).sort((a,b)=>a.distance-b.distance);
  const first=list[0],second=list.find(e=>first.normal[0]*e.normal[0]+first.normal[1]*e.normal[1]<.5);
  if(Math.abs(first.distance-radius)>1e-4||Math.abs(second.distance-radius)>1e-4)throw new Error('Seat is not tangent to two valley walls');
  return[first.normal,second.normal];
}

export function meshFamilyMass(parts,families,family){
  let volume=0,moment=[0,0,0];
  for(const [name,mesh] of Object.entries(parts))if(families[name]===family){
    mesh.updateMatrix();const g=mesh.geometry,p=g.attributes.position,index=g.index;
    for(let i=0;i<(index?.count??p.count);i+=3){
      const a=new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(mesh.matrix),
        b=new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+1):i+1).applyMatrix4(mesh.matrix),
        c=new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+2):i+2).applyMatrix4(mesh.matrix),
        v=a.dot(new THREE.Vector3().crossVectors(b,c))/6;
      volume+=v;for(let k=0;k<3;k++)moment[k]+=v*(a.getComponent(k)+b.getComponent(k)+c.getComponent(k))/4;
    }
  }
  if(!(volume>0))throw new Error('Invalid pawl mesh mass');
  return{volume,centroid:moment.map(v=>v/volume)};
}

export function makeReciprocatingPawlCandidate(options={}){
  const motion=options.motionOverride??makeReciprocatingPawlStudy({teeth:34,faceAngle:.06,sourcePoseGravity:true,closure:'analytic',...options}),p=motion.parameters,
    source=motion.atTime?motion.atTime(0):motion.atPhase(p.sourcePhase),root=new THREE.Group(),parts={},families={},blocks={};
  for(const name of ['wheel','bar','movingPawl','holdingPawl','rod','fixed']){blocks[name]=new THREE.Group();root.add(blocks[name]);}
  const attach=(name,geometry,family,color,position=[0,0,0])=>{
    const mesh=new THREE.Mesh(geometry,matte(color,{metalness:.17,roughness:.61}));
    mesh.name=name;mesh.position.fromArray(position);blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;
  };
  const bore=.091,pinRadius=.035,rodLength=1.16,sourceRod=pawlSourcePoint(reciprocatingPawlSource.rodJoint),
    rodX=sourceRod[0],rodJoint=rotate(sourceRod,-p.sourceBarAngle),
    barOutline=polygonClipping.union(capsule([-p.barRadius,0],[0,0],.04),poly(circle([0,0],.18)),
      capsule([0,0],rodJoint,.04),poly(circle(rodJoint,.084)),poly(circle([-p.barRadius,0],.083))),
    barPolygons=polygonClipping.difference(barOutline,poly(circle([0,0],bore)),poly(circle(rodJoint,pinRadius)));
  attach('wheelBody',plate(polygonClipping.difference(poly(motion.points),poly(circle([0,0],bore))),-.055,.045),'wheel',PALETTE.driven);
  attach('wheelFace',ring(bore,.7453,.045,.053),'wheel',PALETTE.driven);
  attach('wheelRearHub',ring(bore,.135,-.09,-.055),'wheel',PALETTE.brass);
  attach('barBody',plate(barPolygons,.079,.134),'bar',PALETTE.brass);
  attach('wheelAxle',disk(.088,-.24,.143),'fixed',PALETTE.muted);
  attach('movingPawlPin',disk(.04,options.planarPawls?-.055:.134,options.planarPawls?.143:.202),'bar',PALETTE.muted,[-p.barRadius,0,0]);
  attach('holdingPawlPin',disk(.043,-.13,options.planarPawls?.055:.202),'fixed',PALETTE.muted,[...p.PH,0]);
  attach('holdingPawlRearCollar',disk(.066,-.15,options.planarPawls?-.058:.12),'fixed',PALETTE.brass,[...p.PH,0]);
  const definitions=[
    {family:'movingPawl',kind:'B',outer:[[256,363],[300,325],[350,299],[397,288],[441,291],[479,304],[501,320]],
      inner:[[295,390],[333,354],[377,326],[419,311],[456,307],[483,313],[501,320]],head:.09,hole:.043,
      smooth:{thickness:.1,startHandle:.32,endHandle:.3,relief:.07}},
    {family:'holdingPawl',kind:'H',outer:[[1000,305],[1014,340],[1011,381],[994,420],[977,446],[958,466]],
      inner:[[976,345],[970,375],[961,400],[953,417],[952,444],[948,479]],head:.108,hole:.046,
      smooth:{thickness:.1,startHandle:.4,endHandle:.4,startDirection:[.5,-1],relief:[.05,.14]}}
  ];
  // Seat each smooth pawl in its valley: find the pawl angle whose nose lies on
  // the seat radius, then express the valley walls in the pawl's own frame.
  const smoothOutline=(d,pivot,nose,local)=>{
    const radiusAt=a=>Math.hypot(...add(pivot,rotate(nose,a)));let low=-.3,high=.3;
    const target=p.seatRadius,sign=Math.sign(radiusAt(high)-target);
    if(sign===Math.sign(radiusAt(low)-target))throw new Error('No seated pawl angle');
    for(let i=0;i<60;i++){const m=(low+high)/2;if(Math.sign(radiusAt(m)-target)===sign)high=m;else low=m;}
    const a=(low+high)/2,world=add(pivot,rotate(nose,a)),w=Math.atan2(world[1],world[0])-p.seatAngle,
      normals=seatWallNormals(motion.points,p.seat,p.noseRadius).map(n=>rotate(n,w-a)),
      center=[0,1,2].map(i=>local(d.outer[i]).map((v,k)=>(v+local(d.inner[i])[k])/2)),
      startDirection=d.smooth.startDirection??center[1];
    // The edges leave the boss tangentially: they start on its rim, square to
    // the start direction.
    return smoothPawlOutline({nose,noseRadius:p.noseRadius,normals,start:[0,0],startThickness:2*d.head*.995,...d.smooth,startDirection}).outline;
  };
  const area=polygons=>polygons.reduce((sum,[outer,...holes])=>sum+[outer,...holes].reduce((a,ring,k)=>{
    let v=0;for(let i=0;i+1<ring.length;i++)v+=ring[i][0]*ring[i+1][1]-ring[i+1][0]*ring[i][1];return a+(k?-1:1)*Math.abs(v)/2;},0),0),reliefArea={};
  for(const d of definitions){
    const pivot=source[d.kind].pivot,nose=sub(source[d.kind].center,pivot),
      local=point=>sub(pawlSourcePoint(point),pivot),
      outer=spline([...d.outer.slice(0,-1).map(local),nose]),inner=spline([...d.inner.slice(0,-1).map(local),nose]),
      outline=options.smoothPawls?smoothOutline(d,pivot,nose,local):[...outer,...inner.slice(0,-1).reverse()],
      body=polygonClipping.difference(polygonClipping.union(poly(outline),poly(circle([0,0],d.head)),...(options.smoothPawls?[]:[poly(circle(nose,p.noseRadius))])),poly(circle([0,0],d.hole)));
    let fitted=body;
    if(options.planarPawls){
      // Relieve the source outline against the complete relative tooth sweep.
      // The solid pawl itself now reaches the wheel's working plane.
      const sweepSamples=options.smoothPawls?Number(process.env.SWEEP_SAMPLES??4096):512;
      for(let i=0;i<=sweepSamples;i++){
        const s=motion.atPhase(i/sweepSamples),angle=d.kind==='B'?(s.angleB??s.barAngle-p.sourceBarAngle+s.B.angle):(s.angleH??s.H.angle-p.sourceHAngle),
          pivot=s[d.kind].pivot,obstacle=poly(motion.points.map(point=>rotate(sub(rotate(point,s.wheelAngle),pivot),-angle)));
        fitted=polygonClipping.difference(fitted,obstacle);
      }
      // The smooth tip already ends in the nose round; restore only the nose round that the
      // sweep grazes at its tangent contacts.
      fitted=polygonClipping.union(fitted,options.smoothPawls?polygonClipping.intersection(body,poly(circle(nose,p.noseRadius,96))):poly(circle(nose,p.noseRadius)));
    }
    reliefArea[d.kind]=area(body)-area(fitted);reliefArea[d.kind+"Removed"]=polygonClipping.difference(body,fitted);
    attach(d.family+'Body',plate(fitted,options.planarPawls?-.055:.151,options.planarPawls?.045:.195),d.family,PALETTE.brass);
    if(!options.planarPawls)attach(d.family+'Nose',disk(p.noseRadius,-.058,.151),d.family,PALETTE.brass,[...nose,0]);
  }
  const rodPolygons=polygonClipping.difference(polygonClipping.union(capsule([0,0],[0,-1.16],.035),poly(circle([0,0],.091))),poly(circle([0,0],pinRadius)));
  attach('rodBody',plate(rodPolygons,options.planarPawls?.057:.21,options.planarPawls?.075:.258),'rod',PALETTE.driver);
  attach('rodPin',disk(pinRadius,options.planarPawls?.057:.075,options.planarPawls?.173:.26),'rod',PALETTE.muted);
  if(options.planarPawls)attach('rodJointBushing',ring(pinRadius,.083,.137,.158),'rod',PALETTE.brass);
  const massB=meshFamilyMass(parts,families,'movingPawl'),massH=meshFamilyMass(parts,families,'holdingPawl'),
    density=1/massB.volume,period=p.period??2.4;
  const atPhase=(phase,cycle=0)=>{
    const state=motion.atPhase(phase,cycle),angleB=state.angleB??state.barAngle-p.sourceBarAngle+state.B.angle,
      angleH=state.angleH??state.H.angle-p.sourceHAngle,rodPosition=rotate(rodJoint,state.barAngle),
      rodAngle=Math.asin((rodX-rodPosition[0])/rodLength),rodY=rodPosition[1];
    state.B.gravityMoment=-9.81*rotate(massB.centroid,angleB)[0];
    state.H.gravityMoment=-9.81*density*massH.volume*rotate(massH.centroid,angleH)[0];
    return{...state,angleB,angleH,rodY,rodPosition,rodAngle,stage:phase<=.5?'drive':'return'};
  };
  const stateAtTime=time=>{const coordinate=p.sourcePhase+time/period,cycle=Math.floor(coordinate);return{time,...atPhase(coordinate-cycle,cycle)};};
  const update=time=>{
    const s=stateAtTime(time);blocks.wheel.rotation.z=s.wheelAngle;blocks.bar.rotation.z=s.barAngle;
    blocks.movingPawl.position.set(...s.B.pivot,0);blocks.movingPawl.rotation.z=s.angleB;
    blocks.holdingPawl.position.set(...p.PH,0);blocks.holdingPawl.rotation.z=s.angleH;
    blocks.rod.position.set(...s.rodPosition,0);blocks.rod.rotation.z=s.rodAngle;root.userData.kinematics=s;
  };
  root.userData={parts,families,blocks,motion,atPhase,stateAtTime,geometry:{...p,period,rodJoint,rodLength,rodX,pinRadius,bore},
    mass:{B:massB,H:massH,density},reliefArea,mechanism:'isolated-reciprocating-rod-pawl-ratchet',fidelity:'candidate',hideGround:true,cameraFov:8,
    animationTiming:{authoredCyclePeriod:period},shadowCameraHalfExtent:2.5,shadowBias:-.00003,shadowNormalBias:.005,
    qualification:'Isolated finite-solid candidate. Uses planar quasistatic pawl contact; actual mesh mass, forces, all independent clearances and source appearance require verification. No inertia is included.'};
  update(0);markShadows(root);return{root,update,motion,cameraDirection:new THREE.Vector3(0,0,10)};
}
