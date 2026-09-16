"""Extract normalized visible arm silhouettes for movements 349 and 367.

Run with the same optional OpenCV environment as extract-engraving-contours.py.
Pin centers and contour selections are semantic annotations, not traced outlines.
"""

import json
from pathlib import Path
import subprocess
import sys
import tempfile

REPOSITORY = Path(__file__).resolve().parents[1]
# The left upper arm of 349 and left full arm of 367 have closed visible edges.
SELECTIONS = (
    (349, 20, (162, 134), (245, 244)),
    (367, 30, (178, 331), (102, 194)),
)


def main():
    profiles = {}
    with tempfile.TemporaryDirectory(prefix="507-ruler-contours-") as directory:
        for movement, contour, start, end in SELECTIONS:
            output = Path(directory) / str(movement)
            subprocess.run(
                [sys.executable, str(REPOSITORY / "scripts/extract-engraving-contours.py"),
                 str(REPOSITORY / f"public/engravings/mm_{movement}.png"),
                 "--output", str(output)],
                check=True, capture_output=True, text=True,
            )
            data = json.loads(output.with_suffix(".json").read_text())
            selected = next(item for item in data["contours"] if item["id"] == contour)
            dx, dy = end[0] - start[0], start[1] - end[1]
            squared_length = dx * dx + dy * dy
            points = []
            for px, py in selected["points"]:
                x, y = px - start[0], start[1] - py
                points.append([
                    round((x * dx + y * dy) / squared_length, 6),
                    round((-x * dy + y * dx) / squared_length, 6),
                ])
            profiles[movement] = {
                "sourceSha256": data["sourceSha256"], "contour": contour,
                "sourcePins": [start, end], "points": points,
            }
    destination = REPOSITORY / "src/simulation/ruler-arm-profiles.js"
    destination.write_text(
        "// Offline OpenCV visible inner-ink contours; normalized pin distance is one.\n"
        "// Source pin centers set scale/orientation. Circular eyes replace hand-drawn bores.\n"
        "export const rulerArmProfiles = " + json.dumps(profiles, separators=(",", ":")) + ";\n"
    )
    print(f"Generated {destination.relative_to(REPOSITORY)}")


if __name__ == "__main__":
    main()
