export async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "models/gemini-embedding-001",
                    content: { parts: [{ text }] },
                    outputDimensionality: 768,
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Error generating embedding:", errorText);
            throw new Error(`Failed to generate embedding: ${response.statusText}`);
        }

        const data = await response.json();
        return data.embedding.values;
    } catch (error) {
        console.error("Embedding generation failed:", error);
        // Return empty array or throw? throwing is better to ensure data quality, but maybe we fallback to null?
        // If we fail to embed, we just don't have memory for this msg. It's accceptable.
        return [];
    }
}
