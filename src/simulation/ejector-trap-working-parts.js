import * as THREE from 'three';
import {plate,poly,circle,capsule,polygonClipping as clip} from './finite-plate-geometry.js';
import {horizontalRing,horizontalTurned} from './horizontal-turbine-solids.js';
import {curvedPipeWall} from './finite-fluid-passages.js';
import {mirroredForkWall} from './mirrored-fork-pipe.js';
import {waterFountainGeometry,waterJetMaterial,waterVolumeMaterial} from './water-volume.js';
import {fitPistonGuide} from './piston-guide-parts.js';
import {helicalThread,threadAngles} from './mujoco-screw/thread-geometry.js';
const replace=(o,g)=>{o.geometry.dispose();o.geometry=g;};
const add=(parent,g,material,role)=>{const o=new THREE.Mesh(g,material);o.userData.role=role;parent.add(o);return o;};

// A closed wall around a meridian, including finite returns at the explicitly
// opened side-port cells. The openings are reconstruction dimensions, not seals.
function portedMeridian(levels,outer,inner,open=()=>false) {
  const n=128,positions=[],active=(i,j)=>j>=0&&j<levels.length-1&&!open((i+.5)*2*Math.PI/n,(levels[j]+levels[j+1])/2);
  const point=(r,y,i)=>new THREE.Vector3(r*Math.cos(i*2*Math.PI/n),y,r*Math.sin(i*2*Math.PI/n));
  const face=(p,normal)=>{if(p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0])).dot(normal)<0)p.reverse();for(const k of[0,1,2,0,2,3])positions.push(...p[k].toArray());};
  for(let j=0;j<levels.length-1;j++)for(let i=0;i<n;i++)if(active(i,j)) {
    const a=levels[j],b=levels[j+1],theta=(i+.5)*2*Math.PI/n;
    for(const[r,sign]of[[outer,1],[inner,-1]])face([point(r(a),a,i),point(r(a),a,i+1),point(r(b),b,i+1),point(r(b),b,i)],new THREE.Vector3(sign*Math.cos(theta),0,sign*Math.sin(theta)));
    for(const[next,y,sign]of[[j-1,a,-1],[j+1,b,1]])if(!active(i,next))face([point(inner(y),y,i),point(outer(y),y,i),point(outer(y),y,i+1),point(inner(y),y,i+1)],new THREE.Vector3(0,sign,0));
    for(const[next,k,sign]of[[(i+n-1)%n,i,-1],[(i+1)%n,i+1,1]])if(!active(next,j))face([point(inner(a),a,k),point(outer(a),a,k),point(outer(b),b,k),point(inner(b),b,k)],new THREE.Vector3(-sign*Math.sin(k*2*Math.PI/n),0,sign*Math.cos(k*2*Math.PI/n)));
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();return g;
}
// Pass 90 (475): a closed wall of revolution (outer radius R(y), inner Ri(y))
// with one round bored port where a straight pipe axis (P0, T) of radius rho
// crosses it. The shell is a (theta, y) grid; cells cut by the port are
// clipped against its exact outline on each surface, the bore joins the two
// outlines, and the ends are capped. Normals are analytic, so the curved
// shell shades smoothly.
function roundPortedShell(levels,R,Ri,P0,T,rho,n=128){
 const pos=[],nor=[],dR=(f,y)=>(f(y+1e-4)-f(y-1e-4))/2e-4;
 const U=new THREE.Vector3(0,1,0).cross(T).normalize(),V=T.clone().cross(U).normalize();
 const outline=(f)=>{const pts=[];for(let k=0;k<96;k++){const phi=k/96*2*Math.PI,off=U.clone().multiplyScalar(rho*Math.cos(phi)).addScaledVector(V,rho*Math.sin(phi));
  const g=s=>{const q=P0.clone().addScaledVector(T,s).add(off);return Math.hypot(q.x,q.z)-f(q.y);};let a=-.6,b=.6;const ga=g(a);for(let i=0;i<60;i++){const m=(a+b)/2;if((g(m)>0)===(ga>0))a=m;else b=m;}
  const q=P0.clone().addScaledVector(T,(a+b)/2).add(off);pts.push({p:q,phi,uv:[Math.atan2(q.z,q.x),q.y]});}return pts;};
 const tri=(a,b,c,na,nb,nc,want)=>{const e=b.clone().sub(a).cross(c.clone().sub(a));if(e.dot(want)<0){[b,c]=[c,b];[nb,nc]=[nc,nb];}for(const v of[a,b,c])pos.push(v.x,v.y,v.z);for(const m of[na,nb,nc])nor.push(m.x,m.y,m.z);};
 const surface=(f,sign,hole)=>{
  const P=(t,y)=>new THREE.Vector3(f(y)*Math.cos(t),y,f(y)*Math.sin(t)),N=(t,y)=>new THREE.Vector3(Math.cos(t),-dR(f,y),Math.sin(t)).normalize().multiplyScalar(sign);
  const holeRing=hole.map(h=>h.uv);holeRing.push(holeRing[0]);let tMin=Infinity,tMax=-Infinity,yMin=Infinity,yMax=-Infinity;for(const[t,y]of holeRing){tMin=Math.min(tMin,t);tMax=Math.max(tMax,t);yMin=Math.min(yMin,y);yMax=Math.max(yMax,y);}
  const emit=(poly2)=>{const ring=poly2[0].slice(0,-1).map(([t,y])=>new THREE.Vector2(t,y)),holes=poly2.slice(1).map(r=>r.slice(0,-1).map(([t,y])=>new THREE.Vector2(t,y)));
   const all=[...ring,...holes.flat()];for(const[a,b,c]of THREE.ShapeUtils.triangulateShape(ring,holes)){const[A,B,C]=[all[a],all[b],all[c]];tri(P(A.x,A.y),P(B.x,B.y),P(C.x,C.y),N(A.x,A.y),N(B.x,B.y),N(C.x,C.y),N((A.x+B.x+C.x)/3,(A.y+B.y+C.y)/3));}};
  for(let j=0;j<levels.length-1;j++)for(let i=0;i<n;i++){const t0=-Math.PI+i*2*Math.PI/n,t1=t0+2*Math.PI/n,y0=levels[j],y1=levels[j+1];
   const quad=[[[t0,y0],[t1,y0],[t1,y1],[t0,y1],[t0,y0]]];
   if(t1<tMin||t0>tMax||y1<yMin||y0>yMax){emit(quad);continue;}
   for(const piece of clip.difference(quad,[holeRing]))emit(piece);}
  return P;};
 const outerHole=outline(R),innerHole=outline(Ri);
 surface(R,1,outerHole);surface(Ri,-1,innerHole);
 // The bore of the port, facing the pipe.
 for(let k=0;k<96;k++){const a=outerHole[k],b=outerHole[(k+1)%96],c=innerHole[(k+1)%96],d=innerHole[k];
  const na=U.clone().multiplyScalar(-Math.cos(a.phi)).addScaledVector(V,-Math.sin(a.phi)),nb=U.clone().multiplyScalar(-Math.cos(b.phi)).addScaledVector(V,-Math.sin(b.phi));
  tri(a.p,b.p,c.p,na,nb,nb,na.clone().add(nb));tri(a.p,c.p,d.p,na,nb,na,na.clone().add(nb));}
 // End rims.
 for(const[y,sy]of[[levels[0],-1],[levels.at(-1),1]])for(let i=0;i<n;i++){const t0=i*2*Math.PI/n,t1=t0+2*Math.PI/n,q=(r,t)=>new THREE.Vector3(r*Math.cos(t),y,r*Math.sin(t)),up=new THREE.Vector3(0,sy,0);
  tri(q(Ri(y),t0),q(R(y),t0),q(R(y),t1),up,up,up,up);tri(q(Ri(y),t0),q(R(y),t1),q(Ri(y),t1),up,up,up,up);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));return g;
}
const sweepShape=(curve,r)=>{const points=curve.getPoints(40);return clip.union(...points.slice(1).map((p,i)=>capsule([points[i].x,points[i].y],[p.x,p.y],r,12)));};

// The start, run and stop loop shared by the jet ejectors 475 and 476. The
// steam purges the air (the water still at the bilge), the vacuum draws the
// water up to the mouth of C, the ejector runs full and discharges through C,
// and at shut-off the discharge collapses and the water falls back. Smoothstep
// ramps are prescribed; no priming transient is integrated.
export function ejectorOperatingStage(phase) {
  const s=THREE.MathUtils.smoothstep,running=phase<.85;
  const stage=phase<.08?'purging-air-from-D-and-C':phase<.40?'water-rising-to-the-mouth-of-C':running?'running-discharging-through-C':'steam-off-water-falling-back';
  return {stage,steamSupplyOpen:running,levelFraction:running?s(phase,.08,.40):1-s(phase,.85,1),
    dischargeFraction:running?s(phase,.40,.48):1-s(phase,.85,.89)};
}
// The free discharge issuing from the open mouth of C: a translucent water
// column the width of the bore, slightly swelling as it slows, with a rounded
// crown. Its height follows the discharge fraction of the state.
// The discharge wells up out of the open mouth of C and spills over its lip
// as a thin sheet running down round the outside of the pipe, thinning out:
// water attached to the mouth, not a cap standing on it. It grows with the
// discharge fraction (vertical scale), keeping its clearance to the lip.
function dischargeJet(root,mouthY,bore,outer,role,sector={}) {
  const apex=.2,fallY=-.85,thickness=.03,columnRadius=bore*.98,r0=columnRadius*.72;
  // Fraction of the crown where its inner skin passes the mouth plane.
  const s0=Math.sqrt(apex/(apex+thickness-fallY));
  const crownRadius=r0+(outer+.05+thickness-r0)/s0;
  const jet=add(root,waterFountainGeometry({nozzleY:-.04,apexY:apex,columnRadius,crownRadius,fallY,crownThickness:thickness,fadeStart:.5,crownAlpha:.8,...sector}),waterJetMaterial({opacity:.42}),role);
  jet.renderOrder=2;jet.position.y=mouthY;
  // A trickle is faint as well as short, so the sheet fades in and out
  // with the discharge rather than switching on at the lip.
  const opacity=jet.material.opacity;
  return fraction=>{jet.visible=fraction>1e-4;jet.scale.y=Math.max(1e-4,fraction);jet.material.opacity=opacity*THREE.MathUtils.smoothstep(fraction,0,.15);};
}

export function correctEjectorTrapParts(root,id,update) {
  const d=root.userData,b=d.blocks,g=d.geometry;
  if(id===475) {
    const steamCurve=d.flowPaths.steamPipeCurve;steamCurve.points.at(-2).set(0,.46,0);steamCurve.updateArcLengths();d.flowPaths.steamFlowCurve.updateArcLengths();
    replace(b.steamPipeCore,new THREE.TubeGeometry(steamCurve,90,.085,16,false));
    const profile=[[-1.16,.53],[-1.02,.89],[-.65,1.23],[-.08,1.38],[.48,1.30],[1.05,1.04],[1.56,.57]];
    // A smooth spline through Brown's pear section, sampled densely, so D's
    // silhouette is a continuous curve instead of a seven-facet polygon.
    const smooth=new THREE.SplineCurve(profile.map(([y,r])=>new THREE.Vector2(y,r))).getPoints(240).map(p=>[p.x,p.y]);
    const radius=y=>{const found=smooth.findIndex(p=>p[0]>=y),k=found<0?smooth.length-1:Math.max(1,found);const[a,r]=smooth[k-1],[c,s]=smooth[k];return r+(s-r)*(y-a)/(c-a);};
    // Pass 90: pipe A passes through D's wall in a round bore 0.002 larger
    // than the pipe (it was a square window of grid cells, leaving a wedge
    // sliver over the pipe), and the shell shades smoothly.
    const levels=Array.from({length:61},(_,i)=>-1.16+2.72*i/60);
    {const c=d.flowPaths.steamPipeCurve,f=t=>{const q=c.getPoint(t);return Math.hypot(q.x,q.z)-radius(q.y);};let lo=0,hi=.6;for(let i=0;i<60;i++){const m=(lo+hi)/2;if(f(m)>0)lo=m;else hi=m;}
     const t=(lo+hi)/2,P0=c.getPoint(t),T=c.getTangent(t).normalize();
     replace(b.chamber,roundPortedShell(levels,radius,y=>radius(y)-.065,P0,T,.202));b.chamber.userData.port={center:P0,axis:T,radius:.202};}
    replace(b.suctionPipe,horizontalRing(.40,.47,-.895,.895,64));
    // The water itself shows the ejector working (the streamline tubes and
    // markers are flow notation and are not presented). Translucent water
    // bodies in the bores of B, D and C follow the state's water level: it
    // stands at the bilge while the steam purges the air, rises through B,
    // D and C as the vacuum draws it up, fills them while the ejector
    // discharges through C, and falls back when the steam is shut off.
    {
      // Pass 56: a clearer water tint so the half-section (the nozzle, the cut
      // rim and the rear wall) reads through the water filling the rear half.
      // Pass 62: a light, clearly watery blue, so the filled rear half reads
      // as water over the dark wall rather than as a teal body.
      const water=waterVolumeMaterial({color:0x8fd3ee,opacity:.62}),bilge=-2.91,dBottom=-1.16,dTop=1.56,outlet=3.40,rB=.395,rC=.465,rD=y=>radius(y)-.07;
      const column=(r,role)=>{const o=add(root,new THREE.CylinderGeometry(r,r,1,64,1,true).translate(0,.5,0),water,role);o.renderOrder=1;return o;};
      const inB=column(rB,'water-rising-in-suction-pipe-B'),inC=column(rC,'water-rising-in-discharge-pipe-C');
      inB.position.y=bilge;inC.position.y=dTop;
      // D's pear-shaped body is re-swept in place up to the level, with a
      // fixed vertex topology so no geometry is reallocated per frame.
      const rows=49,segments=64,lathe=new THREE.LatheGeometry(Array.from({length:rows},(_,j)=>new THREE.Vector2(rD(dBottom),dBottom+j*(dTop-dBottom)/(rows-1))),segments);
      const inD=add(root,lathe,water,'water-filling-mixing-chamber-D');inD.renderOrder=1;
      // B, D and C are cut on z = 0 (cutaway presentation): the free surface and
      // the discharge keep only the half behind the cut, like the walls.
      const surface=add(root,new THREE.CircleGeometry(1,64,0,Math.PI).rotateX(-Math.PI/2),water,'free-water-surface-in-B-D-C');surface.renderOrder=1;
      const sweepD=level=>{
        const position=lathe.getAttribute('position'),top=Math.min(level,dTop);
        for(let i=0;i<=segments;i++){const a=i/segments*2*Math.PI,c=Math.sin(a),e=Math.cos(a);
          for(let j=0;j<rows;j++){const y=dBottom+j*(top-dBottom)/(rows-1),r=rD(y);position.setXYZ(i*rows+j,r*c,y,r*e);}}
        position.needsUpdate=true;lathe.computeVertexNormals();lathe.computeBoundingSphere();lathe.computeBoundingBox();
      };
      b.waterFill=[inD,inB,inC];b.waterSurface=surface;
      const jet=dischargeJet(root,outlet,rC,.54,'free-discharge-issuing-from-mouth-of-C',{thetaStart:Math.PI,thetaLength:Math.PI});b.dischargeJet=root.children.at(-1);
      d.updateWorkingParts=(time,state)=>{
        jet(state.dischargeFraction);
        const level=state.waterLevelY;
        // The columns never switch on: empty, each collapses to a flat
        // ring at its foot, and it grows from there as the level rises.
        inB.scale.y=Math.max(1e-4,Math.min(level,dBottom)-bilge);inB.visible=true;
        inD.visible=true;sweepD(Math.max(level,dBottom));
        inC.scale.y=Math.max(1e-4,Math.min(level,outlet)-dTop);inC.visible=true;
        const r=level<dBottom?rB:level<dTop?rD(level):rC;
        surface.position.y=level;surface.scale.set(r,1,r);surface.visible=level>bilge+1e-3;
      };
    }
    replace(b.dischargePipe,horizontalRing(.47,.54,-.94,.94,64));
    replace(b.steamPipe,curvedPipeWall(d.flowPaths.steamPipeCurve,.105,.20,90,32));
    Object.assign(b.steamPipe.material,{transparent:false,opacity:1});
    replace(b.nozzle,horizontalRing(.125,.19,-.11,.11,64));
    // Brown's flange on the outer end of A: it covers the pipe's end face
    // (0.01 proud of it) and is bored 0.005 over the pipe's bore.
    {const end=d.flowPaths.steamPipeCurve.points[0];
     b.steamPipeFlange=add(root,horizontalRing(.110,.32,end.x-.075,end.x+.01,64).rotateZ(-Math.PI/2).translate(0,end.y,end.z),b.steamPipe.material,'flange-on-outer-end-of-steam-pipe-A');}
  } else if(id===476) {
    const steamCurve=d.flowPaths.steamPipeCurve;
    for(let i=0;i<steamCurve.points.length-1;i++)steamCurve.points[i].z=i===5?-.35:-.72;
    steamCurve.points[5].set(0,.68,0);steamCurve.updateArcLengths();d.flowPaths.steamFlowCurve.updateArcLengths();replace(b.steamCore,new THREE.TubeGeometry(steamCurve,92,.070,16,false));
    const branches=d.flowPaths.branchShellCurves;
    // Brown draws the fork as round opaque pipes (A is dashed where it runs
    // behind B): one hollow wall, the left leg B running on through the fork
    // into the stem C on x = 0, cut at the symmetry plane and mirrored, so
    // the legs merge into C with a flared neck and a clean crotch.
    const leg=branches[0].points.filter(p=>p.x<-.9).map(p=>p.clone());
    leg.unshift(leg[0].clone().setY(-2.86));
    const halfCurve=new THREE.CatmullRomCurve3([...leg,new THREE.Vector3(-.45,.95,0),new THREE.Vector3(-.12,1.32,0),new THREE.Vector3(0,1.75,0),new THREE.Vector3(0,2.3,0),new THREE.Vector3(0,3.42,0)],false,'centripetal');
    // Pipe A passes up through the crotch wall in a port of its own size.
    const aPath=d.flowPaths.steamPipeCurve.getSpacedPoints(200),probe=new THREE.Line3();
    const onA=p=>{for(let i=0;i<aPath.length-1;i++){probe.set(aPath[i],aPath[i+1]);if(probe.closestPointToPoint(p,true,new THREE.Vector3()).distanceTo(p)<.168)return true;}return false;};
    replace(b.suctionBranches[0],mirroredForkWall(halfCurve,.38,.46,{cut:onA}));
    b.suctionBranches[0].material=b.suctionBranches[0].material.clone();Object.assign(b.suctionBranches[0].material,{transparent:false,opacity:1,depthWrite:true,side:THREE.DoubleSide});
    b.suctionBranches[1].visible=false;b.dischargePipe.visible=false;
    replace(b.steamPipe,curvedPipeWall(d.flowPaths.steamPipeCurve,.092,.17,92,32));
    Object.assign(b.steamPipe.material,{transparent:false,opacity:1});
    // Brown draws the fork in section with A turned up inside it: the fork
    // is cut on z = 0 (cutaway presentation) and the water rising through
    // both legs B, round nozzle A and up C shows through the cut, as in 475.
    // The water is one body filling the fork's bore (the same mirrored sweep
    // as the wall, so the legs merge into C with no internal faces); its
    // level is a clipping plane, so nothing is rebuilt per frame. It stands
    // below the mouths of B while the steam purges the air, rises to the
    // mouth of C, fills the fork while the siphon discharges, and falls
    // back at shut-off.
    const footY=-2.86,mouthY=3.42;
    const water=add(root,mirroredForkWall(halfCurve,.004,.372,{segments:220,sides:48}),waterVolumeMaterial({color:0x8fd3ee,opacity:.62}),'water-rising-in-B-fork-and-C');
    water.renderOrder=1;b.waterFill=[water];
    const levelPlane=new THREE.Plane(new THREE.Vector3(0,-1,0),footY);
    const jet=dischargeJet(root,mouthY,.38,.46,'free-discharge-issuing-from-mouth-of-C',{thetaStart:Math.PI,thetaLength:Math.PI});b.dischargeJet=root.children.at(-1);
    d.localClippingEnabled=true;
    d.updateWorkingParts=(time,state)=>{
      jet(state.dischargeFraction);
      const level=footY+(mouthY-footY)*state.levelFraction;
      levelPlane.constant=level;
      for(const m of[].concat(water.material))if(!m.clippingPlanes?.includes(levelPlane))m.clippingPlanes=[...(m.clippingPlanes??[]),levelPlane];
      // Always drawn: at the foot of B the level plane clips it all away,
      // so it grows from nothing instead of switching on.
      water.userData.waterLevelY=level;
    };
  } else if(id===477) {
    replace(b.inletPipeA,horizontalRing(.66,.74,-1.04,1.04,64));
    replace(b.outletPipeB,horizontalRing(.68,.76,-.725,.725,64));
    // The conical shoulder reaches a conformal finite seat at the existing
    // maximum prescribed lift. It previously missed the toroidal seat entirely.
    // Pass 80: the seat's outer flank runs on up to the cover's bore edge
    // (0.745 at its underside, y 1.78), so a a is cast on at inlet A (it
    // stood 0.08 clear); its working cone and 0.48 throat are unchanged.
    replace(b.annularSeat,horizontalTurned([[1.10,.90],[1.78,.745],[1.78,.48],[1.50,.48],[1.10,.80]]));b.annularSeat.position.y=0;b.annularSeat.rotation.set(0,0,0);
    // Brown's D: a slender hollow stem closed at the top, the collar a a that
    // closes on the seat, a narrow waist (the letter D) and a dished foot
    // flaring out to the flange that clamps the diaphragm. The seat-closing
    // cone (0.775..1.175) and stem are unchanged; the waist and dish replace
    // the former broad bell.
    const outer=[[-.05,.98],[.02,.97],[.10,.86],[.20,.70],[.30,.58],[.40,.52],[.55,.50],[.62,.56],[.72,.76],[.775,.80],[1.175,.48],[1.20,.40],[2.835,.40],[2.98,.36],[3.12,.22],[3.18,0]];
    const inner=[[3.12,0],[3.06,.20],[2.94,.30],[2.80,.33],[1.20,.33],[1.10,.41],[.80,.62],[.70,.60],[.60,.44],[.50,.43],[.40,.45],[.30,.51],[.20,.63],[.10,.79],[.02,.90],[-.05,.93]];
    replace(b.valveStem,horizontalTurned([...outer,...inner]));b.valveStem.position.y=0;
    for(const o of[b.valveTop,b.valveShoulder,b.valveReservoir,b.valveNeck])o.visible=false;
    replace(b.workingFluidReservoir,new THREE.SphereGeometry(.62,48,24));b.workingFluidReservoir.scale.y=.20;b.workingFluidReservoir.position.y=.05;
    // Pass 57: the sealed liquid fills D's whole cavity (inner profile inset
    // 0.006) from the diaphragm up to the closed top, so the cut shows liquid
    // filling the hollow valve rather than a free-standing bar.
    const cavity=inner.filter(([y])=>y>=0).map(([y,r])=>[y,Math.max(0,r-.006)]);
    const liquid=[[0,0],[0,.90],...cavity.slice().reverse().map(([y,r])=>[Math.min(y,3.114),r])];
    replace(b.workingFluidColumn,horizontalTurned(liquid.filter((p,i,a)=>i===0||p[0]!==a[i-1][0]||p[1]!==a[i-1][1])));b.workingFluidColumn.position.y=0;
    // Finite diaphragm; its lowest point remains on the bridge as the
    // retained thermal law changes its bow by scaling about the rim. It thins
    // to the clamped edge, which stays flush between D's flange above and a
    // flat clamp ring below (the torus rim overlapped it by 0.072).
    const lower=[],upper=[];for(let i=0;i<=48;i++){const r=.94*i/48,y=-.20*(1-(r/.94)**2)**2;lower.push([y,r]);upper.unshift([y+.012*(1-(r/.94)**8),r]);}
    replace(b.flexibleDiaphragm,horizontalTurned([...lower,...upper]));
    replace(b.diaphragmRim,horizontalTurned([[-.06,.925],[-.06,1.0],[0,1.0],[0,.925]]));b.diaphragmRim.rotation.set(0,0,0);
    replace(b.bridgeCap,new THREE.SphereGeometry(.10,48,32));b.bridgeCap.position.y=-.35;
    for(const leg of b.bridgeLegs){replace(leg,new THREE.BoxGeometry(.16,1.27,.30));leg.position.y=-1.045;}
    for(const stream of b.condensateStreams)stream.visible=false;
    for(const marker of b.condensateMarkers)replace(marker,new THREE.SphereGeometry(.025,16,12));
    d.updateWorkingParts=(time,state)=>{
      const lift=state.valveLiftMetre*g.liftDisplayScaleSceneUnitPerMetre;
      const path=[[.53,3.64],[.53,2.38],[.44,1.70],[.48,1.50],[.60,1.35],[.80,1.10],[1.08,.79],[1.40,-.10],[1.29,-.92],[.95,-1.43],[.52,-1.70],[.20,-2.18],[.15,-3.10]];
      for(const k of[3,4,5]){const seat=path[k][0],y=path[k][1],valve=Math.max(.40,.80-.8*(y-lift-.775));path[k][0]=(seat+valve)/2;}
      for(let i=0;i<d.flowPaths.condensateFlowCurves.length;i++){
        const angle=Math.PI/4+i*Math.PI/2,curve=d.flowPaths.condensateFlowCurves[i];
        curve.points=path.map(([r,y])=>new THREE.Vector3(r*Math.cos(angle),y,r*Math.sin(angle)));curve.updateArcLengths();
        for(let j=0;j<g.markersPerPath;j++){const marker=b.condensateMarkers[i*g.markersPerPath+j],progress=d.flowPaths.markerProgressAtTime(time,j);marker.position.copy(curve.getPointAt(progress));marker.scale.setScalar(Math.sin(Math.PI*progress)**.55*state.flowFraction);}
      }
    };
    b.rearWall.position.z=-1.12;
    for(const wall of b.caseWalls){const p=wall.geometry.parameters;replace(wall,new THREE.BoxGeometry(wall.userData.role.includes('top-wall')?1.32:wall.userData.role.includes('bottom-wall')?1.24:p.width,p.height,2.24));}
  } else if(id===478) {
    const R=1.13,r=1.06,lo=-Math.sqrt(R*R-.50*.50),levels=[lo,-.34,.34,...Array.from({length:49},(_,i)=>lo+(R-lo)*i/48)].sort((a,b)=>a-b).filter((x,i,a)=>!i||x-a[i-1]>1e-8);
    replace(b.hollowSphereC,portedMeridian(levels,y=>Math.sqrt(Math.max(0,R*R-y*y)),y=>Math.sqrt(Math.max(0,r*r-y*y)),(a,y)=>Math.abs(y)<.34&&Math.abs(Math.cos(a))>.94));
    replace(b.sphereOutlet,horizontalRing(.42,.50,-.81,.81,64));b.sphereOutlet.position.y=-1.615;
    replace(b.pipeShell,horizontalRing(.18,.27,-g.basePipeDisplayLength/2,g.basePipeDisplayLength/2,64));
    replace(b.stuffingBody,horizontalRing(.124,.30,-.27,.27,64));
    replace(b.valveFace,new THREE.CylinderGeometry(.285,.285,.17,64));
    // Flat annular end faces express the prescribed pipe/plunger contact.
    replace(b.pipeFreeEndRim,horizontalRing(.18,.27,-.018,0,64).rotateZ(-Math.PI/2));b.pipeFreeEndRim.rotation.set(0,0,0);
    b.plungerContactPad.position.x=g.plungerExternalContactLocalX-.25;
    const rodLength=g.plungerExternalContactLocalX-.25-.17;replace(b.plungerRod,new THREE.CylinderGeometry(.12,.12,rodLength,32));b.plungerRod.position.x=.17+rodLength/2;
    const lower=b.leverD.children.find(o=>o.userData.role==='lower-arm-of-loaded-elbow-lever-D');
    const shape=clip.difference(clip.union(capsule([0,-.29],[0,-2.05],.11,24),poly(circle([0,0],.32,64))),poly(circle([0,0],.244,64)));
    replace(lower,plate(shape,-.09,.09));lower.position.set(0,0,0);lower.quaternion.identity();
    const upper=b.leverD.children.find(o=>o.userData.role==='weighted-upper-arm-of-elbow-lever-D'),direction=new THREE.Vector3(1.22,.21,0),length=direction.length();
    replace(upper,new THREE.CylinderGeometry(.13,.13,length-.30,32));upper.position.copy(direction.clone().normalize().multiplyScalar((length+.30)/2));
    const standShape=clip.difference(clip.union(poly([[-.13,-2.96],[.13,-2.96],[.13,0],[-.13,0]]),poly(circle([0,0],.32,64))),poly(circle([0,0],.244,64)));
    b.leverStand=add(root,plate(standShape,-.07,.07),b.baseRight.material,'finite-bored-lever-support');b.leverStand.position.copy(g.leverPivot);b.leverStand.position.z=-.24;
    const postTop=g.fixedStopContactPoint.y+.01,postBottom=-1.28;replace(b.stopPost,new THREE.BoxGeometry(.30,postTop-postBottom,.54));b.stopPost.position.y=(postTop+postBottom)/2;
    const local=g.stopScrewTipLocal.clone().add(new THREE.Vector3(.09*Math.cos(g.leverStopAngle),-.09*Math.sin(g.leverStopAngle),0));
    b.stopTip=add(b.leverD,new THREE.SphereGeometry(.09,48,32),b.stopScrewB.material,'rounded-stop-screw-tip-contacting-fixed-stop');b.stopTip.position.copy(local);
    replace(b.stopScrewB,new THREE.CylinderGeometry(.075,.075,-.10-local.x,32));b.stopScrewB.position.set((local.x-.10)/2,-1.94,0);
    const thread={inner:.075,outer:.095,low:local.x,high:-.10,width:.018,lead:.055/(2*Math.PI),phase:0};replace(b.screwThreadsB,helicalThread(thread,threadAngles(thread,48)).rotateY(Math.PI/2).translate(0,-1.94,0));
  }
  d.minimumDisplayCycleSeconds=g.cycleDuration;
  d.workingPartsReview={status:'bounded-finite-geometry',residual:id<477?'Steady entrainment and flow markers are prescribed; startup, condensation, losses and two-phase dynamics are not solved. The visible cutaway is not a watertight manifold qualification.':'Thermal history, quasi-static contact and discharge remain prescribed analytical models; passive valve inertia, heat transfer, leakage and transient fluid dynamics are not solved.'};
  fitPistonGuide(root,update,g.cycleDuration);
  d.cameraDirection=new THREE.Vector3(1.4,1.0,15);
}
