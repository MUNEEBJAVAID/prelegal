import type { DocumentModel } from "./document";

export type DownloadFormat = "pdf" | "docx" | "md";

export const FORMAT_LABELS: Record<DownloadFormat, string> = {
  pdf: "PDF",
  docx: "Word",
  md: "Markdown",
};

/** e.g. fileBaseName("mutual-nda", ["Acme Inc.", "Beta LLC"]) → "mutual-nda-acme-inc-beta-llc" */
export function fileBaseName(prefix: string, companies: string[]): string {
  const slug = (s: string) =>
    s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return [prefix, ...companies.map(slug).filter(Boolean)].join("-");
}

/** Renders the document in the requested format. Heavy libraries are loaded on demand. */
export async function renderDocument(doc: DocumentModel, format: DownloadFormat): Promise<Blob> {
  switch (format) {
    case "pdf":
      return (await import("./render/pdf")).renderPdf(doc);
    case "docx":
      return (await import("./render/docx")).renderDocx(doc);
    case "md": {
      const { renderMarkdown } = await import("./render/markdown");
      return new Blob([renderMarkdown(doc)], { type: "text/markdown;charset=utf-8" });
    }
  }
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before releasing the URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
