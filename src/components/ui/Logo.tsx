import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
}

export const Logo = ({ className }: LogoProps) => {
  const { theme } = useTheme();
  
  // Usando os mesmos assets e lógica da AuthPage
  const logoSrc = theme === 'dark' ? "/favicon-S-FUNDO-BRANCA.ico" : "/favicon-S-FUNDO-PRETA.ico";

  return (
    <img
      src={logoSrc}
      alt="NeuroNex Logo"
      className={cn("object-contain transition-opacity duration-300", className)}
    />
  );
};
