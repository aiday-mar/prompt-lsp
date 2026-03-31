import { describe, it, expect, beforeEach } from 'vitest';
import { StaticAnalyzer } from '../analyzers/static';
import { makeDoc } from './helpers';

describe('StaticAnalyzer', () => {
  let analyzer: StaticAnalyzer;

  beforeEach(() => {
    analyzer = new StaticAnalyzer();
  });

  describe('ambiguity detection', () => {
    it('should flag ambiguous quantifiers', () => {
      const doc = makeDoc('Include a few examples in your response.');
      const results = analyzer.analyze(doc);
      const ambiguous = results.find(r => r.code === 'ambiguous-quantifier');
      expect(ambiguous).toBeDefined();
    });

    it('should flag vague terms', () => {
      const doc = makeDoc('Write in a professional manner.');
      const results = analyzer.analyze(doc);
      const vague = results.find(r => r.code === 'vague-term');
      expect(vague).toBeDefined();
    });

    it('should flag unresolved references', () => {
      const doc = makeDoc('Follow the format mentioned above.');
      const results = analyzer.analyze(doc);
      const unresolved = results.find(r => r.code === 'unresolved-reference');
      expect(unresolved).toBeDefined();
    });
  });

  describe('analyze (integration)', () => {
    it('should run all analyzers on a complex document', () => {
      const doc = makeDoc(
        '# System Prompt\n\n' +
        'You are a helpful assistant.\n\n' +
        '## Rules\n\n' +
        'Include a few examples in your response.\n' +
        'Follow the format mentioned above.\n\n' +
        '## User Input\n\n' +
        'Hello world\n'
      );
      const results = analyzer.analyze(doc);
      // Should have results from ambiguity-detection
      const analyzers = new Set(results.map(r => r.analyzer));
      expect(analyzers.size).toBeGreaterThanOrEqual(1);
    });

    it('should return results with required fields', () => {
      const doc = makeDoc('Include a few items.');
      const results = analyzer.analyze(doc);

      for (const result of results) {
        expect(result).toHaveProperty('code');
        expect(result).toHaveProperty('message');
        expect(result).toHaveProperty('severity');
        expect(result).toHaveProperty('range');
        expect(result).toHaveProperty('analyzer');
        expect(['error', 'warning', 'info', 'hint']).toContain(result.severity);
      }
    });
  });

  describe('getTokenInfo', () => {
    it('should return total token count', () => {
      const doc = makeDoc('Hello world, this is a test document.');
      const info = analyzer.getTokenInfo(doc);
      expect(info.totalTokens).toBeGreaterThan(0);
    });

    it('should return per-section token counts', () => {
      const doc = makeDoc(
        '# Introduction\n\nThis is the intro section.\n\n' +
        '# Rules\n\nThese are the rules for the assistant.\n\n' +
        '# Examples\n\nHere is an example.'
      );
      const info = analyzer.getTokenInfo(doc);
      expect(info.sections.size).toBe(3);
      expect(info.sections.has('Introduction')).toBe(true);
      expect(info.sections.has('Rules')).toBe(true);
      expect(info.sections.has('Examples')).toBe(true);
      for (const [, tokens] of info.sections) {
        expect(tokens).toBeGreaterThan(0);
      }
    });

    it('should return empty sections map when no headers present', () => {
      const doc = makeDoc('Just some plain text without headers.');
      const info = analyzer.getTokenInfo(doc);
      expect(info.sections.size).toBe(0);
      expect(info.totalTokens).toBeGreaterThan(0);
    });

  });

  describe('getTokenCount', () => {
    it('should count tokens accurately', () => {
      const count = analyzer.getTokenCount('Hello, world!');
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(20);
    });

    it('should return higher count for longer text', () => {
      const short = analyzer.getTokenCount('Hello');
      const long = analyzer.getTokenCount('Hello world, this is a much longer sentence with many more tokens.');
      expect(long).toBeGreaterThan(short);
    });
  });

  describe('dispose', () => {
    it('should free encoders without error', () => {
      // Trigger encoder creation
      analyzer.getTokenCount('test');
      expect(() => analyzer.dispose()).not.toThrow();
    });

    it('should allow re-creation after dispose', () => {
      analyzer.getTokenCount('test');
      analyzer.dispose();
      // Should create a new encoder
      const count = analyzer.getTokenCount('Hello again');
      expect(count).toBeGreaterThan(0);
    });
  });
});
