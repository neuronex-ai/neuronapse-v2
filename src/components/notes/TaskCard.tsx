"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
    CheckCircle2, Clock, FileText
} from "lucide-react";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Reminder } from "@/types";
import { TaskDetailModal } from "./TaskDetailModal";

interface TaskCardProps {
    task: any;
    onToggle?: (id: string, status: boolean) => void;
    onDelete?: (id: string) => void;
    onUpdate?: (id: string, updates: Partial<Reminder>) => void;
    isKanban?: boolean;
    isOverlay?: boolean;
    categories?: string[];
}

export const TaskCard = ({ task, onToggle, onDelete, onUpdate, isKanban = false, isOverlay = false, categories }: TaskCardProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: task.id, disabled: isOverlay });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition: transition || undefined,
    };

    const isOverdue = !task.is_completed && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
    const due = new Date(task.due_date);

    const cardContent = (
        <div
            className={cn(
                "rounded-[28px] border group relative transition-all duration-700 [transition-timing-function:cubic-bezier(0.2,0,0,1)]",
                // Base state
                "bg-white/80 dark:bg-white/[0.03] backdrop-blur-xl border-zinc-200/50 dark:border-white/[0.08]",
                "shadow-[0_8px_20px_-6px_rgba(0,0,0,0.02)] dark:shadow-none",

                // Interaction
                !isOverlay && !task.isGhost && "hover:-translate-y-1.5 hover:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.4)] hover:border-zinc-300 dark:hover:border-white/20 hover:bg-white dark:hover:bg-white/[0.05]",

                // Overlay state (dragging)
                isOverlay && [
                    "border-zinc-200 dark:border-white/20",
                    "shadow-[0_40px_80px_-20px_rgba(0,0,0,0.25)] dark:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)]",
                    "bg-white/95 dark:bg-zinc-900/90 scale-[1.05] -rotate-1",
                    "ring-1 ring-black/5 dark:ring-white/10"
                ],

                // Ghost state (placeholder)
                task.isGhost && "border-dashed border-zinc-200 dark:border-white/10 bg-transparent shadow-none opacity-20 grayscale",

                // Completed state
                task.is_completed && "bg-zinc-50/50 dark:bg-white/[0.01] border-zinc-200/30 dark:border-white/5 opacity-50 grayscale-[0.5]",

                isKanban ? "px-6 py-5" : "px-5 py-4"
            )}
        >
            {/* Liquid Glass Glow Effect */}
            {!task.isGhost && !task.is_completed && (
                <div className="absolute inset-0 rounded-[28px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000 overflow-hidden pointer-events-none">
                    <div className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1)_0%,transparent_50%)] dark:bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_0%,transparent_50%)] animate-[spin_8s_linear_infinite]" />
                </div>
            )}

            {/* Status indicator dot */}
            {!task.isGhost && (
                <div className={cn(
                    "absolute top-5 right-5",
                    task.is_completed ? "opacity-30" : "opacity-100"
                )}>
                    <div className={cn(
                        "w-2 h-2 rounded-full transition-all duration-700 shadow-[0_0_12px_rgba(0,0,0,0.1)]",
                        task.is_completed ? "bg-zinc-300 dark:bg-zinc-800" :
                            isOverdue ? "bg-red-500 shadow-red-500/50 animate-pulse" :
                                isToday(due) ? "bg-zinc-900 dark:bg-white shadow-zinc-900/40 dark:shadow-white/40" :
                                    "bg-zinc-400 dark:bg-zinc-700"
                    )} />
                </div>
            )}

            <div className="flex items-start gap-4 relative z-10">
                {/* Icon Container with Advanced Styling */}
                <div className={cn(
                    "w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 transition-all duration-700 border",
                    task.is_completed
                        ? "bg-zinc-100 dark:bg-zinc-900/50 border-zinc-200/50 dark:border-white/5 text-zinc-400"
                        : "bg-white dark:bg-white/[0.04] border-zinc-200/60 dark:border-white/[0.1] text-zinc-900 dark:text-white shadow-sm group-hover:scale-110 group-hover:rotate-3 group-hover:bg-zinc-900 dark:group-hover:bg-white group-hover:text-white dark:group-hover:text-zinc-900 group-hover:shadow-[0_8px_16px_-4px_rgba(0,0,0,0.1)]"
                )}>
                    {task.is_completed
                        ? <CheckCircle2 className="h-4.5 w-4.5" />
                        : <FileText className="h-4.5 w-4.5" />
                    }
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-2 pt-0.5">
                    <h4 className={cn(
                        "text-[15px] font-bold tracking-tight leading-snug line-clamp-2 transition-colors duration-500",
                        task.is_completed
                            ? "text-zinc-400 dark:text-zinc-600 line-through decoration-zinc-300/40"
                            : "text-zinc-900 dark:text-zinc-100"
                    )}>
                        {task.title}
                    </h4>

                    <div className="flex items-center gap-2.5">
                        <div className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.1em] transition-all duration-500",
                            isOverdue ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400" :
                                isToday(due) ? "bg-zinc-100 dark:bg-white/10 text-zinc-900 dark:text-white" :
                                    "bg-zinc-50 dark:bg-white/[0.03] text-zinc-400 dark:text-zinc-600"
                        )}>
                            <Clock className="h-3 w-3 shrink-0" />
                            <span>
                                {isToday(due) ? "Hoje" : isTomorrow(due) ? "Amanhã" : format(due, "dd MMM", { locale: ptBR })}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    if (isOverlay) return cardContent;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "relative outline-none group/sortable",
                isDragging ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100"
            )}
        >
            <TaskDetailModal
                task={task}
                onToggle={onToggle}
                onDelete={onDelete}
                onUpdate={onUpdate}
                categories={categories}
            >
                <div
                    {...listeners}
                    {...attributes}
                    className="w-full cursor-grab active:cursor-grabbing focus:outline-none touch-none"
                >
                    {cardContent}
                </div>
            </TaskDetailModal>
        </div>
    );
};
