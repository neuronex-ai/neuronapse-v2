import { useLastSessionSummary } from "@/hooks/use-last-session-summary";
import { Loader2, Sparkles, FileText, Info } from "lucide-react";

interface SummaryPanelProps {
  patientId: string;
}

export const SummaryPanel = ({ patientId }: SummaryPanelProps) => {
  const { data: aiSummary, isLoading, error } = useLastSessionSummary(patientId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-rose-400 p-4">
        <Info className="w-8 h-8 mb-2" />
        <p>Erro ao carregar resumo.</p>
      </div>
    );
  }

  const hasTopics = aiSummary?.topics && aiSummary.topics.length > 0;
  const hasSummary = aiSummary?.summary && aiSummary.summary.trim() !== '';

  if (!hasTopics && !hasSummary) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground opacity-50 p-4">
        <Info className="w-8 h-8 mb-2" />
        <p className="font-medium">Nenhum resumo de IA disponível</p>
        <p className="text-xs">O resumo da última sessão aparecerá aqui.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 overflow-y-auto custom-scrollbar h-full">
      {hasTopics && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5" />
            <h4 className="font-bold">Pontos Chave da Última Sessão</h4>
          </div>
          <ul className="space-y-2 list-disc list-inside text-foreground/80 text-sm pl-2">
            {aiSummary.topics.map((point: string, index: number) => (
              <li key={index} className="leading-normal">{point}</li>
            ))}
          </ul>
        </div>
      )}

      {hasTopics && hasSummary && (
        <div className="w-full h-px bg-border/10" />
      )}

      {hasSummary && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center gap-2 text-primary">
            <FileText className="h-5 w-5" />
            <h4 className="font-bold">Síntese da Sessão</h4>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
            {aiSummary.summary}
          </p>
        </div>
      )}
    </div>
  );
};