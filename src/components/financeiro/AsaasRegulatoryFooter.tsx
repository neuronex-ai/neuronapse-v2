/**
 * AsaasRegulatoryFooter
 * 
 * Displays discreet Asaas regulatory disclosure at the bottom of financial pages.
 * Uses the official AsaasStamp (shield + "Serviços financeiros / Asaas") per brand guidelines.
 */


import { AsaasStamp } from './AsaasStamp';

export function AsaasRegulatoryFooter({ className = '' }: { className?: string }) {
    return (
        <div className={`flex flex-col items-center gap-4 py-4 mt-2 border-none ${className}`}>
            <p className="text-[11px] text-zinc-500/80 dark:text-zinc-500/80 text-center font-medium tracking-wide max-w-md leading-relaxed mb-1">
                Serviços financeiros intermediados por Asaas Gestão Financeira S.A. — CNPJ 19.540.550/0001-21.
                Instituição de pagamento regulada pelo Banco Central do Brasil.
            </p>
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                    <img 
                        src="/neuro-logo.png" 
                        alt="NeuroNex" 
                        className="h-6 w-auto brightness-0 dark:invert transition-all duration-300"
                    />
                    <span className="font-bold text-sm tracking-tight text-zinc-900 dark:text-white uppercase">NeuroNex AI</span>
                </div>
                <span className="text-zinc-300 dark:text-zinc-700 font-light text-xl">|</span>
                <AsaasStamp />
            </div>
        </div>
    );
}
