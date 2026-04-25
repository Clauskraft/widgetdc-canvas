import type { CanvasNodeInputType, CanvasNodeType } from '../types/canvas';

export interface CanvasTemplate {
  id: string;
  name: string;
  description: string;
  queries: Array<{ cypher: string; nodeType: CanvasNodeInputType; labelField: string }>;
  autoAnalyze: boolean;
  layoutMode: 'freeform' | 'mindmap';
  columns?: string[];  // Engagement canvas column names
}

export const CANVAS_TEMPLATES: CanvasTemplate[] = [
  {
    id: 'competitive-due-diligence',
    name: 'Competitive Due Diligence',
    description: 'All competitors + capabilities + tech stack. Auto-scores and ranks.',
    queries: [
      { cypher: "MATCH (c:Competitor) RETURN c.name AS name, c.id AS id, c.description AS description LIMIT 30", nodeType: 'entity', labelField: 'name' },
      { cypher: "MATCH (c:Competitor)-[:HAS_CAPABILITY]->(cap) RETURN DISTINCT cap.name AS name, cap.id AS id, cap.description AS description LIMIT 40", nodeType: 'evidence', labelField: 'name' },
      { cypher: "MATCH (c:Competitor)-[:USES_TECH]->(t:TechStackEntry) RETURN DISTINCT t.name AS name, t.id AS id, t.category AS description LIMIT 40", nodeType: 'tool', labelField: 'name' },
    ],
    autoAnalyze: true,
    layoutMode: 'mindmap',
  },
  {
    id: 'regulatory-assessment',
    name: 'Regulatory Assessment',
    description: 'ComplianceGaps + RiskAssessments. Severity-ranked with remediation.',
    queries: [
      { cypher: "MATCH (g:ComplianceGap) RETURN g.title AS title, g.id AS id, g.description AS description, g.severity AS severity LIMIT 20", nodeType: 'insight', labelField: 'title' },
      { cypher: "MATCH (r:RiskAssessment) WHERE r.severity IN ['CRITICAL','WARNING'] RETURN r.description AS description, r.id AS id, r.severity AS severity LIMIT 20", nodeType: 'evidence', labelField: 'description' },
    ],
    autoAnalyze: false,
    layoutMode: 'freeform',
  },
  {
    id: 'tender-response',
    name: 'Tender Response',
    description: 'TenderRequirements + matched capabilities. War room ready.',
    queries: [
      { cypher: "MATCH (t:TenderRequirement) WHERE t.confidence > 0.6 RETURN t.text AS text, t.id AS id, t.confidence AS confidence ORDER BY t.confidence DESC LIMIT 30", nodeType: 'evidence', labelField: 'text' },
    ],
    autoAnalyze: true,
    layoutMode: 'freeform',
  },
  {
    id: 'digital-transformation',
    name: 'Digital Transformation',
    description: 'Tech landscape + maturity model. Current vs target state.',
    queries: [
      { cypher: "MATCH (t:TechStackEntry)<-[:USES_TECH]-(c:Competitor) WITH t, count(c) AS users RETURN t.name AS name, t.id AS id, t.category AS description, users ORDER BY users DESC LIMIT 25", nodeType: 'tool', labelField: 'name' },
      { cypher: "MATCH (cap:CompetitorCapability)<-[:HAS_CAPABILITY]-(c:Competitor) WITH cap, count(c) AS adopters RETURN cap.name AS name, cap.id AS id, cap.description AS description, adopters ORDER BY adopters DESC LIMIT 25", nodeType: 'evidence', labelField: 'name' },
    ],
    autoAnalyze: false,
    layoutMode: 'mindmap',
  },
  {
    id: 'h10-strategic-north-star',
    name: 'H10 Strategic North Star',
    description: '10-year vision breakdown: North Star → Pillars → H5 → H3 → H1 → 90-Day Action Plan.',
    queries: [
      { cypher: "MATCH (n:StrategicGoal) RETURN n.name AS name, n.id AS id, n.description AS description, n.horizon AS horizon LIMIT 5", nodeType: 'entity', labelField: 'name' },
      { cypher: "MATCH (p:StrategicPillar) RETURN p.name AS name, p.id AS id, p.description AS description LIMIT 10", nodeType: 'insight', labelField: 'name' },
    ],
    autoAnalyze: false,
    layoutMode: 'freeform',
    columns: ['VISION', 'PILLARS', 'MARKET', 'GAPS', 'H5_MIDPOINT', 'H3_MOMENTUM', 'H1_LAUNCH', 'RISKS', 'FINANCE', 'ACTION_PLAN'],
  },
  {
    id: 'governance-spine',
    name: 'Governance Spine',
    description: 'Real WidgeTDC governance state from AuraDB: claims, gates, packs, patterns, artifacts, services, affordances. The default substrate.',
    queries: [
      // Claims that have moved beyond L0 — anchor of the spine
      { cypher: "MATCH (c:Claim) WHERE c.current_level IN ['L1','L2','L3','L4','L5'] RETURN c.id AS id, coalesce(c.title, c.id) AS name, c.text AS description, c.current_level AS severity ORDER BY c.current_level DESC, c.id LIMIT 30", nodeType: 'Claim', labelField: 'name' },
      // ProductionGates that validate claims
      { cypher: "MATCH (g:ProductionGate) RETURN g.id AS id, coalesce(g.title, g.id) AS name, coalesce(g.scope, g.pass_threshold) AS description LIMIT 20", nodeType: 'GuardrailRule', labelField: 'name' },
      // KnowledgePacks (curated pattern libraries)
      { cypher: "MATCH (k:KnowledgePack) WHERE k.id <> 'kp:claims-registry' RETURN k.id AS id, coalesce(k.name, k.id) AS name, k.summary AS description ORDER BY k.created_at DESC LIMIT 15", nodeType: 'Insight', labelField: 'name' },
      // KnowledgePatterns (technique-level abstractions)
      { cypher: "MATCH (k:KnowledgePattern) WHERE k.id IS NOT NULL RETURN k.id AS id, k.name AS name, k.summary AS description, k.evidence_strength AS confidence ORDER BY k.evidence_strength DESC, k.created_at DESC LIMIT 30", nodeType: 'KnowledgePattern', labelField: 'name' },
      // WorkArtifacts (cryptographically-signed evidence)
      { cypher: "MATCH (w:WorkArtifact) RETURN w.id AS id, coalesce(w.title, w.kind, w.id) AS name, coalesce(w.signature_domain, w.kind) AS description LIMIT 20", nodeType: 'Artifact', labelField: 'name' },
      // ProductionServices (deployed services)
      { cypher: "MATCH (s:ProductionService) RETURN s.id AS id, coalesce(s.name, s.id) AS name, coalesce(s.url, s.description) AS description LIMIT 15", nodeType: 'Tool', labelField: 'name' },
      // CanvasAffordances (the surfaces the canvas exposes)
      { cypher: "MATCH (a:CanvasAffordance) RETURN a.id AS id, coalesce(a.name, a.id) AS name, coalesce(a.role, a.spec_id) AS description LIMIT 15", nodeType: 'Track', labelField: 'name' },
      // R5: PMM_Template — 219 EG PMM project-method templates ingested via pmm_import (data_ingest review 2026-04-25)
      // Property shape: name (canonical), source, language, filename, format. No `id` field — use `name` as id.
      { cypher: "MATCH (p:PMM_Template) RETURN coalesce(p.id, 'pmm:' + p.name) AS id, p.name AS name, coalesce(p.format, p.language, p.source) AS description LIMIT 25", nodeType: 'Insight', labelField: 'name' },
      // R5: ConsultingFramework — 89 frameworks from vidensarkiv seed + s2_extract harvests
      { cypher: "MATCH (f:ConsultingFramework) RETURN coalesce(f.id, 'cf:' + coalesce(f.name, '')) AS id, coalesce(f.name, f.title, f.id) AS name, coalesce(f.description, f.summary) AS description LIMIT 20", nodeType: 'Insight', labelField: 'name' },
      // R5: ConsultingDomain — 17 canonical taxonomy domains (STR/OPS/FIN/CYB/TEC/RCM/PE/PPL/MKT/CROSS/ESG + 6)
      { cypher: "MATCH (d:ConsultingDomain) RETURN coalesce(d.id, 'cd:' + coalesce(d.name, '')) AS id, coalesce(d.name, d.id) AS name, coalesce(d.description, d.summary) AS description LIMIT 17", nodeType: 'Track', labelField: 'name' },
    ],
    autoAnalyze: false,
    layoutMode: 'mindmap',
  },
];

// Column mapping for engagement canvas layout
export const ENGAGEMENT_COLUMNS: Record<string, { nodeTypes: CanvasNodeType[]; x: number; color: string }> = {
  'VISION':          { nodeTypes: ['Entity'],                         x: 0,    color: '#f4bb00' },
  'PILLARS':         { nodeTypes: ['Insight'],                        x: 280,  color: '#22c55e' },
  'MARKET':          { nodeTypes: ['Entity'],                         x: 560,  color: '#3b82f6' },
  'GAPS':            { nodeTypes: ['Claim', 'ComplianceGap'],         x: 840,  color: '#f97316' },
  'H5_MIDPOINT':     { nodeTypes: ['Claim', 'StrategicLeverage'],     x: 1120, color: '#8b5cf6' },
  'H3_MOMENTUM':     { nodeTypes: ['Claim', 'Track'],                 x: 1400, color: '#a855f7' },
  'H1_LAUNCH':       { nodeTypes: ['Claim', 'Decision'],              x: 1680, color: '#ec4899' },
  'RISKS':           { nodeTypes: ['Insight', 'ComplianceGap'],       x: 1960, color: '#ef4444' },
  'FINANCE':         { nodeTypes: ['Evidence'],                       x: 2240, color: '#14b8a6' },
  'ACTION_PLAN':     { nodeTypes: ['Artifact', 'Decision'],           x: 2520, color: '#06b6d4' },
  'BRIEF':           { nodeTypes: ['Entity', 'CodeImplementation'],   x: 0,    color: '#64748b' },
  'HYPOTHESES':      { nodeTypes: ['Claim'],                          x: 280,  color: '#8b5cf6' },
  'EVIDENCE':        { nodeTypes: ['Evidence'],                       x: 560,  color: '#f97316' },
  'ANALYSIS':        { nodeTypes: ['Insight', 'StrategicInsight'],    x: 840,  color: '#22c55e' },
  'RECOMMENDATIONS': { nodeTypes: ['StrategicLeverage', 'Decision'],  x: 1120, color: '#0047bb' },
  'DELIVERABLES':    { nodeTypes: ['Artifact'],                       x: 1400, color: '#ec4899' },
};
