import { Document, Link, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import type { Block, DocumentModel, SectionContent } from "../document";
import type { Run } from "../terms";

// Uses the built-in Times fonts, so no font files need to be fetched.
const INK = "#1f2a44";
const MUTED = "#6b6b6b";
const LINE = "#c9c2b4";

const s = StyleSheet.create({
  page: {
    paddingVertical: 54,
    paddingHorizontal: 60,
    fontFamily: "Times-Roman",
    fontSize: 10.5,
    lineHeight: 1.45,
    color: "#1a1a1a",
  },
  title: { fontFamily: "Times-Bold", fontSize: 18, textAlign: "center", marginBottom: 14, color: INK },
  paragraph: { marginBottom: 8 },
  muted: { fontSize: 8.5, color: MUTED, marginTop: 6 },
  section: { borderTopWidth: 0.75, borderTopColor: LINE, paddingTop: 7, marginBottom: 7 },
  sectionTitle: { fontFamily: "Times-Bold", fontSize: 10, letterSpacing: 0.6, color: INK },
  hint: { fontFamily: "Times-Italic", fontSize: 8.5, color: MUTED, marginBottom: 2 },
  option: { flexDirection: "row", marginTop: 3 },
  box: {
    width: 9,
    height: 9,
    borderWidth: 0.75,
    borderColor: "#333",
    marginRight: 6,
    marginTop: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  boxMark: { fontFamily: "Helvetica-Bold", fontSize: 7, lineHeight: 1 },
  optionText: { flex: 1 },
  unchecked: { color: MUTED },
  table: { marginTop: 6, borderTopWidth: 0.75, borderLeftWidth: 0.75, borderColor: LINE },
  row: { flexDirection: "row" },
  cell: { flex: 1, borderRightWidth: 0.75, borderBottomWidth: 0.75, borderColor: LINE, padding: 5 },
  labelCell: { flex: 0.75, fontFamily: "Times-Bold" },
  headCell: { fontFamily: "Times-Bold", textAlign: "center", backgroundColor: "#f3efe7" },
  blankCell: { minHeight: 30 },
  heading: { fontFamily: "Times-Bold", fontSize: 15, textAlign: "center", marginBottom: 12, color: INK },
  clause: { flexDirection: "row", marginBottom: 7, textAlign: "justify" },
  clauseNumber: { width: 26 },
  clauseText: { flex: 1 },
  bold: { fontFamily: "Times-Bold" },
  link: { color: INK, textDecoration: "underline" },
  placeholder: { color: "#9a6b00" },
  pageNumber: { position: "absolute", bottom: 28, left: 0, right: 0, textAlign: "center", fontSize: 8, color: MUTED },
});

function Runs({ runs }: { runs: Run[] }) {
  return (
    <>
      {runs.map((r, i) => {
        if (r.href)
          return (
            <Link key={i} src={r.href} style={s.link}>
              {r.text}
            </Link>
          );
        const style = r.bold || r.ref ? s.bold : r.placeholder ? s.placeholder : undefined;
        return (
          <Text key={i} style={style}>
            {r.text}
          </Text>
        );
      })}
    </>
  );
}

function Content({ content }: { content: SectionContent }) {
  if (content.type === "paragraph")
    return (
      <Text>
        <Runs runs={content.runs} />
      </Text>
    );
  return (
    <View>
      {content.options.map((o, i) => (
        <View key={i} style={s.option} wrap={false}>
          <View style={s.box}>{o.checked && <Text style={s.boxMark}>X</Text>}</View>
          <Text style={[s.optionText, o.checked ? {} : s.unchecked]}>
            <Runs runs={o.runs} />
          </Text>
        </View>
      ))}
    </View>
  );
}

function PdfBlock({ block }: { block: Block }) {
  switch (block.type) {
    case "title":
      return <Text style={s.title}>{block.text}</Text>;
    case "paragraph":
      return (
        <Text style={block.muted ? s.muted : s.paragraph}>
          <Runs runs={block.runs} />
        </Text>
      );
    case "section":
      return (
        <View style={s.section} wrap={false}>
          <Text style={s.sectionTitle}>{block.title.toUpperCase()}</Text>
          {block.hint && <Text style={s.hint}>{block.hint}</Text>}
          {block.content.map((c, i) => (
            <Content key={i} content={c} />
          ))}
        </View>
      );
    case "signatures":
      return (
        <View style={s.table} wrap={false}>
          <View style={s.row}>
            <Text style={[s.cell, s.labelCell]} />
            <Text style={[s.cell, s.headCell]}>{block.parties[0]}</Text>
            <Text style={[s.cell, s.headCell]}>{block.parties[1]}</Text>
          </View>
          {block.rows.map((r) => (
            <View key={r.label} style={s.row}>
              <Text style={[s.cell, s.labelCell]}>{r.label}</Text>
              {r.cells.map((c, i) => (
                <Text key={i} style={r.blank ? [s.cell, s.blankCell] : s.cell}>
                  <Runs runs={c} />
                </Text>
              ))}
            </View>
          ))}
        </View>
      );
    case "heading":
      return (
        <Text style={s.heading} break={block.newPage}>
          {block.text}
        </Text>
      );
    case "clause":
      return (
        <View style={[s.clause, { marginLeft: block.level * 14 }]}>
          <Text style={s.clauseNumber}>{block.label}</Text>
          <Text style={s.clauseText}>
            <Runs runs={block.runs} />
          </Text>
        </View>
      );
  }
}

export function DocumentPdf({ doc }: { doc: DocumentModel }) {
  return (
    <Document title={doc.title} creator="Prelegal" producer="Prelegal">
      <Page size="LETTER" style={s.page}>
        {doc.blocks.map((b, i) => (
          <PdfBlock key={i} block={b} />
        ))}
        <Text
          style={s.pageNumber}
          fixed
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
        />
      </Page>
    </Document>
  );
}

export function renderPdf(doc: DocumentModel): Promise<Blob> {
  return pdf(<DocumentPdf doc={doc} />).toBlob();
}
