"use client";

import { ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";

const labels: Record<string, string> = {
  agenda: "Agenda",
  pacientes: "Pacientes",
  teleconsulta: "Teleconsulta",
  notas: "Notas",
  financeiro: "Financeiro",
  gestao: "Gestão",
  neurofinance: "NeuroFinance",
  pix: "Pix",
  pagar: "Pagar",
  qrcode: "QR Code",
  recebidos: "Recebidos",
  chaves: "Chaves",
  transferir: "Transferir",
  saque: "Saque",
  pagamentos: "Pagamentos",
  boleto: "Boleto",
  agendados: "Agendados",
  extrato: "Extrato",
  receitas: "Receitas",
  despesas: "Despesas",
  cobrancas: "Cobranças",
  inadimplencia: "Inadimplência",
  planejamento: "Planejamento",
  relatorios: "Relatórios",
  ajustes: "Ajustes",
  integracoes: "Integrações",
  "synapse-ai": "Synapse",
};

const looksLikeId = (value: string) => value.length > 20 && value.includes("-");

export const MobileRoutePill = () => {
  const location = useLocation();
  const crumbs = useMemo(() => {
    const segments = location.pathname.split("/").filter(Boolean);
    let path = "";

    return segments.map((segment, index) => {
      path += `/${segment}`;
      const previous = segments[index - 1];
      const label = looksLikeId(segment)
        ? previous === "pacientes" ? "Prontuário" : "Detalhes"
        : labels[segment] || segment.replace(/-/g, " ");
      return { label, href: path };
    }).slice(-4);
  }, [location.pathname]);

  if (location.pathname === "/dashboard" || crumbs.length === 0) return null;

  return (
    <nav aria-label="Trilha da página" className="pointer-events-auto min-w-0 max-w-[calc(100vw-7.5rem)] overflow-hidden rounded-full border border-foreground/[0.07] bg-background/62 px-3 py-2 shadow-[0_12px_30px_-24px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.055]">
      <div className="flex min-w-0 items-center gap-1 overflow-hidden">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <div key={crumb.href} className="flex min-w-0 items-center gap-1">
              {index > 0 ? <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/30" /> : null}
              {last ? (
                <span className="truncate text-[7px] font-black uppercase tracking-[0.09em] text-foreground">{crumb.label}</span>
              ) : (
                <Link to={crumb.href} className="truncate text-[7px] font-black uppercase tracking-[0.09em] text-muted-foreground/55 active:text-foreground">
                  {crumb.label}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
};
