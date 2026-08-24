import { cn } from "@/lib/utils";

interface LightBeamProps {
    className?: string;
    delay?: string;
    color?: string;
}

export const LightBeam = ({ className, delay = "0s", color }: LightBeamProps) => {
    return (
        <div
            className={cn(
                "absolute top-0 left-1/2 -translate-x-1/2 w-[1px] h-full bg-gradient-to-b from-primary/0 via-primary/20 to-primary/0 animate-premium-beam pointer-events-none z-0 will-change-transform",
                className
            )}
            style={{
                animationDelay: delay,
                background: color ? `linear-gradient(to bottom, transparent, ${color}, transparent)` : undefined
            }}
        />
    );
};
