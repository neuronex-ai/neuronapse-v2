const NVIDIA_CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

export interface ProviderResult {
  data: any;
  provider: "nvidia" | "groq";
  model: string;
}

interface InvokeOptions {
  messages: any[];
  tools?: readonly any[];
  toolChoice?: "auto" | "required" | "none";
  maxTokens?: number;
  temperature?: number;
}

async function parseProviderResponse(response: Response, provider: string) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload?.error?.message || payload?.message || `Falha no provedor ${provider} (${response.status}).`;
    throw new Error(detail);
  }
  if (!payload?.choices?.[0]?.message) throw new Error(`Resposta inválida do provedor ${provider}.`);
  return payload;
}

async function callNvidia(apiKey: string, model: string, options: InvokeOptions) {
  const baseBody: Record<string, unknown> = {
    model,
    messages: options.messages,
    temperature: options.temperature ?? 0.15,
    top_p: 0.9,
    max_tokens: options.maxTokens ?? 2200,
    stream: false,
  };
  if (options.tools?.length && options.toolChoice !== "none") {
    baseBody.tools = options.tools;
    baseBody.tool_choice = options.toolChoice || "auto";
    baseBody.parallel_tool_calls = false;
  }

  const request = async (includeNemotronOptions: boolean) => fetch(NVIDIA_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...baseBody,
      ...(includeNemotronOptions
        ? { chat_template_kwargs: { enable_thinking: false } }
        : {}),
    }),
  });

  let response = await request(true);
  if (response.status === 400 || response.status === 422) {
    console.warn("[synapse-provider] NVIDIA rejected optional chat-template fields; retrying OpenAI-compatible payload.");
    response = await request(false);
  }
  return parseProviderResponse(response, "NVIDIA");
}

async function callGroq(apiKey: string, model: string, options: InvokeOptions) {
  const body: Record<string, unknown> = {
    model,
    messages: options.messages,
    temperature: options.temperature ?? 0.15,
    max_completion_tokens: options.maxTokens ?? 2200,
    stream: false,
  };
  if (options.tools?.length && options.toolChoice !== "none") {
    body.tools = options.tools;
    body.tool_choice = options.toolChoice || "auto";
    body.parallel_tool_calls = false;
  }
  const response = await fetch(GROQ_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return parseProviderResponse(response, "Groq");
}

export async function invokeSynapseModel(options: InvokeOptions): Promise<ProviderResult> {
  const nvidiaKey = Deno.env.get("NVIDIA_API_KEY")?.trim();
  const nvidiaModel = Deno.env.get("NVIDIA_SYNAPSE_MODEL")?.trim() || "nvidia/nemotron-3-ultra-550b-a55b";
  const groqKey = Deno.env.get("GROQ_API_KEY")?.trim();
  const groqModel = Deno.env.get("GROQ_AGENT_MODEL")?.trim() || "openai/gpt-oss-120b";
  const providerPreference = (Deno.env.get("SYNAPSE_TEXT_PROVIDER") || "nvidia").trim().toLowerCase();

  if (providerPreference !== "groq" && nvidiaKey) {
    try {
      return {
        data: await callNvidia(nvidiaKey, nvidiaModel, options),
        provider: "nvidia",
        model: nvidiaModel,
      };
    } catch (error) {
      console.warn("[synapse-provider] NVIDIA unavailable; trying configured fallback:", error instanceof Error ? error.message : error);
      if (!groqKey) throw error;
    }
  }

  if (groqKey) {
    return {
      data: await callGroq(groqKey, groqModel, options),
      provider: "groq",
      model: groqModel,
    };
  }

  if (!nvidiaKey) throw new Error("Configure NVIDIA_API_KEY nos secrets do Supabase para ativar o Nemotron.");
  return {
    data: await callNvidia(nvidiaKey, nvidiaModel, options),
    provider: "nvidia",
    model: nvidiaModel,
  };
}
