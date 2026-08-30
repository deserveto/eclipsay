import { describe, expect, it } from 'vitest';
import { coerceTitle, titleFrom } from './title';

describe('titleFrom', () => {
  it('compacts whitespace and truncates to the placeholder width', () => {
    expect(titleFrom('  I  keep\nsecond-guessing\tmyself  ')).toBe('I keep second-guessing myself');
    expect(titleFrom('a'.repeat(100))).toHaveLength(48);
  });

  it('falls back to the shared placeholder for blank input', () => {
    expect(titleFrom('   ')).toBe('New Reflection');
    expect(titleFrom('')).toBe('New Reflection');
  });
});

describe('coerceTitle', () => {
  it('strips wrapping quotes, brackets, and markdown emphasis', () => {
    expect(coerceTitle('"Choosing between two jobs"')).toBe('Choosing between two jobs');
    expect(coerceTitle('**The stuck decision**')).toBe('The stuck decision');
    expect(coerceTitle('[Night thoughts]')).toBe('Night thoughts');
  });

  it('collapses newlines and trailing punctuation stays capped', () => {
    expect(coerceTitle('Two\nlines\nbecome\none')).toBe('Two lines become one');
    expect(coerceTitle('x'.repeat(200))).toHaveLength(80);
  });

  it('falls back to the placeholder when nothing usable remains', () => {
    expect(coerceTitle('')).toBe('New Reflection');
    expect(coerceTitle('"  "')).toBe('New Reflection');
  });
});
