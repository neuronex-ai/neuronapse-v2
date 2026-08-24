export const readSupabaseFunctionError = async (error: unknown, fallback: string) => {
  const context = (error as { context?: Response })?.context;

  if (context) {
    try {
      const payload = await context.clone().json();
      if (typeof payload?.error === "string") return payload.error;
      if (typeof payload?.message === "string") return payload.message;
    } catch {
      try {
        const text = await context.clone().text();
        if (text) return text;
      } catch {
        return fallback;
      }
    }
  }

  return error instanceof Error && error.message ? error.message : fallback;
};
