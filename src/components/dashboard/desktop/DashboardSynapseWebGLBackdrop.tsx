"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { WebGLShader } from "@/components/ui/web-gl-shader";

export function DashboardSynapseWebGLBackdrop() {
  const [composer, setComposer] = useState<HTMLFormElement | null>(null);

  useEffect(() => {
    const target = document.querySelector<HTMLFormElement>(
      "form.dashboard-v4-composer",
    );
    setComposer(target);
  }, []);

  if (!composer) return null;

  return createPortal(
    <div className="dashboard-v4-composer-shader" aria-hidden="true">
      <WebGLShader />
    </div>,
    composer,
  );
}

export default DashboardSynapseWebGLBackdrop;
