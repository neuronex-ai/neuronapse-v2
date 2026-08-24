"use client";

import { PersonalNote } from "@/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Clock, ChevronRight } from "lucide-react";

interface MobileNotesListViewProps {
    notes: PersonalNote[];
    onNoteSelect: (id: string) => void;
}

/** Strip HTML tags and decode common entities for clean preview text */
const stripHtml = (html: string): string => {
    const text = html
        .replace(/<[^>]*>/g, ' ')       // replace tags with space
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')           // collapse multiple spaces
        .trim();
    return text;
};

export const MobileNotesListView = ({ notes, onNoteSelect }: MobileNotesListViewProps) => {
    if (notes.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center pt-20">
                <div className="w-20 h-20 rounded-[32px] bg-secondary/30 flex items-center justify-center mb-6">
                    <FileText className="w-8 h-8 text-muted-foreground/40" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">Sem notas encontradas</h3>
                <p className="text-sm text-muted-foreground max-w-[240px]">
                    Crie sua primeira nota tocando no botão + acima.
                </p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto px-5 pt-2 pb-32 no-scrollbar">
            <AnimatePresence mode="popLayout">
                {notes.map((note, index) => (
                    <motion.div
                        key={note.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => onNoteSelect(note.id)}
                        className="mb-3 p-5 rounded-[28px] bg-card border border-border/40 shadow-sm active:scale-[0.98] transition-all"
                    >
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-primary/5 flex items-center justify-center">
                                    <FileText className="w-4 h-4 text-primary" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-[15px] font-bold text-foreground truncate max-w-[180px]">
                                        {note.title || 'Nota sem título'}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <Clock className="w-3 h-3 text-muted-foreground/60" />
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">
                                            {format(new Date(note.updated_at), "d 'de' MMMM", { locale: ptBR })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground/20" />
                        </div>
                        <p className="text-[13px] text-muted-foreground line-clamp-2 leading-relaxed font-medium opacity-80">
                            {stripHtml(note.content) || 'Nenhum conteúdo...'}
                        </p>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};