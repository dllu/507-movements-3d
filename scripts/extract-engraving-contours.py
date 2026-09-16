#!/usr/bin/env python3
"""Extract observed ink boundaries; never infer hidden mechanical geometry."""

import argparse
import hashlib
import json
from pathlib import Path
import time
import xml.etree.ElementTree as ET

import cv2
import numpy as np


def integers(value):
    try:
        return [int(part) for part in value.split(",")]
    except ValueError as error:
        raise argparse.ArgumentTypeError("Expected comma-separated integers") from error


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image", type=Path)
    parser.add_argument("--output", type=Path, required=True, help="Output prefix")
    parser.add_argument("--roi", type=integers, help="Source pixels: x,y,width,height")
    parser.add_argument("--threshold", default="otsu", help="otsu or integer 0–255")
    parser.add_argument("--epsilon", type=float, default=0.8, help="Polygon approximation parameter in source pixels")
    parser.add_argument("--min-area", type=float, default=12, help="Minimum root ink-component area; holes are retained")
    parser.add_argument("--contours", type=integers, help="Select contour IDs and their descendants from a first pass")
    args = parser.parse_args()
    if args.epsilon < 0 or args.min_area < 0:
        parser.error("epsilon and min-area must be nonnegative")

    started = time.perf_counter()
    source = cv2.imread(str(args.image), cv2.IMREAD_COLOR)
    if source is None:
        parser.error(f"Cannot read {args.image}")
    height, width = source.shape[:2]
    roi = args.roi or [0, 0, width, height]
    if len(roi) != 4:
        parser.error("ROI must have four integers")
    x, y, crop_width, crop_height = roi
    if x < 0 or y < 0 or crop_width <= 0 or crop_height <= 0 or x + crop_width > width or y + crop_height > height:
        parser.error("ROI must be a nonempty rectangle inside the source image")
    gray = cv2.cvtColor(source[y:y + crop_height, x:x + crop_width], cv2.COLOR_BGR2GRAY)
    if args.threshold == "otsu":
        threshold, mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)
    else:
        try:
            threshold = int(args.threshold)
        except ValueError:
            parser.error("threshold must be otsu or an integer 0–255")
        if not 0 <= threshold <= 255:
            parser.error("threshold must be in 0–255")
        _, mask = cv2.threshold(gray, threshold, 255, cv2.THRESH_BINARY_INV)

    contours, hierarchy = cv2.findContours(mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_NONE)
    hierarchy = hierarchy[0] if hierarchy is not None else []
    parents = [int(entry[3]) for entry in hierarchy]

    def ancestors(index):
        result = []
        while parents[index] >= 0:
            index = parents[index]
            result.append(index)
        return result

    if args.contours is not None:
        if any(index < 0 or index >= len(contours) for index in args.contours):
            parser.error(f"Contour IDs must be in 0–{len(contours) - 1}")
        requested = set(args.contours)
        roots = {index for index in requested if not requested.intersection(ancestors(index))}
    else:
        roots = {
            index for index, contour in enumerate(contours)
            if parents[index] == -1 and cv2.contourArea(contour) >= args.min_area
        }
    selected = [index for index in range(len(contours)) if index in roots or roots.intersection(ancestors(index))]
    selected_set = set(selected)
    records = []
    overlay = source.copy()
    svg = ET.Element("svg", {
        "xmlns": "http://www.w3.org/2000/svg", "width": str(width), "height": str(height),
        "viewBox": f"0 0 {width} {height}",
    })
    ET.SubElement(svg, "title").text = "Observed engraving contours in source pixel coordinates"
    for index in selected:
        contour = contours[index]
        polygon = cv2.approxPolyDP(contour, args.epsilon, True)
        # Do not erase tiny holes merely because their simplified polygon degenerates.
        if len(polygon) < 3 <= len(contour):
            polygon = contour
        source_points = polygon[:, 0, :] + [x, y]
        bx, by, bw, bh = cv2.boundingRect(contour)
        depth = len(ancestors(index))
        points = source_points.tolist()
        record = {
            "id": index,
            "parent": parents[index] if parents[index] in selected_set else None,
            "sourceParent": parents[index] if parents[index] >= 0 else None,
            "depth": depth,
            "boundary": "ink-outer" if depth % 2 == 0 else "ink-hole",
            "areaPixels": cv2.contourArea(contour),
            "bbox": [bx + x, by + y, bw, bh],
            "touchesCropBoundary": bx == 0 or by == 0 or bx + bw == crop_width or by + bh == crop_height,
            "rawVertexCount": len(contour),
            "points": points,
        }
        records.append(record)
        color = (30, 130, 245) if depth % 2 == 0 else (210, 155, 20)
        cv2.polylines(overlay, [source_points.astype(np.int32)], True, color, 1, cv2.LINE_AA)

    by_id = {record["id"]: record for record in records}
    for root in sorted(roots):
        members = [index for index in selected if index == root or root in ancestors(index)]
        paths = []
        for index in members:
            points = by_id[index]["points"]
            paths.append("M " + " L ".join(f"{px},{py}" for px, py in points) + " Z")
        ET.SubElement(svg, "path", {
            "id": f"contour-{root}", "d": " ".join(paths), "fill": "black", "fill-rule": "evenodd",
        })

    data = {
        "schemaVersion": 1,
        "source": str(args.image),
        "sourceSha256": hashlib.sha256(args.image.read_bytes()).hexdigest(),
        "imageSize": [width, height],
        "roi": roi,
        "coordinates": "Source pixels: origin at top-left, x right, y down; closed contour polygons.",
        "method": {
            "opencv": cv2.__version__, "threshold": threshold, "thresholdMethod": args.threshold,
            "epsilonPixels": args.epsilon, "minRootAreaPixels": args.min_area,
            "morphology": "none", "hiddenGeometryInference": "none",
        },
        "limitations": [
            "Boundaries describe thresholded ink, not identified mechanical parts or centerlines.",
            "Hatching, labels, overlapping parts and broken lines require semantic cleanup.",
            "Crop-border segments are artificial closures, not observed physical edges.",
            "Polygon simplification is approximate; epsilon is not a mechanical clearance tolerance.",
        ],
        "contours": records,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    def output_path(suffix):
        return args.output.parent / (args.output.name + suffix)

    output_path(".json").write_text(json.dumps(data, indent=2) + "\n")
    ET.ElementTree(svg).write(output_path(".svg"), encoding="unicode", xml_declaration=True)
    # The threshold image is cropped; overlay and vectors retain full source coordinates.
    for suffix, image in [(".threshold.png", 255 - mask), (".overlay.png", overlay)]:
        path = output_path(suffix)
        if not cv2.imwrite(str(path), image):
            raise OSError(f"Cannot write {path}")
    raw = sum(record["rawVertexCount"] for record in records)
    simplified = sum(len(record["points"]) for record in records)
    print(json.dumps({
        "output": str(args.output), "contours": len(records), "roots": len(roots),
        "rawVertices": raw, "vertices": simplified, "elapsedSeconds": round(time.perf_counter() - started, 3),
        "largestContours": [
            {key: record[key] for key in ["id", "boundary", "areaPixels", "bbox", "touchesCropBoundary"]}
            for record in sorted(records, key=lambda record: record["areaPixels"], reverse=True)[:12]
        ],
    }, indent=2))


if __name__ == "__main__":
    main()
