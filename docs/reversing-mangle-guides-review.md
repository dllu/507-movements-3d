# Reversing mangle guides: 192–194

## Primary evidence and retained motion

The [192](https://507movements.com/mm_192.html), [193](https://507movements.com/mm_193.html) and [194](https://507movements.com/mm_194.html) captions and local engravings are the references. The actual page HTML contains neither `ae.add_model` nor `mm_present` for any of the three; animation unavailability was not inferred merely from a disabled tab. These factories already contained substantial source-coordinate and ideal rolling reconstruction tests, so this is a finite-contact follow-up, not a first implementation.

192 retains its eccentric path and continuously varying forward/reverse speed. 193 retains two concentric pitch radii and unequal forward/reverse rates. 194 retains one circle of radial face pins with equal opposite main-run rates. Their analytical XY laws, reversal branches, source phases, tooth pitch counts and constant input speeds are unchanged. Forces, bearing friction, clearance take-up and universal-joint angular-speed modulation remain prescribed/unsolved. There is no native or baked dynamics claim.

## Connected blind guides and accessible shafts

Previously, a solid tube drawn along each shaft path was called a groove, with a smaller solid tube drawn over it as a recess. The shafts crossed solid backing disks. Pinion bodies also overlapped the wheel face axially by 0.04 in 192/193 and 0.03 in 194, before bevel and hub extents.

All three now have genuine blind channels. Two finite walls share a continuous backing spanning z=−0.14 to −0.06; the walls extend to z=+0.14. Thus the enclosed inner island remains mechanically attached. A through-slot would have disconnected it. The visible outline uses the existing analytic circular guide segments and their finite offsets.

The guided journal radius is 0.055, its bored collar has inner radius 0.056 and outer radius 0.062, and the channel half-width is 0.064. This coherent stack is necessary for 193: the two adjacent guide branches are only about 0.147 apart, so its previous oversized torus collar could not fit with a retained separating wall. The finite collar engages 0.17 axial depth, ends 0.03 above the floor, and retains nominal 0.002 wall clearance. The journal ends 0.06 above the floor.

The pinion plane moves to z=0.37 while the wheel teeth stay attached to the face. The old pinion shaft is replaced by a front-side shaft ending in the blind groove; its universal input is also placed on the accessible front side. This depth arrangement is a reconstruction, since the source views do not supply a sectional layout. The universal link/yokes remain schematic rather than a solved Cardan transmission. The existing rear output support remains separate.

A bounded initial audit measured collar-wall separations around 0.00199–0.00211, pinion-to-wheel-face clearance 0.045, and pinion-to-root-strip clearance 0.005. Final bidirectional tests measure a minimum collar bore clearance of **0.00093257**, hub/face clearance of at least **0.02750**, and collar/floor clearance **0.03000**, rather than inferring clearance from pitch circles alone.

## 192/193: reuse the cutter with the correct complementary topology

The existing rectangular wheel teeth do not mate with their involute pinions. A 33-pose baseline found 0.040983 penetration for 192 (phase 0.6875, tooth 56, inner run) and 0.052831 for 193 (phase 0.5625, tooth 37, inner run).

Movement 036's `mangleToothOutline` cutter is reusable, but its raised C-shaped strip cannot be copied directly: 192/193 require the **complementary internal toothed opening**. The generator resamples the actual visible pinion outline uniformly in polar angle, aligns it with the factory's actual pinion/wheel phase at the first path station, and applies the existing synchronized cutter to all runs and both reversals. The resulting opening is subtracted from a finite raised wheel face. Old box teeth are removed and replaced with this working solid; no overlapping decorative teeth remain.

The offline cuts use 8,160 stations for 192 and 6,528 for 193, the shared cutter's 0.0006 allowance and a further 0.0003 finishing allowance along the outward cavity direction. Full pinion teeth and hub dimensions are retained. No pinion/hub/support intersections are included in the tooth cutter or excused by it. The generated file is approximately 394 KB; cutter work never runs in the browser.

Before the final finishing allowance, a 65-pose finite-pinion audit found +0.000160 minimum clearance for 192, with its closest witness in the upper-right reversal, and −0.000000155 for 193. Maximum nearest working gaps were 0.00162 and 0.00191. The final 65-pose bidirectional tests measure minimum clearance / maximum nearest working gap of **+0.00044816 / 0.00170810 for 192** and **+0.00029986 / 0.00201195 for 193**, including both reversal intervals. They require positive clearance and nearest working separation below 0.003.

## 194: finite pinion follow-up

The original isolated radial pins and involute pinion had **0.064059 penetration** at phase **0.90625**, pin **6**, on the outer run. The subsequent [194 finite pinion pass](radial-pin-mangle-contact-review.md) replaces that pinion with an offline capsule-envelope profile, retaining the full pins and five repeated tooth pairs. It clears the old witness and the full sampled cycle. The guide/interface correction above is retained.

The mechanism remains **partial**: the original ideal rolling law leaves a measured maximum working gap of **0.00821**. A loaded-flank seating trial develops a **0.02211-radian terminal pickup jump** and is deliberately not used for playback. The linked review records the exact witnesses, regeneration and remaining terminal/phase reconstruction work.

## Playback and verification

Each model has a source-facing camera and full-cycle fit bounds, no ground/fog, shadow flags on new working meshes, and a minimum display cycle equal to its authored full mechanical cycle. Geometry identities and scene descendants remain stable during state queries and playback.

Regenerate only the offline tooth cavities:

```sh
node scripts/generate-reversing-mangle-cavities.mjs
```

Focused checks:

```sh
node --test tests/movement-192.test.mjs tests/movement-193.test.mjs tests/movement-194.test.mjs tests/reversing-mangle-finite-guides.test.mjs
```

The retained legacy checks test source proportions, all analytical branches, derivatives and periodicity. New tests query the rendered finite surfaces in both directions for guide capture, journal/floor and pinion/hub/face interfaces, and tooth clearance/proximity; 194 has a separately disclosed residual bound. The checks are bounded sampling, not an exhaustive collision or load-capacity proof. Root integration owns final source/default/oblique browser review. This lane did not launch Chrome.

All **27 checks pass** (15 retained source/motion tests and 12 new finite/playback tests). The finite suite takes approximately 63 seconds. A second regeneration is byte-identical; SHA-256 of `src/simulation/baked/reversing-mangle-cavities.js`: `433c12db0600297a6dfdabd5c806dac4a916eafc18e078f3fde10405dc8cab30`.
