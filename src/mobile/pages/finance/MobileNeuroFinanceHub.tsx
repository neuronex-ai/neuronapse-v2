import { ArrowDownLeft, Barcode, CalendarClock, FileText, Key, QrCode, Receipt, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { AsaasRegulatoryFooter } from "@/components/financeiro/AsaasRegulatoryFooter";
import { MobileActionListItem, MobileSectionHeader, MobileStatusBanner } from "../../components/MobilePagePrimitives";

const base = "/financeiro/neurofinance";

export function MobileNeuroFinanceHub() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <MobileStatusBanner
        variant="info"
        title="Operações conectadas ao NeuroFinance"
        description="Pagamentos e transferências consultam o destino antes de solicitar o PIN financeiro."
      />

      <section className="space-y-3">
        <MobileSectionHeader title="Pix" eyebrow="Transferências instantâneas" />
        <div className="grid gap-2">
          <MobileActionListItem icon={QrCode} title="Pagar Pix" description="Cole um código Pix, revise o recebedor e autorize com o PIN." status="Ativo" onClick={() => navigate(`${base}/pix/pagar`)} />
          <MobileActionListItem icon={Receipt} title="Gerar QR Code" description="Receba por uma chave ativa, sem exigir nome ou CPF do pagador." status="Ativo" onClick={() => navigate(`${base}/pix/qrcode`)} />
          <MobileActionListItem icon={ArrowDownLeft} title="Pix recebidos" description="Acompanhe recebimentos e cobranças Pix existentes." status="Ativo" onClick={() => navigate(`${base}/pix/recebidos`)} />
          <MobileActionListItem icon={Key} title="Minhas chaves" description="Crie, copie e remova chaves aleatórias da conta." status="Ativo" onClick={() => navigate(`${base}/pix/chaves`)} />
          <MobileActionListItem icon={Send} title="Transferir via Pix" description="Consulte a chave no DICT antes de enviar o dinheiro." status="Ativo" onClick={() => navigate(`${base}/transferir`)} />
        </div>
      </section>

      <section className="space-y-3">
        <MobileSectionHeader title="Conta" eyebrow="Pagamentos e histórico" />
        <div className="grid gap-2">
          <MobileActionListItem icon={Barcode} title="Pagar boleto" description="Leia, revise e escolha pagar agora ou agendar." status="Ativo" onClick={() => navigate(`${base}/pagamentos/boleto`)} />
          <MobileActionListItem icon={CalendarClock} title="Pagamentos agendados" description="Acompanhe programações, retornos e comprovantes." status="Ativo" onClick={() => navigate(`${base}/pagamentos/agendados`)} />
          <MobileActionListItem icon={FileText} title="Extrato" description="Movimentações realizadas, futuras e recorrentes." status="Ativo" onClick={() => navigate(`${base}/extrato`)} />
          <MobileActionListItem icon={Send} title="Sacar fundos" description="Envie saldo para uma conta ou chave cadastrada." status="Ativo" onClick={() => navigate(`${base}/saque`)} />
        </div>
      </section>

      <AsaasRegulatoryFooter />
    </div>
  );
}
