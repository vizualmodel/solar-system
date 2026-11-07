import {createCompanionClient} from '../../src/client';import {counterAdapter} from './adapter';
const output=document.querySelector('#count')!;
const adapter=counterAdapter(n=>output.textContent=String(n));
const client=createCompanionClient(adapter);
client.start();
document.querySelector('#increment')!.addEventListener('click',()=>adapter.execute('increment',{amount:1},{id:'ui',expiresAt:Date.now()+1000}));
client.panel.subscribe(p=>{document.querySelector('#status')!.textContent=p.status;document.querySelector('#history')!.textContent=p.items.filter((i:any)=>i.type==='agentMessage').map((i:any)=>i.text).join('\n');});
document.querySelector('form')!.addEventListener('submit',e=>{e.preventDefault();const input=document.querySelector('textarea')!;try{client.action('submit',{text:input.value});input.value='';}catch(e){document.querySelector('#status')!.textContent=String(e);}});
