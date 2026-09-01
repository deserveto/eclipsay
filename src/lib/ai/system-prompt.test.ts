import { describe, expect, it } from 'vitest';
import { buildSystemPrompt } from './system-prompt';
import { classify } from './safety';

// Prompt-boundary privacy tests (plan: Accounts §7): the nickname and the
// teen band are the only identity signals allowed into the prompt — the full
// legal name, email, and birth date must never appear, even when present on
// the profile object.

const safety = classify('work has been heavy lately');

const identityProfile = {
  // Fields outside the PromptProfile pick must never leak into the prompt.
  full_name: 'Priya Nair-Whitfield-XYZQ',
  display_name: 'Priya',
  date_of_birth: '2005-04-11',
  reflection_goal: null,
  tarot_familiarity: null,
  memory_enabled: true,
} as const;

describe('nickname guidance', () => {
  it('instructs sparing nickname use only when display_name exists', () => {
    const withNickname = buildSystemPrompt({ profile: identityProfile, safety });
    expect(withNickname).toContain('Priya');
    expect(withNickname).toContain('sparingly and naturally');

    const withoutNickname = buildSystemPrompt({ profile: { ...identityProfile, display_name: null }, safety });
    expect(withoutNickname).not.toContain('sparingly and naturally');
  });
});

describe('teen band guidance', () => {
  it('includes conservative teen guidance only when teenUser is true', () => {
    const teen = buildSystemPrompt({ profile: identityProfile, safety, teenUser: true });
    expect(teen).toContain('13–17');

    const adult = buildSystemPrompt({ profile: identityProfile, safety, teenUser: false });
    expect(adult).not.toContain('13–17');

    const omitted = buildSystemPrompt({ profile: identityProfile, safety });
    expect(omitted).not.toContain('13–17');
  });
});

describe('prompt privacy boundary', () => {
  it('never emits the full legal name, email, or birth date', () => {
    const prompt = buildSystemPrompt({
      profile: identityProfile,
      safety,
      teenUser: true,
      memories: [{ content: 'private fact', category: 'context' }],
      approvedContext: [{ title: 'entry', body: 'entry body' }],
    });
    expect(prompt).not.toContain(identityProfile.full_name);
    expect(prompt).not.toContain(identityProfile.date_of_birth);
    expect(prompt).not.toContain('@');
  });
});

describe('sticky tarot boundary', () => {
  it('keeps grounded reflection available while disabling tarot for the session', () => {
    const prompt = buildSystemPrompt({ profile: null, safety, tarotUnavailable: true });
    expect(prompt).toContain('Tarot is unavailable for the remainder of this reflection.');
    expect(prompt).toContain('Continue with ordinary grounded reflection and conversation.');
    expect(prompt).toContain('Do not use tarot tools, card language, card suggestions, or card interpretation.');
  });
});
