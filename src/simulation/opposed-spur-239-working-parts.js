import * as THREE from 'three';
import { makeBeam, matte, PALETTE } from './primitives.js';
import { squareToothOutline } from './square-tooth-outline.js';
import { plate, poly, circle, ring, polygonClipping } from './finite-plate-geometry.js';
import { stopOutlines239 } from './baked/opposed-spur-239-outlines.js';

// Plate 239 draws square teeth. Their parallel flanks are 0.447 wide, the
// width the former involute had where the two stop noses bear (radii 2.17
// and 2.32), so the stops trap the same free play.
// Brown breaks the wheel off below the hub with an irregular line. The break
// is fixed in the world while the wheel turns, so fragments below a wavy
// world-space line are discarded instead of cutting the geometry (the same
// technique as movement 233's lantern wheel).
export const WHEEL_BREAK_239 = { amplitude: 0.1, level: -0.82, wavelength: 1.7 };
function applyWorldBreakBelow(material, { amplitude, level, wavelength }) {
  const broken = material.clone();
  broken.side = THREE.DoubleSide;
  broken.userData.worldBreakBelow = { amplitude, level, wavelength };
  broken.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBreakWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvBreakWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBreakWorld;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        {
          float k = 6.28318530718 / ${wavelength.toFixed(6)};
          float breakY = ${level.toFixed(6)}
            + ${amplitude.toFixed(6)} * (0.65 * sin(k * vBreakWorld.x + 0.7)
              + 0.35 * sin(2.3 * k * vBreakWorld.x + 2.1));
          if (vBreakWorld.y < breakY) discard;
        }`);
  };
  broken.customProgramCacheKey = () => `world-break-${level}-${amplitude}-${wavelength}`;
  return broken;
}

export const SQUARE_TOOTH_WIDTH_239 = 0.447;
export function spurStopProfile239({ teeth, pitchRadius, rootRadius, outerRadius }) {
  const square = squareToothOutline({ teeth, radius: pitchRadius, addendum: outerRadius - pitchRadius,
    dedendum: pitchRadius - rootRadius, width: SQUARE_TOOTH_WIDTH_239, taper: 0 });
  const outline = square.points;
  const pitch = 2 * Math.PI / teeth, base = null;
  const halfRoot = square.rootAngle;
  const flanks = {};
  for (const side of [-1, 1]) {
    flanks[side] = outline.filter(p => {
      const a = Math.atan2(p.y, p.x);
      return a * side > 0 && Math.abs(a) <= halfRoot + 1e-10 && p.x > 0;
    }).sort((a, b) => a.length() - b.length());
  }
  const pointAtRadius = (side, radius) => {
    const points = flanks[side];
    for (let i = 0; i < points.length - 1; i++) {
      const root = points[i], outer = points[i + 1];
      if (radius < root.length() - 1e-10 || radius > outer.length() + 1e-10) continue;
      const delta = outer.clone().sub(root), a = delta.lengthSq(), b = 2 * root.dot(delta), c = root.lengthSq() - radius ** 2;
      const u = (-b + Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a);
      const point = root.clone().addScaledVector(delta, u);
      return { point, angle: Math.atan2(point.y, point.x), segmentCoordinate: (radius - rootRadius) / (outerRadius - rootRadius), localSegmentCoordinate: u, segment: {root, outer} };
    }
    throw new RangeError('239 nose misses the square-tooth flank');
  };
  const halfTip = Math.abs(Math.atan2(flanks[1].at(-1).y, flanks[1].at(-1).x));
  return { outline, flanks, pointAtRadius, halfRoot, halfTip, pitch, base };
}

export function finishOpposedSpur239(model) {
  const { root } = model, d = root.userData, b = d.blocks, g = d.geometry;
  const replace = (mesh, geometry) => { mesh.geometry.dispose(); mesh.geometry = geometry; };
  const sourceOutlines = {};
  for (const side of ['left', 'right']) {
    const stop = b[`${side}Stop`], body = stop.userData.body;
    sourceOutlines[side] = body.geometry.parameters.shapes.getPoints(24).map(p => p.toArray());
    const outline = stopOutlines239[side] ?? poly(sourceOutlines[side]);
    replace(body, plate(polygonClipping.difference(outline, poly(circle([0, 0], 0.08, 96))), -0.15, 0.15));
    replace(stop.userData.hub, ring(0.08, 0.18, -0.213, 0.213, 96));
    stop.userData.hub.rotation.set(0, 0, 0);
  }
  // The hub's rear face stops just in front of the fixed output journal
  // (z -0.43 to -0.23) instead of turning 0.068 into it.
  replace(b.gearHub, ring(0.108, 0.46, -0.225, g.gearDepth * 0.71, 96));
  b.gearHub.rotation.set(0, 0, 0);
  replace(b.gearIndicator, new THREE.BoxGeometry(0.7, 0.045, 0.012));
  b.gearIndicator.position.set(1.2, 0, g.gearDepth / 2 + 0.006);
  b.gearIndicator.rotation.z = 0;
  // The fixed shafts terminate in bored journals attached to the rear rail.
  const journals = [], posts = [];
  const frameMaterial = matte(PALETTE.frame);
  for (const [name, pivot, boreRadius, outerRadius] of [
    ['left', g.leftPivot, 0.078, 0.20], ['right', g.rightPivot, 0.078, 0.20],
    ['output', new THREE.Vector2(), 0.108, 0.24],
  ]) {
    const journal = new THREE.Mesh(ring(boreRadius, outerRadius, -0.43, -0.23, 96), frameMaterial);
    journal.position.set(pivot.x, pivot.y, 0); journal.userData.role = `${name}-bored-fixed-journal`;
    const post = makeBeam(new THREE.Vector3(pivot.x, -3.35, -0.32), new THREE.Vector3(pivot.x, pivot.y - outerRadius + 0.03, -0.32), {color: PALETTE.frame, depth: 0.18, thickness: 0.14});
    post.userData.role = `${name}-journal-support-post`; root.add(journal, post); journals.push(journal); posts.push(post);
  }
  b.bearingPost.visible = false;
  // The plate breaks the wheel off just below its hub; the fixed journals
  // and rail behind it are not drawn, and no index mark is drawn on the wheel.
  for (const mesh of [b.gearBody, b.gearHub, b.gearHubRing]) {
    const original = mesh.material;
    mesh.material = applyWorldBreakBelow(original, WHEEL_BREAK_239);
    original.dispose();
  }
  b.gearIndicator.removeFromParent();
  d.wheelBreak = { ...WHEEL_BREAK_239 };
  d.workingParts239 = { sourceOutlines, journals, posts };
  // The full turning wheel is kept as sweptBounds; the camera fits the
  // plate's crop, which ends at the break line below the hub.
  d.sweptBounds = new THREE.Box3(new THREE.Vector3(-3.7, -3.55, -0.68), new THREE.Vector3(5, 3.25, 0.65));
  d.cameraFitBounds.set(new THREE.Vector3(-3.7, -1.05, -0.68), new THREE.Vector3(5, 3.25, 0.65));
  d.minimumDisplayCycleSeconds = 6;
  d.hideGround = true;
  d.reconstructionNote = 'Opposed finite stops limit the gear to its small trapped clearance. The alternating test torque and seated stops are prescribed; gravity seating, hinge reactions, friction and holding strength are not dynamically solved.';
  d.sourceAnimation.reason = 'The official page marks Animated unavailable and registers no inline animation.';
  root.traverse(o => { if(o.isMesh) {o.castShadow = true; o.receiveShadow = true;} for(const material of [].concat(o.material ?? [])) material.fog = false; });
  const update = model.update;
  model.update = time => { update(time); b.leftContactMarker.visible = false; b.rightContactMarker.visible = false; };
  model.cameraDirection = new THREE.Vector3(0.4, 0.3, 15);
  model.update(0);
  return model;
}
