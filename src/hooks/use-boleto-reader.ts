import { useCallback, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { findBoletoCandidate } from "@/lib/boleto";

async function readPdfText(file: File) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const bytes = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const parts: string[] = [];

  for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 3); pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    parts.push(content.items.map((item: any) => item.str || "").join(" "));
  }

  return parts.join(" ");
}

export function useBoletoReader() {
  const [isReading, setIsReading] = useState(false);

  const readFile = useCallback(async (file: File) => {
    setIsReading(true);
    try {
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        const candidate = findBoletoCandidate(await readPdfText(file));
        return candidate;
      }

      const url = URL.createObjectURL(file);
      try {
        const reader = new BrowserMultiFormatReader();
        const result = await reader.decodeFromImageUrl(url);
        return findBoletoCandidate(result.getText()) || result.getText();
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      return null;
    } finally {
      setIsReading(false);
    }
  }, []);

  return { readFile, isReading };
}
