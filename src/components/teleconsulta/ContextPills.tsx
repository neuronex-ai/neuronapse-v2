import { BrainCircuit, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { usePatientContextSummary } from "@/hooks/use-patient-context-summary";

interface ContextPillsProps {
  patientId: string | null;
}

export const ContextPills = ({ patientId }: ContextPillsProps) => {
  const { data: pills, isLoading } = usePatientContextSummary(patientId);

  return (
    <div className="p-5 rounded-2xl bg-[#0F0F11]/80 border border-white/5 backdrop-blur-sm shadow-lg">
      <div className="flex items-center gap-2 mb-4">
        <BrainCircuit className="h-4 w-4 text-primary" />
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Contexto IA</h3>
      </div>
      <div className="space-y-2">
        {isLoading ? (
          <div className="flex justify-center items-center h-20">
            <Loader2 className="h-5 w-5 animate-spin text-primary/50" />
          </div>
        ) : (
          pills?.map((pill, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 + 0.2 }}
              className="p-2.5 rounded-lg bg-primary/5 border border-primary/10 text-xs text-primary/80 font-medium"
            >
              {pill}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};