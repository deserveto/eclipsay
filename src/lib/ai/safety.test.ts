import { describe, expect, it } from 'vitest';
import { classify } from './safety';

const crisisCases = [
  'I have been having suicidal thoughts lately',
  'sometimes I think about killing myself',
  'I want to end my life',
  "I don't want to live anymore",
  'there is no reason to go on',
  'I keep cutting myself when it gets bad',
  'I took an overdose last night',
];

const highStakesCases = [
  'my partner is abusive and I feel trapped',
  'I think I have an eating disorder',
  'I was arrested last week and my court date is coming',
  'we are facing foreclosure next month',
  'I want revenge on my boss',
  'I just got my medical diagnosis results',
  'I relapsed after two years clean',
];

const negativeCases = [
  "I don't know whether I'm actually unhappy at work or just exhausted",
  'my job is killing my motivation',
  'I feel stuck between two choices',
  'my friend is going through a hard time and I want to help',
  'I am stressed about money this month',
  'the deadlines at work are killing me, ha',
];

describe('safety classifier', () => {
  it('marks crisis cases as crisis and high stakes', () => {
    for (const text of crisisCases) {
      expect(classify(text), text).toEqual({ highStakes: true, crisis: true });
    }
  });

  it('marks high-stakes cases without crisis flag', () => {
    for (const text of highStakesCases) {
      expect(classify(text), text).toEqual({ highStakes: true, crisis: false });
    }
  });

  it('passes ordinary reflections through', () => {
    for (const text of negativeCases) {
      expect(classify(text), text).toEqual({ highStakes: false, crisis: false });
    }
  });
});
