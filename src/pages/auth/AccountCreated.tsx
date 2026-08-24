"use client";

import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, Variants } from "framer-motion";
import { CheckCircle2, RefreshCw, ArrowRight, Loader2, Sparkles, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const fadeInUp: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const }
    },
};

const AccountCreated = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [isResending, setIsResending] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);

    const email = location.state?.email || "";
    const firstName = location.state?.firstName || "Profissional";

    // Redirect if accessed directly without state
    useEffect(() => {
        if (!email) {
            navigate('/create-account');
        }
    }, [email, navigate]);

    // Cooldown timer
    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCooldown]);

    const handleResendEmail = async () => {
        if (!email || resendCooldown > 0) return;

        setIsResending(true);
        try {
            const { error } = await supabase.auth.resend({
                type: 'signup',
                email: email,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth?verified=true`
                }
            });

            if (error) throw error;

            toast.success("E-mail de verificação reenviado!");
            setResendCooldown(60); // 60 second cooldown
        } catch (err) {
            toast.error("Erro ao reenviar: " + (err instanceof Error ? err.message : "Erro desconhecido"));
        } finally {
            setIsResending(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-8 relative overflow-hidden font-sans selection:bg-foreground/10">
            {/* Background Effects */}
            <div className="premium-noise opacity-[0.015] fixed inset-0 pointer-events-none z-50" />
            <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-emerald-500/[0.03] rounded-full blur-[180px] pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-20%] w-[50%] h-[50%] bg-foreground/[0.02] rounded-full blur-[180px] pointer-events-none" />

            <motion.div
                className="w-full max-w-[560px] relative z-10"
                initial="hidden"
                animate="visible"
                variants={{
                    hidden: { opacity: 0 },
                    visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
                }}
            >
                {/* Logo */}
                <motion.div variants={fadeInUp} className="text-center mb-12">
                    <Link to="/" className="inline-flex items-center gap-2 text-foreground font-bold text-2xl tracking-tight hover:opacity-80 transition-opacity">
                        <Sparkles className="w-6 h-6" />
                        NeuroNex
                    </Link>
                </motion.div>

                {/* Main Card */}
                <motion.div
                    variants={fadeInUp}
                    className="bg-card/10 backdrop-blur-[60px] border border-border/30 rounded-[48px] p-12 md:p-16 text-center relative overflow-hidden shadow-2xl"
                >
                    <div className="premium-noise opacity-[0.02]" />

                    {/* Success Icon */}
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                        className="w-24 h-24 mx-auto mb-10 rounded-[32px] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-[0_0_60px_-15px_rgba(16,185,129,0.3)]"
                    >
                        <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                    </motion.div>

                    {/* Title */}
                    <motion.h1 variants={fadeInUp} className="text-4xl md:text-5xl font-bold text-foreground tracking-[-0.04em] mb-4">
                        Conta Criada!
                    </motion.h1>

                    <motion.p variants={fadeInUp} className="text-lg text-muted-foreground/60 mb-10 max-w-[380px] mx-auto leading-relaxed">
                        Bem-vindo(a), <span className="text-foreground font-medium">{firstName}</span>! Enviamos um e-mail de confirmação para você.
                    </motion.p>

                    {/* Email Display */}
                    <motion.div
                        variants={fadeInUp}
                        className="bg-foreground/[0.02] border border-border/40 rounded-[24px] p-6 mb-10 flex items-center justify-center gap-4"
                    >
                        <div className="w-12 h-12 rounded-2xl bg-foreground/5 flex items-center justify-center">
                            <Inbox className="w-6 h-6 text-foreground/40" />
                        </div>
                        <div className="text-left">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40 mb-1">E-mail enviado para</p>
                            <p className="text-foreground font-medium">{email}</p>
                        </div>
                    </motion.div>

                    {/* Instructions */}
                    <motion.div variants={fadeInUp} className="space-y-4 mb-10">
                        <div className="flex items-start gap-4 text-left p-4 bg-foreground/[0.01] rounded-2xl border border-border/20">
                            <div className="w-8 h-8 rounded-xl bg-foreground/5 flex items-center justify-center text-foreground/60 font-bold text-sm shrink-0">1</div>
                            <div>
                                <p className="text-sm text-foreground font-medium">Verifique sua caixa de entrada</p>
                                <p className="text-xs text-muted-foreground/50">Procure por um e-mail do NeuroNex</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4 text-left p-4 bg-foreground/[0.01] rounded-2xl border border-border/20">
                            <div className="w-8 h-8 rounded-xl bg-foreground/5 flex items-center justify-center text-foreground/60 font-bold text-sm shrink-0">2</div>
                            <div>
                                <p className="text-sm text-foreground font-medium">Clique no link de confirmação</p>
                                <p className="text-xs text-muted-foreground/50">Você será redirecionado para fazer login</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4 text-left p-4 bg-foreground/[0.01] rounded-2xl border border-border/20">
                            <div className="w-8 h-8 rounded-xl bg-foreground/5 flex items-center justify-center text-foreground/60 font-bold text-sm shrink-0">3</div>
                            <div>
                                <p className="text-sm text-foreground font-medium">Complete seu perfil</p>
                                <p className="text-xs text-muted-foreground/50">Configure sua clínica e comece a usar</p>
                            </div>
                        </div>
                    </motion.div>

                    {/* Resend Button */}
                    <motion.div variants={fadeInUp}>
                        <Button
                            onClick={handleResendEmail}
                            disabled={isResending || resendCooldown > 0}
                            variant="outline"
                            className="h-14 px-8 rounded-full border-border/40 hover:bg-foreground/5 text-foreground font-bold uppercase tracking-widest text-[11px] transition-all disabled:opacity-50"
                        >
                            {isResending ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : resendCooldown > 0 ? (
                                <>Aguarde {resendCooldown}s</>
                            ) : (
                                <>
                                    <RefreshCw className="w-4 h-4 mr-3" />
                                    Reenviar E-mail
                                </>
                            )}
                        </Button>
                    </motion.div>

                    {/* Spam Notice */}
                    <motion.p variants={fadeInUp} className="text-[10px] text-muted-foreground/30 uppercase tracking-widest mt-8">
                        Verifique também a pasta de spam
                    </motion.p>
                </motion.div>

                {/* Footer Link */}
                <motion.div variants={fadeInUp} className="text-center mt-10">
                    <Link
                        to="/auth?role=pro"
                        className="inline-flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40 hover:text-foreground transition-colors"
                    >
                        Já confirmou? Fazer Login
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                </motion.div>
            </motion.div>
        </div>
    );
};

export default AccountCreated;
