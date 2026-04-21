# CROSS_REPO_ACK — Operator-Anchored Neurogenesis

- repo: `widgetdc-canvas`
- directive id/version: `2026-04-21-operator-anchored-neurogenesis` / `v1`
- impacted surfaces:
  - `src/components/PheromonePanel.tsx`
  - `src/AppShell.tsx` operator-facing placement surface
  - `src/lib/api.ts` backend pheromone route bindings
- disposition: `implemented`
- local gate state:
  - `build`: passed (`npm run build`)
  - `test`: passed (`npx vitest run src/lib/api.test.ts src/components/PheromonePanel.test.tsx`)
  - `typecheck`: passed via `tsc -b` in `npm run build`
- read-back evidence:
  - companion PR branch: `codex/unified-adoption-propagation`
  - consolidated production read-back will be recorded in WidgeTDC adoption closeout
