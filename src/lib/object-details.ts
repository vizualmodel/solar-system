import {byId} from './catalog';
import {objectInfo} from '../data/object-info';
import images from '../data/object-images.json';

export function objectDetails(id:string){
 const body=byId[id],info=objectInfo[id],image=images[id as keyof typeof images];
 if(!body||!info||!image)throw new Error(`No information available for ${id}.`);
 const facts:[string,string][]=[];
 if(body.kind!=='satellite')facts.push(['Mean radius',`≈ ${body.radius.toLocaleString('en-GB',{maximumFractionDigits:1})} km`]);
 if(body.parent)facts.push(['Orbits',byId[body.parent].name]);
 if(info.period)facts.push(['Orbital period',info.period]);
 facts.push(...(info.facts??[]));
 return {...info,name:body.name,color:body.color,facts,image,wikipediaUrl:'https://en.wikipedia.org/wiki/'+info.wikipedia};
}
