import * as THREE from 'three';

// Rotation cue for featureless turning bodies (plain pulleys, drums, rollers,
// discs, sheaves, cone and stepped pulleys). Brown's plates carry no index
// marks, and a smooth solid of revolution gives no cue to how fast it turns,
// so every such body gets the same quiet treatment: its surface is divided
// into four quadrants about the spin axis, and the odd quadrants take a
// slightly shifted tone of the part's own colour. Light and mid colours shift
// darker; dark colours shift lighter. The cue is a colour change only: no
// extra meshes (nothing to z-fight or intersect), no change to geometry or
// normals, so flat faces still shade flat. It is computed per fragment in the
// mesh's own geometry space, so it turns with the part and reads the same on
// end faces, treads and bores from any viewing angle.
//
// Rule: odd quadrant colour = base * (1 - s) in display (sRGB) space when the
// base luminance is at least ROTATION_INDICATOR_DARK_LIMIT, otherwise
// base + (1 - base) * s * 0.8; s = ROTATION_INDICATOR_STRENGTH. The four
// quadrant boundaries are crisp ~1.5 px lines shifted by 2s, so on a tread
// seen edge-on they read as straight lines sweeping across it.
export const ROTATION_INDICATOR_STRENGTH = 0.22;
export const ROTATION_INDICATOR_DARK_LIMIT = 0.26;

const UNIT_Z = new THREE.Vector3(0, 0, 1);
// Mean |normal . tangent| above which a mesh is not treated as a solid of
// revolution by the 'auto' axis (a 24-sided prism scores about 0.01, a hexagon 0.05).
const AUTO_AXIS_TOLERANCE = 0.035;
const AXIS_NAMES = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: UNIT_Z };
const Y_AXIS_GEOMETRIES = new Set(['CylinderGeometry', 'LatheGeometry', 'ConeGeometry', 'CapsuleGeometry']);

// For 'auto', the geometry's own axis of revolution: of the three geometry
// axes through the bounding-box centre, the one about which the surface
// normals have the least tangential component (zero for a solid of
// revolution). Returns { direction, origin }.
export function revolutionAxisOf(geometry) {
  const position = geometry.attributes.position, index = geometry.index;
  geometry.computeBoundingBox();
  const centre = geometry.boundingBox.getCenter(new THREE.Vector3());
  const triangles = index ? index.count / 3 : position.count / 3;
  const stride = Math.max(1, Math.floor(triangles / 6000));
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const normal = new THREE.Vector3(), point = new THREE.Vector3(), tangent = new THREE.Vector3();
  const vertex = (t, k) => (index ? index.getX(3 * t + k) : 3 * t + k);
  let best = null;
  for (const name of ['x', 'y', 'z']) {
    const direction = AXIS_NAMES[name];
    let total = 0, tangential = 0;
    for (let t = 0; t < triangles; t += stride) {
      a.fromBufferAttribute(position, vertex(t, 0)); b.fromBufferAttribute(position, vertex(t, 1));
      c.fromBufferAttribute(position, vertex(t, 2));
      normal.subVectors(b, a).cross(tangent.subVectors(c, a));
      const area = normal.length();
      if (!(area > 0)) continue;
      normal.divideScalar(area);
      point.addVectors(a, b).add(c).multiplyScalar(1 / 3).sub(centre);
      point.addScaledVector(direction, -point.dot(direction));
      const radius = point.length();
      if (radius < 1e-9) continue;
      tangent.crossVectors(direction, point).divideScalar(radius);
      total += area;
      tangential += area * Math.abs(normal.dot(tangent));
    }
    const score = total > 0 ? tangential / total : 1;
    if (!best || score < best.score) best = { direction: direction.clone(), score };
  }
  // The bounding-box centre of a solid of revolution lies on its axis.
  return { direction: best.direction, origin: centre, score: best.score };
}

function geometryAxis(mesh, axis) {
  if (axis === 'auto') return revolutionAxisOf(mesh.geometry).direction;
  if (axis?.isVector3) return axis.clone().normalize();
  if (typeof axis === 'string') return AXIS_NAMES[axis].clone();
  return (Y_AXIS_GEOMETRIES.has(mesh.geometry?.type) ? AXIS_NAMES.y : UNIT_Z).clone();
}

// Geometry-space transform into the spin frame used by the shader: the spin
// axis becomes +Z through the origin.
function spinFrameMatrix(mesh, { axis, center, frame, frameAxis = 'z', frameCenter } = {}) {
  if (frame) {
    // Axis given in an ancestor's local space (e.g. a makePulley rotor, whose
    // local Z is the spin axis): chain the local matrices from the mesh up.
    const toFrame = new THREE.Matrix4();
    for (let node = mesh; node && node !== frame; node = node.parent) {
      node.updateMatrix();
      toFrame.premultiply(node.matrix);
      if (!node.parent) throw new Error('rotation indicator frame must be an ancestor of the mesh');
    }
    const direction = geometryAxis(mesh, frameAxis);
    const origin = frameCenter?.clone() ?? new THREE.Vector3();
    const align = new THREE.Matrix4().makeRotationFromQuaternion(
      new THREE.Quaternion().setFromUnitVectors(direction, UNIT_Z));
    return align.multiply(new THREE.Matrix4().makeTranslation(-origin.x, -origin.y, -origin.z)).multiply(toFrame);
  }
  const auto = axis === 'auto' ? revolutionAxisOf(mesh.geometry) : null;
  const direction = auto?.direction ?? geometryAxis(mesh, axis);
  const origin = center?.clone() ?? (auto ? auto.origin : new THREE.Vector3());
  const align = new THREE.Matrix4().makeRotationFromQuaternion(
    new THREE.Quaternion().setFromUnitVectors(direction, UNIT_Z));
  return align.multiply(new THREE.Matrix4().makeTranslation(-origin.x, -origin.y, -origin.z));
}

const VERTEX_HEAD = 'uniform mat4 rotationIndicatorFrame;\nvarying vec3 vRotationIndicator;\n';
const FRAGMENT_HEAD = '#define ROTATION_LINE_EXTRA 1.0\nuniform float rotationIndicatorStrength;\nuniform float rotationIndicatorDarkLimit;\nvarying vec3 vRotationIndicator;\n';
const FRAGMENT_BODY = `
{
  // Odd quadrants: x * y > 0 in the spin frame (a smooth one-pixel edge).
  vec2 rotationXY = vRotationIndicator.xy;
  float rotationQuadrant = rotationXY.x * rotationXY.y;
  float rotationEdge = max(fwidth(rotationQuadrant), 1e-7);
  float rotationOdd = smoothstep(-rotationEdge, rotationEdge, rotationQuadrant);
  // The four quadrant boundaries (the planes x = 0 and y = 0 through the
  // axis) are drawn as crisp lines about 1.5 px wide: radial lines on end
  // faces, straight axial lines along treads, so edge-on the turning reads as
  // lines sweeping across the tread.
  float rotationBoundary = min(abs(rotationXY.x), abs(rotationXY.y));
  float rotationPixel = max(fwidth(rotationBoundary), 1e-7);
  float rotationLine = 1.0 - smoothstep(0.5 * rotationPixel, 1.3 * rotationPixel, rotationBoundary);
  float rotationAmount = rotationIndicatorStrength
    * clamp(max(rotationOdd, rotationLine) + ROTATION_LINE_EXTRA * rotationLine, 0.0, 1.0 + ROTATION_LINE_EXTRA);
  vec3 rotationBase = pow(max(diffuseColor.rgb, vec3(0.0)), vec3(1.0 / 2.2));
  float rotationLuma = dot(rotationBase, vec3(0.299, 0.587, 0.114));
  vec3 rotationShift = rotationLuma >= rotationIndicatorDarkLimit
    ? rotationBase * (1.0 - rotationAmount)
    : mix(rotationBase, vec3(1.0), rotationAmount * 0.8);
  diffuseColor.rgb = pow(rotationShift, vec3(2.2));
}
`;

const FRAMES = new WeakMap();

// The cue survives later material clones (cutaways, clipping, recolouring).
function install(material, frameMatrix, strength) {
  const uniforms = {
    rotationIndicatorFrame: { value: frameMatrix },
    rotationIndicatorStrength: { value: strength },
    rotationIndicatorDarkLimit: { value: ROTATION_INDICATOR_DARK_LIMIT },
  };
  material.userData.rotationIndicator = true;
  FRAMES.set(material, frameMatrix);
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_HEAD}`)
      .replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvRotationIndicator = (rotationIndicatorFrame * vec4(position, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_HEAD}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${FRAGMENT_BODY}`);
  };
  material.customProgramCacheKey = () => 'rotation-indicator-v2';
  material.clone = function cloneWithIndicator() {
    return install(new this.constructor().copy(this), frameMatrix.clone(), strength);
  };
  return material;
}

function patchMaterial(material, frameMatrix, strength) {
  const base = material.userData?.rotationIndicator
    ? new material.constructor().copy(material) : material.clone();
  return install(base, frameMatrix, strength);
}

// Geometry-to-spin-frame matrix of a patched material (for tests and reviews).
export function rotationIndicatorFrame(material) {
  return FRAMES.get(material) ?? null;
}

// Give one mesh (or every mesh under an object) the quadrant cue.
//   axis:   spin axis in the mesh's geometry space ('x' | 'y' | 'z' | Vector3);
//           defaults to Y for cylinder/lathe/cone geometry and Z otherwise.
//   center: a point on the spin axis in geometry space (default origin).
//   frame:  alternatively, an ancestor whose local frameAxis (default 'z')
//           through frameCenter is the spin axis; used for groups of meshes.
//           A group given without frame or axis is its own frame.
//   axis 'auto': each mesh's own axis of revolution (see revolutionAxisOf);
//           meshes that are not solids of revolution are skipped.
// Meshes that already carry the cue, invisible meshes and meshes marked
// userData.noRotationIndicator are left alone. Returns the patched meshes.
export function applyRotationIndicator(object, options = {}) {
  const strength = options.strength ?? ROTATION_INDICATOR_STRENGTH;
  const meshes = [];
  const visit = (mesh) => {
    if (!mesh.isMesh || mesh.userData.noRotationIndicator || mesh.userData.rotationIndicator) return;
    if (!mesh.visible && !options.includeHidden) return;
    // 'auto' takes each mesh's own axis of revolution and skips meshes that
    // are not solids of revolution (spokes, pins, marks).
    if (options.axis === 'auto' && !options.frame
      && revolutionAxisOf(mesh.geometry).score > AUTO_AXIS_TOLERANCE) return;
    const frameMatrix = spinFrameMatrix(mesh, options.frame || object.isMesh || options.axis === 'auto'
      ? options : { ...options, frame: object });
    const materials = [mesh.material].flat();
    const patched = materials.map((material) => patchMaterial(material, frameMatrix, strength));
    mesh.material = Array.isArray(mesh.material) ? patched : patched[0];
    mesh.userData.rotationIndicator = true;
    meshes.push(mesh);
  };
  if (object.isMesh) visit(object);
  else object.traverse(visit);
  return meshes;
}

export function hasRotationIndicator(mesh) {
  return Boolean(mesh?.userData?.rotationIndicator);
}

// Presentation-time application by part role: every visible mesh whose role
// (or an ancestor's role) matches one of the patterns gets the cue about its
// own axis of revolution. Returns the patched meshes.
export function applyRotationIndicatorByRole(root, entries) {
  const rules = entries.map((entry) => {
    const { pattern, axis = 'auto' } = typeof entry === 'string' ? { pattern: entry } : entry;
    return { expression: new RegExp(`^(?:${pattern})$`), axis };
  });
  const roleOf = (object) => object.userData.role || object.name || '';
  const matched = new Map();
  root.traverse((object) => {
    if (!object.isMesh || !object.visible) return;
    for (let node = object; node && node !== root.parent; node = node.parent) {
      const role = roleOf(node);
      const rule = role && rules.find(({ expression }) => expression.test(role));
      if (rule) { matched.set(object, rule); break; }
    }
  });
  const patched = [];
  for (const [mesh, rule] of matched) patched.push(...applyRotationIndicator(mesh, { axis: rule.axis }));
  return patched;
}
