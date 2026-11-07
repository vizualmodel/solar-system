import type { ZodRawShape } from 'zod';
export interface StatePolicy { snapshot(value: unknown): any; assertRestored(before: any, after: unknown): void }
export interface ApplicationTool {
 name: string; description: string; inputSchema: ZodRawShape;
 annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; openWorldHint?: boolean };
 validateResult(value: unknown): any;
 summarize?(value: any): string;
}
export interface RuntimeOptions { mcpName: string; mcpEntry: string; instructions: string; name?: string; workspace?: boolean }
export interface ScenarioSummary { id: string; title: string; revision: string }
export interface ScenarioDefinition extends ScenarioSummary { prompt: string }
export interface ScenarioRepository {
 list(): Promise<ScenarioSummary[]>;
 get(id: string): Promise<ScenarioDefinition>;
 save(value: { id?: string; title: string; prompt: string; expectedRevision?: string }): Promise<ScenarioDefinition>;
}
export interface CompanionConfig {
 application: { id: string; name: string }; root: string;
 port?: number; openBrowser?: boolean; agent?: boolean;
 runtime?: RuntimeOptions; // Deprecated application-owned runtime; omit for workspace integration.
 instructions?: string;
 contextTool?: string;
 tools: ApplicationTool[]; state: StatePolicy;
 validation: { name: string; args: string[] }[];
 build: { args: string[] }; // Node argv; {outDir} is the immutable candidate directory.
 sourceRoots?: string[]; // Linked source dependencies included in candidate digest.
 storageDirectory?: string;
 transport?: { bootstrapGlobal?: string; protocol?: string };
 scenarios?: ScenarioRepository; // Application-owned prompt files and persistence.
}
export interface BrowserAdapter {
 ready(): Promise<void>;
 capture(): unknown;
 preserve?(state: unknown): void;
 loadSaved(state: unknown): void | Promise<void>;
 captureForActivation(): unknown | Promise<unknown>;
 restore(state: unknown): unknown | Promise<unknown>;
 execute(method: string, params: any, request: { id: string; expiresAt: number }): unknown | Promise<unknown>;
}
export interface BrowserOptions { bootstrapGlobal?: string; protocol?: string; storagePrefix?: string }
