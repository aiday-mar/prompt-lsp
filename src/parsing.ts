import path from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYAML } from 'yaml';
import { PromptDocument, PromptFileType, CompositionLink } from './types';

export function detectFileType(uri: string): PromptFileType {
  const lower = uri.toLowerCase();
  const baseName = lower.split(/[\\/]/).pop() || '';
  if (baseName === 'skill.md') return 'skill';
  if (lower.endsWith('.agent.md')) return 'agent';
  if (lower.endsWith('.prompt.md')) return 'prompt';
  if (lower.endsWith('.instructions.md')) return 'instructions';
  if (isSkillMarkdownPath(lower)) return 'skill';
  return 'unknown';
}

export function getDocumentDir(uri: string): string | undefined {
  try {
    const filePath = fileURLToPath(uri);
    return path.dirname(filePath);
  } catch {
    return undefined;
  }
}

export function normalizeMarkdownLinkTarget(target: string): string | undefined {
  let cleaned = target.trim();

  if (cleaned.startsWith('<') && cleaned.endsWith('>')) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  if (!cleaned || cleaned.startsWith('#')) {
    return undefined;
  }

  if (/^(https?:|mailto:)/i.test(cleaned)) {
    return undefined;
  }

  const match = cleaned.match(/^([^\s]+)(?:\s+['"][^'"]*['"])?$/);
  return match ? match[1] : cleaned;
}

export function resolveLinkPath(target: string, documentDir?: string, workspaceRoot?: string): string | undefined {
  if (!documentDir) return undefined;

  let resolved: string | undefined;

  if (target.startsWith('file://')) {
    try {
      resolved = fileURLToPath(target);
    } catch {
      return undefined;
    }
  } else if (path.isAbsolute(target)) {
    resolved = target;
  } else {
    resolved = path.resolve(documentDir, target);
  }

  // When workspaceRoot is provided, enforce containment; when absent, restrict to documentDir
  if (resolved && workspaceRoot) {
    if (!isWithinDirectory(resolved, workspaceRoot)) {
      return undefined;
    }
  } else if (resolved) {
    // No workspace root — restrict to documentDir to prevent traversal
    if (!isWithinDirectory(resolved, documentDir)) {
      return undefined;
    }
  }

  return resolved;
}

function isWithinDirectory(filePath: string, directory: string): boolean {
  const normalizedFile = path.resolve(filePath);
  const normalizedDir = path.resolve(directory);
  return normalizedFile === normalizedDir || normalizedFile.startsWith(normalizedDir + path.sep);
}

export function isPromptFile(target: string): boolean {
  const lower = target.toLowerCase();
  const baseName = lower.split(/[\\/]/).pop() || '';
  return (
    lower.endsWith('.prompt.md') ||
    lower.endsWith('.agent.md') ||
    lower.endsWith('.instructions.md') ||
    isSkillMarkdownPath(lower)
  );
}

export function isSkillMarkdownPath(target: string): boolean {
  if (!target.endsWith('.md')) return false;
  return /(^|[\\/])\.?(github|claude)[\\/]skills[\\/]/.test(target) ||
         /(^|[\\/])skills[\\/]/.test(target);
}

export interface ParsePromptDocumentOptions {
  uri: string;
  text: string;
  workspaceRoot?: string;
}

export function parsePromptDocument(options: ParsePromptDocumentOptions): PromptDocument {
  const { uri, text, workspaceRoot } = options;
  const lines = text.split('\n');

  // Extract variables like {{variable_name}}
  const variables: Map<string, number[]> = new Map();

  lines.forEach((line, lineIndex) => {
    const variablePattern = /\{\{(\w+)\}\}/g;
    let match;
    while ((match = variablePattern.exec(line)) !== null) {
      const varName = match[1];
      const positions = variables.get(varName) || [];
      positions.push(lineIndex);
      variables.set(varName, positions);
    }
  });

  // Extract sections (markdown headers)
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

  const compositionLinks: CompositionLink[] = [];
  const documentDir = getDocumentDir(uri);

  lines.forEach((line, lineIndex) => {
    const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    while ((match = linkPattern.exec(line)) !== null) {
      const rawTarget = match[2].trim();
      const target = normalizeMarkdownLinkTarget(rawTarget);
      if (!target) continue;

      const targetWithoutAnchor = target.split('#')[0];
      if (!targetWithoutAnchor) continue;

      if (!isPromptFile(targetWithoutAnchor)) continue;

      const resolvedPath = resolveLinkPath(targetWithoutAnchor, documentDir, workspaceRoot);
      const openParenOffset = match[0].indexOf('(');
      const targetStartColumn = match.index + (openParenOffset >= 0 ? openParenOffset + 1 : 0);
      const targetEndColumn = targetStartColumn + match[2].length;
      compositionLinks.push({
        target: targetWithoutAnchor,
        resolvedPath,
        line: lineIndex,
        column: match.index,
        endColumn: match.index + match[0].length,
        targetStartColumn,
        targetEndColumn,
      });
    }
  });

  return {
    text,
    lines,
    sections,
    compositionLinks,
    fileType: detectFileType(uri)
  };
}
