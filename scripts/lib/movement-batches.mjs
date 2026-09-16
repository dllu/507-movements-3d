// Primary work queues, not claims of physical validation. Cross-family reuse is
// expected; every remaining movement has exactly one coordination owner.
const batch = (key, ids, mode, reuse) => ({ key, ids, mode, reuse });
export const movementBatches = [
  batch('catches-and-clutches', '183-184,186-189,217-218,247,251,253,267,277-278,280,360-361,385,415', 'contact-bake', ['mujoco-diagonal-catch', 'finite-plate-geometry.js']),
  batch('valve-linkages', '185,418', 'analytic', ['authored-locomotive-valve-gears.js', 'authored-marine-valve-gears.js']),
  batch('screws-and-clamps', '190,260,266,275,285,366,379-382,389,399,493-494', 'mixed', ['bored-worm-geometry.js', 'mujoco-screw', 'mujoco-bench-clamp']),
  batch('noncircular-and-variable-gears', '191,196,201,205,208-209,219,221-224,414', 'mixed', ['noncircular-gear-geometry.js', 'stepped-sector-geometry.js']),
  batch('mangle-and-reversing-racks', '192-194,197-199,216,269,371,394', 'contact-bake', ['mangle-gear-geometry.js', 'mujoco-endless-rack']),
  batch('worm-drives', '195,202,207,264', 'analytic', ['bored-worm-geometry.js', 'helical-gear-geometry.js', 'worm-wheel-profile.js']),
  batch('bevel-and-epicyclic-gears', '200,226,412,495,502-507', 'analytic', ['bevel-geometry.js', 'coaxial-gear-geometry.js', 'band-epicyclic-geometry.js']),
  batch('slots-and-crank-couplings', '203,210,220,230-231,252,268,273,279,282-283,348,350,354,401,417,419', 'analytic', ['authored-offset-crank-slots.js', 'linked-variable-crank-motion.js', 'mujoco-scotch-yoke']),
  batch('friction-drives-and-brakes', '204,242,244,250,262-263,265,270,365,372-373,388,413', 'mixed', ['grooved-friction-geometry.js', 'authored-cone-friction-drives.js']),
  batch('ratchets-and-indexers', '206,211-215,225,232-233,235-237,239-241,271,284,364,390-391,397-398,491', 'contact-bake', ['pull-pawl-geometry.js', 'mujoco-reversible-click', 'mujoco-rack-rectifier']),
  batch('chains-belts-and-pulleys', '227-229,243,254-259,352,358-359,362,368,374,383-384,392,496', 'analytic', ['belt-geometry.js', 'rope-kinematics.js', 'fusee-geometry.js']),
  batch('cams-and-followers', '272,276,281,286,400', 'mixed', ['mujoco-heart-cam', 'mujoco-grooved-heart', 'wave-cam-contact.js']),
  batch('escapements', '234,238,288-314,320-321,396,402', 'contact-bake', ['finite-plate-geometry.js', 'authored-deadbeat-escapements.js']),
  batch('governors-and-inertial-devices', '274,287,315-319,355-357,369', 'mixed', ['mujoco-ball-governor', 'mujoco-crossed-governor']),
  batch('drawing-and-measuring-linkages', '246,322-325,349,367,403-411', 'analytic', ['authored-linkages.js', 'authored-drawing-instruments.js']),
  batch('piston-guides-and-engines', '326-347,421-429', 'mixed', ['mujoco-crank-slider', 'mujoco-scotch-yoke', 'authored-beam-engine-parallel-motions.js']),
  batch('impacts-and-treadles', '351,353,363,375-378,416,420,470-472', 'contact-bake', ['mujoco-treadle', 'wiper-stamp-geometry.js']),
  batch('spatial-and-folding-linkages', '245,248-249,261,370,386-387,393,468,489-490,492', 'analytic', ['authored-joints.js', 'authored-pipe-couplings.js', 'rope-kinematics.js']),
  batch('water-wheels-and-fluid-rotors', '430-438,441-443,447,469,474,484-488,497', 'fluid-analytic', ['authored-horizontal-overshot-water-wheels.js', 'authored-screw-propellers.js']),
  batch('pumps-valves-and-fluid-storage', '395,439-440,444-446,448-467,473,475-483,498-501', 'fluid-analytic', ['authored-lift-pumps.js', 'authored-double-acting-pumps.js', 'authored-gasometers.js']),
];

export function expandIds(spec) {
  const ids = spec.split(',').flatMap(part => {
    const match = /^(\d+)(?:-(\d+))?$/.exec(part.trim());
    if (!match) throw new Error(`Invalid movement range: ${part}`);
    const first = Number(match[1]), last = Number(match[2] ?? match[1]);
    if (first < 1 || last > 507 || last < first) throw new Error(`Invalid movement range: ${part}`);
    return Array.from({length: last - first + 1}, (_, i) => first + i);
  });
  return [...new Set(ids)].sort((a, b) => a - b);
}

export function batchAssignments() {
  const assignments = new Map();
  for (const batch of movementBatches) for (const id of expandIds(batch.ids)) {
    if (assignments.has(id)) throw new Error(`Movement ${id} assigned twice`);
    assignments.set(id, batch);
  }
  for (let id = 183; id <= 507; id++) if (!assignments.has(id)) throw new Error(`Movement ${id} has no batch`);
  return assignments;
}
