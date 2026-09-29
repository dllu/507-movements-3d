import {finishRockingPawl232} from './lift-draw-pawl-232-branch.js';
import * as T from 'three';
import {poly,circle,plate,ring,polygonClipping as clip} from './finite-plate-geometry.js';
import {makeBoredPlanarLink} from './bored-planar-link.js';

function unexpanded(mesh,extra=[]){
 const {shapes,options}=mesh.geometry.parameters;
 const region=clip.difference(poly(shapes.getPoints(48).map(p=>p.toArray())),...shapes.holes.map(h=>poly(h.getPoints(48).map(p=>p.toArray()))),...extra.map(([x,y,r])=>poly(circle([x,y],r,96))));
 const old=mesh.geometry;mesh.geometry=plate(region,-options.depth/2,options.depth/2);old.dispose();
}

export function finishLiftDrawPawl232(model){
 const d=model.root.userData,b=d.blocks,g=d.geometry,oldUpdate=model.update;
 // Bevels must not close bores or enlarge the square tooth working section.
 unexpanded(b.wheel.userData.body);unexpanded(b.pawlBody,[[g.shortLinkLength,0,.076]]);
 // Handle B's rounded end runs on the wheel shaft (r .105) with a .0005
 // running fit; the end is rounded out to r .16 to leave a wall round the bore.
 {const lever=b.inputLeverBody,{shapes,options}=lever.geometry.parameters;
  const region=clip.difference(clip.union(poly(shapes.getPoints(48).map(p=>p.toArray())),poly(circle([0,0],.16,96))),
   poly(circle([0,0],.1055,96)),poly(circle([g.shortLinkLength,0],.076,96)));
  lever.geometry.dispose();lever.geometry=plate(region,-options.depth/2,options.depth/2);}
 const frameShape=b.framePlate.geometry.parameters.shapes,frameRegion=clip.difference(clip.union(poly(frameShape.getPoints(48).map(p=>p.toArray())),poly(circle(g.retainingPivot.toArray(),.14,96))),...frameShape.holes.filter(h=>h.getPoints(8)[0].length()>.3).map(h=>poly(h.getPoints(48).map(p=>p.toArray()))),poly(circle(g.retainingPivot.toArray(),.070,96)),poly(circle([0,0],.1055,96)));b.framePlate.geometry.dispose();b.framePlate.geometry=plate(frameRegion,-.07,.07);
 // Carrier A journals on the wheel shaft (r .105) with a .0005 running fit.
 const wheelIndex=b.wheel.userData.index;wheelIndex.geometry.dispose();wheelIndex.geometry=new T.BoxGeometry(.045,.8,.012);wheelIndex.position.set(0,-1.15,.196);
 b.framePlate.position.z=.49;b.inputLever.position.z=.70;
 const oldCoupler=b.coupler;oldCoupler.visible=false;
 const coupler=makeBoredPlanarLink({length:g.groundLength,width:.13,eyeRadius:.115,boreRadius:.076,depth:.12},b.inputLeverBody.material);coupler.userData.role='232-through-bored-parallelogram-coupler';model.root.add(coupler);b.coupler=coupler;
 // Brown draws no retaining click: A's two holes are its fixing bolts and the
 // caption names only B, C and the wheel. The reconstructed face-mounted click
 // (a roller reaching back to the teeth from in front) is not built; the wheel
 // dwells between draws by prescribed friction. The upper fixed pin stays as
 // the guide pin running in A's curved slot.
 {const click=b.retainingClick;click.removeFromParent();click.traverse(o=>o.geometry?.dispose());
  for(const key of ['retainingClick','retainingBody','retainingNose'])delete b[key];}
 b.retainingPivotPin.userData.role='fixed-A-upper-guide-pin';
 b.retainingPivotPin.position.z=.39;b.retainingPivotPin.geometry.dispose();b.retainingPivotPin.geometry=new T.CylinderGeometry(.065,.065,.30,48);
 b.pawlCouplerPin.geometry.dispose();b.pawlCouplerPin.geometry=new T.CylinderGeometry(.07,.07,.88,48);
 b.outputShaft.scale.z=1.3;
 Object.assign(g.axialLayers,{frameA:{center:.49,depth:.14},inputB:{center:.70,depth:.14},coupler:{center:.86,depth:.12}});
 delete g.axialLayers.retainingClick;
 d.sourceAnimation={...d.sourceAnimation,available:false,reason:'The fetched official page has no canvas, inline animation program or ae.add_model registration (checked 2026-09-16).'};
 d.hideGround=true;d.minimumDisplayCycleSeconds=6;
 model.root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}for(const mat of(Array.isArray(o.material)?o.material:[o.material]))if(mat)mat.fog=false;});
 model.update=t=>{oldUpdate(t);const s=d.stateAtTime(t);b.inputLever.position.z=.70;coupler.userData.setEndpoints(new T.Vector3(s.inputCouplerPivot.x,s.inputCouplerPivot.y,.86),new T.Vector3(s.pawlCouplerPivot.x,s.pawlCouplerPivot.y,.86));b.inputCouplerPin.position.z=.78;b.pawlCouplerPin.position.z=.50;d.kinematics=s;};
 model.cameraDirection=new T.Vector3(.6,.45,12);model.update(0);
 const finished=finishRockingPawl232(model);
 // p101: C's two eyes carry bosses of C's own colour forward to the parts
 // they bear on (carrier A's back face at .42, the coupler's back face at
 // .80), so neither joint is a bare black column bridging air; the upper
 // pin is trimmed to the stack (C's back -.10 to A's front .56 plus a head).
 {const pawl=b.pawl,mat=b.pawlBody.material;
  const upperBoss=new T.Mesh(ring(.077,.15,.10,.42,96),mat);upperBoss.userData.role='232-C-upper-eye-boss-to-carrier-A';pawl.add(upperBoss);
  const couplerBoss=new T.Mesh(ring(.0705,.13,.10,.80,96),mat);couplerBoss.position.set(g.shortLinkLength,0,0);couplerBoss.userData.role='232-C-coupler-eye-boss';pawl.add(couplerBoss);
  const pin=b.upperPivotPin;pin.geometry.dispose();pin.geometry=new T.CylinderGeometry(.075,.075,.72,48);pin.position.z=.24;
  b.pawlUpperBoss=upperBoss;b.pawlCouplerBoss=couplerBoss;}
 return finished;
}
