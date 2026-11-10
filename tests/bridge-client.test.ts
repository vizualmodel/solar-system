import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {EventEmitter} from 'node:events';
import {createHmac,randomBytes,webcrypto} from 'node:crypto';
import {transpileModule,ModuleKind,ScriptTarget} from 'typescript';
import {WebSocket,WebSocketServer} from 'ws';

// The actual shipped client runs against real sockets/crypto. DOM, protocol
// activation and model dispatch are fixtures, not real Chrome or model evidence.
async function fixture(t:any,options:{delayedActivation?:boolean;badProof?:boolean;deny?:boolean;autoConversation?:boolean;stall?:boolean;durable?:boolean;historyAccess?:boolean}={}){
  const origin='https://model.example',server=new WebSocketServer({host:'127.0.0.1',port:0});
  await new Promise<void>(resolve=>server.once('listening',resolve));const address=server.address();assert.ok(address&&typeof address==='object');const port=address.port;
  const events:any[]=[],frames:any[]=[],bus=new EventEmitter();let launch:URL,launches=0,connections=0,client:any,active=!options.delayedActivation,conversationSocket:WebSocket|undefined;
  function signature(role:string,nonce:string,instance:string){return createHmac('sha256',Buffer.from(launch.searchParams.get('challenge')!,'base64url')).update(JSON.stringify([1,role,nonce,origin,instance])).digest('base64url');}
  server.on('connection',socket=>{connections++;let nonce='',instance='';socket.on('message',data=>{
    const frame=JSON.parse(data.toString());frames.push(frame);bus.emit('frame',frame);
    if(frame.type==='hello'){
      if(options.stall)return;
      if(!active){active=true;socket.send(JSON.stringify({type:'error',message:'Connection rejected. Return to the model and start a fresh connection.'}));socket.close(1008);return;}
      nonce=randomBytes(32).toString('base64url');instance=frame.instance;socket.send(JSON.stringify({type:'proof',protocol:1,nonce,proof:options.badProof?'x'.repeat(43):signature('bridge',nonce,instance)}));
    }
    if(frame.type==='prove'){
      assert.equal(frame.proof,signature('browser',nonce,instance));
      if(options.deny){socket.close(1008,'Access not approved.');return;}
      socket.send(JSON.stringify({type:'connected',protocol:1,runtime:'Codex',session:randomBytes(32).toString('base64url'),credential:randomBytes(32).toString('base64url'),operate:false,capabilities:['chat','new_conversation',...(options.durable?['durable_history']:[]),...(options.historyAccess?['history_access']:[])]}));
    }
    if(frame.type==='new_conversation'){conversationSocket=socket;if(options.autoConversation!==false)socket.send(JSON.stringify({type:'conversation',threadId:'fixture-thread',history:[]}));}
    if(frame.type==='tool_result'){socket.send(JSON.stringify({type:'tool_activity',id:frame.id,name:'read_state',status:'succeeded'}));socket.send(JSON.stringify({type:'tool_activity',id:'runtime-call',name:'read_state',status:'completed'}));}
  });});
  class BrowserSocket extends WebSocket{constructor(url:string,protocols:string[]){assert.equal(url,'ws://127.0.0.1:46317/v1/connect');super(`ws://127.0.0.1:${port}/v1/connect`,protocols,{origin});}}
  const source=await fs.readFile(new URL('../src/model-integration/bridge-client.ts',import.meta.url),'utf8');
  const code=transpileModule(source,{compilerOptions:{module:ModuleKind.ESNext,target:ScriptTarget.ES2022}}).outputText.replace(/^import .*;\r?$/gm,'').replace('export function createBridgeClient','function createBridgeClient');
  const location={origin,set href(value:string){launch=new URL(value);launches++;}};
  const context=vm.createContext({WebSocket:BrowserSocket,crypto:webcrypto,btoa,URL,URLSearchParams,Uint8Array,ArrayBuffer,TextEncoder,setTimeout:(callback:()=>void,ms:number)=>setTimeout(callback,options.stall&&ms===60000?1100:ms),clearTimeout,window:{isSecureContext:true},location,__MODEL_BUILD__:'fixture',__MODEL_DATA__:'fixture',modelDescriptor:{label:'Fixture'},createBrowserActionAdapter:()=>({dispose(){},execute(){return{fixture:'read-only synthetic result'};}})});
  vm.runInContext(code+'\nglobalThis.factory=createBridgeClient;',context);
  client=context.factory((event:any)=>{events.push(event);bus.emit('event',event);});
  t.after(async()=>{client.dispose();for(const socket of server.clients)socket.terminate();await new Promise<void>(resolve=>server.close(()=>resolve()));});
  function wait(kind:'event'|'frame',predicate:(value:any)=>boolean){const found=(kind==='event'?events:frames).find(predicate);if(found)return Promise.resolve(found);return new Promise<any>((resolve,reject)=>{const timer=setTimeout(()=>{bus.off(kind,receive);reject(Error('Client fixture deadline expired.'));},6000);function receive(value:any){if(predicate(value)){clearTimeout(timer);bus.off(kind,receive);resolve(value);}}bus.on(kind,receive);});}
  return{client,events,frames,wait,counts:()=>({launches,connections}),finishConversation(){assert.ok(conversationSocket);conversationSocket.send(JSON.stringify({type:'conversation',threadId:'fixture-thread',history:[]}));},readFixture(){assert.ok(conversationSocket);for(const frame of [{type:'tool_activity',id:'runtime-call',name:'read_state',status:'running'},{type:'tool_activity',id:'browser-action',name:'read_state',status:'running'},{type:'tool_call',id:'browser-action',tool:'read_state',inputs:{},deadline:Date.now()+30000}])conversationSocket.send(JSON.stringify(frame));}};
}

test('delayed activation after the listener opens needs one launch click and no model replay',async t=>{
  const f=await fixture(t,{delayedActivation:true});f.client.connect(false);
  const result=await f.wait('event',e=>e.type==='status'&&['ready','error','disconnected'].includes(e.status));
  assert.equal(result.status,'ready');assert.equal(f.counts().launches,1);assert.equal(f.counts().connections,2);
  assert.equal(f.frames.filter(f=>f.type==='prove').length,1);assert.equal(f.frames.filter(f=>f.type==='new_conversation').length,1);assert.equal(f.frames.some(f=>['chat','tool_result'].includes(f.type)),false);
});
test('connection is ready only after Codex conversation acknowledgement',async t=>{
  const f=await fixture(t,{autoConversation:false});f.client.connect(false);await f.wait('frame',v=>v.type==='new_conversation');
  assert.equal(f.events.some(e=>e.type==='status'&&e.status==='ready'),false);
  assert.equal([...f.events].reverse().find(e=>e.type==='status').status,'connecting-runtime');
  f.finishConversation();assert.equal((await f.wait('event',e=>e.type==='status'&&e.status==='ready')).status,'ready');
});
test('an invalid Bridge proof stops before browser proof or runtime startup',async t=>{
  const f=await fixture(t,{badProof:true});f.client.connect(false);const result=await f.wait('event',e=>e.type==='status'&&e.status==='error');
  assert.match(result.message,/did not match/);assert.equal(f.frames.some(f=>['prove','new_conversation','chat'].includes(f.type)),false);assert.equal(f.counts().connections,1);
});
test('denied trusted consent does not silently retry or start Codex',async t=>{
  const f=await fixture(t,{deny:true});f.client.connect(false);await f.wait('event',e=>e.type==='status'&&e.status==='disconnected');
  assert.equal(f.counts().launches,1);assert.equal(f.counts().connections,1);assert.equal(f.frames.some(f=>f.type==='new_conversation'),false);
});
test('a listener that stalls before proving identity cannot keep pairing pending forever',async t=>{
  const f=await fixture(t,{stall:true});f.client.connect(false);const result=await f.wait('event',e=>e.type==='status'&&e.status==='disconnected');
  assert.match(result.message,/Pairing expired/);assert.equal(f.counts().connections,1);assert.equal(f.frames.some(f=>f.type==='prove'),false);
});
test('one browser operation is not counted twice through runtime and Bridge activity events',async t=>{
  const f=await fixture(t);f.client.connect(false);await f.wait('event',e=>e.type==='status'&&e.status==='ready');f.readFixture();await f.wait('event',e=>e.type==='tool_activity'&&e.status==='succeeded');
  const activity=f.events.filter(e=>e.type==='tool_activity');assert.deepEqual(activity.map(e=>e.id),['browser-action','browser-action']);assert.equal(new Set(activity.map(e=>e.id)).size,1);
});

test('durable history connects without a runtime; reading and resume are separate deliberate requests',async t=>{
  const f=await fixture(t,{durable:true,historyAccess:true});f.client.connect(false);await f.wait('frame',e=>e.type==='history_list');
  assert.equal(f.frames.some(e=>['new_conversation','chat'].includes(e.type)),false);assert.equal([...f.events].reverse().find(e=>e.type==='status')?.status,'archive');
  f.client.read('selected-archive');const read=await f.wait('frame',e=>e.type==='history_read');assert.equal(read.conversationId,'selected-archive');assert.equal(read.threadId,undefined);
  f.client.resume('selected-archive');await f.wait('frame',e=>e.type==='resume_conversation');assert.equal(f.frames.some(e=>e.type==='chat'),false);
});

test('history denied at consent remains in trusted Bridge; client sends no archive request automatically',async t=>{
  const f=await fixture(t,{durable:true});f.client.connect(false);await f.wait('event',e=>e.type==='status'&&e.status==='archive');assert.equal(f.frames.some(e=>e.type.startsWith('history_')||e.type==='new_conversation'),false);
});
