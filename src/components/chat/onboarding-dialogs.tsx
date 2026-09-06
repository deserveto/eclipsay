'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { loadGuestStore, saveGuestProfile } from '@/lib/guest/store';
import type { ReflectionGoal, TarotFamiliarity } from '@/lib/types';

// Micro onboarding (PRD §12): two optional questions on first /reflect visit.
// Every question is skippable; answers personalize later prompts.

const GOALS: { value: ReflectionGoal; label: string }[] = [
  { value: 'feelings', label: 'Understand my feelings' },
  { value: 'decisions', label: 'Think through decisions' },
  { value: 'relationships', label: 'Relationships' },
  { value: 'growth', label: 'Personal growth' },
  { value: 'exploring', label: 'Just exploring' },
];

const FAMILIARITY: { value: TarotFamiliarity; label: string }[] = [
  { value: 'new', label: 'New to tarot' },
  { value: 'some', label: 'A little familiar' },
  { value: 'very', label: 'Very familiar' },
];

export function OnboardingDialogs({ eligible }: { eligible: boolean }) {
  // Audit A36: the age step runs first and CANNOT be silently skipped — the
  // 13+ product floor needs an answer before the personalized steps. The
  // answer is a coarse bracket only (never a birth date); it drives the
  // conservative 13–17 prompt policy server-side via guestAdultConfirmed.
  const [step, setStep] = useState<'idle' | 'age' | 'goal' | 'familiarity'>('idle');
  useEffect(() => {
    if (eligible && !loadGuestStore().onboardingDone) setStep('age');
  }, [eligible]);
  const finish = () => {
    saveGuestProfile({ onboardingDone: true });
    setStep('idle');
  };

  return (
    <>
      <Dialog
        open={step === 'age'}
        onOpenChange={(o) => {
          if (!o) finish();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>First, a quick check</DialogTitle>
            <DialogDescription>
              Eclipsay is built for ages 13 and up. Your answer stays on this device — it only tunes how
              carefully Eclipsay responds.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button
              variant="secondary"
              className="justify-start"
              onClick={() => {
                saveGuestProfile({ ageBracket: '18_plus' });
                setStep('goal');
              }}
            >
              I&apos;m 18 or older
            </Button>
            <Button
              variant="secondary"
              className="justify-start"
              onClick={() => {
                saveGuestProfile({ ageBracket: '13_17' });
                setStep('goal');
              }}
            >
              I&apos;m 13–17
            </Button>
            <Button variant="ghost" onClick={finish}>
              Prefer not to say
            </Button>
            <p className="text-xs text-muted-foreground">
              Under 13? Eclipsay isn&apos;t available yet — please close this tab.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={step === 'goal'}
        onOpenChange={(o) => {
          if (!o) finish();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>What would you like this space to help you with?</DialogTitle>
            <DialogDescription>Just a preference — it shapes how I respond, nothing more.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {GOALS.map((g) => (
              <Button
                key={g.value}
                variant="secondary"
                className="justify-start"
                onClick={() => {
                  saveGuestProfile({ reflectionGoal: g.value });
                  setStep('familiarity');
                }}
              >
                {g.label}
              </Button>
            ))}
            <Button variant="ghost" onClick={finish}>
              Skip
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={step === 'familiarity'}
        onOpenChange={(o) => {
          if (!o) finish();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>How familiar are you with tarot?</DialogTitle>
            <DialogDescription>This decides how much I explain card meanings.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {FAMILIARITY.map((f) => (
              <Button
                key={f.value}
                variant="secondary"
                className="justify-start"
                onClick={() => {
                  saveGuestProfile({ tarotFamiliarity: f.value });
                  finish();
                }}
              >
                {f.label}
              </Button>
            ))}
            <Button variant="ghost" onClick={finish}>
              Skip
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
