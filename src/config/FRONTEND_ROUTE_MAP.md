# Decision Doc: Frontend Route Map (LibreChat vs. Canvas)

## 1. Core Ownership

### A. LibreChat (The Conversational Interface)
**Role:** The primary entry point for multi-agent dialog and sequential task orchestration.
**Ownership:**
- Thread-based history and session management.
- Multi-model selection and individual agent interaction.
- Document uploads and simple text-based RAG queries.
- **Foundry Triggering:** Starting a "Factory Run" (Slide/Doc generation) begins here.

### B. Canvas (The Spatial Reasoning Interface)
**Role:** High-density visual mapping, strategic alignment, and complex graph exploration.
**Ownership:**
- Visualizing connections (Neighbors, Cross-Client patterns).
- **H10 Strategy Alignment:** Managing the 10-column strategic grid.
- **Oracle Interaction:** Contextual chat *inside* spatial nodes.
- **Workflow State:** Seeing the "Big Picture" of a consulting engagement.

## 2. Eliminating Overlap

| Feature | Current Overlap | Decision |
|---|---|---|
| **RAG Chat** | Both have a sidebar chat. | **Move to LibreChat**. Canvas should only have *Node-Contextual* chat (Oraklet). |
| **Document List** | Both show file assets. | **Move to LibreChat**. Canvas should only show documents as *Evidence Nodes* linked to thoughts. |
| **Agent Selection** | Both allow agent swapping. | **Move to LibreChat**. Canvas agents should be automatic/hidden (swarmed). |

## 3. Integration Bridge (The Link)
- **From LibreChat to Canvas:** "Visualize this thread" -> Spawns a new Canvas populated with the thread's key entities and insights.
- **From Canvas to LibreChat:** "Discuss this node" -> Opens a LibreChat thread with the node's full provenance and context as the starting prompt.

## 4. Immediate Cleanup Actions
1. **Disable AIPanel general chat in Canvas.** Redirect users to LibreChat for general queries.
2. **Rename Canvas AIPanel to "The Oracle"** to signify its specialized node-driven reasoning role.
3. **Unified Auth:** Ensure the same Bearer token flows seamlessly between both frontends.

---
**Status:** TASK 4 DELIVERABLE SUBMITTED.
**Owner:** Gemini Architect
**Reference:** LIN-62, Task 4 (P2)
