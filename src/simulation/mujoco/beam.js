/**
 * Bending spring between the average orientations of neighboring beam cells.
 * At a clamped root, the first orientation is half a cell from the boundary.
 * Fixing that whole cell would shorten the flexible span as resolution changes.
 * EI is the flexural rigidity about the selected local cross-section axis.
 */
export function beamBendingStiffness(EI, length, previousLength = null) {
  if (!(Number.isFinite(EI) && EI > 0 && Number.isFinite(length) && length > 0) ||
      (previousLength !== null && !(Number.isFinite(previousLength) && previousLength > 0)))
    throw new RangeError('Beam rigidity and cell lengths must be positive');
  return EI / (previousLength === null ? length / 2 : (length + previousLength) / 2);
}
