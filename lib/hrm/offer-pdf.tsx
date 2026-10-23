import { Document, Image, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { pdfFontName, type OfferMargins, type OfferNode } from "@/lib/hrm/offer-doc";

export type OfferPdfInput = {
  doc: OfferNode;
  margins: OfferMargins;
  pageWidth: number;
  pageHeight: number;
  headerHeight: number;
  footerHeight: number;
  accentColor: string;
  headerPng: Buffer;
  footerPng: Buffer;
};

function pngSrc(png: Buffer) {
  return `data:image/png;base64,${png.toString("base64")}`;
}

function markFlags(node: OfferNode) {
  const marks = node.marks ?? [];
  const look = marks.find((mark) => mark.type === "textLook");
  const family = typeof look?.attrs?.fontFamily === "string" ? look.attrs.fontFamily : null;
  const sizeRaw = look?.attrs?.fontSize;
  const parsed = typeof sizeRaw === "number" ? sizeRaw : typeof sizeRaw === "string" ? Number.parseFloat(sizeRaw) : NaN;
  const underline = marks.some((mark) => mark.type === "underline");
  const strike = marks.some((mark) => mark.type === "strike");
  const style: {
    fontFamily: string;
    fontSize?: number;
    textDecoration?: "underline" | "line-through" | "underline line-through";
  } = {
    fontFamily: pdfFontName(
      family,
      marks.some((mark) => mark.type === "bold"),
      marks.some((mark) => mark.type === "italic")
    ),
  };
  if (Number.isFinite(parsed)) style.fontSize = parsed;
  if (underline && strike) style.textDecoration = "underline line-through";
  else if (underline) style.textDecoration = "underline";
  else if (strike) style.textDecoration = "line-through";
  return style;
}

function Inline({ nodes }: { nodes: OfferNode[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        if (node.type === "hardBreak") return <Text key={index}>{"\n"}</Text>;
        if (node.type === "text") {
          const style = markFlags(node);
          return (
            <Text key={index} style={style}>
              {node.text || ""}
            </Text>
          );
        }
        if (node.content?.length) {
          return (
            <Text key={index}>
              <Inline nodes={node.content} />
            </Text>
          );
        }
        return null;
      })}
    </>
  );
}

function Blocks({ nodes, accent }: { nodes: OfferNode[]; accent: string }) {
  return (
    <>
      {nodes.map((node, index) => {
        if (node.type === "heading") {
          const level = Number(node.attrs?.level) || 1;
          const size = level === 1 ? 18 : level === 2 ? 15 : 13;
          return (
            <Text
              key={index}
              style={{
                fontFamily: "Helvetica-Bold",
                fontSize: size,
                color: level === 1 ? accent : "#1c1917",
                marginTop: 8,
                marginBottom: 6,
              }}
            >
              <Inline nodes={node.content ?? []} />
            </Text>
          );
        }
        if (node.type === "bulletList" || node.type === "orderedList") {
          const start = Number(node.attrs?.start) || 1;
          return (
            <View key={index} style={{ marginBottom: 6 }}>
              {(node.content ?? []).map((item, itemIndex) => (
                <View key={itemIndex} style={{ flexDirection: "row", marginBottom: 2 }}>
                  <Text style={{ width: 18 }}>{node.type === "orderedList" ? `${start + itemIndex}.` : "•"}</Text>
                  <View style={{ flex: 1 }}>
                    <Blocks nodes={item.content ?? []} accent={accent} />
                  </View>
                </View>
              ))}
            </View>
          );
        }
        if (node.type === "paragraph") {
          const content = node.content ?? [];
          return (
            <Text key={index} style={{ fontSize: 11, marginBottom: 6, lineHeight: 1.45 }}>
              {content.length ? <Inline nodes={content} /> : " "}
            </Text>
          );
        }
        if (node.content?.length) return <Blocks key={index} nodes={node.content} accent={accent} />;
        return null;
      })}
    </>
  );
}

export function OfferPdf({ input }: { input: OfferPdfInput }) {
  return (
    <Document title="Offer letter">
      <Page
        size={[input.pageWidth, input.pageHeight]}
        style={{
          fontFamily: "Helvetica",
          fontSize: 11,
          color: "#1c1917",
          lineHeight: 1.45,
          paddingTop: input.headerHeight + input.margins.top,
          paddingBottom: input.footerHeight + input.margins.bottom,
          paddingLeft: input.margins.left,
          paddingRight: input.margins.right,
        }}
      >
        <Image
          fixed
          src={pngSrc(input.headerPng)}
          style={{ position: "absolute", top: 0, left: 0, width: input.pageWidth, height: input.headerHeight }}
        />
        <Image
          fixed
          src={pngSrc(input.footerPng)}
          style={{ position: "absolute", bottom: 0, left: 0, width: input.pageWidth, height: input.footerHeight }}
        />
        <View>
          <Blocks nodes={input.doc.content ?? []} accent={input.accentColor} />
        </View>
      </Page>
    </Document>
  );
}

export function renderOfferPdf(input: OfferPdfInput) {
  return renderToBuffer(<OfferPdf input={input} />);
}
