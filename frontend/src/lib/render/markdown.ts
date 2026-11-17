import type { Block, NdaDocumentModel, SectionContent } from "../document";
import type { Run } from "../terms";

function runsToMarkdown(runs: Run[]): string {
  return runs
    .map((r) => {
      const t = r.text.replace(/\r?\n/g, "  \n");
      if (r.href) return `[${t}](${r.href})`;
      if (r.bold) return `**${t}**`;
      return t;
    })
    .join("");
}

function cell(runs: Run[]): string {
  return runsToMarkdown(runs).replace(/\|/g, "\\|").replace(/ {2}\n/g, "<br>");
}

function contentToMarkdown(c: SectionContent): string {
  if (c.type === "paragraph") return runsToMarkdown(c.runs);
  return c.options.map((o) => `- [${o.checked ? "x" : " "}] ${runsToMarkdown(o.runs)}`).join("\n");
}

function blockToMarkdown(block: Block): string {
  switch (block.type) {
    case "title":
      return `# ${block.text}`;
    case "paragraph":
      return block.muted ? `_${runsToMarkdown(block.runs)}_` : runsToMarkdown(block.runs);
    case "section":
      return [`### ${block.title}`, ...block.content.map(contentToMarkdown)].join("\n\n");
    case "signatures":
      return [
        "| | PARTY 1 | PARTY 2 |",
        "|:--- | :----: | :----: |",
        ...block.rows.map((r) => `| ${r.label} | ${cell(r.cells[0])} | ${cell(r.cells[1])} |`),
      ].join("\n");
    case "heading":
      return `${block.newPage ? "---\n\n" : ""}## ${block.text}`;
    case "clause":
      return `${block.number}. ${runsToMarkdown(block.runs)}`;
  }
}

export function renderMarkdown(doc: NdaDocumentModel): string {
  return doc.blocks.map(blockToMarkdown).join("\n\n") + "\n";
}
