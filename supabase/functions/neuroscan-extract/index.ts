import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const SYSTEM_PROMPT = `Você é um assistente especializado em psicologia clínica e triagem de documentos médicos.
Sua tarefa é analisar o documento fornecido e extrair TODOS os campos de informação em formato estruturado para uma anamnese psicológica.

REGRAS IMPORTANTES:
1. Identifique seções principais e campos individuais.
2. Retorne SOMENTE um JSON válido, sem nenhum texto adicional.
3. O JSON deve ser um array de objetos com a seguinte estrutura:
   { "question": "Nome do campo", "answer": "Valor extraído", "isSection": false }
4. Para títulos de seção, use "isSection": true e deixe "answer" vazio.
5. Se um campo não tiver valor no documento, preencha "answer" com string vazia "".
6. Extraia TODOS os dados disponíveis, incluindo:
   - Dados de identificação (nome, idade, data de nascimento, etc)
   - Motivo da consulta / queixa principal
   - Histórico clínico e médico
   - Histórico familiar
   - Desenvolvimento (se infantil)
   - Dados socioeconômicos
   - Hábitos e rotina
   - Relacionamentos
   - Qualquer outro dado presente no documento
7. Preserve os títulos e campos originais do documento.
8. Se o documento contiver perguntas e respostas, preserve ambos.

Responda APENAS com o JSON, sem markdown, sem backticks, sem explicações.`;

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { fileBase64, mimeType, fileName } = await req.json();
        const geminiKey = Deno.env.get('GEMINI_API_KEY');

        if (!geminiKey) {
            throw new Error("Chave da API Gemini não configurada.");
        }

        if (!fileBase64) {
            throw new Error("Nenhum arquivo fornecido.");
        }

        console.log(`[NeuroScan] Processing: ${fileName} (${mimeType})`);

        let parts: any[] = [];

        // Determine if input is text-based or image/binary
        const isTextBased = mimeType === 'text/plain' ||
            mimeType === 'text/markdown' ||
            mimeType === 'application/json';

        const isImage = mimeType.startsWith('image/');
        const isPDF = mimeType === 'application/pdf';

        if (isTextBased) {
            // Decode the base64 text content
            let textContent: string;
            try {
                textContent = decodeURIComponent(escape(atob(fileBase64)));
            } catch {
                textContent = atob(fileBase64);
            }

            parts = [
                { text: SYSTEM_PROMPT },
                { text: `\n\nDocumento "${fileName}":\n\n${textContent}` }
            ];
        } else if (isImage || isPDF) {
            // Use Gemini's multimodal capability for images and PDFs
            parts = [
                { text: SYSTEM_PROMPT },
                { text: `\n\nAnalise o documento "${fileName}" anexado abaixo e extraia todos os campos de anamnese encontrados:` },
                {
                    inline_data: {
                        mime_type: mimeType,
                        data: fileBase64
                    }
                }
            ];
        } else {
            // For .docx already converted to text on the client
            let textContent: string;
            try {
                textContent = decodeURIComponent(escape(atob(fileBase64)));
            } catch {
                textContent = atob(fileBase64);
            }

            parts = [
                { text: SYSTEM_PROMPT },
                { text: `\n\nDocumento "${fileName}":\n\n${textContent}` }
            ];
        }

        const response = await fetch(`${GEMINI_API_URL}?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 8192,
                }
            }),
        });

        if (!response.ok) {
            const errBody = await response.text();
            console.error(`[NeuroScan] Gemini API Error: ${response.status}`, errBody);
            throw new Error(`Erro na API de IA (${response.status}). Tente novamente.`);
        }

        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!rawText) {
            console.error("[NeuroScan] Empty response from Gemini:", JSON.stringify(data));
            throw new Error("A IA não retornou dados. Verifique se o documento contém informações legíveis.");
        }

        console.log(`[NeuroScan] Raw response length: ${rawText.length}`);

        // Clean potential markdown fences
        let cleanJson = rawText
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/g, '')
            .trim();

        // Try to extract JSON array if wrapped in other text
        const arrayMatch = cleanJson.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
            cleanJson = arrayMatch[0];
        }

        let items: any[];
        try {
            items = JSON.parse(cleanJson);
        } catch (parseErr) {
            console.error("[NeuroScan] JSON parse error:", parseErr, "\nRaw:", cleanJson.substring(0, 500));
            throw new Error("Erro ao processar a resposta da IA. O formato do documento pode não ser compatível.");
        }

        if (!Array.isArray(items) || items.length === 0) {
            throw new Error("Nenhum dado estruturado foi extraído do documento.");
        }

        // Validate and normalize items
        const normalizedItems = items.map((item: any) => ({
            question: String(item.question || item.field || item.label || "Campo não identificado"),
            answer: String(item.answer || item.value || item.response || ""),
            isSection: Boolean(item.isSection || item.is_section || false),
        }));

        console.log(`[NeuroScan] Extracted ${normalizedItems.length} fields from ${fileName}`);

        return new Response(
            JSON.stringify({ items: normalizedItems }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        );

    } catch (error: any) {
        console.error("[NeuroScan] Error:", error.message);
        return new Response(
            JSON.stringify({ error: error.message || "Erro interno no processamento." }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    }
});
