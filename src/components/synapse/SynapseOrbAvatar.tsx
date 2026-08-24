import { VoiceSpiral } from "@/components/ai-chat/VoiceSpiral";
import { cn } from "@/lib/utils";

export function SynapseOrbAvatar({
  className,
  active = true,
}: {
  className?: string;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-white shadow-[0_12px_35px_-24px_rgba(0,0,0,0.75)] dark:border-white/10 dark:bg-[#050507]",
        className,
      )}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(99,102,241,0.16),transparent_62%)] dark:bg-[radial-gradient(circle_at_50%_45%,rgba(165,180,252,0.18),transparent_62%)]" />
      <VoiceSpiral
        totalDots={180}
        dotRadius={2.8}
        duration={active ? 2.4 : 3.6}
        minOpacity={0.18}
        maxOpacity={active ? 0.9 : 0.58}
        minScale={0.35}
        maxScale={active ? 1.7 : 1.1}
        isProcessing={active}
        useMultipleColors
        colors={["#d4d4d8", "#a5b4fc", "#6366f1"]}
        className="relative z-10 h-full w-full scale-[1.22] opacity-95"
      />
    </div>
  );
}
