/** Session messages are complete runtime snapshots, not partial updates. */
export function mergePanelSession(previous: Record<string, any>, incoming: Record<string, any>) {
  return {
    ...previous,
    ...incoming,
    // Older companion processes omit undefined IDs when serializing JSON.
    // An absent turn ID therefore clears the prior turn, rather than retaining it.
    turnId: incoming.turnId ?? null,
    threadId: incoming.threadId ?? null,
    connected: true,
    needsSync: false,
  };
}

/** WebSocket messages are ordered. A missed revision requires a fresh snapshot, never a replayed turn. */
export function applyPanelMessage(previous: Record<string, any>, message: Record<string, any>) {
  if (message.type === 'session') return mergePanelSession(previous, message);
  if (!['session-update', 'session-item', 'session-delta'].includes(message.type)) return previous;
  if (previous.needsSync) return previous;
  if (message.revision <= previous.revision) return previous;
  if (message.revision !== previous.revision + 1) return { ...previous, needsSync: true };
  const next = { ...previous, revision: message.revision };
  if (message.type === 'session-update') return { ...next, ...message.state };
  const items = [...(previous.items ?? [])];
  const id = message.type === 'session-item' ? message.item.id : message.id;
  let index = items.findIndex(item => item.id === id);
  if (message.type === 'session-item') {
    if (index < 0) items.push(message.item); else items[index] = message.item;
  } else {
    if (!['text', 'aggregatedOutput'].includes(message.field)) return { ...previous, needsSync: true };
    if (index < 0) { index = items.length; items.push({ id, type: message.itemType }); }
    const content = (items[index][message.field] ?? '') + message.delta;
    items[index] = { ...items[index], [message.field]: message.field === 'aggregatedOutput' ? content.slice(-16000) : content,
      ...(message.field === 'aggregatedOutput' && content.length > 16000 ? { outputTruncated: true } : {}) };
  }
  return { ...next, items };
}
