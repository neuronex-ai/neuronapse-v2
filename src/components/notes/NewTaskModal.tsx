import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, CheckCircle2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useReminders } from "@/hooks/use-reminders";
import { ResponsiveModal } from "@/components/ui/ResponsiveModal";

interface NewTaskModalProps {
    children?: React.ReactNode;
    onOpenChange?: (open: boolean) => void;
    open?: boolean;
}

export const NewTaskModal = ({ children, onOpenChange, open: controlledOpen }: NewTaskModalProps) => {
    const [internalOpen, setInternalOpen] = useState(false);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;

    const [title, setTitle] = useState("");
    const [date, setDate] = useState<Date>(new Date());
    const [category, setCategory] = useState("Geral");

    const { createReminder } = useReminders();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleOpenChange = (val: boolean) => {
        if (!isControlled) {
            setInternalOpen(val);
        }
        onOpenChange?.(val);
        if (!val) {
            // Reset form when closing
            setTimeout(() => {
                setTitle("");
                setDate(new Date());
            }, 300);
        }
    };

    const handleSubmit = async () => {
        if (!title.trim()) return;

        setIsSubmitting(true);

        // Set default time to 09:00 if user didn't pick a specific time (simple logic for now)
        const due = new Date(date);
        if (due.getHours() === 0 && due.getMinutes() === 0) {
            due.setHours(9, 0, 0, 0);
        }

        await createReminder({
            title,
            due_date: due.toISOString(),
            category: category as any,
            is_completed: false
        });

        setIsSubmitting(false);
        handleOpenChange(false);
    };

    return (
        <ResponsiveModal
            open={open}
            onOpenChange={handleOpenChange}
            trigger={children}
            className="sm:max-w-[420px] p-0 gap-0 overflow-hidden shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] bg-background/95 backdrop-blur-[40px] border border-border/10 rounded-[32px]"
        >
            <div className="flex flex-col">
                <div className="p-8 border-b border-border/5 bg-card/40">
                    <h2 className="flex items-center gap-3 text-2xl font-light text-foreground tracking-tighter">
                        <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
                        Nova Meta
                    </h2>
                </div>

                <div className="p-6 space-y-4 pb-10">
                    <div className="space-y-3">
                        <label className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/50 ml-1">O que deve ser executado?</label>
                        <Input
                            placeholder="Descreva a atividade..."
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="bg-secondary/20 border-border/10 focus:border-border/20 focus:bg-secondary/30 h-14 rounded-2xl text-base tracking-tight transition-all pb-1 placeholder:text-muted-foreground/40 text-foreground"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/50 ml-1">Calendário</label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-light bg-secondary/20 border-border/10 hover:bg-secondary/30 h-14 rounded-2xl px-5 transition-all text-foreground",
                                            !date && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-3 h-4 w-4 text-muted-foreground" />
                                        {date ? format(date, "dd 'de' MMM", { locale: ptBR }) : <span>Definir Data</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 bg-popover border-border/10 backdrop-blur-3xl rounded-3xl overflow-hidden" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={date}
                                        onSelect={(d) => d && setDate(d)}
                                        initialFocus
                                        locale={ptBR}
                                        className="bg-transparent text-foreground"
                                        classNames={{
                                            day_selected: "bg-primary text-primary-foreground hover:bg-primary/90 focus:bg-primary/90 rounded-full font-bold",
                                            day_today: "bg-secondary text-foreground rounded-full",
                                        }}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/50 ml-1">Contexto</label>
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger className="bg-secondary/20 border-border/10 focus:bg-secondary/30 h-14 rounded-2xl px-5 transition-all text-sm font-light text-foreground">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-popover border-border/10 backdrop-blur-3xl rounded-2xl">
                                    <SelectItem value="Geral" className="rounded-lg">Geral</SelectItem>
                                    <SelectItem value="Urgente" className="rounded-lg">Urgente</SelectItem>
                                    <SelectItem value="Clínico" className="rounded-lg">Clínico</SelectItem>
                                    <SelectItem value="Pessoal" className="rounded-lg">Pessoal</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <Button
                        onClick={handleSubmit}
                        disabled={!title.trim() || isSubmitting}
                        className="w-full h-16 rounded-2xl bg-primary text-primary-foreground font-black uppercase text-[10px] tracking-[0.4em] mt-6 shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 duration-500 hover:bg-primary/90"
                    >
                        {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Registrar Meta"}
                    </Button>
                </div>
            </div>
        </ResponsiveModal>
    );
};