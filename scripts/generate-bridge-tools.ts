import {writeFile,readFile} from 'node:fs/promises';
import {z} from 'zod';
import {tools} from '../model-service/tools';
function subset(value:any):any{
 if(Array.isArray(value))return value.map(subset);
 if(!value||typeof value!=='object')return value;
 if(value.anyOf){const alternatives=value.anyOf.map(subset);if(alternatives.length===2&&alternatives.some((s:any)=>s.type==='null')){const other=alternatives.find((s:any)=>s.type!=='null');return{...other,type:[other.type,'null']};}throw Error('Unsupported schema union.');}
 const allowed=new Set(['type','properties','required','additionalProperties','enum','minimum','maximum','minLength','maxLength','items','minItems','maxItems','description']);
 const result:any={};
 for(const [key,entry]of Object.entries(value)){if(key==='const')result.enum=[entry];else if(key==='exclusiveMinimum'&&value.type==='integer')result.minimum=Math.floor(entry as number)+1;else if(key==='exclusiveMaximum'&&value.type==='integer')result.maximum=Math.ceil(entry as number)-1;else if(key==='properties')result.properties=Object.fromEntries(Object.entries(entry as any).map(([name,schema])=>[name,subset(schema)]));else if(allowed.has(key))result[key]=subset(entry);else if(key==='$schema'||key==='format'||key==='pattern'||key==='safeint')continue;else throw Error('Unsupported generated schema field: '+key);}
 return result;
}
const descriptors=tools.map(tool=>({name:tool.name,description:tool.description,operation:tool.annotations?.readOnlyHint?'read':'control',inputSchema:subset(z.toJSONSchema(z.object(tool.inputSchema).strict(),{unrepresentable:'any'}))}));
const destination=new URL('../src/model-integration/control-tools.json',import.meta.url),contents=JSON.stringify(descriptors,null,2)+'\n';
if(process.argv.includes('--check')){if((await readFile(destination,'utf8')).replace(/\r\n/g,'\n')!==contents)throw Error('Bridge tool descriptors are stale. Run npm run bridge:schema.');console.log('Bridge tool descriptors match Solar control schemas.');}
else{await writeFile(destination,contents);console.log(`Generated ${descriptors.length} model tool descriptors; domain validation remains in Solar.`);}
