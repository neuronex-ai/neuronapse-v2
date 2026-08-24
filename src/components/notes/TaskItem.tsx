import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Reminder } from "@/types";
import confetti from "canvas-confetti";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AnimatePresence, motion } from "framer-motion";
import {
    AlertCircle, Check,
    Clock, MessageCircle, MoreHorizontal, Trash2, User
} from "lucide-react";

interface TaskItemProps {
  task: Reminder;
  onToggle: (id: string, status: boolean) => void;
  onDelete: (id: string) => void;
  onShare: (task: Reminder, method: 'whatsapp' | 'email') => void;
}

const categoryColors: Record<string, string> = {
  "Urgente": "bg-rose-500/20 text-rose-400 border-rose-500/30",
  "Clínico": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Pessoal": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "Geral": "bg-white/10 text-zinc-400 border-white/10"
};

export const TaskItem = ({ task, onToggle, onDelete, onShare }: TaskItemProps) => {
  const isOverdue = isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date)) && !task.is_completed;
  const colorClass = categoryColors[task.category] || categoryColors["Geral"];

  const handleCheck = () => {
    if (!task.is_completed) {
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#10b981', '#34d399', '#ffffff'],
        disableForReducedMotion: true,
        scalar: 0.6
      });
    }
    onToggle(task.id, !task.is_completed);
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    if (isToday(d)) return "Hoje";
    if (isTomorrow(d)) return "Amanhã";
    return format(d, "dd MMM", { locale: ptBR });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      className={cn(
        "group relative p-5 rounded-[32px] border transition-all duration-500 overflow-hidden",
        task.is_completed
          ? "bg-secondary/30 dark:bg-white/[0.02] border-border/5 dark:border-white/5 opacity-60"
          : "bg-[#0A0A0B]/60 backdrop-blur-2xl border-white/[0.06] hover:border-primary/20 hover:bg-primary/[0.02] shadow-xl"
      )}
    >
      {/* Glow Effect on Hover */}
      {!task.is_completed && (
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
      )}

      {/* Priority bar */}
      {!task.is_completed && task.category === 'Urgente' && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500 shadow-[0_0_10px_#f43f5e]" />
      )}

      <div className="flex items-start gap-4 relative z-10">

        {/* Checkbox Button */}
        <button
          onClick={handleCheck}
          className={cn(
            "mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 relative overflow-hidden group/btn",
            task.is_completed
              ? "bg-emerald-500 border-emerald-500 shadow-[0_0_15px_#10b981]"
              : "border-border/20 dark:border-white/20 hover:border-primary hover:bg-primary/10"
          )}
        >
          <AnimatePresence>
            {task.is_completed && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Check className="w-3.5 h-3.5 text-black stroke-[3]" />
              </motion.div>
            )}
          </AnimatePresence>
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-start justify-between">
            <h4 className={cn(
              "text-sm font-medium transition-all duration-300 leading-snug",
              task.is_completed ? "text-muted-foreground line-through decoration-border/50" : "text-foreground dark:text-white/90"
            )}>
              {task.title}
            </h4>

            {/* Actions Menu */}
            <div className={cn(
              "flex items-center gap-1 transition-opacity duration-300 opacity-100"
            )}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-secondary dark:hover:bg-white/10 text-muted-foreground hover:text-foreground dark:hover:text-white">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover dark:bg-[#0A0A0B] border-border/10 dark:border-white/10 backdrop-blur-xl">
                  <DropdownMenuItem onClick={() => onShare(task, 'whatsapp')} className="text-xs gap-2 cursor-pointer">
                    <MessageCircle className="h-3.5 w-3.5 text-emerald-400" /> WhatsApp
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDelete(task.id)} className="text-xs gap-2 cursor-pointer text-rose-400 focus:text-rose-300 focus:bg-rose-500/10">
                    <Trash2 className="h-3.5 w-3.5" /> Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-2 mt-2">

            {/* Due Date Pill */}
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider transition-colors",
              isOverdue
                ? "bg-rose-500/10 border-rose-500/30 text-rose-500 animate-pulse"
                : "bg-secondary/50 dark:bg-white/5 border-border/10 dark:border-white/10 text-muted-foreground"
            )}>
              {isOverdue ? <AlertCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              {formatDate(task.due_date)}
            </div>

            {/* Category Pill */}
            <div className={cn("px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider", colorClass)}>
              {task.category}
            </div>

            {/* Patient Context */}
            {task.title.toLowerCase().includes("paciente") && (
              <div className="flex items-center gap-1 text-[10px] text-primary/80 pl-1">
                <User className="h-3 w-3" />
                <span className="truncate max-w-[80px]">Clínico</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
