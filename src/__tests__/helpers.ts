import { PromptDocument, PromptFileType, CompositionLink } from '../types';

/**
 * Shared test helper to build a PromptDocument from text content.
 */
export function makeDoc(
  text: string,
  options: {
    uri?: string;
    fileType?: PromptFileType;
    compositionLinks?: CompositionLink[];
    frontmatter?: Record<string, unknown>;
    frontmatterRange?: { startLine: number; endLine: number };
  } = {},
): PromptDocument {
  const lines = text.split('\n');
  const variables = new Map<string, number[]>();
  const variablePattern = /\{\{(\w+)\}\}/g;

  lines.forEach((line, lineIndex) => {
    let match: RegExpExecArray | null;
    variablePattern.lastIndex = 0;
    while ((match = variablePattern.exec(line)) !== null) {
      const varName = match[1];
      const positions = variables.get(varName) || [];
      positions.push(lineIndex);
      variables.set(varName, positions);
    }
  });

  const sections: { name: string; startLine: number; endLine: number }[] = [];
  let currentSection: { name: string; startLine: number } | null = null;

  lines.forEach((line, lineIndex) => {
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      if (currentSection !== null) {
        sections.push({
          name: currentSection.name,
          startLine: currentSection.startLine,
          endLine: lineIndex - 1,
        });
      }
      currentSection = { name: headerMatch[2], startLine: lineIndex };
    }
  });

  if (currentSection !== null) {
    sections.push({
      name: (currentSection as { name: string; startLine: number }).name,
      startLine: (currentSection as { name: string; startLine: number }).startLine,
      endLine: lines.length - 1,
    });
  }

  return {
    text,
    lines,
    sections,
    compositionLinks: options.compositionLinks ?? [],
    fileType: options.fileType ?? 'prompt'
  };
}
