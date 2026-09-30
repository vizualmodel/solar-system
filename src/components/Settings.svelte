<script lang="ts">
 import { X,Orbit,Eye,Camera,SlidersHorizontal } from 'lucide-svelte';
 import { scenario,updateView } from '../lib/store';
 import { bodies,byId } from '../lib/catalog';
 import { focus } from '../lib/focus';
 import { changeTracking } from '../lib/presentation';
 import type { Vec3 } from '../lib/ephemeris';
 let {onclose,positions}:{onclose:()=>void;positions:Record<string,Vec3>}=$props();
 const view=$derived($scenario.views.find(v=>v.id===$scenario.active)!);
 let tab=$state<'scene'|'camera'>('scene');
 const patch=(p:Parameters<typeof updateView>[1])=>updateView(view.id,p);
 function toggle(id:string){patch({visible:view.visible.includes(id)?view.visible.filter(x=>x!==id):[...view.visible,id]});}
</script>
<aside class="panel settings-panel">
 <div class="panel-heading"><div><span class="eyebrow">YOUR OBSERVATORY</span><h2>View settings</h2></div><button aria-label="Close settings" onclick={onclose}><X size={18}/></button></div>
 <div class="selected-view"><span class="live-dot"></span>VIEW {String($scenario.views.findIndex(v=>v.id===view.id)+1).padStart(2,'0')}<span>{byId[view.focus].name==='Sun'?'Solar system':byId[view.focus].name}</span></div>
 <div class="tabs"><button class:selected={tab==='scene'} onclick={()=>tab='scene'}><Eye size={14}/> Display</button><button class:selected={tab==='camera'} onclick={()=>tab='camera'}><Camera size={14}/> Camera</button></div>
 {#if tab==='scene'}
 <div class="panel-section"><h3><Orbit size={14}/> Scene layers</h3>{#each [['orbits','Orbital paths'],['labels','Body labels'],['stars','Star field'],['constellations','Constellation lines']] as [key,label]}<label class="switch-row"><span>{label}</span><input type="checkbox" checked={view[key as 'orbits'|'labels'|'stars'|'constellations']} onchange={e=>patch({[key]:e.currentTarget.checked})}/></label>{/each}<p class="hint">NASA sky maps · constellation lines can be shown with or without the stars.</p></div>
 <div class="panel-section"><h3><SlidersHorizontal size={14}/> Scale & visibility</h3><label class="range-label" for="body-size">Body magnification <strong>×{view.size}</strong></label><input id="body-size" type="range" min="1" max="200" step="1" value={view.size} oninput={e=>patch({size:+e.currentTarget.value})}/><div class="range-ends"><span>True size</span><span>Enhanced</span></div><label class="range-label" for="moon-distance">Moon orbit spread <strong>×{view.moonScale}</strong></label><input id="moon-distance" type="range" min="1" max="100" value={view.moonScale} oninput={e=>patch({moonScale:+e.currentTarget.value})}/><p class="hint">Display scales only. Physical positions and distance measurements stay unchanged.</p></div>
 <div class="panel-section"><div class="section-heading"><h3>Celestial bodies</h3><button class="text-button" onclick={()=>patch({visible:bodies.map(b=>b.id)})}>Show all</button></div>{#each bodies.filter(b=>!b.parent||b.parent==='sun') as body}<div class="body-row"><label><input type="checkbox" checked={view.visible.includes(body.id)} onchange={()=>toggle(body.id)}/><span class="planet-swatch" style:background={body.color}></span>{body.name}</label><button title={`Focus on ${body.name}`} onclick={()=>focus(view.id,body.id)} aria-label={`Focus on ${body.name}`}><Camera size={13}/></button></div>{#each bodies.filter(b=>b.parent===body.id&&b.parent!=='sun') as moon}<label class="moon-row"><input type="checkbox" checked={view.visible.includes(moon.id)} onchange={()=>toggle(moon.id)}/>{moon.name}</label>{/each}{/each}</div>
 {:else}
 <div class="panel-section"><h3>Point of interest</h3><select aria-label="Camera focus" value={view.focus} onchange={e=>focus(view.id,e.currentTarget.value)}>{#each bodies as b}<option value={b.id}>{b.name}</option>{/each}</select><div class="button-pair"><button onclick={()=>focus(view.id,view.focus,'system')}>System view</button><button onclick={()=>focus(view.id,view.focus,'portrait')}>Close-up</button></div><label class="switch-row"><span>Follow selected body</span><input type="checkbox" checked={view.follow} disabled={!positions[view.focus]} onchange={()=>patch(changeTracking(view,positions))}/></label><p class="hint">Tracking keeps your camera offset from the selected body as time moves. Fixed cameras use the Sun as their origin.</p></div>
 <div class="panel-section"><h3>Perspective</h3><div class="button-pair"><button onclick={()=>{const d=Math.hypot(...view.camera);patch({camera:[0,d,0.000001],target:[0,0,0]});}}>Top-down</button><button onclick={()=>{const d=Math.hypot(...view.camera);patch({camera:[0,d*0.55,d*0.85],target:[0,0,0]});}}>Inclined</button></div><dl class="control-guide"><dt>Orbit</dt><dd>Drag</dd><dt>Zoom</dt><dd>Scroll / pinch</dd><dt>Pan</dt><dd>Right drag</dd><dt>Focus</dt><dd>Click a body label</dd></dl></div>
 {/if}
 <div class="panel-footer">Settings apply to this view only.</div>
</aside>
