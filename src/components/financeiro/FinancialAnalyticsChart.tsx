"use client";

import { useState, useMemo, useEffect } from 'react';
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Area,
    AreaChart,
} from 'recharts';
import { Calendar, Users, CreditCard, ChevronDown, Check, Loader2 } from 'lucide-react';
import { formatCurrency } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useTransactions } from "@/hooks/use-transactions";
import { supabase } from "@/integrations/supabase/client";
import { subMonths, format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const MONTHS = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const METHODS = ["Todos os Métodos", "Pix", "Cartão de Crédito", "Boleto Bancário", "Dinheiro"];

const CustomTooltip = ({ active, payload, label, filters }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-[#0A0A0B] border border-white/10 p-4 rounded-2xl shadow-2xl backdrop-blur-xl z-[200]">
                <div className="mb-3 pb-2 border-b border-white/5">
                    <p className="text-[10px] font-black text-white uppercase tracking-widest">{label}</p>
                    {filters.patientName !== "Todos os Pacientes" && (
                        <p className="text-[8px] font-bold text-blue-400 uppercase tracking-tight mt-1">Paciente: {filters.patientName}</p>
                    )}
                    {filters.method !== "Todos os Métodos" && (
                        <p className="text-[8px] font-bold text-emerald-400 uppercase tracking-tight">Via: {filters.method}</p>
                    )}
                </div>
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-tight">Bruto</span>
                        </div>
                        <span className="text-[11px] font-black text-white">{formatCurrency(payload[0].value)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-tight">Líquido</span>
                        </div>
                        <span className="text-[11px] font-black text-white">{formatCurrency(payload[1].value)}</span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

export const FinancialAnalyticsChart = () => {
    const { data: transactions, isLoading: isLoadingTransactions } = useTransactions(subMonths(new Date(), 6));
    const [patients, setPatients] = useState<{ id: string, name: string }[]>([]);
    const [filters, setFilters] = useState({
        period: 'Todos os Meses',
        patientId: 'all',
        patientName: 'Todos os Pacientes',
        method: 'Todos os Métodos'
    });

    useEffect(() => {
        const fetchPatients = async () => {
            const { data } = await supabase
                .from('patients')
                .select('id, name')
                .order('name');
            if (data) setPatients(data);
        };
        fetchPatients();
    }, []);

    const chartData = useMemo(() => {
        if (!transactions) return [];

        let filtered = transactions.filter(t => t.type === 'income');

        if (filters.patientId !== 'all') {
            filtered = filtered.filter(t => t.patient_id === filters.patientId);
        }
        if (filters.method !== 'Todos os Métodos') {
            filtered = filtered.filter(t => (t as any).payment_method === filters.method || (t as any).method === filters.method);
        }

        if (filters.period === 'Todos os Meses') {
            // Agrupar por mês (últimos 6 meses)
            const last6Months = Array.from({ length: 6 }, (_, i) => subMonths(new Date(), 5 - i));
            return last6Months.map(date => {
                const monthTransactions = filtered.filter(t => isSameMonth(parseISO(t.date), date));
                const bruto = monthTransactions.reduce((acc, t) => acc + Number(t.amount), 0);
                // Líquido simplificado (bruto - 5% taxa média se não houver campo específico)
                const liquido = bruto * 0.95;
                return {
                    name: format(date, 'MMM', { locale: ptBR }).toUpperCase(),
                    bruto,
                    liquido
                };
            });
        } else {
            // Agrupar por dia do mês selecionado
            const monthIdx = MONTHS.indexOf(filters.period);
            const targetDate = new Date(new Date().getFullYear(), monthIdx, 1);
            const days = eachDayOfInterval({
                start: startOfMonth(targetDate),
                end: endOfMonth(targetDate)
            });

            return days.map(date => {
                const dayTransactions = filtered.filter(t => isSameDay(parseISO(t.date), date));
                const bruto = dayTransactions.reduce((acc, t) => acc + Number(t.amount), 0);
                const liquido = bruto * 0.95;
                return {
                    name: format(date, 'dd'),
                    bruto,
                    liquido
                };
            });
        }
    }, [transactions, filters]);

    if (isLoadingTransactions) {
        return (
            <div className="w-full h-[500px] flex items-center justify-center bg-white/40 dark:bg-white/[0.01] rounded-[40px] border border-zinc-200/50 dark:border-white/[0.03]">
                <Loader2 className="w-8 h-8 animate-spin text-zinc-300" />
            </div>
        );
    }

    return (
        <div className="w-full rounded-[40px] bg-white/40 dark:bg-white/[0.01] border border-zinc-200/50 dark:border-white/[0.03] overflow-hidden shadow-sm">
            <div className="p-8 pb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-400 dark:text-zinc-500">
                        RASTREIE SEU DINHEIRO
                    </h4>
                    <p className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter">
                        SEU FLUXO DE CAIXA EXPLICADO
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="h-10 px-4 rounded-full bg-white dark:bg-white/[0.04] border border-zinc-200 dark:border-white/5 flex items-center gap-3 hover:border-zinc-300 dark:hover:border-white/10 transition-all shadow-sm group">
                                <Calendar className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white">
                                    {filters.period}
                                </span>
                                <ChevronDown className="w-3 h-3 text-zinc-300" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56 bg-white dark:bg-[#0A0A0B] border-zinc-200 dark:border-white/10 rounded-2xl shadow-2xl p-2 z-[200]">
                            <DropdownMenuItem
                                onClick={() => setFilters(f => ({ ...f, period: 'Todos os Meses' }))}
                                className="flex items-center justify-between rounded-xl px-3 h-10 text-[10px] font-black uppercase tracking-wider cursor-pointer"
                            >
                                Todos os Meses {filters.period === 'Todos os Meses' && <Check className="w-3 h-3 text-emerald-500" />}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-zinc-100 dark:bg-white/5" />
                            {MONTHS.map(month => (
                                <DropdownMenuItem
                                    key={month}
                                    onClick={() => setFilters(f => ({ ...f, period: month }))}
                                    className="flex items-center justify-between rounded-xl px-3 h-10 text-[10px] font-black uppercase tracking-wider cursor-pointer"
                                >
                                    {month} {filters.period === month && <Check className="w-3 h-3 text-emerald-500" />}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="h-10 px-4 rounded-full bg-white dark:bg-white/[0.04] border border-zinc-200 dark:border-white/5 flex items-center gap-3 hover:border-zinc-300 dark:hover:border-white/10 transition-all shadow-sm group">
                                <Users className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white">
                                    {filters.patientName}
                                </span>
                                <ChevronDown className="w-3 h-3 text-zinc-300" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56 bg-white dark:bg-[#0A0A0B] border-zinc-200 dark:border-white/10 rounded-2xl shadow-2xl p-2 z-[200] max-h-[300px] overflow-y-auto custom-scrollbar">
                            <DropdownMenuItem
                                onClick={() => setFilters(f => ({ ...f, patientId: 'all', patientName: 'Todos os Pacientes' }))}
                                className="flex items-center justify-between rounded-xl px-3 h-10 text-[10px] font-black uppercase tracking-wider cursor-pointer"
                            >
                                Todos os Pacientes {filters.patientId === 'all' && <Check className="w-3 h-3 text-emerald-500" />}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-zinc-100 dark:bg-white/5" />
                            {patients.map(p => (
                                <DropdownMenuItem
                                    key={p.id}
                                    onClick={() => setFilters(f => ({ ...f, patientId: p.id, patientName: p.name }))}
                                    className="flex items-center justify-between rounded-xl px-3 h-10 text-[10px] font-black uppercase tracking-wider cursor-pointer"
                                >
                                    {p.name} {filters.patientId === p.id && <Check className="w-3 h-3 text-emerald-500" />}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="h-10 px-4 rounded-full bg-white dark:bg-white/[0.04] border border-zinc-200 dark:border-white/5 flex items-center gap-3 hover:border-zinc-300 dark:hover:border-white/10 transition-all shadow-sm group">
                                <CreditCard className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white">
                                    {filters.method === "Todos os Métodos" ? "Método" : filters.method}
                                </span>
                                <ChevronDown className="w-3 h-3 text-zinc-300" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56 bg-white dark:bg-[#0A0A0B] border-zinc-200 dark:border-white/10 rounded-2xl shadow-2xl p-2 z-[200]">
                            {METHODS.map(m => (
                                <DropdownMenuItem
                                    key={m}
                                    onClick={() => setFilters(f => ({ ...f, method: m }))}
                                    className="flex items-center justify-between rounded-xl px-3 h-10 text-[10px] font-black uppercase tracking-wider cursor-pointer"
                                >
                                    {m} {filters.method === m && <Check className="w-3 h-3 text-emerald-500" />}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <div className="h-[400px] w-full p-8 relative">
                <div className="absolute top-0 right-10 flex items-center gap-8 z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.6)]" />
                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Faturamento Bruto</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)]" />
                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Lucro Líquido</span>
                    </div>
                </div>

                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 30, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorBruto" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorLiquido" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-zinc-200 dark:text-white/5" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#71717a' }} dy={15} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#71717a' }} tickFormatter={(val) => `R$ ${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`} />
                        <Tooltip content={<CustomTooltip filters={filters} />} />
                        <Area type="monotone" dataKey="bruto" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorBruto)" dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0, fill: '#3b82f6' }} />
                        <Area type="monotone" dataKey="liquido" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorLiquido)" dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0, fill: '#10b981' }} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};