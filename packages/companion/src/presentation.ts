/** Keep one copy of a tool result, including nonduplicate diagnostic content. */
export function toolResult(result: any): any {
  if (!result || result.structuredContent === undefined) return result;
  const content = (result.content ?? []).filter((part: any) => {
    if (part.type !== 'text') return true;
    try { return JSON.stringify(JSON.parse(part.text)) !== JSON.stringify(result.structuredContent); } catch { return true; }
  });
  return { ...result, content };
}
export function panelItem(item: any) {
  if (item.type === 'mcpToolCall') return { ...item, result: toolResult(item.result) };
  if (item.type === 'commandExecution' && item.aggregatedOutput?.length > 16000) return { ...item, aggregatedOutput: item.aggregatedOutput.slice(-16000), outputTruncated: true };
  return item;
}
export function narrative(item: any): string {
  if (item.type === 'userMessage') return (item.content ?? []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n');
  if (item.type === 'agentMessage' || item.type === 'plan') return item.text ?? '';
  return '';
}
function resultValue(item: any) {
  if (item.result?.structuredContent) return item.result.structuredContent;
  try { return JSON.parse(item.result?.content?.find((p: any) => p.type === 'text')?.text ?? 'null'); } catch { return null; }
}
export function itemFailed(item: any): boolean {
  return ['failed', 'declined'].includes(item.status) || !!item.error || item.result?.isError === true || (item.type === 'commandExecution' && typeof item.exitCode === 'number' && item.exitCode !== 0);
}
export function activitySummary(item: any): string {
  const failed = itemFailed(item);
  const outcome = failed ? 'Failed' : item.status === 'inProgress' ? 'Working' : item.status === 'completed' ? 'Done' : item.status ?? '';
  if (item.type === 'mcpToolCall') {
    const value = resultValue(item);
    const labels: Record<string, string> = { build_candidate: 'Validate and build', activate_candidate: 'Activate application', rollback_build: 'Restore previous build', verify_recovery: 'Test recovery' };
    const label = labels[item.tool] ?? item.tool;
    if (failed) return `${label} · Failed`;
    if (value?.activated) return `${label} · ${value.restored ? 'State restored' : 'Restoration unconfirmed'}`;
    if (value?.candidate) return `${label} · Checks, tests and build passed`;
    if (value?.recovered) return `${label} · Previous build restored`;
    return `${label} · ${outcome}`;
  }
  if (item.type === 'commandExecution') {
    const actions = item.commandActions ?? [];
    let label = 'Run project command';
    if (/npm(?:\.cmd)? run (?:build|check)|vite(?:\.js)?['\"]? build/.test(item.command ?? '')) label = 'Validate project';
    else if (/--test|npm(?:\.cmd)? (?:run )?test/.test(item.command ?? '')) label = 'Run tests';
    else if (actions.some((a: any) => a.type === 'read' || a.type === 'search') || /Get-Content|\brg\b/.test(item.command ?? '')) label = 'Inspect project files';
    return `${label} · ${outcome}${failed && item.exitCode != null ? ` (exit ${item.exitCode})` : ''}`;
  }
  if (item.type === 'fileChange') return `Edit ${(item.changes ?? []).length} file(s) · ${outcome}`;
  if (item.type === 'functionCallOutput') return `Tool result · ${item.name ?? 'development tool'}`;
  return '';
}
export function activityDetails(item: any): string {
  if (item.type === 'commandExecution') return `${item.command ?? ''}\n\n${item.outputTruncated ? '[Showing the last 16,000 characters; full output remains in Codex history.]\n' : ''}${item.aggregatedOutput ?? ''}`;
  if (item.type === 'mcpToolCall') {
    const result = toolResult(item.result);
    return JSON.stringify({ arguments: item.arguments, result: result?.structuredContent ?? result, ...(result?.structuredContent && result.content?.length ? { extraContent: result.content } : {}), ...(item.error ? { error: item.error } : {}) }, null, 2);
  }
  return JSON.stringify(item.changes ?? item.output ?? item, null, 2);
}
