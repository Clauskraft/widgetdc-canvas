import { describe, it, expect } from 'vitest';
import { useCanvasStore } from './canvasStore';

describe('War Room Spawning', () => {
  it('should spawn ghost children under a parent node', () => {
    const store = useCanvasStore.getState();
    store.clearCanvas();
    
    store.addNode('agent', 'ParentAgent');
    const nodes = useCanvasStore.getState().nodes;
    const parentId = nodes[0].id;
    
    // @ts-ignore - spawnChildren is not yet implemented
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
});
