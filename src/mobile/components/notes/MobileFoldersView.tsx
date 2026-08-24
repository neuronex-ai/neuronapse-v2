import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useNoteModules } from "@/hooks/use-note-modules";
import { motion } from "framer-motion";
import {
    Activity, CheckSquare,
    ChevronRight, Folder, Layout, MoreHorizontal, NotebookPen, Plus, Sparkles, Trash2, Workflow
} from "lucide-react";
import { useState } from "react";

interface MobileFoldersViewProps {
    onSelectFolder: (id: string | 'all' | 'tasks' | 'neuroview' | 'neuroflow' | 'neuropulse') => void;
    currentFolderId: string | 'all' | 'tasks' | null;
    totalNotesCount: number;
    tasksCount: number;
}

export const MobileFoldersView = ({ onSelectFolder, currentFolderId: _currentFolderId, totalNotesCount, tasksCount }: MobileFoldersViewProps) => {
    const { modules, createModule, deleteModule } = useNoteModules();
    const [newModuleName, setNewModuleName] = useState("");
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    const handleCreateModule = () => {
        if (!newModuleName.trim()) return;
        createModule(newModuleName);
        setNewModuleName("");
        setIsCreateOpen(false);
    };

    const SmartFolderItem = ({ icon: Icon, label, count, id }: any) => (
        <button
            onClick={() => onSelectFolder(id)}
            className="w-full flex items-center justify-between p-4 min-h-[60px] border-b border-border/10 last:border-0 active:bg-secondary/50 transition-colors group hover:bg-secondary/30"
        >
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-secondary/50 flex items-center justify-center border border-border/10">
                    <Icon className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
                <span className="text-[15px] font-medium text-foreground">{label}</span>
            </div>
            <div className="flex items-center gap-3">
                {count !== undefined && <span className="text-sm text-muted-foreground font-medium">{count}</span>}
                <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
            </div>
        </button>
    );

    return (
        <div className="flex flex-col h-full bg-background text-foreground overflow-y-auto pb-32 relative z-0">
            {/* Background - Z-index baixo para não cobrir o nav global */}
            <div className="fixed inset-0 pointer-events-none z-[-1]">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-secondary/20 rounded-full blur-[150px]" />
            </div>

            {/* Header - Padding superior para começar abaixo do Nav Global */}
            <header className="px-6 pt-24 pb-6 relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-between items-end"
                >
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                                <Sparkles className="w-4.5 h-4.5 text-primary" />
                            </div>
                            <h1 className="text-2xl font-black tracking-tighter text-foreground">Notas</h1>
                        </div>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest ml-[48px]">Base de Inteligência</p>
                    </div>

                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button
                                size="icon"
                                className="h-10 w-10 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground border border-border/10 active:scale-90 transition-all shrink-0"
                            >
                                <Plus className="w-5 h-5" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-card border-border text-foreground w-[90vw] rounded-[28px] p-6 shadow-2xl z-[10001]">
                            <DialogHeader className="mb-5">
                                <DialogTitle className="text-xl font-bold tracking-tight">Nova Pasta</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                                <Input
                                    placeholder="Ex: Evolução Semanal"
                                    value={newModuleName}
                                    onChange={(e) => setNewModuleName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleCreateModule()}
                                    className="bg-secondary/20 border-border/20 text-foreground h-14 rounded-xl px-5 focus-visible:ring-primary/20 text-[15px]"
                                    autoFocus
                                />
                                <Button
                                    onClick={handleCreateModule}
                                    className="w-full h-14 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-[11px] uppercase tracking-wider"
                                >
                                    Criar Pasta
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </motion.div>
            </header>

            {/* Smart Folders */}
            <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mx-5 mt-4 rounded-[24px] overflow-hidden bg-card border border-border/10 mb-6 relative z-10 shadow-sm"
            >
                <SmartFolderItem id="all" icon={NotebookPen} label="Todas as Notas" count={totalNotesCount} />
                <SmartFolderItem id="tasks" icon={CheckSquare} label="Tarefas" count={tasksCount} />
            </motion.section>

            <div className="px-6 pb-3 flex items-center justify-between relative z-10">
                <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Organização</h2>
            </div>

            <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mx-5 rounded-[24px] overflow-hidden bg-card border border-border/10 mb-8 relative z-10 shadow-sm"
            >
                {modules?.map((module) => (
                    <div key={module.id} className="relative group border-b border-border/10 last:border-0 hover:bg-secondary/30 transition-colors">
                        <button
                            onClick={() => onSelectFolder(module.id)}
                            className="w-full flex items-center justify-between p-4 min-h-[64px] active:bg-secondary/50 transition-colors"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-secondary/50 border border-border/10 flex items-center justify-center">
                                    <Folder className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                                </div>
                                <span className="text-[15px] font-semibold text-foreground">{module.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-muted-foreground font-medium">{(module as any).notes_count || 0}</span>
                                <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
                            </div>
                        </button>

                        <div className="absolute right-12 top-1/2 -translate-y-1/2">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-foreground active:scale-95 transition-all"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <MoreHorizontal className="w-4 h-4" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-card border-border text-foreground rounded-xl shadow-2xl min-w-[140px] z-[10001]">
                                    <DropdownMenuItem
                                        className="text-rose-500 focus:text-rose-600 focus:bg-rose-500/10 text-xs gap-2 font-semibold cursor-pointer"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deleteModule(module.id);
                                        }}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Excluir
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                ))}

                {modules?.length === 0 && (
                    <div className="p-10 text-center text-muted-foreground">
                        <p className="text-xs mt-1">Crie pastas para organizar suas notas</p>
                    </div>
                )}
            </motion.section>

            <div className="px-6 pb-3 flex items-center justify-between relative z-10">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-3 h-3 text-primary" />
                    <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">NeuroInteligência</h2>
                </div>
                <div className="px-2 py-0.5 rounded-md border text-[8px] bg-primary/5 text-primary border-primary/20 font-black uppercase tracking-tighter">Premium</div>
            </div>

            <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mx-5 rounded-[24px] overflow-hidden bg-gradient-to-b from-card to-card/50 border border-border/10 relative z-10 shadow-sm"
            >
                <SmartFolderItem id="neuroview" icon={Layout} label="NeuroView" />
                <SmartFolderItem id="neuroflow" icon={Workflow} label="NeuroFlow" />
                <SmartFolderItem id="neuropulse" icon={Activity} label="NeuroPulse" />
            </motion.section>
        </div>
    );
};
