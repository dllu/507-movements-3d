// Visible cam-edge landmarks in public/engravings/mm_137.png (525 × 525).
// The upper/lower roller occlusions are deliberately not treated as measured edges.
export const expansionEccentricOutline = {
  shaft: [82, 226],
  forkPivot: [449, 230],
  rollerCenters: { upper: [82, 120], lower: [80, 332] },
  visibleRuns: [
    [[110,138],[127,144],[147,157],[162,175],[171,195],[174,211],
      [170,229],[160,245],[148,258],[142,279],[131,296],[116,304],[102,307]],
    [[60,302],[49,288],[41,270],[34,252],[22,242],[15,230],[14,215],
      [18,200],[26,185],[39,172],[54,160],[65,151]],
  ],
  // The shaft and fork axes are robust; hidden cam arcs and roller radii need
  // a mechanically consistent reconstruction before this can drive playback.
};
