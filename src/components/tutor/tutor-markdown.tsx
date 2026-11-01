"use client";

import "katex/dist/katex.min.css";
import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

/*
 * Renders tutor replies. react-markdown never renders raw HTML, and
 * javascript: or data: links are stripped by its URL sanitiser, so model
 * output can't inject markup. Maths renders with KaTeX.
 */

const components: Components = {
  p: ({ children }) => <p className="my-3 first:mt-0 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-fg">{children}</strong>,
  em: ({ children }) => <em className="text-fg">{children}</em>,
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1.5 pl-5 marker:text-blue-400/70">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1.5 pl-5 marker:text-fg-subtle">{children}</ol>,
  li: ({ children }) => <li className="pl-1">{children}</li>,
  h1: ({ children }) => <h3 className="mt-5 mb-2 font-display text-lg font-semibold text-fg">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-5 mb-2 font-display text-lg font-semibold text-fg">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-4 mb-1.5 font-semibold text-fg">{children}</h4>,
  h4: ({ children }) => <h4 className="mt-4 mb-1.5 font-semibold text-fg">{children}</h4>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-violet-400/50 pl-4 text-fg-muted">{children}</blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="text-blue-400 underline decoration-blue-400/40 underline-offset-2 hover:text-blue-300"
    >
      {children}
    </a>
  ),
  code: ({ className, children }) =>
    className ? (
      <code className={className}>{children}</code>
    ) : (
      <code className="rounded-md bg-white/[0.07] px-1.5 py-0.5 font-mono text-[0.875em] text-cyan-400">
        {children}
      </code>
    ),
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-panel border border-line bg-ink-950/70 p-4 font-mono text-[0.8125rem] leading-relaxed">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-panel border border-line">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-line bg-white/[0.04] px-3 py-2 text-left font-semibold text-fg">{children}</th>
  ),
  td: ({ children }) => <td className="border-b border-line/60 px-3 py-2 align-top">{children}</td>,
  hr: () => <hr className="my-5 border-line" />,
  img: () => null, // tutor replies never embed remote images
};

export const TutorMarkdown = memo(function TutorMarkdown({ content }: { content: string }) {
  return (
    <div className="tutor-prose text-[0.9375rem] leading-[1.7] break-words text-fg/90">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: true }]]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false, output: "html" }]]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
