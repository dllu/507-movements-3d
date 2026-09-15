# Open review: 170 crossed-arm governor

The selected finite-joint audit finds interference at all seven checked
interfaces. An unregistered MuJoCo study now drives only the spindle, leaving
crossed arms, upper links and axial output passive. Eight load/drive/timestep
cases identify branch failures at excessive speed and a promising smaller
drive range. Forty-cycle runs now qualify periodicity at two timesteps, and
an unregistered conical involute bevel pair passes its finite-surface sweep.
Source solids, the output bearing, assembly clearance and browser bake remain
open; see [movement 170](movement-170.md).

# Shipped reconstruction: 169 link-connected crank

Eleven finite meshes replace the inherited shaft spacing and solid joint ends
with measured proportions, bored link eyes and a rear connecting-link plane.
Initial moving joints fit within 2.9 pixels. Three tests, the 129-pose solid
sweep, production build and packaged desktop/mobile checks pass. Playback uses
analytic rigid closure with a four-second cycle and an explicitly inferred
hidden power pivot; no direct source animation exists for 169.
See [movement 169](movement-169.md). Next source review: 170; the full review
remains active.

# Shipped reconstruction: 168 variable-radius slotted crank

Nine meshes provide a tapered pitman, through-slot and real pin openings.
The engraving-based unequal spans fit all three initial moving joints within
1.6 pixels. Independent closure agrees with the source animation at 721 phases
using its separate dimensions. The 129-pose solid sweep finds no sampled
cross-body overlap; three tests, build and packaged desktop/mobile checks pass.
Playback is analytic with a four-second cycle and an explicitly inferred hidden
rocker pivot. See [movement 168](movement-168.md). Next source review: 169;
the full review remains active.

# Shipped reconstruction: 167 reversing spiral drum

Eight meshes replace the raised track and added frame with a recessed channel
and the source drum/shaft/rod silhouette. The 129-pose solid sweep finds no
sampled cross-body overlap. Three motion/clearance tests and packaged browser
checks pass. Playback is analytic, four seconds per full cycle, with explicit
dead-center and clearance assumptions. The source page has no working 2D oracle.
See [movement 167](movement-167.md). Next source review: 168; the full review
remains active.

# Shipped reconstruction: 166 slotted brick-press drive

166 now uses twelve meshes with real pin bores and a single capsule slot.
The 129-pose clearance sweep finds no sampled intersections. Independent
lost-motion closure matches the executed 2D oracle at 721 phases with oracle
dimensions; the engraving-based narrower slot has a documented shorter dwell.
Three tests, the build and packaged desktop/mobile checks pass without WASM.
See [movement 166](movement-166.md). Next source review: 167; the full review
remains active.

# Shipped reconstruction: 165 waved face cam

165 now uses 13 source-shaped meshes and a 666 KB offline contact bake. Its
quasi-static finite-roller solve replaces the legacy point-contact overlap;
whole-solid source projection is within 0.14 pixel. The 721-pose baked-solid
sweep finds no sampled intersection. Fourteen targeted tests, the build and
packaged desktop/mobile checks pass without loading WASM. Ideal loading,
guides, depth and rolling assumptions are explicit in
[movement 165](movement-165.md). The full 507-movement
review remains active.

# Shipped reconstruction: 164 knee press

164 now uses ten source-shaped meshes with analytic pinned-linkage motion and a
rounded foot seated in its cup. The added reaction frame and workpiece are removed.
The solver matches the source 2D oracle with its dimensions; source contours,
full-solid clearances, restart and packaged desktop/mobile playback are checked.
See [movement 164](movement-164.md) for the ideal bearing and load assumptions.

# Shipped reconstruction: 163 belt-shifting governor

163 now plays a 676 KB offline bake with 1,761 motion keys, 43 physical meshes
and seven belt seam marks. Passive governor motion and finite-width belt traction
replace the prescribed spread and invented remote gearing. The settled cycle needs
no numerical seam correction. Eleven tests, native/interpolated clearance sweeps,
production build and desktop/mobile Chrome checks pass, with no browser WASM.
See [movement 163](movement-163.md) for the reduced belt-model assumptions.

# Shipped reconstruction: 162 water-wheel governor

162 now plays a 452 KB offline MuJoCo bake with 1,490 keys and 38 rendered mesh
objects. Passive selector contacts reverse the output; the native loop retains
two net output turns. The qualified seam uses a documented subpixel numerical
correction. Native and interpolated clearances, twelve tests, production build
and desktop/mobile Chrome checks pass, with no browser physics loading.
See [movement 162](movement-162.md) for inferred parameters and numerical limits.

# Shipped reconstruction: 161 centrifugal governor

161 now plays a settled eight-second native cycle from a 451 KB bake, with no
live browser physics. Source-sized bevels, bored pin joints, balls, sleeve and
output fork replace the old equilibrium-driven assembly and invented valve.
The passive dynamics, interpolation, unwrapped rotation seam, 99-mesh clearance
sweep, bounds, restart, private build and desktop/mobile Chrome checks pass.
Inferred masses, depths and the unloaded remote valve connection remain explicit
in [movement 161](movement-161.md). Continue at 163; 147's mesh refinement and
150's source fit remain open. The full 507-movement review remains active.

# Shipped reconstruction: 160 spring-return treadle

160 now plays a four-second baked native cycle from a roughly 609 KB asset.
The source-shaped spring, solid pulley and treadle preserve ordinary attachment
motion, with a spatial full wrap and no live browser physics. Refined mechanical
and mesh-clearance checks, native-versus-interpolated playback, inextensible
leaf lengths, loop/restart, private production build and desktop/mobile Chrome
checks pass. The massless-pulley and inferred material/prestress assumptions
remain explicit in [movement 160](movement-160.md). Continue at 161; 147’s
refinement and 150’s source fit remain open. The full review remains active.

# Shipped reconstruction: 159 cord treadle

159 now plays a four-second baked passive MuJoCo cycle with source-proportioned
rigid parts, floor contact and a length-preserving slack illustration. The
525 KB asset renders eight meshes without loading MuJoCo WASM. Native tests,
interpolated cord/profile checks, bounds, seam/restart, private production build
and desktop/mobile playback pass. The massless slack shape is explicitly an
illustration; the finite-rope prototype remains unqualified. Details and
assumptions are in [movement 159](movement-159.md). Continue at 160; 147’s
mesh refinement and 150’s source fit remain open. The complete review is active.

# Shipped reconstruction: 158 treadle and disk

158 now preserves measured joint centers and the larger crank radius of the
engraving, with its tapered pedestal and supported treadle. A 16-mesh analytic
assembly updates only three rigid transforms. Three tests, source-oracle
comparison, 129-pose clearance audit, production build and desktop/mobile
playback pass. The model shows ideal linked motion at steady disk speed;
foot force and flywheel dynamics are not simulated. These limits and inferred
bearing details are explicit in [movement 158](movement-158.md). Continue at
159; 150's source fit remains open.

# Shipped reconstruction: 157 pinned bell crank

157 now uses source-proportioned bored links and an analytic full-turn assembly.
The exact drawing dimensions cannot assemble through about 24% of a turn;
three joint centers are adjusted by 9–12px to permit continuous rotation. This
is substantially closer to the engraving than the source animation's 39px pivot
and 74px output-joint differences. The solver reproduces that animation when
configured with its dimensions. Three tests, a 129-pose assembly audit, production
build and packaged desktop/mobile playback pass. Source corrections and hidden
supports are explicit in [movement 157](movement-157.md). Continue at 158;
150's source fit remains open.

# Shipped reconstruction: 156 slotted elbow

156 now uses engraving-based proportions, a finite slot, bored pin joints and
complete output guidance. Its exact analytic linkage needs no browser physics
and changes only rigid transforms during playback. Three focused tests, the
129-pose visible assembly audit, production build and packaged desktop/mobile
playback pass. The source animation agrees with the solver using its own
parameters; its dimensions differ from the engraving. The cropped rod length,
guide and rear supports remain explicit reconstruction assumptions in
[movement 156](movement-156.md). Continue at 157; 150's source fit remains open.

# Shipped reconstruction: 155 reversible elbow-pawl feed

155 now uses an 839 KB MuJoCo bake with both pawl installations, natural startup
and settled one-tooth feed. The source-shaped elbow, shallower teeth and pinned
input replace disconnected scripted engagement. Bored supports, retainers and
an upper crosshead pass startup and settled assembly checks. Five focused tests,
interpolated-assembly checks, production build and packaged desktop/mobile
playback pass. Inferred tooth count, pawl remounting, input guide and resisting
load remain explicit in [movement 155](movement-155.md). Continue at 156;
150's source fit remains open.

# Shipped reconstruction: 154 passive weighted bell-crank

154 now loads a 351 KB, 6,001-pose MuJoCo bake without browser physics.
The engraving's three stud centers drive the passive elbow and tension-only
wrapped cord; a physical stop replaces the prescribed reset. Bored hardware,
connected rope fittings and a reusable rope vertex buffer complete playback.
Four focused tests, native and between-bake-frame assembly checks, production
build and packaged desktop/mobile playback pass. The inferred stop and ideal
guide, eight-pixel weight offset, impact refinement limits and attachment joins
are explicit in [movement 154](movement-154.md). Continue at 155; 150's source
fit remains open.

# Shipped reconstruction: 153 passive stud-driven reverser

153 now loads a 299 KB, 6,001-pose MuJoCo bake with 15 meshes and no browser
physics. The inferred stepped arm releases the disk stud; gravity resets the
elbow onto a physical stop. Bored bearings and full-stroke bar guides pass the
assembly check. Three physics tests, two bake tests, the between-sample assembly
check, production build and packaged desktop/mobile playback pass. Hidden
relief, guide resistance, ideal constraints and finite sampling remain explicit
in [movement 153](movement-153.md). Continue at 154; 150's source fit remains open.

# Shipped improvement: 152 two-stud trammel

152 retains its exact ellipse geometry and now has close-fitting bar bushings,
finite crossed-guide shoes, a source-oriented view and a six-second turn.
Two focused tests, the dense legacy kinematic test, a 34-part full-turn surface
audit, production build and packaged desktop/mobile playback pass. Hidden
hardware and ideal guide/clearance assumptions remain explicit in
[movement 152](movement-152.md). Continue the catalog review at 153.

# Shipped reconstruction: 151 worm-driven opposite-hand screw

151 now uses a source-oriented edge-on wheel, an end-on upper worm shaft,
matching solid square threads, bored bearings and rear antirotation guides.
The refined worm clears all 65 sampled tooth phases; a 53-part assembly audit
passes 10,153,736 point queries across 17 poses. Three focused tests and packaged
desktop/mobile playback pass. The ideal 18:1 transmission preserves readable
input speed. Tooth count, supports, a 6.8px upper-axis source offset and finite
sampling remain explicit limits. See [movement 151](movement-151.md).
Continue at 152 while retaining the open 150 source-fit review below.

# Open source-fit review: 150 selectable valve cams

150's native MuJoCo trajectory now passes a 53-mesh, 934-pair rendered assembly
check. Four physics tests include rendered/native pin correspondence. A source
projection diagnostic measures 16.55px RMS joint error in the current view;
nearly frontal framing reduces that error but hides the present cam stack.
Cam contours/axial projection still require reconciliation with the engraving,
and passive playback still needs interpolation/baking. See [movement 150](movement-150.md).

# Shipped reconstruction: 149 twin cam followers

149 now uses a 453 KB, 601-pose offline MuJoCo bake with traced cams, source-length
rods, inferred vertical output guides and rear bearings. Five physics tests,
two bake tests, a 33-part between-frame assembly check, production build and
packaged desktop/mobile playback pass. Restart, full-sweep framing and no WASM
request are verified. Guides and obscured cam geometry remain explicit
engineering interpretations; small soft-contact and velocity residuals are
recorded in [movement 149](movement-149.md).

# Shipped reconstruction: 148 oblong-frame crank-rocker

148 now uses the traced oblong on the long rocker, a bored short crank and hubs,
involute gears and rear supports. The upper joint is shifted 14px right for
full-turn closure. A 65-pose complete assembly check, 257-pose tooth check and
four focused tests pass, along with the production build and packaged
desktop/mobile playback and restart. The frame attachment and support depths remain an
engineering interpretation; exact historical topology is not established.
See [movement 148](movement-148.md). Continue the catalog review at 149 while
retaining that source-interpretation caveat.

# Shipped improvement: 147 air-drag governor; refinement follow-up open

147 now uses passive MuJoCo lift baked into a 1.83 MB, nine-mesh bundle. The
remeasured fans, bored weight, crowned rollers, collar and slotted lever pass
joint and sampled assembly checks. Seven focused tests, the production build
and desktop/mobile playback/restart pass, with no browser WASM. Independent
timestep refinement changes lift by 0.000568 units, but mesh refinement changes
the transient by up to 0.04267 units. Keep that numerical follow-up and inferred
ramp profile open; cycle closure alone is not convergence. The output lever is
unloaded. See [movement 147](movement-147.md). Continue the catalog review at 148.

# Completed review: 146 measured framed yoke

146 now uses the measured crank, traced broad frame and corrected stroke.
Extended stems remain guided throughout the cycle; a front-supported shaft
clears the rear yoke. Actual groove clearance, 129 assembly poses, 257 framing
and guide poses, restart and fog checks pass. Mounting structure is omitted and
support/hidden-groove assumptions are explicit in [movement 146](movement-146.md).
No source animation is available. Continue to 147.

# Completed review: 145 rocking beam and tied rod

145 retains the source animation's exact analytic linkage and complete beam.
Both rods and the tapered beam now have bored joints; the axle, bearing, pin
retainers and sliding guide have actual clearance. The 129-pose visible assembly
check and focused joint checks pass, along with packaged desktop/mobile
playback and restart. Axial supports and the distinction between prescribed
rotation and force-driven motion are explicit in [movement 145](movement-145.md).
Continue to 146.

# Completed review: 144 lazy-tongs joints

144's analytic 3:1 linkage now uses bored flat links and handle clevises, a
seated fixed pin, source-length rod ends and a plain pedestal. Frontal view,
fog removal, eight-second playback and restart are checked. Bore tests and the
existing kinematic test pass; the visible assembly clears 65 sampled
configurations including both stroke limits. Depths remain reconstructed;
see [movement 144](movement-144.md). Continue to 145.

# Completed review: 143 generated keyed-worm traverse

143 now loads a prebuilt generated worm/wheel assembly with a keyed bore,
bored guide and bearings, direct wrist attachment, and twelve-second analytic
playback. The wheel's nominal outside radius is corrected from 60 to 56
engraving pixels. The regular generating envelope satisfies the 22:1 relation;
the actual simplified drive skins and assembly pass their respective 65-pose
checks. Closed surfaces, normals, measured linkage closure, serialized pin
alignment and complete motion bounds are checked. The 1.16 MB asset replaces
browser construction of the dense geometry. Display relief and inferred depths
remain explicit in [movement 143](movement-143.md). Continue to 144.

# Current review: 142 reconstructed variable traverse

142 now loads the corrected six/eighteen-tooth gearing, measured carrier and
bolted crank with a complete rod and output guide. Stud cap, working teeth and
guide are separated axially; 721 full-assembly clearance poses and a finer gear
check pass. Prebuilt geometry keeps gear generation out of the browser; analytic
playback takes fifteen seconds for the three-turn pattern. Joint, shoe, framing,
restart and packaged desktop/mobile checks pass without WASM. The rod's full
length, omitted guide, supports and depths remain explicit assumptions. See
[movement 142](movement-142.md). Continue to 143.

# Current review: 141 reconstructed band saw

141 now uses measured wheel spacing, a curved casting, six-spoke wheels, slotted
table and curved support. Its analytic twelve-second blade circuit replaces the
old tooth/tread intersections with overhanging teeth and an unbeveled tread.
Actual ribbon chords clear the rotating wheel envelope; tooth/table passages,
hub bores, supports, framing and restart checks pass. Packaged desktop/mobile
playback and visual review pass without WASM. Blade dimensions and hidden depths
remain reconstructed. See [movement 141](movement-141.md). Continue to 142.

# Current review: 140 reconstructed toggle punch

140 now loads an analytic reconstruction with engraving-fitted unequal links,
handle, curved casting, open guide and bored die shelf. It corrects the old
82-pixel handle-tip mismatch. Its 29.65-pixel stroke needs a 123.53-degree lever
swing, an explicit difference from the source animation. Full-stroke linkage,
finite plate/pin clearance, round punch passage, framing and restart checks pass.
Packaged desktop/mobile playback and visual review pass without WASM. Hidden
depths and the die passage are reconstructed; material cutting is not simulated.
See [movement 140](movement-140.md). Continue to 141.

# Current review: 139 baked internal rack

139 now replaces the colliding legacy teeth with a nine-tooth involute pinion,
conjugate opening and measured unequal suspension arms. The passive contact
simulation is baked into a 1.03 MB asset with an eight-second cycle. Separate
timestep/contact checks differ by at most 0.252 pixels; a 32-second run has no
resets and maximum penetration 0.0375 pixels. Interpolated tooth overlap, pin/bore
alignment, roller support, motion bounds, loop/restart and packaged desktop/mobile
checks pass. No WASM is requested. The coupler weight, physical scale, depths and
lumped inertias remain explicit reconstruction assumptions, not exact historical
measurements or mesh-derived inertias. See [movement 139](movement-139.md).
Continue to 140.

# Current review: 138 traced cam and baked pointed follower

138 now uses the engraving's traced outline, correcting the old animation-based
profile mismatch and transposed follower tip. Twenty edge landmarks are within
2.49 pixels. Guides and rod length follow measured source positions; fitted
bores and a rear support replace the preceding frame. Passive MuJoCo motion is
baked into a 420 KB bundle, including brief lift-off at sharp corners. Separate
timestep/mesh checks, finite-tip clearance, guide engagement and loop/restart
checks pass. Physical scale and hidden depths remain explicit assumptions.
Packaged desktop/mobile playback and visual review pass, including a check
that the complete rod section passes through both guide bores.
See [movement 138](movement-138.md). Continue to 139.

# Current review: 137 shaped expansion eccentric

137 now loads baked MuJoCo motion and a traced shaped cam, with passive fork,
rollers and a separately hinged valve rod. No browser physics or circular cam
branch equations are used. Separate timestep/mesh sensitivity, interpolated
contact clearance, pin alignment, loop seams, restart and packaged playback
pass. The drawing needs an explicit 12-pixel outward adjustment at each roller
to avoid interference; hidden contour arcs and mounting remain inferred.
Continue to 138; see [movement 137](movement-137.md).

# Current review: 136 axial face cam

136 now follows a finite spherical-tip envelope instead of point contact.
The old trajectory penetrated the rendered cam by about 0.123 units. Actual
mesh clearance, envelope derivatives and normal contact velocity are checked.
Playback allows one tooth stroke per second. The spring now preserves wire
thickness and centreline length between connected bored seats; the guide post
clears the rod. A side-on camera follows the engraving. The guide, collar and
rod endpoint now match measured source positions, and a fitted shaft bearing
replaces the decorative ring. Focused checks pass on the revised dimensions.
Packaged playback and visual review pass. Continue to 137; see [movement 136](movement-136.md).

# Current review: 135 Reuleaux valve cam

135 retains its exact analytic constant-width motion. The un-beveled working
mesh now matches that profile, with a measured maximum liner gap of 0.001007.
The shaft stays behind the working plane and the fastener reaches the carrier.
Four-second playback and restart are enabled. Bowed yoke sides, wider measured
rods and connected guide shoes with real passages now pass full-stroke checks.
Fitted rear bearing, connected base supports and the measured fastener location
now pass their checks. Packaged playback and visual review pass. Continue to 136; see [movement 135](movement-135.md).

# Current review: 134 rope drum

134 now uses a seated helical wrap with separate tangent entry/exit spans.
Finite rope and flange checks pass; prescribed uniform material speed includes
explicit axial creep rather than a false zero-slip assertion. Four-second
playback, restart and ground/fog cleanup are in place. Traced curved spokes, flush rim dividers, the engraved shaft diameter and
fitted bored supports now replace the preceding silhouette/hardware.
Casting and shaft clearances pass. Hidden supports and traction are explicitly
idealized. Continue to 135; see [movement 134](movement-134.md).

# Fidelity and rendering review

The active task remains the review and correction of **all 507 movements**.
The previous implementation's `authored` labels and regression tests are not
evidence that all models match the engravings or avoid interference.

## Faster playback and source references — 2026-09-14

133 now uses offline-generated involute pinion/sector teeth, with finite
full-stroke overlap checks and a wrong-phase failure control. Its six-to-one
analytical linkage is retained, with a six-second display cycle and Restart.
The frame and guide rails now connect, and the anvil covers the platen in depth;
full-stroke support-clearance checks pass. The connecting rod now has bored eyes
and retaining heads, with pin/eye and axial clearance checks. A continuous
two-opening sector web follows the engraving and fully seats the rod pin;
full-stroke web/pinion interference checks pass. Fitted shaft sleeves and a
bored sector hub replace decorative bearings; their clearance checks pass.
Frame, rod and crank proportions now fit eight engraved landmarks within four
pixels, with full-stroke checks on the revised geometry. Engraving proportions and remaining
hardware still need review; see
[133's partial review](movement-133.md).

132's handle now sweeps in front of the frame, avoiding a verified collision
with the right column. Finite lever/column checks reject the former handedness;
rod-length and linkage regression checks pass. Playback has a four-second
display cycle, Restart and a nearly frontal view. The collar and three overhead
frame layers now have coaxial shaft bores, checked against their actual triangles;
the shaft stub emerges above the frame. Both disks now contain spherical seats
and flared rod entrances, with finite clearance and source disk-height checks.
The bell now has a curved flare and measured neck dimensions; the unengraved
workpiece and raised trim are hidden. Columns, feet, overhead layers and guide
webs now connect, with full-stroke platen/frame clearance checks. Joint retention
and hidden construction remain qualified; continue with 133. See [132's review and qualifications](movement-132.md).

131 now has an engraving-based analytical assembly: one connected slotted
sector with two traced web openings, measured disk/shaft/guide positions,
involute teeth and a close-fitting pin. It has no invented rear frame or
indices. Full-cycle finite clearance tests cover the pin, gear/rack and guides.
The source animation's proportions differ slightly; tooth regularization,
extended bar ends and hidden depths are documented in [131's review](movement-131.md).

130 now uses source-traced shear profiles and a passive gravity-driven jaw, with
only its eccentric cam actuated in MuJoCo. Its motion is baked into a 264 KB
asset; browser playback needs no WASM. Native timestep refinement differs by
less than 0.03 source pixels. The blades pass with axial clearance and cut
progressively from the throat rather than forcing the far tips together.
See [130's reconstruction and validation](movement-130.md).

129's rope exits no longer intersect the barrel flanges: the source's central
flange and bare barrel replace two flanges at the exits. A finite rope/flange
distance test passes across 121 poses and rejects the former placement.
Playback has a six-second full cycle and no scene ground. Its lower sheave is
now one bored, grooved solid with a traced J-hook and shorter hanger. Rope
anchors stay fixed on the shaft, and neighbouring windings pass finite
clearance checks. A refined arc-length audit bounds the ideal lift law's
omitted winding correction to 0.0369 source pixels after correcting the barrel
and rope dimensions. Bored posts now join the shaft bearings, with feet linking
them to the base; shaft/base heights follow the engraving. The unengraved crank
and diagnostic markers are hidden, and the camera is nearly frontal. The lower
sheave's projection remains a documented reconstruction qualification;
see [129's partial review](movement-129.md).

128 now has a source-traced frame and cam faces with contact-driven MuJoCo
motion baked for browser playback. Only the rotor is actuated; explicit guide
friction prevents the rejected near-frictionless trial's outer-rim impacts.
The final 18-second recording has no resets or outer-wall contacts and less
than 0.066 source pixels of penetration. Each output stroke takes two seconds.
See [128's assumptions, validation and reproduction](movement-128.md).

127 now uses a compact analytical rack-and-pinion reconstruction, with measured
engraving proportions, pierced spokes, conjugate involute/rack teeth and no
invented frame. Finite profiles pass 721 sampled poses with a wrong-phase
failure control; engagement gaps remain below 0.3 source pixels at 121 poses.
Its full stroke takes four seconds. Source-animation timing differences and
reconstruction assumptions are recorded in [the 127 review](movement-127.md).

Use scripted analytical motion for simple mechanisms and MuJoCo where needed
for correctness, with offline baking for expensive browser simulations.
Movement 123 is the first baked conversion: cached visible geometry, no browser
MuJoCo download, preserved startup and a continuous six-second settled loop.
Fresh native comparison bounds interpolation error to 0.07114 source pixels
through startup and a full cycle. The source-animation index finds 150 original
animations (104 among 127–507), ready to guide subsequent reviews. This does
not mark the remaining movements verified. See [workflow details](baked-motion.md).

## Movement 086 reconstruction study — 2026-09-12

086's baseline is rejected. Its rounded cam and circular contact pads have
essentially zero shaft-axis torque arm, despite reporting near-zero contact
error. Its finite screen finds 588,297 penetrating samples among 18,820,946
checks over 136 poses and 1,162 independent pairs. The source proportions and
front bearing standard also differ substantially from the existing model.

The initial replacement follows measured wheel and pin circles, a manually
traced hooked catch, pointed cam and pierced front standard. Thirteen core
solids pass topology checks. All 56 independent core pairs pass a diagnostic
34-pose surface screen; this prescribed sweep is not solved dynamics. Ten
baseline views, seven candidate views, both source images and a measurement
overlay are inspected. The candidate's principal contours closely overlay
the source.

Actual finite cam/hook contact seats after 3.146 degrees of clockwise cam
rotation and has a usable clockwise torque arm. Both boundary normal cones
and clear/penetrating controls pass. Rope, pump loading, rear input apparatus,
release dynamics, continuous clearance and integration remain pending.
All 972 production inputs remain unchanged. See the
[086 study](../artifacts/review/086-reconstruction-notes.md).

The dynamics study now includes mesh-derived mass/inertia and an independent
pump with a finite attached rope that can go slack. Length, gradient, energy
and momentum formula checks pass. Independent checks rejected earlier
negative tension, nonlocal corner forces and a return collision hidden by
normal filtering. Those failures and their exact source snapshots are retained.

The latest guarded three-second run passes all 5,264 reaction checks and
6,246,092 core surface samples. Its denser cap-triangle screen still fails
at 20 cam/hook poses, with maximum overlap area 5.174001e-9 at an interpolated
midpoint. Earlier 1 ms/0.5 ms runs diverged substantially; step agreement for
the guarded solver is pending. Full return/cycle behavior, continuous
clearance, rope/load meshes and rear hardware remain unresolved. This is
diagnostic progress only; production remains unchanged.

The subsequent impact study corrects closing velocity left at seated
contacts and a roundoff error that removed valid faces near contact. All
1,460 face controls now pass; the old method lost 62. The three-second 0.5 ms
impact run passes 9,625 reactions, with contact drift work reduced to 1.24e-14.
Nine new source/motion views are inspected as diagnostics.

The motion remains rejected: 1 ms/0.5 ms startup differs by 27.340 engraving
pixels, and 0.25 ms/0.125 ms startups still differ by 15.229 pixels and lose
cam engagement. The finest startup passes force, energy and sampled overlap
checks, which does not establish the required capture and repeated cycle.
Production, the original core geometry and the 082/083 studies are unchanged.

The rear input candidate now completes both pulleys, the band, shafts and
rear supports. All 28 solids and 285 independent pairs pass 14,181,018 surface
samples at 34 prescribed poses. Eight source/overlay/full-drive views are
inspected. This remains separate from the loaded motion candidate.

Slower input retains initial capture, but a 24-second run still fails to
repeat the pump sequence. An optional weighted catch head and relative
bearing/pump losses now have independent mass, force and power checks. The
16-second loaded trial passes 64,587 reaction checks, its work audit,
5,290,338 solid samples and all 64,001 primary knot/midpoint overlap checks.
It is nevertheless rejected: first-revolution lift is 2.589774 units and
second-revolution lift only 0.001119. Eight more motion views show the catch
turning away from its ready position. Catch reset, rope/load hardware,
time-step agreement and complete clearance remain unresolved. See
`086-rear-drive-study-checkpoint.json` and the linked study notes. Production
and the original core geometry remain unchanged; the all-507 goal is active.

A finite heel lug and wheel-mounted stop now prevent inward catch overtravel.
With relative pin damping increased from 0.02 to 0.2, the 0.5 ms loaded trial
repeats both lift/release/return cycles: each lifts 2.589426891 units, and
corresponding states after initial capture agree within 9.15e-14. The hidden
stop and damping are explicit assumptions, with actual finite contact and
independent mass/moment controls.

All 58,645 reactions, the work audit, 6,032,478 solid samples and 64,001
primary knot/midpoint overlap checks pass. Nineteen additional source, stop
detail and solved-motion images are inspected. A regression also fixes a
contact-query crash on interior cap vertices. Conservative box filtering
reproduces 727 complete feature lists and 81 saved impact steps exactly.
The sixteen-second 0.25 ms refinement completes 64,001 states without
subdivision. The 0.125 ms run reaches the end but fails during large-array
summary construction; its retry is running with a verified bounded summary.
Their agreement, complete
rope/pump hardware and continuous clearance remain
unqualified; no integration or all-507 completion is claimed. See
`086-heel-reset-final-study-checkpoint.json` and the linked study notes.

## Movement 085 rebuilt and verified — 2026-09-12

085's baseline is rejected for its oversized fan-shaped cams, spherical
follower, wide rod spacing and straight support. Its prescribed late lift
requires downward cam support, and a finite screen finds shaft/support and
travel-marker/guide intersections.

The integrated replacement follows the measured wipers, flat projection B, square
rod, curved standard and flared head. It has fifteen closed solids, a rotating
input shaft and actual guide/bearing bores. Hidden depths and a striking bed
that keeps both guides engaged are explicit reconstruction assumptions.
Gravity and finite cam contact determine the rod motion at four seconds per
shaft revolution. Nine-second 0.25 and 0.125 ms runs agree within 0.193724 source
pixels. All 60,551 contact reactions pass actual mesh boundary and normal-cone
checks; momentum and energy audits pass with contact drift work reported.
The refined surface screen covers all 68 independent pairs and 1,501,058
samples without detected intrusion.

Playback preserves startup and repeats a complete four-second cycle from a
resting stamp pose. Its 2,950 knots add at most 0.000099171 source pixels of
compression error. Continuous triangle bounds limit runtime contact projection
to 0.002 pixels over every interval. Together with observed time-step agreement,
the total is 0.195823137 source pixels; this is not a continuum-error guarantee.
Continuous finite hardware bounds cover all 68 independent pairs.

Production matches all 43 geometry buffers and 13,981 poses exactly. All 3,108
numerical tests, the build and the targeted desktop/mobile browser check pass.
Eighteen integrated images are inspected and accepted; the actual engine's
shadow settings resolve the earlier candidate-preview shadow issue. Live
playback averages 56.36 fps with approximately 0.1 ms 95th-percentile model
updates. The other 506 catalog and display-profile entries remain unchanged.
Earlier capture, normal, mesh-limit and time-step failures are preserved.
No new all-507 browser pass is claimed. See the
[085 review](../artifacts/review/085-reconstruction-notes.md).

## Movement 082 reconstruction study — 2026-09-11

082 now has a finite-contact dynamics candidate with 26 steeper teeth,
curved pawls, separate rod joints and a small pulley C. The fixed-pin linkage
supplies both moving pawl hinges; gravity, inertia and an explicit lower-pawl
preload determine free motion. The finest twelve-second run passes 690,558
independent contact-reaction checks. Corrected joint/support spacing passes 12,153,906
surface samples over 49 poses and 538 pairs. All 35 meshes pass topology
checks, and 13 new source/motion views are inspected.

An independent loading study now includes all nine rigid component families.
It finds feasible positive strap tension with both feet pressing down,
allowing the rising foot to absorb work. Mesh energy integration and momentum
checks pass; corrected energy residual decreases with smaller steps. The
strap/pulley remain ideal massless constraints. The candidate now applies a
rolling approximation with small measured circumferential slip; it remains
an idealization without a traction proof. Conservative contact pruning gives identical results in 12,326 cases
and approximately 3.63 times faster local queries.

The pulley stays on its fixed axle, and all other part transforms match the
prior candidate at 257 checked poses. The newest twelve-second startup has
384,001 states and passes time-step agreement at 0.0345345 engraving pixels.
Compression to 24,123 knots adds at most 0.0000134321 pixels. Actual mesh
triangle bounds cover both pawl/ratchet pairs through every interval, and
the secondary bounds retain their margins after compression. Together they
cover all 538 independent component pairs within 1e-6 world units.

Thirteen new candidate stills and the live preview's final image are inspected.
The finite browser preview keeps all 269 rendered frames inside the camera
and above the ground. It averages 22.32 fps locally, with 0.400 ms model updates
at the 95th percentile. This is diagnostic candidate evidence.

The finest loading audit also passes, with a corrected cumulative energy
residual of 0.00143644% of its work/loss scale. It retains the explicit ideal
two-foot loading and massless pulley/strap assumptions.

082 has not been integrated. Both settling step sizes now reach 60 seconds
without failed steps. The completed 0.0625 ms continuation has 768,001 states.
Its comparison with 0.125 ms differs by 0.532806 engraving pixels, failing the
unchanged 0.25-pixel target. Sixteen-second recurrence differences are 0.420341
and 0.386980 pixels; eight-second recurrence remains rejected. Final playback
and repeated-motion clearance remain pending. A report-specific compact JSON
serialization intervention preserved the long run without changing study
sources. The runner now has a bounded writer, checked byte for byte against
native JSON with real trajectory rows. Its three output-only edits are
verified exactly against the archived runner; the other 40 study sources
remain unchanged.
Earlier gravity, contact,
hardware, step-size and recurrence failures remain archived, along with the
rejected oversized-pulley interpretation. The later framing-marker shadow
fix changes only the shared shadow helper; 082 remains separate from
production. Details and limits are in the
[082 study](../artifacts/review/082-reconstruction-notes.md).

## Movement 083 reconstruction study — updated 2026-09-12

Six actual baseline views are inspected against the native engraving. The
existing straight-bar sector and separate spring shoe do not reproduce the
broad pierced source plate. The prescribed return lift also permits finite
tooth interference: a 65-pose screen finds 4,632 penetrating samples among
3,585,304 checks over 1,036 selected pairs, with maximum depth 0.062958 world
units. This rejects the existing model; no replacement is yet integrated.
The isolated replacement now has broad pierced plates, rounded openings,
measured joints and a provisional 12-tooth arc. Source overlays exposed and
rejected a wheel-edge reading and an extra central tooth in earlier fits.
The latest candidate has paired radial spring guides behind each plate and
ordinary-pin input closure. The crown ramps now match the source direction;
the output axle turns with the wheel. Finite-mesh seating is checked at 117
shaft/wheel poses, with matching unpruned comparisons and an independent
penetrating negative control. Analytic contact derivatives and independent
mesh-energy checks of the free force equations pass.

Free contact dynamics now determine the wheel and sector lifts. The first
slower run passes all 7,147 spatial reaction checks at saved states, but it
fails midpoint clearance and differs by 194.416 source pixels when its time
step is halved. An independent mesh check confirms the missed tooth intrusion.
It is rejected for playback.

Starting from a checked static gravity/spring equilibrium removes the large
startup divergence. Two step sizes now advance about 8.12 teeth per cycle,
but still differ by 4.19131 pixels and retain about 0.23 teeth of retreat.
The completed 0.0005- and 0.00025-second-step runs reduce the refinement
differences to 1.703677 and 0.451570 pixels, still above the target. The corrected-start study also has
twelve inspected source/motion renders, without browser errors or unexpected
warnings. No final motion is accepted or integrated.

A new continuous finite-solid bound finds 21 missed crossings in the previous
0.0005-second trajectory. The integrator now rejects crossing trials and
recomputes both half steps without reseating a sector. The known failure
passes independent repaired-motion surface and reaction checks. A full
eight-second run now bounds both complete sector/crown pairs across 8,048
accepted intervals, and all 14,981 recorded reactions pass the spatial audit.
The finer 0.25 ms and 0.125 ms runs also finish without crossings, but differ
by 0.947596 source pixels and fail the 0.25-pixel motion-agreement target.

New full-travel bounds cover all 1,198 secondary hardware pairs, including
the round pin/slider bores, guide windows and spring seats. A deliberately
misaligned guide rod is rejected. Continuous local-cell and separate-turn
bounds establish self-clearance for all four finite spring wires; 52 sampled
wire states remain closed and outward oriented. The combined checker verifies
all 1,280 distinct-family pairs and spring self-clearance across the finest
run's 64,000 intervals within 1e-6 world units. Sources, exhaustive pair counts
and trajectory containment in the bounded domain match. This qualifies the
current candidate's clearance, including its assumed hidden guides.
The finest spatial audit now passes all 118,413 impulses and 236,826 boundary
checks. A new input-loading audit includes all five rigid families and the
ordinary-pin rod's sideways motion. Direct mesh integration verifies its
energy and input momentum; the rod transmission stays clear of a toggle
throughout the shaft range. The normalized cumulative energy residual halves
to 0.0000638841% with the finer step. Forces are interval averages under ideal
rigid impacts; individual guide pressures and material loads are not qualified.
The guide construction now closes the former 0.003-unit rod/bore gaps with
matching faceted profiles. Compressive surface normals span all five required
ideal guide reactions. Circular hub faces replace the unshown lower lips;
thin backing plates cover the shaft notches from behind. Free-body geometry,
mass and springs remain identical. All 69 meshes pass topology checks, and
the revised bounds cover all 1,384 independent pairs through the complete
64,000-interval trajectory. Updated shaft loading still passes the energy
audit. Twenty-four new diagnostic views are inspected, including twelve
after the hub correction.
The 0.0625 ms run now finishes with 128,001 states and complete clearance,
but differs by 3.133324 pixels from 0.125 ms and fails motion agreement.
The first large discrepancy follows a rear-sector landing near 3.642 seconds.
Short replays from one shared state agree within 0.008742 pixels; the same-step
replay exactly reproduces the original segment. This points to sensitivity
to earlier state error and does not qualify the complete motion. The approach
to that landing, remaining reversal, support assumptions and final playback
still need work; 083 remains outside production.

An isolated BDF2 experiment now improves smooth-branch integration while
retaining the old solver for contact changes. Analytic smooth and plastic-impact
controls pass, and shared-state landing replays agree within 0.007862 pixels.
The first 1 ms and 0.5 ms full cycles retain complete guided-candidate clearance
but differ by **0.479747 pixels**, above the 0.25-pixel target. Their method-specific
reaction audits are separate from the old energy audit. A supplemental
immediate-release control exposes first-order backward-Euler startup error;
the actual 083 start is a separately solved static equilibrium. The full 0.25 ms
run also fails the adjacent comparison at **0.479608 pixels**. A new BDF-specific
five-family energy audit passes all three complete cycles, with a finest
normalized residual of 3.44209e-8 and explicit signed history exchanges.
A separate restart variant bounds the two post-impact intervals by the event
resolution. Its analytic and short replay controls pass, but both restart
variants already agree in the short shared-state replay. The revised full
cycles pass clearance and energy but still fail motion agreement at 0.483124
pixels. One reaction-check failure is traced to a nearby vertex incorrectly
included in a supporting edge; an independent finite-edge solution recovers
the solver torque exactly. Full audits with stricter support selection now
pass.

An isolated contact-kernel optimization reproduces every stored state,
impulse, rejected trial and clearance statistic in both full reference runs
exactly. Recorded runtimes improve by about 4.6 to 5.7 times; these are workload
observations, not controlled benchmarks. The new 0.25 ms and 0.125 ms full
cycles give the first passing adjacent comparison at **0.0503433 pixels**.
The finer cycle passes complete guided clearance, 120,852 independent reaction
checks and the method-specific energy audit.

Continuing both trajectories through sixteen seconds exposes a new
**8.463231-pixel failure** during the second cycle. The exact carried states
and numerical-history restarts are checked at the join. Disagreement crosses
0.25 pixels near 11.316 seconds, after several contact events; no cause is yet
established. All 1,384 independent pairs remain clear through the 131,832
finer intervals, and the full energy audit passes. Independent spatial audits
pass all 236,375 reactions across both cycles. Replaying the second cycle from
one shared state reduces the discrepancy to **0.738183 pixels**, still above
target. Carried first-cycle error contributes to the longer disagreement;
second-cycle integration error also remains unresolved.
Motion refinement and playback qualification remain open. All 904 frozen
app inputs, 43 treadle study sources and 40 prior 083 study sources remain
unchanged; the prior steppers and evidence are preserved.

The next isolated variant retains second-order history when the time step
changes, with growth bounded by two. Analytic uneven-step motion, contact and
energy controls pass. First-cycle agreement improves to **0.00136539 pixels**
between 0.25 ms and 0.125 ms. Both cycles pass complete guided clearance,
spatial reactions and the updated energy audit. The separate original 0.0625 ms
cycle also passes its first-cycle comparison at 0.0510740 pixels.

The new sixteen-second comparison still **fails at 7.399579 pixels**. Near
12.694 seconds one trajectory briefly catches tooth 25 while the other misses
it and reaches tooth 26. Both finer segments retain complete clearance and
passing energy audits; all 240,173 reactions pass independent spatial checks.
Twelve new source/motion stills are inspected without page errors or unexpected
warnings.

Ten times finer event timing exposes a round-off bug in the variable-step
growth guard: a nominal double step is repeatedly halved because nearby stored
time stamps lose subtraction precision. The complete 303,989-state prefix is
preserved in a verified lossless snapshot before the diagnosed run is stopped.
A separate corrected guard accounts for clock spacing and retains a hard
growth cap. Analytic controls reduce 8,193–16,384 intervals to 16, with twelve
exact accepted-step comparisons. The corrected finer-event trial is running.
The 60 current study sources are frozen, production is unchanged, and repeated
playback and final support presentation remain unqualified.

The corrected 0.1 us trial completes, and new clock-aware audits pass. Lossless
compressed reports now preserve native JSON values while avoiding duplicated
large evidence files. A segmented comparator checks exact resume joins and
reproduces the prior comparison's maxima and failed result exactly.

At 0.1 us event resolution, 0.25 ms and 0.125 ms base steps agree within
**0.00103791 pixels** for the first cycle, but differ by **3.534342 pixels**
through sixteen seconds. The separate fixed-base comparison with the earlier
1 us variant differs by 0.268962 pixels through sixteen seconds; its recorded
clock-guard change prevents attributing that difference solely to event timing.
Complete guided clearance and energy audits pass for both finer segments, and
all 245,480 reactions pass independent spatial checks. The final cycle endpoints
still differ by 0.541790 pixels after removing eight teeth of rotation, rejecting
a seamless loop of these states. The 0.0625 ms first cycle now completes and
agrees with the 0.125 ms run within 0.00102219 pixels. Its guided clearance and
energy checks pass; its spatial reaction audit and second cycle remain in
progress. All five completed trajectories have finite states and their full
requested durations, and all four packed reports reproduce their producer
byte counts and hashes when decoded. The 69 study sources are frozen, with
904 production inputs unchanged; the full review remains active.

The finer 0.0625 ms first-cycle spatial audit now passes all 243,476 reactions.
Its completed second cycle passes guided clearance and energy checks, but
the sixteen-second base-step comparison **fails at 6.992124 pixels**. A brief
tooth-25 contact is present in the 0.125 ms history and absent in the finer one.
Halving only the event window from the same saved second-cycle starting state
passes at 0.202838 pixels.

From an identical state at twelve seconds, the next 1.5 seconds at 0.0625 ms
and 0.03125 ms agree within 0.000111698 pixels. Using different parent states
with the same 0.03125 ms step preserves the different tooth catches and grows
an initial 0.00343611-pixel position difference to 3.698066 pixels. This
establishes sensitivity to accumulated state differences; it does not resolve
the complete motion's accuracy. The finer cycle endpoints also fail the loop
target at 1.406439 pixels. A complete 0.03125 ms first cycle continues running.
The two diagnostics bring the frozen 083 source count to 71; playback,
integration and the full review remain open.

The complete 0.03125 ms first cycle now finishes without failed steps and
agrees with 0.0625 ms within 0.00154025 pixels. Its guided clearance and energy
audits pass. Its second cycle has also completed, with guided clearance and
energy checks passing. The complete sixteen-second comparison still fails at
6.925184 pixels. The finer history catches tooth 25 for about 15 microseconds;
the 0.0625 ms history misses that catch. All 2,864 reactions in a focused audit
around this event pass independent boundary, normal and moment checks. These
results do not resolve motion refinement or qualify production integration.
All continuation and checker jobs have finished; the 71 existing 083 sources
and 904 production inputs remain unchanged.

084's baseline is also rejected. The source has a single projecting cam in
front of a large wheel with curved spokes; the baseline has a four-lobed cam and a
small wheel with straight spokes. Its suspension slots are overlays on a solid
housing. Eight baseline views are inspected, and 6,427,516 finite-surface
checks find 27,333 penetrating samples, including both pins entering the
housing. Preliminary source circles and contour targets are measured and
inspected. A labeled tooth overlay fits thirteen upper working faces and
thirteen of fourteen lower candidates; the obscured lower face remains
unmeasured. The visibly irregular spacing is quantified, and all three new
source views are inspected.

084 now has an independent candidate with seventeen closed solids, including
the single cam, full rear wheel, real suspension slots and retained pins,
through guides and rear bearing standard. The source pose and 33 neutral
angles pass 2,526,268 surface samples over all 99 distinct-family pairs.
Six latest browser views are inspected, with no errors or unexpected warnings.
An aligned-slot cap triangulation defect was repaired without moving the
contour; its failed screen and controls are preserved.

The actual mesh contact intervals agree with independent polygon intersections
at 3,783 poses. A continuous neutral-domain bound clears the rack against the
cam, hubs, axle and rear wheel across the full horizontal slot range. Earlier
full-turn selections exhausted slot travel, and nearest-position projections
jumped between gaps. Those rejected paths are preserved.

The new loaded study frees both rack translations and its planar angle.
Gravity, inertia, drag and actual cam/pin contact resolve two smooth governor
pulses, release and settling over 5.5 seconds. All four step sizes complete;
the finest pair, 0.25 and 0.125 ms, agree within 0.133435 engraving pixels.
The 0.125 ms run passes all 84,844 spatial reaction checks and the discrete
momentum/energy identities. Its 132-pose surface screen covers 9,807,864
samples over all 99 distinct-family pairs without intrusion beyond tolerance.

A continuous bound now covers all 44,000 saved intervals for the frame
against the cam, pin shanks, fixed axle and guide passages, to 1e-6 world
units. It uses actual prisms, containing guide sections and analytic bounds
between endpoints. Neutral and deliberately penetrating controls behave as
expected. Whole-motion hardware bounds now complete all 99 independent pairs.
The compressed 13,525-knot playback also passes continuous clearance checks;
compression plus observed step refinement totals 0.133445 engraving pixels.

084 is integrated with the single cam, full curved-spoke wheel, actual slots
and finite pin joints. Its four-second cam revolution runs through a
5.5-second demonstration, followed by an explicit animation pause and Replay.
The declared camera envelope includes the final drift. Production matches the
reviewed trajectory at 27,049 checked knots and midpoints. All 3,104 numerical
tests, the build and the 084 desktop/mobile browser test pass. Fourteen final
app/source/motion views are inspected, without errors or unexpected warnings;
playback averages 59.84 fps with 0.2 ms 95th-percentile updates. The current
checkpoint freezes 944 inputs and accounts for the five changed preexisting
production files. No new all-507 browser pass is claimed.
See [the 084 reconstruction record](../artifacts/review/084-reconstruction-notes.md).

For the earlier sampled trajectory, all 67 meshes pass topology checks at nine poses;
2,632,342 surface samples across 1,280 distinct-family pairs find no intrusion.
The later midpoint failure establishes the limits of that sampled evidence.
Refinement, guide loads and final playback remain open.
The capture check passes without JavaScript errors or unexpected warnings.
Production is unchanged.
Measurements, preserved failures and qualification limits are recorded in the
[083 review](../artifacts/review/083-reconstruction-notes.md).

## Invisible framing-marker shadows — 2026-09-11

The shared shadow helper no longer enables shadows on invisible camera-framing
guides. This removes the isolated shadow spots seen beyond 083's model.
Constructing all 507 catalog entries confirms shadows are disabled on all
66 marked guides in 53 movements. Six before/after renders are inspected;
pose data and the source panel match, and only the former marker-shadow pixels
change. The build and all 3,100 numerical tests pass. The updated
904-input map is `artifacts/review/083-shadow-source-hashes.json`; only
`src/simulation/primitives.js` differs from the prior production map.

## Movement 081 integration — 2026-09-11

081 now uses the measured six-tooth gear and seven-tooth rack, with finite
contact, spring return and a constant-section spring. All 3,100 numerical
tests, the build and its desktop/mobile browser check pass. Thirteen final
views are inspected. Details and reconstruction assumptions are in the
[081 review](../artifacts/review/081-reconstruction-notes.md).

## Git checkpoint — 2026-09-11

The workspace now tracks `git@github.com:dllu/507-movements-3d.git` on `main`.
Meaningful progress is committed and pushed using `daniel@lawrence.lu`.
Source, production data, tests, scripts and review notes are versioned; bulk
generated evidence remains in the local artifact archive. The Git setup cleaned
five whitespace-only warnings; the previous 3,094-test result applies to the
same program behavior. The local forward source map is now
`artifacts/review/git-bootstrap-source-hashes.json`; its transition record
identifies every whitespace edit. The full-507 review remains active.

## User correction pass — 2026-09-11

The requested corrections are implemented: shark-fin teeth on 073/075, continuous overtravel and pawl drop with an ordinary swinging rod pin on 075, the complete default wheel on 076, and improved engagement with less take-up on 077. The user caught a second 075 defect in static contact selection; that version is explicitly superseded. Current evidence is in [the correction record](../artifacts/review/073-077-correction-notes.md). The broader spring reconstruction for 073 remains unresolved. The saved 081 study has since been integrated; see its review below. The full-507 goal is active.

## Changes made on 2026-09-09

- Removed scene fog entirely. Replaced the decorative ground disk/rings with
  a subtle shadow surface. Its height uses the sampled motion envelope and an
  ongoing guard against translated or deformed parts crossing the floor.
- Removed the camera-distance clamp that allowed visible geometry to cross
  the frame even when the camera fitter had calculated the necessary distance.
- Rebuilt all three shared bevel constructors (`makeBevelGear`, `makeMiterGear`,
  `makePitchBevelGear`) with conical heel/toe surfaces, outward winding, and
  separate normals at cap/flank edges. Teeth use a back-cone involute
  approximation; they are **not certified generated octoid tooth surfaces**.
  See the [KHK gear dimensions reference](https://khkgears.net/gear-knowledge/gear-technical-reference/calculation-gear-dimensions/).
- Removed the outward extrusion-bevel expansion of shared spur teeth. The
  chamfer now stays within the specified involute outline. Two old tests
  required overlap with solid rack backing or a pedestal; they now verify
  backing clearance and engagement with the projecting rack teeth instead.
- Measured world rotation and floor envelopes for all 507 models. Playback
  still aims for two seconds, with limits for sustained rotation and brief
  impulses. Tiny details are weighted by their size; deforming cable/spring
  frames and instantaneous marker resets do not set the shaft speed limit.
  These are **sampled display profiles**, not a comprehensive fidelity review.
- Movement 007: replaced outward-facing offset cones with an 18:22 bevel train
  sharing one apex. Added correct tooth phases, a real hollow sleeve, and
  clearance between the upright and horizontal shafts. Initial camera now
  resembles the source view. Belt shifting/slip and all contact phases still
  require the ongoing review.
- Movement 025: shortened the bevel faces to the engraving's proportions,
  shortened the shafts, added collars, and changed to a near-front source view.
- Expanded 506's camera envelope for the corrected tooth geometry.
- Replaced unsupported "mechanically reviewed" claims in the interface and
  README. Also removed the undefined `mechanicallyReviewed` reference that
  broke the About page.

## Evidence and limits

Screenshots are in [`artifacts/review`](../artifacts/review/). The `*-source-comparison.png`
files show the actual app beside its local engraving. These cover initial
poses of 001–012, 025, 043, 151, and 506; an image alone does not certify motion.
Geometry tests independently check closure, winding, conical ends, and hard
edges for shallow, miter, and steep bevels. Ground tests exercise translation
and deformed vertices past the initial envelope. Numerical model tests retain
their authored-time mechanism constraints; obsolete exact two-second playback
assertions now check readable timing instead.

Verification for this pass:

- `npm test`: 2,812 passed (`artifacts/review/unit-tests.log`).
- Full Playwright sweep: five tests passed, including all 507 WebGL
  constructions (`artifacts/review/browser-tests.log`).
- The subsequent camera change is additionally checked by projecting actual
  vertices through `MovementEngine.fitCamera` for all 507 initial models at
  three aspect ratios (`tests/camera-catalog.test.mjs`). Explicit author crops
  remain respected. The combined rendering test run is recorded in
  `artifacts/review/rendering-tests.log`.
- Initial screenshots for 004, 007, and 025 were refreshed after the camera
  correction; the About page was also opened successfully without page errors.

These checks verify construction, numerical invariants, and the specified
rendering properties. They do not certify full-cycle collision freedom or
source fidelity of every movement.

Regenerate display measurements after model edits:

```sh
npm run measure-display       # all 507
npm run measure-display -- 7  # only movement 007, preserving other entries
```

The reference image provided by the user is
`/home/danlu/.codex/attachments/2efd4dff-7593-43c6-a1ba-dbdec45a31bc/image-1.png`.
The authoritative engravings are stored in `public/engravings/`; source text
and page URLs are in `src/data/movements.json`.

## Confirmed next work

1. **Remaining ribbon mechanics:** 003 now has two separated guides aligned
   in elevation, and 011 has source-like quarter-turn leaves. Their smooth
   free ribbon shapes are geometric reconstructions, not solved elastic
   ribbon equilibrium. Further mechanical review should address this without
   reintroducing interpenetrating guides or detaching the band from the wraps.
2. **Slack and selector dynamics:** 005 now has a rigid pivot arm, finite
   idler contact, source-sized unequal pulleys, and a constant-length planar
   belt. Its slack buckle and transmission ramp are illustrative rather than
   a mass/friction/stiffness simulation. 007's shifting band now clears its
   pulleys, but its transition slip/torque is still approximated by engagement
   weights. Both mechanisms need that distinction retained during review.
3. **Other belt contact work:** 004's helical capstan winding still needs
   an axial-slip/friction review. 008 changes the installed step while
   stopped but does not simulate manual re-reeving over each shoulder.
   009–010 retain the small length variation of the opposed cone construction;
   their shifting/elastic tension is not a solved dynamic model. Flat bands
   have only been introduced for the reviewed opening drives; later band
   callers still need review. Round hoist ropes remain round.
4. **023 axial tracking:** proportions, suspension hardware, actual wheel
   clearance, and projected tangencies have been corrected. Two independently
   rotating sheaves at A remain a reconstruction choice for the same-side
   passing strands in the [source](https://507movements.com/mm_023.html), not
   an independently confirmed construction detail. The main drums retain
   helical axial crossovers and their free spans retain slight axial curves;
   their XY projections are now straight tangents. This still needs a physical
   tracking/friction or elastic-belt solution. Circumferential mismatch of the
   retained approximation is bounded in the new contact tests; do not call
   these helical contacts fully no-slip. The circular A contacts now follow
   material travel without slip. Source text allows omitted sliding guides.
5. **Other bevel assemblies, including 043 and 506:** audit every caller's
   pitch radius/axial-distance convention, shared apex, phase, and physical
   clearance. 043 now has shorter faces and separated shafts, but its exact
   shaft-angle interpretation and final source projection still need review.
   Do not restore shafts through their common apex to imitate a projected
   crossing in the engraving.
6. **173's self-intersecting spur:** the remaining known negative involute
   tip half-angle is in 173 (18 teeth, radius 0.4, tooth height 0.16). The
   flanks cross at the tips despite the `true-involute` label. It contacts a
   tappet; choose the source-specific tooth shape and verify actual engagement.
   The corresponding 029 defect is repaired by the spiral-generated wheel
   described below.
7. **Timing outliers:** review 099 (tiny guide roller still influences pacing),
   151 and 264 (large real reductions), and 305 (short escapement impulses).
   Long complete cycles may be appropriate for real reductions, but pacing
   still needs visual judgment and a useful way to inspect slow output stages.
8. **The remaining gear catalog:** continue with **035–507**, preserving
   the earlier open items and the full objective. Fine-pitch spur callers
   also need the oversized default chamfer reviewed; 024, 026 and 034 now opt
   into standard tooth proportions and a small chamfer. The numerical cuts
   used by 026 and 029 retain finite mesh clearance and prescribed rotation,
   rather than a loaded contact/deflection solution. No movement is being
   declared comprehensively certified by this pass. Old analytic contact
   metadata is not proof that rendered solids engage.

## Pulley and band pass

- `makePulley` now has an open annular rim, the requested number of radial
  spokes, and a tread at its declared radius. Solid drums remain available
  with `spokes: 0`. Decorative indexes sit at the faces/tread rather than
  projecting large blocks into a contacting belt.
- Added rectangular band geometry with separate running faces, closed seams,
  capped open ends, and quarter-turn width frames. Cone-drive bands follow
  different contact radii at their two edges. White travel markers are small
  stripes instead of oversized spheres. Factories that identified markers
  by `SphereGeometry` now use an explicit tag; their material-coordinate
  tests are retained.
- 001–002 have source-like pulley spacing, open four-spoke wheels, flat bands,
  and a near-front view. 003's two guides now align in elevation and have
  more than 0.25 units of clearance between their complete rendered bounds;
  its broad lower drum matches the source proportions. Free leaves preserve
  each entry tangent while distributing the axial skew between the guides
  and working pulleys. 004's guide/capstan proportions were improved, and its
  intermediate flanges no longer intersect the helical rope winding.
- 005's arm retains its rigid length through engagement. The idler contacts
  a finite circular wrap, and the larger driver/smaller driven pulley match
  the engraving. A planar slack buckle absorbs the excess belt length as
  the idler retracts; a numerical solve keeps the installed length constant.
  Its initial pose is engaged, and angular positions are seekable.
- 006 now has an open semicircular rim and two spokes, with belt ends attached
  at the lever. Two sector wraps exchange exactly the length paid out to the
  lower wheels. Material markers move once with that transfer. Crossover lift
  peaks at the actual projected intersection, providing room for both bands.
- Centered bands 001–002 and 005–006 on their treads. Tests against the actual
  toroidal flange surfaces caught and removed the previous axial edge
  interference; testing only the pitch radius had missed it.
- 007 now uses one broad upper drum and three unflanged lower selector
  pulleys. Its flat band can traverse the treads without passing through
  raised rims, and the shaft spacing now follows the source proportions.
- 008 now has four steps on vertically stacked horizontal shafts. The middle
  pair is solved against the full tangent-and-wrap belt length, so all four
  ratios accept the same belt. Removed the raised center rings that cut
  through the band. Angular positions use the integrated drive schedule and
  remain consistent when seeking; shifts occur at zero drive speed.
- 009–010 have source-oriented cones and flat bands. 010's curved profiles
  were reversed in the previous model and now bend in the source direction.
  Raised cone index tubes were replaced with surface marks.
- 011 now has a broad upper drum, source-like shaft spacing, a flat twisted
  belt, and a near-front view. Removed its unsupported overhead bar.
- 012 now has a suspension bracket, eye, and support connected to the sheave
  pin, a solid sheave face, a tied sack, longer source-like rope legs, and a
  near-front view. Its effort grip is schematic; the source's hand is omitted.
- Added an optional narrow camera field of view for the reviewed models to
  reduce perspective distortion while keeping orbit controls available.
- Camera fitting now includes each model's sampled full-motion bounds. An
  initial-vertex fit had cropped 006's raised handle and 012's descending
  load. Explicit authored viewing bounds remain respected and are fitted
  completely: the expanded test caught a later pose in 084 leaving the
  initial-only fit even though it was inside its authored viewing region.
- 043's toe diameter is now about three-fifths of its heel, and both shafts
  terminate before the shared virtual apex. Actual shaft surface points clear
  the other shaft. Its camera and sampled floor were updated.

Evidence for this pass:

- All 2,828 numerical tests passed in `pulley-pass-tests.log`. All five
  browser tests, including the full 507-model sweep, passed in
  `pulley-pass-browser-tests.log`. The production build passed in
  `pulley-pass-build.log`. These runs precede the separate 013–015 edits below.
- New geometry tests check closed band skins and normals, real pulley holes,
  flange clearance, separated guides, rigid tensioner motion, fixed-length
  stepped-belt selection, material travel, cone-edge contact, and 043's actual
  short tooth faces and separated shaft solids.
- All-507 camera checks now cover six motion phases at three aspect ratios.
  The opening twelve models and 043 additionally pass 38 phases with the
  camera held fixed (`pulley-camera-tests.log`, `pulley-motion-tests.log`).
- All 507 display profiles were regenerated after the shared changes; 043
  was regenerated again after its assembly edit. Default display cycles are
  approximately 4.69 seconds for 008, 4.21 for 009, and 3.42 for 010. Their
  fastest visible pulleys no longer have to complete the selector cycle in
  two seconds.
- `scripts/capture-review.mjs` produces actual-engine/source pairs. Images
  named `NNN-phase-X.png` cover 001–023 and 043. Multiple phases were captured
  for the opening twelve models. These comparisons are evidence of
  the specific improvements and remaining faults, not blanket approvals.
  The [comparison gallery](../artifacts/review/index.html) indexes these images.

```sh
node scripts/capture-review.mjs 6 8 43
REVIEW_PHASES=0,0.25,0.75 node scripts/capture-review.mjs 9 10
```

The script defaults to a Vite server on port 5174; override with `REVIEW_URL`.

## Hoist review: 013–015

- 013 now has the source's larger fixed wheel and smaller movable wheel,
  solid faces, a connected fixed suspension and rope anchor, a moving pin
  and hanger, a load hook, and a cylindrical weight. The hanger stays upright
  while the wheel rotates. Longer vertical spacing and a near-front camera
  bring the assembly closer to the engraving.
- 014 now has four enclosing cheek plates around each three-sheave block,
  two crosspieces, a short common pin, and upper/lower hooks. The lower hook
  carries the source's small round weight. Removed the unrelated overhead
  beam and the shelves that previously stood in for the block housings.
  Reordered the reeving and chose the final wrap tangent so the free effort
  leaf leaves outward without crossing a supporting strand.
- 015 was rebuilt with a fixed upper rope anchor, straight free spans,
  concentric grooved solids, attached hangers/hooks, and the source's downward
  hauling end. Removed the unsupported S-shaped rope bends, moving becket,
  overhead beam, and extra load. The U-shaped groove is cut into each solid;
  its wider mouth clears the rope's small fleet angle. Material groups replace
  overlapping toroidal rim decorations that caused mottled shading.
- **015 source discrepancy:** three moving sheaves with a fixed upper anchor
  provide six supporting rope parts, not seven. The reconstruction follows
  this topology and retains Brown's original wording with an explanatory note
  beside it. [White's own account](https://www.gutenberg.org/files/42951/42951-h/42951-h.htm)
  describes the fixed upper termination and equal rotation of proportional
  grooves. [Kater and Lardner](https://www.gutenberg.org/files/66078/66078-h/66078-h.htm)
  explicitly assign odd groove ratios to the lower block and even ratios to
  the upper block. The model now uses that assignment.
- Finite fleet angles make the ideal parallel-strand angular ratios an
  approximation in 014–015. Rope length is solved from the actual straight
  spans and wraps. In 015, independently differentiated material coordinates
  bound the retained contact-speed error below 3% of load speed at the tested
  phases. The model does not claim a fully solved elastic rope/contact model.

Focused checks pass in `artifacts/review/hoist-tests.log`: actual rope/groove
and rope/cheek clearance, nonintersecting rope strands, rigid load attachments,
and full-motion framing at three aspect ratios. The fixed-camera test now
covers 001–015 plus 043 at 38 phases. The existing 013–015 numerical constraints
also pass after replacing the obsolete 015 seven-part assumptions. Profiles
and three-phase source comparisons were regenerated for these models.

The two Spanish barton factory assignments were reversed. Movement **016**
now receives the nominal 4:1 arrangement: one rope embraces both moving
sheaves and the other joins their centers over the fixed sheave. Movement
**017** receives the nominal 5:1 arrangement: its hauling rope starts at the
lower becket and passes over the carrier, while the other rope runs from the
ceiling around the load sheave and fixed sheave to the carrier center. These
connections follow the [016](https://507movements.com/mm_016.html) and
[017](https://507movements.com/mm_017.html) engravings. Their factory periods,
display profiles, and regression cases were reassigned together. This fixed
the model selection; construction was addressed in the subsequent pass below.

Verification of the final hoist-pass state:

- Production build passed (`artifacts/review/hoist-build.log`).
- All 2,834 numerical tests passed (`artifacts/review/hoist-full-tests.log`).
- All five browser tests passed, including the full 507-model WebGL sweep
  (`artifacts/review/hoist-browser-tests.log`). Movement 015's correction note
  was also opened in the production build without page errors; see
  `artifacts/review/015-app-correction.png`.
- Refreshed 013–017 comparisons include phases 0, 0.25, and 0.75. The
  gallery now indexes 62 images, including the earlier opening-drive review.
- A separate read-only 13-phase probe of 016–023 recorded actual torus/rope
  penetration of approximately 0.023, 0.021, and 0.022 units in 016, 017, and
  018 respectively (`artifacts/review/hoist-next-clearance.json`). These were
  open defects at that checkpoint and are addressed below. Positive gaps
  for 019–023 in this particular check do not
  establish clearance from spokes, hubs, shafts, housings, or other ropes.

## Hoist assembly pass: 016–022

- Rebuilt 016 and 017 with solid sheaves centered on their actual rope planes,
  short pins, rigid front/rear stirrups, attached eyes and hooks, and round
  loads. In 016 the fixed sheave and secondary rope share the forward plane;
  in 017 the carrier and its hauling rope share it. Brackets reach outboard
  attachment points above the wheels. The previous flange penetrations are
  removed without putting the terminating rope through a rotating drum.
- Rebuilt 018 with an actual link carrying its second fixed sheave, a compact
  upper becket on the moving block, and one planar rope. The previously
  unsupported cubic terminal is now a straight tangent. The second fixed
  sheave is smaller and offset left so its return strand clears the long
  right-hand supporting strand. Shortened the load hook and kept its crossbar
  below the running rope through the entire motion.
- Rebuilt 019–021's load-anchored cascades with solid wheels, short axles,
  proper stirrups, and wide cylindrical loads. In 019 the three small sheaves
  have individual hooks attached to load eyes. In 020–021 the rope eyes are
  attached directly to the load. Removed the suspended decorative crossbars,
  long axle stubs, and unrelated narrow bell-shaped weights.
- Rebuilt 022's ceiling-anchored cascade with actual ceiling eyes, lower
  carrier eyes, a fixed guide hanger, and a hook carrying the round load.
  Its three working ropes retain the exact ideal 8:1 vertical travel law.
- All seven models use near-frontal source views. The hauling ends in
  017–021 leave on the engraving's outward tangent, with constant installed
  rope lengths. Ratios 5:1, 3:1, 26:1, 7:1, and 3:1 are retained as nominal
  values; vertical force components and input work use the actual angled
  rope directions. Movement 016 retains its exact 4:1 arrangement.
- Shared circular rope contacts now use exact arc lengths. Wheel angles
  follow material distance from each tied rope origin, including moving
  terminations. Independent finite differences of rendered wheel points and
  fixed rope material coordinates agree within 2e-6 in the no-slip tests.
  The old imposed integer angular approximation for 017's carrier is gone.

These remain prescribed kinematic reconstructions with ideal massless ropes
and sheaves. They do not simulate lateral swinging, elastic rope stretch,
friction, or a free-body transient. The force checks concern vertical motion
and virtual work; they are not proof of unrestricted 3D static equilibrium.

Verification includes actual rope mesh vertices against every sheave drum,
flange, and stirrup bar over 32 poses; distinct rope strands over 17 poses;
material contact velocities; and force/work consistency derived independently
from the rendered paths. The fixed-camera test now covers 001–022 plus 043 at
38 phases and three aspect ratios. Display profiles and three-phase source
comparisons for 016–022 were regenerated. The gallery indexes 74 images,
including the still-unfixed 023 for the next pass.

Final verification for this pass:

- Production build passed (`artifacts/review/cascade-build.log`).
- All 2,859 numerical tests passed (`artifacts/review/cascade-full-tests.log`).
- All five browser tests passed, including all 507 WebGL constructions,
  mobile layout, and hosting beneath a subdirectory
  (`artifacts/review/cascade-browser-tests.log`).
- Dense fixed-camera projection passed for the expanded opening range
  (`artifacts/review/cascade-camera-tests.log`).
- The high-resolution original scan and printed page 12 are now available
  under `artifacts/reference/`, with source and regeneration instructions.
  They will help resolve the remaining 023 belt-routing interpretation.

## Movable belt and opening gear pass: 023, 024, 027, 028

- **023:** matched the engraving's larger horizontal separation, smaller
  movable wheel, short pins, solid sheaves, guide-pulley spacing, and small
  cylindrical counterweight. Removed the unrelated overhead bar and replaced
  the offset floating suspension link with a connected rigid stirrup and eye.
  Removed the intermediate drum flanges from the axial crossover tracks.
- Replaced 023's prescribed 80/110/20-degree contact angles with circle
  tangents recalculated from the moving centers. The outside spans use
  external tangents; the returning spans use internal tangents. This removes
  the visible XY bowing and the approximately 0.005-unit driver-drum
  penetration detected after the proportion change. Actual belt and rope
  meshes now clear all six sheave bodies and their flanges in 32 sampled poses.
- Wheel rotation in 023 now accounts for changing material distance to each
  wrap and for movement of its tangent point. Independently sampled circular
  idler contacts agree with their rope material velocities within 2e-6.
  The two helical wraps explicitly retain axial sliding; their changing pitch
  keeps a small circumferential mismatch, bounded below 0.1% of belt speed at
  three locations on each wrap and six tested times. This is a bounded
  reconstruction approximation, not a solved axial friction model.
- **024:** corrected the initial tooth phases. The old speed ratio was
  correct, but a 41-pose tooth-pitch sweep counted 2,204 outline vertices
  inside the mating gear, with as many as 56 per pose. The corrected phase
  removes that overlap. The final gears use 20-degree involutes, addendum
  equal to one module, dedendum equal to 1.25 modules, and a 0.008-unit
  chamfer. This removes the pointed appearance from the old excessive
  tooth height and chamfer. `makeGear` now accepts these optional dimensions;
  other callers retain their existing defaults.
- 024 also has shorter shafts, a near-frontal view, and source-sized inset
  face rings. The rings are flush decals with depth bias rather than partially
  buried toruses. Independent outline tests require both no penetration and
  a flank gap below 0.0015 over a complete tooth pitch, so merely separating
  the wheels cannot pass the test.
- **027:** replaced painted stripes with open radial channels between raised
  sector webs and recessed triangular pockets. Rollers now sit inside the
  channels, behind the carrier plate; their oversized flanges are removed.
  Added pins and moved the rear hub/shaft behind the groove floor so a roller
  can pass through the center without striking them. The exact ideal slot
  width equals the roller diameter. Ray casts hit the actual driving wall at
  the roller radius; mesh vertices clear the walls and floor through 48 poses.
- 027 now reports a roller as disengaged while it crosses the central opening.
  The other two rollers maintain the half-speed constraint. The roller's
  free spin during this passage remains prescribed rather than inertially
  simulated. This is an ideal zero-clearance kinematic mechanism.
- **028:** removed the pulley flanges that penetrated the friction disk by
  approximately 0.0347 units. The upper wheel is now a solid crowned roller;
  its slight crown gives one central contact rather than demanding equal
  rolling speeds across a finite disk-radius interval. Removed the raised
  disk rim, replaced the lower hub with the source's tapered underside, and
  shortened the shafts. The upper shaft follows the adjusting wheel. Actual
  vertices clear the disk through 80 drive/adjustment poses and reach the
  intended contact level within the mesh sampling tolerance.

Profiles and three-phase comparisons were regenerated for the four changed
models. Fixed-camera testing now additionally covers 023, 024, 027, and 028
at 38 phases and three aspect ratios. The gallery indexes 86 images; the new
initial 026 and 029 images document unresolved assemblies, not completed fixes.

Verification for this pass:

- Production build passed (`artifacts/review/drive-gear-build.log`).
- All 2,864 numerical tests passed (`artifacts/review/drive-gear-full-tests.log`).
- Focused physical geometry/material-motion checks passed
  (`artifacts/review/drive-gear-contact-tests.log`).
- All five browser tests passed, including all 507 WebGL constructions,
  mobile layout, and static hosting beneath a subdirectory
  (`artifacts/review/drive-gear-browser-tests.log`).

## Crown and spiral drive pass: 026 and 029

- **026:** a 41-pose sweep of the old assembly found 3,749 actual spur-mesh
  vertices inside the crown's block teeth, with up to 107 per pose. Correcting
  its phase alone still left 1,806 intruding vertices. Replaced those blocks
  with a sampled surface generated by the mating 20-degree involute pinion,
  using its actual unchamfered outline and the 28:36 rotation relation.
  The pinion now uses module 0.075, standard addendum/dedendum proportions,
  and a 0.008 chamfer. Both shafts are shorter and the default view follows
  the near-frontal [source engraving](https://507movements.com/mm_026.html).
- The crown cut varies across its radial face width, including relief of the
  inner edge; it is not a radial extrusion of one rack section. Conservative
  resampling keeps triangle interpolation on the removed-material side.
  Independent tests query the rendered triangles, actual pinion bevel/cap
  vertices, subdivided flanks at three axial stations, and the crown surface
  in reverse. They require no sampled penetration and a flank gap below
  0.003 units through the tooth cycle. This is a numerical generating
  approximation with clearance, not a manufacturing or loaded-contact model.
  The generating approach follows the envelope principle described in NASA's
  [Handbook on Face Gear Drives with a Spur Involute Pinion](https://ntrs.nasa.gov/archive/nasa/casi.ntrs.nasa.gov/20000027536.pdf).
- **029:** removed the self-crossing 18-tooth outline and corrected the
  rotation direction. With the depicted outward-winding spiral rotating
  about +Z, its intersection with the right-hand wheel moves inward; the
  driven wheel must rotate about +Y for its bottom pitch point to move in
  that direction. The former negative ratio moved that point outward.
- The new driven wheel is smaller and has short teeth cut by the swept round
  spiral, including both endpoint caps. Its sections vary across its width;
  this special drive uses a generated thread-mating profile rather than
  claiming that the old invalid extrusion was an involute. The round thread
  section is a reconstruction choice: the [source](https://507movements.com/mm_029.html)
  specifies one tooth of advance per disk revolution but does not supply a
  manufacturing profile. The one-tooth advance is preserved.
- 029's wheel now straddles the raised thread while its real tips stay more
  than 0.028 units above the disk face. Its vertical shaft extends farther
  below the wheel, matching the engraving; removed the extra outer face
  ring, enlarged the central hub, and placed the spiral opening at the top
  in the initial view. The spiral centerline is now exactly Archimedean.
- A 69-pose test includes phases immediately around the open-end handoff.
  It checks actual thread vertices against rendered wheel triangles, checks
  wheel vertices against the continuous round thread, and ray-casts from
  the wheel to the rendered thread surface. Each pose has no sampled solid
  penetration and an actual surface gap below 0.004 units. Motion remains
  prescribed with finite clearance; backlash take-up, compliance and contact
  forces are not dynamically solved.
- Generated cutting tables are saved in `src/data/contact-profiles.js`;
  `node scripts/bake-contact-profiles.mjs` regenerates them from the current
  model parameters. The mathematical generators remain available and run
  automatically when the parameter keys differ. Run the baking script after
  changing a generating algorithm as well. On this machine, saved cuts reduced
  cold model construction to about 40–45 ms, from roughly 0.7 seconds for the
  crown cut and 2.2 seconds for the spiral cut.
- Both changed models retain a two-second input cycle at default playback.
  Their three-phase source comparisons are refreshed, and fixed-camera
  testing now includes both at 38 phases and three aspect ratios. All phase
  images for 001–029 and 043 were recaptured after the bounds change.
  The gallery now indexes 115 images, including initial review captures for
  030–036. Those seven assemblies are not yet repaired by this pass.

### Precise motion bounds

The render comparison exposed another common framing error: rotating a disk's
local bounding square expands its world bounds by up to sqrt(2), even though
the disk itself keeps the same diameter. Display measurement now uses actual
vertices, and all 507 profiles have been regenerated. The initial camera and
ground bounds also use actual vertices. The runtime floor guard first checks
inexpensive part bounds, then scans vertices only when a part's box appears
to cross the floor; empty box corners can no longer lower the ground during
rotation. Translation and deformation still trigger the existing guard.
A new full-turn wheel regression covers this case.
The recalculation tightens 346 motion bounds; measured sustained playback
speeds are unchanged. For example, the old rotating-box estimate placed 217
and 218's floor envelopes about 1.78 units below their actual sampled geometry.

Initial observations at that checkpoint (030, 032 and 034 are addressed in
the following pass):

- 030, 032, 034 and 035 need near-frontal projections and closer source
  proportions. 030/033/035's discrete noncircular teeth still require actual
  flank-interference sweeps; correct pitch-curve metadata alone is insufficient.
- 031 depicts the worm as a thick round coil around a shaft. The engraving
  shows a screw thread; inspect the thread section and real wheel engagement.
- 033's current focus-mounted ellipses have a markedly different axle
  placement from the engraving's apparently centered holes. Resolve this
  interpretation before changing its kinematics; simply centering two exact
  ellipses is not a verified conjugate construction.
- 034 still uses the old block-toothed ring; investigate migration to the
  existing continuous internal-involute primitive and test the actual mesh.
- A preliminary 41-pose midplane screening projects mesh vertices into the
  other member's tooth rectangles. It found 2,596 hits for 030 (up to 68 per
  pose), 3,757 for 033 (up to 146), and 4,139 for 034 (up to 103). These are
  projected screening counts, not finalized 3D collision tests; use them to
  guide the next contact audit. Do not use only end-cap vertices for the 3D
  check: coplanar faces or different gear widths can hide axial overlap from
  a strict vertex-inside-solid test.
- 036's raised round guide rails need checking against the source's guiding
  groove and pinion-shaft constraint, including the transition at both ends.

Final verification after the bounds change:

- Production build passed (`artifacts/review/face-spiral-build.log`).
- All 2,867 numerical tests passed, including the catalog camera checks
  (`artifacts/review/face-spiral-full-tests.log`).
- The two detailed contact tests passed
  (`artifacts/review/face-spiral-contact-tests.log`).
- Focused engine and dense opening-camera checks passed
  (`artifacts/review/face-spiral-camera-tests.log`).
- All five browser tests passed, including construction and rendering of
  all 507 movements, mobile layout, and static subdirectory hosting
  (`artifacts/review/face-spiral-browser-tests.log`).
- All 507 display profiles were regenerated
  (`artifacts/review/precise-display-measurements.log`). The opening comparison
  captures and the separate 030–036 baseline captures completed without page
  errors (`precise-opening-captures.log`, `next-gear-captures.log`).

## Noncircular, friction and internal gear pass: 030, 032 and 034

- **030:** replaced discrete rectangular teeth with a continuous outline cut
  by a rolling straight-flanked rack. The generator removes the rack's swept
  volume from an offset convex blank, including root relief, and uses a
  20-degree pressure angle. A circular benchmark independently checks the
  resulting working flanks against standard involutes. The method follows
  the generating principle described by Bäsel in
  [Determining the geometry of noncircular gears for given transmission function](https://arxiv.org/abs/1905.02642).
- The existing conjugate pitch curves and variable-speed law are retained.
  Their convex rounded corners approximate the rectangular forms in the
  [engraving](https://507movements.com/mm_030.html); neither the exact curves
  nor the selected 48 teeth per wheel are specified by that source. Larger
  hubs, shorter shafts, inset face lines and a near-frontal camera improve
  the source projection. This is not an exact tracing of the engraving.
- A 192-pose full-cycle check queries both rendered extrusion outlines and
  requires no sampled penetration and a contact gap below 0.0025 units.
  Actual chamfer and cap vertices remain within those outlines, allowing
  only Float32 rounding tolerance. The cut includes small finite backlash
  and radial clearance; motion remains prescribed rather than force-driven.
  The new generator supports convex pitch curves and was initially enabled
  only for 030; 033 adopts it in the following pass. Other noncircular callers
  still require individual review.
- **032:** the official animation supplies radii 5 and 8, hub radii 1.5 and
  shaft radii 1. The reconstruction now uses those proportions and the exact
  opposite 5:8 rotation ratio. Both wheels have shorter shafts, thinner
  bodies and a near-frontal camera. Increasing the tread tessellation reduces
  visible faceting and the discretization gap at rolling contact.
  A 48-pose test checks actual wheel vertices against the mating cylinder
  and ray-casts the rendered treads, requiring a surface gap below 0.0005.
  The ideal rolling law does not simulate friction or slip under load.
- **034:** the official animation establishes a 50-tooth ring, 20-tooth
  pinion and 2:5 rotation ratio. These replace the previous 42:18 choice.
  The ring is now a continuous internal involute extrusion; the pinion uses
  matching module 0.06 and standard addendum/dedendum proportions. Corrected
  the initial tooth/gap phase, enlarged the hub to the source proportions,
  shortened the shaft and adopted a near-frontal camera.
- Corrected the internal-gear primitive's bevel offset so the chamfer stays
  within its specified material outline. Added optional chamfer and backlash
  parameters; 034 uses a 0.006 chamfer and 0.0006 tangential backlash.
  The small backlash accommodates the sampled flank interpolation rather
  than separating the nominal pitch circles. A 41-pose tooth-cycle test
  checks both mating outlines and actual chamfer/cap vertices, with no
  sampled penetration and a flank gap below 0.0015 units. The shared
  primitive also affects 329, 412 and 505; their display profiles were
  regenerated, but their complete assemblies remain pending review.

The official 032 and 034 page snapshots and extracted dimensions are recorded
in [`artifacts/reference/README.md`](../artifacts/reference/README.md).
Three-phase comparisons for 030, 032 and 034 were refreshed. The gallery still
contains 115 images. Dense fixed-camera testing now includes these three
models at 38 phases and three aspect ratios.

Verification for this pass:

- Production build passed (`artifacts/review/noncircular-internal-build.log`).
- All 2,871 numerical tests passed
  (`artifacts/review/noncircular-internal-full-tests.log`).
- All seven focused physical-contact tests passed
  (`artifacts/review/noncircular-internal-contact-tests.log`).
- Dense fixed-camera projection passed
  (`artifacts/review/noncircular-internal-camera-tests.log`).
- All five browser tests passed, including all 507 WebGL constructions,
  mobile layout and static subdirectory hosting
  (`artifacts/review/noncircular-internal-browser-tests.log`).

At that checkpoint, the next unresolved opening models were 031, 033, 035 and
036. The following pass addresses 031 and 033. The earlier open items and the
rest of the 507-movement catalog remain part of the active review.

## Worm and centered oval pass: 031 and 033

- **031:** replaced the detached round coil with one closed screw surface:
  straight axial flanks, flat crests, an integral root cylinder and planar
  end caps. Separate flank/crest normals retain the sharp edges without
  faceting the circular surfaces. This is a Type-I axial trapezoid, one of
  the worm profiles described in the
  [KHK technical reference](https://khkgears.net/gear-knowledge/gear-technical-reference/calculation-gear-dimensions/).
  The [source](https://507movements.com/mm_031.html) does not identify an exact
  manufactured profile; the 20-degree axial pressure angle is a reconstruction
  choice, not a recovered dimension from the engraving.
- Replaced 031's ordinary extruded wheel with a wheel generated by the
  synchronized screw sweep. The cutting hob has a quarter-module crest
  extension for root clearance. Its sampled surface varies across the wheel's
  width and includes the throat and skewed flanks. The generating cut uses
  1,200 poses and conservative neighboring samples to keep the triangle
  interpolation on the removed-material side. Clearance is finite; this
  remains prescribed kinematics rather than a loaded contact solver.
- Retained 30 wheel teeth and one tooth of advance per screw revolution.
  The worm is smaller, has 3.5 turns, and carries a shorter shaft. The wheel
  is thinner, with a source-sized hub and short shaft. Removed the unrelated
  large inset ring and switched to a near-frontal default view. Those chosen
  proportions approximate the engraving; the website provides no animation
  geometry for this movement.
- A manifold/winding test verifies the closed screw and its axial profile.
  A 65-pose contact test queries screw vertices, triangle centers and edge
  midpoints against actual wheel triangles. In reverse, wheel vertices and
  flank triangle centers clear the continuous screw surface. Ray casts to
  actual screw flanks require a contact gap below 0.004 units at every pose.
  The test selects the finite working flank, not its extrapolation above
  the crest, when choosing the contact normal.
- The worm cutting table is saved alongside 026 and 029 in
  `src/data/contact-profiles.js`. `node scripts/bake-contact-profiles.mjs`
  regenerates all three. Cold 031 construction is now about 0.1 seconds on
  this machine, compared with roughly three seconds when generating the cut.
- **033:** replaced focus-mounted true ellipses with centered second-order
  elliptical gears, matching the axle locations in the
  [engraving](https://507movements.com/mm_033.html). This interpretation follows
  the conjugate oval family described by
  [Vanegas-Useche et al., section 3](https://revistas.unal.edu.co/index.php/dyna/article/view/49170).
  Their pitch radius is `2ab / ((a+b) - (a-b) cos(2θ))`, with fixed center
  distance `a+b`. These are centered ovals, not exact geometric ellipses;
  the application now explains that distinction.
- 033 uses maximum/minimum pitch radii 1.2 and 0.72, a 1.92 center distance,
  and 32 teeth per wheel. The dimensions follow the drawing's proportions;
  they are not specified numerical source data. The resulting input/output
  speed-ratio magnitude ranges from 0.6 to 5/3, twice per revolution. This
  removes the previous focus-mounted pair's greater-than-40-fold variation.
  Integrated angles preserve exact ideal rolling and seekable motion.
- Replaced both sets of rectangular teeth with the rolling-rack generator
  introduced for 030. Uniform pitch-curve sampling gives both identical
  ovals equal tooth pitch. The 192-pose actual-outline test requires no
  sampled interference and a flank gap below 0.0025. Chamfer/cap vertices
  stay inside their cut outlines. Shafts are shorter, the gear faces have
  inset lines, and the default view is near-frontal.

Both models have refreshed display profiles and three-phase source comparisons.
Their default input cycles are two seconds; 031's full wheel revolution takes
30 input turns, preserving its genuine reduction. Fixed-camera checks include
both models at 38 phases and three aspect ratios. The original scan's printed
page 14 and the two website page snapshots are retained under
[`artifacts/reference`](../artifacts/reference/). Eighteen new baseline images
for 037–042 bring the comparison gallery to 133 images; those six models
have not been repaired by this pass.

Verification for this pass:

- Production build passed (`artifacts/review/worm-oval-build.log`).
- Five focused contact/geometry tests passed
  (`artifacts/review/worm-oval-contact-tests.log`).
- Dense fixed-camera projection passed
  (`artifacts/review/worm-oval-camera-tests.log`).
- All 2,874 numerical tests passed
  (`artifacts/review/worm-oval-full-tests.log`).
- All five browser tests passed, including all 507 WebGL constructions,
  mobile layout and static subdirectory hosting
  (`artifacts/review/worm-oval-browser-tests.log`).
- 033's interpretation note was also opened in the production build without
  page errors (`artifacts/review/033-app-interpretation.png`).

## Sliding elliptical pinion and mangle-wheel pass (035–036)

- **035:** kept the fixed true ellipse, uniform circular pinion and rotating
  slotted carrier from the [source](https://507movements.com/mm_035.html).
  Replaced both sets of block teeth with 20-degree rolling-rack cuts, including
  the 12-tooth pinion's undercut roots. The 192-pose contact check requires
  no sampled tooth interference and a working gap below 0.0025.
- Replaced the carriage that penetrated both rails with a bored sliding
  tongue and a separate retaining flange. Actual mesh/raycast checks require
  0.005 clearance at each slot wall, 0.025 between flange and rail faces,
  and open bores around both rotating shafts. The old overlap measurement
  remains in `artifacts/review/035-carriage-baseline.json`.
- Reconstructed the inward-pulling tension spring, including its attachment
  posts. Its changing helix radius preserves wire length as the carriage
  travels. Checks cover 33 carrier poses, shaft and flange clearance, positive
  spring extension and an inward force direction. The mechanism still uses
  prescribed ideal kinematics, rather than a spring-force/contact solver.
- **036:** corrected the working side of the
  [mangle-wheel](https://507movements.com/mm_036.html). The pinion runs outside
  the outer tooth edge, inside the inner edge, and around both convex ends.
  A real closed groove surrounds the raised C-shaped tooth strip. This
  replaces the former facing tooth rows and raised round guide rails.
- Generated the strip by subtracting the synchronized, rack-cut circular
  pinion along its complete path. Both circular runs and both reversals share
  one tooth pitch. There are 88 strip teeth and 12 pinion teeth; these counts
  and dimensions are a conjugate reconstruction of the undimensioned drawing,
  not numerical specifications published by Brown.
- The 256-pose actual-outline check finds no sampled interference and a
  maximum working gap of 0.001691 units. Actual cap/chamfer vertices stay
  within the cut outline. The generator samples the entire closed contour,
  including nonadjacent parts near the opening. Its saved cutting table is
  regenerated with the crown, spiral and worm tables by
  `node scripts/bake-contact-profiles.mjs`.
- The guide pin sits in a recessed groove with 0.008 nominal side clearance
  and 0.035 clearance above its floor. The upright slot leaves 0.006 around
  the main shaft. Raycasts check both actual groove walls through 96 poses.
  Shortened the pinion hub to clear the disk face, joined the raised strip
  to the face, and separated the stationary bar from the rotating pinion.
- Both models now use near-frontal source views and short shafts. 036 starts
  with its opening at the left. Its lighter tooth-strip finish makes both
  toothed edges readable. Three-phase comparisons for both models and two
  additional 036 reversal views are in the 135-image review gallery.
- Added both models to the fixed-camera test at 38 phases and three aspect
  ratios. Removed 036's obsolete hard-coded cycle duration, so display bounds
  are measured over its actual complete motion. At default speed, their
  pinions turn once per second; a complete 035 carrier circuit takes 4⅓ seconds
  and a complete 036 forward/reverse cycle takes 8⅓ seconds.

Verification against the final cycle-duration correction:

- Production build passed (`artifacts/review/sliding-mangle-build.log`).
- All 2,878 numerical tests passed, including both new contact suites and
  the expanded fixed-camera checks
  (`artifacts/review/sliding-mangle-full-tests.log`).
- All five browser tests passed, including all 507 WebGL constructions,
  mobile layout and static subdirectory hosting
  (`artifacts/review/sliding-mangle-browser-tests.log`).
- The source comparisons and extra reversal views rendered without page
  errors (`artifacts/review/mangle-captures.log` and
  `artifacts/review/mangle-reversal-captures.log`).

The original 037 baseline had actual mesh vertices and triangle interiors
penetrating the opposite frustum: long teeth by up to 0.1036 and studs by up to 0.2255 units
in a 96-pose baseline. These depths greatly exceed polygonal tessellation
error. See `artifacts/review/037-body-interference-baseline.json`. The
[official 037 page](https://507movements.com/mm_037.html), saved under
`artifacts/reference/mm_037.html`, has no source animation. Its spiral stud
layout and tooth law need checking alongside the body clearances and view.
An older related construction appears in Lanz and Betancourt's
[Analytical Essay, printed page 85 and figure L8 on plate 6](https://archive.org/details/b22009851/page/85/mode/1up).
The saved plate includes a plan as well as an elevation. It shows a spiral
running from one axial end to the other, with adjacent end teeth at different
heights; it does not support the former model's sinusoidal rise-and-fall
layout. The text also calls for tooth shapes matched to their respective
pinion sections. This is supporting evidence for the partial reconstruction below,
not a claim that Brown supplied a detailed tooth law or reset dynamics.
The shared `makeScrew` coil primitive remains unchanged for its later callers;
each still needs source/contact review.

The 037–042 baseline captures expose additional concrete work:

- 037's camera and shaft proportions differ from the engraving. The opposed
  cone bodies meet at their pitch surfaces; check their protruding teeth
  and studs against actual body volumes, not only contact-radius metadata.
- 038 substitutes a shallow continuous contour for the source's strongly
  stepped circular sectors and straight connecting edges. Its hidden center
  link, block teeth and motion law need a source-specific reconstruction.
- 039 needs the flywheel's broad rim/spokes, hub proportions, short shafts,
  source view and actual gear engagement reviewed. Its current flywheel
  reads as a thin separate hoop.
- 040–042 share `makeContinuousHelicalGear`, whose teeth use four-point radial
  sections rather than involute flanks. The smoothed prism edges appear
  rounded, and the source's thin edge-on views are not reproduced. Audit
  transverse/normal pitch, helix angles and real clearance before changing
  only the camera. 042 additionally needs its shaft-angle interpretation
  and unequal-wheel proportions checked.

## Partial repair of 037; engagement remains unresolved

- Replaced the original long block teeth with straight conical surfaces whose
  transverse profiles are 20-degree rack-generated involutes. The experimental
  stud-cut driver, which produced horizontal ridges, was discarded. The current
  pinion has continuous generators and separate cap/flank normals.
- Replaced the sinusoidal stud row with an end-to-end spiral and shortened the
  shafts. Removed decorative rim rings, indicators, contact marker and base
  rail. The near-frontal view and tapered silhouettes now follow the source
  more closely. The selected 12 pinion teeth, 10 studs and dimensions are a
  reconstruction; Brown does not supply manufacturing dimensions or counts.
- Relieved the stud cone below the maximum pinion tip envelope. Individual stud
  blanks are cut against the moving pinion, preserving its full conical teeth.
  The resulting caps are cached in `src/data/conical-stud-profile.js`; regenerate
  with `node scripts/bake-conical-stud-profile.mjs`. Both the factory and baker
  use one parameter object. A parameter mismatch falls back to generation.
- The 128-pose actual-vertex and triangle-interior check finds minimum sampled
  stud/tooth clearance of **0.000382** and tooth/body clearance of **0.016003**.
  These address the old solid-body penetrations; they do not prove engagement.
- A separate 256-pose point-to-actual-triangle distance check finds a maximum
  sampled working gap of **0.177659** near the spiral seam. The radial-distance
  test alone overstated some gaps near steep flanks, but this 3D check confirms
  that the handoff remains unresolved. Evidence is saved in
  `artifacts/review/conical-stud-euclidean-contact.json`. Reproduce this known
  engagement failure with `node scripts/probe-conical-stud-contact.mjs`
  (expected exit status 1 while 037 remains unfinished).
- **037 is not mechanically verified.** Its nominal motion integrates adjacent
  pitch ratios and closes after every stud has passed. This remains prescribed
  animation. Stud spacing, matching faces and the end-to-end handoff need to be
  solved together; the long exposed studs also need further source comparison.
  The app's note and `contactValidation` metadata make this limitation explicit.
  Legacy tests that merely equated two virtual pitch velocities were removed.
- Re-measured display bounds and speeds after the final geometry and source
  phase changes. The full output turn takes two seconds at default speed.
  Fixed-camera tests cover 38 poses at three aspect ratios. All three 037 source
  comparisons in the 135-image gallery now show this same reconstruction.
- Production build and all **2,879 numerical tests passed** in
  `artifacts/review/conical-stud-full-tests.log`. All **five browser tests passed**,
  including all 507 WebGL constructions, mobile layout and subdirectory hosting
  (`artifacts/review/conical-stud-browser-tests.log`). The separate engagement
  diagnostic above still fails; passing regression tests do not complete 037.

## Rebuilt 038: three stepped gear ratios

- Replaced the shallow smooth pitch curves with the source's three concentric
  sectors and radial boundaries. The official animation specifies successive
  ratios of **-3, -1 and -1/3**, with changes at input fractions 1/12 and 3/4.
  At center distance 2.8, the mating pitch radii are 2.1:0.7, 1.4:1.4 and
  0.7:2.1. Radial joints on the front faces reproduce the visible construction
  lines. The source remains `artifacts/reference/mm_038.html` and
  `mm_038-animation-data.json`.
- Generated all circular sectors with a common 20-degree rack and module
  2.8/24, using the 12-, 24- and 36-tooth parent circles. Simply connecting the
  arcs with radial faces caused interference at the transitions. The driven
  boundaries are now relieved against the actual moving driver through 9,216
  poses, with 9,216 angular cutting rays.
- Saved the driven cut alongside the crown, spiral, worm and mangle cuts in
  `src/data/contact-profiles.js`. `node scripts/bake-contact-profiles.mjs` now
  regenerates all five, and was run against the final motion correction.
- A 532-pose bidirectional check samples the actual outlines, including points
  along the long radial edges and both sides of every speed change. It finds
  no sampled penetration and a maximum working gap of **0.002858** units.
  Rendered bevel vertices also stay inside the checked outline. This required
  constraining small Three.js bevel-miter overshoots at sharp generated corners.
- Replaced the hidden center link with the visible fixed link and bored end
  collars, and shortened both shafts. Checks through 33 poses find more than
  0.0059 clearance in the actual bores, 0.005 between collars and rotating hubs,
  and 0.064 between the link and gear faces.
- The output positions now match all four source keyframes and remain
  continuous across cycle boundaries. Fixed a floating-point wrap that could
  incorrectly report zero output after a full revolution. The source's speed
  steps are retained; this is ideal kinematics without an impact/inertia model.
- Re-measured motion bounds and speeds and added 038 to the 38-pose camera test
  at three aspect ratios. A complete cycle takes two seconds at default speed;
  peak output speed is 1.5 turns per second during the short first sector.
  The four final source comparisons, including all three ratio-change poses,
  are in the **136-image** review gallery.
- Production build and all **2,881 numerical tests passed** in
  `artifacts/review/stepped-sector-full-tests.log`. Contact and hardware details
  are in `stepped-sector-contact-tests.log`, with maximum gap 0.002858.
  All **five browser tests passed**, including every one of the 507 WebGL
  constructions, mobile layout and subdirectory hosting
  (`stepped-sector-browser-tests.log`).

## Rebuilt 039: Watt's sun-and-planet motion

- Corrected the equal 24-tooth involute gears' indexing. The baseline entered
  its mate by up to **0.044202** units; the repaired actual outlines have no
  sampled penetration through 192 poses, with a maximum working gap of
  **0.0001591**. The test also checks the rendered chamfers.
- Reconstructed a finite rod three carrier lengths long, using the official
  animation's length ratio. Its unseen upper joint follows a vertical guide
  above the starting planet. This guide placement is an explicit reconstruction
  choice: it reproduces the engraving's right-hand planet and upright cropped
  rod, while the official animation puts its guide over the sun. The app
  explains this choice. The visible rod stays a fixed length and rocks with
  the planet; it does not telescope.
- The sun turns through twice the carrier angle minus the rod's rocking angle.
  Tests verify the full rod length, vertical upper guide, actual rendered rod
  direction, rigid attachment to the planet, instantaneous angular speeds and
  two complete sun turns per orbit.
- Replaced the round flywheel rim and crossed bars with a single broad rim,
  four tapered spokes and four real openings. Added the source's gear flanges,
  wide bored carrier, rod attachment boss and shorter shafts. Removed the rail
  and set a nearly frontal source view.
- Through 65 poses, the actual carrier bores provide over 0.0059 radial shaft
  clearance. The carrier clears the rod by 0.03 and its attachment boss by
  0.01; the planet and rear shaft clear the flywheel by over 0.0169.
- Re-measured the display profile. An orbit takes **2.2531 seconds** at default
  speed, keeping the sun's sustained visible speed within the shared limit.
  Fixed-camera tests include 38 poses at three aspect ratios. Four final
  screenshots are linked in the **137-image** gallery.
- Build and all **2,883 numerical tests passed**. The final contact/hardware
  tests passed again after the rendering experiments. All five browser tests passed, including every 507 WebGL construction,
  mobile layout and subdirectory hosting (sun-planet-browser-tests.log).
- **A small rendering issue remains open:** fine marks occur on the carrier
  face at some poses. Disabling its shadows, welding vertices, rebuilding its
  outline and replacing its triangulation did not reliably remove them.
  A separate shader-program key and a tenfold camera-near-plane increase also
  left the marks; the test browser reports a 24-bit depth buffer.
  The simpler original bored extrusion and normal lighting were retained;
  there is no evidence of a physical rod/plate intersection. Rendering probes
  are saved as sun-planet-*-probe.log and corresponding prefixed PNGs. An
  earlier progress message attributed this to shadows/triangulation too soon.

## Rebuilt 040 and 041: unequal involute helical gears

- Replaced the equal gears and oblique view with a smaller upper gear, larger
  lower gear and nearly edge-on source view. The engravings give no counts or
  exact ratio; **28:40** approximates their roughly 7:10 pitch diameters. This
  reconstruction choice is stated in both app notes. The lower gear turns
  oppositely at seven tenths of the upper gear's speed.
- Replaced the four-corner wedge teeth with normal-system involutes. Both gears
  use a 20-degree normal pressure angle, a 40-degree helix angle and a common
  normal module of 0.07 cos(40 degrees). Their different radii require different
  leads. The smaller and larger pitch radii are 0.98 and 1.4; face width is 0.74.
  A transverse backlash allowance of 0.0003 prevents tessellation interference.
- In 040, opposite helical hands meet at a sharp central chevron with no gap.
  In 041, the uninterrupted single helices have opposite hands. Corrected the
  visible slopes to match both sources. Flank lighting uses analytic helicoid
  normals; the flat end caps keep separate axial normals. Each gear is one
  closed toothed solid, with no separately overlapping tooth bars.
- Restored the short horizontal shafts and broad hubs, including 041's second
  hub step. Removed the decorative rail. Four source comparisons per mechanism
  include an offset of half a tooth pitch, since quarter turns repeat the
  appearance of uniformly spaced 28-tooth gears. The gallery has **139 images**.
- The contact test intersects the actual rendered triangle strips with axial
  planes, retaining their diagonal intersection points. It checks both faces,
  the center and all 48 strip midpoints through 32 input-tooth phases. No
  sampled penetration was found; maximum working gaps are **0.00016121** for
  040 and **0.00015613** for 041. These are finite-resolution surface checks,
  not a force or loaded-deflection simulation.
- Further checks cover closure of every mesh edge, outward triangle winding,
  flank normals tangent to the base cylinder, hard end-cap normals and the
  unequal tooth/gap relation across the entire width through 65 motion poses.
  The default upper-gear turn takes **two seconds**, and a lower-gear turn takes
  20/7 seconds. Re-measured both display profiles and added them to the
  38-pose camera test at three aspect ratios.
- Production build and all **2,885 numerical tests passed**
  (parallel-helical-full-tests.log). All **five browser tests passed**, including
  every one of the 507 WebGL constructions, mobile layout and subdirectory
  hosting (parallel-helical-browser-tests.log).

## Rebuilt 042: shallow skew involute gears

- Replaced the 90-degree, 16:24 wedge-tooth pair with nearly equal diameters
  on a **20-degree shaft crossing**. The upper gear is almost edge-on and the
  lower shows a narrow face, matching the engraving's arrangement. Brown
  supplies no dimensions: **40:42 teeth and 25/5-degree helix angles** are
  explicit reconstruction choices, stated in the app.
- Both gears use normal-system involutes with module 0.05 and a 20-degree
  normal pressure angle. Opposite hands make the crossing angle equal the
  difference of the helix angles. Their different transverse pressure angles
  and pitch radii follow from that common normal system. The obsolete shared
  four-corner helical-tooth helper was removed after its last caller migrated.
- Rebuilt the broad hubs and short horizontal-looking shafts, removed the
  rail, and restored a nearly frontal view. The lower gear turns oppositely
  at **20/21** of the upper gear's speed. Nominal contact retains sliding along
  the common tooth trace rather than falsely claiming pure rolling.
- The old 64-pose baseline had **0.146946** maximum radial penetration.
  Its factory and probe are archived in 042-original-factory.txt and
  042-original-probe.txt. The current command now checks the repaired model:
  node scripts/probe-crossed-helical-contact.mjs.
- The new check uses the actual triangulated surfaces, including axial-strip
  diagonals, both triangle centroids and samples near the outer ends of the
  cap triangles. Through 64 input-tooth phases it checks **2,428,122** points
  in the possible contact region in both directions. No sampled penetration
  was found, and the largest sampled point-to-triangle working gap was
  **0.00014118**. Detailed evidence is in 042-involute-contact.json.
- Independent Three.js raycasts at 48 unrelated positions agree with the fast
  surface queries. Tests also check mesh closure, outward winding, involute
  base-cylinder tangency of the lighting normals, hard cap normals, shaft
  directions, gear ratio and tooth advance. Through 65 poses, upper hubs and
  shafts clear the lower gear by over 0.69 units; lower hardware clears the
  upper gear by over 0.58 units.
- Re-measured the display profile and added 042 to the fixed-camera checks
  through 38 poses at three aspect ratios. An upper-gear turn takes **two
  seconds**, and a lower-gear turn takes **2.1 seconds**. Four source images,
  including a half-tooth phase, are saved in the review gallery.
- Production build and all **2,888 numerical tests passed**
  (crossed-helical-full-tests.log). All **five browser checks passed**,
  including rendering all 507 models (crossed-helical-browser-tests.log).

## Rebuilt 044: four staggered spur rows

- Replaced equal 24-tooth wheels with a common-module **36:50 involute pair**,
  matching the source's approximately 0.72 upper/lower diameter ratio. Brown
  specifies four staggered rows but no counts; the application identifies the
  tooth count as a reconstruction choice.
- Widened the stack to 2.686 units across a 2.365 shaft spacing and restored the
  source's nearly edge-on view. Each row advances one-quarter of its own tooth
  pitch; the lower rows have the complementary reverse stagger. Shafts now
  have the source's different upper/lower diameters.
- Removed per-row decorative rings, indices and oversized hubs. Reduced the
  tooth chamfers from about 0.0338 to 0.003. Actual adjacent row bodies formerly
  overlapped by **0.029184**; their new gap stays above **0.0739** through 65
  full-turn poses. The baseline is 044-stack-geometry-baseline.json; the old
  factory is preserved in 044-original-factory.txt.
- The actual tooth outlines, with all chamfer vertices checked against them,
  pass bidirectional contact probes through **161 poses per row**. Across all
  four rows, 162,037 nearby samples show no penetration and a largest sampled
  working gap of **0.00011065** (stepped-spur-contact-tests.log).
- Motion tests check the independent pitch velocities, weighted mesh phase,
  each row's actual rotor transform and the corresponding one-tooth advances.
  Upper/lower revolutions take **2 seconds / 2.7778 seconds** at default speed.
  Four comparison images include a half-tooth pose. Camera bounds now cover
  044 at all three tested aspect ratios.

## Rebuilt 045: five grooved friction faces and enlarged section

- Replaced the equal four-groove wheels with **five complementary V grooves**
  and **7:10 mean radii**, matching the engraving's unequal wheels. The face
  width and nearly edge-on camera follow the source. The right-hand detail
  enlarges the middle four grooves by 1.35, with hatched axial sections.
  Its geometry is a stationary reference illustration and casts no shadow.
- Each wheel is now one closed solid, with separate cap normals, sharp V
  creases and smooth circumferential normals. Its pale motion index is vertex
  color on the existing faces. There are no raised rings or face markers.
  The removed valley rings penetrated the mate by up to **0.018253** in the
  old model (045-groove-ring-interference-baseline.json). The original factory
  is retained in 045-original-factory.txt.
- Actual triangle vertices and centroids stay inside complementary conical
  envelopes: **2,228,224 checks across 64 poses**, no penetration. Tests also
  ensure no triangle bridges a groove valley. **5,120 raycasts** against the
  rotating, rendered faces find a largest working gap of **0.00016483**.
  Evidence is in grooved-friction-contact-tests.log.
- Closed-surface, outward-winding and normal tests pass. The reference section
  clears the machine by over 0.23 units; camera bounds include both through
  motion. Upper/lower turns take **2 seconds / 2.8571 seconds**.
- The nominal ratio rolls at the mean radii. Independent cross-product checks
  retain opposite signs of local sliding on the V faces. The application
  states that friction force and load-dependent slip are not simulated.

## Resolved 039 opaque-face rendering marks

The earlier shadow, material and arm-triangulation probes did not fix the
carrier's dotted marks. Further isolation reproduced the fault in the
multisampled default framebuffer: objects behind the opaque carrier changed
**7, 4 and 27 interior pixels** at phases 0.25, 0.5 and 0.75. Disabling
multisampling removed the effect. This isolates the rendering path; it does
not establish a general cause inside the browser or graphics driver.

The renderer now uses a single-sample framebuffer at **two pixels per CSS
pixel**. This keeps smooth displayed edges without the faulty multisample
path. With the same geometry and depth tests, all **52,314 sampled interior
pixels** now agree exactly with an isolated-arm rendering. This comparison
disables shadow reception in both views to isolate occlusion; the production
model retains its shadows. The existing mechanical clearance tests remain in
place. Evidence and reproducible command:

- 039-opaque-occlusion-baseline.json: old path, expected failure.
- 039-opaque-occlusion.json: repaired path, zero changed pixels.
- node scripts/probe-opaque-occlusion.mjs
- Fresh 039 comparisons at 0, 0.25, 0.5 and 0.75, plus refreshed 044/045 views.

The 2x framebuffer increases fragment shading work on standard-density
screens, compared with the previous 1x multisampled framebuffer. The 507-model
browser sweep validates the final rendering path. Production build and all
**2,891 numerical tests passed** (stepped-grooved-full-tests.log). **All five
browser checks passed**: four passed in the first invocation, and the all-507
rendering sweep passed on its rerun (7.5 minutes). The first sweep reached 507
but hit its 440.25-second timeout. Its revised budget is 1 second per model
plus 60 seconds of overhead; assertions and model coverage are unchanged.
Logs: stepped-grooved-browser-tests.log and stepped-grooved-browser-render-sweep.log.
Fresh renderer comparisons also cover 001, 025, 040–043 and the half-tooth
phase of 044.

## Next: 046 and 047 baselines

Both official pages mark their animation unavailable. Their page snapshots,
three comparison phases each, and original factories are saved. The gallery
now contains **153 comparisons**, including baselines that are not certified.
A larger Brown scan and direct PDF crops resolve details obscured by the small
website pictures (brown-page-16.png, brown-046-detail.png, brown-047-detail.png).

- **046:** the chain is drawn over a solid cone, while its supposed groove is
  a raised black wire. Raycasts against the actual cone show chain/link
  penetration up to **0.033571** across 24 poses (53,242 vertices checked;
  046-chain-cone-interference-baseline.json). The source fusee is wider and
  shorter, with an actual spiral ledge/channel and a flat link chain; its
  initial source pose has most of the chain on the barrel. The current spring
  and barrel arbor both rotate rigidly with the barrel. Glasgow's 1885
  practical manual, printed pages 63 and 66, confirms a cut groove for an
  edgewise chain and a **stationary barrel arbor** after spring adjustment.
  A spring reconstruction must allow the coils to unwind between that fixed
  inner arbor and the moving barrel attachment. The current torque curve is
  prescribed from the desired output torque, not derived from a spring.
- **047:** the high-resolution section shows a narrow outer annular tongue
  entering an annular recess in the left member. The existing broad face disk
  and plain cup do not match that profile; the initial opaque oblique view
  also hides it. Shaft, hub and lever axial lengths need source comparison.
  A raised input face index enters the engaged output disk by **0.013000**
  (047-face-marker-interference-baseline.json, 65 poses). The motion also clamps
  integration steps to 0.05 seconds: at a 0.1-second authored step it reports
  a locked 1.2-rad/s output while the actual output angle advances at only
  **0.6 rad/s**, against a 1.2-rad/s input (047-locked-rate-baseline.json).
  The rebuild needs time-consistent engagement and physical part clearances.

**037 remains mechanically unfinished**; completing the other entries does
not certify its continuous contact.

## Rebuilt 046 fusee, chain and spring

The initial source view now uses a short, wide fusee with **three broad spiral
turns**, a hollow spring barrel of the same height, and the front chain hook
and three barrel wraps shown by Brown. The shaft spacing is 2.76 relative to
a unit barrel chain radius; the fusee's top boss and base radii are 0.555 and
1.18. The 4.25-turn example in Glasgow's manual supports the mechanism's
interpretation, but produces too many narrow steps for this drawing. The
final model instead retains **one reserve barrel wrap at full wind**. Neither
that travel limit nor the exact dimensions are supplied by Brown; the
application explicitly identifies them as reconstruction choices.

- The old raised guide wire and solid cone are replaced by a closed,
  machined spiral ledge. Hard ledge edges retain separate normals, while the
  cylindrical and spiral risers shade smoothly. Top and bottom caps have
  complete boundaries and outward-facing triangles.
- **299 articulated links** have separate interleaved plates, bored ends and
  finite joint pins. Their pin spacing is fixed at **0.079975343** and the
  total polygonal chain length is **23.912627426**. A chord-walking closure
  solve moves the wrapping and free portions without stretching links or
  switching chains. Across 257 states, individual pitch error stays below
  2e-12; the 1,025-pose clearance sweep finds endpoint closure error below
  2e-10. The smooth guide's arc length is not used as a substitute for the
  actual rigid-link length.
- Both end pins remain in fixed clevis eyes on their respective rotors.
  **3,075,000 checks across 1,025 poses** prove that the oblique finite pins reach through, and
  clear, every plate and anchor bore (minimum conservative clearance
  **0.00087872**). A 129-pose check missed a narrow transition interference
  in the earlier 0.007-radius bores; the final bore radius is 0.0082 and the
  denser sampling remains in the regression test. **230,652 neighboring plate pairs** have a separating axis
  with at least **0.00353270** clearance. Nonadjacent chain sections also have
  disjoint conservative swept volumes across **2,876,445 segment pairs**.
- The final ledge opening accounts for the projecting joint-pin ends at the
  changing helix/span transition. **659,788,400 actual plate/pin surface
  samples across 1,025 poses** clear the continuous barrel/fusee envelopes:
  minima **0.00120090 / 0.00238177**. An independent radial-ray test against
  the rendered fusee triangles includes both plates and complete joint pins:
  **1,292,978 rays**, minimum clearance **0.00238806**.
  Evidence: 046-chain-clearance.json, 046-mechanical-tests.log, and the
  reproducible `FUSEE_CLEARANCE_STEPS=1024 node scripts/probe-fusee-clearance.mjs`
  diagnostic. Its default uses 129 poses for a faster check.
- The barrel arbor stays fixed. The ribbon expands toward the barrel wall as
  it unwinds, with fixed inner and rotating outer attachments in small clamps.
  Its neutral-line length changes by less than 4e-10. **29,361,299 finite
  spring-segment pairs** keep separate turns at least **0.037078** apart after
  allowing for ribbon thickness. Moving coils clear the arbor, cup wall,
  floor and rim. The clamps are permanent attachment interfaces.
- The prescribed spring-force curve illustrates torque compensation; it is
  not derived from the ribbon's elastic strain energy. Spring stress,
  friction, winding stopwork and load response are not simulated. These
  limitations remain visible in the application's mechanical note.

The complete winding/rewinding display cycle takes **8.7169 seconds**. Its
sustained visible rotation stays within one revolution per second. The fixed
camera check now includes 046 and correctly accounts for instanced chain
meshes. Six source comparisons cover the initial pose, quarter phases, and
both winding reversals (0.1108435329 and 0.6108435329). The gallery now contains
**156 comparisons**, still including uncorrected baselines for later entries.

The first complete browser run passed all five checks, including all 507
models (046-browser-tests.log, 8.1 minutes). The final bore-clearance change
also passed a fresh production build and all **2,897 numerical tests**
(046-full-tests.log, 104.4 seconds for the numerical suite). The additional
046 browser test passed against that final build, checking moving pixels,
pause stability and mobile layout (046-final-browser-test.log). All six
source comparisons were refreshed after the final geometry change. 047
retains its documented baseline defects and is next; **037's continuous
engagement remains unresolved**. This entry does not certify the remaining
mechanisms.

The next clutch outline is traced in 047-section-reconstruction.json, without
changing production 047. Relative to its outer radius, the larger drawing
gives a shaft length of about 2.04, lever arm 0.484, and handle 0.769. Its
input recess and output annular tongue need small explicit running
clearances. The sectional presentation must remain fixed while the members
rotate; simply rotating a half shell would misrepresent the mechanism.

## Rebuilt 047 annular friction clutch

The new section follows the larger Brown drawing: a narrow outer annular
tongue enters a matching annular recess, and the right member has a keyed
sliding sleeve and circumferential follower groove. The shaft is **2.04 outer
radii long**, with a **0.484-radius lever arm** and **0.769-radius handle**.
The old broad face disk, long shaft/hub and raised face index are removed.
The former index penetrated the engaged disk by 0.013 units; the new rotation
marks are painted into the member's vertex colors, outside the working face.

- Both clutch members are complete, closed solids with outward-facing
  triangles. The output bore includes its actual keyway, with explicit
  corner angles in the surface mesh. The fixed feather clears that bore
  throughout the 0.10-unit slide; **2,064 rays** against the actual bore find
  at least **0.005000** radial clearance at the sampled key surfaces. Shaft,
  lever and follower pins also clear their bores.
- The annular tongue clears both walls of its recess. **866,840 surface
  checks across 257 poses** find at least **0.00593295** side clearance.
  **18,504 axial rays** against the rendered working faces recover the
  commanded axial gap to below 1e-15. The faces meet at zero gap under
  applied pressure, without axial penetration.
- The lever is one rigid bell crank. Its follower maintains contact with the
  appropriate collar corner, with small lost motion between the two sides
  before axial travel begins. **8,313,387 surface checks across 1,025 poses**
  keep follower, pin and lever clear of the rotating sleeve; minimum sampled
  radial clearance is **0.00034855**. The analytic full follower circle also
  clears both collar corners at every sample, with **0.0002** contact
  clearance on the active side. The follower is a sliding contact, not a
  claimed no-slip roller.
- The source view is a fixed section of the rotating members, with front and
  rear faces at Z=0 and -0.08. Its keyway opening changes with the actual
  shaft angle; an oblique keyway may leave a separate slit in the rear face.
  **40,998 section-triangle checks across 512 full-turn angles** lie inside
  the complete physical solids. The cut does not rotate with the machine.
  A **Section view** control restores the full solids and an oblique camera;
  the complete view retains the normal floor, while the drawing view omits
  its shadow plane. Other movements retain their existing view controls.
- Polynomial pressure ramps and exact acceleration/angle integrals replace
  the old delta-clamped update. Breakaway, synchronization, release and rest
  occur at solved events. Tests compare actual angle derivatives with
  reported speed over 2,000 times, independently integrate the acceleration,
  and verify torque balance, including a stalled output under weak pressure.
  Updates with zero delta, 1/240, 1/60, 0.05, 0.1 and 0.4-second steps all
  produce the same state at a given time.

The display cycle is **2 seconds**, with a maximum input speed of about
0.764 revolutions per second. Dimensions, pressure, inertia, load and travel
are reconstruction choices; wear, heating and elastic deformation are not
simulated. The application states these limits.

The production build and **2,903 numerical tests passed**
(047-full-tests.log, 115.0 seconds). Evidence for the mechanism is in
047-mechanical-tests.log. **All seven browser tests passed** in 7.9 minutes
(047-browser-tests.log), including the all-507 render sweep, the 047
section/full-view and mobile controls, 046 playback, and static-subdirectory
hosting. Four source phases and two complete-model views are saved.
**037 remains mechanically unresolved**.

## 048 and 049 baseline for the next rebuilds

Official page snapshots and enlarged Brown PDF crops are saved in
artifacts/reference. Both official animations are unavailable. The review
gallery includes phases 0, 0.25 and 0.75 of each existing model; these are
baseline evidence, and neither mechanism is certified by the browser sweep.

048 has confirmed geometry and contact failures. The input clutch cylinder
is too short, both clutch halves are too wide relative to the driven gear,
and the narrow output hub does not follow the long cylindrical sleeve in
the drawing. The upper shaft and oblique camera also differ substantially.
The source's tapered or curved jaw outline needs reconstruction; its exact
jaw count and dimensions are not specified. Tooth counts and the ratio
cannot be reliably recovered from the schematic edge-on teeth alone.

The lower gear uses four-point trapezoidal teeth with an involute pinion.
A middle-plane probe of **1,093,792 actual pinion triangle samples across
257 poses** finds **55,275 samples inside** the lower gear's rendered
straight-extruded outline, with maximum sampled penetration **0.0304158**.
The positive clutch also declares its output locked while its jaws have
**0.006 axial clearance**. During full insertion the jaws remain centered
in **7.2 degrees of backlash on each side**, so they never carry torque
through flank contact. **99 rays across 33 locked poses** measure working
flank gaps of **0.0631647 to 0.126329**, including **0.0947470** at mean
radius 0.75. These failures are recorded in 048-contact-baseline.json.
The old model test checks prescribed phase and clearance but does not
establish actual engagement. The next rebuild must test the working
surfaces and the transition into and out of positive contact.

049's existing three-bevel topology needs a source-proportion review.
Its exposed upper shaft is much longer than the engraving, its bearing
frames differ, and the present oblique view obscures Brown's front outline.
The initial interpretation of that outline as a section was corrected in
the 049 rebuild below. The pawls used a prescribed cosine lift; their contact
with the actual ratchet teeth still needs investigation. The enlarged
source is saved as brown-049-detail.png. No 048/049 production changes
were included with the completed 047 rebuild.

## Rebuilt 048 geared jaw clutch

The long input cylinder and rounded sliding sleeve now follow the enlarged
Brown drawing. Their outer radius is **0.54** relative to the driven gear's
approximately unit outside radius. The input tip is at X=0.87; the parked
output tip is at X=1.29. The shaft extends from -0.56 to 3.99, and the
bell-crank arm and handle measure 1.15 and 1.09. The grooved collar has a
real bored follower and pin, and the short operating rod is pinned to the
handle. The source camera is nearly straight on. There are no added rails
or bearing posts in this drawing view; the shoulder is smoothly shaded.

Both spur gears are now generated by a rolling 20-degree rack, including
the root transition below the base circle. The chosen **18:32 ratio** uses
module 0.05875. **6,579,200 checks** of the actual extruded middle-plane
outlines across 257 poses find no intersection, with minimum radial
clearance **0.00083735**. An independent involute equation checks 5,184
flank points, with maximum tangential departure **0.00003265**. This
replaces the incompatible trapezoidal lower wheel.

Six annular jaws are part of each complete closed clutch solid. Their
working sides are radial planes; their opposite sides have curved lead-in
ramps. Insertion begins while the stationary output's slots are aligned.
The output starts only when a driving flank reaches its mate, then follows
the input at that contact phase. The sleeve remains locked during
withdrawal and coasts under a constant resisting load after the jaws clear.

- **1,984,543 actual front-surface checks** across 513 poses show no jaw
  penetration. The complete teeth also remain inside their root angular
  sectors, whose overlap bounds hold throughout the motion. Projection
  ambiguities at a vertical driving face are resolved by distance to its
  actual triangle, not by ignoring the contact region.
- **1,170 rays** against all six working flanks across 65 engaged poses
  recover zero contact gap within **1.58e-8** model units.
- **5,557,438 lever/follower surface checks** across 513 poses clear the
  sleeve envelope by at least **0.0210064**. **462 additional collar rays**
  verify contact on the actual active lip to **9.54e-8**. The follower
  traverses the groove's lost motion before each reversal of sleeve travel.
- **2,580 keyway rays** across 129 poses find at least **0.0060000**
  clearance from the actual feather surface. Separate bore rays check the
  shaft against the loose input member and both gears.
- All rebuilt meshes have closed edges, outward winding and consistent
  normals. Angle derivatives match reported speeds; engagement events and
  cycle boundaries preserve output angle; frame sizes from zero through
  0.4 seconds produce the same state at a given time.

The default cycle takes **2 seconds** and the fastest shaft turns about
**0.593 revolutions per second**. The six jaws, tooth ratio, dimensions,
clearances, travel and load are explicit reconstruction choices. Locking
is an ideal inelastic impact against a prescribed constant-speed input;
stress and elastic deformation are not modeled. The application explains
these limits. Reconstruction parameters are saved in 048-reconstruction.json.

All **eight dedicated mechanical tests passed**. The production build and
**2,911 numerical tests passed** (048-build.log and 048-full-tests.log,
118.6 seconds for the tests). The new 048 desktop/mobile playback check
also passed. **All eight browser tests passed** in 8.1 minutes, including
the all-507 render sweep, mobile controls and static-subdirectory hosting
(048-browser-tests.log). Four final source phases and two oblique
complete-model views are saved; the original 048
phase-0.25 capture is retained under its baseline filename. The review
gallery contains 168 source/complete-model comparisons.

## Confirmed 049 failures before its rebuild

The larger engraving implies approximately equal **45-degree miter gears**:
its upper-left heel is roughly (-298, -300) from the apex, and the toe/heel
slant ratio is about 0.62. The existing model uses **16:32 teeth**, a
26.565-degree pinion cone and a 0.40 slant ratio. Its ratchet radius is about
1.04 times the pinion radius; the drawing suggests about 0.46. These are
substantial proportion/ratio differences, in addition to the long upper
shaft and different camera view.

The actual pawl contact probe also fails. Across **1,025 poses**, **511 of
1,023 active-pawl poses** have an air gap, reaching **0.0175332**. Elsewhere,
**6,024 rendered tip vertices** lie inside ratchet teeth, with maximum depth
**0.0134688**. The beam itself sits 0.015 outside the wheel axially, so it
cannot provide the missing contact. Results and source coordinate estimates
are in 049-contact-baseline.json. The replacement must solve the pawl's
motion against its real tooth surfaces and address finite tooth pitch at
reversals. The old prescribed cosine lift is not contact evidence. With its 0.82-radian
input amplitude, a passive half-stroke advances the relative ratchet phase
by 3.28 radians, or about 7.308 pitches. The next drive therefore starts at
a different tooth phase; repeated strokes cannot be validated from a
single ideal speed-ratio equation.

## Rebuilt 049 ratchet and bevel rectifier

Three equal **40-tooth, 45-degree bevel gears** replace the old 16:32 pair.
The inner/outer axial ratio is **0.60/0.97**, and the ratchet radius is
**0.46** relative to the approximately unit bevel radius. The source's
short upper shaft, smaller ratchets, upright pawl arms and curved bearing
braces are reconstructed. Front and oblique views show the complete closed
solids. The radiating lines in Brown are bevel teeth, not section hatching;
the earlier suggestion that this movement needs a cutaway was incorrect.

The bevel teeth retain a back-cone involute approximation with conical
heels and toes. A local thickness factor of 0.999 closes the previous
excessive backlash without changing other bevel callers' default factor.
**6,976,320 actual triangle-surface checks across 129 poses** find no
intersection in either mesh. The smallest sampled gap is **0.00004779**;
the largest per-pose, per-mesh contact gap is **0.00007222**. This is
sampled contact evidence for the rendered approximation, not certification
of exact manufactured octoid conjugacy.

The opposed pawls now lift against the real ratchet outline and return
under ideal spring bias to physical heel stops. Each has a rounded nose,
true pivot bore, pin and torsion coil. The arms have bored keyways and
rotate with actual shaft feathers; the two bevel/ratchet members run loose
on the horizontal shaft. The upper gear fits its output shaft. Both shafts
terminate clear of each other.

- **2,918,638 pawl-surface checks across 1,025 poses** show no tooth
  penetration, with minimum clearance **0.000004984**.
- **257 rays** against the driving nose and actual tooth face measure a
  maximum gap of **0.000005357**. The overrunning pawl's lift follows the
  tooth ramp instead of a prescribed cosine.
- Pawl heels meet their stops within **1.05e-10** numerical error. Pivot
  clearance exceeds **0.001494**; the spring wire clears the pivot and
  stop by **0.008878** and **0.009250** respectively.
- **1,430 rays** from actual feather-surface samples verify at least
  **0.004000** keyway clearance. Further bore rays check both loose gears
  and 64 output-shaft rays verify the fixed fit within **1e-7**. Carrier
  arms clear the stationary posts axially by at least 0.025.
- Rigid meshes have closed edges, positive volume and outward normals.
  A bore ray exposed a microscopic seam at the final angle of the shared
  turned-surface helper; wrapping that angle to zero closes the seam.
  All 17 targeted clutch and bevel regression tests pass after that fix.

The chosen **40-degree input amplitude** advances four ratchet teeth per
half-stroke and **160 degrees of output per oscillation**. Both driving
strokes therefore begin on an actual working face. Tests also exercise
three nonintegral stroke amplitudes through four cycles each: these retain
the required lost motion at reversals. Output angle is continuous and
one-directional; derivatives match the reported speeds, and the prescribed
load/inertia balance never requires a pawl to pull. Frame steps from zero
through 0.4 seconds give the same state at a given time.

The displayed oscillation takes **2 seconds**, with maximum shaft speed
about **0.349 revolutions per second**. Tooth counts, dimensions, amplitude,
load and spring details are explicit reconstruction choices. Spring
return is quasistatic and engagement impacts are ideal; spring inertia,
wear and elastic stress are not simulated. The app states these limits.
Parameters and evidence are saved in 049-reconstruction.json. Seven
dedicated mechanical tests and the fixed-camera motion test pass. The
final production build passes, and **all 2,918 numerical tests pass** in
107.5 seconds after the output-shaft fit correction
(049-final-build.log and 049-final-full-tests.log).

The full browser run passed eight of nine tests, including the **all-507
render sweep**, mobile layouts, static-subdirectory hosting and 049's
playback, pause and orbit controls. 046 exhausted its 45-second test
budget during mobile scrolling while the numerical suite was also running;
the failure trace is preserved in 049-browser-timeout-046. A sequential
rerun against the final build passed both 046 and 049 in **40.0 seconds**,
with no assertion changes or longer timeouts. Thus all nine distinct
browser checks have passing results across the full run and focused rerun
(049-browser-tests.log and 049-final-browser-tests.log).

Five final source phases and two oblique views are saved for 049. Its old
captures remain under baseline filenames. Including the next 050/051
baselines, the gallery now contains **178 comparisons**.

## 050 and 051 baseline for the next rebuilds

Both official pages describe kinds of universal joints and mark their
animations unavailable. Saved page snapshots, Brown PDF page 22 (printed
page 18) and larger unmodified drawing crops are in artifacts/reference.
The existing factories are saved in 050-051-original-factories.txt, and
three source-comparison phases per model are in the gallery.

The current tubular arms, separate toroidal bearing eyes and bulky necks
do not follow the source's broad, curved fork silhouettes. 050's middle
member also needs its compact double-loop outline reconstructed in place
of the long exposed middle shaft. The cameras and relative shaft lengths
differ substantially from the drawings. Exact joint angles and dimensions
remain reconstruction choices; these drawings are not dimensioned.

The rendered joints also have confirmed interpart interference. The
existing yoke-arm tubes extend into their pivot openings and pass through
the cross or ring trunnions. A probe of actual triangle vertices, centers
and edge midpoints compares distinct moving members, excluding intended
fixed connections. Only closed individual solids are used as penetration
targets; open tube ends cannot generate the inside classification.

- **050:** 5,606,224 surface checks across 65 poses find **56,108 samples
  inside** the other member, reaching depth **0.0698337**. The worst witness
  is a middle-yoke arm inside a cross trunnion of radius 0.075.
- **051:** 3,812,876 checks find **25,009 samples inside**, reaching depth
  **0.0738605** at a yoke arm and the ring's trunnion.

The probe and detailed witnesses are saved in
scripts/probe-universal-joint-baseline.mjs and 050/051-contact-baseline.json.
No 050/051 production changes were made during the 049 rebuild. Their
current kinematic regression tests do not establish physical clearance.

This baseline describes the state before the following rebuild.

## 050 and 051: curved forks, real pivot bores and derived Cardan motion

Both universal joints now use broad curved straps and cylindrical bored
end lugs. The old tubes and separate decorative toroidal eyes let the arms
fill their own pivot openings. The new straps stop before each opening;
real pins pass through real bores, with retaining caps outside the forks.
050's exposed intermediate shaft and oversized necks are replaced by one
compact, continuous double fork. Shafts are shorter and thinner, and the
source cameras show the reconstructed broad fork silhouettes. The models
omit external supports, as do the engravings, and have no ground plane.

051 now has a solid cross. Its former ring interpretation was not supported
by Brown's thin central web. Plate 6, figure O8 in the 1820 English
Lanz–Betancourt *Analytical Essay* clearly shows a solid cross between
curved forks. Cornell's archived Clark collection editorial note also
suggests a relationship between that figure and Brown's drawings. This
supports the chosen topology, while the exact historical relationship
remains an inference. Sources, the enlarged O8 crop and photograph
provenance are recorded in artifacts/reference/README.md.

Motion is derived from perpendicular trunnion axes at each joint.
051 has the expected twice-per-turn output speed variation. In 050, the
two equal bends and correctly phased middle bearings produce constant
output speed; the middle member and both crosses vary in speed. Independent
trigonometric checks cover four turns, numerical angle derivatives agree
with the reported speeds, and multiple frame steps give identical states.
The chosen bends are 52 degrees per joint in 050 and 54 degrees overall in
051. The input makes one turn in **2 displayed seconds**. The fastest
shafts reach about **0.812** and **0.851 revolutions per second**, respectively.
Dimensions, angles, fits and caps are reconstructed; bearing friction,
elastic stress and external shaft support loads are not simulated.

Actual rendered geometry supplies the mechanical evidence:

- Every rigid solid has closed edges, positive volume and outward normals.
- **050:** 16,941,504 surface checks through 129 poses find **zero** samples
  penetrating another moving member. **051:** 6,887,552 checks find **zero**.
  These use triangle vertices, centers and edge midpoints in both directions
  for every pair of distinct moving members; fixed subparts of one member
  are excluded. This is sampled evidence, not a continuous collision proof.
- Across 257 nonaligned poses per joint, **37,008 rays** pass through the
  actual bearing geometry. Their first hits are the pin and bore skins,
  confirming that the straps do not fill the holes. Minimum radial clearance
  is approximately **0.0009755**, against a nominal 0.001.
- Further axial rays confirm **0.004000** minimum separation between the
  retaining caps and the outer fork faces.

Five dedicated mechanical tests and the existing model wiring checks cover
these changes. Dense reports are in 050-contact.json and 051-contact.json;
reconstruction parameters and final validation results are in the matching
050/051-reconstruction.json files. Five source phases and two oblique views
per joint replace the old comparisons; baseline images remain preserved.
The final build passes, and **all 2,923 numerical tests pass** in 113.2
seconds after the final source-pose registration. **All 11 browser tests
pass** in 9.1 minutes, including the all-507 render sweep, playback/pause/orbit
and mobile controls for both rebuilt joints, the previous rebuilt mechanisms,
catalog navigation and static-subdirectory hosting. The run used one browser
worker and needed no retries or assertion changes. Final logs are
050-051-build.log, 050-051-full-tests.log and 050-051-browser-tests.log.
The gallery contains **192 comparisons**, including the following 052/053
baselines.

## 052 and 053: source comparison and contact baselines

Three phases of each current model are saved beside their source images.
Both original factories are preserved under 052/053-original-factory.txt.
The official page snapshots and enlarged Brown PDF crops are in
artifacts/reference. No 052/053 production changes were made during the
universal-joint rebuild.

052's disk side view, unequal disk thicknesses, shaft lengths and bent
operating lever differ substantially from the present oblique model.
The current handle extends along the upper lever's line rather than
turning approximately a right angle at the pivot. Added support posts
and an oversized floor shadow also depart from the source composition.
An actual-skin probe inside the inserted studs' axial overlap performs
**8,256 rays across 129 locked poses**. The pin-to-hole wall clearance is
**0.039962 to 0.040629**, while the disk faces remain 0.12 apart and the
state reports full torque transmission. The studs are centered in the
oversized holes rather than loaded against a wall. The rebuilt clutch
must derive its engagement phase from real contact and preserve the
necessary take-up. Evidence: scripts/probe-pin-clutch-baseline.mjs and
052-contact-baseline.json.

053 needs the source's large central opening, longer double-clutch body,
short shaft stubs and front-view composition reconstructed. The existing
model compresses the clutch within broad bevel faces and adds prominent
external supports. A baseline probe checks **2,460,640 bevel-surface
samples over 65 poses**, across both mesh pairs and both directions. No
sample penetrates; the closest sampled gap is 0.001971 and the largest
pair minimum is 0.001990. These results concern the bevel skins only;
the clutch, key and selector still need their own contact review. The
old solid input gear's collapsed zero-radius bore contributes 384
zero-area faces. The probe excludes those faces from nearest-triangle
distance calculations and requires every resulting distance to be finite.
Evidence: scripts/probe-reversing-bevel-baseline.mjs and
053-bevel-contact-baseline.json.

A further jaw-only probe during the 052 rebuild checks **7,387,776 surface
samples in 198 fully inserted poses**, covering both driving directions
through three cycles. The opposed jaws remain **0.0313953 apart** while
the old state reports full torque transmission. This matches the clearance
left by teeth centered in the mating gaps, rather than loaded against a
driving flank. 053 therefore needs a real loaded jaw phase and take-up as
well as its proportion changes. The report excludes shafts, keys, gear
bodies and selector hardware; those remain separate review requirements.
Evidence: scripts/probe-reversing-clutch-baseline.mjs and
053-clutch-contact-baseline.json.

## 052: loaded stud contact, common shaft and bent operating lever

The rebuilt clutch follows the source's unequal disk sizes and thicknesses,
short left stub, continuous shaft, grooved collar, turned end knob and bent
operating lever. The left disk has a real sleeve bore around the output
shaft; the right disk and shaft slide together. The stud coupling supplies
their rotational connection. Brown does not detail the internal shaft
connection, so this arrangement is explicitly identified as a reconstruction.
The external drive and support bearings are outside the shown assembly.
The model has a front source view, an oblique inspection view and no ground.

A single rigid bell crank replaces the straight, separately drawn links.
Its perpendicular handle rotates about a bored fixed pivot. A second pin
connects the upper eye to a small bored shoe inside the annular collar
groove. The shoe stays parallel to the groove walls while following the
lever's arc; actual bores and retaining caps make both pivots inspectable.

The studs enter when aligned, then take up the available clearance before
driving. Their loaded phase is computed from the support planes of the
actual 256-sided pin and hole polygons, including the pin's relative
rotation. The chosen phase difference is **0.0117503 radians**. Contact
force uses the normal and torque arm at the actual supporting pin vertex.
The output then rotates with the input, remains driven through withdrawal,
and coasts against a prescribed opposing load once the pins are clear.
One operation advances the output by half a turn; the two opposite holes
allow the next engagement without an angle reset. Engagement is an ideal
rigid impact. Bearing friction, elastic stress and impact deformation are
not simulated. These assumptions and the unshown sleeve construction are
stated in the application and 052-reconstruction.json.

Independent evidence for the final geometry and motion:

- All rigid solids have closed edges, positive volume, nonzero-area faces
  and outward normals. The loose sleeve is hollow; the output disk has two
  real stud holes and a fitted central shaft bore.
- **21,416,862 surface checks through 179 poses** find **zero** samples
  penetrating another moving member. The probe adds 33 times inside the
  brief initial entry and 17 around release, which uniform sampling could
  miss. Every pair of distinct moving members is checked in both directions.
  Fixed subparts of one member are excluded. This is sampled evidence,
  not a continuous collision proof.
- **774 loaded-contact rays** through three engagements find a gap of
  **0.000011763** between the actual pin and hole skins along the line of
  their eccentric centers. The minimum support-plane clearance is 0.000005.
  This replaces the old all-around gap of about 0.04.
- **6,837 hardware rays** find minimum sleeve clearance **0.002974**,
  main-pivot clearance **0.000994**, shoe-pin clearance **0.000995**,
  shoe-to-groove-wall clearance **0.000009978** and cap clearance **0.005000**.
- Four cycles of independent motion checks verify continuous one-way
  output angle, angle derivatives, load balance, rigid perpendicular lever
  arms and half-turn advancement. Frame steps from zero through 0.4 seconds
  give identical states at a common time.

The final hardware inspection added a rear cap to retain the selector shoe
on its pin. The cap has 0.005 clearance behind the shoe and clears the
collar's groove floor; both are covered by the updated actual-skin checks.
Five dedicated mechanical tests pass, and **all 2,928 numerical tests pass**
in 114.6 seconds after that addition. The browser sweep and final-build
control verification are recorded in 052-reconstruction.json. The full
browser run passed **all 12 tests** in 9.6 minutes, including all 507 model
constructions, before the rear cap was added. Afterward the final build
passed in 8.4 seconds, and 052's playback, pause, orbit and mobile test
passed again in **10.2 seconds** against that build. The final numerical
suite and geometry probes also include the rear cap. No assertions were
relaxed and no retries were needed. Final logs are 052-final-build.log,
052-final-full-tests.log, 052-browser-tests.log and
052-final-browser-tests.log. Six source phases and two oblique views are
saved for 052.
The displayed operation takes **2 seconds**, with both the driving disk
and output shaft limited to **0.5 revolutions per second**. The gallery now
contains **197 comparisons**.
The original factory and baseline contact report remain preserved; three
baseline views were reproduced from that saved factory after the rebuild.

**037 remains mechanically unresolved; 053 onward remain pending.**

## 053: triangular reversing clutch and compact bevel train

Rebuilt 053 from the enlarged Brown scan and the official source page. Its
three equal bevel gears now have short conical tooth faces, a large central
opening and short shaft ends. The central clutch has the long waisted body
and triangular crown outline visible in the engraving. A bent selector
operates a pivoted shoe inside the groove; its main pivot, shoe pin and
control-rod pin have real bores and retaining caps. Both horizontal gears
turn on clearance bores around a common feathered output shaft.

The old four-dog clutch declared torque transmission with about **0.0314**
clearance at the nearest opposing skins. In the new construction, each of
12 triangular teeth reaches its loaded flank. Their slope requires a small
camming rotation while the sleeve moves axially. The model derives that
rotation from the available face gap and includes the selector's axial
holding force. Drive and selector power balance output power; the tooth
force remains compressive through insertion and withdrawal. The output
coasts to rest before engaging the opposite gear. Initial engagement is
an ideal rigid impact, with its angular impulse recorded.

The source does not specify the exact tooth counts, internal flank shape,
fits, selector joints, inertia or load. Those are reconstruction choices,
recorded in 053-reconstruction.json and the application's mechanical note.
The triangular flanks are helicoidal surfaces approximated by a radial
and angular mesh with small numerical clearance. Elastic stress, impact
deformation, bearing friction and manufactured bevel conjugacy are not
simulated. This does not claim an engineering production design.

Independent evidence for the final geometry:

- **968,518,924 surface checks through 229 poses** find **zero** penetrating
  samples among all 45 pairs of the ten member groups, in both directions.
  The poses include 33 initial-entry samples and 17 around release for
  each driving direction. Fixed subparts of a rigid member are excluded.
  This is sampled evidence, not a continuous collision proof.
- **74,304 crown-contact checks through 258 loaded poses** find a minimum
  gap of **0.00003744** and a largest per-tooth nearest gap of **0.00004172**.
  Every tooth is checked in both directions against actual opposing triangles.
- **6,976,320 bevel-surface checks through 129 poses** find no intersections.
  The nearest gap ranges from **0.00005404** to **0.00008125** over the two
  meshes and both probe directions.
- **4,355 hardware rays** find minimum loose-gear clearance **0.004996**,
  key-wall clearance **0.00001000**, main-pivot clearance **0.000999**,
  shoe-pin clearance **0.000799**, rod-pin clearance **0.000999**,
  shoe-to-groove-wall clearance **0.00001000**, and cap clearance **0.004000**.
- Every rendered rigid solid has closed edges, positive volume, nonzero-area
  faces and outward normals. Four cycles verify motion derivatives, torque
  balance, cam power, rigid lever geometry and frame-step independence.

Six 053 tests and the eight shared 048 jaw-clutch regressions pass. The
production build passes in **8.43 seconds**, and all **2,934 numerical tests**
pass in **114.9 seconds**. All **13 browser tests pass in 9.7 minutes**
against that final build, including every 507 model construction, 053
playback/pause/orbit/mobile controls, and static-subdirectory hosting. The
logs are 053-full-tests.log and 053-browser-tests.log; no retries or
weakened browser assertions were needed.
The outer npm command later returned exit 143 despite its complete passing
TAP, and an interactive direct rerun was also terminated. The same complete
suite was then run in a separate process with eight workers: all **2,934
tests pass in 106.1 seconds**, with explicitly recorded **exit code 0** and
no signal. The final numerical evidence is 053-numerical-exit-check.log and
053-numerical-exit-status.json. Production code and test assertions did not
change between these runs.
The complete operation takes **2 seconds** at default speed. The input
turns at **0.5 revolutions per second**, and the cammed output peaks at
**0.588 revolutions per second**. Six source views and two oblique views
are saved. Concentrating this small model's shadow map around the assembly
makes the tooth shadows crisp instead of blurring them into sleeve ripples.

## 054–055: next source comparisons

Saved the official pages, larger unchanged Brown scan crops, original
factories and three baseline views apiece. These have not been corrected.
054 currently has a large opening through both rims, round rim sections,
straight spokes and an oblique starting view. Brown shows a nearly complete
wheel with flat rim faces, waisted spokes and a small H-shaped piece at A.
An independent baseline probe finds **38,821 penetrating samples in 169,900
checks**, with depth up to **0.213868**, between its wheel pins/webs and the
pinion through 129 poses. Its uncapped open rims are excluded as inside-test
targets. The exact crossover construction needs investigation. 055 has a thick
pinion and thin exposed ring spokes absent from its engraving. A support-only
probe finds **184 penetrating samples in 78,432 checks**, up to **0.041175**
deep, where the rotating ring spokes pass through the pinion hub. Its
internal/external tooth contacts still need independent checking.
The gallery contains **208 comparisons**, including these uncorrected baselines.

**037 remains mechanically unresolved; 054 onward remain pending.**

## 054 rebuilt and verified

The right-angle mangle now has radial generated teeth, four waisted spokes,
a bored hub, a short input shaft and a captured crab guide. The source
stroke pitch supports 32 wheel positions. The shifted four-tooth involute
pinion keeps the small source outline; its contact map determines wheel
motion while the input rotates continuously. Two opposed guide faces keep
collar reactions compressive through reversal. Those guide sections and
the input bearing beyond shaft B are explicit reconstruction inferences.

The loaded model passes **41,869,586 bidirectional tooth checks through
195 poses** and **252,779,008 hardware checks through 99 poses**, with no
penetrating samples. Independent exact triangle distances at 48 positions
find gaps of **0.0000216–0.0000270**. All **23 unique solids** have closed
oriented edges, positive volume and outward normals at every triangle
corner. A 38-pose quasistatic force check uses only compressive tooth and
selected-guide reactions; its power residual is at most **0.41%**.

The full cycle requires sixteen input revolutions and displays in **16
seconds**. Source and oblique views have been inspected. The gallery now
contains **211 comparisons**. The original factory, false-positive pitch
identities and failing prototypes remain archived.

**All 2,941 numerical tests pass with exit code 0; the build and all 14
browser tests pass**, including all 507 canvases and the new 054 controls
check. Headless browser tests now run serially to avoid shared software-WebGL
contention; the earlier parallel timeouts and traces are preserved.
Full evidence: artifacts/review/054-reconstruction.json.

### 055 — rebuilt and verified

The coaxial train now uses source-proportioned **17/10/37 teeth**, common
25-degree involutes, and two independently rotating concentric outputs.
The ring's hidden support is an inferred cup web and bored sleeve; the
input shaft ends ahead of that web. Short shaft ends and a shallow assembly
replace the old overhangs and intersecting rear spokes.

Both working flanks retain **0.0000246–0.0000382** clearance in 2,049 exact
contour checks per pair, with no intersections. The contour method agrees
with independent triangle-distance measurements. All seven solids pass
closed-edge, volume, face-area and corner-normal checks. A 97-pose hardware
sweep performs **38,887,646** surface checks with no penetration. The input
runs at **0.5 revolution/second**; outputs A and C take 3.4 and 7.4 seconds
per revolution.

**All 2,945 numerical tests, the build, and all 15 browser tests pass**,
including all 507 canvases and the new 055 controls check. The final source
and oblique captures are inspected; the gallery contains **214 comparisons**.
Evidence: artifacts/review/055-reconstruction.json. An interactive source
contour overlay is in artifacts/review/055-source-alignment.html. It shows
the remaining differences between mechanically compatible involutes and
the engraving's schematic tooth shapes and spacing.

056 is rebuilt and integrated with a traced foreground headstock and eccentric
slot, 38/12 generated involutes, a bored sliding bearing and a correctly ordered
three-step pulley. Both shafts stop before each shift, and the pinion turns
alone while disengaged. Default playback is 4.1533 seconds per complete cycle.
Its 2,049-pose tooth sweep and 1,026-pose full-cycle sweep have no crossings;
97 hardware poses cover 85 pairs and 62,754,548 samples without penetration.
The 130-pose cam check transmits compressive power in both directions, and all
16 meshes are closed with outward normals. Build and all **2,950 numerical
tests pass**, and all **16 browser tests pass** with one worker, including the
complete 507-scene canvas sweep. Source residuals and the
inferred operating sequence are documented in artifacts/review/056-reconstruction-notes.md;
its actual-mesh overlay is artifacts/review/056-source-alignment.html. The gallery
now contains **220 comparisons**.

057 is rebuilt and verified. Its
18/10/34 custom involutes share base pitch and use different operating pressure
angles at the two meshes. Both pass 2,049 actual-contour contact phases with no
crossings. The corrected carrier runs between the rear sun drum and gear faces;
the ring has an inferred external annular bearing. A 97-pose, 128-pair audit
passes **997,119,928 bidirectional surface checks** with no penetrations. All
18 meshes have closed outward surfaces, and exact triangle checks retain small
positive gaps at both gears, four pulley contacts and the crossed cords.

Indexed source outlines favor 18/10/34, and the source overlay records remaining
involute-versus-schematic tooth differences, shorter sun tips and the crossed
band's rear passage behind the ring. The pinion spins once per second at default
speed; the near-cancelling differential gives a **174.4-second carrier orbit**.
The build, five focused mechanical tests, all **2,955 numerical tests**, and all
**17 browser tests pass**, including all 507 canvases. Both full-suite wrappers
report exit code 0 with no signal. All six source/oblique comparison frames and
the rear view are inspected; the gallery contains **226 comparisons**. Evidence
is in artifacts/review/057-reconstruction.json and its reconstruction notes.

058 is rebuilt and verified. Brown's
side elevation now aligns with the larger smooth pulleys, expanded gear spacing
and negative-x camera. A real flat band traverses four equal pulleys through
stopped shifts. Three 17/39, 26/30 and 40/16 involute pairs share a common output;
unselected inputs back-drive through genuinely bored nested sleeves. The counts
are compatible proportion estimates, not tooth counts specified by Brown.

Both torque flanks pass 2,049 phases per pair with no contour crossings and
24.142–27.522 microunits of clearance. A 97-pose, 117-pair hardware audit performs
**142,209,744 bidirectional surface checks** with no penetration. Independent
3D triangle checks confirm six gear contacts and fourteen band/tread contacts,
including both adjoining pulleys during traversal. All 17 solids are closed
with outward normals. Seven focused tests and the build pass. Default playback
is **14.7572 seconds** for the complete selector demonstration. All six final
source/oblique captures and the source overlay are inspected; the gallery now
contains **232 comparisons**. Evidence is in artifacts/review/058-reconstruction.json
and its reconstruction notes. All **2,962 numerical tests** and all **18 browser
tests pass**, including all 507 canvases and the new 058 controls check. Both
full-suite wrappers report exit code 0 with no signal.

059 is rebuilt and verified with 12/42 and 45/9 ordinary 30-degree involutes,
real independent bores, three smooth lower pulleys and a flat traversing band.
Both gear pairs pass 2,049 samples on each actual load flank over complete
relative tooth cycles: no crossings and maximum normal-force power error
0.317 percent. All 13 solids are closed with outward normals. A 97-pose,
66-pair hardware sweep has no penetration in 97,609,164 samples, and fourteen
independent 3D contact checks pass. The source overlay's measured residuals
are within 7.66 scan pixels. The old shared selector factory and 059 test are
archived; the production factory is removed after exact archive comparison.

Five focused mechanical tests, the build, and all **2,967 numerical tests**
pass. Default playback is **15.0095 seconds** per complete demonstration,
preserving the quick-mode 17.5-times back-drive of the small input gear.
All six integrated source/full captures are inspected; the gallery contains
**238 comparisons**. All **19 browser tests pass**, including all 507 canvases
and the new 059 controls check. Both full-suite wrappers report code 0 with no
signal; the browser run uses one worker and takes 754.558 seconds.
Evidence: artifacts/review/059-reconstruction.json and its reconstruction notes.

060 is rebuilt and verified with two permanent flat bands, source-sized pulleys, the exposed
shaft gap between lower banks and independently rotating loose pulleys. All
measured body/shaft outlines lie within seven scan pixels. Across 97 poses,
39 independent hardware pairs give 49,976,460 surface samples with no
penetrations; all 24 independent triangle-contact gaps are positive. Five
focused tests, the build and all 2,972 numerical tests pass. All six integrated
source/oblique frames are inspected; the gallery has 244 comparisons. All
20 browser tests pass, including all 507 canvases and the new 060 controls
test. Both full-suite wrappers exit zero with no signal (137.471 seconds for
numerical tests, 768.349 seconds for browsers).
Evidence: artifacts/review/060-reconstruction.json and reconstruction notes.

061 is rebuilt and verified with a compact differential enclosed in hollow source-sized
pulleys, real independent bores, a flat selector band and a flat weighted
friction curb. Section view exposes the hidden 26/20-tooth bevel train;
complete view preserves its physical enclosure. All 19 physical geometries
are closed with outward normals. A 97-pose, 153-pair sweep finds no
penetration in 171,138,216 samples. Four 129-phase directional mesh checks
find working gaps of 37.035–40.295 microunits and maximum pairwise contact-normal
power residual below 0.211 percent. All 61 exact contact/hardware rows and
motion checks pass. Measured source outline residuals are within nine scan
pixels. Five focused tests pass; all six integrated frames are inspected.
Playback takes 4.480 seconds per full demonstration; the gallery has 250
comparisons. All 2,977 numerical tests pass after restoring the legacy
constructor that 062 still depends on. All 21 browser tests pass, including
all 507 canvases and the new 061 controls check. Both wrappers exit zero
without a signal (141.701 seconds numerical, 795.392 seconds browser); the
build passes in 9.88 seconds. The first run's six numerical failures and one
browser sweep failure all had that missing-constructor cause, now repaired.
Evidence: artifacts/review/061-reconstruction.json and reconstruction notes.

062 is rebuilt and verified with four source-sized lower pulleys, two permanent flat bands
and a compact enclosed 34/20-tooth differential. An accessible configuration
select installs the auxiliary band open or crossed and restarts the demonstration.
The output subtracts or adds that side input in carrier mode. Neutral and shifts
explicitly stop the input; free differential dynamics are not assumed. Section
view exposes the enclosed train without changing physical mesh transforms.

Both configurations have 19 closed physical geometries with outward normals.
Their 97-pose, 152-pair hardware sweeps perform **437,678,550 total surface checks**
with no penetration. Eight directional mesh sweeps cover **1,032 loaded-flank
poses**, with 31.762–33.882 microunit working gaps and maximum contact-normal
power residual below 0.181 percent. All 145 exact triangle contact/clearance rows
pass, including the entire crossed free spans. Motion checks include 14,286
actual neutral-curve wrap samples. All 12 measured body/shaft source residuals
are within 13.5 scan pixels. Both obsolete legacy factories are archived and
removed; rebuilt 061 is unchanged.

All seven new 062 mechanical tests pass within the full **2,984-test numerical
suite** (wrapper code 0, no signal, 186.972 seconds). The build passes in 9.22
seconds. All **22 browser tests pass**, including the new configuration/section
controls test and all 507 canvases (wrapper code 0, no signal, one worker,
820.313 seconds). Both configurations set
the measured bounds and speed limits, giving a **4.7745-second** displayed cycle.
All twelve integrated source/complete frames, both overlays and desktop/mobile
controls are inspected; the gallery includes **262 comparisons**. Evidence:
artifacts/review/062-reconstruction.json and reconstruction notes.

063 remains mechanically unresolved; its production model is unchanged.
The official page has no animation. A scoped actual-surface probe at 309 poses
across three pin events confirms the active-pin identity but finds large gaps
where the existing animation flags claim contact: 0.171–0.394 between pin/drop
and 0.259–1.102 between pin/pawl. The pawl intersects the star throughout every
claimed engaged sample, and the striker, drop and pivot constructions also
need correction. The source's overlapping drop/pawl outlines and pivot anatomy
are being resolved before selecting a replacement. Evidence is in
artifacts/review/063-contact-baseline.json; factory, helpers and tests are archived.
All four baseline frames and three provisional source tracing overlays are
inspected. The initial fixed-upper-pivot planar study tracks a connected contact
branch across three pin events, but omits the star and cannot establish indexing.
The upper pawl joint moves with the spring-carried drop. Subsequent moving-hinge
studies include the star, finite pins and striker, and explore support, cam and
tooth geometry. None establishes repeated one-tooth advance. The simplified
solver omits some hinge/contact force coupling and a two-flank seated nose
constraint; clear sampled poses alone are not a working-mechanism result.
Corrected reverse-direction studies also fail indexing. Spon's figure 3186
repeats the source anatomy without resolving support dimensions. Sam Gallagher's
written reconstruction account is saved; his animation could not be retrieved
and was not inspected. Its failed-download placeholder is labeled accordingly.
The baseline itself finds 57,637 penetrating samples in 4,130,124 checks.
See artifacts/review/063-reconstruction.json and reconstruction notes.

064 is rebuilt and verified with a source-traced bored cam, finite pin and
half-cut sleeve, pivoted rolling follower, fitted constant-length curved leaf
spring and a conjugate cylindrical-worm-generated wheel. The spring releases
the cam dynamically; it settles before the pin catches. Maximum relative lead
is 2.403560 radians within the finite cut's 2.761272-radian allowance.

All 20 parts have closed outward surfaces; the deforming spring has five more
checked poses. The 104-pose, 165-pair complete hardware sweep and 65-pose loaded
worm sweep perform **335,677,456 combined surface checks with no penetration**.
Worm contact-normal power residual stays below 1.168 percent. Independent
spring energy/work, fixed-root/neutral-length, rolling contact, catch impact,
and time/contact-table convergence checks pass. The initial worm refinement
inherited a spherical cutter bound; the corrected cylindrical bound is verified
by a doubled-resolution generating study.

The current source comparison covers 86 boundary readings and three centers.
Maximum marked residuals are 3.752 pixels for the cam, 6.333 for the spring
stem, 5.124 for the lever, 10.745 for the regularized curl and 20.521 for the
regularized wheel teeth. The engraving does not establish an exact tooth count;
24 is a construction choice. Ten integrated source/complete views are inspected,
and the gallery has 272 comparisons. Playback takes 24 seconds per wheel cycle
to keep the visible worm at one revolution per second. The unmarked circular
roller retains its physical no-slip spin while its invisible symmetric axial
rotation is excluded from visible-speed measurement.

Seven focused tests pass. The first full numerical run passed 2,989 of 2,990:
a new visibility test incorrectly rejected a uniform vertex-color attribute.
That assertion is corrected; the initial complete 2,990-test and 22-browser-test
runs pass. Final mobile inspection then found a shared camera resize/reset bug:
aspect changed without fit distance, and reset retained drag inertia. Resizing
now preserves orbit, pan and relative zoom at the new fit distance; reset fits
the current viewport and clears pending inertia. Narrow-field views allow more
zoom-out room. Desktop, mobile, zoomed orbit and source overlay are inspected.
Two actual-vertex/reset tests and a rendered-foreground browser test cover the
failure. The rebuilt app and all **2,992 numerical tests pass** (code 0, no signal,
241.334 seconds). All **23 browser tests pass**, including all 507 canvases and
the new mobile/reset test (code 0, no signal, one worker, 865.566 seconds). Final evidence
is in artifacts/review/064-reconstruction.json and reconstruction notes.

**031's reopened worm audit is repaired, integrated and verified.** The
shared spherical cutter bound and neighboring-cell erosion are replaced by the
continuously refined cylindrical generator. Source inspection favors 29
regularized teeth over the earlier 30; the starting phase, shaft overhangs and
shaft thickness now follow that source fit. The unchanged Brown scan comparison
covers 71 boundary readings, with maximum errors below 23.736 pixels for the
wheel, 21.359 for the worm, 5.799 for the shaft and 4.001 for the hub. Tooth count,
pressure angle and hidden dimensions remain reconstruction choices.

The final 65-pose worm sweep and eight-pair hardware sweep perform **259,692,596
combined surface checks with no penetration**. Working gaps are 6.054–14.616
microunits; actual contact-normal power residual stays below 1.252 percent. All
six physical solids are closed with outward normals. Doubling the generating
search changes the radial field by at most 3.56e-15. Exact mesh/transform equality
connects the audited candidate to production; a new test reproduces the stored
profile through the runtime fallback. Other contact tables remain byte-identical.

All four focused worm tests and the model kinematics test pass; the build passes
in 12.369 seconds. Six integrated source/oblique frames and the final overlay
are inspected. Playback takes two seconds per input turn and 58 seconds per
complete wheel revolution. All **2,994 numerical tests pass** (code 0, no signal, 267.253 seconds). The
full browser run passes 23/24, including all 507 canvases and 031 controls.
057 hits its 45-second overall timeout during mouse movement, then passes
unchanged on isolated rerun in 29.8 seconds (wrapper code 0, no signal, 31.331
seconds). The initial full-run failure/exit/trace are preserved; this is combined
passing coverage rather than a zero-exit claim for that full invocation. Both
desktop/mobile frames are inspected. See
artifacts/review/031-reconstruction.json and reconstruction notes.

065 is rebuilt, integrated and verified. Its rounded tapered tappet advances ten regularized studs
one pitch per turn and finishes each index at rest. The source-shaped stop
has two finite locking flanks, a bored pivot and a sharp cam-contact corner.
A rear foot reaches the input notch while the main stop and tappet occupy
separate axial layers. Unrelated rails and face rings are removed.

All 22 solids are closed and outward. The final 94-pose, 143-pair sweep checks
**41,110,054 surface samples without penetration** beyond the 1e-6 tolerance.
Actual triangle-contact checks pass at 65 indexing poses and ten locked
orientations, with positive quasistatic reactions and no free velocity
direction in the dwell constraints. Maximum normal relative-speed residual
is 0.001822 model units/s. Initial strike impulses, loaded inertia and shaft
bearings remain idealized. Earlier rounded-toe contact loss, toe-foot
interference and mesh topology failures are archived with their failed results.

The inspected Brown overlay covers 77 boundary points and ten stud centers.
Maximum errors are 27.465 pixels at the cam, 22.940 at the tappet, 8.047 at the
stop and 6.055 at the output rim in the 1400-pixel crop. The irregular source
pattern is regularized; exact superposition is not claimed. A five-second
input cycle leaves about 0.398 seconds for the short indexing action.

All **six focused tests and 3,000 numerical tests pass** (full command code 0,
no signal, 235.987 seconds); the build passes in 12.429 seconds. Exact mesh
buffers and five pose transforms connect the audited candidate to production.
Nine integrated source/oblique frames are inspected; the gallery contains
284 comparisons. All **25 browser tests pass**, including all 507 canvases and the new 065
controls test (13.3 seconds). The full invocation exits 0 with no signal in
896.673 seconds, with no retries. Desktop and mobile captures are inspected. See
artifacts/review/065-reconstruction.json and reconstruction notes.

066 is rebuilt, integrated and verified. Its source-sized gravity weight, finite pin and
half-cut sleeve now use energy-balanced gravity/drag dynamics with exact
release/catch events. A fitted 26-tooth generated wheel and shifted solid
worm replace the old 20-tooth wire-worm arrangement. All **3,009 numerical
tests and 26 browser tests pass**, with no retries, along with the build. The 65-pose worm sweep passes 92,228,630 surface samples,
positive contact torque and a 1.494% maximum force-power residual. Complete
hardware and source-fit evidence is recorded in the 066 reconstruction notes.
Ten integrated frames, the source overlay and desktop/mobile views are
inspected. Complete hardware and worm sweeps total 448,000,888 sampled
checks without penetration. The four baseline images are preserved as
066-original-phase files; the current gallery has 292 comparisons.

067 is rebuilt, integrated and verified with a source-shaped scalloped plate,
finite pin and half-cut sleeve, event-resolved gravity motion and generated
24-tooth worm drive. All ten focused tests, **3,019 numerical tests and 27
browser tests pass**, along with the build. The complete candidate has
437,633,078 sampled hardware/worm checks with zero penetration; force and
energy audits pass. The common source overlay, ten integrated views and
desktop/mobile frames are inspected. Exact buffers and eight pose transforms
connect the audited candidate to production. The browser invocation exits 0
with no signal or retries in 960.355 seconds. Interrupted initial numerical
and build logs are preserved alongside successful rerun records. The gallery
contains 298 comparisons at the 067 checkpoint.

068 is rebuilt, integrated and verified. All **3,026 numerical tests and 28
browser tests pass**, along with the build. The browser invocation exits zero
with no retries in 970.409 seconds, including all 507 rendered canvases.
The replacement uses a traced tapered tooth, ten U notches and circular
locking hollows. All six solids pass topology and normal checks. Exact
buffers and ten pose transforms match the audited candidate. The corrected
motion passes **42,701,508 actual surface checks** over 83 poses and all
nine moving-part pairs, with no penetration above 1e-6. All 136 active
contact-force poses and twenty locking poses pass. Both load directions at
all ten notches clear at their seats and block attempted overtravel.

An exact entry knot prevents drift before contact; refinement keeps the
peak speed at 1.9517 rad/s. The four-second input cycle gives about 0.476
seconds for the index. Resisting load, bearing resistance and engagement
impacts are explicit quasistatic assumptions; unloaded coasting is not
certified. All seven focused tests pass. Ten integrated front/oblique frames,
the source overlay and desktop/mobile views are inspected. Earlier failed candidates and the
four original baseline images are preserved. Source-fit errors and detailed
evidence are in artifacts/review/068-reconstruction-notes.md.

The 068 checkpoint includes 314 gallery comparisons. Earlier inspected UI
images are preserved; fresh regression copies are archived separately.
At the 068 checkpoint, all 770 files matched its verification snapshot.

069 is rebuilt, integrated and verified with thirty asymmetric teeth and the
broad source-traced driver. All **3,034 numerical tests and 29 browser tests**
pass, with no retries, along with the build and eight focused tests. The full
browser run exits zero in 977.903 seconds, including all 507 rendered canvases. All six solids pass topology checks.
The actual sweep passes **38,176,776 surface checks** over 86 poses and nine
moving pairs. All 124 drive-force cases and 60 locking-force cases pass;
both seats at all thirty teeth clear and block attempted overtravel.

The final locking transition is resolved from actual Float32 rim-junction
contact, closing the two-tooth index exactly. A three-second input cycle gives
about 0.813 seconds for the index. The short internal pause assumes passive
bearing resistance, with a resisting load and idealized engagement impacts.
All ten integrated front/oblique frames and both candidate source overlays
are inspected. The complete 201-reading source fit has a largest residual
of 28.066 pixels on the 1150-pixel-wide Brown crop. Details, earlier failed
trials and reference limitations are preserved in the 069 reconstruction notes.
Both desktop/mobile captures are inspected. At the 069 checkpoint, all 775
verification files matched and twelve historical UI images were restored from verified backups.
The 069 checkpoint contains 324 comparisons, including failed baselines.

070 is rebuilt, integrated and verified; all eight focused tests,
**3,042 numerical tests, 30 browser tests and the build pass**. The full
browser invocation exits zero without retries in 1,007.116 seconds, including
all 507 rendered canvases. Both desktop/mobile captures are inspected. The source
arrangement has one stud inside the rim and adjacent studs locking against
its exterior. The measured circles and traced tappet need only a 1.103-pixel
spacing change and a 1.486-pixel tip adjustment. Closed-form contact events
give one exact 36-degree step per turn, including a short resisted pause
before final rim seating. All eighteen solids pass topology checks.

The full 070 sweep passes **452,216,700 actual surface checks** over 117
poses and 65 moving pairs without penetration above 1e-6. All 189 active
force cases and twenty locking-force cases pass. All twenty seats clear
and block attempted overtravel. The common source overlay retains 153
readings; the largest residual is 35.710 pixels at a stud center. Ten
candidate and ten integrated views plus the overlay are inspected. A
five-second cycle gives a 0.512-second main stroke. Original failed models
and coarse-stud trials are archived. All 780 verification files match, and
fourteen historical UI images are restored from verified backups. The 070
checkpoint contains 334 comparisons.

071 source, numerical and rendered baseline diagnosis is complete. Its current factory
is unchanged. The 44-pair working-surface sweep finds 2,813 penetrating
samples among 14,216,800 checks, including a guard/stud collision. All 97
claimed drive-force poses have the wrong output moment. The source has ten
marks on the main stud orbit and an additional inner circular mark whose
role remains unresolved. All 25 initial three-interior-stud opening trials
require disconnected motion and are rejected. Four baseline 3D frames are
inspected and hashed; the gallery now has 338 comparisons. Both official
070 and 071 animation tabs are unavailable.

071 remains mechanically unresolved after additional finite-pin studies. The
upper guard blocks the entering stud; source-like angled notches also jam.
Extra-pin, spacing and tip variants do not establish a valid replacement.
Fine long-tip projection exposes overdrive and high peak speed, not acceptance.
Detailed results and their limits are retained in its reconstruction record.

**037, 063 and 071 remain mechanically unresolved. 031, 064, 065, 066, 067,
068, 069 and 070 are verified. Review continues at 072; the complete
507-movement review remains active.**

072 now has a source-shaped isolated candidate; it is not integrated. Its
baseline sweep finds 3,990 penetrating samples in 38,555,868 checks. The
replacement uses four measured circular cam flanks, a finite rounded nose,
gravity release, the shaped hammer/workpiece and a supported blind pivot.
All fifteen solids pass topology checks. The complete candidate sweep passes
392,126,508 samples over 146 poses and 68 moving pairs without penetration
above 1e-6. All 192 physical contact-force cases pass. Rendered mass properties
match the motion model; the cycle energy residual is 3.17e-9 per unit mass.

The common 169-reading source fit has a maximum error of 14.388 pixels on the
1910-pixel crop. Eight baseline frames, nine candidate views and the overlay
are inspected. Failed event-classification and force-differentiation checks
are preserved with their corrections. All 780 files from the verified 070
production snapshot still match. Runtime export, integration, dependent tests
and full regression remain pending. See 072-reconstruction.json and notes.

072 is now rebuilt, integrated and verified. The runtime preserves all fifteen
audited mesh buffers and 1,245 gravity knots, while replacing startup polygon
union and integration with exported contours and exact contact equations.
The registry comparison covers 10,076 poses and all nine inspected candidate
transforms. Movement 353's dependent comparison is migrated. All sixteen
focused tests, **3,050 numerical tests**, the production build and **31 browser
tests** pass. The browser run renders all 507 movements with one worker and
no retries. All **785 verification source hashes** match after the run.

Eleven integrated 072 views, desktop/mobile controls and a scrolled mobile
notes view are inspected. Sixteen historical UI images are restored from
checked backups, with this run's replacements archived separately. Display
timing is three seconds per blow and twelve seconds per full cam revolution.
The prior candidate-only review and initial runtime join-boundary failure
remain archived. See 072-reconstruction.json and 072-reconstruction-notes.md.

073 baseline diagnosis now requires reconstruction. The enlarged source has
**ten ratchet teeth**, while the current factory and tests require eight.
The 174-pose working-surface sweep finds **2,209 penetrating samples** in
**5,069,142 checks**: each spring enters the opposite contact pad. At all 55
indexing force samples, the prescribed B/C contact normal is purely axial and
cannot provide the imposed in-plane deflection under frictionless contact.
Selected actual spring-skin distances also show a 0.00211075 gap at declared
pressing contact. The catch pad itself has the correct ratchet-driving force
sign. Six baseline frames are inspected and preserved.

073 has an isolated ten-tooth circular-flank profile and measured spring
centerlines. Its upper source flank fits thirty readings to 0.558-pixel RMS;
the driver circle fits twenty-nine readings to 2.166-pixel RMS. The source
animation is unavailable. Initial readings that hit lettering and an initial
biased spring centerline are preserved with their refinements. The original
profile study does not constitute a 3D replacement.

073 now has a coupled elastic/contact study with a source-fitted continuous
spring taper, independently checked gradients, and separate reactions on both
sides of a tooth seat. The selected planar leaf layouts lose wheel restraint
near release, even with C four times stiffer. Fixed-wheel diagnostic solves
confirm both tips clear the wheel's entire circumcircle after release, with
beam residuals below 1.49e-7. This is an unresolved 3D arrangement, not an
accepted replacement. Failed studies and cancelled superseded runs are
preserved in 073-elastic-checkpoint.json. All 785 verified production hashes
still match. Source review proceeds to 074 while 073 remains open.

074 baseline reconstruction is now required. Eight inspected source/comparison
frames show overly broad bevel faces, a missing central opening and long
shafts meeting at the common apex. The corrected 291-pose sweep finds
**14,340 penetrating gear samples in 8,652,012 checks**, with maximum depth
0.0546630, as C enters the still-stationary output. All three shaft pairs
intersect, producing another **316 penetrating samples**. Zero-area pole
triangles are excluded from the independently checked closed query boundary;
the earlier nonfinite-distance report and shaft-group probe failure are
preserved. Source tooth counts and pitch-cone ratios, a candidate rebuild
and physical entry/exit geometry remain pending. See 074-reconstruction.json
and 074-reconstruction-notes.md.

074 now has an isolated fitted contact candidate. Twenty source landmarks
fit to **12.168 pixels RMS**; a direct engraving overlay and the 3D views are
inspected. Its 32/40 tooth counts balance local tooth spacing and global rim
proportions; they are not claimed as exact source counts. Separate face
widths, short integral shafts and conical heel/toe surfaces restore the large
opening. Four end teeth receive contact-envelope relief.

All **87 solids** pass the closed-boundary and normal audit. The contact solve
completes three repeatable cycles, with local release maxima refined so a
receding flank does not drive the output. **93 force samples** have compressive
reactions with the correct moment ratio. Complete sampled hardware checks
and their exact counts are in 074-candidate-checkpoint.json. The ideal dwell
uses bearing friction, not a positive lock. At that candidate checkpoint,
runtime interpolation and final integration/regression remained pending.

074 is now **rebuilt and verified**. Its 5,047-knot runtime profile agrees with
20,184 independent contact solves to 3.1203e-7 radians. The actual interpolated
skins pass another **31,202,640 checks at 246 poses**, with no penetration over
1e-6. All 87 exported mesh buffers and world transforms match the audited
candidate, including 4,124 arbitrary times. Eleven integrated model views and
three UI frames are inspected. Input rotation takes eight display seconds.
Seven focused tests, **3,056 numerical tests**, the build and **31 browser
checks** pass against 789 frozen source hashes; all 507 entries rendered.
Eighteen historical UI screenshots were restored after saving the fresh
regression copies. See `074-integrated-checkpoint.json`.

075 requires reconstruction. The source shows a curved moving pawl and a
separate fixed holding pawl; the model instead has a large counterweight and
explicitly omits the holding pawl. The selected 102-pose audit finds **56,870
penetrating samples in 794,758 checks between independently moving parts**.
The rod pin enters the solid bar beneath a painted slot, and the carrier-hub
bevel shrinks its bore below the axle radius. The nominal ratchet bore also
degenerates to two XY points. Its co-rotating wheel/shaft overlap is recorded
separately as a possible integral join. Source tip readings and gravity-closing
directions are documented; exact tooth count and complete pawl contact remain
unresolved. Eight baseline mechanical views are inspected and preserved.
The baseline diagnosis is preserved in `075-reconstruction.json`.

075 is now **rebuilt and verified**, with both curved pawls, a real radial
slot and correctly bored joints. Its 14 finite solids pass topology checks;
21,004,344 independent-family surface checks find no penetration over 1e-6.
A further 1,028 finite-contact poses have maximum gap 6.5615e-7. The loaded
quasistatic model uses contact friction and omits inertia. Its 34-tooth profile
regularizes the drawing, and its cycle takes 2.4 seconds. Seven focused tests,
3,062 numerical tests, the build and all 31 browser checks pass against 794
frozen files. All 507 entries rendered. Thirteen integrated mechanical and UI
views are inspected; the eighteen historical screenshots were restored after
preserving fresh regression copies. See `075-integrated-checkpoint.json`.

076 is rebuilt and verified. Its complete coaxial driver turns clockwise,
its twenty-tooth count wheel turns counterclockwise, and its curved working
and holding pawls use actual bored joints and finite stops. The source pose
is the initial released condition; later turns start at the physical rest stop.
A twelve-second displayed revolution settles one tooth ahead after inertial
overtravel. The full driver and capped engraving section are both available.

Its 24 solids and mass/contact formulas pass independent checks. Three
simulated strikes count three teeth; loads 2 through 5 count one tooth per
revolution. The cache has a continuous primary-contact interpolation bound
within 1e-6, including all twenty tooth orientations. The production all-pair
screen covers 228 pairs, 207 poses and 54,642,530 actual surface samples with
no penetration beyond 1e-6. All 72 buffers and 44,150 poses match the candidate
exactly. Componentwise convergence failures remain recorded; a separate
assessment bounds the finest-step displacement difference by 0.223 source
pixels. Bearing resistance, material density and output load are reconstruction
assumptions. The contact-compatible regular teeth have ordered source-tip RMS
error 28.854 pixels; the source's spacing is irregular.

Eight focused tests, 3,069 numerical tests, the build and all 32 browser checks
pass against 802 frozen files. All 507 entries rendered. Eighteen integrated
mechanical/UI views are inspected, and historical screenshots were restored
after fresh regression copies were preserved. See `076-integrated-checkpoint.json`.

077 is rebuilt and verified. Its 24-pin wheel, high fulcrum, open spoke sectors,
bored joints and tapered finite pawls follow the source. The engaged pins fit
within 2.5 source pixels; the regular layout has overall RMS error 12.146 pixels.
Gravity, inertia and finite contact determine both free pawls and wheel motion.
Bidirectional output resistance and absolute angular damping are explicit
reconstruction assumptions. Each four-second displayed cycle advances one pin
pitch after the initial settling cycle, with about 82% moving time. Tiny
physical rollback is retained.

The 62-solid assembly passes 118,326,808 sampled surface checks at 275 poses.
Continuous primary-contact bounds remain within 1e-6. Secondary bounds keep
both pawls and fixed shafts separated, with real radial bearing clearances.
All 186 production buffers and 21,796 poses match the candidate exactly.
Observed finest-step displacement differs by at most 0.126338 source pixels.
Seven focused tests, all 3,075 numerical tests, the build and all 33 browser
checks pass against 812 frozen files. All 507 entries rendered. Fourteen
integrated images are inspected; eighteen historical browser images were
restored after fresh captures were preserved. See
`077-integrated-checkpoint.json` and `077-reconstruction-notes.md`.

078 is rebuilt and verified. Its 23 closed solids follow the engraving's
26-tooth open wheel, A-frame, rocker and nearly equal hooked pawls. The
undercut teeth are source supported; a hidden rear recess beneath the left
hook is an explicit reconstruction assumption. Finite contact, gravity and
inertia determine the free pawls and output wheel. Each four-second displayed
steady cycle advances one tooth clockwise, with physical startup settling
and tiny rollback retained.

Continuous face, layer, bore, capsule and frame bounds cover all 192
independent pairs through every interpolation interval and all 26 wheel
orientations within 1e-6. All 153,773 contact reactions pass independent
boundary and normal-cone checks. The final two time-step comparisons differ
by at most 0.187008 and 0.188089 source pixels; both pass, without a claim of
monotonically decreasing spatial error. Positive work residual decreases.

All 69 production buffers and 33,758 poses match the bounded candidate.
The production surface screen covers 307 poses and 84,041,118 mesh samples
without intrusion beyond tolerance. Seven focused tests, all 3,081 numerical
tests, the build and all 34 browser checks pass against 823 frozen inputs.
All 507 entries rendered. Fourteen integrated images and eight preview images
are inspected. Eighteen historical browser images were restored after fresh
copies were preserved. See `078-integrated-checkpoint.json` and
`078-reconstruction-notes.md`.

079 is rebuilt and verified. Its 37 closed solids follow the measured rim,
five joints, independent arms, fixed-length rods and 33-tooth axial face
ratchet. Gravity, inertia, finite tooth contact and ideal hinge preload
determine the free wheel and pawls. The concealed journal and preload details,
material density, damping and output resistance are reconstruction assumptions.
The settled wheel advances four teeth clockwise per four-second displayed
input cycle without stopping; physical startup settling is retained.

The finest sixteen-second dynamics have 64,001 states. The last time-step
comparison differs by at most 0.103462 source pixels. Compression and one
interior contact projection add at most 0.000391529 pixels, giving a combined
observed-agreement bound of 0.103854011 pixels. Continuous bounds cover every
one of the 9,004 playback intervals, all 33 tooth orientations and all 538
independent pairs within 1e-6. All 113,064 contact reactions pass independent
surface, normal-cone and moment checks, including two resolved edge-midpoint
cases whose original flags remain preserved.

The candidate passes 15,195,512 actual surface samples at 97 poses. Production
matches all 110 buffers and 31,256 poses exactly, with additional focused
production surface checks. Seven focused tests, all 3,087 numerical tests,
the build and all 35 browser checks pass against 835 frozen inputs. All 507
entries rendered. Fourteen integrated images and the final ten candidate
preview images are accepted. Historical browser images are restored after
fresh copies are preserved. See `079-integrated-checkpoint.json` and
`079-reconstruction-notes.md`.

080 is rebuilt and verified. Its sixteen closed solids follow the finite
slot, flared rack, sixteen teeth per side, tapered lever and long crossed
hooked pawls. Gravity, inertia and finite contact determine the rack and free
pawls. The ideal prismatic rack constraint, hidden axial relief, density and
drag are explicit reconstruction assumptions. Startup seating and handoff
rollback are retained. Each input cycle takes four display seconds; the
ten-second demonstration holds its raised final pose and offers Replay.

All 228,333 contact reactions pass boundary, normal and moment checks.
Continuous primary bounds cover every one of the 3,900 playback segments
through 6,008 proof intervals within 1e-6. The other 79 independent pairs
retain their complete layer, bore, slot and hull bounds. The loaded candidate
passes 3,270,960 actual surface samples at 101 poses. Time-step agreement plus
compression totals 0.237842698 source pixels; this is observed numerical
agreement, not an exact continuum-error guarantee. The energy audit passes.

Production matches all 48 buffers, the complete profile and 11,810 poses
exactly. Eight new focused tests, all 3,094 numerical tests, the build and all
36 browser checks pass against 850 frozen inputs. All 507 entries rendered.
Forty candidate and seventeen final integrated stills are inspected. Desktop
and mobile completion, pause, Replay and framing pass. Eighteen historical
browser images were restored after fresh copies were preserved. Earlier
mechanics failures and two corrected test/capture issues remain archived.
See `080-integrated-checkpoint.json` and `080-reconstruction-notes.md`.

081 is now rebuilt and verified. Its 24 closed solids follow the measured
six-tooth wheel, seven-tooth rack, spring and guide proportions. Finite tooth
contact, inertia, gravity and a Hookean spring determine motion. The hollow
rack, fixed internal mandrel and rear slot stop are explicit reconstruction
assumptions. The mandrel stays engaged while the lower guide is vacated at
high lift. Playback preserves startup and repeats the settled cycle in four
seconds.

All 17,746 positive contact reactions and energy checks pass. The loaded
surface screen covers all 183 independent pairs, 101 poses and 39,074,016
samples without intrusion beyond tolerance. Continuous hardware bounds cover
176 pairs; the other seven use finite gear/rack contact. New continuous spring
cell checks complete the earlier nonlocal-turn clearance bound. Projection of
the compressed trajectory is bounded to 0.002 engraving pixels over every
knot interval. Measured time-step agreement plus compression, projection and
spring deformation sensitivity totals 0.205304784 pixels; this is not a
continuum-error guarantee.

Production geometry and motion match the independent candidate. All 3,100
numerical tests, the build and the targeted 081 desktop/mobile browser check
pass. Thirteen final app/source/motion views are inspected; browser playback
averaged 52.41 fps with 1.5 ms 95th-percentile model updates. The 25 saved study
sources are unchanged, and the current map freezes 904 inputs. Earlier
failures remain archived. No new all-507 browser pass is claimed: the last
attempt timed out after movement 482. See [the 081 review](../artifacts/review/081-reconstruction-notes.md)
and its local integrated checkpoint.

086's complete 42-part candidate now passes its motion, force, energy,
repeat-state and continuous-clearance checks. The fine study has 371,396 states;
all 728,394 reactions and 170,952 smooth stages pass, with signed/absolute work
defects of 0.09676%/0.09680%. The corrected coarse study also completes. The
final display profile contains 4,988 poses and retains startup before repeating
the settled cycle at four display seconds per input revolution.

All 4,987 playback intervals pass the seven primary contact-pair bounds.
Whole-motion bounds cover the other 629 independent rigid pairs, and separate
rope bounds cover all 41 surrounding parts plus self-clearance. Across all
392,236 common numerical/display intervals, combined step/compression bounds
stay below 0.25 engraving pixels: 0.018694353 for rigid parts and 0.249935584
for the actual polygonal rope, including mesh and Float32 allowances. These
compare supplied numerical profiles; they do not establish exact continuum
error. Failed intermediate bounds and their sources remain archived.

Ten refreshed views are inspected. With the numerical jobs stopped, the final
preview measures 22.48 fps and 1.9 ms p95 model updates on SwiftShader, with no
browser errors. That qualified candidate is now integrated in production.
All 9,975 knot/midpoint poses, 418,950 part transforms and 26,733,644 checked
attribute values match exactly. The six focused tests cover finite contacts,
closed solids, bored guides, rope attachments/length, buffer reuse and the
repeat seam. All 3,113 numerical tests, the build and the targeted desktop/mobile
browser test pass.

Twenty-three integrated views are inspected, including a source overlay and
front/oblique views of the actual overhead trip contact. Final production
playback measures 23.13 fps and 1.5 ms p95 model updates on SwiftShader.
Continuous camera bounds include the entire rear input and guided pump; the
four-second cycle repeats indefinitely. The first capture's review script
mistook the total playback limit for the cycle duration; its failed assertion
and exact sources remain archived. The corrected capture passes without model
changes. Of the previous 972 frozen inputs, 968 are unchanged; the four edited
files replace only 086's factory, tests and display entry. All other 506 display
profiles are unchanged. The 082/083 studies remain intact. No new all-507 browser
pass is claimed. See the
[086 reconstruction review](../artifacts/review/086-reconstruction-notes.md).

087 now has an isolated 207-part reconstruction with the face-on input ring,
open wheels, source-measured joints, a real curved slot and a fixed-length
connecting rod. All solids pass topology checks. The three bevel pairs pass
2,362,308 surface samples, and all 17,740 independent pairs pass either mesh
bounds or 1,259,886 surface samples at the source pose. Ten final browser views
are inspected. Failed sphere, jaw and key-clearance studies remain archived.

The measured linkage exposes a reversal problem: F passes vertical after
42.15 degrees, but G is outside the stud's entire swept envelope after about
47.41 degrees. A symmetric 84.30-degree flip is therefore unreachable with
this geometry. The quadrant/shifter coupling needs further interpretation;
no reversal animation or continuous-clearance pass is claimed. Production and
all 1,097 frozen inputs remain unchanged. See the
[087 reconstruction review](../artifacts/review/087-reconstruction-notes.md).

087 also has a separate 213-part lost-motion hypothesis informed by a period
weighted-clutch analogue. A finite follower traverses the curved slot for
76.31 degrees before shifting D; the full diagnostic swing is 83.93 degrees.
The contact-direction study shows why mere stud reach is insufficient: within
the tested equal-pin-adjustment family, 51 source pixels permit reach, but
70 are needed for useful return torque. The current 75-pixel version is an
explicit and visible departure from Brown's proportions, not an accepted
source reconstruction.

After correcting weight/shifter and spacer/rod collisions, all 213 solids and
26 diagnostic forward/return poses pass 7,120,408 native surface samples.
Fifteen final stills are inspected with no browser errors or unexpected
warnings. Motor/output angles remain fixed during this screen; gravity,
native stud-driven motion, loaded clutch contact and continuous clearance are
still pending. The measured 207-part candidate, production and all 1,097
frozen inputs remain unchanged. See the
[087 lost-motion study](../artifacts/review/087-lost-motion-notes.md).

087's exact native stud/G edge check now exposes a 1.545-pixel overlap in the
unchanged source pose that earlier surface samples missed. Corrected contact
phases remove it in the new lifting poses. All 258 native contacts agree with
full-solid 3D witnesses within 1.34e-14 world units. Independent gap derivatives
confirm useful force transmission through the rod on both lifting strokes.
The 213-part model passes 26,588,934 surrounding-hardware surface samples at
18 rotating lifting poses, and all 13 new views are inspected. Other hardware
pairs still have sampled, not continuous, clearance evidence.

A broader pin-direction search only reduces the common displacement to
73.5 pixels at the previous smooth-contact margin within its tested family;
it does not resolve source fidelity. The existing geometry and production
remain unchanged. Gravity fall, impact/release behavior and loaded clutch
reversal still need to connect the two lifting branches. See the
[087 native contact review](../artifacts/review/087-native-contact-notes.md).

087 now has timed unilateral lift/release/gravity-flight trajectories in both
directions, ending just before the opposite slot end transfers momentum to the
fixed shifter. Native component masses provide variable linkage inertia and
gravity; independent rendered-transform checks verify those quantities. Five
time-step levels reach 175,251 finest states, with absolute energy defects of
0.06061% forward and 0.02893% on return. A separate finer study resolves the
initial return release and recontact instead of smoothing away its facet event.

All sixteen selected hardware poses pass 24,409,000 native surface samples,
and the active stud/G pair receives independent exact polygon checks. Twelve
new still views are inspected; both partial timed previews finish without
browser errors. The full clutch transition, continuous clearance, source
fidelity and final playback speed remain unresolved. The existing factories
and all 1,097 frozen production inputs remain unchanged. See the
[087 inertia and first-flight review](../artifacts/review/087-first-flight-notes.md).

087's next isolated stage now transfers momentum through native slot and fork
contacts into D, with output rotation as a fourth independent coordinate. The
first constant-output-speed controls missed gravity torque from E's eccentric
stud; the corrected model includes it and changes the return contact flank.
Three time-step levels reach 31,155 finest states with absolute energy defects
of 0.005035% and 0.004355%. Both separately computed native jaw impacts reverse
the shaft, with compressive impulses and balanced momentum/energy.

Twelve final shift poses pass 18,237,132 surrounding-hardware surface samples,
supplemented by exact native jaw, slot and fork checks. Twelve rendered views
are inspected, and both slowed inspection previews finish without browser
errors. Loaded seating, initial engaged-jaw preload, a repeating cycle, source
fidelity and continuous clearance remain pending. Production and all 1,097
frozen inputs remain unchanged. See the
[087 clutch-transition review](../artifacts/review/087-clutch-transition-notes.md).

087 now reaches loaded seating in both directions and checks holding through
the next native stud contacts. Direct refinement of the jaw corners corrected
a sub-microunit interpolation error that had produced a false holding-release
diagnosis. The refined model supports the held states, but **both clutches cam
out when the next lifting stroke starts**. Output speeds change from −0.120 to
−0.002298 and +0.120 to +0.039550 at those impacts. Half-time-unit continuations
confirm 0.018668 and 0.016784 units of withdrawal. The current frictionless jaw
and lost-motion interpretation cannot be accepted as a complete reversal.

The selected seating runs contain 136,700 states, with native jaw discrepancies
below 1.98e-7. Their final settling times remain unresolved to five milliseconds.
Fourteen hardware poses pass 21,135,730 surface checks plus native jaw, slot,
fork and stud checks. Ten new still views are inspected; both slowed seating
previews complete without browser errors. Retention, source proportions,
continuous clearance and final whole-cycle speed still need work. Production
and all 1,097 frozen inputs remain unchanged. See the
[087 loaded seating and retention review](../artifacts/review/087-loaded-seating-notes.md).

087's next retention study exposes the actual feather clearance by giving D
and the shaft independent spin coordinates. Native key contacts and an explicit
dry static/sliding friction hypothesis retain the clutch through both lifting
strokes, then allow withdrawal when F reaches the far quadrant-slot end.
Return motion crosses the key clearance twice as the load changes direction;
those transients alter the lift and release timing and are not snapped away.

The finer extended runs contain 43,768 states. Coarse/fine release times agree
within 0.00075 model time units, with independent momentum, friction and native
contact checks. Twelve hardware poses pass 18,516,688 surface samples, and all
ten new still views are inspected. Both slowed previews finish without browser
errors. Material identity, a connected full reversal, source pin proportions,
continuous clearance and final display speed remain unresolved. Production
and all 1,097 frozen inputs are unchanged. See the
[087 key friction and release review](../artifacts/review/087-key-friction-notes.md).

087 now continues each key-friction branch through neutral travel, a native
opposite-jaw impact, loaded seating, held rotation and the following lift
without reassigning its state or motor phase. The first right-jaw impact does
not immediately reverse the shaft; that reversal develops during seating.
Native-cusp event refinement resolves a retained Newton iteration failure.
The finer neutral/seating runs contain 80,390 states, and the held/lift runs
contain another 102,752. Key preload changes during held rotation and is no
longer independently assigned when the next stud arrives.

One coarse following-lift transient fails its convergence check despite
matching the final lever position. Two finer local continuations from the
same held state reduce successive lever differences to 0.0017 degrees; the
failed report is retained. Independent free-shaft gravity integration,
momentum, friction and native contact checks pass. Sixteen hardware poses
pass 24,169,044 surface samples, ten stills are inspected and four slowed
previews complete without browser errors. Source pin proportions, material
identity, repeated full cycles, continuous clearance, final rendering/speed
and integration remain unresolved. Production and all 1,097 frozen inputs
remain unchanged. See the
[087 connected reversal review](../artifacts/review/087-connected-reversal-notes.md).

087's source fit now has a separate distributed-adjustment candidate. Its
maximum rendered landmark error falls from 75 to 26.67 source pixels, and
E's pinion is exactly coaxial with the output shaft. All 213 solids and the
source pose pass 1,466,392 surface samples. Both lifting branches retain
useful force direction at 258 native contacts; smaller stencils resolve one
retained derivative-check failure caused by crossing a polygon feature.

The nine inspected views expose a source-contour tradeoff: the stud now
protrudes 15.82 pixels beyond E's rim, where the engraving puts it inside.
Mean landmark error also increases as more points move. This candidate is
therefore retained as a comparison, not accepted as the final reconstruction.
The next fit must constrain the stud/rim relationship and broader outlines
before repeating dynamics and clearance qualification. Production and all
1,097 frozen inputs remain unchanged. See the
[087 distributed source-fit review](../artifacts/review/087-distributed-source-fit-notes.md).

087 now has a fixed-orbit fit that restores the stud's measured margin inside
E while limiting actual landmark shifts to 32 pixels. Registered native
contours improve in RMS over both earlier candidates, but mean contour error
still exceeds the 75-pixel candidate, so source fidelity remains unresolved.
All 213 solids, 258 native stud contacts and fresh rendered mass/gravity checks
pass. A retained initialization error confused preceding and outgoing stroke
directions; the corrected version explicitly checks incoming stud motion.

Two independent initial lifts retain the clutch under the existing friction
hypothesis through half a model time unit. Their 4,002 fine states pass balance
and contact checks, with coarse/fine position differences below 7.84e-5 radians.
Four endpoint poses pass 6,053,388 hardware surface samples; all 17 new stills
are inspected. Full release, connected reversal, repeated cycles, continuous
clearance, final rendering/speed and integration still need qualification for
this changed geometry. Production and all 1,097 frozen inputs remain unchanged.
See the [087 fixed-orbit review](../artifacts/review/087-fixed-orbit-notes.md).

087's fixed-orbit candidate now continues through full lifting, free fall,
clutch withdrawal, native opposite-jaw impact, seating, held rotation and
the following stud encounter. The integrated positions and input clock are
preserved throughout; neither subsequent key preload nor stud phase is reset.
Independent free-fall and free-shaft integrations, step comparisons and native
contact checks qualify these bounded continuations.

A retained following-lift failure exposed a premature stud impulse at a tiny
positive gap. Restricting stud velocity activation to the jaw contact tolerance
and refining the local steps reduces its complementarity residual from
1.41e-8 to 6.21e-14. The unchanged held prefix and earlier independent hold-step
comparison remain explicit. An exact triangle-query optimization also matches
142 reference queries while reducing this local query time by about fourfold.

The qualified transfer, seating and following studies contain 76,004 stored
states, including shared boundaries. Twenty-eight hardware poses pass
43,124,924 surface samples; 26 new stills are inspected and six slowed preview
executions finish without browser errors. Repeating full cycles, source
acceptance, material identity, continuous clearance, final speed and production
integration remain unresolved. All 1,097 frozen production inputs are unchanged.
See the [087 fixed-orbit connected reversal review](../artifacts/review/087-fixed-orbit-transfer-notes.md).

087 now completes a second connected transfer on each initialized branch,
returning to the original engaged side without resetting any physical state
or motor phase. Both initial coarse runs stop at unmeasured next-tooth phases;
16,768 new native queries supply those actual tooth profiles. Their exact
stopped prefixes are preserved in the completed coarse continuations.

The 26,487 fine states pass balance, friction, contact, independent free-fall
and step-size checks. Seating times differ by at most 0.000561 model time
units. Twelve hardware poses pass 18,137,424 surface samples; all twelve
stills are inspected and two slowed previews finish without browser errors.
Longer repeat sequences, source acceptance, continuous clearance, final
playback and production integration remain pending. All 1,097 frozen
production inputs are unchanged. See the
[087 second-transfer review](../artifacts/review/087-second-transfer-notes.md).

087 now has four connected reversals on each initialized branch. The third/fourth-transfer checkpoint checks 198,010 fine states, four newly measured native tooth profiles and independent free-linkage/free-shaft integrations. Maximum coordinate and event-time differences are 0.00018808 and 0.00032757. Thirty-two hardware poses pass 48,691,568 surface samples; 24 stills are inspected and two slowed previews complete without errors or unexpected warnings. Three signal-terminated workers retain their published prefixes, and a bounded continuation recomputes the unfinished CCW fourth transfer from its exact preceding endpoint. Further fifth/sixth studies continue outside this checkpoint. Source acceptance, continuous clearance, final playback and integration remain pending; production is unchanged. See the [087 four-transfer review](../artifacts/review/087-four-transfer-notes.md).

088's current production model now has a measured source diagnosis. One outer-disk registration leaves a mean cam-contour discrepancy of 24.14 source pixels and an input-axis displacement of 22.93 pixels, beyond the approximate 3-pixel tracing uncertainty. The actual point noses do reach a cam edge with a usable driving normal; an initial axial-only contact hypothesis was rejected and retained. Finite stop construction and prescribed drive/dwell velocity jumps still need mechanical review. Four corrected stills and one registered overlay are inspected, with no errors or unexpected warnings in the final capture. Production is unchanged; 088 is not qualified. See the [088 production diagnosis](../artifacts/review/088-production-review-notes.md).

087's contact-integrated reconstruction is now in the application. Two reversals
repeat over a 24-second display cycle while the motor keeps its accumulated
angle. Matching settled endpoints close within 1.8e-13, with no substituted
endpoint. The promoted geometry matches all 213 candidate solids; rigid pin
closure and 268 native-contact poses pass through four playback periods.
The build and all 174 selected tests pass, including camera checks for all 507
models. A complete browser cycle and 13 inspected captures cover both transfers,
the seam, the source overlay and desktop/mobile views. The fifth connected
reversal also passes on both initialized numerical branches. Source-proportion
differences and continuous solid clearance keep 087 under review. The old
086 source baseline is preserved; a new integration snapshot records the four
changed existing inputs and the added 087 modules. See the
[087 integration review](../artifacts/review/087-integrated-playback-notes.md).

088 now uses the traced cam, broad stepped stop feet and contact-integrated
indexing in the application. The centered wheel repeats exact half-turn stops
and an eight-second two-index display cycle, with continuous input/output
angles. Step-halving, impulse/energy, seven solid poses, all playback-interval
midpoint contacts, the build and 178 selected tests pass. Fourteen rendered
views and a complete browser run are inspected. The inferred hidden axle
requires an approximately 11-pixel rear-rim shift, and the stepped-foot
construction remains a reconstruction choice; 088 is integrated and under
review. See the [088 integration review](../artifacts/review/088-integrated-playback-notes.md).

089's flange, wrist and crosshead hardware now implements the intended joints.
Two through-bolts join bored, abutting flanges; the rod eye swings between
bored fork cheeks, and channel guides retain the crosshead. The motion stays
continuous on the existing exact linkage equations, with a four-second
cycle. Focused native-geometry and analytic sweep checks cover the changed
joints. Source proportions and the remaining strap/shaft hardware still
need reconstruction and clearance review. See the
[089 joint correction](../artifacts/review/089-joints-review-notes.md).

089 now follows the traced circular outlines, bored split lugs, stepped sheave,
flange and rod. Exact offset-slider closure, 43 closed solids, 302 source ink
points and continuous running-clearance bounds pass. The build, 173 selected
tests, six final focused tests and 13 inspected browser views are recorded.
Depths, bearings and the completed output/support arrangement remain explicit
reconstruction choices. See the
[089 source reconstruction](../artifacts/review/089-source-reconstruction-notes.md).

MuJoCo is now the default engine for continued reconstruction. The 082 pilot
is integrated into the normal catalog with shared lazy loading, fixed physics
steps, restart and allocation cleanup. Fifteen simulated cycles pass the
native pawl/tooth and strap checks, with both pawls repeatedly engaging and
releasing. The inferred lower-pawl spring and approximate belt traction remain
explicit reconstruction assumptions. Other entries retain their current models
until migrated and checked. See the [MuJoCo integration](mujoco-integration.md).

083 now runs live MuJoCo contacts in the catalog. The traced pierced sectors,
complete crown wheel, ordinary-pin rod, radial spring guides and completed
supports replace the old prescribed bars and lifts. Fifteen cycles advance
118.8944 teeth with at most 0.01553 tooth retreat; 600 native contact poses have
at most 0.20824 source pixels of penetration and 0.00849 pixels of pin error.
Five poses pass 1,739,316 native hardware surface samples across 84 closed solids.
The build, 17 focused tests, six browser tests and fourteen inspected rendered
views pass. Hidden construction and contact parameters remain assumptions;
step-halving still changes brief sector-drop positions by up to 4.623 source
pixels. 083 is integrated and remains under mechanical review. See the
[083 MuJoCo reconstruction](mujoco-083-spring-sectors.md).

073 has a new isolated MuJoCo experiment with spatially bending leaves. It
demonstrates dynamic recovery of C after both wheel contacts are briefly lost,
resolving the stopping point of the older quasi-static study. Three cycles and
six native solid poses run successfully, but rollback reaches 0.73186 tooth.
The enlarged source also exposes an inherited rounded-tip mismatch at C's
obliquely cut end. Nine candidate views are inspected. Source end reconstruction,
complete hardware, refinement and acceptable indexing remain open; production
073 is unchanged. See the [073 dynamic study](mujoco-073-spring-study.md).

The next 073 checkpoint replaces the ideal repeated ratchet in the isolated
candidate with ten separately traced cubic flanks (0.6542-pixel pooled RMS on
800 reserved readings), and gives C an obliquely cut finite end without its
added round tab. The source overlay and nine dynamic views are inspected.
Three cycles advance 3.03253 nominal teeth, but rollback still reaches 0.65645
tooth. Six poses have 51 closed solids and no topology errors across 2,310,564
surface samples; six directed contact findings reach 0.02782 source pixels
of overlap. The cut location and axial construction remain assumptions. B's end,
complete hardware, refinement and acceptable indexing remain open; this is
source-reconstruction progress, not a finished 073 migration.

073's isolated candidate now also uses B's measured flat end without a contact
tab. A planar rest arrangement and MuJoCo NoSlip improve the first three cycles,
but the ten-cycle run still has 0.35696 tooth rollback, and both timestep and
beam-resolution checks fail to establish convergence. Nine candidate views and
six native solid poses are inspected. The entire first beam cell is currently
fixed, so its effective clamped length changes with resolution; correcting that
boundary is the next concrete solver change. Production 073 remains unresolved.

The 073 clamp boundary is now corrected using half-cell bending compliance.
An independent MuJoCo cantilever test converges to the analytical deflection
with 0.78124%, 0.19530% and 0.04882% error at 8, 16 and 32 cells; the former
eight-cell boundary gives 17.96876% error. Three corrected ratchet cycles and
nine rendered views are checked, but changing from 24 to 36 cells still changes
the advance from 5.62068 to 3.68447 teeth. The overlap between rigid contact cells
is the next geometry issue to replace and check; the complete 073 migration
remains unqualified.

073 now has continuous finite contact leaves driven by its existing MuJoCo beam
bodies. The native contact boundary and rendered triangles match in independent
8/24/48-cell tests, and all five beam/runtime tests pass. Nine rendered views and
six native poses are inspected; four closed solids replace fifty overlapping
cell meshes. Small contact overlaps remain, and the three-cycle advance changes
from 5.59340 to 4.64735 teeth at 24 versus 36 cells. Halving timestep changes brief
wheel-rim positions by up to 8.90992 source pixels. Geometry is improved, but
resolution, complete hardware and real-time qualification still prevent migration.

The 073 study can now also use a rigid MuJoCo volume preserving the ratchet's
concavity and bore. An assembly preload holds its source phase while the leaves
settle, then releases A before playback; reset and release are regression-tested.
Seven focused tests, nine inspected views and six native solid poses pass their
structural checks. Small contact overlaps remain, and 24 versus 36 beam cells
still advance 5.59449 versus 4.64691 teeth over three cycles. The ratchet collision
representation therefore does not explain the main resolution sensitivity.
The 24-cell run takes 165.39 seconds for 18 simulated seconds; 073 remains isolated.

073's isolated study now supports a bounded adaptive ratchet outline: 225 points
replace 1,290 while the cubic chord error stays below 0.1 source pixel. Nine
focused tests and nine inspected views pass their structural checks. The probe
cost falls from 165.39 to 92.11 seconds for 18 simulated seconds. However,
transient wheel positions differ by up to 22.30344 source pixels from the dense
outline, so similar final advance does not establish acceptable dynamics.
A separate softer-contact trial also fails spatial refinement. Production 073
remains unresolved, including its constrained beam torsion and incomplete hardware.

090 now uses live MuJoCo in the catalog. The shaft alone is actuated; the passive
yoke moves through contact with straight bearing faces. Measured eccentric and
shaft circles, the traced rounded yoke ends, complete rods and bored guide
hardware replace the old oversized prescribed-cosine model. Rectifying the
working opening changes the traced contour by up to about 5.7 source pixels;
the viewer and [reconstruction report](mujoco-090-eccentric-yoke.md) disclose
this correction and the inferred supports, rod extensions and ideal guides.
Eighteen focused tests and seven production browser tests pass. Ten turns at
1/0.5/0.25 ms stay within 0.118 pixels of the eccentric's horizontal position;
the 1/0.5 ms comparison stays within 0.226 pixels at every coarse tick. Twelve
views are inspected, the full stroke fits the camera, and the final browser
run averages 60 fps. 090 is verified within its stated reconstruction assumptions.

091 now uses live MuJoCo contact between a fitted constant-width triangular cam
and the passive yoke's two bearing liners. Its two dwells last about 0.796 seconds
each in a four-second revolution. The source overlay follows the cam, bowed yoke
and collar; clearing the continuous sweep changes the traced opening by up to
about 3.36 source pixels. Guides, rod extensions, rear hardware, axial dimensions
and the hidden small arc remain explicit reconstruction assumptions.
Twenty-two focused tests, eight production browser tests and the build pass.
Ten turns have at most 0.03069 source pixel of native soft penetration and
0.03490 pixel of interior dwell motion. Timestep and cam-chord refinement stay
within 0.1 pixel at every coarse tick; seventeen native solid poses, the
continuous opening bound and twelve inspected views pass. Live playback averages
60 fps. See the [091 reconstruction](mujoco-091-triangular-eccentric.md).
091 is verified within these stated reconstruction assumptions.

092 now uses MuJoCo hinges, a slider and a wrist closure. The shaft alone is
actuated; the rod and crosshead move through the native joint constraints.
Measured wheel, hub and pin circles replace the old proportions, and fitting
58 upper-opening readings gives 0.2512-pixel RMS for the curved spoke sides.
The measured 4.8664-pixel slider offset is preserved. Added guide shoes, pin
heads, rear support and depth remain explicit reconstruction assumptions.
Twenty-one selected tests, nine browser tests and the build pass. Ten turns
have at most 0.001857 pixel of wrist error, and 1/0.5 ms output differences
stay below 0.042 pixel. Thirty-three native poses pass 1,016,930 independent
surface samples without detected intersections. Twelve final views are
inspected and live playback averages 60 fps. See the
[092 reconstruction](mujoco-092-crank-slider.md). 092 is verified within its
stated source interpretation and ideal bearing constraints.

093 now uses a native wrist cylinder contacting the two straight faces of a
passive Scotch yoke. Measured disk, hub, shaft and wrist circles replace the
extra crank arm and old proportions. The slot is widened to contain the
measured wrist; completing the stems lets them stay within reconstructed fixed
guides throughout the stroke. These changes and all depths are disclosed.
Fifteen selected tests, nine production browser tests and the build pass.
Ten turns have at most 0.004657 source pixel of native soft penetration, and
1/0.5 ms output differences stay below 0.089 pixel. Thirty-three poses pass
1,155,696 independent surface samples with only bounded wrist/yoke contact.
Removing contact lets the output fall; reversing gravity engages the other
working face. Twelve final views and an additional scrolled mobile note view
are inspected, and live playback averages 60 fps. See the
[093 reconstruction](mujoco-093-scotch-yoke.md). 093 is verified within its
stated source corrections, ideal guides and soft-contact tolerances.

094 now uses a powered MuJoCo spiral plate and a passive bolt in a held radial
guide. A fit to 107 paired groove readings gives 1.2286-pixel centerline RMS;
individual radial-slot angles and the inner terminal circle follow the source.
A reconstructed stepped bolt preserves the narrow spiral, while slightly
widened radial slots accommodate its measured front end. These corrections,
the held translucent plate, supports and axial dimensions are disclosed.
Fifteen selected tests, ten production browser tests and the build pass.
Ten uninterrupted adjustments have at most 0.03043 source pixel of native
soft penetration; timestep and spiral-mesh refinement stay below 0.09 pixel.
Thirty-three poses pass 2,773,362 independent surface samples with only bounded
bolt/groove contact. Fourteen final views are inspected and live playback
averages 37.58 fps. See the [094 reconstruction](mujoco-094-variable-crank.md).
094 is verified for radius adjustment within its stated source corrections,
ideal radial guide and soft-contact tolerances; clamping and subsequent crank
operation are not simulated.

095 now uses MuJoCo contact between the inclined disk and a passive fork-held
roller, with the rod constrained by an ideal vertical guide. The input shaft
alone is actuated. Fitted disk faces have 0.4392/0.5289-pixel line RMS; measured
shaft and rod outlines replace the previous proportions. The disk's broken
left edge is completed, and a radial axle with real fork/wheel bores replaces
the detached spherical shoe. The roller interpretation, source corrections,
hidden hub, upper guide and wall depth are disclosed.
Fifteen selected tests, eleven production browser tests and the build pass.
Ten turns have at most 0.00388 source pixel of native soft penetration; timestep
differences remain below 0.024 pixel in rod height and 0.384 pixel at the roller
rim. Thirty-three poses pass 1,324,642 independent surface samples with only
bounded roller/disk contact. Fourteen final views are inspected and live playback
averages 59.69 fps. See the [095 reconstruction](mujoco-095-inclined-disk.md).
095 is verified within its stated roller interpretation, ideal bearing/guide
constraints and soft-contact tolerances.

096 now uses MuJoCo cam contact to move a passive horizontal bar and turn its
roller against an added return spring. Only the shaft is actuated. Measured hub,
shaft and roller circles replace the old proportions; the completed bar runs
through two bored guides. The finite-roller cam preserves uniform travel over
94.907% of the cycle with short smooth reversals. Its 124 independent source
outline samples differ by 5.3714 pixels RMS and 10.8898 pixels maximum. That
correction, a 6.4159-pixel bar alignment shift and the inferred spring are
explicitly disclosed. Fifteen selected tests, twelve production browser tests
and the build pass. Ten turns keep native soft penetration below 0.01370 source
pixel, timestep position differences below 0.020 pixel and roller-rim differences
below 0.304 pixel. Thirty-three poses pass 2,269,142 independent surface samples
with only bounded cam/roller contact. Fourteen final views are inspected and
playback averages 59.94 fps. See the [096 reconstruction](mujoco-096-heart-cam.md).
096 is verified within its stated source corrections, ideal spring/guide model,
finite reversal intervals and soft-contact tolerances.

097 now uses two Archimedean spiral flanks with short smooth reversals to drive
its passive bar through MuJoCo contact. The user's correction supersedes the
earlier varying-speed harmonic fit. The corrected walls differ from 270 source
face readings by 8.3850 pixels RMS and 15.6413 pixels maximum, preserving the
measured stroke endpoints. Fifteen selected tests pass; ten turns keep native
follower error on the working flanks below 0.067 source pixel and 100 ms
travel-speed error below 1.218%. Thirty-three poses pass 2,980,012 independent
surface samples without unintended intersections. Fourteen corrected views
are inspected. See the [097 reconstruction](mujoco-097-grooved-heart.md) for the
short reversal blends, finite-pin relief pocket, source corrections and fits.

098 now completes one circuit of its oblong groove per crank revolution. The
user's correction supersedes the earlier lower-branch-return interpretation.
The corrected 123.1877-pixel crank radius and 0.7826-pixel axis shift match both
radial ends of the measured groove. Only the input is actuated; contact and
inertia carry the passive arm through both ends at a two-second physical period.
Four mechanism tests pass, including ten full laps at three timesteps and two
mesh resolutions. Native soft penetration remains below 0.03027 source pixel;
dead-center timestep/mesh sensitivity remains below 0.362°. Thirty-three poses
pass 2,660,506 independent surface samples with no unintended intersections.
See the [098 reconstruction](mujoco-098-endless-groove.md) for the corrected
initial pin position, section cover, inferred bearings and operating limits.

Both corrected movements pass the production build and all 15 MuJoCo browser
tests. Fourteen 097 views and eighteen 098 views are inspected; frozen source
and image hashes are verified in the separate correction inspection reports.

099 now uses MuJoCo contact with adjacent turns of a spiral rail to drive a
passive feed rod and free roller. Only the disk is actuated. Its 487 measured
spiral points match the finite centerline within 2.5316 pixels RMS and 7.2014
pixels maximum. The roughly eight-pixel spiral correction, 5.5-pixel guide
lowering, completed rod, inferred roller journal and reversing drive are
disclosed. The normal view retains the engraved eye and head; half section
reveals the working roller while keeping the connection to the rod visible.
Fifteen selected tests, fifteen production browser tests and the build pass.
Ten feed-and-return cycles keep native soft penetration below 0.00381 pixel,
timestep feed differences below 0.012 pixel and roller-rim differences below
0.573 pixel. Thirty-three poses pass 9,192,492 independent surface samples
without unintended intersections. Sixteen views are inspected and playback
averages 28.16 fps. See the
[099 reconstruction](mujoco-099-spiral-feed.md). 099 is verified within its
corrected spiral pitch, inferred reversing drive, ideal guide/journal and
stated running-clearance model.

100 now uses MuJoCo contact between a crank wrist and a passive slotted lever.
It retains the measured 21.7463-pixel shaft-height offset, 102.5729-pixel crank
radius, complete rear disk and full lever. The settled slot and lever match
independent source readings within 2.454 and 2.800 pixels RMS. Fifteen selected
tests pass: ten cycles give approximately 2.113:1 quick-return timing, soft
penetration below 0.05151 source pixel and timestep differences below 0.043°.
Thirty-three poses pass 1,039,962 independent surface samples without unintended
intersections. The wrist slides without friction; plate depths, the flat output
section and bearings remain reconstructed. See the
[100 reconstruction](mujoco-100-quick-return.md) for geometry and operating limits.
All fifteen final views were inspected; playback averages 60.00 fps. The
production build and all sixteen MuJoCo browser checks pass.

101 now uses a driven hanging lever and passive horizontal bar in MuJoCo.
Its corrected slot and outer lever body match independent ink readings within
0.746 and 0.365 pixels RMS. Fifteen selected tests pass: ten swings retain both
bored guides and give a 148.7134-pixel stroke with no measured backtracking.
Soft penetration stays below 0.00594 pixel and timestep differences below
0.03574 pixel. Thirty-one poses pass 935,316 independent surface samples without
unintended intersections. All sixteen final views are inspected and playback
averages 60.00 fps. The slot is widened by 0.5896 pixel per side and the bar's
right end extended 47.7569 pixels. The full handle, symmetric input swing and
ideal bearings remain reconstructed; see the
[101 reconstruction](mujoco-101-slotted-bar.md).
The production build and all seventeen MuJoCo browser checks pass.

102 now uses matching solid helical threads in MuJoCo: rotation of the nut
drives its passive axial slide on a fixed bolt. The head and nut match sampled
source edges within 1.145 and 1.462 pixels RMS. The engraving's exaggerated
diagonal slope is corrected to a single-start helix while retaining pitch,
diameter and drawn direction; the corresponding crest edges differ by
5.863 pixels RMS and 11.726 pixels maximum. Complete square threads, true
conical hexagon chamfers and a nut section view replace the earlier tube
threads and added guide frame. Twenty-two selected tests pass. Ten complete
cycles retain the nut and keep native soft penetration below 0.04170 pixel;
31 poses pass 5,629,476 finite-surface checks without intersections. Contact
sector error remains below 0.04687 pixel and timestep travel differences below
0.11256 pixel. All eighteen final views are inspected and real-time headless
playback averages 28.37 fps. The production build and all eighteen MuJoCo
browser checks pass, with the 102 check repeated after the final shadow
adjustment. The fixed bolt, ideal coaxial alignment, zero friction,
0.3-pixel clearance and twelve-second reversing drive are explicit
assumptions; see the [102 reconstruction](mujoco-102-screw.md).

103 now uses matching MuJoCo threads to drive a passive horizontal carriage
from an axially fixed rotating screw. The single curved carriage replaces
separate braces, with a bored headstock, complete bed and hidden retaining
guide. Its haunch matches 61 independent ink readings within 1.7198 pixels RMS.
The helix corrects the drawn diagonal slope while retaining pitch, diameter
and direction; corresponding crest edges differ by 2.6682 pixels RMS.
Sixteen selected tests pass. Ten complete cycles give an 88.843-pixel stroke,
and retain both thread and guide. Thirty-three poses over the first cycle
pass 5,162,448 finite-surface samples, with only intended thread penetration
below 0.002350 pixel. Timestep and sector refinement change
travel by less than 0.132625 and 0.115218 pixel respectively. All eighteen final
views are inspected, including the moving carriage and guide section; real-time
headless playback averages 23.98 fps. The build and all nineteen MuJoCo browser
checks pass. The ideal bearings and guide, open-bay bed interpretation, completed
ends, friction values and eight-second reversing drive are explicit assumptions;
see the [103 reconstruction](mujoco-103-leadscrew-slide.md).

104 now uses an ideal MuJoCo gear constraint with matching helical geometry
and both source-described input arrangements. The front pedestal, bored
journal, rib and foot replace the old rear support. A generated 18-tooth wheel
corrects the former 23.2% pitch mismatch. The pedestal matches 181 ink readings
within 1.4050 pixels RMS; the true helix differs from the drawn diagonals by
2.4286 pixels RMS. The regularized wheel has a larger, explicit source correction.
Four mechanism tests, eleven runtime/engine/camera tests and all four existing
031 worm-drive tests pass. Ten cycles in each mode retain the guide; eighteen
poses pass 33,097,524 finite-surface samples with intended mesh overlap below
0.008249 pixel. Timestep travel differences stay below 0.035751 pixel.
All seventeen final views are inspected. The production build and all twenty
MuJoCo browser checks pass, with 104 repeated after the final shadow adjustment.
Headless playback averages 13.87 fps; mean physics/update time is 0.220 ms,
so rendering is the measured performance limitation. This is an ideal
transmission: tooth contact, friction, backlash and self-locking are omitted.
Its inferred tooth count, pressure angle, depth, guide, bearings and reversing
drive are documented in the [104 reconstruction](mujoco-104-worm-saddle.md).

105 now uses a MuJoCo screw coupling and captured swivel with native contact
between the ram and a rigid blank. The reconstruction corrects reversed,
round-wire threads, ball-shaped weights, the added side guide and frame/ram
proportions. Matching square helices, oblate bored weights and a surrounding
keyed guide replace them. The frame matches 139 independent ink readings
within 1.48018 pixels RMS; source registration records coaxial and perspective
corrections. Four mechanism and eleven shared playback/camera tests pass.
Ten full strokes retain the guides and thread engagement. Seventeen poses
pass 3,949,752 finite-surface samples, with only intended ram/blank overlap
below 0.000113 pixel. Native penetration stays below 0.002225 pixel and
timestep travel differences below 0.011155 pixel. All nineteen final views
are inspected, including section views and desktop/mobile catalog controls.
The production build and all 21 MuJoCo browser tests pass. Headless playback
averages 39.10 fps. Ideal screw/swivel/guide constraints, omitted thread
friction and self-locking, and the inferred lower frame and hidden hardware
are documented in the [105 reconstruction](mujoco-105-screw-press.md).

106 now uses MuJoCo groove-wall contact to drive a passive rectangular rod
through measured hanging guides. A complete recessed groove replaces the
old raised black tube; the corrected travel law has uniform working strokes
and short smooth reversals. The groove matches 161 independent ink readings
within 3.74299 pixels RMS, with a stated maximum correction of 13.59085 pixels.
Four mechanism and eleven shared tests pass. Ten revolutions complete every
stroke, with position error below 0.019514 pixel and speed variation below
1.40215% over 100 ms intervals on the uniform flanks. Thirty-three poses pass
5,935,008 finite-surface samples, with only intended pin/land overlap below
0.001688 pixel. Both guides remain engaged by at least 5.50248 pixels.
Timestep and mesh refinement change travel by less than 0.031875 pixel.
All sixteen final views are inspected, including groove and joint details
and desktop/mobile controls. The production build and all 22 MuJoCo browser
tests pass; live headless playback averages 36.32 fps. The inferred rounded
pin, rigid attachment, depths, ideal bearings and guides, and uncalibrated
contact parameters are documented in the [106 reconstruction](mujoco-106-barrel-cam.md).

107 now uses MuJoCo contact in a complete repeating barrel groove, driving a
passive rectangular rod through measured hanging guides. The eleven repetitions
are inferred from a cylindrical source fit; the caption specifies no count.
Uniform working flanks and smooth reversals replace the irregular drawn groove.
A narrower working pin avoids undercut at the tight turns, an explicit source
correction. The actual groove outlines match 334 ink readings within 3.31546
pixels RMS, with a 7.97171-pixel maximum; the separate horizontal center metric
has a 16.29649-pixel maximum correction. All nineteen native/shared checks pass,
including the four 106 regressions. Ten barrel turns complete all 220 half-strokes,
with follower error below 0.103872 pixel and speed variation below 1.87948% over
100 ms intervals on uniform flanks. Forty-three poses pass 13,327,862 surface
samples, with only intended pin/land contact below 0.002334 pixel. Both guides
retain at least 8.03050 pixels of engagement. All sixteen final views are
inspected; the build and all 23 MuJoCo browser tests pass. Headless playback
averages 19.84 fps at physical speed. Reconstructed depths, rigid attachment,
bent stem, ideal bearings/guide and contact limits are documented in the
[107 reconstruction](mujoco-107-serpentine-cam.md).

108 now loads a contact-driven reconstruction in the catalog, under review.
A passive swiveling shoe follows complete intersecting grooves, replacing the
old raised tubes and prescribed reversals. Contoured shoe sides provide more
flank support; long-run p95 speed error over 100 ms intervals falls from 9.05%
to 1.47844%, with a 10.7819% peak near an end transition. The darker recessed
core makes both grooves visible. Six complete output cycles retain the selected
path within 0.87419 source pixel, but peak penetration worsens from 0.07116 to
0.36499 pixel. The refined mesh and half timestep also exceed the unchanged
0.1-pixel penetration regression bound. Current two-cycle reversed-load checks
retain the path with penetration below 0.07569 pixel; longer-load robustness is
not established. A 485-pose audit makes 38,522,534 independent surface queries,
confirming shoe/land penetration up to 0.36663 pixel and clear guides, bearings
and socket. All 5,328 compiled contact vertices match the visible solids.
Four mechanism and three shared tests and the integrated build pass. Nineteen
integrated views are inspected; playback runs at 20.88 fps and 99.00% physical
speed over 22 seconds. All 24 MuJoCo production browser regressions pass. Actual
groove shoulders have 6.62320-pixel RMS nearest-outline error against 164 ink
readings, and the source overlay still shows a substantial pattern mismatch.
[The reconstruction record](mujoco-108-reverse-thread-candidate.md) keeps the
source interpretation, contact convergence and visual shadow work open.
Integration makes progress reviewable; 108 is not mechanically qualified.

109 now loads a MuJoCo reconstruction with connected square threads, involute
gears, a bored carriage, a retained rear guide and progressive material removal.
The new blank stays cut on return strokes; a 24-second cycle supplies smooth
reversals. The fitted 52:76 gear pair requires an inferred shaft depth stagger
and an opposite-handed, coarser cut than the source depicts. Actual mesh extent
differences are 0.8028 pixel RMS against 805 edge readings; lead and work thread
shoulders differ by 3.9837 and 9.8506 pixels RMS respectively. The latter metric
now includes only exposed workpiece shoulders. Source interpretation remains
under review. A single closed workpiece exterior eliminates the blank's former
helical shadow seams and reduces the initial assembly to 17 solids and 59,892
triangles. Twenty-six workpiece states check solid topology, volume and the
absence of buried thread flanks.
Ten cycles keep native carriage error below 0.019868 pixel and uniform travel
speed error below 0.6361%. The gears and screw feed use explicit ideal native
constraints, with geometric cutting and fixed initial workpiece inertia.
The original integration passed fifteen mechanism/shared/engine checks and all
25 production MuJoCo browser tests. The exterior change passes seven updated
mechanism/runtime tests and the focused production 109 playback/restart test.
A 73-pose audit passes 26,856,574 surface queries with no sampled unintended
interference. Twenty updated integrated images are inspected, and live playback
averages 33.77 fps at 99.94% of physical speed. The build passes.
The [109 reconstruction record](mujoco-109-thread-cutting.md) documents these
limits and the validation evidence. This is an integrated improvement, not
final mechanical qualification.

110 now loads the MuJoCo half-nut traverse in the catalog. Reducing the thread
mesh from 64 to 32 angular divisions cuts collision geoms from 3,388 to 1,812
and allows 22.44 fps at 98.87% physical speed in the final integrated capture.
Measured outlines still differ from 1,100 ink readings by 0.79919 pixel RMS.
Native contact drives the passive rod through nine selections in 68 seconds,
with maximum penetration 0.10285 pixel and a cycle near 16 seconds. Both
21-second reversed-load trials retain engagement. Half-timestep and finer-mesh
comparisons differ from the default sampled axial trajectory by at most
0.20287 and 0.29984 pixel, but contact penetration does not converge
monotonically. Working-stroke speed still varies: p95 error over 100 ms is
14.8561%, and the largest sampled deviation from an ideal screw line is
0.25604 pixel. Thirteen mechanism/runtime/engine checks and the integrated
build pass. A 27-pose audit makes 4,414,170 independent surface queries with no
unintended sampled intersections; all sixteen integrated views are inspected.
All 26 production MuJoCo browser regressions pass. Automatic selection, weight
support, stops, hidden depths and thread relief are reconstructed. Speed ripple,
contact convergence, longer loaded runs, friction and source interpretation
remain open in the [110 reconstruction record](mujoco-110-half-nut-candidate.md).

111 now loads a nested MuJoCo differential micrometer with matching square
threads and a section control. The inner hand is corrected to obtain
pitch-difference travel, and the sleeve root is widened by 1.84825 pixels in
radius to contain the inner crest and a wall. These changes resolve the
previous model's inconsistent mating hands, while source interpretation
remains open. Actual outlines differ from 229 ink readings by 1.15978 pixels
RMS; outer and inner projected thread flanks differ by 2.98996 and 6.84331
pixels RMS. Ideal native screw joints replace prescribed output poses and
permit 50.25 fps at 99.96% physical speed. A separate contact model follows
the same three-turn stroke, but its 6.535 ms step cost is too high for live
playback. Ten ideal-joint cycles retain pitch-difference travel within
0.000146 pixel. Thirteen mechanism/runtime/engine tests pass, including
reversed loads, native constraint removal, contact progress and restart.
A 65-pose audit makes 12,106,120 independent surface queries with no sampled
penetration, retaining 37.18386 pixels of thread engagement. All thirteen
integrated views are inspected, and the build and all 27 production MuJoCo
browser tests pass. Omitted
supports, hidden dimensions, source corrections, ideal joints and contact
limitations are recorded in the [111 reconstruction](mujoco-111-micrometer.md).

112 now loads a MuJoCo Persian drill whose hand grip turns the stock through
native thread contact. Six starts are inferred from the engraving; seven also
fit closely, so the count remains a documented reconstruction choice. Solid
grooved stock, a fitted bored grip and head, and a flat bit replace floating
thread ridges and invented details. Actual extents differ from 703 source
readings by 0.71278 pixel RMS, and projected grooves from 125 readings by
1.02473 pixels RMS. Playback runs at 25.24 fps and 99.74% physical speed on a
six-second cycle. Ten cycles retain the screw relation within 0.05244 pixel
and native penetration within 0.02810 pixel. Timestep/mesh refinement,
reversed torque and friction 0.05 with elliptic cones retain motion; coarse
meshes and pyramidal friction at 4 ms are rejected. A 26-pose surface audit
makes 22,209,252 queries, and nine friction poses add 7,687,818, finding no
unintended hardware intersections. All thirteen integrated views are
inspected; fourteen mechanism/runtime/engine tests, the production build and
all 28 MuJoCo browser regressions pass. Ideal head/hand constraints, hidden
dimensions and numerical limits are recorded in the
[112 reconstruction](mujoco-112-persian-drill.md).

113 now loads a MuJoCo rack and pinion with either member selectable as input.
Matching shallow involute teeth replace the previous tooth forms, and a
measured fourteen-tooth rack mates with a fifteen-tooth pinion inferred from
the visible contour. Actual pinion edges differ from 114 ink readings by
2.54432 pixels RMS; uniform rack centers differ from 34 readings by 3.37370
pixels RMS. The invented frame/posts and index dots are removed. Gravity
loads passive rollers, and the rack passes behind them with a 3-pixel axial
gap. Ten cycles in each mode retain mesh within 0.07850 pixel and penetration
within 0.01072 pixel. Refined meshes/timesteps, reversed loads and tooth
friction 0.1 retain engagement. Two surface audits total 1,066,702 queries
over 37 poses with no unintended intersections. Nineteen mechanism, runtime,
engine and shared gear tests pass. All thirteen integrated views are inspected;
playback runs at 60.07 fps and 99.9764% physical speed. The isolated production
build and all 29 production MuJoCo browser regressions pass. Source corrections, ideal orientation/bearing constraints,
inferred depths and contact limits are recorded in the
[113 reconstruction](mujoco-113-rack-pinion.md).

114 now loads a MuJoCo double rack with a passive sliding frame and a
continuously driven half-pinion. Measured frame curves and rod junctions replace
the old proportions and invented supports. Generated involute working teeth
and relieved end teeth permit contact-driven transfer; a 27-degree source
phase correction leaves clearance through the complete stroke. Frame edge
errors are mostly below two pixels RMS; the corrected pinion differs by
6.41805 pixels RMS and regular rack centers by 4.29011 pixels RMS.
Ten cycles retain engagement with at most 0.07185 pixel native penetration.
The 28-pose independent surface audit makes 1,629,656 queries and finds no
unintended intersections, including at the frame ends. Thirteen mechanism,
runtime and engine tests pass. All twelve integrated views are inspected;
playback runs at 59.46 fps and 99.92765% physical speed. The production build
and all 30 production MuJoCo browser regressions pass. Tooth friction 0.05 and 0.1 fail qualification, so the verified scope
is explicitly the default frictionless reconstruction with ideal shaft and
slide constraints. The source corrections, end-tooth construction and limits
are recorded in the [114 reconstruction](mujoco-114-double-rack.md).

115 now loads a MuJoCo double rack driven through native tooth contact by two
equal pinions receiving equal opposite shaft torques. The measured frame,
shaft circles, ten upper teeth and nine lower teeth replace the old oversized
frame and extra hardware. Profile-shifted involute teeth reconcile the shaft
spacing with the rack pitch; actual gear contours differ from the engraving
by 2.21015 and 1.84603 pixels RMS. The inner frame curves fit within 0.511
pixel RMS. Ten cycles retain both rack contacts with maximum penetration
0.009762 pixel. Timestep, mesh-resolution and loaded friction trials pass.
The independent 25-pose surface audit makes 3,055,300 queries and finds no
unintended intersections. All 29 targeted numerical and runtime tests pass;
all twelve integrated views are inspected. Playback records 51.43 fps at
99.86536% physical speed. The production build and all 31 production MuJoCo
browser regressions pass. Equal input torque is idealized; instantaneous
rack forces are not prescribed. Source corrections, construction assumptions
and qualification limits are recorded in the [115 reconstruction](mujoco-115-equal-racks.md).

116 now uses two separate pinions with hinged pawls and six-tooth ratchets
on a common shaft. Only the reciprocating frame is actuated; native contacts
produce the clockwise output. The measured frame, thirteen-tooth involute
pinions and twelve teeth per rack replace the old proportions and prescribed
pawl motion. Pinion and ratchet contours fit within 2.21611 and 1.15299 source
pixels RMS. Ten cycles retain one-way motion after startup, with maximum
native penetration 0.15825 pixel. Speed over 20 ms intervals remains within
4.4% of ideal; brief individual-step contact impulses are documented. The
independent 25-pose audit makes 5,162,318 surface queries and finds no
unintended intersections. All sixteen targeted mechanism and shared tests
pass, and all fourteen integrated views are inspected. Headless playback
records 23.44 fps at 99.23% physical speed. The production build and all 32
production MuJoCo browser regressions pass.
The verified scope uses frictionless contact, inferred weak pawl springs and
ideal bearings and guide; nonzero friction and applied loads remain outside
qualification. Construction and evidence are recorded in the
[116 reconstruction](mujoco-116-rack-rectifier.md).

117 now loads a MuJoCo cam between two independently rotating rollers in a
passive guided yoke. A measured cam with a conjugate pitch curve replaces the
old animation-derived shape and prescribed motion. The 27-solid construction
connects both stems to their crossbars and continues the lower stem beyond
the engraving's break to keep it inside its guide. Actual cam edges fit
within 1.57099 source pixels RMS. Ten cycles retain the full stroke with
maximum motion error 0.004732 pixel and native penetration 0.004205 pixel.
Finer timestep, finer cam mesh and friction trials from 0.05 to 0.6 retain
the motion; the lightly loaded lower roller can slip or coast, so its exact
rotation is not qualified. The independent 21-pose audit makes 1,080,198
surface queries and finds no unintended intersections. All fifteen targeted
tests pass, and all thirteen integrated views are inspected. Playback records
60.07 fps at 99.97421% physical speed. The production build and all 33
production MuJoCo browser regressions pass. Source measurements, ideal
bearings and guide, inferred depth and stem continuation, and contact limits
are recorded in the [117 reconstruction](mujoco-117-roller-yoke.md).

118 now loads a loose MuJoCo pinion carried by the pitman between a fixed
lower rack and a passive upper rack. Native contact produces the doubled
stroke. Fourteen generated involute pinion teeth and nineteen/twenty rack
teeth preserve the source counts; the measured pitman, raised eye, compact
upper rail and rounded base replace the old proportions and invented posts.
Actual pinion edges fit within 1.90085 source pixels RMS; regularizing the
uneven rack spacing requires larger tooth-center corrections, documented
explicitly. Ten cycles retain the doubled stroke with maximum error 0.144231
pixel and native penetration 0.009691 pixel. Finer timestep and mesh trials,
and loaded friction trials at 0.1 and 0.3, retain the motion. The independent
21-pose audit makes 1,517,922 surface queries and finds no unintended
intersections. All fifteen targeted numerical and runtime tests pass.
All thirteen final rendered views pass inspection, with fixed framing through
the complete stroke and corrected front-face shadow specks. Playback averages
60.07 fps at 99.97% physical speed. The production build and all 34 MuJoCo
browser checks pass; a final rebuild and targeted 118 check also pass after
the display-only shadow adjustment. Construction assumptions,
the interpretation of the three static support webs, and evidence are in
the [118 reconstruction](mujoco-118-stroke-doubler.md).

119 now uses a uniformly driven MuJoCo pinion, a passive vertical carrier
and a passive horizontal endless rack. Tooth contact determines travel
along the rack, with explicit ideal normal support retaining engagement.
The bare construction loses mesh at its first end, so the additional support
is a stated reconstruction assumption. Generated eight-tooth pinion and
six-tooth rounded ends preserve the interpreted source counts; the corrected
initial phase, thick rear rod, four bores, broad slotted guide and complete
beams replace the old proportions. Actual pinion edges fit within 2.49613
source pixels RMS and the regularized rack within 4.80993 pixels RMS.
Ten circuits retain the full stroke with maximum transmission error 0.473889
pixel and native penetration 0.020343 pixel. Finer timestep and mesh trials,
opposed loaded friction trials and doubled retention stiffness preserve the
motion. The 33-pose surface audit makes 1,583,474 queries and finds no
unintended intersections. All thirteen targeted tests pass, all fifteen final
views are inspected, and the production build and all 35 MuJoCo browser
checks pass. Section view outlines the front guide to expose the pinion;
the opaque guide remains available. Playback averages 57.57 fps at 99.97%
physical speed. Evidence and the scope of ideal engagement support are in
the [119 reconstruction](mujoco-119-endless-rack.md).

120 now closes and reopens through native external/internal gear contact
and physical jaw contact. Compatible 13/51 and 23/79 tooth pairs replace
the old equal 1:3 ratios and triangular teeth. Measured shaft positions,
curved jaws and enclosing frame restore the source silhouette. Recessed
frame arms and complete end tooth spaces remove two early closing jams;
hidden depths, widened jaw edges, ideal bearings and the reversing drive
are explicit reconstruction assumptions. Ten cycles retain both meshes,
with maximum rolling error 0.121431 pixel and native penetration 0.031468
pixel. Finer solver/geometry and opposed loaded friction trials preserve
closure. The twelve-solid audit makes 4,219,514 sampled surface queries
without unintended intersections. All fifteen targeted tests pass and all
fourteen final views are inspected. The production build and all 36 MuJoCo
browser checks pass. Playback averages 37.09 fps at 99.92%
physical speed. Source differences, collision approximation and evidence
are documented in the [120 reconstruction](mujoco-120-segment-clamp.md).

121 now uses a rod-driven MuJoCo disk carrying a freely hinged reversible
click. Native contact advances the cog, and selecting the thrown-over click
uses its opposite end to reverse the feed. The visible working surfaces
share a plane. Measured hub, shaft, pin and rod-eye sizes replace the old
altered proportions and invented supports. A 24-tooth cog with almost radial
faces is used because the tested involute faces cammed the reversed click
outward; its actual-edge RMS is 4.61360 source pixels. The source's imperfect
concentricity is regularized, and the click nose is narrowed to fit the solid
tooth spaces.

Ten cycles in each direction retain the one-tooth feed after initial seating.
Maximum retreat is 0.006402 tooth forward and 0.001187 in reverse; maximum
native penetration is 0.028992 / 0.062903 source pixel. Finer geometry/timestep
and tooth-friction 0.1 trials retain both feeds. Each full-hardware audit
makes 646,350 surface queries over 21 poses with no unintended intersections.
All fourteen targeted tests pass. Ideal guides/pins, inferred hinge damping,
the finite resisting shaft load, source differences and failed load/geometry
trials are documented in the [121 reconstruction](mujoco-121-reversible-click.md).
All eighteen final catalog views are inspected. The production build and
all 37 MuJoCo browser checks pass, including the reversal selector. Default
headless playback averages 27.25 fps at 99.82% physical speed.

122 now uses one MuJoCo gear input with native involute tooth contact and two
ideal rod-pin closures. The unequal rods, broad curved floating link, ordinary
pin eyes and output silhouette restore the source proportions. Compatible
29/23 shifted involutes regularize the drawing's nonconcentric gear outlines;
actual-edge RMS is 2.90247 / 2.41503 source pixels. Both crank radii are reduced
by 15%, moving the pins inward by at most 10.04555 pixels, because the measured
source assembly branch encounters a toggle. Independent full-pattern continuation
and the unreduced native stall support this explicit correction.

Two complete 29:23 patterns retain the variable alternating traverse. Maximum
native penetration is 0.010935 pixel, pin-closure error 0.000422 pixel and rolling
error 0.139371 pixel. Finer timestep/collision geometry and opposed loaded
friction trials complete full patterns. Shortening the shaft fronts removes
rod interference; the final 466-pose, 46,332,516-query surface audit finds no
unintended intersections. All 15 targeted tests and all 19 final view inspections
pass. Default headless playback averages 42.16 fps at 99.92% physical speed,
with a readable four-second input revolution. Source corrections, ideal guides,
depth assumptions and finite qualification limits are documented in the
[122 reconstruction](mujoco-122-variable-traverse.md).
The production build and all 38 MuJoCo browser checks pass, including 122
playback, restart, navigation and loading beneath a static subdirectory.

123 now uses MuJoCo tooth and stop/cam contact to turn three passive rotors
from one reciprocating rack input. Measured shaft, hub, rack and sector
proportions replace the old scripted drive and invented supports. Equal
36-tooth spurs and matching 38-tooth-reference sectors regularize the
inconsistent engraved teeth. End relief, raised rack flanges and a transfer
piece rephased 180° permit the native handoff. These source corrections and
the ideal bearings/guide are documented in the
[123 reconstruction](mujoco-123-sector-handoff.md).

Ten default cycles maintain forward output without retreat. Maximum native
penetration is 0.0287113 pixel, rack input error 0.442466 pixel and spur
rolling error 0.101741 pixel. Finer timestep/geometry and a stronger resisting
load with friction complete both reversals. Removing the cam contact or
restoring its engraved phase prevents the handoff. All 18 selected tests
pass. The 51-pose hardware audit makes 13,060,170 surface queries with zero
unintended penetration. All 19 integrated views are inspected, including
section views of both hidden stop contacts and desktop/mobile controls.
Headless playback averages 25.51 fps at 99.38% physical speed. The production
build and all 39 MuJoCo browser checks pass, including 123 section controls,
playback, restart, navigation and loading beneath a static subdirectory.

124 now uses native MuJoCo cord friction in the public catalog. Ninety-six
rotating finite sections, joined by native ball connections, turn the passive
spindle from a single bow input. The measured bow and pulley replace the old
oversized scripted geometry. The string width comes from 91 source stations;
51 partial binding-contour readings qualify the corrected coil handedness and
loose ends. The lower cord enters behind the stock without crossing a winding.
Its tied geometry, hidden depths, ideal supports and lumped bow compliance are
stated assumptions in the [124 reconstruction report](mujoco-124-bow-drill.md).

Three native cycles, time/spatial refinements, friction removal and a resisting
load complete without resets or output actuation. Default spindle travel is
within 0.125% of the pitch-radius estimate; changed mean angle remains a stated
refinement limitation. All 19 selected tests pass. A 51-pose rendered-hardware
audit makes 8,826,664 surface queries with zero unintended intersections;
nonadjacent default cord sections retain at least 3.048012 source pixels.
All 18 integrated views are inspected, including section details and mobile
controls. Shaft-end hatching makes native rotation visible. Headless playback
averages 28.34 fps at 96.53% physical speed using the viewer's normal frame cap.
The production build and 39 of 40 browser cases pass on the full sweep; 123
hits its five-second startup deadline. After a measured startup allowance
correction, all six focused 123/124 checks pass (three each). The original
failure and isolated checks are preserved in the reconstruction report.

125 is integrated with MuJoCo, measured crank pins, unequal rods, broad curved
links and the short output stem. The retained 19:23:29 interpretation completes
437 turns in independent linkage continuation and native runs at both 1 ms
and 0.5 ms without shortening any crank. All sixteen selected tests and all
41 production browser cases pass. A 495-pose hardware audit makes 93,537,180
surface queries with zero unintended penetration and working tooth overlap
below 0.036413 source pixel. Full-pattern timestep refinement changes the output
position by at most 0.046827 pixel. All 23 integrated views are inspected;
headless playback averages 32.24 fps at 99.84% physical speed. Source
ambiguities, the earlier failed contact approximation and guide/depth assumptions are documented in the
[125 reconstruction](mujoco-125-cascaded-traverse.md).

126 is integrated with a solid pulley, measured curved lever arms, two native
flexible cords and freely hinged pin attachments. Rendered arm-edge RMS errors
are 0.2148–0.3413 source pixel. Ten cycles finish without resets or passive
actuation; timestep and section refinement change sampled output motion by
0.072011 and 0.483253 pixel. The surface audits find no unintended hardware
penetration, and nonlocal cord spans remain separate. Single-point cord/drum
contacts retain full 3D coordinates while bringing playback to approximately
32 fps and 99% of real time. Cord texture and fixed-shaft hatching follow the
source; arm-face shadow artifacts are corrected. Source-rim/cord inconsistency,
local grip-angle sensitivity and inferred bearings, cord seats, endpoint guides
and loads remain explicit limits. See the [126 reconstruction record](mujoco-126-bell-crank.md).

**037, 063, 071 and 073 remain mechanically unresolved. 031, 064, 065, 066, 067,
068, 069, 070, 072, 074, 075, 076, 077, 078, 079, 080, 081, 084, 085 and 086 are verified.
089 is verified as an ideal kinematic reconstruction.
090 and 091 are verified as MuJoCo reconstructions with ideal guides and stated clearance.
092 is verified as a MuJoCo reconstruction with ideal pins and guides.
093 is verified as a MuJoCo reconstruction with ideal guides and stated slot clearance.
094 is verified for radius adjustment with an ideal guide and stated bolt/slot fits.
095 is verified with a reconstructed roller, ideal bearings/guide and stated contact limits.
096 is verified with a corrected cam, smooth reversals, ideal guides and an inferred spring.
097 is verified with Archimedean spiral flanks, short reversals and an inferred pin and guides.
098 is verified with full groove circulation at the corrected crank radius and physical speed.
099 is verified with a corrected spiral, passive free roller and inferred reversing drive.
100 is verified with measured crank/lever geometry, frictionless wrist contact and ideal bearings.
101 is verified with a corrected slot, passive guided bar and an inferred symmetric lever swing.
102 is verified with matching square threads, ideal coaxial alignment and stated clearance and friction limits.
103 is verified with matching square threads, ideal bearings and guide, reconstructed friction and stated clearance.
104 is verified as an ideal MuJoCo gear transmission with generated matching teeth and both input modes.
105 is verified with an ideal screw and swivel, native ram/blank contact, a keyed guide and stated reconstruction assumptions.
106 is verified with native groove contact, uniform working strokes, smooth reversals and stated pin/guide reconstruction assumptions.
107 is verified with repeated native groove contact, a narrowed working pin, inferred repetition count and stated guide/attachment assumptions.
112 is verified for alternating contact-driven rotation with six inferred starts, ideal head/hand constraints and stated clearance/friction limits.
113 is verified for contact-driven transmission in both directions, with inferred shallow involute teeth, passive rollers and stated guide/depth assumptions.
114 is verified for frictionless contact-driven rack transfer with relieved end teeth, a corrected initial phase and stated guide/depth assumptions.
115 is verified for contact-driven double-rack motion with equal input torques, shifted involute teeth and stated bearing/guide assumptions.
116 is verified for alternating ratchet contact with shifted involute pinions, inferred pawl springs and stated friction/guide limits.
117 is verified for native cam-driven yoke motion with passive rollers, an inferred stem continuation and stated bearing/guide and roller-slip limits.
118 is verified for native doubled-stroke transmission with regular involute teeth, ideal bearings and guides, and stated input/support reconstruction assumptions.
119 is verified for contact-driven endless-rack circulation with additional ideal normal engagement support and stated tooth-count, guide and depth assumptions.
120 is verified for native gear-driven jaw closure and reopening with ideal bearings, bounded collision approximation and stated frame/depth/drive reconstruction assumptions.
121 is verified for native tooth-driven feed in both click positions after initial seating, with ideal pins/guide, inferred damping and resisting load, and stated cog/nose reconstruction assumptions.
122 is verified for native geared variable traverse across the full 29:23 pattern, with 15% reduced crank radii, ideal pins/guide, bounded collision approximation and stated source/depth assumptions.
123 is verified for native double-rack sector handoff with regular equal spur gears, relieved ends, raised flanges, a rephased working cam and stated ideal support/depth/drive assumptions.
124 is verified for native finite-cord friction transmission with corrected bound ties, ideal hand/bearing constraints, lumped bow compliance and stated material/depth and sampled-clearance limits.
125 is verified for native geared cascaded-link motion across the full 19:23:29 pattern, with measured crank radii, ideal pins and vertical guides, bounded collision approximation and stated source/depth assumptions.
126 is verified for native pulley/cord force redirection with ordinary hinged pin attachments, sampled hardware and cord clearances, and stated source, guide, load and local cord-angle assumptions.
082, 083, 087, 088, 108, 109, 110 and 111 are integrated and under review.
Final mechanical qualification for these movements remains pending.
The complete 507-movement review remains active.**

## Completion requirements

Completion requires source comparisons and motion review for all 507 entries,
correction of every identified wrong topology/proportion/contact, inspection of
actual rendered clearances through motion, readable playback at default speed,
and the build, numerical tests, and browser checks against the final state.
The goal remains active until that evidence exists.
