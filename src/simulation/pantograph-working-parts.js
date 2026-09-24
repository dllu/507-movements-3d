import * as THREE from 'three';
import { circle, poly, plate, polygonClipping as clip } from './finite-plate-geometry.js';
import { boredCylinderGeometry } from './piston-guide-parts.js';
import { markShadows } from './primitives.js';

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
  const [,post,oldRing] = b.fixedPivot.children;
  replace(post, new THREE.CylinderGeometry(.095,.095,.60-g.paperTopY,64));
  post.position.y = (.60+g.paperTopY)/2;
  // Brown draws C as a plain round knob, without a dark pin end.
  post.material = oldRing.material;
  replace(oldRing, boredCylinderGeometry(.18,.099,.025));
  oldRing.rotation.set(0,0,0); oldRing.position.y = g.lowerLayerY-.13;
  const fixedCap = new THREE.Mesh(boredCylinderGeometry(.14,.092,.025),oldRing.material);
  fixedCap.position.y = g.lowerLayerY+.13; b.fixedPivot.add(fixedCap);
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
  b.tracerKnob.position.y = g.paperTopY+.93;
  replace(b.tracerShaft,new THREE.CylinderGeometry(.055,.055,.82-.055,32));
  b.tracerShaft.position.y = g.paperTopY+(.82+.055)/2;
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
  data.workingParts = {bars:bars.map(x=>x.mesh),fixedSlide,pencilSlide,fixedPost:post,fixedCap,fixedRing:oldRing};
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
