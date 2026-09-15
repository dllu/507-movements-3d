export function makeBenchClampUpdater(root){
 const upper=root.getObjectByName('body:jaw0'),lower=root.getObjectByName('body:jaw1'),board=root.getObjectByName('body:board');
 return state=>{upper.rotation.z=state.upper;lower.rotation.z=state.lower;board.position.x=state.board;board.position.y=state.boardY;root.updateMatrixWorld(true);};
}
