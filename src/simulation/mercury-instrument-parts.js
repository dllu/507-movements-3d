import * as THREE from 'three';
import {circle, poly, polygonClipping, turned} from './finite-plate-geometry.js';
import {horizontalPlate} from './horizontal-turbine-solids.js';
import {curvedPipeWall} from './finite-fluid-passages.js';
import {fitPistonGuide} from './piston-guide-parts.js';

const replace = (mesh, geometry) => { mesh.geometry.dispose(); mesh.geometry = geometry; };
const lathe = profile => turned(profile, 96).rotateX(-Math.PI / 2);
const wall = (inner, outer, low, high) => lathe([[low, inner], [low, outer], [high, outer], [high, inner]]);

// An exact circular bend gives vertical tangents at both ends of a U-tube.
class LowerBend extends THREE.Curve {
  constructor(radius, y) { super(); this.radius = radius; this.y = y; }
  getPoint(t, target = new THREE.Vector3()) {
    const a = Math.PI * (1 + t);
    return target.set(this.radius * Math.cos(a), this.y + this.radius * Math.sin(a), 0);
  }
  getTangent(t, target = new THREE.Vector3()) {
    const a = Math.PI * (1 + t);
    return target.set(-Math.sin(a), Math.cos(a), 0);
  }
}

function retainingClip(xs, radius, y, material) {
  const back = poly([[-.99, .20], [.99, .20], [.99, .55], [-.99, .55]]);
  const outer = polygonClipping.union(back, ...xs.map(x => poly(circle([x, 0], radius + .045, 64))));
  const section = polygonClipping.difference(outer, ...xs.map(x => poly(circle([x, 0], radius, 64))));
  const mesh = new THREE.Mesh(horizontalPlate(section, -.045, .045), material);
  mesh.position.y = y;
  mesh.userData.role = 'bored-glass-retaining-clip';
  return mesh;
}

// The scale board stands behind the glass leg it reads: a deeper board
// with a round groove in which that leg lies, so the board is carried by
// the tube (and the tube by the board) without bands or clips.
function grooveScaleBoard(board, legX, glassRadius, side = 1, clearance = .02) {
  board.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(board);
  const grooveRadius = glassRadius + clearance;
  // side 1: the board runs out to the right of the leg; -1: to its left.
  const left = side > 0 ? legX - glassRadius - .14 : box.min.x;
  const right = side > 0 ? box.max.x : legX + glassRadius + .14;
  const front = box.max.z, back = -(glassRadius + .10);
  const section = polygonClipping.difference(
    poly([[left, -back], [right, -back], [right, -front], [left, -front]]),
    poly(circle([legX, 0], grooveRadius, 96)),
  );
  const shape = new THREE.Shape(section[0][0].map(([x, y]) => new THREE.Vector2(x, y)));
  const geometry = new THREE.ExtrudeGeometry(shape, {depth: box.max.y - box.min.y, bevelEnabled: false, curveSegments: 1})
    .rotateX(-Math.PI / 2).translate(0, box.min.y, 0);
  replace(board, geometry);
  board.position.set(0, 0, 0); board.rotation.set(0, 0, 0); board.scale.set(1, 1, 1);
  board.userData.grooveForGlassLeg = {legX, grooveRadius};
}

export function correctMercuryInstrument(root, id, update) {
  const d = root.userData, b = d.blocks, g = d.geometry;
  const fluidRadius = id === 498 ? g.innerBoreRadius : g.innerTubeRadius;
  const bore = fluidRadius + .003;
  const bend = new LowerBend(g.legCenterX, g.bendTangentY);
  replace(b.glassBend, curvedPipeWall(bend, bore, g.glassOuterRadius, 64, 32));
  replace(b.mercuryBend, new THREE.TubeGeometry(bend, 64, fluidRadius, 32));

  if (id === 498) {
    for (const leg of b.glassLegs) replace(leg, wall(bore, g.glassOuterRadius, -.5, .5));
    replace(b.openLegRim, wall(bore, g.glassOuterRadius + .015, -.025, .025));
    b.openLegRim.rotation.set(0, 0, 0);
    // The old spline approached the top from below, leaving a pointed, open elbow.
    const elbowRadius = .4, elbowX = -g.legCenterX - elbowRadius;
    const inletY = g.tubeTopY + elbowRadius;
    const path = new THREE.CurvePath();
    path.add(new THREE.LineCurve3(new THREE.Vector3(-4.40, inletY, 0), new THREE.Vector3(elbowX, inletY, 0)));
    class Elbow extends THREE.Curve {
      getPoint(t, target = new THREE.Vector3()) {
        const a = Math.PI / 2 * (1 - t);
        return target.set(elbowX + elbowRadius * Math.cos(a), g.tubeTopY + elbowRadius * Math.sin(a), 0);
      }
      getTangent(t, target = new THREE.Vector3()) {
        const a = Math.PI / 2 * (1 - t);
        return target.set(Math.sin(a), -Math.cos(a), 0);
      }
    }
    path.add(new Elbow());
    replace(b.pressureConnection, curvedPipeWall(path, bore, g.glassOuterRadius, 96, 32));
    replace(b.pressureCore, new THREE.TubeGeometry(path, 96, fluidRadius - .002, 24));
    b.pressureConnection.userData.centerline = path;
    replace(b.boilerFlange, wall(bore, .42, -.08, .08));
    b.boilerFlange.position.y = inletY;
    // Pass 64: Brown draws the pipe only from his crop to the elbow, so it
    // runs straight to a clean open end; no flange, boiler or saddles.
    // Pass 65: Brown's cock is a plug cock: a round body between two pipe
    // flanges, a small plug head on top and the T handle of the plug key
    // hanging below. Its passage stays open.
    const cockX = -2.45, body = .30, flange = .27, bodyHalf = .24, flangeHalf = .30;
    const cockProfile = [[-flangeHalf, bore], [-flangeHalf, flange], [-bodyHalf, flange]];
    for (let i = 0; i <= 24; i++) {
      const a = -bodyHalf + 2 * bodyHalf * i / 24;
      cockProfile.push([a, Math.sqrt(body * body - a * a)]);
    }
    cockProfile.push([bodyHalf, flange], [flangeHalf, flange], [flangeHalf, bore]);
    const boss = new THREE.Mesh(lathe(cockProfile), b.boilerFlange.material);
    boss.rotation.z = Math.PI / 2; boss.position.set(cockX, inletY, 0);
    boss.userData.role = 'plug-cock-body-between-pipe-flanges';
    root.add(boss); b.valveBoss = boss;
    replace(b.valveStem, new THREE.CylinderGeometry(.075, .085, .12, 24));
    b.valveStem.userData.role = 'plug-cock-plug-head';
    b.valveStem.position.set(cockX, inletY + body - .02 + .06, 0);
    // The T handle: a flared neck from the body down to a flat cross bar.
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(.08, .13, .24, 24), b.valveHandle.material);
    neck.userData.role = 'plug-cock-key-neck';
    // The neck starts inside the round body, just below the passage.
    neck.position.set(cockX, inletY - body + .04 - .12, 0);
    root.add(neck); b.cockKeyNeck = neck;
    replace(b.valveHandle, new THREE.BoxGeometry(.66, .15, .20));
    b.valveHandle.userData.role = 'plug-cock-t-handle-bar';
    b.valveHandle.rotation.set(0, 0, 0);
    b.valveHandle.position.set(cockX, inletY - body + .04 - .24 - .075 + .005, 0);
    b.base.position.y = -3.47;
    replace(b.backPost, new THREE.BoxGeometry(.16, 6.12, .18));
    b.backPost.position.y = -.32;
    for (let i = 0; i < b.tubeClamps.length; i++) {
      const old = b.tubeClamps[i];
      const clip = retainingClip([-g.legCenterX, g.legCenterX], g.glassOuterRadius + .004, old.position.y, old.material);
      root.remove(old); old.geometry.dispose(); root.add(clip); b.tubeClamps[i] = clip;
    }
    for (const y of [1.05, 2.40]) {
      const tab = new THREE.Mesh(new THREE.BoxGeometry(.28, .06, .28), b.tubeClamps[0].material);
      tab.position.set(1.12, y, -.40); tab.userData.role = 'clip-tab-to-scale-board'; root.add(tab);
    }
    grooveScaleBoard(b.scaleBoard, g.legCenterX, g.glassOuterRadius);
    if (b.leftZeroBoard) {
      // Pass 96: the small zero tag is clipped to the pressure leg: its
      // groove fits the glass closely and a thin ivory band from its top
      // edge wraps the front of the tube, so it is visibly held by the leg.
      // The band stands above the zero level, where the pressure leg's
      // mercury (only ever depressed) never reaches.
      grooveScaleBoard(b.leftZeroBoard, -g.legCenterX, g.glassOuterRadius, -1, .004);
      const tag = new THREE.Box3().setFromObject(b.leftZeroBoard);
      const band = new THREE.Mesh(wall(g.glassOuterRadius + .004, g.glassOuterRadius + .028, -.03, .03), b.leftZeroBoard.material);
      band.position.set(-g.legCenterX, tag.max.y - .03, 0);
      band.userData.role = 'pressure-leg-zero-mark-tag-band';
      root.add(band); b.leftZeroBand = band;
    }
  } else {
    replace(b.glassLongLeg, wall(bore, g.glassOuterRadius, -.5, .5));
    replace(b.glassShortLower, wall(bore, g.glassOuterRadius, g.bendTangentY, -3.65));
    b.glassShortLower.position.y = 0;
    const r = g.reservoirInnerRadius, inner = r + .003;
    // The working band has the same constant area as the hydrostatic model.
    // Rounded shoulders below/above it connect to the narrow glass legs.
    replace(b.reservoirBulb, lathe([
      [-3.65, bore], [-3.65, g.glassOuterRadius], [-3.48, inner + .055],
      [-3.22, inner + .07], [-2.90, inner + .055], [-2.55, g.glassOuterRadius],
      [-2.55, bore], [-2.90, inner], [g.reservoirBottomY, inner],
    ]));
    b.reservoirBulb.position.y = 0; b.reservoirBulb.scale.y = 1;
    replace(b.shortOpenNeck, wall(bore, g.glassOuterRadius, -2.55, g.shortLegOpenY));
    b.shortOpenNeck.position.y = 0;
    replace(b.shortOpenRim, wall(bore, g.glassOuterRadius + .015, -.025, .025));
    b.shortOpenRim.rotation.set(0, 0, 0);
    replace(b.lowerShortMercury, lathe([
      [g.bendTangentY, 0], [g.bendTangentY, fluidRadius], [-3.65, fluidRadius],
      [g.reservoirBottomY, r], [g.reservoirBottomY, 0],
    ]));
    b.lowerShortMercury.position.y = 0;
    const cap = [];
    for (let i = 0; i <= 24; i++) {
      const a = i / 24 * Math.PI / 2;
      cap.push([Math.sin(a) * .10, g.glassOuterRadius * Math.cos(a)]);
    }
    for (let i = 24; i >= 0; i--) {
      const a = i / 24 * Math.PI / 2;
      cap.push([Math.sin(a) * .06, bore * Math.cos(a)]);
    }
    replace(b.sealedLongCap, lathe(cap)); b.sealedLongCap.scale.y = 1;
    b.supportBase.position.y = -5.0;
    replace(b.supportSpine, new THREE.BoxGeometry(.16, 9.65, .17));
    b.supportSpine.position.y = -.085;
    for (let i = 0; i < b.retainingClips.length; i++) {
      const old = b.retainingClips[i];
      const clip = retainingClip(i ? [g.legCenterX] : [-g.legCenterX, g.legCenterX], g.glassOuterRadius + .004, i ? old.position.y : -3.8, old.material);
      root.remove(old); old.geometry.dispose(); root.add(clip); b.retainingClips[i] = clip;
    }
    const scaleBracket = new THREE.Mesh(new THREE.BoxGeometry(1.2, .06, .14), b.retainingClips[0].material);
    scaleBracket.position.set(.63, 4.55, -.45); scaleBracket.userData.role = 'scale-board-bracket'; root.add(scaleBracket);
    const scaleTab = new THREE.Mesh(new THREE.BoxGeometry(.1, .06, .25), b.retainingClips[0].material);
    scaleTab.position.set(1.20, 4.55, -.365); scaleTab.userData.role = 'scale-board-bracket-tab'; root.add(scaleTab);
    grooveScaleBoard(b.scaleBoard, g.legCenterX, g.glassOuterRadius);
  }
  d.minimumDisplayCycleSeconds = g.cycleDuration;
  d.reconstructionNote = 'Finite glass walls and open pressure passages; constant-area working reservoir agrees with the existing volume-conserving hydrostatic law. Pressure is prescribed slowly, with no fluid inertia, capillary correction, heat transfer or valve-flow dynamics.';
  fitPistonGuide(root, update, g.cycleDuration);
  d.cameraDirection = new THREE.Vector3(.65, .35, 15);
  d.cameraFov = 12;
  root.traverse(o => { if ([].concat(o.material ?? []).some(m => m.transparent)) { o.castShadow = false; o.receiveShadow = false; } });
}
