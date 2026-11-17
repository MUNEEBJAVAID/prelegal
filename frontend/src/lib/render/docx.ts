import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ParagraphChild,
} from "docx";
import type { Block, NdaDocumentModel, SectionContent } from "../document";
import type { Run } from "../terms";

const INK = "1F2A44";
const MUTED = "6B6B6B";
const LINE = "C9C2B4";
const FONT = "Georgia";

function runsToChildren(runs: Run[], opts: { size?: number; color?: string } = {}): ParagraphChild[] {
  return runs.flatMap((r): ParagraphChild[] => {
    // Preserve user-entered line breaks (e.g. multi-line addresses).
    const lines = r.text.split(/\r?\n/);
    const textRuns = lines.map(
      (line, i) =>
        new TextRun({
          text: line,
          break: i > 0 ? 1 : undefined,
          bold: r.bold || !!r.ref,
          size: opts.size,
          color: r.placeholder ? "9A6B00" : r.href ? INK : opts.color,
          underline: r.href ? {} : undefined,
          font: FONT,
        }),
    );
    return r.href ? [new ExternalHyperlink({ link: r.href, children: textRuns })] : textRuns;
  });
}

function contentToParagraphs(c: SectionContent): Paragraph[] {
  if (c.type === "paragraph") return [new Paragraph({ children: runsToChildren(c.runs) })];
  return c.options.map(
    (o) =>
      new Paragraph({
        indent: { left: 360, hanging: 360 },
        spacing: { before: 60 },
        children: [
          new TextRun({ text: o.checked ? "☒\t" : "☐\t", font: "Segoe UI Symbol" }),
          ...runsToChildren(o.runs, { color: o.checked ? undefined : MUTED }),
        ],
      }),
  );
}

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

function cell(children: ParagraphChild[], opts: { width: number; header?: boolean; minHeight?: boolean }) {
  return new TableCell({
    width: { size: opts.width, type: WidthType.PERCENTAGE },
    borders: cellBorders,
    shading: opts.header ? { fill: "F3EFE7" } : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [
      new Paragraph({
        alignment: opts.header ? AlignmentType.CENTER : undefined,
        spacing: opts.minHeight ? { after: 360 } : undefined,
        children,
      }),
    ],
  });
}

function blockToDocx(block: Block): (Paragraph | Table)[] {
  switch (block.type) {
    case "title":
      return [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 240 },
          children: [new TextRun({ text: block.text, bold: true, size: 36, color: INK, font: FONT })],
        }),
      ];
    case "paragraph":
      return [
        new Paragraph({
          spacing: { before: block.muted ? 160 : 0, after: 160 },
          children: runsToChildren(block.runs, block.muted ? { size: 16, color: MUTED } : {}),
        }),
      ];
    case "section":
      return [
        new Paragraph({
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 6 } },
          spacing: { before: 200 },
          keepNext: true,
          children: [
            new TextRun({ text: block.title.toUpperCase(), bold: true, color: INK, size: 20, font: FONT }),
          ],
        }),
        ...(block.hint
          ? [
              new Paragraph({
                keepNext: true,
                children: [new TextRun({ text: block.hint, italics: true, color: MUTED, size: 17, font: FONT })],
              }),
            ]
          : []),
        ...block.content.flatMap(contentToParagraphs),
      ];
    case "signatures": {
      const header = new TableRow({
        tableHeader: true,
        children: [
          cell([], { width: 26 }),
          cell([new TextRun({ text: "PARTY 1", bold: true, font: FONT })], { width: 37, header: true }),
          cell([new TextRun({ text: "PARTY 2", bold: true, font: FONT })], { width: 37, header: true }),
        ],
      });
      const rows = block.rows.map(
        (r) =>
          new TableRow({
            cantSplit: true,
            children: [
              cell([new TextRun({ text: r.label, bold: true, font: FONT })], { width: 26 }),
              ...r.cells.map((c) => cell(runsToChildren(c), { width: 37, minHeight: r.blank })),
            ],
          }),
      );
      return [
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...rows] }),
      ];
    }
    case "heading":
      return [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 240 },
          children: [
            ...(block.newPage ? [new PageBreak()] : []),
            new TextRun({ text: block.text, bold: true, size: 30, color: INK, font: FONT }),
          ],
        }),
      ];
    case "clause":
      return [
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          indent: { left: 360, hanging: 360 },
          spacing: { after: 140 },
          children: [new TextRun({ text: `${block.number}.\t`, font: FONT }), ...runsToChildren(block.runs)],
        }),
      ];
  }
}

export function buildDocx(doc: NdaDocumentModel): Document {
  return new Document({
    creator: "Prelegal",
    title: "Mutual Non-Disclosure Agreement",
    styles: { default: { document: { run: { font: FONT, size: 21 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 }, // US Letter
            margin: { top: 1080, bottom: 1080, left: 1200, right: 1200 },
          },
        },
        children: doc.blocks.flatMap(blockToDocx),
      },
    ],
  });
}

export function renderDocx(doc: NdaDocumentModel): Promise<Blob> {
  return Packer.toBlob(buildDocx(doc));
}
