# Option C Architecture Spec: RLM-to-Backend Contract

## 1. Concept: Synthesis/Render Split
This specification defines the "Option C" contract for the WidgeTDC Foundry. The RLM (Reasoning Engine) is responsible for **Synthesizing** the structural intent, while the Backend is responsible for **Rendering** the final file bytes (PPTX, DOCX, PDF).

## 2. API Endpoint: `/api/foundry/render`
**Method:** `POST`
**Auth:** `Bearer <WIDGETDC_API_KEY>`

### A. Request Schema (Input from RLM)
The RLM sends an array of "Intent Sections".

```json
{
  "jobId": "uuid-v4",
  "targetFormat": "pptx | docx | pdf",
  "themeId": "mckinsey | tdc | dark",
  "metadata": {
    "title": "Market Strategy 2026",
    "author": "Oracle Agent",
    "client": "Project Alpha"
  },
  "sections": [
    {
      "type": "title_slide | executive_summary | content | diagram | table | metric_grid",
      "content": {
        "title": "Section Title",
        "subtitle": "Key takeaway headline",
        "body": "Markdown or structured text",
        "items": ["Point 1", "Point 2"],
        "data": [ { "label": "Revenue", "value": 100 } ]
      },
      "visualIntent": {
        "layout": "split | centered | grid",
        "emphasis": "high | normal",
        "diagramType": "swot | roadmap | architecture"
      }
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
    "fileName": "Strategy_2026.pptx",
    "contentType": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "size": 1024000,
    "downloadUrl": "https://.../retrieve/uuid"
  },
  "manifest": {
    "promptHash": "sha256",
    "renderTimeMs": 450,
    "version": "1.2.0",
    "qualityGate": {
      "score": 0.98,
      "checks": [
        { "id": "theme_adherence", "passed": true },
        { "id": "broken_links", "passed": true }
      ]
    }
  }
}
```

## 3. Section Types & Capabilities
- **`title_slide`:** Mandatory start. Requires title/subtitle.
- **`diagram`:** Uses the `DiagramService` (D3/Drawio) to render vector assets based on `diagramType`.
- **`metric_grid`:** Specifically for financial data (DCF, TCO). Maps to high-contrast visual blocks.

## 4. Why Option C?
1. **RLM focus:** No need for LLMs to understand binary file formats or complex CSS.
2. **Backend precision:** Python/TS renderers use battle-tested libraries (python-pptx, docx-js) for pixel-perfect results.
3. **Auditability:** The `section-array` is human-readable and provides a perfect log of "what the AI wanted to build".

---
**Status:** TASK 3 DELIVERABLE SUBMITTED.
**Owner:** Gemini Architect
**Reference:** LIN-79, Task 3 (P1)
