'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

// Admin-only model configuration (plan: AI admin config). Rendered by the
// settings page solely when the server-side admin gate passes; the API
// re-checks on every call. Changes apply within about a minute (config cache).

type ReasoningEffort = 'low' | 'medium' | 'high';

interface AiModelSlot {
  provider: string;
  model: string;
  reasoning?: { effort: ReasoningEffort };
}

interface AdminModelOption {
  id: string;
  name: string;
}

const EFFORT_OPTIONS: { value: ReasoningEffort | 'none'; label: string }[] = [
  { value: 'none', label: 'No thinking (fastest)' },
  { value: 'low', label: 'Low effort' },
  { value: 'medium', label: 'Medium effort' },
  { value: 'high', label: 'High effort (deepest, slowest)' },
];

const PROVIDER_LABELS: Record<string, string> = {
  openrouter: 'OpenRouter',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  poolside: 'Poolside',
};

interface SlotEditorProps {
  title: string;
  description: string;
  slot: AiModelSlot;
  showReasoning: boolean;
  reasoningCapable: string[];
  providers: string[];
  options: AdminModelOption[] | undefined;
  loadOptions: (provider: string) => void;
  onChange: (slot: AiModelSlot) => void;
}

function SlotEditor({
  title,
  description,
  slot,
  showReasoning,
  reasoningCapable,
  providers,
  options,
  loadOptions,
  onChange,
}: SlotEditorProps) {
  const datalistId = `model-options-${title.toLowerCase().replace(/\s+/g, '-')}`;
  const canReason = reasoningCapable.includes(slot.provider);

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <Label className="text-base">{title}</Label>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${datalistId}-provider`}>Provider</Label>
          <Select
            value={slot.provider}
            onValueChange={(value) => {
              loadOptions(value);
              // Model ids are provider-specific — drop the stale one.
              onChange({ ...slot, provider: value, model: '', reasoning: slot.reasoning });
            }}
          >
            <SelectTrigger id={`${datalistId}-provider`} className="w-full">
              <SelectValue placeholder="Choose a provider" />
            </SelectTrigger>
            <SelectContent>
              {providers.map((id) => (
                <SelectItem key={id} value={id}>
                  {PROVIDER_LABELS[id] ?? id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${datalistId}-model`}>Model id</Label>
          <Input
            id={`${datalistId}-model`}
            list={datalistId}
            value={slot.model}
            placeholder="provider/model-id"
            onChange={(event) => onChange({ ...slot, model: event.target.value })}
          />
          <datalist id={datalistId}>
            {(options ?? []).map((option) => (
              <option key={option.id} value={option.id}>
                {option.name !== option.id ? option.name : undefined}
              </option>
            ))}
          </datalist>
        </div>
      </div>

      {showReasoning ? (
        <div className="space-y-2">
          <Label htmlFor={`${datalistId}-effort`}>Thinking</Label>
          <Select
            value={slot.reasoning?.effort ?? 'none'}
            disabled={!canReason}
            onValueChange={(value) => {
              onChange({
                ...slot,
                reasoning: value === 'none' ? undefined : { effort: value as ReasoningEffort },
              });
            }}
          >
            <SelectTrigger id={`${datalistId}-effort`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EFFORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            {canReason
              ? 'Thinking trades latency for depth. Reasoning text is never shown or stored.'
              : 'This provider has no thinking control.'}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function AiModelAdmin() {
  const [providers, setProviders] = useState<string[]>([]);
  const [reasoningCapable, setReasoningCapable] = useState<string[]>([]);
  const [chat, setChat] = useState<AiModelSlot | null>(null);
  const [utility, setUtility] = useState<AiModelSlot | null>(null);
  const [options, setOptions] = useState<Record<string, AdminModelOption[]>>({});
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/ai-config');
        if (!res.ok) return; // gate flipped after render — stay hidden
        const json = (await res.json()) as {
          config?: { chat?: AiModelSlot; utility?: AiModelSlot };
          providers?: string[];
          reasoningCapable?: string[];
        };
        if (cancelled || !json.config?.chat || !json.config.utility) return;
        setProviders(json.providers ?? []);
        setReasoningCapable(json.reasoningCapable ?? []);
        setChat(json.config.chat);
        setUtility(json.config.utility);
        setLoaded(true);
      } catch {
        // stay hidden on network failure
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadOptions = useCallback(
    (provider: string) => {
      if (!provider || options[provider]) return;
      (async () => {
        try {
          const res = await fetch(`/api/admin/models?provider=${encodeURIComponent(provider)}`);
          if (!res.ok) return; // picker stays free-text on failure
          const json = (await res.json()) as { models?: AdminModelOption[] };
          setOptions((prev) => ({ ...prev, [provider]: json.models ?? [] }));
        } catch {
          // picker stays free-text on failure
        }
      })();
    },
    [options],
  );

  const save = async () => {
    if (!chat || !utility) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/ai-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat, utility }),
      });
      if (!res.ok) {
        toast.error('Could not save the model configuration.');
        return;
      }
      toast.success('Model configuration saved. It applies within about a minute.');
    } catch {
      toast.error('Could not save the model configuration.');
    } finally {
      setSaving(false);
    }
  };

  if (!loaded || !chat || !utility) return null;

  return (
    <section className="mx-auto w-full max-w-2xl space-y-6 px-4 pb-8">
      <div>
        <h2 className="text-lg font-semibold">AI models</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Pick which model powers the companion and the quick utilities (session titles, journal
          notes). Model suggestions load from each provider when available.
        </p>
      </div>

      <SlotEditor
        title="Chat model"
        description="Used for reflective conversations and tarot guidance."
        slot={chat}
        showReasoning
        reasoningCapable={reasoningCapable}
        providers={providers}
        options={options[chat.provider]}
        loadOptions={loadOptions}
        onChange={setChat}
      />

      <SlotEditor
        title="Utility model"
        description="Used for session titles and journal notes — a small, fast model is fine."
        slot={utility}
        showReasoning={false}
        reasoningCapable={reasoningCapable}
        providers={providers}
        options={options[utility.provider]}
        loadOptions={loadOptions}
        onChange={setUtility}
      />

      <Button onClick={save} disabled={saving || !chat.model.trim() || !utility.model.trim()}>
        {saving ? 'Saving…' : 'Save model configuration'}
      </Button>
    </section>
  );
}
