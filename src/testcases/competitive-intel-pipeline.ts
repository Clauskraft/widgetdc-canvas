/**
 * COMPETITIVE INTELLIGENCE ENRICHMENT PIPELINE
 * =============================================
 * Repurposes pentest/OSINT tools for legitimate competitive intelligence:
 *
 * TRADITIONAL USE → REPURPOSED USE
 * ─────────────────────────────────────────────────────────────────
 * harvest.intel.domain    → Map competitor tech stack (DNS, MX, SPF)
 * trident.scan.domain     → Discover competitor SSL/cert infrastructure
 * trident.cvr.lookup      → Company registry: ownership, board, financials
 * intel.cvr_financials    → Financial health scoring of competitors
 * trident.dork.scan.org   → Public document discovery (PDFs, reports, decks)
 * trident.attack-surface  → Technology footprint mapping (services, CDNs)
 * harvest.web.scrape      → Extract public capability claims from websites
 * harvest.intel.osint     → Open-source intelligence aggregation
 * trident.cti.dk-landscape→ Danish market threat/opportunity landscape
 * trident.certstream.start→ Track competitor domain changes in real-time
 *
 * OUTPUT: Enriched Neo4j graph with:
 * - :Competitor nodes (30 existing) enhanced with tech_stack, dns, mx
 * - :CompetitorCapability nodes (NEW) — extracted from websites
 * - :TechStackEntry nodes (NEW) — CDN, email, DNS providers
 * - :PublicDocument nodes (NEW) — discovered PDFs/reports
 * - :FinancialSnapshot nodes (existing 20) enhanced with CVR data
 * - :MarketSignal nodes (NEW) — cert changes, domain expansions
 *
 * EDGES:
 * - (Competitor)-[:USES_TECH]->(TechStackEntry)
 * - (Competitor)-[:PUBLISHES]->(PublicDocument)
 * - (Competitor)-[:HAS_CAPABILITY]->(CompetitorCapability)
 * - (Competitor)-[:COMPETES_IN]->(ConsultingDomain)
 * - (Competitor)-[:EMITS]->(MarketSignal)
 */

import { mcpCall, graphWrite, graphRead } from '../lib/api';

export interface PipelineTarget {
  name: string;
  domain: string;
  cvr?: string;
}

export interface PipelineResult {
  target: string;
  steps: StepResult[];
  nodesCreated: number;
  edgesCreated: number;
  errors: string[];
}

interface StepResult {
  step: string;
  tool: string;
  status: 'success' | 'error' | 'skipped';
  data?: unknown;
  nodesCreated: number;
  error?: string;
}

// Danish consulting market targets (from graph: 30 competitors)
export const DANISH_TARGETS: PipelineTarget[] = [
  { name: 'Deloitte Denmark', domain: 'deloitte.dk', cvr: '33963556' },
  { name: 'PwC Denmark', domain: 'pwc.dk', cvr: '33771231' },
  { name: 'EY Denmark', domain: 'dk.ey.com', cvr: '30700228' },
  { name: 'KPMG Denmark', domain: 'kpmg.dk', cvr: '25578198' },
  { name: 'Implement Consulting', domain: 'implement.dk', cvr: '32767788' },
  { name: 'Netcompany', domain: 'netcompany.com', cvr: '14814139' },
  { name: 'KMD (NEC)', domain: 'kmd.dk', cvr: '26911745' },
  { name: 'Accenture Denmark', domain: 'accenture.com', cvr: '33276517' },
  { name: 'Ramboll', domain: 'ramboll.com', cvr: '35128417' },
  { name: 'COWI', domain: 'cowi.com', cvr: '44623528' },
];

/**
 * Step 1: Domain Intelligence — DNS, MX, SPF, TXT records
 * Reveals: email provider, CDN, security posture, cloud providers
 */
async function stepDomainIntel(target: PipelineTarget): Promise<StepResult> {
  try {
    const result = await mcpCall<Record<string, unknown>>('harvest.intel.domain', { domain: target.domain });
    const data = (result as Record<string, unknown>)?.result as Record<string, unknown>;
    const scanResults = (data?.data as Record<string, unknown>)?.scanResults as Record<string, unknown>;
    const dns = scanResults?.dns as Record<string, unknown> | undefined;

    if (!dns) return { step: 'Domain Intel', tool: 'harvest.intel.domain', status: 'skipped', nodesCreated: 0 };

    // Extract tech stack from DNS records
    const mx = (dns?.mx as { exchange: string }[])?.map((m) => m.exchange) ?? [];
    const txt = (dns?.txt as string[][])?.flat() ?? [];
    const ns = (dns?.ns as string[]) ?? [];
    const aRecords = (dns?.a as string[]) ?? [];

    // Detect technologies from DNS
    const techStack: string[] = [];
    if (mx.some((m) => m.includes('outlook') || m.includes('microsoft'))) techStack.push('Microsoft 365');
    if (mx.some((m) => m.includes('google'))) techStack.push('Google Workspace');
    if (ns.some((n) => n.includes('cloudflare'))) techStack.push('Cloudflare');
    if (ns.some((n) => n.includes('aws'))) techStack.push('AWS Route53');
    if (txt.some((t) => t.includes('spf') && t.includes('sendgrid'))) techStack.push('SendGrid');
    if (txt.some((t) => t.includes('hubspot'))) techStack.push('HubSpot');
    if (txt.some((t) => t.includes('salesforce'))) techStack.push('Salesforce');
    if (txt.some((t) => t.includes('atlassian'))) techStack.push('Atlassian');
    if (txt.some((t) => t.includes('adobe'))) techStack.push('Adobe');
    if (txt.some((t) => t.includes('docusign'))) techStack.push('DocuSign');
    if (txt.some((t) => t.includes('zendesk'))) techStack.push('Zendesk');

    // Persist to graph
    let nodesCreated = 0;
    for (const tech of techStack) {
      await graphWrite(
        `MERGE (t:TechStackEntry {name: $tech})
         SET t.category = 'SaaS', t.updatedAt = datetime()
         WITH t
         MATCH (c:Competitor {name: $compName})
         MERGE (c)-[:USES_TECH]->(t)`,
        { tech, compName: target.name },
      );
      nodesCreated++;
    }

    // Update competitor with raw DNS data
    await graphWrite(
      `MATCH (c:Competitor {name: $name})
       SET c.domain = $domain,
           c.mx_providers = $mx,
           c.dns_nameservers = $ns,
           c.ip_addresses = $aRecords,
           c.tech_stack = $techStack,
           c.dns_scanned_at = datetime()`,
      { name: target.name, domain: target.domain, mx, ns, aRecords, techStack },
    );

    return { step: 'Domain Intel', tool: 'harvest.intel.domain', status: 'success', data: { techStack, mx, ns }, nodesCreated };
  } catch (err) {
    return { step: 'Domain Intel', tool: 'harvest.intel.domain', status: 'error', nodesCreated: 0, error: String(err) };
  }
}

/**
 * Step 2: Certificate Infrastructure — SSL certs reveal subdomains, services
 */
async function stepCertScan(target: PipelineTarget): Promise<StepResult> {
  try {
    const result = await mcpCall<Record<string, unknown>>('trident.scan.domain', { domain: target.domain });
    const data = (result as Record<string, unknown>)?.result as Record<string, unknown>;
    const certs = (data?.certificates as Record<string, unknown>[]) ?? [];

    let nodesCreated = 0;
    for (const cert of certs.slice(0, 10)) {
      const cn = String(cert?.commonName ?? cert?.subject ?? target.domain);
      await graphWrite(
        `MERGE (ms:MarketSignal {type: 'SSL_CERT', subject: $cn, competitor: $comp})
         SET ms.issuer = $issuer, ms.validFrom = $validFrom, ms.discoveredAt = datetime()
         WITH ms
         MATCH (c:Competitor {name: $comp})
         MERGE (c)-[:EMITS]->(ms)`,
        {
          cn,
          comp: target.name,
          issuer: String(cert?.issuer ?? ''),
          validFrom: String(cert?.validFrom ?? ''),
        },
      );
      nodesCreated++;
    }

    return { step: 'Cert Scan', tool: 'trident.scan.domain', status: 'success', data: { certsFound: certs.length }, nodesCreated };
  } catch (err) {
    return { step: 'Cert Scan', tool: 'trident.scan.domain', status: 'error', nodesCreated: 0, error: String(err) };
  }
}

/**
 * Step 3: Website Scrape — extract capability claims, service offerings
 */
async function stepWebsiteScrape(target: PipelineTarget): Promise<StepResult> {
  try {
    const result = await mcpCall<Record<string, unknown>>('harvest.web.scrape', {
      url: `https://${target.domain}`,
      maxPages: 3,
      extractMetadata: true,
    });
    const data = (result as Record<string, unknown>)?.result as Record<string, unknown>;
    const content = String(data?.content ?? data?.text ?? '');

    // Extract capability keywords from website content
    const capabilityKeywords = [
      'digital transformation', 'cloud migration', 'cybersecurity', 'data analytics',
      'AI', 'machine learning', 'ESG', 'sustainability', 'M&A', 'due diligence',
      'strategy', 'consulting', 'advisory', 'audit', 'tax', 'risk management',
      'compliance', 'GDPR', 'NIS2', 'public sector', 'healthcare', 'energy',
      'financial services', 'telecom', 'retail', 'manufacturing', 'agile',
      'devops', 'SAP', 'Salesforce', 'ServiceNow', 'Azure', 'AWS', 'GCP',
    ];

    const foundCapabilities = capabilityKeywords.filter((kw) =>
      content.toLowerCase().includes(kw.toLowerCase()),
    );

    let nodesCreated = 0;
    for (const cap of foundCapabilities) {
      await graphWrite(
        `MERGE (cc:CompetitorCapability {name: $cap})
         SET cc.category = 'claimed', cc.updatedAt = datetime()
         WITH cc
         MATCH (c:Competitor {name: $compName})
         MERGE (c)-[:HAS_CAPABILITY]->(cc)`,
        { cap, compName: target.name },
      );
      nodesCreated++;
    }

    return {
      step: 'Website Scrape',
      tool: 'harvest.web.scrape',
      status: 'success',
      data: { capabilities: foundCapabilities, contentLength: content.length },
      nodesCreated,
    };
  } catch (err) {
    return { step: 'Website Scrape', tool: 'harvest.web.scrape', status: 'error', nodesCreated: 0, error: String(err) };
  }
}

/**
 * Step 4: Google Dorking — discover public documents (PDFs, reports, presentations)
 */
async function stepDorkScan(target: PipelineTarget): Promise<StepResult> {
  try {
    const result = await mcpCall<Record<string, unknown>>('trident.dork.scan.org', {
      org: target.name,
      domain: target.domain,
    });
    const data = (result as Record<string, unknown>)?.result as Record<string, unknown>;
    const findings = (data?.findings as Record<string, unknown>[]) ?? [];

    let nodesCreated = 0;
    for (const finding of findings.slice(0, 20)) {
      await graphWrite(
        `MERGE (pd:PublicDocument {url: $url})
         SET pd.title = $title, pd.type = $type, pd.source = $source,
             pd.discoveredAt = datetime(), pd.competitor = $comp
         WITH pd
         MATCH (c:Competitor {name: $comp})
         MERGE (c)-[:PUBLISHES]->(pd)`,
        {
          url: String(finding?.url ?? ''),
          title: String(finding?.title ?? 'Unknown'),
          type: String(finding?.type ?? 'document'),
          source: 'google_dork',
          comp: target.name,
        },
      );
      nodesCreated++;
    }

    return { step: 'Dork Scan', tool: 'trident.dork.scan.org', status: 'success', data: { findings: findings.length }, nodesCreated };
  } catch (err) {
    return { step: 'Dork Scan', tool: 'trident.dork.scan.org', status: 'error', nodesCreated: 0, error: String(err) };
  }
}

/**
 * Step 5: Attack Surface → Technology Footprint
 * Repurposed: Maps CDN, hosting, services as competitive intelligence
 */
async function stepTechFootprint(target: PipelineTarget): Promise<StepResult> {
  try {
    const result = await mcpCall<Record<string, unknown>>('trident.attack-surface', { domain: target.domain });
    const data = (result as Record<string, unknown>)?.result as Record<string, unknown>;
    const services = (data?.services as Record<string, unknown>[]) ?? [];
    const technologies = (data?.technologies as string[]) ?? [];

    let nodesCreated = 0;
    for (const tech of technologies.slice(0, 15)) {
      await graphWrite(
        `MERGE (t:TechStackEntry {name: $tech})
         SET t.category = 'infrastructure', t.updatedAt = datetime()
         WITH t
         MATCH (c:Competitor {name: $compName})
         MERGE (c)-[:USES_TECH]->(t)`,
        { tech, compName: target.name },
      );
      nodesCreated++;
    }

    return {
      step: 'Tech Footprint',
      tool: 'trident.attack-surface',
      status: 'success',
      data: { services: services.length, technologies },
      nodesCreated,
    };
  } catch (err) {
    return { step: 'Tech Footprint', tool: 'trident.attack-surface', status: 'error', nodesCreated: 0, error: String(err) };
  }
}

/**
 * Run the full pipeline for a single target
 */
export async function runPipeline(target: PipelineTarget): Promise<PipelineResult> {
  const steps: StepResult[] = [];
  const errors: string[] = [];

  const runners = [
    stepDomainIntel,
    stepCertScan,
    stepWebsiteScrape,
    stepDorkScan,
    stepTechFootprint,
  ];

  for (const runner of runners) {
    const result = await runner(target);
    steps.push(result);
    if (result.error) errors.push(`${result.step}: ${result.error}`);
  }

  return {
    target: target.name,
    steps,
    nodesCreated: steps.reduce((sum, s) => sum + s.nodesCreated, 0),
    edgesCreated: steps.reduce((sum, s) => sum + s.nodesCreated, 0), // 1 edge per node in this pipeline
    errors,
  };
}

/**
 * Run pipeline for all Danish targets
 */
export async function runFullEnrichment(
  targets: PipelineTarget[] = DANISH_TARGETS,
  onProgress?: (target: string, step: string, status: string) => void,
): Promise<PipelineResult[]> {
  const results: PipelineResult[] = [];

  for (const target of targets) {
    onProgress?.(target.name, 'starting', 'in_progress');
    const result = await runPipeline(target);
    results.push(result);
    onProgress?.(target.name, 'complete', result.errors.length > 0 ? 'partial' : 'success');
  }

  // Post-enrichment: cross-link capabilities to consulting domains
  await graphWrite(
    `MATCH (cc:CompetitorCapability)
     WHERE toLower(cc.name) CONTAINS 'cyber' OR toLower(cc.name) CONTAINS 'security'
     MATCH (d:ConsultingDomain {name: 'Cybersecurity'})
     MERGE (cc)-[:MAPS_TO_DOMAIN]->(d)`,
    {},
  );
  await graphWrite(
    `MATCH (cc:CompetitorCapability)
     WHERE toLower(cc.name) CONTAINS 'strategy' OR toLower(cc.name) CONTAINS 'advisory'
     MATCH (d:ConsultingDomain {name: 'Strategy'})
     MERGE (cc)-[:MAPS_TO_DOMAIN]->(d)`,
    {},
  );
  await graphWrite(
    `MATCH (cc:CompetitorCapability)
     WHERE toLower(cc.name) CONTAINS 'digital' OR toLower(cc.name) CONTAINS 'cloud' OR toLower(cc.name) CONTAINS 'AI'
     MATCH (d:ConsultingDomain {name: 'Technology'})
     MERGE (cc)-[:MAPS_TO_DOMAIN]->(d)`,
    {},
  );

  return results;
}

/**
 * Generate canvas nodes from pipeline results
 */
export function pipelineToCanvasNodes(results: PipelineResult[]) {
  const nodes: { type: string; label: string; subtitle: string }[] = [];
  const edges: { source: string; target: string }[] = [];

  // Center node
  nodes.push({ type: 'concept', label: 'CI Pipeline', subtitle: 'Competitive Intelligence' });

  for (const result of results) {
    const competitorId = `comp-${result.target.replace(/\s/g, '-')}`;
    nodes.push({
      type: 'domain',
      label: result.target,
      subtitle: `${result.nodesCreated} nodes, ${result.errors.length} errors`,
    });
    edges.push({ source: 'node-0', target: competitorId });

    for (const step of result.steps) {
      if (step.status === 'success' && step.nodesCreated > 0) {
        nodes.push({
          type: 'tool',
          label: step.tool,
          subtitle: `${step.nodesCreated} enrichments`,
        });
      }
    }
  }

  return { nodes, edges };
}
