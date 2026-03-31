import { Range } from 'vscode-languageserver';

export type PromptFileType = 'prompt' | 'agent' | 'instructions' | 'skill' | 'system' | 'agents-md' | 'copilot-instructions' | 'unknown';

export interface PromptDocument {
  uri: string;
  text: string;
  lines: string[];
  variables: Map<string, number[]>;
  sections: Section[];
  compositionLinks: CompositionLink[];
  fileType: PromptFileType;
  frontmatter?: Record<string, unknown>;
  frontmatterRange?: { startLine: number; endLine: number };
}

export interface CompositionLink {
  target: string;
  resolvedPath?: string;
  line: number;
  column: number;
  endColumn: number;
  /** Column range for the link target inside parentheses: (target) */
  targetStartColumn?: number;
  targetEndColumn?: number;
}

export interface Section {
  name: string;
  startLine: number;
  endLine: number;
}

export interface AnalysisResult {
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info' | 'hint';
  range: Range;
  analyzer: string;
  suggestion?: string;
}

export interface TokenInfo {
  totalTokens: number;
  sections: Map<string, number>;
  /** Token counts aligned with doc.sections order (avoids collisions on duplicate section names). */
  sectionTokens?: number[];
}

export interface LLMAnalysisRequest {
  text: string;
  analysisType: 
    | 'contradiction'
    | 'ambiguity'
    | 'persona'
    | 'safety'
    | 'coverage';
}

export interface LLMAnalysisResponse {
  issues: AnalysisResult[];
  confidence: number;
}

export interface CacheEntry {
  hash: string;
  results: AnalysisResult[];
  timestamp: number;
  ttl: number;
}

// LSP proxy types for vscode.lm integration
export interface LLMProxyRequest {
  prompt: string;
  systemPrompt: string;
}

export interface LLMProxyResponse {
  text: string;
  error?: string;
}

export type LLMProxyFn = (request: LLMProxyRequest) => Promise<LLMProxyResponse>;

// Typed LLM response shapes for extractJSON
export interface LLMContradictionResponse {
  contradictions?: {
    instruction1: string;
    instruction2: string;
    severity: 'error' | 'warning';
    explanation: string;
    line1_estimate?: number;
    line2_estimate?: number;
  }[];
}

export interface LLMAmbiguityResponse {
  issues?: {
    text: string;
    type: 'quantifier' | 'reference' | 'term' | 'scope' | 'other';
    severity: 'warning' | 'info';
    suggestion: string;
  }[];
}

export interface LLMPersonaResponse {
  issues?: {
    description: string;
    trait1: string;
    trait2: string;
    severity: 'warning' | 'info';
    suggestion: string;
  }[];
}

export interface LLMCognitiveLoadResponse {
  issues?: {
    type: string;
    description: string;
    severity: 'warning' | 'info';
    suggestion: string;
  }[];
  overall_complexity?: 'low' | 'medium' | 'high' | 'very-high';
}

export interface LLMCoverageResponse {
  coverage_analysis?: {
    well_handled_intents?: string[];
    coverage_gaps?: { gap: string; impact: 'high' | 'medium' | 'low'; suggestion: string }[];
    missing_error_handling?: { scenario: string; suggestion: string }[];
    overall_coverage?: 'comprehensive' | 'adequate' | 'limited' | 'minimal';
  };
}

export interface LLMCompositionConflictResponse {
  conflicts?: {
    summary: string;
    instruction1: string;
    instruction2: string;
    severity: 'error' | 'warning';
    suggestion: string;
  }[];
}

/** Combined LLM response for single-call analysis. */
export interface LLMCombinedAnalysisResponse {
  contradictions?: LLMContradictionResponse['contradictions'];
  ambiguity_issues?: LLMAmbiguityResponse['issues'];
  persona_issues?: LLMPersonaResponse['issues'];
  cognitive_load?: {
    issues?: LLMCognitiveLoadResponse['issues'];
    overall_complexity?: LLMCognitiveLoadResponse['overall_complexity'];
  };
  coverage_analysis?: LLMCoverageResponse['coverage_analysis'];
}
