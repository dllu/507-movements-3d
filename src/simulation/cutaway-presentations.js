import * as THREE from 'three';
import {curvedPipeWall, mergePassageParts} from './finite-fluid-passages.js';
import {cutFaceMaterial, latheSectionGeometry, mercuryMaterial, sectionMeshInPlace, solidMaterial} from './cutaway-section.js';

// Pass 55: Brown's sectioned vessels, pumps and cylinders rendered as ONE
// clean cutaway (see cutaway-section.js) instead of translucent stand-ins.
// A spec names parts by role (the mesh's own role or its nearest ancestor's)
// or by predicate:
//   cut      opaque walls cut on the plane (default z = 0 in root space)
//   water    water volumes cut on the same plane, left as real water
//   solid    parts made opaque and whole (no section needed)
//   hide     symbolic volumes (tinted gas/air/heat stand-ins) removed
//   mercury  volumes rendered as opaque silvery metal
//   plane    {normal, point} in root space (default normal +z through origin)

function roleOf(object) {
  for (let o = object; o; o = o.parent) if (o.userData?.role) return o.userData.role;
  return '';
}

function matches(mesh, patterns) {
  const role = roleOf(mesh);
  return patterns.some(pattern => typeof pattern === 'function' ? pattern(mesh, role) : pattern instanceof RegExp ? pattern.test(role) : role === pattern);
}

// A thin open shell cannot be capped; give it a wall first.
function thickenOpenShell(mesh, wall) {
  const g = mesh.geometry, p = g.parameters ?? {};
  if (g.type === 'CylinderGeometry' && p.openEnded) {
    const h = p.height / 2, t = wall ?? Math.max(0.03, 0.06 * Math.max(p.radiusTop, p.radiusBottom));
    const next = latheSectionGeometry([[Math.max(0.001, p.radiusBottom - t), -h], [p.radiusBottom, -h], [p.radiusTop, h], [Math.max(0.001, p.radiusTop - t), h]], {segments: p.radialSegments ?? 48, phiStart: 0, phiLength: Math.PI * 2});
    g.dispose();mesh.geometry = next;return true;
  }
  if (g.type === 'TubeGeometry' && p.path) {
    const t = wall ?? Math.max(0.02, 0.18 * p.radius);
    const next = curvedPipeWall(p.path, p.radius - t, p.radius, p.tubularSegments ?? 64, Math.max(12, p.radialSegments ?? 16));
    g.dispose();mesh.geometry = next;return true;
  }
  return false;
}

// Convert a closed solid cylinder standing in for a vessel into a hollow
// vessel with a bottom (well shafts, tanks, jars).
export function hollowVesselGeometry(geometry, {wall = 0.06, bottom = wall, top = false} = {}) {
  const p = geometry.parameters, h = p.height / 2, r0 = p.radiusBottom, r1 = p.radiusTop;
  const profile = bottom > 0 ?
    [[0, -h], [r0, -h], [r1, h], [r1 - wall, h], [r0 - wall, -h + bottom], [0, -h + bottom]] :
    [[r0 - wall, -h], [r0, -h], [r1, h], [r1 - wall, h]];
  if (top) profile.splice(0, profile.length, [0, -h], [r0, -h], [r1, h], [0, h]);
  return latheSectionGeometry(profile, {segments: p.radialSegments ?? 48, phiStart: 0, phiLength: Math.PI * 2});
}

export function applyCutaway(root, spec) {
  if (!spec) return null;
  spec.prepare?.(root);
  root.updateMatrixWorld(true);
  const normal = spec.plane?.normal ?? new THREE.Vector3(0, 0, 1), point = spec.plane?.point ?? new THREE.Vector3();
  const unit = normal.clone().normalize(), waterPlane = new THREE.Plane(unit.clone().negate(), unit.dot(point));
  const meshes = [];
  root.traverse(o => {if (o.isMesh) meshes.push(o);});
  const report = {cut: [], water: [], solid: [], hide: [], mercury: [], open: [], removed: []};
  for (const mesh of meshes) {
    if (spec.hide && matches(mesh, spec.hide)) {
      // Material visibility persists even where an update toggles the mesh.
      mesh.visible = false;mesh.material = [].concat(mesh.material).map(m => {const c = m.clone();c.visible = false;return c;});
      if (mesh.material.length === 1) mesh.material = mesh.material[0];
      report.hide.push(roleOf(mesh));continue;
    }
    if (spec.mercury && matches(mesh, spec.mercury)) {
      mesh.material = mercuryMaterial();report.mercury.push(roleOf(mesh));
      // Walls dipping into the quicksilver share its cut plane: draw the
      // quicksilver just behind them there instead of z-fighting.
      if (spec.mercuryBehindWalls) Object.assign(mesh.material, {polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 4});
      if (spec.cutMercury) {
        sectionMeshInPlace(mesh, root, {normal, point});
        if (!mesh.geometry.attributes.position.count) {mesh.parent?.remove(mesh);report.removed.push(roleOf(mesh));}
      }
      continue;
    }
    if (spec.cut && matches(mesh, spec.cut)) {
      const custom = spec.vessel?.find(([pattern]) => matches(mesh, [pattern]));
      if (custom) {const next = hollowVesselGeometry(mesh.geometry, custom[1]);mesh.geometry.dispose();mesh.geometry = next;}
      else thickenOpenShell(mesh, spec.wall);
      const role = roleOf(mesh), open = sectionMeshInPlace(mesh, root, {normal, point, color: spec.colors?.[role]});
      report.cut.push(role);if (open) report.open.push(role);
      // A part wholly in front of the plane is removed by the section.
      if (!mesh.geometry.attributes.position.count) {mesh.parent?.remove(mesh);report.removed.push(role);}
      continue;
    }
    if (spec.water && matches(mesh, spec.water)) {
      // Water is cut by a clipping plane rather than new geometry: volumes are
      // often rebuilt or rescaled each frame. The model root is never moved
      // by the engine, so root space is world space.
      mesh.material = [].concat(mesh.material).map(m => {
        const c = m.clone();c.side = THREE.DoubleSide;c.clippingPlanes = [waterPlane];return c;
      });
      if (mesh.material.length === 1) mesh.material = mesh.material[0];
      root.userData.localClippingEnabled = true;
      report.water.push(roleOf(mesh));
      continue;
    }
    if (spec.solid && matches(mesh, spec.solid)) {
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(m => solidMaterial(m)) : solidMaterial(mesh.material, spec.colors?.[roleOf(mesh)]);
      report.solid.push(roleOf(mesh));
    }
  }
  root.userData.cutawayPresentation = {
    plane: {normal: normal.toArray(), point: point.toArray()},
    note: 'One clean cutaway on the plane facing the default camera: opaque walls with plain cut faces; internal working parts whole.',
    ...Object.fromEntries(Object.entries(report).map(([k, v]) => [k, [...new Set(v)]])),
  };
  return root.userData.cutawayPresentation;
}

export function findRole(root, role) {
  let found = null;
  root.traverse(o => {if (!found && o.userData?.role === role) found = o;});
  return found;
}

// Closed walls of a rectangular shaft or casing, as one geometry of separate
// closed boxes: [width, height, depth, x, y, z] each.
export function boxWallsGeometry(boxes) {
  return mergePassageParts(boxes.map(([w, h, d, x, y, z]) => new THREE.BoxGeometry(w, h, d).translate(x, y, z)));
}

// Replace a (translucent or window-cut) vertical cylinder wall by a whole
// closed tube spanning the same local bounding box.
export function wholeTube(mesh, {wallFraction = 0.14, y0, y1, inner: innerRadius, outer: outerRadius} = {}) {
  mesh.geometry.computeBoundingBox();
  const box = mesh.geometry.boundingBox, c = box.getCenter(new THREE.Vector3());
  const r = outerRadius ?? Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2, inner = innerRadius ?? r * (1 - wallFraction);
  const low = y0 ?? box.min.y, high = y1 ?? box.max.y;
  const next = latheSectionGeometry([[inner, low], [r, low], [r, high], [inner, high]], {phiStart: 0, phiLength: Math.PI * 2, segments: 64});
  next.translate(c.x, 0, c.z);
  mesh.geometry.dispose();mesh.geometry = next;
  mesh.material = solidMaterial([].concat(mesh.material)[0]);
  return mesh;
}

// Replace a thin dark torus hoop by a flat band on a shell of radius
// `shellRadius`, in a darker shade of the shell's own material.
export function hoopBand(mesh, shellRadius, material) {
  const t = mesh.geometry.parameters.tube, h = 1.5 * t;
  mesh.geometry.dispose();
  mesh.geometry = latheSectionGeometry([[shellRadius - 0.01, -h], [shellRadius + 0.03, -h], [shellRadius + 0.03, h], [shellRadius - 0.01, h]], {phiStart: 0, phiLength: Math.PI * 2, segments: 64});
  mesh.rotation.set(0, 0, 0);
  mesh.material = material;
  return mesh;
}

const unnamedDarkTorus = (mesh, role) => !role && mesh.geometry.type === 'TorusGeometry';

export const CUTAWAY_SPECS = {
  450: {
    // The piston and the checks with their seats lie inside the sectioned
    // barrel and valve chamber, so they are cut on the same plane.
    cut: [/^fixed-(suction-pipe|force-pump-cylinder|delivery-pipe|outlet-check-valve-chamber|suction-check-seat|outlet-check-seat)/,
      'solid-force-pump-piston-with-no-through-valve', 'suction-check-opening-only-on-piston-upstroke', 'outlet-check-opening-only-on-piston-downstroke'],
    water: [/water/],
    hide: [/^fixed-cutaway-.*outline$/, unnamedDarkTorus],
  },
  451: {
    cut: [/^fixed-(suction-pipe|solid-piston-force-pump-cylinder|air-chamber-inlet-neck|pump-to-air-chamber-delivery-pipe|suction-check-seat|pump-delivery-check-seat)/, 'globular-outlet-air-chamber', 'selected-side-outlet-from-air-chamber', 'unselected-alternative-dip-tube-outlet',
      'solid-piston-feeding-air-chamber-on-downstroke', 'suction-check-opening-on-upstroke', 'delivery-check-opening-on-piston-downstroke'],
    water: [/water/, 'constant-flow-through-selected-air-chamber-outlet'],
    hide: [/^fixed-cutaway-.*outline$/, unnamedDarkTorus, 'elastic-air-cushion-maintaining-constant-outlet'],
  },
  453: {
    // Pass 70: Brown's section on the mid-plane: the flat chest, its ported
    // partitions, the semicircular channel, both pipes and the four flaps
    // (which turn about z, so the plane stays put).
    cut: ['fixed-common-valve-chest-beneath-both-bellows', 'fixed-valve-chest-floor-with-channel-mouths',
      'fixed-ported-partitions-round-central-discharge-chamber', 'fixed-semicircular-suction-channel-under-chest', /pipe/, /check-opening/],
    water: [/^water-/],
    solid: [/flexible-lantern-bellows/],
  },
  454: {
    plane: {point: new THREE.Vector3(0, 0, 0.38)},
    cut: ['fixed-cylindrical-water-chamber-below-diaphragm', 'fixed-diaphragm-pump-chamber-bottom', 'fixed-circular-clamping-ring-around-diaphragm-edge',
      /pipe|branch/, /transparent-body$/],
    water: [/^water-/],
    solid: [/^single-flexible-diaphragm/],
    hide: [/^fixed-cutaway-.*outline$/],
  },
  457: {
    cut: ['shallow-well-below-sweep-bucket'],
    water: ['water-source-at-bottom-of-shallow-well'],
  },
  458: {
    // Earth-lined shaft: back wall and two side walls, cut on the camera plane.
    prepare(root) {
      const shaft = findRole(root, 'transparent-well-shaft-containing-two-opposed-buckets');
      shaft.geometry.dispose();
      shaft.geometry = boxWallsGeometry([[3.40, 3.12, 0.12, 0, 0, -0.94], [0.12, 3.12, 1.88, -1.64, 0, 0.06], [0.12, 3.12, 1.88, 1.64, 0, 0.06]]);
    },
    cut: ['transparent-well-shaft-containing-two-opposed-buckets'],
    water: ['well-water-at-bottom-of-two-bucket-shaft'],
  },
  462: {
    cut: ['water-tight-rising-cylinder-fitted-to-moving-disks'],
    water: ['water-column-lifted-between-successive-chain-disks'],
  },
  465: {
    // Brown draws the two barrels, covers and check chambers as exteriors.
    solid: [/transparent-single-acting-pump-cylinder$/, 'bored-pump-rod-cover', 'finite-delivery-check-chamber'],
  },
  466: {
    cut: ['closed-ram-cylinder-floor', 'open-water-reservoir-feeding-small-hand-pump', 'fixed-lower-wall-of-pump-cistern', 'fixed-floor-of-pump-cistern',
      'finite-delivery-check-chamber', 'closed-delivery-chamber-floor', 'bored-delivery-chamber-outlet', 'small-pressure-pipe-from-pump-to-large-ram-cylinder'],
    water: ['pressurized-water-under-large-solid-ram', 'pressurized-water-column-linking-small-and-large-cylinders'],
  },
  470: {
    // Brown draws the cylinder and its valve chest as exteriors: the whole
    // cylinder wall (ported under the chest) and the closed chest are built
    // in authored-steam-hammers.js; nothing is cut away.
    hide: [/^fixed-cylinder-ring-/],
  },
  471: {
    // Brown draws cylinder B as an exterior (the dotted piston is hidden).
    prepare(root) {wholeTube(findRole(root, 'front-cutaway-moving-cylinder-shell-B'), {y0: -1.30, y1: 1.30});},
    hide: ['upper-air-charge-compressed-during-cylinder-descent', 'lower-air-charge-compressed-during-cylinder-ascent'],
  },
  472: {
    prepare(root) {
      const frame = findRole(root, 'hollow-frame-reservoir-C'), window = findRole(root, 'front-cutaway-window-into-regulated-air-reservoir-C');
      window.material = [].concat(frame.material)[0];
    },
    cut: ['front-cutaway-hammer-cylinder-B-shell', 'fixed-slide-valve-chest-on-cylinder-B', 'cutaway-double-acting-pump-D-cylinder',
      (mesh, role) => /cylinder-head$/.test(role) && mesh.getWorldPosition(new THREE.Vector3()).x > 1.5],
    hide: [/^pump-D-(lower|upper)-air-chamber$/, /^air-admitted-/],
  },
  473: {
    // Brown draws the outer tub and the rising bell as whole hooped vessels.
    // Pass 69: both are coopered barrels (built in water-sealed-pump-parts.js):
    // Brown's five hoops on the tub and three on the bell follow the staves.
    prepare(root) {
      const barrels = root.userData.barrels;
      const tub = findRole(root, 'front-cutaway-outer-water-tub'), shell = findRole(root, 'front-cutaway-inverted-bell-shell');
      tub.material = solidMaterial([].concat(tub.material)[0]);
      root.userData.blocks.tubBottom.material = tub.material;
      shell.material = solidMaterial([].concat(shell.material)[0]);
      findRole(root, 'closed-roof-of-inverted-bell').material = shell.material;
      const tubBand = cutFaceMaterial(tub.material, 0.78), bellBand = cutFaceMaterial(shell.material, 0.78);
      const tubHoops = [];
      root.traverse(o => {
        const role = o.userData?.role ?? '';
        if (/^outer-tub-hoop-/.test(role)) tubHoops.push(o);
        if (/^moving-bell-hoop-/.test(role)) hoopBand(o, barrels.bellOuter(o.position.y), bellBand);
        if (role === 'submerged-open-bell-rim-water-seal') {
          o.material = shell.material;
          const {radius, tube, radialSegments, tubularSegments} = o.geometry.parameters;
          o.geometry.dispose();o.geometry = new THREE.TorusGeometry(barrels.bellOuter(-barrels.bellHalf) + radius - 0.63, tube, radialSegments, tubularSegments);
        }
      });
      const low = barrels.tubMid - barrels.tubHalf + 0.10, span = 2 * barrels.tubHalf - 0.20;
      const hoopAt = (hoop, fraction) => {const y = low + span * fraction;hoopBand(hoop, barrels.tubOuter(y), tubBand);hoop.position.y = y;};
      hoopAt(tubHoops[0], 0);hoopAt(tubHoops[1], 1);
      for (const fraction of [0.3, 0.55, 0.8]) {
        const hoop = new THREE.Mesh(new THREE.TorusGeometry(1, 0.048, 9, 56), tubBand);
        hoop.userData.role = `outer-tub-hoop-at-${fraction}`;
        hoopAt(hoop, fraction);hoop.castShadow = true;hoop.receiveShadow = true;
        tubHoops[0].parent.add(hoop);
      }
    },
    hide: ['carbonic-acid-gas-column-from-deep-shaft', 'trapped-gas-inside-water-sealed-bell'],
  },
  // Pass 56: the boxes of 445/446 are already rear half-sections (z <= 0);
  // the revolved water (stream, cone, column, film and falling sheet, one
  // body since pass 69) and
  // the fixed plate on its stem are cut on the same plane, so no water hangs
  // outside the cut boxes.
  445: {
    cut: ['fixed-circular-plate-concentric-with-upper-orifice', 'fixed-flared-stem-of-circular-plate'],
    water: ['falling-stream-cone-and-plate-sheet-as-one-water-body', 'raised-water-column-spraying-in-upper-box'],
  },
  475: {
    cut: ['stationary-cutaway-mixing-chamber-D', 'stationary-suction-pipe-B-rising-from-bilge', 'stationary-vertical-discharge-pipe-C'],
    water: [/^water-/, 'free-water-surface-in-B-D-C'],
    hide: ['suction-B-to-chamber-D-joint', 'chamber-D-to-discharge-C-joint'],
  },
  477: {
    // The casing is already a clean half-section on z = 0; valve D and its
    // working liquid are cut on the same plane.
    cut: ['rigid-hollow-upper-stem-of-valve-D', 'fixed-annular-seat-a-a-at-inlet-A'],
    water: [/^sealed-thermal-working-liquid-/],
  },
  478: {
    cut: ['fixed-hollow-sphere-C-surrounding-pipe-end-and-valve', 'fixed-bottom-outlet-from-sphere-C'],
    water: ['condensate-core-from-sphere-C-through-bottom-outlet'],
    solid: ['expanding-outer-wall-of-pipe-A', 'fixed-inlet-rim-of-A-at-anchor-side'],
    hide: ['front-cutaway-rim-of-sphere-C', 'fixed-bottom-outlet-rim', 'condensate-inside-expanding-pipe-A'],
  },
  479: {
    cut: ['transparent-fixed-side-wall-of-tank-B', 'fixed-bottom-of-water-tank-B', 'fixed-top-rim-of-tank-B', 'open-bottomed-cylindrical-skirt-of-A',
      'closed-domed-crown-of-vessel-A', 'inlet-pipe-shell', 'outlet-pipe-shell'],
    water: [/water-(annulus|column)/],
    hide: [/gas-(volume|core)/],
  },
  480: {
    cut: ['transparent-fixed-side-wall-of-tank-B', 'fixed-bottom-of-water-tank-B', 'fixed-top-rim-of-tank-B', 'open-bottomed-cylindrical-skirt-of-A',
      'closed-domed-crown-of-vessel-A-around-guide-sleeve', 'fixed-hollow-shell-of-central-tube-b', 'visible-top-rim-of-fixed-tube-b', 'fixed-base-securing-tube-b-to-tank',
      'lower-sliding-rim-of-tube-a', 'upper-crown-fastening-rim-of-tube-a', 'sliding-outer-shell-of-integral-tube-a-around-b',
      'left-outlet-pipe-shell', 'right-inlet-pipe-shell', 'left-outlet-opening-above-inner-water', 'right-inlet-opening-above-inner-water'],
    water: [/water-annulus/],
    hide: [/gas-(volume|core)/],
  },
  481: {
    // Brown's section is across the drum axis: case and drum are cut just
    // behind the front drum head, so the spiral partitions show whole.
    plane: {point: new THREE.Vector3(0, 0, 0.48)},
    cut: ['transparent-stationary-shell-of-case-A', /^stationary-case-rim-/, 'transparent-cylindrical-shell-of-drum', /^rotating-drum-rim-/, 'finite-ported-drum-head'],
    water: ['stationary-water-volume-above-drum-centerline'],
    solid: ['transparent-rear-head-of-case-A'],
    hide: [/^gas-displacing-water-in-compartment-/, 'stationary-level-water-surface-line'],
  },
  482: {
    // One cut on Brown's section plane (z = 0.29) through case, cover, troughs,
    // cup H and valve D; lever d, its stand and the floor plate stay whole in
    // front. Quicksilver is silvery metal. The separate flat "section face"
    // plates are replaced by the true cut faces.
    plane: {point: new THREE.Vector3(0, 0, 0.29)},
    // The back panel fits between the side walls instead of sharing (and
    // z-fighting on) their outer faces.
    prepare(root) {findRole(root, 'transparent-fixed-outer-case').scale.x = 2.67 / 2.85;},
    cut: [/^fixed-side-wall-/, 'fixed-domed-case-roof-reconstruction', 'fixed-domed-cover-with-rod-knob', 'fixed-outlet-chamber-side-walls-and-bottom',
      'outer-quicksilver-channel-sealing-cup-H-1', 'finite-open-mercury-trough-around-D', 'fixed-base-of-valve-D-mercury-seat',
      /^lower-rim-\d-of-H-dipping/, 'closed-top-of-inverted-cup-H', 'finite-front-or-rear-pressure-cup-skirt',
      'closed-top-of-inverted-valve-D', /^valve-D-skirt-corner-/, /-skirt-of-D-around-notch-b-/],
    colors: {'outer-quicksilver-channel-sealing-cup-H-1': 0x59605f, 'finite-open-mercury-trough-around-D': 0x59605f},
    mercury: [/^quicksilver-volume-for-cup-H-rim-/, /quicksilver-seat-volume-for-D$/],
    cutMercury: true,
    mercuryBehindWalls: true,
    hide: [/^section-face-of-/, 'regulated-outlet-gas-acting-on-inner-surface-of-H'],
  },
  483: {
    // The case is a cabinet shown with its front panel removed: solid back
    // and side panels between the corner posts; the valve chest round B is
    // cut on z = 0 so the slide valve shows.
    prepare(root) {
      const post = findRole(root, 'fixed-case-corner-post-1'), back = findRole(root, 'transparent-cutaway-dry-meter-case');
      back.material = solidMaterial([].concat(post.material)[0]);
      for (const x of [-3.08, 3.08]) {
        const side = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.98, 2.20), back.material);
        side.position.set(x, 0.50, -0.05);
        side.userData.role = 'solid-side-panel-of-dry-meter-case';
        side.castShadow = true;side.receiveShadow = true;
        post.parent.add(side);
      }
    },
    cut: ['fixed-inlet-pressure-chest-around-B'],
    solid: ['fixed-central-partition-between-A-and-A-prime'],
    hide: [/^measured-gas-volume-inside-/, 'moving-exhaust-cavity-beneath-D-slide-B'],
  },
  497: {
    // Brown's section is across the shaft: the volute is cut just in front of
    // the blades, removing the front side, its inlet rim and front bearing.
    plane: {point: new THREE.Vector3(0, 0, 0.5)},
    cut: ['continuous-finite-volute-wall', /^open-spout-lip-/, 'fan-driving-shaft'],
    solid: ['rear-volute-side-with-circular-inlet-opening', 'rear-circular-air-inlet-rim'],
    hide: ['transparent-front-volute-side-with-circular-inlet-opening', 'front-circular-air-inlet-rim', 'fixed-fan-shaft-bearing-2',
      (mesh, role) => /^inlet-bearing-spider/.test(role) && mesh.getWorldPosition(new THREE.Vector3()).z > 0],
    colors: {'open-spout-lip-1': 0x59605f, 'open-spout-lip-2': 0x59605f},
  },
  500: {
    // The face view is a whole round case: an opaque drum closes the space
    // between the pressure chamber and the bezel, which now seats on the
    // dial edge; disk A shows only through the dial's centre opening, as
    // Brown draws it. Brown's side figure stays his single clean section.
    prepare(root) {
      const rim = findRole(root, 'fixed-round-magdeburg-gauge-case-rim');
      rim.position.z = 0.50;
      const material = [].concat(rim.material)[0];
      const drum = new THREE.Mesh(latheSectionGeometry([[3.12, -1.04], [3.44, -1.04], [3.44, 0.40], [3.12, 0.40]], {phiStart: 0, phiLength: Math.PI * 2, segments: 96}), material);
      const back = new THREE.Mesh(latheSectionGeometry([[0, -1.04], [3.12, -1.04], [3.12, -0.98], [0, -0.98]], {phiStart: 0, phiLength: Math.PI * 2, segments: 96}), material);
      for (const [mesh, role] of [[drum, 'whole-round-gauge-case-drum'], [back, 'whole-round-gauge-case-back']]) {
        mesh.rotation.x = Math.PI / 2;mesh.userData.role = role;mesh.castShadow = true;mesh.receiveShadow = true;rim.parent.add(mesh);
      }
    },
    solid: ['annular-dial-face-with-center-cutaway-showing-disk-A', 'cutaway-pressure-chamber-behind-corrugated-disk', 'fixed-back-wall-of-pressure-chamber'],
    hide: [/^visible-pressure-medium-/],
  },
  436: {
    cut: ['fixed-trunk-or-casing-b-around-both-vane-rows', 'fixed-casing-ring-at-bottom', 'fixed-casing-ring-at-top',
      'fixed-top-cover-of-trunk-b-carrying-upper-bearing', 'fixed-sloping-inlet-flume-to-casing-b'],
    hide: [/^(left|right)-fixed-casing-cutaway-post$/],
  },
  443: {
    // Brown draws the screw's casing as a closed cylinder (the helix dotted
    // as hidden); the end rings are bands of the casing, not black rims.
    prepare(root) {
      const g = root.userData.geometry;
      const casing = wholeTube(findRole(root, 'transparent-rotating-oblique-screw-casing'), {inner: g.casingRadius - 0.04, outer: g.casingRadius});
      const band = cutFaceMaterial(casing.material, 0.8);
      for (const role of ['lower-screw-casing-ring', 'upper-screw-casing-ring']) hoopBand(findRole(root, role), g.casingRadius, band);
    },
  },
  469: {
    // The cisterns are cut on one plane just in front of the water wheel; the
    // air receiver and air pipe are whole.
    plane: {point: new THREE.Vector3(0, 0, 0.6)},
    cut: [/cistern-end-wall-(left|right)$/],
    water: [/-water-body$/],
    solid: ['transparent-inclined-screw-barrel', 'submerged-air-receiver-at-lower-screw-end', 'air-pipe-ascending-crossing-descending-to-wheel-underside'],
    colors: {'transparent-inclined-screw-barrel': 0x7e8584},
    // Brown shows the screw's spiral inside its tube: the barrel is cut in
    // half on its axis plane facing the camera (a back half-tube with plain
    // cut faces), so the whole flight shows. Water and the cistern back walls
    // behind it take no shadows: the pipe's and screw's shadow patches seen
    // through the water read as pale blotches in it.
    prepare(root) {
      const barrel = findRole(root, 'transparent-inclined-screw-barrel');
      barrel.geometry.computeBoundingBox();
      const {min, max} = barrel.geometry.boundingBox, outer = max.x;
      barrel.geometry.dispose();
      barrel.geometry = latheSectionGeometry([[outer - 0.04, min.y], [outer, min.y], [outer, max.y], [outer - 0.04, max.y]], {segments: 64});
      root.traverse((object) => { if (/-water-body$|-cistern-back-wall$/.test(object.userData.role ?? '')) object.receiveShadow = false; });
    },
  },
  395: {
    // Brown dashes the plug's passages as hidden bores. One cut on the face
    // plane through body, plug and port pipes shows them as open channels in
    // the plug's cut face; no tinted fluid stands in for them. The plug is
    // solid behind its channels and the body is a full annulus (not a thin
    // dark outline ring), ported where the pipes join: see
    // sectionFourWayCockParts in four-way-cock-parts.js.
    // Pass 56: the port pipes stay whole round bored pipes (cut in half they
    // read as broken troughs), so nothing is cut: the body is a whole annulus
    // notched for the pipes, and the plug's passages are open channels in its
    // front face, which Brown's figure shows.
    cut: [],
    hide: [/fluid-core$/],
    colors: {'fixed-annular-four-port-cock-body-surrounding-turning-plug': 0x59605f, 'second-plate-figure-annular-cock-body': 0x59605f},
  },
  285: {
    // The sliding quill is cut on the plane facing the camera so the screw
    // and nut show inside; it translates along its axis, so the cut stays put.
    cut: ['transparent-cutaway-sliding-quill-sleeve', 'sliding-quill-end-ring'],
    colors: {'transparent-cutaway-sliding-quill-sleeve': 0x7e8584},
  },
  316: {
    // Brown's bob is a glass jar of mercury: the glass stays clear, the
    // mercury is opaque silvery metal.
    mercury: ['constant-mass-expanding-mercury-column'],
  },
  389: {
    // Brown sections the hollow stand: its flared cheeks and rack-guide
    // straps are cut on the one plane z = 0 (plain cut faces), so the stand
    // reads as a deliberate section around the whole rack, not an open channel.
    cut: ['cast-jack-frame-flared-foot', 'fixed-rack-guide-strap-web'],
  },
  418: {
    // The chest, casing and cover are already cut on z = 0.48; the seat plate
    // is cut on the same plane so nothing of the fixed body stands in front.
    plane: {point: new THREE.Vector3(0, 0, 0.48)},
    cut: ['fixed-horizontal-valve-seat'],
  },
  421: {
    // One cut on z = 0 through cylinder, heads, flange, stuffing box, piston
    // and trunk. Brown draws no standard or bearing for the crankshaft (only
    // the crank on its bare shaft), so none is built: the shaft axis is a
    // fixed ideal constraint (p62 support rule).
    prepare(root) {
      // The stuffing box sat 0.09 down inside the head, so their cut faces
      // shared the section plane there and z-fought as a speckled patch: it
      // now stands on the head's top face (world y 1.23).
      const box = findRole(root, 'fixed-annular-stuffing-box-around-moving-trunk');
      root.updateMatrixWorld(true);box.geometry.computeBoundingBox();
      const worldBox = new THREE.Box3().setFromObject(box), offset = worldBox.min.y - box.geometry.boundingBox.min.y;
      const top = box.geometry.boundingBox.max.y, bottom = box.geometry.boundingBox.min.y, seat = 1.2305 - offset;
      if (seat > bottom) {
        const k = (top - seat) / (top - bottom), position = box.geometry.attributes.position;
        for (let i = 0; i < position.count; i++) position.setY(i, top - (top - position.getY(i)) * k);
        position.needsUpdate = true;box.geometry.computeBoundingBox();box.geometry.computeBoundingSphere();
      }
    },
    // The piston and trunk are built already sectioned (closed under the pin).
    cut: ['sectioned-back-half-cylinder-wall', 'lower-cylinder-flange', 'fixed-cylinder-head-half-around-trunk-opening', 'fixed-annular-stuffing-box-around-moving-trunk'],
  },
};

// `extra` lets a family file add spec fields that need its own helpers
// (kept out of this shared module), e.g. a `prepare` step.
export function applyCutawayFor(model, id, extra = {}) {
  if (model?.root && CUTAWAY_SPECS[id]) applyCutaway(model.root, {...CUTAWAY_SPECS[id], ...extra});
  return model;
}
