'use client';


type Resource = {
  label: string;
  href: string;
  hint: string;
  external?: boolean;
};

// Concrete resources shown on the card (PRD §52–§55). Deterministic list —
// same transcript state, same render, every time.
const RESOURCES: Resource[] = [
  { label: '988 Suicide & Crisis Lifeline', href: 'tel:988', hint: 'call or text 988 (US)' },
  { label: 'findahelpline.com', href: 'https://findahelpline.com', hint: 'international hotlines', external: true },
];

// Quiet crisis support card: acknowledges what they're carrying, then offers
// two concrete places to reach a person. No guilt, no repetition, no motion —
// it renders at most once per exchange and simply sits there until needed.
export function CrisisResources() {
  return (
    <div role="note" aria-label="Crisis support resources" className="rounded-2xl border border-border bg-card px-4 py-3.5">
      <p className="text-sm font-medium">That sounds heavy to be carrying.</p>
      <p className="mt-1 text-sm text-muted-foreground">
        You don&apos;t have to hold this by yourself. If you&apos;d like a person right now, these are free and confidential:
      </p>
      <ul className="mt-2 flex flex-col gap-1 text-sm">
        {RESOURCES.map((resource) => (
          <li key={resource.href}>
            <a
              href={resource.href}
              target={resource.external ? '_blank' : undefined}
              rel={resource.external ? 'noopener noreferrer' : undefined}
              className="underline underline-offset-2 hover:text-foreground"
            >
              {resource.label}
            </a>{' '}
            <span className="text-muted-foreground">
              — {resource.hint}
              {resource.external ? ' (opens in a new tab)' : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
