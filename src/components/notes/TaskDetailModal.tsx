"use client";

import { useState, useEffect } from "react";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Save, Pencil, CheckCircle, Trash2, Calendar as CalendarIcon, Tag, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { cn } from "@/lib/utils";
import { ResponsiveModal } from "@/components/ui/ResponsiveModal";
import { motion, AnimatePresence } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Reminder } from "@/types";

interface TaskDetailModalProps {
    children: React.ReactNode;
    task: any;
    onToggle?: (id: string, status: boolean) => void;
    onDelete?: (id: string) => void;
    onUpdate?: (id: string, updates: Partial<Reminder>) => void;
    categories?: string[];
}

export const TaskDetailModal = ({
    children,
    task,
    onToggle,
    onDelete,
    onUpdate,
    categories = ["Geral", "Clínico", "Financeiro", "Pessoal", "Urgente"]
}: TaskDetailModalProps) => {
    const [open, setOpen] = useState(false);
    const [editedTitle, setEditedTitle] = useState(task.title);
    const [editedDate, setEditedDate] = useState<Date | undefined>(new Date(task.due_date));
    const [editedCategory, setEditedCategory] = useState(task.category || "Geral");
    const [isEditing, setIsEditing] = useState(false);
    const [step, setStep] = useState(1);

    useEffect(() => {
        if (open) {
            setEditedTitle(task.title);
            setEditedDate(new Date(task.due_date));
            setEditedCategory(task.category || "Geral");
            setIsEditing(false);
            setStep(1);
        }
    }, [open, task]);

    const isOverdue = !task.is_completed && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
    const due = new Date(task.due_date);

    const getStatusInfo = () => {
        if (task.is_completed) return { label: 'Concluída', color: 'bg-zinc-900 dark:bg-white', textColor: 'text-zinc-900 dark:text-white', bgColor: 'bg-zinc-100 dark:bg-white/10' };
        if (isOverdue) return { label: 'Atrasada', color: 'bg-zinc-400 dark:bg-zinc-600', textColor: 'text-zinc-500 dark:text-zinc-400', bgColor: 'bg-zinc-100 dark:bg-white/5' };
        if (isToday(due)) return { label: 'Prioridade Hoje', color: 'bg-zinc-900 dark:bg-white shadow-[0_0_10px_rgba(255,255,255,0.3)]', textColor: 'text-zinc-900 dark:text-white', bgColor: 'bg-zinc-100 dark:bg-white/20' };
        return { label: 'Pendente', color: 'bg-zinc-300 dark:bg-zinc-700', textColor: 'text-zinc-400 dark:text-zinc-500', bgColor: 'bg-transparent' };
    };
    const statusInfo = getStatusInfo();

    const handleSave = () => {
        if (!editedTitle.trim()) return;
        onUpdate?.(task.id, {
            title: editedTitle,
            due_date: editedDate?.toISOString() || task.due_date,
            category: editedCategory as any,
        });
        setIsEditing(false);
    };

    const handleDelete = () => {
        onDelete?.(task.id);
        setOpen(false);
    };

    const handleToggle = () => {
        onToggle?.(task.id, !task.is_completed);
    };

    const labelStyle = "text-[9px] font-black uppercase tracking-[0.35em] text-zinc-400 dark:text-zinc-500 mb-3 ml-1 block";

    return (
        <ResponsiveModal
            open={open}
            onOpenChange={setOpen}
            trigger={children}
            className="sm:max-w-[520px] bg-white dark:bg-[#060606] backdrop-blur-3xl border border-zinc-200/60 dark:border-white/[0.08] p-0 overflow-hidden rounded-[48px] shadow-[0_80px_160px_-40px_rgba(0,0,0,0.6)] ring-1 ring-black/5 dark:ring-white/5"
        >
            <div className="relative p-10 md:p-14 max-h-[85vh] overflow-y-auto custom-scrollbar">
                {/* Background texture */}
                <div className="absolute inset-0 notes-retina-texture opacity-[0.18] pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-b from-zinc-50/50 dark:from-white/[0.01] via-transparent to-zinc-50/30 dark:to-white/[0.01] pointer-events-none" />

                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div
                            key="detail"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            className="space-y-10 relative z-10"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-4xl font-black text-zinc-900 dark:text-white tracking-tighter">Detalhes</h3>
                                    <div className="flex items-center gap-3 mt-4">
                                        <div className={cn("flex items-center gap-2.5 px-4 py-2 rounded-full border backdrop-blur-md", statusInfo.bgColor, 'border-zinc-200/50 dark:border-white/10')}>
                                            <div className={cn("w-1.5 h-1.5 rounded-full transition-all duration-1000", statusInfo.color, !task.is_completed && isToday(due) && "animate-pulse")} />
                                            <span className={cn("text-[9px] font-black uppercase tracking-[0.3em]", statusInfo.textColor)}>{statusInfo.label}</span>
                                        </div>
                                        <span className="text-[9px] font-bold text-zinc-300 dark:text-zinc-700 tracking-wider">
                                            {format(due, "dd MMM yyyy", { locale: ptBR })}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button size="icon" variant="ghost" onClick={() => setIsEditing(!isEditing)} className={cn(
                                        "rounded-[20px] border h-14 w-14 shadow-sm transition-all duration-700 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
                                        isEditing
                                            ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white scale-105 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.3)]"
                                            : "bg-zinc-50 dark:bg-white/5 border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/10 hover:scale-105"
                                    )}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* Task Title Card */}
                            <div className="p-8 bg-zinc-50/80 dark:bg-white/[0.02] border border-zinc-200/60 dark:border-white/[0.06] rounded-[36px] group transition-all duration-700 hover:bg-white dark:hover:bg-white/[0.04] hover:border-zinc-300 dark:hover:border-white/10 shadow-sm hover:shadow-lg relative overflow-hidden">
                                <div className="absolute inset-0 notes-retina-texture opacity-[0.14] pointer-events-none" />
                                <div className="flex items-center gap-6 relative z-10">
                                    <button
                                        onClick={handleToggle}
                                        className={cn(
                                            "w-16 h-16 rounded-[24px] flex items-center justify-center shadow-[0_24px_48px_-12px_rgba(0,0,0,0.25)] transition-all duration-700 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] shrink-0",
                                            task.is_completed
                                                ? "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-400 dark:text-zinc-500 scale-95 opacity-60"
                                                : "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:scale-110 hover:rotate-6 active:scale-90"
                                        )}
                                    >
                                        {task.is_completed
                                            ? <CheckCircle className="h-6 w-6" />
                                            : <FileText className="h-6 w-6" />
                                        }
                                    </button>
                                    <div className="flex-1 min-w-0 space-y-2">
                                        <span className="text-[8px] font-black uppercase tracking-[0.5em] text-zinc-400 dark:text-zinc-600 block">Ação Estratégica</span>
                                        {isEditing ? (
                                            <Input
                                                value={editedTitle}
                                                onChange={(e) => setEditedTitle(e.target.value)}
                                                className="h-12 bg-white dark:bg-black/40 border-zinc-200 dark:border-white/10 rounded-2xl text-lg font-black tracking-tight focus:ring-0 focus-visible:ring-0"
                                                autoFocus
                                            />
                                        ) : (
                                            <h4 className={cn(
                                                "text-xl font-black tracking-tight leading-tight transition-colors duration-700",
                                                task.is_completed
                                                    ? "text-zinc-300 dark:text-zinc-700 line-through decoration-zinc-300/50"
                                                    : "text-zinc-900 dark:text-white"
                                            )}>{task.title}</h4>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Date & Category */}
                            <div className="grid grid-cols-2 gap-5">
                                <div className="p-7 border border-zinc-200/60 dark:border-white/[0.06] bg-zinc-50/60 dark:bg-white/[0.015] rounded-[32px] space-y-5 shadow-sm hover:shadow-md transition-all duration-700 relative overflow-hidden group">
                                    <div className="absolute inset-0 notes-retina-texture opacity-[0.14] pointer-events-none" />
                                    <span className={labelStyle}>Prazo</span>
                                    {isEditing ? (
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="w-full h-14 rounded-2xl justify-start bg-white dark:bg-black/40 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white font-black text-sm">
                                                    <CalendarIcon className="mr-3 h-4 w-4 text-zinc-400" />
                                                    {editedDate ? format(editedDate, "dd/MM/yy") : "—"}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="p-0 bg-white dark:bg-zinc-950 rounded-[28px] border-zinc-200 dark:border-white/10 shadow-[0_48px_96px_-24px_rgba(0,0,0,0.5)]" align="start">
                                                <Calendar mode="single" selected={editedDate} onSelect={setEditedDate} className="p-4" />
                                            </PopoverContent>
                                        </Popover>
                                    ) : (
                                        <div className="relative z-10">
                                            <p className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter tabular-nums">
                                                {format(due, "dd")}
                                                <span className="text-lg text-zinc-300 dark:text-zinc-700 ml-1.5 font-bold">{format(due, "MMM", { locale: ptBR })}</span>
                                            </p>
                                            <p className={cn(
                                                "text-[10px] font-black uppercase tracking-[0.2em] mt-2 transition-colors duration-700",
                                                isOverdue ? "text-zinc-900 dark:text-white" :
                                                    isToday(due) ? "text-zinc-900 dark:text-white" :
                                                        "text-zinc-400 dark:text-zinc-600"
                                            )}>
                                                {isToday(due) ? "Prioridade Zero" : isTomorrow(due) ? "Amanhã" : isOverdue ? "Atrasada" : format(due, "EEEE", { locale: ptBR })}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div className="p-7 border border-zinc-200/60 dark:border-white/[0.06] bg-zinc-50/60 dark:bg-white/[0.015] rounded-[32px] space-y-5 shadow-sm hover:shadow-md transition-all duration-700 relative overflow-hidden group">
                                    <div className="absolute inset-0 notes-retina-texture opacity-[0.14] pointer-events-none" />
                                    <span className={labelStyle}>Contexto</span>
                                    {isEditing ? (
                                        <Select value={editedCategory} onValueChange={setEditedCategory}>
                                            <SelectTrigger className="h-14 rounded-2xl bg-white dark:bg-black/40 border-zinc-200 dark:border-white/10 font-black text-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-[24px] bg-white dark:bg-zinc-950 border-zinc-200 dark:border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.4)]">
                                                {categories.map(cat => <SelectItem key={cat} value={cat} className="font-black py-3 uppercase tracking-widest text-[11px]">{cat}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <div className="flex items-center gap-3 relative z-10">
                                            <Tag className="h-4 w-4 text-zinc-400 dark:text-zinc-600" />
                                            <p className="text-lg font-black text-zinc-900 dark:text-white tracking-tight">{task.category || "Geral"}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-4 pt-2">
                                <Button
                                    onClick={() => setStep(2)}
                                    className="flex-1 h-[72px] bg-zinc-50 dark:bg-white/[0.02] text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-[28px] uppercase tracking-[0.3em] text-[10px] font-black border border-zinc-200/50 dark:border-white/[0.06] transition-all duration-700 hover:bg-white dark:hover:bg-white/5 hover:shadow-lg"
                                >
                                    <Trash2 className="h-4 w-4 mr-3" />
                                    Descartar
                                </Button>
                                {isEditing ? (
                                    <Button
                                        onClick={handleSave}
                                        className="flex-1 h-[72px] bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-[28px] uppercase tracking-[0.3em] text-[10px] font-black shadow-[0_32px_64px_-16px_rgba(0,0,0,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-700"
                                    >
                                        <Save className="h-4 w-4 mr-3" />
                                        Salvar Edição
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={handleToggle}
                                        className={cn(
                                            "flex-1 h-[72px] rounded-[28px] uppercase tracking-[0.3em] text-[10px] font-black hover:scale-[1.02] active:scale-[0.98] transition-all duration-700 outline-none ring-0",
                                            task.is_completed
                                                ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-700"
                                                : "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.4)] hover:shadow-[0_40px_80px_-16px_rgba(0,0,0,0.5)]"
                                        )}
                                    >
                                        <CheckCircle className="h-4 w-4 mr-3" />
                                        {task.is_completed ? "Reativar Fluxo" : "Finalizar Fluxo"}
                                    </Button>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div
                            key="confirm"
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                            className="flex flex-col items-center text-center space-y-14 py-16 relative z-10"
                        >
                            <motion.div
                                initial={{ rotate: 0 }}
                                animate={{ rotate: [0, -5, 5, 0] }}
                                transition={{ delay: 0.3, duration: 0.6 }}
                                className="w-32 h-32 rounded-[44px] bg-zinc-100 dark:bg-white/[0.03] flex items-center justify-center border border-zinc-200 dark:border-white/10 shadow-inner"
                            >
                                <Trash2 className="h-14 w-14 text-zinc-300 dark:text-zinc-700" />
                            </motion.div>
                            <div className="space-y-5">
                                <h2 className="text-4xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter">Remover Registro</h2>
                                <p className="text-[10px] text-zinc-400 dark:text-zinc-600 font-black uppercase tracking-[0.4em] max-w-[360px] mx-auto leading-loose">
                                    Esta ação removerá permanentemente o registro do seu fluxo de trabalho.
                                </p>
                            </div>
                            <div className="flex gap-4 w-full px-4">
                                <Button onClick={() => setStep(1)} className="flex-1 h-[72px] bg-zinc-100 dark:bg-white/[0.03] text-zinc-500 rounded-[28px] uppercase tracking-[0.3em] text-[10px] font-black border border-zinc-200/50 dark:border-white/[0.06] transition-all duration-700 hover:bg-white dark:hover:bg-white/5">Cancelar</Button>
                                <Button onClick={handleDelete} className="flex-1 h-[72px] bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-[28px] uppercase tracking-[0.3em] text-[10px] font-black shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] hover:bg-black dark:hover:bg-zinc-200 transition-all duration-700">Confirmar</Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </ResponsiveModal>
    );
};
