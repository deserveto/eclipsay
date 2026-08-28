'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Compass, Menu, NotebookPen, Plus, Settings, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { FollowUpBanner } from '@/components/followups/followup-banner';
import { useDataMode } from '@/hooks/use-data-mode';
import { loadGuestStore } from '@/lib/guest/store';

function RecentSessions({ onNavigate }: { onNavigate?: () => void }) {
  const { mode } = useDataMode();
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
      {sessions.map((s) => (
        <Link
          key={s.id}
          href={`/reflect/${s.id}`}
          onClick={onNavigate}
          className="truncate rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          {s.title}
        </Link>
      ))}
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
  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <aside className="hidden w-64 shrink-0 border-r bg-sidebar md:block">
        <SidebarInner />
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
              <SidebarInner onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <span className="text-sm font-medium">Eclipsay</span>
        </header>
        <main className="min-h-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
