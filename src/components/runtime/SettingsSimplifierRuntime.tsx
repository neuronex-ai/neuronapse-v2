import { useEffect } from 'react';

const simplifySettings = () => {
  if (!window.location.pathname.startsWith('/ajustes')) return;

  document
    .querySelectorAll<HTMLOptionElement>('option[value="en-US"], option[value="es-ES"]')
    .forEach((option) => {
      option.hidden = true;
      option.disabled = true;
    });

  document.querySelectorAll<HTMLParagraphElement>('p').forEach((paragraph) => {
    if (paragraph.textContent?.trim() !== 'Semana e movimento') return;
    const row = paragraph.parentElement?.parentElement as HTMLElement | null;
    if (row) row.hidden = true;
  });
};

export const SettingsSimplifierRuntime = () => {
  useEffect(() => {
    simplifySettings();
    const observer = new MutationObserver(simplifySettings);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
};
