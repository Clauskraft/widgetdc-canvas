# 🚀 WidgeTDC Vibecoding Specifikation (v1.3.0 - OPERATIONAL EXPANSION)

**Status:** CANONICAL / FINAL DESIGN
**Arkitekt:** THE ARCHITECT (Gemini 2.5 Pro)
**Referencer:** LIN-104 (ARC-007), LIN-99 (Qwen Review), Commit: 58cfd9e

---

## 🏛️ 1. OVERORDNET FILOSOFI
Vibecoding i WidgeTDC handler om at **dyrke en arkitektur-graf**. Vi transformerer intentioner til vedvarende, valide vidensobjekter i Neo4j via en risikostyret, sporbart og højtydende pipeline.

## 🏗️ 2. CANONICAL GRAPH SCHEMAS (Codex Aligned)

### 2.1 Pattern Node (:Pattern)
```cypher
MERGE (p:Pattern {id: $id})
SET p += {
  name: $name,
  vibe_query: $vibe_query,
  frameworkVersion: "1.3.0",
  status: $status, // DRAFT | ACTIVE | HYPOTHESIS
  domain: $domain,
  createdAt: datetime(),
  lastVerifiedAt: datetime(),
  trace_id: $trace_id
}
```

### 2.2 AnswerBlock (:AnswerBlock)
```cypher
MERGE (a:AnswerBlock {id: $id})
SET a += {
  title: $title,
  content: $content,
  trace_id: $trace_id,
  baseVersion: $baseVersion
}
```

## 🧠 3. TRACEABLE ORCHESTRATION (Qwen Aligned)
1.  **Distributed Tracing:** Alle operationer SKAL bære en `X-Trace-Id`. Dette gælder fra `neural-bridge` til `graph.write_cypher`.
2.  **No Circular Vibes:** Systemet validerer autonomt at nye ToolChains ikke skaber cirkulære afhængigheder i RLM-Engine arkitekturen via `scripts/graph-compliance-validator.js`.

## 🐍 4. RISK-GATED EXECUTION & UCP (Claude Aligned)
1.  **Pre-Write Risk Gate:** SENTINEL gate skal trigge **før** enhver skrivning.
2.  **UCP Synchronization:** Synkronisering mellem blocks sker via **REST (PUT /api/canvas/:id)**. Event-driven arkitektur er planlagt til v2.0.
3.  **Circuit Breaker:** Max 3 selv-rettende loops i sandbox.

---
## 🤝 5. ENDELIG FLEET KONTRAKT (JSON UCP-1.3)
```json
{
  "schema_version": "1.3.0",
  "vibe_id": "uuid",
  "trace_id": "string (X-Trace-Id)",
  "agent_id": "string",
  "decision_id": "string",
  "timestamp": "ISO-8601",
  "graph_impact": {
    "canonical_label": "Pattern | AnswerBlock | ControlPack",
    "nodes_impacted": ["string"],
    "relations_merged": ["IMPLEMENTS", "REGULATES"]
  },
  "canvas_payload": {
    "sync_group": "string",
    "blocks": [
      {
        "type": "string",
        "data": { "..." },
        "meta": { "..." }
      }
    ]
  },
  "risk_assessment": {
    "score": "float",
    "gate_passed": "boolean",
    "blast_radius": "string"
  }
}
```

## 🛠️ 6. INTEGRATION MED EKSISTERENDE INFRASTRUKTUR
- **Tools:** Brug `blocks.upsert` til alle Canvas-opdateringer.
- **Recall:** Brug `kg_rag.query` som primær kilde til mønster-retrieval.
- **Folding:** Kald `context_folding.fold` ved ToolChains med > 5 skridt.
