import { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, ChevronDown, ChevronRight, ArrowDownToLine, BrainCircuit } from 'lucide-react';
import { useCanvasStore } from '../store/canvasStore';
import { graphRead, graphTextSearch, mcpCall, isComplianceQuery } from '../lib/api';
import { ragQuery, type SuggestedAction } from '../lib/rag';
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
  // Canvas 5X: Text search
  {
    pattern: /^search:\s*(.+)$/i,
    handler: async (match) => {
      const text = match[1]?.trim() ?? '';
      const records = await graphTextSearch(text, 30);
      return { records, nodeType: 'entity' as CanvasNodeType, labelField: 'name', message: `Search "${text}": ${(records as unknown[]).length} results` };
    },
  },
  // Canvas 5X: Expand command
  {
    pattern: /^expand:\s*(.+)$/i,
    handler: async (match) => {
      const nodeName = match[1]?.trim() ?? '';
      const store = useCanvasStore.getState();
      const target = store.nodes.find(n => (n.data.label as string)?.toLowerCase().includes(nodeName.toLowerCase()));
      if (target) {
        await store.expandNode(target.id);
        return { records: [], nodeType: 'entity' as CanvasNodeType, labelField: 'name', message: `Expanded graph around "${target.data.label}"` };
      }
      return { records: [], nodeType: 'entity' as CanvasNodeType, labelField: 'name', message: `Node "${nodeName}" not found on canvas. Add it first.` };
    },
  },
  // Canvas 5X: Show provenance
  {
    pattern: /^(show\s+)?provenance$/i,
    handler: async () => {
      const store = useCanvasStore.getState();
      const sel = store.nodes.find(n => n.id === store.selectedNodeId);
      if (!sel) return { records: [], nodeType: 'entity' as CanvasNodeType, labelField: 'name', message: 'Select a node first to view provenance.' };
      const prov = sel.data.provenance as Record<string, unknown> | undefined;
      if (!prov) return { records: [], nodeType: 'entity' as CanvasNodeType, labelField: 'name', message: `"${sel.data.label}" has no provenance data.` };
      const msg = `Provenance for "${sel.data.label}":\n  Created by: ${prov.createdBy}\n  At: ${prov.createdAt}\n  Source: ${prov.source}\n  Confidence: ${prov.confidence ?? 'N/A'}\n  Parent: ${prov.parentNodeId ?? 'none'}`;
      return { records: [], nodeType: 'entity' as CanvasNodeType, labelField: 'name', message: msg };
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
  // Canvas 5X: Create query node
  {
    pattern: /^query:\s*(.+)$/is,
    run: async (match, addMsg, _addNode) => {
      const queryText = match[1]?.trim() ?? '';
      const store = useCanvasStore.getState();
      const isJson = queryText.startsWith('{');
      store.addNodeWithData('query', {
        label: isJson ? 'MCP Query' : 'Cypher Query',
        nodeType: 'query',
        queryType: isJson ? 'mcp' : 'cypher',
        queryText,
        queryStatus: 'idle',
      });
      addMsg('Query node created. Double-click to execute.');
      return `Query node added to canvas:\n${queryText.slice(0, 200)}`;
    },
  },
  // Canvas 5X: Generate artifact
  {
    pattern: /^generate:\s*(.+)$/is,
    run: async (match, addMsg, _addNode) => {
      const content = match[1]?.trim() ?? '';
      const store = useCanvasStore.getState();
      const isMermaid = content.startsWith('graph ') || content.startsWith('flowchart ') || content.startsWith('sequenceDiagram');
      const artType = isMermaid ? 'mermaid' : 'markdown';
      store.addNodeWithData('artifact', {
        label: `Artifact: ${content.slice(0, 30)}`,
        nodeType: 'artifact',
        artifactType: artType,
        artifactSource: content,
        provenance: {
          createdBy: 'ai',
          createdAt: new Date().toISOString(),
          source: 'ai-panel',
        },
      });
      addMsg(`${artType} artifact created.`);
      return `Artifact node (${artType}) added to canvas`;
    },
  },
  // Canvas 5X: Reasoning commands
  {
    pattern: /^(reason|think|analyse|analyze):\s*(.+)$/is,
    run: async (match, addMsg) => {
      const query = match[2]?.trim() ?? '';
      const isCompliance = isComplianceQuery(query);
      addMsg(isCompliance ? 'Routing to Semantic Arbitrage (compliance detected)...' : 'Reasoning...');
      try {
        const store = useCanvasStore.getState();
        const result = await store.reason(query);
        // Create thought node on canvas
        store.addNodeWithData('thought', {
          label: query.slice(0, 50) + (query.length > 50 ? '...' : ''),
          subtitle: isCompliance ? 'Compliance Reasoning' : 'AI Reasoning',
          nodeType: 'thought',
          thinkingSteps: result.thinking_steps,
          reasoningStatus: 'complete',
          provenance: {
            createdBy: 'ai',
            createdAt: new Date().toISOString(),
            source: '/reason',
            confidence: result.confidence,
          },
        });
        // Return message with thinking steps info
        const answer = result.recommendation;
        const stepsInfo = result.thinking_steps?.length
          ? `\n\n[${result.thinking_steps.length} thinking steps — expand thought node on canvas]`
          : '';
        const conf = result.confidence !== undefined ? `\nConfidence: ${(result.confidence * 100).toFixed(0)}%` : '';
        return answer + stepsInfo + conf;
      } catch (err) {
        return `Reasoning failed: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  },
  // Canvas 5X: Tender matching (G3)
  {
    pattern: /^tenders?:\s*(.+)$/is,
    run: async (match, addMsg) => {
      const capability = match[1]?.trim() ?? '';
      addMsg(`Matching tenders for "${capability}"...`);
      try {
        const result = await mcpCall<{
          success: boolean;
          matches?: Array<{ tender_id: string; text: string; category: string; confidence: number; score: number }>;
        }>('nexus.tender_match', { capability, limit: 10 });

        if (!result?.success || !result.matches?.length) {
          return `No tender matches found for "${capability}".`;
        }

        const store = useCanvasStore.getState();
        for (const match of result.matches) {
          store.addNodeWithData('evidence', {
            label: match.text?.slice(0, 60) + ((match.text?.length ?? 0) > 60 ? '...' : ''),
            subtitle: `${match.category ?? 'Tender'} (${((match.score ?? 0) * 100).toFixed(0)}%)`,
            nodeType: 'evidence',
            complianceScore: match.confidence ?? 0.5,
            signalIntensity: (match.score ?? 0) > 0.8 ? 0.85 : 0.5,
            provenance: {
              createdBy: 'tool',
              createdAt: new Date().toISOString(),
              source: 'nexus.tender_match',
              tool: 'nexus.tender_match',
            },
          });
        }

        return `Found ${result.matches.length} tender matches for "${capability}":\n` +
          result.matches.map((m, i) => `  ${i + 1}. ${m.text?.slice(0, 50)} — ${m.category} (${((m.score ?? 0) * 100).toFixed(0)}%)`).join('\n');
      } catch (err) {
        return `Tender match failed: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  },
  // Canvas 5X: Undo/Redo
  {
    pattern: /^undo$/i,
    run: async () => {
      useCanvasStore.getState().undo();
      return 'Undo applied.';
    },
  },
  {
    pattern: /^redo$/i,
    run: async () => {
      useCanvasStore.getState().redo();
      return 'Redo applied.';
    },
  },
  // S21-S25: Cross-Reference
  {
    pattern: /^cross[- ]?reference:\s*(.+)$/i,
    run: async (match, addMsg) => {
      const nodeName = match[1]?.trim() ?? '';
      const store = useCanvasStore.getState();
      const target = store.nodes.find(n => (n.data.label as string)?.toLowerCase().includes(nodeName.toLowerCase()));
      if (!target) return `Node "${nodeName}" not found on canvas.`;
      addMsg(`Cross-referencing "${target.data.label}"...`);
      await store.crossReference(target.id);
      return `Cross-reference complete for "${target.data.label}". Check new edges and nodes on canvas.`;
    },
  },
  // S21-S25: Audit Trail
  {
    pattern: /^audit\s+trail(\s+(json|markdown))?$/i,
    run: async (match, addMsg) => {
      const format = (match[2]?.trim().toLowerCase() ?? 'json') as 'json' | 'markdown';
      addMsg(`Exporting audit trail as ${format}...`);
      const result = await useCanvasStore.getState().exportAuditTrail(format);
      return `Audit trail exported (${format}, ${result.length} chars). Content copied to clipboard if available.`;
    },
  },
  // S21-S25: Analysis Pipeline
  {
    pattern: /^pipeline:\s*(.+)$/i,
    run: async (match, addMsg) => {
      const text = match[1]?.trim() ?? '';
      const parts = text.split('|').map(s => s.trim());
      const entityName = parts[0] ?? text;
      const templateId = parts[1];
      addMsg(`Running analysis pipeline for "${entityName}"${templateId ? ` with template "${templateId}"` : ''}...`);
      const result = await useCanvasStore.getState().runAnalysisPipeline(entityName, templateId);
      return `Pipeline complete for "${entityName}": ${result.nodeCount} nodes created.\n${result.narrative.slice(0, 300)}`;
    },
  },
  // S21-S25: Replay Engagement
  {
    pattern: /^replay:\s*(.+)$/i,
    run: async (match, addMsg) => {
      const engagementId = match[1]?.trim() ?? '';
      addMsg(`Replaying engagement "${engagementId}"...`);
      await useCanvasStore.getState().replayEngagement(engagementId);
      return `Engagement "${engagementId}" replayed on canvas. All historical nodes and edges restored.`;
    },
  },
  // Strategic: Auto-Analyze
  {
    pattern: /^auto[- ]?analy[sz]e$/i,
    run: async (_match, addMsg) => {
      const store = useCanvasStore.getState();
      if (!store.selectedNodeId) return 'Select a node first, then run auto-analyze.';
      const node = store.nodes.find(n => n.id === store.selectedNodeId);
      addMsg(`Auto-analyzing "${node?.data.label}"... (expand + tenders + reasoning in parallel)`);
      await store.autoAnalyze(store.selectedNodeId);
      return `Auto-analysis complete for "${node?.data.label}". Check the new nodes on canvas.`;
    },
  },
  // Strategic: Narrative
  {
    pattern: /^(generate\s+)?narrative$/i,
    run: async (_match, addMsg) => {
      addMsg('Generating structured narrative report from canvas...');
      const result = await useCanvasStore.getState().generateNarrative();
      return result ? `Narrative generated (${result.length} chars). See artifact node on canvas.` : 'Narrative generation returned empty.';
    },
  },
  // Strategic: Discover Patterns
  {
    pattern: /^(discover\s+)?patterns$/i,
    run: async (_match, addMsg) => {
      addMsg('Discovering cross-engagement patterns from strategic insights...');
      await useCanvasStore.getState().discoverPatterns();
      return 'Pattern discovery complete. Check insight + thought nodes on canvas.';
    },
  },
  // Strategic: Evaluate Hypothesis
  {
    pattern: /^eval(uate)?\s+hypo(thesis)?$/i,
    run: async (_match, addMsg) => {
      const store = useCanvasStore.getState();
      if (!store.selectedNodeId) return 'Select a thought/hypothesis node first.';
      const node = store.nodes.find(n => n.id === store.selectedNodeId);
      if (node?.type !== 'thought') return `Selected node "${node?.data.label}" is not a thought/hypothesis. Select a thought node.`;
      addMsg(`Evaluating hypothesis: "${node.data.label}" against connected evidence...`);
      await store.evaluateHypothesis(store.selectedNodeId);
      return `Hypothesis evaluated. Check the updated score and edge colors on canvas.`;
    },
  },
  // Strategic: Load Template
  {
    pattern: /^template:\s*(.+)$/i,
    run: async (match, addMsg) => {
      const templateName = match[1]?.trim().toLowerCase() ?? '';
      const { CANVAS_TEMPLATES } = await import('../templates');
      const tmpl = CANVAS_TEMPLATES.find(t =>
        t.id.includes(templateName) || t.name.toLowerCase().includes(templateName)
      );
      if (!tmpl) {
        return `Template "${templateName}" not found. Available:\n${CANVAS_TEMPLATES.map(t => `  - ${t.id}: ${t.name}`).join('\n')}`;
      }
      addMsg(`Loading template: ${tmpl.name}...`);
      await useCanvasStore.getState().loadTemplate(tmpl.id);
      return `Template "${tmpl.name}" loaded.`;
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

function MessageBubble({ msg, onInject, onRunCommand }: { msg: Message; onInject: (text: string, type?: CanvasNodeType) => string; onRunCommand?: (cmd: string) => void }) {
  const [showThinking, setShowThinking] = useState(false);
  const hasThinking = msg.thinkingSteps && msg.thinkingSteps.length > 0;

  return (
    <div
      className={`text-sm whitespace-pre-wrap rounded-lg px-3 py-2 ${
        msg.role === 'user'
          ? 'bg-tdc-500/20 text-tdc-200 ml-8'
          : 'bg-neural-panel text-gray-300 mr-8'
      }`}
    >
      {msg.content}
      {/* Thinking chain toggle */}
      {hasThinking && (
        <div className="mt-2 border-t border-neural-border/50 pt-1.5">
          <button
            onClick={() => setShowThinking(!showThinking)}
            className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300"
          >
            <BrainCircuit size={11} />
            {showThinking ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            {msg.thinkingSteps!.length} thinking steps
          </button>
          {showThinking && (
            <div className="mt-1.5 border-l-2 border-purple-500/30 pl-2 space-y-1 max-h-[120px] overflow-y-auto">
              {msg.thinkingSteps!.map((step, j) => (
                <div key={j} className="flex items-start gap-1">
                  <span className="text-[10px] text-purple-500 mt-0.5 shrink-0">{j + 1}.</span>
                  <span className="text-[11px] text-gray-400">{step}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Inject into Canvas button */}
      {msg.injectable && msg.role === 'assistant' && msg.content.length > 20 && (
        <button
          onClick={() => onInject(msg.content, 'insight')}
          className="mt-2 flex items-center gap-1 text-[11px] text-tdc-400 hover:text-tdc-300 transition-colors"
        >
          <ArrowDownToLine size={11} /> Inject into Canvas
        </button>
      )}
      {/* Suggested actions from RAG */}
      {msg.suggestedActions && msg.suggestedActions.length > 0 && onRunCommand && (
        <div className="mt-2 border-t border-neural-border/50 pt-2 space-y-1">
          <div className="text-[10px] text-gray-500 uppercase">Suggested next steps</div>
          {msg.suggestedActions.map((action, i) => (
            <button
              key={i}
              onClick={() => onRunCommand(action.command)}
              className="block w-full text-left px-2 py-1 rounded text-[11px] text-tdc-300 hover:bg-tdc-500/20 transition-colors"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AIPanel() {
  const { aiPanelOpen, toggleAiPanel, addNodesFromGraph, addNode, reason, injectToCanvas } = useCanvasStore();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: `Consulting Canvas — just ask in plain language.

I understand your consulting workflow:
  1. Scope & Discover — "help me scope a cybersecurity engagement"
  2. Analyze & Assess — "run a DCF valuation for TechCo"
  3. Synthesize & Recommend — "generate a report from this canvas"
  4. Plan & Execute — "break this into tasks and milestones"
  5. Review & Iterate — "what changed since the last iteration?"

I know 74 frameworks (SWOT, DCF, BMC, PESTLE...), 30 domains, 38 processes, and 390 past engagements from the knowledge graph.

Power commands:
  search: keyword — find in graph
  template: name — load canvas template
  reason: question — deep AI reasoning
  cypher: MATCH... — raw graph query
  auto-analyze — full pipeline on selected node

Shortcuts: Ctrl+K (commands), Ctrl+Z/Y (undo/redo), ? (this panel)` },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
        // RAG-powered consulting chat — enriched with graph context
        try {
          const store = useCanvasStore.getState();
          setMessages((prev) => [...prev, {
            role: 'assistant',
            content: isComplianceQuery(text) ? 'Routing via Semantic Arbitrage + consulting RAG...' : 'Consulting RAG: gathering context...',
            isReasoning: true,
          }]);

          const result = await ragQuery(
            text,
            store.nodes,
            store.edges,
            store.selectedNodeId,
          );

          // Remove the "gathering..." message, add the real response
          setMessages((prev) => {
            const filtered = prev.filter((m, idx) => idx !== prev.length - 1 || !m.isReasoning);
            return [...filtered, {
              role: 'assistant',
              content: result.answer,
              thinkingSteps: result.thinkingSteps,
              injectable: true,
              suggestedActions: result.suggestedActions,
            }];
          });
        } catch {
          // Fallback: raw /reason with no context
          try {
            const store = useCanvasStore.getState();
            const result = await store.reason(text);
            setMessages((prev) => {
              const filtered = prev.filter((m, idx) => idx !== prev.length - 1 || !m.isReasoning);
              return [...filtered, {
                role: 'assistant',
                content: result.recommendation || 'No recommendation generated.',
                thinkingSteps: result.thinking_steps,
                injectable: true,
              }];
            });
          } catch {
            setMessages((prev) => {
              const filtered = prev.filter((m, idx) => idx !== prev.length - 1 || !m.isReasoning);
              return [...filtered, {
                role: 'assistant',
                content: 'No results. Try:\n- "reason: your question" — AI reasoning\n- "show all agents/tools/servers"\n- "cypher: MATCH (n) RETURN n"',
              }];
            });
          }
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
          <MessageBubble key={i} msg={msg} onInject={injectToCanvas} onRunCommand={(cmd) => handleSend(cmd)} />
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
            onClick={() => handleSend()}
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
