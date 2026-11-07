import { z } from 'zod';
import type { ApplicationTool } from '../../src/contracts';
const validateResult = (v: unknown) => z.object({count:z.number().int()}).parse(v);
export const tools: ApplicationTool[] = [
 {name:'get_count',description:'Read the live counter',inputSchema:{},validateResult,annotations:{readOnlyHint:true,openWorldHint:false}},
 {name:'increment',description:'Add an integer to the live counter',inputSchema:{amount:z.number().int().min(-100).max(100)},validateResult,annotations:{destructiveHint:false,openWorldHint:false}}
];
