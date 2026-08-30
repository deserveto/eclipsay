import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ToolUIPart } from 'ai';
import {
  ComposerClarification,
  DECLINE_CHOICE,
  FALLBACK_FREEFORM_LABEL,
  applyCustomAnswer,
  formatClarificationAnswers,
  updateClarificationSelection,
  type ClarificationQuestion,
} from './composer-clarification';

const batch: ClarificationQuestion[] = [
  { question: 'What part of this feels heaviest?', options: ['The timing', 'The people involved'], allowMultiple: false },
  { question: 'Which angles should the reading include?', options: ['How I feel', 'Practical next steps', 'What others expect'], allowMultiple: true },
];

const part = (output: unknown, state = 'output-available') =>
  ({ type: 'tool-ask_user', toolCallId: 't1', state, input: {}, output }) as ToolUIPart;

const render = (output: unknown) => renderToStaticMarkup(
  createElement(ComposerClarification, { part: part(output), onSubmit: () => {}, markActed: () => {} }),
);

describe('updateClarificationSelection', () => {
  it('replaces the value on single-select questions', () => {
    expect(updateClarificationSelection(['The timing'], 'The people involved', false)).toEqual(['The people involved']);
  });

  it('toggles values independently on multi-select questions', () => {
    let selected = updateClarificationSelection([], 'How I feel', true);
    expect(selected).toEqual(['How I feel']);
    selected = updateClarificationSelection(selected, 'Practical next steps', true);
    expect(selected).toEqual(['How I feel', 'Practical next steps']);
    selected = updateClarificationSelection(selected, 'How I feel', true);
    expect(selected).toEqual(['Practical next steps']);
  });

  it('makes the decline choice mutually exclusive in both directions', () => {
    expect(updateClarificationSelection(['The timing'], DECLINE_CHOICE, true)).toEqual([DECLINE_CHOICE]);
    expect(updateClarificationSelection([DECLINE_CHOICE], 'The timing', false)).toEqual(['The timing']);
    expect(updateClarificationSelection([DECLINE_CHOICE], 'Practical next steps', true)).toEqual(['Practical next steps']);
  });
});

describe('applyCustomAnswer', () => {
  const options = ['The timing', 'The people'];

  it('clears the decline choice and stale custom values while typing', () => {
    expect(applyCustomAnswer([DECLINE_CHOICE], 'M', options, false)).toEqual(['M']);
    expect(applyCustomAnswer(['The timing', 'Money'], 'Money matters', options, true)).toEqual(['The timing', 'Money matters']);
  });

  it('replaces the whole selection on single-select questions', () => {
    expect(applyCustomAnswer(['The timing'], 'Both, honestly', options, false)).toEqual(['Both, honestly']);
  });

  it('keeps checked options alongside the custom answer in multi-select', () => {
    expect(applyCustomAnswer(['The timing'], 'Money matters', options, true)).toEqual(['The timing', 'Money matters']);
  });

  it('drops the custom value when the field is emptied', () => {
    expect(applyCustomAnswer(['The timing', 'Money matters'], '  ', options, true)).toEqual(['The timing']);
    expect(applyCustomAnswer(['Only custom'], '', options, false)).toEqual([]);
  });
});

describe('formatClarificationAnswers', () => {
  it('emits one `<question> — <answers>` line per question', () => {
    const text = formatClarificationAnswers(batch, [['The timing'], ['How I feel', 'Practical next steps']]);
    expect(text).toBe(
      'What part of this feels heaviest? — The timing\nWhich angles should the reading include? — How I feel, Practical next steps',
    );
  });
});

describe('ComposerClarification', () => {
  it('renders the progress header, per-question instruction, and pressable options', () => {
    const html = render({ questions: batch });
    expect(html).toContain('Question 1 of 2');
    expect(html).toContain('Choose one');
    expect(html).toContain('What part of this feels heaviest?');
    expect(html).toContain('The timing');
    expect(html).toContain('I&#x27;d rather not say');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('Next');
    expect(html).not.toContain('Send answers');
  });

  it('labels multi-select questions with the select-all instruction', () => {
    const html = render({ questions: [batch[1]] });
    expect(html).toContain('Select all that apply');
    expect(html).not.toContain('Choose one');
    expect(html).toContain('Send answers');
  });

  it('renders the free-answer field with the English fallback label', () => {
    const html = render({ questions: [batch[0]] });
    expect(html).toContain(`placeholder="${FALLBACK_FREEFORM_LABEL}"`);
    expect(html).toContain(`aria-label="${FALLBACK_FREEFORM_LABEL}"`);
  });

  it('uses the model-provided localized label for the free-answer field', () => {
    const html = render({ questions: [batch[0]], freeformLabel: 'Scrivi la tua risposta…' });
    expect(html).toContain('placeholder="Scrivi la tua risposta…"');
    expect(html).toContain('aria-label="Scrivi la tua risposta…"');
    expect(html).not.toContain(FALLBACK_FREEFORM_LABEL);
  });

  it('renders nothing when the freeformLabel is malformed', () => {
    expect(render({ questions: [batch[0]], freeformLabel: 'ab' })).toBe('');
  });

  it('renders nothing for pre-cutover single-question payloads', () => {
    expect(render({ question: 'What feels heaviest?', options: ['Timing', 'Money'] })).toBe('');
  });

  it('renders nothing for malformed or missing output', () => {
    expect(render(undefined)).toBe('');
    expect(render({ questions: [] })).toBe('');
    expect(render({ questions: [{ question: 'Nope', options: ['A', 'B'], allowMultiple: false }] })).toBe('');
    expect(render({ questions: [{ question: 'Valid question wording?', options: ['Only one'], allowMultiple: false }] })).toBe('');
  });
});
