"use client";

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

function getSafeReturnTo() {
  const params = new URLSearchParams(window.location.search);
  const rawReturnTo = params.get("returnTo") || "/dashboard?status=success&service=google";
  if (!rawReturnTo.startsWith("/") || rawReturnTo.startsWith("//") || rawReturnTo.includes("\\\\")) {
    return "/dashboard?status=success&service=google";
  }
  return rawReturnTo.includes("status=success")
    ? rawReturnTo
    : `${rawReturnTo}${rawReturnTo.includes("?") ? "&" : "?"}status=success&service=google`;
}

export default function GoogleConnectionSuccess() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate(getSafeReturnTo(), { replace: true });
  }, [navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="flex items-center gap-3 text-sm font-bold text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Redirecionando...
      </div>
    </main>
  );
}
