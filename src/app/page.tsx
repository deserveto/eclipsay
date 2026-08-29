import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MessagesSquare, Sparkles, NotebookPen } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getAuthUser, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { WelcomeBack } from '@/components/landing/welcome-back';

// Landing (PRD §11.1): guest-first, "What's on your mind?" + three entry actions.
// Signed-in users go straight to the reflection space.
export default async function Home() {
  if (isSupabaseServerConfigured()) {
    const user = await getAuthUser();
    if (user) redirect('/reflect');
  }

  const actions = [
    {
      href: '/reflect',
      title: 'Talk something through',
      description: 'Start a private conversation and unpack what is on your mind.',
      icon: MessagesSquare,
    },
    {
      href: '/reflect?tarot=1',
      title: 'Reflect with tarot',
      description: 'Explore a question with a few cards as reflective prompts.',
      icon: Sparkles,
    },
    {
      href: '/journal/new',
      title: 'Write privately',
      description: 'Put thoughts into your journal, no conversation needed.',
      icon: NotebookPen,
    },
  ];

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl space-y-10 text-center">
        <div className="space-y-3">
          <p className="text-sm tracking-wide text-primary">ECLIPSAY</p>
          <h1 className="text-4xl font-medium tracking-tight text-balance sm:text-5xl">
            What&apos;s on your mind?
          </h1>
          <p className="mx-auto max-w-md text-muted-foreground">
            A private space to reflect through conversation, tarot, and journaling. No account needed to begin.
          </p>
        </div>
        <div className="grid gap-3 text-left">
          {actions.map(({ href, title, description, icon: Icon }) => (
            <Link key={href} href={href} className="rounded-xl transition-transform hover:-translate-y-0.5">
              <Card className="gap-2 py-4">
                <CardHeader className="flex-row items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4.5" aria-hidden />
                  </span>
                  <CardTitle className="text-base">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{description}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
        <WelcomeBack />
      </div>
    </main>
  );
}
