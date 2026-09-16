# Cam contact pass: 272 and 276

Primary references are the captions and engravings for [272](https://507movements.com/mm_272.html) and [276](https://507movements.com/mm_276.html). Page 272 has no `ae.add_model` or `mm_present` animation setup. Page 276 has both, and its running official canvas was observed: one rotating three-lobed cam drives one translating bar carrying two fixed-spacing rollers. The existing three-reciprocation cycle agrees with that behavior. No official drawing coordinates were copied.

## 272: oblique disk and inclined rod

The existing analytical sphere/plane constraint is retained. The visible yellow annulus had been raised 0.012 model units above that plane, into the follower. It now lies on the actual working plane; material depth offset prevents z-fighting without moving the contact geometry. Its duplicated coplanar face no longer casts another shadow.

The default view now exposes the working annulus and shoe. Camera bounds include the whole rod stroke, and floor/fog no longer hide the suspended mechanism. The engraving's oblique/wavy disk is interpreted as an oblique planar working face; that reconstruction assumption is unchanged.

At 257 poses the actual annular mesh plane is tangent to the finite shoe within 7e-8. A negative control raises it by the old 0.012 and restores interference. The finite shoe and rod clear the closed disk mesh in a bidirectional 129-pose triangle-surface sample.

## 276: two opposed rollers and relieved yoke

The independently reconstructed pitch law remains `r(theta) = R + A cos(3 theta)`, with exact opposed pitch-radius sum and the existing finite-roller normal offset. The simulation uses that ideal contact law and rolling relation, not a new dynamics model.

The rendered cam's outward bevel had penetrated each roller by about 0.0222 model units. The tubular decorative outline intruded by about 0.0264. The working cam extrusion now ends at its prescribed envelope, and the face trim is inset inside it. A 0.00023 model-unit machining allowance bounds the polygon chord approximation: 4,097 phases give circle-to-rendered-outline clearance between 0.0000178 and 0.0003387. This is a finite mesh approximation to nominal tangency, not exact solid tangency; the test also bounds the gap so excessive shrinking cannot pass.

The original bar crossed the cam's rear bevel and input shaft, with measured sampled penetrations of 0.0170 and 0.2092 respectively. The bar now sits just behind the cam hub and has a genuine oblong eye clearing the stationary shaft bearing over the entire stroke. Upper and lower eye webs are 0.1 model units thick and form one connected yoke; the roller axles still enter it. The rear eye is inferred, since the engraving occludes this region. Its visible outer bar, roller spacing and source proportions are retained.

The rear bearing arm is now bored around its shaft, the bearing ring has positive running clearance, and both roller treads have bores around their fixed axles. Roller indices stay on the annular face instead of crossing the axle.

## Checks and limits

Run `node --test tests/movement-272.test.mjs tests/movement-276.test.mjs tests/cam-272-276-solids.test.mjs`.

The added checks cover the actual working surfaces, both roller/cam pairs, decorative rim clearance, yoke/cam/hub/shaft/bearing neighbors, shaft/support bores and roller/axle bores, with bidirectional finite triangle-surface sampling. Existing tests retain the motion, continuity, source-pose and roller no-slip checks. Negative controls detect the former raised face and outward cam bevel. Both models suppress floor and fog.

Browser review inspected default/front/rear views against the source engravings. A 65-pose check of actual visible vertices found none outside either default camera frustum. Review images remain in RAM, outside Git.

This is a bounded analytical and finite-geometry correction. 272's assumed gravity preload has not been qualified against friction, loads or separation dynamics. 276's analytical yoke and roller motion ignores compliance, wear and load-dependent clearance take-up. The pitch curve is an idealization of the source's lobed form, not an exact recovered historical cam. These checks do not certify every attachment or frame pair in either assembly, and no passive MuJoCo qualification is claimed.
