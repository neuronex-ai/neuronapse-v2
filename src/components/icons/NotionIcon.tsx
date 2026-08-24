"use client";


export const NotionIcon = ({ className = "h-8 w-8" }: { className?: string; strokeWidth?: number }) => {
  return (
    <div className={`${className} relative group transition-all duration-500`}>
      {/* Modo Claro: Começa cinza, acende para preto */}
      <img 
        src="/images/integrations/notion_black.png" 
        alt="Notion"
        className="
          w-full h-full object-contain dark:hidden
          transition-all duration-500 ease-out
          opacity-30 grayscale
          group-hover:opacity-100 group-hover:grayscale-0 group-hover:scale-110
        "
      />
      {/* Modo Escuro: Começa cinza, acende para branco puro */}
      <img 
        src="/images/integrations/notion_white.png" 
        alt="Notion"
        className="
          w-full h-full object-contain hidden dark:block
          transition-all duration-500 ease-out
          opacity-30 grayscale
          group-hover:opacity-100 group-hover:grayscale-0 group-hover:scale-110
        "
      />
    </div>
  );
};
