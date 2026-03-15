# Design Spec: Canvas "The War Room" — Creation Engine

**Status:** Draft
**Date:** 2026-03-15
**Topic:** Hierarchical idea compilation and autonomous learning visualization in Canvas.

---

## 1. Executive Summary
The "War Room" is a significant evolution of the WidgeTDC Canvas, transforming it from a static graph viewer into an **Autonomous Creation Engine**. It leverages a top-down hierarchical approach where users plant a "Seed Goal" and watch the system unfold it into complex structures (Software Architecture, Books, Strategic Analysis) using autonomous agents and a self-healing learning loop.

## 2. Core Interaction: The Command Node
Every node in the Canvas serves as an entry point for intelligence.

### 2.1 The Unified Input
Each node features a slank, Spotlight-inspired input field at its base: "Type instruction or select action..."
*   **Power Verbs (Zero-Typing):** Clicking the field reveals a menu of context-aware verbs:
    *   `[ ⚡️ Decompose ]` (Break into child hypotheses/components)
    *   `[ 🕵️ Research ]` (Start OSINT/Neo4j deep search)
    *   `[ 🤖 Assign Agent ]` (Delegate to a specific persona like Claude or DeepSeek)
*   **Natural Language:** Users can type specific prompts (e.g., *"Analyze price trends for the last 3 quarters in Europe"*), which the system maps to agent tasks.

## 3. Asynchronous Workflow: Ghost Nodes
To eliminate wait times and provide immediate feedback, the system employs **Ghost Nodes**.

### 3.1 Pre-visualization
When a "Decompose" or "Research" task starts:
*   The system immediately spawns semi-transparent **Ghost Nodes** under the parent.
*   These nodes represent the *expected* hierarchical skeleton of the result.
*   They provide a "Live Construction Site" feel, ensuring the user knows the system is working.

### 3.2 Solidification
As background agents (OSINT, Memory Recalls) find data:
*   Ghost Nodes are populated with content.
*   The nodes transition from transparent to solid states (Solidification), changing their type to `Insight`, `Evidence`, or `Artifact`.

## 4. Learning Visualization: The Immune Response
The "War Room" makes the invisible `FailureMemory.ts` and `AgentLearningLoop.ts` tangible.

### 4.1 Failure Detection
If an agent fails (e.g., rate-limit, schema error) while populating a Ghost Node:
*   The node enters a **Warning State** (pulsing red border).

### 4.2 Healing Animation
*   The system automatically triggers a `Lesson Recall` from Neo4j.
*   A **Lesson Node** (from the Teacher/Student loop) visually "flies" into the Canvas and collides with the failing node.
*   **Transformation:** The failing node turns green (Healed), the agent resumes with the new lesson (Student side), and the node solidifies successfully.

## 5. Technical Requirements (TDD Approach)
Implementation will follow strict **Test-Driven Development**:

### 5.1 Components to Build/Update
*   **NodeComponent:** Update to include the "Command Input" and state-based rendering (Ghost vs. Solid).
*   **CanvasStore:** Implement hierarchical spawning logic and state management for async tasks.
*   **ImmuneResponseManager:** A new logic layer to handle the visual triggers for failures and lessons.
*   **AgentBridge:** Interface with `AgentLearningLoop` to trigger UI events on failure/healing.

### 5.2 Test Cases
*   `test(CommandNode): should spawn child nodes when "Decompose" is clicked`
*   `test(GhostNodes): should render semi-transparently until data is received`
*   `test(ImmuneResponse): should trigger healing animation when agent emits failure:recorded`

## 6. Goal & Value
The differentiator is **Simplicity hiding Complexity**. The user is the "General" (Master Teacher), providing the top-down vision, while the "War Room" manages the bottom-up execution, learning from every step to provide a seamless, magical experience.
