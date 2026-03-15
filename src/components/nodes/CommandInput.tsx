import React, { useState } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { initImmuneResponseManager } from '../../lib/immuneResponseManager';

interface CommandInputProps {
  nodeId: string;
}

const POWER_VERBS = [
  { label: '⚡️ Decompose', action: 'decompose' },
  { label: '🕵️ Research', action: 'research' },
  { label: '🤖 Assign Agent', action: 'assign' },
];

export const CommandInput: React.FC<CommandInputProps> = ({ nodeId }) => {
  const [command, setCommand] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const spawnChildren = useCanvasStore(state => state.spawnChildren);
  const executeNodeCommand = useCanvasStore(state => state.executeNodeCommand);
  const { triggerFailure } = initImmuneResponseManager();

  const handleAction = (action: string) => {
    if (action === 'decompose') {
      spawnChildren(nodeId, ['Hypothesis: Price Gap', 'Hypothesis: Feature Deficit', 'Hypothesis: Brand Trust']);
    } else if (action === 'research') {
      // Simulate a research task that hits a failure and then heals
      spawnChildren(nodeId, ['OSINT: Competitor X Analysis']);
      setTimeout(() => {
        const { nodes } = useCanvasStore.getState();
        const ghost = nodes.find(n => n.data.parentId === nodeId && n.data.isGhost);
        if (ghost) triggerFailure(ghost.id);
      }, 1000);
    } else {
      executeNodeCommand(nodeId, `/${action}`);
    }
    setShowMenu(false);
    setCommand('');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && command.trim()) {
      executeNodeCommand(nodeId, command);
      setCommand('');
      setShowMenu(false);
    }
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 p-2 bg-slate-900/80 backdrop-blur-sm border-t border-slate-700 rounded-b-lg nodrag">
      {showMenu && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-slate-800 border border-slate-700 rounded-md shadow-xl overflow-hidden flex flex-col">
          {POWER_VERBS.map(pv => (
            <button
              key={pv.action}
              onClick={() => handleAction(pv.action)}
              className="px-3 py-2 text-left text-xs text-slate-200 hover:bg-indigo-600 transition-colors"
            >
              {pv.label}
            </button>
          ))}
        </div>
      )}
      <input
        type="text"
        placeholder="Type instruction or select action..."
        className="w-full bg-slate-950 border border-slate-600 rounded px-2 py-1 text-[10px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
        value={command}
        onChange={(e) => setCommand(e.target.value)}
        onFocus={() => setShowMenu(true)}
        onBlur={() => setTimeout(() => setShowMenu(false), 200)}
        onKeyDown={onKeyDown}
      />
    </div>
  );
};
