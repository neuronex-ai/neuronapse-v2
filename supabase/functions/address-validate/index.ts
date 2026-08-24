import { corsHeaders, jsonResponse } from "../_shared/signup.ts";

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function pickComponent(components: Array<Record<string, unknown>>, type: string) {
  const item = components.find((component) => Array.isArray(component.types) && component.types.includes(type));
  return String(item?.long_name || item?.short_name || "");
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
    const placeId = String(body.placeId || body.suggestion?.id || "").trim();
    const label = String(body.label || body.suggestion?.label || body.address || "").trim();
    const googleKey = Deno.env.get("GOOGLE_MAPS_API_KEY");

    if (placeId.startsWith("manual:")) {
      if (label.length < 8 || !/\d/.test(label)) {
        return jsonResponse({ valid: false, error: "Informe um endereço com número." }, 400);
      }

      return jsonResponse({
        valid: true,
        address: {
          label,
          source: "manual",
          validatedAt: new Date().toISOString(),
        },
      });
    }

    if (placeId.startsWith("viacep:")) {
      const cep = onlyDigits(placeId);
      const response = await fetch(`https://viacep.com.br/ws/${cep.slice(0, 8)}/json/`);
      if (!response.ok) {
        return jsonResponse({ valid: false, error: "Não conseguimos validar este CEP." }, 400);
      }
      const data = await response.json();
      if (data.erro) {
        return jsonResponse({ valid: false, error: "CEP não encontrado." }, 400);
      }

      return jsonResponse({
        valid: true,
        address: {
          label: [data.logradouro, data.bairro, data.localidade, data.uf, data.cep].filter(Boolean).join(", "),
          street: data.logradouro || "",
          neighborhood: data.bairro || "",
          city: data.localidade || "",
          state: data.uf || "",
          postalCode: data.cep || "",
          source: "viacep",
        },
      });
    }

    if (placeId && googleKey) {
      const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
      url.searchParams.set("place_id", placeId);
      url.searchParams.set("language", "pt-BR");
      url.searchParams.set("fields", "place_id,formatted_address,address_components,geometry");
      url.searchParams.set("key", googleKey);

      const response = await fetch(url);
      const data = await response.json();
      const result = data.result;

      if (!response.ok || !result?.formatted_address) {
        return jsonResponse({ valid: false, error: "Endereço não encontrado." }, 400);
      }

      const components = result.address_components || [];
      return jsonResponse({
        valid: true,
        address: {
          label: result.formatted_address,
          placeId,
          street: pickComponent(components, "route"),
          number: pickComponent(components, "street_number"),
          neighborhood:
            pickComponent(components, "sublocality_level_1") ||
            pickComponent(components, "political"),
          city:
            pickComponent(components, "administrative_area_level_2") ||
            pickComponent(components, "locality"),
          state: pickComponent(components, "administrative_area_level_1"),
          postalCode: pickComponent(components, "postal_code"),
          source: "google",
          geometry: result.geometry || null,
        },
      });
    }

    const cep = onlyDigits(label);
    if (cep.length >= 8) {
      const response = await fetch(`https://viacep.com.br/ws/${cep.slice(0, 8)}/json/`);
      if (response.ok) {
        const data = await response.json();
        if (!data.erro) {
          return jsonResponse({
            valid: true,
            address: {
              label: [data.logradouro, data.bairro, data.localidade, data.uf, data.cep].filter(Boolean).join(", "),
              street: data.logradouro || "",
              neighborhood: data.bairro || "",
              city: data.localidade || "",
              state: data.uf || "",
              postalCode: data.cep || "",
              source: "viacep",
            },
          });
        }
      }
    }

    return jsonResponse(
      {
        valid: false,
        error: "Selecione um endereço válido da lista.",
      },
      400,
    );
  } catch (error) {
    console.error("address-validate:error", error);
    return jsonResponse({ valid: false, error: "Não conseguimos validar este endereço agora." }, 500);
  }
});
