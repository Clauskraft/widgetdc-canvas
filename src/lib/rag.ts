import type { Node, Edge } from '@xyflow/react';
import { graphRead, reasonCall } from './api';
import { CANVAS_TEMPLATES } from '../templates';

// --- Intent Classification ---

export type ConsultingWorkflow =
  | 'scope-discover'
  | 'analyze-assess'
  | 'synthesize-recommend'
  | 'plan-execute'
  | 'review-iterate';

export interface IntentClassification {
  workflow: ConsultingWorkflow;
  domain: string | null;
  framework: string | null;
  entityMentioned: string | null;
  confidence: number;
}

const WORKFLOW_KEYWORDS: Record<ConsultingWorkflow, RegExp> = {
  'scope-discover': /\b(scope|discover|understand|brief|kickoff|start|onboard|what do we know|hvad ved vi|forstå|udforsk|load|find|search|explore|investigate|map|overview|landscape)\b/i,
  'analyze-assess': /\b(analy[sz]e|assess|evaluate|score|benchmark|compare|due diligence|valuat|audit|diagnos|measure|test|hypothesis|gap|risk|maturity)\b/i,
  'synthesize-recommend': /\b(synthe|recommend|report|narrative|deliverable|presentation|summary|conclusion|slide|document|write|export|produce|draft|memo|executive)\b/i,
  'plan-execute': /\b(plan|execute|task|timeline|milestone|roadmap|implement|initiative|break down|workstream|sprint|backlog|assign|owner|schedule|gantt)\b/i,
  'review-iterate': /\b(review|iterate|diff|replay|update|revis|revisit|feedback|retrospective|lesson|what changed|compare version|history)\b/i,
};

// Top consulting domains (from Neo4j ConsultingDomain nodes)
const DOMAIN_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'Strategy', pattern: /\b(strateg|positioning|growth|competitive|vision|market entry)\b/i },
  { name: 'Finance & Accounting', pattern: /\b(financ|accounting|revenue|cost|profit|cash flow|treasury|forecast)\b/i },
  { name: 'PE & VC', pattern: /\b(pe |private equity|venture capital|investment|fund|portfolio company|lbo|buyout)\b/i },
  { name: 'Due Diligence', pattern: /\b(due diligence|dd |vdr|data room|target company|acquisition)\b/i },
  { name: 'M&A', pattern: /\b(m&a|merger|acquisition|deal|transaction|carve.out|integration)\b/i },
  { name: 'Digital Transformation', pattern: /\b(digital\s*transform\w*|moderniz\w*|cloud migrat\w*|legacy|digitalis\w*)\b/i },
  { name: 'Cybersecurity', pattern: /\b(cyber\w*|security|penetration|soc|siem|threat|incident response|infosec)\b/i },
  { name: 'Risk & Compliance', pattern: /\b(risk|compliance|regulat|gdpr|nis2|ai.act|dora|governance)\b/i },
  { name: 'People & Org', pattern: /\b(people|org(aniz|anis)|change management|talent|hr |workforce|culture)\b/i },
  { name: 'Operations', pattern: /\b(operation|process|supply chain|lean|six sigma|procurement|logistics)\b/i },
  { name: 'Marketing & CX', pattern: /\b(marketing|customer experience|cx |brand|segmentation|journey|inbound)\b/i },
  { name: 'Technology', pattern: /\b(tech|architect|cloud|devops|platform|api |microservice|infrastructure)\b/i },
  { name: 'ESG & Sustainability', pattern: /\b(esg|sustainab|csrd|carbon|climate|social governance|green)\b/i },
  { name: 'Tax Advisory', pattern: /\b(tax|vat|duty|transfer pricing|withholding|fiscal)\b/i },
];

// Known framework shortnames (from 74 ConsultingFramework nodes)
const FRAMEWORK_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'SWOT Analysis', pattern: /\bswot\b/i },
  { name: 'PESTLE Analysis', pattern: /\b(pestle?|pest)\b/i },
  { name: 'DCF Valuation', pattern: /\bdcf\b/i },
  { name: 'Balanced Scorecard', pattern: /\bbalanced scorecard\b/i },
  { name: 'Business Model Canvas', pattern: /\bbusiness model canvas\b/i },
  { name: 'Value Proposition Canvas', pattern: /\bvalue proposition canvas\b/i },
  { name: 'OKR Design', pattern: /\bokr\b/i },
  { name: 'Design Thinking', pattern: /\bdesign thinking\b/i },
  { name: 'Lean Startup Cycle', pattern: /\blean startup\b/i },
  { name: 'Customer Journey Mapping', pattern: /\bcustomer journey\b/i },
  { name: 'M&A Due Diligence', pattern: /\b(m&a dd|m&a due diligence)\b/i },
  { name: 'Comparable Company Valuation', pattern: /\b(comp|comparable).*(valuation|analysis)\b/i },
  { name: 'DuPont Analysis', pattern: /\bdupont\b/i },
  { name: 'Risk Register', pattern: /\brisk register\b/i },
  { name: 'Capability Maturity Assessment', pattern: /\b(maturity|cmm|capability maturity)\b/i },
  { name: 'Agile Operating Model', pattern: /\bagile operating\b/i },
  { name: 'Scrum Framework', pattern: /\bscrum\b/i },
  { name: 'Process Mapping', pattern: /\bprocess map/i },
  { name: 'Change Management', pattern: /\bchange management\b/i },
  { name: 'Market Segmentation', pattern: /\bmarket segment/i },
  { name: 'Competitive Positioning', pattern: /\bcompetitive position/i },
  { name: 'Product Discovery', pattern: /\bproduct discovery\b/i },
  { name: 'Product Market Fit Diagnostics', pattern: /\bproduct.market fit\b/i },
  { name: 'Transformation Risk Heatmap', pattern: /\brisk heatmap\b/i },
  { name: 'Control Mapping', pattern: /\bcontrol mapping\b/i },
  { name: 'Financial Ratio Analysis', pattern: /\bfinancial ratio/i },
  { name: 'Unit Economics', pattern: /\bunit economics\b/i },
  { name: 'Break-Even Analysis', pattern: /\bbreak.even\b/i },
  { name: 'Strategic Initiative Mapping', pattern: /\binitiative mapping\b/i },
  { name: 'RACI DACI Governance', pattern: /\b(raci|daci)\b/i },
  { name: 'Service Blueprinting', pattern: /\bservice blueprint/i },
];

function extractEntity(text: string): string | null {
  // Match quoted strings
  const quoted = text.match(/["']([^"']+)["']/);
  if (quoted) return quoted[1];
  // Match "for X" / "about X" / "on X" patterns
  const prep = text.match(/\b(?:for|about|on|of|regarding|around)\s+([A-Z][A-Za-z0-9\s&]+?)(?:\s*[,.\-?!]|\s+(?:and|or|in|with|using|that)\b|$)/);
  if (prep) return prep[1].trim();
  return null;
}

export function classifyIntent(text: string): IntentClassification {
  // Score each workflow
  let bestWorkflow: ConsultingWorkflow = 'scope-discover';
  let bestScore = 0;

  for (const [workflow, pattern] of Object.entries(WORKFLOW_KEYWORDS)) {
    const matches = text.match(new RegExp(pattern, 'gi'));
    const score = matches?.length ?? 0;
    if (score > bestScore) {
      bestScore = score;
      bestWorkflow = workflow as ConsultingWorkflow;
    }
  }

  // Detect domain
  let domain: string | null = null;
  for (const d of DOMAIN_PATTERNS) {
    if (d.pattern.test(text)) { domain = d.name; break; }
  }

  // Detect framework
  let framework: string | null = null;
  for (const f of FRAMEWORK_PATTERNS) {
    if (f.pattern.test(text)) { framework = f.name; break; }
  }

  // Extract entity
  const entityMentioned = extractEntity(text);

  return {
    workflow: bestWorkflow,
    domain,
    framework,
    entityMentioned,
    confidence: bestScore > 0 ? Math.min(0.5 + bestScore * 0.15, 0.95) : 0.3,
  };
}

// --- Graph Context Retrieval ---

export interface GraphContext {
  frameworks: Array<{ name: string; category: string; description?: string }>;
  processes: Array<{ name: string; tools?: string[]; deliverables?: string[] }>;
  pastEngagements: Array<{ name: string; status?: string; domain?: string }>;
  relevantTools: string[];
}

async function safeGraphRead(query: string, params: Record<string, unknown> = {}): Promise<unknown[]> {
  try {
    return await graphRead(query, params);
  } catch {
    return [];
  }
}

export async function fetchGraphContext(intent: IntentClassification): Promise<GraphContext> {
  const ctx: GraphContext = { frameworks: [], processes: [], pastEngagements: [], relevantTools: [] };

  const queries: Promise<void>[] = [];

  // Always fetch relevant frameworks
  if (intent.framework) {
    // Specific framework requested — get its processes and tools
    queries.push(
      safeGraphRead(
        `MATCH (f:ConsultingFramework)
         WHERE toLower(f.name) CONTAINS toLower($fw)
         OPTIONAL MATCH (p:ConsultingProcess)-[:USES_METHODOLOGY]->(m:Methodology)
           WHERE toLower(m.name) CONTAINS toLower($fw)
         OPTIONAL MATCH (p)-[:USES_TOOL]->(t:MCPTool)
         OPTIONAL MATCH (p)-[:DELIVERS]->(d:DeliverableType)
         RETURN f.name AS name, f.category AS category, f.description AS description,
                collect(DISTINCT p.name) AS processes,
                collect(DISTINCT t.name) AS tools,
                collect(DISTINCT d.name) AS deliverables
         LIMIT 5`,
        { fw: intent.framework },
      ).then(records => {
        for (const raw of records) {
          const r = raw as Record<string, unknown>;
          ctx.frameworks.push({
            name: String(r.name ?? ''),
            category: String(r.category ?? ''),
            description: r.description ? String(r.description) : undefined,
          });
          const procs = (r.processes as string[])?.filter(Boolean) ?? [];
          const tools = (r.tools as string[])?.filter(Boolean) ?? [];
          const deliverables = (r.deliverables as string[])?.filter(Boolean) ?? [];
          if (procs.length) {
            ctx.processes.push({ name: procs[0], tools, deliverables });
          }
          ctx.relevantTools.push(...tools);
        }
      }),
    );
  } else if (intent.domain) {
    // Domain detected — get frameworks for that domain
    queries.push(
      safeGraphRead(
        `MATCH (f:ConsultingFramework)-[:APPLIES_TO]->(d:ConsultingDomain)
         WHERE toLower(d.name) CONTAINS toLower($domain)
         RETURN f.name AS name, f.category AS category, f.description AS description
         LIMIT 10`,
        { domain: intent.domain },
      ).then(records => {
        for (const raw of records) {
          const r = raw as Record<string, unknown>;
          ctx.frameworks.push({
            name: String(r.name ?? ''),
            category: String(r.category ?? ''),
            description: r.description ? String(r.description) : undefined,
          });
        }
      }),
    );
  } else {
    // No domain/framework — get overview
    queries.push(
      safeGraphRead(
        `MATCH (d:ConsultingDomain)<-[:APPLIES_TO]-(f:ConsultingFramework)
         WITH d.name AS domain, collect(f.name)[0..3] AS frameworks
         RETURN domain, frameworks
         LIMIT 10`,
      ).then(records => {
        for (const raw of records) {
          const r = raw as Record<string, unknown>;
          const fws = (r.frameworks as string[]) ?? [];
          for (const fw of fws) {
            ctx.frameworks.push({ name: fw, category: String(r.domain ?? '') });
          }
        }
      }),
    );
  }

  // Fetch processes with tools for the domain
  if (intent.domain) {
    queries.push(
      safeGraphRead(
        `MATCH (p:ConsultingProcess)-[:BELONGS_TO]->(d:ConsultingDomain)
         WHERE toLower(d.name) CONTAINS toLower($domain)
         OPTIONAL MATCH (p)-[:USES_TOOL]->(t:MCPTool)
         OPTIONAL MATCH (p)-[:DELIVERS]->(del:DeliverableType)
         RETURN p.name AS name,
                collect(DISTINCT t.name) AS tools,
                collect(DISTINCT del.name) AS deliverables
         LIMIT 8`,
        { domain: intent.domain },
      ).then(records => {
        for (const raw of records) {
          const r = raw as Record<string, unknown>;
          const tools = (r.tools as string[])?.filter(Boolean) ?? [];
          ctx.processes.push({
            name: String(r.name ?? ''),
            tools,
            deliverables: (r.deliverables as string[])?.filter(Boolean),
          });
          ctx.relevantTools.push(...tools);
        }
      }),
    );
  }

  // Fetch past engagements
  if (intent.domain || intent.entityMentioned) {
    const engQuery = intent.entityMentioned
      ? `MATCH (e:Engagement)
         WHERE toLower(e.name) CONTAINS toLower($search) OR toLower(e.client) CONTAINS toLower($search)
         RETURN e.name AS name, e.status AS status, e.domain AS domain
         LIMIT 5`
      : `MATCH (e:Engagement)
         WHERE e.domain IS NOT NULL AND toLower(e.domain) CONTAINS toLower($search)
            OR toLower(e.name) CONTAINS toLower($search)
         RETURN e.name AS name, e.status AS status, e.domain AS domain
         LIMIT 5`;
    queries.push(
      safeGraphRead(engQuery, { search: intent.entityMentioned ?? intent.domain ?? '' }).then(records => {
        for (const raw of records) {
          const r = raw as Record<string, unknown>;
          ctx.pastEngagements.push({
            name: String(r.name ?? ''),
            status: r.status ? String(r.status) : undefined,
            domain: r.domain ? String(r.domain) : undefined,
          });
        }
      }),
    );
  }

  await Promise.all(queries);

  // Deduplicate tools
  ctx.relevantTools = [...new Set(ctx.relevantTools)];

  return ctx;
}

// --- Canvas Snapshot ---

export function buildCanvasSnapshot(nodes: Node[], edges: Edge[], selectedNodeId: string | null): string {
  if (nodes.length === 0) return 'Canvas is empty — no nodes loaded yet.';

  const byType: Record<string, string[]> = {};
  for (const n of nodes) {
    const t = n.type ?? 'unknown';
    (byType[t] ??= []).push(String(n.data?.label ?? 'unnamed'));
  }

  const lines = [`Canvas: ${nodes.length} nodes, ${edges.length} edges.`];
  for (const [type, labels] of Object.entries(byType)) {
    lines.push(`- ${type} (${labels.length}): ${labels.slice(0, 8).join(', ')}${labels.length > 8 ? ` +${labels.length - 8} more` : ''}`);
  }

  const relTypes = [...new Set(edges.map(e => (e as Edge & { label?: string }).label).filter(Boolean))];
  if (relTypes.length) lines.push(`- Relationships: ${relTypes.slice(0, 10).join(', ')}`);

  if (selectedNodeId) {
    const sel = nodes.find(n => n.id === selectedNodeId);
    if (sel) {
      const connCount = edges.filter(e => e.source === selectedNodeId || e.target === selectedNodeId).length;
      lines.push(`\nSelected node: "${sel.data?.label}" (${sel.type}, ${connCount} connections)`);
    }
  }

  return lines.join('\n');
}

// --- Suggested Actions ---

export interface SuggestedAction {
  type: 'load_template' | 'expand' | 'analyze' | 'cross_reference' | 'narrative' | 'audit_trail';
  label: string;
  command: string; // The command to execute in AI Panel
}

function deriveSuggestedActions(intent: IntentClassification, ctx: GraphContext): SuggestedAction[] {
  const actions: SuggestedAction[] = [];

  switch (intent.workflow) {
    case 'scope-discover': {
      // Suggest loading a relevant template
      const templateMap: Record<string, string> = {
        'Due Diligence': 'competitive-due-diligence',
        'M&A': 'competitive-due-diligence',
        'PE & VC': 'competitive-due-diligence',
        'Risk & Compliance': 'regulatory-assessment',
        'Cybersecurity': 'regulatory-assessment',
        'Digital Transformation': 'digital-transformation',
        'Technology': 'digital-transformation',
      };
      const templateId = intent.domain ? templateMap[intent.domain] : null;
      if (templateId) {
        const tpl = CANVAS_TEMPLATES.find(t => t.id === templateId);
        if (tpl) {
          actions.push({
            type: 'load_template',
            label: `Load "${tpl.name}" template`,
            command: `template: ${templateId}`,
          });
        }
      }
      // Always suggest engagement canvas for scoping
      actions.push({
        type: 'load_template',
        label: 'Start structured Engagement Canvas',
        command: 'template: engagement-canvas',
      });
      // If entity mentioned, suggest searching
      if (intent.entityMentioned) {
        actions.push({
          type: 'expand',
          label: `Search for "${intent.entityMentioned}" in graph`,
          command: `search: ${intent.entityMentioned}`,
        });
      }
      break;
    }
    case 'analyze-assess': {
      if (intent.entityMentioned) {
        actions.push({
          type: 'analyze',
          label: `Auto-analyze "${intent.entityMentioned}"`,
          command: 'auto-analyze',
        });
        actions.push({
          type: 'expand',
          label: `Expand "${intent.entityMentioned}" neighbors`,
          command: `expand: ${intent.entityMentioned}`,
        });
      }
      if (intent.domain === 'Risk & Compliance' || intent.domain === 'Cybersecurity') {
        actions.push({
          type: 'load_template',
          label: 'Load Regulatory Assessment template',
          command: 'template: regulatory-assessment',
        });
      }
      // Suggest hypothesis evaluation if thought nodes exist
      actions.push({
        type: 'analyze',
        label: 'Evaluate hypothesis (select thought node first)',
        command: 'evaluate hypothesis',
      });
      break;
    }
    case 'synthesize-recommend': {
      actions.push({
        type: 'narrative',
        label: 'Generate narrative report from canvas',
        command: 'narrative',
      });
      actions.push({
        type: 'audit_trail',
        label: 'Export audit trail (Markdown)',
        command: 'audit trail markdown',
      });
      actions.push({
        type: 'audit_trail',
        label: 'Export audit trail (JSON-LD)',
        command: 'audit trail json',
      });
      break;
    }
    case 'plan-execute': {
      actions.push({
        type: 'load_template',
        label: 'Start structured Engagement Canvas',
        command: 'template: engagement-canvas',
      });
      if (intent.entityMentioned) {
        actions.push({
          type: 'analyze',
          label: `Run pipeline for "${intent.entityMentioned}"`,
          command: `pipeline: ${intent.entityMentioned}`,
        });
      }
      break;
    }
    case 'review-iterate': {
      if (ctx.pastEngagements.length) {
        actions.push({
          type: 'expand',
          label: `Replay engagement: ${ctx.pastEngagements[0].name}`,
          command: `replay: ${ctx.pastEngagements[0].name}`,
        });
      }
      actions.push({
        type: 'audit_trail',
        label: 'View provenance audit trail',
        command: 'audit trail markdown',
      });
      break;
    }
  }

  return actions.slice(0, 4); // Max 4 suggestions
}

// --- Main RAG Pipeline ---

const WORKFLOW_LABELS: Record<ConsultingWorkflow, string> = {
  'scope-discover': 'Scope & Discover',
  'analyze-assess': 'Analyze & Assess',
  'synthesize-recommend': 'Synthesize & Recommend',
  'plan-execute': 'Plan & Execute',
  'review-iterate': 'Review & Iterate',
};

export interface RagResult {
  answer: string;
  thinkingSteps?: string[];
  confidence?: number;
  suggestedActions: SuggestedAction[];
  intent: IntentClassification;
}

export async function ragQuery(
  userText: string,
  nodes: Node[],
  edges: Edge[],
  selectedNodeId: string | null,
): Promise<RagResult> {
  // Step 1: Classify intent (instant, no network)
  const intent = classifyIntent(userText);

  // Step 2: Fetch graph context (parallel Cypher queries)
  const ctx = await fetchGraphContext(intent);

  // Step 3: Build canvas snapshot (instant)
  const canvasSnapshot = buildCanvasSnapshot(nodes, edges, selectedNodeId);

  // Step 4: Assemble enriched prompt
  const frameworkSection = ctx.frameworks.length
    ? ctx.frameworks.map(f => `- **${f.name}** (${f.category})${f.description ? `: ${f.description}` : ''}`).join('\n')
    : 'No specific frameworks matched. Ask about a domain or framework by name.';

  const processSection = ctx.processes.length
    ? ctx.processes.map(p => {
        const parts = [`- **${p.name}**`];
        if (p.tools?.length) parts.push(`  Tools: ${p.tools.join(', ')}`);
        if (p.deliverables?.length) parts.push(`  Delivers: ${p.deliverables.join(', ')}`);
        return parts.join('\n');
      }).join('\n')
    : 'No specific processes matched.';

  const engagementSection = ctx.pastEngagements.length
    ? ctx.pastEngagements.map(e => `- ${e.name} (${e.status ?? 'unknown'})${e.domain ? ` — ${e.domain}` : ''}`).join('\n')
    : 'No past engagements found.';

  const toolSection = ctx.relevantTools.length
    ? `Available MCP tools for this domain: ${ctx.relevantTools.slice(0, 15).join(', ')}`
    : '';

  const enrichedPrompt = `You are a senior management consultant assistant. You help consultants work through engagements using structured frameworks and methodologies.

## User Question
${userText}

## Detected Context
- Workflow phase: ${WORKFLOW_LABELS[intent.workflow]}
- Domain: ${intent.domain ?? 'General / not specified'}
- Framework: ${intent.framework ?? 'Not specified — suggest relevant ones'}
- Entity: ${intent.entityMentioned ?? 'None mentioned'}
- Confidence: ${(intent.confidence * 100).toFixed(0)}%

## Relevant Consulting Frameworks (from knowledge graph)
${frameworkSection}

## Relevant Processes & Tools
${processSection}
${toolSection}

## Past Engagements (similar work)
${engagementSection}

## Current Canvas State
${canvasSnapshot}

## Available Canvas Templates
${CANVAS_TEMPLATES.map(t => `- "${t.id}": ${t.name} — ${t.description}`).join('\n')}

## Instructions
Answer the question as a senior consultant would. Be specific and actionable:
1. Reference specific frameworks, processes, and tools by name when relevant
2. Explain WHY a framework fits this situation
3. Suggest concrete next steps the consultant can take
4. If a canvas template fits, recommend loading it by name
5. Keep response concise — under 400 words
6. Use the consulting knowledge above, don't make up frameworks`;

  // Step 5: Call /reason with enriched prompt (passthrough mode — >200 chars)
  const result = await reasonCall(enrichedPrompt, {
    domain: intent.domain ?? 'consulting',
    consulting_rag: true,
    workflow: intent.workflow,
  });

  // Step 6: Derive suggested actions
  const suggestedActions = deriveSuggestedActions(intent, ctx);

  return {
    answer: result.recommendation || 'No recommendation generated.',
    thinkingSteps: result.thinking_steps,
    confidence: result.confidence,
    suggestedActions,
    intent,
  };
}
