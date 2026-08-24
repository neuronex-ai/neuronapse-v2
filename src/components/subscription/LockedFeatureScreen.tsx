import { type ElementType, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  BarChart3,
  Brain,
  Crown,
  DollarSign,
  Key,
  Lock,
  Sparkles,
  Users,
  Video,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FeatureKey, FEATURE_NAMES, FEATURE_UPSELL_PLANS } from "@/types/subscription";
import { UpsellModal } from "./UpsellModal";

interface LockedFeatureScreenProps {
  feature: FeatureKey;
  title?: string;
  description?: string;
  className?: string;
}

const FEATURE_ICONS: Record<FeatureKey, ElementType<{ className?: string }>> = {
  ai_copilot: Brain,
  telemedicine: Video,
  advanced_finance: DollarSign,
  patient_portal: Users,
  unlimited_patients: Users,
  admin_dashboard: BarChart3,
  api_access: Key,
};

export const LockedFeatureScreen = ({
  feature,
  title,
  description,
  className,
}: LockedFeatureScreenProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const featureName = title || FEATURE_NAMES[feature];
  const requiredPlan = FEATURE_UPSELL_PLANS[feature];
  const FeatureIcon = FEATURE_ICONS[feature];
  const PlanIcon = requiredPlan === "Enterprise" ? Crown : Zap;
  const defaultDescription = `Use ${featureName.toLowerCase()} com integração ao prontuário, segurança de dados e ferramentas avançadas. Disponível a partir do plano ${requiredPlan}.`;

  const motionProps = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
      };

  return (
    <>
      <div
        className={cn(
          "relative flex min-h-[calc(100vh-80px)] items-center justify-center overflow-hidden px-5 py-14 text-foreground",
          className,
        )}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_32%,hsl(var(--foreground)/0.055),transparent_34%)] dark:bg-[radial-gradient(circle_at_50%_32%,hsl(var(--foreground)/0.075),transparent_34%)]" />

        <motion.section
          {...motionProps}
          className="relative z-10 flex w-full max-w-[34rem] flex-col items-center text-center"
          aria-labelledby="locked-feature-title"
        >
          <div className="relative mb-8 flex h-20 w-20 items-center justify-center rounded-[26px] border border-border/70 bg-card/72 shadow-[0_22px_70px_-54px_hsl(var(--foreground)/0.55)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.04]">
            <FeatureIcon className="h-8 w-8 text-foreground/78" />
            <div className="absolute -bottom-2.5 -right-2.5 flex h-8 w-8 items-center justify-center rounded-xl border border-border/70 bg-background shadow-lg dark:border-white/[0.08]">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>

          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
            Recurso premium
          </p>
          <h2 id="locked-feature-title" className="mt-3 text-4xl font-black leading-tight tracking-tight md:text-5xl">
            {featureName}
          </h2>
          <p className="mt-4 max-w-[30rem] text-base font-semibold leading-relaxed text-muted-foreground">
            {description || defaultDescription}
          </p>

          <div className="mt-8 inline-flex max-w-full items-center gap-2.5 rounded-full border border-border/70 bg-card/70 px-5 py-2.5 text-muted-foreground shadow-sm backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.04]">
            <PlanIcon className="h-4 w-4 text-foreground/75" />
            <span className="truncate text-[11px] font-black uppercase tracking-[0.15em]">
              Disponível no plano {requiredPlan}
            </span>
          </div>

          <Button
            onClick={() => setIsModalOpen(true)}
            className="mt-10 h-14 rounded-2xl bg-foreground px-9 text-[11px] font-black uppercase tracking-[0.18em] text-background shadow-[0_20px_55px_-36px_hsl(var(--foreground)/0.8)] transition-transform hover:bg-foreground/90 active:scale-[0.98]"
          >
            <Sparkles className="mr-3 h-4 w-4" />
            Desbloquear agora
          </Button>
        </motion.section>
      </div>

      <UpsellModal
        feature={feature}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </>
  );
};
