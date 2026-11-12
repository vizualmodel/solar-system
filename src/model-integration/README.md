# Model action integration

Transport-independent operations reuse the existing simulation state validation,
browser command dispatcher and closest-approach calculation. The browser adapter
uses a worker for the existing Earth–Mars search and disposes it on disconnect.

The Agent panel now opens a user-initiated Bridge connection, proves Bridge's
identity and submits this model's descriptor for trusted consent. It binds a live
session with current read/control permissions. Request IDs,
generation checks, deadlines, revision checks and bounded duplicate handling remain
at this boundary. Never replay an uncertain mutation after reconnecting.

The regression tests in tests/model-adapter.test.ts compare identical calculation
inputs; they do not independently validate ephemeris accuracy. Scientific data,
manual controls, saved states and the developer companion are unchanged.

The build emits `vizualmodel-package.json`. Bridge's Open model folder action
serves that built folder on its own loopback origin. This review build is not
deployed. Runtime fixtures are documented in the Bridge repository; actual Solar
panel acceptance is recorded separately and is not inferred from those fixtures.

The former hosted transport was removed on 10 November 2026. Recovery baseline:
e48ebcd75ebd0f368c8ce642896b9c140544ebc6. Git history holds its implementation.
