# CROSS_REPO_ACK — WorkCore Phantom Canvas Pane

- repo: `widgetdc-canvas`
- directive id/version: `workcore-phantom-pane` / `v1`
- upstream concept: Universal Work Core / Phantom ontology cockpit
- disposition: `implemented`

## Impacted Surfaces

- `src/AppShell.tsx`
- `src/types/session.ts`
- `src/state/canvasSession.ts`
- `src/panes/WorkCorePhantomPane.tsx`
- `src/state/canvasSession.panes.test.ts`
- `src/panes/WorkCorePhantomPane.test.tsx`

## Contract Ack

- `phantom_bom` is preserved as the legacy Phantom BOM inventory pane.
- `workcore_phantom` is the new dedicated pane for Universal Work Core visualization.
- Pane registration is centralized through exported `PANE_IDS`.
- The WorkCore cockpit is projection-first and does not claim frontend state is graph truth.
- Command input is represented as proposal/read-back flow rather than direct canonical mutation.

## Local Gate State

- component/registry tests: passed
- full Vitest suite: passed (`18` files, `133` tests)
- production build: passed
- production dependency audit: passed with `0 vulnerabilities` after lockfile hardening

## Runtime Read-Back

- production deployment: `fcd3b23f-1763-4f54-994d-596bff7c07f8`
- public surface: `https://widgetdc-canvas-production.up.railway.app/?pane=workcore_phantom`
- bundle evidence: live JS contains `WorkCore Phantom`, `workcore_phantom`, and `Scalable ontology cockpit`

## Follow-Up

- Replace mock read-back with backend WorkCore snapshot hydration when the native WorkCore endpoint is ready.
- Fix Railway build metadata so `/health.runtime_fingerprint.git_commit_sha` reflects manual `railway up` deployments instead of stale env metadata.
