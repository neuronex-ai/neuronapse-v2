import { BubbleMenu } from '@tiptap/react';
import {
  ArrowDownToLine,
  ArrowRightToLine,
  Trash2,
  Rows,
  Columns,
  ArrowUpToLine,
  ArrowLeftToLine,
  MoreHorizontal,
  GripVertical,
  Settings2,
  AlignLeft // Added AlignLeft as it was used but not imported
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

interface TableMenuProps {
  editor: any;
}

const TableButton = ({ onClick, icon: Icon, title, isDestructive = false, isActive = false }: any) => (
  <button
    onClick={onClick}
    className={cn(
      "p-2 rounded-lg transition-all duration-200 flex items-center justify-center relative",
      isActive
        ? "bg-zinc-900 text-white dark:bg-white dark:text-black shadow-[0_5px_15px_rgba(0,0,0,0.1)]"
        : isDestructive
          ? "text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600"
          : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
    )}
    title={title}
  >
    <Icon className="h-4 w-4" />
    {isActive && (
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-zinc-900 dark:bg-white" />
    )}
  </button>
);

export const TableMenu = ({ editor }: TableMenuProps) => {
  if (!editor) return null;

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="tableMenu"
      shouldShow={({ editor }) => editor.isActive('table')}
      tippyOptions={{
        duration: 200,
        animation: 'shift-away',
        placement: 'top',
        maxWidth: 'none',
        offset: [0, 10]
      }}
      className="flex items-center gap-1 p-1.5 rounded-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-3xl border border-zinc-200 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] overflow-hidden ring-1 ring-black/5 dark:ring-white/5"
    >
      <div className="flex items-center gap-0.5">
        <div className="px-2 border-r border-zinc-100 dark:border-white/5 flex items-center cursor-grab active:cursor-grabbing text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 transition-colors">
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="px-3 py-1 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5 flex items-center gap-2">
          <Settings2 className="h-3 w-3 text-zinc-400 dark:text-zinc-500" />
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">Tabela</span>
        </div>
        <Separator orientation="vertical" className="h-4 bg-zinc-100 dark:bg-white/10 mx-2" />

        <TableButton onClick={() => editor.chain().focus().addColumnBefore().run()} icon={ArrowLeftToLine} title="Adicionar coluna antes" />
        <TableButton onClick={() => editor.chain().focus().addColumnAfter().run()} icon={ArrowRightToLine} title="Adicionar coluna depois" />
        <TableButton onClick={() => editor.chain().focus().deleteColumn().run()} icon={Columns} title="Remover coluna" isDestructive />
      </div>

      <Separator orientation="vertical" className="h-6 bg-zinc-100 dark:bg-white/10 mx-2" />

      <div className="flex items-center gap-0.5">
        <TableButton onClick={() => editor.chain().focus().addRowBefore().run()} icon={ArrowUpToLine} title="Adicionar linha antes" />
        <TableButton onClick={() => editor.chain().focus().addRowAfter().run()} icon={ArrowDownToLine} title="Adicionar linha depois" />
        <TableButton onClick={() => editor.chain().focus().deleteRow().run()} icon={Rows} title="Remover linha" isDestructive />
      </div>

      <Separator orientation="vertical" className="h-6 bg-zinc-100 dark:bg-white/10 mx-2" />

      <div className="flex items-center gap-0.5">
        <TableButton onClick={() => editor.chain().focus().toggleHeaderCell().run()} icon={AlignLeft} title="Alternar Cabeçalho" />
        <TableButton onClick={() => editor.chain().focus().mergeCells().run()} icon={MoreHorizontal} title="Mesclar Células" />
        <TableButton onClick={() => editor.chain().focus().deleteTable().run()} icon={Trash2} title="Excluir Tabela" isDestructive />
      </div>
    </BubbleMenu>
  );
};