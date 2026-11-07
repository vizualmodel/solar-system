import test from 'node:test';
import assert from 'node:assert/strict';
import { validViewProbe, installWorkspaceViewProbe } from '../companion/workspace-view';
test('workspace identity probes require the registered parent, origin and nonce',()=>{
 const parent={} as Window;
 const event={source:parent,origin:'http://127.0.0.1:5190',data:{type:'vmblu-view-probe',nonce:'one'}};
 assert.equal(validViewProbe(event,parent,event.origin),true);
 assert.equal(validViewProbe({...event,source:{} as Window},parent,event.origin),false);
 assert.equal(validViewProbe({...event,origin:'https://other.example'},parent,event.origin),false);
 assert.equal(validViewProbe({...event,data:{type:'vmblu-view-probe'}},parent,event.origin),false);
});

test('a separate application tab identifies itself only to its registered workspace opener',async()=>{
 const originals=new Map<string,PropertyDescriptor|undefined>();
 let receive:((event:any)=>Promise<void>)|undefined;
 const replies:any[]=[];
 const opener={postMessage:(message:any,origin:string)=>replies.push({message,origin})};
 const tab:any={opener,addEventListener:(_:string,fn:any)=>receive=fn,removeEventListener:()=>receive=undefined};tab.parent=tab;
 const values={window:tab,sessionStorage:{getItem:()=> 'tab-owner'},fetch:async()=>({ok:true,json:async()=>({workspaceAgent:{url:'http://127.0.0.1:5190/workspace/'}})})};
 for(const [name,value]of Object.entries(values)){originals.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});}
 const cleanup=installWorkspaceViewProbe();
 try{
  const event={source:opener,origin:'http://127.0.0.1:5190',data:{type:'vmblu-view-probe',nonce:'tab-probe'}};
  await receive!({...event,source:{}});await receive!({...event,origin:'https://other.example'});
  assert.equal(replies.length,0);
  await receive!(event);
  assert.deepEqual(replies,[{message:{type:'vmblu-view-identity',nonce:'tab-probe',instanceId:'tab-owner'},origin:event.origin}]);
  tab.opener=null;await receive!(event);assert.equal(replies.length,1);
 }finally{cleanup();for(const [name,original]of originals){if(original)Object.defineProperty(globalThis,name,original);else delete(globalThis as any)[name];}}
});
