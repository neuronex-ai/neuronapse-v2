"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

import { cn } from "@/lib/utils";

type WebGLShaderProps = {
  className?: string;
};

export function WebGLShader({ className }: WebGLShaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const vertexShader = `
      precision highp float;
      attribute vec3 position;

      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      precision highp float;

      uniform vec2 resolution;
      uniform float time;
      uniform vec3 ink;

      float softLine(float distanceToCurve, float width, float strength) {
        return strength / max(distanceToCurve + width, width);
      }

      void main() {
        vec2 p = (gl_FragCoord.xy * 2.0 - resolution) / min(resolution.x, resolution.y);

        float phase = (p.x + time) * 1.12;
        float curve = sin(phase) * 0.44 + sin(phase * 0.53 - 0.82) * 0.065;
        float distanceToCurve = abs(p.y + curve);

        float core = softLine(distanceToCurve, 0.014, 0.0105);
        float glow = softLine(distanceToCurve, 0.075, 0.018);
        float halo = exp(-distanceToCurve * distanceToCurve * 7.4) * 0.24;

        float horizontalFade = 1.0 - smoothstep(2.15, 4.25, abs(p.x));
        float intensity = min(1.0, (core + glow + halo) * horizontalFade);
        float alpha = clamp(intensity * 0.82, 0.0, 0.82);

        gl_FragColor = vec4(ink * intensity, alpha);
      }
    `;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

    const uniforms = {
      resolution: { value: new THREE.Vector2(1, 1) },
      time: { value: 0 },
      ink: { value: new THREE.Color(0.08, 0.085, 0.095) },
    };

    const positions = new THREE.BufferAttribute(
      new Float32Array([
        -1, -1, 0,
         1, -1, 0,
        -1,  1, 0,
         1, -1, 0,
        -1,  1, 0,
         1,  1, 0,
      ]),
      3,
    );

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", positions);

    const material = new THREE.RawShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    let animationId: number | null = null;
    let isIntersecting = true;
    let reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const startedAt = performance.now();

    const syncTheme = () => {
      const isDark = document.documentElement.classList.contains("dark");
      uniforms.ink.value.setRGB(
        isDark ? 0.97 : 0.075,
        isDark ? 0.975 : 0.08,
        isDark ? 0.99 : 0.095,
      );
    };

    const resize = () => {
      const parent = canvas.parentElement;
      const width = Math.max(1, parent?.clientWidth || canvas.clientWidth || 1);
      const height = Math.max(1, parent?.clientHeight || canvas.clientHeight || 1);
      renderer.setSize(width, height, false);
      renderer.getDrawingBufferSize(uniforms.resolution.value);
      renderer.render(scene, camera);
    };

    const stopLoop = () => {
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
    };

    const renderFrame = (timestamp: number) => {
      animationId = null;
      if (!isIntersecting || document.hidden) return;

      if (!reduceMotion) {
        uniforms.time.value = ((timestamp - startedAt) / 1000) * 0.34;
      }

      renderer.render(scene, camera);
      if (!reduceMotion) animationId = requestAnimationFrame(renderFrame);
    };

    const startLoop = () => {
      stopLoop();
      if (reduceMotion) {
        uniforms.time.value = 0.42;
        renderer.render(scene, camera);
        return;
      }
      if (isIntersecting && !document.hidden) {
        animationId = requestAnimationFrame(renderFrame);
      }
    };

    syncTheme();
    resize();
    startLoop();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas.parentElement || canvas);

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      isIntersecting = entry?.isIntersecting ?? true;
      if (isIntersecting) startLoop();
      else stopLoop();
    });
    intersectionObserver.observe(canvas);

    const themeObserver = new MutationObserver(() => {
      syncTheme();
      renderer.render(scene, camera);
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleMotionChange = (event: MediaQueryListEvent) => {
      reduceMotion = event.matches;
      startLoop();
    };
    motionQuery.addEventListener("change", handleMotionChange);

    const handleVisibility = () => {
      if (document.hidden) stopLoop();
      else startLoop();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stopLoop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      themeObserver.disconnect();
      motionQuery.removeEventListener("change", handleMotionChange);
      document.removeEventListener("visibilitychange", handleVisibility);
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn("absolute inset-0 block h-full w-full", className)}
    />
  );
}

export default WebGLShader;
