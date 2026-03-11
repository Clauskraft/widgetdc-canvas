/**
 * CANVAS CI PERSPECTIVE — Visual Competitive Intelligence
 * ========================================================
 * Updated to use the 8-type node taxonomy:
 * INFRA:         server, endpoint
 * CAPABILITY:    tool
 * ORCHESTRATION: pipeline, agent
 * INTELLIGENCE:  entity, insight, evidence
 */

import type { Node, Edge } from '@xyflow/react';
import type { CanvasNodeData, CanvasNodeType } from '../components/nodes';
import { graphRead } from '../lib/api';
import { applyDagreLayout } from '../lib/layout';

// ─────────────────────────────────────────────────────────────
// LAYER 1: The Repurposing Model
// ─────────────────────────────────────────────────────────────

export interface ToolRepurposing {
  tool: string;
  traditionalUse: string;
  repurposedUse: string;
  outputNodeType: CanvasNodeType;
  outputLabel: string;
  cypher: string;
}

export const TOOL_REPURPOSING_MAP: ToolRepurposing[] = [
  {
    tool: 'harvest.intel.domain',
    traditionalUse: 'Recon af mål',
    repurposedUse: 'Map konkurrents tech stack (DNS→email, CDN, SaaS)',
    outputNodeType: 'evidence',
    outputLabel: 'TechStackEntry',
    cypher: 'MATCH (c:Competitor)-[:USES_TECH]->(t:TechStackEntry) RETURN c, t',
  },
  {
    tool: 'trident.scan.domain',
    traditionalUse: 'SSL-sårbarhedsscanning',
    repurposedUse: 'Discover cert-infrastruktur (subdomæner, services)',
    outputNodeType: 'evidence',
    outputLabel: 'MarketSignal (SSL)',
    cypher: "MATCH (c:Competitor)-[:EMITS]->(ms:MarketSignal) WHERE ms.type = 'SSL_CERT' RETURN c, ms",
  },
  {
    tool: 'trident.attack-surface',
    traditionalUse: 'Angrebsoverflade-mapping',
    repurposedUse: 'Teknologisk footprint (hosting, frameworks, CDNs)',
    outputNodeType: 'evidence',
    outputLabel: 'MarketSignal (Infra)',
    cypher: "MATCH (c:Competitor)-[:EMITS]->(ms:MarketSignal) WHERE ms.type = 'ATTACK_SURFACE' RETURN c, ms",
  },
  {
    tool: 'trident.dork.scan.org',
    traditionalUse: 'Lækket data-søgning',
    repurposedUse: 'Offentlige dokumenter (PDFs, rapporter, præsentationer)',
    outputNodeType: 'evidence',
    outputLabel: 'PublicDocument',
    cypher: 'MATCH (c:Competitor)-[:PUBLISHES]->(pd:PublicDocument) RETURN c, pd',
  },
  {
    tool: 'trident.cvr.lookup',
    traditionalUse: 'Firmaundersøgelse',
    repurposedUse: 'Ejerstruktur & board-mapping',
    outputNodeType: 'entity',
    outputLabel: 'CompanyRegistry',
    cypher: 'MATCH (c:Competitor) WHERE c.cvr IS NOT NULL RETURN c',
  },
  {
    tool: 'harvest.web.scrape',
    traditionalUse: 'Web-scraping (pentest)',
    repurposedUse: 'Capability claims fra konkurrenters hjemmesider',
    outputNodeType: 'evidence',
    outputLabel: 'CompetitorCapability',
    cypher: 'MATCH (c:Competitor)-[:HAS_CAPABILITY]->(cc:CompetitorCapability) RETURN c, cc',
  },
  {
    tool: 'intel.cvr_financials',
    traditionalUse: 'Financial exposure',
    repurposedUse: 'Finansiel sundhedsscore af konkurrenter',
    outputNodeType: 'evidence',
    outputLabel: 'FinancialSnapshot',
    cypher: 'MATCH (c:Competitor)-[:HAS_SNAPSHOT]->(fs:CompetitorSnapshot) RETURN c, fs',
  },
];

// ─────────────────────────────────────────────────────────────
// LAYER 2: Canvas Visualization Modes
// ─────────────────────────────────────────────────────────────

export type CanvasViewMode =
  | 'pipeline'
  | 'market-map'
  | 'tech-landscape'
  | 'infra-topology'
  | 'capability-matrix';

/**
 * Generate the "Pipeline View" — shows the repurposing flow
 * [Tool] ──→ [Evidence] ──→ [Entity]
 */
export function generatePipelineView(): { nodes: Node<CanvasNodeData>[]; edges: Edge[] } {
  const nodes: Node<CanvasNodeData>[] = [];
  const edges: Edge[] = [];

  // Pipeline header
  nodes.push({
    id: 'center',
    type: 'pipeline',
    position: { x: 400, y: 0 },
    data: { label: 'CI Pipeline', subtitle: 'Pentest → Intelligence Repurposing', nodeType: 'pipeline' },
  });

  TOOL_REPURPOSING_MAP.forEach((tr, i) => {
    const toolId = `tool-${i}`;
    const outputId = `output-${i}`;

    nodes.push({
      id: toolId,
      type: 'tool',
      position: { x: 0, y: 120 * (i + 1) },
      data: { label: tr.tool, subtitle: tr.traditionalUse, nodeType: 'tool' },
    });

    nodes.push({
      id: outputId,
      type: tr.outputNodeType,
      position: { x: 600, y: 120 * (i + 1) },
      data: { label: tr.outputLabel, subtitle: tr.repurposedUse, nodeType: tr.outputNodeType },
    });

    edges.push({ id: `e-center-${toolId}`, source: 'center', target: toolId });
    edges.push({ id: `e-${toolId}-${outputId}`, source: toolId, target: outputId, animated: true });
  });

  return { nodes, edges };
}

/**
 * Generate the "Market Map" — competitors with their intelligence
 */
export async function generateMarketMap(): Promise<{ nodes: Node<CanvasNodeData>[]; edges: Edge[] }> {
  const nodes: Node<CanvasNodeData>[] = [];
  const edges: Edge[] = [];

  nodes.push({
    id: 'market',
    type: 'entity',
    position: { x: 0, y: 0 },
    data: { label: 'Danish Consulting Market', subtitle: '10 competitors profiled', nodeType: 'entity' },
  });

  const competitors = await graphRead(
    `MATCH (c:Competitor)
     WHERE c.domain IS NOT NULL
     OPTIONAL MATCH (c)-[:USES_TECH]->(t:TechStackEntry)
     OPTIONAL MATCH (c)-[:EMITS]->(ms:MarketSignal)
     RETURN c.name AS name, c.domain AS domain,
            count(DISTINCT t) AS techCount,
            count(DISTINCT ms) AS signalCount
     ORDER BY techCount DESC LIMIT 15`,
  ) as Record<string, unknown>[];

  competitors.forEach((comp, i) => {
    const id = `comp-${i}`;
    const techCount = ((comp?.techCount as Record<string, number>)?.low ?? comp?.techCount ?? 0);
    const signalCount = ((comp?.signalCount as Record<string, number>)?.low ?? comp?.signalCount ?? 0);

    nodes.push({
      id,
      type: 'entity',
      position: { x: 0, y: 0 },
      data: {
        label: String(comp?.name ?? 'Unknown'),
        subtitle: `${techCount} tech, ${signalCount} signals | ${comp?.domain ?? ''}`,
        nodeType: 'entity',
      },
    });

    edges.push({ id: `e-market-${id}`, source: 'market', target: id });
  });

  const laidOut = applyDagreLayout(nodes, edges, 'LR');
  return { nodes: laidOut, edges };
}

/**
 * Generate the "Tech Landscape" — shared technology across competitors
 */
export async function generateTechLandscape(): Promise<{ nodes: Node<CanvasNodeData>[]; edges: Edge[] }> {
  const nodes: Node<CanvasNodeData>[] = [];
  const edges: Edge[] = [];

  const techData = await graphRead(
    `MATCH (c:Competitor)-[:USES_TECH]->(t:TechStackEntry)
     RETURN t.name AS tech, collect(DISTINCT c.name) AS competitors, count(DISTINCT c) AS users
     ORDER BY users DESC LIMIT 20`,
  ) as Record<string, unknown>[];

  nodes.push({
    id: 'tech-center',
    type: 'pipeline',
    position: { x: 0, y: 0 },
    data: { label: 'Tech Landscape', subtitle: 'SaaS adoption across competitors', nodeType: 'pipeline' },
  });

  techData.forEach((td, i) => {
    const id = `tech-${i}`;
    const users = (td?.users as Record<string, number>)?.low ?? td?.users ?? 0;
    const competitors = (td?.competitors as string[]) ?? [];

    nodes.push({
      id,
      type: 'entity',
      position: { x: 0, y: 0 },
      data: {
        label: String(td?.tech ?? 'Unknown'),
        subtitle: `${users} competitors: ${competitors.slice(0, 3).join(', ')}${competitors.length > 3 ? '...' : ''}`,
        nodeType: 'entity',
      },
    });

    edges.push({ id: `e-tc-${id}`, source: 'tech-center', target: id });
  });

  const laidOut = applyDagreLayout(nodes, edges, 'TB');
  return { nodes: laidOut, edges };
}

/**
 * Generate the "Infrastructure Topology" — subdomains reveal architecture
 */
export async function generateInfraTopology(): Promise<{ nodes: Node<CanvasNodeData>[]; edges: Edge[] }> {
  const nodes: Node<CanvasNodeData>[] = [];
  const edges: Edge[] = [];

  const signals = await graphRead(
    `MATCH (c:Competitor)-[:EMITS]->(ms:MarketSignal)
     WHERE ms.type = 'ATTACK_SURFACE'
     RETURN c.name AS competitor, ms.totalSubdomains AS subs,
            ms.riskScore AS risk, ms.interestingSubdomains AS interesting
     ORDER BY ms.totalSubdomains DESC`,
  ) as Record<string, unknown>[];

  nodes.push({
    id: 'infra',
    type: 'pipeline',
    position: { x: 0, y: 0 },
    data: { label: 'Infrastructure Topology', subtitle: 'Subdomain analysis', nodeType: 'pipeline' },
  });

  signals.forEach((sig, i) => {
    const compId = `infra-comp-${i}`;
    const subs = (sig?.subs as Record<string, number>)?.low ?? sig?.subs ?? 0;
    const risk = (sig?.risk as Record<string, number>)?.low ?? sig?.risk ?? 0;
    const interesting = (sig?.interesting as string[]) ?? [];

    nodes.push({
      id: compId,
      type: 'entity',
      position: { x: 0, y: 0 },
      data: {
        label: String(sig?.competitor ?? 'Unknown'),
        subtitle: `${subs} subdomains, risk: ${risk}`,
        nodeType: 'entity',
      },
    });

    edges.push({ id: `e-infra-${compId}`, source: 'infra', target: compId });

    // Interesting subdomains as endpoint nodes
    interesting.slice(0, 5).forEach((sub, j) => {
      const subId = `${compId}-sub-${j}`;
      nodes.push({
        id: subId,
        type: 'endpoint',
        position: { x: 0, y: 0 },
        data: { label: sub, subtitle: 'Discovered subdomain', nodeType: 'endpoint' },
      });
      edges.push({ id: `e-${compId}-${subId}`, source: compId, target: subId });
    });
  });

  const laidOut = applyDagreLayout(nodes, edges, 'TB');
  return { nodes: laidOut, edges };
}
