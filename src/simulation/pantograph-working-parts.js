import * as THREE from 'three';
import { circle, poly, plate, polygonClipping as clip } from './finite-plate-geometry.js';
import { boredCylinderGeometry } from './piston-guide-parts.js';
import { markShadows } from './primitives.js';
import { creaseLatheNormals } from './crease-normals.js';

const rectangle = (x0, x1, z0, z1) => poly([[x0,z0],[x1,z0],[x1,z1],[x0,z1]]);
const replace = (mesh, geometry) => { mesh.geometry.dispose(); mesh.geometry = geometry; };
const horizontalPlate = (shape, bottom, top) => plate(shape, -top, -bottom).rotateX(Math.PI / 2);

// All stations are fixed in their own rigid bar. No mesh is rebuilt in update.
function barGeometry(length, holes, thickness) {
  const outline = clip.union(rectangle(0, length, -.085, .085),
    ...holes.map(({station}) => poly(circle([station, 0], .15, 64))));
  return horizontalPlate(clip.difference(outline,
    ...holes.map(({station, radius}) => poly(circle([station, 0], radius, 96)))),
  -thickness / 2, thickness / 2);
}

// A slide needs both the longitudinal rail passage and the vertical pin bore.
// A round slide (radius > 0) reads as Brown's plain circular knob at C.
function slideParts(parent, oldBody, width, depth, height, bore, round = 0) {
  oldBody.visible = false;
  const parts = [], outline = clip.difference(round > 0 ? poly(circle([0,0], round, 96))
    : rectangle(-width/2, width/2, -depth/2, depth/2),
    poly(circle([0,0], bore, 96)));
  const add = (geometry, role) => {
    const mesh = new THREE.Mesh(geometry, oldBody.material);
    mesh.position.y = height; mesh.userData.role = role; parent.add(mesh); parts.push(mesh); return mesh;
  };
  for (const side of [-1,1]) {
    add(horizontalPlate(outline, side * .08375 - .02125, side * .08375 + .02125), 'bored-slide-cover');
    if (round > 0) {
      // Pass 101: the round knob's sides are closed arcs flush with its
      // covers, so C reads as one knob with a rail slot, not stacked discs.
      const segment = clip.intersection(poly(circle([0,0], round, 96)),
        rectangle(-round, round, side > 0 ? .16 : -round, side > 0 ? round : -.16));
      add(horizontalPlate(segment, -.0625, .0625), 'slide-rail-side-wall');
      continue;
    }
    const wall = add(new THREE.BoxGeometry(width, .125, (depth-.32)/2), 'slide-rail-side-wall');
    wall.position.z = side * (depth+.32)/4;
  }
  return parts;
}

export function correctPantographParts(model) {
  const {root} = model, data = root.userData, b = data.blocks, g = data.geometry;
  const specs = [
    [b.lowerLongArm, 4.8 + g.lowerRailOverhang + g.rightRailOverhang,
      [[g.lowerRailOverhang,.099],[g.lowerRailOverhang+2.4,.109],[g.lowerRailOverhang+4.8,.109]]],
    [b.upperLongArm, 4.8 + g.upperRailOverhang + g.rightRailOverhang,
      [[g.upperRailOverhang,.076],[g.upperRailOverhang+2.4,.109],[g.upperRailOverhang+4.8,.109]]],
    [b.blueParallelBar, 2.4, [[0,.109],[2.4,.109]]],
    [b.redParallelBar, 2.4, [[0,.109],[2.4,.109]]],
  ];
  const bars = specs.map(([legacy, length, stations]) => {
    let material; legacy.traverse(o => { if (o.isMesh && !material) material = o.material; });
    legacy.visible = false;
    const holes = stations.map(([station,radius]) => ({station,radius}));
    const mesh = new THREE.Mesh(barGeometry(length, holes, g.barThickness), material);
    mesh.userData.role = `${legacy.userData.role}-bored`;
    mesh.userData.holes = holes; mesh.userData.length = length; root.add(mesh);
    return {legacy,mesh};
  });
  const fixedSlide = slideParts(b.fixedSlideC, b.fixedSlideC.children[0], .40, .37, g.lowerLayerY, .099, .29);
  const pencilSlide = slideParts(b.pencilAssembly, b.pencilCarrier, .44, .37, g.upperLayerY, .076);
  // Pass 101: fixed point C is one turned piece (foot, post, the collar the
  // slide rides on and a domed head), not a stack of separate grey discs.
  const [foot,post,oldRing] = b.fixedPivot.children;
  b.fixedPivot.remove(foot, oldRing);
  const lo = g.lowerLayerY, arc = (cx, cy, r, a0, a1, n) => Array.from({length:n+1},
    (_, i) => { const a = a0 + (a1 - a0) * i / n; return new THREE.Vector2(cx + r * Math.cos(a), cy + r * Math.sin(a)); });
  const domeCentre = .32, domeRadius = .28, domeStart = Math.acos(.14 / domeRadius);
  const profile = [
    new THREE.Vector2(0, g.paperTopY), new THREE.Vector2(.30, g.paperTopY), new THREE.Vector2(.30, .04),
    ...arc(.27, .04, .03, 0, Math.PI / 2, 8), new THREE.Vector2(.14, .07),
    ...arc(.14, .115, .045, -Math.PI / 2, -Math.PI, 10),
    new THREE.Vector2(.095, lo - .1425), new THREE.Vector2(.18, lo - .1425),
    new THREE.Vector2(.18, lo - .1175), new THREE.Vector2(.095, lo - .1175),
    new THREE.Vector2(.095, lo + .1175), new THREE.Vector2(.14, lo + .1175), new THREE.Vector2(.14, lo + .1325),
    ...arc(0, domeCentre, domeRadius, domeStart, Math.PI / 2, 16).slice(1),
  ];
  profile[profile.length - 1].x = 0;
  replace(post, creaseLatheNormals(new THREE.LatheGeometry(profile, 96)));
  post.position.y = 0;
  // Brown draws C as a plain round knob, without a dark pin end.
  post.material = oldRing.material;
  post.userData.role = 'turned-fixed-pivot-C-with-foot-collar-and-head';
  // The tracer passes through the hollow compound pin at B.
  replace(b.jointPins.B.children[0], boredCylinderGeometry(.105,.059,g.upperLayerY-g.lowerLayerY+.29));
  for (const joint of Object.values(b.jointPins)) {
    for (const [index,y] of [[1,g.lowerLayerY-.075],[2,g.upperLayerY+.075]]) {
      const washer = joint.children[index];
      replace(washer,boredCylinderGeometry(.15,.102,.025));
      washer.rotation.set(0,0,0); washer.position.y=y;
    }
  }
  b.tracerTip.position.y = g.paperTopY+.047;
  // Pass 101: B's head is a solid cap seated on the hollow pin's top (it
  // floated 0.085 above the tracer shaft); the shaft ends inside it.
  const pinTop = g.jointCenterY + (g.upperLayerY - g.lowerLayerY + .29) / 2, capHeight = .05;
  b.tracerKnob.position.y = pinTop + capHeight / 2;
  // Brown draws B as a ringed pivot like the other joints, not a white ball.
  replace(b.tracerKnob, new THREE.CylinderGeometry(.16, .16, capHeight, 64));
  b.tracerKnob.material = b.tracerTip.material;
  b.tracerShaft.material = b.tracerTip.material;
  const shaftBottom = g.paperTopY + .055, shaftTop = pinTop + capHeight / 2;
  replace(b.tracerShaft,new THREE.CylinderGeometry(.055,.055,shaftTop-shaftBottom,32));
  b.tracerShaft.position.y = (shaftTop+shaftBottom)/2;
  b.pencilTip.position.y = g.paperTopY+.085;
  replace(b.pencilShaft,new THREE.CylinderGeometry(.072,.072,.98-.15,32));
  b.pencilShaft.position.y = g.paperTopY+(.98+.15)/2;

  const originalUpdate = model.update;
  model.update = time => {
    originalUpdate(time);
    for (const {legacy,mesh} of bars) {
      const {start,end} = legacy.userData.endpoints;
      mesh.position.copy(start); mesh.rotation.y = -Math.atan2(end.z-start.z,end.x-start.x);
    }
  };
  data.workingParts = {bars:bars.map(x=>x.mesh),fixedSlide,pencilSlide,fixedPost:post};
  data.reconstructionNote = 'The exact parallelogram gives a 2:1 copy. The six-second tracing path is prescribed; friction, pencil pressure and manual slide adjustment are not simulated. Bored joints and rail passages reconstruct the hidden thickness interfaces.';
  data.minimumDisplayCycleSeconds = g.cyclePeriod; data.hideGround = true;
  root.traverse(o => { for (const m of [].concat(o.material ?? [])) m.fog=false; });
  const bounds = new THREE.Box3();
  for (let i=0;i<=32;i++) {
    model.update(g.cyclePeriod*i/32);root.updateMatrixWorld(true);
    root.traverseVisible(o=>{if(o.geometry){o.geometry.computeBoundingBox();bounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}});
  }
  data.cameraFitBounds=bounds; data.cameraDistanceScale=1.02;
  markShadows(root);
  model.cameraDirection=new THREE.Vector3(-.85,16,4); model.update(0);return model;
}
