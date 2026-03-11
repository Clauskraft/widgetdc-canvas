import { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { useCanvasStore } from '../store/canvasStore';
import { graphRead, mcpCall } from '../lib/api';
import type { CanvasNodeType } from './nodes';
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
    pattern: /^(show|vis|hent)\s+(all\s+)?endpoints?$/i,
    handler: async () => {
      const records = await graphRead('MATCH (e:APIEndpoint) RETURN e LIMIT 30');
      return { records, nodeType: 'endpoint', labelField: 'name', message: `Found ${(records as unknown[]).length} endpoints` };
    },
  },
  {
    pattern: /^(show|vis)\s+graph\s+stats?$/i,
    handler: async () => {
      await mcpCall('graph.stats');
      return { records: [], nodeType: 'entity', labelField: 'name', message: 'Graph stats fetched — check console' };
    },
  },
  {
    pattern: /^(show|vis|hent)\s+(.+)\s+for\s+(.+)$/i,
    handler: async (match) => {
      const type = match[2]?.trim().toLowerCase() ?? '';
      const target = match[3]?.trim() ?? '';
      const cypher = `MATCH (n)-[r]->(m) WHERE toLower(n.name) CONTAINS toLower($name) RETURN m LIMIT 20`;
      const records = await graphRead(cypher, { name: target });
      const nodeType: CanvasNodeType = type.includes('agent') ? 'agent' : type.includes('tool') ? 'tool' : 'entity';
      return { records, nodeType, labelField: 'name', message: `Found ${(records as unknown[]).length} connected nodes for "${target}"` };
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
    pattern: /^(show|vis|hent)\s+(all\s+)?ghosts?(\s+nodes?)?$/i,
    handler: async () => {
      const result = await mcpCall<{ success: boolean; ghosts?: unknown[]; count?: number }>('aura.ghost_list', { limit: 30 });
      if (!result?.success) return { records: [], nodeType: 'insight' as CanvasNodeType, labelField: 'topic', message: `Ghost list failed: ${JSON.stringify(result)}` };
      const ghosts = (result.ghosts ?? []) as Record<string, unknown>[];
      return {
        records: ghosts.map((g) => ({ name: g?.topic, id: g?.id, status: g?.status, tier: g?.tier })),
        nodeType: 'insight' as CanvasNodeType,
        labelField: 'name',
        message: `Found ${ghosts.length} Ghost Nodes (epistemic gaps)`,
      };
    },
  },
  {
    pattern: /^ghost\s+metrics$/i,
    handler: async () => {
      const result = await mcpCall<Record<string, unknown>>('aura.ghost_metrics', { window_hours: 72 });
      if (!result?.success) return { records: [], nodeType: 'insight' as CanvasNodeType, labelField: 'name', message: `Metrics failed` };
      const alarms = (result.alarms ?? {}) as Record<string, boolean>;
      return {
        records: [],
        nodeType: 'insight' as CanvasNodeType,
        labelField: 'name',
        message: `Ghost Metrics (72h):\n  Total: ${result.total_ghosts}\n  Fulfilled: ${result.fulfilled}\n  Pending: ${result.pending}\n  Expired: ${result.expired}\n  Entropy: ${result.entropy}\n  Fulfillment rate: ${result.fulfillment_rate}\n  Alarms: entropy=${alarms.entropy_high ? 'HIGH' : 'ok'}, fulfillment=${alarms.fulfillment_low ? 'LOW' : 'ok'}`,
      };
    },
  },
];

// Pipeline commands (handled separately — they need progress updates)
const PIPELINE_COMMANDS: {
  pattern: RegExp;
  run: (match: RegExpMatchArray, addMsg: (msg: string) => void, addNodes: typeof useCanvasStore.getState extends () => infer S ? S extends { addNode: infer F } ? F : never : never) => Promise<string>;
}[] = [
  {
    pattern: /^(run|kør)\s+ci\s+pipeline\s+(.+)$/i,
    run: async (match, addMsg, addNode) => {
      const targetName = match[2]?.trim() ?? '';
      const target = DANISH_TARGETS.find((t) => t.name.toLowerCase().includes(targetName.toLowerCase()));
      if (!target) return `Target "${targetName}" not found. Available: ${DANISH_TARGETS.map((t) => t.name).join(', ')}`;

      addMsg(`Starting CI Pipeline for ${target.name} (${target.domain})...`);
      const result = await runPipeline(target);

      // Add nodes to canvas
      addNode('entity', target.name, target.domain);
      for (const step of result.steps) {
        if (step.status === 'success' && step.nodesCreated > 0) {
          addNode('tool', step.tool, `${step.nodesCreated} enrichments`);
        }
      }

      return `Pipeline complete for ${target.name}:\n` +
        result.steps.map((s) => `  ${s.status === 'success' ? '+' : 'x'} ${s.step}: ${s.nodesCreated} nodes`).join('\n') +
        `\nTotal: ${result.nodesCreated} nodes, ${result.errors.length} errors`;
    },
  },
  {
    pattern: /^(run|kør)\s+full\s+enrichment$/i,
    run: async (_match, addMsg, addNode) => {
      addMsg(`Starting FULL enrichment for ${DANISH_TARGETS.length} targets...`);
      addNode('pipeline', 'CI Pipeline', 'Full Enrichment Run');

      const results = await runFullEnrichment(DANISH_TARGETS, (target, step, status) => {
        addMsg(`[${status}] ${target}: ${step}`);
      });

      for (const r of results) {
        addNode('entity', r.target, `${r.nodesCreated} nodes`);
      }

      const totalNodes = results.reduce((s, r) => s + r.nodesCreated, 0);
      const totalErrors = results.reduce((s, r) => s + r.errors.length, 0);
      return `Full enrichment complete:\n  Targets: ${results.length}\n  Nodes created: ${totalNodes}\n  Errors: ${totalErrors}`;
    },
  },
  {
    pattern: /^(show|vis)\s+ci\s+results$/i,
    run: async (_match, _addMsg, addNode) => {
      const techStack = await graphRead('MATCH (t:TechStackEntry)<-[:USES_TECH]-(c:Competitor) RETURN t.name AS name, count(c) AS users ORDER BY users DESC LIMIT 20');
      const capabilities = await graphRead('MATCH (cc:CompetitorCapability)<-[:HAS_CAPABILITY]-(c:Competitor) RETURN cc.name AS name, count(c) AS competitors ORDER BY competitors DESC LIMIT 20');

      for (const rec of (techStack as Record<string, unknown>[]).slice(0, 10)) {
        addNode('entity', String(rec?.name ?? 'Unknown'), `${rec?.users ?? 0} competitors`);
      }
      for (const rec of (capabilities as Record<string, unknown>[]).slice(0, 10)) {
        addNode('evidence', String(rec?.name ?? 'Unknown'), `${rec?.competitors ?? 0} competitors`);
      }

      return `Loaded ${(techStack as unknown[]).length} tech stack entries and ${(capabilities as unknown[]).length} capabilities`;
    },
  },
  {
    pattern: /^(view|vis)\s+pipeline$/i,
    run: async (_match, _addMsg, _addNode) => {
      const { nodes, edges } = generatePipelineView();
      const store = useCanvasStore.getState();
      store.clearCanvas();
      useCanvasStore.setState({ nodes, edges });
      return `Pipeline view loaded: ${nodes.length} nodes showing tool→intelligence repurposing flow`;
    },
  },
  {
    pattern: /^(view|vis)\s+market(\s+map)?$/i,
    run: async (_match, _addMsg, _addNode) => {
      const { nodes, edges } = await generateMarketMap();
      const store = useCanvasStore.getState();
      store.clearCanvas();
      useCanvasStore.setState({ nodes, edges });
      return `Market map loaded: ${nodes.length} competitors with tech stack and signal counts`;
    },
  },
  {
    pattern: /^(view|vis)\s+tech(\s+landscape)?$/i,
    run: async (_match, _addMsg, _addNode) => {
      const { nodes, edges } = await generateTechLandscape();
      const store = useCanvasStore.getState();
      store.clearCanvas();
      useCanvasStore.setState({ nodes, edges });
      return `Tech landscape loaded: ${nodes.length} shared SaaS tools across competitors`;
    },
  },
  {
    pattern: /^(view|vis)\s+infra(structure)?(\s+topology)?$/i,
    run: async (_match, _addMsg, _addNode) => {
      const { nodes, edges } = await generateInfraTopology();
      const store = useCanvasStore.getState();
      store.clearCanvas();
      useCanvasStore.setState({ nodes, edges });
      return `Infrastructure topology loaded: ${nodes.length} nodes showing subdomain architecture`;
    },
  },
  {
    pattern: /^(view|vis)\s+showcase$/i,
    run: async (_match, addMsg, _addNode) => {
      addMsg('Loading showcase: tools → intelligence → competitors → KOMBIT...');
      const { nodes, edges } = await generateShowcaseView();
      useCanvasStore.getState().clearCanvas();
      useCanvasStore.setState({ nodes, edges });
      return `Showcase loaded: ${nodes.length} nodes, ${edges.length} edges — full CI pipeline story`;
    },
  },
  {
    pattern: /^hypothesis:\s*(.+)$/is,
    run: async (match, addMsg, addNode) => {
      const text = match[1]?.trim() ?? '';
      const parts = text.split('|').map((s) => s.trim());
      const topic = parts[0] ?? text;
      const reason = parts[1] ?? 'Identified as knowledge gap during canvas session';
      const priority = (parts[2] as 'low' | 'medium' | 'high') ?? 'medium';

      addMsg(`Creating Ghost Node: "${topic}"...`);
      const result = await mcpCall<{ success: boolean; ghost_id?: string; uncertainty_tier?: string; error?: string }>(
        'aura.hypothesis',
        { topic, reason, priority, requested_by: 'canvas-user' },
      );

      if (!result?.success) return `Hypothesis failed: ${result?.error ?? 'unknown'}`;

      addNode('insight', topic, `Ghost [${result.uncertainty_tier}]`);
      return `Ghost Node created: ${result.ghost_id}\nTier: ${result.uncertainty_tier}\nPriority: ${priority}\nStatus: pending (72h TTL)`;
    },
  },
  {
    pattern: /^fulfill:\s*(.+)$/is,
    run: async (match, addMsg, addNode) => {
      const text = match[1]?.trim() ?? '';
      const parts = text.split('|').map((s) => s.trim());
      const ghostId = parts[0] ?? '';
      const evidence = parts[1] ?? '';
      const source = parts[2] ?? 'canvas-manual';
      const confidence = parseFloat(parts[3] ?? '0.8');

      if (!ghostId || !evidence) return 'Usage: fulfill: ghost-id | evidence text | source | confidence';

      addMsg(`Fulfilling Ghost Node ${ghostId}...`);
      const result = await mcpCall<{ success: boolean; error?: string; ghost_id?: string }>(
        'aura.ghost_fulfill',
        { ghost_id: ghostId, evidence, source, confidence, harvested_by: 'canvas-user' },
      );

      if (!result?.success) return `Fulfillment failed: ${result?.error ?? 'unknown'}`;

      // Add evidence node and auto-link to ghost insight node
      const store = useCanvasStore.getState();
      const ghostNode = store.nodes.find((n) => String(n.data.label ?? '').includes(ghostId.slice(-8)) || String(n.data.subtitle ?? '').includes('Ghost'));
      addNode('evidence', evidence.slice(0, 60), `Source: ${source} (${confidence})`);

      // Auto-create edge if ghost node found on canvas
      if (ghostNode) {
        const newNodes = useCanvasStore.getState().nodes;
        const evidenceNode = newNodes[newNodes.length - 1];
        if (evidenceNode) {
          const edges = useCanvasStore.getState().edges;
          useCanvasStore.setState({
            edges: [...edges, {
              id: `edge-fulfill-${Date.now()}`,
              source: ghostNode.id,
              target: evidenceNode.id,
              label: 'fulfilled_by',
            }],
          });
        }
      }

      return `Ghost ${ghostId} fulfilled!\nEvidence: "${evidence.slice(0, 80)}"\nSource: ${source}\nConfidence: ${confidence}`;
    },
  },
];

export function AIPanel() {
  const { aiPanelOpen, toggleAiPanel, addNodesFromGraph, addNode } = useCanvasStore();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Commands:\n\nViews:\n- "view showcase" — full CI pipeline story\n- "view pipeline" — tool repurposing flow\n- "view market map" — competitor landscape\n- "view tech landscape" — shared SaaS\n- "view infra topology" — subdomain arch\n\nCI Pipeline:\n- "run ci pipeline Deloitte"\n- "run full enrichment" (all 10)\n\nNeo Aura:\n- "hypothesis: topic | reason | priority"\n- "fulfill: ghost-id | evidence | source | conf"\n- "show ghosts" — list active Ghost Nodes\n- "ghost metrics" — entropy + fulfillment\n\nGraph:\n- "show all agents/tools/servers"\n- "show all competitors/entities/endpoints"\n- "cypher: MATCH (n) RETURN n"\n\nNode types: server, endpoint, tool, pipeline, agent, entity, insight, evidence' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!aiPanelOpen) return null;

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    try {
      let handled = false;

      // Check pipeline commands first
      for (const cmd of PIPELINE_COMMANDS) {
        const match = text.match(cmd.pattern);
        if (match) {
          const addMsg = (msg: string) => setMessages((prev) => [...prev, { role: 'assistant', content: msg }]);
          const result = await cmd.run(match, addMsg, addNode);
          setMessages((prev) => [...prev, { role: 'assistant', content: result }]);
          handled = true;
          break;
        }
      }

      // Then check graph query commands
      if (!handled) {
        for (const cmd of COMMAND_MAP) {
          const match = text.match(cmd.pattern);
          if (match) {
            const result = await cmd.handler(match);
            if (result.records && (result.records as unknown[]).length > 0) {
              addNodesFromGraph(result.records as unknown[], result.nodeType, result.labelField);
            }
            setMessages((prev) => [...prev, { role: 'assistant', content: result.message }]);
            handled = true;
            break;
          }
        }
      }

      if (!handled) {
        // Fallback: try kg_rag.query
        try {
          const result = await mcpCall<{ result?: string }>('kg_rag.query', { question: text, max_evidence: 10 });
          const answer = typeof result === 'string' ? result : (result?.result ?? JSON.stringify(result));
          setMessages((prev) => [...prev, { role: 'assistant', content: String(answer).slice(0, 1000) }]);
        } catch {
          setMessages((prev) => [...prev, {
            role: 'assistant',
            content: 'Command not recognized. Try:\n- "show all agents/services/tools/domains/tenders"\n- "show [type] for [name]"\n- "cypher: [query]"',
          }]);
        }
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err instanceof Error ? err.message : String(err)}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-[380px] h-full border-l border-neural-border bg-neural-surface flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neural-border">
        <h3 className="text-sm font-semibold text-gray-100">AI Canvas Assistant</h3>
        <button onClick={toggleAiPanel} className="p-1 rounded hover:bg-neural-border text-gray-400">
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`text-sm whitespace-pre-wrap rounded-lg px-3 py-2 ${
              msg.role === 'user'
                ? 'bg-tdc-500/20 text-tdc-200 ml-8'
                : 'bg-neural-panel text-gray-300 mr-8'
            }`}
          >
            {msg.content}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 size={14} className="animate-spin" /> Querying...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-neural-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="show all agents..."
            className="flex-1 px-3 py-2 rounded-lg bg-neural-panel border border-neural-border text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-tdc-500"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="p-2 rounded-lg bg-tdc-500 hover:bg-tdc-600 text-white disabled:opacity-50 transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
