/** Routine questions do not need the complete camera/simulationState payload. */
export function observation(value: any, detail: 'summary' | 'full' = 'summary'): { time: any; playing: any; viewCount: any; workspace: any; build: any; state?: any; reload?: any } {
  const result = {
    time: value.time, playing: value.playing,
    viewCount: value.viewCount ?? value.state?.simulationState?.views?.length,
    workspace: value.workspace, build: value.build,
  };
  return detail === 'full' ? { ...result, ...(value.state ? { state: value.state } : {}), ...(value.reload ? { reload: value.reload } : {}) } : result;
}
export function toolSummary(method: string, value: any): string {
  if (value.time) return `${value.time}; ${value.playing ? 'playing' : 'paused'}. Build ${value.build?.id ?? 'unknown'}.`;
  if (value.candidate) return `Checks, tests and candidate build passed. Candidate: ${value.candidate.id}. Not activated.`;
  if (value.activated) return `Activated ${value.activated}; state restoration ${value.restored ? 'verified' : 'unconfirmed'}. Previous: ${value.previous}.`;
  if (value.recovered) return 'Recovery verified: previous application and captured state restored.';
  return `${method} completed.`;
}
