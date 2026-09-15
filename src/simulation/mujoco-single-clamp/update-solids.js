export function makeSingleClampUpdater(root){
 const jaw=root.getObjectByName('body:jaw'),board=root.getObjectByName('body:board');
 return state=>{jaw.rotation.z=state.jaw;board.position.set(state.boardX,state.boardY,0);root.updateMatrixWorld(true);};
}
