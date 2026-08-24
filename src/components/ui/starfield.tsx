import { useMemo } from "react";

export const Starfield = () => {
  const stars = useMemo(() => Array.from({ length: 35 }).map((_, i) => ({
    id: i,
    top: `${Math.random() * 100}%`,
    left: `${Math.random() * 100}%`,
    size: Math.random() * 2 + 1,
    style: {
        '--tx': `${(Math.random() - 0.5) * 150}px`, 
        '--ty': `${(Math.random() - 0.5) * 150}px`,
        animationDuration: `${Math.random() * 15 + 25}s`, 
        animationDelay: `${Math.random() * -25}s`,
    } as React.CSSProperties
  })), []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden perspective-[1000px]">
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute rounded-full bg-white opacity-0 animate-[drift_linear_infinite]"
          style={{
            top: star.top,
            left: star.left,
            width: `${star.size}px`,
            height: `${star.size}px`,
            ...star.style
          }}
        />
      ))}
    </div>
  );
};