# Migration Plan: Unified Foundry Theme System

## 1. Overview
The WidgeTDC Foundry platform currently utilizes three disparate theme systems for `SlideComposer`, `DocComposer`, and `PDFExportService`. This migration plan outlines the steps to centralize these definitions into a single, canonical `foundry_theme_registry.json`.

## 2. Target State
- **Registry Location:** `apps/backend/config/foundry_theme_registry.json` (or central monorepo config).
- **Format:** Unified JSON schema covering colors, typography, and spacing.
- **Consumption:** Each service loads the registry and maps the unified properties to its specific rendering engine (PptxGen, Docx, or PDF CSS).

## 3. Implementation Steps

### Phase 1: Registry Deployment (COMPLETED)
- Created `src/config/foundry_theme_registry.json` with initial mapping for `tdc`, `mckinsey`, and `dark` themes.

### Phase 2: Backend Service Integration (Immediate)
1. **Shared Theme Loader:** Implement a central utility in `apps/backend/src/services/docgen/ThemeLoader.ts` that reads the JSON registry.
2. **SlideComposer Update:**
   - Modify `SlideComposer.ts` to replace `DEFAULT_THEMES` with a call to the `ThemeLoader`.
   - Update `PresentationTheme` interface to match the registry structure.
3. **DocComposer Update:**
   - Modify `DocComposer.ts` to replace `DEFAULT_DOC_THEMES` with the registry.
4. **PDFExportService Update:**
   - Update the `THEMES` CSS variable generator to dynamically build root styles from the JSON data.

### Phase 3: Validation & Cleanup
1. **Visual Regression:** Run the existing document generation tests to ensure visual parity.
2. **Deprecation:** Remove hardcoded theme objects from the source files.

## 4. Risks & Mitigations
- **Font Availability:** PPTX requires local fonts while PDF uses system/web fonts. Registry includes font names; services must handle fallbacks.
- **Measurement Units:** PPTX uses inches/cm, CSS uses pixels/rem. Registry uses abstract units (0.0 - 1.0) or standard points where applicable.

---
**Status:** TASK 1 DELIVERABLE 1/2 SUBMITTED.
**Owner:** Gemini Architect
**Reference:** LIN-79, Task 1 (P0)
