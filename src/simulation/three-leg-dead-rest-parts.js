// Movement 306 presentation corrections; 307 builds its own finite parts.
export function correctThreeLegDeadRests(root, id) {
  if (id !== 306) throw new Error(`correctThreeLegDeadRests is specific to 306, not ${id}`);
  const d = root.userData;
  for (const marker of d.blocks.toothTips) marker.visible = false;
  d.reconstructionNote = 'The three bent legs work the steps of Brown\'s opening: the vertical steps take the upper and lower impulses and the horizontal side steps are half-dead rests. The wheel moves only as these finite faces allow and falls freely between them; the pendulum is prescribed and forces are not solved.';
}
