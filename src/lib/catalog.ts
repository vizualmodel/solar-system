export interface Body { id: string; name: string; parent: string | null; radius: number; color: string; texture?: string; }
export const bodies: Body[] = [
 {id:'sun',name:'Sun',parent:null,radius:695700,color:'#ffd18a',texture:'sun'},
 {id:'mercury',name:'Mercury',parent:'sun',radius:2439.7,color:'#ada79e',texture:'mercury'},
 {id:'venus',name:'Venus',parent:'sun',radius:6051.8,color:'#dfbb80',texture:'venus_atmosphere'},
 {id:'earth',name:'Earth',parent:'sun',radius:6371,color:'#69b7ef',texture:'earth_daymap'},
 {id:'mars',name:'Mars',parent:'sun',radius:3389.5,color:'#e88b65',texture:'mars'},
 {id:'jupiter',name:'Jupiter',parent:'sun',radius:69911,color:'#d7b798',texture:'jupiter'},
 {id:'saturn',name:'Saturn',parent:'sun',radius:58232,color:'#e1cd98',texture:'saturn'},
 {id:'uranus',name:'Uranus',parent:'sun',radius:25362,color:'#9bd8df',texture:'uranus'},
 {id:'neptune',name:'Neptune',parent:'sun',radius:24622,color:'#6590ef',texture:'neptune'},
 {id:'moon',name:'Moon',parent:'earth',radius:1737.4,color:'#c5c8cf',texture:'moon'},
 {id:'phobos',name:'Phobos',parent:'mars',radius:11.1,color:'#a39889'},
 {id:'deimos',name:'Deimos',parent:'mars',radius:6.2,color:'#b6a898'},
 {id:'io',name:'Io',parent:'jupiter',radius:1821.6,color:'#d9c779'},
 {id:'europa',name:'Europa',parent:'jupiter',radius:1560.8,color:'#d9cec0'},
 {id:'ganymede',name:'Ganymede',parent:'jupiter',radius:2634.1,color:'#a79f90'},
 {id:'callisto',name:'Callisto',parent:'jupiter',radius:2410.3,color:'#968b80'},
 {id:'titan',name:'Titan',parent:'saturn',radius:2574.7,color:'#d2a664'},
 {id:'enceladus',name:'Enceladus',parent:'saturn',radius:252.1,color:'#dee8ed'},
 {id:'titania',name:'Titania',parent:'uranus',radius:788.9,color:'#b6b9b9'},
 {id:'oberon',name:'Oberon',parent:'uranus',radius:761.4,color:'#aaa39e'},
 {id:'triton',name:'Triton',parent:'neptune',radius:1353.4,color:'#c5bdb7'}
];
export const byId = Object.fromEntries(bodies.map(b => [b.id,b]));
export const AU = 149597870.7;
