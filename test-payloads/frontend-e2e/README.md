# Canvas Frontend E2E Flow Pack

Version: 2026-03-14
Status: Active browser-flow contract for `LF-FE-003`

## Purpose

Provide the repo-owned browser E2E flow definition for Canvas production verification.

## Canonical Flow

- file: `test-payloads/frontend-e2e/canvas-production-smoke.json`
- target: `CANVAS_BASE_URL`
- runner owner: `widgetdc-openclaw/scripts/frontend-e2e-runner.mjs`

## Required Environment

- `CANVAS_BASE_URL`

## Execution Example

```bash
node scripts/frontend-e2e-runner.mjs \
  --flowFile C:/Users/claus/Projetcs/widgetdc-canvas/test-payloads/frontend-e2e/canvas-production-smoke.json
```

## Contract

The flow must prove at least:

- Canvas Railway surface loads
- main canvas is visible
- expected bootstrap UI is visible
- default node value is present
- a new node can be created by double-click interaction
- no fatal runtime banner is shown

`CANVAS_BASE_URL` is environment-owned because the canonical public Railway URL is not declared directly in this repo.
