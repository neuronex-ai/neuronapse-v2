"use client";

import { useIsMobile } from "@/hooks/use-mobile";
import { DesktopAppTour } from "./DesktopAppTour";
import { MobileAppTour } from "./MobileAppTour";

interface AppTourProps {
  open: boolean;
  onComplete: () => void;
  onClose: () => void;
}

export const AppTour = ({ open, onComplete, onClose }: AppTourProps) => {
  const isMobile = useIsMobile();

  return isMobile ? (
    <MobileAppTour open={open} onComplete={onComplete} onClose={onClose} />
  ) : (
    <DesktopAppTour open={open} onComplete={onComplete} onClose={onClose} />
  );
};

export default AppTour;
