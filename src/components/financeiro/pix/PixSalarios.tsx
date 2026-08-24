import { LockKeyhole, Sparkles, Users } from "lucide-react";

export function PixSalarios() {
  return (
    <section className="mx-auto flex min-h-[420px] max-w-3xl flex-col items-center justify-center rounded-[36px] border border-zinc-200/70 bg-white/75 p-10 text-center dark:border-white/[0.08] dark:bg-white/[0.025]">
      <div className="flex h-24 w-24 items-center justify-center rounded-[32px] bg-zinc-950 text-white shadow-2xl dark:bg-white dark:text-zinc-950">
        <Users className="h-10 w-10" />
      </div>
      <div className="mt-7 flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">
        <Sparkles className="h-3.5 w-3.5" /> Em breve
      </div>
      <h3 className="mt-5 text-2xl font-black">Pix em lote com autorização segura</h3>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-500">Estamos preparando uma revisão única de todos os favorecidos, confirmação por PIN e acompanhamento individual de cada pagamento.</p>
      <p className="mt-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400"><LockKeyhole className="h-4 w-4" /> Nenhum pagamento em lote será enviado sem revisão e PIN</p>
    </section>
  );
}
