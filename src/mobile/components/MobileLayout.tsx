"use client";

import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useUnreadNotificationCount } from "@/hooks/use-notifications";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import "@/styles/mobile-polish.css";
import { Bell } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileRoutePill } from "./MobileRoutePill";
import { TrialStatusIndicator } from "@/components/subscription";

interface MobileLayoutProps {
  children: ReactNode;
  className?: string;
  shellClassName?: string;
  showNav?: boolean;
  showBottomNav?: boolean;
}

export const MobileLayout = ({ children, className, shellClassName, showNav = true, showBottomNav = true }: MobileLayoutProps) => {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { theme } = useTheme();
  const { unreadCount } = useUnreadNotificationCount();

  return (
    <div className={cn("nn-mobile-shell relative flex h-[100dvh] w-full flex-col overflow-hidden bg-background text-foreground", shellClassName)}>
      <div className="mobile-surface-texture pointer-events-none fixed inset-0 z-0">
        <div className="mobile-retina-texture absolute inset-0 text-foreground" />
      </div>

      {showNav ? (
        <header className="pointer-events-none fixed left-0 right-0 top-0 z-[100] pt-[env(safe-area-inset-top)]">
          <div className="flex items-center justify-between gap-2 px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <Link to="/dashboard" className="pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-foreground/[0.07] bg-background/62 shadow-[0_14px_34px_-24px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.055]">
                <img src={theme === "dark" ? "/favicon-S-FUNDO-BRANCA.ico" : "/favicon-S-FUNDO-PRETA.ico"} alt="NeuroNex" className="h-[17px] w-[17px] object-contain opacity-85" />
              </Link>
              <MobileRoutePill />
              <TrialStatusIndicator compact className="hidden min-[390px]:inline-flex max-w-[7.75rem] px-2.5" />
            </div>

            <button type="button" onClick={() => setNotificationsOpen(true)} className="pointer-events-auto relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-foreground/[0.07] bg-background/62 shadow-[0_14px_34px_-24px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.055]" aria-label="Abrir notificações">
              <Bell className="h-[17px] w-[17px] text-foreground/68" />
              {unreadCount > 0 ? <span className="absolute -right-1 -top-1 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-background bg-red-500 px-1 text-[7px] font-black text-white">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
            </button>
          </div>
        </header>
      ) : null}

      <Sheet open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <SheetContent side="bottom" className="z-[110] flex h-[min(82dvh,46rem)] flex-col overflow-hidden rounded-t-[26px] border-x-0 border-b-0 border-t border-border/45 bg-background p-0 pb-[env(safe-area-inset-bottom)] dark:border-white/10">
          <div className="absolute left-1/2 top-2.5 z-30 h-1 w-9 -translate-x-1/2 rounded-full bg-foreground/14" />
          <AlertsPanel />
        </SheetContent>
      </Sheet>

      <main className={cn("relative z-10 min-h-0 min-w-0 flex-1 overflow-hidden", showNav ? "pt-[calc(3.35rem+env(safe-area-inset-top))]" : "pt-0", "pb-0", className)}>
        {children}
      </main>

      {showBottomNav ? <MobileBottomNav /> : null}
    </div>
  );
};
