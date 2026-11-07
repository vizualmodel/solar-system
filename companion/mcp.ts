import { startMcp } from '@vizualmodel/companion/mcp';
import { tools } from './tools';
await startMcp({ name: 'solar-companion', tools, url: process.env.COMPANION_URL ?? process.env.SOLAR_COMPANION_URL, token: process.env.COMPANION_TOKEN ?? process.env.SOLAR_COMPANION_TOKEN });
