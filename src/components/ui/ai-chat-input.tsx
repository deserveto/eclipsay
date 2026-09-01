'use client';

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ArrowUp, Clock3, LoaderCircle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AiChatInputProps {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  onOpenCheckIn: () => void;
  onExploreCards: () => void;
  cardsDisabled?: boolean;
  busy?: boolean;
  placeholder?: string;
  className?: string;
}

export function AiChatInput({
  value,
  onValueChange,
  onSubmit,
  onOpenCheckIn,
  onExploreCards,
  cardsDisabled = false,
  busy = false,
  placeholder = "Share what's on your mind…",
  className,
}: AiChatInputProps) {
  const [focused, setFocused] = useState(false);
  const textareaHeight = useRef(52);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasValue = value.trim().length > 0;
  const expanded = focused || hasValue || busy;

  useEffect(() => {
    const form = formRef.current;
    const textarea = textareaRef.current;
    const nextHeight = textarea ? Math.max(52, Math.min(textarea.scrollHeight, 160)) : textareaHeight.current;
    textareaHeight.current = nextHeight;
    if (form) form.style.height = `${expanded ? nextHeight + 44 : 52}px`;
    if (!textarea) return;
    textarea.style.height = `${nextHeight}px`;
  }, [value, expanded]);

  const submit = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (busy || !hasValue) return;
    onSubmit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing || event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    if (!busy && hasValue) onSubmit();
  };

  return (
    <form
      ref={formRef}
      aria-busy={busy}
      data-expanded={expanded}
      onSubmit={submit}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!formRef.current?.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
      onMouseDown={(event) => {
        if (event.target === formRef.current) textareaRef.current?.focus();
      }}
      style={{ height: expanded ? textareaHeight.current + 44 : 52 }}
      className={cn(
        'relative w-full overflow-hidden rounded-[22px] border border-border bg-card',
        'transition-[height,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
        'hover:border-foreground/15 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20',
        'motion-reduce:transition-none',
        className,
      )}
    >
      <textarea
        ref={textareaRef}
        value={value}
        rows={1}
        aria-label="Message"
        placeholder={placeholder}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={handleKeyDown}
        className={cn(
          'absolute inset-x-0 top-0 w-full resize-none overflow-y-auto bg-transparent px-4 py-[15px] pr-14',
          'text-base leading-[22px] text-foreground caret-primary outline-none placeholder:text-muted-foreground',
          'transition-[height] duration-200 ease-out sm:text-sm motion-reduce:transition-none',
        )}
      />

      <div className="absolute bottom-2 left-2.5 right-14 flex h-9 items-center gap-1">
        <button
          type="button"
          aria-label="Check in with me later"
          title="Check in with me later"
          onClick={onOpenCheckIn}
          className={cn(
            'relative inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground',
            'outline-none transition-colors hover:bg-muted hover:text-foreground',
            'focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px',
            'after:absolute after:-inset-1.5 after:content-[\"\"]',
          )}
        >
          <Clock3 className="size-3.5" aria-hidden />
          <span>Check in</span>
        </button>
        {!cardsDisabled && (
          <button
            type="button"
            aria-label="Explore with cards"
            title="Explore with cards"
            onClick={onExploreCards}
            className={cn(
              'relative inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground',
              'outline-none transition-colors hover:bg-muted hover:text-foreground',
              'focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px',
              'after:absolute after:-inset-1.5 after:content-[\"\"]',
            )}
          >
            <Sparkles className="size-3.5" aria-hidden />
            <span>Cards</span>
          </button>
        )}

        {busy && (
          <span className="ml-auto inline-flex items-center gap-1.5 pr-1 text-xs text-muted-foreground" aria-live="polite">
            <span className="size-1.5 animate-pulse rounded-full bg-primary motion-reduce:animate-none" aria-hidden />
            Reflecting…
          </span>
        )}
      </div>

      <button
        type="submit"
        aria-label="Send"
        title="Send"
        disabled={busy || !hasValue}
        className={cn(
          'absolute bottom-1.5 right-1.5 flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground',
          'outline-none transition-[background-color,transform,opacity] duration-200',
          'hover:bg-[color-mix(in_oklch,var(--primary),var(--foreground)_8%)] focus-visible:ring-3 focus-visible:ring-ring/50',
          'active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none',
          'after:absolute after:-inset-0.5 after:content-[\"\"]',
        )}
      >
        {busy ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <ArrowUp className="size-4" aria-hidden />}
      </button>
    </form>
  );
}
