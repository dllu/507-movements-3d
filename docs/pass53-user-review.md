# Pass 53: user review findings (2026-09-24)

The user reviewed movements by rotating and zooming the 3D views and set these rules for every movement:

1. **No engraving notation in renders.** The engraving dashes a part only to show that it is occluded. The 3D model shows the part itself, so dashed or dotted hidden-line outlines must not be drawn.
2. **No truncated parts.** Where the engraving breaks a part off or crops it (a squiggle or broken end), that is a drawing convention. Show the whole part, since the viewer can rotate and zoom.
3. **No decorative black rims** on part edges (e.g. 261, 272, 276).
4. **Consistent styling.** Parts drawn alike render alike. For example, 270 renders its ropes as braided rope while 001 renders a thin belt, although both engravings draw similar ropes.
5. **Construction artefacts are flaws** even when the default view looks fine.

Specific findings:
- **63:** the pawl is cut off in a weird way when the view is rotated, caused by the undrawn zone and dashed-leg treatment. The pawl outline has several steps, where the drawing and the Gallagher reconstruction are simple.
- **76:** the outer wheel is a truncated arc; it should be the whole wheel. Part B's tip is oddly shaped compared with the engraving.
- **305:** differs cosmetically from the plate a great deal. The pendulum hole was cut round and then refilled with two jagged, protruding pieces.
- **277:** the whole linkage to the right of the orange hammer is missing. Spring C swells in width as it deflects.
- **261, 272, 276:** black rims around some edges.
- **001:** a thin belt where the plate draws a rope like 270's.

Fix lanes: p53-no-hidden-lines, p53-parts, p53-no-crop and p53-style. A rotated-view audit of all 507 movements goes to /dev/shm/audit53.
