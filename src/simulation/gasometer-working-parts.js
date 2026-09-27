import * as THREE from 'three';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import { circle, plate, poly, polygonClipping } from './finite-plate-geometry.js';
import { curvedPipeWall } from './finite-fluid-passages.js';

const tube = (radius, bore, height, segments = 72) => boredLatheGeometry([
  { radial: radius, axial: -height / 2 },
  { radial: radius, axial: height / 2 },
], bore, segments);
const INK = 0x252a2d;
const replace = (mesh, geometry) => { mesh.geometry.dispose(); mesh.geometry = geometry; };

// A closed meridian: outer ellipsoid, aperture edge, inner ellipsoid, equator.
function crown(radius, thickness, hole = 0) {
  const inner = radius - thickness, points = [];
  for (const [r, reverse] of [[radius, false], [inner, true]]) {
    const end = Math.acos(hole / r);
    for (let i = 0; i <= 28; i++) {
      const angle = end * (reverse ? 1 - i / 28 : i / 28);
      points.push(new THREE.Vector2(r * Math.cos(angle), r * Math.sin(angle)));
    }
  }
  points.push(points[0].clone());
  return new THREE.LatheGeometry(points, 72);
}
function floor(radius, pipeX, pipeRadius) {
  const outline = polygonClipping.difference(poly(circle([0, 0], radius, 96)),
    ...pipeX.map(x => poly(circle([x, 0], pipeRadius + 0.002, 48))));
  return plate(outline, -0.09, 0.09).rotateX(Math.PI / 2);
}
function addMesh(parent, geometry, material, role, position) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.role = role;
  if (position) mesh.position.copy(position);
  parent.add(mesh);
  return mesh;
}

// Brown draws no separate black rings: the bell seams go, and the lips on
// the tank and tubes take the metal of the part they finish.
function plainGasometerRims(root, b) {
  for (const rim of [b.bellBottomRim, b.bellCrownBand]) if (rim) rim.visible = false;
  const opaque = (mesh) => mesh.isMesh && mesh.visible && mesh.geometry?.type !== 'TorusGeometry'
    && !mesh.material.transparent && mesh.material.color?.getHex() !== INK;
  const rims = [];
  root.traverse((mesh) => {
    if (mesh.isMesh && mesh.visible && mesh.geometry?.type === 'TorusGeometry' && mesh.material.color?.getHex() === INK) rims.push(mesh);
  });
  for (const rim of rims) {
    const body = rim === b.tankTopRim ? b.tankBottom : rim.parent.children.find(opaque);
    if (!body) { rim.visible = false; continue; }
    rim.material = body.material;
    const { radius, tube: tubeRadius, radialSegments, tubularSegments } = rim.geometry.parameters;
    replace(rim, new THREE.TorusGeometry(radius, Math.min(tubeRadius, 0.05), radialSegments, tubularSegments));
  }
  root.userData.plainRims = rims.map((rim) => rim.userData.role);
}

export function correctGasometerWorkingParts(root, id) {
  const b = root.userData.blocks, counterweighted = id === 479;
  const tankRadius = counterweighted ? 2.38 : 2.66;
  const bellRadius = counterweighted ? 2 : 1.98;
  replace(b.tankWall, tube(tankRadius, tankRadius - 0.055, 2.2));
  replace(b.tankBottom, floor(tankRadius, counterweighted ? [-0.48, 0.48] : [-0.68, 0.68], counterweighted ? 0.16 : 0.155));
  replace(b.tankTopRim, new THREE.TorusGeometry(tankRadius, 0.095, 12, 96));
  replace(b.bellSkirt, tube(bellRadius, bellRadius - 0.05, counterweighted ? 2.3 : 2.2));
  replace(b.bellCrown, crown(bellRadius, 0.05, counterweighted ? 0 : 0.43));
  const pipes = b.gasPipes.map(group => group.children.find(mesh => mesh.userData.role?.endsWith('pipe-shell')));
  for (const pipe of pipes) {
    if (counterweighted) {
      // Pass 69: Brown's two pipes pass down through the floor and turn
      // outward under the tank (left pipe to the left, right to the right),
      // one bent pipe each instead of a straight stub ending below the floor.
      const x = pipe.position.x, side = Math.sign(x), top = 0.475, bendRadius = 0.25;
      const bendTop = b.tankBottom.position.y - 0.09 - 0.02, runY = bendTop - bendRadius;
      const path = new THREE.CurvePath();
      path.add(new THREE.LineCurve3(new THREE.Vector3(x, top, 0), new THREE.Vector3(x, bendTop, 0)));
      const bend = new THREE.Curve();
      bend.getPoint = (t, target = new THREE.Vector3()) => target.set(
        x + side * bendRadius * (1 - Math.cos(t * Math.PI / 2)), bendTop - bendRadius * Math.sin(t * Math.PI / 2), 0);
      path.add(bend);
      path.add(new THREE.LineCurve3(new THREE.Vector3(x + side * bendRadius, runY, 0), new THREE.Vector3(side * 3.0, runY, 0)));
      pipe.position.set(0, 0, 0);
      replace(pipe, curvedPipeWall(path, 0.12, 0.16, 160, 48));
      pipe.userData.flowPath = path;
    } else replace(pipe, tube(0.155, 0.12, 2.60, 48));
  }
  const parts = { pipes };
  // Pass 69: the water is one connected body. The inner water stands at the
  // gas-depressed level right up to the bell's inner face, the outer water
  // at atmospheric level from the bell's outer face to the tank wall, and a
  // ring under the bell's rim joins them; the pipes and (480) the guide tubes
  // are excluded, and the gap between sleeve a and tube b, open to the air
  // at the top, holds water at the outer level. The old volumes left dry
  // gaps round the skirt and under its rim and filled the pipe bores.
  const g = root.userData.geometry, gap = 0.004;
  const floorTop = b.tankBottom.position.y + 0.09 + gap;
  const tankInner = tankRadius - 0.055 - gap;
  const bellInner = bellRadius - (counterweighted ? 0.05 : 0.05);
  const pipeHoles = (counterweighted ? [-0.48, 0.48] : [-0.68, 0.68]).map(x => poly(circle([x, 0], (counterweighted ? 0.16 : 0.155) + gap, 64)));
  const annulus = (inner, outer, holes = []) => polygonClipping.difference(poly(circle([0, 0], outer, 128)),
    ...(inner > 0 ? [poly(circle([0, 0], inner, 128))] : []), ...holes);
  const prism = (polys, low, high) => plate(polys, low, high).rotateX(-Math.PI / 2);
  const waterMaterial = b.outerAnnularWater.material;
  const inner = counterweighted ? b.innerWater : b.innerAnnularWater;
  replace(b.outerAnnularWater, prism(annulus(bellRadius + gap, tankInner), floorTop, g.externalWaterSurfaceY));
  b.outerAnnularWater.position.set(0, 0, 0);
  b.outerAnnularWater.rotation.set(0, 0, 0);
  // 480: sleeve a ends in a rim bead (radius 0.4455, tube 0.045) kept dry.
  const sleeveRimOuter = 0.4455 + 0.045 + gap;
  replace(inner, prism(annulus(counterweighted ? 0 : sleeveRimOuter, bellInner - gap, pipeHoles), floorTop, g.internalWaterSurfaceY));
  inner.position.set(0, 0, 0);
  inner.rotation.set(0, 0, 0);
  const moving = [];
  const movingWater = (polys, role, topOf) => {
    const mesh = addMesh(root, prism(polys, 0, 1), waterMaterial, role);
    mesh.position.y = floorTop;
    moving.push([mesh, topOf]);
    return mesh;
  };
  b.underRimWater = movingWater(annulus(bellInner - gap, bellRadius + gap),
    'water-annulus-under-bell-rim-joining-inner-and-outer-water', bellY => bellY + g.bellLocalRimY);
  if (!counterweighted) {
    b.underSleeveWater = movingWater(annulus(0.351 - gap, sleeveRimOuter),
      'water-annulus-under-sleeve-a', bellY => bellY + g.movingTubeLocalBottomY - 0.045 - gap);
    b.sleeveGapWater = addMesh(root, prism(annulus(0.297 + gap, 0.351 - gap), floorTop, g.externalWaterSurfaceY), waterMaterial,
      'water-annulus-in-gap-between-tubes-a-and-b-at-atmospheric-level');
  }
  root.userData.waterSealUpdate = bellY => {
    for (const [mesh, topOf] of moving) mesh.scale.y = Math.max(1e-4, topOf(bellY) - floorTop);
  };
  if (counterweighted) {
    parts.axles = []; parts.grooves = []; parts.hubs = [];
    b.pulleys.forEach((pulley, i) => {
      const r = 0.46, c = 0.058;
      const profile = [{ radial: r + 0.04, axial: -0.14 }, { radial: r + 0.04, axial: -0.075 }];
      for (let j = 0; j <= 24; j++) {
        const z = c * (j / 12 - 1);
        profile.push({ radial: r - Math.sqrt(Math.max(0, c * c - z * z)), axial: z });
      }
      profile.push({ radial: r + 0.04, axial: 0.075 }, { radial: r + 0.04, axial: 0.14 });
      replace(pulley.userData.tread, boredLatheGeometry(profile, 0.34, 96));
      replace(pulley.userData.hub, tube(0.46 * 0.26, 0.073, 0.406, 48));
      // Original tread index would obstruct the rope groove.
      for (const child of pulley.userData.rotor.children) {
        if (child.geometry?.type === 'BoxGeometry' && !child.userData.role && child.position.z === 0) child.visible = false;
      }
      // The axle runs back into its post behind the pulley.
      const axle = addMesh(root, new THREE.CylinderGeometry(0.07, 0.07, 0.83, 48),
        b.tankTopRim.material, `counterweight-pulley-axle-${i + 1}`, pulley.position);
      axle.rotation.x = Math.PI / 2; axle.position.z = -0.165;
      parts.axles.push(axle); parts.grooves.push(pulley.userData.tread); parts.hubs.push(pulley.userData.hub);
      addMesh(b.counterweights[i], new THREE.CylinderGeometry(0.085, 0.085, 0.16, 24),
        b.tankTopRim.material, 'counterweight-rope-socket', new THREE.Vector3(0, 0.42, 0));
      // Extend each existing lug down into the crown-to-skirt seam.
      replace(b.bellRopeLugs[i], new THREE.BoxGeometry(0.18, 0.43, 0.34));
      b.bellRopeLugs[i].position.y -= 0.075;
    });
  } else {
    // Pass 56: tube b passes through a bore in the tank floor down to the
    // same depth as the two pipes (Brown draws it through the bottom); no
    // separate base collar sits on the floor.
    const tubeTop = b.fixedTubeShell.position.y + 5.54 / 2, tubeBottom = -2.48;
    replace(b.fixedTubeShell, tube(0.297, 0.245, tubeTop - tubeBottom));
    b.fixedTubeShell.position.y = (tubeTop + tubeBottom) / 2;
    replace(b.tankBottom, plate(polygonClipping.difference(poly(circle([0, 0], tankRadius, 96)),
      ...[-0.68, 0.68].map(x => poly(circle([x, 0], 0.157, 48))), poly(circle([0, 0], 0.299, 64))), -0.09, 0.09).rotateX(Math.PI / 2));
    replace(b.movingTubeShell, tube(0.4455, 0.351, 3.04));
    // The tinted gas volume also has to leave the guide sleeve empty.
    const radius = 1.78, hole = 0.50, end = Math.acos(hole / radius);
    const points = [new THREE.Vector2(hole, 0), new THREE.Vector2(radius, 0)];
    for (let i = 1; i <= 28; i++) points.push(new THREE.Vector2(radius * Math.cos(end * i / 28), radius * Math.sin(end * i / 28)));
    points.push(points[0].clone());
    replace(b.gasDome, new THREE.LatheGeometry(points, 72));
    parts.guide = b.fixedTubeShell; parts.sleeve = b.movingTubeShell;
  }
  // Section-like transparency keeps the two pipes and central sleeve legible.
  b.bellSkirt.material.opacity = 0.22;
  b.tankWall.material.opacity = 0.16;
  b.outerAnnularWater.material.opacity = 0.20;
  b.gasDome.material.opacity = 0.08;
  plainGasometerRims(root, b);
  root.userData.gasometerWorkingParts = parts;
  root.userData.minimumDisplayCycleSeconds = 8;
  root.userData.hideGround = true;
  root.userData.cameraDirection = new THREE.Vector3(0.45, 1.35, 15);
  root.userData.cameraDistanceScale = 1.0;
  root.userData.reconstructionNote = 'The fill and withdrawal cycle is prescribed. Pressure follows an assumed quasi-static weight balance; gas temperature, dimensions and masses are illustrative. Water displacement, pressure losses, guide friction and moving inertia are not dynamically solved.';
  root.traverse(object => {
    if (object.material) for (const material of [].concat(object.material)) material.fog = false;
  });
}
