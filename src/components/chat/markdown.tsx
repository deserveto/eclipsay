'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Assistant messages render markdown; user messages render as plain text.
export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-3 text-[15px] leading-7 break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: (props) => <a {...props} className="underline underline-offset-4" target="_blank" rel="noreferrer" />,
          ul: (props) => <ul {...props} className="list-disc space-y-1 pl-5" />,
          ol: (props) => <ol {...props} className="list-decimal space-y-1 pl-5" />,
          blockquote: (props) => (
            <blockquote {...props} className="border-l-2 border-border pl-3 text-muted-foreground italic" />
          ),
          code: (props) => <code {...props} className="rounded bg-muted px-1 py-0.5 text-[13px]" />,
          strong: (props) => <strong {...props} className="font-semibold" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
