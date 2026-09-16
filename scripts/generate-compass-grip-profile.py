"""Extract 409's visible scalloped grip; joints and occluded web stay analytical."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
ROOT = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='507-compass-') as directory:
    output = Path(directory) / '409'
    subprocess.run([sys.executable, str(ROOT / 'scripts/extract-engraving-contours.py'),
                    str(ROOT / 'public/engravings/mm_409.png'), '--output', str(output)],
                   check=True, capture_output=True)
    data = json.loads(output.with_suffix('.json').read_text())
    contour = next(c for c in data['contours'] if c['id'] == 11)
    # The observed lower circular shoulder and tip establish the front leg axis.
    origin = (310, 305)
    dx, dy = 425 - origin[0], 502 - origin[1]
    length = (dx * dx + dy * dy) ** .5
    points = []
    for px, py in contour['points']:
        x, y = px - origin[0], py - origin[1]
        points.append([round((x * dy - y * dx) / length * .0075, 6),
                       round(-.88 - (x * dx + y * dy) / length * .0075, 6)])
    profile = {'sourceSha256': data['sourceSha256'], 'contour': 11,
               'sourceShoulder': origin, 'sourceTip': [425, 502],
               'unitsPerPixel': .0075, 'points': points}
    (ROOT / 'src/simulation/compass-grip-profile.js').write_text(
        '// Offline OpenCV contour; only the visible scalloped grip is recovered.\n'
        'export const compassGripProfile = ' + json.dumps(profile, separators=(',', ':')) + ';\n')
