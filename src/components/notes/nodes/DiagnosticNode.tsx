import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CID10_MENTAL_HEALTH } from "@/lib/cid10-br-mental-health";
import { cn } from "@/lib/utils";
import { Activity, Brain, ClipboardList, Search } from "lucide-react";
import { useState } from 'react';
import { Handle, NodeResizer, Position } from 'reactflow';

export const DiagnosticNode = ({ id, data, selected }: any) => {
  const [open, setOpen] = useState(false);
  const [selectedDiagnosis, setSelectedDiagnosis] = useState<any>(data.diagnosis || null);

  const handleSelect = (diagnosis: any) => {
    setSelectedDiagnosis(diagnosis);
    if (typeof data.onUpdateNodeData === 'function') {
      data.onUpdateNodeData(id, {
        label: `${diagnosis.code} · ${diagnosis.label}`,
        diagnosis,
      });
    }
    setOpen(false);
  };

  return (
    <div className={cn(
      "w-[340px] bg-[#0A0A0B]/95 backdrop-blur-3xl border rounded-[32px] shadow-2xl overflow-hidden group transition-all",
      selected ? "border-primary/40 shadow-[0_0_50px_-10px_rgba(255,255,255,0.1)]" : "border-white/10"
    )}>
      <NodeResizer
        minWidth={320}
        minHeight={250}
        isVisible={selected}
        lineClassName="border-primary/30"
        handleClassName="h-3 w-3 bg-white border-2 border-zinc-950 rounded-full"
      />

      {[
        { type: 'target' as const, position: Position.Left, className: "!w-4 !h-20 !-left-2", bar: "w-1 h-10" },
        { type: 'source' as const, position: Position.Right, className: "!w-4 !h-20 !-right-2", bar: "w-1 h-10" },
        { type: 'source' as const, position: Position.Top, className: "!w-20 !h-4 !-top-2", bar: "h-1 w-10" },
        { type: 'source' as const, position: Position.Bottom, className: "!w-20 !h-4 !-bottom-2", bar: "h-1 w-10" },
      ].map((handle) => (
        <Handle
          key={`${handle.type}-${handle.position}`}
          type={handle.type}
          position={handle.position}
          className={cn(handle.className, "!bg-transparent !border-none !flex !items-center !justify-center")}
        >
          <div className={cn(handle.bar, "rounded-full bg-white/10 group-hover:bg-white transition-all duration-300")} />
        </Handle>
      ))}

      <div className="h-28 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-6 relative border-b border-white/5 drag-handle">
        <div className="absolute top-4 right-4 opacity-[0.05]">
          <Activity className="text-white w-16 h-16" />
        </div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shadow-xl backdrop-blur-md">
            <Brain className="text-indigo-400 w-6 h-6" />
          </div>
          <div>
            <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">Hipótese Diagnóstica</h3>
            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-[0.1em]">CID-10 BR</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" aria-expanded={open} className="w-full h-12 justify-between bg-white/[0.02] border-white/5 text-zinc-500 hover:text-white hover:bg-white/[0.05] rounded-2xl transition-all">
              <span className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest">
                <Search className="w-3.5 h-3.5" /> {selectedDiagnosis ? 'Trocar CID-10' : 'Vincular CID-10'}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[360px] p-0 bg-[#0A0A0B] border-white/10 backdrop-blur-3xl">
            <Command className="bg-transparent">
              <CommandInput placeholder="Pesquisar CID-10..." className="h-12 border-none bg-transparent text-xs font-medium" />
              <CommandList className="max-h-[340px]">
                <CommandEmpty className="py-6 text-center text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Nada encontrado.</CommandEmpty>
                <CommandGroup heading="CID-10 BR" className="text-zinc-600 px-2">
                  {CID10_MENTAL_HEALTH.map((item) => (
                    <CommandItem
                      key={item.code}
                      value={`${item.code} ${item.label} ${item.group}`}
                      onSelect={() => handleSelect(item)}
                      className="rounded-xl px-4 py-3 mb-1 text-[11px] font-medium aria-selected:bg-white/5 aria-selected:text-white cursor-pointer transition-all"
                    >
                      <span className="font-black mr-3 text-indigo-400 w-12">{item.code}</span>
                      <span className="flex-1">
                        <span className="block">{item.label}</span>
                        <span className="block text-[8px] uppercase tracking-[0.16em] text-zinc-700">{item.group}</span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {selectedDiagnosis && (
          <div className="relative group/card">
            <div className="absolute inset-0 bg-indigo-500/5 blur-2xl rounded-[24px] group-hover/card:bg-indigo-500/10 transition-all duration-500" />
            <div className="relative bg-white/[0.02] border border-white/5 rounded-[24px] p-5 hover:border-indigo-500/20 transition-all duration-500 group-hover/card:translate-y-[-2px]">
              <div className="flex justify-between items-start mb-3">
                <span className="px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-300 text-[9px] font-black tracking-[0.2em] border border-indigo-500/10 shadow-inner uppercase">
                  {selectedDiagnosis.code}
                </span>
                <ClipboardList className="w-5 h-5 text-zinc-800 group-hover/card:text-indigo-400 transition-colors duration-500" />
              </div>
              <p className="text-sm font-bold text-zinc-200 leading-relaxed tracking-tight">
                {selectedDiagnosis.label}
              </p>
              <p className="mt-2 text-[8px] font-black uppercase tracking-[0.18em] text-zinc-700">
                {selectedDiagnosis.group}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-black/40 border-t border-white/5 text-center">
        <span className="text-[8px] font-black text-zinc-800 uppercase tracking-[0.5em]">CID-10 BR</span>
      </div>
    </div>
  );
};
