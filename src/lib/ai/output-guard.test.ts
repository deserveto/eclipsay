import { describe, expect, it } from 'vitest';
import { guardGeneratedOutput } from './output-guard';

describe('guardGeneratedOutput', () => {
  it('returns normal prose after trimming surrounding whitespace', () => {
    expect(guardGeneratedOutput('  A thoughtful reflection.  ')).toBe('A thoughtful reflection.');
  });

  it('preserves meaningful multiline prose', () => {
    expect(guardGeneratedOutput('  First line.\n\nSecond line.  ')).toBe('First line.\n\nSecond line.');
  });

  it('rejects empty and too-short output', () => {
    expect(guardGeneratedOutput('   ')).toBeNull();
    expect(guardGeneratedOutput('short', 6)).toBeNull();
  });

  it('rejects safety label prefixes', () => {
    expect(guardGeneratedOutput('User Safety: safe')).toBeNull();
    expect(guardGeneratedOutput('Safety: high')).toBeNull();
    expect(guardGeneratedOutput('Classification=crisis')).toBeNull();
    expect(guardGeneratedOutput('Risk-high_stakes')).toBeNull();
  });

  it('rejects marker-only output', () => {
    expect(guardGeneratedOutput('safe')).toBeNull();
    expect(guardGeneratedOutput('high_stakes')).toBeNull();
    expect(guardGeneratedOutput('crisis')).toBeNull();
  });

  it('supports the journal-note minimum length', () => {
    expect(guardGeneratedOutput('Too short', 12)).toBeNull();
    expect(guardGeneratedOutput('A useful note.', 12)).toBe('A useful note.');
  });
});
