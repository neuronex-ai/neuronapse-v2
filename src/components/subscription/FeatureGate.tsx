import { ReactNode } from "react";
import { useSubscription } from "@/context/SubscriptionContext";
import { FeatureKey } from "@/types/subscription";
import { Loader2 } from "lucide-react";

interface FeatureGateProps {
    /** The feature key to check access for */
    feature: FeatureKey;
    /** Content to render when access is denied */
    fallback?: ReactNode;
    /** Content to render when access is granted */
    children: ReactNode;
    /** Whether to show a loading state while checking */
    showLoading?: boolean;
}

/**
 * FeatureGate component controls access to features based on user's subscription plan.
 * If the user doesn't have access, it renders the fallback (usually an upsell component).
 */
export const FeatureGate = ({
    feature,
    fallback,
    children,
    showLoading = true
}: FeatureGateProps) => {
    const { canAccess, isLoading } = useSubscription();

    if (isLoading && showLoading) {
        return (
            <div className="min-h-[400px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (canAccess(feature)) {
        return <>{children}</>;
    }

    if (fallback) {
        return <>{fallback}</>;
    }

    // Default fallback if none provided
    return null;
};
