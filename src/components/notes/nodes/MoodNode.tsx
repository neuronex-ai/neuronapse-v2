import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePatientMoodLogs } from "@/hooks/use-patient-mood-logs";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Angry, Frown, Laugh, Meh, RefreshCw, Smile, TrendingUp } from "lucide-react";
import { useState } from 'react';
import { Handle, NodeResizer, Position } from 'reactflow';
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';

const moodConfig: Record<number, { label: string, icon: any, color: string, bg: string, border: string }> = {
    1: { label: "Péssimo", icon: Angry, color: "#f43f5e", bg: "bg-rose-500/10", border: "border-rose-500/20" },
    2: { label: "Ruim", icon: Frown, color: "#f97316", bg: "bg-orange-500/10", border: "border-orange-500/20" },
    3: { label: "Neutro", icon: Meh, color: "#eab308", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
    4: { label: "Bem", icon: Smile, color: "#10b981", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
    5: { label: "Ótimo", icon: Laugh, color: "#3b82f6", bg: "bg-blue-500/10", border: "border-blue-500/20" },
};

export const MoodNode = ({ data, selected }: any) => {
    const [currentMood, setCurrentMood] = useState<number>(data.moodScore || 3);
    const { data: logs, isLoading, refetch } = usePatientMoodLogs(data.patientId);
    const { theme } = useTheme();

    const chartData = logs?.map(log => ({
        date: format(new Date(log.created_at), "dd/MM"),
        score: log.mood_score,
    })).slice(-10) || [];

    const config = moodConfig[currentMood];
    const Icon = config.icon;

    const handleMoodChange = (score: number) => {
        setCurrentMood(score);
        data.moodScore = score;
    };

    return (
        <div className={cn(
            "w-[320px] rounded-[32px] bg-white dark:bg-[#0A0A0B]/90 backdrop-blur-3xl border shadow-2xl overflow-hidden group transition-all h-full",
            selected ? "border-primary/40 shadow-[0_0_50px_-10px_rgba(255,255,255,0.1)]" : "border-zinc-200 dark:border-white/10"
        )}>
            <NodeResizer
                minWidth={300}
                minHeight={250}
                isVisible={selected}
                lineClassName="border-primary/30"
                handleClassName="h-3 w-3 bg-white border-2 border-zinc-950 rounded-full"
            />

            {/* Enhanced Handles */}
            <Handle
                type="target"
                position={Position.Left}
                className="!w-4 !h-20 !-left-2 !bg-transparent !border-none !flex !items-center !justify-center group/h-left"
            >
                <div className="w-1 h-10 rounded-full bg-zinc-200 dark:bg-white/10 group-hover/h-left:bg-zinc-900 dark:group-hover/h-left:bg-white transition-all duration-300" />
            </Handle>

            <Handle
                type="source"
                position={Position.Right}
                className="!w-4 !h-20 !-right-2 !bg-transparent !border-none !flex !items-center !justify-center group/h-right"
            >
                <div className="w-1 h-10 rounded-full bg-zinc-200 dark:bg-white/10 group-hover/h-right:bg-zinc-900 dark:group-hover/h-right:bg-white transition-all duration-300" />
            </Handle>

            <Handle
                type="source"
                position={Position.Top}
                className="!w-20 !h-4 !-top-2 !bg-transparent !border-none !flex !items-center !justify-center group/h-top"
            >
                <div className="h-1 w-10 rounded-full bg-zinc-200 dark:bg-white/10 group-hover/h-top:bg-zinc-900 dark:group-hover/h-top:bg-white transition-all duration-300" />
            </Handle>

            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-20 !h-4 !-bottom-2 !bg-transparent !border-none !flex !items-center !justify-center group/h-bottom"
            >
                <div className="h-1 w-10 rounded-full bg-zinc-200 dark:bg-white/10 group-hover/h-bottom:bg-zinc-900 dark:group-hover/h-bottom:bg-white transition-all duration-300" />
            </Handle>

            {/* Header */}
            <div className="p-4 border-b border-zinc-100 dark:border-white/5 bg-zinc-50 dark:bg-white/[0.02] drag-handle">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-xl border transition-all duration-500 shadow-lg", config.bg, config.border)}>
                            <Icon size={18} style={{ color: config.color }} />
                        </div>
                        <div>
                            <span className="block text-[11px] font-black uppercase tracking-[0.2em] text-zinc-900 dark:text-white">Mapa de Humor</span>
                            <span className="block text-[9px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">Estado Biopsicossocial</span>
                        </div>
                    </div>
                    {data.patientId && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-all" onClick={() => refetch()}>
                            <RefreshCw size={14} className={cn(isLoading && "animate-spin")} />
                        </Button>
                    )}
                </div>
            </div>

            {/* Interactive Radial Slider */}
            <div className="p-6 flex justify-between items-center bg-zinc-50/50 dark:bg-black/20">
                {[1, 2, 3, 4, 5].map((score) => {
                    const itemConfig = moodConfig[score as keyof typeof moodConfig];
                    const ItemIcon = itemConfig.icon;
                    const isActive = currentMood === score;

                    return (
                        <button
                            key={score}
                            onClick={() => handleMoodChange(score)}
                            className={cn(
                                "flex flex-col items-center gap-2 transition-all p-2 rounded-xl relative",
                                isActive ? "scale-110" : "opacity-30 hover:opacity-60 scale-90"
                            )}
                        >
                            <div className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center border transition-all duration-500",
                                isActive ? `${itemConfig.bg} ${itemConfig.border} shadow-[0_0_20px_rgba(255,255,255,0.05)]` : "bg-transparent border-transparent"
                            )}>
                                <ItemIcon size={20} style={{ color: isActive ? itemConfig.color : '#71717a' }} />
                            </div>
                            {isActive && (
                                <motion.span
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-[8px] font-black uppercase tracking-widest text-zinc-900 dark:text-white absolute -bottom-3 w-max"
                                >
                                    {itemConfig.label}
                                </motion.span>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Mini Chart Area */}
            <div className="flex-1 min-h-[120px] w-full bg-zinc-50 dark:bg-black/40 relative border-t border-zinc-100 dark:border-white/5">
                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] text-zinc-600 uppercase font-black tracking-widest animate-pulse">
                        Sincronizando...
                    </div>
                ) : logs && logs.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={theme === 'dark' ? "#ffffff" : "#000000"} stopOpacity={0.15} />
                                    <stop offset="95%" stopColor={theme === 'dark' ? "#ffffff" : "#000000"} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Tooltip
                                contentStyle={{ background: theme === 'dark' ? '#0A0A0B' : '#ffffff', border: theme === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.05)', borderRadius: '12px', fontSize: '10px', fontWeight: '900', color: theme === 'dark' ? '#fff' : '#000' }}
                                itemStyle={{ color: theme === 'dark' ? '#fff' : '#000' }}
                                cursor={{ stroke: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', strokeWidth: 1 }}
                            />
                            <Area
                                type="monotone"
                                dataKey="score"
                                stroke={theme === 'dark' ? "#ffffff" : "#18181b"}
                                strokeWidth={2}
                                strokeOpacity={0.5}
                                fillOpacity={1}
                                fill="url(#colorScore)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-700 gap-3">
                        <TrendingUp size={24} className="opacity-10" />
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-30">Dados Insuficientes</span>
                    </div>
                )}
            </div>

            <div className="p-4 bg-zinc-50 dark:bg-black/60 border-t border-zinc-100 dark:border-white/5 flex items-center justify-between">
                <span className="text-[9px] text-zinc-400 dark:text-zinc-600 font-black uppercase tracking-widest">Status</span>
                <Badge variant="outline" className="text-[8px] font-bold border-zinc-200 dark:border-white/5 bg-zinc-100 dark:bg-white/[0.02] text-zinc-500">
                    {data.patientId ? "Conectado" : "Offline"}
                </Badge>
            </div>
        </div>
    );
};
