"use client";

import { EdgeProps, getBezierPath } from 'reactflow';
import { useTheme } from '@/hooks/use-theme';

const NeuralEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: EdgeProps) => {
  const { theme } = useTheme();
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const strokeColor = theme === 'dark' ? '#ffffff' : '#18181b'; // zinc-900

  return (
    <>
      {/* Background Glow Path */}
      <path
        id={id}
        style={{ ...style, strokeWidth: 8, strokeOpacity: theme === 'dark' ? 0.05 : 0.03, stroke: strokeColor }}
        className="react-flow__edge-path blur-lg"
        d={edgePath}
      />
      {/* Main Path */}
      <path
        style={{ ...style, strokeWidth: 1.2, strokeOpacity: theme === 'dark' ? 0.15 : 0.2, stroke: strokeColor }}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      {/* Animated Signal Particle */}
      <circle r="1" fill={strokeColor} className={theme === 'dark' ? "shadow-[0_0_8px_rgba(255,255,255,0.8)] opacity-40" : "opacity-30"}>
        <animateMotion path={edgePath} dur="4s" repeatCount="indefinite" />
      </circle>
    </>
  );
};

export default NeuralEdge;