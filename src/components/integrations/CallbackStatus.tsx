import { Button } from "@/components/ui/button";
import { Starfield } from "@/components/ui/starfield";
import { cn } from "@/lib/utils";
import { ArrowRight, CheckCircle2, XCircle } from "lucide-react";

interface CallbackStatusProps {
  status: 'success' | 'failure';
  message?: string;
  onClose: () => void;
}

export const CallbackStatus = ({ status, message, onClose }: CallbackStatusProps) => {

  const config = {
    success: {
      icon: CheckCircle2,
      title: "Conexão Bem-Sucedida",
      description: "Sua conta foi integrada com sucesso. As automaá§áµes estão ativas.",
      glowClass: "bg-emerald-500/20",
      iconColor: "text-emerald-400",
    },
    failure: {
      icon: XCircle,
      title: "Falha na Conexão",
      description: message || "Não foi possá­vel concluir a integraá§ão. Por favor, tente novamente.",
      glowClass: "bg-rose-500/20",
      iconColor: "text-rose-400",
    }
  }[status];

  const Icon = config.icon;

  return (
    <div className="fixed inset-0 z-[100] bg-[#050505] flex items-center justify-center animate-fade-in">
      <Starfield />

      <div className={cn("absolute inset-0 blur-[120px] rounded-full transition-colors duration-1000", config.glowClass)} />

      <div className="relative p-1 rounded-[40px] bg-gradient-to-b from-white/[0.1] to-transparent shadow-2xl animate-scale-in">
        <div className="w-[90vw] max-w-md rounded-[39px] bg-[#0A0A0B]/80 backdrop-blur-2xl p-10 text-center flex flex-col items-center border border-white/10">

          <div className={cn("w-24 h-24 rounded-full flex items-center justify-center border mb-8 shadow-lg", config.glowClass, config.iconColor.replace('text-', 'border-').replace('400', '500/20'))}>
            <Icon className={cn("h-12 w-12", config.iconColor)} />
          </div>

          <h2 className="text-3xl font-bold text-white tracking-tight mb-3">{config.title}</h2>
          <p className="text-sm text-muted-foreground/80 leading-relaxed mb-10">{config.description}</p>

          <Button
            onClick={onClose}
            className="w-full h-12 rounded-xl bg-white text-black hover:bg-white/90 font-bold text-xs uppercase tracking-widest gap-2 shadow-lg shadow-white/10"
          >
            Continuar <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
