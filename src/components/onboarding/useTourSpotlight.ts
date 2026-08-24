"use client";

import { useLayoutEffect, useState } from "react";
import type { TourStep } from "./tour-content";

type UseTourSpotlightArgs = {
  open: boolean;
  active: boolean;
  isModal: boolean;
  step?: TourStep;
  reducedMotion: boolean;
  missingAfter?: number;
  retryDelay?: number;
  scrollBlock?: ScrollLogicalPosition;
  scrollInline?: ScrollLogicalPosition;
};

const readViewport = () => ({
  width: typeof window === "undefined" ? 0 : window.innerWidth,
  height: typeof window === "undefined" ? 0 : window.innerHeight,
});

export const useTourSpotlight = ({
  open,
  active,
  isModal,
  step,
  reducedMotion,
  missingAfter = 7,
  retryDelay = 440,
  scrollBlock = "center",
  scrollInline = "center",
}: UseTourSpotlightArgs) => {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [targetMissing, setTargetMissing] = useState(false);
  const [viewport, setViewport] = useState(readViewport);

  useLayoutEffect(() => {
    if (!open || !active || isModal || !step?.targetSelector) {
      setRect(null);
      setTargetMissing(false);
      setViewport(readViewport());
      return;
    }

    let attempts = 0;
    let raf = 0;
    let measureRaf = 0;
    let resizeObserver: ResizeObserver | null = null;
    let observedElement: Element | null = null;

    const measure = (target: Element) => {
      setViewport(readViewport());
      setRect(target.getBoundingClientRect());
    };

    const sync = (shouldScroll = true) => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        const target = document.querySelector(step.targetSelector!);

        if (!target) {
          attempts += 1;
          setRect(null);
          setViewport(readViewport());
          setTargetMissing(attempts > missingAfter);
          return;
        }

        attempts = 0;
        setTargetMissing(false);

        if (shouldScroll) {
          target.scrollIntoView({
            behavior: reducedMotion ? "auto" : "smooth",
            block: scrollBlock,
            inline: scrollInline,
          });
        }

        window.cancelAnimationFrame(measureRaf);
        measureRaf = window.requestAnimationFrame(() => measure(target));

        if (observedElement !== target) {
          resizeObserver?.disconnect();
          observedElement = target;
          resizeObserver = new ResizeObserver(() => sync(false));
          resizeObserver.observe(target);
        }
      });
    };

    const initialTimer = window.setTimeout(() => sync(true), 120);
    const retryTimer = window.setInterval(() => sync(false), retryDelay);
    const mutationObserver = new MutationObserver(() => sync(false));
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    const onViewportChange = () => sync(false);
    const onScroll = () => sync(false);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("orientationchange", onViewportChange);
    window.addEventListener("scroll", onScroll, true);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(retryTimer);
      window.cancelAnimationFrame(raf);
      window.cancelAnimationFrame(measureRaf);
      mutationObserver.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("orientationchange", onViewportChange);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [active, isModal, missingAfter, open, reducedMotion, retryDelay, scrollBlock, scrollInline, step]);

  return { rect, targetMissing, viewport };
};
