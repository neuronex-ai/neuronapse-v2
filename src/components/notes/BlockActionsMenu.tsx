import { BubbleMenu } from '@tiptap/react';
import {
    List,
    ListOrdered,
    CheckSquare,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Trash2,
    Settings2,
    GripVertical
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

interface BlockActionsMenuProps {
    editor: any;
}

const ActionButton = ({ onClick, icon: Icon, title, isActive = false, isDestructive = false }: any) => (
    <button
        onClick={onClick}
        className={cn(
            "p-2.5 rounded-xl transition-all duration-300 flex items-center justify-center relative group",
            isActive
                ? "bg-zinc-900 text-white shadow-[0_5px_15px_rgba(0,0,0,0.1)]"
                : isDestructive
                    ? "text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                    : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
        )}
        title={title}
    >
        <Icon className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
        {isActive && (
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white" />
        )}
    </button>
);

export const BlockActionsMenu = ({ editor }: BlockActionsMenuProps) => {
    if (!editor) return null;

    return (
        <BubbleMenu
            editor={editor}
            pluginKey="blockActionsMenu"
            shouldShow={({ state, editor }) => {
                const { selection } = state;
                const { empty } = selection;

                return empty && !editor.isActive('table') && editor.isEditable;
            }}
            tippyOptions={{
                duration: 200,
                animation: 'shift-away',
                placement: 'top',
                maxWidth: 'none',
                offset: [0, 15]
            }}
            className="flex items-center gap-1.5 p-2 rounded-[24px] bg-white/90 backdrop-blur-3xl border border-zinc-200 shadow-[0_30px_70px_rgba(0,0,0,0.1)] overflow-hidden animate-in fade-in zoom-in-95"
        >
            <div className="flex items-center gap-1">
                <div className="px-2 border-r border-zinc-100 flex items-center cursor-grab active:cursor-grabbing text-zinc-200 hover:text-zinc-400 transition-colors">
                    <GripVertical className="h-4 w-4" />
                </div>
                <div className="px-3 py-1 bg-zinc-50 rounded-xl border border-zinc-100 flex items-center gap-2">
                    <Settings2 className="h-3 w-3 text-zinc-400" />
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Bloco</span>
                </div>

                <Separator orientation="vertical" className="h-5 bg-zinc-100 mx-2" />

                <ActionButton
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    isActive={editor.isActive('bulletList')}
                    icon={List}
                    title="Lista de Marcadores"
                />
                <ActionButton
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    isActive={editor.isActive('orderedList')}
                    icon={ListOrdered}
                    title="Lista Numerada"
                />
                <ActionButton
                    onClick={() => editor.chain().focus().toggleTaskList().run()}
                    isActive={editor.isActive('taskList')}
                    icon={CheckSquare}
                    title="Checklist"
                />
            </div>

            <Separator orientation="vertical" className="h-8 bg-white/10 mx-1" />

            <div className="flex items-center gap-1">
                <ActionButton
                    onClick={() => editor.chain().focus().setTextAlign('left').run()}
                    isActive={editor.isActive({ textAlign: 'left' })}
                    icon={AlignLeft}
                    title="Alinhar Esquerda"
                />
                <ActionButton
                    onClick={() => editor.chain().focus().setTextAlign('center').run()}
                    isActive={editor.isActive({ textAlign: 'center' })}
                    icon={AlignCenter}
                    title="Centralizar"
                />
                <ActionButton
                    onClick={() => editor.chain().focus().setTextAlign('right').run()}
                    isActive={editor.isActive({ textAlign: 'right' })}
                    icon={AlignRight}
                    title="Alinhar Direita"
                />
            </div>

            <Separator orientation="vertical" className="h-8 bg-white/10 mx-1" />

            <div className="flex items-center gap-1">
                <button
                    onClick={() => {
                        const { $from } = editor.state.selection;
                        const range = { from: $from.before(), to: $from.after() };
                        editor.chain().focus().deleteRange(range).run();
                    }}
                    className="p-2.5 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-all"
                    title="Excluir Bloco"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
        </BubbleMenu>
    );
};
