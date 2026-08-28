import Link from 'next/link';

// Foundation placeholder — replaced by the real landing page in Phase 2.
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background text-foreground">
      <h1 className="text-4xl font-medium tracking-tight">Eclipsay</h1>
      <p className="max-w-md text-center text-muted-foreground">
        Reflect through conversation, tarot, and journaling.
      </p>
      <div className="flex gap-3 text-sm">
        <Link href="/reflect" className="underline underline-offset-4">
          Start a reflection
        </Link>
        <Link href="/explore" className="underline underline-offset-4">
          Explore cards
        </Link>
      </div>
    </main>
  );
}
