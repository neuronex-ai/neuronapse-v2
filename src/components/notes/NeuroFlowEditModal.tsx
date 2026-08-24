"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { usePersonalNotes } from "@/hooks/use-personal-notes";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { lazy, Suspense } from "react";

const NoteEditor = lazy(() =>
    import("@/components/notes/NoteEditor").then((module) => ({ default: module.NoteEditor }))
);

interface NeuroFlowEditModalProps {
    noteId: string | null;
    isOpen: boolean;
    onClose: () => void;
}

export const NeuroFlowEditModal = ({ noteId, isOpen, onClose }: NeuroFlowEditModalProps) => {
    const { notes, updateNote, deleteNote } = usePersonalNotes();
    const activeNote = notes?.find(n => n.id === noteId);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-[90vw] w-[1200px] h-[85vh] p-0 bg-transparent border-none shadow-none gap-0 overflow-hidden">
                <AnimatePresence>
                    {isOpen && (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="w-full h-full bg-[#FAFAFA] dark:bg-[#0A0A0A] border border-white/10 rounded-[32px] shadow-[0_32px_120px_rgba(0,0,0,0.5)] flex flex-col relative overflow-hidden"
                        >
                            {/* Header / Toolbar */}
                            <div className="h-14 shrink-0 flex items-center justify-between px-6 bg-white/50 dark:bg-black/20 backdrop-blur-xl border-b border-black/5 dark:border-white/5 z-20">
                                <div className="flex items-center gap-3">
                                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Editor de Pensamento Lateral</span>
                                </div>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={onClose}
                                    className="h-8 w-8 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground transition-all"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="flex-1 overflow-hidden relative">
                                {activeNote ? (
                                    <Suspense fallback={
                                        <div className="flex h-full w-full items-center justify-center">
                                            <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
                                        </div>
                                    }>
                                        <NoteEditor 
                                            note={activeNote}
                                            onUpdate={(id, updates) => updateNote({ id, updates })}
                                            onDelete={(id) => { deleteNote(id); onClose(); }}
                                            isFocusMode={false}
                                            onToggleFocus={() => {}}
                                        />
                                    </Suspense>
                                ) : (
                                    <div className="h-full w-full flex flex-col items-center justify-center">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary/20 mb-4" />
                                        <p className="text-xs text-muted-foreground font-medium">Carregando conteúdo neural...</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </DialogContent>
        </Dialog>
    );
};
