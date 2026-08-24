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
  Command,
  Keyboard,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DESKTOP_TOUR_STEPS, type TourPlacement, type TourStep } from "./tour-content";
import { useTourSpotlight } from "./useTourSpotlight";

interface DesktopAppTourProps {
  open: boolean;
  onComplete: () => void;
  onClose: () => void;
}

const CARD_WIDTH = 390;
const CARD_HEIGHT_ESTIMATE = 310;
const VIEWPORT_MARGIN = 18;
const TARGET_PADDING = 12;
const GAP = 18;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const overlayFillForTheme = (isDarkTheme: boolean, isModal: boolean) => {
  if (isDarkTheme) return isModal ? "rgba(0,0,0,0.78)" : "rgba(0,0,0,0.68)";
  return isModal ? "rgba(244,244,245,0.82)" : "rgba(244,244,245,0.68)";
};

const resolvePopoverPosition = (rect: DOMRect | null, placement: TourPlacement = "auto") => {
  if (!rect || typeof window === "undefined") {
    return {
      position: "fixed" as const,
      left: "50%",
      top: "50%",
      width: CARD_WIDTH,
      transform: "translate(-50%, -50%)",
    };
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const room = {
    top: rect.top,
    bottom: viewportHeight - rect.bottom,
    left: rect.left,
    right: viewportWidth - rect.right,
  };

  let resolved = placement;
  if (placement === "auto") {
    const candidates: Array<[TourPlacement, number]> = [
      ["bottom", room.bottom],
      ["top", room.top],
      ["right", room.right],
      ["left", room.left],
    ];
    resolved = candidates.sort((a, b) => b[1] - a[1])[0][0];
  }

  let left = rect.left + rect.width / 2 - CARD_WIDTH / 2;
  let top = rect.bottom + GAP;

  if (resolved === "top") top = rect.top - CARD_HEIGHT_ESTIMATE - GAP;
  if (resolved === "left") {
    left = rect.left - CARD_WIDTH - GAP;
    top = rect.top + rect.height / 2 - CARD_HEIGHT_ESTIMATE / 2;
  }
  if (resolved === "right") {
    left = rect.right + GAP;
    top = rect.top + rect.height / 2 - CARD_HEIGHT_ESTIMATE / 2;
  }

  left = clamp(left, VIEWPORT_MARGIN, viewportWidth - CARD_WIDTH - VIEWPORT_MARGIN);
  top = clamp(top, VIEWPORT_MARGIN, viewportHeight - CARD_HEIGHT_ESTIMATE - VIEWPORT_MARGIN);

  return { position: "fixed" as const, left, top, width: CARD_WIDTH };
};

const DesktopTourCard = ({
  step,
  index,
  total,
  onBack,
  onNext,
  onClose,
  isLast,
  targetMissing,
}: {
  step: TourStep;
  index: number;
  total: number;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
  isLast: boolean;
  targetMissing: boolean;
}) => {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      key={step.id}
      initial={reducedMotion ? false : { opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={reducedMotion ? undefined : { opacity: 0, scale: 0.97, y: -8 }}
      transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-[30px] border border-border/70 bg-background/95 text-foreground shadow-[0_34px_120px_-28px_rgba(15,23,42,0.34)] backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-950/95 dark:shadow-[0_34px_120px_-28px_rgba(0,0,0,0.82)]"
      role="dialog"
      aria-modal="true"
      aria-label={`Tour desktop: ${step.title}`}
    >
      <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-foreground/20 to-transparent" />

      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-muted/70 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        aria-label="Encerrar tour"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="p-7">
        <div className="flex items-start gap-4 pr-8">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[17px] bg-foreground text-background shadow-lg shadow-foreground/10">
            {isLast ? <Check className="h-5 w-5" strokeWidth={3} /> : <Command className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">
              {step.eyebrow} · {index + 1}/{total}
            </p>
            <h3 className="mt-2 text-[1.45rem] font-black leading-[0.98] tracking-[-0.045em]">
              {step.title}
            </h3>
          </div>
        </div>

        <p className="mt-5 text-sm font-medium leading-relaxed text-muted-foreground">
          {step.description}
        </p>

        {step.hint ? (
          <div className="mt-4 flex items-center gap-2 rounded-[16px] border border-border/70 bg-muted/60 px-3.5 py-3 text-[10px] font-bold text-muted-foreground">
            <Keyboard className="h-4 w-4 shrink-0" />
            {step.hint}
          </div>
        ) : null}

        {targetMissing && step.layout !== "modal" ? (
          <p className="mt-3 text-[10px] font-bold text-amber-600 dark:text-amber-300">
            Este componente ainda está carregando. Você pode continuar normalmente.
          </p>
        ) : null}

        <div className="mt-6 flex items-center gap-1.5" aria-label="Progresso do tour">
          {DESKTOP_TOUR_STEPS.map((item, itemIndex) => (
            <span
              key={item.id}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                itemIndex === index
                  ? "w-8 bg-foreground"
                  : itemIndex < index
                    ? "w-2 bg-foreground/35"
                    : "w-2 bg-foreground/12",
              )}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center gap-3">
          {index > 0 ? (
            <button
              type="button"
              onClick={onBack}
              className="flex h-13 w-13 items-center justify-center rounded-[17px] border border-border bg-muted text-muted-foreground transition hover:bg-accent hover:text-accent-foreground active:scale-95"
              aria-label="Voltar uma etapa"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : null}

          <Button
            type="button"
            onClick={onNext}
            className="h-13 flex-1 rounded-[17px] bg-foreground text-[10px] font-black uppercase tracking-[0.2em] text-background hover:bg-foreground/90"
          >
            {isLast ? "Começar a usar" : "Próximo"}
            {!isLast ? <ChevronRight className="ml-2 h-4 w-4" /> : <Sparkles className="ml-2 h-4 w-4" />}
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export const DesktopAppTour = ({ open, onComplete, onClose }: DesktopAppTourProps) => {
  const [active, setActive] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const { theme } = useTheme();

  const step = DESKTOP_TOUR_STEPS[currentIndex];
  const isLast = currentIndex === DESKTOP_TOUR_STEPS.length - 1;
  const isModal = step?.layout === "modal" || !step?.targetSelector;
  const isDarkTheme = theme === "dark";
  const overlayFill = overlayFillForTheme(isDarkTheme, isModal);
  const { rect, targetMissing, viewport } = useTourSpotlight({
    open,
    active,
    isModal,
    step,
    reducedMotion: Boolean(reducedMotion),
    missingAfter: 8,
    retryDelay: 460,
    scrollBlock: "center",
    scrollInline: "center",
  });

  const goToStep = useCallback(
    (index: number) => {
      const bounded = clamp(index, 0, DESKTOP_TOUR_STEPS.length - 1);
      const next = DESKTOP_TOUR_STEPS[bounded];
      if (next.expectedRoute && location.pathname !== next.expectedRoute) {
        navigate(next.expectedRoute);
      }
      setCurrentIndex(bounded);
    },
    [location.pathname, navigate],
  );

  const finish = useCallback(() => {
    confetti({
      particleCount: 90,
      spread: 60,
      origin: { y: 0.68 },
      colors: ["#ffffff", "#d4d4d8", "#71717a", "#18181b"],
      disableForReducedMotion: true,
    });
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
    const timer = window.setTimeout(() => setActive(true), 80);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open || !step?.expectedRoute || location.pathname === step.expectedRoute) return;
    navigate(step.expectedRoute, { replace: false });
  }, [location.pathname, navigate, open, step]);

  useEffect(() => {
    if (!open || !active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "Enter") {
        event.preventDefault();
        next();
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        back();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, back, next, onClose, open]);

  const overlayPath = useMemo(() => {
    const width = viewport.width;
    const height = viewport.height;
    const full = `M 0 0 H ${width} V ${height} H 0 Z`;
    if (!rect || isModal) return full;

    const x = Math.max(0, rect.left - TARGET_PADDING);
    const y = Math.max(0, rect.top - TARGET_PADDING);
    const w = Math.min(width - x, rect.width + TARGET_PADDING * 2);
    const h = Math.min(height - y, rect.height + TARGET_PADDING * 2);
    const radius = 18;
    const hole = `M ${x + radius} ${y} H ${x + w - radius} A ${radius} ${radius} 0 0 1 ${x + w} ${y + radius} V ${y + h - radius} A ${radius} ${radius} 0 0 1 ${x + w - radius} ${y + h} H ${x + radius} A ${radius} ${radius} 0 0 1 ${x} ${y + h - radius} V ${y + radius} A ${radius} ${radius} 0 0 1 ${x + radius} ${y} Z`;
    return `${full} ${hole}`;
  }, [isModal, rect, viewport]);

  if (!open || !active || !step) return null;

  const cardStyle = isModal
    ? {
        position: "fixed" as const,
        left: "50%",
        top: "50%",
        width: CARD_WIDTH,
        transform: "translate(-50%, -50%)",
      }
    : resolvePopoverPosition(rect, step.placement);

  return (
    <div className="fixed inset-0 z-[10050] select-none overflow-hidden" data-tour-platform="desktop">
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        <motion.path
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1, fill: overlayFill }}
          d={overlayPath}
          fillRule="evenodd"
          transition={{ duration: reducedMotion ? 0 : 0.25 }}
        />
      </svg>

      {rect && !isModal ? (
        <motion.div
          className={cn(
            "pointer-events-none fixed z-[10051] rounded-[20px] ring-2",
            isDarkTheme
              ? "ring-white/70 shadow-[0_0_0_6px_rgba(255,255,255,0.08),0_0_42px_rgba(255,255,255,0.2)]"
              : "ring-zinc-950/70 shadow-[0_0_0_6px_rgba(0,0,0,0.055),0_0_42px_rgba(0,0,0,0.16)]",
          )}
          animate={{
            left: rect.left - TARGET_PADDING,
            top: rect.top - TARGET_PADDING,
            width: rect.width + TARGET_PADDING * 2,
            height: rect.height + TARGET_PADDING * 2,
          }}
          transition={{ duration: reducedMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
        />
      ) : null}

      <div className="fixed z-[10052] max-w-[calc(100vw-36px)]" style={cardStyle}>
        <AnimatePresence mode="wait">
          <DesktopTourCard
            step={step}
            index={currentIndex}
            total={DESKTOP_TOUR_STEPS.length}
            onBack={back}
            onNext={next}
            onClose={onClose}
            isLast={isLast}
            targetMissing={targetMissing}
          />
        </AnimatePresence>
      </div>
    </div>
  );
};

export default DesktopAppTour;
