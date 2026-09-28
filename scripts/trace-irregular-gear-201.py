# Trace the pitch curve of Brown's irregular driving gear in mm_201.png.
#
# The gear's white interior (bounded by the inner edge of its tooth outline)
# is flood-filled from a seed inside the gear and sampled in polar form about
# the region's centroid. That boundary alternates between tip and root; a
# sliding maximum and minimum over one tooth pitch give the tip and root
# envelopes, and their mean plus half the ink width is the mid-tooth (pitch)
# curve. Angles where the pinion and hub overlap the gear (-15..45 degrees
# about the centroid, towards the mesh) are excluded, and a least-squares
# Fourier series with HARMONICS terms, well below the 18-tooth frequency,
# gives the smooth closed pitch curve R(u) the model rolls on:
#   p(u) = centre + R(u) (cos u, sin u), in model units, relative to the
#   driver shaft, in the plate pose (driver angle 0).
# Prints the constants pasted into eccentricGearCarriedPinionRocker.
import json, math, sys
import numpy as np
from PIL import Image
from scipy import ndimage
from scipy.ndimage import maximum_filter1d, minimum_filter1d

IMAGE = 'public/engravings/mm_201.png'
SCALE = 0.0135                       # model units per source pixel
SHAFT = np.array([207.0, 65.0])      # driver shaft pixel
SEED = (100, 170)                    # (row, col) inside the gear
HARMONICS = int(sys.argv[1]) if len(sys.argv) > 1 else 5
OCCLUDED = (-15.0, 45.0)             # degrees about the centroid
INK_HALF_WIDTH = 1.0
TOOTH_PITCH_PIXELS = 21.0
TANGENCY_WEIGHT = float(sys.argv[2]) if len(sys.argv) > 2 else 4.0

ink = np.array(Image.open(IMAGE).convert('L')) < 150
labels, _ = ndimage.label(~ink)
region = ndimage.binary_fill_holes(labels == labels[SEED])
ys, xs = np.nonzero(region)
centroid = np.array([xs.mean(), ys.mean()])

N = 2048
angles = 2 * math.pi * np.arange(N) / N
radius = np.zeros(N)
for k, t in enumerate(angles):
    c, s = math.cos(t), -math.sin(t)
    last = 0.0
    for step in range(0, 1200):
        r = step / 10
        if region[int(round(centroid[1] + r * s)), int(round(centroid[0] + r * c))]:
            last = r
    radius[k] = last
window = int(TOOTH_PITCH_PIXELS / np.median(radius) / (2 * math.pi) * N)
def smooth(values):
    padded = np.r_[values[-window:], values, values[:window]]
    return np.convolve(padded, np.ones(window) / window, 'same')[window:-window]
tip = smooth(maximum_filter1d(radius, window, mode='wrap'))
root = smooth(minimum_filter1d(radius, window, mode='wrap'))
mid = (tip + root) / 2 + INK_HALF_WIDTH
degrees = np.degrees(angles)
visible = ~((degrees > 360 + OCCLUDED[0]) | (degrees < OCCLUDED[1]))
def columns(u):
    return np.stack([np.ones_like(u)] + sum([[np.cos(k * u), np.sin(k * u)] for k in range(1, HARMONICS + 1)], []), 1)
# Brown's pinion hides the mesh itself. The pinion's pitch circle (8 of the
# gear's tooth pitches about its drawn centre) must touch the pitch curve
# there, so the fit carries one heavily weighted tangency point: the point of
# that circle nearest the gear's centroid.
PINION = np.array([269.0, 74.0])
pinion_pitch_radius = 8 * TOOTH_PITCH_PIXELS / (2 * math.pi)
for _ in range(20):
    towards = centroid - PINION
    touch = PINION + pinion_pitch_radius * towards / np.linalg.norm(towards)
    touch_angle = math.atan2(-(touch[1] - centroid[1]), touch[0] - centroid[0]) % (2 * math.pi)
    touch_radius = np.linalg.norm(touch - centroid)
    A = np.vstack([columns(angles[visible]), TANGENCY_WEIGHT * columns(np.array([touch_angle]))])
    b = np.r_[mid[visible], TANGENCY_WEIGHT * touch_radius]
    coefficients, *_ = np.linalg.lstsq(A, b, rcond=None)
    fine = np.linspace(0, 2 * math.pi, 20001)[:-1]
    rr = columns(fine) @ coefficients
    xx, yy = rr * np.cos(fine), rr * np.sin(fine)
    perimeter = np.sum(np.hypot(np.diff(np.r_[xx, xx[0]]), np.diff(np.r_[yy, yy[0]])))
    pinion_pitch_radius = perimeter * 8 / (18 * 2 * math.pi)
residual = columns(angles[visible]) @ coefficients - mid[visible]
# Tooth count from the boundary ripple (peaks above a low-pass trend).
spectrum = np.fft.rfft(radius); spectrum[7:] = 0
detail = radius - np.fft.irfft(spectrum, N)
peaks, state = 0, None
for value in detail:
    if value > 2.5 and state != 'hi': state = 'hi'; peaks += 1
    elif value < -2.5 and state != 'lo': state = 'lo'
# Image y points down: the model's (cos u, sin u) is the image's (cos u, -sin u).
centre = [(centroid[0] - SHAFT[0]) * SCALE, -(centroid[1] - SHAFT[1]) * SCALE]
print(json.dumps({
    'centroidPixel': centroid.round(4).tolist(),
    'visibleTeeth': peaks,
    'traceResidualRmsPixels': float(np.sqrt(np.mean(residual ** 2))),
    'harmonics': HARMONICS,
    'tangencyWeight': TANGENCY_WEIGHT,
    'pinionPitchRadiusPixels': pinion_pitch_radius,
    'centre': [round(v, 6) for v in centre],
    'radiusCoefficients': [round(float(c) * SCALE, 7) for c in coefficients],
}, indent=1))
