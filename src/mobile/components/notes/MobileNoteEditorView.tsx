import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronLeft, Save, Sparkles, Calendar, Loader2, Trash2 } from "lucide-react";
import { RichTextEditor } from "@/components/notes/RichTextEditor";

import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface MobileNoteEditorViewProps {
    noteId: string | null;
    onClose: () => void;
}

export const MobileNoteEditorView = ({ noteId, onClose }: MobileNoteEditorViewProps) => {
    const queryClient = useQueryClient();
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [lastSaved, setLastSaved] = useState<string | null>(null);

    const { data: note, isLoading } = useQuery({
        queryKey: ["note-editor", noteId],
        queryFn: async () => {
            if (!noteId) return null;
            const { data, error } = await supabase
                .from("personal_notes")
                .select("*")
                .eq("id", noteId)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!noteId
    });

    useEffect(() => {
        if (note) {
            setTitle(note.title || "");
            setContent(note.content || "");
            setLastSaved(note.updated_at);
        }
    }, [note]);

    const saveMutation = useMutation({
        mutationFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Não autenticado");

            const now = new Date().toISOString();
            const noteData = {
                title,
                content,
                user_id: user.id,
                updated_at: now
            };

            if (noteId) {
                const { error } = await supabase
                    .from("personal_notes")
                    .update(noteData)
                    .eq("id", noteId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from("personal_notes")
                    .insert([noteData]);
                if (error) throw error;
            }
            return now;
        },
        onSuccess: (updatedAt) => {
            queryClient.invalidateQueries({ queryKey: ["mobile-notes"] });
            setLastSaved(updatedAt);
            toast.success("Nota salva com sucesso");
        },
        onError: () => {
            toast.error("Erro ao salvar nota");
        }
    });

    const handleDelete = async () => {
        if (!noteId) return;
        const { error } = await supabase.from("personal_notes").delete().eq("id", noteId);
        if (error) {
            toast.error("Erro ao excluir nota");
            return;
        }
        queryClient.invalidateQueries({ queryKey: ["mobile-notes"] });
        toast.success("Nota excluída");
        onClose();
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-background relative h-full">
            {/* Editor Container */}
            <div className="flex-1 overflow-y-auto no-scrollbar">
                <div className="px-6 pt-[7.5rem] pb-40 space-y-8 max-w-2xl mx-auto">

                    {/* Meta info */}
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 select-none"
                    >
                        {lastSaved && (
                            <span className="flex items-center gap-2 bg-secondary/30 px-3 py-1.5 rounded-lg border border-border/5">
                                <Calendar className="w-3 h-3" />
                                {format(new Date(lastSaved), "dd MMM, HH:mm", { locale: ptBR })}
                            </span>
                        )}
                        {noteId && <div className="h-1 w-1 rounded-full bg-border" />}
                        {noteId && <span className="opacity-80">{content.length} caracteres</span>}
                    </motion.div>

                    {/* Title Input */}
                    <motion.input
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Título da nota"
                        className="w-full bg-transparent border-none text-[2.5rem] font-black tracking-tighter placeholder:text-muted-foreground/10 text-foreground focus:ring-0 p-0 outline-none leading-tight"
                    />

                    {/* Content Input - Replaced Textarea with RichTextEditor */}
                    <div className="relative -mx-4 px-4">
                        <RichTextEditor
                            content={content}
                            onChange={(html) => setContent(html)}
                            placeholder="Comece a escrever aqui..."
                            className="min-h-[60vh] text-lg leading-loose focus:outline-none"
                            editable={true}
                        />
                    </div>
                </div>
            </div>

            {/* Floating Action Bar */}
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="absolute bottom-6 inset-x-6 z-50 pointer-events-none"
            >
                <div className="flex items-center justify-between pointer-events-auto">
                    {/* Left Actions */}
                    <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-background/80 backdrop-blur-xl border border-border/10 shadow-lg">
                        <Button
                            size="icon" variant="ghost"
                            onClick={onClose}
                            className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </Button>
                        <div className="w-px h-4 bg-border/10" />
                        <Button
                            size="icon" variant="ghost"
                            onClick={handleDelete}
                            className="h-10 w-10 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-3">
                        <Button
                            onClick={() => saveMutation.mutate()}
                            disabled={saveMutation.isPending}
                            className={cn(
                                "h-14 px-6 rounded-2xl bg-primary text-primary-foreground shadow-2xl active:scale-95 transition-all hover:bg-primary/90 flex items-center gap-2 font-bold tracking-wide",
                                saveMutation.isPending && "opacity-80"
                            )}
                        >
                            {saveMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            <span>Salvar</span>
                        </Button>

                        <Button
                            size="icon"
                            variant="secondary"
                            className="h-14 w-14 rounded-2xl bg-card/80 border border-border/10 backdrop-blur-xl text-foreground shadow-2xl active:scale-90 transition-all hover:bg-secondary"
                        >
                            <Sparkles className="w-5 h-5 text-primary" />
                        </Button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};