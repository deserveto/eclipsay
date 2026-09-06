import Link from 'next/link';

// Audit A26: unknown routes get a real 404 surface with a way back.
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-xl font-medium tracking-tight">This page doesn&apos;t exist.</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The link may be old or mistyped. Your reflections are right where you left them.
      </p>
      <Link
        href="/reflect"
        className="rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Start reflecting
      </Link>
    </div>
  );
}
