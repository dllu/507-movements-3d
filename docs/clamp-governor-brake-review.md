# Working clamps: Pickering governor 287 and Prony brake 244

The [287 engraving and caption](https://507movements.com/mm_287.html) and
[244 engraving and caption](https://507movements.com/mm_244.html) were checked
against the models. Neither official page has a canvas animation. Pickering's
[US36621A patent](https://patents.google.com/patent/US36621A/en) supports the
three-leaf arrangement, the shaft-fixed feather and sliding sleeve, and weights
with passages and clamping plugs around the springs. Intended circles and smooth
spring centerlines are analytical rather than traced hand-drawn irregularities.

## Corrections

287's lower flange, keeper, sleeve and shoulders now have real keyed passages.
The feather is attached to the shaft and spans the sleeve travel; previously it
moved with the sleeve, outside the shaft. A bored neck joins the previously
separated flange and sleeve body. The fixed lower spindle bearing is bored.
Floating torus shoulders have become connected collars. The invented pedestal
and invisible camera envelope no longer determine the view. The oval weights
have actual leaf passages; two small pads represent the midpoint attachment.
The obsolete transverse solid pins and protruding ball markers are hidden.
A sixteen-second response cycle makes the six spindle turns readable, preserving
the original ratio and response law.

244's decorative extrusion bevels penetrated the drum despite nominal contact
radii matching. Unbeveled liners now circumscribe the finite rotating cylinder,
with less than .00005 separation from the intended sliding surface. The drum's
face index is flush. Fixed stops now connect to their rear standard, and the
suspension eye sits below the lever with its opening unobstructed. The four scale
cords meet the bottom of that eye. The four-second steady brake cycle is retained.

Both use source-facing full-cycle bounds and disable ground and fog. Existing
analytical motion and scalar state APIs are preserved. Playback adds no geometry
allocation; the governor's existing leaf buffers continue to deform in place.

## Evidence and limitations

All 20 focused tests pass: existing 244/287 law and renderer tests, 25-pose
selected finite-surface sweeps, actual brake contact proximity, shaft/keyway
clearance, leaf/weight passage clearance and sleeve attachment checks. Deforming
leaf surfaces and their triangle queries are refreshed at each pose. This is a
selected-interface check, not a claim of global physical validation.

287 retains an inextensible chosen leaf-centerline family and a calibrated
radial spring law. Its varying spindle speed prescribes a quasi-static response;
bending stress, inertia, gravity, valve load and passive governor stability are
not solved. End clamps and midpoint pads simplify the patent's grooves, taper
plugs and fasteners. The weight passages are simplified straight bores.

244 illustrates an already balanced steady operating point. Its imposed clamp
load and coefficient give the torque balanced by the scale weights; the 35/65
upper/lower load split is an assumption. Stop engagement, passive lever settling,
thermal dissipation, detailed pressure distribution and screw/strap adjustment
are not simulated. Added depth connections and running clearances are inferred.

Final browser source/default and oblique views have no errors. Seventeen
full-cycle projected-vertex poses remain inside the viewport: maximum NDC .885
for 244 and .717 for 287. Bulk captures remain in `/dev/shm`.
