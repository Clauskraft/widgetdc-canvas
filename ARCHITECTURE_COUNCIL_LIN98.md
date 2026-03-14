# Architecture Council Report: Canvas + LibreChat + Foundry
## LIN-98 | Status: DELIVERED | Date: 2026-03-14

**Participants:** Claude Code (Canvas), Gemini (Architecture), Codex (Runtime/Foundry)

---

## A. Executive Thesis

WidgeTDC Canvas is a 12-node-type, 52-method strategic reasoning surface backed by a 201K-node Neo4j knowledge graph and a 5-layer intelligence stack. The system works — but it operates as a monolithic store (1,900+ lines in `canvasStore.ts`) with no awareness of the Foundry building blocks (AnswerBlock, Pattern, ReferenceArchitecture, ControlPack, MigrationPath, ReplacementCandidate, StandardComponent, DeliveryModel, BusinessCase) that represent WidgeTDC's consulting IP.

**The gap:** Canvas treats everything as generic `entity`/`insight`/`evidence` nodes. Foundry building blocks exist in the backend/graph but have no first-class visual identity in Canvas. LibreChat and Canvas share zero state — they are two separate apps with no bridge.

**The thesis:** Unify Canvas and LibreChat into a single Foundry client where building blocks are first-class citizens with distinct visual grammar, interaction patterns, and reasoning behaviors. Canvas becomes the spatial reasoning surface; LibreChat becomes the conversational command layer. Both read/write the same graph truth through the same MCP bridge.

---

## B. Current-State Diagnosis

### Canvas Strengths
- 12 node types across 6 architectural layers (Infra → Reasoning)
- 5 intelligence layers (Validity, Consequence, Synthesis, Explorer, Oracle)
- 329 MCP tools available via ToolPalette
- Full provenance tracking (manual, query, expand, tool, ai, pipeline, harvest)
- Engagement replay with audit trail
- Canvas-as-API for programmatic analysis

### Canvas Weaknesses (from LIN-95 audit — 38 findings)
- **2 CRITICAL:** Cookie exposure, localStorage overflow risk
- **14 HIGH:** Hardcoded URLs, shallow undo snapshots, concurrent state races, unsanitized inputs
- **13 MEDIUM:** Persona drift across reasoning layers, mixed language prompts, silent degradation
- Monolithic store with no separation of concerns
- Boolean `isLoading` instead of operation counter — concurrent ops break UI state

### Building Block Gap
| Building Block | In Graph? | In Canvas? | Visual Identity? |
|---|---|---|---|
| AnswerBlock | No | No | No |
| Pattern | Yes (StrategicInsight) | Partial (insight node) | Generic |
| ReferenceArchitecture | No | No | No |
| ControlPack | No | No | No |
| MigrationPath | No | No | No |
| ReplacementCandidate | No | No | No |
| StandardComponent | No | No | No |
| DeliveryModel | No | No | No |
| BusinessCase | No | No | No |

### LibreChat–Canvas Bridge
- **Current:** Zero integration. Separate apps, separate state.
- **Documented intent** (`FRONTEND_ROUTE_MAP.md`): "Visualize thread → Canvas spawn" and "Discuss node → LibreChat thread" — but not implemented.

---

## C. Target Architecture: Canvas + LibreChat + Foundry

### Three-Layer Model

```
┌─────────────────────────────────────────────────┐
│                   USER LAYER                     │
│  LibreChat (Conversational)  │  Canvas (Spatial) │
│  - Agent dialog              │  - Node graph     │
│  - Building block retrieval  │  - Visual grammar │
│  - Report/deck generation    │  - Reasoning aura │
│  - Review/approval loops     │  - Gap overlays   │
└──────────────┬───────────────┴────────┬──────────┘
               │     Foundry Bridge     │
               │  (Shared MCP + State)  │
┌──────────────┴────────────────────────┴──────────┐
│                  RUNTIME LAYER                    │
│  Backend (MCP Router)  │  RLM Engine (Reasoning)  │
│  - graph.read/write    │  - /reason (MLTM)        │
│  - harvest/trident     │  - compliance-gaps        │
│  - nexus.tender_match  │  - context_folding.fold   │
│  - system.run_python   │  - kg_rag.query           │
└──────────────┬────────────────────────┬──────────┘
               │                        │
┌──────────────┴────────────────────────┴──────────┐
│                  TRUTH LAYER                      │
│         Neo4j AuraDB (201K nodes, 1.57M edges)   │
│         + Foundry Building Block Ontology         │
└──────────────────────────────────────────────────┘
```

### Foundry Bridge (New)
A shared state layer between LibreChat and Canvas:
- **WebSocket channel** for real-time sync (node created in Canvas → appears in LibreChat thread)
- **Shared session context** (current engagement, selected building blocks, active reasoning chain)
- **Canonical URL scheme:** `foundry://block/{type}/{id}` — clickable in both surfaces

---

## D. Visual Interaction Model

### New Node Types for Building Blocks

| Building Block | Node Type | Icon | Color | Layer |
|---|---|---|---|---|
| AnswerBlock | `answer-block` | MessageSquare | #3b82f6 (blue) | INTELLIGENCE |
| Pattern | `pattern` | Fingerprint | #8b5cf6 (purple) | INTELLIGENCE |
| ReferenceArchitecture | `ref-architecture` | Building2 | #0891b2 (cyan) | CAPABILITY |
| ControlPack | `control-pack` | ShieldCheck | #dc2626 (red) | CAPABILITY |
| MigrationPath | `migration-path` | Route | #f59e0b (amber) | ORCHESTRATION |
| ReplacementCandidate | `replacement` | ArrowLeftRight | #ef4444 (rose) | INTELLIGENCE |
| StandardComponent | `std-component` | Component | #6366f1 (indigo) | CAPABILITY |
| DeliveryModel | `delivery-model` | Truck | #059669 (emerald) | ORCHESTRATION |
| BusinessCase | `business-case` | Calculator | #16a34a (green) | INTELLIGENCE |

### Surface Classification

| Surface | Content | Why |
|---|---|---|
| **Node-native** | AnswerBlock, Pattern, ControlPack, StandardComponent, ReplacementCandidate | Self-contained, inspectable, connectable |
| **Panel-native** | BusinessCase (detailed financials), DeliveryModel (timeline view) | Complex internal structure needs more space than a node |
| **Canvas-native** | ReferenceArchitecture, MigrationPath | Spatial layouts with multiple connected components |
| **Deck-native** | All of the above as exportable slides | PowerPoint/PDF generation from canvas state |

### Visual Grammar Rules
1. **Building block nodes** have a distinct double-border to differentiate from generic nodes
2. **Confidence halos:** Green (>0.8), Yellow (0.5-0.8), Red (<0.5) — already implemented for validity
3. **Provenance badges:** AI-generated vs. manual vs. graph-derived — visible on all blocks
4. **Connection semantics:** `IMPLEMENTS` (block→architecture), `MITIGATES` (control→gap), `REPLACES` (candidate→component), `FUNDS` (case→path)

---

## E. Building-Block Usage Model

### Lifecycle: Create → Enrich → Validate → Connect → Deliver

```
1. CREATE          2. ENRICH           3. VALIDATE          4. CONNECT          5. DELIVER
─────────────      ─────────────       ─────────────        ─────────────       ─────────────
User creates       RLM enriches        Validity Layer       User/AI links       Export as
block via:         via /reason         scores evidence      blocks together     report/deck/
- Canvas drag      with graph RAG      + NotebookLM         on canvas with      artifact node
- LibreChat cmd    context             grounding            typed edges
- Template load
- Pattern discovery
```

### Per-Block Behaviors

| Block | Create | Enrich | Validate | Connect |
|---|---|---|---|---|
| **AnswerBlock** | From Oracle response or LibreChat thread | Auto-attach evidence links | Validity score from sources | Links to Pattern, ControlPack |
| **Pattern** | From `discoverPatterns()` or manual | Cross-engagement frequency scoring | Empirical check across engagements | Links to AnswerBlock, Architecture |
| **ReferenceArchitecture** | From template or LibreChat `/architecture` | Component enumeration via graph | Gap analysis overlay | Contains StandardComponents |
| **ControlPack** | From compliance gap overlay | Auto-map to framework obligations | NIS2/GDPR/DORA compliance check | Mitigates ComplianceGaps |
| **MigrationPath** | Manual or from ReplacementCandidate | Timeline estimation via RLM | Risk assessment (Consequence Engine) | Connects current→target state |
| **ReplacementCandidate** | From tender matching or competitive analysis | Scoring against requirements | Market validation via harvest tools | Replaces StandardComponent |
| **StandardComponent** | From graph (TechStackEntry) or manual | Capability mapping | Adoption scoring across competitors | Part of ReferenceArchitecture |
| **DeliveryModel** | Manual or from LibreChat planning | Resource/timeline estimation | Feasibility via BusinessCase | Executes MigrationPath |
| **BusinessCase** | From DeliveryModel financials | ROI calculation via RLM | Evidence grounding | Funds MigrationPath/DeliveryModel |

---

## F. Runtime Routing Model

### Decision Tree: What Runs Where

```
User Action
    │
    ├─ Simple CRUD (add/remove/connect nodes)
    │  └─ Canvas (local Zustand) — no backend call
    │
    ├─ Graph query (expand, search, template load)
    │  └─ Backend MCP → graph.read_cypher → Neo4j
    │
    ├─ Single-node reasoning (verify, consequences, oracle)
    │  └─ RLM /reason (domain-tagged, 60s timeout)
    │     └─ If NotebookLM available: fetchNotebookContext first
    │
    ├─ Multi-node analysis (auto-analyze, patterns, synthesis)
    │  └─ RLM /reason + Backend graph queries (parallel)
    │     └─ Use Promise.allSettled for isolation
    │
    ├─ Heavy document processing (>100K tokens)
    │  └─ RLM context_folding.fold → then /reason
    │
    ├─ Complex multi-agent task (complexity > 7)
    │  └─ RLM Swarm Orchestration → agents negotiate
    │     └─ Canvas shows live swarm state as thought nodes
    │
    ├─ Building block retrieval/scoring
    │  └─ Backend MCP → graph.read + nexus.tender_match
    │     └─ RLM for scoring/enrichment if needed
    │
    └─ Report/deck generation
       └─ RLM /reason (narrative domain) → Canvas artifact node
          └─ Export: html-to-image (PNG/SVG) or future PPT gen
```

### Option C Implementation (RLM Synth + Backend Render)

| Step | Owner | Action |
|---|---|---|
| 1. User triggers analysis | Canvas | Sends context to RLM |
| 2. RLM synthesizes | RLM Engine | Folds context, runs reasoning, returns structured JSON |
| 3. Backend renders | Backend | Transforms JSON → graph nodes, persists to Neo4j |
| 4. Canvas visualizes | Canvas | Loads rendered nodes via `loadFromGraph()` |

This keeps Canvas thin (render only), RLM smart (synthesis only), and Backend reliable (persistence + rendering).

---

## G. 30-Day Implementation Plan

### Week 1: Foundation (Days 1-7)
- [ ] **Fix CRITICAL audit findings** (S1: cookie security, ST1: localStorage guard)
- [ ] **Replace `isLoading` boolean with `pendingOps` counter** (ST4)
- [ ] **Deep-clone undo snapshots** (ST2)
- [ ] **Create `.env.example`** with all required variables (P6)
- [ ] **Add Caddy proxy rules for `/reason` and `/intelligence`** (P4)

### Week 2: Building Blocks (Days 8-14)
- [ ] **Define 9 new node types** in `canvas.ts` (AnswerBlock through BusinessCase)
- [ ] **Create node renderers** in `nodes/index.tsx` with double-border visual grammar
- [ ] **Add building block templates** — "Solution Architecture" and "Business Case Builder"
- [ ] **Implement typed edge creation** (IMPLEMENTS, MITIGATES, REPLACES, FUNDS)
- [ ] **Add building block commands** to CommandPalette

### Week 3: Runtime Integration (Days 15-21)
- [ ] **Implement block enrichment** — RLM /reason with block-type-specific prompts
- [ ] **Add block validation** — Validity Layer aware of block semantics
- [ ] **Connect Pattern discovery** to create `pattern` nodes (not generic `insight`)
- [ ] **Implement ControlPack auto-generation** from compliance gap overlay
- [ ] **Add ReplacementCandidate scoring** via tender matching

### Week 4: Bridge + Polish (Days 22-30)
- [ ] **Design Foundry Bridge protocol** (WebSocket schema for Canvas↔LibreChat sync)
- [ ] **Implement "Visualize in Canvas" action** from LibreChat thread
- [ ] **Implement "Discuss in LibreChat" action** from Canvas node
- [ ] **Add deck export** — building blocks → PowerPoint slides via artifact nodes
- [ ] **Unify prompt language** — all prompts in English, user-facing strings in Danish
- [ ] **Architecture Council review** of implemented building blocks

---

## H. Open Questions for Architecture Council

1. **Building block persistence:** Should new block types be Neo4j node labels (e.g., `:AnswerBlock`) or metadata on existing `:CanvasNode` (e.g., `blockType: 'answer-block'`)? Neo4j labels are more queryable; metadata is more flexible.

2. **LibreChat bridge technology:** WebSocket (real-time, complex) vs. polling shared graph state (simpler, higher latency) vs. shared localStorage (same-origin only)?

3. **Prompt language policy:** Currently mixed Danish/English causing output inconsistency. Proposal: all LLM prompts in English, all user-facing UI text in Danish. Confirm?

4. **Building block ownership:** Who defines the canonical schema for each block? Codex (graph truth), Gemini (architecture), or Claude Code (implementation)?

5. **Deck generation:** Build custom PPT export in Canvas, or delegate to LibreChat/backend with a dedicated report engine?

6. **Swarm visualization:** When RLM triggers multi-agent swarm, should Canvas show agents as live `agent` nodes with real-time status, or summarize as a single `thought` chain?

7. **Authentication architecture:** Current `__Secure-1PSID` cookie hack for NotebookLM is CRITICAL security risk. Replace with OAuth proxy, or deprecate direct NotebookLM integration in favor of RLM-mediated grounding?

8. **State management refactor:** `canvasStore.ts` at 1,900+ lines is unsustainable. Split into domain slices (graph, reasoning, ui, blocks)? Or keep monolithic for simplicity?

---

## Appendix: Current System Statistics

| Metric | Value |
|---|---|
| Canvas node types | 12 (need 21 with building blocks) |
| Canvas methods | 52 |
| Canvas templates | 5 |
| UI components | 9 |
| MCP tools available | 329 (56 namespaces) |
| Neo4j nodes | 201K+ |
| Neo4j edges | 1.57M+ |
| RLM reasoning domains | 6 |
| RAG intent categories | 5 |
| Consulting frameworks | 74 |
| Consulting domains | 12 |
| LIN-95 audit findings | 38 (2 CRITICAL, 14 HIGH) |

---

*Report generated by Claude Code (Canvas Agent) for Architecture Council review.*
*References: LIN-95 (Production Audit), LIN-96 (Code Review), LIN-98 (This Report)*
