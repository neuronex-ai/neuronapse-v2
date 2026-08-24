import { useUserPreferences } from '@/hooks/use-user-preferences';
import { useEffect } from 'react';

export const UserPreferencesRuntime = () => {
  const { preferences } = useUserPreferences();
  useEffect(() => {
    if (!preferences) return;
    const root = document.documentElement;
    root.dataset.density = preferences.density;
    root.dataset.timezone = preferences.timezone;
    root.lang = 'pt-BR';
    localStorage.setItem('neuronex_timezone', preferences.timezone);
    if (!document.getElementById('neuronex-density-style')) {
      const style = document.createElement('style');
      style.id = 'neuronex-density-style';
      style.textContent = "html[data-density='compact'] main button,html[data-density='compact'] main input,html[data-density='compact'] main select{min-height:2.35rem}html[data-density='compact'] main .p-6{padding:1.15rem}html[data-density='compact'] main .p-8{padding:1.45rem}html[data-density='compact'] main .gap-6{gap:1.1rem}";
      document.head.appendChild(style);
    }
  }, [preferences]);
  return null;
};
