"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, X, Download, ExternalLink, ShieldCheck, Clock, HardDrive, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PremiumFileIcon } from "@/components/ui/PremiumFileIcons";

interface NeuroFlowPreviewModalProps {
    fileData: any | null;
    isOpen: boolean;
    onClose: () => void;
}

const isPreviewable = (filename?: string, mimetype?: string): string | null => {
    if (!filename && !mimetype) return null;
    const ext = filename?.split('.').pop()?.toLowerCase() || '';
    const mime = (mimetype || '').toLowerCase();
    if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
    if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
    return null;
};

const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return "Desconhecido";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

export const NeuroFlowPreviewModal = ({ fileData, isOpen, onClose }: NeuroFlowPreviewModalProps) => {
    const fileName = fileData?.fileName || fileData?.label || "Arquivo sem nome";
    const fileUrl = fileData?.fileUrl;
    const fileMimetype = fileData?.fileMimetype;
    const fileSize = fileData?.fileSize;
    const patientName = fileData?.patientName;
    const fileSource = fileData?.fileSource;
    const previewType = isPreviewable(fileName, fileMimetype);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-[80vw] w-[900px] h-[80vh] p-0 bg-transparent border-none shadow-none gap-0 overflow-hidden">
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="w-full h-full bg-[#0A0A0B]/95 backdrop-blur-3xl border border-white/10 rounded-[40px] shadow-[0_32px_120px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden ring-1 ring-white/5"
                        >
                            {/* Visual Background Accent */}
                            <div className="absolute top-0 right-0 w-[40%] h-[40%] bg-primary/10 blur-[100px] rounded-full pointer-events-none" />

                            {/* Header */}
                            <div className="p-8 pb-6 relative z-10 border-b border-white/5">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-5">
                                        <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-2xl">
                                            <PremiumFileIcon filename={fileName} className="w-8 h-10" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-primary/20 text-primary bg-primary/5 px-3 py-1">Documento Neural</Badge>
                                            <h2 className="text-xl font-black text-white tracking-tight">{fileName}</h2>
                                            <div className="flex items-center gap-3">
                                                {fileSource === 'patient' && patientName && (
                                                    <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-primary/70">
                                                        <User size={10} /> {patientName}
                                                    </span>
                                                )}
                                                {fileSource === 'personal' && (
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Arquivo Pessoal</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={onClose}
                                        className="h-12 w-12 rounded-full hover:bg-white/10 text-zinc-500 hover:text-white transition-all"
                                    >
                                        <X size={24} />
                                    </Button>
                                </div>
                            </div>

                            {/* Info Cards */}
                            <div className="px-8 py-4 grid grid-cols-3 gap-4 relative z-10 border-b border-white/5">
                                <InfoCard icon={ShieldCheck} label="Segurança" value="Criptografia Ativa" />
                                <InfoCard icon={HardDrive} label="Tamanho" value={formatFileSize(fileSize)} />
                                <InfoCard icon={Clock} label="Origem" value={fileSource === 'patient' ? 'Arquivo do Paciente' : 'Arquivo Pessoal'} />
                            </div>

                            {/* Preview Area */}
                            <div className="flex-1 relative z-10 overflow-hidden">
                                {previewType && fileUrl ? (
                                    <div className="w-full h-full">
                                        {previewType === 'image' ? (
                                            <div className="w-full h-full flex items-center justify-center bg-zinc-950/50 p-4">
                                                <img
                                                    src={fileUrl}
                                                    alt={fileName}
                                                    className="max-w-full max-h-full object-contain rounded-xl"
                                                />
                                            </div>
                                        ) : previewType === 'pdf' ? (
                                            <iframe
                                                src={`${fileUrl}#toolbar=1&navpanes=0`}
                                                className="w-full h-full border-0"
                                                title={fileName}
                                            />
                                        ) : null}
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center p-12 text-center group">
                                        <div className="h-20 w-20 rounded-full bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                            <FileText className="h-8 w-8 text-zinc-600" />
                                        </div>
                                        <h4 className="text-lg font-bold text-white mb-2">Visualização Prévia Não Disponível</h4>
                                        <p className="text-sm text-zinc-500 max-w-xs mb-8">Este formato de arquivo requer download ou abertura em aba externa.</p>
                                    </div>
                                )}
                            </div>

                            {/* Action Bar */}
                            <div className="px-8 py-5 border-t border-white/5 flex items-center justify-end gap-3 relative z-10">
                                {fileUrl && (
                                    <>
                                        <a href={fileUrl} download={fileName}>
                                            <Button className="h-11 px-6 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold uppercase tracking-tight text-[10px] border border-white/10">
                                                <Download className="mr-2 h-4 w-4" /> Baixar
                                            </Button>
                                        </a>
                                        <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                                            <Button className="h-11 px-6 rounded-xl bg-white text-black hover:bg-zinc-200 font-bold uppercase tracking-tight text-[10px]">
                                                <ExternalLink className="mr-2 h-4 w-4" /> Abrir Externamente
                                            </Button>
                                        </a>
                                    </>
                                )}
                            </div>

                            <style>{`
                                .custom-scrollbar::-webkit-scrollbar {
                                    width: 6px;
                                }
                                .custom-scrollbar::-webkit-scrollbar-track {
                                    background: transparent;
                                }
                                .custom-scrollbar::-webkit-scrollbar-thumb {
                                    background: rgba(255, 255, 255, 0.05);
                                    border-radius: 10px;
                                }
                                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                                    background: rgba(255, 255, 255, 0.1);
                                }
                            `}</style>
                        </motion.div>
                    )}
                </AnimatePresence>
            </DialogContent>
        </Dialog>
    );
};

const InfoCard = ({ icon: Icon, label, value }: { icon: any, label: string, value: string }) => (
    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-zinc-600">
            <Icon size={12} />
            <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
        </div>
        <span className="text-[11px] font-bold text-zinc-300">{value}</span>
    </div>
);