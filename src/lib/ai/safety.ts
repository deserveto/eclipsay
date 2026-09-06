// Safety classifier (plan: AI layer; PRD §52–§55).
// Conservative by design: over-matching is acceptable, under-matching is not.
// `highStakes` removes tarot tools for the request and switches the prompt to
// grounded reflective language. `crisis` additionally appends crisis resources.

type Rule = {
  pattern: RegExp;
  stakes: 'high' | 'crisis';
};

// Order matters only for the crisis superset; a single hit of a crisis rule
// implies high stakes as well.
const RULES: Rule[] = [
  // Crisis: suicide / self-harm / immediate medical emergency
  { pattern: /\bsuicid(e|al)\b/i, stakes: 'crisis' },
  { pattern: /\bend(ing)?\s+(my|it\s+all|my\s+own)\s+life\b/i, stakes: 'crisis' },
  { pattern: /\bdon'?t\s+want\s+to\s+(live|be\s+here|exist|wake\s+up)\b/i, stakes: 'crisis' },
  { pattern: /\bno\s+reason\s+to\s+(live|go\s+on|continue)\b/i, stakes: 'crisis' },
  { pattern: /\b(hurt|harming|harm)\s+(myself|me)\b/i, stakes: 'crisis' },
  { pattern: /\bcut(ting)?\s+myself\b/i, stakes: 'crisis' },
  { pattern: /\bkill(ing)?\s+myself\b/i, stakes: 'crisis' },
  { pattern: /\boverdos(e|ing)\b/i, stakes: 'crisis' },
  { pattern: /\bcan'?t\s+breathe\b|\bchest\s+pains?\b/i, stakes: 'crisis' },
  { pattern: /\bnot\s+(wanting\s+)?to\s+be\s+alive\b/i, stakes: 'crisis' },
  // Audit A28: conservative multilingual coverage (executed-classifier gaps).
  // Indonesian — direct suicide/self-harm phrasing.
  { pattern: /\bbunuh\s+diri\b/i, stakes: 'crisis' },
  { pattern: /\b(ingin|mau|akan)\s+(mengakhiri|akhiri)\s+(hidup|nyawa)\b/i, stakes: 'crisis' },
  { pattern: /\btidak?\s+(ingin|mau)\s+(lagi\s+)?hidup\b/i, stakes: 'crisis' },
  { pattern: /\bmenyakiti\s+diri\b/i, stakes: 'crisis' },
  { pattern: /\bapakah\s+(saya|aku)\s+akan\s+mati\b/i, stakes: 'crisis' },
  // English — death questions and medication safety.
  { pattern: /\bwill\s+I\s+die\b/i, stakes: 'crisis' },
  { pattern: /\bam\s+I\s+going\s+to\s+die\b/i, stakes: 'crisis' },
  { pattern: /\bshould\s+I\s+stop\s+taking\s+my\s+(medication|meds|medicine|pills?)\b/i, stakes: 'high' },
  { pattern: /\bstop\s+taking\s+my\s+(medication|meds|medicine|pills?)\b/i, stakes: 'high' },

  // High stakes: abuse and coercive control
  { pattern: /\babus(e|es|ed|ive|ing)\b/i, stakes: 'high' },
  { pattern: /\bdomestic\s+violence\b/i, stakes: 'high' },
  { pattern: /\bmolest|traffick|\bassault(ed|ing)?\b/i, stakes: 'high' },
  { pattern: /\b(beaten?|hit(ting)?)\s+me\b/i, stakes: 'high' },
  { pattern: /\bcoercive\s+control\b/i, stakes: 'high' },
  { pattern: /\bkekerasan\s+(dalam\s+rumah\s+tangga|fisik)\b/i, stakes: 'high' },

  // High stakes: eating disorders
  { pattern: /\banorexi|\bbulimi|\beating\s+disorder/i, stakes: 'high' },
  { pattern: /\b(addict(ion|ed)?|relaps(e|ed|ing)|withdraw(ing|al)?)\b/i, stakes: 'high' },

  // High stakes: substance misuse
  { pattern: /\bdrinking\s+problem\b|\bsubstance\s+abus/i, stakes: 'high' },

  // High stakes: medical / legal / major financial decisions
  { pattern: /\b(diagnos(is|e|ed)|medical\s+(result|emergency|condition)|symptoms?\s+of)\b/i, stakes: 'high' },
  { pattern: /\b(lawsuit|sued|sue\s+(them|him|her)|court\s+(case|date)|arrest(ed)?|charged\s+with|custody\s+(battle|of|hearing))\b/i, stakes: 'high' },
  { pattern: /\b(bankrupt(cy)?|foreclos(e|ure)|evict(ion|ed)?|can'?t\s+pay\s+(rent|bills)|debt\s+of)\b/i, stakes: 'high' },
  // Audit A28: "bet the house" financial decisions are high stakes even
  // without debt keywords.
  { pattern: /\binvest\s+(all|my)\s+(my\s+)?(savings|money|life\s+savings)\b/i, stakes: 'high' },
  { pattern: /\ball\s+my\s+savings\b/i, stakes: 'high' },
  { pattern: /\bseluruh\s+tabungan\b/i, stakes: 'high' },

  // High stakes: harm to others
  { pattern: /\b(hurt|harm|kill|get\s+back\s+at|revenge\s+on)\s+(someone|him|her|them|my\s+(ex|boss|neighbor))\b/i, stakes: 'high' },
];

export type SafetyClassification = {
  highStakes: boolean;
  crisis: boolean;
};

export function classify(text: string): SafetyClassification {
  let highStakes = false;
  let crisis = false;
  for (const rule of RULES) {
    if (rule.pattern.test(text)) {
      if (rule.stakes === 'crisis') {
        crisis = true;
        highStakes = true;
      } else {
        highStakes = true;
      }
    }
  }
  return { highStakes, crisis };
}

export function classifyTranscript(texts: readonly string[]): SafetyClassification {
  let highStakes = false;
  let crisis = false;
  for (const text of texts) {
    const classification = classify(text);
    highStakes ||= classification.highStakes;
    crisis ||= classification.crisis;
  }
  return { highStakes, crisis };
}
