import { usePatientGoals } from "@/hooks/use-patient-goals";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
import { format } from "date-fns";
import { CheckCircle2, Circle, Loader2, Target, Trophy } from "lucide-react";

interface PatientGoalsPanelProps {
  patientId: string;
}

export const PatientGoalsPanel = ({ patientId }: PatientGoalsPanelProps) => {
  const { goals, isLoading, toggleGoal } = usePatientGoals(patientId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
      </div>
    );
  }

  const handleToggle = (id: string, isCompleted: boolean) => {
    toggleGoal({ id, isCompleted });

    if (isCompleted) {
      confetti({
        particleCount: 60,
        spread: 50,
        origin: { y: 0.7 },
        colors: ['#10b981', '#34d399', '#059669'],
        disableForReducedMotion: true
      });
    }
  };

  const completedCount = goals?.filter(g => g.is_completed).length || 0;
  const totalCount = goals?.length || 0;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;




  return (
    <div className="space-y-6 p-6 h-full flex flex-col">
      <div className="flex items-center justify-between border-b border-white/5 pb-4 shrink-0">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-white">Metas</h2>
        </div>

        {/* Progress Ring Mini */}
        <div className="relative w-10 h-10 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90">
            <circle cx="20" cy="20" r="16" fill="transparent" stroke="#ffffff10" strokeWidth="4" />
            <circle
              cx="20" cy="20" r="16"
              fill="transparent"
              stroke="#10b981"
              strokeWidth="4"
              strokeDasharray={100}
              strokeDashoffset={100 - progress}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <span className="absolute text-[8px] font-bold text-emerald-400">{Math.round(progress)}%</span>
        </div>
      </div>

      <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar pr-1">
        {goals && goals.length > 0 ? (
          goals.map((goal) => (
            <div
              key={goal.id}
              className={cn(
                "group flex items-start gap-3 p-4 rounded-2xl border transition-all cursor-pointer select-none active:scale-[0.98]",
                goal.is_completed
                  ? "bg-emerald-500/[0.03] border-emerald-500/10 opacity-70"
                  : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10"
              )}
              onClick={() => handleToggle(goal.id, !goal.is_completed)}
            >
              <div className="mt-0.5 flex-shrink-0 transition-transform duration-300">
                {goal.is_completed ? (
                  <div className="text-emerald-500 scale-110">
                    <CheckCircle2 className="h-5 w-5 fill-emerald-500/20" />
                  </div>
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm font-medium transition-all leading-snug",
                  goal.is_completed ? "text-muted-foreground line-through decoration-white/20" : "text-white/90"
                )}>
                  {goal.description}
                </p>
                {goal.due_date && (
                  <p className="text-[10px] text-muted-foreground/60 mt-1 font-mono uppercase tracking-wide">
                    Atá© {format(new Date(goal.due_date + 'T00:00:00'), 'dd/MM')}
                  </p>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground border border-dashed border-white/10 rounded-2xl bg-white/[0.01] p-6">
            <Trophy className="h-10 w-10 mb-3 opacity-20" />
            <p className="text-sm font-medium">Nenhuma meta ativa.</p>
            <p className="text-xs text-muted-foreground/50 mt-1">Aguarde seu terapeuta definir novos objetivos.</p>
          </div>
        )}
      </div>
    </div>
  );
};
