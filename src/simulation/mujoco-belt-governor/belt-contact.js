// Axial contact width of a finite flat belt on the three cylindrical pulley
// faces. Partial engagement is mechanically meaningful: the middle pulley is
// loose and may turn with the belt while an adjacent fast pulley drives it.
export function beltPulleyOverlap(beltY,g){
 const beltWidth=.324,pulleyWidth=.288;
 const overlap=center=>Math.max(0,Math.min(beltY+beltWidth/2,center+pulleyWidth/2)-Math.max(beltY-beltWidth/2,center-pulleyWidth/2));
 return{upper:overlap(g.upperPulleyY),middle:overlap(g.middlePulleyY),lower:overlap(g.lowerPulleyY),beltWidth,pulleyWidth};
}
