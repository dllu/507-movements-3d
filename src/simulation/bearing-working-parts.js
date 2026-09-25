import * as THREE from 'three';
import {circle, ring, plate, poly, polygonClipping} from './finite-plate-geometry.js';
import {boredCylinderGeometry, fitPistonGuide} from './piston-guide-parts.js';

function replace(mesh, geometry) {
  mesh.geometry.dispose();
  mesh.geometry = geometry;
}

function pedestalGeometry() {
  // Smooth intended casting edges, fitted to the source proportions. The old
  // pedestal stopped at the bottom of the wheels rather than below them.
  const shape = new THREE.Shape();
  shape.moveTo(-5.45, -12.75);
  shape.lineTo(5.45, -12.75);
  shape.lineTo(5.45, -4.05);
  shape.bezierCurveTo(5.45, -2.55, 3.85, -2.0, 2.75, -3.8);
  shape.quadraticCurveTo(0, -6.55, -2.75, -3.8);
  shape.bezierCurveTo(-3.85, -2.0, -5.45, -2.55, -5.45, -4.05);
  shape.closePath();
  let section = poly(shape.getPoints(32).map(p => p.toArray()));
  for (const sign of [-1, 1]) {
    const window = new THREE.Shape();
    window.moveTo(sign * 4.0, -8.1);
    window.lineTo(sign * 4.0, -5.95);
    window.quadraticCurveTo(sign * 1.35, -5.7, sign * 2.35, -6.65);
    window.closePath();
    section = polygonClipping.difference(section, poly(window.getPoints(24).map(p => p.toArray())));
  }
  const arch = new THREE.Shape();
  arch.moveTo(-3.95, -12.05);
  arch.lineTo(3.95, -12.05);
  arch.bezierCurveTo(3.7, -8.4, 2.9, -7.2, 0, -7.15);
  arch.bezierCurveTo(-2.9, -7.2, -3.7, -8.4, -3.95, -12.05);
  arch.closePath();
  section = polygonClipping.difference(section, poly(arch.getPoints(40).map(p => p.toArray())));
  return plate(section, -.17, .17);
}

function axle(parent, radius, low, high, material, role, x = 0, y = 0) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, high - low, 64), material);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, (low + high) / 2);
  mesh.userData.role = role;
  parent.add(mesh);
  return mesh;
}

function correctWheelBearing(root) {
  const {blocks: b, geometry: g} = root.userData;
  replace(b.frame, pedestalGeometry());
  b.frame.position.z = 1.75;
  replace(b.base, new THREE.BoxGeometry(11.0, .26, .8));
  b.base.position.set(0, -12.88, 1.65);
  b.supportAxles = [];
  for (const [index, side] of ['left', 'right'].entries()) {
    const z = g.supportWheelAxialPlanes[index];
    const hub = b[`${side}SupportHub`];
    replace(hub, boredCylinderGeometry(g.supportHubRadius, g.supportAxleRadius + .008, .58));
    replace(b[`${side}SupportRim`], ring(g.supportInnerRadius, g.supportOuterRadius, -.2, .2, 256));
    for (const spoke of b[`${side}SupportSpokes`]) {
      const start = g.supportHubRadius - .03, end = g.supportInnerRadius + .03;
      replace(spoke, new THREE.BoxGeometry(end - start, .18, .28));
      const a = spoke.rotation.z;
      spoke.position.set(Math.cos(a) * (start + end) / 2, Math.sin(a) * (start + end) / 2, z);
    }
    b[`${side}SupportIndex`].position.z = z + .23;
    const x = (index ? 1 : -1) * g.supportCenterX;
    b.supportAxles.push(axle(root, g.supportAxleRadius, z - .31, 2.04, b.pivotCaps[index].material,
      `${side}-fixed-axle-through-bored-support-wheel`, x, g.supportCenterY));
    b.pivotCaps[index].position.z = 2.0;
  }
  replace(b.mainFlywheelRim, ring(g.flywheelInnerRadius, g.flywheelOuterRadius, -.2, .2, 256));
  b.mainFlywheelIndex.position.z = b.mainFlywheelRim.position.z + .235;
  b.shaftJournalIndex.position.z = 1.1575;
  // Contact dots label the interface from in front of the shaft, rather than
  // occupying the tangent solids themselves.
  b.contactMarkers.forEach(marker => { marker.position.z = 1.26; });
  root.userData.minimumDisplayCycleSeconds = g.inputCyclePeriod;
  root.userData.workingBearingReview = {
    interfaces: 'Bored support hubs, fixed axles, flat rims and a separated full-height front pedestal.',
    residual: 'No-slip motion is analytical; bearing loads, friction and elastic deformation are not solved. Casting depth and axle fastening are inferred.',
  };
}

function correctRollerBearing(root) {
  const {blocks: b, geometry: g} = root.userData;
  // No bevel may protrude into a working race or belt. A circumscribed inner
  // polygon keeps the finite outer race outside the ideal cylindrical rollers.
  replace(b.pulleyWeb, ring(g.outerRaceInnerRadius / Math.cos(Math.PI / 512), g.pulleyWebOuterRadius,
    -g.pulleyDepth / 2, g.pulleyDepth / 2, 512));
  replace(b.pulleyRim, ring(g.pulleyWebOuterRadius - .12, g.pulleyOuterRadius,
    -g.pulleyRimDepth / 2, g.pulleyRimDepth / 2, 512));
  const inside = g.pulleyOuterRadius / Math.cos(Math.PI / 512);
  const outside = g.pulleyOuterRadius + g.beltThickness;
  const outline = [[-outside, -g.beltLegLength]];
  for (let i = 0; i <= 256; i++) {
    const angle = Math.PI - Math.PI * i / 256;
    outline.push([outside * Math.cos(angle), outside * Math.sin(angle)]);
  }
  outline.push([outside, -g.beltLegLength], [inside, -g.beltLegLength]);
  for (let i = 0; i <= 256; i++) {
    const angle = Math.PI * i / 256;
    outline.push([inside * Math.cos(angle), inside * Math.sin(angle)]);
  }
  outline.push([-inside, -g.beltLegLength]);
  replace(b.belt, plate(poly(outline), -g.beltDepth / 2, g.beltDepth / 2));
  if (root.userData.sourceReference?.plate270) twistedRope(root);
  replace(b.innerRace, new THREE.CylinderGeometry(g.innerRaceRadius, g.innerRaceRadius, g.innerRaceDepth, 256));
  replace(b.cagePlate, ring(g.innerRaceRadius + .08, g.outerRaceInnerRadius - .08,
    -g.cageDepth / 2, g.cageDepth / 2, 256));
  b.cageIndex.visible = false;
  b.cagePins = [];
  for (const assembly of b.rollerAssemblies) {
    replace(assembly.body, boredCylinderGeometry(g.rollerBodyRadius, .065, g.rollerDepth));
    replace(assembly.hub, boredCylinderGeometry(.105, .065, g.rollerDepth * 1.1));
    b.cagePins.push(axle(assembly.positionGroup, .060, -.365, .31, assembly.hub.material,
      `retainer-pin-through-roller-${assembly.index + 1}`));
    assembly.faceIndex.position.z = g.rollerDepth / 2 + .02;
  }
  // Hide the invented pedestal: the engraving is an open bearing section and
  // does not specify how its stationary journal is attached to a machine.
  root.remove(b.supportPost, b.supportFoot);
  b.supportPost.visible = b.supportFoot.visible = false;
  b.pulleyIndex.position.x = 1.70;
  replace(b.pulleyIndex, new THREE.BoxGeometry(.48, .075, .055));
  b.pulleyIndex.position.z = g.pulleyDepth / 2 + .0275;
  root.userData.minimumDisplayCycleSeconds = root.userData.timeline.demonstrationPeriod;
  root.userData.workingBearingReview = {
    interfaces: 'Finite cylindrical races, bored rollers and captured retainer pins; exposed cutaway without an invented stand.',
    residual: 'Pure rolling and cage spacing are imposed analytically. Loads, slip, lubrication and cage force response are not solved; historical retainer details remain ambiguous.',
  };
}

// Brown hatches both hanging legs of 270 as a laid rope. Replace the flat
// band by three helical strands laid round the same centreline, touching the
// tread at the rope's inner side. Brown crops the legs; the rope is endless,
// running down past the plate's edge round an equal lower sheave, so no
// strand ends in mid-air. The lay travels with the rope: the strand phase at
// arc length s is 2π(s - v t)/lay, the lay divides one pulley circumference
// and the loop length is a whole number of lays, so the pattern closes. The
// buffer keeps the rope at zero travel (a fixed solid for clearance checks);
// the vertex shader shifts the lay.
function twistedRope(root) {
  const {blocks: b, geometry: g} = root.userData;
  const rc = g.beltCenterlineRadius;
  const ropeRadius = g.beltThickness / 2;
  const strandRadius = ropeRadius / (1 + 1 / Math.sin(Math.PI / 3));
  const layRadius = ropeRadius - strandRadius;
  const loop = 2 * Math.PI * g.pulleyOuterRadius;
  const strandLay = loop / Math.round(loop / 0.13);
  const lay = 3 * strandLay;
  const arc = Math.PI * rc;
  const legs = (Math.round((2 * 9 + 2 * arc) / lay) * lay - 2 * arc) / 2, length = 2 * legs + 2 * arc;
  const along = Math.ceil(length / 0.018), around = 10, strands = 3;
  const frame = (s) => {
    if (s <= legs) return {x: -rc, y: -legs + s, nx: -1, ny: 0};
    if (s <= legs + arc) {
      const angle = Math.PI - (s - legs) / rc;
      return {x: rc * Math.cos(angle), y: rc * Math.sin(angle), nx: Math.cos(angle), ny: Math.sin(angle)};
    }
    if (s <= 2 * legs + arc) return {x: rc, y: legs + arc - s, nx: 1, ny: 0};
    const angle = -(s - 2 * legs - arc) / rc;
    return {x: rc * Math.cos(angle), y: -legs + rc * Math.sin(angle), nx: Math.cos(angle), ny: Math.sin(angle)};
  };
  // Each strand is a closed ring of stations; the last station repeats the
  // first, where the whole-lay loop length makes the strands meet.
  const count = strands * (along + 1) * around;
  const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3);
  const ropeS = new Float32Array(count), ropeStrand = new Float32Array(count), ropeAround = new Float32Array(count);
  const ropeRing = new Float32Array(count).fill(1);
  const index = [];
  let n = 0;
  for (let k = 0; k < strands; k++) {
    for (let i = 0; i <= along; i++) {
      const s = length * i / along, f = frame(s);
      const phase = 2 * Math.PI * (s / lay + k / strands);
      const cn = layRadius * Math.cos(phase), cz = layRadius * Math.sin(phase);
      for (let j = 0; j < around; j++) {
        const t = 2 * Math.PI * j / around, on = Math.cos(t), oz = Math.sin(t), r = cn + strandRadius * on;
        positions.set([f.x + f.nx * r, f.y + f.ny * r, cz + strandRadius * oz], 3 * n);
        normals.set([f.nx * on, f.ny * on, oz], 3 * n);
        ropeS[n] = s; ropeStrand[n] = k; ropeAround[n] = t;
        if (i < along) {
          const a = n, c = n + around, a1 = n - j + (j + 1) % around, c1 = a1 + around;
          index.push(a, a1, c, a1, c1, c);
        }
        n++;
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('ropeS', new THREE.BufferAttribute(ropeS, 1));
  geometry.setAttribute('ropeStrand', new THREE.BufferAttribute(ropeStrand, 1));
  geometry.setAttribute('ropeAround', new THREE.BufferAttribute(ropeAround, 1));
  geometry.setAttribute('ropeRing', new THREE.BufferAttribute(ropeRing, 1));
  geometry.setIndex(index);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  replace(b.belt, geometry);
  const travel = {value: 0};
  const material = b.belt.material;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.ropeTravel = travel;
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', `attribute float ropeS;
attribute float ropeStrand;
attribute float ropeAround;
attribute float ropeRing;
uniform float ropeTravel;
void ropeFrame(float s, out vec2 c, out vec2 nrm) {
  float legs = ${legs.toFixed(8)}, rc = ${rc.toFixed(8)}, arc = ${arc.toFixed(8)};
  if (s <= legs) { c = vec2(-rc, -legs + s); nrm = vec2(-1.0, 0.0); }
  else if (s <= legs + arc) { float a = 3.14159265358979 - (s - legs) / rc; nrm = vec2(cos(a), sin(a)); c = rc * nrm; }
  else if (s <= 2.0 * legs + arc) { c = vec2(rc, legs + arc - s); nrm = vec2(1.0, 0.0); }
  else { float a = -(s - 2.0 * legs - arc) / rc; nrm = vec2(cos(a), sin(a)); c = vec2(0.0, -legs) + rc * nrm; }
}
void main() {`)
      .replace('#include <beginnormal_vertex>', `vec2 ropeC; vec2 ropeN; ropeFrame(ropeS, ropeC, ropeN);
vec3 objectNormal = vec3(ropeN * cos(ropeAround), sin(ropeAround));
#ifdef USE_TANGENT
vec3 objectTangent = vec3( tangent.xyz );
#endif`)
      .replace('#include <begin_vertex>', `float ropePhase = 6.28318530717959 * ((ropeS - ropeTravel) / ${lay.toFixed(10)} + ropeStrand / 3.0);
float ropeR = ${layRadius.toFixed(8)} * cos(ropePhase) + ropeRing * ${strandRadius.toFixed(8)} * cos(ropeAround);
vec3 transformed = vec3(ropeC + ropeN * ropeR, ${layRadius.toFixed(8)} * sin(ropePhase) + ropeRing * ${strandRadius.toFixed(8)} * sin(ropeAround));
#ifdef USE_ALPHAHASH
vPosition = vec3( position );
#endif`);
  };
  material.customProgramCacheKey = () => 'laid-rope-270';
  b.belt.userData.role = 'single-laid-three-strand-rope-with-exact-straight-to-semicircular-tangent-path';
  b.belt.userData.ropeLay = {lay, layRadius, ropeRadius, strandRadius, strands, loopLegLength: legs, closed: true};
  // The lower return sheave the endless rope runs round, below the plate's
  // crop: a plain grooved disc on its own journal, turning with the pulley.
  const sheave = new THREE.Group();
  sheave.position.y = -legs;
  sheave.userData.role = 'lower-return-sheave-of-endless-rope-below-plate-crop';
  for (const part of [b.pulleyRim, b.pulleyFrontFlange, b.pulleyRearFlange]) sheave.add(part.clone());
  const web = new THREE.Mesh(ring(0.3, g.pulleyWebOuterRadius, -g.pulleyDepth / 2, g.pulleyDepth / 2, 128), b.pulleyWeb.material);
  web.userData.role = 'lower-return-sheave-web';
  const journal = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, g.pulleyRimDepth + 0.2, 48), b.innerRace.material);
  journal.rotation.x = Math.PI / 2;
  journal.userData.role = 'lower-return-sheave-journal';
  sheave.add(web);
  const lower = new THREE.Group();
  lower.userData.role = 'lower-return-sheave-assembly';
  lower.add(sheave, journal);
  journal.position.y = -legs;
  root.add(lower);
  b.lowerReturnSheave = sheave;
  b.lowerReturnAssembly = lower;
  const speed = root.userData.transmission?.beltLinearSpeed ?? 0;
  root.userData.layRopeAtTime = (time) => {
    travel.value = ((speed * time) % lay + lay) % lay;
    sheave.rotation.z = b.pulleyRotor.rotation.z;
  };
}

// Brown's plate 270 draws two figures: the assembled pulley on the left, with
// a cover over the bearing showing six pin holes and a fluted journal end,
// and the exposed rollers on the right. The working cutaway stays at the
// origin as the right figure; the left figure shares its geometry and motion.
function addAssembledView(model) {
  const root = model.root;
  const {blocks: b, geometry: g, sourceReference} = root.userData;
  const view = sourceReference.plate270;
  const pixel = g.pulleyOuterRadius / view.assembledView.pulleyOuterRadius;
  const offsetX = (view.assembledView.centerX - view.cutawayView.centerX) * pixel;
  const coverRadius = view.assembledView.coverRadius * pixel;
  // Brown's cover holes sit on a 44 px circle, a little inside the 49 px
  // roller circle of his right figure. This figure holds no rollers, so the
  // holes follow the left figure and show the open space behind the cover.
  const pinHoleCircle = view.assembledView.holeCircleRadius * pixel;
  const pinHoleRadius = view.assembledView.holeRadius * pixel;
  const front = g.pulleyDepth / 2;
  const figure = new THREE.Group();
  figure.position.x = offsetX;
  figure.userData.role = 'assembled-left-view-of-the-same-pulley-bearing';
  const pulleyRotor = new THREE.Group();
  pulleyRotor.userData.role = 'assembled-view-pulley-rotor';
  for (const part of [b.pulleyWeb, b.pulleyRim, b.pulleyFrontFlange, b.pulleyRearFlange]) {
    pulleyRotor.add(part.clone());
  }
  const face = new THREE.Mesh(
    ring(coverRadius + 0.004, g.pulleyWebOuterRadius - 0.121, front + 0.001, front + 0.05, 256),
    b.pulleyWeb.material,
  );
  face.userData.role = 'assembled-view-pulley-front-face';
  pulleyRotor.add(face);
  const cover = new THREE.Group();
  cover.userData.role = 'assembled-view-roller-retainer-cover';
  let section = polygonClipping.difference(
    poly(circle([0, 0], coverRadius, 256)),
    poly(circle([0, 0], g.innerRaceRadius + 0.004, 256)),
  );
  for (let index = 0; index < 6; index += 1) {
    const angle = Math.PI / 2 + index * Math.PI / 3;
    section = polygonClipping.difference(section,
      poly(circle([pinHoleCircle * Math.cos(angle), pinHoleCircle * Math.sin(angle)], pinHoleRadius, 48)));
  }
  const coverPlate = new THREE.Mesh(plate(section, front + 0.001, front + 0.05), b.cagePlate.material);
  coverPlate.userData.role = 'assembled-view-cover-with-six-pin-holes';
  cover.add(coverPlate);
  const journal = new THREE.Mesh(b.innerRace.geometry, b.innerRace.material);
  journal.position.copy(b.innerRace.position);
  journal.rotation.copy(b.innerRace.rotation);
  journal.userData.role = 'assembled-view-stationary-journal';
  const star = new THREE.Shape();
  for (let index = 0; index <= 96; index += 1) {
    const angle = index * Math.PI * 2 / 96;
    const radius = g.innerRaceRadius * (0.72 + 0.16 * Math.cos(6 * angle));
    if (index === 0) star.moveTo(radius, 0);
    else star.lineTo(radius * Math.cos(angle), radius * Math.sin(angle));
  }
  const starMesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(star, {bevelEnabled: false, depth: 0.04, curveSegments: 1}),
    b.innerRaceFrontRing.material,
  );
  starMesh.position.z = b.innerRace.position.z + g.innerRaceDepth / 2;
  starMesh.userData.role = 'assembled-view-fluted-journal-end';
  figure.add(b.belt.clone(), pulleyRotor, cover, journal, starMesh);
  const lowerSheave = b.lowerReturnAssembly?.clone();
  if (lowerSheave) figure.add(lowerSheave);
  const lowerRotor = lowerSheave?.children.find((part) => part.userData.role === 'lower-return-sheave-of-endless-rope-below-plate-crop');
  root.add(figure);
  Object.assign(b, {assembledCover: cover, assembledFigure: figure, assembledPulleyRotor: pulleyRotor});
  root.userData.bearingInterpretation.consolidatedView =
    'Brown’s assembled left view and exposed right view are shown side by side; the left figure shares the right figure’s pulley and retainer motion';
  const baseUpdate = model.update;
  model.update = (time) => {
    baseUpdate(time);
    pulleyRotor.rotation.z = b.pulleyRotor.rotation.z;
    if (lowerRotor) lowerRotor.rotation.z = b.pulleyRotor.rotation.z;
    cover.rotation.z = b.rollerCarrier.rotation.z;
    for (const marker of b.beltMarkers) marker.visible = false;
  };
  model.update(0);
}

export function correctBearingParts(model, id) {
  if (id === 250) correctWheelBearing(model.root);
  else correctRollerBearing(model.root);
  // Brown draws no white phase marks, contact dots or belt beads.
  model.root.traverse((object) => {
    if (object.isMesh && /white-.*index|contact-marker|belt-marker|contact-of-reference-roller/
      .test(object.userData.role ?? '')) {
      object.visible = false;
    }
  });
  if (id === 270) {
    const baseUpdate = model.update;
    model.update = (time) => {
      baseUpdate(time);
      model.root.userData.layRopeAtTime?.(time);
    };
    addAssembledView(model);
  }
  fitPistonGuide(model.root, model.update, model.root.userData.minimumDisplayCycleSeconds);
  // Frame Brown's crop: the rope runs on below it to the lower return sheave.
  if (model.root.userData.blocks.lowerReturnAssembly) {
    model.root.userData.cameraFitBounds.min.y = -model.root.userData.geometry.beltLegLength - .03;
  }
  model.cameraDirection = new THREE.Vector3(.45, .55, 15);
}
