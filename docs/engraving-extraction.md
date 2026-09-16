# Extract visible engraving outlines before reconstruction

Use `scripts/extract-engraving-contours.py` to obtain visible irregular edges in
seconds, then spend reconstruction time on identifying parts and recovering hidden
segments. It uses OpenCV Otsu thresholding, contour hierarchy, and polygon
simplification. It does not require a browser, image generation, or manual tracing.

The output is **observed ink geometry**, not an automatically identified mechanism.
Use analytical circles, gear teeth, sine waves, or cam laws when those define the
intended part; reproducing hand-drawn irregularities would make those parts worse.

## Run offline

Install the optional tooling outside the repository. The demonstrated version is
OpenCV 5.0.0.93; none of these dependencies enter the web application.

```sh
python3 -m venv /dev/shm/507-contours-venv
/dev/shm/507-contours-venv/bin/pip install opencv-python-headless==5.0.0.93
/dev/shm/507-contours-venv/bin/python scripts/extract-engraving-contours.py \
  public/engravings/mm_183.png --output /dev/shm/507-contours/183
```

Each run produces:

- `.overlay.png`: simplified orange outer boundaries and blue hole boundaries on
  the full source image, for immediate inspection.
- `.svg`: vector paths with even–odd fill and nested holes retained.
- `.json`: source hash, processing parameters, contour IDs, hierarchy, original
  vertex counts, simplified points, areas, bounds, and crop-boundary flags.
- `.threshold.png`: the thresholded crop, to diagnose missing or merged ink.

The CLI prints the largest contour IDs and bounds. Select a useful contour and its
descendants with `--contours ID`; a selected inner boundary becomes a filled SVG
region while JSON retains its original `sourceParent` and ink/hole classification.
IDs are valid for the same source, threshold, ROI, and OpenCV contour enumeration.
They are not stable part identifiers across different processing settings.

```sh
# A full heart-cam pass, followed by the visible enclosed region at contour 2.
/dev/shm/507-contours-venv/bin/python scripts/extract-engraving-contours.py \
  public/engravings/mm_217.png --output /dev/shm/507-contours/217
/dev/shm/507-contours-venv/bin/python scripts/extract-engraving-contours.py \
  public/engravings/mm_217.png --contours 2 --output /dev/shm/507-contours/217-heart

# Limit inspection to the lower quadrant while retaining source coordinates.
/dev/shm/507-contours-venv/bin/python scripts/extract-engraving-contours.py \
  public/engravings/mm_183.png --roi 190,215,185,125 \
  --output /dev/shm/507-contours/183-quadrant
```

The default `--min-area 12` filters small *root* ink components; descendants are
retained so filtering does not silently fill holes. Use `--threshold 128` to hold a
threshold fixed between crops. Otsu computes its threshold from each crop, so
different ROIs may otherwise produce slightly different boundaries. `--epsilon 0`
disables approximation; the default is 0.8 pixels. The parameter is not a proven
clearance bound, and simplification can change tiny features. Degenerate contours
can have fewer than three distinct points and are not extrudable polygons.

## Reconstruct only what remains unknown

1. Inspect the overlay and choose the relevant boundaries or visible spans. The
   two edges of a thick ink stroke are not two physical boundaries. Labels,
   hatching, dashed construction lines, and overlapping parts need interpretation.
2. Map source pixels to the existing mechanism coordinates: for source origin
   `[ox, oy]` and model units per pixel `s`, use
   `x = (px - ox) * s`, `y = (oy - py) * s`. ROIs do not change this origin.
3. Join visible spans belonging to the same part. Fit a line or circle where the
   mechanism calls for one. Recover occluded spans from another movement/stage,
   symmetry, or the mechanism's constraints, and record these inferred spans
   separately in the movement's reconstruction notes.
4. Validate contact geometry independently. Image thresholding establishes neither
   proper clearance nor correct motion. Retain source-derived visible geometry
   separately from simplified contact proxies where appropriate.

No morphology or gap filling is performed. An open stroke may merge an otherwise
enclosed region with its surroundings. Cropping also closes contours along the
image border: `touchesCropBoundary` marks potentially artificial closures. These
closures must not become contact surfaces merely because they appear in the SVG.

## First-pass observations

These three local engravings were processed with default settings and the overlays
were visually inspected. Timings exclude Python/OpenCV import startup and include
reading the image and writing the four artifacts.

| Movement | Retained contours | Original vertices | Simplified vertices | Extraction time |
| --- | ---: | ---: | ---: | ---: |
| 183 | 59 | 10,597 | 1,395 | 0.032 s |
| 184 | 115 | 10,267 | 1,492 | 0.064 s |
| 217 | 31 | 10,492 | 1,156 | 0.016 s |

This reduces the visible boundary data by approximately 85–89%. A separate check
of every retained original contour vertex against its simplified polygon measured
maximum distances of 0.920, 0.868, and 0.819 pixels respectively. These are
one-direction boundary checks, not a mechanical accuracy or topology guarantee.

For 183–184, the overlays follow the quadrant rims, hubs, and exposed handle edges
immediately; the major assembly is still joined by overlapping ink. The visible
lower quadrant region in 183 is available as full-image contour 50. For 217,
contour 2 captures the large enclosed heart-shaped region, but other cam strokes
are broken and labels remain within its hierarchy. Neither example supplies hidden
part boundaries without interpretation.

A synthetic nested-rectangle check also verified retained holes/islands, ROI
coordinate offsets, contour-subtree selection, crop-boundary flags, and output
prefixes containing dots. Generated fixtures and review outputs stay in
`/dev/shm/507-contours/`; no bulk review artifacts are committed.
