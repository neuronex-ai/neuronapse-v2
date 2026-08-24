"use client";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Hand,
  Smartphone,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MOBILE_TOUR_STEPS, type TourStep } from "./tour-content";
import { useTourSpotlight } from "./useTourSpotlight";

interface MobileAppTourProps {
  open: boolean;
  onComplete: () => void;
  onClose: () => void;
}

const TARGET_PADDING = 9;
const SWIPE_THRESHOLD = 72;

const overlayFillForTheme = (isDarkTheme: boolean, isModal: boolean) => {
  if (isDarkTheme) return isModal ? "rgba(0,0,0,0.74)" : "rgba(0,0,0,0.58)";
  return isModal ? "rgba(244,244,245,0.78)" : "rgba(244,244,245,0.62)";
};

const MobileTourCard = ({
  step,
  index,
  total,
  isLast,
  targetMissing,
  onBack,
  onNext,
  onClose,
}: {
  step: TourStep;
  index: number;
  total: number;
  isLast: boolean;
  targetMissing: boolean;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
}) => {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      key={step.id}
      drag={reducedMotion ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.18}
      onDragEnd={(_, info) => {
        if (info.offset.x <= -SWIPE_THRESHOLD) onNext();
        if (info.offset.x >= SWIPE_THRESHOLD && index > 0) onBack();
      }}
      initial={reducedMotion ? false : { opacity: 0, y: 34, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reducedMotion ? undefined : { opacity: 0, x: -36, scale: 0.98 }}
      transition={{ duration: reducedMotion ? 0 : 0.26, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-[28px] border border-border/70 bg-background/95 text-foreground shadow-[0_28px_90px_-24px_rgba(15,23,42,0.36)] backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-950/95 dark:shadow-[0_28px_90px_-24px_rgba(0,0,0,0.86)]"
      role="dialog"
      aria-modal="true"
      aria-label={`Tour mobile: ${step.title}`}
    >
      <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-foreground/14" />
      <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-foreground/18 to-transparent" />

      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-muted/70 text-muted-foreground active:scale-95"
        aria-label="Encerrar tour"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="px-5 pb-5 pt-4">
        <div className="flex items-start gap-3.5 pr-9">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-foreground text-background shadow-lg shadow-foreground/10">
            {isLast ? <Check className="h-5 w-5" strokeWidth={3} /> : <Smartphone className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              {step.eyebrow} · {index + 1}/{total}
            </p>
            <h3 className="mt-1.5 text-[1.28rem] font-black leading-[0.98] tracking-[-0.045em]">
              {step.title}
            </h3>
          </div>
        </div>

        <p className="mt-4 text-[13px] font-medium leading-relaxed text-muted-foreground">
          {step.description}
        </p>

        {step.hint ? (
          <div className="mt-3.5 flex items-center gap-2 rounded-[15px] border border-border/70 bg-muted/60 px-3 py-2.5 text-[9px] font-bold text-muted-foreground">
            <Hand className="h-4 w-4 shrink-0" />
            {step.hint}
          </div>
        ) : null}

        {targetMissing && step.layout !== "modal" ? (
          <p className="mt-3 text-[9px] font-bold text-amber-600 dark:text-amber-300">
            Esta área ainda está carregando. O tour continuará sem bloquear o uso.
          </p>
        ) : null}

        <div className="mt-4 flex items-center gap-1" aria-label="Progresso do tour">
          {MOBILE_TOUR_STEPS.map((item, itemIndex) => (
            <span
              key={item.id}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                itemIndex === index
                  ? "w-7 bg-foreground"
                  : itemIndex < index
                    ? "w-1.5 bg-foreground/35"
                    : "w-1.5 bg-foreground/12",
              )}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2.5">
          {index > 0 ? (
            <button
              type="button"
              onClick={onBack}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] border border-border bg-muted text-muted-foreground active:scale-95"
              aria-label="Voltar uma etapa"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : null}

          <Button
            type="button"
            onClick={onNext}
            className="h-12 flex-1 rounded-[16px] bg-foreground text-[9px] font-black uppercase tracking-[0.17em] text-background active:scale-[0.98] hover:bg-foreground/90"
          >
            {isLast ? "Começar a usar" : "Próximo"}
            {!isLast ? <ChevronRight className="ml-1.5 h-4 w-4" /> : <Sparkles className="ml-1.5 h-4 w-4" />}
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export const MobileAppTour = ({ open, onComplete, onClose }: MobileAppTourProps) => {
  const [active, setActive] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const { theme } = useTheme();

  const step = MOBILE_TOUR_STEPS[currentIndex];
  const isLast = currentIndex === MOBILE_TOUR_STEPS.length - 1;
  const isModal = step?.layout === "modal" || !step?.targetSelector;
  const isDarkTheme = theme === "dark";
  const overlayFill = overlayFillForTheme(isDarkTheme, isModal);
  const { rect, targetMissing, viewport } = useTourSpotlight({
    open,
    active,
    isModal,
    step,
    reducedMotion: Boolean(reducedMotion),
    missingAfter: 7,
    retryDelay: 460,
    scrollBlock: "center",
    scrollInline: "nearest",
  });

  const giveHapticFeedback = () => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
  };

  const goToStep = useCallback(
    (index: number) => {
      const bounded = Math.min(Math.max(index, 0), MOBILE_TOUR_STEPS.length - 1);
      const nextStep = MOBILE_TOUR_STEPS[bounded];
      if (nextStep.expectedRoute && location.pathname !== nextStep.expectedRoute) {
        navigate(nextStep.expectedRoute);
      }
      giveHapticFeedback();
      setCurrentIndex(bounded);
    },
    [location.pathname, navigate],
  );

  const finish = useCallback(() => {
    confetti({
      particleCount: 54,
      spread: 46,
      origin: { y: 0.76 },
      colors: ["#ffffff", "#d4d4d8", "#71717a", "#18181b"],
      disableForReducedMotion: true,
    });
    giveHapticFeedback();
    onComplete();
  }, [onComplete]);

  const next = useCallback(() => {
    if (isLast) finish();
    else goToStep(currentIndex + 1);
  }, [currentIndex, finish, goToStep, isLast]);

  const back = useCallback(() => {
    if (currentIndex > 0) goToStep(currentIndex - 1);
  }, [currentIndex, goToStep]);

  useEffect(() => {
    if (!open) {
      setActive(false);
      setCurrentIndex(0);
      return;
    }
    const timer = window.setTimeout(() => setActive(true), 70);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open || !step?.expectedRoute || location.pathname === step.expectedRoute) return;
    navigate(step.expectedRoute, { replace: false });
  }, [location.pathname, navigate, open, step]);

  useEffect(() => {
    if (!open || !active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, onClose, open]);

  const overlayPath = useMemo(() => {
    const width = viewport.width;
    const height = viewport.height;
    const full = `M 0 0 H ${width} V ${height} H 0 Z`;
    if (!rect || isModal) return full;

    const x = Math.max(0, rect.left - TARGET_PADDING);
    const y = Math.max(0, rect.top - TARGET_PADDING);
    const w = Math.min(width - x, rect.width + TARGET_PADDING * 2);
    const h = Math.min(height - y, rect.height + TARGET_PADDING * 2);
    const radius = Math.min(20, Math.max(10, Math.min(w, h) / 4));
    const hole = `M ${x + radius} ${y} H ${x + w - radius} A ${radius} ${radius} 0 0 1 ${x + w} ${y + radius} V ${y + h - radius} A ${radius} ${radius} 0 0 1 ${x + w - radius} ${y + h} H ${x + radius} A ${radius} ${radius} 0 0 1 ${x} ${y + h - radius} V ${y + radius} A ${radius} ${radius} 0 0 1 ${x + radius} ${y} Z`;
    return `${full} ${hole}`;
  }, [isModal, rect, viewport]);

  if (!open || !active || !step) return null;

  return (
    <div className="fixed inset-0 z-[10050] select-none overflow-hidden" data-tour-platform="mobile">
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        <motion.path
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1, fill: overlayFill }}
          d={overlayPath}
          fillRule="evenodd"
          transition={{ duration: reducedMotion ? 0 : 0.22 }}
        />
      </svg>

      {rect && !isModal ? (
        <motion.div
          className={cn(
            "pointer-events-none fixed z-[10051] rounded-[20px] ring-2",
            isDarkTheme
              ? "ring-white/80 shadow-[0_0_0_5px_rgba(255,255,255,0.08),0_0_34px_rgba(255,255,255,0.24)]"
              : "ring-zinc-950/70 shadow-[0_0_0_5px_rgba(0,0,0,0.055),0_0_34px_rgba(0,0,0,0.16)]",
          )}
          animate={{
            left: rect.left - TARGET_PADDING,
            top: rect.top - TARGET_PADDING,
            width: rect.width + TARGET_PADDING * 2,
            height: rect.height + TARGET_PADDING * 2,
          }}
          transition={{ duration: reducedMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
        />
      ) : null}

      <div
        className={cn(
          "fixed left-3 right-3 z-[10052] mx-auto max-w-[430px]",
          isModal
            ? "bottom-[calc(0.8rem+env(safe-area-inset-bottom))]"
            : "bottom-[calc(5.25rem+env(safe-area-inset-bottom))]",
        )}
      >
        <AnimatePresence mode="wait">
          <MobileTourCard
            step={step}
            index={currentIndex}
            total={MOBILE_TOUR_STEPS.length}
            isLast={isLast}
            targetMissing={targetMissing}
            onBack={back}
            onNext={next}
            onClose={onClose}
          />
        </AnimatePresence>
      </div>
    </div>
  );
};

export default MobileAppTour;
