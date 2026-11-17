"use client";

import { useState } from "react";
import { NdaDocument } from "./NdaDocument";
import { NdaForm } from "./NdaForm";
import { buildNdaMarkdown, defaultNdaData, type NdaData } from "@/lib/nda";
import type { Clause } from "@/lib/nda";

type Props = {
  standardTermsMarkdown: string;
  clauses: Clause[];
  footer: string;
};

function fileBaseName(data: NdaData): string {
  const slug = (s: string) =>
    s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const parties = [data.party1.company, data.party2.company].map(slug).filter(Boolean);
  return ["mutual-nda", ...parties].join("-");
}

function downloadFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function NdaCreator({ standardTermsMarkdown, clauses, footer }: Props) {
  const [data, setData] = useState<NdaData>(defaultNdaData);

  const downloadMarkdown = () =>
    downloadFile(
      `${fileBaseName(data)}.md`,
      buildNdaMarkdown(data, standardTermsMarkdown),
      "text/markdown;charset=utf-8",
    );

  return (
    <div className="flex min-h-full flex-1 flex-col bg-neutral-100 print:bg-white">
      <header className="border-b border-neutral-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">
              Prelegal <span className="font-normal text-neutral-500">· Mutual NDA Creator</span>
            </h1>
            <p className="text-sm text-neutral-500">
              Fill in the key details and your Mutual NDA updates as you type.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setData(defaultNdaData)}
              className="rounded-md px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={downloadMarkdown}
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
            >
              Download .md
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              Download PDF
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] print:block print:p-0">
        <aside className="print:hidden lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
          <NdaForm data={data} onChange={setData} />
        </aside>
        <section aria-label="Document preview" className="min-w-0">
          <NdaDocument data={data} clauses={clauses} footer={footer} />
        </section>
      </main>
    </div>
  );
}
