import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useSubscription } from "@/context/SubscriptionContext";

type SubscriptionRouteGuardProps = {
  children: ReactNode;
};

const MINIMAL_ALLOWED_PREFIXES = [
  "/ajustes",
  "/payment/callback",
  "/help",
  "/initial-settings",
  "/pwa-intent",
];

export const SubscriptionRouteGuard = ({ children }: SubscriptionRouteGuardProps) => {
  const location = useLocation();
  const { isLoading, isDevAccount, canUseCurrentAccess } = useSubscription();

  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isDevAccount || canUseCurrentAccess) {
    return <>{children}</>;
  }

  const isAllowedMinimalRoute = MINIMAL_ALLOWED_PREFIXES.some((prefix) =>
    location.pathname.startsWith(prefix),
  );

  if (isAllowedMinimalRoute) {
    return <>{children}</>;
  }

  return (
    <Navigate
      to="/ajustes?tab=subscription"
      replace
      state={{ from: location, subscriptionBlocked: true }}
    />
  );
};
