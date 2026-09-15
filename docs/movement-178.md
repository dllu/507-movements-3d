# Movement 178 — eccentric circular-guide shaper

The [source page](https://507movements.com/mm_178.html) includes executable 2D animation. Its circular track and eccentric input shaft determine the slide position analytically. The existing equations follow that reference, including a 25-unit connecting rod and horizontal output guide. Those remote components are mostly cropped out of the engraving. Source registration and their default presentation remain under review.

The first full visible-solid audit found 28 intersecting mesh pairs at 129 poses. Decorative round-wire outlines entered the circular and radial slots, and extrusion bevels intruded into the nominal shoe clearance. These are corrected. The disk is now opaque, scene ground is hidden, fog remains disabled, Restart is available, and the minimum display revolution is four seconds.

The current audit examines 29 meshes and 318 cross-family pairs at 129 poses, with 9,076,970 finite-surface queries and no sampled intersections. The rod has flat bored eyes, shortened beam ends, full-depth pins and retaining heads. The slider body clears the crank face; the input shaft ends behind the rod sweep; cutter depth clears the guide stops. Bearing and pin fits remain ideal. This sampled audit is not continuous collision proof.

The joint test checks actual bore surfaces, pin/eye concentricity throughout the cycle, full pin engagement, retaining-head attachment and shaft clearance. The original motion test, production build and desktop/mobile browser checks pass.

Source registration remains open. Four initial-pose landmarks differ by 10.40 pixels at the shaft, 4.20 at the slider, 26.21 at the rod crop, and 16.60 at the crank tip. The 2D animation's inferred proportions therefore do not fully reproduce the engraving. Next: fit these proportions and improve the default framing while preserving the full mechanism and rechecking clearance. See [source diagnostic](validation/178-source-fit.json).

Evidence: [baseline](validation/178-existing-solids.json), [current audit](validation/178-current-solids.json), and the existing motion test in tests/movement-178.test.mjs.

Production build, the existing motion test, and packaged desktop/mobile playback checks pass. Front-view inspection confirms that the long connecting rod still makes the main mechanism too small in the default viewport. Framing remains part of the next source-registration pass.
