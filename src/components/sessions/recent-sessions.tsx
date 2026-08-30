'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Loader2, MoreHorizontal, PencilLine, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useDataMode } from '@/hooks/use-data-mode';
import { deleteSession, generateSessionTitle, renameSession } from '@/lib/chat/session-actions';
import { SESSIONS_CHANGED_EVENT } from '@/lib/chat/session-events';
import { TITLE_MAX } from '@/lib/chat/title';
import { getGuestSession, loadGuestStore } from '@/lib/guest/store';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

type SessionSummary = { id: string; title: string; updated_at: string };

function recentLabel(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  const days = Math.round(mins / 1440);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Recent reflection threads (PRD §34). Every row carries a per-session menu:
// generate an AI title, rename inline, or delete. Guests mutate the local
// store (its event refreshes this list); accounts go through the REST routes
// and this list refreshes on `eclipsay:sessions-changed` and on navigation.
export function RecentSessions({ onNavigate }: { onNavigate?: () => void }) {
  const { mode } = useDataMode();
  const pathname = usePathname();
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (mode === 'account' && isSupabaseConfigured()) {
      const supabase = createClient();
      const { data } = await supabase
        .from('reflection_sessions')
        .select('id, title, updated_at')
        .order('updated_at', { ascending: false })
        .limit(20);
      setSessions((data ?? []) as SessionSummary[]);
      return;
    }
    const store = loadGuestStore();
    setSessions(
      [...store.sessions]
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .slice(0, 20)
        .map((s) => ({ id: s.id, title: s.title, updated_at: s.updated_at })),
    );
  }, [mode]);

  useEffect(() => {
    void refresh();
    // Guests: every store mutator dispatches `eclipsay:guest-store-changed`.
    // Accounts: session actions dispatch `eclipsay:sessions-changed`.
    window.addEventListener('eclipsay:guest-store-changed', refresh);
    window.addEventListener(SESSIONS_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener('eclipsay:guest-store-changed', refresh);
      window.removeEventListener(SESSIONS_CHANGED_EVENT, refresh);
    };
    // Re-running on navigation keeps a title renamed or deleted in another
    // surface from lingering here; `refresh` is stable per mode.
  }, [refresh, pathname]);

  const firstExchangeTexts = (sessionId: string): { userText: string; assistantText: string } | null => {
    const session = getGuestSession(sessionId);
    const userText = session?.messages.find((m) => m.role === 'user')?.content ?? '';
    const assistantText = session?.messages.find((m) => m.role === 'assistant')?.content ?? '';
    if (userText.length === 0) return null;
    return { userText, assistantText };
  };

  const handleGenerate = async (id: string) => {
    setGeneratingFor(id);
    const guestTexts = mode === 'guest' ? firstExchangeTexts(id) : null;
    // Accounts let the route derive the first exchange from the DB.
    const title = await generateSessionTitle({ sessionId: id, mode, overwrite: true, ...guestTexts });
    setGeneratingFor(null);
    if (title === null) toast.error('Could not generate a title.');
    else toast.success('Title generated.');
  };

  const commitRename = () => {
    const current = editing;
    if (!current) return;
    setEditing(null);
    const title = current.value.trim().slice(0, TITLE_MAX);
    const existing = sessions.find((s) => s.id === current.id);
    if (!existing || title.length === 0 || title === existing.title) return;
    void renameSession(current.id, mode, title).then((ok) => {
      if (!ok) toast.error('Could not rename the reflection.');
    });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this reflection? Its messages and readings will be gone for good.')) return;
    const ok = await deleteSession(id, mode);
    if (!ok) {
      toast.error('Could not delete the reflection.');
      return;
    }
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (pathname === `/reflect/${id}`) {
      onNavigate?.();
      router.push('/reflect');
    }
  };

  if (sessions.length === 0) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <p className="px-3 pb-1 text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-muted-foreground">Recent</p>
      {sessions.map((s) => {
        const href = `/reflect/${s.id}`;
        const current = pathname === href;
        if (editing?.id === s.id) {
          return (
            <div key={s.id} className="px-1 py-0.5">
              <Input
                autoFocus
                value={editing.value}
                maxLength={TITLE_MAX}
                aria-label="Session title"
                onChange={(e) => setEditing({ id: s.id, value: e.target.value })}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setEditing(null);
                }}
                className="h-8 text-sm"
              />
            </div>
          );
        }
        return (
          <div
            key={s.id}
            className={`group relative flex items-center rounded-lg px-3 py-1.5 text-sm transition-colors motion-reduce:transition-none ${
              current
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            }`}
          >
            <Link href={href} onClick={onNavigate} aria-current={current ? 'page' : undefined} className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
              <span className="truncate" title={s.title}>
                {s.title}
              </span>
              {/* Timestamp gives way to the options button on hover; the
                  reserved gap keeps touch (no hover) overlap-free. */}
              <span className="mr-6 shrink-0 text-xs tabular-nums opacity-70 transition-opacity md:mr-0 md:group-hover:opacity-0 motion-reduce:transition-none">
                {recentLabel(s.updated_at)}
              </span>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Options for ${s.title}`}
                  className="absolute right-1.5 top-1/2 z-10 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground opacity-100 transition-[opacity,background-color,color] hover:bg-foreground/10 hover:text-foreground focus-visible:bg-foreground/10 focus-visible:text-foreground focus-visible:outline-none md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 motion-reduce:transition-none"
                >
                  <MoreHorizontal className="size-4" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => void handleGenerate(s.id)} disabled={generatingFor === s.id}>
                  {generatingFor === s.id ? (
                    <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                  ) : (
                    <Sparkles className="size-4" aria-hidden />
                  )}
                  Generate title
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEditing({ id: s.id, value: s.title })}>
                  <PencilLine className="size-4" aria-hidden />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => void handleDelete(s.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="size-4" aria-hidden />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}
    </div>
  );
}
