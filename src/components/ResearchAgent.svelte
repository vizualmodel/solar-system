<script lang="ts">
 import {onMount} from 'svelte';
 let {onclose,width=$bindable(420),request=null,onresult=()=>{}}:{onclose:()=>void;width?:number;request?:{id:string;text:string}|null;onresult?:(error?:string)=>void}=$props();
 let frame:HTMLIFrameElement,ready=$state(false),sent='';
 const workspace=import.meta.env.VITE_VMBLU_WORKSPACE_URL||'http://127.0.0.1:5190/workspace/';
 const url=new URL(workspace);
 url.searchParams.set('agent','1');url.searchParams.set('vizmo','vizualmodel/solar-system');
 onMount(()=>{const receive=(event:MessageEvent)=>{if(event.source!==frame?.contentWindow||event.origin!==url.origin)return;if(event.data?.type==='vmblu:agent-ready')ready=true;if(event.data?.type==='vmblu:scenario-result'&&event.data.id===request?.id)onresult(event.data.error);};window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);});
 $effect(()=>{if(ready&&request&&sent!==request.id){sent=request.id;frame.contentWindow?.postMessage({type:'solar:scenario-setup',...request},url.origin);}});
 function resize(event:PointerEvent){const start=event.clientX,original=width;const move=(e:PointerEvent)=>width=Math.max(340,Math.min(720,original+start-e.clientX));const stop=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',stop);};window.addEventListener('pointermove',move);window.addEventListener('pointerup',stop,{once:true});}
</script>
<aside class="research-agent" style:width={`${width}px`} aria-label="Solar research companion"><button class="resize-agent" aria-label="Resize research companion" onpointerdown={resize} onkeydown={e=>{if(e.key==='ArrowLeft')width=Math.min(720,width+20);if(e.key==='ArrowRight')width=Math.max(340,width-20);}}></button><button class="close-agent" onclick={onclose} aria-label="Close research companion">×</button><iframe bind:this={frame} title="Research companion" src={url.href}></iframe></aside>
<style>
 .research-agent{position:fixed;right:0;top:0;bottom:0;width:420px;border-left:1px solid #344454;background:#111c27;z-index:60}.research-agent iframe{width:100%;height:100%;border:0}.close-agent{position:absolute;right:12px;top:20px;z-index:2;background:#111c27;color:#e6edf3;border:0;border-radius:5px;font-size:23px;padding:4px 8px;cursor:pointer}@media(max-width:900px){.research-agent{width:min(420px,100vw)}}
.research-agent{max-width:100vw}.resize-agent{position:absolute;left:-4px;top:0;bottom:0;width:8px;border:0;padding:0;background:transparent;cursor:ew-resize;touch-action:none;z-index:2}.resize-agent:hover{background:#e8c65a55}
</style>
