"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, Columns, Inbox, LayoutGrid, List } from "lucide-react";

interface TaskSidebarProps {
  view: 'list' | 'grid' | 'kanban';
  setView: (view: 'list' | 'grid' | 'kanban') => void;
  filter: 'all' | 'pending' | 'completed';
  setFilter: (filter: 'all' | 'pending' | 'completed') => void;
  isListCollapsed?: boolean;
  onToggleCollapsed: () => void;
}

const views = [
  { id: 'kanban', icon: Columns, label: 'Kanban' },
  { id: 'list', icon: List, label: 'Lista' },
  { id: 'grid', icon: LayoutGrid, label: 'Grade' },
] as const;

const filters = [
  { id: 'all', icon: Inbox, label: 'Todas' },
  { id: 'pending', icon: Clock, label: 'Pendentes' },
  { id: 'completed', icon: CheckCircle2, label: 'Concluídas' },
] as const;

export const TaskSidebar = ({
  view,
  setView,
  filter,
  setFilter,
  isListCollapsed = false,
  onToggleCollapsed,
}: TaskSidebarProps) => {
  if (isListCollapsed) {
    return (
      <div className="flex h-full w-[52px] flex-col items-center border-r border-white/[0.05] bg-white/[0.012] py-4 [.light_&]:border-zinc-200/60 [.light_&]:bg-white/35">
        <button
          onClick={onToggleCollapsed}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.04] text-zinc-400 transition-all hover:bg-white/[0.09] hover:text-white active:scale-95 [.light_&]:border-zinc-200/70 [.light_&]:bg-white [.light_&]:text-zinc-500 [.light_&]:hover:bg-zinc-100 [.light_&]:hover:text-zinc-950"
          title="Expandir filtros"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <Columns className="mt-6 h-4 w-4 text-zinc-600 [.light_&]:text-zinc-400" />
      </div>
    );
  }

  const renderOption = (
    item: typeof views[number] | typeof filters[number],
    active: boolean,
    onClick: () => void,
  ) => {
    const Icon = item.icon;
    return (
      <button
        key={item.id}
        onClick={onClick}
        className={cn(
          "relative flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left transition-all duration-250",
          active
            ? "bg-white text-zinc-950 shadow-[0_12px_30px_-20px_rgba(255,255,255,0.55)] [.light_&]:bg-zinc-950 [.light_&]:text-white"
            : "text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-100 [.light_&]:hover:bg-zinc-950/[0.045] [.light_&]:hover:text-zinc-950"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2.3 : 1.6} />
        <span className="text-[9px] font-black uppercase tracking-[0.17em]">{item.label}</span>
        {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-current opacity-35" />}
      </button>
    );
  };

  return (
    <div className="relative flex h-full w-[248px] shrink-0 flex-col overflow-hidden border-r border-white/[0.05] bg-white/[0.01] [.light_&]:border-zinc-200/60 [.light_&]:bg-white/30">
      <div className="pointer-events-none absolute inset-0 notes-retina-texture opacity-[0.12]" />
      <div className="relative z-10 flex h-20 items-center justify-between border-b border-white/[0.05] px-5 [.light_&]:border-zinc-200/60">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-300 [.light_&]:text-zinc-700">Tarefas</p>
          <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.16em] text-zinc-600 [.light_&]:text-zinc-400">Visualização e filtros</p>
        </div>
        <button
          onClick={onToggleCollapsed}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.035] text-zinc-400 transition-all hover:bg-white/[0.08] hover:text-white active:scale-95 [.light_&]:border-zinc-200/70 [.light_&]:bg-white [.light_&]:text-zinc-500 [.light_&]:hover:bg-zinc-100 [.light_&]:hover:text-zinc-950"
          title="Recolher filtros"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      <div className="relative z-10 flex-1 space-y-7 overflow-y-auto px-3 py-5 custom-scrollbar">
        <section className="space-y-1">
          <p className="mb-2 px-3 text-[7.5px] font-black uppercase tracking-[0.28em] text-zinc-600 [.light_&]:text-zinc-400">Visualização</p>
          {views.map((item) => renderOption(item, view === item.id, () => setView(item.id)))}
        </section>
        <section className="space-y-1">
          <p className="mb-2 px-3 text-[7.5px] font-black uppercase tracking-[0.28em] text-zinc-600 [.light_&]:text-zinc-400">Status</p>
          {filters.map((item) => renderOption(item, filter === item.id, () => setFilter(item.id)))}
        </section>
      </div>
    </div>
  );
};
