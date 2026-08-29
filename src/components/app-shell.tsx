'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Brain, Compass, Menu, NotebookPen, PanelLeft, PanelLeftClose, Plus, Settings, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
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


const navItems = [
  { href: '/journal', label: 'Journal', icon: NotebookPen },
  { href: '/explore', label: 'Explore', icon: Compass },
  { href: '/memory', label: 'Memory', icon: Brain },
];

const accountItems = [
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/settings', label: 'Settings', icon: Settings },
];
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
    <div className="flex flex-col gap-0.5">
      <p className="px-3 pb-1 text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-muted-foreground">Recent</p>
      {sessions.map((s) => {
        const href = `/reflect/${s.id}`;
        const current = pathname === href;
        return (
          <Link
            key={s.id}
            href={href}
            onClick={onNavigate}
            aria-current={current ? 'page' : undefined}
            className={`flex items-baseline justify-between gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
              current
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            }`}
          >
            <span className="truncate">{s.title}</span>
            <span className="shrink-0 text-xs tabular-nums opacity-70">{recentLabel(s.updated_at)}</span>
          </Link>
        );
      })}
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {navItems.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          aria-current={pathname === href ? 'page' : undefined}
          className={`group flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-sidebar-accent ${
            pathname === href ? 'bg-sidebar-accent' : ''
          }`}
        >
          <Icon className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}

function NavLinksBottom({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = accountItems;
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
      <Link
        href="/reflect"
        onClick={onNavigate}
        className="mb-3 flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--primary),var(--foreground)_8%)] motion-reduce:transition-none"
      >
        <Plus className="size-4" aria-hidden />
        New Reflection
      </Link>
      <NavLinks onNavigate={onNavigate} />
      <div className="mt-5 flex min-h-0 flex-1 flex-col overflow-y-auto">
        <RecentSessions onNavigate={onNavigate} />
      </div>
      <div className="mt-2 shrink-0 border-t border-foreground/10 pt-2">
        <NavLinksBottom onNavigate={onNavigate} />
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:shadow-lg"
      >
        Skip to content
      </a>
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
            <nav className="mt-3 flex flex-col items-center gap-1" aria-label="Main">
              {navItems.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  aria-label={label}
                  title={label}
                  aria-current={pathname === href ? 'page' : undefined}
                  className={`grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:bg-sidebar-accent focus-visible:outline-none ${
                    pathname === href ? 'bg-sidebar-accent text-foreground' : ''
                  }`}
                >
                  <Icon className="size-4" aria-hidden />
                </Link>
              ))}
            </nav>
            <div className="mt-auto flex flex-col items-center gap-1">
              <ThemeToggle side="right" align="end" />
              {accountItems.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  aria-label={label}
                  title={label}
                  aria-current={pathname === href ? 'page' : undefined}
                  className={`grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:bg-sidebar-accent focus-visible:outline-none ${
                    pathname === href ? 'bg-sidebar-accent text-foreground' : ''
                  }`}
                >
                  <Icon className="size-4" aria-hidden />
                </Link>
              ))}
            </div>
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
              <div className="flex items-center gap-1">
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
                <ThemeToggle />
              </div>
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
          <ThemeToggle className="ml-auto" />
        </header>
        <main id="main-content" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
