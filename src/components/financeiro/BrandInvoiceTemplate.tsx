import type { ReceiptPDFData } from "@/lib/pdf-types";

interface ReceiptTemplateProps {
  data: ReceiptPDFData;
}

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-1 text-[12px] font-semibold leading-5 text-zinc-950">{value}</p>
    </div>
  );
}

export const BrandInvoiceTemplate = ({ data }: ReceiptTemplateProps) => (
  <article className="flex aspect-[210/297] w-full flex-col overflow-hidden bg-white p-[16mm] font-sans text-zinc-950 selection:bg-zinc-100 print:p-[15mm] print:shadow-none">
    <header className="flex items-start justify-between gap-8 border-b border-zinc-200 pb-8">
      <div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-950 text-lg font-black text-white">N</div>
        <p className="mt-5 text-[9px] font-black uppercase tracking-[0.28em] text-zinc-500">NeuroNex</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight">Comprovante de pagamento</h1>
      </div>
      <div className="text-right">
        <Field label="Referência" value={data.reference} />
        <div className="mt-4"><Field label="Emissão" value={data.issuedAt} /></div>
      </div>
    </header>

    <section className="border-b border-zinc-200 py-9">
      <p className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-500">Valor do pagamento</p>
      <p className="mt-3 text-4xl font-black tracking-[-0.04em] tabular-nums">{data.amountFormatted}</p>
      <div className="mt-6 grid grid-cols-2 gap-x-10 gap-y-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
        <Field label="Método" value={data.paymentMethod} />
        <Field label="Data do pagamento" value={data.paymentDate} />
        <Field label="Parcela" value={data.installmentLabel} />
        <Field label="Operação relacionada" value={data.relatedReference} />
      </div>
    </section>

    <section className="grid grid-cols-2 gap-10 border-b border-zinc-200 py-8">
      <div className="space-y-5">
        <p className="text-[10px] font-black uppercase tracking-[0.2em]">Pagador</p>
        <Field label="Nome" value={data.payerName} />
        <Field label="CPF/CNPJ" value={data.payerDocument || "Não informado"} />
      </div>
      <div className="space-y-5">
        <p className="text-[10px] font-black uppercase tracking-[0.2em]">Beneficiário</p>
        <Field label="Nome" value={data.beneficiaryName} />
        <Field label="CPF" value={data.beneficiaryDocument || "Não informado"} />
        <Field label="Vínculo com o pagador" value={data.payerBeneficiaryRelationship} />
      </div>
    </section>

    <section className="border-b border-zinc-200 py-8">
      <p className="text-[10px] font-black uppercase tracking-[0.2em]">Serviço e atendimento</p>
      <p className="mt-4 text-[13px] font-semibold leading-6">{data.serviceDescription}</p>
      {data.serviceDate ? <p className="mt-2 text-[11px] text-zinc-600">Atendimento em {data.serviceDate}</p> : null}
      {data.notes ? <p className="mt-4 rounded-xl bg-zinc-50 p-4 text-[10px] leading-5 text-zinc-600">{data.notes}</p> : null}
    </section>

    <section className="grid grid-cols-2 gap-10 py-8">
      <div className="space-y-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em]">Emissor</p>
        <Field label="Nome / Razão social" value={data.issuerName} />
        <Field label="CPF/CNPJ" value={data.issuerDocument || "Não informado"} />
        <Field label="Registro profissional" value={data.issuerRegistry} />
        <Field label="Endereço" value={data.issuerAddress} />
      </div>
      <div className="space-y-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em]">Vínculos fiscais</p>
        <Field label="Receita Saúde" value={data.receitaSaudeReference || (data.fiscalMode === "individual" ? "Não vinculado" : undefined)} />
        <Field label="Nota fiscal" value={data.nfseReference || (data.fiscalMode === "company" ? "Não vinculada" : undefined)} />
      </div>
    </section>

    <footer className="mt-auto border-t border-zinc-200 pt-6">
      <p className="text-[9px] leading-4 text-zinc-600">{data.fiscalNotice}</p>
      <div className="mt-5 flex items-end justify-between gap-6 text-[8px] font-bold uppercase tracking-[0.14em] text-zinc-400">
        <span>{data.processedByNeuroFinance ? "Pagamento processado no NeuroFinance · serviços financeiros por Asaas" : "Comprovante gerencial NeuroNex"}</span>
        <span>Página 1 de 1</span>
      </div>
    </footer>
  </article>
);
