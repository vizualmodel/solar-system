import { z } from 'zod';
import { bodies, displayBodies } from '../src/lib/catalog';
import { parseSimulationTime } from './simulation-protocol';
const body = z.enum(bodies.map(b => b.id) as [string, ...string[]]);
const focus = z.enum(displayBodies.map(b => b.id) as [string, ...string[]]);
const satellite = z.enum(['iss','hubble']);
const time = z.string().refine(v => { try { parseSimulationTime(v); return true; } catch { return false; } }, 'Invalid timestamp. Use a supported ISO timestamp with timezone.');
// MCP/LLM schema adapters expect one homogeneous array-items schema, not tuples.
// Exact length preserves the existing three-coordinate validation.
const vec = z.array(z.number().finite()).length(3);
const detail = z.enum(['summary','full']).optional();
const viewId = z.string().max(100).optional().describe('Defaults to the active view.');
export const controlSchemas = {
 get_simulation_state: { detail },
 set_simulation_time: { time, detail },
 timeline: { settings: z.object({ time: time.optional(), playing: z.boolean().optional(), speed: z.number().min(-365).max(365).optional().describe('Simulation days per real second.'), start: time.optional(), end: time.optional(), stepSeconds: z.number().finite().optional(), jump: z.enum(['start','end']).optional(), resetRange: z.boolean().optional() }).strict(), detail },
 camera: { viewId, settings: z.object({ focus: focus.optional(), preset: z.enum(['system','portrait','top','inclined']).optional(), follow: z.boolean().optional(), camera: vec.optional().describe('Position in AU in the renderer Y-up frame; relative to focus when following.'), target: vec.optional(), mode: z.enum(['orbit','alignment','surface']).optional(), observer: z.object({ latitude:z.number().min(-90).max(90), longitude:z.number().min(-180).max(180), altitude:z.number().min(0).max(100000).describe('Metres above the surface.') }).strict().optional() }).strict(), detail },
 scene: { viewId, settings: z.object({ orbits:z.boolean().optional(), labels:z.boolean().optional(), stars:z.boolean().optional(), constellations:z.boolean().optional(), localLandscape:z.boolean().optional(), moonUmbra:z.boolean().optional(), moonPenumbra:z.boolean().optional(), size:z.number().min(1).max(200).optional(), moonScale:z.number().min(1).max(100).optional(), visible:z.array(body).optional() }).strict(), detail },
 satellites: { viewId, settings: z.object({ populationGroups:z.array(z.enum(['geo','leo','starlink','navigation','gps'])).optional(), populationSelection:z.number().int().positive().max(999999999).nullable().optional(), closeUp:z.literal('iss').optional().describe('True-size ISS tracking camera at real-time speed; pauses ready for Play.'), visible:z.array(satellite).optional(), magnification:z.object({ iss:z.number().min(1).max(100000).optional(), hubble:z.number().min(1).max(100000).optional() }).strict().optional(), explore:satellite.optional(), focus:satellite.optional() }).strict(), detail },
 views: { action:z.enum(['select','split','close','layout']), viewId, direction:z.enum(['row','column']).optional(), layout:z.unknown().optional().describe('Recursive {kind:"view",id} or {kind:"split",direction,children:[a,b]}; must include every view exactly once.'), detail },
 session: { action:z.enum(['rename','save','export','import','new','preset']), name:z.string().max(120).optional(), simulationState:z.unknown().optional().describe('Exported version 1 simulation state for import; validated before mutation.'), scenario:z.unknown().optional().describe('Deprecated alias for simulationState, for older clients.'), preset:z.enum(['overview','earth','inner','spain-eclipse']).optional(), detail },
 workspace: { settings:z.object({ settings:z.boolean().optional(), charts:z.boolean().optional(), companion:z.boolean().optional(), about:z.boolean().optional(), tab:z.enum(['scene','camera']).optional(), sections:z.object({landscape:z.boolean().optional(),satellites:z.boolean().optional(),eclipse:z.boolean().optional(),layers:z.boolean().optional(),scale:z.boolean().optional(),bodies:z.boolean().optional(),interest:z.boolean().optional(),perspective:z.boolean().optional()}).strict().optional() }).strict(), detail },
 charts: { settings:z.object({ from:body.optional(), to:body.optional(), open:z.boolean().optional(), nextClosestApproach:z.boolean().optional() }).strict(), detail }
};
export type ControlMethod = keyof typeof controlSchemas;
export function parseControl(method: string, params: unknown) {
 if (!Object.hasOwn(controlSchemas,method)) throw new Error('Unsupported simulation operation.');
 return z.object(controlSchemas[method as ControlMethod]).strict().parse(params);
}
