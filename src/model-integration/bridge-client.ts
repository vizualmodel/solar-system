import { createBrowserActionAdapter } from './browser-adapter';
import { modelDescriptor } from './manifest';
import type { ModelRequest } from './adapter';
type Event = {type:string;[key:string]:any};
const b64=(bytes:ArrayBuffer|Uint8Array)=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
async function proof(secret:Uint8Array,role:string,nonce:string,instance:string){const key=await crypto.subtle.importKey('raw',secret as BufferSource,{name:'HMAC',hash:'SHA-256'},false,['sign']);return b64(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(JSON.stringify([1,role,nonce,location.origin,instance]))));}
export function createBridgeClient(event:(value:Event)=>void) {
  let current:any;
  function emit(value:Event){event(value);}
  function dispose(){if(current){current.cancelled=true;clearTimeout(current.retry);current.adapter?.dispose();current.socket?.close();current.credential=undefined;current=undefined;}emit({type:'connection',connected:false});}
  function request(type:string,fields:Record<string,unknown>={}){if(!current?.credential||current.socket.readyState!==WebSocket.OPEN)throw Error('Connect this model to Bridge first.');current.socket.send(JSON.stringify({type,id:crypto.randomUUID(),...fields,credential:current.credential}));}
  function attempt(a:any){
    if(current!==a||a.cancelled)return;
    if(Date.now()>=a.expires||a.tries++>=8){dispose();emit({type:'status',status:'disconnected',message:'Connection did not complete. Open Bridge from the Start menu, review browser permissions, then retry.'});return;}
    const socket=a.socket=new WebSocket('ws://127.0.0.1:46317/v1/connect',['vizualmodel.v1']);let phase='opening';
    const opening=setTimeout(()=>{if(phase==='opening')socket.close();},2500);
    socket.onopen=()=>{clearTimeout(opening);phase='proof';socket.send(JSON.stringify({type:'hello',protocol:1,instance:a.instance}));};
    socket.onmessage=async message=>{
      if(current!==a||a.cancelled)return;
      try{
        const value=JSON.parse(message.data);
        if(phase==='proof'&&value.type==='proof'){
          phase='verifying';
          if(value.protocol!==1||typeof value.nonce!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(value.nonce)||value.proof!==await proof(a.secret,'bridge',value.nonce,a.instance))throw Error('The local process did not match the Bridge launch. Connection stopped.');
          const response=await proof(a.secret,'browser',value.nonce,a.instance);if(current!==a||a.cancelled)return;
          phase='approving';socket.send(JSON.stringify({type:'prove',proof:response,label:modelDescriptor.label,descriptor:modelDescriptor,requestControl:a.control}));emit({type:'status',status:'waiting-for-approval',message:'Review the website and model permissions in Bridge.'});
        }else if(phase==='approving'&&value.type==='connected'){
          if(value.protocol!==1||value.runtime!=='Codex'||!/^[A-Za-z0-9_-]{43}$/.test(value.credential))throw Error('This Bridge build does not support the model conversation. Install the matching build.');
          phase='connected';a.credential=value.credential;a.secret=undefined;a.adapter=createBrowserActionAdapter(__MODEL_BUILD__,__MODEL_DATA__);a.target={sessionId:value.session,generation:1,read:true,operate:value.operate===true};
          emit({type:'connection',connected:true,operate:a.target.operate,runtime:'Codex'});emit({type:'status',status:'ready',message:'Connected. Your next message starts a Codex conversation for this model.'});
        }else if(phase==='connected'&&value.type==='tool_call'){
          try{
            const result=await a.adapter.execute({protocol:1,id:value.id,sessionId:a.target.sessionId,generation:1,deadline:value.deadline,action:value.tool,inputs:value.inputs} as ModelRequest,a.target);
            if(current===a&&!a.cancelled)socket.send(JSON.stringify({type:'tool_result',id:value.id,credential:a.credential,success:true,result}));
          }catch(error){if(current===a&&!a.cancelled)socket.send(JSON.stringify({type:'tool_result',id:value.id,credential:a.credential,success:false,error:(error as Error).message}));}
        }else if(phase==='connected')emit(value);
        else if(value.type==='error')throw Error(value.message??'Connection rejected. Retry with a new connection.');
      }catch(error){if(current===a&&!a.cancelled){dispose();emit({type:'status',status:'error',message:(error as Error).message});}}
    };
    socket.onerror=()=>{};
    socket.onclose=()=>{clearTimeout(opening);if(current!==a||a.cancelled)return;if(phase==='opening'){emit({type:'status',status:'connecting',message:'Waiting for Bridge. Browser launch and local-access prompts may need your approval.'});a.retry=setTimeout(()=>attempt(a),Math.min(500*2**a.tries,4000));}else{dispose();emit({type:'status',status:'disconnected',message:'Disconnected. Pending actions will not be replayed. Read fresh state after an uncertain change.'});}};
  }
  return{
    connect(control:boolean){dispose();if(!window.isSecureContext)throw Error('Open the hosted HTTPS model or a model served by Bridge.');const secret=crypto.getRandomValues(new Uint8Array(32));const a:any=current={instance:crypto.randomUUID(),secret,control,expires:Date.now()+60000,tries:0,cancelled:false};const url=new URL('vizualmodel://connect');url.search=new URLSearchParams({v:'1',instance:a.instance,challenge:b64(secret),expires:String(a.expires)}).toString();emit({type:'status',status:'connecting',message:'Opening Bridge. Confirm the application launch and any browser local-access request.'});location.href=url.href;a.retry=setTimeout(()=>attempt(a),800);},
    send(text:string){request('chat',{text});},cancel(){request('cancel');},newConversation(){request('new_conversation');},
    disconnect(){if(current?.credential)request('disconnect');dispose();emit({type:'status',status:'disconnected',message:'Disconnected by this model. Completed changes are preserved.'});},dispose,
  };
}
