import { ShieldCheck } from 'lucide-react';

interface StandardDocumentTemplateProps {
  type: string; 
  title: string;
  content: string; 
  patientName: string;
  patientDoc?: string;
  professionalName: string;
  professionalRegistry: string;
  date: string;
  logoUrl?: string;
}

export const StandardDocumentTemplate = ({
  type,
  title,
  content,
  patientName,
  patientDoc,
  professionalName,
  professionalRegistry,
  date,
}: StandardDocumentTemplateProps) => {
  
  return (
    <div className="w-[210mm] min-h-[297mm] bg-white text-slate-900 shadow-2xl flex flex-col print:shadow-none print:m-0 relative overflow-hidden mx-auto print:w-full print:h-full font-serif">
      
      {/* Background Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 opacity-[0.02]">
         <div className="w-[500px] h-[500px] border-[20px] border-slate-900 rounded-full flex items-center justify-center">
            <span className="text-9xl font-bold font-sans tracking-tighter">N</span>
         </div>
      </div>
      
      {/* Header Bar */}
      <div className="h-2 bg-slate-900 w-full" />

      {/* Header Info */}
      <header className="px-16 pt-12 pb-8 border-b border-slate-100 relative z-10 flex justify-between items-end">
        <div>
            <h1 className="text-xl font-bold text-slate-900 font-sans tracking-tight uppercase">{professionalName}</h1>
            <p className="text-sm text-slate-500 font-sans mt-0.5">{professionalRegistry}</p>
        </div>
        <div className="text-right">
            <span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wider font-sans rounded-md">
                {type}
            </span>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 px-16 py-16 flex flex-col relative z-10">
        
        {/* Title */}
        <h2 className="text-2xl font-bold text-center text-slate-900 mb-12 uppercase tracking-wide decoration-slate-300 underline underline-offset-8">
            {title}
        </h2>

        {/* Patient Block */}
        <div className="mb-10 text-lg text-slate-800">
            <p className="leading-relaxed">
                <span className="font-bold">Paciente:</span> {patientName}
            </p>
            {patientDoc && <p className="text-base text-slate-500 mt-1 font-sans">CPF: {patientDoc}</p>}
        </div>

        {/* Dynamic Content */}
        <div 
            className="prose prose-slate max-w-none text-justify text-lg leading-[2.2] text-slate-800 font-normal"
            dangerouslySetInnerHTML={{ __html: content }}
        />

        {/* Date */}
        <div className="mt-20 text-right">
            <p className="text-lg text-slate-600 italic">
                {date}.
            </p>
        </div>

        {/* Signature */}
        <div className="mt-auto pt-16 flex flex-col items-center justify-center">
            <div className="w-64 border-t border-slate-900 pt-4 text-center">
                 <p className="font-bold text-slate-900 text-base font-sans uppercase">{professionalName}</p>
                 <p className="text-xs text-slate-500 font-bold mt-1 font-sans">{professionalRegistry}</p>
            </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="px-16 py-6 border-t border-slate-100 flex justify-between items-center text-[9px] text-slate-400 uppercase tracking-widest font-sans font-bold relative z-10">
        <div className="flex items-center gap-2">
            <ShieldCheck size={12} />
            <span>Documento emitido eletronicamente</span>
        </div>
        <span>NeuroNex Clinics</span>
      </footer>
    </div>
  );
};