import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/SessionContextProvider";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bell,
  Calendar,
  Check,
  Command,
  LayoutDashboard,
  Menu,
  Search,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { useTour } from "@/components/onboarding/TourContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export const WelcomeTourModal = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { startTour, isTourOpen, isTourCompleted, completeTour } = useTour();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!user || isTourCompleted || isTourOpen) {
      setShowModal(false);
      return;
    }

    const timer = window.setTimeout(() => setShowModal(true), 260);
    return () => window.clearTimeout(timer);
  }, [isTourCompleted, isTourOpen, user]);

  const content = useMemo(
    () =>
      isMobile
        ? {
            eyebrow: "Tour mobile-first",
            title: "Conheça a NeuroNex no celular.",
            description:
              "Um tour curto e próprio para uso com uma mão, navegação inferior, painéis deslizantes e acesso rápido ao Synapse.",
            features: [
              { icon: Smartphone, label: "Mobile" },
              { icon: Calendar, label: "Agenda" },
              { icon: Sparkles, label: "Synapse" },
              { icon: Menu, label: "Menu" },
            ],
          }
        : {
            eyebrow: "Tour desktop",
            title: "Conheça sua central de operação.",
            description:
              "Uma apresentação pensada para tela ampla, módulos completos, busca global e produtividade por teclado.",
            features: [
              { icon: LayoutDashboard, label: "Painel" },
              { icon: Calendar, label: "Agenda" },
              { icon: Search, label: "Busca" },
              { icon: Bell, label: "Alertas" },
            ],
          },
    [isMobile],
  );

  const handleStartTour = () => {
    setShowModal(false);
    window.setTimeout(startTour, 220);
  };

  const handleSkip = () => {
    setShowModal(false);
    completeTour();
  };

  if (!user || isTourCompleted || isTourOpen || !showModal) return null;

  return (
    <Dialog open={showModal} onOpenChange={() => undefined}>
      <DialogContent
        className={cn(
          "z-[10020] w-[calc(100vw-1.5rem)] overflow-hidden border-0 bg-transparent p-0 shadow-none focus:outline-none",
          isMobile ? "max-w-[420px]" : "max-w-[470px]",
        )}
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: isMobile ? 30 : 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-[32px] border border-black/[0.065] bg-white/95 text-zinc-950 shadow-[0_40px_130px_-30px_rgba(0,0,0,0.58)] backdrop-blur-3xl dark:border-white/[0.09] dark:bg-[#09090a]/95 dark:text-white"
        >
          <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-black/20 to-transparent dark:via-white/25" />

          <div className={cn("flex flex-col items-center text-center", isMobile ? "p-6" : "p-9")}>
            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-full bg-foreground/10 blur-[38px]" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-[26px] border border-black/[0.06] bg-black/[0.035] dark:border-white/[0.08] dark:bg-white/[0.045]">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-950 text-white shadow-lg dark:bg-white dark:text-zinc-950">
                  <Check className="h-5 w-5" strokeWidth={3} />
                </div>
              </div>
            </div>

            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-zinc-400 dark:text-white/38">
              {content.eyebrow}
            </p>
            <h2 className="mt-3 text-[1.75rem] font-black leading-[0.96] tracking-[-0.055em]">
              {content.title}
            </h2>
            <p className="mt-4 max-w-sm text-[13px] font-medium leading-relaxed text-zinc-600 dark:text-white/52">
              {content.description}
            </p>

            <div className="mt-7 grid w-full grid-cols-4 gap-2">
              {content.features.map((item, index) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.16 + index * 0.06, duration: 0.3 }}
                  className="flex min-w-0 flex-col items-center gap-2 rounded-[18px] border border-black/[0.05] bg-black/[0.025] px-2 py-3 dark:border-white/[0.07] dark:bg-white/[0.035]"
                >
                  <item.icon className="h-4.5 w-4.5 text-zinc-600 dark:text-white/60" />
                  <span className="truncate text-[7px] font-black uppercase tracking-[0.12em] text-zinc-400 dark:text-white/35">
                    {item.label}
                  </span>
                </motion.div>
              ))}
            </div>

            {!isMobile ? (
              <div className="mt-4 flex items-center gap-2 rounded-full border border-black/[0.06] bg-black/[0.025] px-3 py-2 text-[9px] font-bold text-zinc-500 dark:border-white/[0.08] dark:bg-white/[0.035] dark:text-white/40">
                <Command className="h-3.5 w-3.5" />
                Setas para navegar · Esc para encerrar
              </div>
            ) : null}

            <div className="mt-7 w-full space-y-2.5">
              <Button
                type="button"
                onClick={handleStartTour}
                className="h-13 w-full rounded-[17px] bg-zinc-950 text-[9px] font-black uppercase tracking-[0.18em] text-white hover:bg-black active:scale-[0.98] dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Iniciar tour personalizado
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

              <button
                type="button"
                onClick={handleSkip}
                className="h-10 w-full text-[8px] font-black uppercase tracking-[0.22em] text-zinc-400 transition hover:text-zinc-700 dark:text-white/32 dark:hover:text-white/65"
              >
                Pular por enquanto
              </button>
            </div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};
