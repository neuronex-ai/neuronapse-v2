import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Smile, Frown, Meh, Laugh, Angry, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MoodTrackerProps {
  patientId: string;
}

const moods = [
  { score: 1, icon: Angry, label: "Péssimo", color: "text-rose-500", bg: "bg-rose-500/10 border-rose-500/20", hover: "hover:bg-rose-500/20" },
  { score: 2, icon: Frown, label: "Ruim", color: "text-orange-500", bg: "bg-orange-500/10 border-orange-500/20", hover: "hover:bg-orange-500/20" },
  { score: 3, icon: Meh, label: "Neutro", color: "text-yellow-500", bg: "bg-yellow-500/10 border-yellow-500/20", hover: "hover:bg-yellow-500/20" },
  { score: 4, icon: Smile, label: "Bem", color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20", hover: "hover:bg-emerald-500/20" },
  { score: 5, icon: Laugh, label: "Ótimo", color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/20", hover: "hover:bg-blue-500/20" },
];

const saveMood = async (data: { patientId: string, score: number, notes: string }) => {
  const { error } = await supabase
    .from('patient_mood_logs')
    .insert({
      patient_id: data.patientId,
      mood_score: data.score,
      notes: data.notes,
    });

  if (error) throw new Error(error.message);
};

const fetchTodayLog = async (patientId: string) => {
  const today = new Date();
  const start = new Date(today.setHours(0, 0, 0, 0)).toISOString();
  const end = new Date(today.setHours(23, 59, 59, 999)).toISOString();

  const { data, error } = await supabase
    .from('patient_mood_logs')
    .select('*')
    .eq('patient_id', patientId)
    .gte('created_at', start)
    .lte('created_at', end)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
};

export const MoodTracker = ({ patientId }: MoodTrackerProps) => {
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  const { data: todayLog, isLoading: isLoadingLog } = useQuery({
    queryKey: ['todayMood', patientId],
    queryFn: () => fetchTodayLog(patientId),
    enabled: !!patientId
  });

  const { mutate, isPending } = useMutation({
    mutationFn: saveMood,
    onSuccess: () => {
      toast.success("Diário registrado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['todayMood', patientId] });
      setNotes("");
      setSelectedScore(null);
    },
    onError: (err) => toast.error(`Erro: ${err.message}`)
  });

  const handleSubmit = () => {
    if (selectedScore) {
      mutate({ patientId, score: selectedScore, notes });
    }
  };

  if (isLoadingLog) return <div className="h-32 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  // State: Already logged today
  if (todayLog) {
    const mood = moods.find(m => m.score === todayLog.mood_score);
    const Icon = mood?.icon || Smile;

    return (
      <div className="flex flex-col items-center text-center justify-center h-full py-6">
        <div className="relative mb-4">
            <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl animate-pulse" />
            <div className="w-16 h-16 rounded-full bg-[#0F0F11] border border-emerald-500/30 flex items-center justify-center relative z-10 shadow-lg">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
        </div>
        <h3 className="text-lg font-bold text-white mb-1">Registrado!</h3>
        <p className="text-sm text-muted-foreground/80 mb-4">Você já completou seu diário hoje.</p>
        
        <div className={cn("inline-flex items-center gap-3 px-4 py-2 rounded-xl border backdrop-blur-md", mood?.bg)}>
            <Icon className={cn("h-5 w-5", mood?.color)} />
            <span className="font-bold text-sm text-white/90">{mood?.label}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="text-center space-y-1 pt-2">
        <h3 className="text-lg font-bold text-white">Como você está hoje?</h3>
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
            {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </p>
      </div>

      <div className="flex justify-between gap-2 px-1">
        {moods.map((mood) => {
          const Icon = mood.icon;
          const isSelected = selectedScore === mood.score;
          
          return (
            <button
              key={mood.score}
              onClick={() => setSelectedScore(mood.score)}
              className={cn(
                "flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border transition-all duration-300 flex-1 active:scale-90",
                isSelected 
                    ? cn(mood.bg, "scale-105 shadow-lg ring-1 ring-white/10") 
                    : cn("bg-white/[0.02] border-white/5", mood.hover)
              )}
            >
              <Icon className={cn("h-6 w-6 transition-colors duration-300", isSelected ? mood.color : "text-muted-foreground group-hover:text-white")} />
              <span className={cn("text-[9px] font-bold uppercase tracking-wide transition-colors", isSelected ? "text-white" : "text-muted-foreground/60")}>
                {mood.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className={cn("space-y-3 transition-all duration-500 ease-out", selectedScore ? "opacity-100 translate-y-0" : "opacity-50 translate-y-2 pointer-events-none")}>
        <Textarea 
            placeholder="Deseja adicionar alguma nota sobre seu dia? (Opcional)" 
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="bg-black/20 border-white/10 focus:border-white/20 focus:bg-black/40 rounded-xl resize-none text-sm min-h-[80px]"
        />
        
        <Button 
            className="w-full rounded-xl h-11 bg-primary hover:bg-primary/90 shadow-glow font-bold text-xs uppercase tracking-widest"
            onClick={handleSubmit}
            disabled={!selectedScore || isPending}
        >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar"}
        </Button>
      </div>
    </div>
  );
};