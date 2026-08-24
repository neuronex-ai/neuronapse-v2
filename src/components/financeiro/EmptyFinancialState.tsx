"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";

export const EmptyFinancialState = ({ onStartOnboarding }: { onStartOnboarding: () => void }) => {
    return (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="w-24 h-24 mb-8 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-[32px] flex items-center justify-center shadow-2xl"
            >
                <Sparkles className="w-10 h-10" />
            </motion.div>
            <h2 className="text-3xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter mb-4">
                Bem-vindo ao NeuroFinance
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto mb-10 text-sm font-medium">
                Para acessar as funcionalidades de transferências, PIX e extratos detalhados, precisamos que conclua o onboarding da sua conta digital. É rápido e seguro.
            </p>
            <Button
                onClick={onStartOnboarding}
                className="h-14 px-8 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold uppercase tracking-widest text-xs hover:scale-[1.02] transition-transform"
            >
                Começar Agora
                <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
        </div>
    );
};
