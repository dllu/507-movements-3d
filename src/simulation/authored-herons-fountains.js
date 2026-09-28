import * as THREE from 'three';
import {PALETTE, markShadows, matte} from './primitives.js';
import {cutFaceMaterial, latheSectionGeometry} from './cutaway-section.js';
import {waterVolumeMaterial} from './water-volume.js';
import {WaterStream, ballisticPath} from './water-stream.js';
import {
  FOUNTAIN,
  bowlWaterGeometry,
  bunFootGeometry,
  fountainCastingGeometry,
  fountainOutlines,
  jetPipeProfile,
  rightWaterGeometry,
} from './herons-fountain-casting.js';

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

// Pass 90: Hero's fountain rebuilt as Brown draws it, one hollow cast frame
// seen in section (a clean cutaway on the plane z = 0, facing the default
// camera):
//   - the trough on top is open to the air; poured water and the returning
//     jet stand in it;
//   - its floor opens into the right leg, a tube running down into the foot
//     (the lower vessel) and ending under the foot's water;
//   - the left leg is hollow and joins the foot's headspace to the chamber
//     over the bowl (the intermediate vessel); Brown's cavities over the
//     water are air;
//   - the bowl hangs from the leg walls under that chamber, and the jet pipe
//     rises from near its bottom, through the chamber and the trough water, to
//     the pointed spire;
//   - water in the right tube presses the foot's air, which by the left leg
//     presses on the bowl water and drives it up the pipe as the jet.
function heronsFountain(movement) {
  const root = new THREE.Group();
  const cycleDuration = 12.5;
  const gravity = 9.81;
  const pipe = FOUNTAIN.pipe;
  // Levels at Brown's pose (plate units above the underside of the foot).
  const troughLevel = 4.86;
  const footLevel = 0.50;
  const bowlLevel = 3.84;
  const groundY = -FOUNTAIN.foot3d.height;
  // Hydrostatics. The right tube is full from the trough surface down to the
  // foot water, so the shared air stands at a gauge head equal to that
  // column; the same air presses on the bowl water, so the ideal jet head
  // above the spire tip is that head less the lift from bowl level to tip.
  const airGaugeHead = troughLevel - footLevel;
  const idealJetHead = airGaugeHead - (pipe.tip - bowlLevel);
  // Brown's spray rises about 0.6 above the tip: the pipe and the fine tip
  // orifice lose the rest of the ideal head (a disclosed loss factor).
  const visibleJetRise = 0.6;
  const jetHeadEfficiency = visibleJetRise / idealJetHead;
  const jetSpeed = Math.sqrt(2 * gravity * visibleJetRise);

  const stateAtPhase = (unwrappedPhase) => {
    const phase = ((unwrappedPhase % 1) + 1) % 1;
    return {
      phase,
      troughLevel,
      footLevel,
      bowlLevel,
      airGaugeHead,
      idealJetHead,
      visibleJetRise,
      // Steady play: the tube carries exactly the jet's return.
      drainFlowRate: 1,
      jetFlowRate: 1,
      levelsHeldInSteadyPlay: true,
      regime: 'steady-play-drain-equals-jet-levels-held',
    };
  };
  const stateAtTime = (time) => stateAtPhase(time / cycleDuration);

  const castMaterial = matte(PALETTE.frame, {metalness: 0.16, roughness: 0.66});
  const cutMaterial = cutFaceMaterial(castMaterial);
  const pipeMaterial = matte(PALETTE.brass, {metalness: 0.18, roughness: 0.50});
  const pipeCutMaterial = cutFaceMaterial(pipeMaterial);
  const waterMaterial = waterVolumeMaterial();
  waterMaterial.side = THREE.FrontSide;

  const {casting: castingGeometry, slab: slabGeometry} = fountainCastingGeometry();
  const casting = addRole(new THREE.Mesh(castingGeometry, [castMaterial, cutMaterial]),
    'hollow-cast-fountain-frame-cut-in-section');
  const slab = addRole(new THREE.Mesh(slabGeometry, [castMaterial, cutMaterial]),
    'trough-floor-bored-for-the-jet-pipe');
  const jetPipe = addRole(new THREE.Mesh(latheSectionGeometry(jetPipeProfile(), {segments: 192}), [pipeMaterial, pipeCutMaterial]),
    'central-jet-pipe-from-bowl-to-spire');
  root.add(casting, slab, jetPipe);
  const bun = bunFootGeometry();
  const feet = [-1, 1].map((side) => {
    const foot = addRole(new THREE.Mesh(bun, castMaterial), 'turned-foot-under-the-lower-vessel');
    foot.position.set(side * FOUNTAIN.foot3d.x, 0, FOUNTAIN.foot3d.z);
    root.add(foot);
    return foot;
  });

  const rightWater = addRole(new THREE.Mesh(rightWaterGeometry(troughLevel, footLevel), waterMaterial),
    'water-in-open-trough-right-tube-and-lower-vessel');
  const bowlWater = addRole(new THREE.Mesh(bowlWaterGeometry(bowlLevel), waterMaterial),
    'water-in-bowl-and-jet-pipe');
  for (const water of [rightWater, bowlWater]) water.renderOrder = 1;
  root.add(rightWater, bowlWater);

  // The jet: thin streams leaving the spire tip and falling back on both
  // sides into the trough water (Brown's willow plume), their streaks
  // running with the water.
  const tip = new THREE.Vector3(0, pipe.tip, -0.08);
  const jets = [-14, -8, -3, 3, 8, 14].map((degrees, index) => {
    const angle = THREE.MathUtils.degToRad(degrees);
    const stream = new WaterStream(ballisticPath({
      origin: tip,
      velocity: new THREE.Vector3(jetSpeed * Math.sin(angle), jetSpeed * Math.cos(angle), 0),
      gravity,
      endY: troughLevel,
      samples: 32,
    }), {
      width: 0.018,
      thickness: 0.018,
      widthExponent: 0.5,
      spread: {start: 0.6, width: 1.8, thickness: 1.8},
      cyclePeriod: cycleDuration,
      streakRate: 2.4,
      opacity: 0.5,
    });
    stream.userData.role = `fountain-jet-stream-${index + 1}-from-spire-tip-into-trough`;
    root.add(stream);
    return stream;
  });

  const update = (time) => {
    for (const jet of jets) jet.update(time);
  };

  const outlines = fountainOutlines();
  root.userData = {
    archetype:
      'herons-three-vessel-fountain-with-water-drain-shared-air-line-and-pressure-driven-central-jet',
    blocks: {bowlWater, casting, feet, jetPipe, jets, rightWater, slab},
    degreesOfFreedom: {independentPrescribedInputs: 1, operatingDegreesOfFreedom: 1},
    fidelity: 'authored',
    geometry: {
      ...FOUNTAIN,
      cycleDuration,
      troughLevel,
      footLevel,
      bowlLevel,
      airGaugeHead,
      idealJetHead,
      visibleJetRise,
      jetHeadEfficiency,
      outlines,
    },
    mechanism:
      'Water in the open trough runs down the right tube into the foot, whose water seals the tube\'s lower end. The trapped air over the foot water, up the hollow left leg and in the chamber over the bowl is one body at the tube\'s head; it presses the bowl water up the central pipe, which leaves the spire as the jet and falls back into the trough.',
    motion: {cycleDuration, motionType: 'steady-play-with-drain-equal-to-jet-and-levels-held'},
    dynamics: {
      resetDisclosure:
        'No reset: the loop shows steady play. The tube carries the jet\'s return, so the trough holds; the slow fall of the bowl and rise of the foot over a real run are held at the plate levels (a disclosed large-vessel approximation).',
      jetDisclosure:
        'Ideal head from hydrostatics (trough to foot column, less the lift from bowl to tip); the drawn rise of about 0.6 implies pipe and orifice losses, applied as one efficiency factor.',
    },
    sourceAnimation: {available: false, officialCanvasModelPresent: false, officialPageMarksAnimationUnavailable: true},
    sourceReference: {
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 464',
      scalePixelsPerUnit: 70,
      engravingEvidence:
        'Brown sections one hollow casting: an open trough ruled with water below its rim; a right leg ruled full of water from the trough floor down into the foot, ending just above the foot floor; a hollow, unruled (air) left leg opening at the top into the space over the bowl; the bowl ruled full to its rim; a jet pipe from low in the bowl through the trough to a pointed spire; and the foot ruled with water below an air space.',
      reconstructionDisclosure:
        'Brown gives no depth, pressures or flows. The casting depth (1.4), rectangular section front to back, round jet pipe, turned feet in place of the claws, levels and jet loss factor are engineered.',
    },
    stateAtPhase,
    stateAtTime,
    transmission: {
      rightDrainPath: 'open trough -> right tube -> lower vessel (foot) water',
      airPath: 'foot headspace <-> hollow left leg <-> chamber over the bowl',
      centralJetPath: 'bowl water -> submerged jet pipe foot -> spire tip -> trough',
      topologyInvariant:
        'The right tube carries water and ends below the foot water; the left leg carries only air; the jet pipe is the bowl water\'s only outlet.',
    },
    update,
    reconstructionNote:
      'One hollow casting cut on Brown\'s section plane, with two continuous water bodies (trough, tube and foot; bowl and jet pipe). Levels are held in steady play; the jet is a ballistic stream at the drawn height.',
  };
  root.userData.cameraDirection = new THREE.Vector3(0.7, 0.65, 15);
  root.userData.cameraDistanceScale = 1.06;
  root.userData.cameraFov = 12;
  root.userData.groundFloorY = groundY;
  root.userData.hideGround = true;
  root.userData.minimumDisplayCycleSeconds = 8;
  markShadows(root);
  for (const object of [rightWater, bowlWater, ...jets]) object.castShadow = false;
  update(0);
  const bounds = new THREE.Box3().setFromObject(root);
  root.userData.cameraFitBounds = bounds.expandByScalar(0.12);
  return {cameraDirection: root.userData.cameraDirection, root, update};
}

export function createAuthoredHeronsFountainMovement(movement) {
  if (movement.id !== 464) return null;
  return heronsFountain(movement);
}
