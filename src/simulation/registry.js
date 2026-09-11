import displayProfiles from '../data/display-profiles.js';
import { createAuthoredBeltMovement } from './authored-belts.js';
import { createAuthoredBeltGovernorMovement } from './authored-belt-governors.js';
import { createAuthoredBearingMovement } from './authored-bearings.js';
import { createAuthoredAnchorEscapementMovement } from './authored-anchor-escapements.js';
import { createAuthoredAnnularEscapementMovement } from './authored-annular-escapements.js';
import { createAuthoredDeadbeatEscapementMovement } from './authored-deadbeat-escapements.js';
import { createAuthoredDetachedEscapementMovement } from './authored-detached-escapements.js';
import { createAuthoredGravityEscapementMovement } from './authored-gravity-escapements.js';
import { createAuthoredGoingBarrelMovement } from './authored-going-barrels.js';
import { createAuthoredParallelRulerMovement } from './authored-parallel-rulers.js';
import { createAuthoredJointedParallelRulerMovement } from './authored-jointed-parallel-rulers.js';
import { createAuthoredSlottedTraverseMovement } from './authored-slotted-traverses.js';
import { createAuthoredStampMovement } from './authored-stamps.js';
import { createAuthoredRedirectedWindlassMovement } from './authored-redirected-windlasses.js';
import { createAuthoredTripHammerMovement } from './authored-trip-hammers.js';
import { createAuthoredUniformGrooveCrossheadMovement } from './authored-uniform-groove-crossheads.js';
import { createAuthoredGyroscopeMovement } from './authored-gyroscopes.js';
import { createAuthoredAndersonGovernorMovement } from './authored-anderson-governors.js';
import { createAuthoredFuseeTraverseMovement } from './authored-fusee-traverses.js';
import { createAuthoredPumpDrillMovement } from './authored-pump-drills.js';
import { createAuthoredOscillatingDrumRatchetMovement } from './authored-oscillating-drum-ratchets.js';
import { createAuthoredAxialPinClutchMovement } from './authored-axial-pin-clutches.js';
import { createAuthoredGroovedCylinderTraverseMovement } from './authored-grooved-cylinder-traverses.js';
import { createAuthoredSeesawMovement } from './authored-seesaws.js';
import { createAuthoredOrthogonalRollerIndexerMovement } from './authored-orthogonal-roller-indexers.js';
import { createAuthoredSkewRollerFeedMovement } from './authored-skew-roller-feeds.js';
import { createAuthoredTreadleDrillMovement } from './authored-treadle-drills.js';
import { createAuthoredCylinderSpiralScriberMovement } from './authored-cylinder-spiral-scribers.js';
import { createAuthoredCycloidalPendulumMovement } from './authored-cycloidal-pendulums.js';
import { createAuthoredMirrorPolisherMovement } from './authored-mirror-polishers.js';
import { createAuthoredMangleWheelMovement } from './authored-mangle-wheels.js';
import { createAuthoredDynamometerMovement } from './authored-dynamometers.js';
import { createAuthoredRollingFrictionExperimentMovement } from './authored-rolling-friction-experiments.js';
import { createAuthoredTreadleEccentricDriveMovement } from './authored-treadle-eccentric-drives.js';
import { createAuthoredEdgeRunnerMovement } from './authored-edge-runners.js';
import { createAuthoredAnimalTreadwheelMovement } from './authored-animal-treadwheels.js';
import { createAuthoredPersonTreadmillMovement } from './authored-person-treadmills.js';
import { createAuthoredPendulumSawMovement } from './authored-pendulum-saws.js';
import { createAuthoredCrampDrillMovement } from './authored-cramp-drills.js';
import { createAuthoredWedgeClampMovement } from './authored-wedge-clamps.js';
import { createAuthoredAdjustableStandMovement } from './authored-adjustable-stands.js';
import { createAuthoredTextileDressingMovement } from './authored-textile-dressing.js';
import { createAuthoredHelicographMovement } from './authored-helicographs.js';
import { createAuthoredDoorCloserMovement } from './authored-door-closers.js';
import { createAuthoredFoldingLadderMovement } from './authored-folding-ladders.js';
import { createAuthoredTideLadderMovement } from './authored-tide-ladders.js';
import { createAuthoredPlanerFeedMovement } from './authored-planer-feeds.js';
import { createAuthoredEccentricJackMovement } from './authored-eccentric-jacks.js';
import { createAuthoredDualBandRatchetMovement } from './authored-dual-band-ratchets.js';
import { createAuthoredAlternatingWeightedRackMovement } from './authored-alternating-weighted-racks.js';
import { createAuthoredGigSawMovement } from './authored-gig-saws.js';
import { createAuthoredLensPolisherMovement } from './authored-lens-polishers.js';
import { createAuthoredParsonsRackMovement } from './authored-parsons-racks.js';
import { createAuthoredFourWayCockMovement } from './authored-four-way-cocks.js';
import { createAuthoredReedEscapementMovement } from './authored-reed-escapements.js';
import { createAuthoredIntermittentShuttleDriveMovement } from './authored-intermittent-shuttle-drives.js';
import { createAuthoredCamRockingDriveMovement } from './authored-cam-rocking-drives.js';
import { createAuthoredChainRepairLinkMovement } from './authored-chain-repair-links.js';
import { createAuthoredFourMotionFeedMovement } from './authored-four-motion-feeds.js';
import { createAuthoredDeadCenterCrankMovement } from './authored-dead-center-cranks.js';
import { createAuthoredGuernseyEscapementMovement } from './authored-guernsey-escapements.js';
import { createAuthoredCyclographMovement } from './authored-cyclographs.js';
import { createAuthoredFlexibleCyclographMovement } from './authored-flexible-cyclographs.js';
import { createAuthoredHyperbolaDrawingMovement } from './authored-hyperbola-drawing.js';
import { createAuthoredParabolaDrawingMovement } from './authored-parabola-drawing.js';
import { createAuthoredPointedArchMovement } from './authored-pointed-arch-instruments.js';
import { createAuthoredCentrolineadMovement } from './authored-centrolineads.js';
import { createAuthoredProportionalCompassMovement } from './authored-proportional-compasses.js';
import { createAuthoredBisectingGaugeMovement } from './authored-bisecting-gauges.js';
import { createAuthoredSelfRecordingLevelMovement } from './authored-self-recording-levels.js';
import { createAuthoredCapstanWheelworkMovement } from './authored-capstan-wheelwork.js';
import { createAuthoredAdjustableFrictionGearMovement } from './authored-adjustable-friction-gears.js';
import { createAuthoredScrollGearMovement } from './authored-scroll-gears.js';
import { createAuthoredDicksonReversibleDriveMovement } from './authored-dickson-reversible-drives.js';
import { createAuthoredSpringAssistedTreadleMovement } from './authored-spring-assisted-treadles.js';
import { createAuthoredBentShaftSlideMovement } from './authored-bent-shaft-slides.js';
import { createAuthoredValveReliefGuideMovement } from './authored-valve-relief-guides.js';
import { createAuthoredSelfRockingCradleMovement } from './authored-self-rocking-cradles.js';
import { createAuthoredSpringReturnBellHammerMovement } from './authored-spring-return-bell-hammers.js';
import { createAuthoredTrunkEngineMovement } from './authored-trunk-engines.js';
import { createAuthoredSectorPistonEngineMovement } from './authored-sector-piston-engines.js';
import { createAuthoredDoubleQuadrantEngineMovement } from './authored-double-quadrant-engines.js';
import { createAuthoredSquarePistonEngineMovement } from './authored-square-piston-engines.js';
import { createAuthoredEccentricRotaryEngineMovement } from './authored-eccentric-rotary-engines.js';
import { createAuthoredRadialPistonRotaryEngineMovement } from './authored-radial-piston-rotary-engines.js';
import { createAuthoredEccentricShaftRadialPistonEngineMovement } from './authored-eccentric-shaft-radial-piston-engines.js';
import { createAuthoredRubberLinedRotaryEngineMovement } from './authored-rubber-lined-rotary-engines.js';
import { createAuthoredDoubleEllipticalRotaryEngineMovement } from './authored-double-elliptical-rotary-engines.js';
import { createAuthoredOvershotWaterWheelMovement } from './authored-overshot-water-wheels.js';
import { createAuthoredUndershotWaterWheelMovement } from './authored-undershot-water-wheels.js';
import { createAuthoredBreastWaterWheelMovement } from './authored-breast-water-wheels.js';
import { createAuthoredHorizontalOvershotWaterWheelMovement } from './authored-horizontal-overshot-water-wheels.js';
import { createAuthoredFourneyronTurbineMovement } from './authored-fourneyron-turbines.js';
import { createAuthoredWarrenCentralDischargeTurbineMovement } from './authored-warren-central-discharge-turbines.js';
import { createAuthoredJonvalTurbineMovement } from './authored-jonval-turbines.js';
import { createAuthoredVoluteWaterWheelMovement } from './authored-volute-water-wheels.js';
import { createAuthoredBarkerReactionMillMovement } from './authored-barker-reaction-mills.js';
import { createAuthoredWaterBucketReciprocatorMovement } from './authored-water-bucket-reciprocators.js';
import { createAuthoredTippingWaterMeterMovement } from './authored-tipping-water-meters.js';
import { createAuthoredPersianIrrigationWheelMovement } from './authored-persian-irrigation-wheels.js';
import { createAuthoredEisachPotWheelMovement } from './authored-eisach-pot-wheels.js';
import { createAuthoredStreamDrivenArchimedesScrewMovement } from './authored-stream-driven-archimedes-screws.js';
import { createAuthoredHydraulicRamMovement } from './authored-hydraulic-rams.js';
import { createAuthoredOscillatingWaterColumnMovement } from './authored-oscillating-water-columns.js';
import { createAuthoredReactionFerryMovement } from './authored-reaction-ferries.js';
import { createAuthoredLiftPumpMovement } from './authored-lift-pumps.js';
import { createAuthoredForcePumpMovement } from './authored-force-pumps.js';
import { createAuthoredDoubleActingPumpMovement } from './authored-double-acting-pumps.js';
import { createAuthoredLanternBellowsPumpMovement } from './authored-lantern-bellows-pumps.js';
import { createAuthoredDiaphragmPumpMovement } from './authored-diaphragm-pumps.js';
import { createAuthoredOldRotaryPumpMovement } from './authored-old-rotary-pumps.js';
import { createAuthoredCaryRotaryPumpMovement } from './authored-cary-rotary-pumps.js';
import { createAuthoredCounterbalancedWellSweepMovement } from './authored-counterbalanced-well-sweeps.js';
import { createAuthoredTwoBucketWellPulleyMovement } from './authored-two-bucket-well-pulleys.js';
import { createAuthoredReciprocatingWellLiftMovement } from './authored-reciprocating-well-lifts.js';
import { createAuthoredBailingScoopMovement } from './authored-bailing-scoops.js';
import { createAuthoredSwingingGutterPumpMovement } from './authored-swinging-gutter-pumps.js';
import { createAuthoredChainPumpMovement } from './authored-chain-pumps.js';
import { createAuthoredSelfActingWeirMovement } from './authored-self-acting-weirs.js';
import { createAuthoredHeronsFountainMovement } from './authored-herons-fountains.js';
import { createAuthoredBalancePumpMovement } from './authored-balance-pumps.js';
import { createAuthoredHydrostaticPressMovement } from './authored-hydrostatic-presses.js';
import { createAuthoredRobertsonJackMovement } from './authored-robertson-jacks.js';
import { createAuthoredFlexibleWaterMainMovement } from './authored-flexible-water-mains.js';
import { createAuthoredTemperatureAirMachineMovement } from './authored-temperature-air-machines.js';
import { createAuthoredSteamHammerMovement } from './authored-steam-hammers.js';
import { createAuthoredAtmosphericHammerMovement } from './authored-atmospheric-hammers.js';
import { createAuthoredCompressedAirHammerMovement } from './authored-compressed-air-hammers.js';
import { createAuthoredWaterSealedAirPumpMovement } from './authored-water-sealed-air-pumps.js';
import { createAuthoredAeolipileMovement } from './authored-aeolipiles.js';
import { createAuthoredBilgeEjectorMovement } from './authored-bilge-ejectors.js';
import { createAuthoredSteamSiphonPumpMovement } from './authored-steam-siphon-pumps.js';
import { createAuthoredDiaphragmSteamTrapMovement } from './authored-diaphragm-steam-traps.js';
import { createAuthoredExpansionSteamTrapMovement } from './authored-expansion-steam-traps.js';
import { createAuthoredGasometerMovement } from './authored-gasometers.js';
import { createAuthoredWetGasMeterMovement } from './authored-wet-gas-meters.js';
import { createAuthoredMercuryGasRegulatorMovement } from './authored-mercury-gas-regulators.js';
import { createAuthoredDryGasMeterMovement } from './authored-dry-gas-meters.js';
import { createAuthoredHelicalCurrentRotorMovement } from './authored-helical-current-rotors.js';
import { createAuthoredCommonWindmillMovement } from './authored-common-windmills.js';
import { createAuthoredPivotedSailWindmillMovement } from './authored-pivoted-sail-windmills.js';
import { createAuthoredCommonPaddleWheelMovement } from './authored-common-paddle-wheels.js';
import { createAuthoredScrewPropellerMovement } from './authored-screw-propellers.js';
import { createAuthoredFeatheringPaddleWheelMovement } from './authored-feathering-paddle-wheels.js';
import { createAuthoredRopeSteeringMovement } from './authored-rope-steering.js';
import { createAuthoredCapstanMovement } from './authored-capstans.js';
import { createAuthoredBoatDetacherMovement } from './authored-boat-detachers.js';
import { createAuthoredStoneLewisMovement } from './authored-stone-lewises.js';
import { createAuthoredStoneTongMovement } from './authored-stone-tongs.js';
import { createAuthoredEntwistleGearingMovement } from './authored-entwistle-gearing.js';
import { createAuthoredThrostleSpinningMovement } from './authored-throstle-spinning.js';
import { createAuthoredFanBlowerMovement } from './authored-fan-blowers.js';
import { createAuthoredSiphonPressureGaugeMovement } from './authored-siphon-pressure-gauges.js';
import { createAuthoredBourdonPressureGaugeMovement } from './authored-bourdon-pressure-gauges.js';
import { createAuthoredDiaphragmPressureGaugeMovement } from './authored-diaphragm-pressure-gauges.js';
import { createAuthoredMercurialBarometerMovement } from './authored-mercurial-barometers.js';
import { createAuthoredEpicyclicTrainMovement } from './authored-epicyclic-trains.js';
import { createAuthoredCompoundParallelRulerMovement } from './authored-compound-parallel-rulers.js';
import { createAuthoredSteamEngineGuideMovement } from './authored-steam-engine-guides.js';
import { createAuthoredCartwrightParallelMotion } from './authored-cartwright-parallel-motions.js';
import { createAuthoredEpicyclicPistonGuide } from './authored-epicyclic-piston-guides.js';
import { createAuthoredForkedPistonGuide } from './authored-forked-piston-guides.js';
import { createAuthoredSlottedCrossheadEngineMovement } from './authored-slotted-crosshead-engines.js';
import { createAuthoredMarineParallelMotion } from './authored-marine-parallel-motions.js';
import { createAuthoredBeamEngineParallelMotion } from './authored-beam-engine-parallel-motions.js';
import { createAuthoredAtmosphericBeamEngine } from './authored-atmospheric-beam-engines.js';
import { createAuthoredUprightEngineParallelMotion } from './authored-upright-engine-parallel-motions.js';
import { createAuthoredOscillatingEngineMovement } from './authored-oscillating-engines.js';
import { createAuthoredTableEngineMovement } from './authored-table-engines.js';
import { createAuthoredDiskEngineMovement } from './authored-disk-engines.js';
import { createAuthoredDoubleStrokeSlotMovement } from './authored-double-stroke-slots.js';
import { createAuthoredVibratingRodParallelMotion } from './authored-vibrating-rod-parallel-motions.js';
import { createAuthoredDirectActionParallelMotion } from './authored-direct-action-parallel-motions.js';
import { createAuthoredBeveledCamMovement } from './authored-beveled-cams.js';
import { createAuthoredCamMovement } from './authored-cams.js';
import { createAuthoredCamArrayMovement } from './authored-cam-arrays.js';
import { createAuthoredCheckHookMovement } from './authored-check-hooks.js';
import { createAuthoredClampMovement } from './authored-clamps.js';
import { createAuthoredCombinationDriveMovement } from './authored-combination-drives.js';
import { createAuthoredConicalPendulumMovement } from './authored-conical-pendulums.js';
import { createAuthoredCompensationBalanceMovement } from './authored-compensation-balances.js';
import { createAuthoredCompensationPendulumMovement } from './authored-compensation-pendulums.js';
import { createAuthoredColtRatchetMovement } from './authored-colt-ratchets.js';
import { createAuthoredConeFrictionDriveMovement } from './authored-cone-friction-drives.js';
import { createAuthoredEccentricConeDriveMovement } from './authored-eccentric-cone-drives.js';
import { createAuthoredEqualDiameterCamMovement } from './authored-equal-diameter-cams.js';
import { createAuthoredCrankMovement } from './authored-cranks.js';
import { createAuthoredCrossedSlotMovement } from './authored-crossed-slots.js';
import { createAuthoredCylinderEscapementMovement } from './authored-cylinder-escapements.js';
import { createAuthoredCurveGeneratorMovement } from './authored-curve-generators.js';
import { createAuthoredDrawingInstrumentMovement } from './authored-drawing-instruments.js';
import { createAuthoredDifferentialDriveMovement } from './authored-differential-drives.js';
import { createAuthoredDifferentialScrewMovement } from './authored-differential-screws.js';
import { createAuthoredDifferentialWormDriveMovement } from './authored-differential-worm-drives.js';
import { createAuthoredDuplexEscapementMovement } from './authored-duplex-escapements.js';
import { createAuthoredDiagonalCatchMovement } from './authored-diagonal-catches.js';
import { createAuthoredEngineCouplingMovement } from './authored-engine-couplings.js';
import { createAuthoredEngineReverserMovement } from './authored-engine-reversers.js';
import { createAuthoredEscapementMovement } from './authored-escapements.js';
import { createAuthoredFreeEscapementMovement } from './authored-free-escapements.js';
import { createAuthoredExpandingPulleyMovement } from './authored-expanding-pulleys.js';
import { createAuthoredEccentricCrownGearMovement } from './authored-eccentric-crown-gears.js';
import { createAuthoredEllipticalIdlerGearMovement } from './authored-elliptical-idler-gears.js';
import { createAuthoredFrictionClutchMovement } from './authored-friction-clutches.js';
import { createAuthoredFrictionWindlassMovement } from './authored-friction-windlasses.js';
import { createAuthoredGearMovement } from './authored-gears.js';
import { createAuthoredGearLinkageMovement } from './authored-gear-linkages.js';
import { createAuthoredGabDisengagerMovement } from './authored-gab-disengagers.js';
import { createAuthoredGovernorMovement } from './authored-governors.js';
import { createAuthoredGrooveDrumMovement } from './authored-groove-drums.js';
import { createAuthoredGroovedDiskFollowerMovement } from './authored-grooved-disk-followers.js';
import { createAuthoredIntermittentMovement } from './authored-intermittent.js';
import { createAuthoredJointMovement } from './authored-joints.js';
import { createAuthoredKneeLeverMovement } from './authored-knee-levers.js';
import { createAuthoredLatheHeadMovement } from './authored-lathe-heads.js';
import { createAuthoredLanternEscapementMovement } from './authored-lantern-escapements.js';
import { createAuthoredLeverEscapementMovement } from './authored-lever-escapements.js';
import { createAuthoredLeverChronometerMovement } from './authored-lever-chronometers.js';
import { createAuthoredLinkageMovement } from './authored-linkages.js';
import { createAuthoredLostMotionMovement } from './authored-lost-motion.js';
import { createAuthoredLocomotiveValveGearMovement } from './authored-locomotive-valve-gears.js';
import { createAuthoredOffsetCrankSlotMovement } from './authored-offset-crank-slots.js';
import { createAuthoredParabolicGovernorMovement } from './authored-parabolic-governors.js';
import { createAuthoredPipeCouplingMovement } from './authored-pipe-couplings.js';
import { createAuthoredPileDriverMovement } from './authored-pile-drivers.js';
import { createAuthoredPickeringGovernorMovement } from './authored-pickering-governors.js';
import { createAuthoredPoppetValveMovement } from './authored-poppet-valves.js';
import { createAuthoredPulleyFormMovement } from './authored-pulley-forms.js';
import { createAuthoredSteppedSectorGearMovement } from './authored-stepped-sector-gears.js';
import { createAuthoredMarineValveGearMovement } from './authored-marine-valve-gears.js';
import { createAuthoredMaintainingPowerMovement } from './authored-maintaining-power.js';
import { createAuthoredMutilatedRackMovement } from './authored-mutilated-racks.js';
import { createAuthoredQuadrantCatchMovement } from './authored-quadrant-catches.js';
import { createAuthoredRackPumpMovement } from './authored-rack-pumps.js';
import { createAuthoredSawFeedMovement } from './authored-saw-feeds.js';
import { createAuthoredRatchetBarMovement } from './authored-ratchet-bars.js';
import { createAuthoredRhombusLinkageMovement } from './authored-rhombus-linkages.js';
import { createAuthoredSelectableCamMovement } from './authored-selectable-cams.js';
import { createAuthoredSafetyStopMovement } from './authored-safety-stops.js';
import { createAuthoredSinglePinEscapementMovement } from './authored-single-pin-escapements.js';
import { createAuthoredStudDriveMovement } from './authored-stud-drives.js';
import { createAuthoredStudEscapementMovement } from './authored-stud-escapements.js';
import { createAuthoredStrokeCrankMovement } from './authored-stroke-cranks.js';
import { createAuthoredTangentRodDriveMovement } from './authored-tangent-rod-drives.js';
import { createAuthoredThreeLeggedEscapementMovement } from './authored-three-legged-escapements.js';
import { createAuthoredVariableCrankMovement } from './authored-variable-cranks.js';
import { createAuthoredScrewMovement } from './authored-screws.js';
import { createAuthoredSilkTraverseMovement } from './authored-silk-traverses.js';
import { createAuthoredSlidingJournalBoxMovement } from './authored-sliding-journal-boxes.js';
import { createAuthoredSlottedDiskLeverMovement } from './authored-slotted-disk-levers.js';
import { createAuthoredSoundingWeightMovement } from './authored-sounding-weights.js';
import { createAuthoredSprocketMovement } from './authored-sprockets.js';
import { createAuthoredWormScrewMovement } from './authored-worm-screws.js';
import { createAuthoredWormRackMovement } from './authored-worm-racks.js';
import { createAuthoredWaterGovernorMovement } from './authored-water-governors.js';
import { createAuthoredWaveCamMovement } from './authored-wave-cams.js';
import { createAuthoredWatchRegulatorMovement } from './authored-watch-regulators.js';
import { createAuthoredWoolComberMovement } from './authored-wool-comber.js';
export const DEFAULT_DISPLAY_CYCLE_SECONDS = 2;
// Continuous gears remain trackable; brief escapement/indexing impulses may
// move faster without stretching every pendulum beat into tens of seconds.
export const MAX_DISPLAY_ANGULAR_SPEED = 6 * Math.PI;
export const MAX_SUSTAINED_DISPLAY_ANGULAR_SPEED = 2 * Math.PI;

const OPENING_AUTHORED_CYCLE_PERIODS = new Map([
  [1, Math.PI * 2 / 1.55],
  [2, Math.PI * 2 / 1.55],
  [3, Math.PI * 2 / (0.8 / 0.74)],
  [4, Math.PI * 2 / (0.82 / 0.88)],
  [5, 10],
  [6, Math.PI * 2 / 1.05],
  [7, 16],
  [8, 16.8],
  [9, Math.PI * 2 / 0.5],
  [10, Math.PI * 2 / 0.5],
  [11, Math.PI * 2 / (0.82 / 0.76)],
  [12, Math.PI * 2 / 0.72],
  [13, Math.PI * 2 / 0.66],
  [14, Math.PI * 2 / 0.56],
  [15, Math.PI * 2 / 0.52],
  [16, Math.PI * 2 / 0.5],
  [17, Math.PI * 2 / 0.52],
  [18, Math.PI * 2 / 0.55],
  [19, Math.PI * 2 / 0.48],
  [20, Math.PI * 2 / 0.5],
  [21, Math.PI * 2 / 0.52],
  [22, Math.PI * 2 / 0.5],
  [23, Math.PI * 2 / 0.55],
  [24, Math.PI * 2 / 1.25],
  [25, Math.PI * 2 / 1.12],
  [26, Math.PI * 2 / 1.24],
  [27, Math.PI * 2 / 1.08],
  [28, 4.4 * 3],
  [29, Math.PI * 2 / 1.16],
  [30, Math.PI * 2 / 0.82],
  [31, Math.PI * 2 / 2.2],
  [32, Math.PI * 2 / 1.4],
  [33, Math.PI * 2 / 0.62],
  [34, Math.PI * 2 / 1.2],
  [35, 11.586015460047468],
  [38, 8.055365778435366],
  [43, Math.PI * 2 / 1.06],
  [50, Math.PI * 2 / 1.05],
]);

const CYCLE_PERIOD_PATHS = [
  ['timeline', 'demonstrationPeriod'],
  ['timeline', 'cycleDuration'],
  ['timeline', 'cyclePeriod'],
  ['timeline', 'balancePeriod'],
  ['canonicalTimes', 'cycleClosure'],
  ['motion', 'inputCycleDuration'],
  ['motion', 'cycleDuration'],
  ['motion', 'balancePeriod'],
  ['selector', 'cycleDuration'],
  ['transmission', 'cyclePeriod'],
  ['transmission', 'cycleDuration'],
  ['transmission', 'inputCyclePeriod'],
  ['transmission', 'inputPeriod'],
  ['geometry', 'cyclePeriod'],
  ['geometry', 'cycleDuration'],
  ['geometry', 'demonstrationPeriod'],
  ['geometry', 'speedCyclePeriod'],
  ['geometry', 'balancePeriod'],
  ['geometry', 'drumRotationPeriod'],
  ['geometry', 'operatingPeriod'],
  ['geometry', 'driverCyclePeriod'],
  ['geometry', 'wheelCyclePeriod'],
  ['geometry', 'lobeCyclePeriod'],
  ['geometry', 'eventPeriod'],
  ['geometry', 'orbitPeriod'],
  ['geometry', 'carrierCycleDuration'],
  ['geometry', 'adjustmentCyclePeriod'],
  ['geometry', 'inputCyclePeriod'],
  ['adjustmentSchedule', 'cycleDuration'],
  ['sourceAnimation', 'durationSeconds'],
  ['sourceAnimation', 'officialDurationSeconds'],
];

const ANGULAR_SPEED_KEYS = [
  'inputAngularSpeed',
  'driverAngularSpeed',
  'crankAngularSpeed',
  'pinionAngularSpeed',
  'wormAngularSpeed',
  'diskAngularSpeed',
  'spurAngularSpeed',
  'carrierAngularSpeed',
  'wheelAngularSpeed',
  'lowerAngularSpeed',
  'rightAngularSpeed',
  'drumAngularSpeed',
  'operatingAngularSpeed',
];

function positiveFinite(value) {
  return Number.isFinite(value) && value > 0 ? value : null;
}

function valueAtPath(object, path) {
  return path.reduce((value, key) => value?.[key], object);
}

export function authoredCyclePeriodFor(model, movement) {
  // Later authored models can declare the display loop directly. Preserve
  // that model-specific decision instead of replacing it with a heuristic.
  const explicitlyAuthoredPeriod = positiveFinite(
    model.root.userData.animationTiming?.authoredCyclePeriod,
  );
  if (explicitlyAuthoredPeriod) return explicitlyAuthoredPeriod;
  const openingPeriod = OPENING_AUTHORED_CYCLE_PERIODS.get(movement.id);
  if (openingPeriod) return openingPeriod;
  const data = model.root.userData;
  for (const path of CYCLE_PERIOD_PATHS) {
    const period = positiveFinite(valueAtPath(data, path));
    if (period) return period;
  }
  const cyclesPerSecond = positiveFinite(data.geometry?.cyclesPerSecond);
  if (cyclesPerSecond) return 1 / cyclesPerSecond;
  const cyclesPerMinute = positiveFinite(data.sourceAnimation?.cyclesPerMinute);
  if (cyclesPerMinute) return 60 / cyclesPerMinute;
  const inputFrequency = positiveFinite(Math.abs(data.geometry?.inputFrequency ?? 0));
  if (inputFrequency) return Math.PI * 2 / inputFrequency;
  const cycleRate = positiveFinite(Math.abs(data.geometry?.cycleRate ?? 0));
  if (cycleRate) return Math.PI * 2 / cycleRate;
  const speedSources = [data.kinematics, data.transmission, data.geometry];
  for (const source of speedSources) {
    for (const key of ANGULAR_SPEED_KEYS) {
      const angularSpeed = positiveFinite(Math.abs(source?.[key] ?? 0));
      if (angularSpeed) return Math.PI * 2 / angularSpeed;
    }
  }
  return Math.PI * 2;
}

export function applyDisplayTiming(
  model,
  movement,
  displayCycleSeconds = DEFAULT_DISPLAY_CYCLE_SECONDS,
) {
  const authoredCyclePeriod = authoredCyclePeriodFor(model, movement);
  const targetCycleDuration = positiveFinite(displayCycleSeconds)
    ?? DEFAULT_DISPLAY_CYCLE_SECONDS;
  const peakVisibleAngularSpeed = positiveFinite(
    displayProfiles.profiles[movement.id]?.peakVisibleAngularSpeed,
  ) ?? 0;
  const sustainedVisibleAngularSpeed = positiveFinite(
    displayProfiles.profiles[movement.id]?.sustainedVisibleAngularSpeed,
  ) ?? peakVisibleAngularSpeed;
  const playbackTimeScale = Math.min(
    authoredCyclePeriod / targetCycleDuration,
    // A brief intermittent index can be unreadable even when peak speed is
    // modest. An authored minimum keeps that working stroke visible.
    authoredCyclePeriod / (positiveFinite(model.root.userData.minimumDisplayCycleSeconds) ?? targetCycleDuration),
    peakVisibleAngularSpeed > 0 ? MAX_DISPLAY_ANGULAR_SPEED / peakVisibleAngularSpeed : Infinity,
    sustainedVisibleAngularSpeed > 0 ? MAX_SUSTAINED_DISPLAY_ANGULAR_SPEED / sustainedVisibleAngularSpeed : Infinity,
  );
  model.root.userData.animationTiming = {
    authoredCyclePeriod,
    playbackTimeScale,
    targetCycleDuration,
    displayCycleDuration: authoredCyclePeriod / playbackTimeScale,
    peakVisibleAngularSpeed,
    sustainedVisibleAngularSpeed,
  };
  model.root.userData.sampledFloorY = displayProfiles.profiles[movement.id]?.floorY;
  model.root.userData.sampledMotionBounds = displayProfiles.profiles[movement.id]?.motionBounds;
  return model;
}

export function createMovementModel(movement) {
  const model = createAuthoredSinglePinEscapementMovement(movement)
    ?? createAuthoredThreeLeggedEscapementMovement(movement)
    ?? createAuthoredDetachedEscapementMovement(movement)
    ?? createAuthoredGravityEscapementMovement(movement)
    ?? createAuthoredLanternEscapementMovement(movement)
    ?? createAuthoredLeverEscapementMovement(movement)
    ?? createAuthoredLeverChronometerMovement(movement)
    ?? createAuthoredCylinderEscapementMovement(movement)
    ?? createAuthoredDuplexEscapementMovement(movement)
    ?? createAuthoredStudEscapementMovement(movement)
    ?? createAuthoredFreeEscapementMovement(movement)
    ?? createAuthoredAnnularEscapementMovement(movement)
    ?? createAuthoredDeadbeatEscapementMovement(movement)
    ?? createAuthoredAnchorEscapementMovement(movement)
    ?? createAuthoredPickeringGovernorMovement(movement)
    ?? createAuthoredPoppetValveMovement(movement)
    ?? createAuthoredLatheHeadMovement(movement)
    ?? createAuthoredSawFeedMovement(movement)
    ?? createAuthoredRackPumpMovement(movement)
    ?? createAuthoredSlottedDiskLeverMovement(movement)
    ?? createAuthoredGroovedDiskFollowerMovement(movement)
    ?? createAuthoredFrictionWindlassMovement(movement)
    ?? createAuthoredSlidingJournalBoxMovement(movement)
    ?? createAuthoredSafetyStopMovement(movement)
    ?? createAuthoredColtRatchetMovement(movement)
    ?? createAuthoredEqualDiameterCamMovement(movement)
    ?? createAuthoredWormRackMovement(movement)
    ?? createAuthoredParabolicGovernorMovement(movement)
    ?? createAuthoredRhombusLinkageMovement(movement)
    ?? createAuthoredBeveledCamMovement(movement)
    ?? createAuthoredRatchetBarMovement(movement)
    ?? createAuthoredBearingMovement(movement)
    ?? createAuthoredMutilatedRackMovement(movement)
    ?? createAuthoredTangentRodDriveMovement(movement)
    ?? createAuthoredFrictionClutchMovement(movement)
    ?? createAuthoredDifferentialScrewMovement(movement)
    ?? createAuthoredConeFrictionDriveMovement(movement)
    ?? createAuthoredDifferentialWormDriveMovement(movement)
    ?? createAuthoredEccentricConeDriveMovement(movement)
    ?? createAuthoredCombinationDriveMovement(movement)
    ?? createAuthoredConicalPendulumMovement(movement)
    ?? createAuthoredCompensationBalanceMovement(movement)
    ?? createAuthoredCompensationPendulumMovement(movement)
    ?? createAuthoredMaintainingPowerMovement(movement)
    ?? createAuthoredGoingBarrelMovement(movement)
    ?? createAuthoredParallelRulerMovement(movement)
    ?? createAuthoredJointedParallelRulerMovement(movement)
    ?? createAuthoredSlottedTraverseMovement(movement)
    ?? createAuthoredStampMovement(movement)
    ?? createAuthoredRedirectedWindlassMovement(movement)
    ?? createAuthoredTripHammerMovement(movement)
    ?? createAuthoredUniformGrooveCrossheadMovement(movement)
    ?? createAuthoredGyroscopeMovement(movement)
    ?? createAuthoredAndersonGovernorMovement(movement)
    ?? createAuthoredFuseeTraverseMovement(movement)
    ?? createAuthoredPumpDrillMovement(movement)
    ?? createAuthoredOscillatingDrumRatchetMovement(movement)
    ?? createAuthoredAxialPinClutchMovement(movement)
    ?? createAuthoredGroovedCylinderTraverseMovement(movement)
    ?? createAuthoredSeesawMovement(movement)
    ?? createAuthoredOrthogonalRollerIndexerMovement(movement)
    ?? createAuthoredSkewRollerFeedMovement(movement)
    ?? createAuthoredTreadleDrillMovement(movement)
    ?? createAuthoredCylinderSpiralScriberMovement(movement)
    ?? createAuthoredCycloidalPendulumMovement(movement)
    ?? createAuthoredMirrorPolisherMovement(movement)
    ?? createAuthoredMangleWheelMovement(movement)
    ?? createAuthoredDynamometerMovement(movement)
    ?? createAuthoredRollingFrictionExperimentMovement(movement)
    ?? createAuthoredTreadleEccentricDriveMovement(movement)
    ?? createAuthoredEdgeRunnerMovement(movement)
    ?? createAuthoredAnimalTreadwheelMovement(movement)
    ?? createAuthoredPersonTreadmillMovement(movement)
    ?? createAuthoredPendulumSawMovement(movement)
    ?? createAuthoredCrampDrillMovement(movement)
    ?? createAuthoredWedgeClampMovement(movement)
    ?? createAuthoredAdjustableStandMovement(movement)
    ?? createAuthoredTextileDressingMovement(movement)
    ?? createAuthoredHelicographMovement(movement)
    ?? createAuthoredDoorCloserMovement(movement)
    ?? createAuthoredFoldingLadderMovement(movement)
    ?? createAuthoredTideLadderMovement(movement)
    ?? createAuthoredPlanerFeedMovement(movement)
    ?? createAuthoredEccentricJackMovement(movement)
    ?? createAuthoredDualBandRatchetMovement(movement)
    ?? createAuthoredAlternatingWeightedRackMovement(movement)
    ?? createAuthoredGigSawMovement(movement)
    ?? createAuthoredLensPolisherMovement(movement)
    ?? createAuthoredParsonsRackMovement(movement)
    ?? createAuthoredFourWayCockMovement(movement)
    ?? createAuthoredReedEscapementMovement(movement)
    ?? createAuthoredIntermittentShuttleDriveMovement(movement)
    ?? createAuthoredCamRockingDriveMovement(movement)
    ?? createAuthoredChainRepairLinkMovement(movement)
    ?? createAuthoredFourMotionFeedMovement(movement)
    ?? createAuthoredDeadCenterCrankMovement(movement)
    ?? createAuthoredGuernseyEscapementMovement(movement)
    ?? createAuthoredCyclographMovement(movement)
    ?? createAuthoredFlexibleCyclographMovement(movement)
    ?? createAuthoredHyperbolaDrawingMovement(movement)
    ?? createAuthoredParabolaDrawingMovement(movement)
    ?? createAuthoredPointedArchMovement(movement)
    ?? createAuthoredCentrolineadMovement(movement)
    ?? createAuthoredProportionalCompassMovement(movement)
    ?? createAuthoredBisectingGaugeMovement(movement)
    ?? createAuthoredSelfRecordingLevelMovement(movement)
    ?? createAuthoredCapstanWheelworkMovement(movement)
    ?? createAuthoredAdjustableFrictionGearMovement(movement)
    ?? createAuthoredScrollGearMovement(movement)
    ?? createAuthoredDicksonReversibleDriveMovement(movement)
    ?? createAuthoredSpringAssistedTreadleMovement(movement)
    ?? createAuthoredBentShaftSlideMovement(movement)
    ?? createAuthoredValveReliefGuideMovement(movement)
    ?? createAuthoredSelfRockingCradleMovement(movement)
    ?? createAuthoredSpringReturnBellHammerMovement(movement)
    ?? createAuthoredTrunkEngineMovement(movement)
    ?? createAuthoredSectorPistonEngineMovement(movement)
    ?? createAuthoredDoubleQuadrantEngineMovement(movement)
    ?? createAuthoredSquarePistonEngineMovement(movement)
    ?? createAuthoredEccentricRotaryEngineMovement(movement)
    ?? createAuthoredRadialPistonRotaryEngineMovement(movement)
    ?? createAuthoredEccentricShaftRadialPistonEngineMovement(movement)
    ?? createAuthoredRubberLinedRotaryEngineMovement(movement)
    ?? createAuthoredDoubleEllipticalRotaryEngineMovement(movement)
    ?? createAuthoredOvershotWaterWheelMovement(movement)
    ?? createAuthoredUndershotWaterWheelMovement(movement)
    ?? createAuthoredBreastWaterWheelMovement(movement)
    ?? createAuthoredHorizontalOvershotWaterWheelMovement(movement)
    ?? createAuthoredFourneyronTurbineMovement(movement)
    ?? createAuthoredWarrenCentralDischargeTurbineMovement(movement)
    ?? createAuthoredJonvalTurbineMovement(movement)
    ?? createAuthoredVoluteWaterWheelMovement(movement)
    ?? createAuthoredBarkerReactionMillMovement(movement)
    ?? createAuthoredWaterBucketReciprocatorMovement(movement)
    ?? createAuthoredTippingWaterMeterMovement(movement)
    ?? createAuthoredPersianIrrigationWheelMovement(movement)
    ?? createAuthoredEisachPotWheelMovement(movement)
    ?? createAuthoredStreamDrivenArchimedesScrewMovement(movement)
    ?? createAuthoredHydraulicRamMovement(movement)
    ?? createAuthoredOscillatingWaterColumnMovement(movement)
    ?? createAuthoredReactionFerryMovement(movement)
    ?? createAuthoredLiftPumpMovement(movement)
    ?? createAuthoredForcePumpMovement(movement)
    ?? createAuthoredDoubleActingPumpMovement(movement)
    ?? createAuthoredLanternBellowsPumpMovement(movement)
    ?? createAuthoredDiaphragmPumpMovement(movement)
    ?? createAuthoredOldRotaryPumpMovement(movement)
    ?? createAuthoredCaryRotaryPumpMovement(movement)
    ?? createAuthoredCounterbalancedWellSweepMovement(movement)
    ?? createAuthoredTwoBucketWellPulleyMovement(movement)
    ?? createAuthoredReciprocatingWellLiftMovement(movement)
    ?? createAuthoredBailingScoopMovement(movement)
    ?? createAuthoredSwingingGutterPumpMovement(movement)
    ?? createAuthoredChainPumpMovement(movement)
    ?? createAuthoredSelfActingWeirMovement(movement)
    ?? createAuthoredHeronsFountainMovement(movement)
    ?? createAuthoredBalancePumpMovement(movement)
    ?? createAuthoredHydrostaticPressMovement(movement)
    ?? createAuthoredRobertsonJackMovement(movement)
    ?? createAuthoredFlexibleWaterMainMovement(movement)
    ?? createAuthoredTemperatureAirMachineMovement(movement)
    ?? createAuthoredSteamHammerMovement(movement)
    ?? createAuthoredAtmosphericHammerMovement(movement)
    ?? createAuthoredCompressedAirHammerMovement(movement)
    ?? createAuthoredWaterSealedAirPumpMovement(movement)
    ?? createAuthoredAeolipileMovement(movement)
    ?? createAuthoredBilgeEjectorMovement(movement)
    ?? createAuthoredSteamSiphonPumpMovement(movement)
    ?? createAuthoredDiaphragmSteamTrapMovement(movement)
    ?? createAuthoredExpansionSteamTrapMovement(movement)
    ?? createAuthoredGasometerMovement(movement)
    ?? createAuthoredWetGasMeterMovement(movement)
    ?? createAuthoredMercuryGasRegulatorMovement(movement)
    ?? createAuthoredDryGasMeterMovement(movement)
    ?? createAuthoredHelicalCurrentRotorMovement(movement)
    ?? createAuthoredCommonWindmillMovement(movement)
    ?? createAuthoredPivotedSailWindmillMovement(movement)
    ?? createAuthoredCommonPaddleWheelMovement(movement)
    ?? createAuthoredScrewPropellerMovement(movement)
    ?? createAuthoredFeatheringPaddleWheelMovement(movement)
    ?? createAuthoredRopeSteeringMovement(movement)
    ?? createAuthoredCapstanMovement(movement)
    ?? createAuthoredBoatDetacherMovement(movement)
    ?? createAuthoredStoneLewisMovement(movement)
    ?? createAuthoredStoneTongMovement(movement)
    ?? createAuthoredEntwistleGearingMovement(movement)
    ?? createAuthoredThrostleSpinningMovement(movement)
    ?? createAuthoredFanBlowerMovement(movement)
    ?? createAuthoredSiphonPressureGaugeMovement(movement)
    ?? createAuthoredBourdonPressureGaugeMovement(movement)
    ?? createAuthoredDiaphragmPressureGaugeMovement(movement)
    ?? createAuthoredMercurialBarometerMovement(movement)
    ?? createAuthoredEpicyclicTrainMovement(movement)
    ?? createAuthoredCompoundParallelRulerMovement(movement)
    ?? createAuthoredSteamEngineGuideMovement(movement)
    ?? createAuthoredCartwrightParallelMotion(movement)
    ?? createAuthoredEpicyclicPistonGuide(movement)
    ?? createAuthoredForkedPistonGuide(movement)
    ?? createAuthoredSlottedCrossheadEngineMovement(movement)
    ?? createAuthoredMarineParallelMotion(movement)
    ?? createAuthoredBeamEngineParallelMotion(movement)
    ?? createAuthoredAtmosphericBeamEngine(movement)
    ?? createAuthoredUprightEngineParallelMotion(movement)
    ?? createAuthoredOscillatingEngineMovement(movement)
    ?? createAuthoredTableEngineMovement(movement)
    ?? createAuthoredDiskEngineMovement(movement)
    ?? createAuthoredDoubleStrokeSlotMovement(movement)
    ?? createAuthoredVibratingRodParallelMotion(movement)
    ?? createAuthoredDirectActionParallelMotion(movement)
    ?? createAuthoredWatchRegulatorMovement(movement)
    ?? createAuthoredDifferentialDriveMovement(movement)
    ?? createAuthoredPulleyFormMovement(movement)
    ?? createAuthoredSprocketMovement(movement)
    ?? createAuthoredCheckHookMovement(movement)
    ?? createAuthoredCrossedSlotMovement(movement)
    ?? createAuthoredPileDriverMovement(movement)
    ?? createAuthoredBeltMovement(movement)
    ?? createAuthoredEccentricCrownGearMovement(movement)
    ?? createAuthoredEllipticalIdlerGearMovement(movement)
    ?? createAuthoredSteppedSectorGearMovement(movement)
    ?? createAuthoredExpandingPulleyMovement(movement)
    ?? createAuthoredGearMovement(movement)
    ?? createAuthoredGearLinkageMovement(movement)
    ?? createAuthoredEscapementMovement(movement)
    ?? createAuthoredIntermittentMovement(movement)
    ?? createAuthoredJointMovement(movement)
    ?? createAuthoredPipeCouplingMovement(movement)
    ?? createAuthoredCamMovement(movement)
    ?? createAuthoredCamArrayMovement(movement)
    ?? createAuthoredSelectableCamMovement(movement)
    ?? createAuthoredCurveGeneratorMovement(movement)
    ?? createAuthoredDrawingInstrumentMovement(movement)
    ?? createAuthoredSoundingWeightMovement(movement)
    ?? createAuthoredDiagonalCatchMovement(movement)
    ?? createAuthoredQuadrantCatchMovement(movement)
    ?? createAuthoredEngineCouplingMovement(movement)
    ?? createAuthoredEngineReverserMovement(movement)
    ?? createAuthoredGabDisengagerMovement(movement)
    ?? createAuthoredStudDriveMovement(movement)
    ?? createAuthoredStrokeCrankMovement(movement)
    ?? createAuthoredCrankMovement(movement)
    ?? createAuthoredKneeLeverMovement(movement)
    ?? createAuthoredOffsetCrankSlotMovement(movement)
    ?? createAuthoredLinkageMovement(movement)
    ?? createAuthoredSilkTraverseMovement(movement)
    ?? createAuthoredClampMovement(movement)
    ?? createAuthoredScrewMovement(movement)
    ?? createAuthoredWormScrewMovement(movement)
    ?? createAuthoredGovernorMovement(movement)
    ?? createAuthoredWaterGovernorMovement(movement)
    ?? createAuthoredBeltGovernorMovement(movement)
    ?? createAuthoredWaveCamMovement(movement)
    ?? createAuthoredLostMotionMovement(movement)
    ?? createAuthoredMarineValveGearMovement(movement)
    ?? createAuthoredLocomotiveValveGearMovement(movement)
    ?? createAuthoredGrooveDrumMovement(movement)
    ?? createAuthoredVariableCrankMovement(movement)
    ?? createAuthoredWoolComberMovement(movement);
  if (!model) {
    throw new RangeError(
      `Movement ${movement.id} has no individually authored 3D model.`,
    );
  }
  if (model.root.userData.fidelity !== 'authored') {
    throw new TypeError(
      `Movement ${movement.id} resolved to a non-authored 3D model.`,
    );
  }
  model.root.userData.archetype ??= movement.archetype;
  return applyDisplayTiming(model, movement);
}
