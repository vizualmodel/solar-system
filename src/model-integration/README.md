# Model action integration

Transport-independent operations reuse the existing simulation state validation,
browser command dispatcher and closest-approach calculation. The browser adapter
uses a worker for the existing Earth–Mars search and disposes it on disconnect.

This module grants no access and opens no connection. Its caller must authenticate
and bind a live session, then pass current read/control permissions. Request IDs,
generation checks, deadlines, revision checks and bounded duplicate handling remain
at this boundary. Never replay an uncertain mutation after reconnecting.

The regression tests in tests/model-adapter.test.ts compare identical calculation
inputs; they do not independently validate ephemeris accuracy. Scientific data,
manual controls, saved states and the developer companion are unchanged.

The former hosted transport was removed on 10 November 2026. Recovery baseline:
e48ebcd75ebd0f368c8ce642896b9c140544ebc6. Git history holds its implementation.
