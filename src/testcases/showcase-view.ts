/**
 * SHOWCASE VIEW — Auto-loads the full CI pipeline story
 * =====================================================
 * Uses the new 8-type node taxonomy (4 layers):
 * INFRA:         server, endpoint
 * CAPABILITY:    tool
 * ORCHESTRATION: pipeline, agent
 * INTELLIGENCE:  entity, insight, evidence
 *
 * Layout:
 * 1. Pipeline header + Agent (top)
 * 2. The 7 MCP tools (left column)
 * 3. Evidence outputs (center column)
 * 4. Entities from Neo4j — competitors (right column)
 * 5. Shared tech stack (far right)
 * 6. KOMBIT infrastructure (bottom) — server/endpoint nodes
 * 7. Insights (bottom)
 */

import type { Node, Edge } from '@xyflow/react';
import type { CanvasNodeData, CanvasNodeType } from '../types/canvas';
import { graphRead } from '../lib/api';

export async function generateShowcaseView(): Promise<{ nodes: Node<CanvasNodeData>[]; edges: Edge[] }> {
  const nodes: Node<CanvasNodeData>[] = [];
  const edges: Edge[] = [];

  // ═══ TOP: Pipeline + Agent ═══
  nodes.push({
    id: 'ci-pipeline',
    type: 'pipeline',
    position: { x: 300, y: -80 },
    data: { label: 'CI Intelligence Pipeline', subtitle: '5-step competitive enrichment workflow', nodeType: 'pipeline' },
  });

  nodes.push({
    id: 'ci-agent',
    type: 'agent',
    position: { x: 600, y: -80 },
    data: { label: 'omega-sentinel', subtitle: 'Autonomous pipeline runner', nodeType: 'agent' },
  });

  edges.push({ id: 'e-agent-pipeline', source: 'ci-agent', target: 'ci-pipeline' });

  // ═══ INFRA: Backend + Neo4j ═══
  nodes.push({
    id: 'infra-backend',
    type: 'server',
    position: { x: -200, y: -80 },
    data: { label: 'Backend Express', subtitle: '777 endpoints, 329 MCP tools', nodeType: 'server' },
  });

  nodes.push({
    id: 'infra-neo4j',
    type: 'server',
    position: { x: -200, y: 20 },
    data: { label: 'Neo4j AuraDB', subtitle: '201K+ nodes, 1.57M+ edges', nodeType: 'server' },
  });

  edges.push({ id: 'e-backend-neo4j', source: 'infra-backend', target: 'infra-neo4j' });

  // ═══ COLUMN 1: MCP Tools (x=0) ═══
  const tools = [
    { id: 'tool-domain', label: 'harvest.intel.domain', sub: 'DNS/MX/TXT recon' },
    { id: 'tool-cert', label: 'trident.scan.domain', sub: 'SSL cert scanning' },
    { id: 'tool-surface', label: 'trident.attack-surface', sub: 'Subdomain enumeration' },
    { id: 'tool-dork', label: 'trident.dork.scan.org', sub: 'Google dorking' },
    { id: 'tool-cvr', label: 'trident.cvr.lookup', sub: 'Company registry (CVR)' },
    { id: 'tool-scrape', label: 'harvest.web.scrape', sub: 'Web scraping' },
    { id: 'tool-fin', label: 'intel.cvr_financials', sub: 'Financial data' },
  ];

  tools.forEach((t, i) => {
    nodes.push({
      id: t.id,
      type: 'tool',
      position: { x: 0, y: 80 + i * 110 },
      data: { label: t.label, subtitle: t.sub, nodeType: 'tool' },
    });
    // Connect pipeline to each tool
    edges.push({ id: `e-pipe-${t.id}`, source: 'ci-pipeline', target: t.id });
    // Connect backend to tools
    edges.push({ id: `e-backend-${t.id}`, source: 'infra-backend', target: t.id, animated: false });
  });

  // ═══ COLUMN 2: Evidence Outputs (x=380) ═══
  const evidenceOutputs = [
    { id: 'ev-tech', label: 'Tech Stack', sub: 'SaaS tools per competitor', fromTool: 'tool-domain' },
    { id: 'ev-cert', label: 'Cert Intelligence', sub: 'SSL infrastructure data', fromTool: 'tool-cert' },
    { id: 'ev-infra', label: 'Infra Topology', sub: 'Subdomains & architecture', fromTool: 'tool-surface' },
    { id: 'ev-docs', label: 'Public Documents', sub: 'PDFs, reports, decks', fromTool: 'tool-dork' },
    { id: 'ev-owner', label: 'Ownership Data', sub: 'Board & corporate structure', fromTool: 'tool-cvr' },
    { id: 'ev-cap', label: 'Capabilities', sub: 'Service offerings scraped', fromTool: 'tool-scrape' },
    { id: 'ev-fin', label: 'Financial Reports', sub: 'Revenue & fiscal health', fromTool: 'tool-fin' },
  ];

  evidenceOutputs.forEach((o, i) => {
    nodes.push({
      id: o.id,
      type: 'evidence',
      position: { x: 380, y: 80 + i * 110 },
      data: { label: o.label, subtitle: o.sub, nodeType: 'evidence' },
    });
    edges.push({
      id: `e-${o.fromTool}-${o.id}`,
      source: o.fromTool,
      target: o.id,
      animated: true,
    });
  });

  // ═══ COLUMN 3: Entities from Neo4j (x=750) ═══
  try {
    const competitors = await graphRead(
      `MATCH (c:Competitor)
       OPTIONAL MATCH (c)-[:USES_TECH]->(t:TechStackEntry)
       WITH c, count(DISTINCT t) AS techCount
       WHERE techCount > 0
       RETURN c.name AS name, techCount
       ORDER BY techCount DESC LIMIT 10`,
    ) as Record<string, unknown>[];

    // Market header entity
    nodes.push({
      id: 'market-header',
      type: 'entity',
      position: { x: 780, y: 0 },
      data: { label: 'Danish Consulting Market', subtitle: `${competitors.length} firms profiled`, nodeType: 'entity' },
    });

    // Connect evidence to market
    edges.push({ id: 'e-tech-market', source: 'ev-tech', target: 'market-header' });
    edges.push({ id: 'e-cap-market', source: 'ev-cap', target: 'market-header' });

    competitors.forEach((comp, i) => {
      const tc = (comp?.techCount as Record<string, number>)?.low ?? comp?.techCount ?? 0;
      const compId = `comp-${i}`;
      nodes.push({
        id: compId,
        type: 'entity',
        position: { x: 750, y: 80 + i * 90 },
        data: {
          label: String(comp?.name ?? 'Unknown'),
          subtitle: `${tc} SaaS tools detected`,
          nodeType: 'entity',
        },
      });
      edges.push({ id: `e-market-${compId}`, source: 'market-header', target: compId });
    });

    // ═══ COLUMN 4: Shared tech — endpoints showing API discovery (x=1100) ═══
    const techData = await graphRead(
      `MATCH (c:Competitor)-[:USES_TECH]->(t:TechStackEntry)
       RETURN t.name AS tech, count(DISTINCT c) AS users
       ORDER BY users DESC LIMIT 8`,
    ) as Record<string, unknown>[];

    nodes.push({
      id: 'tech-header',
      type: 'evidence',
      position: { x: 1130, y: 0 },
      data: { label: 'Shared Tech Stack', subtitle: `${techData.length} SaaS tools detected`, nodeType: 'evidence' },
    });

    techData.forEach((td, i) => {
      const users = (td?.users as Record<string, number>)?.low ?? td?.users ?? 0;
      const techId = `shared-tech-${i}`;
      nodes.push({
        id: techId,
        type: 'entity',
        position: { x: 1080 + (i % 2) * 200, y: 80 + Math.floor(i / 2) * 90 },
        data: {
          label: String(td?.tech ?? 'Unknown'),
          subtitle: `${users}/10 competitors`,
          nodeType: 'entity',
        },
      });
      edges.push({ id: `e-th-${techId}`, source: 'tech-header', target: techId });
    });

    // Connect some competitors to shared tech
    if (competitors.length > 0 && techData.length > 0) {
      edges.push({ id: 'e-comp0-tech0', source: 'comp-0', target: 'shared-tech-0' });
      if (competitors.length > 2) edges.push({ id: 'e-comp2-tech1', source: 'comp-2', target: 'shared-tech-1' });
    }

  } catch (err) {
    nodes.push({
      id: 'no-data',
      type: 'insight',
      position: { x: 750, y: 300 },
      data: { label: 'No Neo4j data', subtitle: String(err), nodeType: 'insight' },
    });
  }

  // ═══ BOTTOM: KOMBIT Infrastructure Case Study (y=900) ═══
  nodes.push({
    id: 'kombit-pipeline',
    type: 'pipeline',
    position: { x: 380, y: 900 },
    data: { label: 'KOMBIT Case Study', subtitle: '15 subdomains, 6 admin portals discovered', nodeType: 'pipeline' },
  });

  edges.push({ id: 'e-infra-kombit', source: 'ev-infra', target: 'kombit-pipeline' });

  const kombitSubs = [
    { id: 'k-admin', label: 'admin.kombit.dk', sub: 'Main admin portal' },
    { id: 'k-cert', label: 'admin.kommunecert.kombit.dk', sub: 'Certificate system' },
    { id: 'k-gapi', label: 'gapi.admin.kombit.dk', sub: 'API Gateway' },
    { id: 'k-dok', label: 'admin.dok.kombit.dk', sub: 'Document admin' },
    { id: 'k-gapi-dok', label: 'gapi.admin.dok.kombit.dk', sub: 'Doc API Gateway' },
    { id: 'k-gapi-cert', label: 'gapi.admin.kommunecert.kombit.dk', sub: 'Cert API Gateway' },
  ];

  kombitSubs.forEach((ks, i) => {
    nodes.push({
      id: ks.id,
      type: 'endpoint',
      position: { x: 80 + (i % 3) * 300, y: 1010 + Math.floor(i / 3) * 100 },
      data: { label: ks.label, subtitle: ks.sub, nodeType: 'endpoint' },
    });
    edges.push({ id: `e-kombit-${ks.id}`, source: 'kombit-pipeline', target: ks.id });
  });

  // ═══ INSIGHT NODES ═══
  nodes.push({
    id: 'insight-1',
    type: 'insight',
    position: { x: 80, y: 1220 },
    data: {
      label: 'Integration Gaps',
      subtitle: 'Separate admin portals = integration consulting opportunity',
      nodeType: 'insight',
    },
  });
  edges.push({ id: 'e-k-dok-insight', source: 'k-dok', target: 'insight-1' });

  nodes.push({
    id: 'insight-2',
    type: 'insight',
    position: { x: 380, y: 1220 },
    data: {
      label: 'API-First Architecture',
      subtitle: 'gapi.* subdomains = API governance opportunity',
      nodeType: 'insight',
    },
  });
  edges.push({ id: 'e-k-gapi-insight', source: 'k-gapi', target: 'insight-2' });

  nodes.push({
    id: 'insight-3',
    type: 'insight',
    position: { x: 680, y: 1220 },
    data: {
      label: 'Security Posture',
      subtitle: 'Certificate management across 6 portals = audit target',
      nodeType: 'insight',
    },
  });
  edges.push({ id: 'e-k-cert-insight', source: 'k-cert', target: 'insight-3' });

  return { nodes, edges };
}
