// Compatibility imports for older integrations. Scenario now means a reusable prompt.
export * from './simulation-state';
export { defaultSimulationState as defaultScenario, validateSimulationState as validateScenario } from './simulation-state';
export type { SimulationState as Scenario } from './simulation-state';
