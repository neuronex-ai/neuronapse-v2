export interface DocumentPDFData {
  type: string;
  title: string;
  content: string;
  patientName: string;
  patientDoc?: string;
  professionalName: string;
  professionalRegistry: string;
  date: string;
  clinicName?: string;
}

export interface ReceiptPDFData {
  reference: string;
  issuedAt: string;
  issuerName: string;
  issuerDocument?: string;
  issuerRegistry: string;
  issuerAddress?: string;
  payerName: string;
  payerDocument?: string;
  beneficiaryName: string;
  beneficiaryDocument?: string;
  payerBeneficiaryRelationship?: string;
  amountFormatted: string;
  serviceDescription: string;
  serviceDate?: string;
  paymentDate: string;
  paymentMethod: string;
  installmentLabel?: string;
  relatedReference?: string;
  notes?: string;
  fiscalMode: 'individual' | 'company' | 'unspecified';
  fiscalNotice: string;
  receitaSaudeReference?: string;
  nfseReference?: string;
  processedByNeuroFinance: boolean;
}
