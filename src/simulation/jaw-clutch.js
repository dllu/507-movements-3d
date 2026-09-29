import * as THREE from 'three';
import { PALETTE, markShadows, matte } from './primitives.js';
import { turnedClutchGeometry } from './clutch-section-geometry.js';
import { boredSpurGeometry, jawClutchGeometry } from './jaw-clutch-geometry.js';
import { makeJawClutchMotion } from './jaw-clutch-motion.js';

const LEVER_STANDOFF = 0.035;

// Repaint a vertex-coloured solid in its base colour, removing the generator's
// light phase-index stripe.
export function unpainted(geometry, color) {
  const base = new THREE.Color(color), colors = geometry.attributes.color;
  for (let i = 0; i < colors.count; i += 1) colors.setXYZ(i, base.r, base.g, base.b);
  colors.needsUpdate = true;
  return geometry;
}

export function makeJawClutch() {
  const root = new THREE.Group(), motion = makeJawClutchMotion(), p = motion.parameters;
  const shaftRadius = 0.15, boreRadius = 0.161, keyHalfWidth = 0.028, keywayTop = 0.193;
  // Measured on the plate: the loose gear is about 9.4 shaft diameters
  // across (2.6 times the clutch body) with fine teeth, and the pinion's
  // edge-on boss spans about a fifth of that. A fine 64:16 pair at a small
  // module keeps the involute mesh.
  const gearTeeth = 64, pinionTeeth = 16, module = 0.042, gearDepth = 0.23;
  // Faces of the loose gear; its hub, the pinion hubs and the input jaw body
  // butt against them.
  const gearFace = gearDepth / 2;
  const gearPitchRadius = gearTeeth * module / 2, pinionPitchRadius = pinionTeeth * module / 2;
  const sourcePhase = 0.93, jawPhase = 0.24 * motion.pitch;
  // Brown draws the pinion's outline inside the gear's, so it meshes on the
  // viewer's side of the gear, about 60° down from its top.
  const pinionTilt = THREE.MathUtils.degToRad(60), centerDistance = gearPitchRadius + pinionPitchRadius;
  const pinionY = centerDistance * Math.cos(pinionTilt), pinionZ = centerDistance * Math.sin(pinionTilt);
  // Swinging the line of centres by the tilt about the gear (local +angle)
  // turns the pinion's mesh phase by tilt × (1 + gear/pinion).
  const pinionMeshPhase = (gearTeeth / 4 + pinionTeeth / 4 + 0.5) % 1 * 2 * Math.PI / pinionTeeth
    + pinionTilt * (1 + gearTeeth / pinionTeeth);
  const rotor = () => {
    const group = new THREE.Group(), member = new THREE.Group(); group.add(member);
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0));
    group.userData = { rotor: member, axis: new THREE.Vector3(1, 0, 0) }; return group;
  };
  const input = rotor(), output = rotor(), shaft = rotor(), pinion = rotor(); pinion.position.set(0, pinionY, pinionZ);
  input.userData.teeth = gearTeeth; pinion.userData.teeth = pinionTeeth;
  const solidMaterial = () => new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.17, roughness: 0.61 });
  const turned = (profile, color, options = {}) => new THREE.Mesh(turnedClutchGeometry(profile, { color, ...options }), solidMaterial());
  const inputProfile = [[gearFace, boreRadius], [gearFace, 0.54], [0.69, 0.54], [0.69, 0.54],
    [0.69, boreRadius], [0.69, boreRadius]];
  const shoulder = Array.from({ length: 17 }, (_, i) => [1.95 + 0.23 * i / 16, 0.54 - 0.09 * (0.5 - 0.5 * Math.cos(Math.PI * i / 16))]);
  const outputProfile = [[1.47, boreRadius], [1.47, boreRadius], [1.47, 0.54], [1.47, 0.54],
    ...shoulder, [2.35, 0.45],
    [2.35, 0.29], [2.60, 0.29], [2.60, 0.46], [2.72, 0.46], [2.72, boreRadius]];
  // Brown draws the jaws as symmetric rounded waves. Each tooth is a
  // half-ellipse crest on two short axial flanks, so both sides of every wave
  // read alike; only the axial bands carry the drive. The spaces stay flat:
  // the mating crests reach within 0.01 of them. The white phase stripe the
  // shared jaw generator paints on the rim is not drawn.
  const toothStations = [{ u: 0, height: p.troughDepth }], crestBase = p.jawHeight - p.crestDepth;
  for (let i = 0; i <= 32; i += 1) {
    const t = Math.PI * i / 32;
    toothStations.push({ u: p.jawFraction * (1 - Math.cos(t)) / 2, height: crestBase + p.crestDepth * Math.sin(t) });
  }
  for (let i = 0; i < 48; i += 1) {
    const t = Math.PI * i / 48;
    toothStations.push({ u: p.jawFraction + (1 - p.jawFraction) * (1 - Math.cos(t)) / 2, height: i === 24 ? 0 : p.troughDepth * (1 - Math.sin(t)) });
  }
  const inputBody = new THREE.Mesh(unpainted(jawClutchGeometry(inputProfile, { movingIndices: [3, 4], direction: 1,
    phase: jawPhase, ...p, topFraction: 0, toothStations, boreRadius, color: PALETTE.accent }), PALETTE.accent), solidMaterial());
  const outputBody = new THREE.Mesh(unpainted(jawClutchGeometry(outputProfile, { movingIndices: [1, 2], direction: -1,
    phase: jawPhase + motion.pitch / 2, ...p, topFraction: 0, toothStations, boreRadius, keyHalfWidth, keywayTop,
    smoothProfileIndices: shoulder.map((_, i) => i + 4), color: PALETTE.driven }), PALETTE.driven), solidMaterial());
  const gearBody = new THREE.Mesh(boredSpurGeometry({ teeth: gearTeeth, module, depth: gearDepth, boreRadius }),
    matte(PALETTE.accent, { metalness: 0.16, roughness: 0.61 }));
  const pinionBody = new THREE.Mesh(boredSpurGeometry({ teeth: pinionTeeth, module, depth: gearDepth, boreRadius: 0.083 }),
    matte(PALETTE.driver, { metalness: 0.16, roughness: 0.61 }));
  const gearHub = turned([[-gearFace - 0.1, boreRadius], [-gearFace - 0.1, 0.34], [-gearFace, 0.34], [-gearFace, boreRadius]], PALETTE.accent);
  const pinionHubs = [-1, 1].map((side) => {
    const a = side < 0 ? -gearFace - 0.1 : gearFace, b = side < 0 ? -gearFace : gearFace + 0.1;
    return turned([[a, 0.083], [a, 0.245], [b, 0.245], [b, 0.083]], PALETTE.driver);
  });
  const pinionShaft = turned([[-0.25, 0], [-0.25, 0.078], [0.25, 0.078], [0.25, 0]], PALETTE.ink);
  input.userData.rotor.add(gearBody, gearHub, inputBody);
  pinion.userData.rotor.add(pinionBody, ...pinionHubs, pinionShaft);
  output.userData.rotor.add(outputBody);
  const shaftBody = turned([[-0.56, 0], [-0.56, shaftRadius], [3.99, shaftRadius], [3.99, 0]], PALETTE.ink);
  const keyLeft = 0.93, keyRight = 3.87, keyBottom = 0.145, keyTop = 0.187, featherHalfWidth = 0.025;
  const feather = new THREE.Mesh(new THREE.BoxGeometry(2 * featherHalfWidth, keyTop - keyBottom, keyRight - keyLeft),
    // Shaft-coloured: Brown draws no separate key strip along the shaft.
    matte(PALETTE.ink)); feather.position.set(0, (keyBottom + keyTop) / 2, (keyLeft + keyRight) / 2);
  shaft.userData.rotor.add(shaftBody, feather);
  const lever = new THREE.Group(); lever.position.set(p.pivotX, p.pivotY, 0);
  // The lever plate stands clear in front of the sliding collar and its
  // shoulder (the plate draws it over them); pins and rod follow it forward.
  const handleLength = 1.09, leverBackZ = 0.385 + LEVER_STANDOFF, leverDepth = 0.055;
  const shape = new THREE.Shape();
  // The horizontal arm is one constant-width bar ending in a full half-round
  // concentric with the rod pin, the same radius as the rod's rounded top.
  const armEndRadius = 0.044;
  shape.moveTo(0.055, p.leverLength); shape.lineTo(0.053, armEndRadius);
  shape.lineTo(handleLength, armEndRadius); shape.absarc(handleLength, 0, armEndRadius, Math.PI / 2, -Math.PI / 2, true);
  // The arm's lower edge runs straight into the elbow eye (no jog).
  const elbowStart = -Math.asin(armEndRadius / 0.09);
  shape.lineTo(0.09 * Math.cos(elbowStart), -armEndRadius); shape.absarc(0, 0, 0.09, elbowStart, -Math.PI, true);
  shape.lineTo(-0.055, p.leverLength); shape.absarc(0, p.leverLength, 0.055, Math.PI, 0, true); shape.closePath();
  for (const [x, y, r] of [[0, 0, 0.034], [0, p.leverLength, 0.022], [handleLength, 0, 0.022]]) {
    const hole = new THREE.Path(); hole.absarc(x, y, r, 0, 2 * Math.PI, true); shape.holes.push(hole);
  }
  const leverBody = new THREE.Mesh(new THREE.ExtrudeGeometry(shape,
    { depth: leverDepth, bevelEnabled: false, curveSegments: 24 }).translate(0, 0, leverBackZ), matte(PALETTE.frame));
  lever.add(leverBody);
  const pin = (r, low, high) => turned([[low, 0], [low, r], [high, r], [high, 0]], PALETTE.ink);
  const follower = turned([[0.310, 0.022], [0.310, p.followerRadius], [0.365, p.followerRadius], [0.365, 0.022]],
    PALETTE.brass, { boreRadius: 0.022 });
  const followerPin = pin(0.020, 0.305, 0.45 + LEVER_STANDOFF), pivotPin = pin(0.032, 0.31, 0.46 + LEVER_STANDOFF);
  const handlePin = pin(0.020, 0.38 + LEVER_STANDOFF, 0.51 + LEVER_STANDOFF);
  pivotPin.position.set(p.pivotX, p.pivotY, 0); handlePin.position.set(handleLength, 0, 0); lever.add(handlePin);
  // Brown crops the vertical operating rod below the bell crank. It runs on
  // straight a little past his crop and ends cleanly there (p60: no hand or
  // stand); its top eye is pinned to the bell crank and follows that endpoint.
  const rodLength = 2.1;
  const rod = new THREE.Group(), rodShape = new THREE.Shape();
  rodShape.moveTo(-0.028, -rodLength); rodShape.lineTo(0.028, -rodLength); rodShape.lineTo(0.028, 0);
  rodShape.absarc(0, 0, 0.044, 0, Math.PI, false); rodShape.closePath();
  const rodBore = new THREE.Path(); rodBore.absarc(0, 0, 0.022, 0, 2 * Math.PI, true); rodShape.holes.push(rodBore);
  const rodBody = new THREE.Mesh(new THREE.ExtrudeGeometry(rodShape,
    { depth: 0.042, bevelEnabled: false, curveSegments: 24 }).translate(0, 0, 0.455 + LEVER_STANDOFF), matte(PALETTE.frame)); rod.add(rodBody);
  // Only the rod's run below Brown's crop lies past the plate framing.
  rodBody.userData.beyondPlateCropBelowY = -1.83;
  // Brown draws the fixed fulcrum only as a pin through the bell crank's
  // elbow, with no bracket; it ends as a plain stub behind the lever (p62).
  root.add(input, output, shaft, pinion, lever, follower, followerPin, pivotPin, rod);
  const update = (time) => {
    const state = motion.stateAt(time + sourcePhase * p.cycleDuration);
    // With an even pinion count a half-pitch offset puts a pinion space
    // opposite the gear tooth on the line of centres.
    state.pinionAngle = -state.inputAngle * gearTeeth / pinionTeeth + pinionMeshPhase;
    state.pinionAngularSpeed = -state.inputAngularSpeed * gearTeeth / pinionTeeth;
    input.userData.rotor.rotation.z = state.inputAngle;
    pinion.userData.rotor.rotation.z = state.pinionAngle;
    output.userData.rotor.rotation.z = state.outputAngle; shaft.userData.rotor.rotation.z = state.outputAngle;
    output.position.x = state.shift - p.stroke;
    lever.rotation.z = -state.leverAngle;
    follower.position.set(state.followerPoint.x, state.followerPoint.y, 0);
    followerPin.position.copy(follower.position);
    rod.position.set(p.pivotX + handleLength * Math.cos(state.leverAngle), p.pivotY - handleLength * Math.sin(state.leverAngle), 0);
    root.userData.clutchState = state; root.userData.kinematics = state;
  };
  root.userData = { fidelity: 'authored', mechanism: 'tapered-jaw-clutch-with-positive-flank-contact', hideGround: true,
    // A little margin keeps the pinion above the loose gear off the view edge.
    cameraFov: 11, cameraDistanceScale: 4, fullCameraDirection: new THREE.Vector3(5.4, 3.6, 8), motion,
    blocks: { input, output, shaft, pinion, inputBody, outputBody, gearBody, pinionBody, shaftBody, feather,
      lever, leverBody, follower, followerPin, pivotPin, rod, rodBody, handlePin },
    geometry: { ...p, sourcePhase, jawPhase, inputProfile, outputProfile, shaftRadius, boreRadius, keyHalfWidth, keywayTop,
      keyLeft, keyRight, keyBottom, keyTop, featherHalfWidth, pinionTeeth, gearTeeth, module, gearDepth,
      gearPitchRadius, pinionPitchRadius, pinionY, pinionZ, pinionTilt, pinionMeshPhase, handleLength, armEndRadius, leverBackZ, leverDepth,
      cycleMeaning: 'align-insert-positive-drive-withdraw-and-coast' } };
  // Frame Brown's plate: the measured swept box of the mechanism with the
  // rod to his crop. The rod's short run past it stays out of the fit.
  root.userData.cameraFitBounds = new THREE.Box3(new THREE.Vector3(-0.56, -1.83, -1.40), new THREE.Vector3(3.99, 1.40, 1.84));
  update(0); markShadows(root);
  return { root, update, cameraDirection: new THREE.Vector3(0.03, 0.06, 10) };
}
