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
  return fraction=>{jet.visible=fraction>1e-3;jet.scale.y=Math.max(1e-4,fraction);};
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
    const levels=[...Array.from({length:61},(_,i)=>-1.16+2.72*i/60).filter(y=>Math.abs(y+.20)>.02&&Math.abs(y-.34)>.02),-.20,.34].sort((a,b)=>a-b);
    replace(b.chamber,portedMeridian(levels,radius,y=>radius(y)-.065,(a,y)=>y>-.20&&y<.34&&Math.cos(a)>.976));
    replace(b.suctionPipe,horizontalRing(.40,.47,-.895,.895,64));
    // The water itself shows the ejector working (the streamline tubes and
    // markers are flow notation and are not presented). Translucent water
    // bodies in the bores of B, D and C follow the state's water level: it
    // stands at the bilge while the steam purges the air, rises through B,
    // D and C as the vacuum draws it up, fills them while the ejector
    // discharges through C, and falls back when the steam is shut off.
    {
      const water=waterVolumeMaterial(),bilge=-2.91,dBottom=-1.16,dTop=1.56,outlet=3.40,rB=.395,rC=.465,rD=y=>radius(y)-.07;
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
        inB.scale.y=Math.max(1e-4,Math.min(level,dBottom)-bilge);inB.visible=level>bilge+1e-3;
        inD.visible=level>dBottom+1e-3;if(inD.visible)sweepD(level);
        inC.scale.y=Math.max(1e-4,Math.min(level,outlet)-dTop);inC.visible=level>dTop+1e-3;
        const r=level<dBottom?rB:level<dTop?rD(level):rC;
        surface.position.y=level;surface.scale.set(r,1,r);surface.visible=level>bilge+1e-3;
      };
    }
    replace(b.dischargePipe,horizontalRing(.47,.54,-.94,.94,64));
    replace(b.steamPipe,curvedPipeWall(d.flowPaths.steamPipeCurve,.105,.20,90,32));
    Object.assign(b.steamPipe.material,{transparent:false,opacity:1});
    replace(b.nozzle,horizontalRing(.125,.19,-.11,.11,64));
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
    // The opaque fork hides the water inside; its working shows as the
    // discharge issuing from the open mouth of C while the siphon runs.
    const jet=dischargeJet(root,3.42,.38,.46,'free-discharge-issuing-from-mouth-of-C');b.dischargeJet=root.children.at(-1);
    d.updateWorkingParts=(time,state)=>jet(state.dischargeFraction);
  } else if(id===477) {
    replace(b.inletPipeA,horizontalRing(.66,.74,-1.04,1.04,64));
    replace(b.outletPipeB,horizontalRing(.68,.76,-.725,.725,64));
    // The conical shoulder reaches a conformal finite seat at the existing
    // maximum prescribed lift. It previously missed the toroidal seat entirely.
    replace(b.annularSeat,horizontalTurned([[1.10,.90],[1.70,.74],[1.70,.48],[1.50,.48],[1.10,.80]]));b.annularSeat.position.y=0;b.annularSeat.rotation.set(0,0,0);
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
