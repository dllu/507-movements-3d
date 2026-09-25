import * as THREE from 'three';
import { capsule, circle, disk, plate, poly, polygonClipping, ring } from './finite-plate-geometry.js';

export function boredHookPlate(points, radius, depth, bore, eyeRadius = bore + .13, extraOutlines = []) {
  const outlines = points.slice(1).map((point, i) => capsule(points[i], point, radius, 24));
  const outer = polygonClipping.union(...outlines, poly(circle([0, 0], eyeRadius, 96)), ...extraOutlines.map(poly));
  return plate(polygonClipping.difference(outer, poly(circle([0, 0], bore, 96))), -depth / 2, depth / 2);
}

export function finishHookFamily(root, duration) {
  root.userData.hideGround = true;
  root.userData.minimumDisplayCycleSeconds = duration;
  root.userData.cameraFov = 8;
  root.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = true; object.receiveShadow = true;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.fog = false;
  });
}

export function correctCheckHookJournals(root) {
  const { hooks, hookPivots, flangeDisk, centerShaft, fixedBacking, ropeDrumBody } = root.userData.blocks;
  const { hookCenterline, hookBarRadius, hookBarbOutline } = root.userData.geometry;
  const plates = [];
  hooks.forEach((hook, index) => {
    const material = hook.children[0].material;
    for (const child of hook.children) child.visible = false;
    const body = new THREE.Mesh(boredHookPlate(hookCenterline.map(p => p.toArray()), hookBarRadius, .36, .304, .44, [hookBarbOutline.map(p => p.toArray())]), material);
    body.userData.role = 'bored-working-check-hook'; hook.add(body); plates.push(body);
    // Brown draws no hook stops: the deployed angle is prescribed, so no
    // stop stud is modelled beside the hook pivot.
    const pin=hookPivots[index].children.find(o=>o.userData.role?.endsWith('pivot-pin'));
    pin.geometry=new THREE.CylinderGeometry(.3,.3,.76,64);
    hookPivots[index].children.find(o=>o.userData.role?.endsWith('torsion-return-spring')).position.z=.27;
  });
  // Both the flange and load drum turn around the common shaft.
  for (const mesh of [flangeDisk, fixedBacking, ropeDrumBody]) {
    if (!mesh?.geometry.parameters?.radiusTop) continue;
    const { radiusTop, height } = mesh.geometry.parameters;
    const shaftRadius = centerShaft.geometry.parameters.radiusTop;
    mesh.geometry = ring(shaftRadius + .004, radiusTop, -height / 2, height / 2, 96);
    mesh.rotation.set(0, 0, 0);
  }
  root.userData.blocks.ropeDrumIndex.geometry = new THREE.BoxGeometry(.6,.13,.07);
  root.userData.blocks.ropeDrumIndex.position.set(.65,0,.825);
  root.userData.workingHooks = { plates };
  root.userData.dynamics = { prescribedDeployment: true, prescribedCatchImpact: true,
    validatedPassiveCatch: false, springLaw: 'ideal unloaded torsional quarter-cycle followed by imposed holding and reset' };
  root.userData.reconstructionNote = 'The hook faces resist drum rotation. Brown draws no hook stops, so the deployed hook angle is prescribed rather than seated on a stop. Hook deployment, impact and subsequent holding are prescribed; the illustrated spring response does not validate a loaded mine-hoist arrest.';
  finishHookFamily(root, 12);
}

export const pileLatch = {
  toeRadius: .15,
  shelfTop: 2 - (-2.64 - (-1.35 - 1.29 * Math.cos(.24) + 2 * Math.sin(.24) - .15)) - .15 * Math.SQRT2 - 2.19,
  edgeX: -1.35 - 1.29 * Math.cos(.24) + 2 * Math.sin(.24) - .15,
};
export function pileHeadOffset(angle) {
  const x = -1.35 - 1.29 * Math.cos(angle) + 2 * Math.sin(angle);
  const y = 1.29 * Math.sin(angle) + 2 * Math.cos(angle);
  const dx = x - pileLatch.edgeX;
  const height = dx < -pileLatch.toeRadius / Math.SQRT2
    ? dx + pileLatch.toeRadius * Math.SQRT2
    : Math.sqrt(Math.max(0, pileLatch.toeRadius ** 2 - dx ** 2));
  return y - height - pileLatch.shelfTop - 2.19;
}

export function correctPileHookSurfaces(root) {
  const b = root.userData.blocks;
  const hooks = [b.leftHook, b.rightHook];
  const shelves = [], bodies = [], toes = [], closingStops = [], stopBrackets = [];
  const head = b.liftHead;
  const find = role => { let found; root.traverse(o => { if(o.userData.role === role) found=o; }); return found; };
  const bar = find('horizontal-lifting-head-gripped-by-hooks');
  bar.geometry = new THREE.BoxGeometry(5.9, .7, .18);
  bar.position.set(0, -.21, -.05);
  for (const side of [-1, 1]) {
    const width = 2.95 + pileLatch.edgeX;
    const left = -2.95, right = pileLatch.edgeX, top = pileLatch.shelfTop;
    let outline = [[left,top+left-right],[right,top],[right,top-.26],[left,top+left-right-.26]];
    if(side>0) outline=outline.map(([x,y])=>[-x,y]).reverse();
    const shelf = new THREE.Mesh(plate(poly(outline),-.17,.53),bar.material);
    shelf.userData.role = 'finite-head-retaining-shelf'; head.add(shelf); shelves.push(shelf);
  }
  for (const role of ['left-concentric-hook-bearing-arc','right-concentric-hook-bearing-arc']) find(role).visible=false;
  const wedge = find('lifting-head-centering-wedge'); wedge.scale.z=.2; wedge.position.z=-.05;
  find('lifting-rope-eye').position.z=.08;
  hooks.forEach((hook,index) => {
    const side=index===0 ? -1:1;
    const old=hook.children.find(o=>o.userData.role?.includes('source-curved-hook-body'));
    const control=old.userData.centerlinePoints.map(p=>p.clone());
    const curve=new THREE.CatmullRomCurve3(control.map(p=>new THREE.Vector3(p.x,p.y,0)),false,'centripetal');
    const points=curve.getPoints(32).map(p=>[p.x,p.y]);
    // The load toe is carried on the rear face of a bored flat hook cheek.
    // Brown's horn swells to a broad crescent over its outward bulge and
    // narrows again to the 0.24 round horn end.
    const smooth=u=>{u=Math.min(1,Math.max(0,u));return u*u*(3-2*u);};
    const hornRadius=i=>{const u=i/31;return u<.6?.18+.14*smooth((u-.25)/.35):.32-.08*smooth((u-.6)/.4);};
    let outer=polygonClipping.union(...points.slice(1).map((p,i)=>capsule(points[i],p,hornRadius(i),12)),
      poly(circle([0,0],.45,96)), capsule([side*1.53,2],[side*1.29,2],.18,24));
    outer=polygonClipping.difference(outer,poly(circle([0,0],.314,96)));
    const body=new THREE.Mesh(plate(outer,.85,1.01),old.material); body.userData.role='bored-flat-pile-hook';
    old.visible=false;
    const oldToe=hook.children.find(o=>o.userData.role?.includes('lifting-head-bearing-index'));oldToe.visible=false;
    const toe=new THREE.Mesh(disk(.15,.34,1.01,96),old.material);
    toe.position.set(side*1.29,2,0);toe.userData.role='finite-load-bearing-hook-toe';
    const tip=hook.children.find(o=>o.userData.role?.includes('guide-contact-tip'));tip.position.z=.93;
    // A rounded horn end whose short rear stud rides the guide of slot B,
    // so the broad horn itself passes in front of the guide faces.
    tip.geometry.dispose();tip.geometry=disk(.24,-.7,.08,96);
    hook.add(body,toe);bodies.push(body);toes.push(toe);
    // Seat the stop on an outline vertex (sample 6 of 32), where the stock
    // is exactly a round 0.18 end, so the at-rest stop gap stays 0.002.
    const at=curve.getPoint(6/32),tangent=curve.getTangent(6/32);
    const outward=new THREE.Vector3(side<0?-tangent.y:tangent.y,side<0?tangent.x:-tangent.x,0);
    const stopPoint=at.clone().addScaledVector(outward,.272);
    const stop=new THREE.Mesh(disk(.09,.6,1.03,48),bar.material);
    stop.position.set(side*1.35+stopPoint.x,stopPoint.y,0);stop.userData.role='pile-hook-closing-stop';
    const bracket=new THREE.Mesh(plate(capsule([side*1.35,0],[stop.position.x,stop.position.y],.15,16),.6,.73),bar.material);
    bracket.userData.role='pile-hook-stop-yoke-bracket';
    b.weightAssembly.add(stop,bracket);closingStops.push(stop);stopBrackets.push(bracket);
  });
  for(const pin of b.pivotPins) {pin.geometry=new THREE.CylinderGeometry(.31,.31,1.8,64);pin.position.z=.38;}
  for(const name of ['left-straight-inward-squeezing-face-of-slot-b','right-straight-inward-squeezing-face-of-slot-b']) {
    // Guide faces span z -1.10..0.80: the tip studs reach them while the
    // horn plates (z 0.85..1.01) pass just in front.
    const guide=find(name); guide.scale.z=1.3; guide.position.z=.8-1.46*1.3/2;
  }
  root.userData.workingHooks={shelves,bodies,toes,closingStops,stopBrackets};
  root.userData.dynamics={prescribedLiftAndSqueeze:true,prescribedReset:true,validatedPassiveRelease:false,
    releaseLaw:'finite rounded toes leave retaining shelf edges; imposed hammer fall then inelastic impact',
    limitation:'edge contact approaches a horizontal normal; no finite-load force balance or elastic impact is solved'};
  root.userData.reconstructionNote='Rounded toes ride sloped shelves; initial load seats the hooks against stops. The toes clear the shelf edges before the hammer falls. Hoisting, squeezing and reset are prescribed; the edge handoff is not a validated finite-load release, and impact is idealized as inelastic.';
  finishHookFamily(root,10);
}
