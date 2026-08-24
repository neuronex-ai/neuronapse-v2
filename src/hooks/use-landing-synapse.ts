import { useCallback, useMemo, useState } from "react";

export interface SDRMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
}

const INITIAL_MESSAGE: SDRMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Olá. Posso te ajudar a entender como o NeuroNex organiza atendimento, agenda e rotina clínica.",
};

export function useLandingSynapse() {
  const [messages, setMessages] = useState<SDRMessage[]>([INITIAL_MESSAGE]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [shouldOpenWaitlist, setShouldOpenWaitlist] = useState(false);

  const closeChat = useCallback(() => setIsOpen(false), []);
  const toggleChat = useCallback(() => setIsOpen((open) => !open), []);
  const consumeWaitlistTrigger = useCallback(() => setShouldOpenWaitlist(false), []);

  const resetChat = useCallback(() => {
    setMessages([INITIAL_MESSAGE]);
    setShouldOpenWaitlist(false);
  }, []);

  const sendMessage = useCallback((content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    const userMessage: SDRMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };

    setMessages((current) => [...current, userMessage]);
    setIsLoading(true);

    window.setTimeout(() => {
      const lower = trimmed.toLowerCase();
      const shouldInvite =
        lower.includes("lista") ||
        lower.includes("waitlist") ||
        lower.includes("começar") ||
        lower.includes("quero");

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: shouldInvite
            ? "Perfeito. Posso abrir a lista de interesse para você deixar seus dados."
            : "O NeuroNex foi pensado para reduzir trabalho operacional e deixar agenda, pacientes e comunicação mais leves no dia a dia.",
        },
      ]);
      setShouldOpenWaitlist(shouldInvite);
      setIsLoading(false);
    }, 500);
  }, []);

  return useMemo(
    () => ({
      messages,
      isLoading,
      isOpen,
      shouldOpenWaitlist,
      closeChat,
      toggleChat,
      sendMessage,
      resetChat,
      consumeWaitlistTrigger,
    }),
    [
      closeChat,
      consumeWaitlistTrigger,
      isLoading,
      isOpen,
      messages,
      resetChat,
      sendMessage,
      shouldOpenWaitlist,
      toggleChat,
    ],
  );
}
