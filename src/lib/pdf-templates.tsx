import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { DocumentPDFData, ReceiptPDFData } from "./pdf-types";

const documentStyles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 11, paddingTop: 60, paddingBottom: 60, paddingLeft: 55, paddingRight: 55, backgroundColor: "#ffffff" },
  header: { marginBottom: 30, borderBottomWidth: 1, borderBottomColor: "#e5e5e5", paddingBottom: 20 },
  logo: { fontSize: 8, fontWeight: 700, color: "#71717a", letterSpacing: 2, textTransform: "uppercase" },
  title: { fontSize: 18, fontWeight: 700, color: "#18181b", textAlign: "center", marginBottom: 30 },
  body: { lineHeight: 1.8, color: "#3f3f46", textAlign: "justify" },
  paragraph: { marginBottom: 12 },
  dateCity: { marginTop: 40, textAlign: "right", color: "#71717a", fontSize: 10 },
  signature: { marginTop: 60, textAlign: "center" },
  signatureLine: { borderTopWidth: 1, borderTopColor: "#18181b", width: 200, marginHorizontal: "auto", marginBottom: 8 },
  signatureName: { fontWeight: 700, color: "#18181b", fontSize: 12 },
  signatureRegistry: { color: "#71717a", fontSize: 9, marginTop: 2 },
  footer: { position: "absolute", bottom: 30, left: 55, right: 55, fontSize: 8, color: "#a1a1aa", textAlign: "center", borderTopWidth: 1, borderTopColor: "#f4f4f5", paddingTop: 10 },
});

const receiptStyles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, padding: 46, backgroundColor: "#ffffff", color: "#18181b" },
  header: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#d4d4d8", paddingBottom: 22 },
  brand: { width: 34, height: 34, backgroundColor: "#18181b", color: "#ffffff", alignItems: "center", justifyContent: "center", borderRadius: 6, fontSize: 16, fontWeight: 700 },
  eyebrow: { marginTop: 13, fontSize: 7, fontWeight: 700, color: "#71717a", letterSpacing: 2, textTransform: "uppercase" },
  receiptTitle: { marginTop: 4, fontSize: 20, fontWeight: 700 },
  right: { alignItems: "flex-end", maxWidth: 210 },
  label: { fontSize: 7, fontWeight: 700, color: "#71717a", letterSpacing: 1.2, textTransform: "uppercase" },
  value: { marginTop: 3, fontSize: 9, fontWeight: 700, lineHeight: 1.4 },
  section: { borderBottomWidth: 1, borderBottomColor: "#e4e4e7", paddingVertical: 20 },
  amount: { marginTop: 7, fontSize: 31, fontWeight: 700 },
  inset: { marginTop: 14, padding: 14, borderWidth: 1, borderColor: "#e4e4e7", borderRadius: 8, backgroundColor: "#fafafa", flexDirection: "row", flexWrap: "wrap" },
  insetField: { width: "50%", paddingRight: 12, marginBottom: 10 },
  columns: { flexDirection: "row" },
  column: { width: "50%", paddingRight: 20 },
  heading: { fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 12 },
  field: { marginBottom: 10 },
  body: { fontSize: 10, lineHeight: 1.65, fontWeight: 700 },
  note: { marginTop: 10, padding: 10, backgroundColor: "#fafafa", borderRadius: 6, color: "#52525b", fontSize: 8, lineHeight: 1.5 },
  footer: { marginTop: "auto", borderTopWidth: 1, borderTopColor: "#d4d4d8", paddingTop: 14 },
  fiscal: { fontSize: 8, color: "#52525b", lineHeight: 1.5 },
  provider: { marginTop: 12, fontSize: 7, fontWeight: 700, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: 0.8 },
});

const stripHtml = (html: string) => html
  .replace(/<br\s*\/?>/gi, "\n")
  .replace(/<\/p>/gi, "\n\n")
  .replace(/<[^>]*>/g, "")
  .replace(/&nbsp;/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .trim();

export const DocumentPDF = ({ data }: { data: DocumentPDFData }) => {
  const paragraphs = stripHtml(data.content).split("\n\n").filter((paragraph) => paragraph.trim());
  return (
    <Document>
      <Page size="A4" style={documentStyles.page}>
        <View style={documentStyles.header}><Text style={documentStyles.logo}>{data.clinicName || "NEURONEX"}</Text></View>
        <Text style={documentStyles.title}>{data.title}</Text>
        <View style={documentStyles.body}>{paragraphs.map((paragraph, index) => <Text key={index} style={documentStyles.paragraph}>{paragraph}</Text>)}</View>
        <Text style={documentStyles.dateCity}>{data.date}</Text>
        <View style={documentStyles.signature}>
          <View style={documentStyles.signatureLine} />
          <Text style={documentStyles.signatureName}>{data.professionalName}</Text>
          <Text style={documentStyles.signatureRegistry}>{data.professionalRegistry}</Text>
        </View>
        <View style={documentStyles.footer} fixed><Text>Documento preparado no NeuroNex.</Text></View>
      </Page>
    </Document>
  );
};

function PdfField({ label, value, compact = false }: { label: string; value?: string; compact?: boolean }) {
  if (!value) return null;
  return (
    <View style={compact ? receiptStyles.insetField : receiptStyles.field}>
      <Text style={receiptStyles.label}>{label}</Text>
      <Text style={receiptStyles.value}>{value}</Text>
    </View>
  );
}

export const ReceiptPDF = ({ data }: { data: ReceiptPDFData }) => (
  <Document>
    <Page size="A4" style={receiptStyles.page}>
      <View style={receiptStyles.header}>
        <View>
          <View style={receiptStyles.brand}><Text>N</Text></View>
          <Text style={receiptStyles.eyebrow}>NeuroNex</Text>
          <Text style={receiptStyles.receiptTitle}>Comprovante de pagamento</Text>
        </View>
        <View style={receiptStyles.right}>
          <PdfField label="Referência" value={data.reference} />
          <PdfField label="Emissão" value={data.issuedAt} />
        </View>
      </View>

      <View style={receiptStyles.section}>
        <Text style={receiptStyles.label}>Valor do pagamento</Text>
        <Text style={receiptStyles.amount}>{data.amountFormatted}</Text>
        <View style={receiptStyles.inset}>
          <PdfField compact label="Método" value={data.paymentMethod} />
          <PdfField compact label="Data do pagamento" value={data.paymentDate} />
          <PdfField compact label="Parcela" value={data.installmentLabel} />
          <PdfField compact label="Operação relacionada" value={data.relatedReference} />
        </View>
      </View>

      <View style={[receiptStyles.section, receiptStyles.columns]}>
        <View style={receiptStyles.column}>
          <Text style={receiptStyles.heading}>Pagador</Text>
          <PdfField label="Nome" value={data.payerName} />
          <PdfField label="CPF/CNPJ" value={data.payerDocument || "Não informado"} />
        </View>
        <View style={receiptStyles.column}>
          <Text style={receiptStyles.heading}>Beneficiário</Text>
          <PdfField label="Nome" value={data.beneficiaryName} />
          <PdfField label="CPF" value={data.beneficiaryDocument || "Não informado"} />
          <PdfField label="Vínculo com o pagador" value={data.payerBeneficiaryRelationship} />
        </View>
      </View>

      <View style={receiptStyles.section}>
        <Text style={receiptStyles.heading}>Serviço e atendimento</Text>
        <Text style={receiptStyles.body}>{data.serviceDescription}</Text>
        {data.serviceDate ? <Text style={[receiptStyles.value, { marginTop: 8 }]}>Atendimento em {data.serviceDate}</Text> : null}
        {data.notes ? <Text style={receiptStyles.note}>{data.notes}</Text> : null}
      </View>

      <View style={[receiptStyles.section, receiptStyles.columns]}>
        <View style={receiptStyles.column}>
          <Text style={receiptStyles.heading}>Emissor</Text>
          <PdfField label="Nome / Razão social" value={data.issuerName} />
          <PdfField label="CPF/CNPJ" value={data.issuerDocument || "Não informado"} />
          <PdfField label="Registro profissional" value={data.issuerRegistry} />
          <PdfField label="Endereço" value={data.issuerAddress} />
        </View>
        <View style={receiptStyles.column}>
          <Text style={receiptStyles.heading}>Vínculos fiscais</Text>
          <PdfField label="Receita Saúde" value={data.receitaSaudeReference || (data.fiscalMode === "individual" ? "Não vinculado" : undefined)} />
          <PdfField label="Nota fiscal" value={data.nfseReference || (data.fiscalMode === "company" ? "Não vinculada" : undefined)} />
        </View>
      </View>

      <View style={receiptStyles.footer}>
        <Text style={receiptStyles.fiscal}>{data.fiscalNotice}</Text>
        <Text style={receiptStyles.provider}>{data.processedByNeuroFinance ? "Pagamento processado no NeuroFinance · serviços financeiros por Asaas" : "Comprovante gerencial NeuroNex"}</Text>
      </View>
    </Page>
  </Document>
);
