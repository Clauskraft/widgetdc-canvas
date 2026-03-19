// Downstream Canvas only needs lightweight graph label/type hints at build time.
// Canonical graph contracts still live in widgetdc-contracts.
export type NodeLabel =
  | 'Agent'
  | 'Artifact'
  | 'Claim'
  | 'CodeImplementation'
  | 'ComplianceGap'
  | 'Decision'
  | 'Entity'
  | 'Evidence'
  | 'GuardrailRule'
  | 'Insight'
  | 'KnowledgePattern'
  | 'MCPTool'
  | 'Memory'
  | 'StrategicInsight'
  | 'StrategicLeverage'
  | 'Tool'
  | 'Track'
  | (string & {});

export type RelationshipType =
  | 'CONSTRAINS'
  | 'IMPLEMENTS'
  | 'LEVERAGES'
  | 'RELATED_TO'
  | 'REMEDIATES'
  | 'TARGETS'
  | (string & {});
