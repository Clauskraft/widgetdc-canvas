import { useCanvasStore } from '../store/canvasStore';

/**
 * ImmuneResponseManager
 * 
 * Maps backend events (failures, recoveries) to UI visual states.
 * This brings the "nervous system" of WidgeTDC to life on the Canvas.
 */
export const initImmuneResponseManager = () => {
  // In a real scenario, this would subscribe to a WebSocket or EventSource
  // for now, we provide a programmatic trigger for the "Immune Response" skuespil.
  
  const triggerFailure = (nodeId: string) => {
    const { nodes } = useCanvasStore.getState();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    useCanvasStore.setState(state => ({
      nodes: state.nodes.map(n => 
        n.id === nodeId ? { ...n, data: { ...n.data, learningState: 'warning' } } : n
      )
    }));

    // Auto-heal after a delay to simulate "Immune Response"
    setTimeout(() => {
      triggerHealing(nodeId);
    }, 2500);
  };

  const triggerHealing = (nodeId: string) => {
    useCanvasStore.setState(state => ({
      nodes: state.nodes.map(n => 
        n.id === nodeId ? { ...n, data: { ...n.data, learningState: 'healing' } } : n
      )
    }));

    // Solidify after healing animation
    setTimeout(() => {
      const node = useCanvasStore.getState().nodes.find(n => n.id === nodeId);
      if (node) {
        useCanvasStore.getState().solidifyNode(nodeId, { 
          subtitle: 'Healed via Collective Wisdom',
          learningState: 'none'
        });
      }
    }, 2000);
  };

  return { triggerFailure, triggerHealing };
};
