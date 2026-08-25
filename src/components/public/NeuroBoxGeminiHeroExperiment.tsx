"use client";

import { useRef } from "react";
import { useReducedMotion, useScroll, useTransform } from "framer-motion";

import { GoogleGeminiEffect } from "@/components/ui/google-gemini-effect";

export function NeuroBoxGeminiHeroExperiment() {
  const targetRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start start", "end start"],
  });

  const first = useTransform(
    scrollYProgress,
    [0, 0.82],
    shouldReduceMotion ? [1, 1] : [0.24, 1.12],
  );
  const second = useTransform(
    scrollYProgress,
    [0, 0.82],
    shouldReduceMotion ? [1, 1] : [0.18, 1.1],
  );
  const third = useTransform(
    scrollYProgress,
    [0, 0.82],
    shouldReduceMotion ? [1, 1] : [0.12, 1.08],
  );
  const fourth = useTransform(
    scrollYProgress,
    [0, 0.82],
    shouldReduceMotion ? [1, 1] : [0.07, 1.06],
  );
  const fifth = useTransform(
    scrollYProgress,
    [0, 0.82],
    shouldReduceMotion ? [1, 1] : [0.03, 1.04],
  );

  return (
    <div
      ref={targetRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-[4] hidden h-[100svh] overflow-hidden lg:block"
    >
      <div className="absolute inset-x-[10%] bottom-[4%] h-[38%] rounded-[50%] bg-foreground/[0.035] blur-[90px] dark:bg-white/[0.045]" />
      <GoogleGeminiEffect
        pathLengths={[first, second, third, fourth, fifth]}
        className="absolute -inset-x-[5%] bottom-[-7%] h-[79%] w-[110%] opacity-[0.74] [mask-image:linear-gradient(to_bottom,transparent_0%,#000_13%,#000_82%,transparent_100%)] dark:opacity-[0.88]"
      />
    </div>
  );
}

export default NeuroBoxGeminiHeroExperiment;
