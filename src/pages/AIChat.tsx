import { Suspense, lazy } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Loader2 } from "lucide-react";
import { FeatureGate, LockedFeatureScreen } from "@/components/subscription";

const DesktopAIChat = lazy(() => import("@/pages/desktop/DesktopAIChat"));
const MobileAIChat = lazy(() => import("@/mobile/pages/MobileAIChat").then(m => ({ default: m.MobileAIChat })));

const PageLoader = () => (
    <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-foreground/20" />
    </div>
);

function AIChatContent() {
    const isMobile = useIsMobile();

    return (
        <Suspense fallback={<PageLoader />}>
            {isMobile ? <MobileAIChat /> : <DesktopAIChat />}
        </Suspense>
    );
}

// Exported component with FeatureGate
export default function AIChat() {
    return (
        <FeatureGate
            feature="ai_copilot"
            fallback={
                <LockedFeatureScreen
                    feature="ai_copilot"
                    title="Synapse AI"
                    description="Seu copiloto de inteligência artificial para transcrições, resumos automáticos e assistência clínica avançada. Disponível a partir do plano Professional."
                />
            }
        >
            <AIChatContent />
        </FeatureGate>
    );
}