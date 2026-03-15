import { describe, it, expect } from 'vitest';
import { useCanvasStore } from './canvasStore';

describe('War Room Spawning', () => {
  it('should spawn ghost children under a parent node', () => {
    const store = useCanvasStore.getState();
    store.clearCanvas();
    
    store.addNode('agent', 'ParentAgent');
    const nodes = useCanvasStore.getState().nodes;
    const parentId = nodes[0].id;
    
    store.spawnChildren(parentId, ['Hypothesis 1', 'Hypothesis 2']);
    
    const currentNodes = useCanvasStore.getState().nodes;
    const ghosts = currentNodes.filter(n => n.data.isGhost && n.data.parentId === parentId);
    expect(ghosts).toHaveLength(2);
    expect(ghosts[0].data.label).toBe('Hypothesis 1');
    expect(ghosts[0].data.taskStatus).toBe('running');
    
    const edges = useCanvasStore.getState().edges;
    const ghostEdges = edges.filter(e => e.source === parentId && ghosts.some(g => g.id === e.target));
    expect(ghostEdges).toHaveLength(2);
    expect(ghostEdges[0].animated).toBe(true);
  });

  it('should solidify a ghost node', () => {
    const store = useCanvasStore.getState();
    store.clearCanvas();
    store.addNode('agent', 'Parent');
    const parentId = useCanvasStore.getState().nodes[0].id;
    
    store.spawnChildren(parentId, ['Ghost']);
    const currentNodes = useCanvasStore.getState().nodes;
    const ghostNode = currentNodes.find(n => n.data.isGhost);
    expect(ghostNode).toBeDefined();
    const ghostId = ghostNode!.id;

    store.solidifyNode(ghostId, { label: 'Solid Reality', subtitle: 'Learned something' });

    const solidNode = useCanvasStore.getState().nodes.find(n => n.id === ghostId);
    expect(solidNode).toBeDefined();
    expect(solidNode!.data.isGhost).toBe(false);
    expect(solidNode!.data.label).toBe('Solid Reality');
    expect(solidNode!.data.taskStatus).toBe('completed');
    
    const edge = useCanvasStore.getState().edges.find(e => e.target === ghostId);
    expect(edge!.animated).toBe(false);
  });
});
