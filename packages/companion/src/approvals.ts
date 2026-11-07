const line = (value: unknown) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
export function approvalSummary(request: any): string {
 const p = request.params ?? {};
 if (p.networkApprovalContext) return `Allow network access to ${line(p.networkApprovalContext.host)}?`;
 if (request.method === 'item/commandExecution/requestApproval') return line(p.reason) || `Allow command: ${line(p.command) || 'command execution'}?`;
 if (request.method === 'item/fileChange/requestApproval') return line(p.reason) || `Allow file changes${p.grantRoot ? ' in ' + line(p.grantRoot) : ''}?`;
 if (request.method === 'item/tool/requestUserInput') return 'Codex needs your input.';
 return line(p.message) || line(p.reason) || 'Codex requests additional permissions.';
}
export function sessionApprovalAvailable(request: any): boolean {
 if (!['item/commandExecution/requestApproval','item/fileChange/requestApproval'].includes(request.method)) return false;
 const decisions = request.params?.availableDecisions;
 return !Array.isArray(decisions) || decisions.includes('acceptForSession');
}

// Empty MCP forms are confirmations. Forms with fields or other validation
// constraints need a field renderer and must not be accepted with empty content.
export function confirmationElicitationAvailable(request: any): boolean {
 const p = request.params;
 if (request.method !== 'mcpServer/elicitation/request' || p?.mode !== 'form') return false;
 const schema = p.requestedSchema;
 if (!schema || schema.type !== 'object' || !schema.properties || Array.isArray(schema.properties) || typeof schema.properties !== 'object') return false;
 if (Object.keys(schema.properties).length || (schema.required !== undefined && (!Array.isArray(schema.required) || schema.required.length))) return false;
 return Object.keys(schema).every(key => ['type', 'properties', 'required', 'additionalProperties', 'title', 'description', '$schema'].includes(key))
   && (schema.additionalProperties === undefined || typeof schema.additionalProperties === 'boolean');
}

export function elicitationResponse(request: any, answer: unknown) {
 if (!['accept', 'decline', 'cancel'].includes(answer as string)) throw new Error('Invalid form decision.');
 if (answer === 'accept' && !confirmationElicitationAvailable(request)) throw new Error('This form requires input that this companion does not support.');
 const meta = answer === 'accept' && request.params?._meta?.persist === 'always' ? { persist: 'always' } : null;
 return { action: answer, content: answer === 'accept' ? {} : null, _meta: meta };
}
