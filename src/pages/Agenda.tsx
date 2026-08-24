"use client";

import { Suspense, lazy } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Loader2 } from "lucide-react";

const DesktopAgenda = lazy(() => import("@/pages/desktop/DesktopAgenda"));
const MobileAgenda = lazy(() => import("@/mobile/pages/MobileAgenda"));

const PageLoader = () => (
  <div className="h-screen w-full flex items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-foreground/20" />
  </div>
);

export default function Agenda() {
  const isMobile = useIsMobile();

  return (
    <Suspense fallback={<PageLoader />}>
      {isMobile ? <MobileAgenda /> : <DesktopAgenda />}
    </Suspense>
  );
}