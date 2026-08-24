"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSubscription } from "@/context/SubscriptionContext";

type TrialStatusIndicatorProps = {
  className?: string;
  compact?: boolean;
};

const formatRemaining = (milliseconds: number, compact?: boolean) => {
  const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return compact ? `${days}d ${hours}h` : `${days}d ${hours}h restantes`;
  if (hours > 0) return compact ? `${hours}h ${minutes}m` : `${hours}h ${minutes}m restantes`;
  return compact ? `${minutes}m` : `${minutes}m restantes`;
};

export const TrialStatusIndicator = ({ className, compact = false }: TrialStatusIndicatorProps) => {
  const { isLoading, isTrial, trialEndsAt } = useSubscription();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isTrial || !trialEndsAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [isTrial, trialEndsAt]);

  const remainingMs = useMemo(
    () => (trialEndsAt ? trialEndsAt.getTime() - now : 0),
    [now, trialEndsAt],
  );

  if (isLoading || !isTrial || !trialEndsAt || remainingMs <= 0) return null;

  return (
    <div
      className={cn(
        "pointer-events-auto inline-flex shrink-0 items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-emerald-300 shadow-[0_14px_36px_-28px_rgba(16,185,129,0.8)] backdrop-blur-2xl dark:border-emerald-300/20",
        compact ? "max-w-[9.75rem]" : "max-w-[15rem]",
        className,
      )}
      title={`Teste Professional ate ${trialEndsAt.toLocaleString("pt-BR")}`}
    >
      <Clock3 className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate text-[8px] font-black uppercase tracking-[0.14em]">
        {compact ? "Trial Pro" : "Teste Pro"}
      </span>
      <span className="truncate text-[8px] font-black uppercase tracking-[0.12em] text-emerald-200/85">
        {formatRemaining(remainingMs, compact)}
      </span>
    </div>
  );
};
