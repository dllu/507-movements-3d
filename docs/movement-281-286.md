# Finite cam contacts: movements 281 and 286

Sources: [281 caption and engraving](https://507movements.com/mm_281.html), [286 caption, engraving and animation](https://507movements.com/mm_286.html). The 281 page contains neither `ae.add_model` nor `mm_present`; 286 contains both. The running 286 canvas was observed and confirms rocking clearance take-up, vertical lifting and return. The existing independent motion reconstructions are retained: a rotating closed groove rocks 281's long lever, while 286's rocking toe takes up clearance, lifts the valve train, and releases it.

## 281: a recessed channel instead of solid tubes

The former representation drew two solid tubes above an uncut disk. The finite follower penetrated the disk by 0.18 model units and both nominal groove tubes by approximately 0.07453. Its correct centerline animation concealed those solid intersections.

The replacement mills a closed channel from the existing analytical pin trajectory. Offset loops form the inner and outer lands, connected by a continuous disk floor. The channel bottom is at Z = −0.04 and the front lands reach Z = 0.18; the pin tip at Z = 0 therefore has 0.04 bottom clearance and shares 0.18 depth with the walls. The old groove width and pin radius remain unchanged, retaining approximately 0.035 lateral clearance on either side. The rendered side walls, not raised tubes, now bound the pin.

The Fourier lever law and measured source groove fit remain inherited analytical idealizations. Playback follows the channel centerline and omits clearance take-up and side switching under load. This fixes the visible solids; it does not establish a passive contact simulation.

## 286: toe, guides and valve seat

The former finite shoe straddled its nominal contact plane by half its 0.045 thickness. Outward bevels, raised toe trim and the nose marker also occupied the lifting face. The shoe's underside now lies on the prescribed support plane; the load-bearing toe/lifter have no outward bevel at their contact, and decorative details remain within the toe's working envelope. The circular working flank uses 128 samples to bound faceting error. Source toe proportions and the existing lift law are retained.

Both rod guides were displaced 0.10 in depth from the rod centerline, producing about 0.06482 penetration. They are now coaxial and positioned outside the lifter/poppet sweep. The rear standard had intersected the lifter by approximately 0.077; it is moved behind the train, connected to the guides with brackets, and extended to the base. These supports are inferred construction details rather than shapes specified by the engraving.

The former valve seat sat well below the closed head. A finite annular seat now contacts the head's bottom rim at zero lift and opens by exactly the animated valve lift. Two supports connect it to the base outside the head's sweep. The seat is an inferred flat annular contact, not a claimed historical sealing-face reconstruction.

## Validation and limits

Run `node --test tests/movement-281.test.mjs tests/movement-286.test.mjs tests/cam-281-286-solids.test.mjs`.

The added regressions inspect actual plate outlines and finite mesh surfaces:

- 281: 513 poses bound lateral wall clearance within 0.0001 of the retained 0.035; pin-to-floor/walls/disk/rim checks confirm no sampled intersection. The floor and shared wall depth are checked, with an uncut-disk negative control.
- 286: 513 poses compare the visible shoe underside with the finite toe; active contact has less than 0.00006 facet gap. Restoring the former shoe offset produces over 0.0224 interference.
- 129-pose bidirectional surface probes cover toe/trim/index versus shoe/lifter, both guides versus rod, and lifter/poppet versus fixed supports, guides, base and seat. Only numerical boundary errors below 2e-7 are allowed. Rod coverage and valve seat gap are also checked over the stroke.
- Both models suppress floor and fog so their suspended working parts remain visible.

Browser review compared default, front and rear views with both source engravings. A 65-pose check of actual visible vertices found no default-camera clipping in either model; floor and fog remain suppressed. Screenshots and the official-animation observation snapshots are retained in RAM, outside Git.

These are bounded geometric corrections. The rod and toe returns, preload, impact during clearance take-up, loads and friction remain prescribed or unqualified. In particular, 286's rigid kinematic take-up has not been validated for impact dynamics. The source groove and toe curves are inherited idealizations. No passive MuJoCo qualification or exhaustive whole-assembly collision certification is claimed.
