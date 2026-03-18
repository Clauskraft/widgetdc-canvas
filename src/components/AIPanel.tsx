import { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, ChevronDown, ChevronRight, ArrowDownToLine, BrainCircuit, Sparkles, Lock, CheckCircle2, Globe, Activity } from 'lucide-react';
import { useCanvasStore } from '../store/canvasStore';
import { graphRead, graphSearch, graphTextSearch, graphWindow, mcpCall, isComplianceQuery } from '../lib/api';
import { ragQuery, type SuggestedAction } from '../lib/rag';
import type { CanvasNodeType } from '../types/canvas';
import { syncNotebookLM, saveNotebookLMCookie } from '../lib/connectors';
import { runPipeline, runFullEnrichment, DANISH_TARGETS } from '../testcases/competitive-intel-pipeline';
import {
  generatePipelineView,
  generateMarketMap,
  generateTechLandscape,
  generateInfraTopology,
} from '../testcases/canvas-ci-perspective';
import { generateShowcaseView } from '../testcases/showcase-view';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  thinkingSteps?: string[];
  isReasoning?: boolean;
  injectable?: boolean;
  suggestedActions?: SuggestedAction[];
}

const COMMAND_MAP: {
  pattern: RegExp;
  handler: (match: RegExpMatchArray) => Promise<{ records: unknown[]; nodeType: CanvasNodeType; labelField: string; message: string }>;
}[] = [
  {
    pattern: /^(show|vis|hent)\s+(all\s+)?agents?$/i,
    handler: async () => {
      const records = await graphRead("MATCH (a:Agent) WHERE a.status <> 'deprecated' RETURN a LIMIT 30");
      return { records, nodeType: 'agent', labelField: 'name', message: `Found ${(records as unknown[]).length} agents` };
    },
  },
  {
    pattern: /^(show|vis|hent)\s+(all\s+)?servers?$/i,
    handler: async () => {
      const records = await graphRead('MATCH (s:Service) RETURN s LIMIT 30');
      return { records, nodeType: 'server', labelField: 'name', message: `Found ${(records as unknown[]).length} servers` };
    },
  },
  {
    pattern: /^(show|vis|hent)\s+(all\s+)?tools?$/i,
    handler: async () => {
      const records = await graphRead('MATCH (t:MCPTool) RETURN t LIMIT 50');
      return { records, nodeType: 'tool', labelField: 'name', message: `Found ${(records as unknown[]).length} tools` };
    },
  },
  {
    pattern: /^(show|vis|hent)\s+(all\s+)?entities$/i,
    handler: async () => {
      const records = await graphRead('MATCH (d:ConsultingDomain) RETURN d LIMIT 30');
      return { records, nodeType: 'entity', labelField: 'name', message: `Found ${(records as unknown[]).length} entities` };
    },
  },
  {
    pattern: /^(show|vis|hent)\s+(all\s+)?competitors?$/i,
    handler: async () => {
      const records = await graphRead('MATCH (c:Competitor) RETURN c LIMIT 30');
      return { records, nodeType: 'entity', labelField: 'name', message: `Found ${(records as unknown[]).length} competitors` };
    },
  },
  {
    pattern: /^cypher:\s*(.+)$/is,
    handler: async (match) => {
      const query = match[1]?.trim() ?? '';
      const records = await graphRead(query);
      return { records, nodeType: 'entity', labelField: 'name', message: `Query returned ${(records as unknown[]).length} records` };
    },
  },
  {
    pattern: /^(search|søg|find)\s+graph\s+(.+)$/i,
    handler: async (match) => {
      const query = match[2]?.trim() ?? '';
      const records = await graphSearch(query, { limit: 20 });
      return { records, nodeType: 'entity', labelField: 'label', message: `Found ${(records as unknown[]).length} graph matches for "${query}"` };
    },
  },
  {
    pattern: /^(show|vis|load|hent)\s+graph\s+(overview|region|detail)$/i,
    handler: async (match) => {
      const lod = (match[2]?.trim() ?? 'overview') as 'overview' | 'region' | 'detail';
      const result = await graphWindow(lod, { limit: lod === 'detail' ? 300 : undefined });
      return {
        records: result.nodes,
        nodeType: 'entity',
        labelField: 'label',
        message: `Loaded graph ${lod} window with ${result.nodes.length} nodes and ${result.edges.length} edges`,
      };
    },
  },
];

const PIPELINE_COMMANDS: {
  pattern: RegExp;
  run: (match: RegExpMatchArray, addMsg: (msg: string) => void, addNodes: typeof useCanvasStore.getState extends () => infer S ? S extends { addNode: infer F } ? F : never : never) => Promise<string>;
}[] = [
  {
    pattern: /^(show|vis|load|hent)\s+(routing|orchestrator routing|routing lineage)$/i,
    run: async (_match, addMsg) => {
      addMsg('Henter orchestrator routing-lineage...');
      const nodeId = await useCanvasStore.getState().loadOrchestratorRouting({ x: 220, y: 180 });
      return `Routing-lineage indlæst på lærredet som node ${nodeId}.`;
    },
  },
  {
    pattern: /^(show|vis|load|hent)\s+(governance|evaluation|eval|scorecard|governance eval)$/i,
    run: async (_match, addMsg) => {
      addMsg('Henter downstream governance-evaluering fra backend...');
      const nodeId = await useCanvasStore.getState().loadGovernanceEval({ x: 260, y: 240 });
      return `Governance-evaluering indlæst på lærredet som node ${nodeId}.`;
    },
  },
  {
    pattern: /^(run|kør)\s+ci\s+pipeline\s+(.+)$/i,
    run: async (match, addMsg, addNode) => {
      const targetName = match[2]?.trim() ?? '';
      const target = DANISH_TARGETS.find((t) => t.name.toLowerCase().includes(targetName.toLowerCase()));
      if (!target) return `Target "${targetName}" not found.`;
      addMsg(`Starting CI Pipeline for ${target.name}...`);
      const result = await runPipeline(target);
      addNode('entity', target.name, target.domain);
      return `Pipeline complete for ${target.name}.`;
    },
  },
];

function MessageBubble({ msg, onInject, onRunCommand }: { msg: Message; onInject: (text: string, type?: CanvasNodeType) => string; onRunCommand?: (cmd: string) => void }) {
  const [showThinking, setShowThinking] = useState(false);
  const hasThinking = msg.thinkingSteps && msg.thinkingSteps.length > 0;

  return (
    <div className={`text-sm whitespace-pre-wrap rounded-lg px-3 py-2 ${msg.role === 'user' ? 'bg-tdc-500/20 text-tdc-200 ml-8' : 'bg-neural-panel text-gray-300 mr-8 shadow-sm border border-neural-border/50'}`}>
      {msg.content}
      {hasThinking && (
        <div className="mt-2 border-t border-neural-border/50 pt-1.5">
          <button onClick={() => setShowThinking(!showThinking)} className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300">
            <BrainCircuit size={11} /> {showThinking ? <ChevronDown size={11} /> : <ChevronRight size={11} />} {msg.thinkingSteps!.length} steps
          </button>
          {showThinking && (
            <div className="mt-1.5 border-l-2 border-purple-500/30 pl-2 space-y-1 max-h-[120px] overflow-y-auto">
              {msg.thinkingSteps!.map((step, j) => <div key={j} className="text-[11px] text-gray-400">{j+1}. {step}</div>)}
            </div>
          )}
        </div>
      )}
      {msg.injectable && msg.role === 'assistant' && (
        <button onClick={() => onInject(msg.content, 'insight')} className="mt-2 flex items-center gap-1 text-[11px] text-tdc-400 hover:text-tdc-300">
          <ArrowDownToLine size={11} /> Inject to Canvas
        </button>
      )}
    </div>
  );
}

export function AIPanel() {
  const { aiPanelOpen, toggleAiPanel, addNodesFromGraph, addNode, reason, injectToCanvas } = useCanvasStore();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Oracle System Online. Grounded Reasoning Layer 5 active.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [nlmToken, setNlmToken] = useState('');
  const [isNlmConnected, setIsNlmConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const connectNotebookLM = async () => {
    if (!nlmToken) return;
    setLoading(true);
    try {
      await saveNotebookLMCookie(nlmToken);
      const result = await syncNotebookLM();
      if (result.success) {
        setIsNlmConnected(true);
        setMessages(prev => [...prev, { role: 'assistant', content: '✅ NotebookLM Tunnel Etableret. Oraklet har nu direkte adgang til dit strategiske bibliotek.' }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: `❌ Forbindelse fejlede: ${result.error}` }]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!aiPanelOpen) return null;

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    try {
      let handled = false;
      for (const cmd of PIPELINE_COMMANDS) {
        const match = text.match(cmd.pattern);
        if (match) {
          const addMsg = (m: string) => setMessages((prev) => [...prev, { role: 'assistant', content: m }]);
          const res = await cmd.run(match, addMsg, addNode);
          setMessages((prev) => [...prev, { role: 'assistant', content: res }]);
          handled = true; break;
        }
      }
      if (!handled) {
        for (const cmd of COMMAND_MAP) {
          const match = text.match(cmd.pattern);
          if (match) {
            const res = await cmd.handler(match);
            if (res.records && (res.records as unknown[]).length > 0) addNodesFromGraph(res.records as unknown[], res.nodeType, res.labelField);
            setMessages((prev) => [...prev, { role: 'assistant', content: res.message }]);
            handled = true; break;
          }
        }
      }
      if (!handled) {
        const result = await useCanvasStore.getState().reason(text);
        setMessages((prev) => [...prev, { role: 'assistant', content: result.recommendation, thinkingSteps: result.thinking_steps, injectable: true }]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err instanceof Error ? err.message : String(err)}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-[380px] h-full border-l border-neural-border bg-neural-surface flex flex-col z-[60] shadow-[-20px_0_50px_rgba(0,0,0,0.5)]">
      <div className="p-4 border-b border-neural-border flex items-center justify-between bg-gradient-to-r from-purple-900/20 to-transparent">
        <div className="flex items-center gap-2">
          <Sparkles className="text-purple-400" size={18} />
          <h2 className="font-bold text-gray-100 uppercase tracking-widest text-xs">The Oracle</h2>
        </div>
        <button onClick={toggleAiPanel} className="text-gray-500 hover:text-gray-300"><X size={16} /></button>
      </div>

      <div className="p-4 bg-slate-900/50 border-b border-neural-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isNlmConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-gray-600'}`} />
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Layer 5: NotebookLM</span>
          </div>
          {isNlmConnected && <CheckCircle2 size={12} className="text-emerald-500" />}
        </div>
        {!isNlmConnected ? (
          <div className="space-y-2">
            <div className="relative group">
              <Lock size={10} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="password"
                value={nlmToken}
                onChange={(e) => setNlmToken(e.target.value)}
                placeholder="Paste __Secure-1PSID token..."
                className="w-full pl-8 pr-3 py-2 bg-neural-panel border border-neural-border rounded-lg text-[10px] text-gray-300 focus:outline-none focus:border-purple-500/50 transition-all font-mono"
              />
            </div>
            <button onClick={connectNotebookLM} disabled={loading} className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">
              {loading ? 'Establishing Tunnel...' : 'Indsprøjt Forbindelse'}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between text-[10px] text-emerald-400/80 italic font-medium">
            <span className="truncate">Tunnel: Connected</span>
            <span className="bg-emerald-500/10 px-1.5 py-0.5 border border-emerald-500/20 rounded uppercase font-bold tracking-widest text-[8px]">Live</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} onInject={injectToCanvas} onRunCommand={(cmd) => handleSend(cmd)} />
        ))}
        {loading && <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 size={14} className="animate-spin" /> Querying...</div>}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-neural-border">
        <div className="flex gap-2">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder="Ask the Oracle..." className="flex-1 px-3 py-2 rounded-lg bg-neural-panel border border-neural-border text-sm text-gray-200 focus:outline-none focus:border-tdc-500" />
          <button onClick={() => handleSend()} disabled={loading || !input.trim()} className="p-2 rounded-lg bg-tdc-500 text-white active:scale-95 transition-all"><Send size={16} /></button>
        </div>
      </div>
    </div>
  );
}
