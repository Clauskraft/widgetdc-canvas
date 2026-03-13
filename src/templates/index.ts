import type { CanvasNodeType } from '../types/canvas';

export interface CanvasTemplate {
  id: string;
  name: string;
  description: string;
  queries: Array<{ cypher: string; nodeType: CanvasNodeType; labelField: string }>;
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
      { cypher: "MATCH (c:Competitor) RETURN c LIMIT 30", nodeType: 'entity', labelField: 'name' },
      { cypher: "MATCH (c:Competitor)-[:HAS_CAPABILITY]->(cap) RETURN DISTINCT cap LIMIT 40", nodeType: 'evidence', labelField: 'name' },
      { cypher: "MATCH (c:Competitor)-[:USES_TECH]->(t:TechStackEntry) RETURN DISTINCT t LIMIT 40", nodeType: 'tool', labelField: 'name' },
    ],
    autoAnalyze: true,
    layoutMode: 'mindmap',
  },
  {
    id: 'regulatory-assessment',
    name: 'Regulatory Assessment',
    description: 'ComplianceGaps + RiskAssessments. Severity-ranked with remediation.',
    queries: [
      { cypher: "MATCH (g:ComplianceGap) RETURN g LIMIT 20", nodeType: 'insight', labelField: 'title' },
      { cypher: "MATCH (r:RiskAssessment) WHERE r.severity IN ['CRITICAL','WARNING'] RETURN r LIMIT 20", nodeType: 'evidence', labelField: 'description' },
    ],
    autoAnalyze: false,
    layoutMode: 'freeform',
  },
  {
    id: 'tender-response',
    name: 'Tender Response',
    description: 'TenderRequirements + matched capabilities. War room ready.',
    queries: [
      { cypher: "MATCH (t:TenderRequirement) WHERE t.confidence > 0.6 RETURN t ORDER BY t.confidence DESC LIMIT 30", nodeType: 'evidence', labelField: 'text' },
    ],
    autoAnalyze: true,
    layoutMode: 'freeform',
  },
  {
    id: 'digital-transformation',
    name: 'Digital Transformation',
    description: 'Tech landscape + maturity model. Current vs target state.',
    queries: [
      { cypher: "MATCH (t:TechStackEntry)<-[:USES_TECH]-(c:Competitor) WITH t, count(c) AS users RETURN t, users ORDER BY users DESC LIMIT 25", nodeType: 'tool', labelField: 'name' },
      { cypher: "MATCH (cap:CompetitorCapability)<-[:HAS_CAPABILITY]-(c:Competitor) WITH cap, count(c) AS adopters RETURN cap, adopters ORDER BY adopters DESC LIMIT 25", nodeType: 'evidence', labelField: 'name' },
    ],
    autoAnalyze: false,
    layoutMode: 'mindmap',
  },
  {
    id: 'h10-strategic-north-star',
    name: 'H10 Strategic North Star',
    description: '10-year vision breakdown: North Star → Pillars → H5 → H3 → H1 → 90-Day Action Plan.',
    queries: [
      { cypher: "MATCH (n:StrategicGoal) RETURN n LIMIT 5", nodeType: 'entity', labelField: 'name' },
      { cypher: "MATCH (p:StrategicPillar) RETURN p LIMIT 10", nodeType: 'insight', labelField: 'name' },
    ],
    autoAnalyze: false,
    layoutMode: 'freeform',
    columns: ['VISION', 'PILLARS', 'MARKET', 'GAPS', 'H5_MIDPOINT', 'H3_MOMENTUM', 'H1_LAUNCH', 'RISKS', 'FINANCE', 'ACTION_PLAN'],
  },
];

// Column mapping for engagement canvas layout
export const ENGAGEMENT_COLUMNS: Record<string, { nodeTypes: CanvasNodeType[]; x: number; color: string }> = {
  'VISION':          { nodeTypes: ['entity'],              x: 0,    color: '#f4bb00' },
  'PILLARS':         { nodeTypes: ['insight'],             x: 280,  color: '#22c55e' },
  'MARKET':          { nodeTypes: ['entity'],              x: 560,  color: '#3b82f6' },
  'GAPS':            { nodeTypes: ['thought'],             x: 840,  color: '#f97316' },
  'H5_MIDPOINT':     { nodeTypes: ['thought'],             x: 1120, color: '#8b5cf6' },
  'H3_MOMENTUM':     { nodeTypes: ['thought'],             x: 1400, color: '#a855f7' },
  'H1_LAUNCH':       { nodeTypes: ['thought'],             x: 1680, color: '#ec4899' },
  'RISKS':           { nodeTypes: ['insight'],             x: 1960, color: '#ef4444' },
  'FINANCE':         { nodeTypes: ['evidence'],            x: 2240, color: '#14b8a6' },
  'ACTION_PLAN':     { nodeTypes: ['artifact'],            x: 2520, color: '#06b6d4' },
  'BRIEF':           { nodeTypes: ['entity', 'server'],    x: 0,    color: '#64748b' },
  'HYPOTHESES':      { nodeTypes: ['thought'],             x: 280,  color: '#8b5cf6' },
  'EVIDENCE':        { nodeTypes: ['evidence'],            x: 560,  color: '#f97316' },
  'ANALYSIS':        { nodeTypes: ['insight'],             x: 840,  color: '#22c55e' },
  'RECOMMENDATIONS': { nodeTypes: ['thought'],             x: 1120, color: '#0047bb' },
  'DELIVERABLES':    { nodeTypes: ['artifact'],            x: 1400, color: '#ec4899' },
};
