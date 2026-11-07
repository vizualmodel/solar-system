export type Layout={kind:'view';id:string}|{kind:'split';direction:'row'|'column';children:[Layout,Layout]};
export function splitLayout(node:Layout,id:string,newId:string,direction:'row'|'column'):Layout{
 if(node.kind==='view')return node.id===id?{kind:'split',direction,children:[node,{kind:'view',id:newId}]}:node;
 return {...node,children:node.children.map(c=>splitLayout(c,id,newId,direction)) as [Layout,Layout]};
}
export function removeLayout(node:Layout,id:string):Layout|null{
 if(node.kind==='view')return node.id===id?null:node;
 const a=removeLayout(node.children[0],id),b=removeLayout(node.children[1],id);
 return !a?b:!b?a:{...node,children:[a,b]};
}
