// Renderer lifecycle acknowledgement, shared with the companion client.
export const renderedViews = new Set<string>();
export const failedViews = new Set<string>();
/** Background tabs throttle renderer readiness; fail before capture or build selection. */
export function requireVisibleForActivation(visibility: string) {
  if (visibility !== 'visible') throw new Error('Keep Solar Observatory visible during build activation. No build was changed; bring its tab to the foreground, read fresh state, then retry explicitly.');
}
