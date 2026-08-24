import { supabase } from "@/integrations/supabase/client";
import { toUserFacingError } from "@/lib/user-facing-error";

type EdgeContext = Parameters<typeof toUserFacingError>[1];

async function extractEdgeMessage(error: any) {
  const raw = error?.context;
  if (!raw || typeof raw.json !== "function") return error?.message;

  try {
    const body = await raw.json();
    return body?.message || body?.error || error?.message;
  } catch {
    return error?.message;
  }
}

export async function invokeNeurofinanceFunction<T>(
  functionName: string,
  body: Record<string, unknown>,
  context: EdgeContext = "generic",
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(functionName, { body });

  if (error) {
    const message = await extractEdgeMessage(error);
    throw new Error(toUserFacingError(message || error, context).message);
  }

  if (data?.error) {
    throw new Error(toUserFacingError(data.message || data.error, context).message);
  }

  return data as T;
}
