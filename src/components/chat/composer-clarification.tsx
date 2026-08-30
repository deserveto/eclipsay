'use client';

import { useState } from 'react';
import type { ToolUIPart } from 'ai';
import { Button } from '@/components/ui/button';

// Progressive clarification panel (PRD §30, §62): the model's ask_user batch
// renders here, one question at a time, docked above the composer — a
// continuation of the assistant's reply, never a modal. The component is
// app-controlled: it validates the payload, owns selection state, and emits
// the answers as one ordinary user message.

export type ClarificationQuestion = {
  question: string;
  options: string[];
  allowMultiple: boolean;
};

/** App-added decline choice; mutually exclusive with real answers. */
export const DECLINE_CHOICE = "I'd rather not say";

export type ClarificationBatch = { questions: ClarificationQuestion[]; freeformLabel?: string };

/** Output contract at render time; pre-cutover single-question payloads fail this and render nothing. */
export function isQuestionBatch(value: unknown): value is ClarificationBatch {
  if (typeof value !== 'object' || value === null || !('questions' in value)) return false;
  const questions: unknown = value.questions;
  if (!Array.isArray(questions) || questions.length < 1 || questions.length > 3) return false;
  if (!questions.every((entry): entry is ClarificationQuestion => {
    if (typeof entry !== 'object' || entry === null) return false;
    if (!('question' in entry) || !('options' in entry) || !('allowMultiple' in entry)) return false;
    const { question, options, allowMultiple } = entry;
    return (
      typeof question === 'string' &&
      question.length >= 5 &&
      Array.isArray(options) &&
      options.length >= 2 &&
      options.every((option) => typeof option === 'string' && option.length > 0 && option.length <= 80) &&
      typeof allowMultiple === 'boolean'
    );
  })) {
    return false;
  }
  if (!('freeformLabel' in value) || value.freeformLabel === undefined) return true;
  const label: unknown = value.freeformLabel;
  return typeof label === 'string' && label.trim().length >= 3 && label.length <= 80;
}

/** Chrome fallback when the model omits its localized freeformLabel. */
export const FALLBACK_FREEFORM_LABEL = 'Type your own…';

/**
 * Folds a typed custom answer into the selection: clears the decline choice
 * and any stale custom value, keeps checked options in multi-select,
 * replaces everything in single-select. Blank text removes the custom value.
 */
export function applyCustomAnswer(current: string[], text: string, options: string[], allowMultiple: boolean): string[] {
  const trimmed = text.trim();
  const kept = current.filter((value) => options.includes(value));
  if (trimmed.length === 0) return kept;
  if (!allowMultiple) return [trimmed];
  return [...kept, trimmed];
}

/** Single-select replaces (decline clears first); multi-select toggles; decline is exclusive both ways. */
export function updateClarificationSelection(current: string[], option: string, allowMultiple: boolean): string[] {
  if (option === DECLINE_CHOICE) return [DECLINE_CHOICE];
  const answers = current.filter((value) => value !== DECLINE_CHOICE);
  if (!allowMultiple) return [option];
  return answers.includes(option) ? answers.filter((value) => value !== option) : [...answers, option];
}

/** One line per question: `<question> — <selected option[, selected option…]>`. */
export function formatClarificationAnswers(questions: ClarificationQuestion[], selections: string[][]): string {
  return questions.map((q, i) => `${q.question} — ${(selections[i] ?? []).join(', ')}`).join('\n');
}

export function ComposerClarification({
  part,
  onSubmit,
  markActed,
}: {
  part: ToolUIPart;
  onSubmit: (text: string) => void;
  markActed: (toolCallId: string) => void;
}) {
  const batch = part.state === 'output-available' && isQuestionBatch(part.output) ? part.output : null;
  const [step, setStep] = useState(0);
  const [selections, setSelections] = useState<string[][]>(() =>
    batch ? batch.questions.map(() => [] as string[]) : [],
  );
  // One draft per question, keyed by question index so Back/Next preserve it.
  const [customValues, setCustomValues] = useState<string[]>(() =>
    batch ? batch.questions.map(() => '') : [],
  );

  if (!batch) return null;
  const questions = batch.questions;
  const index = Math.min(step, questions.length - 1);
  const question = questions[index];
  const selected = selections[index] ?? [];
  const answered = selected.length > 0;
  const isLast = index === questions.length - 1;
  const freeformLabel = batch.freeformLabel ?? FALLBACK_FREEFORM_LABEL;
  const customText = customValues[index] ?? '';
  const customSelected = selected.some((value) => !question.options.includes(value) && value !== DECLINE_CHOICE);

  const choose = (option: string) => {
    setSelections((prev) =>
      prev.map((values, i) => (i === index ? updateClarificationSelection(values, option, question.allowMultiple) : values)),
    );
  };

  const setCustomValue = (text: string) => {
    setCustomValues((prev) => prev.map((value, i) => (i === index ? text : value)));
    setSelections((prev) =>
      prev.map((values, i) => (i === index ? applyCustomAnswer(values, text, question.options, question.allowMultiple) : values)),
    );
  };
  const submit = () => {
    if (!answered) return;
    // Acted first so the panel retires atomically with the send.
    markActed(part.toolCallId);
    onSubmit(formatClarificationAnswers(questions, selections));
  };

  return (
    <section
      aria-label="Clarifying questions"
      className="animate-[eclipsay-rise-in_250ms_ease-out] rounded-3xl border border-border bg-card p-4 motion-reduce:animate-none"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase" aria-live="polite">
          Question {index + 1} of {questions.length}
        </p>
        <p className="text-xs text-muted-foreground">{question.allowMultiple ? 'Select all that apply' : 'Choose one'}</p>
      </div>

      <p className="mt-2 text-[15px] leading-7">{question.question}</p>

      <div className="mt-3 flex flex-col gap-1.5" role="group" aria-label={question.question}>
        {question.options.map((option) => {
          const pressed = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={pressed}
              onClick={() => choose(option)}
              className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors motion-reduce:transition-none ${
                pressed ? 'border-primary/40 bg-primary/10 font-medium text-primary' : 'border-border hover:bg-accent'
              }`}
            >
              {option}
            </button>
          );
        })}
        <input
          type="text"
          value={customText}
          onChange={(event) => setCustomValue(event.target.value)}
          placeholder={freeformLabel}
          aria-label={freeformLabel}
          className={`rounded-xl border bg-transparent px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
            customSelected ? 'border-primary/40' : 'border-border'
          }`}
        />
        <button
          type="button"
          aria-pressed={selected.includes(DECLINE_CHOICE)}
          onClick={() => choose(DECLINE_CHOICE)}
          className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors motion-reduce:transition-none ${
            selected.includes(DECLINE_CHOICE)
              ? 'border-primary/40 bg-primary/10 font-medium text-primary'
              : 'border-border text-muted-foreground hover:bg-accent'
          }`}
        >
          {DECLINE_CHOICE}
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={index === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          Back
        </Button>
        {isLast ? (
          <Button type="button" size="sm" disabled={!answered} onClick={submit}>
            Send answers
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!answered}
            onClick={() => setStep((s) => Math.min(questions.length - 1, s + 1))}
          >
            Next
          </Button>
        )}
      </div>
    </section>
  );
}
