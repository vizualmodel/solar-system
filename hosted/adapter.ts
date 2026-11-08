import { validateSimulationState, MIN_TIME, MAX_TIME, type SimulationState } from '../src/lib/simulation-state';
import type { ClosestApproach } from '../src/lib/closest-approach';

export const HOSTED_PROTOCOL = 1;
export const HOSTED_ACTIONS = ['read_state', 'set_time', 'set_view_options', 'investigate_earth_mars'] as const;
export type HostedAction = typeof HOSTED_ACTIONS[number];
export type HostedRequest = {
  protocol: 1; id: string; sessionId: string; generation: number; deadline: number;
  action: HostedAction; inputs: Record<string, unknown>;
};
export interface AdapterPorts {
  read(): { state: SimulationState; revision: number };
  apply(method: 'set_simulation_time' | 'scene', params: Record<string, unknown>, request: { id: string; expiresAt: number }): Promise<void>;
  investigate(after: number, until: number, deadline: number): Promise<ClosestApproach | null>;
  modelBuild: string;
  dataVersion: string;
}
function object(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Expected an object.');
}
function fields(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some(k => !allowed.includes(k))) throw Error('Unsupported input field.');
}
function utc(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value) || !Number.isFinite(Date.parse(value))) throw Error('Use an ISO timestamp in UTC ending in Z.');
  const time = Date.parse(value);
  if (new Date(time).toISOString().slice(0, 19) !== value.slice(0, 19)) throw Error('Invalid UTC calendar date.');
  if (time < MIN_TIME || time > MAX_TIME) throw Error('Time outside the supported dataset interval.');
  return time;
}
function observation(ports: AdapterPorts) {
  const { state: value, revision } = ports.read(), s = validateSimulationState(value);
  return { revision, time: new Date(s.time).toISOString(), playing: s.playing, speedDaysPerSecond: s.speed,
    start: new Date(s.start).toISOString(), end: new Date(s.end).toISOString(), activeViewId: s.active,
    mission: s.mission ? { id: s.mission.id } : null,
    views: s.views.map(v => ({ id: v.id, focus: v.focus, labels: v.labels, orbits: v.orbits, visible: v.visible })),
  };
}

// Domain dispatch is independent of WSS/OAuth. The relay independently
// enforce owner, consent, scopes, version and generation before calling this boundary.
export function createHostedAdapter(ports: AdapterPorts) {
  const completed = new Map<string, { fingerprint: string; result: Promise<unknown> }>();
  let mutationInFlight = false;
  function execute(request: HostedRequest, target: { sessionId: string; generation: number; read: boolean; operate: boolean }) {
    object(request); fields(request, ['protocol', 'id', 'sessionId', 'generation', 'deadline', 'action', 'inputs']);
    if (request.protocol !== HOSTED_PROTOCOL || !HOSTED_ACTIONS.includes(request.action)) throw Error('Incompatible protocol or unsupported operation.');
    if (typeof request.id !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(request.id)) throw Error('Invalid request ID.');
    if (!Number.isInteger(request.generation) || request.generation < 1 || request.sessionId !== target.sessionId || request.generation !== target.generation) throw Error('Wrong session or stale generation.');
    if (!Number.isFinite(request.deadline) || request.deadline <= Date.now() || request.deadline > Date.now() + 60_000) throw Error('Expired or invalid deadline; no action applied.');
    if (!target.read || (['set_time', 'set_view_options'].includes(request.action) && !target.operate)) throw Error('Browser permission denied.');
    object(request.inputs);
    const fingerprint = JSON.stringify(request), previous = completed.get(request.id);
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw Error('Request ID reused with different content.');
      return previous.result;
    }
    const result = run(request, target);
    completed.set(request.id, { fingerprint, result });
    // A tab incarnation never restores this cache across a reload. The server must
    // never replay an uncertain mutation in a new incarnation.
    if (completed.size > 100) completed.delete(completed.keys().next().value!);
    return result;
  }
  async function run(request: HostedRequest, target: { read: boolean; operate: boolean }) {
    const p = request.inputs;
    let effectiveInputs: Record<string, unknown> = {}, output: unknown;
    const mutates = request.action === 'set_time' || request.action === 'set_view_options';
    if (mutates) {
      if (mutationInFlight) throw Error('Session busy; inspect fresh state before a new action.');
      mutationInFlight = true;
    }
    try {
      const before = ports.read(), s = validateSimulationState(before.state);
      if (request.action === 'read_state') { fields(p, []); output = observation(ports); }
      if (mutates) {
        if (p.expectedRevision !== undefined && (!Number.isSafeInteger(p.expectedRevision) || p.expectedRevision !== before.revision)) throw Error('State changed; read state before deliberately issuing a new action.');
        if (s.mission) throw Error('Stop the mission before using normal simulation controls.');
        if (Date.now() >= request.deadline || !target.operate) throw Error('Permission revoked or deadline expired.');
        if (request.action === 'set_time') {
          fields(p, ['time', 'expectedRevision']); utc(p.time);
          effectiveInputs = { time: p.time, stateRevisionBefore: before.revision, ...(p.expectedRevision === undefined ? {} : { expectedRevision: p.expectedRevision }) };
          await ports.apply('set_simulation_time', { time: p.time }, { id: request.id, expiresAt: request.deadline });
        } else {
          fields(p, ['viewId', 'labels', 'orbits', 'expectedRevision']);
          if (typeof p.viewId !== 'string' || !s.views.some(v => v.id === p.viewId)) throw Error('Choose an existing view ID.');
          const settings: Record<string, boolean> = {};
          for (const key of ['labels', 'orbits']) if (p[key] !== undefined) {
            if (typeof p[key] !== 'boolean') throw Error('View options must be booleans.'); settings[key] = p[key];
          }
          if (!Object.keys(settings).length) throw Error('Supply labels or orbits.');
          effectiveInputs = { viewId: p.viewId, ...settings, stateRevisionBefore: before.revision, ...(p.expectedRevision === undefined ? {} : { expectedRevision: p.expectedRevision }) };
          await ports.apply('scene', { viewId: p.viewId, settings }, { id: request.id, expiresAt: request.deadline });
        }
        output = observation(ports);
      }
      if (request.action === 'investigate_earth_mars') {
        fields(p, ['after', 'until']);
        if (s.mission) throw Error('Stop the mission before investigating the normal orbital model.');
        const after = utc(p.after), until = p.until === undefined ? s.end : utc(p.until);
        if (after < s.start || until > s.end || after >= until) throw Error('Choose an increasing interval within the current FROM/TO range.');
        effectiveInputs = { from: 'earth', to: 'mars', after: new Date(after).toISOString(), until: new Date(until).toISOString(), stateRevision: before.revision };
        const found = await ports.investigate(after, until, request.deadline);
        if (Date.now() >= request.deadline) throw Error('Investigation deadline expired; no state changed.');
        output = { found: !!found, time: found ? new Date(found.time).toISOString() : null, distance: found?.distanceAU ?? null, units: { distance: 'AU', time: 'UTC' },
          assumptions: 'Existing approximate Keplerian ephemeris. Next future local minimum, not the absolute minimum. Six-hour brackets, one-second time refinement. Agreement with direct invocation does not validate astronomical accuracy.',
          stateUnchanged: true, stateRevisionAtCompletion: ports.read().revision };
      }
      return { requestId: request.id, sessionId: request.sessionId, generation: request.generation, protocol: HOSTED_PROTOCOL,
        operation: request.action, modelBuild: ports.modelBuild, dataVersion: ports.dataVersion, effectiveInputs,
        timestamp: new Date().toISOString(), outcome: 'succeeded', result: output };
    } finally { if (mutates) mutationInFlight = false; }
  }
  return { describe: () => ({ protocol: HOSTED_PROTOCOL, actions: [...HOSTED_ACTIONS], modelBuild: ports.modelBuild, dataVersion: ports.dataVersion }), execute };
}
