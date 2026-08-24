import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { CustomOnboardingFlow as BaseCustomOnboardingFlow } from "./CustomOnboardingFlow";
import { useFinancialAccount } from "@/hooks/use-financial-account";

type Props = React.ComponentProps<typeof BaseCustomOnboardingFlow>;

export function OnboardingRecoveryBoundary(props: Props) {
  const { isConnected, isLoading, refetch } = useFinancialAccount();
  const completedRef = useRef(false);

  useEffect(() => {
    const refresh = () => void refetch();
    window.addEventListener("online", refresh);
    const timer = window.setInterval(refresh, 2500);
    return () => {
      window.removeEventListener("online", refresh);
      window.clearInterval(timer);
    };
  }, [refetch]);

  useEffect(() => {
    if (!isConnected || completedRef.current) return;
    completedRef.current = true;
    void props.onComplete?.();
  }, [isConnected, props]);

  if (isLoading || isConnected) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center rounded-[32px] border border-zinc-200/70 bg-white/80 dark:border-white/[0.07] dark:bg-zinc-950/80">
        <div className="flex flex-col items-center gap-4 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          <div>
            <p className="text-sm font-black text-zinc-950 dark:text-white">
              Finalizando sua conta NeuroFinance
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Seus dados permanecem salvos durante instabilidades temporárias.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <BaseCustomOnboardingFlow {...props} />;
}

export { OnboardingRecoveryBoundary as CustomOnboardingFlow };
