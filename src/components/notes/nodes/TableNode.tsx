import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MoreHorizontal, Plus, TableProperties } from "lucide-react";
import { useState } from 'react';
import { Handle, NodeResizer, Position } from 'reactflow';

export const TableNode = ({ id, data, selected }: any) => {
    const [rows, setRows] = useState<number>(data.rows || 3);
    const [cols, setCols] = useState<number>(data.cols || 2);
    const [cellData, setCellData] = useState<Record<string, string>>(data.cellData || {});

    const updateData = (patch: Record<string, unknown>) => {
        if (typeof data.onUpdateNodeData === 'function') {
            data.onUpdateNodeData(id, patch);
        }
    };

    const handleAddRow = () => {
        setRows(prev => {
            const newVal = prev + 1;
            updateData({ rows: newVal });
            return newVal;
        });
    };
    const handleAddCol = () => {
        setCols(prev => {
            const newVal = prev + 1;
            updateData({ cols: newVal });
            return newVal;
        });
    };

    const handleUpdateCell = (r: number, c: number, value: string) => {
        const key = `${r}-${c}`;
        setCellData(prev => {
            const next = { ...prev, [key]: value };
            updateData({ cellData: next });
            return next;
        });
    };

    return (
        <div className={cn(
            "min-w-[320px] min-h-[220px] bg-[#0A0A0B]/95 backdrop-blur-3xl border rounded-[32px] overflow-hidden flex flex-col shadow-2xl transition-all h-full",
            selected ? "border-primary/40 shadow-[0_0_50px_-10px_rgba(255,255,255,0.1)]" : "border-white/10"
        )}>
            <NodeResizer
                minWidth={320}
                minHeight={220}
                isVisible={selected}
                lineClassName="border-primary/30"
                handleClassName="h-3 w-3 bg-white border-2 border-zinc-950 rounded-full"
            />

            {/* Header / Controls */}
            <div className="flex items-center justify-between p-4 bg-white/[0.03] border-b border-white/5 drag-handle">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <TableProperties size={16} />
                    </div>
                    <div>
                        <span className="block text-[11px] font-black uppercase tracking-[0.2em] text-white">Tabela Inteligente</span>
                        <span className="block text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Organização de Dados</span>
                    </div>
                </div>
                <div className="flex gap-1.5">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleAddRow}
                        className="h-8 w-8 rounded-lg bg-white/5 hover:bg-primary/20 hover:text-primary transition-all"
                        title="Adicionar Linha"
                    >
                        <Plus size={14} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleAddCol}
                        className="h-8 w-8 rounded-lg bg-white/5 hover:bg-primary/20 hover:text-primary transition-all"
                        title="Adicionar Coluna"
                    >
                        <MoreHorizontal size={14} className="rotate-90" />
                    </Button>
                </div>
            </div>

            {/* Table Content */}
            <div className="flex-1 overflow-auto p-5 custom-scrollbar bg-black/20">
                <table className="w-full border-collapse">
                    <tbody>
                        {Array.from({ length: rows }).map((_, rIndex) => (
                            <tr key={rIndex} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors rounded-xl overflow-hidden">
                                {Array.from({ length: cols }).map((_, cIndex) => (
                                    <td key={cIndex} className="border-r border-white/5 last:border-0 p-0 min-w-[100px]">
                                        <input
                                            className="nodrag nowheel w-full bg-transparent p-3 text-[13px] font-medium text-zinc-300 placeholder:text-zinc-800 outline-none focus:bg-white/[0.05] transition-all"
                                            placeholder="..."
                                            value={cellData[`${rIndex}-${cIndex}`] || ""}
                                            onChange={(e) => handleUpdateCell(rIndex, cIndex, e.target.value)}
                                            onPointerDown={(event) => event.stopPropagation()}
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Enhanced Handles */}
            <Handle
                type="target"
                position={Position.Left}
                className="!w-4 !h-20 !-left-2 !bg-transparent !border-none !flex !items-center !justify-center group/h-left"
            >
                <div className="w-1 h-10 rounded-full bg-white/10 group-hover/h-left:bg-white transition-all duration-300" />
            </Handle>

            <Handle
                type="source"
                position={Position.Right}
                className="!w-4 !h-20 !-right-2 !bg-transparent !border-none !flex !items-center !justify-center group/h-right"
            >
                <div className="w-1 h-10 rounded-full bg-white/10 group-hover/h-right:bg-white transition-all duration-300" />
            </Handle>

            <Handle
                type="source"
                position={Position.Top}
                className="!w-20 !h-4 !-top-2 !bg-transparent !border-none !flex !items-center !justify-center group/h-top"
            >
                <div className="h-1 w-10 rounded-full bg-white/10 group-hover/h-top:bg-white transition-all duration-300" />
            </Handle>

            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-20 !h-4 !-bottom-2 !bg-transparent !border-none !flex !items-center !justify-center group/h-bottom"
            >
                <div className="h-1 w-10 rounded-full bg-white/10 group-hover/h-bottom:bg-white transition-all duration-300" />
            </Handle>
        </div>
    );
};
