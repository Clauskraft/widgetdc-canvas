# ADOPTION_RECORD — WorkCore Phantom Canvas Pane

- repo: `widgetdc-canvas`
- directive: `workcore-phantom-pane`
- version: `v1`
- adoption date: `2026-04-23`
- status: `implemented_and_verified`
- implementation PR: `#43`
- merge commit: `b2ebb53457e6943da20c1fd90e72ed953f28496c`
- production deployment: `fcd3b23f-1763-4f54-994d-596bff7c07f8`

## ADOPTION_RECORD

The WorkCore Phantom cockpit is adopted as a dedicated pane, `workcore_phantom`, rather than overloading the legacy `phantom_bom` pane.

Reason:

- `phantom_bom` remains the inventory/topology view for legacy Phantom BOM components.
- `workcore_phantom` is the visual projection surface for the Universal Work Core lifecycle.
- The pane uses lane-based ontology stages instead of absolute positioned graph cards, so the model can scale across many nodes and domains.
- The UI remains projection-only: user input compiles to proposals and graph state changes only after a read-back hydration path.

## QUESTION_REPORT

- Question: Should the WorkCore/Phantom model live in `phantom_bom`?
- Answer: No. That overloads a legacy BOM inventory concept with a new universal ontology cockpit.

- Question: Should the pane be a freeform graph canvas?
- Answer: Not as the primary view. A freeform graph is useful for local exploration, but the default operational cockpit must be lane-structured so users can reason over lifecycle state at scale.

- Question: Should frontend commands directly mutate canonical graph state?
- Answer: No. The frontend may hold projection state and command proposals; canonical truth must come from backend/read-back hydration.

## TRIANGULATION_REPORT

- Governance: `GLOBAL_AGENT_GOVERNANCE.md` requires runtime/read-back verification and rejects UI-only governance claims.
- Execution policy: `GLOBAL_AGENT_EXECUTION_POLICY.md` routes validation through delivery verification and requires traceable exceptions where canonical tooling is unavailable.
- Canvas implementation: `src/state/canvasSession.ts` now exports `PANE_IDS`, making pane registration a code-level source of truth instead of duplicated local arrays.
- Runtime evidence: production bundle read-back confirmed `WorkCore Phantom`, `workcore_phantom`, and `Scalable ontology cockpit` are present in the deployed JavaScript bundle.

## EXISTENCE_REPORT

- `src/types/session.ts` includes `workcore_phantom` in `PaneId`.
- `src/state/canvasSession.ts` includes `workcore_phantom` in exported `PANE_IDS`.
- `src/AppShell.tsx` validates URL panes through `PANE_IDS`, renders `PhantomBOMPane` for `phantom_bom`, and renders `WorkCorePhantomPane` for `workcore_phantom`.
- `src/panes/WorkCorePhantomPane.tsx` implements the lane-based cockpit.
- `src/state/canvasSession.panes.test.ts` locks the pane registry behavior.
- `src/panes/WorkCorePhantomPane.test.tsx` verifies the lane cockpit and proposal/read-back interaction model.

## IMPLEMENTATION_DIRECTIVE

The correct implementation shape is:

- Keep `phantom_bom` as the legacy Phantom BOM component inventory pane.
- Add `workcore_phantom` as the dedicated Universal Work Core visual cockpit.
- Use lane columns for `Phantom`, `WorkSpec`, `FoldedEvidenceBundle`, `WorkItem`, `WorkRun`, `WorkArtifact`, and `ReadBackClosure`.
- Treat command input as an intent compiler that produces proposals before graph hydration.
- Avoid treating frontend state as the canonical database.
- Keep pane registration centralized through `PANE_IDS`.

## Verification

- `npx vitest run src/state/canvasSession.panes.test.ts` passed before deploy of PR `#43`.
- `npm run build` passed before deploy of PR `#43`.
- `npx vitest run src/panes/WorkCorePhantomPane.test.tsx src/state/canvasSession.panes.test.ts` passed during adoption hardening.
- `npx vitest run` passed after hardening: `18` test files, `133` tests.
- `npm run build` passed after dependency hardening with Vite `6.4.2`.
- `npm audit --omit=dev --audit-level=high` initially caught vulnerable transitive dependencies; `npm audit fix` updated the lockfile and the follow-up audit found `0 vulnerabilities`.
- Production Railway deployment `fcd3b23f-1763-4f54-994d-596bff7c07f8` reported `SUCCESS`.
- Production bundle read-back confirmed the new pane strings are live.

## Exceptions And Follow-Up

- The configured multi-provider Octopus `flow-deliver` script is not available in this Codex runtime; validation was executed with local repo tests, production build, dependency audit, and live bundle read-back.
- Full Vitest initially collected `.claude/worktrees` and Playwright specs. `vitest.config.ts` now excludes those non-unit-test surfaces so the suite reports the actual repo test set.
- Legacy `AppShell.test.tsx` assumed pre-UC5 controls. The test now explicitly opts into `?legacy=1` and asserts the current legacy shell behavior.
- `/health` still reports a stale `git_commit_sha` sourced from Railway environment metadata. Deployment identity and live bundle content were used as runtime truth for this adoption pass.
