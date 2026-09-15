export function makeCrossedGovernorUpdater(root, g) {
  const names = ['rotor', 'output', 'valve', 'leftArm', 'rightArm', 'leftLink', 'rightLink', 'inputBevel', 'outputBevel'];
  const blocks = Object.fromEntries(names.map(name => [name, root.getObjectByName('body:' + name)]));
  return state => {
    blocks.rotor.rotation.y = state.spindle;
    blocks.inputBevel.rotation.z = Math.PI / 2 - state.spindle;
    blocks.outputBevel.rotation.z = Math.PI + Math.PI / 30 + state.spindle;
    blocks.output.position.y = state.outputY; blocks.valve.position.y = state.outputY;
    for (const sign of [-1, 1]) {
      const name = sign < 0 ? 'left' : 'right', spread = state[name + 'Spread'];
      blocks[name + 'Arm'].rotation.z = sign * spread;
      const x = -sign * g.extension * Math.sin(spread), wy = g.extension * Math.cos(spread);
      blocks[name + 'Link'].position.set(x, wy, sign * .275);
      blocks[name + 'Link'].rotation.z = Math.atan2(state.outputY - wy, -x) - Math.PI / 2;
    }
    root.updateMatrixWorld(true); root.userData.state = state;
  };
}
