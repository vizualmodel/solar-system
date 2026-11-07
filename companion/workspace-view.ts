// Read-only identity handshake. Setup remains an ordinary, approved agent turn.
export function validViewProbe(event: Pick<MessageEvent, 'source'|'data'|'origin'>, parent: Window, origin: string) {
 return event.source===parent && event.origin===origin && event.data?.type==='vmblu-view-probe'
  && typeof event.data.nonce==='string' && event.data.nonce.length<=100;
}
export function installWorkspaceViewProbe() {
 const receive=async(event:MessageEvent)=>{
  const host=window.parent!==window ? window.parent : window.opener;
  if(!host || event.source!==host || event.data?.type!=='vmblu-view-probe')return;
  try {
   const response=await fetch('/companion/bootstrap',{cache:'no-store',signal:AbortSignal.timeout(3000)});
   if(!response.ok)return;
   const bootstrap=await response.json();
   if(!bootstrap.workspaceAgent?.url)return;
   const origin=new URL(bootstrap.workspaceAgent.url).origin;
   if(!validViewProbe(event,host,origin))return;
   const instanceId=sessionStorage.getItem('solar-companion.owner');
   if(instanceId)host.postMessage({type:'vmblu-view-identity',nonce:event.data.nonce,instanceId},origin);
  } catch { /* Offline viewing remains available. */ }
 };
 window.addEventListener('message',receive);
 return()=>window.removeEventListener('message',receive);
}
