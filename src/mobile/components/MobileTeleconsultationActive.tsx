import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { JitsiMeet } from "@/components/teleconsulta/JitsiMeet";

interface MobileTeleconsultationActiveProps {
    roomName: string;
    userName: string;
    userEmail?: string;
    subject?: string;
    onBack: () => void;
}

export const MobileTeleconsultationActive = ({
    roomName,
    userName,
    userEmail,
    subject,
    onBack
}: MobileTeleconsultationActiveProps) => {
    return (
        <div className="fixed inset-0 bg-black z-[120] flex flex-col">
            {/* Overlay Header para o botão de voltar */}
            <div className="absolute top-4 left-4 z-[130] pointer-events-auto">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onBack}
                    className="rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white w-10 h-10 active:scale-90 transition-all shadow-2xl"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>
            </div>

            {/* Jitsi Call Area */}
            <div className="flex-1 w-full h-full relative">
                <JitsiMeet
                    roomName={roomName}
                    userName={userName}
                    userEmail={userEmail}
                    subject={subject}
                    onMeetingEnd={onBack}
                />
            </div>
        </div>
    );
};