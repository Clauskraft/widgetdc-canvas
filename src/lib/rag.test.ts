import { describe, it, expect } from 'vitest';
import { classifyIntent, buildCanvasSnapshot } from './rag';

describe('RAG: classifyIntent', () => {
  it('classifies scope/discover queries', () => {
    const result = classifyIntent('I want to explore and discover what we know about this topic');
    expect(result.workflow).toBe('scope-discover');
  });

  it('detects cybersecurity domain', () => {
    const result = classifyIntent('Help me understand the cybersecurity landscape');
    expect(result.domain).toBe('Cybersecurity');
  });

  it('classifies analyze/assess with framework detection', () => {
    const result = classifyIntent('I need to analyze and evaluate a DCF valuation for TechCo');
    expect(result.workflow).toBe('analyze-assess');
    expect(result.framework).toBe('DCF Valuation');
    expect(result.entityMentioned).toBe('TechCo');
  });

  it('classifies synthesize/recommend queries', () => {
    const result = classifyIntent('Generate a report from this canvas');
    expect(result.workflow).toBe('synthesize-recommend');
  });

  it('classifies plan/execute queries', () => {
    const result = classifyIntent('Create a plan with tasks, milestones and a timeline');
    expect(result.workflow).toBe('plan-execute');
  });

  it('classifies review/iterate queries', () => {
    const result = classifyIntent('What changed since the last iteration?');
    expect(result.workflow).toBe('review-iterate');
  });

  it('detects M&A domain', () => {
    const result = classifyIntent('We need to do due diligence on the acquisition target');
    expect(result.domain).toBe('Due Diligence');
  });

  it('detects SWOT framework', () => {
    const result = classifyIntent('Can we do a SWOT analysis?');
    expect(result.framework).toBe('SWOT Analysis');
  });

  it('detects Balanced Scorecard framework', () => {
    const result = classifyIntent('Lets set up a balanced scorecard for the project');
    expect(result.framework).toBe('Balanced Scorecard');
  });

  it('extracts quoted entity names', () => {
    const result = classifyIntent('Analyze "Netcompany" competitive position');
    expect(result.entityMentioned).toBe('Netcompany');
  });

  it('extracts "for X" entity pattern', () => {
    const result = classifyIntent('Run analysis for KOMBIT');
    expect(result.entityMentioned).toBe('KOMBIT');
  });

  it('handles Danish language scope queries', () => {
    const result = classifyIntent('Hvad ved vi om digitalisering og digital transformation?');
    expect(result.workflow).toBe('scope-discover');
    expect(result.domain).toBe('Digital Transformation');
  });

  it('handles risk/compliance domain', () => {
    const result = classifyIntent('We need to assess GDPR compliance gaps');
    expect(result.domain).toBe('Risk & Compliance');
    expect(result.workflow).toBe('analyze-assess');
  });

  it('defaults to scope-discover for ambiguous input', () => {
    const result = classifyIntent('tell me about the weather');
    expect(result.workflow).toBe('scope-discover');
    expect(result.confidence).toBeLessThan(0.5);
  });

  it('has higher confidence for keyword-rich queries', () => {
    const vague = classifyIntent('something');
    const rich = classifyIntent('analyze and evaluate the risk benchmark for compliance');
    expect(rich.confidence).toBeGreaterThan(vague.confidence);
  });
});

describe('RAG: buildCanvasSnapshot', () => {
  it('returns empty message for empty canvas', () => {
    expect(buildCanvasSnapshot([], [], null)).toContain('empty');
  });

  it('summarizes nodes by type', () => {
    const nodes = [
      { id: '1', type: 'entity', position: { x: 0, y: 0 }, data: { label: 'KOMBIT' } },
      { id: '2', type: 'entity', position: { x: 0, y: 0 }, data: { label: 'SKAT' } },
      { id: '3', type: 'evidence', position: { x: 0, y: 0 }, data: { label: 'Tender 123' } },
    ];
    const result = buildCanvasSnapshot(nodes, [], null);
    expect(result).toContain('3 nodes');
    expect(result).toContain('entity (2)');
    expect(result).toContain('evidence (1)');
    expect(result).toContain('KOMBIT');
  });

  it('includes selected node context', () => {
    const nodes = [
      { id: 'n1', type: 'entity', position: { x: 0, y: 0 }, data: { label: 'Focus Entity' } },
    ];
    const edges = [
      { id: 'e1', source: 'n1', target: 'n2' },
    ];
    const result = buildCanvasSnapshot(nodes, edges, 'n1');
    expect(result).toContain('Selected node: "Focus Entity"');
  });

  it('includes relationship types', () => {
    const nodes = [
      { id: '1', type: 'entity', position: { x: 0, y: 0 }, data: { label: 'A' } },
      { id: '2', type: 'entity', position: { x: 0, y: 0 }, data: { label: 'B' } },
    ];
    const edges = [
      { id: 'e1', source: '1', target: '2', label: 'COMPETES_WITH' },
    ];
    const result = buildCanvasSnapshot(nodes, edges as never[], null);
    expect(result).toContain('COMPETES_WITH');
  });
});
