import { Badge } from "@/components/ui/badge";
import { usePatientSessionSummary } from "@/hooks/use-patient-session-summary";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bot, BrainCircuit, Calendar, List, Loader2, Sparkles, TrendingUp } from "lucide-react";

interface PatientProgressPanelProps {
  patientName: string;
}

const sentimentColors: Record<string, string> = {
  Positivo: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Neutro: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Negativo: "bg-rose-500/10 text-rose-400 border-rose-500/20",
};

export const PatientProgressPanel = ({ patientName: _ }: PatientProgressPanelProps) => {
  const { data: latestNote, isLoading, error } = usePatientSessionSummary();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive text-sm bg-rose-500/5 rounded-xl mx-4">
        Não foi possível carregar o resumo.
      </div>
    );
  }

  const summary = latestNote?.ai_summary;

  if (!latestNote || !summary) {
    return (
      <div className="text-center py-12 px-6 text-muted-foreground border border-dashed border-white/10 rounded-2xl bg-white/[0.01] mx-4 my-4">
        <Bot className="h-12 w-12 mx-auto mb-4 opacity-30 text-primary" />
        <h3 className="text-sm font-semibold text-white mb-1">Aguardando Análise</h3>
        <p className="text-xs text-muted-foreground/60 max-w-xs mx-auto">Seu terapeuta ainda não disponibilizou um resumo de progresso para a última sessão.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Evolução
        </h2>
        <Badge variant="outline" className="bg-white/5 text-muted-foreground border-white/10 font-normal gap-1.5 py-1 px-2.5 h-7">
          <Calendar className="h-3 w-3" />
          {format(new Date(latestNote.created_at), "dd MMM", { locale: ptBR })}
        </Badge>
      </div>

      <div className="space-y-6">
        {/* Main Insight Card */}
        <div className="relative p-6 rounded-2xl bg-gradient-to-br from-primary/10 via-[#0A0A0B] to-transparent border border-primary/20 overflow-hidden shadow-lg">
          <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-[50px] rounded-full pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/20 text-primary">
                  <BrainCircuit className="h-4 w-4" />
                </div>
                <p className="text-xs font-bold uppercase tracking-wider text-white/90">Resumo Clínico</p>
              </div>
              <Badge className={cn("text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 border", sentimentColors[summary.sentiment] || sentimentColors.Neutro)}>
                {summary.sentiment}
              </Badge>
            </div>
            <p className="text-sm text-white/80 leading-relaxed font-light italic">
              "{summary.summary}"
            </p>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid gap-4 sm:grid-cols-2">

          {/* Topics */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest pl-1">
              <List className="h-3.5 w-3.5" /> Tópicos
            </div>
            <div className="flex flex-wrap gap-2">
              {summary.topics.map((topic, i) => (
                <div
                  key={i}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-xs font-medium text-white/80 hover:bg-white/[0.06] transition-colors cursor-default"
                >
                  {topic}
                </div>
              ))}
            </div>
          </div>

          {/* Next Steps */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest pl-1">
              <TrendingUp className="h-3.5 w-3.5" /> Próximos Passos
            </div>
            <ul className="space-y-2">
              {summary.next_steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-xs text-white/70 bg-white/[0.02] p-3 rounded-xl border border-white/5 hover:bg-white/[0.04] transition-colors">
                  <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shadow-[0_0_8px_rgba(139,92,246,0.5)]" />
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
