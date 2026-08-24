import { motion } from "framer-motion";

interface ThemeTransitionOverlayProps {
    direction: 'to-light' | 'to-dark';
}

export const ThemeTransitionOverlay = ({ direction }: ThemeTransitionOverlayProps) => {
    return (
        <>
            {/* Liquid Glass Overlay */}
            <motion.div
                key="theme-overlay"
                className="fixed inset-0 z-[99999] pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{
                    opacity: [0, 1, 1, 0],
                }}
                transition={{
                    duration: 0.6,
                    times: [0, 0.4, 0.6, 1], // Smooth crossfade over 0.6s
                    ease: "easeInOut", // Apple-like smooth easing
                }}
                style={{
                    background: direction === 'to-light'
                        ? 'radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0.95) 100%)'
                        : 'radial-gradient(circle at 50% 50%, rgba(10, 10, 12, 1) 0%, rgba(0, 0, 0, 0.98) 100%)',
                    backdropFilter: 'blur(12px) brightness(1.1)',
                    WebkitBackdropFilter: 'blur(12px) brightness(1.1)',
                }}
            >
            </motion.div>
        </>
    );
};
