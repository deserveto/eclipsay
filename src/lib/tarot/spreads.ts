import type { Spread } from './types';

// P0 spread library — exact set from the plan / PRD §31.
export const SPREADS: Spread[] = [
  {
    id: 'one_card',
    title: 'One Card',
    description: 'A single perspective on whatever is on your mind.',
    positions: ['A single perspective'],
  },
  {
    id: 'three_reflection',
    title: 'Three Card Reflection',
    description: 'A gentle look at where you are and what deserves attention.',
    positions: ['Situation', 'What deserves attention', 'Possible direction'],
  },
  {
    id: 'past_present_future',
    title: 'Past / Present / Future',
    description: 'Traditional structure, interpreted reflectively.',
    positions: ['Past', 'Present', 'Future'],
  },
  {
    id: 'situation_challenge_guidance',
    title: 'Situation / Challenge / Guidance',
    description: 'A general reflection on something you are working through.',
    positions: ['Situation', 'Challenge', 'Guidance'],
  },
  {
    id: 'relationship_reflection',
    title: 'Relationship Reflection',
    description: 'Two people and the space between them.',
    positions: ['Me', 'Them', 'Dynamic'],
  },
  {
    id: 'decision_reflection',
    title: 'Decision Reflection',
    description: 'Weigh a choice from several angles at once.',
    positions: [
      'Current position',
      'What supports option A',
      'What supports option B',
      'What I may be overlooking',
      'Guidance',
    ],
  },
];

export function getSpread(id: string): Spread | undefined {
  return SPREADS.find((s) => s.id === id);
}
