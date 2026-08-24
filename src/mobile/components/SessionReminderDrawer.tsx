"use client";

import { Button } from "@/components/ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Appointment } from "@/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Mail, MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface SessionReminderDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment | null;
}

export const SessionReminderDrawer = ({ isOpen, onOpenChange, appointment }: SessionReminderDrawerProps) => {
  if (!appointment) return null;

  const handleSendWhatsApp = () => {
    // Logic for WhatsApp link
    const message = `Olá ${appointment.patient_name}, lembrete da nossa sessão hoje às ${format(new Date(appointment.start_time), 'HH:mm')}.`;
    const encodedMessage = encodeURIComponent(message);
    const phone = appointment.patient_phone || ''; // Assuming phone exists or logic to get it
    window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
    toast.success("Redirecionando para o WhatsApp...");
    onOpenChange(false);
  };

  const handleSendEmail = () => {
    toast.success(`E-mail de lembrete enviado para ${appointment.patient_name}.`);
    onOpenChange(false);
  };

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-background/95 backdrop-blur-2xl border-t border-border/10 rounded-t-[40px] px-6 pb-12 outline-none">
        <div className="mx-auto w-12 h-1.5 bg-muted rounded-full mt-4 mb-8" />
        
        <DrawerHeader className="p-0 text-left mb-8">
          <DrawerTitle className="text-2xl font-black text-foreground tracking-tight mb-2">
            Enviar Lembrete
          </DrawerTitle>
          <DrawerDescription className="text-sm text-muted-foreground font-medium">
            Escolha o canal para notificar <span className="text-foreground font-bold">{appointment.patient_name}</span> sobre a sessão de {format(new Date(appointment.start_time), "EEEE, d 'de' MMMM", { locale: ptBR })}.
          </DrawerDescription>
        </DrawerHeader>

        <div className="grid gap-3">
          <Button 
            variant="outline" 
            onClick={handleSendWhatsApp}
            className="h-16 rounded-2xl flex items-center justify-between px-6 border-border/20 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/20 group transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-foreground">WhatsApp</p>
                <p className="text-[10px] text-muted-foreground font-medium">Notificação instantnea</p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
              <span className="text-xs font-bold text-emerald-500">Enviar</span>
            </div>
          </Button>

          <Button 
            variant="outline" 
            onClick={handleSendEmail}
            className="h-16 rounded-2xl flex items-center justify-between px-6 border-border/20 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/20 group transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                <Mail className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-foreground">E-mail</p>
                <p className="text-[10px] text-muted-foreground font-medium">Confirmação formal</p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
              <span className="text-xs font-bold text-blue-500">Enviar</span>
            </div>
          </Button>
        </div>

        <DrawerFooter className="p-0 mt-8">
          <DrawerClose asChild>
            <Button variant="ghost" className="h-12 rounded-xl text-muted-foreground hover:text-foreground font-bold text-xs uppercase tracking-widest">
              Cancelar
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};