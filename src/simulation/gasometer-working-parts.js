import * as THREE from 'three';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import { circle, plate, poly, polygonClipping } from './finite-plate-geometry.js';

const tube = (radius, bore, height, segments = 72) => boredLatheGeometry([
  { radial: radius, axial: -height / 2 },
  { radial: radius, axial: height / 2 },
], bore, segments);
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
    if (counterweighted) pipe.position.y = (-2.48 + 0.475) / 2;
    replace(pipe, tube(counterweighted ? 0.16 : 0.155, 0.12, counterweighted ? 2.955 : 2.60, 48));
  }
  const parts = { pipes };
  if (counterweighted) {
    // Narrower cistern leaves the source's external hanging weights outside it
    // over their complete descent, while preserving both constant rope laws.
    replace(b.outerAnnularWater, tube(2.30, 2.085, 2.02).rotateX(-Math.PI / 2));
    const waterTop = b.innerWater.position.y + 0.96;
    const waterBottom = b.tankBottom.position.y + 0.10;
    replace(b.innerWater, new THREE.CylinderGeometry(1.89, 1.89, waterTop - waterBottom, 64));
    b.innerWater.position.y = (waterTop + waterBottom) / 2;
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
    replace(b.fixedTubeShell, tube(0.297, 0.245, 5.54));
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
