import { useState, useCallback, useEffect, useRef } from 'react';

export const useTextToSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setIsSupported(true);
    }
    return () => { mountedRef.current = false; };
  }, []);

  const speak = useCallback((text: string) => {
    if (!isSupported || typeof window === 'undefined') return;

    // Cancelar fala anterior para evitar fila
    window.speechSynthesis.cancel();

    try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'pt-BR';
        utterance.rate = 1.2;
        
        utterance.onstart = () => {
            if (mountedRef.current) setIsSpeaking(true);
        };
        
        utterance.onend = () => {
            if (mountedRef.current) setIsSpeaking(false);
        };
        
        utterance.onerror = () => {
            if (mountedRef.current) setIsSpeaking(false);
        };

        window.speechSynthesis.speak(utterance);
    } catch (e) {
        console.error("TTS Error:", e);
        setIsSpeaking(false);
    }
  }, [isSupported]);

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      if (mountedRef.current) setIsSpeaking(false);
    }
  }, []);

  return { speak, stop, isSpeaking, isSupported };
};