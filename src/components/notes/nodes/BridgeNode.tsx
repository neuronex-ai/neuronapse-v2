import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { useEffect, useState } from 'react';
import { Handle, NodeResizer, Position } from 'reactflow';

export const BridgeNode = ({ data, selected }: any) => {
    const [flows, setFlows] = useState<any[]>([]);
    const [selectedFlowId, setSelectedFlowId] = useState<string>(data.targetFlowId || "");

    useEffect(() => {
        const fetchFlows = async () => {
            const { data: flowsData } = await supabase.from('neuro_flows').select('id, title');
            if (flowsData) setFlows(flowsData);
        };
        fetchFlows();
    }, []);

    const handleSelect = (flowId: string) => {
        setSelectedFlowId(flowId);
        data.targetFlowId = flowId;
    };

    const handleNavigate = () => {
        if (selectedFlowId) {
            const event = new CustomEvent('neuroflow:navigate', { detail: { flowId: selectedFlowId } });
            window.dispatchEvent(event);
        }
    };

    return (
        <div
            className={cn(
                "min-w-[300px] min-h-[140px] rounded-full bg-[#0A0A0B]/80 backdrop-blur-3xl border-2 border-dashed flex items-center justify-between p-2 pl-10 shadow-[0_0_50px_rgba(99,102,241,0.05)] transition-all group relative overflow-hidden",
                selected ? "border-indigo-500/60 scale-[1.02] shadow-[0_0_40px_rgba(99,102,241,0.2)]" : "border-white/10"
            )}
            onDoubleClick={handleNavigate}
        >
            <NodeResizer
                minWidth={300}
                minHeight={140}
                isVisible={selected}
                lineClassName="border-indigo-500/30"
                handleClassName="h-3 w-3 bg-white border-2 border-indigo-950 rounded-full"
            />

            {/* Enhanced Handles */}
            <Handle
                type="target"
                position={Position.Left}
                className="!w-4 !h-16 !-left-2 !bg-transparent !border-none !flex !items-center !justify-center group/h-left"
            >
                <div className="w-1.5 h-8 rounded-full bg-indigo-500/20 group-hover/h-left:bg-indigo-400 transition-all duration-300" />
            </Handle>

            <Handle
                type="source"
                position={Position.Right}
                className="!w-4 !h-16 !-right-2 !bg-transparent !border-none !flex !items-center !justify-center group/h-right"
            >
                <div className="w-1.5 h-8 rounded-full bg-indigo-500/20 group-hover/h-right:bg-indigo-400 transition-all duration-300" />
            </Handle>

            <Handle
                type="source"
                position={Position.Top}
                className="!w-16 !h-4 !-top-2 !bg-transparent !border-none !flex !items-center !justify-center group/h-top"
            >
                <div className="h-1.5 w-8 rounded-full bg-indigo-500/20 group-hover/h-top:bg-indigo-400 transition-all duration-300" />
            </Handle>

            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-16 !h-4 !-bottom-2 !bg-transparent !border-none !flex !items-center !justify-center group/h-bottom"
            >
                <div className="h-1.5 w-8 rounded-full bg-indigo-500/20 group-hover/h-bottom:bg-indigo-400 transition-all duration-300" />
            </Handle>

            {/* Animated particles */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-full">
                <div className="absolute top-1/2 left-1/4 w-1 h-1 bg-indigo-400 rounded-full blur-[1px] animate-pulse opacity-20" />
                <div className="absolute top-1/3 right-1/4 w-1.5 h-1.5 bg-purple-400 rounded-full blur-[2px] animate-bounce opacity-10" />
            </div>

            <div className="relative z-10 flex-1 pr-6">
                <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={14} className="text-indigo-400 animate-pulse" />
                    <span className="text-[10px] uppercase font-black tracking-[0.3em] text-indigo-400/80">Ponte Terapêutica</span>
                </div>

                <Select value={selectedFlowId} onValueChange={handleSelect}>
                    <SelectTrigger className="w-full h-10 bg-white/5 border-white/5 rounded-xl text-zinc-100 font-bold px-4 focus:ring-0 focus:ring-offset-0 text-xs hover:bg-white/10 transition-colors">
                        <SelectValue placeholder="Vincular a fluxo..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0A0A0B] border-white/10 backdrop-blur-3xl">
                        {flows.map(f => (
                            <SelectItem key={f.id} value={f.id} className="text-xs font-medium focus:bg-indigo-500/20 focus:text-white rounded-lg m-1 cursor-pointer">{f.title}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {selectedFlowId && (
                    <div className="mt-2 flex items-center gap-2 px-1">
                        <div className="h-1 w-1 rounded-full bg-indigo-500 animate-pulse" />
                        <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Fluxo Conectado</span>
                    </div>
                )}
            </div>

            <button
                className="h-16 w-16 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 group-hover:bg-indigo-500/20 group-hover:scale-105 transition-all duration-500 shadow-xl relative z-20 mr-2 group/btn"
                onClick={handleNavigate}
            >
                <ArrowUpRight className="text-indigo-400 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" size={24} />
            </button>
        </div>
    );
};
