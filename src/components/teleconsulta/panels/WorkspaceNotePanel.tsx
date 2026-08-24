import { useState } from 'react';
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Save, Bell } from "lucide-react";
import { useCreatePersonalNote } from '@/hooks/use-create-personal-note';
import { useCreateReminder } from '@/hooks/use-create-reminder';

interface WorkspaceNotePanelProps {
  patientId: string;
  patientName: string;
}

export const WorkspaceNotePanel = ({ patientId, patientName }: WorkspaceNotePanelProps) => {
  const [notes, setNotes] = useState("");
  const { mutate: createNote, isPending: isCreatingNote } = useCreatePersonalNote();
  const { mutate: createReminder, isPending: isCreatingReminder } = useCreateReminder();

  const handleSaveAsNote = () => {
    if (!notes.trim()) return;
    const title = `Nota da sessão com ${patientName} - ${new Date().toLocaleDateString()}`;
    createNote({ patientId, content: notes, title });
  };

  const handleSaveAsReminder = () => {
    if (!notes.trim()) return;
    // For simplicity, sets reminder for tomorrow. A date picker could be added.
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    createReminder({ title: notes.substring(0, 100), dueDate: tomorrow });
  };

  const isSaving = isCreatingNote || isCreatingReminder;

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex justify-end p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!notes.trim() || isSaving}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleSaveAsNote} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              <span>Salvar como Nota</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSaveAsReminder} disabled={isSaving}>
              <Bell className="mr-2 h-4 w-4" />
              <span>Criar Lembrete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Textarea
        placeholder="Anotações da sessão..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="flex-1 bg-transparent border-0 focus:ring-0 focus:bg-transparent resize-none text-sm leading-relaxed text-foreground p-2 pt-0 placeholder:text-muted-foreground/40 custom-scrollbar"
      />
    </div>
  );
};