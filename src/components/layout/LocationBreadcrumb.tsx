import { useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Video,
  DollarSign,
  Settings,
  ChevronRight,
  FileText,
  User,
  NotebookPen,
  Home
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Fragment, useEffect, useState } from "react";

// Configuração de Mapeamento de Rotas
const routeConfig: Record<string, { label: string; icon: any; color: string }> = {
  dashboard: { label: "Visão Geral", icon: LayoutDashboard, color: "text-sky-400" },
  agenda: { label: "Agenda", icon: Calendar, color: "text-violet-400" },
  pacientes: { label: "Pacientes", icon: Users, color: "text-emerald-400" },
  teleconsulta: { label: "Teleconsulta", icon: Video, color: "text-rose-400" },
  financeiro: { label: "Financeiro", icon: DollarSign, color: "text-amber-400" },
  integrations: { label: "Ajustes", icon: Settings, color: "text-zinc-400" },
  detalhes: { label: "Prontuário", icon: FileText, color: "text-emerald-300" },
  portal: { label: "Portal", icon: User, color: "text-blue-400" },
  notas: { label: "Notas", icon: NotebookPen, color: "text-pink-400" },
};

export const LocationBreadcrumb = () => {
  const location = useLocation();
  const pathnames = location.pathname.split("/").filter((x) => x);
  const [isHidden, setIsHidden] = useState(false);

  // Detecta se algum Modal/Dialog/Sheet está aberto para esconder o breadcrumb
  useEffect(() => {
    const checkModalState = () => {
      // O Radix UI adiciona 'pointer-events: none' ao body ou attributes específicos quando um modal abre
      const isModalOpen = document.body.style.pointerEvents === 'none' ||
        document.querySelector('[role="dialog"]') !== null ||
        document.querySelector('[data-state="open"]') !== null;
      setIsHidden(isModalOpen);
    };

    // Observer para assistir mudanças no DOM (atributos do body ou adição de nós)
    const observer = new MutationObserver(checkModalState);

    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['style', 'class', 'data-state']
    });

    return () => observer.disconnect();
  }, []);

  // Não mostrar na home/login
  if (location.pathname === "/" || location.pathname === "/auth") return null;

  return (
    <div
      className={cn(
        "fixed top-6 left-6 z-[40] hidden xl:flex items-center transition-all duration-500 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)]",
        isHidden ? "-translate-y-[200%] opacity-0 filter blur-md" : "translate-y-0 opacity-100 blur-0"
      )}
    >
      <nav className="glass-capsule px-1.5 py-1.5 pl-3 rounded-full flex items-center gap-1 bg-background/60 dark:bg-[#0A0A0B]/60 backdrop-blur-xl border border-border/10 shadow-2xl">

        {/* Root */}
        <Link
          to="/dashboard"
          className="flex items-center justify-center w-7 h-7 rounded-full bg-secondary/20 hover:bg-secondary/40 text-muted-foreground hover:text-foreground transition-all group"
        >
          <Home className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
        </Link>

        {/* Dynamic Segments */}
        {pathnames.map((value, index) => {
          const isLast = index === pathnames.length - 1;
          const to = `/${pathnames.slice(0, index + 1).join("/")}`;
          const isUUID = /^[0-9a-fA-F-]{36}$/.test(value);

          let config = routeConfig[value.toLowerCase()];

          if (isUUID && pathnames[index - 1] === 'pacientes') {
            config = routeConfig['detalhes'];
          } else if (!config) {
            config = { label: value, icon: ChevronRight, color: "text-muted-foreground" };
          }

          const Icon = config.icon;

          return (
            <Fragment key={to}>
              <ChevronRight className="h-3 w-3 text-muted-foreground/30" />

              {isLast ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/30 border border-border/5 shadow-inner">
                  <Icon className={cn("h-3.5 w-3.5", config.color)} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/90">
                    {config.label}
                  </span>
                </div>
              ) : (
                <Link
                  to={to}
                  className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-secondary/20 text-muted-foreground hover:text-foreground transition-all group"
                >
                  <Icon className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-70 group-hover:opacity-100">
                    {config.label}
                  </span>
                </Link>
              )}
            </Fragment>
          );
        })}
      </nav>
    </div>
  );
};
