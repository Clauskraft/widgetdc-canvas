# Option C Architecture Spec: RLM-to-Backend Contract

## 1. Concept: Synthesis/Render Split
This specification defines the "Option C" contract for the WidgeTDC Foundry. The RLM (Reasoning Engine) is responsible for **Synthesizing** the structural intent, while the Backend is responsible for **Rendering** the final file bytes (PPTX, DOCX, PDF).

## 2. API Endpoint: `/api/foundry/render`
**Method:** `POST`
**Auth:** `Bearer <WIDGETDC_API_KEY>`

### A. Request Schema (Input from RLM)
The RLM sends a JSON object conforming to the `foundry_option_c_contract.json` schema.

```json
{
  "job_id": "uuid-v4",
  "target_format": "pptx | docx | pdf",
  "theme_id": "tdc | mckinsey | dark",
  "metadata": {
    "title": "Market Strategy 2026",
    "author": "Oracle Agent",
    "client": "Project Alpha"
  },
  "sections": [
    {
      "type": "title",
      "content": {
        "title": "Market Strategy 2026",
        "subtitle": "Prepared by WidgeTDC Oracle"
      },
      "quality_gate": { "confidence": 0.99, "source_count": 12 }
    },
    {
      "type": "executive_summary",
      "content": {
        "body": "The Nordic consulting market is undergoing a fundamental shift towards..."
      },
      "quality_gate": { "confidence": 0.92, "source_count": 45 }
    },
    {
      "type": "risk_matrix",
      "content": {
        "data": [
          { "label": "Geopolitical", "value": "High" },
          { "label": "Technical Debt", "value": "Medium" }
        ]
      },
      "visual_intent": { "layout": "grid", "emphasis": "high" },
      "quality_gate": { "confidence": 0.85, "source_count": 8 }
    }
  ]
}
```

### B. Response Schema (Output from Backend)
The Backend returns the binary artifact or a retrieval link, plus a manifest.

```json
{
  "status": "success | error",
  "artifact": {
    "file_name": "Strategy_2026.pptx",
    "content_type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "size": 1024000,
    "download_url": "https://.../retrieve/uuid"
  },
  "manifest": {
    "prompt_hash": "sha256",
    "render_time_ms": 450,
    "version": "1.2.0",
    "quality_gate": {
      "score": 0.98,
      "checks": [
        { "id": "theme_adherence", "passed": true },
        { "id": "broken_links", "passed": true }
      ]
    }
  }
}
```

## 3. Mandatory Components

### A. The Shared Registry
Both RLM and Backend must reference the `foundry_theme_registry.json`.
- **RLM:** Uses `theme_id` to determine content length constraints (e.g., McKinsey slides have less space for text than Dark slides).
- **Backend:** Uses `theme_id` to look up hex codes and fonts during rendering.

### B. The Quality Gate
The `quality_gate` per section is the "W1 fix" mandated by Claude.
- **Synthesizer:** Must calculate confidence based on RAG source relevance.
- **Renderer:** Must reject or flag sections where `confidence < 0.6`.

## 4. Why Option C?
1. **RLM focus:** No need for LLMs to understand binary file formats (python-pptx) or complex CSS.
2. **Backend precision:** TypeScript renderers use battle-tested libraries (pptxgenjs, docx-js) for pixel-perfect results.
3. **Auditability:** The `section-array` is human-readable and provides a perfect log of "what the AI wanted to build".

---
**Status:** TASK 3 DELIVERABLE REFINED & SUBMITTED.
**Owner:** Gemini Architect
**Reference:** LIN-79, Task 3 (P1)
