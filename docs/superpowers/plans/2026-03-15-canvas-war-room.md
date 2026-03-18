# Canvas "War Room" Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Canvas into a hierarchical "War Room" creation engine with TDD-verified command nodes, ghost nodes, and visual self-healing animations.

**Architecture:** Enhances the existing Zustand `canvasStore` to support parent-child relationships and asynchronous "Ghost" states. A new `ImmuneResponseManager` coordinates visual feedback between backend `AgentLearningLoop` events and the React Flow UI.

**Tech Stack:** React (Vite), Zustand, React Flow (@xyflow/react), Vitest, Tailwind CSS.

---

## Chunk 1: Hierarchical State & Ghost Nodes (TDD)

### Task 1: Extend Node Types for War Room State
**Files:**
- Modify: `src/types/canvas.ts`

- [ ] **Step 1: Add Ghost and Hierarchical properties to `CanvasNodeData`**
- [ ] **Step 2: Commit types**

### Task 2: Implement `spawnChildren` in Store (TDD)
**Files:**
- Modify: `src/store/canvasStore.ts`
- Create: `src/store/warRoom.test.ts`

- [ ] **Step 1: Write failing test for spawning ghost children**
- [ ] **Step 2: Run test and verify failure**
- [ ] **Step 3: Implement minimal `spawnChildren`**
- [ ] **Step 4: Run test and verify pass**
- [ ] **Step 5: Commit**

---

## Chunk 2: Command Node UI & Power Verbs

### Task 3: Command Input Component
**Files:**
- Create: `src/components/nodes/CommandInput.tsx`
- Create: `src/components/nodes/CommandInput.test.tsx`

- [ ] **Step 1: Write test for CommandInput UI**
- [ ] **Step 2: Implement CommandInput with Tailwind**
- [ ] **Step 3: Integrate into Base Node**

---

## Chunk 3: Solidification & Immune Response

### Task 4: Node Solidification Action
**Files:**
- Modify: `src/store/canvasStore.ts`

- [ ] **Step 1: Write test for `solidifyNode`**
- [ ] **Step 2: Implement `solidifyNode`**
- [ ] **Step 3: Commit**

### Task 5: Visual Immune Response (Animations)
**Files:**
- Modify: `src/components/nodes/index.tsx`
- Create: `src/lib/immuneResponseManager.ts`

- [ ] **Step 1: Add "Warning" and "Healing" visual states to nodes**
- [ ] **Step 2: Create the manager to listen for EventBus events**
- [ ] **Step 3: Integrate events into store**
