"use client";
import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

// يحول \( \) و \[ \] لصيغة $ عشان KaTeX يفهمها لو استخدمها الموديل
function normalizeMath(src: string) {
  return src
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, m) => `\n$$\n${m.trim()}\n$$\n`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, m) => `$${m.trim()}$`);
}

const remarkPlugins = [remarkGfm, [remarkMath, { singleDollarTextMath: true }]] as never;
const rehypePlugins = [[rehypeKatex, { throwOnError: false, strict: "ignore" }]] as never;

function MarkdownImpl({ children }: { children: string }) {
  return (
    <div className="prose-ar">
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={{
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table>{children}</table>
            </div>
          ),
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
        }}
      >
        {normalizeMath(children)}
      </ReactMarkdown>
    </div>
  );
}

export const Markdown = memo(MarkdownImpl);

/** نسخة مختصرة لنص قصير فيه معادلات (أسئلة الاختبار والبطاقات) */
export const InlineMarkdown = memo(function InlineMarkdown({ children }: { children: string }) {
  return (
    <div className="prose-ar [&_p]:my-0">
      <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
        {normalizeMath(children)}
      </ReactMarkdown>
    </div>
  );
});
