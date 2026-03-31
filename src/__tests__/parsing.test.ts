import { describe, it, expect } from 'vitest';
import path from 'path';
import {
  detectFileType,
  normalizeMarkdownLinkTarget,
  resolveLinkPath,
  isPromptFile,
  isSkillMarkdownPath,
  parsePromptDocument,
} from '../parsing';

describe('detectFileType', () => {
  it('should detect agent files', () => {
    expect(detectFileType('file:///path/to/my.agent.md')).toBe('agent');
  });

  it('should detect prompt files', () => {
    expect(detectFileType('file:///path/to/my.prompt.md')).toBe('prompt');
  });

  it('should detect instructions files', () => {
    expect(detectFileType('file:///path/to/my.instructions.md')).toBe('instructions');
  });

  it('should detect skill.md', () => {
    expect(detectFileType('file:///path/to/skill.md')).toBe('skill');
  });

  it('should detect skill files inside /skills/ directory (Fix 4)', () => {
    expect(detectFileType('file:///workspace/.github/skills/web-test/helpers.md')).toBe('skill');
    expect(detectFileType('file:///workspace/skills/coding/SKILL.md')).toBe('skill');
  });

  it('should return unknown for non-prompt files', () => {
    expect(detectFileType('file:///path/to/readme.md')).toBe('unknown');
    expect(detectFileType('file:///path/to/code.ts')).toBe('unknown');
  });

  it('should be case-insensitive', () => {
    expect(detectFileType('file:///path/to/MY.AGENT.MD')).toBe('agent');
  });
});

describe('normalizeMarkdownLinkTarget', () => {
  it('should return target as-is for simple paths', () => {
    expect(normalizeMarkdownLinkTarget('file.md')).toBe('file.md');
  });

  it('should strip angle brackets', () => {
    expect(normalizeMarkdownLinkTarget('<file.md>')).toBe('file.md');
  });

  it('should strip title strings', () => {
    expect(normalizeMarkdownLinkTarget('file.md "Title"')).toBe('file.md');
  });

  it('should return undefined for anchor-only links', () => {
    expect(normalizeMarkdownLinkTarget('#section')).toBeUndefined();
  });

  it('should return undefined for http URLs', () => {
    expect(normalizeMarkdownLinkTarget('https://example.com')).toBeUndefined();
  });

  it('should return undefined for mailto links', () => {
    expect(normalizeMarkdownLinkTarget('mailto:test@example.com')).toBeUndefined();
  });

  it('should return undefined for empty targets', () => {
    expect(normalizeMarkdownLinkTarget('')).toBeUndefined();
    expect(normalizeMarkdownLinkTarget('  ')).toBeUndefined();
  });
});

describe('resolveLinkPath', () => {
  it('should resolve relative paths', () => {
    const result = resolveLinkPath('child.md', '/workspace/dir');
    expect(result).toBe(path.resolve('/workspace/dir', 'child.md'));
  });

  it('should return undefined when no documentDir', () => {
    expect(resolveLinkPath('file.md', undefined)).toBeUndefined();
  });

  it('should block path traversal beyond workspace root (Fix 1)', () => {
    const result = resolveLinkPath('../../../etc/passwd', '/workspace/dir', '/workspace');
    expect(result).toBeUndefined();
  });

  it('should allow paths within workspace', () => {
    const result = resolveLinkPath('sub/file.md', '/workspace/dir', '/workspace');
    expect(result).toBe(path.resolve('/workspace/dir', 'sub/file.md'));
  });

  it('should block absolute paths outside workspace', () => {
    const result = resolveLinkPath('/etc/passwd', '/workspace/dir', '/workspace');
    expect(result).toBeUndefined();
  });

  it('should allow absolute paths within workspace', () => {
    const result = resolveLinkPath('/workspace/other/file.md', '/workspace/dir', '/workspace');
    expect(result).toBe('/workspace/other/file.md');
  });

  it('should block path traversal without workspace root', () => {
    const result = resolveLinkPath('../parent.md', '/workspace/dir');
    expect(result).toBeUndefined();
  });
});

describe('isPromptFile', () => {
  it('should recognize .prompt.md', () => {
    expect(isPromptFile('file.prompt.md')).toBe(true);
  });

  it('should recognize .agent.md', () => {
    expect(isPromptFile('file.agent.md')).toBe(true);
  });

  it('should recognize .instructions.md', () => {
    expect(isPromptFile('file.instructions.md')).toBe(true);
  });

  it('should recognize skill paths', () => {
    expect(isPromptFile('.github/skills/test/SKILL.md')).toBe(true);
  });

  it('should reject regular markdown', () => {
    expect(isPromptFile('readme.md')).toBe(false);
  });

  it('should reject non-markdown', () => {
    expect(isPromptFile('code.ts')).toBe(false);
  });
});

describe('isSkillMarkdownPath', () => {
  it('should match .github/skills/ paths', () => {
    expect(isSkillMarkdownPath('.github/skills/test/SKILL.md')).toBe(true);
  });

  it('should match .claude/skills/ paths', () => {
    expect(isSkillMarkdownPath('.claude/skills/test/SKILL.md')).toBe(true);
  });

  it('should match generic skills/ paths', () => {
    expect(isSkillMarkdownPath('skills/coding/helper.md')).toBe(true);
  });

  it('should not match regular markdown', () => {
    expect(isSkillMarkdownPath('readme.md')).toBe(false);
  });

  it('should not match non-markdown in skills dir', () => {
    expect(isSkillMarkdownPath('skills/coding/helper.ts')).toBe(false);
  });
});

describe('parsePromptDocument', () => {
  it('should parse sections', () => {
    const doc = parsePromptDocument({
      uri: 'file:///test.prompt.md',
      text: '# Intro\nHello\n\n## Rules\nBe nice',
    });
    expect(doc.sections).toHaveLength(2);
    expect(doc.sections[0].name).toBe('Intro');
    expect(doc.sections[1].name).toBe('Rules');
  });

  it('should detect file type', () => {
    const doc = parsePromptDocument({
      uri: 'file:///test.agent.md',
      text: 'Agent content',
    });
    expect(doc.fileType).toBe('agent');
  });

  it('should detect composition links', () => {
    const doc = parsePromptDocument({
      uri: 'file:///workspace/test.prompt.md',
      text: 'See [rules](rules.agent.md) for details',
    });
    expect(doc.compositionLinks).toHaveLength(1);
    expect(doc.compositionLinks[0].target).toBe('rules.agent.md');
  });

  it('should not include non-prompt links', () => {
    const doc = parsePromptDocument({
      uri: 'file:///workspace/test.prompt.md',
      text: 'See [docs](readme.md) and [site](https://example.com)',
    });
    expect(doc.compositionLinks).toHaveLength(0);
  });

  it('should block path traversal in composition links (Fix 1)', () => {
    const doc = parsePromptDocument({
      uri: 'file:///workspace/dir/test.prompt.md',
      text: 'See [evil](../../../etc/evil.agent.md)',
      workspaceRoot: '/workspace',
    });
    expect(doc.compositionLinks).toHaveLength(1);
    expect(doc.compositionLinks[0].resolvedPath).toBeUndefined();
  });
});
