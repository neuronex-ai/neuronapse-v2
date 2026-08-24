"use client";

import { AppTour } from "./AppTour";
import { useTour } from "./TourContext";

export const GlobalTourOverlay = () => {
  const { isTourOpen, completeTour, closeTour } = useTour();

  return <AppTour open={isTourOpen} onComplete={completeTour} onClose={closeTour} />;
};

export default GlobalTourOverlay;
