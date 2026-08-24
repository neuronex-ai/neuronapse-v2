import { corsHeaders, jsonResponse } from "../_shared/signup.ts";

type AddressSuggestion = {
  id: string;
  label: string;
  source: "google" | "viacep" | "manual";
  metadata?: Record<string, unknown>;
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function manualSuggestion(query: string): AddressSuggestion[] {
  const trimmed = query.trim();
  if (trimmed.length < 8 || !/\d/.test(trimmed)) return [];
  return [
    {
      id: `manual:${trimmed}`,
      label: trimmed,
      source: "manual",
    },
  ];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const query = String(body.query || "").trim();

    if (query.length < 3) {
      return jsonResponse({ suggestions: [] });
    }

    const googleKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (googleKey) {
      const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
      url.searchParams.set("input", query);
      url.searchParams.set("components", "country:br");
      url.searchParams.set("language", "pt-BR");
      url.searchParams.set("types", "address");
      url.searchParams.set("key", googleKey);

      const response = await fetch(url);
      const data = await response.json();
      const suggestions = (data.predictions || []).slice(0, 6).map((item: Record<string, unknown>) => ({
        id: String(item.place_id || ""),
        label: String(item.description || ""),
        source: "google",
      })) satisfies AddressSuggestion[];

      return jsonResponse({ suggestions });
    }

    const cep = onlyDigits(query);
    if (cep.length >= 8) {
      const response = await fetch(`https://viacep.com.br/ws/${cep.slice(0, 8)}/json/`);
      if (response.ok) {
        const data = await response.json();
        if (!data.erro) {
          const label = [data.logradouro, data.bairro, data.localidade, data.uf, data.cep]
            .filter(Boolean)
            .join(", ");
          return jsonResponse({
            suggestions: [
              {
                id: `viacep:${data.cep}`,
                label,
                source: "viacep",
                metadata: data,
              },
            ],
          });
        }
      }
    }

    return jsonResponse({
      suggestions: manualSuggestion(query),
      provider: "viacep",
      message: "Digite um CEP completo ou selecione o endereço digitado.",
    });
  } catch (error) {
    console.error("address-autocomplete:error", error);
    return jsonResponse({ suggestions: [], error: "Não conseguimos buscar endereços agora." }, 500);
  }
});
