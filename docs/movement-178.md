# Movement 178 — eccentric circular-guide shaper

The [source page](https://507movements.com/mm_178.html) includes executable 2D animation. Its circular track and eccentric input shaft determine the slide position analytically. The existing equations follow that reference, including a 25-unit connecting rod and horizontal output guide. Those remote components are mostly cropped out of the engraving. Source registration and their default presentation remain under review.

The first full visible-solid audit found 28 intersecting mesh pairs at 129 poses. Decorative round-wire outlines entered the circular and radial slots, and extrusion bevels intruded into the nominal shoe clearance. These are corrected. The disk is now opaque, scene ground is hidden, fog remains disabled, Restart is available, and the minimum display revolution is four seconds.

The current audit examines 27 meshes and 271 cross-family pairs, with 10,443,250 surface queries. 11 interfering pairs remain: the rod has solid eyes where bores are needed, the wrist and output pin need coherent axial seating, the shaft intersects the rod sweep, and the cutter hits guide stops. The slider body and fixed shaft-bearing/hub interface also need repair. The audit intentionally fails while any pair remains. Numerical motion tests alone do not establish physical clearance.

Next: replace these joints with finite bored geometry, recheck attachment and whole-cycle clearance, then register the visible components to the engraving. This movement is not mechanically qualified yet.

Evidence: [baseline](validation/178-existing-solids.json), [current audit](validation/178-current-solids.json), and the existing motion test in tests/movement-178.test.mjs.

Production build, the existing motion test, and packaged desktop/mobile playback checks pass. Front-view inspection confirms that the long connecting rod still makes the main mechanism too small in the default viewport. Framing remains part of the next source-registration pass.
