/**
 * AsaasStamp — Official Asaas Regulatory Seal
 * 
 * Required by banking regulations to identify the payment services provider.
 * Uses official Asaas SVG badge URL with a CSS wrapper that transitions
 * from monochrome/high-contrast to its original color on hover.
 */

interface AsaasStampProps {
    className?: string;
}

export function AsaasStamp({ className = '' }: AsaasStampProps) {
    return (
        <a 
            href="https://www.asaas.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className={`inline-block transition-all duration-300 ${className}`}
        >
            <img 
                src="https://baas.asaas.com/selos/Servicos_financeiros_Asaas-Reduzida-Positivo.svg?id=439aba1c-ed66-40b6-a0b4-056475eb56ff" 
                alt="Serviços financeiros Asaas"
                className="h-7 w-auto mix-blend-multiply grayscale contrast-[1000%] dark:mix-blend-screen dark:invert transition-all duration-300"
            />
        </a>
    );
}
