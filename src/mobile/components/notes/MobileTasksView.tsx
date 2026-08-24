import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { CheckCircle2, Circle, Clock, Tag, Trash2, Calendar } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useState, useRef } from "react";
import { NewTaskModal } from "@/components/notes/NewTaskModal";

const SwipeableTaskItem = ({ task, onToggle, onDelete }: { task: any, onToggle: () => void, onDelete: () => void }) => {
    const [swiped, setSwiped] = useState(false);
    const constraintsRef = useRef(null);
    const x = useMotionValue(0);
    const deleteOpacity = useTransform(x, [-120, -60], [1, 0]);
    const deleteScale = useTransform(x, [-120, -60], [1, 0.8]);

    const handleDragEnd = (_: any, info: PanInfo) => {
        if (info.offset.x < -80) {
            setSwiped(true);
        } else {
            setSwiped(false);
        }
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative overflow-hidden rounded-[24px]"
            ref={constraintsRef}
        >
            {/* Delete background */}
            <motion.div
                className="absolute inset-0 bg-destructive/10 rounded-[24px] flex items-center justify-end px-6"
                style={{ opacity: deleteOpacity, scale: deleteScale }}
            >
                <button onClick={onDelete} className="flex items-center gap-2 text-destructive">
                    <Trash2 className="w-5 h-5" />
                    <span className="text-xs font-bold uppercase tracking-wider">Excluir</span>
                </button>
            </motion.div>

            <motion.div
                drag="x"
                dragConstraints={{ left: -120, right: 0 }}
                dragElastic={0.1}
                onDragEnd={handleDragEnd}
                animate={{ x: swiped ? -120 : 0 }}
                style={{ x }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className={cn(
                    "p-4 rounded-[24px] border transition-all duration-300 cursor-grab active:cursor-grabbing relative z-10",
                    task.is_completed
                        ? "bg-secondary/20 border-border/5 opacity-50"
                        : "bg-card border-border/10 shadow-xl shadow-black/5"
                )}
            >
                <div className="flex items-start gap-4">
                    <button
                        onClick={onToggle}
                        className="mt-1 shrink-0"
                    >
                        {task.is_completed ? (
                            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                        ) : (
                            <Circle className="w-6 h-6 text-muted-foreground/30 hover:text-primary transition-colors" />
                        )}
                    </button>

                    <div className="flex-1 space-y-2">
                        <p className={cn(
                            "text-[15px] font-semibold transition-all",
                            task.is_completed ? "line-through text-muted-foreground/30" : "text-foreground"
                        )}>
                            {task.title}
                        </p>

                        <div className="flex flex-wrap gap-3">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider">
                                <Clock className="w-3 h-3" />
                                {format(new Date(task.due_date), "dd MMM, HH:mm", { locale: ptBR })}
                            </div>
                            {task.category && (
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary/60 uppercase tracking-wider">
                                    <Tag className="w-3 h-3" />
                                    {task.category}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};

interface MobileTasksViewProps {
    showNewTaskModal?: boolean;
    onCloseNewTaskModal?: () => void;
}

export const MobileTasksView = ({ showNewTaskModal, onCloseNewTaskModal }: MobileTasksViewProps) => {
    const queryClient = useQueryClient();

    const { data: tasks, isLoading } = useQuery({
        queryKey: ["mobile-tasks"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("reminders")
                .select("*")
                .order("due_date", { ascending: true });

            if (error) throw error;
            return data;
        }
    });

    const toggleTask = useMutation({
        mutationFn: async ({ id, completed }: { id: string, completed: boolean }) => {
            const { error } = await supabase
                .from("reminders")
                .update({ is_completed: !completed })
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["mobile-tasks"] });
            queryClient.invalidateQueries({ queryKey: ["tasks-count"] });
        }
    });

    const deleteTask = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("reminders").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["mobile-tasks"] });
            queryClient.invalidateQueries({ queryKey: ["tasks-count"] });
            toast.success("Tarefa removida");
        }
    });

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col px-5 py-6 pb-32 space-y-6">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.2em]">Pendentes</h2>
                    <p className="text-2xl font-black tracking-tighter text-foreground">
                        {tasks?.filter(t => !t.is_completed).length || 0} Tarefas
                    </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-secondary/50 border border-border/10 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-muted-foreground" />
                </div>
            </div>

            {/* Swipe hint */}
            <p className="text-[9px] text-muted-foreground/40 font-medium uppercase tracking-wider text-center">
                ← Deslize para excluir
            </p>

            <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                    {tasks?.map((task) => (
                        <SwipeableTaskItem
                            key={task.id}
                            task={task}
                            onToggle={() => toggleTask.mutate({ id: task.id, completed: task.is_completed })}
                            onDelete={() => deleteTask.mutate(task.id)}
                        />
                    ))}
                </AnimatePresence>

                {tasks?.length === 0 && (
                    <div className="py-20 text-center space-y-4">
                        <div className="w-16 h-16 rounded-full bg-secondary/20 border border-dashed border-border/20 flex items-center justify-center mx-auto">
                            <CheckCircle2 className="w-8 h-8 text-muted-foreground/20" />
                        </div>
                        <p className="text-sm text-muted-foreground/40 font-medium tracking-tight">Nenhuma tarefa para o momento</p>
                    </div>
                )}
            </div>

            {/* New Task Modal */}
            <NewTaskModal
                open={showNewTaskModal || false}
                onOpenChange={onCloseNewTaskModal}
            />
        </div>
    );
};