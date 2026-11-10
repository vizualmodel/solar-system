# Bridge history panel — private review candidate

The `bridge/history-delegation-2026-11-10` follow-up adds Conversations to the existing Agent panel: recent activity, title/transcript search, archive read, explicit native resume, rename, Markdown/JSON export and separately confirmed Bridge archive deletion. This changes no numerical calculation or model state contract. The original hosted build is not changed by building this checkout.

With Bridge 0.3.0-review.1, connecting starts no runtime. Reading an archive is separate from Resume. The panel shows changed-build context, interrupted messages and another tab's active writer. Failed native continuation preserves the transcript and offers an explicitly new conversation with user-selected prior text. Current permissions and fresh tools govern resumed operations; model state is never restored by reopening a conversation.

The prior 0.2.3 panel protocol remains supported. Against a legacy Bridge, this panel keeps its earlier start-new-on-connect behavior. History requires the new Bridge and fresh optional history consent for the exact origin/model identity. Native history deletion and the all-model archive list live in trusted Bridge UI.

Validation: Svelte check reports zero errors/warnings; 184 tests pass, including new real-socket fixture cases for history-only connection, denied history and explicit resume. These fixtures simulate the browser/model and do not establish graphical acceptance. The actual installed Codex/core-storage restart and Stop evidence is in the Bridge repository. Browser automation reports `The browser access host is unavailable`; Windows app inspection timed out awaiting app access. No new owner-observed acceptance has been recorded.

Delegated editing is not exposed by this candidate. The Windows coding sandbox refused the positive inside-workspace canary because split filesystem read restrictions cannot be enforced. Stage B and the final Stage C journey remain blocked pending separate runtime/sandbox validation. No unrestricted fallback was added.

Build locally for private review only. Git deployment remains disabled. No merge, hosted deployment, public installer or binary commit is authorized. The closed [0.2.3 acceptance record](https://github.com/vizualmodel/bridge/blob/bridge/connection-proof/docs/acceptance-0.2.3.md), including the owner's skipped manual Stop, remains unchanged.
