import { Document, Image, Page, Text, View } from "@react-pdf/renderer";

export type LetterPdfInput = {
  title: string;
  body: string;
  pageWidth: number;
  pageHeight: number;
  headerHeight: number;
  footerHeight: number;
  sideMargin: number;
  accentColor: string;
  headerPng: Buffer;
  footerPng: Buffer;
};

function pngSrc(png: Buffer) {
  return `data:image/png;base64,${png.toString("base64")}`;
}

export function LetterPdf({ letter }: { letter: LetterPdfInput }) {
  const lines = (letter.body.trim() ? letter.body : " ").split(/\n/);
  return (
    <Document title={letter.title || "Letter"}>
      <Page
        size={[letter.pageWidth, letter.pageHeight]}
        style={{ fontFamily: "Helvetica", fontSize: 11, color: "#1c1917", lineHeight: 1.45 }}
      >
        <Image
          fixed
          src={pngSrc(letter.headerPng)}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: letter.pageWidth,
            height: letter.headerHeight,
          }}
        />
        <Image
          fixed
          src={pngSrc(letter.footerPng)}
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: letter.pageWidth,
            height: letter.footerHeight,
          }}
        />
        <View
          style={{
            marginTop: letter.headerHeight + 8,
            marginBottom: letter.footerHeight + 8,
            paddingHorizontal: Math.max(letter.sideMargin, 36),
          }}
        >
          {letter.title.trim() ? (
            <Text
              style={{
                fontSize: 14,
                marginBottom: 12,
                fontFamily: "Helvetica-Bold",
                color: letter.accentColor,
              }}
            >
              {letter.title.trim()}
            </Text>
          ) : null}
          {lines.map((line, index) => (
            <Text key={index}>{line.length > 0 ? line : " "}</Text>
          ))}
        </View>
      </Page>
    </Document>
  );
}
