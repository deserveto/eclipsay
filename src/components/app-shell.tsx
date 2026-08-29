'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Brain, Compass, Menu, NotebookPen, PanelLeft, PanelLeftClose, Plus, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { FollowUpBanner } from '@/components/followups/followup-banner';
import { useDataMode } from '@/hooks/use-data-mode';
import { loadGuestStore } from '@/lib/guest/store';

function recentLabel(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  const days = Math.round(mins / 1440);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function RecentSessions({ onNavigate }: { onNavigate?: () => void }) {
  const { mode } = useDataMode();
  const pathname = usePathname();
  const [sessions, setSessions] = useState<{ id: string; title: string; updated_at: string }[]>([]);

  useEffect(() => {
    if (mode === 'account' && isSupabaseConfigured()) {
      const supabase = createClient();
      let cancelled = false;
      supabase
        .from('reflection_sessions')
        .select('id, title, updated_at')
        .order('updated_at', { ascending: false })
        .limit(20)
        .then(({ data }) => {
          if (!cancelled) setSessions((data ?? []) as { id: string; title: string; updated_at: string }[]);
        });
      return () => {
        cancelled = true;
      };
    }
    const read = () => {
      const store = loadGuestStore();
      setSessions(
        [...store.sessions]
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
          .slice(0, 20)
          .map((s) => ({ id: s.id, title: s.title, updated_at: s.updated_at })),
      );
    };
    read();
    window.addEventListener('eclipsay:guest-store-changed', read);
    return () => window.removeEventListener('eclipsay:guest-store-changed', read);
  }, [mode]);

  if (sessions.length === 0) return null;
  return (
    <div className="mt-4 flex flex-col gap-0.5">
      <p className="px-3 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Recent</p>
      {sessions.map((s) => {
        const href = `/reflect/${s.id}`;
        const current = pathname === href;
        return (
          <Link
            key={s.id}
            href={href}
            onClick={onNavigate}
            aria-current={current ? 'page' : undefined}
            className={`flex items-baseline justify-between gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
              current
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            }`}
          >
            <span className="truncate">{s.title}</span>
            <span className="shrink-0 text-xs opacity-70">{recentLabel(s.updated_at)}</span>
          </Link>
        );
      })}
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = [
    { href: '/journal', label: 'Journal', icon: NotebookPen },
    { href: '/explore', label: 'Explore', icon: Compass },
    { href: '/memory', label: 'Memory', icon: Brain },
  ];
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {items.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          aria-current={pathname === href ? 'page' : undefined}
          className={`flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
            pathname === href
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
          }`}
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}

function NavLinksBottom({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = [{ href: '/profile', label: 'Profile', icon: NotebookPen }, { href: '/settings', label: 'Settings', icon: Settings }];
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Account">
      {items.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          aria-current={pathname === href ? 'page' : undefined}
          className={`flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
            pathname === href
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
          }`}
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}

function SidebarInner({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col px-3 py-4">
      <Button asChild variant="secondary" className="mb-4 justify-start gap-2">
        <Link href="/reflect" onClick={onNavigate}>
          <Plus className="size-4" aria-hidden />
          New Reflection
        </Link>
      </Button>
      <RecentSessions onNavigate={onNavigate} />
      <Separator className="my-4" />
      <NavLinks onNavigate={onNavigate} />
      <div className="mt-auto">
        <Separator className="mb-4" />
        <NavLinksBottom onNavigate={onNavigate} />
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // ChatGPT-style collapse (user request): the persisted choice loads after
  // mount so SSR and hydration always agree on the expanded default.
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem('eclipsay.sidebar.collapsed') === '1');
    } catch {
      // Storage unavailable (private mode): stay expanded.
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem('eclipsay.sidebar.collapsed', next ? '1' : '0');
      } catch {
        // Ignore persistence failures; the visual state still applies.
      }
      return next;
    });
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <aside
        className={`hidden shrink-0 overflow-hidden border-r bg-sidebar transition-[width] duration-200 ease-out motion-reduce:transition-none md:block ${
          collapsed ? 'w-14' : 'w-64'
        }`}
      >
        {collapsed ? (
          <div className="flex h-full w-14 flex-col items-center py-4">
            <button
              type="button"
              aria-label="Show sidebar"
              title="Show sidebar"
              onClick={toggleCollapsed}
              className="group relative grid size-9 shrink-0 place-items-center rounded-lg transition-colors hover:bg-sidebar-accent focus-visible:bg-sidebar-accent focus-visible:outline-none"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.webp"
                className="size-8 transition-opacity duration-150 group-hover:opacity-0 group-focus-visible:opacity-0 motion-reduce:transition-none"
                alt=""
              />
              <PanelLeft
                aria-hidden
                className="absolute size-4 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
              />
            </button>
          </div>
        ) : (
          <div className="flex h-full w-64 flex-col px-3 py-4">
            <div className="mb-4 flex items-center justify-between gap-1">
              <Link
                href="/reflect"
                aria-label="Eclipsay home"
                className="flex min-w-0 items-center gap-2.5 rounded-md px-1 py-0.5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.webp" alt="Eclipsay logo" className="size-9 shrink-0" />
                <span className="truncate text-sm tracking-wide text-primary">ECLIPSAY</span>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
                onClick={toggleCollapsed}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <PanelLeftClose className="size-4" aria-hidden />
              </Button>
            </div>
            <SidebarInner />
          </div>
        )}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <FollowUpBanner />
        <header className="flex items-center gap-2 border-b px-3 py-2 md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open navigation">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex items-center gap-2.5 px-4 pt-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.webp" alt="Eclipsay logo" className="size-8" />
                <span className="text-sm tracking-wide text-primary">ECLIPSAY</span>
              </div>
              <SidebarInner onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <Link href="/reflect" className="flex items-center gap-2 text-sm font-medium" aria-label="Eclipsay home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.webp" alt="" className="size-6" />
            Eclipsay
          </Link>
        </header>
        <main className="min-h-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
