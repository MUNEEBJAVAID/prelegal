import { Fragment, type ReactNode } from "react";

// Supports the small subset of inline Markdown used by the Common Paper templates:
// **bold**, [links](url) and <span class="coverpage_link">Cover Page references</span>.
const TOKEN =
  /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)|<span class="coverpage_link">(.+?)<\/span>/g;

export function InlineMarkdown({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const index = m.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    const [, bold, linkText, href, coverRef] = m;
    if (bold !== undefined) {
      nodes.push(<strong key={index}>{bold}</strong>);
    } else if (linkText !== undefined) {
      nodes.push(
        <a key={index} href={href} target="_blank" rel="noopener noreferrer" className="underline">
          {linkText}
        </a>,
      );
    } else if (coverRef !== undefined) {
      nodes.push(
        <span key={index} className="font-semibold text-indigo-800 print:text-black">
          {coverRef}
        </span>,
      );
    }
    last = index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <>{nodes.map((n, i) => <Fragment key={i}>{n}</Fragment>)}</>;
}
